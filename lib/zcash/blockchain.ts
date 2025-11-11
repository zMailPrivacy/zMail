import {
  Transaction,
  BlockInfo,
  SyncStatus,
  AppError,
  ErrorCode,
  NetworkType
} from '@/types'
import { sleep, retry } from '@/lib/utils'
import { ZcashRPCClient, createZcashRPCClient } from './zcash-rpc-client'

export class BlockchainService {
  private network: NetworkType
  private connected: boolean = false
  private latestBlock: number = 0
  private client: ZcashRPCClient | null = null

  constructor(network: NetworkType = 'mainnet') {
    this.network = network
  }

  private async ensureClient() {
    if (!this.client) {
      this.client = await createZcashRPCClient(this.network)
    }
    return this.client
  }

  async connect(): Promise<void> {
    try {
      const client = await this.ensureClient()
      const info = await client.getBlockchainInfo()
      this.connected = true
      this.latestBlock = info.blocks || 0
    } catch (error) {
      this.connected = false
      throw new AppError(
        ErrorCode.CONNECTION_FAILED,
        'Failed to connect to zcashd RPC. Make sure zcashd is running with RPC enabled.',
        true,
        error as Error
      )
    }
  }

  disconnect(): void {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  async getCurrentBlockHeight(): Promise<number> {
    try {
      const client = await this.ensureClient()
      const info = await client.getBlockchainInfo()
      this.latestBlock = info.blocks || 0
      return this.latestBlock
    } catch (error) {
      throw new AppError(
        ErrorCode.NETWORK_ERROR,
        'Failed to get block height from zcashd',
        true,
        error as Error
      )
    }
  }

  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const client = await this.ensureClient()
      const info = await client.getBlockchainInfo()
      const verificationProgress = info.verificationprogress || 0
      
      return {
        synced: verificationProgress >= 0.9999,
        progress: verificationProgress,
        currentHeight: info.blocks || 0,
        targetHeight: info.blocks || 0
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.NETWORK_ERROR,
        'Failed to get sync status from zcashd',
        true,
        error as Error
      )
    }
  }

  async getTransaction(txHash: string): Promise<Transaction | null> {
    try {
      const client = await this.ensureClient()
      const tx = await client.getTransaction(txHash)
      
      if (!tx) {
        return null
      }

      return {
        txid: tx.txid,
        confirmations: tx.confirmations || 0,
        blockhash: tx.blockhash,
        blockheight: tx.blockheight,
        fee: tx.fee || 0
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.NETWORK_ERROR,
        'Failed to get transaction from zcashd',
        true,
        error as Error
      )
    }
  }

  async broadcastTransaction(rawTx: Uint8Array): Promise<string> {
    try {
      const client = await this.ensureClient()
      const txHex = Buffer.from(rawTx).toString('hex')
      const txid = await client.sendRawTransaction(txHex)
      return txid
    } catch (error) {
      throw new AppError(
        ErrorCode.TRANSACTION_FAILED,
        'Failed to broadcast transaction: ' + (error instanceof Error ? error.message : 'Unknown error'),
        true,
        error as Error
      )
    }
  }

  async getBalance(address: string): Promise<bigint> {
    try {
      const client = await this.ensureClient()
      const balance = await client.rpcCall<number>('z_getbalance', [address])
      return BigInt(Math.floor(balance * 1e8))
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return 0n
      }
      throw new AppError(
        ErrorCode.NETWORK_ERROR,
        'Failed to get balance from zcashd',
        true,
        error as Error
      )
    }
  }

  async getBlockInfo(height: number): Promise<BlockInfo> {
    try {
      const client = await this.ensureClient()
      const block = await client.getBlock(height)
      
      return {
        height: block.height || height,
        hash: block.hash || '',
        time: block.time || Math.floor(Date.now() / 1000),
        transactions: block.tx?.length || 0
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.NETWORK_ERROR,
        'Failed to get block info from zcashd',
        true,
        error as Error
      )
    }
  }
}

export function createBlockchainService(network: NetworkType = 'mainnet'): BlockchainService {
  return new BlockchainService(network)
}
