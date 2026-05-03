'use strict';

const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') throw e;
}

const http = require('http');
const {
  Client,
  GatewayIntentBits,
  AuditLogEvent,
  Partials,
  Events
} = require('discord.js');

/* -------------------------------------------------------------------------- */
/*  Ayarlar — Sunucu Bilgileri                                                */
/* -------------------------------------------------------------------------- */

const LOG_CHANNEL_ID = '1499712129551433848';
const WHITELIST_ROLES = new Set(
  [
    '1376625962027843695',
    '1376625962027843696',
    '1376625962027843697',
    '1376625962027843698'
  ].map(String)
);

const seenAuditLogIds = new Map();

/* -------------------------------------------------------------------------- */
/*  Yardımcı Fonksiyonlar                                                     */
/* -------------------------------------------------------------------------- */

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function logErr(...args) {
  console.error(new Date().toISOString(), ...args);
}

function readDiscordToken() {
  const raw = process.env.TOKEN || process.env.DISCORD_TOKEN || '';
  let t = raw.replace(/^\uFEFF/, '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function roleIdsFromAuditChanges(changes, key) {
  const ch = (changes || []).find((c) => c.key === key);
  if (!ch?.new || !Array.isArray(ch.new)) return [];
  return ch.new.map((x) => (x != null && x.id != null ? String(x.id) : null)).filter(Boolean);
}

function isDuplicateAuditDelivery(id) {
  if (id == null || id === '') return false;
  const s = String(id);
  const now = Date.now();
  for (const [k, t] of seenAuditLogIds) {
    if (now - t > 120_000) seenAuditLogIds.delete(k);
  }
  if (seenAuditLogIds.has(s)) return true;
  seenAuditLogIds.set(s, now);
  return false;
}

function pickLatestAuditForUser(logs, userId, maxAgeMs) {
  const uid = String(userId);
  const now = Date.now();
  const list = [...logs.entries.values()]
    .filter(e => e.targetId != null && String(e.targetId) === uid && now - e.createdTimestamp <= maxAgeMs)
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  return list[0] ?? null;
}

function safeAuditReason(reason) {
  if (reason == null) return '';
  const s = typeof reason === 'string' ? reason : String(reason);
  const t = s.trim();
  return t.length > 900 ? `${t.slice(0, 900)}…` : t;
}

function safeTick(s) {
  return String(s ?? '').replace(/`/g, "'");
}

async function formatAuditActor(entry, client) {
  try {
    if (!entry?.executorId) return '**İşlemi yapan (audit):** Bilinmiyor';
    let ex = entry.executor;
    if (!ex?.tag && !ex?.username) {
      try { ex = await client.users.fetch(entry.executorId); } catch { ex = null; }
    }
    const mention = `<@${entry.executorId}>`;
    const tag = ex?.tag ?? ex?.globalName ?? ex?.username ?? String(entry.executorId);
    const lines = [`**İşlemi yapan (audit):** ${mention} · \`${tag}\` · **ID:** \`${entry.executorId}\``];
    const reasonText = safeAuditReason(entry.reason);
    if (reasonText) lines.push(`**Audit sebep:** ${reasonText}`);
    return lines.join('\n');
  } catch (e) {
    return `**İşlemi yapan (audit):** (hata: ${e.message})`;
  }
}

async function deliverWhitelistRoleLogFromAudit(entry, guild, client) {
  if (entry.action !== AuditLogEvent.MemberRoleUpdate) return;
  const targetId = entry.targetId ? String(entry.targetId) : null;
  if (!targetId) return;

  const addedIds = roleIdsFromAuditChanges(entry.changes, '$add').filter(id => WHITELIST_ROLES.has(id));
  const removedIds = roleIdsFromAuditChanges(entry.changes, '$remove').filter(id => WHITELIST_ROLES.has(id));

  if (addedIds.length === 0 && removedIds.length === 0) return;

  const logChan = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!logChan || !logChan.isTextBased()) return logErr('[discord] Log kanalı bulunamadı!');

  if (isDuplicateAuditDelivery(entry.id)) return;

  const member = await guild.members.fetch(targetId).catch(() => null);
  const whoLabel = member ? safeTick(member.user.tag ?? member.user.username ?? targetId) : safeTick(targetId);
  const whoBlock = await formatAuditActor(entry, client);

  for (const rid of addedIds) {
    const role = guild.roles.cache.get(rid);
    await logChan.send(`➕ **${safeTick(role?.name ?? rid)}** verildi → <@${targetId}> (\`${whoLabel}\`)\n${whoBlock}`);
  }
  for (const rid of removedIds) {
    const role = guild.roles.cache.get(rid);
    await logChan.send(`➖ **${safeTick(role?.name ?? rid)}** alındı → <@${targetId}> (\`${whoLabel}\`)\n${whoBlock}`);
  }
}

/* -------------------------------------------------------------------------- */
/*  HTTP & Discord Bot Fonksiyonları                                          */
/* -------------------------------------------------------------------------- */

function startHttp() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nova Dijital Bot Aktif');
  });
  const port = process.env.PORT || 10000;
  server.listen(port, '0.0.0.0', () => log(`[http] ${port} portunda uyanık.`));
}

function createBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildMessages
    ],
    partials: [Partials.GuildMember, Partials.User]
  });

  client.on('error', (err) => logErr('[discord] KRİTİK HATA:', err.message));
  client.on('shardError', (err) => logErr('[discord] BAĞLANTI KOPTU:', err.message));

  client.once(Events.ClientReady, (c) => {
    log(`✅ BAŞARILI: ${c.user.tag} girişi yapıldı!`);
  });

  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    try { await deliverWhitelistRoleLogFromAudit(entry, guild, client); } catch (err) { logErr('[discord] Audit Log hatası:', err.message); }
  });

  client.on('guildMemberUpdate', async (_oldM, newM) => {
    try {
      await new Promise(r => setTimeout(r, 2000));
      const logs = await newM.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberRoleUpdate }).catch(() => null);
      if (!logs) return;
      const entry = pickLatestAuditForUser(logs, newM.id, 60_000);
      if (entry) await deliverWhitelistRoleLogFromAudit(entry, newM.guild, client);
    } catch (err) { logErr('[discord] Yedek tarama hatası:', err.message); }
  });

  return client;
}

/* -------------------------------------------------------------------------- */
/*  Ana Çalıştırıcı (Giriş)                                                   */
/* -------------------------------------------------------------------------- */

async function main() {
  log('[boot] Sistem başlatılıyor...');
  
  startHttp(); // HTTP'yi başlat

  const token = readDiscordToken();
  if (!token) return logErr('!!! KRİTİK HATA: TOKEN BULUNAMADI !!!');

  log('[boot] Discord\'a bağlanılıyor...');
  const client = createBot();

  try {
    await client.login(token);
  } catch (e) {
    logErr('!!! GİRİŞ BAŞARISIZ !!!:', e.message);
    if (e.message.includes('intent')) logErr('Developer Portalda INTENT açılmamış!');
  }
}

main().catch(logErr);
