#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('⚙️  zMail - Zcash Node Configuration')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log('Choose your setup option:')
  console.log('')
  console.log('1. Local zcashd node (http://localhost:8232)')
  console.log('2. Public RPC provider (GetBlock, QuickNode, etc.)')
  console.log('3. Lightwalletd server')
  console.log('4. Manual configuration (edit config/settings.ts yourself)')
  console.log('')
  
  const choice = await question('Enter option (1-4): ')
  
  const configPath = path.join(__dirname, '../config/settings.ts')
  let configContent = fs.readFileSync(configPath, 'utf8')
  
  let endpoint = ''
  let user = ''
  let password = ''
  
  switch(choice) {
    case '1':
      console.log('')
      console.log('📡 Configuring for local zcashd node...')
      console.log('')
      console.log('Make sure zcashd is running and RPC is enabled in ~/.zcash/zcash.conf:')
      console.log('  server=1')
      console.log('  rpcuser=your_username')
      console.log('  rpcpassword=your_password')
      console.log('  rpcport=8232')
      console.log('')
      
      endpoint = await question('RPC Endpoint [http://localhost:8232]: ') || 'http://localhost:8232'
      user = await question('RPC Username: ')
      password = await question('RPC Password: ')
      break
      
    case '2':
      console.log('')
      console.log('🌐 Configuring for public RPC provider...')
      console.log('')
      console.log('Popular providers:')
      console.log('  - GetBlock: https://getblock.io')
      console.log('  - QuickNode: https://www.quicknode.com')
      console.log('  - Others: Search for "Zcash RPC provider"')
      console.log('')
      
      endpoint = await question('RPC Endpoint URL: ')
      user = await question('API Key / Username: ')
      password = await question('Password (if required, otherwise press Enter): ') || ''
      break
      
    case '3':
      console.log('')
      console.log('⚡ Configuring for lightwalletd server...')
      console.log('')
      
      endpoint = await question('Lightwalletd Endpoint (e.g., https://mainnet.lightwalletd.com:9067): ')
      user = await question('Username (if required, otherwise press Enter): ') || ''
      password = await question('Password (if required, otherwise press Enter): ') || ''
      break
      
    case '4':
      console.log('')
      console.log('📝 Manual configuration selected.')
      console.log('')
      console.log('Edit config/settings.ts and set:')
      console.log('  zcashNode: {')
      console.log('    enabled: true,')
      console.log('    rpcEndpoint: \'your_endpoint\',')
      console.log('    rpcUser: \'your_username\',')
      console.log('    rpcPassword: \'your_password\'')
      console.log('  }')
      console.log('')
      rl.close()
      return
      
    default:
      console.log('❌ Invalid option')
      rl.close()
      return
  }
  
  if (!endpoint || !user) {
    console.log('❌ Endpoint and username are required!')
    rl.close()
    return
  }
  
  const nodeConfig = `  zcashNode: {
    enabled: true,
    rpcEndpoint: '${endpoint}',
    rpcUser: '${user}',
    rpcPassword: '${password}'
  }`
  
  configContent = configContent.replace(
    /zcashNode:\s*\{[^}]*\}/s,
    nodeConfig
  )
  
  fs.writeFileSync(configPath, configContent)
  
  console.log('')
  console.log('✅ Configuration saved to config/settings.ts')
  console.log('')
  console.log('📋 Configuration:')
  console.log('   Endpoint:', endpoint)
  console.log('   Username:', user)
  console.log('   Password:', password ? '***' : '(empty)')
  console.log('')
  console.log('🧪 Testing connection...')
  console.log('')
  
  try {
    const axios = require('axios')
    const auth = Buffer.from(`${user}:${password}`).toString('base64')
    
    const response = await axios.post(endpoint, {
      jsonrpc: '2.0',
      method: 'getinfo',
      params: [],
      id: 1
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      timeout: 10000
    })
    
    if (response.data.error) {
      throw new Error(response.data.error.message)
    }
    
    const info = response.data.result
    console.log('✅ Connection successful!')
    console.log('📊 Blockchain height:', info.blocks || 'N/A')
    console.log('🔄 Sync progress:', info.verificationprogress ? (info.verificationprogress * 100).toFixed(2) + '%' : 'N/A')
    console.log('')
    console.log('🎉 Your Zcash node is configured and ready!')
    console.log('')
    console.log('Next steps:')
    console.log('  1. Restart your dev server: npm run dev')
    console.log('  2. Try sending a message')
    console.log('  3. Check console for: "✅ Transaction broadcast successfully!"')
    
  } catch (error) {
    console.log('⚠️  Connection test failed:', error.message)
    console.log('')
    console.log('The configuration was saved, but the connection test failed.')
    console.log('Please verify:')
    console.log('  - Is the endpoint URL correct?')
    console.log('  - Are the credentials correct?')
    console.log('  - Is the node/server running?')
    console.log('  - Is RPC enabled?')
    console.log('')
    console.log('You can test later with: node scripts/test-zcash-node.js')
  }
  
  rl.close()
}

main().catch(console.error)

