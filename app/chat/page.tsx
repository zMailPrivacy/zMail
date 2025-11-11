"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useWalletStore, useMessageStore, useContactStore } from "@/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { 
  MessageSquare, 
  Send, 
  Lock, 
  Search, 
  Settings as SettingsIcon,
  Plus,
  Menu,
  X,
  Users,
  Home
} from "lucide-react"
import { formatDate, truncateAddress, formatZEC } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import type { Message } from "@/types"

export default function ChatPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const { currentWallet, isLocked, unlockWallet, initialize: initializeWallet } = useWalletStore()
  const { conversations, messages, currentConversationId, setCurrentConversation, sendMessage, loadMessages, isSending } = useMessageStore()
  const { contacts, findContact, loadContacts } = useContactStore()

  const [mounted, setMounted] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [messageInput, setMessageInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [unlockPassword, setUnlockPassword] = useState("")
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [newChatAddress, setNewChatAddress] = useState("")

  useEffect(() => {
    setMounted(true)
    initializeWallet()
  }, [initializeWallet])

  useEffect(() => {
    if (mounted && !currentWallet) {
      router.push("/")
    }
  }, [mounted, currentWallet, router])

  useEffect(() => {
    if (mounted && currentWallet) {
      loadMessages()
      loadContacts()
      
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const addressParam = params.get('address')
        if (addressParam) {
          setCurrentConversation(addressParam)
        }
      }
    }
  }, [mounted, currentWallet])

  const currentConversation = currentConversationId 
    ? conversations.find(c => c.id === currentConversationId) || {
        id: currentConversationId,
        contactAddress: currentConversationId,
        lastMessage: null,
        unreadCount: 0
      }
    : null
  
  const currentMessages = messages.filter(m => m.conversationId === currentConversationId)
    .sort((a, b) => a.timestamp - b.timestamp)

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !currentConversationId) return

    if (isLocked) {
      setShowUnlockDialog(true)
      return
    }

    try {
      await sendMessage({
        toAddress: currentConversationId,
        content: messageInput.trim()
      })

      setMessageInput("")
      
      const { isZcashNodeEnabled } = await import('@/config/settings')
      
      if (await isZcashNodeEnabled()) {
        toast({
          title: "✅ Message Broadcast",
          description: "Your message is being broadcast to the Zcash blockchain!",
        })
      } else {
        toast({
          title: "⚠️ Dev Mode - Not Broadcast",
          description: "Transaction built but NOT broadcast. Configure zcashNode in config/settings.ts to enable real broadcasting.",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Failed to Send",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive"
      })
    }
  }

  const handleUnlock = async () => {
    try {
      await unlockWallet(unlockPassword)
      setShowUnlockDialog(false)
      setUnlockPassword("")
      
      toast({
        title: "Wallet Unlocked",
        description: "You can now send messages.",
      })
    } catch (error) {
      toast({
        title: "Unlock Failed",
        description: "Invalid password",
        variant: "destructive"
      })
    }
  }

  const handleNewChat = () => {
    if (!newChatAddress.trim()) return
    
    const address = newChatAddress.trim()
    const isSapling = /^zs[0-9a-z]{76}$/i.test(address)
    const isUnified = /^u1[0-9a-z]{74,}$/i.test(address)
    
    if (!isSapling && !isUnified) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Zcash shielded address (zs1... or u1...)",
        variant: "destructive"
      })
      return
    }
    
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    setCurrentConversation(address)
    setShowNewChatDialog(false)
    setNewChatAddress("")
    
    toast({
      title: "Chat Started",
      description: `You can now send messages to ${truncateAddress(address)}`,
    })
  }

  const getContactName = (address: string) => {
    const contact = findContact(address)
    return contact?.name || truncateAddress(address)
  }

  const filteredConversations = conversations.filter(conv => {
    const contactName = getContactName(conv.contactAddress).toLowerCase()
    return contactName.includes(searchQuery.toLowerCase()) ||
           conv.contactAddress.toLowerCase().includes(searchQuery.toLowerCase())
  })

  if (!mounted || !currentWallet) {
    return null
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b bg-gradient-to-r from-purple-50 to-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="zMail Logo" 
              width={32} 
              height={32} 
              className="rounded"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">zMail</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
          
          {isLocked ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUnlockDialog(true)}
              className="bg-yellow-500/10 border-yellow-500/20 text-yellow-600 hover:bg-yellow-500/20"
            >
              <Lock className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Unlock Wallet</span>
              <span className="sm:hidden">Unlock</span>
            </Button>
          ) : (
            <div className="flex items-center gap-1 text-sm text-green-600">
              <div className="h-2 w-2 bg-green-600 rounded-full animate-pulse" />
              <span className="hidden sm:inline font-medium">Unlocked</span>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/contacts")}
            title="Contacts"
            className="hover:bg-purple-100/50"
          >
            <Users className="h-5 w-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/settings")}
            title="Settings"
            className="hover:bg-purple-100/50"
          >
            <SettingsIcon className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside
          className={`${
            sidebarOpen ? 'block' : 'hidden'
          } lg:block w-full lg:w-80 border-r bg-gradient-to-b from-purple-50/20 to-white flex flex-col`}
        >
          <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-white">
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="zMail Logo" 
                width={32} 
                height={32} 
                className="rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <h2 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">zMail</h2>
            </div>
          </div>
          
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="p-3 border-b">
            <Button
              className="w-full"
              onClick={() => setShowNewChatDialog(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-lg mb-2">No conversations yet</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Click "New Chat" above to start messaging someone on Zcash
                </p>
                <Button
                  onClick={() => setShowNewChatDialog(true)}
                  className="w-full"
                  size="lg"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Start Your First Chat
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    className={`w-full p-4 text-left hover:bg-accent transition-colors ${
                      currentConversationId === conv.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => setCurrentConversation(conv.id)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium truncate">
                        {getContactName(conv.contactAddress)}
                      </span>
                      {conv.lastMessage && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDate(conv.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    
                    {conv.lastMessage && (
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.lastMessage.isOutgoing ? 'You: ' : ''}
                        {conv.lastMessage.content}
                      </p>
                    )}
                    
                    {conv.unreadCount > 0 && (
                      <div className="mt-1">
                        <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                          {conv.unreadCount}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col bg-background">
          {currentConversation ? (
            <>
              <div className="border-b bg-card px-4 py-3">
                <h2 className="font-semibold">
                  {getContactName(currentConversation.contactAddress)}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {truncateAddress(currentConversation.contactAddress)}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {currentMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-muted-foreground">
                    <div className="max-w-md">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium mb-2">No messages yet</p>
                      <p className="text-xs mb-4">Start the conversation by sending the first message</p>
                      
                      <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                        <p className="text-xs font-medium">💡 How it works:</p>
                        <p className="text-xs">• Type your message below</p>
                        <p className="text-xs">• Click Send (requires unlocked wallet)</p>
                        <p className="text-xs">• Message is encrypted and sent as a shielded transaction</p>
                        <p className="text-xs">• Transaction fee: ~0.0001 ZEC</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  currentMessages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.isOutgoing}
                    />
                  ))
                )}
              </div>

              <div className="border-t bg-card p-4">
                {isLocked && (
                  <div className="mb-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-yellow-600" />
                      <p className="text-sm text-yellow-600 font-medium">
                        Wallet is locked - Unlock to send messages
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowUnlockDialog(true)}
                      className="bg-yellow-600 hover:bg-yellow-700"
                    >
                      <Lock className="h-3 w-3 mr-1" />
                      Unlock
                    </Button>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Input
                    placeholder={isLocked ? "Unlock wallet to send messages" : "Type a message..."}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    disabled={isSending || isLocked}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || isSending || isLocked}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground mt-2">
                  Messages are sent as Zcash shielded transactions with a small fee (~0.0001 ZEC)
                </p>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-center px-4">
              <div className="max-w-md">
                <MessageSquare className="h-20 w-20 mx-auto mb-4 text-primary opacity-50" />
                <h2 className="text-2xl font-bold mb-3">Welcome to zMail</h2>
                <p className="text-muted-foreground mb-6">
                  {conversations.length === 0 
                    ? "Start a conversation by clicking 'New Chat' or the button below"
                    : "Select a conversation from the sidebar or start a new chat"
                  }
                </p>
                <Button
                  onClick={() => setShowNewChatDialog(true)}
                  size="lg"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  New Chat
                </Button>
                
                <div className="mt-8 pt-8 border-t text-left space-y-2">
                  <h3 className="font-semibold mb-3 text-center">How zMail Works:</h3>
                  <p className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary font-bold">1.</span>
                    Messages are sent as Zcash shielded transactions
                  </p>
                  <p className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary font-bold">2.</span>
                    Each message costs ~0.0001 ZEC in transaction fees
                  </p>
                  <p className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary font-bold">3.</span>
                    Both sender and recipient addresses are fully private
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {showUnlockDialog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-yellow-600" />
              <h3 className="text-lg font-semibold">Unlock Wallet</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your password to unlock the wallet and send messages.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter wallet password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUnlock()
                    }
                  }}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  💡 This is the password you set when importing your wallet
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowUnlockDialog(false)
                    setUnlockPassword("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleUnlock}
                  disabled={!unlockPassword.trim()}
                >
                  Unlock Wallet
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {showNewChatDialog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-2">Start New Chat</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter the Zcash shielded address of the person you want to message.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="zs... or u1..."
                  value={newChatAddress}
                  onChange={(e) => setNewChatAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleNewChat()
                    }
                  }}
                />
                <div className="bg-muted rounded-md p-3 space-y-1">
                  <p className="text-xs font-medium">Supported Address Types:</p>
                  <p className="text-xs text-muted-foreground">
                    ✓ Sapling: <code className="bg-background px-1 py-0.5 rounded">zs1...</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ✓ Unified: <code className="bg-background px-1 py-0.5 rounded">u1...</code>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowNewChatDialog(false)
                    setNewChatAddress("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleNewChat}
                  disabled={!newChatAddress.trim()}
                >
                  Start Chat
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

const MessageBubble = ({ message, isOwn }: { message: Message; isOwn: boolean }) => {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-2xl px-4 py-2 ${
            isOwn
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
        
        <div className={`flex items-center gap-2 mt-1 px-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-muted-foreground">
            {formatDate(message.timestamp)}
          </span>
          
          {message.status === 'pending' && (
            <span className="text-xs text-muted-foreground">Sending...</span>
          )}
          
          {message.status === 'sent' && (
            <span className="text-xs text-muted-foreground">
              {message.confirmations} conf{message.confirmations !== 1 ? 's' : ''}
            </span>
          )}
          
          {message.status === 'confirmed' && (
            <span className="text-xs text-green-600">✓</span>
          )}
          
          {message.status === 'failed' && (
            <span className="text-xs text-destructive">Failed</span>
          )}
        </div>
      </div>
    </div>
  )
}

