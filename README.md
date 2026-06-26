# Discord Anti-Spam HoneyPot Bot

A simple Discord anti-spam / honeypot moderation bot built with Node.js.

Softbans users who send messages in a specified trap channel defined in .env.

---

## ⚙️ Setup

### 1. Create `.env` file

Create a `.env` file in the project root and add the following:

```env
TOKEN=your_bot_token
TRAP_CHANNEL_ID=your_channel_id
BYPASS_ROLE_ID=optional_role_id
```

### 2. Install dependencies

```bash
npm install discord.js dotenv
```

### 3. Start the project

```bash
node index.js
```
