// Llamada genérica a la IA (Gemini o Claude) que devuelve un JSON con el esquema pedido.
// Gemini si está GEMINI_API_KEY (modelo GEMINI_MODEL); si no, Claude con ANTHROPIC_API_KEY.
// Uso diario limitado por negocio (tabla ai_usage) para controlar el costo.

export const hasAI = () => !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);

export const AI_DAILY_LIMIT = 30;

export async function useAI(admin, bakeryId, kind, limit = AI_DAILY_LIMIT) {
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await admin.from('ai_usage').select('id', { count: 'exact', head: true }).eq('bakery_id', bakeryId).gte('at', since);
  if ((count || 0) >= limit) return false;
  await admin.from('ai_usage').insert({ bakery_id: bakeryId, kind });
  return true;
}

async function gemini({ media, text }, prompt, schema, tag, opts = {}) {
  const parts = [];
  if (media) parts.push({ inline_data: { mime_type: media.type, data: media.data } });
  if (text) parts.push({ text });
  parts.push({ text: `${prompt}\nRespondé solo con un JSON con esta forma: ${JSON.stringify(schema)}` });
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const call = (withSchema) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: opts.maxTokens || 2000, ...(withSchema ? { responseJsonSchema: schema } : {}) },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs || 40000),
  });
  let res = await call(true);
  if (res.status === 400) res = await call(false);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`${tag} gemini`, res.status, body?.error?.message);
    throw new Error('ai_failed');
  }
  const raw = (body?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
}

async function claude({ media, text }, prompt, schema, tag, opts = {}) {
  const content = [];
  if (media) content.push(media.type === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: media.data } }
    : { type: 'image', source: { type: 'base64', media_type: media.type, data: media.data } });
  if (text) content.push({ type: 'text', text });
  content.push({ type: 'text', text: `${prompt}\nRespondé con la herramienta guardar.` });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.RECIPE_AI_MODEL || 'claude-haiku-5-5',
      max_tokens: opts.maxTokens || 2000,
      tools: [{ name: 'guardar', description: 'Guarda los datos leídos.', input_schema: schema }],
      tool_choice: { type: 'tool', name: 'guardar' },
      messages: [{ role: 'user', content }],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs || 40000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`${tag} claude`, res.status, body?.error?.message);
    throw new Error('ai_failed');
  }
  return (body?.content || []).find((c) => c.type === 'tool_use')?.input;
}

// Devuelve el objeto leído o null si la IA no está configurada o falló (nunca rompe el flujo).
// opts: { maxTokens, timeoutMs } para respuestas largas (ej. kits de venta).
export async function askAI(input, prompt, schema, tag = 'ai', opts = {}) {
  if (!hasAI()) return null;
  try {
    return process.env.GEMINI_API_KEY ? await gemini(input, prompt, schema, tag, opts) : await claude(input, prompt, schema, tag, opts);
  } catch (e) {
    console.error(tag, String(e?.message || e));
    return null;
  }
}
