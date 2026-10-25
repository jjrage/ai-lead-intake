#!/usr/bin/env node
// Conversation eval: plays every scenario in eval/conversations/scenarios.json against one assistant
// model while another model plays the lead, then checks the result in code. The assistant turn is the
// n8n workflow's own logic (core/assistant.mjs, core/model-request.mjs), and the lead record is
// updated the way assistant.apply_turn() updates it in Postgres.
//
//   node eval/conversations/run.mjs --variant claude-haiku            # all scenarios, one model
//   node eval/conversations/run.mjs --variant gemini-flash --only 01,09 --reps 2
//   options: --concurrency N (default 4), --fresh (drop earlier results; with --only, just those
//   scenarios), --regrade (re-check stored conversations against the current scenarios.json, no calls)
//
// Writes eval/conversations/runs/<variant>/results.jsonl and transcripts/<scenario>-r<rep>.md.
// Then: node eval/conversations/summarize.mjs. Keys come from .env.
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { buildReplySchema, renderSystemPrompt, formatTurnInput, decideTurn, CHANNEL_NAMES, meetingPlan, bookingDue, freeSlots, freeWindows } from '../../core/assistant.mjs';
import { turnRequest, parseTurnResponse, turnCost } from '../../core/model-request.mjs';
import { parseAndValidate } from '../lib/validate.mjs';

try { process.loadEnvFile('.env'); } catch {}

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const variant = opt('--variant');
const only = opt('--only')?.split(',').map((s) => s.trim());
const reps = Number(opt('--reps', 1));
const concurrency = Number(opt('--concurrency', 4));
const fresh = args.includes('--fresh');
const regrade = args.includes('--regrade');

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const SCENARIOS = JSON.parse(read('./scenarios.json'));
const MODELS = JSON.parse(read('./models.json'));
const PROFILE = JSON.parse(read(`../../profiles/${SCENARIOS.profile}.json`));
const SYSTEM = renderSystemPrompt(read('../../prompts/assistant.system.md'), PROFILE);
const SCHEMA = buildReplySchema(PROFILE);

const candidate = MODELS.candidates.find((m) => m.variant === variant);
if (!candidate) {
  console.error(`usage: node eval/conversations/run.mjs --variant ${MODELS.candidates.map((m) => m.variant).join('|')} [--only 01,09] [--reps N] [--concurrency N] [--fresh]`);
  process.exit(1);
}
const SIM = MODELS.lead_simulator;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ZERO = { input_tokens: 0, output_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0 };

// One model call with retries on rate limits, server errors and network failures.
async function call(provider, model, { system, user, schema }) {
  const req = turnRequest(provider, model, { system, user, schema });
  const key = provider === 'claude' ? { 'x-api-key': process.env.ANTHROPIC_API_KEY } : { 'x-goog-api-key': process.env.GEMINI_API_KEY };
  for (let attempt = 1; ; attempt++) {
    const t0 = Date.now();
    let status = 0;
    let body = '';
    try {
      const res = await fetch(req.url, { method: 'POST', headers: { 'content-type': 'application/json', ...req.headers, ...key }, body: JSON.stringify(req.body) });
      status = res.status;
      body = await res.text();
      if (res.ok) {
        const parsed = parseTurnResponse(provider, model, JSON.parse(body));
        return { ...parsed, latency_ms: Date.now() - t0, cost_usd: turnCost(model, parsed.usage) ?? 0 };
      }
    } catch (e) {
      body = String(e?.message ?? e);
    }
    if (attempt < 5 && (status === 0 || status === 429 || status >= 500)) { await sleep(1500 * 2 ** attempt); continue; }
    return { text: '', model, stop_reason: 'error', usage: ZERO, error: `HTTP ${status}: ${body.slice(0, 300)}`, latency_ms: Date.now() - t0, cost_usd: 0 };
  }
}

// ---- the lead --------------------------------------------------------------------------------

const SIM_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['messages', 'done'],
  properties: { messages: { type: 'array', items: { type: 'string' } }, done: { type: 'boolean' } },
};

function simSystem(s) {
  return [
    `You are role-playing a person chatting with a real-estate agency (${PROFILE.business.name}, ${PROFILE.business.city}) through ${CHANNEL_NAMES[s.channel] ?? 'chat'}. Stay in character for the whole conversation: you are the customer, never an assistant.`,
    '',
    `Who you are: ${s.persona}`,
    `What you want: ${s.goal}`,
    `What you know (share a detail when you are asked for it or when it fits naturally; don't put everything in one message): ${s.facts}`,
    `How you write: ${s.style}`,
    '',
    'Rules:',
    '- Send one short message per turn, like a real person texting.',
    '- Answer the agency\'s questions with the facts above. For anything not covered, answer briefly and plausibly, or say you don\'t know yet.',
    '- Don\'t repeat what you already said.',
    '- The agency\'s message may show [buttons: …] under it. To pick one, write its text exactly, as tapping it would; then that tap is your whole turn.',
    '- Set "done" to true with no messages when the agency has said someone will contact you and you have nothing to add, when they have handed you to a person, when they confirmed they will stop messaging you, or when the conversation has naturally ended.',
    '- Never say that you are an AI or that this is a test.',
  ].join('\n');
}

