// Recomputes the programmatic grades of every run in a flow from the saved transcripts, without
// calling any model. Use after a grader fix so all models are scored by the same grader.
// Usage: node eval/regrade.mjs [--flow eval/runs]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gradeCase } from './lib/grade.mjs';

const flowArg = process.argv.indexOf('--flow');
const flow = flowArg > -1 ? process.argv[flowArg + 1] : 'eval/runs';
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const schema = JSON.parse(read('../prompts/lead-intake.schema.json'));
const config = JSON.parse(read('./models.json'));
const cases = new Map(JSON.parse(read('./cases.json')).map((c) => [c.id, c]));

for (const entry of config.models) {
  const path = join(flow, entry.variant, 'results.jsonl');
  if (!existsSync(path)) continue;
  let changed = 0, missing = 0;
  const rows = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  for (const row of rows) {
    const trace = join(flow, entry.variant, 'traces', `${row.prompt_id}_rep${row.rep}.json`);
    if (!existsSync(trace)) { missing++; continue; }
    // The runner stores the model's answer as the last turn, inside a json code fence.
    const text = JSON.parse(readFileSync(trace, 'utf8')).at(-1).content.replace(/^```json\n|\n```$/g, '');
    const g = gradeCase(cases.get(row.prompt_id), { text, stop_reason: row.stop_reason }, schema);
    if (JSON.stringify(g.grade) !== JSON.stringify(row.grade)) changed++;
    Object.assign(row, { grade: g.grade, explanation: g.explanation, details: g.meta });
  }
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`${entry.variant} (${entry.model}): ${rows.length} rows, ${changed} regraded` + (missing ? `, ${missing} without a transcript` : ''));
}
