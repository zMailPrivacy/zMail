Write-Host "========================================"
Write-Host "  Building librustzcash WASM"
Write-Host "========================================"
Write-Host ""

# Check if Rust is installed
$rustInstalled = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $rustInstalled) {
    Write-Host "ERROR: Rust is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Rust first:"
    Write-Host "  1. Download from: https://rustup.rs/"
    Write-Host "  2. Run: rustup-init.exe"
    Write-Host "  3. Restart terminal and run this script again"
    Write-Host ""
    exit 1
}

# Check if wasm-pack is installed
$wasmPackInstalled = Get-Command wasm-pack -ErrorAction SilentlyContinue
if (-not $wasmPackInstalled) {
    Write-Host "Installing wasm-pack..." -ForegroundColor Yellow
    cargo install wasm-pack
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install wasm-pack" -ForegroundColor Red
        exit 1
    }
}

# Create directory for librustzcash
$libDir = "libs\librustzcash"
if (-not (Test-Path $libDir)) {
    Write-Host "Cloning librustzcash..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "libs" -Force | Out-Null
    git clone https://github.com/zcash/librustzcash.git $libDir
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to clone librustzcash" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Building WASM (this may take 10-30 minutes)..." -ForegroundColor Yellow
Push-Location $libDir

try {
    wasm-pack build --target web --out-dir pkg
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to build WASM" -ForegroundColor Red
        exit 1
    }
    
    # Copy to public directory
    Write-Host "Copying WASM files to public directory..." -ForegroundColor Yellow
    $publicDir = "..\..\public\zcash-wasm"
    New-Item -ItemType Directory -Path $publicDir -Force | Out-Null
    Copy-Item -Path "pkg\*" -Destination $publicDir -Recurse -Force
    
    Write-Host ""
    Write-Host "✅ WASM build complete!" -ForegroundColor Green
    Write-Host "   Files copied to: public/zcash-wasm/" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Update lib/zcash/browser-transaction-builder.ts"
    Write-Host "  2. Implement buildWithWasm() method"
    Write-Host "  3. Test transaction building"
    
} finally {
    Pop-Location
}

