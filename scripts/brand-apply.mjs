// Puts the brand avatar (brand/avatar-1024.png, from brand/render.mjs) on the business's WhatsApp
// profile and, when it can, on the Facebook Page (which takes a public image URL):
//   node scripts/brand-apply.mjs [https://…/avatar-1024.png]
// Telegram, Instagram and the Slack app take the image only in their own apps (see docs).
import { readFileSync } from 'node:fs';

const GRAPH = 'https://graph.facebook.com/v25.0';
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2]]));
const image = readFileSync(new URL('../brand/avatar-1024.png', import.meta.url));
const publicUrl = process.argv[2];

async function step(label, fn) {
  try { console.log(`ok    ${label}${(await fn()) ?? ''}`); } catch (e) { console.log(`FAIL  ${label}: ${e.message}`); }
}
async function json(res) {
  const j = await res.json();
  if (j.error) throw new Error(j.error.error_user_msg ?? j.error.message);
  return j;
}

// WhatsApp: a resumable upload to the app gives a handle, which the business profile takes.
await step('WhatsApp profile photo', async () => {
  const token = env.WHATSAPP_ACCESS_TOKEN;
  const session = await json(await fetch(`${GRAPH}/${env.META_APP_ID}/uploads?file_name=avatar.png&file_length=${image.length}&file_type=image/png&access_token=${encodeURIComponent(token)}`, { method: 'POST' }));
  const { h } = await json(await fetch(`${GRAPH}/${session.id}`, { method: 'POST', headers: { authorization: `OAuth ${token}`, file_offset: '0' }, body: image }));
  await json(await fetch(`${GRAPH}/${env.WHATSAPP_PHONE_NUMBER_ID}/whatsapp_business_profile`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', profile_picture_handle: h }),
  }));
});

if (publicUrl) {
  await step('Facebook Page picture', async () => {
    const { id } = await json(await fetch(`${GRAPH}/me?fields=id&access_token=${encodeURIComponent(env.META_PAGE_TOKEN)}`));
    await json(await fetch(`${GRAPH}/${id}/picture?picture=${encodeURIComponent(publicUrl)}&access_token=${encodeURIComponent(env.META_PAGE_TOKEN)}`, { method: 'POST' }));
  });
}
