// Raw HTTP calls to Claude and Gemini with a JSON-schema-constrained response. Production runs
// the same request from an n8n HTTP Request node, so the eval sends exactly that body rather
// than going through an SDK.

const MAX_OUTPUT_TOKENS = 8000;

class ApiError extends Error {
  constructor(provider, status, body) {
    super(`${provider} HTTP ${status}: ${body.slice(0, 500)}`);
    this.status = status;
  }
}

async function postJson(provider, url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new ApiError(provider, res.status, text);
  return JSON.parse(text);
}

// The Messages API body; the n8n workflow sends the same shape.
export function claudeRequestBody({ model, settings = {}, system, user, schema, maxTokens = MAX_OUTPUT_TOKENS }) {
  const outputConfig = { format: { type: 'json_schema', schema } };
  if (settings.effort) outputConfig.effort = settings.effort;
  return {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: outputConfig,
  };
}

export async function callClaude(opts) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set (see .env.example)');
  const res = await postJson(
    'anthropic',
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    claudeRequestBody(opts),
  );
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return {
    text,
    model: res.model,
    stop_reason: res.stop_reason, // end_turn | max_tokens | refusal | ...
    usage: {
      input_tokens: res.usage.input_tokens,
      output_tokens: res.usage.output_tokens,
      cache_read_input_tokens: res.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: res.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

export function geminiRequestBody({ settings = {}, system, user, schema, maxTokens = MAX_OUTPUT_TOKENS }) {
  const generationConfig = {
    responseMimeType: 'application/json',
    responseJsonSchema: schema,
    maxOutputTokens: maxTokens,
  };
  if (settings.thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: settings.thinkingLevel };
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig,
  };
}

const GEMINI_STOP = { STOP: 'end_turn', MAX_TOKENS: 'max_tokens', SAFETY: 'refusal', PROHIBITED_CONTENT: 'refusal' };

export async function callGemini(opts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set (see .env.example)');
  const res = await postJson(
    'google',
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`,
    { 'x-goog-api-key': key },
    geminiRequestBody(opts),
  );
  const candidate = res.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
  const u = res.usageMetadata ?? {};
  const thoughts = u.thoughtsTokenCount ?? 0;
  const finish = candidate?.finishReason ?? res.promptFeedback?.blockReason ?? 'NO_CANDIDATE';
  return {
    text,
    model: res.modelVersion ?? opts.model,
    stop_reason: GEMINI_STOP[finish] ?? finish.toLowerCase(),
    usage: {
      input_tokens: u.promptTokenCount ?? 0,
      // Thinking tokens are billed at the output rate, so they count as output here.
      output_tokens: (u.candidatesTokenCount ?? 0) + thoughts,
      thinking_tokens: thoughts,
      cache_read_input_tokens: u.cachedContentTokenCount ?? 0,
    },
  };
}

export function callModel(entry, { system, user, schema, maxTokens }) {
  const opts = { model: entry.model, settings: entry.settings, system, user, schema, maxTokens };
  if (entry.provider === 'anthropic') return callClaude(opts);
  if (entry.provider === 'google') return callGemini(opts);
  throw new Error(`unknown provider ${entry.provider}`);
}

// USD for one call. No prompt caching is requested (at a few leads a day it would rarely be warm).
// Gemini may cache implicitly; its input count includes those tokens and they are priced as full
// input here, so every model is compared at the cold-cache cost the workflow will actually see.
export function costUsd(price, usage) {
  if (!price || !usage) return null;
  return (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1e6;
}
