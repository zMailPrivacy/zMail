import { NetworkType } from '@/types'

export const config = {
  network: 'mainnet' as NetworkType,

  blockchainAPI: {
    mainnet: 'https://api.blockchair.com/zcash',
    testnet: 'https://api.blockchair.com/zcash/testnet'
  },

  zcashNode: {
    enabled: false,
    rpcEndpoint: 'http://localhost:8232',
    rpcUser: '',
    rpcPassword: ''
  },

  app: {
    name: 'zMail',
    version: '0.1.0'
  },

  security: {
    autoLockTimeout: 900000,
    minConfirmations: 6,
    confirmationCheckInterval: 75000
  },

  network_settings: {
    requestTimeout: 30000,
    blockScanBatchSize: 100,
    maxMessageLength: 400
  },

  features: {
    enableMessageScanning: true,
    enableAutoSync: true,
    autoSyncInterval: 300000
  },

  dev: {
    debugMode: false,
    logLevel: 'error' as 'error' | 'warn' | 'info' | 'debug',
    allowDevMode: true
  }
}

export const getBlockchainEndpoint = (): string => {
  return config.blockchainAPI[config.network]
}

export const isZcashNodeEnabled = async (): Promise<boolean> => {
  try {
    const { StorageService } = await import('@/lib/storage/db')
    const stored = await StorageService.getNodeConfig()
    
    if (stored && stored.rpcEndpoint && typeof stored.rpcEndpoint === 'string' && stored.rpcEndpoint.trim()) {
      const endpoint = stored.rpcEndpoint.toLowerCase()
      const isLocalNode = endpoint.includes('localhost') || 
                         endpoint.includes('127.0.0.1')
      return isLocalNode
    }
  } catch (error) {
  }
  
  if (!config.zcashNode.enabled || !config.zcashNode.rpcEndpoint) {
    return false
  }
  
  const endpoint = config.zcashNode.rpcEndpoint.toLowerCase()
  const isLocalNode = endpoint.includes('localhost') || 
                     endpoint.includes('127.0.0.1')
  
  return isLocalNode
}

export const isDevMode = async (): Promise<boolean> => {
  const enabled = await isZcashNodeEnabled()
  return !enabled && config.dev.allowDevMode
}

export const getZcashNodeConfig = async () => {
  try {
    const { StorageService } = await import('@/lib/storage/db')
    const stored = await StorageService.getNodeConfig()
    
    if (stored && stored.rpcEndpoint && typeof stored.rpcEndpoint === 'string' && stored.rpcEndpoint.trim()) {
      const endpoint = stored.rpcEndpoint.toLowerCase()
      const isLocalNode = endpoint.includes('localhost') || 
                         endpoint.includes('127.0.0.1')
      
      if (!isLocalNode) {
        return null
      }
      
      const hasCredentials = !!stored.rpcUser
      let auth = ''
      if (hasCredentials) {
        auth = Buffer.from(
          `${stored.rpcUser}:${stored.rpcPassword || ''}`
        ).toString('base64')
      }
      
      return {
        endpoint: stored.rpcEndpoint,
        auth
      }
    }
  } catch (error) {
  }
  
  const enabled = await isZcashNodeEnabled()
  if (!enabled || !config.zcashNode.rpcEndpoint) {
    return null
  }
  
  const endpoint = config.zcashNode.rpcEndpoint.toLowerCase()
  const isLocalNode = endpoint.includes('localhost') || 
                     endpoint.includes('127.0.0.1')
  
  if (!isLocalNode) {
    return null
  }
  
  const hasCredentials = !!config.zcashNode.rpcUser
  let auth = ''
  if (hasCredentials) {
    auth = Buffer.from(
      `${config.zcashNode.rpcUser}:${config.zcashNode.rpcPassword || ''}`
    ).toString('base64')
  }
  
  return {
    endpoint: config.zcashNode.rpcEndpoint,
    auth
  }
}

export default config
