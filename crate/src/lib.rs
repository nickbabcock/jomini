use jomini::{
    ArrayReader, Encoding, ObjectReader, Operator, Scalar, TextTape, TextToken, Utf8Encoding,
    ValueReader, Windows1252Encoding,
};
use js_sys::{Array, Date};
use ser::SerTape;
use std::fmt::Write;
use wasm_bindgen::prelude::*;
mod op;
mod ser;

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

fn create_error_msg(err: &dyn std::error::Error) -> String {
    let mut msg = String::new();
    let _ = write!(msg, "{}", err);

    let mut ie = err.source();
    while let Some(cause) = ie {
        let _ = write!(msg, ". Caused by: {}", cause);
        ie = cause.source();
    }

    msg
}

fn data_to_js_date(data: &[u8]) -> Option<Date> {
    enum DateState {
        Empty,
        Year,
        Month,
        Day,
    }

    let mut state = DateState::Empty;
    let mut y = 0;
    let mut m = 0;
    let mut d = 0;
    let mut start = 0;
    let mut pos = 0;

    for &c in data {
        if c == b'.' {
            let span = Scalar::new(&data[start..pos]);
            if let Ok(x) = span.to_i64() {
                match state {
                    DateState::Empty => {
                        y = x as i32;
                        state = DateState::Year;
                    }
                    DateState::Year => {
                        m = x as i32 - 1;
                        state = DateState::Month;
                    }
                    DateState::Month => {
                        d = x as i32;
                        state = DateState::Day;
                    }
                    _ => {
                        return None;
                    }
                }
                start = pos + 1;
            } else {
                return None;
            }
        } else if c > b'9' || (c < b'0' && c != b'-') {
            return None;
        }

        pos += 1;
    }

    let span = Scalar::new(&data[start..pos]);
    span.to_u64().ok().and_then(|x| match state {
        DateState::Month => {
            let res = Date::new(&JsValue::from_f64(Date::utc(y as f64, m as f64)));
            res.set_utc_date(x as u32);
            Some(res)
        }
        DateState::Day => {
            let res = Date::new(&JsValue::from_f64(Date::utc(y as f64, m as f64)));
            res.set_utc_date(d as u32);
            res.set_utc_hours(x as u32);
            Some(res)
        }
        _ => None,
    })
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

    fn from_root(&self) -> JsValue {
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

        if let Some(x) = data_to_js_date(scalar.view_data()) {
            return x.into();
        }

        JsValue::from_str(reader.read_str().unwrap().as_ref())
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
                TextToken::End(_) | TextToken::Operator(_) => JsValue::null(),
            }
        }
    }

    fn create_object(&self, mut reader: ObjectReader<'a, 'b, E>) -> Object {
        let result = Object::new();
        while let Some((key, mut entries)) = reader.next_fields() {
            let key_js = JsValue::from_str(key.read_str().as_ref());

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
                Ok(io.from_root())
            }
            _ => {
                let io = InObjectifier::new(&self.tape, Utf8Encoding::new());
                Ok(io.from_root())
            }
        }
    }

    /// Convert the entire document into a JSON string
    pub fn json(&self, pretty: bool) -> Result<JsValue, JsValue> {
        match self.encoding.as_string().as_deref() {
            Some("windows1252") => {
                let reader = SerTape::new(&self.tape, Windows1252Encoding::new());
                let result = if pretty {
                    serde_json::to_string_pretty(&reader)
                } else {
                    serde_json::to_string(&reader)
                };

                let val = JsValue::from_str(&result.unwrap());
                Ok(val)
            }
            _ => {
                let reader = SerTape::new(&self.tape, Utf8Encoding::new());
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

    let tape =
        TextTape::from_slice(data).map_err(|e| JsValue::from_str(create_error_msg(&e).as_str()))?;

    // Cast away the lifetime so that we can store it in a wasm-bindgen compatible struct
    let tape: TextTape<'static> = unsafe { std::mem::transmute(tape) };

    Ok(Query {
        tape,
        encoding,
        _backing_data: d,
    })
}
