// Conversation logic shared by the n8n workflows (copied into Code nodes by the workflow
// generator) and by the conversation eval. No imports: every function here must run on its own
// inside an n8n Code node. Business details come from profiles/<id>.json, never from this file.

// Characters a channel accepts in one message.
// A Lead Ads reply goes inside a WhatsApp template, whose text is limited to 1024 characters.
const CHANNEL_LIMITS = { telegram: 4096, whatsapp: 4096, messenger: 2000, instagram: 1000, web_chat: 4000, email: 20000, lead_ads: 900 };

const CHANNEL_NAMES = { telegram: 'Telegram', whatsapp: 'WhatsApp', messenger: 'Facebook Messenger', instagram: 'Instagram Direct', web_chat: 'the chat on the website', email: 'email', web_form: 'the contact form on the website (your reply goes to their email)', lead_ads: 'a Facebook lead form (your reply goes to their WhatsApp)' };

// Carrier-style opt-out keywords: a whole message that is one of these always unsubscribes,
// whatever the model thinks.
const OPT_OUT_RE = /^\s*(stop|stop all|unsubscribe|cancel|end|quit|opt out|optout|baja|alto|parar)\s*[.!]*\s*$/i;

// Said when the model's answer can't be used; the conversation goes to the team.
const FALLBACK_REPLY = {
  en: 'Thanks for your message! A member of our team will get back to you here shortly.',
  es: '¡Gracias por tu mensaje! Alguien de nuestro equipo te responderá por aquí en breve.',
};

// Details the lead always types: no tap-to-answer buttons for these questions.
const TYPED_DETAILS = ['name', 'email', 'phone', 'contact'];

// The last button of every set: the lead taps it to type an answer of their own.
const OTHER_REPLY = { en: 'Other', es: 'Otro' };

// Channels that show tap-to-answer buttons (email and a WhatsApp template don't).
const BUTTON_CHANNELS = ['telegram', 'whatsapp', 'messenger', 'instagram', 'web_chat'];

// Detail keys the model fills: the profile's fields, with "contact" split into email and phone.
function profileFields(profile) {
  return [...Object.keys(profile.fields).filter((k) => k !== 'contact'), 'email', 'phone'];
}

// The JSON schema of one assistant turn, built from the profile so that each business gets
// exactly its own intents and fields.
function buildReplySchema(profile) {
  const nullable = { anyOf: [{ type: 'string' }, { type: 'null' }] };
  const facts = Object.fromEntries(profileFields(profile).map((k) => [k, nullable]));
  return {
    type: 'object',
    additionalProperties: false,
    required: ['language', 'intent', 'facts', 'is_hot', 'action', 'handoff_reason', 'injection', 'reply', 'asking', 'quick_replies', 'booking', 'slot', 'summary'],
    properties: {
      language: { type: 'string' },
      intent: { type: 'string', enum: [...Object.keys(profile.intents), 'other', 'unknown'] },
      facts: { type: 'object', additionalProperties: false, required: Object.keys(facts), properties: facts },
      is_hot: { type: 'boolean' },
      action: { type: 'string', enum: ['reply', 'handoff', 'opt_out'] },
      handoff_reason: nullable,
      injection: { type: 'boolean' },
      reply: { type: 'string' },
      // An enum, not nullable: Claude's structured outputs allow at most 16 union-typed fields.
      asking: { type: 'string', enum: [...new Set([...profileFields(profile), 'contact', 'meeting_time', 'none'])] },
      quick_replies: { type: 'array', items: { type: 'string' } },
      // The lead picked one of the offered meeting times (`slot` is its id), or cancels their booking.
      booking: { type: 'string', enum: ['none', 'book', 'cancel'] },
      slot: { type: 'string' },
      summary: { type: 'string' },
    },
  };
}

