import {
  MemoProtocol,
  MessageType,
  AppError,
  ErrorCode,
  CONSTANTS
} from '@/types'

/**
 * Memo Protocol Service
 * Handles encoding and decoding messages in Zcash memo format
 * 
 * Memo Structure (512 bytes):
 * [Version:1][MessageType:1][Sequence:2][Timestamp:4][Payload:504]
 */
export class MemoProtocolService {
  private static readonly VERSION = 1
  private static readonly HEADER_SIZE = CONSTANTS.MEMO_PROTOCOL_OVERHEAD

  /**
   * Encode message to memo format
   */
  static encode(
    content: string,
    messageType: MessageType = 'text',
    sequence: number = 0
  ): Uint8Array {
    try {
      // Convert content to bytes
      const contentBytes = new TextEncoder().encode(content)

      // Check size constraints
      if (contentBytes.length > CONSTANTS.MAX_MESSAGE_SIZE) {
        throw new AppError(
          ErrorCode.MESSAGE_TOO_LONG,
          `Message too long. Maximum ${CONSTANTS.MAX_MESSAGE_SIZE} bytes`,
          true
        )
      }

      // Create memo buffer
      const memo = new Uint8Array(CONSTANTS.MEMO_SIZE)
      let offset = 0

      // Version (1 byte)
      memo[offset++] = this.VERSION

      // Message Type (1 byte)
      memo[offset++] = this.messageTypeToCode(messageType)

      // Sequence (2 bytes, big-endian)
      memo[offset++] = (sequence >> 8) & 0xFF
      memo[offset++] = sequence & 0xFF

      // Timestamp (4 bytes, big-endian)
      const timestamp = Math.floor(Date.now() / 1000)
      memo[offset++] = (timestamp >> 24) & 0xFF
      memo[offset++] = (timestamp >> 16) & 0xFF
      memo[offset++] = (timestamp >> 8) & 0xFF
      memo[offset++] = timestamp & 0xFF

      // Payload (content + padding)
      memo.set(contentBytes, offset)

      return memo
    } catch (error) {
      if (error instanceof AppError) throw error
      
      throw new AppError(
        ErrorCode.INVALID_MESSAGE,
        'Failed to encode message',
        true,
        error as Error
      )
    }
  }

  /**
   * Decode memo to message protocol
   */
  static decode(memo: Uint8Array): MemoProtocol {
    try {
      if (memo.length !== CONSTANTS.MEMO_SIZE) {
        throw new Error('Invalid memo size')
      }

      let offset = 0

      // Version (1 byte)
      const version = memo[offset++]
      if (version !== this.VERSION) {
        throw new Error(`Unsupported protocol version: ${version}`)
      }

      // Message Type (1 byte)
      const messageTypeCode = memo[offset++]
      const messageType = this.codeToMessageType(messageTypeCode)

      // Sequence (2 bytes, big-endian)
      const sequence = (memo[offset++] << 8) | memo[offset++]

      // Timestamp (4 bytes, big-endian)
      const timestamp = (
        (memo[offset++] << 24) |
        (memo[offset++] << 16) |
        (memo[offset++] << 8) |
        memo[offset++]
      )

      // Payload (remaining bytes)
      const payload = memo.slice(offset)

      return {
        version,
        messageType,
        sequence,
        timestamp,
        payload
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.INVALID_MESSAGE,
        'Failed to decode memo',
        true,
        error as Error
      )
    }
  }

  /**
   * Extract message content from payload
   */
  static extractContent(payload: Uint8Array): string {
    try {
      // Find the end of actual content (first null byte or end)
      let endIndex = payload.length
      for (let i = 0; i < payload.length; i++) {
        if (payload[i] === 0) {
          endIndex = i
          break
        }
      }

      const contentBytes = payload.slice(0, endIndex)
      return new TextDecoder().decode(contentBytes)
    } catch (error) {
      throw new AppError(
        ErrorCode.INVALID_MESSAGE,
        'Failed to extract content from payload',
        true,
        error as Error
      )
    }
  }

  /**
   * Split long message into multiple parts
   */
  static splitMessage(content: string): string[] {
    const contentBytes = new TextEncoder().encode(content)
    const maxSize = CONSTANTS.MAX_MESSAGE_SIZE
    const parts: string[] = []

    for (let i = 0; i < contentBytes.length; i += maxSize) {
      const chunk = contentBytes.slice(i, i + maxSize)
      const chunkStr = new TextDecoder().decode(chunk)
      parts.push(chunkStr)
    }

    return parts
  }

  /**
   * Combine multi-part messages
   */
  static combineMessages(messages: MemoProtocol[]): string {
    // Sort by sequence number
    const sorted = messages.sort((a, b) => a.sequence - b.sequence)
    
    // Extract and combine content
    const contents = sorted.map(msg => this.extractContent(msg.payload))
    
    return contents.join('')
  }

  /**
   * Validate memo structure
   */
  static validate(memo: Uint8Array): boolean {
    try {
      if (memo.length !== CONSTANTS.MEMO_SIZE) return false
      
      const version = memo[0]
      if (version !== this.VERSION) return false
      
      const messageTypeCode = memo[1]
      if (messageTypeCode < 1 || messageTypeCode > 3) return false
      
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if message needs to be split
   */
  static needsSplit(content: string): boolean {
    const contentBytes = new TextEncoder().encode(content)
    return contentBytes.length > CONSTANTS.MAX_MESSAGE_SIZE
  }

  /**
   * Get number of parts needed for message
   */
  static getPartsCount(content: string): number {
    const contentBytes = new TextEncoder().encode(content)
    return Math.ceil(contentBytes.length / CONSTANTS.MAX_MESSAGE_SIZE)
  }

  /**
   * Create empty memo
   */
  static createEmpty(): Uint8Array {
    return new Uint8Array(CONSTANTS.MEMO_SIZE)
  }

  /**
   * Check if memo is empty
   */
  static isEmpty(memo: Uint8Array): boolean {
    return memo.every(byte => byte === 0)
  }

  /**
   * Convert message type to code
   */
  private static messageTypeToCode(type: MessageType): number {
    switch (type) {
      case 'text': return 1
      case 'continuation': return 2
      case 'receipt': return 3
      default: return 1
    }
  }

  /**
   * Convert code to message type
   */
  private static codeToMessageType(code: number): MessageType {
    switch (code) {
      case 1: return 'text'
      case 2: return 'continuation'
      case 3: return 'receipt'
      default: return 'text'
    }
  }
}

/**
 * Helper function to encode message
 */
export const encodeMessage = (
  content: string,
  type?: MessageType,
  sequence?: number
): Uint8Array => {
  return MemoProtocolService.encode(content, type, sequence)
}

/**
 * Helper function to decode message
 */
export const decodeMessage = (memo: Uint8Array): string => {
  const protocol = MemoProtocolService.decode(memo)
  return MemoProtocolService.extractContent(protocol.payload)
}

/**
 * Helper function to prepare messages for sending
 */
export const prepareMessagesForSending = (content: string): Uint8Array[] => {
  if (!MemoProtocolService.needsSplit(content)) {
    return [MemoProtocolService.encode(content, 'text', 0)]
  }

  const parts = MemoProtocolService.splitMessage(content)
  return parts.map((part, index) => {
    const type: MessageType = index === 0 ? 'text' : 'continuation'
    return MemoProtocolService.encode(part, type, index)
  })
}

export default MemoProtocolService

