// After `vite build`: give every public page its own HTML file with its own
// title, description, canonical and social tags, and write the sitemap.
//
// The site is a single-page app, so without this every address is served
// the same index.html (the home page's title) until the app's script runs
// and sets the real one. Search engines and link previews often read the
// HTML before (or without) running it. Each page is written as
// dist/<path>.html; with "cleanUrls" (vercel.json) Vercel serves it at
// <path>, ahead of the catch-all rewrite to /index.html.
//
// Pages and wording: ../seo-pages.json (also read by app/seo.py).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const { site, pages } = JSON.parse(fs.readFileSync(path.join(root, 'seo-pages.json'), 'utf8'));

const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const shell = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

// Who Havlo is, for search engines (on every page).
const organisation = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${site}/#organization`,
      name: 'Havlo',
      url: `${site}/`,
      logo: `${site}/apple-touch-icon.png`,
      sameAs: [
        'https://www.facebook.com/profile.php?id=61586495581183',
        'https://www.instagram.com/heyhavlo/',
        'https://x.com/heyhavlo',
      ],
    },
    { '@type': 'WebSite', '@id': `${site}/#website`, name: 'Havlo', url: `${site}/`, publisher: { '@id': `${site}/#organization` } },
  ],
};

// The site's main sections, as plain links in the HTML of every page until
// the app takes over (a fraction of a second for a visitor). Crawlers
// reading the HTML see how the site is organised, including each Buy
// Abroad country page.
const sections = [
  ['Stale Listings', '/stale-listings'],
  ['For Sellers', '/stale-listings/seller'],
  ['For Estate Agents', '/stale-listings/agents'],
  ['Buy UK Property from Nigeria', '/buyabroad/uk'],
  ['Buy UK Property from Ghana', '/buyabroad/ghana'],
  ['Buy UK Property from Kenya', '/buyabroad/kenya'],
  ['Buy UK Property from Egypt', '/buyabroad/egypt'],
  ['Buy UK Property from South Africa', '/buyabroad/southafrica'],
  ['Browse UK Properties', '/buyabroad/uk/listings'],
  ['About Havlo', '/about-us'],
  ['Contact', '/contact-us'],
];
const nav =
  '<nav aria-label="Havlo" style="max-width:720px;margin:48px auto;padding:0 16px;font-family:Inter,Arial,sans-serif;color:#111">' +
  '<p style="font-weight:700;margin:0 0 12px">Havlo</p><ul style="list-style:none;padding:0;margin:0;line-height:2">' +
  sections.map(([label, href]) => `<li><a href="${href}" style="color:#111">${esc(label)}</a></li>`).join('') +
  '</ul></nav>';

function replaceTag(html, pattern, tag) {
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function pageHtml(page, { canonical }) {
  let html = shell;
  const title = esc(page.title);
  const description = esc(page.description);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  html = replaceTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${description}" />`);
  html = replaceTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}" />`);
  html = replaceTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${description}" />`);
  html = replaceTag(html, /<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${title}" />`);
  html = replaceTag(html, /<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${description}" />`);
  if (canonical) {
    const url = `${site}${page.path === '/' ? '/' : page.path}`;
    html = replaceTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`);
    html = replaceTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`);
  }
  html = html.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(organisation)}</script>\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${nav}</div>`);
  return html;
}

let written = 0;
for (const page of pages) {
  if (page.path === '/') continue;
  const file = path.join(dist, `${page.path}.html`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, pageHtml(page, { canonical: true }));
  written += 1;
}
// dist/index.html is both the home page and the fallback for every other
// address (/assess/seller, a listing...), so it gets the home wording and
// links but no canonical: each page sets its own once the app runs.
const home = pages.find((p) => p.path === '/');
fs.writeFileSync(path.join(dist, 'index.html'), pageHtml(home, { canonical: false }));

const today = new Date().toISOString().slice(0, 10);
const legal = new Set(['/terms', '/privacy-policy', '/cookie-policy']);
const urls = pages.map((page) => {
  const priority = page.path === '/' ? '1.0' : legal.has(page.path) ? '0.3' : page.path.startsWith('/buyabroad/') || page.path.startsWith('/stale-listings') ? '0.9' : '0.7';
  return `  <url>\n    <loc>${site}${page.path}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;
});
fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
);
console.log(`prerender-seo: ${written} pages + home, sitemap with ${pages.length} URLs`);
