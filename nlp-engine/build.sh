#!/usr/bin/env bash
# Builds the nlp-engine Rust crate to wasm and generates the JS/TS glue with
# wasm-bindgen (no wasm-pack required). Output lands in src/nlp/generated,
# which Vite imports as a normal ES module + wasm asset.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v wasm-bindgen >/dev/null 2>&1; then
  echo "error: wasm-bindgen CLI not found." >&2
  echo "  install with: cargo install wasm-bindgen-cli --version \$(cargo pkgid wasm-bindgen | cut -d'#' -f2) --locked" >&2
  exit 1
fi

rustup target add wasm32-unknown-unknown >/dev/null 2>&1 || true

cargo build --release --target wasm32-unknown-unknown

OUT_DIR="../src/nlp/generated"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

wasm-bindgen --target web --out-dir "$OUT_DIR" --out-name nlp_engine \
  target/wasm32-unknown-unknown/release/nlp_engine.wasm

echo "wasm-bindgen output written to nlp-engine/$OUT_DIR"
