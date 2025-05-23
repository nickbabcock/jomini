use jomini::{text::Operator, TextWriter};
use js_sys::Date;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmWriter {
    pub(crate) writer: TextWriter<Vec<u8>>,
}

#[wasm_bindgen]
impl WasmWriter {
    pub fn inner(self) -> Vec<u8> {
        self.writer.into_inner()
    }

    pub fn write_object_start(&mut self) -> Result<(), JsError> {
        self.writer.write_object_start().map_err(JsError::from)
    }

    pub fn start_mixed_mode(&mut self) {
        self.writer.start_mixed_mode()
    }

    pub fn write_array_start(&mut self) -> Result<(), JsError> {
        self.writer.write_array_start().map_err(JsError::from)
    }

    pub fn write_end(&mut self) -> Result<(), JsError> {
        self.writer.write_end().map_err(JsError::from)
    }

    pub fn write_bool(&mut self, data: bool) -> Result<(), JsError> {
        self.writer.write_bool(data).map_err(JsError::from)
    }

    pub fn write_operator(&mut self, data: &str) -> Result<(), JsError> {
        let res = match data {
            ">" => self.writer.write_operator(Operator::GreaterThan),
            ">=" => self.writer.write_operator(Operator::GreaterThanEqual),
            "<" => self.writer.write_operator(Operator::LessThan),
            "=" => self.writer.write_operator(Operator::Equal),
            _ => self.writer.write_operator(Operator::LessThanEqual),
        };

        res.map_err(JsError::from)
    }

    pub fn write_unquoted(&mut self, data: &[u8]) -> Result<(), JsError> {
        self.writer.write_unquoted(data).map_err(JsError::from)
    }

    pub fn write_quoted(&mut self, data: &[u8]) -> Result<(), JsError> {
        self.writer.write_quoted(data).map_err(JsError::from)
    }

    pub fn write_integer(&mut self, data: i32) -> Result<(), JsError> {
        self.writer.write_i32(data).map_err(JsError::from)
    }

    pub fn write_u64(&mut self, data: u64) -> Result<(), JsError> {
        self.writer.write_u64(data).map_err(JsError::from)
    }

    pub fn write_f32(&mut self, data: f32) -> Result<(), JsError> {
        self.writer.write_f32(data).map_err(JsError::from)
    }

    pub fn write_f64(&mut self, data: f64) -> Result<(), JsError> {
        self.writer.write_f64(data).map_err(JsError::from)
    }

    pub fn write_header(&mut self, data: &[u8]) -> Result<(), JsError> {
        self.writer.write_header(data).map_err(JsError::from)
    }

    pub fn write_date(&mut self, data: Date, hour: bool) -> Result<(), JsError> {
        if hour {
            write!(
                self.writer,
                "{}.{}.{}.{}",
                data.get_utc_full_year(),
                data.get_utc_month() + 1,
                data.get_utc_date(),
                data.get_utc_hours() + 1,
            )
            .map_err(JsError::from)
        } else {
            write!(
                self.writer,
                "{}.{}.{}",
                data.get_utc_full_year(),
                data.get_utc_month() + 1,
                data.get_utc_date()
            )
            .map_err(JsError::from)
        }
    }
}
