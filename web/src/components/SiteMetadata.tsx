import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { renderSiteHead } from "../siteMetadata.ts";
export function SiteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.head.querySelectorAll("[data-fleet-seo]").forEach((node) => node.remove());
    const template = document.createElement("template");
    template.innerHTML = renderSiteHead(pathname === "/");
    document.head.append(template.content);
  }, [pathname]);
  return null;
}
