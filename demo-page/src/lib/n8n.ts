// The assistant's website chat endpoints (n8n workflow "Assistant · Website chat"). The page talks to
// them through this app's own routes, so visitors never see the server's address.
export const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL ?? "https://148-113-241-86.sslip.io/webhook";

export async function n8n(path: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(`${N8N_WEBHOOK_URL}/${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const text = await res.text();
    // n8n answers JSON; anything else (a proxy error page while it restarts) is "try again".
    if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
      return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
    }
    return new Response(text, { status: res.status, headers: { "content-type": "application/json" } });
  } catch {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
