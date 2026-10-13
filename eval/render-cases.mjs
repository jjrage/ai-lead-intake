// Renders eval/cases.json as an HTML page for reviewing the inputs and expected answers.
// Usage: node eval/render-cases.mjs  ->  eval/out/cases.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatLead, isHot, HOT_MIN_BUDGET_USD } from './lib/lead.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(here, 'cases.json'), 'utf8'));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const show = (v) => (v === null || v === undefined ? '<span class="null">null</span>' : esc(v));
const alts = (v) => (Array.isArray(v) ? v.map(show).join(' <span class="or">or</span> ') : show(v));

function budget(b) {
  if (b.period === 'unknown') return '<span class="null">none stated</span>';
  const range = b.min === b.max ? show(b.min) : `${show(b.min)} to ${show(b.max)}`;
  return `${range} ${esc(b.currency)}, ${esc(b.period)}`;
}

function expectedRows(e) {
  const rows = [['category', alts(e.category)]];
  if (e.services) {
    const optional = e.services_optional?.length ? ` <span class="opt">optional: ${e.services_optional.map(esc).join(', ')}</span>` : '';
    rows.push(
      ['services', (e.services.length ? e.services.map(esc).join(', ') : '<span class="null">none</span>') + optional],
      ['urgency', alts(e.urgency)],
      ['budget', budget(e.budget)],
      ['name', alts(e.contact.name)],
      ['email', show(e.contact.email)],
      ['phone', show(e.contact.phone)],
      ['company', alts(e.contact.company)],
      ['language', esc(e.language)],
      ['hot', isHot(e) ? '<b class="hot">yes</b>' : 'no'],
    );
  }
  rows.push(
    ['needs_review', e.needs_review === null ? '<span class="null">not graded</span>' : String(e.needs_review)],
    ['reply', e.reply === null ? '<span class="null">not graded</span>' : e.reply ? 'draft expected' : 'null'],
  );
  return rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
}

const count = (key) =>
  Object.entries(cases.reduce((acc, c) => ((acc[key(c)] = (acc[key(c)] ?? 0) + 1), acc), {}))
    .map(([k, n]) => `${esc(k)} ${n}`)
    .join(' · ');

const cards = cases
  .map(
    (c) => `
<section class="case" id="${esc(c.id)}">
  <h2>${esc(c.id)} ${c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</h2>
  <p class="note">${esc(c.note)}</p>
  <div class="grid">
    <div><h3>What the model receives</h3><pre>${esc(formatLead(c.input))}</pre></div>
    <div><h3>Expected</h3><table>${expectedRows(c.expected)}</table></div>
  </div>
</section>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lead intake eval: cases</title>
<style>
:root { --bg:#fafaf8; --fg:#1d1d1b; --muted:#6b6b66; --card:#fff; --line:#e3e2dc; --tag:#eef0f4; --hot:#b3261e; --pre:#f4f3ef; }
@media (prefers-color-scheme: dark) { :root { --bg:#161615; --fg:#ecebe6; --muted:#9d9c95; --card:#1f1f1d; --line:#34332f; --tag:#2b2e35; --hot:#ff8a80; --pre:#262624; } }
body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui, sans-serif; }
main { max-width:1180px; margin:0 auto; padding:24px 16px 64px; }
h1 { font-size:24px; margin:0 0 8px; } h2 { font-size:16px; margin:0 0 4px; } h3 { font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin:0 0 6px; }
.summary, .case { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; margin:16px 0; }
.summary p { margin:4px 0; }
.tag { display:inline-block; background:var(--tag); border-radius:999px; padding:0 8px; margin-left:6px; font-size:12px; font-weight:500; }
.note { color:var(--muted); margin:0 0 12px; }
.grid { display:grid; grid-template-columns: minmax(0,1.4fr) minmax(0,1fr); gap:16px; }
@media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
pre { background:var(--pre); border-radius:8px; padding:12px; margin:0; white-space:pre-wrap; word-break:break-word; font-size:13px; }
table { border-collapse:collapse; width:100%; font-size:14px; }
th { text-align:left; color:var(--muted); font-weight:500; padding:3px 12px 3px 0; vertical-align:top; white-space:nowrap; }
td { padding:3px 0; word-break:break-word; }
.null, .or, .opt { color:var(--muted); font-style:italic; } .hot { color:var(--hot); }
</style></head>
<body><main>
<h1>Lead intake eval: ${cases.length} cases</h1>
<div class="summary">
  <p><b>By group:</b> ${count((c) => c.tags[0])}</p>
  <p><b>By expected category:</b> ${count((c) => (Array.isArray(c.expected.category) ? 'any of several' : c.expected.category))}</p>
  <p><b>By language:</b> ${count((c) => c.tags[1])} · <b>By channel:</b> ${count((c) => c.input.channel)}</p>
  <p><b>Hot leads:</b> ${cases.filter((c) => c.expected.services && isHot(c.expected)).length}.
     Rule: sales lead, urgency high, at least one service we offer, and no stated USD budget below
     $${HOT_MIN_BUDGET_USD.one_time.toLocaleString('en-US')} per project or $${HOT_MIN_BUDGET_USD.monthly.toLocaleString('en-US')} per month.
     Computed in code from the extracted fields, not decided by the model.</p>
  <p><b>Graded per case:</b> category, needs_review and whether a reply is drafted. For sales leads also services
     (optional ones may be listed or not), urgency, budget, contact (names without titles, phones by digits,
     alternatives accepted where shown) and language.</p>
</div>
${cards}
</main></body></html>`;

mkdirSync(join(here, 'out'), { recursive: true });
writeFileSync(join(here, 'out', 'cases.html'), html);
console.log(`Wrote eval/out/cases.html (${cases.length} cases)`);
