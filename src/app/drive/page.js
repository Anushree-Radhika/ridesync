// ─────────────────────────────────────────────────────────────────────────────
// app/drive/page.js
//
// Driver dashboard — shows matched passengers on a map + list.
// Uses your existing: RideMap, firebase, AuthContext, OSRM geocoding.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useState, useEffect, useContext, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AuthContext } from "../context/AuthContext";
import PassengerCard from "../components/PassengerCard";

// ── Lazy-load the map (MapLibre uses window) ───────────────────────────────
const RideMap = dynamic(() => import("../components/RideMap"), { ssr: false });

// ── Spinner (same as ride/page.js) ─────────────────────────────────────────
const Spinner = () => (
  <svg style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none">
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <circle style={{ opacity: 0.3 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path style={{ opacity: 0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

// ── Nominatim place search and Location Input ──────────────────────────────
async function searchPlaces(query) {
  if (!query || query.length < 3) return [];
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
  );
  const data = await res.json();
  return data.map((item) => ({
    display: item.display_name,
    short: item.name || item.display_name.split(",")[0],
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}

function LocationInput({ placeholder, value, onChange, onSelect, onEnterKey }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const timerRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(timerRef.current);
    if (val.length < 3) { setSuggestions([]); setShowDrop(false); return; }
    timerRef.current = setTimeout(async () => {
      const results = await searchPlaces(val);
      setSuggestions(results);
      setShowDrop(results.length > 0);
    }, 400);
  };
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", border: "1.5px solid #e2e2e2", borderRadius: "8px", boxSizing: "border-box", background: "#fff" }}>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setShowDrop(true)}
          onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          onKeyDown={(e) => e.key === "Enter" && onEnterKey && onEnterKey()}
          style={{ flex: 1, border: "none", outline: "none", fontSize: "13px", fontFamily: "inherit", background: "transparent", color: "#000" }}
        />
      </div>
      {showDrop && (
        <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e2e2", borderRadius: "8px", zIndex: 300, overflow: "hidden", maxHeight: "250px", overflowY: "auto" }}>
          {suggestions.map((item, i) => (
            <button
              key={i}
              onMouseDown={() => { onChange(item.short); onSelect(item); setSuggestions([]); setShowDrop(false); }}
              style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: i < suggestions.length - 1 ? "1px solid #f5f5f5" : "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", gap: "10px" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f9f9f9"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            >
              <span>📍</span>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#000", margin: 0 }}>{item.short}</p>
                <p style={{ fontSize: "11px", color: "#999", margin: 0 }}>{item.display.slice(0, 55)}...</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Geocode via Nominatim (same helper as ride/page.js) ────────────────────
async function geocode(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
  );
  const data = await res.json();
  if (!data.length) throw new Error(`Could not find "${query}"`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// ── Tab options ─────────────────────────────────────────────────────────────
const TABS = [
  { key: "all", label: "All" },
  { key: "onroute", label: "On route" },
  { key: "pending", label: "Pending" },
];

// ───────────────────────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  // ── Driver's own route inputs ────────────────────────────────────────────
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [fromCoord, setFromCoord] = useState(null);
  const [toCoord, setToCoord] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);   // OSRM polyline

  // ── Passenger list ───────────────────────────────────────────────────────
  const [passengers, setPassengers] = useState([]);
  const [declined, setDeclined] = useState(new Set()); // locally hidden

  // ── UI state ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [routeSet, setRouteSet] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("all");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  // ── Show toast helper ────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }, []);

  // ── Step 1: Driver submits their route ───────────────────────────────────
  const handleSetRoute = async () => {
    if (!fromText.trim() || !toText.trim()) return;
    setLoading(true);
    setError("");
    setPassengers([]);
    setRouteSet(false);

    try {
      // Geocode both ends
      const from = fromCoord && fromCoord.query === fromText ? fromCoord : await geocode(fromText);
      const to = toCoord && toCoord.query === toText ? toCoord : await geocode(toText);

      setFromCoord({ ...from, query: fromText });
      setToCoord({ ...to, query: toText });

      // Fetch matched passengers from our API
      const res = await fetch(
        `/api/match?driverLng=${from.lng}&driverLat=${from.lat}&destLng=${to.lng}&destLat=${to.lat}`
      );
      if (!res.ok) throw new Error("Failed to fetch passengers");

      const data = await res.json();
      setRouteCoords(data.routeCoords);
      setPassengers(data.passengers);
      setRouteSet(true);

      if (!data.passengers.length) showToast("No waiting passengers on this route right now.");

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Accept a passenger ───────────────────────────────────────────────────
  const handleAccept = async (rideId) => {
    try {
      const res = await fetch("/api/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId,
          driverId: user.uid,
          driverName: user.displayName || user.email,
        }),
      });
      if (!res.ok) throw new Error("Accept failed");

      // Update locally
      setPassengers((prev) =>
        prev.map((p) => p.id === rideId ? { ...p, status: "accepted" } : p)
      );
      showToast("Passenger accepted — they've been notified.");

    } catch (err) {
      showToast("Could not accept. Please try again.");
    }
  };

  // ── Decline (local only — just hides the card) ───────────────────────────
  const handleDecline = (rideId) => {
    setDeclined((prev) => new Set([...prev, rideId]));
    if (selected === rideId) setSelected(null);
    showToast("Request hidden.");
  };

  // ── Filtered + visible list ──────────────────────────────────────────────
  const visible = passengers.filter((p) => {
    if (declined.has(p.id)) return false;
    if (tab === "onroute") return p.tag === "on route";
    if (tab === "pending") return p.status === "waiting";
    return true;
  });

  const pendingCount = passengers.filter(
    (p) => !declined.has(p.id) && p.status === "waiting"
  ).length;

  // ── Selected passenger for map highlight ────────────────────────────────
  const selectedPax = passengers.find((p) => p.id === selected);

  // Map shows driver's route + selected passenger's pickup pin
  const mapPickup = fromCoord || null;
  const mapDestination = selectedPax
    ? { lat: selectedPax.pickupLat, lng: selectedPax.pickupLng }
    : toCoord || null;

  // ── Render ───────────────────────────────────────────────────────────────
  if (!user) return null;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "inherit", background: "#fff" }}>

      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <div style={{
        width: "380px", flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: "1px solid #e8e8e8", background: "#fff",
      }}>

        {/* Header */}
        <div style={{ padding: "16px", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#000", margin: 0 }}>Driver mode</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1d9e75" }} />
              <span style={{ fontSize: "12px", color: "#555", fontWeight: 600 }}>
                {user.displayName || user.email}
              </span>
            </div>
          </div>

          {/* Route input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <LocationInput
              placeholder="Your starting point"
              value={fromText}
              onChange={setFromText}
              onSelect={(item) => {
                setFromText(item.short);
                setFromCoord({ lat: item.lat, lng: item.lng, query: item.short });
              }}
              onEnterKey={handleSetRoute}
            />
            <LocationInput
              placeholder="Your destination"
              value={toText}
              onChange={setToText}
              onSelect={(item) => {
                setToText(item.short);
                setToCoord({ lat: item.lat, lng: item.lng, query: item.short });
              }}
              onEnterKey={handleSetRoute}
            />
            <button
              onClick={handleSetRoute}
              disabled={loading || !fromText.trim() || !toText.trim()}
              style={{
                padding: "11px", background: loading ? "#555" : "#000", color: "#fff",
                border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              {loading ? <><Spinner /> Finding passengers…</> : routeSet ? "Refresh" : "Find passengers"}
            </button>

            {error && (
              <p style={{ fontSize: "12px", color: "#c0392b", margin: 0 }}>{error}</p>
            )}
          </div>
        </div>

        {/* Tabs (only show after route is set) */}
        {routeSet && (
          <div style={{ padding: "10px 16px 0", borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#000" }}>
                Passengers
                <span style={{
                  marginLeft: "6px", background: "#f0f0f0", color: "#333",
                  fontSize: "11px", fontWeight: 700, padding: "1px 7px",
                  borderRadius: "20px",
                }}>
                  {pendingCount}
                </span>
              </span>
            </div>
            <div style={{ display: "flex", gap: "4px", paddingBottom: "10px" }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    padding: "5px 14px", borderRadius: "20px", fontSize: "12px",
                    fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    border: tab === t.key ? "2px solid #000" : "1px solid #e2e2e2",
                    background: tab === t.key ? "#000" : "#fff",
                    color: tab === t.key ? "#fff" : "#555",
                    transition: "all 0.12s",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Passenger list */}
        <div style={{ flex: 1, overflowY: "auto", padding: routeSet ? "10px 12px" : "0" }}>
          {!routeSet && !loading && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#aaa" }}>
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🗺️</div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#888", margin: 0 }}>
                Enter your route above to see passengers near your path
              </p>
            </div>
          )}

          {loading && (
            <div style={{ padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <Spinner />
              <p style={{ color: "#777", fontSize: "13px", fontWeight: 600, margin: 0 }}>Scanning route for passengers…</p>
            </div>
          )}

          {routeSet && !loading && visible.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#aaa" }}>
              <p style={{ fontSize: "13px", margin: 0 }}>No passengers match this filter.</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {visible.map((p) => (
              <PassengerCard
                key={p.id}
                passenger={p}
                selected={selected === p.id}
                onSelect={(id) => setSelected(selected === id ? null : id)}
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT — MAP ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        <RideMap
          pickup={mapPickup}
          destination={mapDestination}
          routeCoords={routeCoords}
          center={fromCoord ? [fromCoord.lng, fromCoord.lat] : [88.3639, 22.5726]}
        />

        {/* Selected passenger info pill */}
        {selectedPax && (
          <div style={{
            position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
            background: "#000", color: "#fff", borderRadius: "20px",
            padding: "7px 18px", fontSize: "12px", fontWeight: 600,
            display: "flex", gap: "14px", zIndex: 10,
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)", whiteSpace: "nowrap",
          }}>
            <span>📍 {selectedPax.pickupName}</span>
            <span>→ {selectedPax.destName}</span>
            <span style={{
              background: selectedPax.score >= 80 ? "#1d9e75" : selectedPax.score >= 55 ? "#e2974a" : "#e24b4a",
              padding: "1px 8px", borderRadius: "10px", fontSize: "11px",
            }}>
              {selectedPax.score}% match
            </span>
          </div>
        )}

        {/* Route info pill */}
        {routeSet && !selectedPax && fromCoord && (
          <div style={{
            position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
            background: "#000", color: "#fff", borderRadius: "20px",
            padding: "7px 18px", fontSize: "12px", fontWeight: 600,
            zIndex: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.3)", whiteSpace: "nowrap",
          }}>
            {fromText} → {toText} · {passengers.filter(p => !declined.has(p.id)).length} passengers nearby
          </div>
        )}
      </div>

      {/* ── TOAST ────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px",
          background: "#000", color: "#fff",
          padding: "12px 20px", borderRadius: "10px",
          fontSize: "13px", fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          zIndex: 100, animation: "fadeIn 0.2s ease",
        }}>
          <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
          {toast}
        </div>
      )}
    </div>
  );
}