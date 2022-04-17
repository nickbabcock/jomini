use jomini::{
    common::{PdsDate, RawDate},
    ArrayReader, Encoding, ObjectReader, Operator, ScalarReader, TextTape, TextToken,
    TextWriterBuilder, Utf8Encoding, ValueReader, Windows1252Encoding,
};
use js_sys::{Array, Date};
use ser::{DisambiguateMode, SerTape};
use wasm_bindgen::prelude::*;
mod errors;
mod op;
mod ser;
mod write;

/// wee_alloc saved ~6kb in the wasm payload and there was no
/// measurable performance difference
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// Custom bindings to avoid using fallible `Reflect` for plain objects.
/// Lifted from serde-wasm-bindgen where it brought a nice performance boost:
/// https://github.com/cloudflare/serde-wasm-bindgen/commit/f763ead4b47d6cda5873d18f276be4fa6712f6a6
#[wasm_bindgen]
extern "C" {
    type Object;

    #[wasm_bindgen(constructor)]
    fn new() -> Object;

    #[wasm_bindgen(method, indexing_setter)]
    fn set(this: &Object, key: JsValue, value: JsValue);
}

fn data_to_js_date(data: &[u8]) -> Option<Date> {
    let date = RawDate::parse(data).ok()?;
    let utc = Date::utc(f64::from(date.year()), f64::from(date.month() - 1));
    let res = Date::new(&JsValue::from_f64(utc));
    res.set_utc_date(date.day() as u32);
    if date.has_hour() {
        res.set_utc_hours(u32::from(date.hour()) - 1);
    }
    Some(res)
}

// We skip the header for jomini
fn skip_header(data: &[u8]) -> &[u8] {
    for (pos, &c) in data.iter().enumerate() {
        if c == b'=' {
            return data;
        } else if c.is_ascii_control() {
            return &data[pos..];
        }
    }

    data
}

#[derive(Debug)]
struct InObjectifier<'a, 'b, E> {
    reader: ObjectReader<'a, 'b, E>,
}

impl<'a, 'b, E: Encoding> InObjectifier<'a, 'b, E>
where
    E: Clone,
{
    fn new(tape: &'b TextTape<'a>, encoding: E) -> Self {
        let reader = ObjectReader::new(tape, encoding);

        Self { reader }
    }

    fn create_from_root(&self) -> JsValue {
        self.create_object(self.reader.clone()).into()
    }

    fn scalar_to_js_value(&self, reader: ValueReader<'a, 'b, E>) -> JsValue {
        let scalar = reader.read_scalar().unwrap();
        if let Ok(x) = scalar.to_bool() {
            return JsValue::from_bool(x);
        }

        if let Ok(x) = scalar.to_f64() {
            return JsValue::from_f64(x);
        }

        if let Some(x) = data_to_js_date(scalar.as_bytes()) {
            return x.into();
        }

        JsValue::from_str(reader.read_str().unwrap().as_ref())
    }

    fn parameter_to_js(&self, reader: ScalarReader<'a, E>, defined: bool) -> JsValue {
        let body = reader.read_str();

        let mut result = String::with_capacity(body.len() + 3);
        result.push('[');

        if !defined {
            result.push('!');
        }

        result.push_str(body.as_ref());
        result.push(']');

        JsValue::from_str(&result)
    }

    fn create_array(&self, mut reader: ArrayReader<'a, 'b, E>) -> JsValue {
        let len = reader.values_len();
        if len == 0 {
            // Surprise! You thought we'd be creating an array. The only reason
            // we aren't for empty arrays is that it is ambiguous whether it is
            // an empty array or object. To keep with previous jomini behavior,
            // we maintain that empty arrays / objects are written as objects.
            return Object::new().into();
        }

        let arr = Array::new_with_length(len as u32);
        let mut pos = 0;
        while let Some(x) = reader.next_value() {
            let v = self.entry_to_js(None, x);
            arr.set(pos, v);
            pos += 1;
        }

        arr.into()
    }

    fn create_from_header(&self, mut veader: ArrayReader<'a, 'b, E>) -> Object {
        let result = Object::new();

        let key = JsValue::from_str(veader.next_value().unwrap().read_str().unwrap().as_ref());
        let val = self.entry_to_js(None, veader.next_value().unwrap());

        result.set(key, val);
        result
    }

    fn create_operator_object(&self, op: Operator, veader: ValueReader<'a, 'b, E>) -> Object {
        let result = Object::new();
        let val = self.entry_to_js(None, veader);
        result.set(JsValue::from_str(op::operator_name(op)), val);
        result
    }

    fn entry_to_js(&self, op: Option<Operator>, veader: ValueReader<'a, 'b, E>) -> JsValue {
        if let Some(op) = op {
            self.create_operator_object(op, veader).into()
        } else {
            match veader.token() {
                TextToken::Quoted(_) | TextToken::Unquoted(_) => self.scalar_to_js_value(veader),
                TextToken::Array(_) => self.create_array(veader.read_array().unwrap()),
                TextToken::Object(_) | TextToken::HiddenObject(_) => {
                    self.create_object(veader.read_object().unwrap()).into()
                }
                TextToken::Header(_) => {
                    self.create_from_header(veader.read_array().unwrap()).into()
                }

                // parameters should not be seen as values
                TextToken::End(_)
                | TextToken::Operator(_)
                | TextToken::Parameter(_)
                | TextToken::UndefinedParameter(_) => JsValue::null(),
            }
        }
    }

    fn scalar_to_key(&self, reader: ScalarReader<'a, E>) -> JsValue {
        match reader.token() {
            TextToken::Parameter(_) => self.parameter_to_js(reader, true),
            TextToken::UndefinedParameter(_) => self.parameter_to_js(reader, false),
            _ => JsValue::from_str(reader.read_str().as_ref()),
        }
    }

    fn create_object(&self, mut reader: ObjectReader<'a, 'b, E>) -> Object {
        let result = Object::new();
        while let Some((key, mut entries)) = reader.next_fields() {
            let key_js = self.scalar_to_key(key);

            let value_js = if entries.len() == 1 {
                let (op, value) = entries.pop().unwrap();
                self.entry_to_js(op, value)
            } else {
                let arr = Array::new_with_length(entries.len() as u32);
                for (i, (op, value)) in entries.drain(..).enumerate() {
                    let v = self.entry_to_js(op, value);
                    arr.set(i as u32, v);
                }
                arr.into()
            };

            result.set(key_js, value_js);
        }

        if let Some(trailer) = reader.at_trailer() {
            result.set(JsValue::from_str("trailer"), self.create_array(trailer));
        }

        result
    }

    fn find_query_in<'c>(
        &mut self,
        needle: &str,
        mut rest: impl Iterator<Item = &'c str>,
        reader: &mut ObjectReader<'a, 'b, E>,
    ) -> JsValue {
        let mut values: Vec<JsValue> = Vec::new();
        let nested_need = rest.next();
        while let Some((key, op, value)) = reader.next_field() {
            if key.read_str() != needle {
                continue;
            }

            if let Some(nested_needle) = nested_need {
                let mut nreader = value.read_object().unwrap();
                return self.find_query_in(nested_needle, rest, &mut nreader);
            }

            let lvalue = self.entry_to_js(op, value);
            values.push(lvalue);
        }

        if values.is_empty() {
            JsValue::undefined()
        } else if values.len() == 1 {
            values.pop().unwrap()
        } else {
            let arr = Array::new_with_length(values.len() as u32);
            for (i, val) in values.drain(..).enumerate() {
                arr.set(i as u32, val);
            }
            arr.into()
        }
    }

    fn find_query(&mut self, query: &str) -> JsValue {
        let mut q = query.split('/').skip(1);
        let root = if let Some(x) = q.next() {
            x
        } else {
            return JsValue::undefined();
        };

        let mut cl = self.reader.clone();
        self.find_query_in(root, q, &mut cl)
    }
}

