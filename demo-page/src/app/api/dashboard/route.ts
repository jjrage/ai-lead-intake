import { n8n } from "@/lib/n8n";

// The dashboard numbers for the last `days` days (aggregates only, no names).
export async function GET(request: Request) {
  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days")) || 30, 1), 90);
  return n8n(`dashboard?days=${days}`);
}
