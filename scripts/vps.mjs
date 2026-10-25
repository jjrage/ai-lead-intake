// Public server helper. The server is an SSH host alias (default demo-vps, override with VPS_HOST);
// files live in ~/lead-assistant on it, laid out like this repository.
//   node scripts/vps.mjs sync       copy deploy/, db/, prompts/, profiles/ to the server
//   node scripts/vps.mjs env        create deploy/.env on the server (fresh secrets, once) and fill
//                                   empty API keys from the local .env
//   node scripts/vps.mjs env KEY…   also replace these API keys with the local values (a new token)
//   node scripts/vps.mjs up         sync, then docker compose up -d
//   node scripts/vps.mjs migrate    apply db/migrations/*.sql that are not applied yet
//   node scripts/vps.mjs sqltest    run db/tests/assistant.sql (in a transaction, rolled back)
//   node scripts/vps.mjs tunnel     n8n editor at http://localhost:5678 until Ctrl+C
//   node scripts/vps.mjs dc <args>  docker compose on the server, e.g. dc ps, dc logs -n 50 n8n
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const HOST = process.env.VPS_HOST || 'demo-vps';
const DIR = 'lead-assistant';
const SYNCED = ['deploy/compose.yml', 'deploy/Caddyfile', 'deploy/site', 'deploy/.env.example', 'db', 'prompts', 'profiles'];
const API_KEYS = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'HUBSPOT_SERVICE_KEY', 'SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET', 'TELEGRAM_BOT_TOKEN', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_WABA_ID', 'WHATSAPP_PHONE_NUMBER_ID', 'META_APP_ID', 'META_APP_SECRET', 'META_PAGE_TOKEN', 'GHL_TOKEN'];

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const ssh = (command, input) => execFileSync('ssh', [HOST, command], { input, stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'inherit'] }).toString();
const dc = (args) => `cd ${DIR}/deploy && docker compose ${args.map(q).join(' ')}`;

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function sync() {
  const paths = SYNCED.filter((p) => existsSync(new URL(`../${p}`, import.meta.url)));
  const tarball = execFileSync('tar', ['-czf', '-', ...paths], { cwd: REPO, maxBuffer: 64 << 20 });
  ssh(`mkdir -p ${DIR} && tar -xzf - -C ${DIR}`, tarball);
  console.log(`synced ${paths.join(', ')} to ${HOST}:~/${DIR}`);
}

function env(replace = []) {
  const path = `${DIR}/deploy/.env`;
  const current = ssh(`cat ${path} 2>/dev/null || true`);
  let text;
  if (current.trim()) {
    text = current;
  } else {
    // First run: the template with fresh secrets. The secrets are generated here and only ever
    // written to the server.
    const ip = /\bsrc (\d+\.\d+\.\d+\.\d+)/.exec(ssh('ip -4 -o route get 1.1.1.1'))?.[1];
    if (!ip) throw new Error('could not find the server\'s public IPv4 address');
    const secret = () => randomBytes(24).toString('base64url');
    const fresh = { PUBLIC_HOST: `${ip.replace(/\./g, '-')}.sslip.io`, POSTGRES_PASSWORD: secret(), POSTGRES_NON_ROOT_PASSWORD: secret(), N8N_ENCRYPTION_KEY: secret(), RUNNERS_AUTH_TOKEN: secret() };
    text = readFileSync(new URL('../deploy/.env.example', import.meta.url), 'utf8')
      .replace(/^([A-Z0-9_]+)=$/gm, (line, k) => (fresh[k] ? `${k}=${fresh[k]}` : line));
  }
  // API keys: fill the ones still empty on the server (or named on the command line) from the local .env.
  const local = existsSync(new URL('../.env', import.meta.url)) ? parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8')) : {};
  const have = parseEnv(text);
  const unknown = replace.filter((k) => !API_KEYS.includes(k));
  if (unknown.length) throw new Error(`not an API key: ${unknown.join(', ')}`);
  const filled = [];
  for (const k of API_KEYS) {
    if ((have[k] && !replace.includes(k)) || !local[k] || have[k] === local[k]) continue;
    text = new RegExp(`^${k}=.*$`, 'm').test(text) ? text.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${local[k]}`) : `${text.trimEnd()}\n${k}=${local[k]}\n`;
    filled.push(k);
  }
  ssh(`umask 077 && mkdir -p ${DIR}/deploy && cat > ${path}.tmp && mv ${path}.tmp ${path}`, text);
  console.log(`${current.trim() ? 'updated' : 'created'} ${HOST}:~/${path}${filled.length ? ` (filled ${filled.join(', ')})` : ''}`);
}

function migrate() {
  // Runs as the non-root user so the tables belong to the account n8n connects with.
  const files = readdirSync(new URL('../db/migrations', import.meta.url)).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
  const psql = (sql) => ssh(`cd ${DIR}/deploy && set -a && . ./.env && set +a && docker compose exec -T postgres psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_NON_ROOT_USER" -d "$POSTGRES_DB" -At`, sql);
  psql('CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());');
  const done = new Set(psql('SELECT name FROM public.schema_migrations;').split('\n').filter(Boolean));
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(new URL(`../db/migrations/${f}`, import.meta.url), 'utf8');
    psql(`BEGIN;\n${sql}\nINSERT INTO public.schema_migrations (name) VALUES (${q(f)});\nCOMMIT;\n`);
    console.log(`applied ${f}`);
  }
  console.log('migrations up to date');
}

function sqltest() {
  const sql = readFileSync(new URL('../db/tests/assistant.sql', import.meta.url), 'utf8');
  process.stdout.write(ssh(`cd ${DIR}/deploy && set -a && . ./.env && set +a && docker compose exec -T postgres psql -X -U "$POSTGRES_NON_ROOT_USER" -d "$POSTGRES_DB" 2>&1`, sql));
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case 'sync': sync(); break;
  case 'env': env(rest); break;
  case 'up': sync(); process.stdout.write(ssh(dc(['up', '-d', '--remove-orphans']))); break;
  case 'migrate': migrate(); break;
  case 'sqltest': sqltest(); break;
  case 'dc': spawnSync('ssh', [HOST, dc(rest)], { stdio: 'inherit' }); break;
  case 'tunnel':
    console.log('n8n editor: http://localhost:5678 (Ctrl+C to close)');
    spawnSync('ssh', ['-N', '-L', '5678:127.0.0.1:5678', HOST], { stdio: 'inherit' });
    break;
  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
}
