"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useWalletStore } from "@/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, MessageSquare, Lock, Zap } from "lucide-react"

export default function HomePage() {
  const router = useRouter()
  const { wallets, currentWallet, isLoading, initialize } = useWalletStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    initialize()
  }, [initialize])

  const handleGetStarted = () => {
    router.push("/import")
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/30 via-white to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div 
            className="flex items-center justify-center gap-4 mb-6 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push('/')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                router.push('/')
              }
            }}
            aria-label="Go to landing page"
          >
            <img 
              src="/logo.png" 
              alt="zMail Logo" 
              width={80} 
              height={80} 
              className="rounded-lg shadow-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-purple-500 to-purple-400 bg-clip-text text-transparent">
              zMail
            </h1>
          </div>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Private messaging on the Zcash blockchain. Self-custodial, end-to-end encrypted, and truly anonymous.
          </p>
          <p className="text-sm text-muted-foreground mb-8 max-w-2xl mx-auto">
            Requires your own Zcash RPC node or public provider. Configure in Settings after importing your wallet.
          </p>
          <div className="flex gap-4 justify-center">
            {currentWallet ? (
              <Button size="lg" onClick={() => router.push("/chat")} className="px-8">
                Go to Chat
              </Button>
            ) : (
              <Button size="lg" onClick={handleGetStarted} className="px-8">
                Get Started
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Shield className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Zero-Knowledge Privacy</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Messages encrypted using Zcash shielded transactions. No one can see who you're talking to or what you're saying.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Lock className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Self-Custodial</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                You control your private keys. No servers, no middlemen, no censorship. Your data stays with you.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <MessageSquare className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Blockchain Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Messages stored in Zcash memo fields. Immutable, decentralized, and always available.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Simple & Fast</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Import your Zcash wallet and start messaging. No complex setup, no accounts, no hassle.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl font-bold mb-8">How It Works</h2>
          
          <div className="space-y-6 text-left">
            <div className="flex items-start gap-4">
              <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1">Import Your Zcash Wallet</h3>
                <p className="text-muted-foreground">
                  Use your existing Zcash viewing key and (optionally) spending key. Your keys are encrypted and stored locally.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">Send Messages</h3>
                <p className="text-muted-foreground">
                  Type a message and recipient's address. zMail creates a shielded transaction with your message in the memo field.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">Receive & Decrypt</h3>
                <p className="text-muted-foreground">
                  zMail scans the blockchain for incoming transactions, automatically decrypts messages using your viewing key.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Card className="max-w-2xl mx-auto bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy First
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>✓ No servers or databases</p>
            <p>✓ No tracking or analytics</p>
            <p>✓ No accounts or email required</p>
            <p>✓ No metadata leakage</p>
            <p>✓ Open source and auditable</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

