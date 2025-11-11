import { AppError, ErrorCode } from '@/types'
import { ZcashRPCClient } from './zcash-rpc-client'

export interface RPCCapabilities {
  supportsWalletMethods: boolean
  supportsZSendMany: boolean
  supportsZImportKey: boolean
  supportsSendRawTransaction: boolean
  isLocalNode: boolean
  providerType: 'local' | 'public' | 'unknown'
}

export class RPCCapabilityDetector {
  private cachedCapabilities: Map<string, RPCCapabilities> = new Map()

  async detectCapabilities(rpcClient: ZcashRPCClient): Promise<RPCCapabilities> {
    const endpoint = this.getEndpoint(rpcClient)
    
    if (!endpoint || typeof endpoint !== 'string' || endpoint === 'unknown') {
      return {
        supportsWalletMethods: false,
        supportsZSendMany: false,
        supportsZImportKey: false,
        supportsSendRawTransaction: false,
        isLocalNode: false,
        providerType: 'unknown'
      }
    }
    
    if (this.cachedCapabilities.has(endpoint)) {
      return this.cachedCapabilities.get(endpoint)!
    }

    const capabilities: RPCCapabilities = {
      supportsWalletMethods: false,
      supportsZSendMany: false,
      supportsZImportKey: false,
      supportsSendRawTransaction: false,
      isLocalNode: false,
      providerType: 'unknown'
    }

    try {
      const endpointUrl = endpoint.toLowerCase()
      capabilities.isLocalNode = endpointUrl.includes('localhost') || 
                                 endpointUrl.includes('127.0.0.1') ||
                                 endpointUrl.includes('0.0.0.0')
      
      if (capabilities.isLocalNode) {
        capabilities.providerType = 'local'
      } else if (endpointUrl.includes('getblock.io') || 
                 endpointUrl.includes('quicknode') ||
                 endpointUrl.includes('infura') ||
                 endpointUrl.includes('alchemy')) {
        capabilities.providerType = 'public'
      }

      try {
        await rpcClient.rpcCall('getinfo', [])
        capabilities.supportsSendRawTransaction = true
      } catch {
        capabilities.supportsSendRawTransaction = false
      }

      if (capabilities.providerType === 'public') {
        capabilities.supportsSendRawTransaction = true
        try {
          await rpcClient.rpcCall('getblockchaininfo', [])
        } catch {
        }
      }

      if (capabilities.isLocalNode || capabilities.providerType === 'local') {
        try {
          await rpcClient.rpcCall('z_listaddresses', [])
          capabilities.supportsWalletMethods = true
          capabilities.supportsZSendMany = true
          capabilities.supportsZImportKey = true
        } catch {
          capabilities.supportsWalletMethods = false
        }
      } else {
        try {
          await rpcClient.rpcCall('z_sendmany', ['test', []])
          capabilities.supportsZSendMany = true
          capabilities.supportsWalletMethods = true
        } catch (error: any) {
          if (error.message?.includes('disallowed') || 
              error.message?.includes('not supported') ||
              error.message?.includes('method not found')) {
            capabilities.supportsZSendMany = false
            capabilities.supportsWalletMethods = false
          } else {
            capabilities.supportsZSendMany = true
            capabilities.supportsWalletMethods = true
          }
        }

        try {
          await rpcClient.rpcCall('z_importkey', ['test'])
          capabilities.supportsZImportKey = true
        } catch (error: any) {
          if (error.message?.includes('disallowed') || 
              error.message?.includes('not supported') ||
              error.message?.includes('method not found')) {
            capabilities.supportsZImportKey = false
          } else {
            capabilities.supportsZImportKey = true
          }
        }
      }

      this.cachedCapabilities.set(endpoint, capabilities)
      return capabilities
    } catch (error) {
      capabilities.supportsSendRawTransaction = true
      this.cachedCapabilities.set(endpoint, capabilities)
      return capabilities
    }
  }

  private getEndpoint(rpcClient: ZcashRPCClient): string {
    try {
      const client = (rpcClient as any).client
      if (client?.defaults?.baseURL) {
        return client.defaults.baseURL
      }
      return 'unknown'
    } catch {
      return 'unknown'
    }
  }

  clearCache(): void {
    this.cachedCapabilities.clear()
  }

  clearCacheForEndpoint(endpoint: string): void {
    this.cachedCapabilities.delete(endpoint)
  }
}

export const rpcCapabilityDetector = new RPCCapabilityDetector()

