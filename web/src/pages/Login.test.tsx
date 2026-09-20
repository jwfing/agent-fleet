// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Login } from "./Login.tsx";
import { signIn, signUp, sendVerificationEmail } from "../authClient.ts";

vi.mock("../authClient.ts", () => ({
  signIn: { social: vi.fn(), email: vi.fn() },
  signUp: { email: vi.fn() },
  sendVerificationEmail: vi.fn(),
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

describe("Email verification", () => {
  function fillCredentials() {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "dev@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse-battery" } });
  }

  it("shows the inbox prompt instead of opening the console when signup has no session", async () => {
    vi.mocked(signUp.email).mockResolvedValue({ data: { token: null }, error: null } as never);
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Create one" }));
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect((await screen.findByRole("status")).textContent).toContain("Check your inbox");
    expect(screen.queryByText("Fleet console")).toBeNull();
    expect(signUp.email).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: `${window.location.origin}/login?verified=1` }));
    expect((screen.getByRole("button", { name: "Resend in 60s" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lets an unverified user request a new link", async () => {
    vi.mocked(signIn.email).mockResolvedValue({ data: null, error: { code: "EMAIL_NOT_VERIFIED" } } as never);
    vi.mocked(sendVerificationEmail).mockResolvedValue({ data: { status: true }, error: null } as never);
    renderLogin();
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resend verification email" }));
    await waitFor(() => expect(sendVerificationEmail).toHaveBeenCalledWith({ email: "dev@example.com", callbackURL: `${window.location.origin}/login?verified=1` }));
    expect((await screen.findByRole("status")).textContent).toContain("If this address needs verification");
  });

  it.each(["invalid_token", "INVALID_TOKEN", "TOKEN_EXPIRED"])("explains %s even when the callback also contains a success marker", (error) => {
    renderLogin(`/login?verified=1&error=${error}`);
    expect(screen.getByRole("alert").textContent).toContain("invalid or expired");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the verified prompt without signing the user in", () => {
    renderLogin("/login?verified=1");
    expect(screen.getByRole("status").textContent).toBe("Email verified. You can now sign in.");
    expect(screen.queryByText("Fleet console")).toBeNull();
  });

  it("keeps email registration working when verification is disabled", async () => {
    vi.mocked(signUp.email).mockResolvedValue({ data: { token: "session" }, error: null } as never);
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Create one" }));
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Fleet console")).toBeTruthy();
  });

  it("handles a rejected resend request and allows retry", async () => {
    vi.mocked(signIn.email).mockResolvedValue({ data: null, error: { code: "EMAIL_NOT_VERIFIED" } } as never);
    vi.mocked(sendVerificationEmail).mockResolvedValue({ data: null, error: { status: 429 } } as never);
    renderLogin();
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resend verification email" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("try again later"));
    expect((screen.getByRole("button", { name: "Resend verification email" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
