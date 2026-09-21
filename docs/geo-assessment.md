# Fleet search and AI discovery assessment

The supplied whatareyoubuild.ing report scored on-page readiness at 58/100 and
AI footprint at 16/100. Those are that service's measures, not Google rankings
or a general probability of being cited by an AI assistant.

## Findings

- **Initial HTML was empty:** confirmed by fetching the live homepage. React
  created the content only in the browser. The missing-H1 finding was a symptom
  of that delivery problem: the source component already contained an H1.
- **Metadata gaps were real:** the title was only “Fleet”; canonical, Open
  Graph, Twitter Card and structured data were missing.
- **AI footprint is a small sample:** one mention in 15 answers is noisy.
  The reported 50% share of voice is one of just two brand mentions, not 50%
  market visibility. Zero citations means this sample did not cite the site;
  it does not prove no AI system can find it.
- **Category fit needs improvement:** Zapier, Asana, Trello and Notion are not
  direct substitutes for an A2A gateway. Follow-up prompts should focus on A2A
  agent discovery, multi-agent orchestration, asynchronous workflows, tracing,
  and self-hosting. Preserve the original prompt set as a baseline rather than
  silently changing it and claiming an improved score.

## Implemented

1. Build-time rendering of the actual React homepage, followed by hydration.
   Both users and crawlers get the same content; there is no bot-only copy.
2. A descriptive single H1 and title, plus a plain-language product definition.
3. Canonical, Open Graph and Twitter metadata, including a real 1200 × 630 PNG.
4. SoftwareApplication JSON-LD with the product name, alternate name, URL,
   category, capabilities, license and source repository. No invented reviews,
   ratings, pricing or endorsements.
5. Visible answers about integration, long-running workflows and self-hosting,
   with links to implementation documentation and A2A compatibility limits.
6. Robots and sitemap files, a separate noindex authentication/console shell,
   and real 404s for unknown public paths.
7. Artifact validation, HTTP serving tests, hydration checks and metadata
   checks across client-side route changes.

## What the guide gets right, and where to be cautious

The [provided guide](https://www.whatareyoubuild.ing/geo-guide) usefully emphasizes
crawlability, useful answers, credible evidence and content maintenance.
Structured data can describe the product explicitly, but is not a guarantee of
AI inclusion. Google's [AI search guidance](https://developers.google.com/search/docs/appearance/ai-features)
states there is no special schema or additional machine-readable file required
for its AI features. Its [JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
supports prerendering because not every crawler executes JavaScript.

The guide's FAQ/HowTo recommendations should not be treated as a promise of
Google rich results. Use markup appropriate to real visible content. Similarly,
republishing your own promotional copy across platforms is not independent
evidence; earn useful third-party references through actual integrations and
documented examples. Google also cautions against focusing on special AI
markup and inauthentic mentions in its
[generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

## Follow-up measurement

- After deployment, rerun the on-page audit against the production HTML.
  Do not claim a new readiness score until that service measures it again.
- Submit `https://fleet.elseward.xyz/sitemap.xml` in the owner's Google Search
  Console account and inspect the homepage's indexing state.
- Track the same AI prompt set over time; report raw mention/citation counts,
  dates and engines alongside the scores. Add a separate set of more relevant
  A2A/orchestration questions for product-market discovery.
- Publish reproducible integration examples and workflow case studies with
  actual code, limitations and results. Avoid unsupported testimonials or
  mass-generated comparisons. Allow time for crawling and external discovery.

This change improves technical access and clarity. It does not promise a
particular search position, rich result or AI-footprint score.
