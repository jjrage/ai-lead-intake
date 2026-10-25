import { n8n } from "@/lib/n8n";

// A visitor's message: { session, message_id, text } → stored by the assistant, which then replies.
export async function POST(request: Request) {
  let body: { session?: unknown; message_id?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad request" }, { status: 400 });
  }
  const { session, message_id, text } = body;
  return n8n("chat/message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session, message_id, text }),
  });
}
