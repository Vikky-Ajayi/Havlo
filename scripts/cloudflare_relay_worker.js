// Havlo Rightmove outbound relay (free workaround for Railway's IP-reputation block)
// ---------------------------------------------------------------------------------
// Confirmed via A/B testing (see app/services/rightmove_scraper.py,
// build_proxied_request): Rightmove serves degraded, poorly-sorted search
// results specifically to Railway's outbound IP. The identical request from
// any other IP gets correctly sorted results. This Worker exists purely to
// make that "any other IP" -- it forwards one URL and returns the response
// verbatim, running on Cloudflare's free tier (no card required, ~3M
// requests/month free).
//
// Deploy:
//   1. dash.cloudflare.com -> sign up free (no card) -> Workers & Pages
//      -> Create -> Create Worker -> give it a name -> Deploy.
//   2. Click "Edit code", replace the default script with this file's
//      contents, click "Deploy".
//   3. Settings -> Variables -> add an encrypted variable named RELAY_TOKEN
//      set to any random string you make up (this stops randoms who find
//      your *.workers.dev URL from using it as an open proxy).
//   4. Copy the Worker's URL (https://<name>.<subdomain>.workers.dev) and
//      the RELAY_TOKEN value into Railway as SCRAPE_RELAY_URL and
//      SCRAPE_RELAY_TOKEN on the backend service, then redeploy.

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const target = incoming.searchParams.get("url");
    const token = incoming.searchParams.get("token");

    if (env.RELAY_TOKEN && token !== env.RELAY_TOKEN) {
      return new Response("Forbidden", { status: 403 });
    }
    if (!target) {
      return new Response("Missing url param", { status: 400 });
    }

    let upstream;
    try {
      upstream = await fetch(target, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-GB,en;q=0.9",
        },
        redirect: "follow",
      });
    } catch (err) {
      return new Response(`Relay fetch failed: ${err}`, { status: 502 });
    }

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
};
