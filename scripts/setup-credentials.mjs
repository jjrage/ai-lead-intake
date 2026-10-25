// Creates (or updates) the n8n credentials the workflows use, from the keys in .env.
// Run after `docker compose up -d` and after creating the n8n owner account:
//   node scripts/setup-credentials.mjs                    local n8n, keys from ./.env
//   node scripts/setup-credentials.mjs --remote demo-vps  public server, keys from its deploy/.env
// Credentials whose keys are missing are skipped; run again after adding them.
// Gmail still needs one click in n8n: open the "Gmail (agency inbox)" credential and sign in with Google.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const i = process.argv.indexOf('--remote');
const remote = i > 0 ? process.argv[i + 1] : null;
if (i > 0 && !remote) throw new Error('--remote needs an SSH host');

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
// docker compose, here or on the server; `input` goes to its stdin.
const compose = (args, input) => (remote
  ? execFileSync('ssh', [remote, `cd lead-assistant/deploy && docker compose ${args.map(q).join(' ')}`], { input, stdio: ['pipe', 'pipe', 'pipe'] })
  : execFileSync('docker', ['compose', ...args], { input, stdio: ['pipe', 'pipe', 'pipe'] })).toString();

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const env = remote
  ? parseEnv(execFileSync('ssh', [remote, 'cat lead-assistant/deploy/.env']).toString())
  : parseEnv(readFileSync('.env', 'utf8'));

// Fixed ids: the exported workflows in workflows/ refer to these.
const candidates = [
  {
    id: 'liCredPostgres01', name: 'Lead Intake Postgres', type: 'postgres',
    needs: ['POSTGRES_DB', 'POSTGRES_NON_ROOT_USER', 'POSTGRES_NON_ROOT_PASSWORD'],
    data: () => ({ host: 'postgres', port: 5432, database: env.POSTGRES_DB, user: env.POSTGRES_NON_ROOT_USER, password: env.POSTGRES_NON_ROOT_PASSWORD, ssl: 'disable', allowUnauthorizedCerts: false, maxConnections: 100, sshTunnel: false }),
  },
  {
    id: 'liCredGemini0001', name: 'Gemini API', type: 'googlePalmApi',
    needs: ['GEMINI_API_KEY'],
    data: () => ({ host: 'https://generativelanguage.googleapis.com', apiKey: env.GEMINI_API_KEY }),
  },
  {
    id: 'liCredAnthropic1', name: 'Anthropic API', type: 'anthropicApi',
    needs: ['ANTHROPIC_API_KEY'],
    data: () => ({ apiKey: env.ANTHROPIC_API_KEY, url: 'https://api.anthropic.com', header: false }),
  },
  {
    id: 'liCredHubspot001', name: 'HubSpot Service Key', type: 'hubspotAppToken',
    needs: ['HUBSPOT_SERVICE_KEY'],
    data: () => ({ appToken: env.HUBSPOT_SERVICE_KEY }),
  },
  {
    id: 'liCredSlack00001', name: 'Slack bot', type: 'slackApi',
    needs: ['SLACK_BOT_TOKEN'],
    // The signing secret lets the Slack Trigger check that events really come from Slack.
    data: () => ({ accessToken: env.SLACK_BOT_TOKEN, ...(env.SLACK_SIGNING_SECRET ? { signatureSecret: env.SLACK_SIGNING_SECRET } : {}) }),
  },
  {
    id: 'liCredGmail00001', name: 'Gmail (agency inbox)', type: 'gmailOAuth2',
    needs: ['GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET'],
    data: () => ({ clientId: env.GMAIL_OAUTH_CLIENT_ID, clientSecret: env.GMAIL_OAUTH_CLIENT_SECRET }),
  },
  {
    // The agents' calendars (free times, bookings) in the same Google account; also needs one click:
    // open it in n8n and sign in with Google.
    id: 'laCredGCalendar1', name: 'Google Calendar (agents)', type: 'googleCalendarOAuth2Api',
    needs: ['GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET'],
    data: () => ({ clientId: env.GMAIL_OAUTH_CLIENT_ID, clientSecret: env.GMAIL_OAUTH_CLIENT_SECRET }),
  },
  {
    // GoHighLevel API v2: a Private Integration token of the sub-account, sent as a Bearer header.
    id: 'laCredGhlToken01', name: 'GoHighLevel token', type: 'httpHeaderAuth',
    needs: ['GHL_TOKEN'],
    data: () => ({ name: 'Authorization', value: `Bearer ${env.GHL_TOKEN.trim()}` }),
  },
  {
    id: 'laCredTelegram01', name: 'Telegram bot', type: 'telegramApi',
    needs: ['TELEGRAM_BOT_TOKEN'],
    data: () => ({ accessToken: env.TELEGRAM_BOT_TOKEN, baseUrl: 'https://api.telegram.org' }),
  },
  {
    id: 'laCredWhatsApp01', name: 'WhatsApp Cloud API', type: 'whatsAppApi',
    needs: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_WABA_ID'],
    data: () => ({ accessToken: env.WHATSAPP_ACCESS_TOKEN, businessAccountId: env.WHATSAPP_WABA_ID }),
  },
  {
    // The Meta app's id and secret: the WhatsApp Trigger registers its webhook with them and checks
    // each event's signature.
    id: 'laCredWaTrigger1', name: 'WhatsApp app (webhooks)', type: 'whatsAppTriggerApi',
    needs: ['META_APP_ID', 'META_APP_SECRET'],
    data: () => ({ clientId: env.META_APP_ID, clientSecret: env.META_APP_SECRET }),
  },
  {
    // The same app for the Messenger and Instagram triggers: an app access token registers their
    // webhooks, and the secret checks each event's signature.
    id: 'laCredMetaApp001', name: 'Meta app (webhooks)', type: 'facebookGraphAppApi',
    needs: ['META_APP_ID', 'META_APP_SECRET'],
    data: () => ({ accessToken: `${env.META_APP_ID}|${env.META_APP_SECRET}`, appSecret: env.META_APP_SECRET }),
  },
  {
    // Sends as the Facebook Page and its linked Instagram account (from scripts/meta-setup.mjs).
    id: 'laCredMetaPage01', name: 'Facebook Page (Messenger, Instagram)', type: 'facebookGraphApi',
    needs: ['META_PAGE_TOKEN'],
    data: () => ({ accessToken: env.META_PAGE_TOKEN }),
  },
];

