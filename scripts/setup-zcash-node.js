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
  console.log('🚀 zMail - Zcash Node Setup')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log('This script will help you configure a Zcash node for zMail.')
  console.log('You need a running zcashd node with RPC enabled.')
  console.log('')
  
  console.log('📡 Checking for zcashd...')
  const axios = require('axios')
  
  const configPath = path.join(__dirname, '../config/settings.ts')
  let configContent = fs.readFileSync(configPath, 'utf8')
  
  console.log('')
  console.log('Please provide your Zcash node configuration:')
  console.log('')
  
  const enabled = await question('Enable Zcash node? (y/n): ')
  if (enabled.toLowerCase() !== 'y') {
    console.log('❌ Node not enabled. Exiting.')
    rl.close()
    return
  }
  
  const endpoint = await question('RPC Endpoint (e.g., http://localhost:8232): ')
  const rpcUser = await question('RPC Username: ')
  const rpcPassword = await question('RPC Password: ')
  
  console.log('')
  console.log('🔍 Testing connection...')
  
  try {
    const auth = Buffer.from(`${rpcUser}:${rpcPassword}`).toString('base64')
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
      timeout: 5000
    })
    
    if (response.data.error) {
      throw new Error(response.data.error.message)
    }
    
    const info = response.data.result
    console.log('✅ Connection successful!')
    console.log('📊 Blockchain height:', info.blocks)
    console.log('🔄 Sync progress:', (info.verificationprogress * 100).toFixed(2) + '%')
    console.log('')
    
    configContent = configContent.replace(
      /zcashNode:\s*\{[^}]*\}/s,
      `zcashNode: {
    enabled: true,
    rpcEndpoint: '${endpoint}',
    rpcUser: '${rpcUser}',
    rpcPassword: '${rpcPassword}'
  }`
    )
    
    fs.writeFileSync(configPath, configContent)
    console.log('✅ Configuration saved to config/settings.ts')
    console.log('')
    console.log('🎉 Setup complete! You can now broadcast real transactions.')
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
    console.log('')
    console.log('Please check:')
    console.log('  1. Is zcashd running?')
    console.log('  2. Is RPC enabled in ~/.zcash/zcash.conf?')
    console.log('  3. Are the credentials correct?')
    console.log('  4. Is the endpoint URL correct?')
    console.log('')
    console.log('Configuration NOT saved. Please fix the issues and try again.')
  }
  
  rl.close()
}

main().catch(console.error)

