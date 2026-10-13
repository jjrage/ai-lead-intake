// Renders one page for checking the grading by eye: for every case and model, the extracted
// fields against the expected ones, the grader's complaints, the draft reply and the judges' verdicts.
// Usage: node eval/render-review.mjs [--flow eval/pilot] [--rep 0]  ->  eval/out/review.html
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const flow = opt('--flow', 'eval/pilot');
const rep = Number(opt('--rep', 0));
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const config = JSON.parse(read('./models.json'));
const cases = JSON.parse(read('./cases.json'));
const readJsonl = (p) =>
  existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const verdicts = new Map();
for (const j of readJsonl(join(flow, 'judgments.jsonl'))) {
  if (j.rep !== rep) continue;
  const key = `${j.variant}\0${j.prompt_id}`;
  verdicts.set(key, [...(verdicts.get(key) ?? []), j]);
}
const judgeLabel = Object.fromEntries(config.judges.map((j) => [j.id, j.label]));

function modelBlock(entry, testCase) {
  const row = readJsonl(join(flow, entry.variant, 'results.jsonl')).find((r) => r.prompt_id === testCase.id && r.rep === rep);
  if (!row) return '';
  const trace = join(flow, entry.variant, 'traces', `${testCase.id}_rep${rep}.json`);
  let out = null;
  try { out = JSON.parse(JSON.parse(readFileSync(trace, 'utf8')).at(-1).content.replace(/^```json\n|\n```$/g, '')); } catch {}
  const grades = Object.entries(row.grade)
    .map(([id, v]) => `<span class="${v === 1 ? 'ok' : 'bad'}">${esc(id)}</span>`)
    .join(' ');
  const why = Object.entries(row.explanation ?? {}).map(([id, t]) => `<li><b>${esc(id)}</b>: ${esc(t)}</li>`).join('');
  const fields = out
    ? `category ${esc(out.category)} · services ${esc((out.services ?? []).join(', ') || 'none')} · urgency ${esc(out.urgency)} · ` +
      `budget ${esc(JSON.stringify(out.budget))} · review ${esc(out.needs_review)}${out.review_reason ? ` (${esc(out.review_reason)})` : ''}`
    : '<span class="bad">no parsable output</span>';
  const judged = (verdicts.get(`${entry.variant}\0${testCase.id}`) ?? [])
    .map((j) => {
      const failed = Object.entries(j.checks).filter(([, c]) => !c.pass);
      return `<li><b>${esc(judgeLabel[j.judge] ?? j.judge)}</b>: ${failed.length ? failed.map(([id, c]) => `<span class="bad">${esc(id)}</span> ${esc(c.reason)}`).join('; ') : '<span class="ok">all checks passed</span>'}</li>`;
    })
    .join('');
  const draft = row.details?.reply ? `<pre>Subject: ${esc(row.details.reply.subject)}\n\n${esc(row.details.reply.body)}</pre>` : '';
  return `<div class="model"><h3>${esc(entry.label)} <small>$${row.cost_usd?.toFixed(4)} · ${row.latency_s?.toFixed(1)}s</small></h3>
  <p class="grades">${grades}</p><p class="fields">${fields}</p>${why ? `<ul>${why}</ul>` : ''}${draft}${judged ? `<ul class="judges">${judged}</ul>` : ''}</div>`;
}

const ran = new Set(config.models.flatMap((m) => readJsonl(join(flow, m.variant, 'results.jsonl')).map((r) => r.prompt_id)));
const sections = cases
  .filter((c) => ran.has(c.id))
  .map((c) => `<section><h2>${esc(c.id)}</h2><p class="note">${esc(c.note)}</p>${config.models.map((m) => modelBlock(m, c)).join('')}</section>`)
  .join('\n');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lead intake eval: grading review</title>
<style>
:root { --bg:#fafaf8; --fg:#1d1d1b; --muted:#6b6b66; --card:#fff; --line:#e3e2dc; --ok:#1e7a3c; --bad:#b3261e; --pre:#f4f3ef; }
@media (prefers-color-scheme: dark) { :root { --bg:#161615; --fg:#ecebe6; --muted:#9d9c95; --card:#1f1f1d; --line:#34332f; --ok:#7fd49a; --bad:#ff8a80; --pre:#262624; } }
body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui, sans-serif; }
main { max-width:1100px; margin:0 auto; padding:24px 16px 64px; }
section { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; margin:16px 0; }
h2 { font-size:17px; margin:0; } h3 { font-size:15px; margin:12px 0 4px; } small { color:var(--muted); font-weight:400; }
.note { color:var(--muted); margin:4px 0 8px; } .model { border-top:1px solid var(--line); }
.ok { color:var(--ok); } .bad { color:var(--bad); font-weight:600; } .grades span { margin-right:8px; font-size:13px; }
.fields { font-size:13px; color:var(--muted); margin:4px 0; } ul { margin:4px 0; padding-left:20px; font-size:14px; }
pre { background:var(--pre); border-radius:8px; padding:10px; white-space:pre-wrap; word-break:break-word; font-size:13px; }
</style></head><body><main><h1>Grading review: ${esc(flow)}, run ${rep}</h1>${sections}</main></body></html>`;

mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/review.html', import.meta.url), html);
console.log('Wrote eval/out/review.html');
