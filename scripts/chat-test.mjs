// Talks to the assistant through the website chat endpoints, like the demo page does, and prints
// the replies and the lead record the business side sees.
//   node scripts/chat-test.mjs "Hi" "We want to buy in Mesa"          one message, one reply, in turn
//   node scripts/chat-test.mjs --burst "hi" "moving in January" "3 beds"  all at once, then one reply
//   --session <id> continues a conversation; --url overrides the server (default: the demo server)
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
const base = opt('--url', 'https://148-113-241-86.sslip.io').replace(/\/$/, '');
const session = opt('--session', randomUUID());
const burst = flag('--burst');
if (!args.length) { console.log('usage: node scripts/chat-test.mjs [--burst] [--session id] "message" ...'); process.exit(1); }

let after = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function send(text) {
  const res = await fetch(`${base}/webhook/chat/message`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session, message_id: randomUUID(), text }) });
  if (!res.ok) throw new Error(`send failed: HTTP ${res.status} ${await res.text()}`);
  console.log(`\n> ${text}`);
}

async function waitForReply(timeoutMs = 60000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    await sleep(1000);
    const res = await fetch(`${base}/webhook/chat/updates?session=${session}&after=${after}`);
    last = await res.json();
    if (last.messages?.length) {
      for (const m of last.messages) { console.log(`< [${m.author}] ${m.text}`); after = Math.max(after, m.id); }
      console.log(`  (${((Date.now() - start) / 1000).toFixed(1)} s)`);
      return last;
    }
  }
  console.log(`  no reply after ${timeoutMs / 1000} s`);
  return last;
}

// A continued conversation starts after what it already has, so old replies aren't taken for new ones.
if (process.argv.includes('--session')) {
  const known = await (await fetch(`${base}/webhook/chat/updates?session=${session}&after=0`)).json();
  after = Math.max(0, ...(known.messages ?? []).map((m) => m.id));
}

if (burst) {
  for (const t of args) { await send(t); await sleep(700); }
  await waitForReply();
} else {
  for (const t of args) { await send(t); await waitForReply(); }
}
await sleep(1500);
const res = await fetch(`${base}/webhook/chat/updates?session=${session}&after=${after}`);
const state = await res.json();
console.log('\nlead:', JSON.stringify(state.lead), '| mode:', state.mode);
console.log('events:', (state.events ?? []).map((e) => e.kind + (e.data?.to ? `→${e.data.to}` : '')).join(', ') || 'none');
console.log('session:', session);
