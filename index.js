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
/*  Ayarlar — sunucuna göre değiştir                                           */
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
/*  Yardımcılar                                                                */
/* -------------------------------------------------------------------------- */

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function logErr(...args) {
  console.error(new Date().toISOString(), ...args);
}

function readDiscordToken() {
  const raw =
    process.env.TOKEN ||
    process.env.DISCORD_TOKEN ||
    process.env.BOT_TOKEN ||
    '';
  let t = raw.replace(/^\uFEFF/, '').trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function roleIdsFromAuditChanges(changes, key) {
  const ch = (changes || []).find((c) => c.key === key);
  if (!ch?.new || !Array.isArray(ch.new)) return [];
  return ch.new
    .map((x) => (x != null && x.id != null ? String(x.id) : null))
    .filter(Boolean);
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
    .filter(
      (e) =>
        e.targetId != null &&
        String(e.targetId) === uid &&
        now - e.createdTimestamp <= maxAgeMs
    )
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  return list[0] ?? null;
}

function safeAuditReason(reason) {
  if (reason == null) return '';
  const s = typeof reason === 'string' ? reason : String(reason);
  const t = s.trim();
  if (t.length > 900) return `${t.slice(0, 900)}…`;
  return t;
}

function safeTick(s) {
  return String(s ?? '').replace(/`/g, "'");
}

async function formatAuditActor(entry, client) {
  try {
    if (!entry?.executorId) {
      return '**İşlemi yapan (audit):** Bilinmiyor';
    }
    let ex = entry.executor;
    if (!ex?.tag && !ex?.username) {
      try {
        ex = await client.users.fetch(entry.executorId);
      } catch {
        ex = null;
      }
    }
    const mention = `<@${entry.executorId}>`;
    const tag = ex?.tag ?? ex?.globalName ?? ex?.username ?? String(entry.executorId);
    const lines = [`**İşlemi yapan (audit):** ${mention} · \`${tag}\` · **ID:** \`${entry.executorId}\``];
    const reasonText = safeAuditReason(entry.reason);
    if (reasonText) lines.push(`**Audit sebep:** ${reasonText}`);
    return lines.join('\n');
  } catch (e) {
    return `**İşlemi yapan (audit):** (ayrıştırma hatası: ${e.message})`;
  }
}

async function deliverWhitelistRoleLogFromAudit(entry, guild, client) {
  if (entry.action !== AuditLogEvent.MemberRoleUpdate) return;
  const targetId = entry.targetId ? String(entry.targetId) : null;
  if (!targetId) return;

  const rawAdd = roleIdsFromAuditChanges(entry.changes, '$add');
  const rawRemove = roleIdsFromAuditChanges(entry.changes, '$remove');

  const addedIds = rawAdd.filter((id) => WHITELIST_ROLES.has(id));
  const removedIds = rawRemove.filter((id) => WHITELIST_ROLES.has(id));

  if (addedIds.length === 0 && removedIds.length === 0) return;

  const logChan = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!logChan || !logChan.isTextBased()) {
    logErr('[discord] log kanalı bulunamadı!');
    return;
  }

  if (isDuplicateAuditDelivery(entry.id)) return;

  const member = await guild.members.fetch(targetId).catch(() => null);
  const whoLabel = member ? safeTick(member.user.tag ?? member.user.username ?? targetId) : safeTick(targetId);
  const whoBlock = await formatAuditActor(entry, client);

  for (const rid of addedIds) {
    const role = guild.roles.cache.get(rid);
    const name = role?.name ?? rid;
    await logChan.send(`➕ **${safeTick(name)}** verildi → <@${targetId}> (\`${whoLabel}\`)\n${whoBlock}`);
  }
  for (const rid of removedIds) {
    const role = guild.roles.cache.get(rid);
    const name = role?.name ?? rid;
    await logChan.send(`➖ **${safeTick(name)}** alındı → <@${targetId}> (\`${whoLabel}\`)\n${whoBlock}`);
  }
}

/* -------------------------------------------------------------------------- */
/*  HTTP — Render Canlı Tutma                                                  */
/* -------------------------------------------------------------------------- */

function startHttp() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot Aktif ve Dinleniyor');
  });
  const port = process.env.PORT || 10000;
  server.listen(port, '0.0.0.0', () => log(`[http] ${port} portunda uyanık.`));
}

/* -------------------------------------------------------------------------- */
/*  Discord Bot — 3. Madde (Hata Yakalayıcılar) Gömüldü                      */
/* -------------------------------------------------------------------------- */

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

  // BAĞLANTI HATALARINI YAKALA (3. Madde)
  client.on('error', (err) => logErr('[discord] KRİTİK HATA:', err.message));
  client.on('shardError', (err) => logErr('[discord] BAĞLANTI KOPTU:', err.message));
  client.on('warn', (info) => log('[discord] UYARI:', info));

  client.once(Events.ClientReady, (c) => {
    log(`✅ BAŞARILI: ${c.user.tag} olarak giriş yapıldı!`);
  });

  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    try {
      await deliverWhitelistRoleLogFromAudit(entry, guild, client);
    } catch (err) {
      logErr('[discord] Audit Log İşleme Hatası:', err.message);
    }
  });

  client.on('guildMemberUpdate', async (_oldM, newM) => {
    try {
      await new Promise((r) => setTimeout(r, 2000)); // Audit logun düşmesi için bekle
      const logs = await newM.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberRoleUpdate }).catch(() => null);
      if (!logs) return;
      const entry = pickLatestAuditForUser(logs, newM.id, 60_000);
      if (entry) await deliverWhitelistRoleLogFromAudit(entry, newM.guild, client);
    } catch (err) {
      logErr('[discord] Yedek Tarama Hatası:', err.message);
    }
  });

  return client;
}

/* -------------------------------------------------------------------------- */
/*  Ana Çalıştırma                                                            */
/* -------------------------------------------------------------------------- */

async function main() {
  startHttp();
  const token = readDiscordToken();
  if (!token) return logErr('TOKEN BULUNAMADI!');

  const client = createBot();
  try {
    await client.login(token);
  } catch (e) {
    logErr('GİRİŞ BAŞARISIZ:', e.message);
    if (e.message.includes('intent')) logErr('DİKKAT: Developer Portalda INTENT açılmamış!');
  }
}

main().catch(logErr);
