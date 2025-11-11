import { AppError, ErrorCode } from '@/types'

export interface BuildTransactionParams {
  fromAddress: string
  toAddress: string
  amount: bigint
  memo: Uint8Array
  spendingKey: string
  fee: bigint
}

export interface BuiltTransaction {
  raw: Uint8Array
  txid: string
}

export class ClientTransactionBuilder {
  async buildShieldedTransaction(params: BuildTransactionParams): Promise<BuiltTransaction> {
    throw new AppError(
      ErrorCode.NOT_IMPLEMENTED,
      'Client-side transaction building requires additional setup.\n\n' +
      'Public RPC providers (like GetBlock) support sendrawtransaction but require:\n' +
      '• librustzcash compiled to WebAssembly\n' +
      '• Sapling/Orchard proving parameters (~50MB each)\n' +
      '• Complete note commitment tree witness\n' +
      '• Anchor from blockchain state\n\n' +
      'Recommended: Use a local zcashd node which handles transaction building automatically.\n\n' +
      'To enable public RPC support:\n' +
      '1. Build librustzcash WASM: npm run build:wasm\n' +
      '2. Download proving parameters from z.cash/downloads/params/\n' +
      '3. Implement note selection and witness generation\n' +
      '4. Generate zk-SNARK proofs\n' +
      '5. Sign and serialize transaction\n\n' +
      'See: https://github.com/zcash/librustzcash for reference.',
      true
    )
  }
}