// The business section of the system prompt, in plain Markdown.
function renderProfile(profile) {
  const b = profile.business;
  const lines = [
    `- Name: ${b.name}, a ${b.kind} in ${b.city}.`,
    `- Areas served: ${b.areas.join(', ')}.`,
    `- Hours (${b.timezone}): ${Object.entries(b.hours).map(([d, h]) => `${d} ${h}`).join('; ')}.`,
    `- Languages: ${b.languages.join(', ')}.`,
    `- Office: ${b.office}.`,
    '- Team:',
    ...b.team.map((t) => `  - ${t.name}, ${t.role} (${t.languages.join('/')}), works with: ${t.handles.join(', ')}`),
  ];
  const intents = Object.entries(profile.intents).map(([k, v]) =>
    `- \`${k}\` (${v.label}): ${v.ask.map((f) => (f === 'contact' ? 'phone or email' : f)).join(', ')}`);
  const fields = Object.entries(profile.fields).filter(([k]) => k !== 'contact').map(([k, v]) => `- \`${k}\`: ${v}`);
  const faq = profile.faq.map((f) => `- Q: ${f.q}\n  A: ${f.a}`);
  return {
    PROFILE: lines.join('\n'),
    INTENTS: intents.join('\n'),
    FIELDS: [...fields, '- `email`: their email address, lower case', '- `phone`: their phone number as written'].join('\n'),
    FAQ: faq.join('\n'),
    NEVER: profile.never.map((s) => `- Never ${s}.`).join('\n'),
    HANDOFF: profile.handoff.map((s) => `- ${s}`).join('\n'),
    HOT: profile.hot_lead.map((s) => `- ${s}`).join('\n'),
  };
}

// Fills {{ASSISTANT}}, {{BUSINESS}}, {{PROFILE}}, ... in prompts/assistant.system.md.
function renderSystemPrompt(template, profile) {
  const values = {
    ASSISTANT: profile.assistant.intro,
    BUSINESS: profile.business.name,
    TONE: profile.assistant.tone,
    MAX_CHARS: String(profile.assistant.max_reply_chars),
    ...renderProfile(profile),
  };
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => values[k] ?? m);
}

// Wall-clock time in the business's time zone: the model is told the local time instead of
// converting time zones itself.
function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { weekday: get('weekday').toLowerCase(), date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

function formatLocal(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

// Opening hours on a weekday ('mon') as [open, close] minutes after midnight, or null when closed,
// from hours like { "mon-fri": "9:00-18:00", "sun": "closed" }.
function hoursOn(profile, weekday) {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const day = days.indexOf(weekday);
  for (const [span, hours] of Object.entries(profile.business.hours)) {
    const [from, to = from] = span.split('-').map((d) => days.indexOf(d));
    const inSpan = from <= to ? day >= from && day <= to : day >= from || day <= to;
    if (!inSpan || hours === 'closed') continue;
    return hours.split('-').map((t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; });
  }
  return null;
}

// Whether the office is open at `date`.
function isOpen(profile, date) {
  const now = localParts(date, profile.business.timezone);
  const hours = hoursOn(profile, now.weekday);
  return !!hours && now.minutes >= hours[0] && now.minutes < hours[1];
}

// The moment a wall-clock time ('2026-10-27', minutes after midnight) happens in a time zone.
function zonedTime(date, minutes, timeZone) {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  let t = wall;
  // Shift by the zone's offset; twice, in case the first guess fell across a daylight-saving change.
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(t), timeZone);
    const [py, pm, pd] = p.date.split('-').map(Number);
    t = wall - (Date.UTC(py, pm - 1, pd, 0, p.minutes) - t);
  }
  return new Date(t);
}

// ---- Booking a meeting ---------------------------------------------------------------------------

// The meeting for a request and who holds it: the intent's meeting type with a team member who
// handles the intent and has a calendar, preferring one who speaks the lead's language.
function meetingPlan(intent, language, profile) {
  const type = profile.intents[intent]?.meeting;
  const meeting = type ? profile.meetings?.[type] : null;
  if (!meeting) return null;
  const team = profile.business.team.filter((t) => t.handles.includes(intent) && t.calendar_id);
  const agent = team.find((t) => t.languages.includes(language)) ?? team[0];
  return agent ? { type, label: meeting.label, minutes: meeting.minutes, where: meeting.where, agent: agent.name, calendar_id: agent.calendar_id } : null;
}

