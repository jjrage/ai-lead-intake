// Offline check of the grader, no API calls: the expected answers must score 100% and
// degenerate answers (empty output, "everything is spam", "everything is a lead") must not.
// Usage: node eval/selftest.mjs
import { readFileSync } from 'node:fs';
import { gradeCase, BOOKING_LINK } from './lib/grade.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const cases = JSON.parse(read('./cases.json'));
const schema = JSON.parse(read('../prompts/lead-intake.schema.json'));
const first = (v) => (Array.isArray(v) ? v[0] : v);

const filler = 'We would be glad to learn more about your goals and how we can help. '.repeat(8);

function oracle(c) {
  const e = c.expected;
  const lead = e.category === 'sales_lead';
  const subject = c.input.channel === 'email' ? `Re: ${c.input.subject}` : 'Your inquiry';
  return {
    summary: 'oracle',
    category: first(e.category),
    services: lead ? e.services : [],
    urgency: lead ? first(e.urgency) : 'unknown',
    budget: lead ? e.budget : { min: null, max: null, currency: null, period: 'unknown' },
    contact: lead
      ? { name: first(e.contact.name), email: e.contact.email, phone: e.contact.phone, company: first(e.contact.company) }
      : { name: null, email: null, phone: null, company: null },
    language: lead ? e.language : 'en',
    needs_review: e.needs_review ?? false,
    review_reason: null,
    reply: e.reply ? { subject, body: `Hi,\n\n${filler}\n\nBook a call: ${BOOKING_LINK}\n\nMegan Torres, Client Partner, Copperline Digital` } : null,
  };
}

const constant = (category) => () => ({
  summary: '', category, services: [], urgency: 'unknown',
  budget: { min: null, max: null, currency: null, period: 'unknown' },
  contact: { name: null, email: null, phone: null, company: null },
  language: 'en', needs_review: false, review_reason: null, reply: null,
});

async function score(label, make) {
  let allFields = 0, draftFormat = 0, draftN = 0;
  for (const c of cases) {
    const out = make(c);
    const run = { text: typeof out === 'string' ? out : JSON.stringify(out), stop_reason: 'end_turn' };
    const g = await gradeCase(c, run, schema, []);
    allFields += g.grade.all_fields;
    if ('draft_format' in g.grade) { draftN++; draftFormat += g.grade.draft_format; }
    if (label === 'oracle' && g.grade.all_fields !== 1) console.log(`  oracle fails ${c.id}:`, g.explanation);
  }
  console.log(`${label.padEnd(18)} all_fields ${allFields}/${cases.length}` + (draftN ? `, draft_format ${draftFormat}/${draftN}` : ''));
  return allFields;
}

const o = await score('oracle', oracle);
const nulls = [
  await score('empty output', () => ''),
  await score('always spam', constant('spam')),
  await score('always sales_lead', constant('sales_lead')),
];
const ok = o === cases.length && nulls.every((n) => n <= cases.length / 3);
console.log(ok ? 'grader self-test passed' : 'grader self-test FAILED');
process.exit(ok ? 0 : 1);
