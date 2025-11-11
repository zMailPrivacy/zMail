#!/bin/bash

set -e

echo "Building zcash-wasm..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "Error: wasm-pack is not installed"
    echo "Install it with: cargo install wasm-pack"
    exit 1
fi

wasm-pack build --target web --out-dir pkg

echo "Build complete! Files are in pkg/"

