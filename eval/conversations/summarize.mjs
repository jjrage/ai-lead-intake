#!/usr/bin/env node
// Summarizes eval/conversations/runs/*/results.jsonl into eval/conversations/summary.md: pass rate,
// cost per conversation and speed per model, a scenario-by-model grid, and every failed check.
//   node eval/conversations/summarize.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const MODELS = JSON.parse(read('./models.json'));
const SCENARIOS = JSON.parse(read('./scenarios.json')).scenarios;
const runsDir = new URL('./runs/', import.meta.url);
if (!existsSync(runsDir)) { console.error('no runs yet: node eval/conversations/run.mjs --variant <name>'); process.exit(1); }

const variants = MODELS.candidates.filter((m) => existsSync(new URL(`${m.variant}/results.jsonl`, runsDir)));
const results = Object.fromEntries(variants.map((m) => [m.variant,
  read(`./runs/${m.variant}/results.jsonl`).split('\n').filter(Boolean).map((l) => JSON.parse(l))]));

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
const lines = ['# Conversation eval', '',
  `${SCENARIOS.length} scenarios for profiles/agave-lane.json; the lead is played by ${MODELS.lead_simulator.model}. Checks run in code (eval/conversations/run.mjs); transcripts are in runs/<model>/transcripts/.`, '',
  '| Model | Passed | Cost per conversation | Model time per reply | Replies per conversation | Answers that failed the schema | Replies with 2+ questions | Over length |',
  '|---|---|---|---|---|---|---|---|'];
for (const m of variants) {
  const rs = results[m.variant];
  const turns = rs.flatMap((r) => r.turns);
  lines.push(`| ${m.label} | ${rs.filter((r) => r.pass).length}/${rs.length} (${pct(rs.filter((r) => r.pass).length, rs.length)}) | $${avg(rs.map((r) => r.cost_usd)).toFixed(4)} | ${(avg(turns.map((t) => t.latency_ms)) / 1000).toFixed(1)} s | ${avg(rs.map((r) => r.turns.length)).toFixed(1)} | ${turns.filter((t) => !t.ok).length}/${turns.length} | ${rs.reduce((a, r) => a + r.style.two_plus_questions, 0)} | ${rs.reduce((a, r) => a + r.style.over_length, 0)} |`);
}

lines.push('', '## By scenario', '', `| Scenario | ${variants.map((m) => m.label.replace(/ \(.*\)/, '')).join(' | ')} |`, `|---|${variants.map(() => '---').join('|')}|`);
for (const s of SCENARIOS) {
  const cells = variants.map((m) => {
    const rs = results[m.variant].filter((r) => r.scenario === s.id);
    return rs.length ? rs.map((r) => (r.pass ? '✅' : '❌')).join('') : '—';
  });
  lines.push(`| ${s.id} ${s.title} | ${cells.join(' | ')} |`);
}

lines.push('', '## Failed checks', '');
for (const m of variants) {
  const failed = results[m.variant].filter((r) => !r.pass);
  lines.push(`### ${m.label}`, '');
  if (!failed.length) lines.push('None.', '');
  for (const r of failed) {
    for (const c of r.checks.filter((x) => !x.ok)) lines.push(`- ${r.scenario} r${r.rep}: ${c.name}${c.detail != null ? ` — got: ${String(c.detail).slice(0, 160)}` : ''}`);
  }
  if (failed.length) lines.push('');
}

writeFileSync(new URL('./summary.md', import.meta.url), lines.join('\n') + '\n');
console.log(lines.slice(0, 6 + variants.length).join('\n'));
