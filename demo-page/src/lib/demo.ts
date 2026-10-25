// What the website chat endpoints return, and how the page names things. The labels follow the
// business profile (profiles/agave-lane.json in the repository).

export type Author = "lead" | "ai" | "human" | "system";

export type ChatMessage = {
  id: string;
  author: Author;
  text: string;
  quick_replies?: string[];
  latency_ms?: number | null;
  cost_usd?: number | null;
};

export type Lead = {
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  facts: Record<string, string>;
  is_hot: boolean;
  in_crm: boolean;
  crm_deal: boolean;
  in_slack: boolean;
};

export type LeadEvent = { kind: string; data: Record<string, unknown>; at: string };

export type Updates = {
  messages: { id: number; author: Author; text: string; sent_at: string; quick_replies: string[]; latency_ms: number | null; cost_usd: number | null }[];
  typing: boolean;
  mode: "ai" | "human" | null;
  lead: Lead | null;
  ai: { replies: number; cost_usd: number; avg_latency_ms: number | null } | null;
  events: LeadEvent[];
};

export const STARTERS = ["I'm buying a home", "I'm selling a home", "I'm looking to rent"];

export const INTENTS: Record<string, string> = {
  buy: "Buying a home",
  sell: "Selling a home",
  rent: "Renting a home",
  invest: "Investment property",
  other: "Something else",
};

// In the order an agent reads them.
export const FACTS: [key: string, label: string][] = [
  ["area", "Area"],
  ["property_area", "Home is in"],
  ["property_type", "Property type"],
  ["bedrooms", "Bedrooms"],
  ["budget", "Budget"],
  ["budget_monthly", "Monthly budget"],
  ["timeline", "Timeline"],
  ["move_in", "Move-in"],
  ["financing", "Financing"],
  ["also_buying", "Also buying"],
  ["pets", "Pets"],
  ["strategy", "Strategy"],
];

export const STAGES: [key: string, label: string][] = [
  ["new", "New"],
  ["qualifying", "Qualifying"],
  ["qualified", "Qualified"],
];

const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGES);

export function describeEvent(e: LeadEvent): { title: string; detail?: string; tone: "neutral" | "good" | "hot" | "team" } {
  const d = e.data ?? {};
  switch (e.kind) {
    case "stage_changed":
      return { title: `Stage: ${STAGE_LABEL[String(d.to)] ?? d.to}`, detail: `from ${STAGE_LABEL[String(d.from)] ?? d.from}`, tone: d.to === "qualified" ? "good" : "neutral" };
    case "hot":
      return { title: "Marked as a hot lead", detail: "Posted to the team's Slack channel", tone: "hot" };
    case "handoff":
      return { title: "Handed to the team", detail: d.reason ? String(d.reason) : undefined, tone: "team" };
    case "takeover":
      return { title: "A team member took over", tone: "team" };
    case "handback":
      return { title: "Handed back to Ava", tone: "team" };
    case "opted_out":
      return { title: "Asked not to be contacted", detail: "No more messages will be sent", tone: "neutral" };
    case "merged":
      return { title: "Matched to an existing contact", tone: "neutral" };
    default:
      return { title: e.kind.replace(/_/g, " "), tone: "neutral" };
  }
}

export const money = (usd: number) => (usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(3)}`);
export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
