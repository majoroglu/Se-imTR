const { Client, GatewayIntentBits, AuditLogEvent } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = "MTUwMDE5ODE2NjUwMTUyNzY4Mw.GZhxwv.zqUfmmAScY7LbTp8WyOuQnlq8fnGrfXoMo6dCs";
const LOG_CHANNEL_ID = "https://discord.com/channels/1376625961428324502/1499712129551433848";

const WHITELIST_ROLES = [
  "1376625962027843695",
  "1376625962027843696",
  "1376625962027843697",
  "1376625962027843698"
];

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

  const filteredAdded = addedRoles.filter(r => WHITELIST_ROLES.includes(r.id));
  const filteredRemoved = removedRoles.filter(r => WHITELIST_ROLES.includes(r.id));

  if (!filteredAdded.size && !filteredRemoved.size) return;

  const logs = await newMember.guild.fetchAuditLogs({
    limit: 1,
    type: AuditLogEvent.MemberRoleUpdate
  });

  const entry = logs.entries.first();
  if (!entry) return;

  const executor = entry.executor;

  const logChannel = newMember.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  filteredAdded.forEach(role => {
    logChannel.send(`➕ ${role.name} verildi → ${newMember.user.tag} | Veren: ${executor.tag}`);
  });

  filteredRemoved.forEach(role => {
    logChannel.send(`➖ ${role.name} alındı → ${newMember.user.tag} | Alan: ${executor.tag}`);
  });
});

client.login(TOKEN);