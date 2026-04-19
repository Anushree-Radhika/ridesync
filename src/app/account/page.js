"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function AccountPage() {
  const { user, isLoggedIn, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.push("/login");
    }
  }, [loading, isLoggedIn, router]);

  if (loading || !isLoggedIn) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: "1rem", color: "#555", fontWeight: 600 }}>Loading account details...</p>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Derive initials for avatar
  const displayName = user?.profile?.displayName || user?.displayName || "Rider";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif" }}>
      {/* ── Navbar ── */}
      <nav style={{ background: "#fff", padding: "16px 24px", borderBottom: "1px solid #eaeaea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link href="/" style={{ textDecoration: "none", color: "#000", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.04em" }}>
            RideSync
          </Link>
        </div>
        <button
          onClick={() => router.push("/")}
          style={{ background: "#f1f1f1", color: "#333", border: "none", borderRadius: "999px", padding: "8px 16px", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#e5e5e5")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#f1f1f1")}
        >
          ← Back to Home
        </button>
      </nav>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, padding: "40px 24px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "680px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#000", marginBottom: "24px", letterSpacing: "-0.03em" }}>Account Settings</h1>

          {/* Profile Card */}
          <section style={{ background: "#fff", borderRadius: "16px", padding: "32px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", border: "1px solid #f0f0f0", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "24px", borderBottom: "1px solid #f0f0f0", paddingBottom: "24px", marginBottom: "24px" }}>
              {/* Avatar */}
              <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", fontWeight: 700, flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#000", margin: "0 0 4px" }}>{displayName}</h2>
                <div style={{ fontSize: "0.85rem", color: "#777", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", background: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: "999px", fontWeight: 600, fontSize: "0.75rem" }}>
                    {user?.profile?.role === "driver" ? "Driver" : "Rider"}
                  </span>
                  <span>Joined {user?.profile?.createdAt?.toDate ? new Date(user.profile.createdAt.toDate()).toLocaleDateString() : "Recently"}</span>
                </div>
              </div>
              <button style={{ padding: "10px 20px", background: "#f5f5f5", border: "none", borderRadius: "10px", fontWeight: 600, color: "#000", cursor: "pointer", fontSize: "0.85rem", transition: "background 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#ebebeb")} onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f5f5")}>
                Edit Profile
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: "0.8rem", color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email Address</p>
                <p style={{ margin: 0, fontSize: "1rem", color: "#000", fontWeight: 500 }}>{user?.email || "No email provided"}</p>
              </div>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: "0.8rem", color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Phone Number</p>
                <p style={{ margin: 0, fontSize: "1rem", color: "#000", fontWeight: 500 }}>{user?.profile?.phone || "No phone added"}</p>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e5e5", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }} onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)")} onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.02)")}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "1.2rem" }}>🕰️</span>
                <span style={{ fontSize: "1rem", fontWeight: 600, color: "#333" }}>Ride History</span>
              </div>
              <span style={{ color: "#aaa" }}>→</span>
            </div>

            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e5e5", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }} onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)")} onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.02)")}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "1.2rem" }}>💳</span>
                <span style={{ fontSize: "1rem", fontWeight: 600, color: "#333" }}>Payment Methods</span>
              </div>
              <span style={{ color: "#aaa" }}>→</span>
            </div>

            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e5e5", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }} onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)")} onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.02)")}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "1.2rem" }}>⚙️</span>
                <span style={{ fontSize: "1rem", fontWeight: 600, color: "#333" }}>Preferences</span>
              </div>
              <span style={{ color: "#aaa" }}>→</span>
            </div>
          </section>

          {/* Logout Button */}
          <div style={{ marginTop: "32px", textAlign: "center" }}>
            <button
              onClick={handleLogout}
              style={{ background: "#fff", color: "#e53e3e", border: "1px solid #fecaca", borderRadius: "10px", padding: "14px 32px", fontSize: "1rem", fontWeight: 700, cursor: "pointer", transition: "all 0.2s", width: "100%", maxWidth: "300px" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
