// One model call for an assistant turn: the HTTP request, the parsed answer and its price. Shared by
// the n8n workflow (copied into Code nodes by the workflow generator) and the conversation eval, so
// both send the same request. No imports: every function must run on its own in an n8n Code node.

// USD per million tokens. Claude: list prices checked 2026-10-20 (claude-api skill); a 5-minute cache
// write bills 1.25x input, a cache read 0.05x. Gemini: checked 2026-09-27 (eval/models.json), priced
// without its implicit cache discount. Thinking tokens bill as output.
const TURN_PRICES = {
  'gemini-3.8-flash': { input: 0.75, output: 3.75 },
  'claude-opus-5-5': { input: 4.0, output: 20.0, cache_write: 5.0, cache_read: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cache_write: 0.125, cache_read: 0.01 },
};

const TURN_MAX_TOKENS = 8000;

// Claude models that accept server-side fallback on a safety refusal (Haiku has none).
const CLAUDE_FALLBACK_MODELS = ['claude-opus-5-5'];

// provider: 'gemini' | 'claude'. Thinking is kept low on both: a chat reply needs speed more than depth.
// The system prompt is the same for every conversation of a business, so Claude caches it.
function turnRequest(provider, model, { system, user, schema }) {
  if (provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: {},
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: TURN_MAX_TOKENS, thinkingConfig: { thinkingLevel: 'low' } },
      },
    };
  }
  if (provider === 'claude') {
    const fallback = CLAUDE_FALLBACK_MODELS.includes(model);
    const body = {
      model,
      max_tokens: TURN_MAX_TOKENS,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
      output_config: { format: { type: 'json_schema', schema }, effort: 'low' },
    };
    if (fallback) body.fallbacks = 'default';
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: fallback ? { 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' } : { 'anthropic-version': '2023-06-01' },
      body,
    };
  }
  throw new Error(`provider must be "gemini" or "claude", got "${provider}"`);
}

// The answer text, the model that served it, why it stopped (end_turn, max_tokens, refusal, ...) and
// token usage, from a raw API response. `response.error` is what an HTTP node returns on failure.
function parseTurnResponse(provider, model, response) {
  if (response?.error) {
    const e = response.error;
    return { text: '', model, stop_reason: 'error', usage: { input_tokens: 0, output_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0 }, error: typeof e === 'string' ? e : (e.message ?? JSON.stringify(e)) };
  }
  if (provider === 'claude') {
    const u = response.usage ?? {};
    return {
      text: (response.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join(''),
      model: response.model ?? model,
      stop_reason: response.stop_reason,
      usage: { input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0, cache_write_tokens: u.cache_creation_input_tokens ?? 0, cache_read_tokens: u.cache_read_input_tokens ?? 0 },
      error: null,
    };
  }
  const candidate = response.candidates?.[0];
  const finish = candidate?.finishReason ?? response.promptFeedback?.blockReason ?? 'NO_CANDIDATE';
  const u = response.usageMetadata ?? {};
  return {
    text: (candidate?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join(''),
    model: response.modelVersion ?? model,
    stop_reason: { STOP: 'end_turn', MAX_TOKENS: 'max_tokens', SAFETY: 'refusal', PROHIBITED_CONTENT: 'refusal' }[finish] ?? finish.toLowerCase(),
    usage: { input_tokens: u.promptTokenCount ?? 0, output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0), cache_write_tokens: 0, cache_read_tokens: 0 },
    error: null,
  };
}

// USD for one call; null for a model without a price.
function turnCost(model, usage) {
  const p = TURN_PRICES[model];
  if (!p) return null;
  return (usage.input_tokens * p.input + usage.output_tokens * p.output
    + usage.cache_write_tokens * (p.cache_write ?? p.input) + usage.cache_read_tokens * (p.cache_read ?? p.input)) / 1e6;
}

export { TURN_PRICES, TURN_MAX_TOKENS, CLAUDE_FALLBACK_MODELS, turnRequest, parseTurnResponse, turnCost };
