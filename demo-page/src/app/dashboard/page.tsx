import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard-view";
import { SiteHeader, SOURCE } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Dashboard: AI lead assistant demo",
  description: "Leads by channel, time to first reply, qualified leads and booked meetings, AI cost per lead: live numbers from the demo assistant.",
};

export default function DashboardPage() {
  return (
    <>
      <SiteHeader current="dashboard" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6">
        <section className="pb-8 pt-6 sm:pt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-agave">Owner dashboard</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl">How the assistant is doing</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Every lead the assistant answered, on every channel: how fast it replied, how many leads it qualified and booked, and what
            the AI cost. Live numbers from the demo; website chat leads are deleted after a day.
          </p>
        </section>
        <DashboardView />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-muted sm:flex-row sm:justify-between sm:px-6">
          <p>Agave Lane Realty is a made-up agency for a portfolio demo.</p>
          <a href={SOURCE} className="hover:text-ink">
            Source on GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
