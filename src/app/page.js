"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import styles from "./styles/home.module.css";
import { useAuth } from "./context/AuthContext";

// ─── Lazy-load map (no SSR) ───────────────────────────────────────────────────
const RideMap = dynamic(() => import("./components/RideMap"), { ssr: false });

// ─── Nominatim place search ───────────────────────────────────────────────────
async function searchPlaces(query) {
  if (!query || query.length < 2) return [];
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

// ─── OSRM route fetch ─────────────────────────────────────────────────────────
async function getRoute(p, d) {
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${p.lng},${p.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`
  );
  const data = await res.json();
  if (!data.routes?.length) return null;
  return {
    coords: data.routes[0].geometry.coordinates,
    distanceKm: data.routes[0].distance / 1000,
    durationMin: data.routes[0].duration / 60,
  };
}

// ─── LocationInput ────────────────────────────────────────────────────────────
function LocationInput({ placeholder, value, onChange, onSelect, onEnterKey, dotShape }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false); // ✅ loading state
  const timerRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(timerRef.current);
    if (val.length < 2) { setSuggestions([]); setShowDrop(false); setLoading(false); return; } // ✅ min 2 chars
    setLoading(true); // ✅ show spinner immediately
    timerRef.current = setTimeout(async () => {
      const results = await searchPlaces(val);
      setSuggestions(results);
      setShowDrop(results.length > 0);
      setLoading(false); // ✅ hide spinner
    }, 200); // ✅ reduced from 400ms to 200ms
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0", borderBottom: "1px solid #ececec" }}>
        <div style={{ width: "10px", height: "10px", flexShrink: 0, borderRadius: dotShape === "circle" ? "50%" : "0", background: "#000" }} />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={(e) => e.key === "Enter" && onEnterKey?.()}
          onFocus={() => suggestions.length > 0 && setShowDrop(true)}
          onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          style={{ flex: 1, border: "none", outline: "none", fontSize: "0.95rem", fontFamily: "inherit", background: "transparent", color: "#000" }}
        />
        {/* ✅ Spinner shown while fetching suggestions */}
        {loading && (
          <div style={{
            width: "14px", height: "14px", border: "2px solid #e2e2e2",
            borderTop: "2px solid #000", borderRadius: "50%",
            animation: "spin 0.6s linear infinite", flexShrink: 0
          }} />
        )}
      </div>
      {showDrop && (
        <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e2e2", borderRadius: "8px", zIndex: 300, overflow: "hidden" }}>
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
                <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#000", margin: 0 }}>{item.short}</p>
                <p style={{ fontSize: "0.72rem", color: "#999", margin: 0 }}>{item.display.slice(0, 55)}...</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HomePage ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const { isLoggedIn, userName, logout } = useAuth();

  const [city, setCity] = useState("Detecting location...");
  const [userCoords, setUserCoords] = useState(null);
  const [pickupText, setPickupText] = useState("Current location");
  const [destText, setDestText] = useState("");

  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");

  const [routeCoords, setRouteCoords] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const mapCenter = useMemo(
    () => (userCoords ? [userCoords.lng, userCoords.lat] : [88.3639, 22.5726]),
    [userCoords]
  );

  const mapPickup = useMemo(() => (routeCoords ? pickup : (userCoords ?? null)), [routeCoords, pickup, userCoords]);
  const mapDestination = useMemo(() => (routeCoords ? destination : null), [routeCoords, destination]);

  useEffect(() => {
    if (!navigator.geolocation) { setCity("Location unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        const coords = { lat: latitude, lng: longitude };
        setUserCoords(coords);
        setPickup(coords);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          const name = data.address.city || data.address.town || data.address.village || data.address.county || "Current location";
          setCity(name);
          setPickupText(name);
        } catch { setCity("Current location"); }
      },
      () => setCity("Location unavailable")
    );
  }, []);

  useEffect(() => {
    if (pickup && destination && !routeCoords) {
      handleFetchRoute();
    }
  }, [pickup, destination]);

  const handleLogout = async () => { await logout(); router.push("/login"); };

  const handleFetchRoute = async () => {
    if (!pickup || !destination) return;
    setRouteLoading(true);
    try {
      const r = await getRoute(pickup, destination);
      if (r) { setRouteCoords(r.coords); setRouteInfo(r); }
    } catch { }
    finally { setRouteLoading(false); }
  };

  const handleSeePrices = () => {
    if (!pickup || !destination) return;
    const p = encodeURIComponent(pickupText);
    const d = encodeURIComponent(destText);
    const plat = pickup.lat;
    const plng = pickup.lng;
    const dlat = destination.lat;
    const dlng = destination.lng;
    router.push(`/ride?pickup=${p}&dest=${d}&plat=${plat}&plng=${plng}&dlat=${dlat}&dlng=${dlng}`);
  };

  const fmtDist = (km) => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  const fmtDur = (m) => m < 60 ? `${Math.round(m)} mins` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;

  const bothSelected = pickup && destination;

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", background: "#ffffff" }}>

      {/* ── Navbar ── */}
      <nav className={styles.navbar} style={{ flexShrink: 0 }}>
        <div className={styles.navLeft}>
          <Link href="/" className={styles.logo} style={{ color: "inherit", textDecoration: "none" }}>RideSync</Link>
          <div className={styles.navLinks}>
            <Link href="/ride" style={{ textDecoration: "none", color: "inherit" }} className={styles.navLink}>Ride</Link>
          </div>
        </div>
        <div className={styles.navRight}>
          {isLoggedIn ? (
            <>
              <button
                onClick={handleLogout}
                style={{ background: "#fff", color: "#000", border: "1.5px solid #000", borderRadius: "999px", padding: "8px 20px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#000"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#000"; }}
              >Log out</button>
            </>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <Link href="/login" className={styles.loginBtn}>Log in</Link>
              <Link href="/signup" className={styles.loginBtn}>Sign up</Link>
            </div>
          )}
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Sidebar ── */}
        <div style={{ width: "380px", flexShrink: 0, background: "#fff", padding: "28px 24px", display: "flex", flexDirection: "column", gap: "14px", overflow: "hidden" }}>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "#555" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e" }} />
            <span>{city}</span>
          </div>

          <h1 style={{ fontSize: "1.6rem", fontWeight: 600, color: "#000", letterSpacing: "-0.03em", lineHeight: 1.2, margin: 0, fontFamily: 'inherit' }}>
            Request a ride
          </h1>

          <div style={{ position: "relative", width: "fit-content" }}>
            <button
              onClick={() => setShowTimePicker(!showTimePicker)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid #e2e2e2", borderRadius: "999px", padding: "8px 14px", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", width: "fit-content", color: "#000" }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {pickupDate && pickupTime ? `${new Date(pickupDate).toLocaleDateString()} at ${pickupTime}` : "Pickup now"}
              <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showTimePicker && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "#fff", border: "1px solid #e2e2e2", borderRadius: "16px", padding: "20px", zIndex: 100, boxShadow: "0 10px 30px rgba(0,0,0,0.1)", width: "300px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#000", letterSpacing: "-0.01em" }}>Schedule a ride</div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.8rem", color: "#555", fontWeight: 600 }}>Date</label>
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    style={{ padding: "10px 14px", border: "1px solid #e2e2e2", borderRadius: "8px", fontFamily: "inherit", fontSize: "0.9rem", color: "#000", outline: "none", background: "#f9f9f9" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "0.8rem", color: "#555", fontWeight: 600 }}>Time</label>
                  <input
                    type="time"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    style={{ padding: "10px 14px", border: "1px solid #e2e2e2", borderRadius: "8px", fontFamily: "inherit", fontSize: "0.9rem", color: "#000", outline: "none", background: "#f9f9f9" }}
                  />
                </div>

                <button
                  onClick={() => setShowTimePicker(false)}
                  style={{ marginTop: "4px", padding: "12px", background: "#000", color: "#fff", fontWeight: 600, border: "none", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", transition: "opacity 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  Confirm time
                </button>

                {(pickupDate || pickupTime) && (
                  <button
                    onClick={() => { setPickupDate(""); setPickupTime(""); setShowTimePicker(false); }}
                    style={{ padding: "8px", background: "none", color: "#666", fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem" }}
                  >
                    Reset to Pickup now
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "10px", padding: "0 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <LocationInput
              placeholder="Pickup location"
              value={pickupText}
              onChange={setPickupText}
              onSelect={(item) => {
                setPickup(item);
                setPickupText(item.short);
                setRouteCoords(null);
                setRouteInfo(null);
              }}
              onEnterKey={bothSelected ? handleFetchRoute : undefined}
              dotShape="circle"
            />
            <LocationInput
              placeholder="Where to?"
              value={destText}
              onChange={setDestText}
              onSelect={(item) => {
                setDestination(item);
                setDestText(item.short);
                setRouteCoords(null);
                setRouteInfo(null);
              }}
              onEnterKey={bothSelected ? handleFetchRoute : undefined}
              dotShape="square"
            />
          </div>

          {bothSelected && !routeInfo && !routeLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.78rem", color: "#717171" }}>
              <span style={{ background: "#f0f0f0", borderRadius: "4px", padding: "2px 7px", fontSize: "0.72rem", fontWeight: 600, color: "#555", fontFamily: "monospace" }}>↵ Enter</span>
              <span>to preview route on map</span>
            </div>
          )}

          {routeInfo && (
            <div style={{ display: "flex", gap: "16px", fontSize: "0.82rem", color: "#555", background: "#f9f9f9", borderRadius: "8px", padding: "10px 14px" }}>
              <span>📍 {fmtDist(routeInfo.distanceKm)}</span>
              <span>⏱ {fmtDur(routeInfo.durationMin)}</span>
            </div>
          )}

          <button
            onClick={handleSeePrices}
            disabled={!destination || routeLoading}
            style={{ width: "100%", padding: "14px", background: "#000", color: "#fff", fontWeight: 700, fontSize: "1rem", border: "none", borderRadius: "8px", cursor: destination ? "pointer" : "not-allowed", opacity: destination ? 1 : 0.45, fontFamily: "inherit", transition: "opacity 0.2s" }}
          >
            {routeLoading ? "Loading route…" : "See prices"}
          </button>

          {!destination && (
            <p style={{ fontSize: "0.75rem", color: "#999", textAlign: "center", margin: 0 }}>
              💡 Type a destination to continue
            </p>
          )}

          <div style={{ marginTop: "auto", padding: "14px", background: "#f9f9f9", borderRadius: "10px", fontSize: "0.85rem", color: "#555" }}>
            {isLoggedIn
              ? `👋 Welcome back, ${userName}!`
              : <span>New here? <Link href="/signup" style={{ color: "#000", fontWeight: 700 }}>Create an account</Link></span>
            }
          </div>
        </div>

        {/* ── Map panel ── */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ width: "100%", height: "100%", maxWidth: "750px", maxHeight: "520px", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", position: "relative", background: "#ffffff" }}>
            <RideMap
              pickup={mapPickup}
              destination={mapDestination}
              routeCoords={routeCoords}
              center={mapCenter}
            />

            {routeInfo && (
              <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", background: "#000", color: "#fff", borderRadius: "20px", padding: "6px 16px", fontSize: "0.78rem", fontWeight: 600, display: "flex", gap: "12px", zIndex: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>
                <span>📍 {fmtDist(routeInfo.distanceKm)}</span>
                <span>⏱ {fmtDur(routeInfo.durationMin)}</span>
              </div>
            )}

            {!routeInfo && city !== "Detecting location..." && (
              <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", color: "#fff", borderRadius: "20px", padding: "6px 16px", fontSize: "0.78rem", fontWeight: 600, zIndex: 10, whiteSpace: "nowrap" }}>
                📍 {city}
              </div>
            )}

            {routeLoading && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20, fontSize: "0.85rem", color: "#555", fontWeight: 600 }}>
                Finding route…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}