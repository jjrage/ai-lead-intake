"use client";

import dynamic from "next/dynamic";

// The chat keeps its session in the browser (localStorage), so it renders on the client only.
export const LiveDemoClient = dynamic(() => import("@/components/live-demo").then((m) => m.LiveDemo), {
  ssr: false,
  loading: () => <div className="h-[660px] rounded-[2.6rem] bg-sand-200/50 lg:max-w-[420px]" aria-hidden />,
});
