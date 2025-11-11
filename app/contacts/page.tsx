"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useContactStore, useWalletStore } from "@/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  User,
  Star,
  MessageSquare,
  Check,
  X,
  Home
} from "lucide-react"
import { truncateAddress } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { isValidZcashAddress } from "@/lib/utils"
import type { Contact } from "@/types"

export default function ContactsPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const { currentWallet, initialize: initializeWallet } = useWalletStore()
  const { contacts, isLoading, addContact, updateContact, deleteContact, loadContacts } = useContactStore()

  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState<Contact | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    note: ""
  })
  const [formErrors, setFormErrors] = useState<string[]>([])

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
      loadContacts()
    }
  }, [mounted, currentWallet, loadContacts])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setFormErrors([])
  }

  const validateForm = (): boolean => {
    const errors: string[] = []

    if (!formData.name.trim()) {
      errors.push("Contact name is required")
    }

    if (!formData.address.trim()) {
      errors.push("Address is required")
    } else if (!isValidZcashAddress(formData.address)) {
      errors.push("Invalid Zcash shielded address")
    }

    const duplicateContact = contacts.find(c => 
      c.address === formData.address && c.id !== editingContact?.id
    )
    if (duplicateContact) {
      errors.push("A contact with this address already exists")
    }

    setFormErrors(errors)
    return errors.length === 0
  }

  const handleSaveContact = async () => {
    if (!validateForm()) return

    try {
      if (editingContact) {
        await updateContact(editingContact.id, {
          name: formData.name.trim(),
          address: formData.address.trim(),
          note: formData.note.trim() || undefined
        })
        
        toast({
          title: "Contact Updated",
          description: `${formData.name} has been updated.`
        })
      } else {
        await addContact({
          name: formData.name.trim(),
          address: formData.address.trim(),
          addressType: formData.address.startsWith('zs') ? 'sapling' : 'orchard',
          note: formData.note.trim() || undefined,
          isFavorite: false
        })
        
        toast({
          title: "Contact Added",
          description: `${formData.name} has been added to your contacts.`
        })
      }

      handleCloseDialog()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save contact",
        variant: "destructive"
      })
    }
  }

  const handleDeleteContact = async () => {
    if (!showDeleteDialog) return

    try {
      await deleteContact(showDeleteDialog.id)
      
      toast({
        title: "Contact Deleted",
        description: `${showDeleteDialog.name} has been removed.`
      })
      
      setShowDeleteDialog(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive"
      })
    }
  }

  const handleToggleFavorite = async (contact: Contact) => {
    try {
      await updateContact(contact.id, {
        isFavorite: !contact.isFavorite
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive"
      })
    }
  }

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setFormData({
      name: contact.name,
      address: contact.address,
      note: contact.note || ""
    })
    setShowAddDialog(true)
  }

  const handleCloseDialog = () => {
    setShowAddDialog(false)
    setEditingContact(null)
    setFormData({ name: "", address: "", note: "" })
    setFormErrors([])
  }

  const handleStartChat = (address: string) => {
    router.push(`/chat?address=${encodeURIComponent(address)}`)
  }

  const filteredContacts = contacts.filter(contact => {
    const query = searchQuery.toLowerCase()
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.address.toLowerCase().includes(query) ||
      contact.note?.toLowerCase().includes(query)
    )
  })

  const favoriteContacts = filteredContacts.filter(c => c.isFavorite)
  const regularContacts = filteredContacts.filter(c => !c.isFavorite)

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
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">Contacts</h1>
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
          
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </header>

      <div className="container mx-auto max-w-4xl p-4 space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{contacts.length}</div>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{favoriteContacts.length}</div>
              <p className="text-sm text-muted-foreground">Favorites</p>
            </CardContent>
          </Card>
        </div>

        {favoriteContacts.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              Favorites
            </h2>
            <div className="space-y-2">
              {favoriteContacts.map(contact => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onEdit={handleEditContact}
                  onDelete={() => setShowDeleteDialog(contact)}
                  onToggleFavorite={handleToggleFavorite}
                  onStartChat={handleStartChat}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          {favoriteContacts.length > 0 && (
            <h2 className="text-lg font-semibold mb-3">All Contacts</h2>
          )}
          
          {regularContacts.length === 0 && favoriteContacts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold mb-2">No Contacts Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery 
                    ? "No contacts match your search"
                    : "Add your first contact to start messaging"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contact
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {regularContacts.map(contact => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onEdit={handleEditContact}
                  onDelete={() => setShowDeleteDialog(contact)}
                  onToggleFavorite={handleToggleFavorite}
                  onStartChat={handleStartChat}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddDialog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{editingContact ? "Edit Contact" : "Add Contact"}</CardTitle>
              <CardDescription>
                {editingContact 
                  ? "Update contact information"
                  : "Add a new contact to your address book"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Zcash Address *</Label>
                <Input
                  id="address"
                  placeholder="zs1... or u1..."
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  disabled={!!editingContact}
                />
                {editingContact && (
                  <p className="text-xs text-muted-foreground">
                    Address cannot be changed after creation
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note (Optional)</Label>
                <Input
                  id="note"
                  placeholder="Add a note..."
                  value={formData.note}
                  onChange={(e) => handleInputChange('note', e.target.value)}
                />
              </div>

              {formErrors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <div className="space-y-1">
                    {formErrors.map((error, i) => (
                      <p key={i} className="text-sm text-destructive">{error}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCloseDialog}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveContact}
                  disabled={isLoading}
                >
                  {editingContact ? "Update" : "Add"} Contact
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showDeleteDialog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Delete Contact</CardTitle>
              <CardDescription>
                Are you sure you want to delete {showDeleteDialog.name}? This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-md p-3">
                <p className="font-medium">{showDeleteDialog.name}</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {truncateAddress(showDeleteDialog.address, 12)}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDeleteDialog(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDeleteContact}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

const ContactCard = ({
  contact,
  onEdit,
  onDelete,
  onToggleFavorite,
  onStartChat
}: {
  contact: Contact
  onEdit: (contact: Contact) => void
  onDelete: () => void
  onToggleFavorite: (contact: Contact) => void
  onStartChat: (address: string) => void
}) => {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{contact.name}</h3>
              <button
                onClick={() => onToggleFavorite(contact)}
                className="flex-shrink-0"
              >
                <Star 
                  className={`h-4 w-4 transition-colors ${
                    contact.isFavorite 
                      ? 'text-yellow-500 fill-yellow-500' 
                      : 'text-muted-foreground hover:text-yellow-500'
                  }`}
                />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground font-mono truncate mb-1">
              {truncateAddress(contact.address, 16)}
            </p>
            
            {contact.note && (
              <p className="text-sm text-muted-foreground">{contact.note}</p>
            )}
            
            <p className="text-xs text-muted-foreground mt-2">
              Added {new Date(contact.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStartChat(contact.address)}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Chat
            </Button>
            
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(contact)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

