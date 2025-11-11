import axios, { AxiosInstance } from 'axios'
import { AppError, ErrorCode, NetworkType } from '@/types'
import { getZcashNodeConfig, isZcashNodeEnabled } from '@/config/settings'

export interface RPCResponse<T = any> {
  result?: T
  error?: {
    code: number
    message: string
  }
  id: number | string
}

export interface TransactionInfo {
  txid: string
  confirmations: number
  blockhash?: string
  blockheight?: number
  blocktime?: number
  fee?: number
}

export class ZcashRPCClient {
  private client: AxiosInstance
  private network: NetworkType
  private rpcId: number = 0

  constructor(network: NetworkType = 'mainnet', nodeConfig?: { endpoint: string; auth: string }) {
    this.network = network
    this.client = axios.create({
      baseURL: '',
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    })
    
    if (nodeConfig) {
      this.setupClient(nodeConfig)
    }
  }

  private async setupClient(config: { endpoint: string; auth: string }) {
    if (!config || !config.endpoint || typeof config.endpoint !== 'string') {
      throw new AppError(
        ErrorCode.NETWORK_ERROR,
        'Invalid RPC endpoint configuration',
        true
      )
    }

    const endpoint = config.endpoint.toLowerCase()
    const isLocalNode = endpoint.includes('localhost') || 
                       endpoint.includes('127.0.0.1')
    
    if (!isLocalNode) {
      throw new AppError(
        ErrorCode.NETWORK_ERROR,
        'Only local zcashd nodes are currently supported. Please configure a local node at http://localhost:8232',
        true
      )
    }
    
    const headers: any = {
      'Content-Type': 'application/json'
    }
    
    if (config.auth) {
      headers['Authorization'] = `Basic ${config.auth}`
    }
    
    this.client = axios.create({
      baseURL: config.endpoint,
      headers,
      timeout: 30000
    })
  }

  async initialize(nodeConfig?: { endpoint: string; auth: string }) {
    let config = nodeConfig
    if (!config) {
      const settingsConfig = await getZcashNodeConfig()
      if (settingsConfig) {
        config = settingsConfig
      }
    }
    
    if (!config) {
      throw new AppError(
        ErrorCode.NETWORK_ERROR,
        'Zcash node not configured. Please configure in Settings > Node Configuration',
        true
      )
    }

    await this.setupClient(config)
  }

