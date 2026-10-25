// Submits the WhatsApp templates the assistant uses when a lead's last message is more than 24 hours
// old (WhatsApp then accepts only approved templates), and prints their review status. Safe to repeat:
// existing templates are left as they are.
//   node scripts/wa-templates.mjs
// The texts match touchMessage() in core/assistant.mjs and the lead-form reply in Send message.
import { readFileSync } from 'node:fs';

const GRAPH = 'https://graph.facebook.com/v25.0';
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2]]));
const buttons = (...texts) => ({ type: 'BUTTONS', buttons: texts.map((text) => ({ type: 'QUICK_REPLY', text })) });

const TEMPLATES = [
  {
    name: 'lead_form_followup',
    category: 'UTILITY',
    components: [{ type: 'BODY', text: 'Hi {{1}}, thanks for your request through our Facebook form. {{2}}\n\nJust reply to this message to continue.', example: { body_text: [['Jordan', "I'm Ava, the virtual assistant at Agave Lane Realty. Which area are you looking to buy in?"]] } }],
  },
  {
    name: 'appointment_reminder',
    category: 'UTILITY',
    components: [
      { type: 'BODY', text: 'Hi {{1}}, this is a reminder about your {{2}} with {{3}}: {{4}}. If you need another time, just reply to this message.', example: { body_text: [['Alex', 'Buyer consultation call', 'Maya Torres', 'tomorrow at 10:00 AM (MST)']] } },
      buttons("I'll be there", 'Change the time', 'Cancel it'),
    ],
  },
  {
    name: 'appointment_missed',
    category: 'UTILITY',
    components: [
      { type: 'BODY', text: 'Hi {{1}}, sorry we missed you for your {{2}} with {{3}}. Would you like to pick another time? Just reply to this message.', example: { body_text: [['Alex', 'Buyer consultation call', 'Maya Torres']] } },
      buttons('Pick another time', 'Not now'),
    ],
  },
  {
    name: 'lead_check_in',
    category: 'MARKETING',
    components: [
      { type: 'BODY', text: "Hi {{1}}, it's Ava from Agave Lane Realty. Are you still looking for help with {{2}}? Just reply to this message and I'll pick up where we left off.", example: { body_text: [['Alex', 'buying a home in Chandler']] } },
      buttons('Still looking', 'Not now', 'Stop'),
    ],
  },
];

async function graph(method, path, body) {
  const res = await fetch(`${GRAPH}${path}`, { method, headers: { authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (json.error) throw new Error(`${method} ${path}: ${json.error.error_user_msg ?? json.error.message}`);
  return json;
}

const { data: existing } = await graph('GET', `/${env.WHATSAPP_WABA_ID}/message_templates?fields=name,status,category,rejected_reason&limit=100`);
for (const t of TEMPLATES) {
  const have = existing.find((e) => e.name === t.name);
  if (have) { console.log(`${t.name}: ${have.status} (${have.category})${have.rejected_reason && have.rejected_reason !== 'NONE' ? `, ${have.rejected_reason}` : ''}`); continue; }
  try {
    const r = await graph('POST', `/${env.WHATSAPP_WABA_ID}/message_templates`, { name: t.name, language: 'en_US', category: t.category, components: t.components });
    console.log(`${t.name}: submitted, ${r.status} (${r.category})`);
  } catch (e) {
    console.log(`${t.name}: FAILED ${e.message}`);
  }
}
