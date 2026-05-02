const { Client, GatewayIntentBits, AuditLogEvent, Partials } = require('discord.js');
const express = require('express');  // Express kullanıyoruz

// Express uygulaması oluşturuyoruz
const app = express();

// Render portu ve basit bir 'Bot Aktif!' yanıtı
app.get('/', (req, res) => {
  res.send('Bot Aktif!');
});

// Render'da portu dinliyoruz
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`HTTP Server aktif! Port: ${port}`);
});

// Discord.js bot ayarları
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.GuildMember, Partials.User]
});

const LOG_CHANNEL_ID = "1499712129551433848";  // Log kanal ID'si
const WHITELIST_ROLES = [
  "1376625962027843695", 
  "1376625962027843696", 
  "1376625962027843697", 
  "1376625962027843698"
];

client.on("ready", () => {
  console.log(`[!] BOT GİRİŞ YAPTI: ${client.user.tag}`);
});

client.on("guildMemberUpdate", async (oldM, newM) => {
  try {
    const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id) && WHITELIST_ROLES.includes(r.id));
    const removed = oldM.roles.cache.filter(r => !newM.roles.cache.has(r.id) && WHITELIST_ROLES.includes(r.id));

    if (added.size === 0 && removed.size === 0) return;

    const logChan = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (!logChan) return console.log("Kanal bulunamadı!");

    // Audit Log çekme
    const logs = await newM.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate }).catch(() => null);
    const entry = logs ? logs.entries.first() : null;
    const exec = (entry && entry.target.id === newM.id) ? entry.executor.tag : "Bilinmiyor";

    added.forEach(r => logChan.send(`➕ **${r.name}** verildi -> \`${newM.user.tag}\` | Yapan: \`${exec}\``));
    removed.forEach(r => logChan.send(`➖ **${r.name}** alındı -> \`${newM.user.tag}\` | Yapan: \`${exec}\``));
  } catch (err) {
    console.log("Hata çıktı: " + err.message);
  }
});

// Token ile botu başlat
client.login(process.env.TOKEN).catch(e => console.log("Giriş Hatası: " + e));