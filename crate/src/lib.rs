use jomini::{Encoding, Operator, Scalar, TextTape, TextToken, Utf8Encoding, Windows1252Encoding};
use js_sys::{Array, Date, Object, Reflect};
use std::{borrow::Cow, fmt::Write, ops::Range};
use wasm_bindgen::prelude::*;

/// wee_alloc saved ~6kb in the wasm payload and there was no
/// measurable performance difference
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

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
            if let Ok(x) = span.to_u64() {
                match state {
                    DateState::Empty => {
                        y = x as u32;
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
        } else if c > b'9' || c < b'0' {
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
    tokens: &'b [TextToken<'a>],
    seen: Vec<bool>,
    encoding: E,
}

impl<'a, 'b, E: Encoding> InObjectifier<'a, 'b, E> {
    fn new(tokens: &'b [TextToken<'a>], encoding: E) -> Self {
        let seen: Vec<bool> = vec![false; tokens.len()];
        Self {
            tokens,
            seen,
            encoding,
        }
    }

    fn token_as_str<'d, 'c: 'd>(&self, token: &'d TextToken<'c>) -> Cow<'c, str> {
        if let TextToken::Scalar(s) = token {
            self.encoding.decode(s.view_data())
        } else {
            Cow::Borrowed("__unknown")
        }
    }

    fn scalar_to_js_value(&self, scalar: &Scalar) -> JsValue {
        if let Ok(x) = scalar.to_bool() {
            return JsValue::from_bool(x);
        }

        if let Ok(x) = scalar.to_f64() {
            return JsValue::from_f64(x);
        }

        if let Some(x) = data_to_js_date(scalar.view_data()) {
            return x.into();
        }

        JsValue::from_str(self.encoding.decode(scalar.view_data()).as_ref())
    }

    fn create_array(&mut self, range: Range<usize>) -> JsValue {
        if range.end - range.start == 0 {
            // Surprise! You thought we'd be creating an array. The only reason
            // we aren't for empty arrays is that it is ambiguous whether it is
            // an empty array or object. To keep with previous jomini behavior,
            // we maintain that empty arrays / objects are written as objects.
            return Object::new().into();
        }

        let arr = Array::new();
        let mut tape_idx = range.start;
        let end_idx = range.end;

        while tape_idx < end_idx {
            let v = self.token_to_value(tape_idx);
            tape_idx = skip_next_idx(&self.tokens, tape_idx);
            arr.push(&v);
        }

        arr.into()
    }

    fn create_from_header(&mut self, key: &Scalar, idx: usize) -> Object {
        let result = Object::new();

        let key = JsValue::from_str(self.encoding.decode(key.view_data()).as_ref());
        let val = self.token_to_value(idx);

        let _ = Reflect::set(&result, &key, &val);
        result
    }

    fn token_to_value(&mut self, val_idx: usize) -> JsValue {
        match &self.tokens[val_idx] {
            TextToken::Scalar(s) => self.scalar_to_js_value(s),
            TextToken::Array(end_idx) => self.create_array(val_idx + 1..*end_idx),
            TextToken::Object(end_idx) | TextToken::HiddenObject(end_idx) => {
                self.create_object(val_idx + 1..*end_idx).into()
            }
            TextToken::Header(s) => self.create_from_header(s, val_idx + 1).into(),
            TextToken::Operator(op) => self.create_operator_object(*op, val_idx).into(),
            TextToken::End(_) => JsValue::null(),
        }
    }

    fn create_operator_object(&mut self, op: Operator, idx: usize) -> Object {
        let result = Object::new();
        let val = self.token_to_value(idx + 1);

        let dsc = match op {
            Operator::LessThan => "LESS_THAN",
            Operator::LessThanEqual => "LESS_THAN_EQUAL",
            Operator::GreaterThan => "GREATER_THAN",
            Operator::GreaterThanEqual => "GREATER_THAN_EQUAL",
        };

        let _ = Reflect::set(&result, &JsValue::from_str(dsc), &val);
        result
    }

    fn create_object(&mut self, range: Range<usize>) -> Object {
        let result = Object::new();
        let mut tape_idx = range.start;
        let end_idx = range.end;
        let mut values: Vec<usize> = Vec::new();

        while tape_idx < end_idx {
            if !self.seen[tape_idx] {
                let key = &self.tokens[tape_idx];
                self.seen[tape_idx] = true;
                values.push(tape_idx + 1);

                let mut value_idx = tape_idx + 1;
                while value_idx < end_idx {
                    let next_key_idx = skip_next_idx(&self.tokens, value_idx);
                    let next_key = self.tokens.get(next_key_idx);
                    if next_key.map_or(false, |next_key| next_key == key) {
                        self.seen[next_key_idx] = true;
                        values.push(next_key_idx + 1)
                    } else {
                        break;
                    }
                    value_idx = next_key_idx + 1;
                }

                let key_js = JsValue::from_str(self.token_as_str(key).as_ref());
                let value_js = if values.len() == 1 {
                    self.token_to_value(values[0])
                } else {
                    let arr = Array::new_with_length(values.len() as u32);
                    for (i, &idx) in values.iter().enumerate() {
                        let v = self.token_to_value(idx);
                        arr.set(i as u32, v);
                    }
                    arr.into()
                };

                let _ = Reflect::set(&result, &key_js, &value_js);
            }

            tape_idx = skip_next_idx(&self.tokens, tape_idx + 1);
            values.clear();
        }

        result
    }

    fn find_query_in<'c>(
        &mut self,
        needle: &str,
        mut rest: impl Iterator<Item = &'c str>,
        range: Range<usize>,
    ) -> JsValue {
        let mut tape_idx = range.start;
        let end_idx = range.end;
        let mut values: Vec<usize> = Vec::new();
        while tape_idx < end_idx {
            let key_token = &self.tokens[tape_idx];
            let key = self.token_as_str(key_token);
            if key.as_ref() == needle {
                if let Some(nested_needle) = rest.next() {
                    let rng = match self.tokens[tape_idx + 1] {
                        TextToken::Array(x) | TextToken::Object(x) | TextToken::HiddenObject(x) => {
                            tape_idx + 2..x
                        }
                        TextToken::Header(_) => match self.tokens[tape_idx + 2] {
                            TextToken::Array(x)
                            | TextToken::Object(x)
                            | TextToken::HiddenObject(x) => tape_idx + 3..x,
                            _ => tape_idx..tape_idx,
                        },
                        _ => tape_idx..tape_idx,
                    };
                    return self.find_query_in(nested_needle, rest, rng);
                }

                values.push(tape_idx + 1);

                let mut value_idx = tape_idx + 1;
                while value_idx < end_idx {
                    let next_key_idx = skip_next_idx(&self.tokens, value_idx);
                    if next_key_idx >= end_idx {
                        break;
                    }

                    let next_key = &self.tokens[next_key_idx];
                    if next_key == key_token {
                        values.push(next_key_idx + 1)
                    }

                    value_idx = next_key_idx + 1;
                }

                let value_js = if values.len() == 1 {
                    self.token_to_value(values[0])
                } else {
                    let arr = Array::new_with_length(values.len() as u32);
                    for (i, &idx) in values.iter().enumerate() {
                        let v = self.token_to_value(idx);
                        arr.set(i as u32, v);
                    }
                    arr.into()
                };

                return value_js;
            }

            tape_idx = skip_next_idx(&self.tokens, tape_idx + 1);
            values.clear();
        }

        JsValue::undefined()
    }

    fn find_query(&mut self, query: &str) -> JsValue {
        let mut q = query.split('/').skip(1);
        let root = if let Some(x) = q.next() {
            x
        } else {
            return JsValue::undefined();
        };

        self.find_query_in(root, q, 0..self.tokens.len())
    }
}

fn skip_next_idx(tokens: &[TextToken], idx: usize) -> usize {
    match tokens[idx] {
        TextToken::Array(x) | TextToken::Object(x) | TextToken::HiddenObject(x) => x + 1,
        TextToken::Operator(_) => idx + 2,
        TextToken::Header(_) => match tokens[idx + 1] {
            TextToken::Array(x) | TextToken::Object(x) | TextToken::HiddenObject(x) => x + 1,
            _ => idx + 2,
        },
        _ => idx + 1,
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
    pub fn root(&self) -> Result<Object, JsValue> {
        match self.encoding.as_string().as_deref() {
            Some("windows1252") => {
                let len = self.tape.tokens().len();
                let mut io = InObjectifier::new(self.tape.tokens(), Windows1252Encoding::new());
                Ok(io.create_object(0..len))
            }
            _ => {
                let len = self.tape.tokens().len();
                let mut io = InObjectifier::new(self.tape.tokens(), Utf8Encoding::new());
                Ok(io.create_object(0..len))
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
                let mut io = InObjectifier::new(self.tape.tokens(), Windows1252Encoding::new());
                Ok(io.find_query(query))
            }
            _ => {
                let mut io = InObjectifier::new(self.tape.tokens(), Utf8Encoding::new());
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
