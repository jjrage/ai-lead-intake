# Demo page

The live demo of the AI lead assistant: a website chat with Ava on one side and, on the other, what the agency
sees (the lead record, deal stage, CRM and Slack status, AI cost), read live from the assistant's database.

Next.js app. Its two API routes forward to the n8n workflow **Assistant · Website chat**
(`/webhook/chat/message` and `/webhook/chat/updates`), so the page never exposes the server's address.

```bash
npm install
npm run dev            # http://localhost:3000
```

`N8N_WEBHOOK_URL` (optional) points at another n8n instance; the default is the demo server.
