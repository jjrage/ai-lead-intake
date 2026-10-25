// Connects the demo's Facebook Page and its Instagram account to the Meta app, once (safe to repeat):
//   node scripts/meta-setup.mjs [--profile agave-lane]
// Reads META_SYSTEM_TOKEN from .env (a system user token with the Page and the Instagram account
// assigned), then:
//   1. finds the Page and writes its Page token to .env as META_PAGE_TOKEN (a Page token taken with a
//      system user token never expires); `node scripts/vps.mjs env` copies it to the server;
//   2. subscribes the Page to the app, so Messenger and Instagram events reach the webhooks the
//      Messenger in / Instagram in workflows register;
//   3. sets the chat welcome from the business profile: a greeting on Messenger and the profile's
//      conversation starters (assistant.starters) on Messenger and Instagram;
//   4. checks that the Instagram account allows access to its messages.
// Tokens are never printed.
import { readFileSync, writeFileSync } from 'node:fs';

const GRAPH = 'https://graph.facebook.com/v25.0';
const i = process.argv.indexOf('--profile');
const profile = JSON.parse(readFileSync(new URL(`../profiles/${i > 0 ? process.argv[i + 1] : 'agave-lane'}.json`, import.meta.url), 'utf8'));
const envUrl = new URL('../.env', import.meta.url);
let envText = readFileSync(envUrl, 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2]]));
if (!env.META_SYSTEM_TOKEN) throw new Error('META_SYSTEM_TOKEN is empty in .env');

async function graph(method, path, token, body) {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (json.error) throw new Error(`${method} ${path}: ${json.error.message}`);
  return json;
}
const step = async (label, fn) => {
  try { console.log(`ok    ${label}${(await fn()) ?? ''}`); } catch (e) { console.log(`FAIL  ${label}: ${e.message}`); }
};

// 1. The Page and its token.
const { data: pages } = await graph('GET', '/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}', env.META_SYSTEM_TOKEN);
const page = pages.length === 1 ? pages[0] : pages.find((p) => p.name.startsWith(profile.business.name));
if (!page) throw new Error(`no Page for "${profile.business.name}" among the system user's Pages: ${pages.map((p) => p.name).join(', ') || 'none'}`);
const ig = page.instagram_business_account;
console.log(`Page ${page.name} (${page.id}); Instagram ${ig ? `@${ig.username} (${ig.id})` : 'not linked'}`);
envText = /^META_PAGE_TOKEN=.*$/m.test(envText) ? envText.replace(/^META_PAGE_TOKEN=.*$/m, `META_PAGE_TOKEN=${page.access_token}`) : `${envText.trimEnd()}\nMETA_PAGE_TOKEN=${page.access_token}\n`;
writeFileSync(envUrl, envText);
console.log('ok    META_PAGE_TOKEN written to .env');
const token = page.access_token;

// 2. Page events for the app: messages, starter taps and Lead Ads form submissions.
await step('Page subscribed to the app (messages, messaging_postbacks, leadgen)', () =>
  graph('POST', `/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,leadgen`, token).then(() => null));

// A Lead Ads instant form (used without an ad: test leads go through it). The lead says what they
// want with the profile's intents, so the assistant's first message can skip that question.
const formName = `${profile.business.name} home search`;
await step(`Lead form "${formName}"`, async () => {
  const { data: forms } = await graph('GET', `/${page.id}/leadgen_forms?fields=id,name,status&limit=100`, token);
  const have = forms.find((f) => f.name === formName && f.status === 'ACTIVE');
  if (have) return ` (${have.id}, exists)`;
  const site = `https://${env.PUBLIC_HOST || '148-113-241-86.sslip.io'}`;
  const form = await graph('POST', `/${page.id}/leadgen_forms`, token, {
    name: formName,
    locale: 'EN_US',
    questions: [
      { type: 'CUSTOM', key: 'intent', label: 'What can we help you with?', options: Object.entries(profile.intents).map(([key, v]) => ({ key, value: v.label })) },
      { type: 'FULL_NAME' },
      { type: 'EMAIL' },
      { type: 'PHONE' },
    ],
    privacy_policy: { url: `${site}/privacy`, link_text: 'Privacy policy' },
    follow_up_action_url: site,
    thank_you_page: { title: 'Thanks! We will message you shortly.', body: `${profile.assistant.name}, our virtual assistant, will text you in a minute.`, button_type: 'VIEW_WEBSITE', button_text: 'Visit website', website_url: site },
  });
  return ` (${form.id}, created)`;
});

// 3. Welcome: greeting and conversation starters (a tapped starter arrives as a postback with its text).
const starters = (profile.assistant.starters ?? []).slice(0, 4);
const iceBreakers = [{ locale: 'default', call_to_actions: starters.map((question) => ({ question, payload: 'starter' })) }];
const greeting = `Hi {{user_first_name}}! I'm ${profile.assistant.intro}.${profile.business.fictional ? ' This is a demo business for a portfolio project.' : ''}`;
await step('Messenger greeting and conversation starters', () =>
  graph('POST', '/me/messenger_profile', token, { greeting: [{ locale: 'default', text: greeting.slice(0, 160) }], ice_breakers: iceBreakers }).then(() => null));
if (ig) {
  await step('Instagram conversation starters', () =>
    graph('POST', '/me/messenger_profile?platform=instagram', token, { platform: 'instagram', ice_breakers: iceBreakers }).then(() => null));
  // 4. Fails until Instagram > Settings > Messages and story replies > Message controls > Connected
  //    tools > Allow access to messages is on.
  await step('Instagram messages readable', () =>
    graph('GET', `/${page.id}/conversations?platform=instagram&limit=1`, token).then((r) => ` (${r.data.length ? 'has conversations' : 'no conversations yet'})`));
}
