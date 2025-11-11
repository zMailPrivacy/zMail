export type NetworkType = 'mainnet' | 'testnet'
export type AddressType = 'sapling' | 'orchard'
export type KeyType = 'spending' | 'viewing'

export interface WalletKeys {
  spendingKey?: string
  viewingKey: string
  address: string
  addressType: AddressType
}

export interface EncryptedWalletKeys {
  encrypted: string // Base64 encoded encrypted keys
  salt: string // Base64 encoded salt
  iv: string // Base64 encoded IV
}

export interface Wallet {
  id: string
  name: string
  address: string
  addressType: AddressType
  hasSpendingKey: boolean
  encryptedKeys: EncryptedWalletKeys
  createdAt: number
  lastUsed: number
}

export interface WalletBalance {
  total: bigint
  confirmed: bigint
  pending: bigint
  lastUpdated: number
}

export type MessageType = 'text' | 'continuation' | 'receipt'
export type MessageStatus = 'pending' | 'sent' | 'confirmed' | 'failed'

export interface MemoProtocol {
  version: number // 1 byte
  messageType: MessageType // 1 byte
  sequence: number // 2 bytes (for multi-part messages)
  timestamp: number // 4 bytes (unix timestamp)
  payload: Uint8Array // 504 bytes (encrypted content)
}

export interface Message {
  id: string
  conversationId: string
  fromAddress: string
  toAddress: string
  content: string
  timestamp: number
  status: MessageStatus
  txHash?: string
  amount: bigint
  confirmations: number
  isOutgoing: boolean
  sequence?: number // For multi-part messages
  totalParts?: number // For multi-part messages
}

export interface Conversation {
  id: string
  contactAddress: string
  contactName?: string
  lastMessage?: Message
  unreadCount: number
  createdAt: number
  updatedAt: number
}

export interface Contact {
  id: string
  name: string
  address: string
  addressType: AddressType
  note?: string
  isFavorite: boolean
  createdAt: number
  updatedAt: number
}

export interface Transaction {
  txHash: string
  fromAddress: string
  toAddress: string
  amount: bigint
  fee: bigint
  memo?: Uint8Array
  timestamp: number
  confirmations: number
  blockHeight?: number
  status: 'pending' | 'confirmed' | 'failed'
}

export interface PendingTransaction {
  id: string
  transaction: Transaction
  messageId?: string
  retryCount: number
  createdAt: number
}

export interface BlockInfo {
  height: number
  hash: string
  timestamp: number
  transactions: number
}

export interface SyncStatus {
  isSyncing: boolean
  currentBlock: number
  latestBlock: number
  progress: number // 0-100
  lastSyncTime: number
}

export interface StoredWallet extends Wallet {
  _id?: number
}

export interface StoredMessage extends Message {
  _id?: number
}

export interface StoredContact extends Contact {
  _id?: number
}

export interface StoredTransaction extends Transaction {
  _id?: number
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  network: NetworkType
  autoLockMinutes: number
  minConfirmations: number
  defaultTxAmount: bigint
  notificationsEnabled: boolean
  soundEnabled: boolean
}

export interface NotificationData {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: number
  read: boolean
  actionUrl?: string
}

export interface EncryptionResult {
  encrypted: Uint8Array
  iv: Uint8Array
  salt: Uint8Array
}

export interface KeyDerivationParams {
  password: string
  salt: Uint8Array
  iterations?: number
  keyLength?: number
}

export interface LightwalletdConfig {
  url: string
  network: NetworkType
  timeout?: number
}

export interface SendMessageParams {
  toAddress: string
  content: string
  amount?: bigint
}

export interface ImportWalletParams {
  viewingKey: string
  spendingKey?: string
  name?: string
  password: string
}

export enum ErrorCode {
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  WALLET_LOCKED = 'WALLET_LOCKED',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  INVALID_KEY = 'INVALID_KEY',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  SYNC_ERROR = 'SYNC_ERROR',
  
  STORAGE_ERROR = 'STORAGE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
  
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public recoverable: boolean = true,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export interface UseWalletReturn {
  wallet: Wallet | null
  balance: WalletBalance | null
  isLocked: boolean
  isLoading: boolean
  unlock: (password: string) => Promise<void>
  lock: () => void
  sendTransaction: (to: string, amount: bigint, memo?: Uint8Array) => Promise<string>
}

export interface UseMessagesReturn {
  messages: Message[]
  conversations: Conversation[]
  isLoading: boolean
  sendMessage: (params: SendMessageParams) => Promise<void>
  markAsRead: (conversationId: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
}

export interface UseContactsReturn {
  contacts: Contact[]
  isLoading: boolean
  addContact: (contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateContact: (id: string, updates: Partial<Contact>) => Promise<void>
  deleteContact: (id: string) => Promise<void>
  findContact: (address: string) => Contact | undefined
}

export interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showTimestamp?: boolean
}

export interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
}

export interface ContactItemProps {
  contact: Contact
  onEdit: () => void
  onDelete: () => void
}

export interface WalletCardProps {
  wallet: Wallet
  balance: WalletBalance
  onSelect: () => void
}

export const CONSTANTS = {
  MEMO_SIZE: 512,
  MEMO_PROTOCOL_OVERHEAD: 8, // version + type + sequence + timestamp
  MAX_MESSAGE_SIZE: 504,
  MIN_TX_AMOUNT: BigInt(1000), // 0.00001 ZEC
  DEFAULT_TX_AMOUNT: BigInt(10000), // 0.0001 ZEC
  CONFIRMATIONS_REQUIRED: 6,
  AUTO_LOCK_DEFAULT: 15, // minutes
  SYNC_INTERVAL: 30000, // 30 seconds
  ZEC_DECIMALS: 8,
} as const

export type Constants = typeof CONSTANTS

