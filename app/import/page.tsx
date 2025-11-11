"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useWalletStore } from "@/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Eye, EyeOff, Loader2, AlertCircle, Home } from "lucide-react"
import { validateWalletImport } from "@/lib/zcash/wallet"
import { useToast } from "@/hooks/use-toast"
import CryptoService from "@/lib/crypto"

export default function ImportWalletPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { importWallet, isLoading } = useWalletStore()

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    viewingKey: "",
    spendingKey: "",
    password: "",
    confirmPassword: ""
  })

  const [showKeys, setShowKeys] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: [] as string[] })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setErrors([])

    if (field === 'password') {
      const strength = CryptoService.validateKeyStrength(value)
      setPasswordStrength(strength)
    }
  }

  const validateForm = (): boolean => {
    const validationErrors: string[] = []

    const walletValidation = validateWalletImport({
      viewingKey: formData.viewingKey,
      spendingKey: formData.spendingKey || undefined,
      address: formData.address
    })

    if (!walletValidation.valid) {
      validationErrors.push(...walletValidation.errors)
    }

    if (!formData.name.trim()) {
      validationErrors.push('Wallet name is required')
    }

    if (!formData.password) {
      validationErrors.push('Password is required')
    } else if (!passwordStrength.valid) {
      validationErrors.push('Password is too weak')
    }

    if (formData.password !== formData.confirmPassword) {
      validationErrors.push('Passwords do not match')
    }

    setErrors(validationErrors)
    return validationErrors.length === 0
  }

  const handleImport = async () => {
    if (!validateForm()) {
      return
    }

    try {
      await importWallet({
        name: formData.name,
        address: formData.address,
        viewingKey: formData.viewingKey,
        spendingKey: formData.spendingKey || undefined,
        password: formData.password
      })

      toast({
        title: "Wallet Imported",
        description: "Your wallet has been imported successfully.",
      })

      router.push("/chat")
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import wallet",
        variant: "destructive"
      })
    }
  }

  const getPasswordStrengthColor = () => {
    if (passwordStrength.score >= 4) return "text-green-600"
    if (passwordStrength.score >= 3) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/30 via-white to-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        {/* Header with Logo and Home Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="zMail Logo" 
              width={40} 
              height={40} 
              className="rounded-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">Import Wallet</h1>
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
        
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-6 w-6 text-primary" />
              <CardTitle>Import Zcash Wallet</CardTitle>
            </div>
          <CardDescription>
            Import your existing Zcash wallet to start sending and receiving encrypted messages.
            Your keys will be encrypted and stored securely on your device.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Wallet Name</Label>
            <Input
              id="name"
              placeholder="My Zcash Wallet"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Zcash Shielded Address</Label>
            <Input
              id="address"
              placeholder="zs1... or u1..."
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Your Sapling (zs) or Unified (u1) shielded address
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="viewingKey">Viewing Key (Required)</Label>
            <div className="relative">
              <Input
                id="viewingKey"
                type={showKeys ? "text" : "password"}
                placeholder="zviews... or zivk... or uview..."
                value={formData.viewingKey}
                onChange={(e) => handleInputChange('viewingKey', e.target.value)}
                disabled={isLoading}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowKeys(!showKeys)}
              >
                {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Required to view incoming transactions and decrypt messages
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="spendingKey">Spending Key (Optional)</Label>
            <Input
              id="spendingKey"
              type={showKeys ? "text" : "password"}
              placeholder="secret-extended-key-main..."
              value={formData.spendingKey}
              onChange={(e) => handleInputChange('spendingKey', e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Required to send messages. You can import view-only first and add this later.
            </p>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium mb-4">Encryption Password</p>
            
            <div className="space-y-2 mb-4">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter a strong password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  disabled={isLoading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              
              {formData.password && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          passwordStrength.score >= 4 ? 'bg-green-600' :
                          passwordStrength.score >= 3 ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs ${getPasswordStrengthColor()}`}>
                      {passwordStrength.score >= 4 ? 'Strong' :
                       passwordStrength.score >= 3 ? 'Fair' : 'Weak'}
                    </span>
                  </div>
                  
                  {passwordStrength.feedback.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {passwordStrength.feedback.map((fb, i) => (
                        <div key={i}>• {fb}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {errors.map((error, i) => (
                    <p key={i} className="text-sm text-destructive">{error}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-sm">
            <p className="font-medium mb-1">🔒 Privacy & Security</p>
            <ul className="space-y-0.5 text-muted-foreground text-xs">
              <li>• Your keys are encrypted with your password</li>
              <li>• Keys are stored locally in your browser</li>
              <li>• Never transmitted to any server</li>
              <li>• You are fully in control</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import Wallet
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

