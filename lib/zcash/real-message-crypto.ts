import nacl from 'tweetnacl'
import * as naclUtil from 'tweetnacl-util'
import { sha256 } from '@noble/hashes/sha256'
import { blake2b } from '@noble/hashes/blake2b'
import { pbkdf2 } from '@noble/hashes/pbkdf2'
import { AppError, ErrorCode } from '@/types'

export interface EncryptedMessage {
  ciphertext: Uint8Array
  nonce: Uint8Array
  ephemeralPubKey: Uint8Array
  mac: Uint8Array
}

export class RealMessageCrypto {
  
  static async encryptMessage(
    message: string,
    senderPrivateKey: Uint8Array,
    recipientPublicKey: Uint8Array
  ): Promise<EncryptedMessage> {
    try {
      const ephemeralKeypair = nacl.box.keyPair()
      
      const sharedSecret = nacl.box.before(recipientPublicKey, ephemeralKeypair.secretKey)
      
      const nonce = nacl.randomBytes(nacl.box.nonceLength)
      
      const messageBytes = new TextEncoder().encode(message)
      const ciphertext = nacl.box.after(messageBytes, nonce, sharedSecret)
      
      const mac = this.calculateMAC(ciphertext, nonce, ephemeralKeypair.publicKey)
      
      return {
        ciphertext,
        nonce,
        ephemeralPubKey: ephemeralKeypair.publicKey,
        mac
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.ENCRYPTION_FAILED,
        'Failed to encrypt message',
        true
      )
    }
  }

  static async decryptMessage(
    encrypted: EncryptedMessage,
    recipientPrivateKey: Uint8Array,
    senderPublicKey: Uint8Array
  ): Promise<string> {
    try {
      const expectedMAC = this.calculateMAC(
        encrypted.ciphertext,
        encrypted.nonce,
        encrypted.ephemeralPubKey
      )
      
      if (!this.constantTimeEqual(encrypted.mac, expectedMAC)) {
        throw new Error('MAC verification failed - message may be tampered')
      }
      
      const sharedSecret = nacl.box.before(encrypted.ephemeralPubKey, recipientPrivateKey)
      
      const decrypted = nacl.box.open.after(
        encrypted.ciphertext,
        encrypted.nonce,
        sharedSecret
      )
      
      if (!decrypted) {
        throw new Error('Decryption failed - invalid key or corrupted data')
      }
      
      const message = new TextDecoder().decode(decrypted)
      
      return message
    } catch (error) {
      throw new AppError(
        ErrorCode.DECRYPTION_FAILED,
        'Failed to decrypt message: ' + (error instanceof Error ? error.message : 'Unknown error'),
        false
      )
    }
  }

  static deriveEncryptionKeypair(spendingKey: string): nacl.BoxKeyPair {
    const seed = blake2b(new TextEncoder().encode(spendingKey), { dkLen: 32 })
    
    return nacl.box.keyPair.fromSecretKey(seed)
  }

  static derivePublicKeyFromAddress(address: string): Uint8Array {
    const hash = blake2b(new TextEncoder().encode(address), { dkLen: 32 })
    
    return this.clampCurve25519(hash)
  }

  static encodeToMemo(encrypted: EncryptedMessage): Uint8Array {
    const memo = new Uint8Array(512)
    let offset = 0
    
    memo[0] = 0x5A
    memo[1] = 0x4D
    memo[2] = 0x01
    offset = 3
    
    memo.set(encrypted.nonce, offset)
    offset += 24
    
    memo.set(encrypted.ephemeralPubKey, offset)
    offset += 32
    
    memo.set(encrypted.mac, offset)
    offset += 32
    
    const ctLength = Math.min(encrypted.ciphertext.length, 512 - offset - 2)
    memo[offset] = ctLength & 0xff
    memo[offset + 1] = (ctLength >> 8) & 0xff
    offset += 2
    
    memo.set(encrypted.ciphertext.slice(0, ctLength), offset)
    
    return memo
  }

  static decodeFromMemo(memo: Uint8Array): EncryptedMessage | null {
    try {
      if (memo[0] !== 0x5A || memo[1] !== 0x4D) {
        return null
      }
      
      const version = memo[2]
      if (version !== 0x01) {
        return null
      }
      
      let offset = 3
      
      const nonce = memo.slice(offset, offset + 24)
      offset += 24
      
      const ephemeralPubKey = memo.slice(offset, offset + 32)
      offset += 32
      
      const mac = memo.slice(offset, offset + 32)
      offset += 32
      
      const ctLength = memo[offset] | (memo[offset + 1] << 8)
      offset += 2
      
      const ciphertext = memo.slice(offset, offset + ctLength)
      
      return {
        ciphertext,
        nonce,
        ephemeralPubKey,
        mac
      }
    } catch (error) {
      return null
    }
  }

  private static calculateMAC(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    ephemeralPubKey: Uint8Array
  ): Uint8Array {
    const data = new Uint8Array(ciphertext.length + nonce.length + ephemeralPubKey.length)
    data.set(ciphertext, 0)
    data.set(nonce, ciphertext.length)
    data.set(ephemeralPubKey, ciphertext.length + nonce.length)
    
    return blake2b(data, { dkLen: 32 })
  }

  private static constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false
    
    let diff = 0
    for (let i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i]
    }
    
    return diff === 0
  }

  private static clampCurve25519(bytes: Uint8Array): Uint8Array {
    const clamped = new Uint8Array(bytes)
    clamped[0] &= 248
    clamped[31] &= 127
    clamped[31] |= 64
    return clamped
  }

  static deriveViewingKey(spendingKey: string): string {
    const hash = blake2b(new TextEncoder().encode(spendingKey + 'viewing'), { dkLen: 32 })
    return Buffer.from(hash).toString('hex')
  }
}

export default RealMessageCrypto

