const { Client, GatewayIntentBits, AuditLogEvent, Partials } = require('discord.js');
const express = require('express');  // Express kullanıyoruz

// Express uygulaması oluşturuyoruz
const app = express();

const LANDING_HTML = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nova Dijital — Strateji &amp; Üretim</title>
  <meta name="description" content="Markanız için dijital strateji, içerik ve deneyim tasarımı.">
  <style>
    :root {
      --bg: #0c0f14;
      --surface: #141a24;
      --text: #e8edf5;
      --muted: #8b98a8;
      --accent: #5b8cff;
      --accent-soft: rgba(91, 140, 255, 0.15);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 6vw;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .logo { font-weight: 700; letter-spacing: -0.02em; font-size: 1.1rem; }
    .logo span { color: var(--accent); }
    nav a {
      color: var(--muted);
      text-decoration: none;
      margin-left: 1.75rem;
      font-size: 0.9rem;
    }
    nav a:hover { color: var(--text); }
    main { padding: 4rem 6vw 5rem; max-width: 960px; margin: 0 auto; }
    .hero h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.15;
      margin-bottom: 1rem;
    }
    .hero p {
      color: var(--muted);
      font-size: 1.1rem;
      max-width: 32rem;
      margin-bottom: 2rem;
    }
    .cta {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--accent);
      color: #fff;
      padding: 0.85rem 1.5rem;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
    }
    .cta:hover { filter: brightness(1.08); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-top: 4rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 1.5rem;
    }
    .card h3 { font-size: 1rem; margin-bottom: 0.5rem; }
    .card p { color: var(--muted); font-size: 0.9rem; }
    footer {
      padding: 2rem 6vw;
      border-top: 1px solid rgba(255,255,255,0.06);
      color: var(--muted);
      font-size: 0.85rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">Nova<span>Dijital</span></div>
    <nav>
      <a href="#hizmetler">Hizmetler</a>
      <a href="#iletisim">İletişim</a>
    </nav>
  </header>
  <main>
    <section class="hero">
      <h1>Markanız için net strateji, ölçülebilir sonuç.</h1>
      <p>Dijital görünürlük, içerik üretimi ve kullanıcı deneyimini bir arada düşünüyor; projelerinizi uçtan uca planlıyoruz.</p>
      <a class="cta" href="#iletisim">Proje konuşalım →</a>
    </section>
    <section id="hizmetler" class="grid">
      <div class="card">
        <h3>Strateji &amp; marka</h3>
        <p>Konumlandırma, mesaj ve dijital varlık haritası; her kanalda tutarlı bir ses.</p>
      </div>
      <div class="card">
        <h3>İçerik &amp; üretim</h3>
        <p>Metin, görsel ve kampanya akışları; yayın takvimi ve kalite kontrolü birlikte.</p>
      </div>
      <div class="card">
        <h3>Deneyim tasarımı</h3>
        <p>Web ve ürün yüzeylerinde sade, hızlı ve erişilebilir arayüzler.</p>
      </div>
    </section>
    <section id="iletisim" style="margin-top:3rem;color:var(--muted);font-size:0.95rem;">
      <p><strong style="color:var(--text);">İletişim:</strong> hello@novadijital.example — İstanbul</p>
    </section>
  </main>
  <footer>© 2026 Nova Dijital. Tüm hakları saklıdır.</footer>
</body>
</html>`;

app.get('/', (req, res) => {
  res.type('html').send(LANDING_HTML);
});

// Render / PaaS: dışarıdan erişim için 0.0.0.0 şart (sadece localhost dinlemek deploy'u düşürür)
const port = Number(process.env.PORT) || 10000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`HTTP Server aktif! http://0.0.0.0:${port}`);
});
server.on('error', (err) => {
  console.error('HTTP sunucu hatası:', err);
  process.exit(1);
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
    if (!logChan || !logChan.isTextBased()) {
      return console.log("Kanal bulunamadı veya mesaj gönderilemeyen bir kanal türü!");
    }

    // Audit Log çekme
    const logs = await newM.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate }).catch(() => null);
    const entry = logs ? logs.entries.first() : null;
    const exec =
      entry && entry.target.id === newM.id && entry.executor
        ? entry.executor.tag
        : "Bilinmiyor";

    for (const r of added.values()) {
      await logChan.send(`➕ **${r.name}** verildi -> \`${newM.user.tag}\` | Yapan: \`${exec}\``);
    }
    for (const r of removed.values()) {
      await logChan.send(`➖ **${r.name}** alındı -> \`${newM.user.tag}\` | Yapan: \`${exec}\``);
    }
  } catch (err) {
    console.log("Hata çıktı: " + err.message);
  }
});

// Token: Render → Dashboard → bu Web Service → Environment → Environment Variables
// Anahtar adı: TOKEN  |  Değer: Discord Developer Portal'dan bot token'ın
const token = process.env.TOKEN?.trim();
if (token) {
  client.login(token).catch(e => console.log("Giriş Hatası: " + e));
} else {
  console.error(
    "[!] TOKEN yok. Render'da Environment Variables içine TOKEN ekleyin (Secret olarak işaretleyin)."
  );
}
