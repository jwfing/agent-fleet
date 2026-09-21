import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Render the actual React page: crawlers and users receive identical copy.
const temporary = resolve("dist/.prerender");
await mkdir(temporary, { recursive: true });
try {
  const entry = resolve(temporary, "entry.mjs");
  await build({ entryPoints: ["web/src/entry-server.tsx"], outfile: entry,
    bundle: true, platform: "node", format: "esm", packages: "external",
    jsx: "automatic", loader: { ".css": "empty" } });
  const { renderLanding, renderSiteHead, SITE_URL } = await import(pathToFileURL(entry).href);
  const template = await readFile("dist/web/index.html", "utf8");
  if (!template.includes('<div id="root"></div>')) throw new Error("Missing prerender root");
  const markup = renderLanding();
  if ((markup.match(/<h1\b/g) ?? []).length !== 1) throw new Error("Landing must have exactly one H1");
  await writeFile("dist/web/app.html", template.replace(/<!--fleet:head:start-->[\s\S]*?<!--fleet:head:end-->/, renderSiteHead(false)));
  await writeFile("dist/web/index.html", template.replace('<div id="root"></div>', `<div id="root">${markup}</div>`));
  await writeFile("dist/web/robots.txt", `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /a2a/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  await writeFile("dist/web/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}/</loc></url></urlset>\n`);
  console.log(`Prerendered homepage (${Buffer.byteLength(markup)} bytes), console shell, robots.txt and sitemap.xml`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