const ready = candidates.filter((c) => c.needs.every((k) => env[k]?.trim()));
for (const c of candidates) if (!ready.includes(c)) console.log(`skip  ${c.name} (missing ${c.needs.filter((k) => !env[k]?.trim()).join(', ')})`);
if (!ready.length) process.exit(0);

// Importing replaces a credential's data, so the tokens of a Google sign-in done in n8n are carried
// over; without this, every run would sign the Gmail and Calendar credentials out.
function signedInTokens() {
  const tmp = `/tmp/n8n-existing-${randomBytes(6).toString('hex')}.json`;
  try {
    const out = compose(['exec', '-T', 'n8n', 'sh', '-c', `umask 077 && n8n export:credentials --all --decrypted --output=${tmp} >/dev/null 2>&1; cat ${tmp} 2>/dev/null; rm -f ${tmp}`]);
    return Object.fromEntries(JSON.parse(out || '[]').filter((c) => c.data?.oauthTokenData).map((c) => [c.id, c.data.oauthTokenData]));
  } catch {
    return {};
  }
}

// The file holds secrets in plain text: it exists only inside the container, until n8n has
// imported (and encrypted) them.
const file = `/tmp/n8n-credentials-${randomBytes(6).toString('hex')}.json`;
const tokens = signedInTokens();
try {
  compose(['exec', '-T', 'n8n', 'sh', '-c', `umask 077 && cat > ${file}`],
    JSON.stringify(ready.map((c) => ({ id: c.id, name: c.name, type: c.type, data: { ...c.data(), ...(tokens[c.id] ? { oauthTokenData: tokens[c.id] } : {}) } }))));
  const out = compose(['exec', '-T', 'n8n', 'n8n', 'import:credentials', `--input=${file}`]);
  if (/error/i.test(out)) console.log(out.trim());
  for (const c of ready) console.log(`ok    ${c.name}`);
} finally {
  try { compose(['exec', '-T', '-u', 'root', 'n8n', 'rm', '-f', file]); } catch {}
}
