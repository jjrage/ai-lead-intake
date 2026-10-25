import Link from "next/link";
import { AgaveMark } from "@/components/agave-mark";

export const SOURCE = "https://github.com/jjrage/ai-lead-intake";

export function SiteHeader({ current }: { current: "demo" | "dashboard" }) {
  const link = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined} className={on ? "font-semibold text-ink" : "hover:text-ink"}>
      {label}
    </Link>
  );
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <Link href="/" className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-agave text-white">
          <AgaveMark className="size-5" />
        </span>
        <span className="truncate font-display text-base text-ink sm:text-lg">Agave Lane Realty</span>
        <span className="hidden rounded-full border border-clay/30 bg-clay-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-clay sm:inline">
          Demo
        </span>
      </Link>
      <nav className="flex shrink-0 items-center gap-4 whitespace-nowrap text-sm text-ink-soft sm:gap-5">
        {link("/", "Live demo", current === "demo")}
        {link("/dashboard", "Dashboard", current === "dashboard")}
        <a href={SOURCE} className="hidden hover:text-ink sm:inline">
          Source
        </a>
      </nav>
    </header>
  );
}
