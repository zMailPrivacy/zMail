# zMail — Private Messaging on Zcash

### _Zero-knowledge messaging through shielded transactions._

zMail is a **self-custodial, privacy-first messaging application** built on the Zcash shielded blockchain. Send and receive encrypted messages through Zcash shielded transactions with complete zero-knowledge privacy — no servers, no metadata, no tracking.

**⚠️ Configuration Template**: zMail requires users to provide their own Zcash RPC node (local zcashd or public provider) to send transactions. This is a configuration template — users must set up their own node or find an available RPC provider.

---

## Core Architecture

zMail is built using **Next.js** for both frontend and backend logic, with **direct integration** to a user-configured Zcash RPC node (local zcashd or public provider) for transaction building and broadcasting.

**Stack Overview:**

* **Frontend:** Next.js + TypeScript + TailwindCSS
* **Backend:** Next.js API Routes (serverless proxy)
* **Storage:** IndexedDB (local encrypted storage)
* **State Management:** Zustand
* **Zcash Integration:** zcashd RPC (`z_sendmany`, `z_listreceivedbyaddress`)
* **Encryption:** NaCl (XSalsa20-Poly1305) for message encryption

### System Flow

```
User (Browser)
    ↓
zMail UI (Next.js)
    ↓
API Proxy (/api/zcash/rpc)
    ↓
User's Zcash RPC Node (configured endpoint)
    ↓
Zcash Blockchain
```

---

## Features

### 🔒 Privacy & Security

* **Zero-Knowledge Privacy**: Messages sent via Zcash shielded transactions hide sender, receiver, and transaction amounts
* **Groth16 Proofs**: Zcash's zero-knowledge proofs ensure complete privacy without revealing transaction details
* **No Metadata Leakage**: Unlike traditional messaging apps, zMail doesn't expose who you're talking to or when
* **Self-Custodial**: Your keys, your control — private keys encrypted and stored locally
* **No Servers**: zMail runs entirely client-side — no backend servers, no data collection
* **No Accounts**: No email, phone number, or registration required
* **End-to-End Encryption**: Messages encrypted with NaCl before being sent

### 💬 Messaging

* **Private Messaging**: Send encrypted messages via Zcash memo fields (up to 512 bytes)
* **Real-time Updates**: Automatic blockchain scanning for new messages
* **Contact Management**: Save and manage contacts by Zcash addresses
* **Transaction History**: View all sent and received messages with transaction details
* **Message Status**: Track message confirmations and delivery status
* **Conversation Threads**: Organized chat interface with conversation history

### 🔑 Wallet Management

* **Wallet Import**: Import existing Zcash wallets (Sapling or Unified)
* **Multiple Wallets**: Manage multiple wallets in one interface
* **Secure Storage**: Local encrypted storage using IndexedDB
* **Auto-Lock**: Wallet automatically locks after inactivity for security
* **Key Encryption**: Wallet keys encrypted at rest using PBKDF2
* **Sign Out**: Complete wallet session clearing for security

### 🎨 User Experience

* **Modern UI**: Clean, intuitive interface built with Next.js and TailwindCSS
* **Responsive Design**: Works on desktop and mobile browsers
* **Dark Mode**: Built-in dark theme support
* **Real-time Status**: Live updates on transaction confirmations
* **QR Code Support**: Easy address sharing (coming soon)
* **Transaction Explorer**: Direct links to Zcash block explorers

---

## Installation & Setup

### Prerequisites

