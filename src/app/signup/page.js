"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

// ── Icons ─────────────────────────────────────────────────────
const LinkedInIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

// ── Main ──────────────────────────────────────────────────────
export default function SignupPage() {
  const router = useRouter();
  const { signUpWithEmail } = useAuth();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [focused, setFocused] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
  };

  // ── Input style ───────────────────────────────────────────
  const inputStyle = (field) => ({
    width: "100%",
    background: "#f3f3f3",
    border: "none",
    outline: focused === field ? "2px solid #000" : "2px solid transparent",
    borderRadius: "8px",
    padding: "16px",
    fontSize: "1rem",
    color: "#000",
    marginBottom: "12px",
    boxSizing: "border-box",
    transition: "outline 0.15s",
    fontFamily: "inherit",
  });

  // ── Step 1 validation ─────────────────────────────────────
  const handleNextStep = () => {
    setError("");
    if (!form.fullName.trim()) return setError("Please enter your full name.");
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return setError("Please enter a valid email address.");
    setStep(2);
  };

  // ── Step 2: Create account ────────────────────────────────
  const handleSignup = async () => {
    setError("");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    try {
      await signUpWithEmail(form.email, form.password, form.fullName);
      router.push("/");
    } catch (err) {
      if (err.code === "auth/email-already-in-use")
        setError("An account with this email already exists.");
      else
        setError(err.message || "Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column" }}>

      {/* Navbar */}
      <header style={{ background: "#000", padding: "14px 28px" }}>
        <Link href="/" style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 700, textDecoration: "none", letterSpacing: "-0.02em" }}>
          RideSync
        </Link>
      </header>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={{ width: "100%", maxWidth: "380px" }}>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
            {[1, 2].map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: step >= s ? "#000" : "#e5e5e5",
                  color: step >= s ? "#fff" : "#aaa",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", fontWeight: 700, transition: "background 0.2s",
                }}>
                  {step > s ? "✓" : s}
                </div>
                <span style={{ fontSize: "0.75rem", color: step >= s ? "#000" : "#aaa", fontWeight: step >= s ? 600 : 400 }}>
                  {s === 1 ? "Your details" : "Set password"}
                </span>
                {s < 2 && <div style={{ width: "32px", height: "1px", background: step > 1 ? "#000" : "#e5e5e5" }} />}
              </div>
            ))}
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              <h1 style={{ fontSize: "1.8rem", fontWeight: 600, color: "#000", marginBottom: "8px", lineHeight: 1.2 }}>
                Create your account
              </h1>
              <p style={{ color: "#777", fontSize: "0.875rem", marginBottom: "28px" }}>
                Enter your details to get started
              </p>

              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#555", display: "block", marginBottom: "6px" }}>Full name</label>
              <input type="text" placeholder="Enter your full name" value={form.fullName} onChange={handleChange("fullName")} onFocus={() => setFocused("fullName")} onBlur={() => setFocused("")} style={inputStyle("fullName")} />

              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#555", display: "block", marginBottom: "6px" }}>Email address</label>
              <input type="email" placeholder="Enter your email" value={form.email} onChange={handleChange("email")} onFocus={() => setFocused("email")} onBlur={() => setFocused("")} style={inputStyle("email")} />

              {error && <p style={{ color: "#e53e3e", fontSize: "0.8rem", marginBottom: "12px" }}>{error}</p>}

              <button
                onClick={handleNextStep}
                style={{ width: "100%", background: "#000", color: "#fff", border: "none", borderRadius: "8px", padding: "16px", fontSize: "1rem", fontWeight: 600, cursor: "pointer", marginBottom: "20px", fontFamily: "inherit", transition: "background 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#222"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#000"}
              >
                Continue →
              </button>

              <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#aaa" }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: "#000", fontWeight: 600, textDecoration: "underline" }}>Log in</Link>
              </p>
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <>
              <button onClick={() => { setStep(1); setError(""); }} style={{ background: "none", border: "none", cursor: "pointer", marginBottom: "16px", fontSize: "1.2rem", padding: 0 }}>←</button>

              <h1 style={{ fontSize: "1.8rem", fontWeight: 600, color: "#000", marginBottom: "8px", lineHeight: 1.2 }}>Set your password</h1>
              <p style={{ color: "#777", fontSize: "0.875rem", marginBottom: "28px" }}>
                Almost there, <strong style={{ color: "#000" }}>{form.fullName.split(" ")[0]}</strong>! Choose a strong password.
              </p>

              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#555", display: "block", marginBottom: "6px" }}>Password</label>
              <div style={{ position: "relative", marginBottom: "12px" }}>
                <input type={showPassword ? "text" : "password"} placeholder="Min. 6 characters" value={form.password} onChange={handleChange("password")} onFocus={() => setFocused("password")} onBlur={() => setFocused("")} style={{ ...inputStyle("password"), marginBottom: 0, paddingRight: "56px" }} />
                <button onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#777", fontSize: "0.8rem", fontWeight: 600 }}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {form.password.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                    {[1, 2, 3].map((level) => (
                      <div key={level} style={{ flex: 1, height: "3px", borderRadius: "2px", background: form.password.length >= level * 4 ? level === 1 ? "#e53e3e" : level === 2 ? "#f5a623" : "#22c55e" : "#e5e5e5", transition: "background 0.2s" }} />
                    ))}
                  </div>
                  <p style={{ fontSize: "0.7rem", color: form.password.length < 4 ? "#e53e3e" : form.password.length < 8 ? "#f5a623" : "#22c55e", margin: 0 }}>
                    {form.password.length < 4 ? "Weak" : form.password.length < 8 ? "Medium" : "Strong"}
                  </p>
                </div>
              )}

              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#555", display: "block", marginBottom: "6px" }}>Confirm password</label>
              <div style={{ position: "relative", marginBottom: "8px" }}>
                <input type={showConfirm ? "text" : "password"} placeholder="Re-enter your password" value={form.confirmPassword} onChange={handleChange("confirmPassword")} onFocus={() => setFocused("confirmPassword")} onBlur={() => setFocused("")} style={{ ...inputStyle("confirmPassword"), marginBottom: 0, paddingRight: "56px" }} />
                <button onClick={() => setShowConfirm(!showConfirm)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#777", fontSize: "0.8rem", fontWeight: 600 }}>
                  {showConfirm ? "Hide" : "Show"}
                </button>
              </div>

              {form.confirmPassword.length > 0 && (
                <p style={{ fontSize: "0.75rem", marginBottom: "16px", color: form.password === form.confirmPassword ? "#22c55e" : "#e53e3e" }}>
                  {form.password === form.confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                </p>
              )}

              {error && <p style={{ color: "#e53e3e", fontSize: "0.8rem", marginBottom: "12px" }}>{error}</p>}

              <button
                onClick={handleSignup}
                disabled={loading}
                style={{ width: "100%", background: loading ? "#555" : "#000", color: "#fff", border: "none", borderRadius: "8px", padding: "16px", fontSize: "1rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginBottom: "16px", fontFamily: "inherit", transition: "background 0.15s" }}
              >
                {loading ? "Creating account..." : "Create account"}
              </button>

              <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#aaa", marginTop: "16px" }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: "#000", fontWeight: 600, textDecoration: "underline" }}>Log in</Link>
              </p>
            </>
          )}

        </div>
      </main>

      {/* ── Footer — fully inline styles, no classNames ── */}
      <footer style={{
        padding: "24px 16px",
        borderTop: "1px solid #e2e2e2",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
      }}>
        {/* Social icons */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center", justifyContent: "center" }}>
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
        </div>

        {/* Footer text */}
        <p style={{ color: "#b0b0b0", fontSize: "0.75rem", fontFamily: "inherit", textAlign: "center" }}>
          © {new Date().getFullYear()} RideSync
        </p>
      </footer>

    </div>
  );
}