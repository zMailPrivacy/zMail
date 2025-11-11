import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  Wallet,
  WalletBalance,
  Message,
  Conversation,
  Contact,
  AppSettings,
  NotificationData,
  SyncStatus,
  SendMessageParams,
  AppError,
  ErrorCode,
  CONSTANTS
} from '@/types'
import StorageService from '@/lib/storage/db'
import CryptoService from '@/lib/crypto'
import ZcashWalletService from '@/lib/zcash/wallet'
import { MemoProtocolService } from '@/lib/zcash/memo'
import { createBlockchainService } from '@/lib/zcash/blockchain'
import { createRealMessageService } from '@/lib/zcash/real-message-service'
import { generateId } from '@/lib/utils'

interface WalletState {
  currentWallet: Wallet | null
  wallets: Wallet[]
  balance: WalletBalance | null
  isLocked: boolean
  isLoading: boolean
  error: string | null
  
  unlockedKeys: {
    viewingKey: string
    spendingKey?: string
  } | null
  
  initialize: () => Promise<void>
  importWallet: (params: {
    viewingKey: string
    spendingKey?: string
    address: string
    name: string
    password: string
  }) => Promise<void>
  selectWallet: (walletId: string) => Promise<void>
  unlockWallet: (password: string) => Promise<void>
  lockWallet: () => void
  refreshBalance: () => Promise<void>
  deleteWallet: (walletId: string) => Promise<void>
  signOut: () => void
}

