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

/* -------------------------------------------------------------------------- */
/*  Yardımcılar                                                                */
/* -------------------------------------------------------------------------- */

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function logErr(...args) {
  console.error(new Date().toISOString(), ...args);
}

/** Render / .env: tırnak veya BOM ile yapıştırılan token'ları temizle */
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

/** Audit kaydındaki $add / $remove rol id listesi (gateway + REST aynı yapı) */
function roleIdsFromAuditChanges(changes, key) {
  const ch = (changes || []).find((c) => c.key === key);
  if (!ch?.new || !Array.isArray(ch.new)) return [];
  return ch.new
    .map((x) => (x != null && x.id != null ? String(x.id) : null))
    .filter(Boolean);
}

function safeAuditReason(reason) {
  if (reason == null) return '';
  const s = typeof reason === 'string' ? reason : String(reason);
  const t = s.trim();
  if (t.length > 900) return `${t.slice(0, 900)}…`;
  return t;
}

/** Kod aralığı içinde kırılmayı önle */
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

    const lines = [
      `**İşlemi yapan (audit):** ${mention} · \`${tag}\` · **ID:** \`${entry.executorId}\``
    ];

    const reasonText = safeAuditReason(entry.reason);
    if (reasonText) {
      lines.push(`**Audit sebep:** ${reasonText}`);
    }

    const integ = entry.extra && typeof entry.extra === 'object' && entry.extra.integrationType;
    if (integ) {
      lines.push(`**Kaynak:** \`${String(integ)}\``);
    }

    if (ex?.bot) {
      lines.push(
        '*Not: İşlemi bu bot yaptı; komutu veren kişi çoğu zaman audit’ta görünmez. Bazı botlar sebep satırına moderatör yazar.*'
      );
    }

    return lines.join('\n');
  } catch (e) {
    return `**İşlemi yapan (audit):** (ayrıştırma hatası: ${e.message})`;
  }
}

