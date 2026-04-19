"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../lib/firebase";

// ── Spinner ───────────────────────────────────────────────────
const Spinner = () => (
  <svg style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none">
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <circle style={{ opacity: 0.3 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path style={{ opacity: 0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

// ── LinkedIn Icon ─────────────────────────────────────────────
const LinkedInIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

// ── Main Content ──────────────────────────────────────────────
function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contact = searchParams.get("contact") || "";
  const phone = searchParams.get("phone") || "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [resending, setResending] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const refs = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    startTimer();
    setTimeout(() => refs.current[0]?.focus(), 100);
    return () => clearInterval(timerRef.current);
  }, []);

  const startTimer = () => {
    setResendTimer(30);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  // ── OTP handlers ─────────────────────────────────────────
  const handleChange = (val, i) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    setError("");
    if (val && i < 5) {
      refs.current[i + 1]?.focus();
      setFocusedIdx(i + 1);
    }
  };

  const handleKeyDown = (e, i) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      refs.current[i - 1]?.focus();
      setFocusedIdx(i - 1);
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      refs.current[5]?.focus();
      setFocusedIdx(5);
    }
  };

  // ── Verify ────────────────────────────────────────────────
  const handleVerify = async () => {
    setError("");
    const code = otp.join("");
    if (code.length < 6) { setError("Please enter the complete 6-digit code."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Incorrect code. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        refs.current[0]?.focus();
        setFocusedIdx(0);
        return;
      }
      // Sign into Firebase using the custom token returned by the server
      await signInWithCustomToken(auth, data.customToken);
      router.push("/");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Resend ────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact }),
      });
      if (!res.ok) throw new Error();
      setOtp(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
      setFocusedIdx(0);
      startTimer();
    } catch {
      setError("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // ── OTP box style ─────────────────────────────────────────
  const boxStyle = (i) => ({
    width: "48px",
    height: "56px",
    textAlign: "center",
    fontSize: "1.4rem",
    fontWeight: 700,
    color: "#000",
    background: "#fff",
    border: error
      ? "2px solid #e53e3e"
      : focusedIdx === i
        ? "2px solid #000"
        : otp[i]
          ? "2px solid #000"
          : "2px solid #e2e2e2",
    borderRadius: "8px",
    outline: "none",
    transition: "border-color 0.15s",
    caretColor: "#000",
    fontFamily: "inherit",
    flexShrink: 0,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

      {/* Navbar */}
      <header style={{ background: "#000", padding: "16px 28px" }}>
        <Link href="/" style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.04em", textDecoration: "none" }}>
          RideSync
        </Link>
      </header>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 16px" }}>
        <div style={{ width: "100%", maxWidth: "360px" }}>

          {/* Back */}
          <button
            onClick={() => router.push("/login")}
            style={{ background: "none", border: "none", color: "#717171", fontSize: "0.875rem", fontFamily: "inherit", cursor: "pointer", padding: 0, marginBottom: "28px", display: "flex", alignItems: "center", gap: "4px" }}
          >
            ← Back
          </button>

          {/* Heading */}
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#000", letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: "10px" }}>
            Enter the code
          </h1>
          <p style={{ color: "#717171", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "6px" }}>
            We sent a 6-digit code to
          </p>
          <p style={{ color: "#000", fontWeight: 700, fontSize: "0.9rem", marginBottom: "28px" }}>
            {contact}
          </p>

          {/* Phone badge */}
          {phone && (
            <div style={{ display: "inline-block", background: "#f5f5f5", borderRadius: "6px", padding: "4px 10px", fontSize: "0.8rem", color: "#555", marginBottom: "20px" }}>
              📱 {phone}
            </div>
          )}

          {/* OTP Boxes */}
          <div
            onPaste={handlePaste}
            style={{ display: "flex", gap: "10px", marginBottom: "20px", justifyContent: "center" }}
          >
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (refs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e.target.value, i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onFocus={() => setFocusedIdx(i)}
                style={boxStyle(i)}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p style={{ color: "#e53e3e", fontSize: "0.82rem", marginBottom: "14px" }}>
              {error}
            </p>
          )}

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={loading}
            style={{
              width: "100%",
              padding: "15px",
              background: "#000",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 700,
              fontFamily: "inherit",
              border: "none",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "20px",
              opacity: loading ? 0.6 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {loading ? <><Spinner /> Verifying…</> : "Verify & Continue"}
          </button>

          {/* Resend */}
          <p style={{ textAlign: "center", color: "#717171", fontSize: "0.875rem" }}>
            Didn't receive it?{" "}
            <button
              onClick={handleResend}
              disabled={resendTimer > 0 || resending}
              style={{
                background: "none",
                border: "none",
                fontSize: "0.875rem",
                fontFamily: "inherit",
                fontWeight: 700,
                padding: 0,
                cursor: resendTimer > 0 ? "not-allowed" : "pointer",
                color: resendTimer > 0 ? "#b0b0b0" : "#000",
                textDecoration: resendTimer === 0 ? "underline" : "none",
                textUnderlineOffset: "2px",
              }}
            >
              {resending ? "Sending…" : resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
            </button>
          </p>

          {/* Legal */}
          <p style={{ color: "#717171", fontSize: "0.72rem", lineHeight: 1.6, marginTop: "28px", textAlign: "center" }}>
            By continuing, you agree to RideSync's Terms and Privacy Policy.
          </p>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ padding: "20px 16px", borderTop: "1px solid #e2e2e2", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        <a
          href="https://www.linkedin.com/in/anushree-r-choudhary"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#b0b0b0", display: "flex", alignItems: "center", transition: "color 0.2s" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "#0077b5"}
          onMouseLeave={(e) => e.currentTarget.style.color = "#b0b0b0"}
        >
          <LinkedInIcon />
        </a>
        <p style={{ color: "#b0b0b0", fontSize: "0.75rem", fontFamily: "inherit", textAlign: "center" }}>
          © {new Date().getFullYear()} RideSync
        </p>
      </footer>

    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#fff" }} />}>
      <VerifyContent />
    </Suspense>
  );
}