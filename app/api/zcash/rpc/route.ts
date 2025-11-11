import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { getZcashNodeConfig, config } from '@/config/settings'

export async function POST(request: NextRequest) {
  try {
    let nodeConfig
    try {
      nodeConfig = await getZcashNodeConfig()
    } catch (configError: any) {
      return NextResponse.json(
        { 
          jsonrpc: '2.0',
          error: { 
            code: -1, 
            message: 'Failed to load node configuration: ' + (configError?.message || 'Unknown error')
          },
          id: null
        },
        { status: 200 }
      )
    }
    
    if (!nodeConfig || !nodeConfig.endpoint || typeof nodeConfig.endpoint !== 'string') {
      return NextResponse.json(
        { 
          jsonrpc: '2.0',
          error: { 
            code: -1, 
            message: 'Zcash node not configured. Please configure your node in Settings > Node Configuration'
          },
          id: null
        },
        { status: 200 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch (e) {
      return NextResponse.json(
        { 
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error' },
          id: null
        },
        { status: 200 }
      )
    }
    
    const { method, params = [], id } = body

    if (!method) {
      return NextResponse.json(
        { 
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid Request: method is required' },
          id: id || null
        },
        { status: 200 }
      )
    }

    const endpoint = nodeConfig.endpoint.toLowerCase()
    const isLocalNode = endpoint.includes('localhost') || 
                       endpoint.includes('127.0.0.1')
    
    if (!isLocalNode) {
      return NextResponse.json(
        { 
          jsonrpc: '2.0',
          error: { 
            code: -1, 
            message: 'Only local zcashd nodes are currently supported. Please configure a local node at http://localhost:8232'
          },
          id: null
        },
        { status: 200 }
      )
    }
    
    const headers: any = {
      'Content-Type': 'application/json'
    }

    let authConfig: { username: string; password: string } | undefined
    if (nodeConfig.auth) {
      try {
        const decoded = Buffer.from(nodeConfig.auth, 'base64').toString('utf-8')
        const [username, password] = decoded.split(':')
        authConfig = { username, password }
        headers['Authorization'] = `Basic ${nodeConfig.auth}`
      } catch (e) {
        if (config.zcashNode.rpcUser && config.zcashNode.rpcPassword) {
          authConfig = {
            username: config.zcashNode.rpcUser,
            password: config.zcashNode.rpcPassword
          }
        }
      }
    } else if (config.zcashNode.rpcUser && config.zcashNode.rpcPassword) {
      authConfig = {
        username: config.zcashNode.rpcUser,
        password: config.zcashNode.rpcPassword
      }
    }

    try {
      const response = await axios.post(
        nodeConfig.endpoint,
        {
          jsonrpc: '2.0',
          method,
          params,
          id: id || Date.now()
        },
        {
          headers,
          timeout: 60000,
          auth: authConfig,
          validateStatus: () => true
        }
      )

      if (response.data && typeof response.data === 'object') {
        return NextResponse.json(response.data, { status: 200 })
      }

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -1,
            message: 'Invalid response format from RPC endpoint'
          },
          id: id || null
        },
        { status: 200 }
      )
    } catch (requestError: any) {
      if (requestError.response) {
        const errorData = requestError.response.data
        if (errorData && typeof errorData === 'object') {
          return NextResponse.json(errorData, { status: 200 })
        }
        
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            error: {
              code: requestError.response.status || -1,
              message: typeof errorData === 'string' ? errorData : (errorData?.message || requestError.message || 'RPC request failed')
            },
            id: id || null
          },
          { status: 200 }
        )
      }

      throw requestError
    }
  } catch (error: any) {
    if (error.response) {
      const errorData = error.response.data
      if (errorData && typeof errorData === 'object') {
        return NextResponse.json(errorData, { status: 200 })
      }
      
      return NextResponse.json(
        { 
          jsonrpc: '2.0',
          error: { 
            code: error.response.status || -1, 
            message: typeof errorData === 'string' ? errorData : (errorData?.message || error.message || 'RPC call failed')
          },
          id: null
        },
        { status: 200 }
      )
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { 
          jsonrpc: '2.0',
          error: { 
            code: -1, 
            message: 'Cannot connect to RPC endpoint. Check your endpoint URL and network connection.'
          },
          id: null
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { 
        jsonrpc: '2.0',
        error: { 
          code: -1, 
          message: error.message || 'RPC call failed',
          data: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        id: null
      },
      { status: 200 }
    )
  }
}