const LANDING_HTML = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nova Dijital — Strateji &amp; Üretim</title>
  <meta name="description" content="Markanız için dijital strateji, içerik ve deneyim tasarımı.">
  <style>
    :root { --bg:#0c0f14; --surface:#141a24; --text:#e8edf5; --muted:#8b98a8; --accent:#5b8cff; }
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh}
    header{display:flex;align-items:center;justify-content:space-between;padding:1.25rem 6vw;border-bottom:1px solid rgba(255,255,255,.06)}
    .logo{font-weight:700;font-size:1.1rem}.logo span{color:var(--accent)}
    nav a{color:var(--muted);text-decoration:none;margin-left:1.75rem;font-size:.9rem}
    nav a:hover{color:var(--text)}
    main{padding:4rem 6vw 5rem;max-width:960px;margin:0 auto}
    .hero h1{font-size:clamp(2rem,5vw,3rem);font-weight:700;line-height:1.15;margin-bottom:1rem}
    .hero p{color:var(--muted);font-size:1.1rem;max-width:32rem;margin-bottom:2rem}
    .cta{display:inline-flex;background:var(--accent);color:#fff;padding:.85rem 1.5rem;border-radius:10px;text-decoration:none;font-weight:600}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.25rem;margin-top:4rem}
    .card{background:var(--surface);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:1.5rem}
    .card h3{font-size:1rem;margin-bottom:.5rem}.card p{color:var(--muted);font-size:.9rem}
    footer{padding:2rem 6vw;border-top:1px solid rgba(255,255,255,.06);color:var(--muted);font-size:.85rem;text-align:center}
  </style>
</head>
<body>
  <header><div class="logo">Nova<span>Dijital</span></div>
    <nav><a href="#hizmetler">Hizmetler</a><a href="#iletisim">İletişim</a></nav></header>
  <main>
    <section class="hero">
      <h1>Markanız için net strateji, ölçülebilir sonuç.</h1>
      <p>Dijital görünürlük, içerik ve kullanıcı deneyimini bir arada planlıyoruz.</p>
      <a class="cta" href="#iletisim">Proje konuşalım →</a>
    </section>
    <section id="hizmetler" class="grid">
      <div class="card"><h3>Strateji &amp; marka</h3><p>Konumlandırma ve dijital varlık haritası.</p></div>
      <div class="card"><h3>İçerik &amp; üretim</h3><p>Metin, görsel ve kampanya akışları.</p></div>
      <div class="card"><h3>Deneyim tasarımı</h3><p>Sade ve hızlı arayüzler.</p></div>
    </section>
    <section id="iletisim" style="margin-top:3rem;color:var(--muted)">
      <p><strong style="color:var(--text)">İletişim:</strong> hello@novadijital.example — İstanbul</p>
    </section>
  </main>
  <footer>© 2026 Nova Dijital.</footer>
</body>
</html>`;

/* -------------------------------------------------------------------------- */
/*  HTTP — Render Web Service (0.0.0.0 + PORT şart)                           */
/* -------------------------------------------------------------------------- */

function startHttp() {
  const server = http.createServer((req, res) => {
    const path = (req.url && req.url.split('?')[0]) || '/';
    if (path === '/' || path === '/health') {
      if (path === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('ok');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(LANDING_HTML);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const port = Number(process.env.PORT);
  const listenPort = Number.isFinite(port) && port > 0 ? port : 10000;

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(listenPort, '0.0.0.0', () => {
      server.off('error', reject);
      log('[http] dinleniyor', `0.0.0.0:${listenPort}`);
      resolve(server);
    });
  });
}

/* -------------------------------------------------------------------------- */
/*  Discord                                                                    */
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

  const onReady = (c) => {
    log('[discord] hazır:', c.user.tag, `(${c.guilds.cache.size} sunucu)`);
  };
  client.once(Events.ClientReady, onReady);

  client.on('shardError', (err, id) => {
    logErr('[discord] shardError', id, err?.message || err);
  });
  client.on('error', (err) => {
    logErr('[discord] client error:', err?.message || err);
  });

  /**
   * Rol logları buradan: guildMemberUpdate önbellek yüzünden sık boş kalıyordu.
   * GUILD_AUDIT_LOG_ENTRY_CREATE + GuildModeration intent gerekir (Portal’da açık olsun).
   */
  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    try {
      if (entry.action !== AuditLogEvent.MemberRoleUpdate) return;

      const targetId = entry.targetId ? String(entry.targetId) : null;
      if (!targetId) return;

      const addedIds = roleIdsFromAuditChanges(entry.changes, '$add').filter((id) =>
        WHITELIST_ROLES.has(id)
      );
      const removedIds = roleIdsFromAuditChanges(entry.changes, '$remove').filter((id) =>
        WHITELIST_ROLES.has(id)
      );

      if (addedIds.length === 0 && removedIds.length === 0) return;

      const logChan = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (!logChan || !logChan.isTextBased()) {
        logErr('[discord] log kanalı yok veya metin kanalı değil:', LOG_CHANNEL_ID);
        return;
      }

      const member = await guild.members.fetch(targetId).catch(() => null);
      const whoLabel = member
        ? safeTick(member.user.tag ?? member.user.username ?? targetId)
        : safeTick(targetId);

      let whoBlock = '**İşlemi yapan (audit):** Bilinmiyor';
      try {
        whoBlock = await formatAuditActor(entry, client);
      } catch (e) {
        logErr('[discord] formatAuditActor:', e?.message || e);
      }

      for (const rid of addedIds) {
        const role = guild.roles.cache.get(rid);
        const name = role?.name ?? rid;
        await logChan.send(
          `➕ **${safeTick(name)}** verildi → Üye: <@${targetId}> (\`${whoLabel}\`) · **ID:** \`${targetId}\`\n${whoBlock}`
        );
      }
      for (const rid of removedIds) {
        const role = guild.roles.cache.get(rid);
        const name = role?.name ?? rid;
        await logChan.send(
          `➖ **${safeTick(name)}** alındı → Üye: <@${targetId}> (\`${whoLabel}\`) · **ID:** \`${targetId}\`\n${whoBlock}`
        );
      }
    } catch (err) {
      logErr('[discord] GuildAuditLogEntryCreate:', err?.message || err);
      if (err?.stack) logErr(err.stack);
    }
  });

  return client;
}

/* -------------------------------------------------------------------------- */
/*  Giriş                                                                      */
/* -------------------------------------------------------------------------- */

process.on('unhandledRejection', (reason) => {
  logErr('[process] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  logErr('[process] uncaughtException:', err);
  process.exit(1);
});

async function main() {
  log('[boot] başlıyor', `node ${process.version}`, `cwd=${process.cwd()}`, `dir=${__dirname}`);

  await startHttp();

  const token = readDiscordToken();
  if (!token) {
    logErr(
      '[boot] TOKEN boş. Yerel: index.js ile aynı klasörde .env içinde TOKEN=... | Render: Environment\'da TOKEN ekle, sonra redeploy.'
    );
    return;
  }

  if (token.length < 50 || token.length > 90) {
    logErr(
      '[boot] TOKEN uzunluğu şüpheli (' +
        token.length +
        '). Bot token mi yapıştırdın? (Client Secret değil.)'
    );
  }

  log('[boot] TOKEN var, uzunluk:', token.length, '→ Discord login…');
  const client = createBot();

  try {
    await client.login(token);
    log('[boot] login() promise tamam; gateway bağlantısı için [discord] hazır satırını bekle.');
  } catch (e) {
    const code = e?.code;
    logErr('[boot] login başarısız:', e?.message || e, code != null ? `code=${code}` : '');
    if (String(e?.message).includes('intent') || code === 'DisallowedIntents') {
      logErr(
        '[boot] Developer Portal → Bot → Privileged Gateway Intents: SERVER MEMBERS INTENT aç.'
      );
    }
    if (String(e?.message).toLowerCase().includes('invalid') || code === 'TokenInvalid') {
      logErr('[boot] Token geçersiz / sıfırlanmış. Yeni token al, Render .env ile aynı değeri kullan.');
    }
  }
}

main().catch((e) => {
  logErr('[boot] main:', e);
  process.exit(1);
});
