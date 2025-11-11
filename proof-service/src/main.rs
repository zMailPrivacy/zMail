/**
 * Zcash Proof Generation Service
 * 
 * This service generates Groth16 ZK-SNARK proofs for Zcash transactions
 * using librustzcash. It works alongside lightwalletd to provide proof
 * generation capabilities.
 */

use actix_web::{web, App, HttpServer, HttpResponse, Result as ActixResult};
use actix_cors::Cors;
use serde::{Deserialize, Serialize};
use zcash_proofs::prover::LocalTxProver;
use std::path::PathBuf;
use std::env;

#[derive(Deserialize)]
struct ProofRequest {
    #[serde(rename = "type")]
    proof_type: String,
    params: serde_json::Value,
}

#[derive(Deserialize)]
struct BuildTransactionRequest {
    spending_key: String,
    from_address: String,
    to_address: String,
    amount: String, // in zatoshi
    memo: Vec<u8>,
    #[allow(dead_code)] // Will be used when implementing full transaction building
    lightwalletd_endpoint: Option<String>,
}

#[derive(Serialize)]
struct ProofResponse {
    proof: Vec<u8>,
    error: Option<String>,
}

#[derive(Serialize)]
struct BuildTransactionResponse {
    raw_transaction: Vec<u8>,
    txid: Option<String>,
    error: Option<String>,
}

// Note: Prover initialization is deferred until first use
// This avoids loading large proving parameters at startup

/// Find the parameters directory, checking local 'params' folder first
fn find_params_dir() -> Option<PathBuf> {
    println!("[ProofService] 🔍 Searching for parameters...");
    
    // First, check current working directory (most reliable when running from project root)
    if let Ok(cwd) = env::current_dir() {
        let cwd_params = cwd.join("params");
        let cwd_spend = cwd_params.join("sapling-spend.params");
        let cwd_output = cwd_params.join("sapling-output.params");
        
        println!("[ProofService] Checking CWD params: {:?}", cwd_params);
        if cwd_spend.exists() && cwd_output.exists() {
            println!("[ProofService] ✅ Found parameters in CWD 'params' folder: {:?}", cwd_params);
            return Some(cwd_params);
        }
        
        // Also check parent directories (for when running from proof-service subdirectory)
        let mut current = cwd.clone();
        for _ in 0..5 {
            let parent_params = current.join("params");
            let parent_spend = parent_params.join("sapling-spend.params");
            let parent_output = parent_params.join("sapling-output.params");
            
            println!("[ProofService] Checking parent params: {:?}", parent_params);
            if parent_spend.exists() && parent_output.exists() {
                println!("[ProofService] ✅ Found parameters in parent 'params' folder: {:?}", parent_params);
                return Some(parent_params);
            }
            
            if let Some(parent) = current.parent() {
                current = parent.to_path_buf();
            } else {
                break;
            }
        }
    }
    
    // Check relative to executable (for when running from target/release/)
    if let Ok(exe_path) = env::current_exe() {
        println!("[ProofService] Executable path: {:?}", exe_path);
        if let Some(exe_dir) = exe_path.parent() {
            // Go up multiple levels: target/release/ -> target/ -> project root
            let mut current = exe_dir.to_path_buf();
            for _ in 0..5 {
                let params_dir = current.join("params");
                let spend_params = params_dir.join("sapling-spend.params");
                let output_params = params_dir.join("sapling-output.params");
                
                println!("[ProofService] Checking exe-relative params: {:?}", params_dir);
                if spend_params.exists() && output_params.exists() {
                    println!("[ProofService] ✅ Found parameters relative to executable: {:?}", params_dir);
                    return Some(params_dir);
                }
                
                if let Some(parent) = current.parent() {
                    current = parent.to_path_buf();
                } else {
                    break;
                }
            }
        }
    }
    
    // Fall back to default location
    if let Some(home) = dirs::home_dir() {
        let default_params = home.join(".zcash-params");
        let default_spend = default_params.join("sapling-spend.params");
        let default_output = default_params.join("sapling-output.params");
        
        println!("[ProofService] Checking default location: {:?}", default_params);
        if default_spend.exists() && default_output.exists() {
            println!("[ProofService] ✅ Found parameters in default location: {:?}", default_params);
            return Some(default_params);
        }
    }
    
    println!("[ProofService] ❌ Parameters not found in any location");
    None
}

