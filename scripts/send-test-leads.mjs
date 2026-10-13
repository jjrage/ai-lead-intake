// Sends the test leads in test-leads/ through the real entry points:
//   web form leads -> the form webhook (http://localhost:5678/webhook/lead-intake)
//   email leads    -> the demo Gmail inbox, via the "Lead Intake · Test inbox" workflow
// Usage: node scripts/send-test-leads.mjs [--only 01,09] [--delay 3] [--report]
//   --report  waits for processing and prints the lead log from Postgres
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const N8N = process.env.N8N_URL ?? 'http://localhost:5678';
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const only = opt('--only')?.split(',');
const delaySeconds = Number(opt('--delay', 3));
const dir = new URL('../test-leads/', import.meta.url);

const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  .filter((f) => !only || only.some((p) => f.startsWith(p)));

// RFC 5322 message with UTF-8 headers and body, as base64url for Gmail's `raw`.
function mimeMessage(lead) {
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
  const word = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
  const [, name, address] = /^(.*?)\s*<([^>]+)>$/.exec(lead.from) ?? [null, '', lead.from];
  const lines = [
    `From: ${name ? `${word(name)} <${address}>` : address}`,
    'To: Copperline Digital <hello@copperlinedigital.example>',
    `Subject: ${word(lead.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@lead-intake.test>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(lead.body).replace(/.{76}/g, '$&\r\n'),
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');
}

async function post(path, body) {
  const res = await fetch(`${N8N}/webhook/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

for (const [i, file] of files.entries()) {
  const lead = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
  try {
    if (lead.channel === 'email') {
      const res = JSON.parse(await post('test-inbox', { raw: mimeMessage(lead) }));
      console.log(`${file}: email in the inbox (Gmail id ${res.id}); the Gmail workflow picks it up within a minute`);
    } else {
      const { name, email, phone, company, message } = lead;
      await post('lead-intake', { name, email, phone, company, message });
      console.log(`${file}: form submitted`);
    }
  } catch (e) {
    console.log(`${file}: FAILED ${e.message}`);
  }
  if (i < files.length - 1) await new Promise((r) => setTimeout(r, delaySeconds * 1000));
}

if (args.includes('--report')) {
  const hasEmail = files.some((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')).channel === 'email');
  const wait = hasEmail ? 90 : 20;
  console.log(`\nWaiting ${wait}s for processing...`);
  await new Promise((r) => setTimeout(r, wait * 1000));
  const sql = `SELECT id, source, status, category, is_hot AS hot, needs_review AS review, duplicates AS dup,
    hubspot_deal_id AS deal, gmail_draft_id IS NOT NULL AS draft, slack_ts IS NOT NULL AS slack,
    round(cost_usd, 5) AS cost_usd, left(coalesce(error, ''), 60) AS error
    FROM intake.leads ORDER BY id`;
  console.log(execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'sh', '-c', `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "${sql.replace(/\s+/g, ' ')}"`], { cwd: join(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')) }).toString());
}