export const useWalletStore = create<WalletState>((set, get) => ({
  currentWallet: null,
  wallets: [],
  balance: null,
  isLocked: true,
  isLoading: false,
  error: null,
  unlockedKeys: null,

  initialize: async () => {
    try {
      const wallets = await StorageService.getAllWallets()
      set({ wallets })
      
      if (wallets.length > 0) {
        const mostRecent = wallets[0]
        set({ currentWallet: mostRecent })
      }
    } catch (error) {
    }
  },

  importWallet: async (params) => {
    set({ isLoading: true, error: null })
    try {
      const walletKeys = await ZcashWalletService.importWallet({
        viewingKey: params.viewingKey,
        spendingKey: params.spendingKey,
        address: params.address
      })

      const keysJson = JSON.stringify(walletKeys)
      const encrypted = await CryptoService.encryptString(keysJson, params.password)

      const wallet: Wallet = {
        id: generateId(),
        name: params.name,
        address: params.address,
        addressType: walletKeys.addressType,
        hasSpendingKey: !!params.spendingKey,
        encryptedKeys: encrypted,
        createdAt: Date.now(),
        lastUsed: Date.now()
      }

      await StorageService.saveWallet(wallet)

      const wallets = [...get().wallets, wallet]
      set({
        wallets,
        currentWallet: wallet,
        unlockedKeys: walletKeys,
        isLocked: false,
        isLoading: false
      })

      await get().refreshBalance()
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to import wallet'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  selectWallet: async (walletId) => {
    set({ isLoading: true, error: null })
    try {
      const wallet = await StorageService.getWallet(walletId)
      if (!wallet) {
        throw new AppError(ErrorCode.WALLET_NOT_FOUND, 'Wallet not found', true)
      }

      await StorageService.updateWalletLastUsed(walletId)
      
      set({
        currentWallet: wallet,
        isLocked: true,
        unlockedKeys: null,
        balance: null,
        isLoading: false
      })
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to select wallet'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  unlockWallet: async (password) => {
    set({ isLoading: true, error: null })
    try {
      const { currentWallet } = get()
      if (!currentWallet) {
        throw new AppError(ErrorCode.WALLET_NOT_FOUND, 'No wallet selected', true)
      }

      const keysJson = await CryptoService.decryptString(
        currentWallet.encryptedKeys.encrypted,
        password,
        currentWallet.encryptedKeys.salt,
        currentWallet.encryptedKeys.iv
      )

      const keys = JSON.parse(keysJson)

      set({
        unlockedKeys: keys,
        isLocked: false,
        isLoading: false
      })

      await get().refreshBalance()
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to unlock wallet'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  lockWallet: () => {
    const { unlockedKeys } = get()
    
    if (unlockedKeys) {
      Object.keys(unlockedKeys).forEach(key => {
        delete (unlockedKeys as any)[key]
      })
    }

    set({
      isLocked: true,
      unlockedKeys: null
    })
  },

  signOut: () => {
    const { unlockedKeys } = get()

    if (unlockedKeys) {
      Object.keys(unlockedKeys).forEach(key => {
        delete (unlockedKeys as any)[key]
      })
    }

    set({
      currentWallet: null,
      isLocked: true,
      unlockedKeys: null,
      balance: null,
      error: null
    })
  },

  refreshBalance: async () => {
    try {
      const { currentWallet } = get()
      if (!currentWallet) return

      const blockchain = createBlockchainService()
      await blockchain.connect()
      
      const balance = await blockchain.getBalance(currentWallet.address)

      set({
        balance: {
          ...balance,
          lastUpdated: Date.now()
        }
      })
    } catch (error) {
    }
  },

  deleteWallet: async (walletId) => {
    set({ isLoading: true, error: null })
    try {
      await StorageService.deleteWallet(walletId)
      
      const wallets = get().wallets.filter(w => w.id !== walletId)
      const currentWallet = get().currentWallet?.id === walletId ? null : get().currentWallet

      set({
        wallets,
        currentWallet,
        isLoading: false
      })
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to delete wallet'
      set({ error: message, isLoading: false })
      throw error
    }
  }
}))

interface MessageState {
  messages: Message[]
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading: boolean
  isSending: boolean
  isScanning: boolean
  scanProgress: { current: number; total: number } | null
  error: string | null
  
  loadMessages: () => Promise<void>
  sendMessage: (params: SendMessageParams) => Promise<void>
  markAsRead: (conversationId: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  setCurrentConversation: (conversationId: string | null) => void
  refreshMessages: () => Promise<void>
  updateMessageConfirmations: (messageId: string, confirmations: number) => Promise<void>
  startMessageScanning: (startHeight?: number) => Promise<void>
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  conversations: [],
  currentConversationId: null,
  isLoading: false,
  isSending: false,
  isScanning: false,
  scanProgress: null,
  error: null,

  loadMessages: async () => {
    set({ isLoading: true, error: null })
    try {
      const messages = await StorageService.getAllMessages()
      const conversations = buildConversations(messages)
      
      set({
        messages,
        conversations,
        isLoading: false
      })
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to load messages'
      set({ error: message, isLoading: false })
    }
  },

  sendMessage: async (params) => {
    set({ isSending: true, error: null })
    try {
      const walletStore = useWalletStore.getState()
      const { currentWallet, unlockedKeys, isLocked } = walletStore

      if (!currentWallet) {
        throw new AppError(ErrorCode.WALLET_NOT_FOUND, 'No wallet selected', true)
      }

      if (isLocked || !unlockedKeys?.spendingKey) {
        throw new AppError(ErrorCode.WALLET_LOCKED, 'Wallet is locked', true)
      }

      const amount = params.amount || CONSTANTS.DEFAULT_TX_AMOUNT

      const { config } = await import('@/config/settings')
      const messageService = createRealMessageService(config.network)

      const result = await messageService.sendMessage({
        fromAddress: currentWallet.address,
        toAddress: params.toAddress,
        spendingKey: unlockedKeys.spendingKey,
        content: params.content,
        amount
      })

      const message: Message = {
        id: result.messageId,
        conversationId: params.toAddress,
        fromAddress: currentWallet.address,
        toAddress: params.toAddress,
        content: params.content,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'sent',
        txHash: result.txHash,
        amount,
        confirmations: 0,
        isOutgoing: true
      }

      await StorageService.saveMessage(message)

      const messages = [...get().messages, message]
      const conversations = buildConversations(messages)
      
      set({
        messages,
        conversations,
        isSending: false
      })

      const { isZcashNodeEnabled } = await import('@/config/settings')
      
      if (await isZcashNodeEnabled()) {
        messageService.waitForConfirmations({
          txHash: result.txHash,
          targetConfirmations: 6,
          onProgress: (confirmations) => {
            get().updateMessageConfirmations(result.messageId, confirmations)
          }
        }).catch(() => {
        })
      } else {
        setTimeout(() => {
          get().updateMessageConfirmations(result.messageId, 1)
        }, 2000)
      }
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to send message'
      set({ error: message, isSending: false })
      throw error
    }
  },

  updateMessageConfirmations: async (messageId: string, confirmations: number) => {
    const messages = get().messages.map(m => 
      m.id === messageId 
        ? { ...m, confirmations, status: confirmations >= 6 ? 'confirmed' : 'sent' as any }
        : m
    )
    
    set({ messages, conversations: buildConversations(messages) })
    
    await StorageService.updateMessage(messageId, { 
      confirmations, 
      status: confirmations >= 6 ? 'confirmed' : 'sent'
    })
  },

  markAsRead: async (conversationId) => {
    const { messages } = get()
    const conversationMessages = messages.filter(m => m.conversationId === conversationId)
    
    for (const msg of conversationMessages) {
    }

    const conversations = buildConversations(messages)
    set({ conversations })
  },

  deleteMessage: async (messageId) => {
    try {
      await StorageService.deleteMessage(messageId)
      
      const messages = get().messages.filter(m => m.id !== messageId)
      const conversations = buildConversations(messages)
      
      set({ messages, conversations })
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to delete message'
      set({ error: message })
      throw error
    }
  },

  setCurrentConversation: (conversationId) => {
    set({ currentConversationId: conversationId })
  },

  refreshMessages: async () => {
    await get().loadMessages()
  },

  startMessageScanning: async (startHeight?: number) => {
    set({ isScanning: true, error: null, scanProgress: null })
    try {
      const walletStore = useWalletStore.getState()
      const { currentWallet, unlockedKeys } = walletStore

      if (!currentWallet) {
        throw new AppError(ErrorCode.WALLET_NOT_FOUND, 'No wallet selected', true)
      }

      if (!unlockedKeys?.viewingKey) {
        throw new AppError(ErrorCode.WALLET_LOCKED, 'Wallet must be unlocked to scan for messages', true)
      }

      const scanStartHeight = startHeight || currentWallet.lastSyncedBlock || 0

      const { config } = await import('@/config/settings')
      const messageService = createRealMessageService(config.network)

      await messageService.scanForMessages({
        viewingKey: unlockedKeys.viewingKey,
        address: currentWallet.address,
        startHeight: scanStartHeight,
        onMessage: async (message) => {
          await StorageService.saveMessage(message)
          
          const messages = [...get().messages, message]
          const conversations = buildConversations(messages)
          
          set({ messages, conversations })
        },
        onProgress: (current, total) => {
          set({ scanProgress: { current, total } })
        }
      })

      set({ isScanning: false, scanProgress: null })
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to scan for messages'
      set({ error: message, isScanning: false, scanProgress: null })
      throw error
    }
  }
}))

interface ContactState {
  contacts: Contact[]
  isLoading: boolean
  error: string | null
  
  loadContacts: () => Promise<void>
  addContact: (contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateContact: (id: string, updates: Partial<Contact>) => Promise<void>
  deleteContact: (id: string) => Promise<void>
  findContact: (address: string) => Contact | undefined
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  isLoading: false,
  error: null,

  loadContacts: async () => {
    set({ isLoading: true, error: null })
    try {
      const contacts = await StorageService.getAllContacts()
      set({ contacts, isLoading: false })
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to load contacts'
      set({ error: message, isLoading: false })
    }
  },

  addContact: async (contactData) => {
    set({ isLoading: true, error: null })
    try {
      const contact: Contact = {
        ...contactData,
        id: generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      await StorageService.saveContact(contact)
      
      set({
        contacts: [...get().contacts, contact],
        isLoading: false
      })
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to add contact'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  updateContact: async (id, updates) => {
    set({ isLoading: true, error: null })
    try {
      await StorageService.updateContact(id, updates)
      
      const contacts = get().contacts.map(c =>
        c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
      )
      
      set({ contacts, isLoading: false })
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to update contact'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  deleteContact: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await StorageService.deleteContact(id)
      
      const contacts = get().contacts.filter(c => c.id !== id)
      set({ contacts, isLoading: false })
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to delete contact'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  findContact: (address) => {
    return get().contacts.find(c => c.address === address)
  }
}))

interface AppState {
  settings: AppSettings
  notifications: NotificationData[]
  syncStatus: SyncStatus | null
  
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  addNotification: (notification: Omit<NotificationData, 'id' | 'timestamp' | 'read'>) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
}

const defaultSettings: AppSettings = {
  theme: 'system',
  network: (process.env.NEXT_PUBLIC_ZCASH_NETWORK as any) || 'mainnet',
  autoLockMinutes: 15,
  minConfirmations: 6,
  defaultTxAmount: CONSTANTS.DEFAULT_TX_AMOUNT,
  notificationsEnabled: true,
  soundEnabled: true
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      notifications: [],
      syncStatus: null,

      updateSettings: async (updates) => {
        const newSettings = { ...get().settings, ...updates }
        await StorageService.saveSettings(newSettings)
        set({ settings: newSettings })
      },

      addNotification: (notification) => {
        const newNotification: NotificationData = {
          ...notification,
          id: generateId(),
          timestamp: Date.now(),
          read: false
        }
        
        set({
          notifications: [newNotification, ...get().notifications]
        })
      },

      markNotificationRead: (id) => {
        set({
          notifications: get().notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
          )
        })
      },

      clearNotifications: () => {
        set({ notifications: [] })
      }
    }),
    {
      name: 'zmail-settings',
      partialize: (state) => ({ settings: state.settings })
    }
  )
)

