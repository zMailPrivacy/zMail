#!/usr/bin/env node

const path = require('path')

const { createZcashRPCClient } = require('../lib/zcash/zcash-rpc-client')
const { isZcashNodeEnabled } = require('../config/settings')

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('🧪 Testing Zcash Node Connection')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  
  if (!isZcashNodeEnabled()) {
    console.log('❌ Zcash node not configured!')
    console.log('')
    console.log('Please run: node scripts/setup-zcash-node.js')
    console.log('Or manually configure zcashNode in config/settings.ts')
    process.exit(1)
  }
  
  try {
    const rpcClient = createZcashRPCClient('mainnet')
    
    console.log('📡 Connecting to Zcash node...')
    console.log('')
    
    const connected = await rpcClient.testConnection()
    
    if (!connected) {
      console.log('❌ Connection test failed!')
      process.exit(1)
    }
    
    console.log('')
    console.log('📊 Node Information:')
    console.log('─────────────────────────────────────────────────────────')
    
    const info = await rpcClient.getInfo()
    console.log('Version:', info.version)
    console.log('Protocol Version:', info.protocolversion)
    console.log('Wallet Version:', info.walletversion)
    console.log('Balance:', info.balance || '0.00 ZEC')
    console.log('Blocks:', info.blocks)
    console.log('Connections:', info.connections)
    console.log('')
    
    const blockchainInfo = await rpcClient.getBlockchainInfo()
    console.log('📈 Blockchain Information:')
    console.log('─────────────────────────────────────────────────────────')
    console.log('Chain:', blockchainInfo.chain)
    console.log('Blocks:', blockchainInfo.blocks)
    console.log('Headers:', blockchainInfo.headers)
    console.log('Best Block Hash:', blockchainInfo.bestblockhash)
    console.log('Difficulty:', blockchainInfo.difficulty)
    console.log('Verification Progress:', (blockchainInfo.verificationprogress * 100).toFixed(2) + '%')
    console.log('')
    
    const mempoolInfo = await rpcClient.getMempoolInfo()
    console.log('💾 Mempool Information:')
    console.log('─────────────────────────────────────────────────────────')
    console.log('Size:', mempoolInfo.size, 'transactions')
    console.log('Bytes:', (mempoolInfo.bytes / 1024).toFixed(2), 'KB')
    console.log('')
    
    const networkInfo = await rpcClient.getNetworkInfo()
    console.log('🌐 Network Information:')
    console.log('─────────────────────────────────────────────────────────')
    console.log('Version:', networkInfo.version)
    console.log('Subversion:', networkInfo.subversion)
    console.log('Protocol Version:', networkInfo.protocolversion)
    console.log('Local Services:', networkInfo.localservices)
    console.log('')
    
    console.log('═══════════════════════════════════════════════════════════')
    console.log('✅ All tests passed! Your Zcash node is ready.')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('')
    console.log('You can now broadcast real transactions from zMail!')
    console.log('')
    
  } catch (error) {
    console.error('')
    console.error('❌ Test failed:', error.message)
    console.error('')
    console.error('Please check:')
    console.error('  1. Is zcashd running?')
    console.error('  2. Are the credentials in config/settings.ts correct?')
    console.error('  3. Is RPC enabled in zcash.conf?')
    console.error('  4. Is the endpoint URL correct?')
    console.error('')
    process.exit(1)
  }
}

main().catch(console.error)