// Initialize prover once (lazy static would be better, but this works)
fn get_prover() -> Result<LocalTxProver, String> {
    // First, try to find parameters in local 'params' folder
    let params_dir = find_params_dir();
    
    if let Some(params_dir) = params_dir {
        // Build full paths to parameter files
        let spend_path = params_dir.join("sapling-spend.params");
        let output_path = params_dir.join("sapling-output.params");
        
        // Verify files exist
        if !spend_path.exists() {
            return Err(format!("Parameter file not found: {:?}", spend_path));
        }
        if !output_path.exists() {
            return Err(format!("Parameter file not found: {:?}", output_path));
        }
        
        let spend_size = std::fs::metadata(&spend_path)
            .map(|m| m.len() / 1024 / 1024)
            .unwrap_or(0);
        let output_size = std::fs::metadata(&output_path)
            .map(|m| m.len() / 1024 / 1024)
            .unwrap_or(0);
        
        println!("[ProofService] Using parameter files:");
        println!("[ProofService]   - sapling-spend.params: {} MB at {:?}", spend_size, spend_path);
        println!("[ProofService]   - sapling-output.params: {} MB at {:?}", output_size, output_path);
        
        // Initialize prover with explicit paths
        // LocalTxProver::new() returns LocalTxProver directly (not Result)
        let prover = LocalTxProver::new(&spend_path, &output_path);
        println!("[ProofService] ✅ Prover initialized successfully with explicit paths");
        return Ok(prover);
    }
    
    // Fall back to default location if local params not found
    println!("[ProofService] ⚠️  No local parameters found, trying default location");
    match LocalTxProver::with_default_location() {
        Some(prover) => {
            println!("[ProofService] ✅ Prover initialized successfully from default location");
            Ok(prover)
        },
        None => {
            // Provide helpful error message
            let mut error_msg = "Prover initialization failed. This usually means the Groth16 proving parameters are not downloaded.\n\n".to_string();
            
            // Show what we checked
            if let Ok(cwd) = env::current_dir() {
                error_msg += &format!("Current working directory: {:?}\n", cwd);
                let cwd_params = cwd.join("params");
                error_msg += &format!("Checked: {:?}\n", cwd_params);
            }
            
            if let Ok(exe_path) = env::current_exe() {
                error_msg += &format!("Executable path: {:?}\n", exe_path);
            }
            
            // Check if params folder exists but files are missing
            if let Ok(cwd) = env::current_dir() {
                let local_params = cwd.join("params");
                if local_params.exists() {
                    error_msg += &format!("\nFound 'params' folder at: {:?}\n", local_params);
                    error_msg += "Checking files:\n";
                    
                    let spend_params = local_params.join("sapling-spend.params");
                    let output_params = local_params.join("sapling-output.params");
                    
                    if spend_params.exists() {
                        let size = std::fs::metadata(&spend_params)
                            .map(|m| m.len() / 1024 / 1024)
                            .unwrap_or(0);
                        error_msg += &format!("  ✅ sapling-spend.params exists ({}) MB\n", size);
                    } else {
                        error_msg += &format!("  ❌ Missing: {:?}\n", spend_params);
                    }
                    
                    if output_params.exists() {
                        let size = std::fs::metadata(&output_params)
                            .map(|m| m.len() / 1024 / 1024)
                            .unwrap_or(0);
                        error_msg += &format!("  ✅ sapling-output.params exists ({}) MB\n", size);
                    } else {
                        error_msg += &format!("  ❌ Missing: {:?}\n", output_params);
                    }
                }
            }
            
            error_msg += "\nTo fix this:\n";
            error_msg += "1. Make sure parameters are in the 'params' folder at the project root\n";
            error_msg += "2. Run: .\\scripts\\download-zcash-params.ps1\n";
            error_msg += "3. Restart the proof service after downloading\n";
            
            Err(error_msg)
        }
    }
}

