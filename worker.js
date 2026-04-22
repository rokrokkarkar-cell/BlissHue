/**
 * Bliss Hue Café — Cloudflare Worker KV API
 * 
 * Routes:
 *   GET  /api/edits?page=index   → returns saved edits JSON for that page
 *   POST /api/edits?page=index   → saves edits JSON for that page
 * 
 * KV Binding: BLISSHUE_EDITS  (set in wrangler.toml or Cloudflare dashboard)
 */

const ALLOWED_PAGES = ['index', 'order'];

// ── CORS headers — update ALLOWED_ORIGIN to your actual Pages domain ──
const ALLOWED_ORIGIN = 'https://your-site.pages.dev'; // ← CHANGE THIS

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN || origin?.endsWith('.pages.dev');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') ?? '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Only handle /api/edits
    if (url.pathname !== '/api/edits') {
      return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
    }

    const page = url.searchParams.get('page');
    if (!ALLOWED_PAGES.includes(page)) {
      return new Response(JSON.stringify({ error: 'Invalid page' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const kvKey = `edits:${page}`;

    // ── GET: load edits ──
    if (request.method === 'GET') {
      const value = await env.BLISSHUE_EDITS.get(kvKey);
      return new Response(value ?? '{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // ── POST: save edits ──
    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }

      // Basic sanity: must be a flat object of string values
      if (typeof body !== 'object' || Array.isArray(body)) {
        return new Response(JSON.stringify({ error: 'Body must be a JSON object' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }

      await env.BLISSHUE_EDITS.put(kvKey, JSON.stringify(body));
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
  },
};