const buildConversations = (messages: Message[]): Conversation[] => {
  const conversationMap = new Map<string, Message[]>()

  messages.forEach(msg => {
    const existing = conversationMap.get(msg.conversationId) || []
    conversationMap.set(msg.conversationId, [...existing, msg])
  })

  const conversations: Conversation[] = []
  conversationMap.forEach((msgs, conversationId) => {
    const sortedMsgs = msgs.sort((a, b) => b.timestamp - a.timestamp)
    const lastMessage = sortedMsgs[0]
    const unreadCount = msgs.filter(m => !m.isOutgoing && m.status === 'confirmed').length

    conversations.push({
      id: conversationId,
      contactAddress: conversationId,
      lastMessage,
      unreadCount,
      createdAt: msgs[msgs.length - 1].timestamp * 1000,
      updatedAt: lastMessage.timestamp * 1000
    })
  })

  return conversations.sort((a, b) => b.updatedAt - a.updatedAt)
}

interface NodeConfig {
  enabled: boolean
  rpcEndpoint: string
  rpcUser: string
  rpcPassword: string
}

interface NodeConfigState {
  config: NodeConfig | null
  isTesting: boolean
  testResult: {
    success: boolean
    message: string
    details?: any
  } | null
  
  loadConfig: () => Promise<void>
  saveConfig: (config: NodeConfig) => Promise<void>
  testConnection: () => Promise<boolean>
  resetConfig: () => Promise<void>
}

