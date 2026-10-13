// Programmatic grading of one model response: the extracted fields and the format of the draft
// reply. What only a reader can tell about the draft is left to the judges (eval/judge.mjs).
import { parseAndValidate } from './validate.mjs';
import { isHot } from './lead.mjs';

export const BOOKING_LINK = 'https://copperlinedigital.example/call';
export const SIGNATURE = 'Megan Torres';

// Metric ids in report order; the first binary one is the headline.
export const METRICS = [
  { id: 'all_fields', label: 'All fields', kind: 'binary' },
  { id: 'category', label: 'Category', kind: 'binary' },
  { id: 'services', label: 'Services', kind: 'binary' },
  { id: 'urgency', label: 'Urgency', kind: 'binary' },
  { id: 'budget', label: 'Budget', kind: 'binary' },
  { id: 'contact', label: 'Contact', kind: 'binary' },
  { id: 'language', label: 'Language', kind: 'binary' },
  { id: 'needs_review', label: 'Needs review', kind: 'binary' },
  { id: 'reply', label: 'Reply present', kind: 'binary' },
  { id: 'draft_format', label: 'Draft format', kind: 'binary' },
];

// --- normalization -----------------------------------------------------------

const stripMarks = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
const blank = (v) => v === null || v === undefined || String(v).trim() === '';

