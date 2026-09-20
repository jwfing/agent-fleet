// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ForgotPassword, ResetPassword } from "./PasswordRecovery.tsx";
import { Login } from "./Login.tsx";
import { requestPasswordReset, resetPassword } from "../authClient.ts";

vi.mock("../authClient.ts", () => ({
  requestPasswordReset: vi.fn(), resetPassword: vi.fn(),
  signIn: {}, signUp: {}, sendVerificationEmail: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

function page(path: string) {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/login" element={<Login />} />
  </Routes></MemoryRouter>);
}

describe("password recovery", () => {
  it("opens from the login page and requests a reset without revealing whether the account exists", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ data: { status: true }, error: null } as never);
    page("/login");
    fireEvent.click(screen.getByRole("link", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect((await screen.findByRole("status")).textContent).toContain("If an account exists");
    expect(requestPasswordReset).toHaveBeenCalledWith({ email: "user@example.com", redirectTo: `${window.location.origin}/reset-password` });
    expect((screen.getByRole("button", { name: "Send again in 60s" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["/reset-password", "/reset-password?error=INVALID_TOKEN", "/reset-password?token=bad&error=INVALID_TOKEN"])("rejects missing or invalid links: %s", (path) => {
    page(path);
    expect(screen.getByRole("alert").textContent).toContain("invalid, expired, or already used");
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.getByRole("link", { name: "Request a new reset link" }).getAttribute("href")).toBe("/forgot-password");
  });

  it("checks confirmation and returns to login after a successful reset", async () => {
    vi.mocked(resetPassword).mockResolvedValue({ data: { status: true }, error: null } as never);
    page("/reset-password?token=test-token");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-long-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("alert").textContent).toBe("Passwords do not match.");
    expect(resetPassword).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "new-long-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect((await screen.findByRole("status")).textContent).toBe("Password reset. Sign in with your new password.");
    expect(resetPassword).toHaveBeenCalledWith({ token: "test-token", newPassword: "new-long-password" });
  });

  it("offers a fresh link when the server rejects an expired token", async () => {
    vi.mocked(resetPassword).mockResolvedValue({ data: null, error: { code: "INVALID_TOKEN" } } as never);
    page("/reset-password?token=expired");
    for (const label of ["New password", "Confirm password"]) fireEvent.change(screen.getByLabelText(label), { target: { value: "new-long-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect((await screen.findByRole("alert")).textContent).toContain("already used");
    expect(screen.queryByLabelText("New password")).toBeNull();
  });

  it("handles network failures and allows retry", async () => {
    vi.mocked(requestPasswordReset).mockRejectedValue(new Error("offline"));
    page("/forgot-password");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Could not reach the server."));
    expect((screen.getByRole("button", { name: "Send reset link" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
