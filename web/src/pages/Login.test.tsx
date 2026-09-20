// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Login } from "./Login.tsx";
import { signIn } from "../authClient.ts";

vi.mock("../authClient.ts", () => ({
  signIn: { social: vi.fn(), email: vi.fn() },
  signUp: { email: vi.fn() },
}));

afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

function renderLogin(path = "/login") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<p>Fleet console</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GitHub sign-in", () => {
  it.each([false, true])("starts OAuth without email/password (registration: %s)", async (register) => {
    vi.mocked(signIn.social).mockResolvedValue({ data: { url: "https://github.com/login/oauth/authorize", redirect: true }, error: null } as never);
    renderLogin();
    if (register) fireEvent.click(screen.getByRole("button", { name: "Create one" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
    await waitFor(() => expect(signIn.social).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: `${window.location.origin}/app`,
      errorCallbackURL: `${window.location.origin}/login`,
    }));
    expect((screen.getByRole("button", { name: "Redirecting to GitHub…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(signIn.email).not.toHaveBeenCalled();
  });

  it("allows retry and email sign-in when GitHub is not configured", async () => {
    vi.mocked(signIn.social).mockResolvedValue({ data: null, error: { code: "PROVIDER_NOT_FOUND" } } as never);
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Please use email and password");
    expect((screen.getByRole("button", { name: "Continue with GitHub" }) as HTMLButtonElement).disabled).toBe(false);
    vi.mocked(signIn.email).mockResolvedValue({ data: {}, error: null } as never);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "dev@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse-battery" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Fleet console")).toBeTruthy();
  });

  it("recovers from network failures", async () => {
    vi.mocked(signIn.social).mockRejectedValue(new Error("offline"));
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Could not reach the server.");
    expect((screen.getByRole("button", { name: "Continue with GitHub" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("explains cancelled authorization without displaying untrusted query text", () => {
    renderLogin("/login?error=access_denied&error_description=untrusted");
    expect(screen.getByRole("alert").textContent).toBe("GitHub sign-in was not completed. Please try again.");
    expect(screen.queryByText("untrusted")).toBeNull();
  });
});
