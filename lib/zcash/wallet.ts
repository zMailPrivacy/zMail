import {
  WalletKeys,
  AddressType,
  Transaction,
  AppError,
  ErrorCode,
  CONSTANTS
} from '@/types'
import { uint8ArrayToHex, hexToUint8Array } from '@/lib/utils'
import CryptoService from '@/lib/crypto'
import { TransactionBuilder } from './transaction-builder'
import { createBlockchainService } from './blockchain'

export class ZcashWalletService {
  static validateViewingKey(key: string): boolean {
    try {
      const saplingFVKRegex = /^zviews[0-9a-z]{141}$/i
      const saplingIVKRegex = /^zivk[0-9a-z]{143}$/i
      const unifiedVKRegex = /^uview1[0-9a-z]{100,}$/i

      return (
        saplingFVKRegex.test(key) ||
        saplingIVKRegex.test(key) ||
        unifiedVKRegex.test(key)
      )
    } catch {
      return false
    }
  }

  static validateSpendingKey(key: string): boolean {
    try {
      const trimmed = key.trim()
      
      const saplingMainRegex = /^secret-extended-key-main[0-9a-z]{100,}$/i
      const saplingTestRegex = /^secret-extended-key-test[0-9a-z]{100,}$/i
      
      const unifiedMainRegex = /^u-secret-spending-key-main1[0-9a-z]{100,}$/i
      const unifiedTestRegex = /^u-secret-spending-key-test1[0-9a-z]{100,}$/i

      return (
        saplingMainRegex.test(trimmed) ||
        saplingTestRegex.test(trimmed) ||
        unifiedMainRegex.test(trimmed) ||
        unifiedTestRegex.test(trimmed)
      )
    } catch {
      return false
    }
  }

  static validateAddress(address: string): boolean {
    try {
      const saplingRegex = /^zs[0-9a-z]{76}$/i
      const unifiedRegex = /^u1[0-9a-z]{74,}$/i

      return saplingRegex.test(address) || unifiedRegex.test(address)
    } catch {
      return false
    }
  }

  static getAddressType(address: string): AddressType {
    if (address.startsWith('zs')) {
      return 'sapling'
    } else if (address.startsWith('u1')) {
      return 'orchard'
    }
    throw new AppError(
      ErrorCode.INVALID_ADDRESS,
      'Unknown address type',
      true
    )
  }

  static async deriveAddress(viewingKey: string): Promise<{
    address: string
    addressType: AddressType
  }> {
    try {
      if (!this.validateViewingKey(viewingKey)) {
        throw new AppError(
          ErrorCode.INVALID_KEY,
          'Invalid viewing key format',
          true
        )
      }
      
      throw new AppError(
        ErrorCode.INVALID_KEY,
        'Address derivation requires actual Zcash library integration. Please provide the address manually.',
        true
      )
    } catch (error) {
      if (error instanceof AppError) throw error
      
      throw new AppError(
        ErrorCode.INVALID_KEY,
        'Failed to derive address',
        true,
        error as Error
      )
    }
  }

  static async importWallet(params: {
    viewingKey: string
    spendingKey?: string
    address: string
  }): Promise<WalletKeys> {
    const { viewingKey, spendingKey, address } = params

    if (!this.validateViewingKey(viewingKey)) {
      throw new AppError(
        ErrorCode.INVALID_KEY,
        'Invalid viewing key format',
        true
      )
    }

    if (spendingKey && !this.validateSpendingKey(spendingKey)) {
      throw new AppError(
        ErrorCode.INVALID_KEY,
        'Invalid spending key format',
        true
      )
    }

    if (!this.validateAddress(address)) {
      throw new AppError(
        ErrorCode.INVALID_ADDRESS,
        'Invalid Zcash shielded address',
        true
      )
    }

    const addressType = this.getAddressType(address)

    return {
      viewingKey,
      spendingKey,
      address,
      addressType
    }
  }

