import { LiveDemoClient } from "@/components/live-demo-client";
import { SiteHeader, SOURCE } from "@/components/site-header";

const WHATSAPP = "https://wa.me/12283728376?text=Hi%2C%20I%27m%20looking%20for%20a%20home";
const TELEGRAM = "https://t.me/AgaveLaneDemoBot";
const PRIVACY = "/privacy";

const STEPS = [
  {
    title: "Every channel, one inbox",
    text: "Website chat, WhatsApp, Telegram, Messenger, Instagram and Facebook Lead Ads all feed the same assistant. A lead form gets a WhatsApp message within seconds.",
  },
  {
    title: "Qualifies like a good front desk",
    text: "One question at a time, tap-to-answer buttons, English or Spanish. Answers only from the business profile: no made-up prices, no promises.",
  },
  {
    title: "Books the meeting",
    text: "Offers free times from the agent's Google Calendar as buttons, books the call or visit, and moves or cancels it right in the chat.",
  },
  {
    title: "Reminds and follows up",
    text: "Reminders a day and an hour before. A nudge when a lead goes quiet, and another time offered after a no-show. STOP ends it.",
  },
  {
    title: "Your CRM and your team",
    text: "A HubSpot contact and deal at the right stage. Hot leads and hand-offs open a Slack thread; a reply there goes straight back to the lead's chat.",
  },
  {
    title: "Tested, not guessed",
    text: "27 scripted conversations are re-run after every change. About 4 seconds and one cent of AI per conversation.",
  },
];

const STACK = ["n8n", "Gemini 3.8 Flash", "Claude (switchable)", "Postgres", "HubSpot", "Slack", "Google Calendar", "Gmail", "WhatsApp Cloud API", "Telegram Bot API", "Meta Graph API"];

export default function Home() {
  return (
    <>
      <SiteHeader current="demo" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <section className="pb-10 pt-6 sm:pt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-agave">AI lead assistant · live demo</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl">
            Every lead gets an answer in seconds, on whatever app they wrote from.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Talk to Ava as a home buyer, seller or renter. Next to the chat you see what the agency sees: the lead record filling in, the
            deal stage moving, and the moment the team is pulled in.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">Also live on</span>
            <a href={WHATSAPP} className="rounded-full border border-line bg-white px-4 py-2 font-medium text-ink shadow-sm hover:border-agave hover:text-agave">
              WhatsApp
            </a>
            <a href={TELEGRAM} className="rounded-full border border-line bg-white px-4 py-2 font-medium text-ink shadow-sm hover:border-agave hover:text-agave">
              Telegram
            </a>
          </div>
        </section>

        <LiveDemoClient />

        <section id="how" className="py-20">
          <h2 className="font-display text-3xl text-ink">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-3xl border border-line bg-white p-6">
                <span className="font-display text-3xl text-agave/40">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-base font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-2">
            {STACK.map((t) => (
              <span key={t} className="rounded-full bg-sand-200/70 px-3 py-1 text-xs font-medium text-ink-soft">
                {t}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-muted sm:flex-row sm:justify-between sm:px-6">
          <p>Agave Lane Realty is a made-up agency for a portfolio demo. Website chat conversations are deleted after 24 hours.</p>
          <p className="flex gap-4">
            <a href={PRIVACY} className="hover:text-ink">
              Privacy
            </a>
            <a href={SOURCE} className="hover:text-ink">
              Source on GitHub
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
