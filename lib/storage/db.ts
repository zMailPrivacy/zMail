import Dexie, { Table } from 'dexie'
import {
  StoredWallet,
  StoredMessage,
  StoredContact,
  StoredTransaction,
  AppSettings,
  NotificationData,
  AppError,
  ErrorCode
} from '@/types'

interface StoredNodeConfig {
  id: string
  enabled: boolean
  rpcEndpoint: string
  rpcUser: string
  rpcPassword: string
}

export class ZMailDB extends Dexie {
  wallets!: Table<StoredWallet, number>
  messages!: Table<StoredMessage, number>
  contacts!: Table<StoredContact, number>
  transactions!: Table<StoredTransaction, number>
  settings!: Table<AppSettings & { id: string }, string>
  notifications!: Table<NotificationData, number>
  nodeConfig!: Table<StoredNodeConfig, string>

  constructor() {
    super('ZMailDB')

    this.version(1).stores({
      wallets: '++_id, id, address, lastUsed',
      messages: '++_id, id, conversationId, fromAddress, toAddress, timestamp, status, txHash',
      contacts: '++_id, id, address, name, isFavorite',
      transactions: '++_id, txHash, fromAddress, toAddress, timestamp, status',
      settings: 'id',
      notifications: '++_id, id, timestamp, read, type',
      nodeConfig: 'id'
    })
  }
}

export const db = new ZMailDB()

export class StorageService {
  static async isAvailable(): Promise<boolean> {
    try {
      await db.open()
      return true
    } catch {
      return false
    }
  }