export const useNodeConfigStore = create<NodeConfigState>()(
  persist(
    (set, get) => ({
      config: null,
      isTesting: false,
      testResult: null,

      loadConfig: async () => {
        try {
          const stored = await StorageService.getNodeConfig()
          if (stored) {
            set({ config: stored })
          } else {
            const { isZcashNodeEnabled, getZcashNodeConfig } = await import('@/config/settings')
            if (await isZcashNodeEnabled()) {
              const nodeConfig = await getZcashNodeConfig()
              if (nodeConfig) {
                const url = new URL(nodeConfig.endpoint)
                const auth = nodeConfig.auth ? Buffer.from(nodeConfig.auth, 'base64').toString('utf-8') : ''
                const [user, password] = auth ? auth.split(':') : ['', '']
                
                const config: NodeConfig = {
                  enabled: true,
                  rpcEndpoint: nodeConfig.endpoint,
                  rpcUser: user,
                  rpcPassword: password
                }
                
                await StorageService.saveNodeConfig(config)
                set({ config })
              }
            }
          }
        } catch (error) {
        }
      },

      saveConfig: async (config: NodeConfig) => {
        try {
          await StorageService.saveNodeConfig(config)
          set({ config })
        } catch (error) {
          throw error
        }
      },

      testConnection: async () => {
        const { config } = get()
        if (!config || !config.enabled) {
          set({
            testResult: {
              success: false,
              message: 'Node configuration is not enabled'
            }
          })
          return false
        }

        set({ isTesting: true, testResult: null })

        try {
          const axios = require('axios')
          
          const endpoint = config.rpcEndpoint.toLowerCase()
          const isLocalNode = endpoint.includes('localhost') || 
                             endpoint.includes('127.0.0.1')
          
          if (!isLocalNode) {
            set({
              isTesting: false,
              testResult: {
                success: false,
                message: 'Only local zcashd nodes are currently supported. Please use http://localhost:8232'
              }
            })
            return false
          }
          
          const headers: any = {
            'Content-Type': 'application/json'
          }
          
          if (config.rpcUser) {
            const auth = Buffer.from(`${config.rpcUser}:${config.rpcPassword || ''}`).toString('base64')
            headers['Authorization'] = `Basic ${auth}`
          }
          
          const response = await axios.post(config.rpcEndpoint, {
            jsonrpc: '2.0',
            method: 'getinfo',
            params: [],
            id: 1
          }, {
            headers,
            timeout: 10000
          })

          if (response.data.error) {
            throw new Error(response.data.error.message)
          }

          const info = response.data.result
          
          set({
            isTesting: false,
            testResult: {
              success: true,
              message: 'Connection successful!',
              details: {
                blocks: info.blocks,
                version: info.version,
                connections: info.connections,
                verificationProgress: info.verificationprogress
              }
            }
          })

          return true
        } catch (error: any) {
          set({
            isTesting: false,
            testResult: {
              success: false,
              message: error.message || 'Connection failed',
              details: error.response?.data
            }
          })
          return false
        }
      },

      resetConfig: async () => {
        await StorageService.deleteNodeConfig()
        set({ config: null, testResult: null })
      }
    }),
    {
      name: 'node-config-storage'
    }
  )
)

