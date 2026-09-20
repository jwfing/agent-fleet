import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthEmailSenders } from "../src/email.js";
import { createAuth } from "../src/auth.js";

const { sendMail, logError } = vi.hoisted(() => ({ sendMail: vi.fn(), logError: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => ({ sendMail })) } }));
vi.mock("../src/logger.js", () => ({ createLogger: () => ({ error: logError }) }));
const smtp = {
  SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "465", SMTP_USER: "sender@gmail.com",
  SMTP_PASSWORD: "app-password", SMTP_FROM: "Fleet <sender@gmail.com>",
};

beforeEach(() => {
  vi.clearAllMocks();
  sendMail.mockResolvedValue({ accepted: ["user@example.com"] });
});
afterEach(() => vi.unstubAllEnvs());

describe("SMTP verification delivery", () => {
  it("leaves verification disabled without SMTP and rejects partial configuration", () => {
    expect(createAuthEmailSenders({})).toBeUndefined();
    expect(() => createAuthEmailSenders({ SMTP_HOST: "smtp.gmail.com" })).toThrow("SMTP_USER");
    expect(() => createAuthEmailSenders({ ...smtp, SMTP_PORT: "invalid" })).toThrow("SMTP_PORT");
  });

  it.each([465, 587])("uses encrypted delivery on port %i and sends the verification link", async (port) => {
    const sender = createAuthEmailSenders({ ...smtp, SMTP_PORT: String(port) })!;
    await sender.sendVerificationEmail({ user: { email: "user@example.com" }, url: "https://fleet.example/api/auth/verify-email?token=test" });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      port, secure: port === 465, requireTLS: port !== 465,
      auth: { user: smtp.SMTP_USER, pass: smtp.SMTP_PASSWORD },
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: smtp.SMTP_FROM, to: { address: "user@example.com", name: "" },
      text: expect.stringContaining("https://fleet.example/api/auth/verify-email?token=test"),
    }));
  });

  it("handles delivery errors without leaking SMTP responses or verification links", async () => {
    sendMail.mockRejectedValue(new Error("secret-provider-response"));
    await createAuthEmailSenders(smtp)!.sendVerificationEmail({ user: { email: "private@example.com" }, url: "https://fleet.example/?token=secret" });
    await vi.waitFor(() => expect(logError).toHaveBeenCalledOnce());
    expect(JSON.stringify(logError.mock.calls)).not.toMatch(/secret|private@example/);
  });
});

