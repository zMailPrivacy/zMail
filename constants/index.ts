export const APP_CONFIG = {
  name: 'zMail',
  version: '0.1.0',
  description: 'Private messaging on the Zcash blockchain',
} as const

export const ZCASH_CONFIG = {
  MEMO_SIZE: 512,
  MEMO_PROTOCOL_OVERHEAD: 8,
  MAX_MESSAGE_SIZE: 504,
  
  MIN_TX_AMOUNT: BigInt(1000),
  DEFAULT_TX_AMOUNT: BigInt(10000),
  FEE_AMOUNT: BigInt(10000),
  
  CONFIRMATIONS_REQUIRED: 6,
  CONFIRMATIONS_SAFE: 10,
  
  ZEC_DECIMALS: 8,
  ZATOSHI_PER_ZEC: BigInt(100000000),
} as const

export const STORAGE_CONFIG = {
  DB_NAME: 'ZMailDB',
  DB_VERSION: 1,
  STORAGE_KEY_PREFIX: 'zmail_',
  SETTINGS_KEY: 'zmail-settings',
} as const

export const SECURITY_CONFIG = {
  KEY_LENGTH: 32,
  SALT_LENGTH: 32,
  IV_LENGTH: 24,
  PBKDF2_ITERATIONS: 100000,
  
  AUTO_LOCK_DEFAULT: 15,
  AUTO_LOCK_OPTIONS: [5, 10, 15, 30, 60],
  
  MIN_PASSWORD_LENGTH: 8,
  RECOMMENDED_PASSWORD_LENGTH: 12,
} as const

export const NETWORK_CONFIG = {
  SYNC_INTERVAL: 30000,
  SYNC_BATCH_SIZE: 100,
  
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  RETRY_BACKOFF: 2,
  
  REQUEST_TIMEOUT: 30000,
  
  MAINNET_LIGHTWALLETD: 'https://mainnet.lightwalletd.com:9067',
  TESTNET_LIGHTWALLETD: 'https://testnet.lightwalletd.com:9067',
  
  MAINNET_EXPLORER: 'https://explorer.zcha.in',
  TESTNET_EXPLORER: 'https://testnet.explorer.zcha.in',
} as const

export const UI_CONFIG = {
  MAX_MESSAGES_DISPLAY: 100,
  MESSAGE_LOAD_MORE: 50,
  
  MAX_CONVERSATIONS_DISPLAY: 50,
  
  SEARCH_DEBOUNCE: 300,
  MIN_SEARCH_LENGTH: 2,
  
  NOTIFICATION_DURATION: 5000,
  MAX_NOTIFICATIONS: 10,
  
  TOAST_DURATION: 3000,
  
  ANIMATION_DURATION: 200,
} as const

export const ADDRESS_FORMATS = {
  SAPLING_PREFIX: 'zs',
  SAPLING_LENGTH: 78,
  
  ORCHARD_PREFIX: 'u1',
  ORCHARD_MIN_LENGTH: 76,
  
  SAPLING_FVK_PREFIX: 'zviews',
  SAPLING_IVK_PREFIX: 'zivk',
  UNIFIED_VK_PREFIX: 'uview1',
  
  SAPLING_SK_PREFIX: 'secret-extended-key-main',
  UNIFIED_SK_PREFIX: 'u-secret-spending-key',
} as const

export const ERROR_MESSAGES = {
  WALLET_NOT_FOUND: 'Wallet not found',
  WALLET_LOCKED: 'Wallet is locked. Please unlock to continue.',
  INVALID_PASSWORD: 'Invalid password',
  INVALID_KEY: 'Invalid key format',
  INVALID_ADDRESS: 'Invalid Zcash address',
  
  INSUFFICIENT_FUNDS: 'Insufficient funds',
  TRANSACTION_FAILED: 'Transaction failed',
  INVALID_AMOUNT: 'Invalid amount',
  
  NETWORK_ERROR: 'Network error occurred',
  CONNECTION_FAILED: 'Failed to connect to network',
  SYNC_ERROR: 'Synchronization error',
  
  STORAGE_ERROR: 'Storage error occurred',
  ENCRYPTION_ERROR: 'Encryption failed',
  DECRYPTION_ERROR: 'Decryption failed',
  
  MESSAGE_TOO_LONG: 'Message is too long',
  INVALID_MESSAGE: 'Invalid message format',
  
  UNKNOWN_ERROR: 'An unknown error occurred',
} as const