/// Holds the parsed data for a short period of time, allowing a user to extract all or a subset of the
/// parsed document
#[wasm_bindgen]
pub struct Query {
    // We need this field so that our referenced data isn't reclaimed
    _backing_data: Vec<u8>,
    tape: TextTape<'static>,
    encoding: JsValue,
}

#[wasm_bindgen]
impl Query {
    /// Convert the entire document into an object
    pub fn root(&self) -> Result<JsValue, JsValue> {
        match self.encoding.as_string().as_deref() {
            Some("windows1252") => {
                let io = InObjectifier::new(&self.tape, Windows1252Encoding::new());
                Ok(io.create_from_root())
            }
            _ => {
                let io = InObjectifier::new(&self.tape, Utf8Encoding::new());
                Ok(io.create_from_root())
            }
        }
    }

    /// Convert the entire document into a JSON string
    pub fn json(&self, pretty: bool, disambiguate: &str) -> Result<JsValue, JsValue> {
        let disam_mode = match disambiguate {
            "keys" => DisambiguateMode::Keys,
            "typed" => DisambiguateMode::Typed,
            _ => DisambiguateMode::None,
        };

        match self.encoding.as_string().as_deref() {
            Some("windows1252") => {
                let reader = SerTape::new(&self.tape, Windows1252Encoding::new(), disam_mode);
                let result = if pretty {
                    serde_json::to_string_pretty(&reader)
                } else {
                    serde_json::to_string(&reader)
                };

                let val = JsValue::from_str(&result.unwrap());
                Ok(val)
            }
            _ => {
                let reader = SerTape::new(&self.tape, Utf8Encoding::new(), disam_mode);
                let result = if pretty {
                    serde_json::to_string_pretty(&reader)
                } else {
                    serde_json::to_string(&reader)
                };

                let val = JsValue::from_str(&result.unwrap());
                Ok(val)
            }
        }
    }

    /// Return the object, array, or value pointed at by the query. Uses a format similar to JSON pointer:
    ///
    /// ```ignore
    /// /player
    /// /countries/ENG/prestige
    /// ```
    pub fn at(&self, query: &str) -> Result<JsValue, JsValue> {
        match self.encoding.as_string().as_deref() {
            Some("windows1252") => {
                let mut io = InObjectifier::new(&self.tape, Windows1252Encoding::new());
                Ok(io.find_query(query))
            }
            _ => {
                let mut io = InObjectifier::new(&self.tape, Utf8Encoding::new());
                Ok(io.find_query(query))
            }
        }
    }
}

#[wasm_bindgen]
pub fn parse_text(d: Vec<u8>, encoding: JsValue) -> Result<Query, JsValue> {
    let data = skip_header(d.as_slice());

    let tape = TextTape::from_slice(data).map_err(errors::create_error_val)?;

    // Cast away the lifetime so that we can store it in a wasm-bindgen compatible struct
    let tape: TextTape<'static> = unsafe { std::mem::transmute(tape) };

    Ok(Query {
        tape,
        encoding,
        _backing_data: d,
    })
}

#[wasm_bindgen]
pub fn write_text() -> Result<write::WasmWriter, JsValue> {
    let sink = Vec::new();
    let writer = TextWriterBuilder::new().from_writer(sink);
    Ok(write::WasmWriter { writer })
}