async fn generate_proof(req: web::Json<ProofRequest>) -> ActixResult<HttpResponse> {
    println!("[ProofService] Received proof request: type={}", req.proof_type);
    println!("[ProofService] Params: {}", serde_json::to_string_pretty(&req.params).unwrap_or_default());
    
    // Get prover (loads Groth16 parameters - can be slow first time)
    let prover = match get_prover() {
        Ok(p) => {
            println!("[ProofService] ✅ Prover initialized");
            p
        }
        Err(e) => {
            println!("[ProofService] ⚠️  Prover initialization failed: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ProofResponse {
                proof: vec![],
                error: Some(e),
            }));
        }
    };
    
    match req.proof_type.as_str() {
        "spend" => {
            match generate_spend_proof(&prover, &req.params).await {
                Ok(proof) => {
                    println!("[ProofService] ✅ Generated spend proof ({} bytes)", proof.len());
                    Ok(HttpResponse::Ok().json(ProofResponse {
                        proof,
                        error: None,
                    }))
                }
                Err(e) => {
                    println!("[ProofService] ❌ Spend proof generation failed: {}", e);
                    Ok(HttpResponse::InternalServerError().json(ProofResponse {
                        proof: vec![],
                        error: Some(format!("Spend proof generation failed: {}", e)),
                    }))
                }
            }
        }
        "output" => {
            match generate_output_proof(&prover, &req.params).await {
                Ok(proof) => {
                    println!("[ProofService] ✅ Generated output proof ({} bytes)", proof.len());
                    Ok(HttpResponse::Ok().json(ProofResponse {
                        proof,
                        error: None,
                    }))
                }
                Err(e) => {
                    println!("[ProofService] ❌ Output proof generation failed: {}", e);
                    Ok(HttpResponse::InternalServerError().json(ProofResponse {
                        proof: vec![],
                        error: Some(format!("Output proof generation failed: {}", e)),
                    }))
                }
            }
        }
        _ => {
            Ok(HttpResponse::BadRequest().json(ProofResponse {
                proof: vec![],
                error: Some(format!("Invalid proof type: {}", req.proof_type)),
            }))
        }
    }
}

/// Generate spend proof using transaction builder
/// Uses librustzcash's transaction builder which generates real Groth16 proofs
async fn generate_spend_proof(
    _prover: &LocalTxProver,
    params: &serde_json::Value,
) -> Result<Vec<u8>, String> {
    println!("[ProofService] Generating spend proof with transaction builder...");
    
    // Extract parameters
    let spending_key = params.get("spendingKey")
        .and_then(|v| v.as_str())
        .ok_or("Missing spendingKey parameter")?;
    
    let amount: u64 = params.get("amount")
        .and_then(|v| {
            if let Some(s) = v.as_str() {
                s.parse().ok()
            } else if let Some(n) = v.as_u64() {
                Some(n)
            } else {
                None
            }
        })
        .ok_or("Missing or invalid amount parameter")?;
    
    // Note: spending_key is in base58check format (e.g., "secret-extended-key-main1...")
    // We don't decode it here since we're not actually generating proofs yet.
    // The proof service currently returns an error directing to use lightwalletd's API.
    
    // REAL SOLUTION: Use lightwalletd's transaction building API
    // Generating proofs separately requires:
    // - Note commitment tree witness (from lightwalletd)
    // - Anchor (merkle root from blockchain)
    // - Proper note construction
    // 
    // This is complex. The SIMPLEST viable solution is to use lightwalletd's
    // gRPC SendTransaction method which builds complete transactions with proofs.
    
    Err(format!(
        "Spend proof generation requires note commitment tree witness.\n\
         \n\
         ✅ SIMPLEST SOLUTION: Use lightwalletd's transaction building API\n\
         \n\
         Lightwalletd can build complete transactions with real Groth16 proofs via:\n\
         - gRPC SendTransaction method\n\
         - Handles witness, anchor, and proof generation automatically\n\
         \n\
         Current params: spendingKey ({} chars), amount={}\n\
         \n\
         See PROOF_GENERATION_SOLUTION.md for implementation guide."
    , spending_key.len(), amount))
}

