// Vercel Edge Function — resolves the visitor's country from Vercel's own
// edge network geolocation, with zero external API calls, no rate limits,
// and no cold start beyond the edge runtime itself.
//
// Vercel populates `x-vercel-ip-country` (an ISO 3166-1 alpha-2 code, e.g.
// "GB") on every request at the edge, for both Edge and Serverless
// Functions — see https://vercel.com/docs/edge-network/headers. This only
// exists on a real Vercel deployment (production or preview); it's absent
// in local dev, which callers must treat as "unknown" rather than assuming
// a default country.
export const config = { runtime: 'edge' };

export default function handler(req: Request): Response {
  const country = (req.headers.get('x-vercel-ip-country') || '').toUpperCase();

  return new Response(JSON.stringify({ country: country || null }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      // Country can change between requests (mobile networks, VPNs) and
      // this costs nothing to compute, so never let a CDN or the browser
      // cache a stale answer.
      'cache-control': 'no-store',
    },
  });
}
