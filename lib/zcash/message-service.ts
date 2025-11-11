import {
  Message,
  SendMessageParams,
  Transaction,
  AppError,
  ErrorCode,
  CONSTANTS
} from '@/types'
import { MemoProtocolService } from './memo'
import ZcashWalletService from './wallet'
import { createBlockchainService } from './blockchain'
import { generateId } from '@/lib/utils'

export class MessageService {
  private network: 'mainnet' | 'testnet'

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network
  }

  async sendMessage(params: {
    fromAddress: string
    toAddress: string
    spendingKey: string
    content: string
    amount?: bigint
  }): Promise<{
    messageId: string
    txHash: string
  }> {
    try {
      const { fromAddress, toAddress, spendingKey, content, amount } = params

      if (MemoProtocolService.needsSplit(content)) {
        return await this.sendMultiPartMessage({
          fromAddress,
          toAddress,
          spendingKey,
          content,
          amount
        })
      }

      const memo = MemoProtocolService.encode(content, 'text', 0)
      const txAmount = amount || CONSTANTS.DEFAULT_TX_AMOUNT
      const signedTx = await ZcashWalletService.signTransaction({
        spendingKey,
        fromAddress,
        toAddress,
        amount: txAmount,
        memo,
        network: this.network
      })

      const blockchain = createBlockchainService(this.network)
      await blockchain.connect()
      
      const txHash = await blockchain.broadcastTransaction(signedTx.rawTransaction)
      
      blockchain.disconnect()

      const messageId = generateId()

      return {
        messageId,
        txHash
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.TRANSACTION_FAILED,
        'Failed to send message',
        true,
        error as Error
      )
    }
  }

  async sendMultiPartMessage(params: {
    fromAddress: string
    toAddress: string
    spendingKey: string
    content: string
    amount?: bigint
  }): Promise<{
    messageId: string
    txHash: string
  }> {
    try {
      const { fromAddress, toAddress, spendingKey, content, amount } = params

      const parts = MemoProtocolService.splitMessage(content)
      const txHashes: string[] = []

      for (let i = 0; i < parts.length; i++) {
        const messageType = i === 0 ? 'text' : 'continuation'
        const memo = MemoProtocolService.encode(parts[i], messageType, i)

        const txAmount = amount || CONSTANTS.DEFAULT_TX_AMOUNT
        const signedTx = await ZcashWalletService.signTransaction({
          spendingKey,
          fromAddress,
          toAddress,
          amount: txAmount,
          memo,
          network: this.network
        })

        const blockchain = createBlockchainService(this.network)
        await blockchain.connect()
        
        const txHash = await blockchain.broadcastTransaction(signedTx.rawTransaction)
        txHashes.push(txHash)
        
        blockchain.disconnect()

        if (i < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      const messageId = generateId()

      return {
        messageId,
        txHash: txHashes[0] // Return first transaction hash
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.TRANSACTION_FAILED,
        'Failed to send multi-part message',
        true,
        error as Error
      )
    }
  }

  async *scanForMessages(params: {
    address: string
    viewingKey: string
    fromBlock: number
    toBlock?: number
    onProgress?: (current: number, total: number) => void
  }): AsyncGenerator<Message> {
    try {
      const { address, viewingKey, fromBlock, toBlock, onProgress } = params

      const blockchain = createBlockchainService(this.network)
      await blockchain.connect()

      const endBlock = toBlock || await blockchain.getCurrentBlockHeight()
      const totalBlocks = endBlock - fromBlock + 1

      let currentBlock = fromBlock

      for await (const block of blockchain.streamCompactBlocks({ 
        startHeight: fromBlock, 
        endHeight: endBlock 
      })) {
        if (onProgress) {
          onProgress(currentBlock - fromBlock + 1, totalBlocks)
        }

        currentBlock++
      }

      blockchain.disconnect()
    } catch (error) {
      throw new AppError(
        ErrorCode.SYNC_ERROR,
        'Failed to scan for messages',
        true,
        error as Error
      )
    }
  }

  async receiveMessage(params: {
    txHash: string
    viewingKey: string
    address: string
  }): Promise<Message | null> {
    try {
      const { txHash, viewingKey, address } = params

      const blockchain = createBlockchainService(this.network)
      await blockchain.connect()

      const tx = await blockchain.getTransaction(txHash)
      if (!tx) return null

      blockchain.disconnect()


      return null
    } catch (error) {
      throw new AppError(
        ErrorCode.NETWORK_ERROR,
        'Failed to receive message',
        true,
        error as Error
      )
    }
  }

  combineMultiPartMessages(messages: Message[]): Message {
    if (messages.length === 0) {
      throw new AppError(
        ErrorCode.INVALID_MESSAGE,
        'No messages to combine',
        true
      )
    }

    if (messages.length === 1) {
      return messages[0]
    }

    const sorted = messages.sort((a, b) => 
      (a.sequence || 0) - (b.sequence || 0)
    )

    const combinedContent = sorted.map(m => m.content).join('')

    const combined: Message = {
      ...sorted[0],
      content: combinedContent,
      totalParts: sorted.length
    }

    return combined
  }

  async waitForConfirmations(params: {
    txHash: string
    requiredConfirmations?: number
    onProgress?: (confirmations: number) => void
  }): Promise<void> {
    const {
      txHash,
      requiredConfirmations = CONSTANTS.CONFIRMATIONS_REQUIRED,
      onProgress
    } = params

    const blockchain = createBlockchainService(this.network)
    await blockchain.connect()

    try {
      while (true) {
        const tx = await blockchain.getTransaction(txHash)
        
        if (!tx) {
          throw new AppError(
            ErrorCode.TRANSACTION_FAILED,
            'Transaction not found',
            true
          )
        }

        const confirmations = tx.confirmations

        if (onProgress) {
          onProgress(confirmations)
        }

        if (confirmations >= requiredConfirmations) {
          break
        }

        await new Promise(resolve => setTimeout(resolve, 15000))
      }
    } finally {
      blockchain.disconnect()
    }
  }

  estimateConfirmationTime(requiredConfirmations: number = 6): number {
    const blockTimeSeconds = 75
    return requiredConfirmations * blockTimeSeconds * 1000
  }
}

export const createMessageService = (
  network: 'mainnet' | 'testnet' = 'mainnet'
): MessageService => {
  return new MessageService(network)
}

export default MessageService

