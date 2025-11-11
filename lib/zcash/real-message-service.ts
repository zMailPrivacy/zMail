import { AppError, ErrorCode, NetworkType, Message, CONSTANTS } from '@/types'
import { ZcashRPCClient, createZcashRPCClient } from './zcash-rpc-client'
import RealMessageCrypto, { EncryptedMessage } from './real-message-crypto'
import { generateId } from '@/lib/utils'
import { TransactionRouter } from './transaction-router'

export interface SendMessageParams {
  fromAddress: string
  toAddress: string
  spendingKey: string
  content: string
  amount?: bigint
}

export interface MessageScanResult {
  message: Message
  txHash: string
}

export class RealMessageService {
  private rpcClient: ZcashRPCClient | null = null
  private network: NetworkType
  private transactionRouter: TransactionRouter | null = null

  constructor(network: NetworkType = 'mainnet') {
    this.network = network
  }

  private async ensureRPCClient() {
    if (!this.rpcClient) {
      this.rpcClient = await createZcashRPCClient(this.network)
      this.transactionRouter = new TransactionRouter(this.rpcClient)
    }
    return this.rpcClient
  }

  async sendMessage(params: SendMessageParams): Promise<{
    txHash: string
    messageId: string
  }> {
    const { fromAddress, toAddress, spendingKey, content, amount = CONSTANTS.DEFAULT_TX_AMOUNT } = params

    try {
      const senderKeypair = RealMessageCrypto.deriveEncryptionKeypair(spendingKey)
      const recipientPubKey = RealMessageCrypto.derivePublicKeyFromAddress(toAddress)

      const encrypted = await RealMessageCrypto.encryptMessage(
        content,
        senderKeypair.secretKey,
        recipientPubKey
      )

      const memo = RealMessageCrypto.encodeToMemo(encrypted)

      if (memo.length > 512) {
        throw new AppError(
          ErrorCode.MESSAGE_TOO_LONG,
          `Message too long. Maximum size after encryption is ${512 - 91} bytes`,
          true
        )
      }

      const { StorageService } = await import('@/lib/storage/db')
      const stored = await StorageService.getNodeConfig()
      
      if (!stored || !stored.rpcEndpoint || typeof stored.rpcEndpoint !== 'string' || !stored.rpcEndpoint.trim()) {
        throw new AppError(
          ErrorCode.NETWORK_ERROR,
          'A local zcashd node is required to send messages.\n\n' +
          'Please configure:\n' +
          '• Install and run zcashd on your local machine\n' +
          '• Enable RPC in zcash.conf (rpcuser, rpcpassword, rpcallowip)\n' +
          '• Configure in Settings > Node Configuration\n' +
          '• Use endpoint: http://localhost:8232',
          true
        )
      }
      
      const endpoint = stored.rpcEndpoint.toLowerCase()
      const isLocalNode = endpoint.includes('localhost') || 
                         endpoint.includes('127.0.0.1')
      
      if (!isLocalNode) {
        throw new AppError(
          ErrorCode.NETWORK_ERROR,
          'Only local zcashd nodes are currently supported.\n\n' +
          'Please configure a local node:\n' +
          '• Install and run zcashd on your local machine\n' +
          '• Enable RPC in zcash.conf\n' +
          '• Use endpoint: http://localhost:8232\n' +
          '• Configure in Settings > Node Configuration',
          true
        )
      }

      await this.ensureRPCClient()
      if (!this.transactionRouter) {
        throw new AppError(
          ErrorCode.NETWORK_ERROR,
          'Failed to initialize RPC client',
          true
        )
      }

      const result = await this.transactionRouter.sendTransaction({
        fromAddress,
        toAddress,
        amount,
        memo,
        spendingKey,
        fee: BigInt(10000)
      })

      return {
        txHash: result.txid,
        messageId: generateId()
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      
      throw new AppError(
        ErrorCode.TRANSACTION_FAILED,
        'Failed to send message: ' + (error instanceof Error ? error.message : 'Unknown error'),
        true
      )
    }
  }

  async scanForMessages(params: {
    viewingKey: string
    address: string
    startHeight?: number
    endHeight?: number
  }): Promise<MessageScanResult[]> {
    try {
      await this.ensureRPCClient()
      if (!this.rpcClient) {
        throw new AppError(
          ErrorCode.NETWORK_ERROR,
          'Failed to initialize RPC client',
          true
        )
      }

      const received = await this.rpcClient.listReceivedByAddress(params.address, 1)
      
      const messages: MessageScanResult[] = []
      
      for (const tx of received) {
        if (tx.memo && tx.memo.length > 0) {
          try {
            const memoBytes = Buffer.from(tx.memo, 'hex')
            
            const decrypted = await RealMessageCrypto.decryptFromMemo(memoBytes, params.viewingKey)
            
            if (decrypted) {
              const message: Message = {
                id: generateId(),
                conversationId: tx.txid,
                fromAddress: '',
                toAddress: params.address,
                content: decrypted,
                timestamp: tx.time || Math.floor(Date.now() / 1000),
                status: 'received',
                txHash: tx.txid,
                amount: BigInt(tx.amount * 1e8),
                confirmations: tx.confirmations || 0,
                isOutgoing: false
              }
              
              messages.push({
                message,
                txHash: tx.txid
              })
            }
          } catch (decryptError) {
          }
        }
      }
      
      return messages
    } catch (error) {
      throw new AppError(
        ErrorCode.NETWORK_ERROR,
        'Failed to scan for messages: ' + (error instanceof Error ? error.message : 'Unknown error'),
        true
      )
    }
  }

  async waitForConfirmations(params: {
    txHash: string
    targetConfirmations: number
    onProgress?: (confirmations: number) => void
  }): Promise<void> {
    const { txHash, targetConfirmations, onProgress } = params
    
    await this.ensureRPCClient()
    if (!this.rpcClient) {
      throw new AppError(
        ErrorCode.NETWORK_ERROR,
        'Failed to initialize RPC client',
        true
      )
    }
    
    while (true) {
      try {
        const txInfo = await this.rpcClient.getTransaction(txHash)
        
        if (txInfo && txInfo.confirmations >= targetConfirmations) {
          if (onProgress) {
            onProgress(txInfo.confirmations)
          }
          return
        }
        
        if (onProgress && txInfo) {
          onProgress(txInfo.confirmations)
        }
        
        await new Promise(resolve => setTimeout(resolve, 30000))
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 30000))
      }
    }
  }
}

export function createRealMessageService(network: NetworkType = 'mainnet'): RealMessageService {
  return new RealMessageService(network)
}
