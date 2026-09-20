import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PRODUCT_NAME } from "../product.ts";
import { FleetMark } from "../components/FleetMark.tsx";
import { signIn, signUp } from "../authClient.ts";

type Mode = "sign-in" | "sign-up";

export function Login() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() =>
    searchParams.has("error")
      ? "GitHub sign-in was not completed. Please try again."
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [githubBusy, setGithubBusy] = useState(false);
  const navigate = useNavigate();

  async function signInWithGitHub() {
    setGithubBusy(true);
    setError(null);
    try {
      const result = await signIn.social({
        provider: "github",
        callbackURL: new URL("/app", window.location.origin).href,
        errorCallbackURL: new URL("/login", window.location.origin).href,
      });
      if (result.error) {
        setError(
          result.error.code === "PROVIDER_NOT_FOUND"
            ? "GitHub sign-in is not available yet. Please use email and password."
            : "Could not sign in with GitHub. Please try again.",
        );
        setGithubBusy(false);
      }
      // Better Auth redirects to GitHub on success. Stay disabled until then.
    } catch {
      setError("Could not reach the server.");
      setGithubBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || githubBusy) return;
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "sign-up"
          ? await signUp.email({ email, password, name: email.split("@")[0] })
          : await signIn.email({ email, password });
      if (result.error) {
        // Better Auth's own message says what is actually wrong — a weak
        // password, an address already taken — so it beats anything generic.
        setError(result.error.message ?? "Could not sign you in.");
        return;
      }
      navigate("/app");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="card">
        <Link to="/" className="brand">
          <FleetMark />
          {PRODUCT_NAME}
        </Link>
        <h1>{mode === "sign-up" ? "Create an account" : "Sign in"}</h1>
        <p className="sub">
          {mode === "sign-up"
            ? "You get a tenant of your own — agents, workflows and runs live inside it."
            : "Welcome back."}
        </p>

        {error ? <div className="error" role="alert">{error}</div> : null}

        <button
          className="btn github-sign-in"
          type="button"
          disabled={busy || githubBusy}
          onClick={signInWithGitHub}
        >
          {githubBusy ? "Redirecting to GitHub…" : "Continue with GitHub"}
        </button>
        <p className="auth-divider">or continue with email</p>

        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              required
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn" type="submit" disabled={busy || githubBusy}>
            {busy ? "Working…" : mode === "sign-up" ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="switch">
          {mode === "sign-up" ? "Already have an account? " : "No account yet? "}
          <button
            type="button"
            className="btn ghost"
            disabled={busy || githubBusy}
            style={{ padding: "2px 8px", fontSize: 13 }}
            onClick={() => {
              setMode(mode === "sign-up" ? "sign-in" : "sign-up");
              setError(null);
            }}
          >
            {mode === "sign-up" ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}