function simUser(transcript) {
  if (!transcript.length) return 'The conversation has not started yet. Write your first message.';
  const lines = transcript.map((m) => `${m.author === 'lead' ? 'You' : 'Agency'}: ${m.text}${m.quick_replies?.length ? ` [buttons: ${m.quick_replies.join(' | ')}]` : ''}`);
  return `The conversation so far:\n\n${lines.join('\n')}\n\nWrite your next message.`;
}

// ---- grading ---------------------------------------------------------------------------------

// Rough language check: more Spanish than English function words.
function looksSpanish(text) {
  const es = (text.match(/\b(que|de|el|la|los|las|para|con|tu|te|su|por|una|un|gracias|hola|es|en|y|tienes|puedo)\b/gi) ?? []).length;
  const en = (text.match(/\b(the|and|you|your|to|for|with|is|are|we|our|can|will)\b/gi) ?? []).length;
  return es > en || (es === en && /[¿¡ñáéíóú]/i.test(text));
}

function grade(s, run) {
  const e = s.expect ?? {};
  const replies = run.turns.map((t) => t.reply).filter(Boolean);
  const all = replies.join('\n');
  const c = run.contact;
  const checks = [];
  const add = (name, ok, detail = null) => checks.push({ name, ok: !!ok, detail });
  const bad = run.turns.filter((t) => !t.ok).map((t) => t.errors.join('; '));
  add('answers valid', bad.length === 0, bad.join(' | ') || null);
  if (e.intent) add(`intent ${e.intent}`, c.facts.intent === e.intent, c.facts.intent ?? null);
  for (const [k, re] of Object.entries(e.facts ?? {})) add(`fact ${k} ~ /${re}/`, new RegExp(re, 'i').test(String(c.facts[k] ?? '')), c.facts[k] ?? null);
  if (e.contact === 'any') add('phone or email captured', c.email || c.phone, [c.email, c.phone].filter(Boolean).join(', ') || null);
  else for (const [k, re] of Object.entries(e.contact ?? {})) add(`${k} ~ /${re}/`, new RegExp(re, 'i').test(String(c[k] ?? '')), c[k] ?? null);
  if (e.stage) add(`stage ${e.stage.join(' or ')}`, e.stage.includes(c.stage), c.stage);
  if (e.hot !== undefined) add(`hot ${e.hot}`, c.is_hot === e.hot, c.is_hot);
  if (e.handoff !== undefined && e.handoff !== 'any') add(`hand-off ${e.handoff}`, run.handoff === e.handoff, run.handoff_reason);
  if (e.injection) add('injection flagged', run.turns.some((t) => t.result?.injection));
  if (e.opt_out !== undefined) add(`opt-out ${e.opt_out}`, !!c.opted_out === e.opt_out);
  if (e.language === 'es') add('replies in Spanish', replies.length && replies.every(looksSpanish), replies.filter((r) => !looksSpanish(r)).map((r) => r.slice(0, 80)).join(' | ') || null);
  for (const re of e.forbid ?? []) {
    const hit = replies.map((r) => r.match(new RegExp(re, 'i'))).find(Boolean);
    add(`never /${re}/`, !hit, hit?.[0] ?? null);
  }
  for (const re of e.require ?? []) add(`says /${re}/`, new RegExp(re, 'i').test(all));

  // Style, reported but not part of pass/fail.
  const style = {
    replies: replies.length,
    over_length: replies.filter((r) => r.length > PROFILE.assistant.max_reply_chars).length,
    two_plus_questions: replies.filter((r) => (r.match(/\?/g) ?? []).length > 1).length,
    markdown: replies.filter((r) => /\*\*|^\s*[-*•] |^#/m.test(r)).length,
    re_greeting: replies.slice(1).filter((r) => /\b(I'?m|I am|soy) Ava\b/i.test(r)).length,
  };
  return { pass: checks.every((x) => x.ok), checks, style };
}

// ---- one conversation ------------------------------------------------------------------------

async function play(s, rep) {
  let now = new Date(s.start).getTime();
  const contact = { name: s.known?.name ?? null, email: s.known?.email ?? null, phone: s.known?.phone ?? null, language: null, stage: 'new', facts: {}, is_hot: false, opted_out: false };
  const messages = [];
  const turns = [];
  let handoff = false;
  let handoffReason = null;
  let simCost = 0;
  let ended = 'max_turns';
  let channel = s.channel;
  if (s.known?.facts) Object.assign(contact.facts, s.known.facts);
  if (s.known?.stage) contact.stage = s.known.stage;
  if (s.known?.booking) contact.booking = s.known.booking;

  for (let i = 0; i < s.max_turns; i++) {
    // The lead's message(s): scripted, or written by the simulator.
    const scripted = i < (s.script?.length ?? 0) ? s.script[i] : null;
    let leadMessages;
    if (scripted) {
      now += (scripted.after_hours ?? 0) * 3600e3;
      channel = scripted.channel ?? channel;  // e.g. a Lead Ads lead answers on WhatsApp
      leadMessages = scripted.messages;
    } else if (s.script_only) {
      ended = 'script_done';
      break;
    } else {
      const sim = await call(SIM.provider, SIM.model, { system: simSystem(s), user: simUser(messages), schema: SIM_SCHEMA });
      simCost += sim.cost_usd;
      const parsed = parseAndValidate(sim.text, SIM_SCHEMA);
      if (!parsed.ok) { ended = `simulator failed: ${sim.error ?? parsed.errors.join('; ')}`; break; }
      if (parsed.value.done || !parsed.value.messages.length) { ended = 'lead_done'; break; }
      // The simulator sometimes writes a tap as "[tap: X]": the lead sends X. A tap next to a typed answer
      // is the same answer twice (a simulator slip): only the typed one is sent.
      leadMessages = parsed.value.messages.map((t) => t.replace(/^\[(?:tap|buttons?):\s*(.+?)\]$/i, '$1').trim()).filter(Boolean);
      const buttons = messages.at(-1)?.quick_replies ?? [];
      const typed = leadMessages.filter((t) => !buttons.includes(t));
      if (leadMessages.length > 1 && typed.length) leadMessages = typed;
    }
    for (const text of leadMessages) {
      messages.push({ author: 'lead', text, sent_at: new Date(now).toISOString() });
      now += 5e3;
    }
    now += 5e3;  // the workflow waits a few seconds for more messages

    // The assistant's turn, as in the workflow.
    // Free times as the workflow finds them, from the scenario's busy periods (none: an empty calendar).
    const current = contact.booking ?? null;
    const plan = bookingDue(contact, PROFILE, current) ? meetingPlan(contact.facts.intent, contact.language ?? 'en', PROFILE) : null;
    const lang = contact.language ?? 'en';
    const booking = plan || current
      ? { plan, slots: plan ? freeSlots(s.busy ?? [], plan, PROFILE, new Date(now), lang) : [], windows: plan ? freeWindows(s.busy ?? [], plan, PROFILE, new Date(now)) : [], current }
      : null;
    const ctx = { contact: { ...contact }, channel, messages: [...messages], booking, now: new Date(now).toISOString() };
    const res = await call(candidate.provider, candidate.model, { system: SYSTEM, user: formatTurnInput(ctx, PROFILE, new Date(now)), schema: SCHEMA });
    const checked = res.error ? { ok: false, value: null, errors: [res.error] }
      : res.stop_reason !== 'end_turn' ? { ok: false, value: null, errors: [`stop reason ${res.stop_reason}`] }
      : parseAndValidate(res.text, SCHEMA);
    const d = decideTurn(checked, ctx, PROFILE);

    // Same update as assistant.apply_turn(): known details are never overwritten.
    const p = d.contact_patch ?? {};
    contact.name ??= p.name ?? null;
    contact.email ??= p.email ?? null;
    contact.phone ??= p.phone ?? null;
    if (p.language) contact.language = p.language;
    if (p.facts) contact.facts = { ...contact.facts, ...p.facts };
    if (p.stage) contact.stage = p.stage;
    contact.is_hot ||= !!p.is_hot;
    if (p.opted_out) contact.opted_out = true;
    // What assistant.book_meeting() / cancel_booking() do once the calendar accepts.
    if (d.booking?.action === 'book') { contact.booking = { meeting: d.booking.plan.label, agent: d.booking.plan.agent, start: d.booking.slot.start }; contact.stage = 'booked'; d.events.push({ kind: 'booked' }); }
    if (d.booking?.action === 'cancel') { contact.booking = null; contact.stage = 'qualified'; d.events.push({ kind: 'booking_cancelled' }); }

    now += res.latency_ms;
    if (d.reply) messages.push({ author: 'ai', text: d.reply, sent_at: new Date(now).toISOString(), quick_replies: d.quick_replies ?? [] });
    turns.push({ lead: leadMessages, reply: d.reply, action: d.action, quick_replies: d.quick_replies ?? [], ok: checked.ok, errors: checked.errors ?? [], result: checked.value, events: d.events.map((e) => e.kind), latency_ms: res.latency_ms, cost_usd: res.cost_usd, usage: res.usage, model: res.model });
    now += 60e3;

    if (d.action === 'handoff') { handoff = true; handoffReason = d.handoff_reason; ended = 'handoff'; break; }
    if (d.action === 'opt_out') { ended = 'opt_out'; break; }
  }

  const run = { scenario: s.id, rep, variant, model: candidate.model, ended, handoff, handoff_reason: handoffReason, contact, turns };
  const g = grade(s, run);
  return {
    ...run,
    ...g,
    cost_usd: turns.reduce((a, t) => a + t.cost_usd, 0),
    sim_cost_usd: simCost,
    latency_ms_avg: Math.round(turns.reduce((a, t) => a + t.latency_ms, 0) / Math.max(turns.length, 1)),
  };
}

function transcriptMd(s, r) {
  const lines = [`# ${s.id} · ${s.title}`, '', `${candidate.label} · rep ${r.rep} · ${r.pass ? 'PASS' : 'FAIL'} · ended: ${r.ended} · $${r.cost_usd.toFixed(4)}`, ''];
  for (const t of r.turns) {
    for (const m of t.lead) lines.push(`**Lead:** ${m}`, '');
    lines.push(`**Ava** (${t.action}${t.ok ? '' : ', answer unusable'}; ${t.latency_ms} ms${t.events.length ? `; ${t.events.join(', ')}` : ''}): ${t.reply || '(no reply)'}${t.quick_replies?.length ? ` [${t.quick_replies.join('] [')}]` : ''}`, '');
  }
  lines.push('## Lead record', '', '```json', JSON.stringify(r.contact, null, 2), '```', '', '## Checks', '');
  for (const c of r.checks) lines.push(`- ${c.ok ? '✅' : '❌'} ${c.name}${c.detail != null ? ` — ${String(c.detail).slice(0, 200)}` : ''}`);
  lines.push('', `Style: ${JSON.stringify(r.style)}`, '');
  return lines.join('\n');
}

// ---- main ------------------------------------------------------------------------------------

const dir = new URL(`./runs/${variant}/`, import.meta.url);
mkdirSync(new URL('transcripts/', dir), { recursive: true });
const resultsFile = new URL('results.jsonl', dir);
const selected = (id) => !only || only.some((p) => id.startsWith(p));
const stored = () => (existsSync(resultsFile) ? readFileSync(resultsFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const save = (rows) => writeFileSync(resultsFile, rows.map((r) => JSON.stringify(r) + '\n').join(''));

if (regrade) {
  const byId = new Map(SCENARIOS.scenarios.map((s) => [s.id, s]));
  const rows = stored().map((r) => {
    const s = byId.get(r.scenario);
    if (!s || !selected(r.scenario)) return r;
    const g = { ...r, ...grade(s, r) };
    writeFileSync(new URL(`transcripts/${s.id}-r${r.rep}.md`, dir), transcriptMd(s, g));
    return g;
  });
  save(rows);
  console.log(`${candidate.label}: regraded ${rows.length} conversation(s), ${rows.filter((r) => r.pass).length} pass`);
  process.exit(0);
}
if (fresh) save(stored().filter((r) => !selected(r.scenario)));
const done = new Set(stored().map((j) => `${j.scenario}#${j.rep}`));

const queue = [];
for (const s of SCENARIOS.scenarios) {
  if (!selected(s.id)) continue;
  for (let rep = 0; rep < reps; rep++) if (!done.has(`${s.id}#${rep}`)) queue.push([s, rep]);
}
console.log(`${candidate.label}: ${queue.length} conversation(s), lead played by ${SIM.model}`);

let passed = 0;
let total = 0;
let cost = 0;
async function worker() {
  while (queue.length) {
    const [s, rep] = queue.shift();
    const r = await play(s, rep);
    appendFileSync(resultsFile, JSON.stringify(r) + '\n');
    writeFileSync(new URL(`transcripts/${s.id}-r${rep}.md`, dir), transcriptMd(s, r));
    total++;
    if (r.pass) passed++;
    cost += r.cost_usd + r.sim_cost_usd;
    const failed = r.checks.filter((c) => !c.ok).map((c) => `${c.name}${c.detail != null ? ` (${String(c.detail).slice(0, 60)})` : ''}`);
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${s.id} r${rep}: ${r.turns.length} turns, ${r.ended}, $${r.cost_usd.toFixed(4)}${failed.length ? ` — ${failed.join('; ')}` : ''}`);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
console.log(`\n${passed}/${total} passed · spent $${cost.toFixed(3)} (assistant + lead simulator)`);
