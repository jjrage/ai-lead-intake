// Creates (or updates) the n8n credentials the workflows use, from the keys in .env.
// Run after `docker compose up -d` and after creating the n8n owner account:
//   node scripts/setup-credentials.mjs
// Credentials whose keys are missing from .env are skipped; run again after adding them.
// Gmail still needs one click in n8n: open the "Gmail (agency inbox)" credential and sign in with Google.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.loadEnvFile('.env');
const env = process.env;

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
    data: () => ({ accessToken: env.SLACK_BOT_TOKEN }),
  },
  {
    id: 'liCredGmail00001', name: 'Gmail (agency inbox)', type: 'gmailOAuth2',
    needs: ['GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET'],
    data: () => ({ clientId: env.GMAIL_OAUTH_CLIENT_ID, clientSecret: env.GMAIL_OAUTH_CLIENT_SECRET }),
  },
];

const ready = candidates.filter((c) => c.needs.every((k) => env[k]?.trim()));
for (const c of candidates) if (!ready.includes(c)) console.log(`skip  ${c.name} (missing ${c.needs.filter((k) => !env[k]?.trim()).join(', ')})`);
if (!ready.length) process.exit(0);

// The file holds secrets in plain text: it lives only until n8n has imported (and encrypted) them.
const file = `n8n-credentials-${randomBytes(6).toString('hex')}.json`;
const local = join(tmpdir(), file);
const inContainer = `/tmp/${file}`;
const run = (...args) => execFileSync('docker', ['compose', ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
try {
  writeFileSync(local, JSON.stringify(ready.map((c) => ({ id: c.id, name: c.name, type: c.type, data: c.data() }))), { mode: 0o600 });
  run('cp', local, `n8n:${inContainer}`);
  const out = run('exec', '-T', 'n8n', 'n8n', 'import:credentials', `--input=${inContainer}`);
  if (/error/i.test(out)) console.log(out.trim());
  for (const c of ready) console.log(`ok    ${c.name}`);
} finally {
  rmSync(local, { force: true });
  try { run('exec', '-T', '-u', 'root', 'n8n', 'rm', '-f', inContainer); } catch {}
}
