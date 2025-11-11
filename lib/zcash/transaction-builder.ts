import {
  AppError,
  ErrorCode,
  CONSTANTS
} from '@/types'
import { hexToUint8Array } from '@/lib/utils'

export interface TransactionInput {
  note: ShieldedNote
  witness: IncrementalWitness
}

export interface ShieldedNote {
  value: bigint
  asset: string
  recipient: Uint8Array
  nf: Uint8Array
  rho: Uint8Array
}

export interface IncrementalWitness {
  position: number
  filled: Uint8Array[]
  cursor: Uint8Array
}

export interface TransactionOutput {
  address: string
  amount: bigint
  memo: Uint8Array
}

export interface BuilderParams {
  spendingKey: string
  inputs: TransactionInput[]
  outputs: TransactionOutput[]
  fee: bigint
  anchorHeight: number
}

export interface BuiltTransaction {
  raw: Uint8Array
  txid: string
}

export class TransactionBuilder {
  private network: 'mainnet' | 'testnet'

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network
  }

  async buildTransaction(params: BuilderParams): Promise<BuiltTransaction> {
    try {
      this.validateBuildParams(params)

      const mockTx = new Uint8Array(200)
      const mockTxid = Array.from(mockTx.slice(0, 32))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      return {
        raw: mockTx,
        txid: mockTxid
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.TRANSACTION_FAILED,
        'Failed to build transaction',
        true,
        error as Error
      )
    }
  }

  async buildSimpleTransaction(params: {
    spendingKey: string
    fromAddress: string
    toAddress: string
    amount: bigint
    memo: Uint8Array
    fee?: bigint
    getUtxos: (address: string) => Promise<ShieldedNote[]>
    getWitness: (note: ShieldedNote) => Promise<IncrementalWitness>
    getAnchorHeight: () => Promise<number>
  }): Promise<BuiltTransaction> {
    try {
      const fee = params.fee || CONSTANTS.DEFAULT_TX_AMOUNT

      const availableNotes = await params.getUtxos(params.fromAddress)
      
      const { selectedNotes, change } = this.selectNotes(
        availableNotes,
        params.amount + fee
      )

      const inputs: TransactionInput[] = []
      for (const note of selectedNotes) {
        const witness = await params.getWitness(note)
        inputs.push({ note, witness })
      }

      const outputs: TransactionOutput[] = [
        {
          address: params.toAddress,
          amount: params.amount,
          memo: params.memo
        }
      ]

      if (change > BigInt(0)) {
        outputs.push({
          address: params.fromAddress,
          amount: change,
          memo: new Uint8Array(CONSTANTS.MEMO_SIZE)
        })
      }

      const anchorHeight = await params.getAnchorHeight()

      return await this.buildTransaction({
        spendingKey: params.spendingKey,
        inputs,
        outputs,
        fee,
        anchorHeight
      })
    } catch (error) {
      throw new AppError(
        ErrorCode.TRANSACTION_FAILED,
        'Failed to build simple transaction',
        true,
        error as Error
      )
    }
  }

  estimateTransactionSize(numSpends: number, numOutputs: number): number {
    const spendSize = 384
    const outputSize = 948
    const overhead = 200

    return overhead + (numSpends * spendSize) + (numOutputs * outputSize)
  }

  estimateFee(numSpends: number, numOutputs: number): bigint {
    return CONSTANTS.DEFAULT_TX_AMOUNT
  }

  private selectNotes(
    availableNotes: ShieldedNote[],
    targetAmount: bigint
  ): { selectedNotes: ShieldedNote[]; change: bigint } {
    const sorted = [...availableNotes].sort((a, b) => 
      Number(b.value - a.value)
    )

    const selectedNotes: ShieldedNote[] = []
    let totalSelected = BigInt(0)

    for (const note of sorted) {
      selectedNotes.push(note)
      totalSelected += note.value

      if (totalSelected >= targetAmount) {
        break
      }
    }

    if (totalSelected < targetAmount) {
      throw new AppError(
        ErrorCode.INSUFFICIENT_FUNDS,
        'Insufficient funds for transaction',
        true
      )
    }

    const change = totalSelected - targetAmount

    return { selectedNotes, change }
  }

  private validateBuildParams(params: BuilderParams): void {
    if (!params.spendingKey) {
      throw new AppError(
        ErrorCode.INVALID_KEY,
        'Spending key is required',
        true
      )
    }

    if (params.inputs.length === 0) {
      throw new AppError(
        ErrorCode.INVALID_AMOUNT,
        'At least one input is required',
        true
      )
    }

    if (params.outputs.length === 0) {
      throw new AppError(
        ErrorCode.INVALID_AMOUNT,
        'At least one output is required',
        true
      )
    }

    for (const output of params.outputs) {
      if (output.memo.length !== CONSTANTS.MEMO_SIZE) {
        throw new AppError(
          ErrorCode.INVALID_MESSAGE,
          `Memo must be exactly ${CONSTANTS.MEMO_SIZE} bytes`,
          true
        )
      }
    }

    const totalInput = params.inputs.reduce((sum, input) => sum + input.note.value, BigInt(0))
    const totalOutput = params.outputs.reduce((sum, output) => sum + output.amount, BigInt(0))
    const expectedTotal = totalOutput + params.fee

    if (totalInput !== expectedTotal) {
      throw new AppError(
        ErrorCode.INVALID_AMOUNT,
        `Input/output mismatch: ${totalInput} ≠ ${expectedTotal}`,
        true
      )
    }
  }

  parseTransaction(rawTx: Uint8Array): {
    version: number
    spends: number
    outputs: number
    fee: bigint
  } {
    return {
      version: 5,
      spends: 0,
      outputs: 0,
      fee: BigInt(0)
    }
  }
}

export default TransactionBuilder

