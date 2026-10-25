// Sends a test lead through the demo's Lead Ads form (no ad needed), like a person submitting it:
//   node scripts/lead-test.mjs "Jordan Avery" jordan@example.com +16025550142 [buy|sell|rent|invest]
// Meta keeps one test lead per form, so an earlier one is deleted first. Uses META_PAGE_TOKEN from .env.
import { readFileSync } from 'node:fs';

const GRAPH = 'https://graph.facebook.com/v25.0';
const FORM_NAME = 'Agave Lane Realty home search';  // created by scripts/meta-setup.mjs
const [name, email, phone, intent = 'buy'] = process.argv.slice(2);
if (!name || !email || !phone) throw new Error('usage: node scripts/lead-test.mjs "Full Name" email +phone [intent]');
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2]]));

async function graph(method, path, body) {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set('access_token', env.META_PAGE_TOKEN);
  // Meta sometimes answers "Service temporarily unavailable" (seen on DELETE of a test lead): try again.
  // That DELETE has often gone through anyway: on a retry, "does not exist" means it is gone.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json();
    if (!json.error) return json;
    if (method === 'DELETE' && attempt > 1 && /does not exist/i.test(json.error.message)) return { success: true };
    if (!/temporarily unavailable/i.test(json.error.message) || attempt === 5) throw new Error(`${method} ${path}: ${json.error.message}`);
    console.log(`${method} ${path}: ${json.error.message}, trying again`);
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }
}

const { id: pageId } = await graph('GET', '/me?fields=id');
const { data: forms } = await graph('GET', `/${pageId}/leadgen_forms?fields=id,name,status&limit=100`);
const form = forms.find((f) => f.name === FORM_NAME && f.status === 'ACTIVE');
if (!form) throw new Error(`no active form "${FORM_NAME}": run node scripts/meta-setup.mjs`);
for (const old of (await graph('GET', `/${form.id}/test_leads`)).data) await graph('DELETE', `/${old.id}`);
const lead = await graph('POST', `/${form.id}/test_leads`, { field_data: [
  { name: 'intent', values: [intent] },
  { name: 'full_name', values: [name] },
  { name: 'email', values: [email] },
  { name: 'phone_number', values: [phone] },
] });
console.log(`lead ${lead.id} sent through form ${form.id}`);
