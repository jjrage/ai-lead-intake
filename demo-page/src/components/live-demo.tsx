"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  describeEvent,
  FACTS,
  INTENTS,
  money,
  seconds,
  STAGES,
  STARTERS,
  type ChatMessage,
  type Lead,
  type LeadEvent,
  type Updates,
} from "@/lib/demo";
import { AgaveMark } from "@/components/agave-mark";

const STORE = "agave-lane-demo-v1";
const REPLY_TIMEOUT_MS = 90_000;

type Stored = { session: string; messages: (ChatMessage & { sent_at?: string })[]; lastId: number };
type Business = { lead: Lead | null; events: LeadEvent[]; ai: Updates["ai"]; mode: Updates["mode"]; typing: boolean };

const EMPTY_BUSINESS: Business = { lead: null, events: [], ai: null, mode: null, typing: false };

function freshStore(): Stored {
  return { session: crypto.randomUUID(), messages: [], lastId: 0 };
}

function loadStore(): Stored {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const s = JSON.parse(raw) as Stored;
      if (typeof s.session === "string" && Array.isArray(s.messages)) return s;
    }
  } catch {
    // Private windows or blocked storage: start a new chat.
  }
  return freshStore();
}

// Rendered on the client only (see live-demo-client.tsx), so the stored chat is read on first render.
export function LiveDemo() {
  const [store, setStore] = useState<Stored>(loadStore);
  const [business, setBusiness] = useState<Business>(EMPTY_BUSINESS);
  const [awaitingSince, setAwaitingSince] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [tick, setTick] = useState(0);
  // Polls and sends read the latest chat without restarting their timers.
  const storeRef = useRef<Stored>(store);

  useEffect(() => {
    storeRef.current = store;
    try {
      localStorage.setItem(STORE, JSON.stringify(store));
    } catch {
      // Not saved: the chat still works for this visit.
    }
  }, [store]);

  const addSystem = (text: string) =>
    setStore((s) => ({ ...s, messages: [...s.messages, { id: `sys-${crypto.randomUUID()}`, author: "system", text }] }));

  const poll = useCallback(async () => {
    const s = storeRef.current;
    let u: Updates;
    try {
      const res = await fetch(`/api/updates?session=${s.session}&after=${s.lastId}`, { cache: "no-store" });
      if (!res.ok) return;
      u = await res.json();
    } catch {
      return;
    }
    setBusiness({ lead: u.lead, events: u.events ?? [], ai: u.ai, mode: u.mode, typing: u.typing });
    const fresh = (u.messages ?? []).filter((m) => m.id > s.lastId);
    if (!fresh.length) return;
    setStore((cur) =>
      cur.session === s.session
        ? {
            ...cur,
            lastId: Math.max(cur.lastId, ...fresh.map((m) => m.id)),
            messages: [
              ...cur.messages,
              ...fresh.map((m) => ({
                id: `srv-${m.id}`,
                author: m.author,
                text: m.text,
                quick_replies: m.quick_replies,
                latency_ms: m.latency_ms,
                cost_usd: m.cost_usd,
                sent_at: m.sent_at,
              })),
            ],
          }
        : cur,
    );
    setAwaitingSince(null);
  }, []);

  // Poll at once for a returning visitor, quickly while a reply is due, slowly while a person handles
  // the chat or the CRM may still update, and not at all before the visitor writes.
  const hasChat = store.messages.some((m) => m.author === "lead");
  const humanMode = business.mode === "human";
  useEffect(() => {
    if (!hasChat) return;
    const delay = tick === 0 ? 0 : awaitingSince ? 1200 : humanMode ? 3000 : 8000;
    const t = setTimeout(async () => {
      if (awaitingSince && Date.now() - awaitingSince > REPLY_TIMEOUT_MS) {
        setAwaitingSince(null);
        addSystem("Ava is taking longer than usual. Please send your message again.");
        return;
      }
      await poll();
      setTick((n) => n + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [hasChat, awaitingSince, humanMode, tick, poll]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || awaitingSince) return;
    const session = storeRef.current.session;
    setDraft("");
    setStore((s) => ({ ...s, messages: [...s.messages, { id: `lead-${crypto.randomUUID()}`, author: "lead", text: clean }] }));
    setAwaitingSince(Date.now());
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session, message_id: crypto.randomUUID(), text: clean }),
      });
      if (res.ok) return;
      setAwaitingSince(null);
      if (res.status === 429) addSystem("This demo has reached its limit for today. Try Ava on WhatsApp or Telegram, or come back tomorrow.");
      else if (res.status === 400) addSystem("That message could not be sent. Messages can be up to 2,000 characters.");
      else addSystem("The assistant is restarting. Please try again in a minute.");
    } catch {
      setAwaitingSince(null);
      addSystem("No connection. Please try again.");
    }
  }

  function startOver() {
    setStore(freshStore());
    setBusiness(EMPTY_BUSINESS);
    setAwaitingSince(null);
    setDraft("");
  }

  const messages = store.messages;
  const last = messages.at(-1);
  const quickReplies = last && (last.author === "ai" || last.author === "human") && !awaitingSince ? last.quick_replies ?? [] : [];
  const typing = !!awaitingSince || business.typing;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10">
      <Phone
        messages={messages}
        typing={typing}
        humanMode={business.mode === "human"}
        quickReplies={quickReplies}
        draft={draft}
        setDraft={setDraft}
        onSend={send}
        onStartOver={startOver}
        busy={!!awaitingSince}
      />
      <BusinessView business={business} messages={messages} started={hasChat} />
    </div>
  );
}

