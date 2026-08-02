mod calendar;
mod model;
mod parse;

pub use calendar::SimpleDate;
pub use model::{Group, ParsedCapture, Priority, RepeatRule};
pub use parse::{parse, ParseInput};

use wasm_bindgen::prelude::*;

/// JS entry point. `known_list_ids` is a JS array of strings (project/list
/// ids the app currently knows about) passed through as a `JsValue` and
/// decoded with serde so we don't depend on wasm-bindgen's own `Vec<String>`
/// ABI support.
#[wasm_bindgen]
pub fn parse_capture(
    text: &str,
    today_y: i32,
    today_m: u32,
    today_d: u32,
    known_list_ids: JsValue,
) -> Result<JsValue, JsValue> {
    let list_ids: Vec<String> =
        serde_wasm_bindgen::from_value(known_list_ids).unwrap_or_default();
    let result = parse::parse(ParseInput {
        text,
        today: SimpleDate::new(today_y, today_m, today_d),
        known_list_ids: &list_ids,
    });
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}
