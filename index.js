require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials } = require("discord.js");

const TOKEN = process.env.TOKEN;
const TRAP_CHANNEL_ID = process.env.TRAP_CHANNEL_ID;
const BYPASS_ROLE_ID = process.env.BYPASS_ROLE_ID || null;

if (!TOKEN) {
  console.error("Missing TOKEN");
  process.exit(1);
}

if (!TRAP_CHANNEL_ID) {
  console.error("Missing TRAP_CHANNEL_ID");
  process.exit(1);
}

const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const fresh = { kicks: 0, messageId: null, users: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function incrementKicks() {
  const data = loadData();
  data.kicks = (data.kicks || 0) + 1;
  saveData(data);
  return data.kicks;
}

function buildTrapMessage(kicks) {
  return {
    flags: 1 << 15,
    components: [
      {
        type: 17,
        components: [
          {
            type: 10,
            content:
              "## Anti-Spam System Active\n\n" +
              "This channel is monitored. Sending messages may result in automatic moderation action."
          },
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 2,
                custom_id: "anti_spam_kicks",
                label: `🛡️ Kicks: ${kicks}`,
                disabled: true
              }
            ]
          }
        ]
      }
    ]
  };
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel, Partials.Message]
});

function isExempt(member) {
  if (member.permissions.has("Administrator")) return true;
  if (BYPASS_ROLE_ID && member.roles.cache.has(BYPASS_ROLE_ID)) return true;
  return false;
}

async function ensureTrapMessage() {
  const channel = await client.channels.fetch(TRAP_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const data = loadData();

  if (data.messageId) {
    const msg = await channel.messages.fetch(data.messageId).catch(() => null);
    if (msg) {
      await msg.edit(buildTrapMessage(data.kicks));
      return;
    }
  }

  const sent = await channel.send(buildTrapMessage(data.kicks));
  data.messageId = sent.id;
  saveData(data);
}

async function refreshCounter() {
  const channel = await client.channels.fetch(TRAP_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const data = loadData();
  if (!data.messageId) return;

  const msg = await channel.messages.fetch(data.messageId).catch(() => null);
  if (!msg) return;

  await msg.edit(buildTrapMessage(data.kicks)).catch(() => {});
}

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await ensureTrapMessage();
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== TRAP_CHANNEL_ID) return;
  if (!message.member) return;

  if (isExempt(message.member)) return;

  await message.delete().catch(() => {});

  try {
    await message.guild.members.ban(message.author.id, {
      reason: "Anti-spam system trigger",
      deleteMessageSeconds: 86400
    });

    setTimeout(() => {
      message.guild.bans.remove(message.author.id).catch(() => {});
    }, 1500);
  } catch (err) {
    console.error("Softban failed:", err.message);
    return;
  }

  const newKicks = incrementKicks();
  await refreshCounter();

  console.log(`Softbanned ${message.author.tag} | Total: ${newKicks}`);
});

client.login(TOKEN);