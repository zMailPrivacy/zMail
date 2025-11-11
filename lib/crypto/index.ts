import nacl from 'tweetnacl'
import * as naclUtil from 'tweetnacl-util'
import { sha256 } from '@noble/hashes/sha256'
import { pbkdf2 } from '@noble/hashes/pbkdf2'
import { 
  EncryptionResult, 
  KeyDerivationParams, 
  AppError, 
  ErrorCode 
} from '@/types'

/**
 * Crypto Service
 * Handles all cryptographic operations: encryption, decryption, hashing, key derivation
 */
export class CryptoService {
  private static readonly KEY_LENGTH = 32 // 256 bits
  private static readonly SALT_LENGTH = 32 // 256 bits
  private static readonly ITERATIONS = 100000 // PBKDF2 iterations
  private static readonly IV_LENGTH = 24 // NaCl nonce length

  /**
   * Generate a random salt
   */
  static generateSalt(): Uint8Array {
    return nacl.randomBytes(this.SALT_LENGTH)
  }

  /**
   * Generate a random IV (nonce)
   */
  static generateIV(): Uint8Array {
    return nacl.randomBytes(this.IV_LENGTH)
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  static async deriveKey(params: KeyDerivationParams): Promise<Uint8Array> {
    const {
      password,
      salt,
      iterations = this.ITERATIONS,
      keyLength = this.KEY_LENGTH
    } = params

    try {
      const passwordBytes = new TextEncoder().encode(password)
      
      // Use PBKDF2 with SHA-256
      const key = pbkdf2(sha256, passwordBytes, salt, {
        c: iterations,
        dkLen: keyLength
      })

      return key
    } catch (error) {
      throw new AppError(
        ErrorCode.ENCRYPTION_ERROR,
        'Failed to derive key from password',
        true,
        error as Error
      )
    }
  }

  /**
   * Encrypt data using NaCl secretbox (XSalsa20-Poly1305)
   */
  static async encrypt(
    data: Uint8Array,
    password: string,
    providedSalt?: Uint8Array
  ): Promise<EncryptionResult> {
    try {
      const salt = providedSalt || this.generateSalt()
      const iv = this.generateIV()
      const key = await this.deriveKey({ password, salt })

      const encrypted = nacl.secretbox(data, iv, key)

      if (!encrypted) {
        throw new Error('Encryption failed')
      }

      // Zero out sensitive data
      key.fill(0)

      return {
        encrypted,
        iv,
        salt
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.ENCRYPTION_ERROR,
        'Failed to encrypt data',
        true,
        error as Error
      )
    }
  }

  /**
   * Decrypt data using NaCl secretbox
   */
  static async decrypt(
    encrypted: Uint8Array,
    password: string,
    salt: Uint8Array,
    iv: Uint8Array
  ): Promise<Uint8Array> {
    try {
      const key = await this.deriveKey({ password, salt })
      const decrypted = nacl.secretbox.open(encrypted, iv, key)

      // Zero out sensitive data
      key.fill(0)

      if (!decrypted) {
        throw new AppError(
          ErrorCode.INVALID_PASSWORD,
          'Failed to decrypt data - invalid password',
          true
        )
      }

      return decrypted
    } catch (error) {
      if (error instanceof AppError) throw error
      
      throw new AppError(
        ErrorCode.DECRYPTION_ERROR,
        'Failed to decrypt data',
        true,
        error as Error
      )
    }
  }

  /**
   * Encrypt string data
   */
  static async encryptString(
    data: string,
    password: string
  ): Promise<{
    encrypted: string
    salt: string
    iv: string
  }> {
    const dataBytes = new TextEncoder().encode(data)
    const result = await this.encrypt(dataBytes, password)

    return {
      encrypted: naclUtil.encodeBase64(result.encrypted),
      salt: naclUtil.encodeBase64(result.salt),
      iv: naclUtil.encodeBase64(result.iv)
    }
  }

  /**
   * Decrypt string data
   */
  static async decryptString(
    encrypted: string,
    password: string,
    salt: string,
    iv: string
  ): Promise<string> {
    const encryptedBytes = naclUtil.decodeBase64(encrypted)
    const saltBytes = naclUtil.decodeBase64(salt)
    const ivBytes = naclUtil.decodeBase64(iv)

    const decrypted = await this.decrypt(
      encryptedBytes,
      password,
      saltBytes,
      ivBytes
    )

    return new TextDecoder().decode(decrypted)
  }

  /**
   * Hash data using SHA-256
   */
  static hash(data: Uint8Array): Uint8Array {
    return sha256(data)
  }

  /**
   * Hash string using SHA-256
   */
  static hashString(data: string): string {
    const dataBytes = new TextEncoder().encode(data)
    const hash = this.hash(dataBytes)
    return Array.from(hash)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Generate random bytes
   */
  static randomBytes(length: number): Uint8Array {
    return nacl.randomBytes(length)
  }

  /**
   * Secure compare two byte arrays (constant time)
   */
  static secureCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false
    
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i]
    }
    
    return result === 0
  }

  /**
   * Zero out sensitive data in memory
   */
  static zeroMemory(data: Uint8Array): void {
    data.fill(0)
  }

  /**
   * Validate encryption key strength
   */
  static validateKeyStrength(password: string): {
    valid: boolean
    score: number
    feedback: string[]
  } {
    const feedback: string[] = []
    let score = 0

    // Length check
    if (password.length < 8) {
      feedback.push('Password should be at least 8 characters')
    } else if (password.length >= 12) {
      score += 2
    } else {
      score += 1
    }

    // Complexity checks
    if (/[a-z]/.test(password)) score += 1
    else feedback.push('Add lowercase letters')

    if (/[A-Z]/.test(password)) score += 1
    else feedback.push('Add uppercase letters')

    if (/[0-9]/.test(password)) score += 1
    else feedback.push('Add numbers')

    if (/[^a-zA-Z0-9]/.test(password)) score += 1
    else feedback.push('Add special characters')

    // Common patterns
    if (/^[0-9]+$/.test(password)) {
      feedback.push('Avoid using only numbers')
      score = Math.max(0, score - 2)
    }

    if (/^[a-z]+$/.test(password)) {
      feedback.push('Avoid using only lowercase letters')
      score = Math.max(0, score - 1)
    }

    const valid = score >= 4 && password.length >= 8

    return {
      valid,
      score: Math.min(5, score),
      feedback
    }
  }
}

/**
 * Secure password hashing for verification (not for encryption)
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = CryptoService.generateSalt()
  const key = await CryptoService.deriveKey({ password, salt })
  
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const keyHex = Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('')
  
  CryptoService.zeroMemory(key)
  
  return `${saltHex}:${keyHex}`
}

/**
 * Verify password against hash
 */
export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  try {
    const [saltHex, keyHex] = hash.split(':')
    
    const salt = new Uint8Array(
      saltHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    )
    
    const storedKey = new Uint8Array(
      keyHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    )
    
    const derivedKey = await CryptoService.deriveKey({ password, salt })
    
    const result = CryptoService.secureCompare(derivedKey, storedKey)
    
    CryptoService.zeroMemory(derivedKey)
    
    return result
  } catch {
    return false
  }
}

export default CryptoService

