/** Public identity shared by initial HTML and client-side navigation. */
export const SITE_URL = "https://fleet.elseward.xyz";
export const SEARCH_NAME = "Agent Fleet";
export const SITE_TITLE = "Agent Fleet | A2A AI Agent Workflow Orchestration";
export const SITE_DESCRIPTION = "Connect A2A-compatible AI agents, compose multi-agent workflows, and trace every run with Agent Fleet, an open-source orchestration gateway.";
export const SOCIAL_IMAGE = `${SITE_URL}/fleet-social.png`;
export const PRODUCT_SCHEMA = {
  "@context": "https://schema.org", "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#software`, name: SEARCH_NAME, alternateName: "Fleet",
  url: `${SITE_URL}/`, description: SITE_DESCRIPTION,
  applicationCategory: "DeveloperApplication", operatingSystem: "Web, Node.js",
  image: SOCIAL_IMAGE, license: "https://www.apache.org/licenses/LICENSE-2.0",
  sameAs: ["https://github.com/jwfing/agent-fleet"],
  featureList: ["A2A agent discovery", "Multi-agent workflow orchestration", "Run tracing", "Multi-tenant isolation"],
};
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function renderSiteHead(home: boolean) {
  const meta = (key: string, value: string, property = false) =>
    `<meta data-fleet-seo ${property ? "property" : "name"}="${key}" content="${escape(value)}" />`;
  if (!home) return `<title data-fleet-seo>Fleet Console</title>\n${meta("robots", "noindex, follow")}`;
  return [
    `<title data-fleet-seo>${escape(SITE_TITLE)}</title>`,
    meta("description", SITE_DESCRIPTION), meta("robots", "index, follow"),
    `<link data-fleet-seo rel="canonical" href="${SITE_URL}/" />`,
    meta("og:type", "website", true), meta("og:site_name", SEARCH_NAME, true),
    meta("og:title", SITE_TITLE, true), meta("og:description", SITE_DESCRIPTION, true),
    meta("og:url", `${SITE_URL}/`, true), meta("og:image", SOCIAL_IMAGE, true),
    meta("og:image:width", "1200", true), meta("og:image:height", "630", true),
    meta("og:image:alt", "Agent Fleet — connect agents, compose workflows, trace every run", true),
    meta("twitter:card", "summary_large_image"), meta("twitter:title", SITE_TITLE),
    meta("twitter:description", SITE_DESCRIPTION), meta("twitter:image", SOCIAL_IMAGE),
    meta("twitter:image:alt", "Agent Fleet workflow orchestration"),
    `<script data-fleet-seo type="application/ld+json">${JSON.stringify(PRODUCT_SCHEMA).replaceAll("<", "\\u003c")}</script>`,
  ].join("\n");
}
