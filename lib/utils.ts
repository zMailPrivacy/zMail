import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind CSS classes with proper precedence
 */
export const cn = (...inputs: ClassValue[]): string => {
  return twMerge(clsx(inputs))
}

/**
 * Format ZEC amount for display
 */
export const formatZEC = (amount: bigint | number | string): string => {
  const value = typeof amount === 'bigint' ? Number(amount) : Number(amount)
  const zec = value / 100000000 // ZEC has 8 decimal places
  return zec.toFixed(8)
}

/**
 * Parse ZEC amount from string to satoshis
 */
export const parseZEC = (amount: string): bigint => {
  const value = parseFloat(amount)
  if (isNaN(value)) return BigInt(0)
  return BigInt(Math.floor(value * 100000000))
}

/**
 * Format timestamp to readable date
 */
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  // Less than 24 hours: show time
  if (diff < 86400000) {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }
  
  // Less than 7 days: show day name
  if (diff < 604800000) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }
  
  // Otherwise: show date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  })
}

/**
 * Format timestamp to full date and time
 */
export const formatFullDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Truncate address for display
 */
export const truncateAddress = (address: string, chars: number = 8): string => {
  if (address.length <= chars * 2) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

/**
 * Sleep utility for async operations
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry async operation with exponential backoff
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts) {
        await sleep(delay * Math.pow(2, attempt - 1))
      }
    }
  }
  
  throw lastError!
}

/**
 * Convert Uint8Array to hex string
 */
export const uint8ArrayToHex = (arr: Uint8Array): string => {
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert hex string to Uint8Array
 */
export const hexToUint8Array = (hex: string): Uint8Array => {
  const matches = hex.match(/.{1,2}/g)
  if (!matches) return new Uint8Array()
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)))
}

/**
 * Validate Zcash address format
 */
export const isValidZcashAddress = (address: string): boolean => {
  // Simplified validation - real validation would check more thoroughly
  // Sapling addresses start with 'zs'
  // Orchard addresses start with 'u'
  const saplingRegex = /^zs[a-z0-9]{76}$/i
  const orchardRegex = /^u1[a-z0-9]{74}$/i
  
  return saplingRegex.test(address) || orchardRegex.test(address)
}

/**
 * Generate random ID
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Check if running in browser
 */
export const isBrowser = (): boolean => {
  return typeof window !== 'undefined'
}

/**
 * Safe JSON parse
 */
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

