import { AppError, ErrorCode } from '@/types'
import { ZcashRPCClient } from './zcash-rpc-client'
import { RPCCapabilityDetector, RPCCapabilities } from './rpc-capability-detector'
import { ClientTransactionBuilder } from './client-transaction-builder'

export interface SendTransactionParams {
  fromAddress: string
  toAddress: string
  amount: bigint
  memo: Uint8Array
  spendingKey: string
  fee?: bigint
}

export interface SendTransactionResult {
  txid: string
  operationId?: string
}

export class TransactionRouter {
  private rpcClient: ZcashRPCClient
  private capabilities: RPCCapabilities | null = null
  private capabilityDetector: RPCCapabilityDetector
  private clientBuilder: ClientTransactionBuilder

  constructor(rpcClient: ZcashRPCClient) {
    this.rpcClient = rpcClient
    this.capabilityDetector = new RPCCapabilityDetector()
    this.clientBuilder = new ClientTransactionBuilder()
  }

  async sendTransaction(params: SendTransactionParams): Promise<SendTransactionResult> {
    if (!this.capabilities) {
      this.capabilities = await this.capabilityDetector.detectCapabilities(this.rpcClient)
    }

    if (this.capabilities.supportsZSendMany && this.capabilities.supportsZImportKey) {
      return this.sendViaZSendMany(params)
    } else if (this.capabilities.supportsSendRawTransaction) {
      return this.sendViaRawTransaction(params)
    } else {
      throw new AppError(
        ErrorCode.TRANSACTION_FAILED,
        'RPC provider does not support transaction sending.\n\n' +
        'Required methods:\n' +
        '• Local node: z_sendmany and z_importkey\n' +
        '• Public RPC: sendrawtransaction\n\n' +
        'Please configure a compatible RPC provider in Settings.',
        true
      )
    }
  }

  private async sendViaZSendMany(params: SendTransactionParams): Promise<SendTransactionResult> {
    try {
      await this.rpcClient.importSpendingKey(params.spendingKey, false, 'zmail')
    } catch (importError: any) {
    }

    const memoHex = Array.from(params.memo)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const amountZEC = Number(params.amount) / 1e8
    const feeZEC = params.fee ? Number(params.fee) / 1e8 : 0.0001

    const operationId = await this.rpcClient.sendShieldedTransaction({
      fromAddress: params.fromAddress,
      recipients: [{
        address: params.toAddress,
        amount: amountZEC,
        memo: memoHex
      }],
      minconf: 1,
      fee: feeZEC
    })

    const txid = await this.rpcClient.waitForOperation(operationId)

    return {
      txid,
      operationId
    }
  }

  private async sendViaRawTransaction(params: SendTransactionParams): Promise<SendTransactionResult> {
    try {
      const builtTx = await this.clientBuilder.buildShieldedTransaction({
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        memo: params.memo,
        spendingKey: params.spendingKey,
        fee: params.fee || BigInt(10000)
      })

      const rawTxHex = Array.from(builtTx.raw)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      const txid = await this.rpcClient.rpcCall<string>('sendrawtransaction', [rawTxHex])

      return {
        txid
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      throw new AppError(
        ErrorCode.TRANSACTION_FAILED,
        'Failed to build and send transaction via sendrawtransaction.\n\n' +
        'Client-side transaction building requires:\n' +
        '• Zcash cryptographic libraries (WASM)\n' +
        '• Proving parameters (~50MB)\n' +
        '• Complete transaction context\n\n' +
        'Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        true,
        error as Error
      )
    }
  }

  async refreshCapabilities(): Promise<void> {
    this.capabilities = await this.capabilityDetector.detectCapabilities(this.rpcClient)
  }
}