export const SUCCESS_MESSAGES = {
  WALLET_IMPORTED: 'Wallet imported successfully',
  WALLET_UNLOCKED: 'Wallet unlocked',
  WALLET_LOCKED: 'Wallet locked',
  MESSAGE_SENT: 'Message sent',
  MESSAGE_RECEIVED: 'New message received',
  CONTACT_ADDED: 'Contact added',
  CONTACT_UPDATED: 'Contact updated',
  CONTACT_DELETED: 'Contact deleted',
  SETTINGS_UPDATED: 'Settings updated',
} as const

export const REGEX_PATTERNS = {
  SAPLING_ADDRESS: /^zs[a-z0-9]{76}$/i,
  
  UNIFIED_ADDRESS: /^u1[a-z0-9]{74,}$/i,
  
  SAPLING_FVK: /^zviews[0-9a-z]{141}$/i,
  
  SAPLING_IVK: /^zivk[0-9a-z]{143}$/i,
  
  UNIFIED_VK: /^uview1[0-9a-z]{100,}$/i,
  
  SAPLING_SK: /^secret-extended-key-main[0-9a-z]{100,}$/i,
  
  UNIFIED_SK: /^u-secret-spending-key[0-9a-z]{100,}$/i,
  
  TX_HASH: /^[0-9a-f]{64}$/i,
} as const

export const LOCAL_STORAGE_KEYS = {
  THEME: 'zmail_theme',
  LANGUAGE: 'zmail_language',
  LAST_WALLET: 'zmail_last_wallet',
  SIDEBAR_STATE: 'zmail_sidebar',
} as const

import config from '@/config/settings'

export const ENV = {
  NETWORK: config.network,
  LIGHTWALLETD_URL: config.blockchainAPI[config.network],
  EXPLORER_URL: config.network === 'mainnet' 
    ? 'https://explorer.zcha.in' 
    : 'https://explorer.testnet.z.cash',
  MIN_CONFIRMATIONS: config.security.minConfirmations,
  AUTO_LOCK_MINUTES: Math.floor(config.security.autoLockTimeout / 60000),
  ENABLE_TESTNET_TOGGLE: true,
} as const

export type NetworkType = 'mainnet' | 'testnet'
export type AddressType = 'sapling' | 'orchard'
export type MessageType = 'text' | 'continuation' | 'receipt'
export type MessageStatus = 'pending' | 'sent' | 'confirmed' | 'failed'

export const isMainnet = (): boolean => ENV.NETWORK === 'mainnet'
export const isTestnet = (): boolean => ENV.NETWORK === 'testnet'

export const getLightwalletdUrl = (network?: NetworkType): string => {
  const net = network || ENV.NETWORK
  return net === 'mainnet' 
    ? NETWORK_CONFIG.MAINNET_LIGHTWALLETD 
    : NETWORK_CONFIG.TESTNET_LIGHTWALLETD
}

export const getExplorerUrl = (network?: NetworkType): string => {
  const net = network || ENV.NETWORK
  return net === 'mainnet'
    ? NETWORK_CONFIG.MAINNET_EXPLORER
    : NETWORK_CONFIG.TESTNET_EXPLORER
}

export const getExplorerTxUrl = (txHash: string, network?: NetworkType): string => {
  return `${getExplorerUrl(network)}/tx/${txHash}`
}

export const getExplorerAddressUrl = (address: string, network?: NetworkType): string => {
  return `${getExplorerUrl(network)}/address/${address}`
}