// Whether to look up free times this turn: the lead has a booking, or their request has a meeting. This
// is decided before the model reads the turn, so the times are there whenever they are needed: when the
// lead gives the last details, asks for a call, or comes back after a team member. When to offer them is
// the prompt's rule ("Booking a meeting").
function bookingDue(contact, profile, current) {
  if (current) return true;
  return Boolean(profile.intents[contact.facts?.intent]?.meeting);
}

// A slot as a button shows it (20 characters at most): "Tomorrow 10:00 AM", "Tue, Oct 27 9:30 AM".
function slotLabel(date, now, timeZone, language) {
  const locale = language === 'es' ? 'es-US' : 'en-US';
  const words = language === 'es' ? ['Hoy', 'Mañana'] : ['Today', 'Tomorrow'];
  const day = localParts(date, timeZone).date;
  const relative = [localParts(now, timeZone).date, localParts(new Date(now.getTime() + 86400e3), timeZone).date].indexOf(day);
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: 'numeric', minute: '2-digit' }).format(date);
  // Spanish month names make "lun, 26 de oct" too long for a button: weekday and day only.
  const dayFormat = language === 'es' ? { weekday: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' };
  const name = relative >= 0 ? words[relative] : new Intl.DateTimeFormat(locale, { timeZone, ...dayFormat }).format(date);
  return `${name} ${time}`.replace(/[  ]/g, ' ');
}

// When the meeting could start, day by day: [{ date, weekday, ranges: [[from, to]] }] in minutes after
// midnight, local time, where `to` is the latest start. Same rules as freeSlots().
function freeWindows(busy, plan, profile, now) {
  const tz = profile.business.timezone;
  const rules = { min_notice_hours: 2, days_ahead: 7, step_minutes: 30, ...profile.booking };
  const taken = busy.map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()]);
  const earliest = now.getTime() + rules.min_notice_hours * 3600e3;
  const noon = zonedTime(localParts(now, tz).date, 12 * 60, tz).getTime();
  const days = [];
  for (let d = 0; d <= rules.days_ahead; d++) {
    const day = localParts(new Date(noon + d * 86400e3), tz);
    const hours = hoursOn(profile, day.weekday);
    if (!hours) continue;
    const ranges = [];
    for (let m = hours[0]; m + plan.minutes <= hours[1]; m += rules.step_minutes) {
      const start = zonedTime(day.date, m, tz).getTime();
      const free = start >= earliest && !taken.some(([a, b]) => start < b && start + plan.minutes * 60e3 > a);
      if (!free) continue;
      const last = ranges.at(-1);
      if (last && last[1] === m - rules.step_minutes) last[1] = m;
      else ranges.push([m, m]);
    }
    if (ranges.length) days.push({ date: day.date, weekday: day.weekday, ranges });
  }
  return days;
}

// A time the lead asked for ("2026-10-27T09:30", local) as a slot, if the meeting can start then.
function slotAt(id, windows, plan, profile, now, language) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(String(id ?? ''));
  if (!m) return null;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  const day = windows.find((w) => w.date === m[1]);
  if (!day?.ranges.some(([from, to]) => minutes >= from && minutes <= to)) return null;
  const tz = profile.business.timezone;
  const start = zonedTime(m[1], minutes, tz);
  return { id, start: start.toISOString(), end: new Date(start.getTime() + plan.minutes * 60e3).toISOString(), label: slotLabel(start, now, tz, language) };
}

