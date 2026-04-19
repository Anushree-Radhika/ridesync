"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

// ── Icons ─────────────────────────────────────────────────────
const LinkedInIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.84l6.09-6.09C34.46 3.09 29.5 1 24 1 14.82 1 7.07 6.48 3.64 14.22l7.1 5.52C12.4 13.67 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.1 24.5c0-1.64-.15-3.22-.42-4.74H24v8.98h12.42c-.54 2.9-2.18 5.36-4.65 7.02l7.1 5.52C43.18 37.4 46.1 31.4 46.1 24.5z"/>
    <path fill="#FBBC05" d="M10.74 28.26A14.5 14.5 0 0 1 9.5 24c0-1.48.26-2.9.74-4.26l-7.1-5.52A23.94 23.94 0 0 0 0 24c0 3.86.92 7.5 2.55 10.74l7.1-5.52z"/>
    <path fill="#34A853" d="M24 47c5.5 0 10.12-1.82 13.49-4.94l-7.1-5.52C28.55 38.28 26.38 39 24 39c-6.26 0-11.6-4.17-13.26-9.74l-7.1 5.52C7.07 42.52 14.82 47 24 47z"/>
  </svg>
);
 
const Spinner = () => (
  <svg style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none">
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <circle style={{ opacity: 0.3 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path style={{ opacity: 0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

function firebaseError(code, message) {
  const map = {
    "auth/popup-closed-by-user":         "Google sign-in was cancelled.",
    "auth/network-request-failed":       "Network error. Check your connection.",
    "auth/too-many-requests":            "Too many attempts. Try again later.",
    "auth/popup-blocked":                "Popup was blocked. Please allow popups for this site.",
    "auth/unauthorized-domain":          "This domain is not authorised in Firebase Console → Authentication → Settings → Authorised domains.",
    "auth/operation-not-allowed":        "Google Sign-In is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.",
  };
  return map[code] || `Error [${code}]: ${message || "Something went wrong."}`;
}

// ── Main ──────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();

  const [email, setEmail]           = useState("");
  const [emailError, setEmailError] = useState("");

  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError]     = useState("");

  // ── Send OTP helper ───────────────────────────────────────
  const sendOTP = async (contact) => {
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send OTP.");
    return data;
  };

  // ── Send OTP ───────────────────────────────────
  const handleEmailContinue = async () => {
    setEmailError("");
    const val = email.trim();
    if (!val) { setEmailError("Please enter your email."); return; }
    if (!/\S+@\S+\.\S+/.test(val)) { setEmailError("Please enter a valid email."); return; }
    setLoading(true);
    try {
      await sendOTP(val);
      router.push(`/verify?contact=${encodeURIComponent(val)}`);
    } catch (err) {
      setEmailError(err.message);
    } finally {
      setLoading(false);
    }
  };
const handleGoogle = async () => {
  setGoogleError("");
  setGoogleLoading(true);
  try {
    await signInWithGoogle();
    router.push("/");
  } catch (err) {
    console.log("GOOGLE ERROR CODE:", err.code);
    console.log("GOOGLE ERROR MSG:", err.message);
    setGoogleError(firebaseError(err.code));
  } finally {
    setGoogleLoading(false);
  }
};

  const busy = loading || googleLoading;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .page { min-height: 100vh; background: #fff; display: flex; flex-direction: column; }
        .navbar { background: #000; padding: 16px 28px; }
        .logo { color: #fff; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.04em; text-decoration: none; }
        .main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 16px; }
        .card { width: 100%; max-width: 360px; }
        .heading { font-size: 1.7rem; font-weight: 600; color: #000; letter-spacing: -0.03em; line-height: 1.2; margin-bottom: 8px; }
        .subtext { color: #717171; font-size: 0.875rem; margin-bottom: 24px; line-height: 1.5; }
        .tabs { display: flex; border: 1.5px solid #e2e2e2; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
        .tab-btn { flex: 1; padding: 11px; font-size: 0.9rem; font-weight: 600; font-family: inherit; border: none; cursor: pointer; transition: background 0.15s, color 0.15s; background: #fff; color: #717171; line-height: 1; }
        .tab-btn.active { background: #000; color: #fff; }
        .tab-btn:first-child { border-right: 1.5px solid #e2e2e2; }
        .input-label { font-size: 0.75rem; font-weight: 600; color: #555; display: block; margin-bottom: 6px; }
        .input-field { width: 100%; padding: 14px 16px; border: 1.5px solid #e2e2e2; border-radius: 8px; outline: none; font-size: 1rem; font-family: inherit; color: #000; background: #fff; margin-bottom: 12px; transition: border-color 0.15s; }
        .input-field:focus { border-color: #000; }
        .input-field.errored { border-color: #e53e3e; margin-bottom: 6px; }
        .input-error { color: #e53e3e; font-size: 0.8rem; margin-bottom: 10px; }
        .back-btn { background: none; border: none; cursor: pointer; color: #717171; font-size: 0.85rem; font-family: inherit; padding: 0; margin-bottom: 20px; display: flex; align-items: center; gap: 4px; transition: color 0.15s; }
        .back-btn:hover { color: #000; }
        .info-box { background: #f5f5f5; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 0.82rem; color: #555; line-height: 1.5; }
        .info-box strong { color: #000; }
        .btn-primary { width: 100%; padding: 15px; background: #000; color: #fff; font-size: 1rem; font-weight: 600; font-family: inherit; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 20px; transition: background 0.15s, opacity 0.15s; }
        .btn-primary:hover:not(:disabled) { background: #222; }
        .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
        .divider { display: flex; align-items: center; gap: 12px; margin: 4px 0 16px; }
        .divider-line { flex: 1; height: 1px; background: #e2e2e2; }
        .divider-text { color: #717171; font-size: 0.8rem; }
        .btn-sso { width: 100%; padding: 14px; background: #f5f5f5; color: #000; font-size: 0.95rem; font-weight: 500; font-family: inherit; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: background 0.15s; }
        .btn-sso:hover:not(:disabled) { background: #ebebeb; }
        .btn-sso:disabled { opacity: 0.5; cursor: not-allowed; }
        .signup-row { text-align: center; margin-top: 20px; font-size: 0.875rem; color: #717171; }
        .signup-row a { color: #000; font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
        .error-banner { color: #e53e3e; font-size: 0.8rem; margin-top: 8px; text-align: center; }
        .legal { color: #717171; font-size: 0.72rem; line-height: 1.6; margin-top: 20px; text-align: center; }
        .footer { padding: 20px 16px; border-top: 1px solid #e2e2e2; display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: auto; }
        .footer-icon-link { color: #b0b0b0; display: flex; align-items: center; transition: color 0.2s; }
        .footer-text { color: #b0b0b0; font-size: 0.75rem; font-family: inherit; text-align: center; }
      `}</style>

      <div className="page">
        <header className="navbar">
          <Link href="/" className="logo">RideSync</Link>
        </header>

        <main className="main">
          <div className="card">

                <h1 className="heading">What's your email?</h1>
                <p className="subtext">We'll send a 6-digit code to verify you.</p>

                <label className="input-label">Email address</label>
                <input
                  type="email"
                  className={`input-field${emailError ? " errored" : ""}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailContinue()}
                />
                {emailError && <p className="input-error">{emailError}</p>}

                <button className="btn-primary" onClick={handleEmailContinue} disabled={busy}>
                  {loading ? <><Spinner /> Sending OTP…</> : "Continue"}
                </button>
                <div className="divider">
                      <div className="divider-line" /><span className="divider-text">or</span><div className="divider-line" />
                    </div>

                    <button className="btn-sso" onClick={handleGoogle} disabled={busy}>
                      {googleLoading ? <Spinner /> : <GoogleIcon />}
                      {googleLoading ? "Connecting…" : "Continue with Google"}
                    </button>
                    {googleError && <p className="error-banner">{googleError}</p>}

                <p className="signup-row">
                  Don't have an account? <Link href="/signup">Sign Up</Link>
                </p>
                <p className="legal">
                  By continuing, you agree to RideSync's Terms and Privacy Policy.
                </p>

          </div>
        </main>

        <footer className="footer">
          <a
            href="https://www.linkedin.com/in/anushree-r-choudhary"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-icon-link"
            onMouseEnter={(e) => e.currentTarget.style.color = "#0077b5"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#b0b0b0"}
          >
            <LinkedInIcon />
          </a>
          <p className="footer-text">© {new Date().getFullYear()} RideSync</p>
        </footer>
      </div>
    </>
  );
}