// ---- the lead's side ----------------------------------------------------------------------------

function Phone(props: {
  messages: (ChatMessage & { sent_at?: string })[];
  typing: boolean;
  humanMode: boolean;
  quickReplies: string[];
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string) => void;
  onStartOver: () => void;
  busy: boolean;
}) {
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [props.messages.length, props.typing, props.quickReplies.length]);
  const empty = !props.messages.length;

  return (
    <section aria-label="Chat with Ava" className="mx-auto w-full max-w-[420px]">
      <div className="rounded-[2.6rem] bg-ink p-2.5 shadow-[0_30px_60px_-25px_rgba(30,42,36,0.55)]">
        <div className="flex h-[640px] flex-col overflow-hidden rounded-[2.1rem] bg-sand-50">
          <header className="flex items-center gap-3 border-b border-line bg-white/80 px-5 pb-3 pt-5 backdrop-blur">
            <div className="grid size-10 place-items-center rounded-full bg-agave text-white">
              <AgaveMark className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ink">Ava · Agave Lane Realty</p>
              <p className="truncate text-xs text-muted">{props.humanMode ? "A team member is in this chat" : "Virtual assistant · replies in seconds"}</p>
            </div>
            {!empty && (
              <button onClick={props.onStartOver} className="rounded-full px-2.5 py-1 text-xs font-medium text-agave hover:bg-agave-50">
                Start over
              </button>
            )}
          </header>

          <div ref={log} aria-live="polite" className="flex-1 space-y-2.5 overflow-y-auto px-4 py-5">
            {empty ? (
              <Welcome onPick={props.onSend} />
            ) : (
              props.messages.map((m) => <Bubble key={m.id} m={m} />)
            )}
            {props.typing && !empty && <Typing />}
          </div>

          {props.quickReplies.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2 px-4 pb-2">
              {props.quickReplies.map((q) => (
                <button
                  key={q}
                  onClick={() => props.onSend(q)}
                  className="rounded-full border border-agave/40 bg-white px-3.5 py-1.5 text-sm font-medium text-agave shadow-sm transition hover:border-agave hover:bg-agave-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              props.onSend(props.draft);
            }}
            className="flex items-center gap-2 border-t border-line bg-white px-3 py-3"
          >
            <input
              value={props.draft}
              onChange={(e) => props.setDraft(e.target.value)}
              maxLength={2000}
              placeholder={props.busy ? "Ava is typing…" : "Type a message"}
              aria-label="Message"
              className="min-w-0 flex-1 rounded-full bg-sand-100 px-4 py-2.5 text-[15px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-agave/30"
            />
            <button
              type="submit"
              disabled={props.busy || !props.draft.trim()}
              aria-label="Send"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-agave text-white transition hover:bg-agave-dark disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                <path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Welcome({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-3 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-agave text-white shadow-lg shadow-agave/25">
        <AgaveMark className="size-9" />
      </div>
      <p className="mt-4 font-display text-2xl text-ink">Hi, I&apos;m Ava</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Ask me about buying, selling or renting a home in the Phoenix area. Pick one to start, or type anything.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        {STARTERS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-left text-[15px] font-medium text-ink shadow-sm transition hover:border-agave hover:text-agave"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.author === "system") {
    return <p className="mx-auto max-w-[85%] rounded-xl bg-clay-50 px-3 py-2 text-center text-xs text-clay">{m.text}</p>;
  }
  const mine = m.author === "lead";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} animate-[rise_0.25s_ease-out]`}>
      <div
        className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug shadow-sm ${
          mine ? "rounded-br-md bg-agave text-white" : "rounded-bl-md border border-line bg-white text-ink"
        }`}
      >
        {m.author === "human" && <span className="mb-0.5 block text-xs font-semibold text-clay">Agave Lane team</span>}
        {m.text}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start">
      <div className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3.5 shadow-sm" aria-label="Ava is typing">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

// ---- the business's side ------------------------------------------------------------------------

function BusinessView({ business, messages, started }: { business: Business; messages: (ChatMessage & { sent_at?: string })[]; started: boolean }) {
  const lead = business.lead;
  return (
    <section aria-label="What the agency sees" className="min-w-0">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl text-ink">What the agency sees</h2>
        <span className="flex items-center gap-1.5 text-xs font-medium text-agave">
          <span className="size-2 animate-pulse rounded-full bg-agave" /> Live from the assistant&apos;s database
        </span>
      </div>
      {!started || !lead ? (
        <div className="grid min-h-[300px] place-items-center rounded-3xl border border-dashed border-line bg-white/60 p-8 text-center">
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            Start a chat with Ava. Here you&apos;ll see the lead record fill in as she asks her questions, the deal stage move,
            and when the team is pulled in.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <LeadCard lead={lead} />
          <div className="space-y-4">
            <WhereItWent lead={lead} humanMode={business.mode === "human"} />
            <AiCard ai={business.ai} />
          </div>
          <Activity events={business.events} messages={messages} />
        </div>
      )}
    </section>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-line bg-white p-5 shadow-[0_1px_0_rgba(30,42,36,0.04)] ${className}`}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{title}</h3>
      {children}
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const intent = INTENTS[lead.facts.intent ?? ""] ?? "Working out what they need";
  const stageIndex = STAGES.findIndex(([k]) => k === lead.stage);
  const facts = FACTS.filter(([k]) => lead.facts[k]);
  return (
    <Card title="Lead">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-xl text-ink">{lead.name ?? "New lead"}</p>
          <p className="text-sm text-ink-soft">{intent}</p>
        </div>
        {lead.is_hot && <span className="shrink-0 rounded-full bg-clay px-2.5 py-1 text-xs font-semibold text-white">Hot lead</span>}
      </div>

      <ol className="mt-4 grid grid-cols-3 gap-1.5" aria-label="Deal stage">
        {STAGES.map(([k, label], i) => (
          <li key={k} className="min-w-0">
            <div className={`h-1.5 rounded-full transition-colors duration-500 ${i <= stageIndex ? "bg-agave" : "bg-sand-200"}`} />
            <p className={`mt-1.5 truncate text-xs ${i === stageIndex ? "font-semibold text-agave" : "text-muted"}`}>{label}</p>
          </li>
        ))}
      </ol>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
        {facts.length === 0 && <p className="col-span-2 text-sm text-muted">Details appear here as Ava learns them.</p>}
        {facts.map(([k, label]) => (
          <div key={k} className="min-w-0 animate-[rise_0.35s_ease-out]">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="truncate font-medium text-ink">{lead.facts[k]}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
        {(
          [
            ["Email", lead.email],
            ["Phone", lead.phone],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="flex justify-between gap-3">
            <span className="text-muted">{label}</span>
            <span className={`truncate ${v ? "font-medium text-ink" : "text-muted/70"}`}>{v ?? "not given yet"}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WhereItWent({ lead, humanMode }: { lead: Lead; humanMode: boolean }) {
  const rows: [name: string, on: boolean, text: string][] = [
    ["HubSpot", lead.in_crm, lead.in_crm ? (lead.crm_deal ? "Contact and deal created, stage kept in sync" : "Contact created") : "Created once Ava has a name and a phone or email"],
    ["Slack #leads", lead.in_slack, lead.in_slack ? "The team has a thread for this lead and can reply from it" : "Hot leads and hand-offs get a thread"],
    ["Who replies", true, humanMode ? "A team member: Ava stays quiet until they hand back" : "Ava, until a person steps in"],
  ];
  return (
    <Card title="Where it went">
      <ul className="space-y-3">
        {rows.map(([name, on, text]) => (
          <li key={name} className="flex gap-3">
            <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${on ? "bg-agave" : "bg-sand-200"}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{name}</p>
              <p className="text-sm text-ink-soft">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AiCard({ ai }: { ai: Updates["ai"] }) {
  if (!ai || !ai.replies) return null;
  return (
    <Card title="AI cost of this conversation">
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["Replies", String(ai.replies)],
            ["Avg. reply", ai.avg_latency_ms ? seconds(ai.avg_latency_ms) : "–"],
            ["Total", money(Number(ai.cost_usd))],
          ] as const
        ).map(([label, v]) => (
          <div key={label}>
            <p className="font-display text-2xl text-ink">{v}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Activity({ events, messages }: { events: LeadEvent[]; messages: (ChatMessage & { sent_at?: string })[] }) {
  const items = [
    ...events.map((e) => ({ at: e.at, ...describeEvent(e) })),
    ...messages
      .filter((m) => m.author === "ai" && m.sent_at && m.latency_ms)
      .map((m) => ({
        at: m.sent_at as string,
        title: "Ava replied",
        detail: `${seconds(m.latency_ms as number)}${m.cost_usd != null ? ` · ${money(Number(m.cost_usd))}` : ""}`,
        tone: "neutral" as const,
      })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const dot = { neutral: "bg-sand-200", good: "bg-agave", hot: "bg-clay", team: "bg-ink" } as const;
  return (
    <Card title="Activity" className="xl:col-span-2">
      <ol className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {items.map((it, i) => (
          <li key={`${it.at}-${i}`} className="flex gap-3">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dot[it.tone]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{it.title}</p>
              {it.detail && <p className="truncate text-xs text-muted">{it.detail}</p>}
            </div>
            <time className="shrink-0 text-xs tabular-nums text-muted">
              {new Date(it.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </time>
          </li>
        ))}
      </ol>
    </Card>
  );
}