// Times to offer for a meeting plan: within opening hours, at least min_notice_hours ahead, on a
// step_minutes grid, clear of busy periods ([{ start, end }] in ISO), one per day and alternating
// morning and afternoon, so the lead gets a real choice. Each: { id (local time), start, end, label }.
function freeSlots(busy, plan, profile, now, language) {
  const tz = profile.business.timezone;
  const rules = { min_notice_hours: 2, days_ahead: 7, step_minutes: 30, offer: 3, ...profile.booking };
  const taken = busy.map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()]);
  const earliest = now.getTime() + rules.min_notice_hours * 3600e3;
  const noon = zonedTime(localParts(now, tz).date, 12 * 60, tz).getTime();
  const slots = [];
  for (let d = 0; d <= rules.days_ahead && slots.length < rules.offer; d++) {
    const day = localParts(new Date(noon + d * 86400e3), tz);
    const hours = hoursOn(profile, day.weekday);
    if (!hours) continue;
    const pick = (from) => {
      for (let m = from; m + plan.minutes <= hours[1]; m += rules.step_minutes) {
        const start = zonedTime(day.date, m, tz).getTime();
        const end = start + plan.minutes * 60e3;
        if (start >= earliest && !taken.some(([a, b]) => start < b && end > a)) return { m, start, end };
      }
      return null;
    };
    const afternoon = slots.length % 2 === 1;
    const found = (afternoon && pick(Math.max(hours[0], 13 * 60))) || pick(hours[0]);
    if (!found) continue;
    const hhmm = `${String(Math.floor(found.m / 60)).padStart(2, '0')}:${String(found.m % 60).padStart(2, '0')}`;
    slots.push({ id: `${day.date}T${hhmm}`, start: new Date(found.start).toISOString(), end: new Date(found.end).toISOString(), label: slotLabel(new Date(found.start), now, tz, language) });
  }
  return slots;
}

// Hand-offs between the assistant and the team, shown in the transcript so the model knows who
// is answering now ({name} is the assistant's name).
const TEAM_NOTES = {
  handoff: 'The conversation was handed to the team.',
  takeover: 'A team member took over the conversation.',
  handback: 'The team handed the conversation back to {name}.',
};

// Keeps lead text from closing the <conversation> wrapper early.
function fenceChat(text) {
  return String(text ?? '').replace(/<\/?conversation>/gi, (t) => t.replace('<', '< '));
}

// The user message for one turn: local time, what is already known, the meeting that can be booked,
// the conversation so far.
// ctx: { contact: { name, email, phone, stage, facts, language }, channel, messages: [{ author, text, sent_at }],
//        team_events?: [{ kind: 'handoff' | 'takeover' | 'handback', at }],
//        booking?: { plan: meetingPlan() | null, slots: freeSlots(), windows: freeWindows(),
//                    current: { meeting, agent, start } | null } }
function formatTurnInput(ctx, profile, now) {
  const tz = profile.business.timezone;
  const c = ctx.contact;
  const b = ctx.booking;
  const hhmm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const booking = !b ? [] : [
    b.current && `Their booking: ${b.current.meeting} with ${b.current.agent}, ${slotLabel(new Date(b.current.start), now, tz, 'en')}.`,
    b.plan && `Meeting to offer: ${b.plan.label} (${b.plan.minutes} minutes, ${b.plan.where}) with ${b.plan.agent}.`,
    b.plan && (b.slots.length
      ? `Free times (${tz}): ${b.slots.map((s) => `${s.id} = "${s.label}"`).join('; ')}.`
      : 'Free times: none in the coming days.'),
    b.plan && b.windows?.length && `Open times by day (24-hour, ${tz}; the meeting can start at any time in these ranges): ${b.windows.map((w) => `${w.date} ${w.weekday} ${w.ranges.map(([f, t]) => (f === t ? hhmm(f) : `${hhmm(f)}-${hhmm(t)}`)).join(', ')}`).join('; ')}.`,
  ].filter(Boolean);
  const known = Object.entries({ name: c.name, email: c.email, phone: c.phone, ...(c.facts ?? {}) }).filter(([, v]) => v != null && v !== '');
  const who = { lead: 'Lead', ai: profile.assistant.name, human: 'Team member', system: 'System' };
  const notes = (ctx.team_events ?? []).filter((e) => TEAM_NOTES[e.kind])
    .map((e) => ({ author: 'system', text: TEAM_NOTES[e.kind].replace('{name}', profile.assistant.name), sent_at: e.at }));
  const transcript = [...ctx.messages, ...notes].sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at)).map((m) => {
    const t = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(m.sent_at));
    return `[${t}] ${who[m.author] ?? m.author}: ${fenceChat(m.text) || '(no text)'}`;
  });
  return [
    `Now: ${formatLocal(now, tz)} (${tz}). The office is ${isOpen(profile, now) ? 'open' : 'closed'} right now.`,
    `Channel: ${CHANNEL_NAMES[ctx.channel] ?? ctx.channel}.`,
    `Stage: ${c.stage}.`,
    `Already known about the lead: ${known.length ? known.map(([k, v]) => `${k}: ${v}`).join('; ') : 'nothing yet'}.`,
    ...booking,
    '',
    '<conversation>',
    ...transcript,
    '</conversation>',
    '',
    `Write ${profile.assistant.name}'s next message to the lead.`,
  ].join('\n');
}