describe("Better Auth verification flow", () => {
  it("blocks unverified login, supports resend, verifies the link, then permits login", async () => {
    for (const [key, value] of Object.entries(smtp)) vi.stubEnv(key, value);
    const origin = "http://localhost:5173";
    // Use the application's actual auth options with an isolated in-memory DB.
    const options = createAuth({ connectionString: "postgres://localhost/test?sslmode=disable", baseURL: origin }).options;
    const db: Parameters<typeof memoryAdapter>[0] = { auth_user: [], auth_account: [], auth_session: [], auth_verification: [] };
    const auth = betterAuth({
      ...options,
      secret: "test-only-secret-with-at-least-thirty-two-characters",
      database: memoryAdapter(db),
      rateLimit: { enabled: false },
      advanced: { ...options.advanced, disableOriginCheck: false, disableCSRFCheck: false },
    });
    const post = (path: string, body: object) => auth.handler(new Request(`${origin}/api/auth/${path}`, {
      method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body),
    }));
    const credentials = { email: "user@example.com", password: "correct-horse-battery" };
    const callbackURL = `${origin}/login?verified=1`;
    const signup = await post("sign-up/email", { ...credentials, name: "User", callbackURL });
    expect(signup.status).toBe(200);
    expect((await signup.json()).token).toBeNull();
    expect(sendMail).toHaveBeenCalledOnce();
    const denied = await post("sign-in/email", credentials);
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe("EMAIL_NOT_VERIFIED");
    expect(sendMail).toHaveBeenCalledOnce();

    const resend = await post("send-verification-email", { email: credentials.email, callbackURL });
    expect(resend.status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(2);
    const mail = sendMail.mock.calls[1][0];
    const link = mail.text.match(/https?:\/\/\S+/)[0];
    expect(new URL(link).searchParams.get("callbackURL")).toBe(callbackURL);
    const verified = await auth.handler(new Request(link));
    expect(verified.status).toBe(302);
    expect(verified.headers.get("location")).toBe(callbackURL);
    const login = await post("sign-in/email", credentials);
    expect(login.status).toBe(200);
    expect((await login.json()).user.emailVerified).toBe(true);

    const invalid = await auth.handler(new Request(`${origin}/api/auth/verify-email?token=invalid&callbackURL=${encodeURIComponent(callbackURL)}`));
    expect(invalid.headers.get("location")).toContain("error=INVALID_TOKEN");
    const unknown = await post("send-verification-email", { email: "unknown@example.com", callbackURL });
    expect(unknown.status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(2);

    const redirectTo = `${origin}/reset-password`;
    const request = await post("request-password-reset", { email: credentials.email, redirectTo });
    expect(request.status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(3);
    const resetMail = sendMail.mock.calls[2][0];
    expect(resetMail.subject).toBe("Reset your Fleet password");
    expect(resetMail.text).toContain("30 minutes");
    const resetLink = resetMail.text.match(/https?:\/\/\S+/)[0];
    const resetCallback = await auth.handler(new Request(resetLink));
    expect(resetCallback.status).toBe(302);
    const location = new URL(resetCallback.headers.get("location")!);
    expect(location.pathname).toBe("/reset-password");
    const token = location.searchParams.get("token");
    expect(token).toBeTruthy();
    const newPassword = "a-new-correct-horse-battery";
    const weak = await post("reset-password", { token, newPassword: "short" });
    expect(weak.status).toBe(400);
    expect((await weak.json()).code).toBe("PASSWORD_TOO_SHORT");
    const reset = await post("reset-password", { token, newPassword });
    expect(reset.status).toBe(200);
    const replay = await post("reset-password", { token, newPassword: "another-password" });
    expect(replay.status).toBe(400);
    expect((await replay.json()).code).toBe("INVALID_TOKEN");
    expect((await post("sign-in/email", credentials)).status).toBe(401);
    expect((await post("sign-in/email", { ...credentials, password: newPassword })).status).toBe(200);

    const oldCookie = login.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
    const oldSession = await auth.handler(new Request(`${origin}/api/auth/get-session`, { headers: { cookie: oldCookie } }));
    expect(await oldSession.json()).toBeNull();

    const unknownReset = await post("request-password-reset", { email: "unknown@example.com", redirectTo });
    expect(unknownReset.status).toBe(200);
    expect(await unknownReset.json()).toEqual(await request.json());
    expect(sendMail).toHaveBeenCalledTimes(3);
    const untrusted = await post("request-password-reset", { email: credentials.email, redirectTo: "https://untrusted.example/reset-password" });
    expect(untrusted.status).toBe(403);

    await post("request-password-reset", { email: credentials.email, redirectTo });
    const expiredLink = sendMail.mock.calls[3][0].text.match(/https?:\/\/\S+/)[0];
    const expiredToken = new URL(expiredLink).pathname.split("/").at(-1);
    const stored = db.auth_verification.find((row) => row.identifier === `reset-password:${expiredToken}`);
    expect(stored).toBeTruthy();
    stored!.expiresAt = new Date(0);
    const expiredCallback = await auth.handler(new Request(expiredLink));
    expect(expiredCallback.headers.get("location")).toContain("error=INVALID_TOKEN");
    expect((await post("reset-password", { token: expiredToken, newPassword })).status).toBe(400);
  });
});
