const page = __PAGE_HTML__;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

function normalizeTikTokUrl(value) {
  try {
    const raw = String(value || "").trim();
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.endsWith("tiktok.com")) return "";
    const match = url.pathname.match(/\/(video|photo)\/(\d+)/i);
    if (match) return `tiktok:${match[2]}`;
    return `${host}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return "";
  }
}

function parseEntry(row) {
  return {
    id: row.id,
    text: row.text,
    urls: JSON.parse(row.urls_json),
    updatedAt: row.updated_at,
  };
}

async function listEntries(db) {
  const result = await db.prepare(
    "SELECT id, text, urls_json, updated_at FROM entries ORDER BY updated_at DESC"
  ).all();
  return (result.results || []).map(parseEntry);
}

function validatePayload(payload) {
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  const urls = Array.isArray(payload?.urls)
    ? [...new Set(payload.urls.map(value => String(value).trim()).filter(Boolean))]
    : [];
  const normalized = urls.map(normalizeTikTokUrl);
  if (!text) return { error: "Message text is required." };
  if (!urls.length || normalized.some(value => !value)) return { error: "Enter valid TikTok links." };
  if (new Set(normalized).size !== normalized.length) return { error: "The same video is listed twice." };
  return { text, urls, normalized };
}

async function saveEntry(db, id, payload, isUpdate) {
  const data = validatePayload(payload);
  if (data.error) return json({ error: data.error }, 400);

  const existingLinks = await db.prepare(
    `SELECT normalized_url, entry_id FROM entry_links WHERE normalized_url IN (${data.normalized.map(() => "?").join(",")})`
  ).bind(...data.normalized).all();
  const clash = (existingLinks.results || []).find(row => row.entry_id !== id);
  if (clash) return json({ error: "One of those videos is already saved." }, 409);

  const now = Date.now();
  const statements = [];
  if (isUpdate) {
    const found = await db.prepare("SELECT id FROM entries WHERE id = ?").bind(id).first();
    if (!found) return json({ error: "Message not found." }, 404);
    statements.push(db.prepare("DELETE FROM entry_links WHERE entry_id = ?").bind(id));
    statements.push(db.prepare(
      "UPDATE entries SET text = ?, urls_json = ?, normalized_urls_json = ?, updated_at = ? WHERE id = ?"
    ).bind(data.text, JSON.stringify(data.urls), JSON.stringify(data.normalized), now, id));
  } else {
    statements.push(db.prepare(
      "INSERT INTO entries (id, text, urls_json, normalized_urls_json, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, data.text, JSON.stringify(data.urls), JSON.stringify(data.normalized), now));
  }
  for (const normalized of data.normalized) {
    statements.push(db.prepare("INSERT INTO entry_links (normalized_url, entry_id) VALUES (?, ?)").bind(normalized, id));
  }
  await db.batch(statements);
  return json({ entry: { id, text: data.text, urls: data.urls, updatedAt: now } }, isUpdate ? 200 : 201);
}

async function handleApi(request, env, pathname) {
  if (!env.DB) return json({ error: "Database is unavailable." }, 503);

  if (pathname === "/api/entries" && request.method === "GET") {
    return json({ entries: await listEntries(env.DB) });
  }
  if (pathname === "/api/entries" && request.method === "POST") {
    const payload = await request.json();
    const id = typeof payload?.id === "string" && payload.id ? payload.id : crypto.randomUUID();
    return saveEntry(env.DB, id, payload, false);
  }

  const match = pathname.match(/^\/api\/entries\/([^/]+)$/);
  if (match && request.method === "PUT") {
    return saveEntry(env.DB, decodeURIComponent(match[1]), await request.json(), true);
  }
  if (match && request.method === "DELETE") {
    const id = decodeURIComponent(match[1]);
    const result = await env.DB.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
    if (!result.meta?.changes) return json({ error: "Message not found." }, 404);
    return json({ ok: true });
  }
  return json({ error: "Not found." }, 404);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url.pathname);
      if (url.pathname !== "/") return new Response("Not found", { status: 404 });
      return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Unexpected error." }, 500);
    }
  },
};
