// What GET /webhook/dashboard returns (n8n workflow "Assistant · Website chat"), and how the page names it.

export type Dashboard = {
  days: number;
  leads: number;
  by_channel: { channel: string; leads: number }[];
  by_day: { day: string; leads: number }[];
  funnel: { leads: number; qualified: number; booked: number; showed: number };
  first_reply: { median_s: number | null; p90_s: number | null };
  ai: { per_lead_usd: number | null; total_usd: number };
  follow_ups: { leads: number; replied: number };
  handoffs: number;
  opted_out: number;
  recent: { channel: string | null; intent: string | null; stage: string; at: string; first_reply_s: number | null; ai_usd: number | null }[];
};

export const CHANNELS: Record<string, string> = {
  web_chat: "Website chat",
  web_form: "Website form",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  messenger: "Messenger",
  instagram: "Instagram",
  email: "Email",
  lead_ads: "Facebook Lead Ads",
  unknown: "Other",
};

export const STAGE_NAMES: Record<string, string> = {
  new: "New",
  qualifying: "Qualifying",
  qualified: "Qualified",
  booked: "Booked",
  showed: "Showed",
  no_show: "No-show",
  lost: "Lost",
};

export const duration = (s: number | null) => (s == null ? "–" : s < 60 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`);
export const usd = (v: number | null) => (v == null ? "–" : v < 0.1 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`);
export const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");
