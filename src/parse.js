// Extract tool calls that a model wrote as text instead of using native tool calling.
// Handles ```tool / ```json fences, <tool_call>...</tool_call> tags, and a bare JSON reply.

function tryParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function toCall(obj, names) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.function && typeof obj.function === 'object') obj = obj.function;
  const name = obj.name || obj.tool || obj.tool_name;
  if (typeof name !== 'string' || !names.has(name)) return null;
  let args = obj.arguments ?? obj.parameters ?? obj.args ?? obj.input ?? {};
  if (typeof args === 'string') args = tryParse(args) ?? {};
  return { name, args };
}

function callsFrom(value, names) {
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => toCall(v, names)).filter(Boolean);
}

export function extractTextToolCalls(content, names) {
  const calls = [];
  let text = content;

  const patterns = [
    /```(?:tool|tool_call|json)?[ \t]*\r?\n([\s\S]*?)```/g,
    /<tool_call>([\s\S]*?)<\/tool_call>/g,
  ];
  for (const re of patterns) {
    text = text.replace(re, (whole, inner) => {
      const found = callsFrom(tryParse(inner.trim()), names);
      if (!found.length) return whole;
      calls.push(...found);
      return '';
    });
  }

  if (!calls.length) {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const found = callsFrom(tryParse(trimmed), names);
      if (found.length) {
        calls.push(...found);
        text = '';
      }
    }
  }
  return { calls, text: text.trim() };
}