function normName(s) {
  return stripMarks(String(s).toLowerCase())
    .replace(/\b(dr|mr|mrs|ms|prof)\b\.?/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normCompany(s) {
  return stripMarks(String(s).toLowerCase())
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\b(co|company|inc|llc|ltd|corp|gmbh)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normPhone(s) {
  const digits = String(s).replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}

const normEmail = (s) => String(s).trim().toLowerCase();

// Gold may be one value or a list of accepted values; null means "must be empty".
function matches(gold, pred, norm) {
  const accepted = Array.isArray(gold) ? gold : [gold];
  return accepted.some((g) => (g === null ? blank(pred) : !blank(pred) && norm(g) === norm(pred)));
}

// --- checks --------------------------------------------------------------------

function gradeServices(expected, pred) {
  const got = new Set(pred ?? []);
  const required = new Set(expected.services);
  const allowed = new Set([...expected.services, ...(expected.services_optional ?? [])]);
  const missing = [...required].filter((s) => !got.has(s));
  const extra = [...got].filter((s) => !allowed.has(s));
  return { ok: missing.length === 0 && extra.length === 0, why: `missing [${missing}] extra [${extra}]` };
}

function gradeBudget(gold, pred) {
  const same = (a, b) => (a === null ? b === null : b !== null && Number(a) === Number(b));
  const currency = gold.currency === null ? blank(pred?.currency) : String(pred?.currency).toUpperCase() === gold.currency;
  const ok = !!pred && same(gold.min, pred.min) && same(gold.max, pred.max) && currency && gold.period === pred.period;
  return { ok, why: `got ${JSON.stringify(pred)}` };
}

function gradeContact(gold, pred) {
  const c = pred ?? {};
  const parts = {
    name: matches(gold.name, c.name, normName),
    email: matches(gold.email, c.email, normEmail),
    phone: matches(gold.phone, c.phone, normPhone),
    company: matches(gold.company, c.company, normCompany),
  };
  const wrong = Object.keys(parts).filter((k) => !parts[k]);
  return { ok: wrong.length === 0, why: wrong.length ? `wrong ${wrong.join(', ')}: ${JSON.stringify(c)}` : '' };
}

function checkDraftFormat(input, reply) {
  const problems = [];
  const body = reply.body ?? '';
  const words = body.split(/\s+/).filter(Boolean).length;
  if (!body.includes(BOOKING_LINK)) problems.push('no booking link');
  if (!body.includes(SIGNATURE)) problems.push('no signature');
  if (/\*\*|^#{1,6} |\]\(http/m.test(body)) problems.push('markdown');
  // The prompt asks for 80-180 words; allow a little slack either way.
  if (words < 70 || words > 200) problems.push(`${words} words`);
  const subject = (reply.subject ?? '').trim();
  if (input.channel === 'email') {
    // "Re: " plus the original subject. A subject that already starts with "Re:" keeps a single one,
    // and a forwarded lead is answered on the sender's own subject, without "Fwd:".
    const base = (s) => s.trim().replace(/^((re|fwd?|fw)\s*:\s*)+/i, '').toLowerCase();
    if (!/^re:/i.test(subject) || base(subject) !== base(input.subject)) problems.push(`subject "${subject}"`);
  } else if (!subject) problems.push('empty subject');
  return { ok: problems.length === 0, why: problems.join('; ') };
}

// Lead / hot flags for the set-level precision and recall in summarize.mjs.
function flags(expected, pred) {
  const goldLead = Array.isArray(expected.category) ? null : expected.category === 'sales_lead';
  return {
    gold_lead: goldLead,
    pred_lead: pred?.category === 'sales_lead',
    gold_hot: goldLead ? isHot(expected) : goldLead === false ? false : null,
    pred_hot: pred ? isHot(pred) : false,
  };
}

// --- entry point -----------------------------------------------------------------

// `run` is the model call result ({ text, stop_reason, ... }). Returns { grade, explanation, meta };
// meta.reply carries a draft the judges should read.
export function gradeCase(testCase, run, schema) {
  const expected = testCase.expected;
  const isLead = !Array.isArray(expected.category) && expected.category === 'sales_lead';
  const parsed = parseAndValidate(run.text, schema);
  const grade = {};
  const explanation = {};
  const set = (id, result) => {
    grade[id] = result.ok ? 1 : 0;
    if (!result.ok && result.why) explanation[id] = result.why;
  };

  if (!parsed.ok || run.stop_reason !== 'end_turn') {
    // A refusal or a malformed answer is the model failing the case, not an infrastructure error:
    // every metric that applies to this case scores 0.
    const why = run.stop_reason !== 'end_turn' ? `stop_reason ${run.stop_reason}` : parsed.errors.join('; ');
    const applicable = ['all_fields', 'category'];
    if (isLead) applicable.push('services', 'urgency', 'budget', 'contact', 'language');
    if (expected.needs_review !== null) applicable.push('needs_review');
    if (expected.reply !== null) applicable.push('reply');
    if (isLead && expected.reply) applicable.push('draft_format');
    for (const id of applicable) grade[id] = 0;
    explanation.all_fields = `invalid output: ${why}`;
    return { grade, explanation, meta: { valid_output: false, ...flags(expected, null) } };
  }

  const pred = parsed.value;
  set('category', { ok: matches(expected.category, pred.category, String), why: `got ${pred.category}` });
  if (isLead) {
    set('services', gradeServices(expected, pred.services));
    set('urgency', { ok: matches(expected.urgency, pred.urgency, String), why: `got ${pred.urgency}` });
    set('budget', gradeBudget(expected.budget, pred.budget));
    set('contact', gradeContact(expected.contact, pred.contact));
    set('language', { ok: String(pred.language).toLowerCase().slice(0, 2) === expected.language, why: `got ${pred.language}` });
  }
  if (expected.needs_review !== null)
    set('needs_review', { ok: pred.needs_review === expected.needs_review, why: `got ${pred.needs_review}: ${pred.review_reason}` });
  const hasReply = !!pred.reply && !blank(pred.reply.body);
  if (expected.reply !== null) set('reply', { ok: hasReply === expected.reply, why: hasReply ? 'reply drafted' : 'no reply' });
  grade.all_fields = Object.values(grade).every((v) => v === 1) ? 1 : 0;

  const meta = { valid_output: true, ...flags(expected, pred) };
  if (isLead && expected.reply && hasReply) {
    set('draft_format', checkDraftFormat(testCase.input, pred.reply));
    meta.reply = { subject: pred.reply.subject, body: pred.reply.body };
  }
  return { grade, explanation, meta };
}
