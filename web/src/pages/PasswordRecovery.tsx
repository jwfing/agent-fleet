import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FleetMark } from "../components/FleetMark.tsx";
import { PRODUCT_NAME } from "../product.ts";
import { requestPasswordReset, resetPassword } from "../authClient.ts";

function RecoveryCard({ title, children }: { title: string; children: ReactNode }) {
  return <div className="auth"><div className="card">
    <Link to="/" className="brand"><FleetMark />{PRODUCT_NAME}</Link>
    <h1>{title}</h1>
    {children}
    <Link to="/login">Back to sign in</Link>
  </div></div>;
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || cooldown) return;
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      const result = await requestPasswordReset({
        email,
        redirectTo: new URL("/reset-password", window.location.origin).href,
      });
      if (result.error) {
        setError(result.error.code === "RESET_PASSWORD_DISABLED"
          ? "Password reset is currently unavailable. Please contact the site administrator."
          : "Could not request a reset email. Please try again later.");
      } else {
        setSent(true);
        setCooldown(60);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return <RecoveryCard title="Forgot password?">
    <p className="sub">Enter your email to request a password reset link.</p>
    {error ? <div className="error" role="alert">{error}</div> : null}
    {sent ? <p role="status">If an account exists for this address, a reset email will arrive shortly. Check your spam folder too.</p> : null}
    <form onSubmit={submit}>
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <button className="btn" disabled={busy || cooldown > 0} type="submit">
        {busy ? "Sending…" : cooldown ? `Send again in ${cooldown}s` : "Send reset link"}
      </button>
    </form>
  </RecoveryCard>;
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const invalidLink = !token || params.has("error") || invalid;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || invalidLink) return;
    setError(null);
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError("Use between 8 and 128 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = await resetPassword({ token: token!, newPassword: password });
      if (result.error) {
        if (["INVALID_TOKEN", "TOKEN_EXPIRED", "USER_NOT_FOUND"].includes(result.error.code ?? "")) setInvalid(true);
        else setError("Could not reset your password. Please try again.");
      } else {
        // Remove the consumed reset token from the current browser history entry.
        navigate("/login?passwordReset=1", { replace: true });
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return <RecoveryCard title="Reset password">
    {invalidLink ? <>
      <div className="error" role="alert">This reset link is invalid, expired, or already used.</div>
      <Link to="/forgot-password">Request a new reset link</Link>
    </> : <>
      <p className="sub">Choose a new password with 8–128 characters. You will need to sign in again on all devices.</p>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <form onSubmit={submit}>
        <label>New password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>Confirm password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Reset password"}</button>
      </form>
    </>}
  </RecoveryCard>;
}
