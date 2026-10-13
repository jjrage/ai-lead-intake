// Compares the models run so far: quality, cost and latency per model, as markdown tables.
// Usage: node eval/summarize.mjs [--flow eval/runs]  ->  stdout and <flow>/summary.md
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const flowArg = process.argv.indexOf('--flow');
const flow = flowArg > -1 ? process.argv[flowArg + 1] : 'eval/runs';
const config = JSON.parse(readFileSync(new URL('./models.json', import.meta.url), 'utf8'));

const readJsonl = (p) =>
  existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);
const quantile = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

// Judge verdicts by (variant, case, rep): { claude: checks, gemini: checks }.
const verdicts = new Map();
for (const j of readJsonl(join(flow, 'judgments.jsonl'))) {
  const key = `${j.variant}\0${j.prompt_id}\0${j.rep}`;
  verdicts.set(key, { ...(verdicts.get(key) ?? {}), [j.judge]: j.checks });
}
const checkIds = [...new Set([...verdicts.values()].flatMap((v) => Object.values(v).flatMap((c) => Object.keys(c))))];

// Mean of a metric over cases (each case = mean over its reps), with a 95% interval across cases.
function caseMetric(rows, id) {
  const byCase = new Map();
  for (const r of rows) {
    const v = r.grade?.[id];
    if (typeof v !== 'number') continue;
    if (!byCase.has(r.prompt_id)) byCase.set(r.prompt_id, []);
    byCase.get(r.prompt_id).push(v);
  }
  const perCase = [...byCase.values()].map(mean);
  const m = mean(perCase);
  if (m == null) return { m: null, ci: null, n: 0 };
  const sd = Math.sqrt(mean(perCase.map((x) => (x - m) ** 2)) ?? 0);
  return { m, ci: (1.96 * sd) / Math.sqrt(perCase.length), n: perCase.length };
}

// Precision / recall over all (case, rep) rows for a gold/pred flag pair in row.details.
function precisionRecall(rows, gold, pred) {
  let tp = 0, fp = 0, fn = 0;
  for (const r of rows) {
    const g = r.details?.[gold];
    if (g == null) continue; // ambiguous cases are left out
    const p = !!r.details?.[pred];
    if (p && g) tp++;
    else if (p && !g) fp++;
    else if (!p && g) fn++;
  }
  return { p: tp + fp ? tp / (tp + fp) : null, r: tp + fn ? tp / (tp + fn) : null };
}

const lines = [];
const fieldIds = ['category', 'services', 'urgency', 'budget', 'contact', 'language', 'needs_review', 'reply'];
const main = [
  '| Model | All fields correct | Lead P / R | Hot P / R | Draft checks passed | Draft format | Invalid | $ per lead | p50 / p90 s | Errors |',
  '|---|---|---|---|---|---|---|---|---|---|',
];
const fields = [`| Model | ${fieldIds.join(' | ')} |`, `|---|${fieldIds.map(() => '---').join('|')}|`];
const checks = [`| Model | ${checkIds.join(' | ')} |`, `|---|${checkIds.map(() => '---').join('|')}|`];
let modelCost = 0, agree = 0, compared = 0;

for (const entry of config.models) {
  const dir = join(flow, entry.variant);
  const rows = readJsonl(join(dir, 'results.jsonl')).filter((r) => r.status == null || r.status === 'ok');
  const errors = readJsonl(join(dir, 'errors.jsonl'));
  if (!rows.length) continue;

  // Draft score per run: share of passed checks across both judges.
  const checkPasses = Object.fromEntries(checkIds.map((id) => [id, []]));
  for (const r of rows) {
    const v = verdicts.get(`${entry.variant}\0${r.prompt_id}\0${r.rep}`);
    if (!v) continue;
    const passes = Object.values(v).flatMap((c) => Object.values(c).map((x) => (x.pass ? 1 : 0)));
    r.grade.draft = mean(passes);
    for (const c of Object.values(v)) for (const [id, x] of Object.entries(c)) checkPasses[id]?.push(x.pass ? 1 : 0);
    if (v.claude && v.gemini)
      for (const id of Object.keys(v.claude)) { compared++; if (v.claude[id].pass === v.gemini[id]?.pass) agree++; }
  }

  const all = caseMetric(rows, 'all_fields');
  const lead = precisionRecall(rows, 'gold_lead', 'pred_lead');
  const hot = precisionRecall(rows, 'gold_hot', 'pred_hot');
  const invalid = rows.filter((r) => r.details?.valid_output === false).length;
  const cost = mean(rows.map((r) => r.cost_usd).filter((x) => typeof x === 'number'));
  const lat = rows.map((r) => r.latency_s).filter((x) => typeof x === 'number');
  modelCost += rows.reduce((a, r) => a + (r.cost_usd ?? 0), 0);
  const cases = new Set(rows.map((r) => r.prompt_id)).size;
  main.push(
    `| ${entry.label} | ${pct(all.m)} ± ${Math.round(all.ci * 100)} | ${pct(lead.p)} / ${pct(lead.r)} | ${pct(hot.p)} / ${pct(hot.r)} ` +
      `| ${pct(caseMetric(rows, 'draft').m)} | ${pct(caseMetric(rows, 'draft_format').m)} | ${invalid}/${rows.length} ` +
      `| $${cost?.toFixed(4)} | ${quantile(lat, 0.5)?.toFixed(1)} / ${quantile(lat, 0.9)?.toFixed(1)} | ${errors.length} |`,
  );
  fields.push(`| ${entry.label} | ${fieldIds.map((id) => pct(caseMetric(rows, id).m)).join(' | ')} |`);
  if (checkIds.length) checks.push(`| ${entry.label} | ${checkIds.map((id) => pct(mean(checkPasses[id]))).join(' | ')} |`);
  lines.push(`- ${entry.label}: ${cases} cases, ${rows.length} scored runs, ${errors.length} failed attempts`);
}

const judges = config.judges.map((j) => j.label).join(' and ');
const out = [
  `# Model comparison (${flow})`,
  '',
  ...main,
  '',
  'Per-field accuracy (share of cases, each case averaged over its runs):',
  '',
  ...fields,
  '',
  ...(checkIds.length
    ? [`Draft checks passed, both judges pooled (${judges}; judges agree on ${pct(compared ? agree / compared : null)} of checks):`, '', ...checks, '']
    : []),
  ...lines,
  '',
  `API spend on the models under test: $${modelCost.toFixed(2)}. Judges run on CLI subscriptions.`,
  '',
  '"± N" is the 95% interval across cases in percentage points. Lead and hot precision/recall are over all runs.',
  'Cost is per call at list price with a cold prompt cache.',
].join('\n');

console.log(out);
writeFileSync(join(flow, 'summary.md'), out + '\n');