  static async saveWallet(wallet: StoredWallet): Promise<void> {
    try {
      await db.wallets.put(wallet)
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to save wallet',
        true,
        error as Error
      )
    }
  }

  static async getWallet(id: string): Promise<StoredWallet | undefined> {
    try {
      return await db.wallets.where('id').equals(id).first()
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get wallet',
        true,
        error as Error
      )
    }
  }

  static async getAllWallets(): Promise<StoredWallet[]> {
    try {
      return await db.wallets.orderBy('lastUsed').reverse().toArray()
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get wallets',
        true,
        error as Error
      )
    }
  }

  static async deleteWallet(id: string): Promise<void> {
    try {
      const wallet = await db.wallets.where('id').equals(id).first()
      if (wallet?._id) {
        await db.wallets.delete(wallet._id)
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to delete wallet',
        true,
        error as Error
      )
    }
  }

  static async updateWalletLastUsed(id: string): Promise<void> {
    try {
      const wallet = await db.wallets.where('id').equals(id).first()
      if (wallet?._id) {
        await db.wallets.update(wallet._id, { lastUsed: Date.now() })
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to update wallet',
        true,
        error as Error
      )
    }
  }

  static async saveMessage(message: StoredMessage): Promise<void> {
    try {
      await db.messages.put(message)
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to save message',
        true,
        error as Error
      )
    }
  }

  static async getMessage(id: string): Promise<StoredMessage | undefined> {
    try {
      return await db.messages.where('id').equals(id).first()
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get message',
        true,
        error as Error
      )
    }
  }

  static async getMessagesByConversation(
    conversationId: string
  ): Promise<StoredMessage[]> {
    try {
      return await db.messages
        .where('conversationId')
        .equals(conversationId)
        .sortBy('timestamp')
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get messages',
        true,
        error as Error
      )
    }
  }

  static async getAllMessages(): Promise<StoredMessage[]> {
    try {
      return await db.messages.orderBy('timestamp').reverse().toArray()
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get messages',
        true,
        error as Error
      )
    }
  }

  static async updateMessage(
    id: string,
    updates: Partial<StoredMessage>
  ): Promise<void> {
    try {
      const message = await db.messages.where('id').equals(id).first()
      if (message?._id) {
        await db.messages.update(message._id, updates)
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to update message',
        true,
        error as Error
      )
    }
  }

  static async deleteMessage(id: string): Promise<void> {
    try {
      const message = await db.messages.where('id').equals(id).first()
      if (message?._id) {
        await db.messages.delete(message._id)
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to delete message',
        true,
        error as Error
      )
    }
  }

  static async getMessageByTxHash(
    txHash: string
  ): Promise<StoredMessage | undefined> {
    try {
      return await db.messages.where('txHash').equals(txHash).first()
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get message by tx hash',
        true,
        error as Error
      )
    }
  }

  static async saveContact(contact: StoredContact): Promise<void> {
    try {
      await db.contacts.put(contact)
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to save contact',
        true,
        error as Error
      )
    }
  }

  static async getContact(id: string): Promise<StoredContact | undefined> {
    try {
      return await db.contacts.where('id').equals(id).first()
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get contact',
        true,
        error as Error
      )
    }
  }

  static async getContactByAddress(
    address: string
  ): Promise<StoredContact | undefined> {
    try {
      return await db.contacts.where('address').equals(address).first()
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get contact by address',
        true,
        error as Error
      )
    }
  }

  static async getAllContacts(): Promise<StoredContact[]> {
    try {
      return await db.contacts.orderBy('name').toArray()
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get contacts',
        true,
        error as Error
      )
    }
  }

  static async updateContact(
    id: string,
    updates: Partial<StoredContact>
  ): Promise<void> {
    try {
      const contact = await db.contacts.where('id').equals(id).first()
      if (contact?._id) {
        await db.contacts.update(contact._id, {
          ...updates,
          updatedAt: Date.now()
        })
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to update contact',
        true,
        error as Error
      )
    }
  }

  static async deleteContact(id: string): Promise<void> {
    try {
      const contact = await db.contacts.where('id').equals(id).first()
      if (contact?._id) {
        await db.contacts.delete(contact._id)
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to delete contact',
        true,
        error as Error
      )
    }
  }

  static async saveTransaction(transaction: StoredTransaction): Promise<void> {
    try {
      await db.transactions.put(transaction)
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to save transaction',
        true,
        error as Error
      )
    }
  }

  static async getTransaction(
    txHash: string
  ): Promise<StoredTransaction | undefined> {
    try {
      return await db.transactions.where('txHash').equals(txHash).first()
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get transaction',
        true,
        error as Error
      )
    }
  }

  static async getTransactionsByAddress(
    address: string
  ): Promise<StoredTransaction[]> {
    try {
      const sent = await db.transactions.where('fromAddress').equals(address).toArray()
      const received = await db.transactions.where('toAddress').equals(address).toArray()
      
      return [...sent, ...received].sort((a, b) => b.timestamp - a.timestamp)
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get transactions',
        true,
        error as Error
      )
    }
  }

  static async updateTransaction(
    txHash: string,
    updates: Partial<StoredTransaction>
  ): Promise<void> {
    try {
      const transaction = await db.transactions.where('txHash').equals(txHash).first()
      if (transaction?._id) {
        await db.transactions.update(transaction._id, updates)
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to update transaction',
        true,
        error as Error
      )
    }
  }

  static async getSettings(): Promise<AppSettings | undefined> {
    try {
      return await db.settings.get('app')
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get settings',
        true,
        error as Error
      )
    }
  }

  static async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await db.settings.put({ ...settings, id: 'app' })
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to save settings',
        true,
        error as Error
      )
    }
  }

  static async getNodeConfig(): Promise<StoredNodeConfig | undefined> {
    try {
      return await db.nodeConfig.get('node')
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get node config',
        true,
        error as Error
      )
    }
  }

  static async saveNodeConfig(config: Omit<StoredNodeConfig, 'id'>): Promise<void> {
    try {
      await db.nodeConfig.put({ ...config, id: 'node' })
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to save node config',
        true,
        error as Error
      )
    }
  }

  static async deleteNodeConfig(): Promise<void> {
    try {
      await db.nodeConfig.delete('node')
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to delete node config',
        true,
        error as Error
      )
    }
  }

  static async saveNotification(notification: NotificationData): Promise<void> {
    try {
      await db.notifications.add(notification)
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to save notification',
        true,
        error as Error
      )
    }
  }

  static async getNotifications(limit?: number): Promise<NotificationData[]> {
    try {
      const query = db.notifications.orderBy('timestamp').reverse()
      return limit ? await query.limit(limit).toArray() : await query.toArray()
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to get notifications',
        true,
        error as Error
      )
    }
  }

  static async markNotificationRead(id: string): Promise<void> {
    try {
      const notification = await db.notifications.where('id').equals(id).first()
      if (notification) {
        await db.notifications.update(notification, { read: true })
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to mark notification as read',
        true,
        error as Error
      )
    }
  }

  static async clearOldNotifications(daysOld: number = 30): Promise<void> {
    try {
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000)
      await db.notifications.where('timestamp').below(cutoffTime).delete()
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to clear old notifications',
        true,
        error as Error
      )
    }
  }

  static async clearAllData(): Promise<void> {
    try {
      await db.delete()
      await db.open()
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to clear all data',
        true,
        error as Error
      )
    }
  }

  static async exportData(): Promise<string> {
    try {
      const data = {
        wallets: await db.wallets.toArray(),
        messages: await db.messages.toArray(),
        contacts: await db.contacts.toArray(),
        transactions: await db.transactions.toArray(),
        settings: await db.settings.toArray(),
      }
      
      return JSON.stringify(data, null, 2)
    } catch (error) {
      throw new AppError(
        ErrorCode.STORAGE_ERROR,
        'Failed to export data',
        true,
        error as Error
      )
    }
  }
}

export default StorageService

