import { n8n } from "@/lib/n8n";

// Replies after `after`, whether one is being written, and what the business sees for this session.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = url.searchParams.get("session") ?? "";
  const after = Number(url.searchParams.get("after")) || 0;
  if (!/^[A-Za-z0-9-]{16,64}$/.test(session)) return Response.json({ ok: false, error: "bad session" }, { status: 400 });
  const res = await n8n(`chat/updates?session=${encodeURIComponent(session)}&after=${after}`);
  if (!res.ok) return res;
  const data = await res.json();
  return Response.json(Array.isArray(data) ? data[0] : data);
}
