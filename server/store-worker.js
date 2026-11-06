// Deepwick's payment server for the web version: a Cloudflare Worker in front of Stripe Checkout.
//   POST /checkout {product}  → {url}: a Stripe payment page for one product of the game
//   POST /claim {session}     → {grant, sig}: once the session is paid, a grant for the game, signed with the
//                               server's private key (each session can be claimed once)
// The game checks the signature with the public key in package.json ("store.publicKey") and gives the pearls.
// Setup (see server/README.md):
//   secrets  STRIPE_KEY  – the Stripe secret key (sk_live_… or sk_test_…)
//            GRANT_KEY   – the private key (JWK) from `node server/keys.mjs`
//   vars     APP_URL     – where the game lives (the payment page returns there), e.g. https://oviiicek.github.io/loppo/
//            ALLOW_ORIGIN – the origin allowed to call the server, e.g. https://oviiicek.github.io
//            PRICE_<product> – the Stripe price id of every product, e.g. PRICE_pearls_50 = price_123…
//   KV       CLAIMS      – remembers the sessions already claimed

const json = (body, status, env) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': env.ALLOW_ORIGIN || '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });

async function stripe(env, method, path, form) {
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method,
    headers: { authorization: 'Bearer ' + env.STRIPE_KEY, 'content-type': 'application/x-www-form-urlencoded' },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'stripe ' + r.status);
  return data;
}

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** the grant's signature: ECDSA P-256 over "product|nonce|ts" (the game checks exactly this text) */
async function sign(env, g) {
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.GRANT_KEY), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${g.product}|${g.nonce}|${g.ts}`));
  return b64u(sig);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return json({}, 204, env);
    if (req.method !== 'POST') return json({ error: 'method' }, 405, env);
    const path = new URL(req.url).pathname;
    let body = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: 'body' }, 400, env);
    }
    try {
      if (path === '/checkout') {
        const product = String(body.product || '');
        const price = env['PRICE_' + product];
        if (!/^[a-z0-9_]{1,40}$/.test(product) || !price) return json({ error: 'product' }, 400, env);
        const app = env.APP_URL;
        const s = await stripe(env, 'POST', 'checkout/sessions', {
          mode: 'payment',
          'line_items[0][price]': price,
          'line_items[0][quantity]': '1',
          success_url: `${app}${app.includes('?') ? '&' : '?'}paid={CHECKOUT_SESSION_ID}`,
          cancel_url: app,
          'metadata[product]': product,
          locale: 'auto',
          // the buyer agrees to the terms (set their link in the Stripe dashboard) – digital goods start at once
          'consent_collection[terms_of_service]': 'required',
        });
        return json({ url: s.url }, 200, env);
      }
      if (path === '/claim') {
        const session = String(body.session || '');
        if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(session)) return json({ error: 'session' }, 400, env);
        if (await env.CLAIMS.get(session)) return json({ error: 'claimed' }, 409, env);
        const s = await stripe(env, 'GET', 'checkout/sessions/' + encodeURIComponent(session));
        if (s.payment_status !== 'paid') return json({ error: 'unpaid' }, 402, env);
        const product = s.metadata?.product;
        if (!product) return json({ error: 'product' }, 400, env);
        await env.CLAIMS.put(session, String(Date.now()));
        const grant = { product, nonce: session, ts: Date.now() };
        return json({ grant, sig: await sign(env, grant) }, 200, env);
      }
      return json({ error: 'path' }, 404, env);
    } catch (e) {
      return json({ error: String(e.message || e).slice(0, 200) }, 502, env);
    }
  },
};
