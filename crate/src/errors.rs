use std::fmt::Write;
use wasm_bindgen::JsValue;

pub fn create_error_msg<E>(err: E) -> String
where
    E: std::error::Error,
{
    let mut msg = String::new();
    let _ = write!(msg, "{}", err);

    let mut ie = err.source();
    while let Some(cause) = ie {
        let _ = write!(msg, ". Caused by: {}", cause);
        ie = cause.source();
    }

    msg
}

pub fn create_error_val<E>(err: E) -> JsValue
where
    E: std::error::Error,
{
    JsValue::from_str(create_error_msg(err).as_str())
}