// E.164: ten digits are a US number (+1...); anything longer is taken to include its country code.
function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

function normalizeEmail(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

// Fields the profile wants for this intent that are still unknown.
function missingFields(intent, facts, contact, profile) {
  const ask = profile.intents[intent]?.ask ?? [];
  return ask.filter((f) => (f === 'contact' ? !(contact.email || contact.phone) : f === 'name' ? !contact.name : facts[f] == null || facts[f] === ''));
}

// ---- CRM records -------------------------------------------------------------------------------------

// What a CRM record says about a lead, for every CRM adapter (HubSpot, GoHighLevel): the name split
// in two, the deal's title and amount (the top of the stated budget; none for a rental), the details
// collected, and the conversation. row: CRM_LEAD_SQL's { contact, conversation, messages, summary }.
function crmRecord(row, profile) {
  const CHANNELS = { telegram: 'Telegram', whatsapp: 'WhatsApp', messenger: 'Messenger', instagram: 'Instagram', web_chat: 'Website chat', email: 'Email', web_form: 'Website form', lead_ads: 'Facebook lead form' };
  const c = row.contact;
  const facts = c.facts ?? {};
  const [first, ...rest] = String(c.name ?? '').trim().split(/\s+/).filter(Boolean);
  // "$650k", "$400k-$500k", "1.2M": the top of the stated range.
  const amounts = String(facts.budget ?? '').toLowerCase().replace(/,/g, '').match(/\d+(?:\.\d+)?\s*[km]?/g) ?? [];
  const values = amounts.map((a) => parseFloat(a) * (a.endsWith('m') ? 1e6 : a.endsWith('k') ? 1e3 : 1)).filter((n) => n >= 1000);
  const intent = profile.intents[facts.intent]?.label ?? 'New inquiry';
  // A seller's deal is about the home they sell; anyone else's, about where they want to be.
  const place = facts.intent === 'sell' ? (facts.property_area ?? facts.area) : (facts.area ?? facts.property_area);
  const time = (t) => new Intl.DateTimeFormat('en-US', { timeZone: profile.business.timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(t));
  const who = { lead: c.name || 'Lead', ai: profile.assistant.name, human: 'Team' };
  return {
    first_name: first ?? null,
    last_name: rest.join(' ') || null,
    intent,
    deal_name: `${c.name || 'Lead'} – ${intent}${place ? `, ${place}` : ''}`.slice(0, 200),
    amount: values.length && facts.intent !== 'rent' ? Math.max(...values) : null,
    details: Object.entries(facts).filter(([k]) => k !== 'intent').map(([k, v]) => [k.replace(/_/g, ' '), String(v)]),
    channels: [...new Set(row.messages.map((m) => CHANNELS[m.channel] ?? m.channel))],
    transcript: row.messages.map((m) => ({ time: time(m.sent_at), who: who[m.author] ?? m.author, text: m.text })),
  };
}

// ---- Messages the assistant sends on its own ------------------------------------------------------

// "tomorrow at 10:00 AM (MST)", "Tue, Oct 27 at 9:30 AM (MST)": a meeting time in a message.
function whenText(date, now, timeZone, language) {
  const es = language === 'es';
  const locale = es ? 'es-US' : 'en-US';
  const day = localParts(date, timeZone).date;
  const relative = [localParts(now, timeZone).date, localParts(new Date(now.getTime() + 86400e3), timeZone).date].indexOf(day);
  const name = relative >= 0 ? (es ? ['hoy', 'mañana'] : ['today', 'tomorrow'])[relative]
    : new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long', month: 'short', day: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: 'numeric', minute: '2-digit' }).format(date);
  const zone = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(date).find((p) => p.type === 'timeZoneName')?.value;
  return `${name} ${es ? 'a las' : 'at'} ${time} (${zone})`.replace(/[  ]/g, ' ');
}

// The text, buttons and WhatsApp template of a message the assistant sends without being asked:
// t.kind is 'reminder_24h' or 'reminder_1h' (before a meeting), 'follow_up' (the lead went quiet; repeats
// the assistant's open question), 'last_follow_up' (the last one, with how to stop) or 'no_show' (a
// missed meeting). t: { kind, name, language, meeting, agent, start, intent, area, question, quick_replies }.
// The template is used on WhatsApp when the lead's last message is more than 24 hours old.
function touchMessage(t, profile, now) {
  const es = t.language === 'es';
  const lang = es ? 'es' : 'en';
  const first = String(t.name ?? '').trim().split(/\s+/)[0] || '';
  const hi = first ? (es ? `¡Hola, ${first}!` : `Hi ${first}!`) : (es ? '¡Hola!' : 'Hi!');
  const when = t.start ? whenText(new Date(t.start), now, profile.business.timezone, lang) : '';
  const label = profile.intents[t.intent]?.label;
  const request = label ? `${label.charAt(0).toLowerCase()}${label.slice(1)}${t.area ? ` in ${t.area}` : ''}` : (es ? 'tu búsqueda' : 'your search');
  const reminder = { name: 'appointment_reminder', language: 'en_US', params: [first || 'there', t.meeting ?? '', t.agent ?? '', when] };
  switch (t.kind) {
    case 'reminder_24h':
      return es
        ? { text: `${hi} Te recuerdo tu cita (${t.meeting}) con ${t.agent}: ${when}. Si necesitas otro horario, responde aquí.`, quick_replies: ['Ahí estaré', 'Cambiar la hora', 'Cancelarla'], template: reminder }
        : { text: `${hi} A reminder: your ${t.meeting.toLowerCase()} with ${t.agent} is ${when}. If you need another time, just reply here.`, quick_replies: ["I'll be there", 'Change the time', 'Cancel it'], template: reminder };
    case 'reminder_1h':
      return es
        ? { text: `${hi} Tu cita (${t.meeting}) con ${t.agent} es ${when}, en una hora más o menos. ¡Hasta pronto!`, quick_replies: [], template: reminder }
        : { text: `${hi} Your ${t.meeting.toLowerCase()} with ${t.agent} is ${when}, in about an hour. Talk soon!`, quick_replies: [], template: reminder };
    case 'follow_up': {
      const ask = t.question || (es ? `¿Sigues buscando ayuda con ${request}?` : `Are you still looking for help with ${request}?`);
      return { text: `${hi} ${es ? 'Solo quería saber cómo vas.' : 'Just checking in.'} ${ask}`, quick_replies: t.quick_replies ?? [], template: { name: 'lead_check_in', language: 'en_US', params: [first || 'there', request] } };
    }
    case 'last_follow_up':
      return es
        ? { text: `${hi} No te escribo más por ahora. Si sigues buscando ayuda con ${request}, responde aquí y seguimos donde lo dejamos. Si prefieres no recibir mensajes, responde STOP.`, quick_replies: ['Sigo buscando', 'Ahora no'], template: { name: 'lead_check_in', language: 'en_US', params: [first || 'there', request] } }
        : { text: `${hi} I'll leave you be for now. If you're still looking for help with ${request}, just reply here and I'll pick up where we left off. Reply STOP if you'd rather not hear from us.`, quick_replies: ['Still looking', 'Not now'], template: { name: 'lead_check_in', language: 'en_US', params: [first || 'there', request] } };
    case 'no_show':
      return es
        ? { text: `${hi} Lamentamos no haber coincidido en tu cita (${t.meeting}) con ${t.agent}. ¿Quieres elegir otro horario?`, quick_replies: ['Sí, otro horario', 'Ahora no'], template: { name: 'appointment_missed', language: 'en_US', params: [first || 'there', t.meeting ?? '', t.agent ?? ''] } }
        : { text: `${hi} Sorry we missed you for your ${t.meeting.toLowerCase()} with ${t.agent}. Would you like to pick another time?`, quick_replies: ['Pick another time', 'Not now'], template: { name: 'appointment_missed', language: 'en_US', params: [first || 'there', t.meeting ?? '', t.agent ?? ''] } };
    default:
      throw new Error(`touchMessage: unknown kind ${t.kind}`);
  }
}

// The last question in a message ("…Which area are you looking in?"), for a follow-up to repeat.
function lastQuestion(text) {
  return String(text ?? '').match(/[^.!?\n]*\?/g)?.at(-1)?.trim() ?? null;
}

// Turns the checked model answer into what the workflow does: the message to send, the contact
// update, the stage, and whether the team is pulled in. `checked` is parseAndValidate()'s result
// (or { ok: false, errors }) for the model call; ctx is the same object formatTurnInput() got.
function decideTurn(checked, ctx, profile) {
  const c = ctx.contact;
  const lastLead = [...ctx.messages].reverse().find((m) => m.author === 'lead');
  const keywordOptOut = !!lastLead && OPT_OUT_RE.test(lastLead.text);
  const events = [];

  if (!checked.ok) {
    const lang = FALLBACK_REPLY[c.language] ? c.language : 'en';
    if (keywordOptOut) {
      return { ok: false, action: 'opt_out', reply: lang === 'es' ? 'Listo, no te enviaremos más mensajes.' : "Done, you won't get any more messages from us.", handoff_reason: null, contact_patch: { opted_out: true }, events: [{ kind: 'opted_out', data: { by: 'keyword' } }], summary: null };
    }
    return {
      ok: false,
      action: 'handoff',
      reply: FALLBACK_REPLY[lang],
      handoff_reason: `AI answer unusable: ${(checked.errors ?? []).slice(0, 3).join('; ')}`.slice(0, 300),
      contact_patch: {},
      events: [{ kind: 'handoff', data: { reason: 'ai_unusable' } }],
      summary: null,
    };
  }

  const r = checked.value;
  // Facts accumulate: a value the model leaves out (null) never erases one learned earlier.
  const facts = { ...(c.facts ?? {}) };
  for (const [k, v] of Object.entries(r.facts)) if (v != null && String(v).trim() !== '' && k !== 'email' && k !== 'phone' && k !== 'name') facts[k] = String(v).trim();
  const email = c.email ?? normalizeEmail(r.facts.email);
  const phone = c.phone ?? normalizePhone(r.facts.phone);
  const name = c.name ?? (r.facts.name ? String(r.facts.name).trim() : null);
  const intent = r.intent !== 'unknown' ? r.intent : (facts.intent ?? 'unknown');
  if (intent !== 'unknown') facts.intent = intent;

  const missing = profile.intents[intent] ? missingFields(intent, facts, { name, email, phone }, profile) : null;
  let stage = c.stage;
  // Only an intent the business serves moves the lead along; "other" and "unknown" leave the stage as it is.
  if (['new', 'qualifying'].includes(stage) && missing) stage = missing.length === 0 ? 'qualified' : 'qualifying';
  if (stage !== c.stage) events.push({ kind: 'stage_changed', data: { from: c.stage, to: stage } });

  const isHot = !!(c.is_hot || r.is_hot);
  if (isHot && !c.is_hot) events.push({ kind: 'hot', data: {} });

  let action = r.action;
  let reason = r.handoff_reason;
  if (keywordOptOut) action = 'opt_out';
  else if (r.injection && action !== 'opt_out') { action = 'handoff'; reason = reason ?? 'Message tried to change the assistant\'s instructions'; }
  if (action === 'handoff') events.push({ kind: 'handoff', data: { reason: reason ?? 'model' } });
  if (action === 'opt_out') events.push({ kind: 'opted_out', data: { by: keywordOptOut ? 'keyword' : 'model' } });

  const limit = Math.min(CHANNEL_LIMITS[ctx.channel] ?? 2000, Math.max(profile.assistant.max_reply_chars * 2, 400));
  let reply = String(r.reply ?? '').trim();
  // A hand-off always tells the lead that someone will answer, even if the model left the reply empty.
  if (!reply && action === 'handoff') reply = FALLBACK_REPLY[r.language] ?? FALLBACK_REPLY.en;
  if (reply.length > limit) reply = `${reply.slice(0, limit - 1).replace(/\s+\S*$/, '')}…`;

  // Answers the lead can tap (buttons in chat apps). The assistant's first message offers the
  // profile's example openers while it's unclear what the person wants; later, the model's options
  // for a question with a few typical answers. Contact details are always typed, and a button holds
  // up to 20 characters (WhatsApp), three at most, plus "Other". After "Other" the lead types.
  const firstReply = !ctx.messages.some((m) => m.author === 'ai' || m.author === 'human');
  const others = Object.values(OTHER_REPLY).map((s) => s.toLowerCase());
  const tappedOther = others.includes(String(ctx.messages.filter((m) => m.author === 'lead').at(-1)?.text ?? '').trim().toLowerCase());
  const tappable = (list) => [...new Set((list ?? []).map((s) => String(s).trim()).filter((s) => s && s.length <= 20 && !others.includes(s.toLowerCase())))].slice(0, 3);
  const offered = ctx.booking?.slots ?? [];
  let quickReplies = [];
  if (action !== 'reply' || tappedOther || !BUTTON_CHANNELS.includes(ctx.channel)) quickReplies = [];
  else if (firstReply && intent === 'unknown') quickReplies = tappable(profile.assistant.starters);
  // Meeting times: the ones the model suggested itself (from the open times), else the offered free times.
  else if (r.asking === 'meeting_time') quickReplies = tappable(r.quick_replies).length >= 2 ? tappable(r.quick_replies) : tappable(offered.map((s) => s.label));
  else if (!TYPED_DETAILS.includes(r.asking)) quickReplies = tappable(r.quick_replies);
  quickReplies = quickReplies.length < 2 ? [] : [...quickReplies, OTHER_REPLY[r.language] ?? OTHER_REPLY.en];

  // A booking names one of the offered times (the workflow checks the calendar again before
  // booking it); booking while one exists moves it. Cancelling needs a booking to cancel.
  let booking = null;
  if (action === 'reply' && r.booking === 'book' && ctx.booking?.plan) {
    const slot = offered.find((s) => s.id === r.slot || s.label === r.slot)
      ?? slotAt(r.slot, ctx.booking.windows ?? [], ctx.booking.plan, profile, ctx.now ? new Date(ctx.now) : new Date(), r.language);
    if (slot) booking = { action: 'book', plan: ctx.booking.plan, slot, replaces: ctx.booking.current ?? null };
  } else if (action === 'reply' && r.booking === 'cancel' && ctx.booking?.current) {
    booking = { action: 'cancel', current: ctx.booking.current };
  }

  return {
    ok: true,
    action,
    reply,
    handoff_reason: action === 'handoff' ? reason : null,
    contact_patch: { name, email, phone, language: r.language, facts, stage, is_hot: isHot, opted_out: action === 'opt_out' },
    missing,
    events,
    summary: r.summary,
    quick_replies: quickReplies,
    booking,
  };
}

export { CHANNEL_LIMITS, CHANNEL_NAMES, OPT_OUT_RE, FALLBACK_REPLY, TEAM_NOTES, TYPED_DETAILS, OTHER_REPLY, BUTTON_CHANNELS, hoursOn, zonedTime, meetingPlan, bookingDue, slotLabel, freeSlots, freeWindows, slotAt, whenText, touchMessage, lastQuestion, crmRecord, profileFields, buildReplySchema, renderProfile, renderSystemPrompt, localParts, formatLocal, isOpen, fenceChat, formatTurnInput, normalizePhone, normalizeEmail, missingFields, decideTurn };
