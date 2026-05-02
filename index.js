const { Client, GatewayIntentBits, AuditLogEvent, Partials } = require('discord.js');
const http = require('http');

// --- RENDER'I KANDIRAN KISIM ---
// Render 'Port' beklediği için ona ufak bir server açıyoruz
http.createServer((req, res) => {
  res.write("Bot 7/24 Aktif!");
  res.end();
}).listen(10000); // Render genelde 10000 portunu sever
// ------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.GuildMember, Partials.User]
});

const TOKEN = "YENI_TOKENINI_YAZ"; 
const LOG_CHANNEL_ID = "1499712129551433848";

const WHITELIST_ROLES = ["1376625962027843695", "1376625962027843696", "1376625962027843697", "1376625962027843698"];

client.on("ready", async () => {
  console.log(`[!] BOT GIRIS YAPTI: ${client.user.tag}`);
  const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (channel) await channel.send("✅ **WEB SERVISI AKTIF!** Bot artık kapanmayacak.");
});

client.on("guildMemberUpdate", async (oldM, newM) => {
  const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id) && WHITELIST_ROLES.includes(r.id));
  const removed = oldM.roles.cache.filter(r => !newM.roles.cache.has(r.id) && WHITELIST_ROLES.includes(r.id));
  if (added.size === 0 && removed.size === 0) return;

  const logChan = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChan) return;

  await new Promise(r => setTimeout(r, 3000));
  try {
    const logs = await newM.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
    const entry = logs.entries.first();
    const exec = (entry && entry.target.id === newM.id) ? entry.executor.tag : "Bilinmiyor";

    added.forEach(r => logChan.send(`➕ **${r.name}** verildi → \`${newM.user.tag}\` | Yapan: \`${exec}\``));
    removed.forEach(r => logChan.send(`➖ **${r.name}** alındı → \`${newM.user.tag}\` | Yapan: \`${exec}\``));
  } catch (e) { console.log(e.message); }
});

client.login(TOKEN);

client.login(process.env.TOKEN);

const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Bot Aktif');
}).listen(process.env.PORT || 10000);
