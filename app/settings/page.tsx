"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useWalletStore, useAppStore, useNodeConfigStore } from "@/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { 
  ArrowLeft, 
  Wallet, 
  Lock, 
  Unlock, 
  Trash2, 
  Shield,
  Network,
  Bell,
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  Home,
  LogOut,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Globe,
  HardDrive
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { truncateAddress, formatZEC } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const { 
    currentWallet, 
    balance, 
    isLocked, 
    lockWallet,
    signOut,
    refreshBalance,
    initialize: initializeWallet
  } = useWalletStore()
  
  const { settings, updateSettings } = useAppStore()
  
  const {
    config: nodeConfig,
    isTesting,
    testResult,
    loadConfig: loadNodeConfig,
    saveConfig: saveNodeConfig,
    testConnection: testNodeConnection,
    resetConfig: resetNodeConfig
  } = useNodeConfigStore()
  
  const [mounted, setMounted] = useState(false)
  const [nodeForm, setNodeForm] = useState({
    enabled: false,
    rpcEndpoint: '',
    rpcUser: '',
    rpcPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showLocalDocs, setShowLocalDocs] = useState(false)
  const [showPublicDocs, setShowPublicDocs] = useState(false)

  useEffect(() => {
    setMounted(true)
    initializeWallet()
    loadNodeConfig()
  }, [initializeWallet, loadNodeConfig])

  useEffect(() => {
    if (nodeConfig) {
      setNodeForm({
        enabled: nodeConfig.enabled,
        rpcEndpoint: nodeConfig.rpcEndpoint,
        rpcUser: nodeConfig.rpcUser,
        rpcPassword: nodeConfig.rpcPassword
      })
    }
  }, [nodeConfig])

  useEffect(() => {
    if (mounted && !currentWallet) {
      router.push("/")
    }
  }, [mounted, currentWallet, router])

  useEffect(() => {
    if (mounted && currentWallet) {
      refreshBalance()
    }
  }, [mounted, currentWallet])

  const handleLockWallet = () => {
    lockWallet()
    toast({
      title: "Wallet Locked",
      description: "Your wallet has been locked for security.",
    })
  }

  const handleSignOut = () => {
    if (confirm('Are you sure you want to sign out? You will need to select a wallet again to continue.')) {
      signOut()
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully.",
      })
      router.push("/")
    }
  }

  const handleToggleNetwork = async () => {
    const newNetwork = settings.network === 'mainnet' ? 'testnet' : 'mainnet'
    await updateSettings({ network: newNetwork })
    
    toast({
      title: "Network Changed",
      description: `Switched to ${newNetwork}. Please restart the app for changes to take effect.`,
    })
  }

  const handleToggleNotifications = async () => {
    await updateSettings({ notificationsEnabled: !settings.notificationsEnabled })
    
    toast({
      title: settings.notificationsEnabled ? "Notifications Disabled" : "Notifications Enabled",
      description: settings.notificationsEnabled 
        ? "You will no longer receive notifications" 
        : "You will now receive notifications for new messages",
    })
  }

  const handleSaveNodeConfig = async () => {
    if (!nodeForm.rpcEndpoint) {
      toast({
        title: "Invalid Configuration",
        description: "Please fill in RPC Endpoint",
        variant: "destructive"
      })
      return
    }

    const endpoint = nodeForm.rpcEndpoint.toLowerCase().trim()
    const isLocalNode = endpoint.includes('localhost') || 
                       endpoint.includes('127.0.0.1')
    
    if (!isLocalNode) {
      toast({
        title: "Local Node Required",
        description: "Only local zcashd nodes are currently supported. Please use http://localhost:8232 or http://127.0.0.1:8232",
        variant: "destructive"
      })
      return
    }

    try {
      await saveNodeConfig({
        enabled: true,
        rpcEndpoint: nodeForm.rpcEndpoint,
        rpcUser: nodeForm.rpcUser,
        rpcPassword: nodeForm.rpcPassword
      })

      toast({
        title: "Configuration Saved",
        description: "Node configuration has been saved successfully.",
      })
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save configuration",
        variant: "destructive"
      })
    }
  }

  const handleTestNodeConnection = async () => {
    if (!nodeForm.rpcEndpoint) {
      toast({
        title: "Invalid Configuration",
        description: "Please fill in RPC Endpoint before testing",
        variant: "destructive"
      })
      return
    }

    const endpoint = nodeForm.rpcEndpoint.toLowerCase().trim()
    const isLocalNode = endpoint.includes('localhost') || 
                       endpoint.includes('127.0.0.1')
    
    if (!isLocalNode) {
      toast({
        title: "Local Node Required",
        description: "Only local zcashd nodes are currently supported. Please use http://localhost:8232 or http://127.0.0.1:8232",
        variant: "destructive"
      })
      return
    }

    const configToSave = {
      enabled: true,
      rpcEndpoint: nodeForm.rpcEndpoint.trim(),
      rpcUser: nodeForm.rpcUser.trim(),
      rpcPassword: nodeForm.rpcPassword.trim()
    }

    await saveNodeConfig(configToSave)
    setNodeForm({ ...nodeForm, enabled: true })

    const success = await testNodeConnection()
    
    if (success) {
      toast({
        title: "✅ Connection Successful!",
        description: "Your Zcash node is configured and broadcasting is now enabled!",
      })
    } else {
      toast({
        title: "Connection Failed",
        description: testResult?.message || "Could not connect to node. Check your credentials.",
        variant: "destructive"
      })
    }
  }

  if (!mounted || !currentWallet) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/30 via-white to-white">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-purple-50 to-white px-4 py-3">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/chat")}
              className="hover:bg-purple-100/50"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img 
              src="/logo.png" 
              alt="zMail Logo" 
              width={28} 
              height={28} 
              className="rounded"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">Settings</h1>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            title="Homepage"
            className="hover:bg-purple-100/50"
          >
            <Home className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Home</span>
          </Button>
        </div>
      </header>

      <div className="container mx-auto max-w-4xl p-4 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <CardTitle>Wallet</CardTitle>
            </div>
            <CardDescription>
              Manage your Zcash wallet and view balance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Wallet Name</Label>
              <p className="font-medium">{currentWallet.name}</p>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Address</Label>
              <p className="font-mono text-sm break-all">{currentWallet.address}</p>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Address Type</Label>
              <p className="font-medium capitalize">{currentWallet.addressType}</p>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Balance</Label>
              <p className="text-2xl font-bold">
                {balance ? `${formatZEC(balance.confirmed)} ZEC` : 'Loading...'}
              </p>
              {balance && balance.pending > BigInt(0) && (
                <p className="text-sm text-muted-foreground">
                  ({formatZEC(balance.pending)} ZEC pending)
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              {!isLocked ? (
                <Button
                  variant="outline"
                  onClick={handleLockWallet}
                  className="flex-1"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Lock Wallet
                </Button>
              ) : (
                <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span>Wallet is locked</span>
                </div>
              )}
              
              <Button
                variant="outline"
                onClick={refreshBalance}
                className="flex-1"
              >
                Refresh Balance
              </Button>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="w-full"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>
              Security and privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Lock</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically lock wallet after {settings.autoLockMinutes} minutes of inactivity
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Minimum Confirmations</Label>
                <p className="text-sm text-muted-foreground">
                  Require {settings.minConfirmations} confirmations before marking messages as confirmed
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-sm">
              <p className="font-medium mb-1">🔒 Privacy Notice</p>
              <ul className="space-y-0.5 text-muted-foreground text-xs">
                <li>• All data stored locally in your browser</li>
                <li>• Keys encrypted with your password</li>
                <li>• No data sent to external servers</li>
                <li>• Fully self-custodial</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              <CardTitle>Network</CardTitle>
            </div>
            <CardDescription>
              Configure blockchain network settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Current Network</Label>
                <p className="text-sm text-muted-foreground capitalize">
                  {settings.network}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleToggleNetwork}
              >
                Switch to {settings.network === 'mainnet' ? 'Testnet' : 'Mainnet'}
              </Button>
            </div>

            {settings.network === 'testnet' && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 text-sm">
                <p className="font-medium text-yellow-600 mb-1">⚠️ Testnet Mode</p>
                <p className="text-muted-foreground text-xs">
                  You are connected to the Zcash testnet. Transactions use test ZEC with no real value.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <CardTitle>Node Configuration</CardTitle>
            </div>
            <CardDescription>
              Configure your Zcash node for real transaction broadcasting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!nodeConfig?.enabled && (
              <>
                <div className="bg-red-500/10 border-2 border-red-500/30 rounded-md p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <XCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-red-600 mb-2 text-base">⚠️ RPC Node Configuration Required!</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        zMail requires a Zcash RPC node to send transactions. You can use a local zcashd node or a public RPC provider.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {testResult && (
              <div className={`rounded-md p-3 text-sm ${
                testResult.success 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-red-500/10 border border-red-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <p className={`font-medium ${
                    testResult.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {testResult.message}
                  </p>
                </div>
                {testResult.details && testResult.success && (
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    {testResult.details.blocks && (
                      <p>• Blockchain height: {testResult.details.blocks}</p>
                    )}
                    {testResult.details.version && (
                      <p>• Node version: {testResult.details.version}</p>
                    )}
                    {testResult.details.connections !== undefined && (
                      <p>• Connections: {testResult.details.connections}</p>
                    )}
                    {testResult.details.verificationProgress !== undefined && (
                      <p>• Sync progress: {(testResult.details.verificationProgress * 100).toFixed(2)}%</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => {
                    setNodeForm({
                      enabled: true,
                      rpcEndpoint: 'http://localhost:8232',
                      rpcUser: '',
                      rpcPassword: ''
                    })
                    toast({
                      title: "Local Node Template Loaded",
                      description: "Update with your actual zcashd RPC credentials from zcash.conf",
                    })
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <HardDrive className="h-4 w-4" />
                  Local zcashd Node
                </Button>
                <Button
                  onClick={() => {
                    setNodeForm({
                      enabled: true,
                      rpcEndpoint: '',
                      rpcUser: '',
                      rpcPassword: ''
                    })
                    toast({
                      title: "Public RPC Template",
                      description: "Enter your public RPC provider endpoint and API key",
                    })
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  Public RPC Provider
                </Button>
              </div>

              <div className="border rounded-lg divide-y">
                <button
                  onClick={() => setShowLocalDocs(!showLocalDocs)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <HardDrive className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <p className="font-semibold">Local zcashd Node Setup</p>
                      <p className="text-xs text-muted-foreground">Run your own full node for maximum privacy</p>
                    </div>
                  </div>
                  {showLocalDocs ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
                {showLocalDocs && (
                  <div className="p-4 space-y-4 bg-muted/30">
                    <div>
                      <p className="font-semibold text-sm mb-2">Step 1: Install zcashd</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Download and install zcashd from <a href="https://z.cash/downloads/" target="_blank" rel="noopener noreferrer" className="text-primary underline">https://z.cash/downloads/</a>
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-2">Step 2: Configure zcash.conf</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        <strong>File Location:</strong>
                      </p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside mb-3 space-y-1">
                        <li>Linux/Mac: <code className="bg-black/10 px-1 rounded">~/.zcash/zcash.conf</code></li>
                        <li>Windows: <code className="bg-black/10 px-1 rounded">%APPDATA%\Zcash\zcash.conf</code></li>
                      </ul>
                      <p className="text-xs text-muted-foreground mb-2">
                        <strong>Add these settings to zcash.conf:</strong>
                      </p>
                      <div className="bg-black/10 dark:bg-white/10 rounded p-3 font-mono text-xs overflow-x-auto">
                        <pre>{`server=1
rpcuser=your_username
rpcpassword=your_secure_password
rpcport=8232
rpcallowip=127.0.0.1`}</pre>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Security:</strong> Use a strong password. The <code className="bg-black/10 px-1 rounded">rpcallowip=127.0.0.1</code> restricts RPC to localhost only.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-2">Step 3: Start zcashd</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Start zcashd and wait for it to sync with the blockchain. This can take 24-48 hours for a full sync.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Check sync status: <code className="bg-black/10 px-1 rounded">zcash-cli getblockchaininfo</code>
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-2">Step 4: Configure in zMail</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li>RPC Endpoint: <code className="bg-black/10 px-1 rounded">http://localhost:8232</code></li>
                        <li>RPC Username: (from zcash.conf)</li>
                        <li>RPC Password: (from zcash.conf)</li>
                        <li>Click "Test & Save Configuration"</li>
                      </ul>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
                      <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        <strong>⚠️ Important:</strong> zcashd must be fully synced before sending transactions. Wallet operations are disabled during sync.
                      </p>
                    </div>
                  </div>
                )}

                <div className="relative opacity-50 pointer-events-none">
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <span className="bg-background/90 px-4 py-2 rounded-md border-2 border-dashed text-sm font-semibold text-muted-foreground">
                      Coming Soon
                    </span>
                  </div>
                  <button
                    className="w-full p-4 flex items-center justify-between bg-muted/30"
                    disabled
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                      <div className="text-left">
                        <p className="font-semibold text-muted-foreground">Public RPC Provider Setup</p>
                        <p className="text-xs text-muted-foreground">Use a third-party RPC service (limited functionality)</p>
                      </div>
                    </div>
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                {false && showPublicDocs && (
                  <div className="p-4 space-y-4 bg-muted/30">
                    <div>
                      <p className="font-semibold text-sm mb-2">What is a Public RPC Provider?</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Public RPC providers offer Zcash node access without running your own node. However, they have limitations:
                      </p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 mb-3">
                        <li>Most providers don't support wallet RPC methods (z_sendmany, z_importkey)</li>
                        <li>You cannot send transactions through public RPC providers</li>
                        <li>Only useful for reading blockchain data</li>
                        <li>Privacy concerns: provider can see your queries</li>
                      </ul>
                      <div className="bg-red-500/10 border border-red-500/20 rounded p-2 mb-3">
                        <p className="text-xs text-red-700 dark:text-red-400">
                          <strong>⚠️ Limitation:</strong> Public RPC providers typically cannot send shielded transactions. You need a local zcashd node or your own remote node to send messages.
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-2">Popular Providers</p>
                      <ul className="text-xs text-muted-foreground space-y-2">
                        <li>
                          <strong>GetBlock:</strong> <a href="https://getblock.io" target="_blank" rel="noopener noreferrer" className="text-primary underline">https://getblock.io</a>
                          <br />
                          <span className="text-muted-foreground">• Provides Zcash RPC endpoints</span>
                          <br />
                          <span className="text-muted-foreground">• API key in URL format</span>
                        </li>
                        <li>
                          <strong>QuickNode:</strong> <a href="https://www.quicknode.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">https://www.quicknode.com</a>
                          <br />
                          <span className="text-muted-foreground">• Enterprise-grade RPC infrastructure</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-2">Configuration Steps</p>
                      <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                        <li>Sign up with a provider and get your API key/endpoint</li>
                        <li>Enter the RPC endpoint URL provided by the service</li>
                        <li>Enter your API key as the username (or as provided by the service)</li>
                        <li>Leave password empty if not required</li>
                        <li>Click "Test & Save Configuration"</li>
                      </ol>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        <strong>💡 Recommendation:</strong> For sending messages, use a local zcashd node. Public RPC is mainly for reading blockchain data.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Node</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable Zcash node for real transaction broadcasting
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={nodeForm.enabled}
                  onChange={(e) => setNodeForm({ ...nodeForm, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rpcEndpoint">RPC Endpoint *</Label>
                <Input
                  id="rpcEndpoint"
                  type="text"
                  placeholder="http://localhost:8232"
                  value={nodeForm.rpcEndpoint}
                  onChange={(e) => setNodeForm({ ...nodeForm, rpcEndpoint: e.target.value })}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Local zcashd node: <code className="bg-black/10 px-1 rounded">http://localhost:8232</code> (default port)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rpcUser">RPC Username / API Key</Label>
                <Input
                  id="rpcUser"
                  type="text"
                  placeholder="rpcuser from zcash.conf or API key from provider"
                  value={nodeForm.rpcUser}
                  onChange={(e) => setNodeForm({ ...nodeForm, rpcUser: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  RPC username from zcash.conf (required if you set rpcuser in zcash.conf, otherwise leave empty)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rpcPassword">RPC Password</Label>
                <div className="relative">
                  <Input
                    id="rpcPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="your_password"
                    value={nodeForm.rpcPassword}
                    onChange={(e) => setNodeForm({ ...nodeForm, rpcPassword: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  RPC password from zcash.conf (required if you set rpcuser in zcash.conf, otherwise leave empty)
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleTestNodeConnection}
                  disabled={isTesting || !nodeForm.rpcEndpoint}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Test & Save Configuration
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSaveNodeConfig}
                  variant="outline"
                  disabled={!nodeForm.rpcEndpoint}
                  className="flex-1"
                >
                  Save Only
                </Button>
              </div>
              
              {nodeConfig?.enabled && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-600">✅ Node Configured & Enabled</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Your messages will now be broadcast to the Zcash blockchain!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {nodeConfig && (
                <div className="pt-2">
                  <Button
                    onClick={async () => {
                      if (confirm('Are you sure you want to reset the node configuration?')) {
                        await resetNodeConfig()
                        setNodeForm({
                          enabled: false,
                          rpcEndpoint: '',
                          rpcUser: '',
                          rpcPassword: ''
                        })
                        toast({
                          title: "Configuration Reset",
                          description: "Node configuration has been cleared.",
                        })
                      }
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Reset Configuration
                  </Button>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 text-xs">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <p className="font-medium text-blue-600">Quick Reference</p>
                </div>
                <div className="space-y-2 text-muted-foreground">
                  <div>
                    <p className="font-semibold text-xs mb-1">Local zcashd Node:</p>
                    <ul className="space-y-1 list-disc list-inside ml-2">
                      <li>Default endpoint: <code className="bg-black/10 px-1 rounded">http://localhost:8232</code></li>
                      <li>Config file: <code className="bg-black/10 px-1 rounded">~/.zcash/zcash.conf</code> (Linux/Mac) or <code className="bg-black/10 px-1 rounded">%APPDATA%\Zcash\zcash.conf</code> (Windows)</li>
                      <li>Required settings: <code className="bg-black/10 px-1 rounded">server=1</code>, <code className="bg-black/10 px-1 rounded">rpcuser</code>, <code className="bg-black/10 px-1 rounded">rpcpassword</code></li>
                      <li>Must be fully synced to send transactions</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-xs mb-1">Public RPC Provider:</p>
                    <ul className="space-y-1 list-disc list-inside ml-2">
                      <li>Use provider's endpoint URL</li>
                      <li>Enter API key as username</li>
                      <li>Most providers don't support sending transactions</li>
                      <li>Best for reading blockchain data only</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>
              Manage notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for new messages
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleToggleNotifications}
              >
                {settings.notificationsEnabled ? 'Disable' : 'Enable'}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Sound</Label>
                <p className="text-sm text-muted-foreground">
                  {settings.soundEnabled ? 'Sound enabled' : 'Sound disabled'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About zMail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Version:</strong> 0.1.0 (Beta)
            </p>
            <p>
              zMail is a privacy-first messaging application built on the Zcash blockchain.
              All messages are sent as shielded transactions, ensuring complete privacy and anonymity.
            </p>
            <div className="pt-4">
              <p className="text-muted-foreground text-xs">
                This is beta software. Use at your own risk. Always backup your wallet keys.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm('Are you sure you want to remove this wallet? Make sure you have backed up your keys!')) {
                  toast({
                    title: "Not Implemented",
                    description: "Wallet deletion is not yet implemented",
                  })
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