  async rpcCall<T = any>(method: string, params: any[] = []): Promise<T> {
    const id = ++this.rpcId
    
    const isBrowser = typeof window !== 'undefined'
    const apiUrl = isBrowser ? '/api/zcash/rpc' : null
    
    try {
      const targetUrl = apiUrl || ''
      const targetClient = apiUrl ? axios.create({ baseURL: '' }) : this.client
      
      const response = await targetClient.post<RPCResponse<T>>(targetUrl, {
        jsonrpc: '2.0',
        method,
        params,
        id
      })

      if (response.data.error) {
        const errorCode = response.data.error.code
        const errorMessage = response.data.error.message || 'Unknown RPC error'
        
        if (errorCode === -28 && errorMessage.includes('reindexing')) {
          throw new AppError(
            ErrorCode.NETWORK_ERROR,
            'zcashd is still syncing/reindexing the blockchain.\n\n' +
            'Wallet operations (including z_sendmany) are disabled until sync completes.\n\n' +
            'Please wait for zcashd to finish syncing. This can take 24-48 hours for a full sync.\n\n' +
            'You can check sync progress with:\n' +
            '• docker logs zcash-node --tail 20\n' +
            '• Look for "progress=" in the logs (e.g., progress=0.002400 means 0.24% complete)',
            true
          )
        }
        
        throw new AppError(
          ErrorCode.NETWORK_ERROR,
          `RPC Error (${errorCode}): ${errorMessage}`,
          true
        )
      }

      if (response.data.result === undefined) {
        throw new AppError(
          ErrorCode.NETWORK_ERROR,
          'RPC call returned no result',
          true
        )
      }

      return response.data.result
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error
      }

      if (error.code === 'ECONNREFUSED') {
        throw new AppError(
          ErrorCode.NETWORK_ERROR,
          'Cannot connect to zcashd node. Is zcashd running?\n\n' +
          'Start with: docker-compose up -d',
          true
        )
      }

      if (error.code === 'ETIMEDOUT') {
        throw new AppError(
          ErrorCode.NETWORK_ERROR,
          'Connection to Zcash node timed out',
          true
        )
      }

      throw new AppError(
        ErrorCode.NETWORK_ERROR,
        `RPC call failed: ${error.message || 'Unknown error'}`,
        true
      )
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getInfo()
      return true
    } catch (error) {
      return false
    }
  }

  async getInfo(): Promise<any> {
    return this.rpcCall('getinfo')
  }

  async getBlockchainInfo(): Promise<any> {
    return this.rpcCall('getblockchaininfo')
  }

  async getLatestBlockHeight(): Promise<number> {
    const info = await this.getBlockchainInfo()
    return info.blocks || 0
  }

  async sendRawTransaction(rawTxHex: string): Promise<string> {
    try {
      const txid = await this.rpcCall<string>('sendrawtransaction', [rawTxHex])
      return txid
    } catch (error: any) {
      if (error.message?.includes('already in block chain')) {
        throw new AppError(
          ErrorCode.TRANSACTION_FAILED,
          'Transaction already exists in blockchain',
          true
        )
      }
      
      if (error.message?.includes('bad-txns-in-belowout')) {
        throw new AppError(
          ErrorCode.TRANSACTION_FAILED,
          'Transaction rejected: insufficient funds or invalid inputs',
          true
        )
      }
      
      if (error.message?.includes('bad-txns-nonfinal')) {
        throw new AppError(
          ErrorCode.TRANSACTION_FAILED,
          'Transaction rejected: not final (sequence number too low)',
          true
        )
      }

      if (error.message?.includes('bad tx header') || error.message?.includes('parse error')) {
        const baseURL = this.client?.defaults?.baseURL
        if (baseURL && typeof baseURL === 'string') {
          const endpoint = baseURL.toLowerCase()
          const isPublicRPC = endpoint.includes('getblock.io') || 
                             endpoint.includes('quicknode') || 
                             endpoint.includes('infura') ||
                             (!endpoint.includes('localhost') && !endpoint.includes('127.0.0.1'))
        
          if (isPublicRPC) {
            throw new AppError(
              ErrorCode.TRANSACTION_FAILED,
              'Public RPC providers (GetBlock, QuickNode, etc.) don\'t support wallet RPC methods.\n\n' +
              'To send real shielded transactions, you need a local full node:\n' +
              '• Install Zebrad: https://z.cash/ecosystem/zebrad/\n' +
              '• See INSTALL_ZEBRAD.md for setup instructions\n' +
              '• Configure in Settings > Node Configuration',
              true
            )
          }
        }
      }
      
      throw error
    }
  }

  async importSpendingKey(spendingKey: string, rescan: boolean = false, label: string = 'zmail'): Promise<void> {
    if (typeof spendingKey !== 'string' || !spendingKey.trim()) {
      throw new AppError(
        ErrorCode.INVALID_KEY,
        'Spending key must be a non-empty string',
        true
      )
    }

    const trimmedKey = spendingKey.trim()
    const isUnified = trimmedKey.startsWith('u-secret-spending-key-')

    try {
      await this.rpcCall('z_importkey', [trimmedKey, rescan, label])
    } catch (error: any) {
      if (error.message?.includes('already exists') || 
          error.message?.includes('already have') ||
          error.message?.includes('already')) {
        return
      }
      
      if (error.message?.includes('invalid') && isUnified) {
        throw new AppError(
          ErrorCode.INVALID_KEY,
          'Invalid unified spending key format. Unified spending keys should start with "u-secret-spending-key-main1" or "u-secret-spending-key-test1".\n\n' +
          'Make sure you are using the correct network (mainnet vs testnet) and the full unified spending key.',
          true
        )
      }
      
      if (error.message?.includes('reindexing') || error.message?.includes('disabled')) {
        throw new AppError(
          ErrorCode.NETWORK_ERROR,
          'zcashd is still syncing/reindexing the blockchain.\n\n' +
          'Wallet operations are disabled until sync completes.\n\n' +
          'Please wait for zcashd to finish syncing. You can check progress with:\n' +
          '• docker logs zcash-node --tail 20\n' +
          '• Or check the block height in the zcashd logs',
          true
        )
      }
      
      throw error
    }
  }

  async sendShieldedTransaction(params: {
    fromAddress: string
    recipients: Array<{
      address: string
      amount: number
      memo?: string
    }>
    minconf?: number
    fee?: number
  }): Promise<string> {
    const { fromAddress, recipients, minconf = 1, fee = 0.0001 } = params

    try {
      const operationId = await this.rpcCall<string>('z_sendmany', [
        fromAddress,
        recipients,
        minconf,
        fee
      ])

      return operationId
    } catch (error: any) {
      if (error.message?.includes('Invalid address')) {
        throw new AppError(
          ErrorCode.TRANSACTION_FAILED,
          'Invalid Zcash address',
          true
        )
      }

      if (error.message?.includes('Insufficient funds')) {
        throw new AppError(
          ErrorCode.TRANSACTION_FAILED,
          'Insufficient funds for transaction',
          true
        )
      }

      throw error
    }
  }

  async getOperationStatus(operationId: string): Promise<any> {
    try {
      const status = await this.rpcCall<any>('z_getoperationstatus', [[operationId]])
      return status[0] || null
    } catch (error) {
      return null
    }
  }

  async getOperationResult(operationId: string): Promise<string | null> {
    try {
      const result = await this.rpcCall<any>('z_getoperationresult', [[operationId]])
      if (result && result.length > 0 && result[0].result) {
        return result[0].result.txid || null
      }
      return null
    } catch (error) {
      return null
    }
  }

  async waitForOperation(operationId: string, timeout: number = 300000): Promise<string> {
    const startTime = Date.now()
    const checkInterval = 2000

    while (Date.now() - startTime < timeout) {
      const status = await this.getOperationStatus(operationId)

      if (!status) {
        await new Promise(resolve => setTimeout(resolve, checkInterval))
        continue
      }

      if (status.status === 'success') {
        const txid = await this.getOperationResult(operationId)
        if (txid) {
          return txid
        }
      }

      if (status.status === 'failed') {
        const errorMsg = status.error?.message || 'Operation failed'
        throw new AppError(
          ErrorCode.TRANSACTION_FAILED,
          `Transaction failed: ${errorMsg}`,
          true
        )
      }

      if (status.status === 'executing' || status.status === 'queued') {
        await new Promise(resolve => setTimeout(resolve, checkInterval))
        continue
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }

    throw new AppError(
      ErrorCode.TRANSACTION_FAILED,
      'Operation timed out waiting for transaction',
      true
    )
  }

  async getTransaction(txid: string): Promise<TransactionInfo | null> {
    try {
      const tx = await this.rpcCall<any>('getrawtransaction', [txid, true])
      
      if (!tx) {
        return null
      }

      const blockchainInfo = await this.getBlockchainInfo()
      const currentHeight = blockchainInfo.blocks || 0
      
      return {
        txid: tx.txid || txid,
        confirmations: tx.confirmations || 0,
        blockhash: tx.blockhash,
        blockheight: tx.blockheight,
        blocktime: tx.blocktime,
        fee: tx.fee
      }
    } catch (error: any) {
      if (error.message?.includes('No such mempool transaction')) {
        return null
      }
      
      throw error
    }
  }

  async getMempoolInfo(): Promise<any> {
    return this.rpcCall('getmempoolinfo')
  }

  async getNetworkInfo(): Promise<any> {
    return this.rpcCall('getnetworkinfo')
  }

  async validateAddress(address: string): Promise<any> {
    return this.rpcCall('validateaddress', [address])
  }

  async getBlock(height: number): Promise<any> {
    const hash = await this.rpcCall<string>('getblockhash', [height])
    return this.rpcCall('getblock', [hash])
  }

  async getBlockByHash(hash: string): Promise<any> {
    return this.rpcCall('getblock', [hash])
  }

  async listReceivedByAddress(address: string, minconf: number = 1): Promise<Array<{
    txid: string
    amount: number
    memo: string
    confirmations: number
    time: number
  }>> {
    try {
      const result = await this.rpcCall<any>('z_listreceivedbyaddress', [address, minconf])
      
      return (result || []).map((item: any) => ({
        txid: item.txid || '',
        amount: item.amount || 0,
        memo: item.memo || '',
        confirmations: item.confirmations || 0,
        time: item.time || 0
      }))
    } catch (error) {
      return []
    }
  }
}

export const createZcashRPCClient = async (network: NetworkType = 'mainnet'): Promise<ZcashRPCClient> => {
  const enabled = await isZcashNodeEnabled()
  if (!enabled) {
    throw new AppError(
      ErrorCode.NETWORK_ERROR,
      'Zcash RPC node not configured. Please configure your node in Settings > Node Configuration',
      true
    )
  }

  const client = new ZcashRPCClient(network)
  await client.initialize()
  return client
}

