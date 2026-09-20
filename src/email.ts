import nodemailer from "nodemailer";
import { createLogger } from "./logger.js";

/** No SMTP configuration preserves local email/password development. Partial
 * configuration fails startup rather than silently disabling verification. */
export function createAuthEmailSenders(env: NodeJS.ProcessEnv = process.env) {
  const fields = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"] as const;
  if (!fields.some((key) => env[key]?.trim())) return undefined;
  for (const key of fields) {
    if (!env[key]?.trim()) throw new Error(`Missing ${key} for verification email`);
  }
  const port = Number(env.SMTP_PORT || "465");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be an integer between 1 and 65535");
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST!.trim(),
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: env.SMTP_USER!.trim(), pass: env.SMTP_PASSWORD! },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const from = env.SMTP_FROM!.trim();
  const log = createLogger();

  const send = (email: string, subject: string, text: string) => {
    // SMTP latency must not disclose whether an account exists. This is a
    // persistent Node server; failures are handled without logging credentials,
    // recipient addresses, verification tokens, or provider response bodies.
    void transport.sendMail({
      from,
      to: { address: email, name: "" },
      subject,
      text,
    }).catch(() => {
      log.error("Auth email delivery failed; check SMTP configuration and provider availability");
    });
  };
  return {
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
      send(user.email, "Verify your Fleet email address",
        `Verify your email address to sign in to Fleet:\n\n${url}\n\nThis link expires in 1 hour. If you did not request this email, you can ignore it.`);
    },
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      send(user.email, "Reset your Fleet password",
        `Choose a new password for your Fleet account:\n\n${url}\n\nThis link expires in 30 minutes and can only be used once. If you did not request a password reset, ignore this email. Your password will remain unchanged.`);
    },
  };
}
