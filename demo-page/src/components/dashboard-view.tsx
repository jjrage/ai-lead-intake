"use client";

import { useEffect, useState } from "react";
import { INTENTS } from "@/lib/demo";
import { CHANNELS, STAGE_NAMES, duration, percent, usd, type Dashboard } from "@/lib/dashboard";

const PERIODS = [7, 30, 90];

export function DashboardView() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Dashboard | null>(null);
  const [failed, setFailed] = useState(false);

  // Loads the period, then refreshes every 30 seconds while the page is open.
  useEffect(() => {
    let live = true;
    const load = () =>
      fetch(`/api/dashboard?days=${days}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: Dashboard) => {
          if (!live) return;
          setData(d);
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    load();
    const t = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [days]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Period" className="inline-flex rounded-full border border-line bg-white p-1 text-sm">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setDays(p)}
              aria-pressed={p === days}
              className={`rounded-full px-3.5 py-1.5 font-medium transition ${p === days ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
            >
              {p} days
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-agave">
          <span className="size-2 animate-pulse rounded-full bg-agave" /> Live from the assistant&apos;s database
        </span>
      </div>

      {failed && !data && <p className="rounded-2xl bg-clay-50 p-4 text-sm text-clay">The dashboard could not be loaded. Please try again in a minute.</p>}
      {!data ? !failed && <div className="h-96 animate-pulse rounded-3xl bg-sand-200/50" aria-hidden /> : <Panels d={data} />}
    </div>
  );
}

function Panels({ d }: { d: Dashboard }) {
  const f = d.funnel;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Tile label="Leads" value={String(d.leads)} note={`last ${d.days} days`} />
        <Tile label="First reply, median" value={duration(d.first_reply.median_s)} note={d.first_reply.p90_s != null ? `9 in 10 within ${duration(d.first_reply.p90_s)}` : "no replies yet"} />
        <Tile label="Qualified" value={percent(f.qualified, f.leads)} note={`${f.qualified} of ${f.leads} leads`} />
        <Tile label="Meetings booked" value={String(f.booked)} note={`${percent(f.booked, f.qualified)} of qualified`} />
        <Tile label="AI cost per lead" value={usd(d.ai.per_lead_usd)} note={`${usd(d.ai.total_usd)} in total`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Leads by channel" subtitle="Where people first wrote from">
          <Bars
            rows={d.by_channel.map((c) => ({ label: CHANNELS[c.channel] ?? c.channel, value: c.leads, tip: `${c.leads} lead${c.leads === 1 ? "" : "s"} · ${percent(c.leads, d.leads)}` }))}
            empty="No leads in this period yet."
          />
        </Card>
        <Card title="From lead to meeting" subtitle="The furthest stage each lead reached">
          <Bars
            rows={[
              ["Leads", f.leads],
              ["Qualified", f.qualified],
              ["Booked a meeting", f.booked],
              ["Showed up", f.showed],
            ].map(([label, value]) => ({ label: String(label), value: Number(value), tip: `${value} · ${percent(Number(value), f.leads)} of leads` }))}
            suffix={(v) => percent(v, f.leads)}
            empty="No leads in this period yet."
          />
        </Card>
      </div>

      <Card title="Leads per day" subtitle={`Last 14 days, ${d.leads ? "business time zone" : "no leads yet"}`}>
        <Columns days={d.by_day} />
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Followed up" value={String(d.follow_ups.leads)} note="leads who went quiet" />
        <Tile label="Replied after a follow-up" value={percent(d.follow_ups.replied, d.follow_ups.leads)} note={`${d.follow_ups.replied} of ${d.follow_ups.leads}`} />
        <Tile label="Handed to the team" value={String(d.handoffs)} note="asked for a person, upset, or unclear" />
        <Tile label="Opted out" value={String(d.opted_out)} note="never messaged again" />
      </div>

      <Card title="Latest leads" subtitle="Names are not shown on this public page">
        <Recent rows={d.recent} />
      </Card>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-soft">{note}</p>}
    </div>
  );
}

// A tooltip that follows the pointer inside a chart.
function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const on = (text: string) => ({
    onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
      const box = (e.currentTarget.closest("[data-chart]") as HTMLElement).getBoundingClientRect();
      setTip({ x: e.clientX - box.left, y: e.clientY - box.top, text });
    },
    onMouseLeave: () => setTip(null),
  });
  const view = tip && (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
      style={{ left: tip.x, top: tip.y - 10 }}
    >
      {tip.text}
    </div>
  );
  return { on, view };
}

