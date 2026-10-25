// Creates a Google calendar for each agent in the business profile (once; safe to repeat) and prints the
// calendar ids to put into the profile (business.team[].calendar_id).
//   node scripts/calendar-setup.mjs [--profile agave-lane] [--seed]
// --seed adds a few existing appointments over the next days, so free times look like a real week.
// --clear-bookings deletes the events the assistant booked (test runs), past and future.
// Uses the "Google Calendar (agents)" credential signed in on the server (its refresh token, through SSH)
// and the OAuth client from the local .env. Tokens are never printed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const HOST = process.env.VPS_HOST || 'demo-vps';
const CREDENTIAL = 'laCredGCalendar1';
const API = 'https://www.googleapis.com/calendar/v3';
const i = process.argv.indexOf('--profile');
const profileId = i > 0 ? process.argv[i + 1] : 'agave-lane';
const seed = process.argv.includes('--seed');
const clear = process.argv.includes('--clear-bookings');
const profile = JSON.parse(readFileSync(new URL(`../profiles/${profileId}.json`, import.meta.url), 'utf8'));
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2]]));

const exported = execFileSync('ssh', [HOST, `cd lead-assistant/deploy && docker compose exec -T n8n sh -c 'umask 077 && n8n export:credentials --id=${CREDENTIAL} --decrypted --output=/tmp/c.json >/dev/null 2>&1; cat /tmp/c.json; rm -f /tmp/c.json'`]).toString();
const refresh = JSON.parse(exported)[0]?.data?.oauthTokenData?.refresh_token;
if (!refresh) throw new Error('the Google Calendar credential is not signed in: open it in n8n and sign in with Google');
const auth = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({ client_id: env.GMAIL_OAUTH_CLIENT_ID, client_secret: env.GMAIL_OAUTH_CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' }),
})).json();
if (!auth.access_token) throw new Error(`token refresh failed: ${auth.error ?? 'unknown'}`);

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${auth.access_token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = res.status === 204 ? {} : await res.json();
  if (json.error) throw new Error(`${method} ${path}: ${json.error.message}`);
  return json;
}

const { items: calendars } = await api('GET', '/users/me/calendarList?maxResults=250');
const tz = profile.business.timezone;
for (const agent of profile.business.team) {
  const summary = `${agent.name} · ${profile.business.name}`;
  let cal = calendars.find((c) => c.summary === summary);
  if (!cal) cal = await api('POST', '/calendars', { summary, timeZone: tz, description: `${agent.role}. Bookings made by the assistant.` });
  console.log(`${agent.name}: ${cal.id}`);
  if (clear) {
    // The assistant's events carry "Booked by the assistant" in their description (Reply turn).
    const { items = [] } = await api('GET', `/calendars/${encodeURIComponent(cal.id)}/events?q=${encodeURIComponent('Booked by the assistant')}&maxResults=250&singleEvents=true`);
    for (const ev of items) await api('DELETE', `/calendars/${encodeURIComponent(cal.id)}/events/${ev.id}?sendUpdates=none`);
    console.log(`  removed ${items.length} booked event(s)`);
  }
  if (!seed) continue;
  // Two existing appointments on each of the next three workdays, at times that differ per agent.
  const offset = profile.business.team.indexOf(agent);
  for (let d = 1, added = 0; added < 3; d++) {
    const day = new Date(Date.now() + d * 86400e3);
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(day);
    const part = (t) => local.find((p) => p.type === t).value;
    if (['Sat', 'Sun'].includes(part('weekday'))) continue;
    const date = `${part('year')}-${part('month')}-${part('day')}`;
    for (const [h, len] of [[9 + offset, 60], [13 + ((offset + added) % 3), 90]]) {
      const start = `${date}T${String(h).padStart(2, '0')}:00:00`;
      const end = new Date(new Date(`${start}Z`).getTime() + len * 60e3).toISOString().slice(0, 19);
      await api('POST', `/calendars/${encodeURIComponent(cal.id)}/events?sendUpdates=none`, {
        summary: ['Showing', 'Client meeting', 'Closing', 'Open house prep'][(h + added) % 4],
        start: { dateTime: start, timeZone: tz }, end: { dateTime: end, timeZone: tz },
      });
    }
    added++;
  }
}