  static async signTransaction(params: {
    spendingKey: string
    fromAddress: string
    toAddress: string
    amount: bigint
    memo?: Uint8Array
    fee?: bigint
    network?: 'mainnet' | 'testnet'
  }): Promise<{
    rawTransaction: Uint8Array
    txHash: string
  }> {
    const {
      spendingKey,
      fromAddress,
      toAddress,
      amount,
      memo = new Uint8Array(CONSTANTS.MEMO_SIZE),
      fee = CONSTANTS.DEFAULT_TX_AMOUNT,
      network = 'mainnet'
    } = params

    try {
      if (!this.validateSpendingKey(spendingKey)) {
        throw new AppError(
          ErrorCode.INVALID_KEY,
          'Invalid spending key',
          true
        )
      }

      if (!this.validateAddress(toAddress)) {
        throw new AppError(
          ErrorCode.INVALID_ADDRESS,
          'Invalid recipient address',
          true
        )
      }

      if (amount < CONSTANTS.MIN_TX_AMOUNT) {
        throw new AppError(
          ErrorCode.INVALID_AMOUNT,
          `Amount must be at least ${CONSTANTS.MIN_TX_AMOUNT} satoshis`,
          true
        )
      }

      const builder = new TransactionBuilder(network)
      const blockchain = createBlockchainService(network)
      await blockchain.connect()

      const builtTx = await builder.buildSimpleTransaction({
        spendingKey,
        fromAddress,
        toAddress,
        amount,
        memo,
        fee,
        getUtxos: async (address) => {
          return []
        },
        getWitness: async (note) => {
          return {
            position: 0,
            filled: [],
            cursor: new Uint8Array(32)
          }
        },
        getAnchorHeight: async () => {
          return await blockchain.getCurrentBlockHeight()
        }
      })

      blockchain.disconnect()

      return {
        rawTransaction: builtTx.raw,
        txHash: builtTx.txid
      }
    } catch (error) {
      if (error instanceof AppError) throw error
      
      throw new AppError(
        ErrorCode.TRANSACTION_FAILED,
        'Failed to sign transaction',
        true,
        error as Error
      )
    }
  }

  static generateTxHash(rawTx: Uint8Array): string {
    const hash = CryptoService.hash(rawTx)
    return uint8ArrayToHex(hash)
  }

  static parseTransaction(rawTx: Uint8Array): Partial<Transaction> {
    try {
      return {
        txHash: this.generateTxHash(rawTx),
        status: 'pending',
        confirmations: 0
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.TRANSACTION_FAILED,
        'Failed to parse transaction',
        true,
        error as Error
      )
    }
  }

  static estimateFee(numInputs: number = 1, numOutputs: number = 2): bigint {
    const baseFee = BigInt(10000)
    const inputFee = BigInt(1000) * BigInt(numInputs)
    const outputFee = BigInt(1000) * BigInt(numOutputs)
    
    return baseFee + inputFee + outputFee
  }

  static isValidForNetwork(address: string, network: 'mainnet' | 'testnet'): boolean {
    return this.validateAddress(address)
  }
}

export const validateWalletImport = (params: {
  viewingKey: string
  spendingKey?: string
  address: string
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (!ZcashWalletService.validateViewingKey(params.viewingKey)) {
    errors.push('Invalid viewing key format')
  }

  if (params.spendingKey && !ZcashWalletService.validateSpendingKey(params.spendingKey)) {
    errors.push('Invalid spending key format')
  }

  if (!ZcashWalletService.validateAddress(params.address)) {
    errors.push('Invalid Zcash address format')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export const formatWalletInfo = (keys: WalletKeys): {
  canSpend: boolean
  canView: boolean
  addressType: string
} => {
  return {
    canSpend: !!keys.spendingKey,
    canView: true,
    addressType: keys.addressType === 'sapling' ? 'Sapling' : 'Orchard'
  }
}

export default ZcashWalletService

