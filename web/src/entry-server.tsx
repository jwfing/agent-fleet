import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { Landing } from "./pages/Landing.tsx";
export { renderSiteHead, SITE_URL } from "./siteMetadata.ts";
export function renderLanding() {
  return renderToString(<StaticRouter location="/"><Landing /></StaticRouter>);
}
