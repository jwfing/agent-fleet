// @vitest-environment jsdom
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { MemoryRouter, Link, Route, Routes } from "react-router-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { renderLanding } from "../entry-server.tsx";
import { Landing } from "./Landing.tsx";
import { SiteMetadata } from "../components/SiteMetadata.tsx";
import { SITE_TITLE, renderSiteHead } from "../siteMetadata.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.head.querySelectorAll("[data-fleet-seo]").forEach((node) => node.remove());
});

it("hydrates the actual prerendered homepage without replacing its H1 or reporting a mismatch", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  const container = document.createElement("div");
  container.innerHTML = renderLanding();
  document.body.append(container);
  const heading = container.querySelector("h1");
  expect(heading?.textContent).toBe("Fleet: AI agent workflow orchestration");
  expect(container.querySelectorAll("h1")).toHaveLength(1);
  expect(container.textContent).toContain("What is Agent Fleet?");
  const recoverable = vi.fn();
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, <MemoryRouter><Landing /></MemoryRouter>, { onRecoverableError: recoverable });
  });
  expect(recoverable).not.toHaveBeenCalled();
  expect(container.querySelector("h1")).toBe(heading);
  await act(async () => root.unmount());
  container.remove();
});

it("keeps homepage metadata out of login routes and restores it on SPA navigation", () => {
  render(<MemoryRouter><SiteMetadata /><Routes>
    <Route path="/" element={<Link to="/login">Sign in</Link>} />
    <Route path="/login" element={<Link to="/">Home</Link>} />
  </Routes></MemoryRouter>);
  expect(document.title).toBe(SITE_TITLE);
  expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
  fireEvent.click(screen.getByText("Sign in"));
  expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, follow");
  expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  fireEvent.click(screen.getByText("Home"));
  expect(document.title).toBe(SITE_TITLE);
  expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
});

it("publishes factual software metadata without invented ratings or offers", () => {
  const parsed = new DOMParser().parseFromString(renderSiteHead(true), "text/html");
  const data = JSON.parse(parsed.querySelector('script[type="application/ld+json"]')!.textContent!);
  expect(data["@type"]).toBe("SoftwareApplication");
  expect(data.name).toBe("Agent Fleet");
  expect(data.aggregateRating).toBeUndefined();
  expect(data.offers).toBeUndefined();
});
