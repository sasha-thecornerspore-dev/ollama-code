// Thin client for the Ollama HTTP API.

function parseError(text) {
  try {
    return JSON.parse(text).error || text;
  } catch {
    return text;
  }
}

export async function* chatStream(baseUrl, body, signal) {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = new Error(parseError(await res.text()));
    err.status = res.status;
    throw err;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const j = JSON.parse(line);
      if (j.error) throw new Error(j.error);
      yield j;
    }
  }
  if (buf.trim()) {
    const j = JSON.parse(buf);
    if (j.error) throw new Error(j.error);
    yield j;
  }
}

export async function listModels(baseUrl) {
  const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const j = await res.json();
  return (j.models || []).map((m) => ({
    name: m.name,
    size: m.size,
    family: m.details?.family,
    params: m.details?.parameter_size,
    quant: m.details?.quantization_level,
  }));
}

const capsCache = new Map();
export async function modelCapabilities(baseUrl, model) {
  if (capsCache.has(model)) return capsCache.get(model);
  const res = await fetch(`${baseUrl}/api/show`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(parseError(await res.text()));
  const j = await res.json();
  const info = {
    capabilities: j.capabilities || null,
    contextLength:
      Object.entries(j.model_info || {}).find(([k]) => k.endsWith('.context_length'))?.[1] || null,
  };
  capsCache.set(model, info);
  return info;
}
