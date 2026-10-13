// Shared lead logic. The n8n workflow's Code nodes use the same rules; keep them in sync.

// Budget below these amounts (USD) keeps an urgent lead from being "hot".
export const HOT_MIN_BUDGET_USD = { one_time: 10000, monthly: 2500 };

// A lead is hot when it is urgent, asks for at least one service we offer, and has no stated
// USD budget below the threshold. An unknown budget does not disqualify it.
export function isHot(result) {
  if (result.category !== 'sales_lead' || result.urgency !== 'high') return false;
  const services = result.services ?? [];
  if (services.length > 0 && services.every((s) => s === 'other')) return false;
  const { min, max, currency, period } = result.budget ?? {};
  const amount = max ?? min;
  const threshold = HOT_MIN_BUDGET_USD[period];
  if (currency === 'USD' && amount != null && threshold != null && amount < threshold) return false;
  return true;
}

const EMPTY = '(not provided)';

// Keeps sender text from closing the <message> wrapper early.
const fence = (text) => String(text ?? '').replaceAll('</message>', '</ message>');

// The user message the model receives for one inbound lead.
export function formatLead(input) {
  const header = [`Received at: ${input.received_at}`];
  let body;
  if (input.channel === 'email') {
    header.push('Channel: email');
    body = [`From: ${input.from}`, `Subject: ${input.subject}`, '', input.body];
  } else {
    header.push('Channel: website contact form');
    body = [
      `Name: ${input.name || EMPTY}`,
      `Email: ${input.email || EMPTY}`,
      `Phone: ${input.phone || EMPTY}`,
      `Company: ${input.company || EMPTY}`,
      'Message:',
      input.message,
    ];
  }
  return [...header, '', '<message>', fence(body.join('\n')), '</message>'].join('\n');
}