// Horizontal bars, one series: thin bars from a shared baseline, value at the tip.
function Bars({ rows, suffix, empty }: { rows: { label: string; value: number; tip: string }[]; suffix?: (v: number) => string; empty: string }) {
  const { on, view } = useTip();
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div data-chart className="relative">
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[8.5rem_1fr] items-center gap-3 sm:grid-cols-[10rem_1fr]" {...on(`${r.label}: ${r.tip}`)}>
            <span className="truncate text-sm text-ink-soft">{r.label}</span>
            <span className="flex min-w-0 items-center gap-2 py-1">
              <span
                className="h-4 min-w-1 rounded-r bg-data transition-[width] duration-500"
                style={{ width: `${(r.value / max) * 85}%` }}
                aria-hidden
              />
              <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
                {r.value}
                {suffix && <span className="ml-1.5 font-normal text-muted">{suffix(r.value)}</span>}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {view}
    </div>
  );
}

// Columns per day: thin columns from the baseline, the busiest day labelled; hover for each day.
function Columns({ days }: { days: Dashboard["by_day"] }) {
  const { on, view } = useTip();
  const max = Math.max(1, ...days.map((d) => d.leads));
  // A multiple of 4, so the 0 / half / top ticks are whole numbers.
  const top = Math.ceil(max / 4) * 4;
  const peak = days.reduce((best, d, i) => (d.leads > days[best].leads ? i : best), 0);
  const name = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div data-chart className="relative">
      <div className="relative h-44">
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-grid" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -top-2.5 right-0 bg-white pl-1 text-[11px] tabular-nums text-muted">{Math.round(top * f)}</span>
          </div>
        ))}
        <div className="absolute inset-0 right-6 flex items-end justify-between gap-[2px]">
          {days.map((d, i) => (
            <div key={d.day} className="relative flex h-full flex-1 items-end justify-center" {...on(`${name(d.day)}: ${d.leads} lead${d.leads === 1 ? "" : "s"}`)}>
              {i === peak && d.leads > 0 && (
                <span className="absolute text-[11px] font-medium tabular-nums text-ink" style={{ bottom: `calc(${(d.leads / top) * 100}% + 4px)` }}>
                  {d.leads}
                </span>
              )}
              <span className="w-full max-w-6 rounded-t bg-data transition-[height] duration-500" style={{ height: `${(d.leads / top) * 100}%` }} aria-hidden />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between pr-6 text-[11px] text-muted">
        <span>{name(days[0].day)}</span>
        <span>{name(days[days.length - 1].day)}</span>
      </div>
      {view}
    </div>
  );
}

function Recent({ rows }: { rows: Dashboard["recent"] }) {
  if (!rows.length) return <p className="text-sm text-muted">No leads in this period yet.</p>;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="text-xs text-muted">
            {["When", "Channel", "Request", "Stage", "First reply", "AI cost"].map((h, i) => (
              <th key={h} className={`px-1 pb-2 font-medium ${i >= 4 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={`${r.at}-${i}`}>
              <td className="px-1 py-2.5 tabular-nums text-ink-soft">
                {new Date(r.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </td>
              <td className="px-1 py-2.5 text-ink">{CHANNELS[r.channel ?? "unknown"] ?? r.channel}</td>
              <td className="px-1 py-2.5 text-ink-soft">{INTENTS[r.intent ?? ""] ?? "Not clear yet"}</td>
              <td className="px-1 py-2.5">
                <span className="rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-ink">{STAGE_NAMES[r.stage] ?? r.stage}</span>
              </td>
              <td className="px-1 py-2.5 text-right tabular-nums text-ink-soft">{duration(r.first_reply_s)}</td>
              <td className="px-1 py-2.5 text-right tabular-nums text-ink-soft">{usd(r.ai_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
