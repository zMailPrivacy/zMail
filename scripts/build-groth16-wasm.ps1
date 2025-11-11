Write-Host "========================================"
Write-Host "  Building Groth16 ZK-SNARK WASM"
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

# Navigate to WASM project
$wasmDir = "libs\zcash-wasm"
if (-not (Test-Path $wasmDir)) {
    Write-Host "ERROR: WASM project not found at $wasmDir" -ForegroundColor Red
    Write-Host "Creating directory structure..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $wasmDir -Force | Out-Null
    Write-Host "Please ensure Cargo.toml and src/lib.rs are in place" -ForegroundColor Yellow
    exit 1
}

Write-Host "Building WASM (this will take 15-45 minutes)..." -ForegroundColor Yellow
Write-Host "This is compiling librustzcash and all dependencies..." -ForegroundColor Yellow
Write-Host ""

Push-Location $wasmDir

try {
    # Build for web target
    wasm-pack build --target web --out-dir pkg
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Build failed" -ForegroundColor Red
        Write-Host "Common issues:" -ForegroundColor Yellow
        Write-Host "  1. Missing Visual Studio Build Tools (C++ compiler)"
        Write-Host "  2. Out of memory (WASM builds are memory-intensive)"
        Write-Host "  3. Network issues downloading dependencies"
        exit 1
    }
    
    # Copy to public directory
    Write-Host ""
    Write-Host "Copying WASM files to public directory..." -ForegroundColor Yellow
    $publicDir = "..\..\public\zcash-wasm"
    New-Item -ItemType Directory -Path $publicDir -Force | Out-Null
    Copy-Item -Path "pkg\*" -Destination $publicDir -Recurse -Force
    
    Write-Host ""
    Write-Host "✅ WASM build complete!" -ForegroundColor Green
    Write-Host "   Files copied to: public/zcash-wasm/" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. The code will automatically detect and use WASM"
    Write-Host "  2. Restart the app: npm run dev"
    Write-Host "  3. Try sending a transaction - it will use real Groth16 proofs!"
    
} catch {
    Write-Host "ERROR: Build failed with exception: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