* **Node.js** 20+ LTS ([Download](https://nodejs.org/))
* **Zcash RPC Node** — You must provide your own:
  * Local zcashd node with RPC enabled ([Download](https://z.cash/download/)), OR
  * Public RPC provider (if available)
* **Modern Browser** (Chrome 120+, Firefox 120+, Safari 17+)

### Step 1: Set Up Your Zcash RPC Node

**Option A: Local zcashd Node (Recommended)**

1. Download zcashd from [z.cash/downloads](https://z.cash/download/)
2. Install and start zcashd
3. Wait for zcashd to sync with the Zcash network (this can take several hours on first run)

**Option B: Public RPC Provider**

1. Find a Zcash RPC provider (e.g., GetBlock, QuickNode)
2. Sign up and obtain your API key/endpoint
3. Note: Most public providers have limited functionality and may not support sending transactions

### Step 2: Configure Your Node RPC (For Local zcashd Only)

If using a local zcashd node, edit your `zcash.conf` file (location depends on OS):
* **Windows**: `%APPDATA%\Zcash\zcash.conf`
* **macOS/Linux**: `~/.zcash/zcash.conf`

Add the following configuration:

```ini
server=1
rpcuser=your_username
rpcpassword=your_secure_password
rpcport=8232
rpcallowip=127.0.0.1
```

**Security Note**: Use a strong password for `rpcpassword`. This password will be used to authenticate with zcashd.

### Step 3: Install zMail

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/zmail.git
   cd zmail
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start zMail**
   ```bash
   # Windows
   .\start-all.bat
   
   # macOS/Linux
   npm run dev
   ```

4. **Open in browser**
   * Navigate to `http://localhost:3000`

### Step 4: Configure Your RPC Node Connection

1. In zMail, go to **Settings** (gear icon)
2. Under **Node Configuration**:
   * Enable the node toggle
   * Enter RPC Endpoint: Your node's endpoint (e.g., `http://localhost:8232` for local zcashd, or your provider's URL)
   * Enter RPC Username/API Key: (from your zcash.conf or provider)
   * Enter RPC Password: (from your zcash.conf, or leave empty if not required)
3. Click **Test & Save Configuration**
4. Wait for confirmation that the connection is successful

### Step 5: Import Your Wallet

1. Click **Get Started** on the homepage
2. Enter your wallet details:
   * **Wallet Name**: A friendly name for your wallet
   * **Zcash Shielded Address**: Your `zs1...` or `u1...` address
   * **Viewing Key**: Your viewing key (required for receiving messages)
   * **Spending Key**: Your spending key (required for sending messages)
   * **Password**: A strong password to encrypt your keys locally
3. Click **Import Wallet**

**Important**: 
* Your keys are encrypted and stored locally on your device
* Never share your spending key with anyone
* Make sure to back up your keys securely

---

## How It Works

### Message Sending Flow

1. **Compose Message**: Type your message in the chat interface
2. **Encryption**: Message is encrypted with recipient's public key using NaCl
3. **Memo Encoding**: Encrypted message is encoded into Zcash memo field (512 bytes max)
4. **Transaction Building**: zcashd's `z_sendmany` creates a shielded transaction
5. **Broadcasting**: Transaction is sent to the Zcash network via zcashd RPC
6. **Confirmation**: Wait for transaction confirmation (typically 1-2 minutes)

### Message Receiving Flow

1. **Blockchain Scanning**: zMail automatically scans the blockchain for incoming transactions
2. **Trial Decryption**: Uses your viewing key to decrypt memo fields
3. **Message Display**: Decrypted messages appear in your conversations
4. **Real-time Updates**: New messages appear automatically as they're confirmed

### Transaction Costs

* Each message requires a small Zcash transaction
* Default transaction fee: ~0.0001 ZEC
* Minimum transaction amount: 0.0001 ZEC (can be customized)
* Total cost per message: ~0.0002 ZEC (fee + amount)

---

## Privacy & Security Principles

* **Shielded by Default**: All messages sent through Zcash shielded transactions
* **Zero-Knowledge Proofs**: Zcash's Groth16 proofs ensure complete privacy
* **No Centralized Servers**: All communication happens directly on the Zcash blockchain
* **No Metadata Collection**: We can't see who you message or when
* **No Data Storage**: Messages stored on blockchain, not on our servers
* **No Backdoors**: Open source code, auditable by anyone
* **No Censorship**: Messages are immutable blockchain transactions
* **Local Key Storage**: All keys encrypted and stored locally on your device

---

## Technical Features

* **Private by Default**: Zcash handles sender privacy, no external tracking
* **Self-Custodial**: Complete control over your keys and data
* **No Backend Required**: Runs entirely client-side with local zcashd node
* **Developer-Friendly**: Simple architecture, easy to audit and extend
* **Transparent Traceability**: Transaction hashes visible via block explorers — without exposing identities
* **Open Source**: Full source code available for security audits

---

## Development

### Running in Development Mode

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Project Structure

```
zmail/
├── app/                    # Next.js app directory
│   ├── chat/               # Chat/messaging interface
│   ├── contacts/           # Contact management
│   ├── settings/            # Application settings
│   └── import/              # Wallet import page
├── components/             # React components
├── lib/                    # Core libraries
│   ├── zcash/             # Zcash integration
│   ├── crypto/             # Encryption utilities
│   └── storage/            # Local storage
├── config/                 # Configuration files
├── public/                 # Static assets
└── store/                  # Zustand state management
```

---

## Troubleshooting

### zcashd RPC Not Responding

**Symptoms**: "Cannot connect to zcashd RPC endpoint"

**Solutions**:
1. Verify zcashd is running: `zcash-cli getinfo`
2. Check RPC is enabled in `zcash.conf`
3. Verify port 8232 is not blocked by firewall
4. Ensure zcashd is fully synced (check block height)
5. Test RPC connection: `zcash-cli -rpcuser=youruser -rpcpassword=yourpass getinfo`

### Transaction Fails

**Symptoms**: "Transaction failed" or "Insufficient funds"

**Solutions**:
1. Verify zcashd is fully synced
2. Check you have sufficient balance (need amount + fee)
3. Ensure spending key is imported to zcashd wallet
4. Check zcashd logs for detailed error messages
5. Verify the recipient address is valid

### Messages Not Appearing

**Symptoms**: Sent messages not showing up, or not receiving messages

**Solutions**:
1. Wait for blockchain sync to complete
2. Verify zcashd is scanning the correct address
3. Check viewing key is correct
4. Ensure transaction has enough confirmations
5. Try manually refreshing the conversation

### Wallet Import Fails

**Symptoms**: "Invalid wallet" or "Import failed"

**Solutions**:
1. Verify address format (must be `zs1...` or `u1...`)
2. Check viewing key and spending key are correct
3. Ensure keys match the address
4. Try importing with just viewing key first (for receiving only)

---

## Future Plans & Roadmap

### Short-Term Enhancements

* **QR Code Support**: Generate and scan QR codes for addresses
* **Message Attachments**: Support for file sharing (with size limits)
* **Group Messaging**: Multi-recipient messages
* **Message Search**: Search through conversation history
* **Export Conversations**: Download conversation history

### Medium-Term

* **Mobile App**: Native iOS and Android applications
* **Desktop App**: Electron-based desktop application
* **Message Encryption Options**: Multiple encryption schemes
* **Contact Verification**: Verify contact identities
* **Message Reactions**: Emoji reactions to messages

### Long-Term Vision

* **Lightwalletd Support**: Optional lightwalletd integration for users without full nodes
* **Multi-Chain Support**: Extend to other privacy-focused blockchains
* **Decentralized Identity**: Integration with decentralized identity systems
* **Message Routing**: Advanced routing for better privacy
* **SDK Development**: Developer SDK for building on zMail

---

## Current Status

**MVP Complete**  
zMail is fully functional and ready for use. All core features are implemented and tested.

Stay updated: [GitHub Repository](https://github.com/zMailPrivacy/zmail)

---

## Security Considerations

### Best Practices

1. **Strong Passwords**: Use a strong, unique password for wallet encryption
2. **Key Backup**: Securely back up your viewing and spending keys
3. **Local Storage**: Keys are stored locally — protect your device
4. **Network Security**: Only use zcashd RPC on trusted networks
5. **Regular Updates**: Keep zcashd and zMail updated

### Limitations

* **zcashd Required**: Users must run their own zcashd node
* **Sync Time**: First-time sync can take several hours
* **Transaction Fees**: Each message requires a small ZEC transaction
* **Message Size**: Limited to 512 bytes per transaction

---

## License

MIT License

---

## Support

For issues, questions, or contributions:
* **GitHub Issues**: [Report a bug or request a feature](https://github.com/zMailPrivacy/zmail/issues)
* **Documentation**: Check this README and code comments

---

## Acknowledgments

* Built on the [Zcash](https://z.cash/) blockchain
* Uses [Next.js](https://nextjs.org/) for the web framework
* Inspired by privacy-first messaging principles

---

> "Private messaging meets zero-knowledge privacy."  
> — _zMail Team_

**⚠️ Disclaimer**: zMail is provided as-is. Users are responsible for securing their keys and understanding the risks of blockchain transactions. Always verify transactions and addresses before sending.