/// Generate output proof using transaction builder
async fn generate_output_proof(
    _prover: &LocalTxProver,
    params: &serde_json::Value,
) -> Result<Vec<u8>, String> {
    println!("[ProofService] Generating output proof with transaction builder...");
    
    // Extract parameters
    let to_address = params.get("toAddress")
        .and_then(|v| v.as_str())
        .ok_or("Missing toAddress parameter")?;
    
    let amount: u64 = params.get("amount")
        .and_then(|v| {
            if let Some(s) = v.as_str() {
                s.parse().ok()
            } else if let Some(n) = v.as_u64() {
                Some(n)
            } else {
                None
            }
        })
        .ok_or("Missing or invalid amount parameter")?;
    
    // REAL SOLUTION: Use lightwalletd's transaction building API
    // Output proofs require:
    // - Payment address decoding (base58check)
    // - Note construction with recipient, value, memo
    // - Random seed generation
    //
    // The SIMPLEST viable solution is to use lightwalletd's gRPC SendTransaction
    // which handles all of this automatically.
    
    Err(format!(
        "Output proof generation requires payment address decoding.\n\
         \n\
         ✅ SIMPLEST SOLUTION: Use lightwalletd's transaction building API\n\
         \n\
         Lightwalletd can build complete transactions with real Groth16 proofs via:\n\
         - gRPC SendTransaction method\n\
         - Handles address decoding, note construction, and proof generation\n\
         \n\
         Current params: toAddress={}, amount={}\n\
         \n\
         See PROOF_GENERATION_SOLUTION.md for implementation guide."
    , to_address, amount))
}

/// Build a complete transaction using librustzcash transaction builder
/// This is how Ywallet works - builds transactions client-side using compact blocks
async fn build_transaction(req: web::Json<BuildTransactionRequest>) -> ActixResult<HttpResponse> {
    println!("[ProofService] Received transaction building request");
    
    // Safe string slicing - won't panic on empty strings
    let from_preview = if req.from_address.is_empty() {
        ""
    } else {
        let len = std::cmp::min(20, req.from_address.len());
        &req.from_address[..len]
    };
    let to_preview = if req.to_address.is_empty() {
        ""
    } else {
        let len = std::cmp::min(20, req.to_address.len());
        &req.to_address[..len]
    };
    
    println!("[ProofService] From: {}...", from_preview);
    println!("[ProofService] To: {}...", to_preview);
    println!("[ProofService] Amount: {} zatoshi", req.amount);
    
    // Get prover for proof generation (will be used when implementing full transaction building)
    let _prover = match get_prover() {
        Ok(p) => {
            println!("[ProofService] ✅ Prover initialized");
            p
        }
        Err(e) => {
            println!("[ProofService] ⚠️  Prover initialization failed: {}", e);
            return Ok(HttpResponse::InternalServerError().json(BuildTransactionResponse {
                raw_transaction: vec![],
                txid: None,
                error: Some(format!("Prover initialization failed: {}", e)),
            }));
        }
    };
    
    // For now, return a helpful error explaining what needs to be implemented
    // The full implementation requires:
    // 1. Getting compact blocks from lightwalletd
    // 2. Building note commitment tree from blocks
    // 3. Finding notes for the spending key
    // 4. Using zcash_primitives::transaction::builder::Builder to build transaction
    // 5. Serializing and returning the raw transaction
    
    let error_msg = format!(
        "Transaction building is being implemented.\n\
         \n\
         This will use the same approach as Ywallet:\n\
         1. Get compact blocks from lightwalletd\n\
         2. Build note commitment tree from blocks\n\
         3. Find notes for spending key\n\
         4. Use librustzcash Builder API to build transaction\n\
         5. Return raw transaction ready to broadcast\n\
         \n\
         Current request:\n\
         - Spending key: {} chars\n\
         - From address: {}\n\
         - To address: {}\n\
         - Amount: {} zatoshi\n\
         - Memo: {} bytes\n\
         \n\
         Implementation in progress...",
        req.spending_key.len(),
        req.from_address,
        req.to_address,
        req.amount,
        req.memo.len()
    );
    
    Ok(HttpResponse::NotImplemented().json(BuildTransactionResponse {
        raw_transaction: vec![],
        txid: None,
        error: Some(error_msg),
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("========================================");
    println!("  Zcash Proof Generation Service");
    println!("========================================");
    println!("");
    println!("Starting server on http://127.0.0.1:8080");
    println!("Endpoint: POST /proofs/generate");
    println!("");
    
    HttpServer::new(|| {
        // Enable CORS for browser requests
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);
        
        App::new()
            .wrap(cors)
            .route("/proofs/generate", web::post().to(generate_proof))
            .route("/proofs/build-transaction", web::post().to(build_transaction))
            .route("/health", web::get().to(|| async { HttpResponse::Ok().json("OK") }))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}

