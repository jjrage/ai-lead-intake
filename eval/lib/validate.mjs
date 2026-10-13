// Checks a parsed model response against the JSON Schema subset used in prompts/*.schema.json
// (type, enum, required, properties, additionalProperties: false, items, anyOf). Structured
// output makes a mismatch unlikely, not impossible, so the workflow checks before trusting it.

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v === 'number' ? 'number' : typeof v;
}

function check(schema, value, path, errors) {
  if (schema.anyOf) {
    const ok = schema.anyOf.some((s) => {
      const sub = [];
      check(s, value, path, sub);
      return sub.length === 0;
    });
    if (!ok) errors.push(`${path}: matches none of the allowed shapes`);
    return;
  }
  const actual = typeOf(value);
  if (schema.type && schema.type !== actual && !(schema.type === 'integer' && Number.isInteger(value))) {
    errors.push(`${path}: expected ${schema.type}, got ${actual}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: '${value}' is not one of ${schema.enum.join(', ')}`);
  if (actual === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}.${key}: missing`);
    for (const [key, v] of Object.entries(value)) {
      const sub = schema.properties?.[key];
      if (sub) check(sub, v, `${path}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: not allowed`);
    }
  }
  if (actual === 'array' && schema.items) value.forEach((v, i) => check(schema.items, v, `${path}[${i}]`, errors));
}

// Returns { ok, value, errors }. `text` is the raw model output.
export function parseAndValidate(text, schema) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, value: null, errors: [`not valid JSON: ${e.message}`] };
  }
  const errors = [];
  check(schema, value, '$', errors);
  return { ok: errors.length === 0, value, errors };
}
