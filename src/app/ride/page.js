"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import RideStatus from "../components/RideStatus";
import LocationInput from "../components/LocationInput";

const RideMap = dynamic(() => import("../components/RideMap"), { ssr: false });

// ─────────────────────────────────────────────────────────────
// VEHICLE DEFINITIONS
// ─────────────────────────────────────────────────────────────
const VEHICLES = [
  { id: "bike", name: "Bike", emoji: "🏍️", capacity: 1, ac: false, acLabel: null, base: 15, perKm: 6, perMin: 0.8, desc: "Fastest for solo trips", tag: "⚡ Faster", etaMin: 3 },
  { id: "auto", name: "Auto", emoji: "🛺", capacity: 3, ac: false, acLabel: "Non-AC", base: 25, perKm: 10, perMin: 1.2, desc: "Affordable 3-wheeler", tag: null, etaMin: 5 },
  { id: "go", name: "Go", emoji: "🚗", capacity: 4, ac: false, acLabel: "Non-AC", base: 30, perKm: 12, perMin: 1.5, desc: "Everyday affordable rides", tag: null, etaMin: 6 },
  { id: "go_ac", name: "Go AC", emoji: "🚗", capacity: 4, ac: true, acLabel: "AC", base: 40, perKm: 15, perMin: 1.8, desc: "Air-conditioned comfort", tag: "❄️ AC", etaMin: 7 },
  { id: "sedan", name: "Sedan", emoji: "🚙", capacity: 4, ac: true, acLabel: "AC", base: 55, perKm: 18, perMin: 2.2, desc: "Premium comfort ride", tag: "⭐ Premium", etaMin: 8 },
  { id: "xl", name: "XL", emoji: "🚐", capacity: 6, ac: true, acLabel: "AC", base: 65, perKm: 16, perMin: 2, desc: "For groups up to 6", tag: null, etaMin: 9 },
  { id: "van", name: "Van", emoji: "🚌", capacity: 7, ac: true, acLabel: "AC", base: 75, perKm: 18, perMin: 2.5, desc: "Large groups up to 7", tag: null, etaMin: 10 },
];

// ─────────────────────────────────────────────────────────────
// HOTSPOTS
// ─────────────────────────────────────────────────────────────
const HOTSPOTS = [
  { name: "Airport", keywords: ["airport"] },
  { name: "Stadium", keywords: ["stadium"] },
  { name: "Railway", keywords: ["station", "railway"] },
];

// ─────────────────────────────────────────────────────────────
// PRICING
// ─────────────────────────────────────────────────────────────
function calcSurge(distanceKm, pickupName = "", destName = "") {
  let surge = 1.0;
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 5) surge *= 1.5;
  else if ((hour >= 8 && hour < 10) || (hour >= 17 && hour < 20)) surge *= 1.3;
  const combinedText = `${pickupName} ${destName}`.toLowerCase();
  if (HOTSPOTS.some((h) => h.keywords.some((kw) => combinedText.includes(kw)))) surge *= 1.4;
  if (distanceKm > 30) surge *= 1.1;
  else if (distanceKm < 3) surge *= 0.9;
  return parseFloat(surge.toFixed(2));
}

function calcPrice(vehicle, distanceKm, durationMin, surge) {
  return Math.round((vehicle.base + distanceKm * vehicle.perKm + durationMin * vehicle.perMin) * surge);
}

// ─────────────────────────────────────────────────────────────
// GEOCODE — Kolkata-biased fallback for typed (non-dropdown) text
// ─────────────────────────────────────────────────────────────
async function geocode(query) {
  const lower = query.toLowerCase();
  const alreadyLocated =
    lower.includes("kolkata") || lower.includes("calcutta") ||
    lower.includes("india") || lower.includes("west bengal");
  const withCity = alreadyLocated ? query : `${query}, Kolkata, West Bengal, India`;
  const headers = { "Accept-Language": "en" };

  const res1 = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(withCity)}&format=json&limit=1&countrycodes=in`, { headers });
  const data1 = await res1.json();
  if (data1.length) return { lat: parseFloat(data1[0].lat), lng: parseFloat(data1[0].lon) };

  const res2 = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`, { headers });
  const data2 = await res2.json();
  if (data2.length) return { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) };

  throw new Error(`Could not find "${query}". Try a more specific name, e.g. "Park Street, Kolkata".`);
}

// ─────────────────────────────────────────────────────────────
// ROUTE (OSRM)
// ─────────────────────────────────────────────────────────────
async function getRoute(p, d) {
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${p.lng},${p.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`);
  const data = await res.json();
  if (!data.routes?.length) throw new Error("Route not found between these two points.");
  return {
    coords: data.routes[0].geometry.coordinates,
    distanceKm: data.routes[0].distance / 1000,
    durationMin: data.routes[0].duration / 60,
  };
}

// ─────────────────────────────────────────────────────────────
// CARPOOL GENDER / MATCH LOGIC
// ─────────────────────────────────────────────────────────────
// Derives group gender from per-passenger array: { gender: "F"|"M" }
function deriveGroupGender(passengers) {
  const females = passengers.filter((p) => p.gender === "F").length;
  const males = passengers.filter((p) => p.gender === "M").length;
  if (females > 0 && males === 0) return "F";
  if (males > 0 && females === 0) return "M";
  return "X"; // mixed
}

// Match priority: girls→girls→mixed→boys | boys→boys→mixed→girls | mixed→mixed→girls→boys
function carpoolMatchPriority(groupGender) {
  if (groupGender === "F") return ["F", "X", "M"];
  if (groupGender === "M") return ["M", "X", "F"];
  return ["X", "F", "M"];
}

const PREF_HINTS = {
  any: "Assigned to any available group heading your way.",
  same: "Only matched with riders of the same gender.",
  coed: "Matched with a mixed-gender group.",
};

const LUGGAGE_OPTIONS = [
  { id: "none", icon: "🎒", label: "Backpack" },
  { id: "small", icon: "💼", label: "Small bag" },
  { id: "large", icon: "🧳", label: "Large box" },
];

// ─────────────────────────────────────────────────────────────
// SPINNER
// ─────────────────────────────────────────────────────────────
const Spinner = () => (
  <svg style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none">
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <circle style={{ opacity: 0.3 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path style={{ opacity: 0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

// ─────────────────────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────────────────────
function StepIndicator({ currentStep, labels }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", padding: "12px 20px", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
      {labels.map((label, i) => {
        const step = i + 1;
        const done = step < currentStep;
        const active = step === currentStep;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < labels.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700, background: done || active ? "#000" : "#f0f0f0", color: done || active ? "#fff" : "#bbb", transition: "all 0.2s" }}>
                {done ? "✓" : step}
              </div>
              <span style={{ fontSize: "0.6rem", fontWeight: active ? 700 : 500, color: active ? "#000" : done ? "#555" : "#ccc", whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div style={{ flex: 1, height: "2px", background: done ? "#000" : "#f0f0f0", margin: "0 4px", marginBottom: "14px", transition: "background 0.3s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PILL BUTTON (gender / match pref selector)
// ─────────────────────────────────────────────────────────────
function PillButton({ label, active, onClick, color }) {
  const activeStyles = {
    F: { border: "1.5px solid #D4537E", background: "#FBEAF0", color: "#993556" },
    M: { border: "1.5px solid #378ADD", background: "#E6F1FB", color: "#185FA5" },
    X: { border: "1.5px solid #7F77DD", background: "#EEEDFE", color: "#534AB7" },
    default: { border: "1.5px solid #000", background: "#000", color: "#fff" },
  };
  const a = active ? (activeStyles[color] || activeStyles.default) : {};
  return (
    <button onClick={onClick} style={{ padding: "9px 12px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", border: "1px solid #e2e2e2", background: "#fff", color: "#555", fontSize: "0.82rem", fontWeight: active ? 600 : 400, transition: "all 0.15s", ...a }}>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────────────────────
function Avatar({ name, gender, size = 36 }) {
  const initials = (name || "U").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const bgMap = { F: "#FBEAF0", M: "#E6F1FB", X: "#EEEDFE" };
  const colMap = { F: "#993556", M: "#185FA5", X: "#534AB7" };
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: bgMap[gender] || "#f0f0f0", color: colMap[gender] || "#555", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 600 }}>
      {initials}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const fmtDist = (km) => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
const fmtDur = (m) => m < 60 ? `${Math.round(m)} mins` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
function RidePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userName } = useAuth();

  // ── URL params from home page ───────────────────────────────
  const pickupParam = searchParams.get("pickup") || "";
  const destParam = searchParams.get("dest") || "";
  const platParam = parseFloat(searchParams.get("plat"));
  const plngParam = parseFloat(searchParams.get("plng"));
  const dlatParam = parseFloat(searchParams.get("dlat"));
  const dlngParam = parseFloat(searchParams.get("dlng"));
  const hasParamCoords = !isNaN(platParam) && !isNaN(plngParam) && !isNaN(dlatParam) && !isNaN(dlngParam);

  // ── Steps:
  //    1 = Location   — skipped to step 2 when coords arrive from home page
  //    2 = Ride type  — Private vs Carpool
  //    3 = Passengers — count + (carpool: per-pax gender, luggage, match pref)
  //    4 = Vehicle    — choose ride + book
  const [step, setStep] = useState(hasParamCoords ? 2 : 1);

  // ── Location ────────────────────────────────────────────────
  const [pickupText, setPickupText] = useState(pickupParam);
  const [destText, setDestText] = useState(destParam);
  const [pickup, setPickup] = useState(hasParamCoords ? { lat: platParam, lng: plngParam } : null);
  const [destination, setDestination] = useState(hasParamCoords ? { lat: dlatParam, lng: dlngParam } : null);
  const [locationLocked, setLocationLocked] = useState(hasParamCoords);

  // ── Route ───────────────────────────────────────────────────
  const [routeCoords, setRouteCoords] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [durationMin, setDurationMin] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [surge, setSurge] = useState(1.0);

  // ── Ride type ───────────────────────────────────────────────
  const [isCarpool, setIsCarpool] = useState(false);

  // ── Passenger details ───────────────────────────────────────
  const [passengerCount, setPassengerCount] = useState(1);
  // Per-passenger gender array — used for group gender derivation
  const [passengerDetails, setPassengerDetails] = useState([{ gender: "M" }]);
  // Carpool-specific fields
  const [matchPref, setMatchPref] = useState("any");   // any | same | coed
  const [luggage, setLuggage] = useState("none");  // none | small | large

  // ── Vehicle / booking ───────────────────────────────────────
  const [vehicles, setVehicles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [acFilter, setAcFilter] = useState("all");
  const [payment, setPayment] = useState("💵 Cash");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  // ── Solo ride status ────────────────────────────────────────
  const [rideId, setRideId] = useState(null);

  // ── Carpool match overlay ───────────────────────────────────
  // carpoolStep: 0 = idle, 1 = finding match, 2 = confirmed
  const [carpoolStep, setCarpoolStep] = useState(0);
  const [matchedRiders, setMatchedRiders] = useState([]);
  const [allocation, setAllocation] = useState(null);

  // ── Auto-fetch route once both coords are available ─────────
  useEffect(() => {
    if (pickup && destination && !routeCoords && !routeLoading) {
      fetchRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, destination]);

  // ── Sync passengerDetails length with count ─────────────────
  useEffect(() => {
    setPassengerDetails((prev) => {
      const next = [...prev];
      while (next.length < passengerCount) next.push({ gender: "M" });
      return next.slice(0, passengerCount);
    });
  }, [passengerCount]);

  // ── Fetch route ─────────────────────────────────────────────
  const fetchRoute = async () => {
    if (!pickup || !destination) return;
    setRouteLoading(true);
    setError("");
    try {
      const r = await getRoute(pickup, destination);
      setRouteCoords(r.coords);
      setDistanceKm(r.distanceKm);
      setDurationMin(r.durationMin);
      setSurge(calcSurge(r.distanceKm, pickupText, destText));
    } catch (err) {
      setError(err.message || "Could not fetch route.");
    } finally {
      setRouteLoading(false);
    }
  };

  // ── Build vehicle list ──────────────────────────────────────
  const buildVehicles = () => {
    if (!distanceKm || !durationMin) return;
    const built = VEHICLES
      .filter((v) => v.capacity >= passengerCount)
      .map((v) => ({
        ...v,
        price: calcPrice(v, distanceKm, durationMin, surge),
        eta: v.etaMin,
        arrivalTime: new Date(Date.now() + v.etaMin * 60000)
          .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));
    setVehicles(built);
    setSelected(built[0] ?? null);
  };

  // ── Step helpers ────────────────────────────────────────────
  const goTo = (n) => { setError(""); setStep(n); };

  // Step 1 → Step 2: geocode if coords not already set
  const handleStep1Continue = async () => {
    if (!pickupText.trim()) { setError("Please enter a pickup location."); return; }
    if (!destText.trim()) { setError("Please enter a destination."); return; }
    setError("");
    setRouteLoading(true);
    try {
      const p = pickup ?? await geocode(pickupText.trim());
      const d = destination ?? await geocode(destText.trim());
      setPickup(p);
      setDestination(d);

      // route fetched by the useEffect above once both are set
      setRouteLoading(false);
    } catch (err) {
      setError(err.message || "Could not resolve locations. Try again.");
      setRouteLoading(false);
      return;
    }
    goTo(2);
  };

  // Step 3 → Step 4
  const handleStep3Continue = () => {
    setError("");
    buildVehicles();
    goTo(4);
  };

  // ── Book ride ───────────────────────────────────────────────
  const handleBookRide = async () => {
    if (!selected || !pickup || !destination) return;
    if (!user) { setError("Please sign in to book a ride."); return; }
    setBooking(true);
    setError("");

    try {
      if (isCarpool) {
        const groupGender = deriveGroupGender(passengerDetails);
        const matchPriority = carpoolMatchPriority(groupGender);
        const carpoolPrice = Math.round(selected.price * 0.7);

        setCarpoolStep(1); // show "finding match" overlay

        const docRef = await addDoc(collection(db, "carpool_requests"), {
          userId: user.uid,
          userName: userName || user.email || "Passenger",
          passengers: passengerCount,
          passengerDetails,
          groupGender,
          matchPriority,
          matchPref,
          luggage,
          vehicleId: selected.id,
          vehicleName: selected.name,
          pickupName: pickupText,
          destName: destText,
          pickupLat: pickup.lat, pickupLng: pickup.lng,
          destLat: destination.lat, destLng: destination.lng,
          basePrice: selected.price,
          carpoolPrice,
          distanceKm,
          durationMin,
          status: "waiting",
          matchedWith: [],
          allocation: null,
          createdAt: serverTimestamp(),
        });

        // Simulate matchmaking (replace with real Firestore listener in production)
        setTimeout(async () => {
          const { updateDoc, doc } = await import("firebase/firestore");

          // Pick a mock co-rider consistent with matchPref
          const mockGender = matchPref === "same" ? groupGender : (groupGender === "F" ? "M" : "F");
          const mockName = mockGender === "F" ? "Priya R." : "Arjun S.";
          const mockRider = { userId: "demo_rider_001", userName: mockName, gender: mockGender, passengers: 1 };

          const mockAlloc = {
            driverName: "Dinesh Kumar",
            driverPhone: "+91 98765 43210",
            vehicleNo: "WB 02 AB 1234",
            vehicleModel: selected.name,
            rating: 4.8,
            eta: Math.max(3, Math.floor(Math.random() * 8) + 2),
            riders: [
              { userId: user.uid, userName: userName || "You", gender: groupGender, passengers: passengerCount },
              mockRider,
            ],
          };

          await updateDoc(doc(db, "carpool_requests", docRef.id), {
            status: "allocated",
            allocation: mockAlloc,
            matchedWith: ["demo_rider_001"],
          });

          setMatchedRiders([mockRider]);
          setAllocation(mockAlloc);
          setCarpoolStep(2); // show confirmed overlay
          setBooking(false);
        }, 3500);

        return;
      }

      // ── Private ride ──────────────────────────────────────
      const docRef = await addDoc(collection(db, "ride_requests"), {
        userId: user.uid,
        userName: userName || user.email || "Passenger",
        vehicleType: selected.id,
        vehicleName: selected.name,
        price: selected.price,
        passengers: passengerCount,
        pickupName: pickupText,
        pickupLat: pickup.lat, pickupLng: pickup.lng,
        destName: destText,
        destLat: destination.lat, destLng: destination.lng,
        distanceKm, durationMin,
        paymentMethod: payment,
        status: "waiting",
        driverId: null, driverName: null, driverEmail: null,
        createdAt: serverTimestamp(),
      });
      setRideId(docRef.id);

    } catch (err) {
      console.error("Booking error:", err);
      setError("Failed to book ride. Please try again.");
    } finally {
      if (!isCarpool) setBooking(false);
    }
  };

  // ── Derived carpool values ──────────────────────────────────
  const groupGender = deriveGroupGender(passengerDetails);
  const matchPriority = carpoolMatchPriority(groupGender);
  const genderLabel = groupGender === "F" ? "👩 Women-only group" : groupGender === "M" ? "👨 Men-only group" : "👥 Mixed group";
  const matchLabel = `Matched with: ${matchPriority.map((g) => g === "F" ? "women" : g === "M" ? "men" : "mixed").join(" → ")}`;

  const filteredVehicles = vehicles.filter((v) => {
    if (acFilter === "ac") return v.ac === true;
    if (acFilter === "nonac") return v.ac === false;
    return true;
  });

  const STEP_LABELS = ["Location", "Ride Type", "Passengers", "Choose Ride"];

  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex" }}>

      {/* Solo ride status modal */}
      {rideId && <RideStatus rideId={rideId} onCancel={() => {
        setRideId(null);
        setStep(1); setRouteCoords(null);
        setPickupText(""); setDestText("");
        setPickup(null); setDestination(null);
        setLocationLocked(false);
      }} />}

      {/* ══ LEFT PANEL ════════════════════════════════════════ */}
      <div style={{ width: "420px", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid #e0e0e0", background: "#fff", zIndex: 10, boxShadow: "2px 0 16px rgba(0,0,0,0.05)", position: "relative" }}>

        {/* Header */}
        <header style={{ padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
          <Link href="/" style={{ color: "#000", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.04em", textDecoration: "none" }}>RideSync</Link>
          <Link href="/" style={{ padding: "6px 12px", borderRadius: "20px", background: "#f5f5f5", color: "#333", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>← Home</Link>
        </header>

        <StepIndicator currentStep={step} labels={STEP_LABELS} />

        <div style={{ flex: 1, overflowY: "auto", padding: "22px 20px" }}>

          {/* ════════════════════════════════════════════════
              STEP 1 — LOCATION
              Shown only when user navigates directly to /ride
              (no coord params from home page)
          ════════════════════════════════════════════════ */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#000", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Where are you going?</h2>
                <p style={{ fontSize: "0.78rem", color: "#999", margin: 0 }}>Type and select from suggestions, or press Continue to geocode</p>
              </div>

              <div style={{ background: "#f9f9f9", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "0 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ borderBottom: "1px solid #ececec" }}>
                  <LocationInput
                    placeholder="Pickup location"
                    value={pickupText}
                    onChange={(val) => { setPickupText(val); setPickup(null); setRouteCoords(null); }}
                    onSelect={(place) => {
                      setPickupText(place.name || place.display_name || pickupText);
                      setPickup({ lat: place.lat, lng: place.lng });
                      setRouteCoords(null);
                    }}
                    dotShape="circle"
                  />
                </div>
                <LocationInput
                  placeholder="Where to?"
                  value={destText}
                  onChange={(val) => { setDestText(val); setDestination(null); setRouteCoords(null); }}
                  onSelect={(place) => {
                    setDestText(place.name || place.display_name || destText);
                    setDestination({ lat: place.lat, lng: place.lng });
                    setRouteCoords(null);
                  }}
                  dotShape="square"
                />
              </div>

              {routeCoords && distanceKm && (
                <div style={{ display: "flex", gap: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "10px 14px", fontSize: "0.82rem", color: "#166534" }}>
                  <span>📍 {fmtDist(distanceKm)}</span>
                  <span>⏱ {fmtDur(durationMin)}</span>
                  {surge > 1 && <span style={{ marginLeft: "auto", background: "#fef9c3", color: "#854d0e", fontWeight: 700, padding: "1px 8px", borderRadius: "4px" }}>{surge}x surge</span>}
                </div>
              )}

              {error && <p style={{ color: "#e53e3e", fontSize: "0.82rem", margin: 0 }}>{error}</p>}

              <button onClick={handleStep1Continue} disabled={routeLoading || !pickupText.trim() || !destText.trim()}
                style={{ width: "100%", padding: "14px", background: "#000", color: "#fff", fontWeight: 700, fontSize: "0.95rem", border: "none", borderRadius: "10px", cursor: (!pickupText.trim() || !destText.trim()) ? "not-allowed" : "pointer", opacity: (!pickupText.trim() || !destText.trim()) ? 0.4 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                {routeLoading ? <><Spinner /> Calculating route…</> : "Continue →"}
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              STEP 2 — RIDE TYPE
          ════════════════════════════════════════════════ */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#000", margin: "0 0 4px", letterSpacing: "-0.02em" }}>How do you want to ride?</h2>
                <p style={{ fontSize: "0.78rem", color: "#999", margin: 0 }}>
                  {pickupText} → {destText}
                  {distanceKm ? ` · ${fmtDist(distanceKm)} · ${fmtDur(durationMin)}` : ""}
                </p>
              </div>

              {/* Private card */}
              <div onClick={() => setIsCarpool(false)}
                style={{ border: `2px solid ${!isCarpool ? "#000" : "#e2e2e2"}`, borderRadius: "14px", padding: "18px 16px", cursor: "pointer", background: !isCarpool ? "#000" : "#fff", transition: "all 0.18s", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <span style={{ fontSize: "2rem", flexShrink: 0 }}>🚗</span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: "0.95rem", color: !isCarpool ? "#fff" : "#000", margin: "0 0 5px" }}>Private Ride</p>
                    <p style={{ fontSize: "0.78rem", color: !isCarpool ? "#ccc" : "#777", margin: 0, lineHeight: 1.5 }}>Just you (and your group). Direct, fastest route with no stops.</p>
                  </div>
                </div>
                {!isCarpool && <span style={{ position: "absolute", top: "14px", right: "14px", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700 }}>✓</span>}
              </div>

              {/* Carpool card */}
              <div onClick={() => setIsCarpool(true)}
                style={{ border: `2px solid ${isCarpool ? "#000" : "#e2e2e2"}`, borderRadius: "14px", padding: "18px 16px", cursor: "pointer", background: isCarpool ? "#000" : "#fff", transition: "all 0.18s", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <span style={{ fontSize: "2rem", flexShrink: 0 }}>🤝</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                      <p style={{ fontWeight: 700, fontSize: "0.95rem", color: isCarpool ? "#fff" : "#000", margin: 0 }}>Carpool</p>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, background: isCarpool ? "#1a1a1a" : "#f0fdf4", color: isCarpool ? "#86efac" : "#166534", padding: "2px 8px", borderRadius: "999px" }}>Save up to 30%</span>
                    </div>
                    <p style={{ fontSize: "0.78rem", color: isCarpool ? "#ccc" : "#777", margin: 0, lineHeight: 1.5 }}>Share with others going your way. Gender-preference matching keeps you comfortable.</p>
                  </div>
                </div>
                {isCarpool && <span style={{ position: "absolute", top: "14px", right: "14px", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700 }}>✓</span>}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                {!locationLocked && (
                  <button onClick={() => goTo(1)} style={{ flex: 1, padding: "12px", background: "#f5f5f5", color: "#333", fontWeight: 600, border: "none", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem" }}>← Back</button>
                )}
                <button onClick={() => goTo(3)} style={{ flex: 2, padding: "12px", background: "#000", color: "#fff", fontWeight: 700, border: "none", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem" }}>Continue →</button>
              </div>

              {locationLocked && (
                <button onClick={() => { setLocationLocked(false); setRouteCoords(null); goTo(1); }}
                  style={{ background: "none", border: "none", color: "#bbb", fontSize: "0.74rem", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", textAlign: "center", padding: "4px" }}>
                  ✏️ Change pickup / destination
                </button>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════
              STEP 3 — PASSENGER DETAILS
          ════════════════════════════════════════════════ */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#000", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                  {isCarpool ? "Tell us about your group" : "Passenger details"}
                </h2>
                <p style={{ fontSize: "0.78rem", color: "#999", margin: 0 }}>
                  {isCarpool ? "We use this to match you with compatible co-riders." : "How many people are travelling?"}
                </p>
              </div>

              {/* ── Passenger count ── */}
              <div style={{ background: "#f9f9f9", borderRadius: "12px", padding: "14px 16px", border: "1px solid #e2e2e2" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.3rem" }}>👥</span>
                  <span style={{ flex: 1, fontSize: "0.92rem", fontWeight: 600, color: "#000" }}>Number of passengers</span>
                  <button onClick={() => setPassengerCount((c) => Math.max(1, c - 1))} style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1.5px solid #e2e2e2", background: "#fff", cursor: "pointer", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                  <span style={{ fontWeight: 700, minWidth: "26px", textAlign: "center", fontSize: "1rem" }}>{passengerCount}</span>
                  <button onClick={() => setPassengerCount((c) => Math.min(7, c + 1))} style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1.5px solid #e2e2e2", background: "#fff", cursor: "pointer", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              </div>

              {/* ── Carpool-only fields ── */}
              {isCarpool && (
                <>
                  {/* Per-passenger gender */}
                  <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: "12px", padding: "16px" }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#555", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Gender of each passenger</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {passengerDetails.map((p, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", background: "#f9f9f9", border: "1px solid #e2e2e2", borderRadius: "10px", padding: "10px 14px" }}>
                          <span style={{ fontSize: "0.82rem", color: "#777", fontWeight: 600, minWidth: "88px" }}>Passenger {i + 1}</span>
                          <div style={{ display: "flex", gap: "8px", flex: 1 }}>
                            {[["M", "👨 Male"], ["F", "👩 Female"]].map(([val, label]) => (
                              <button key={val}
                                onClick={() => {
                                  const next = [...passengerDetails];
                                  next[i] = { ...next[i], gender: val };
                                  setPassengerDetails(next);
                                }}
                                style={{ flex: 1, padding: "8px", borderRadius: "8px", border: `1.5px solid ${p.gender === val ? (val === "F" ? "#D4537E" : "#378ADD") : "#e2e2e2"}`, background: p.gender === val ? (val === "F" ? "#FBEAF0" : "#E6F1FB") : "#fff", color: p.gender === val ? (val === "F" ? "#993556" : "#185FA5") : "#555", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Group gender summary */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "10px", marginTop: "12px" }}>
                      <span style={{ fontSize: "1rem", flexShrink: 0 }}>ℹ️</span>
                      <div>
                        <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0369a1", margin: "0 0 2px" }}>{genderLabel}</p>
                        <p style={{ fontSize: "0.72rem", color: "#0c4a6e", margin: 0 }}>{matchLabel}</p>
                      </div>
                    </div>
                  </div>

                  {/* Matching preference */}
                  <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: "12px", padding: "16px" }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#555", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Matching preference</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "10px" }}>
                      {[["any", "Any group"], ["same", "Same gender"], ["coed", "Mixed (co-ed)"]].map(([p, lbl]) => (
                        <PillButton key={p} label={lbl} active={matchPref === p} onClick={() => setMatchPref(p)} />
                      ))}
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "#717171", margin: 0, lineHeight: 1.5 }}>{PREF_HINTS[matchPref]}</p>
                  </div>

                  {/* Luggage */}
                  <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: "12px", padding: "16px" }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#555", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Luggage</p>
                    <p style={{ fontSize: "0.72rem", color: "#aaa", margin: "0 0 12px" }}>Helps match with riders who have similar space needs</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                      {LUGGAGE_OPTIONS.map(({ id, icon, label }) => (
                        <button key={id} onClick={() => setLuggage(id)}
                          style={{ padding: "10px 4px", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit", border: luggage === id ? "1.5px solid #1D9E75" : "1px solid #e2e2e2", background: luggage === id ? "#E1F5EE" : "#fff", color: luggage === id ? "#0F6E56" : "#555", textAlign: "center", fontSize: "0.72rem", fontWeight: luggage === id ? 600 : 400, transition: "all 0.15s" }}>
                          <div style={{ fontSize: "1.2rem", marginBottom: "2px" }}>{icon}</div>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {error && <p style={{ color: "#e53e3e", fontSize: "0.82rem", margin: 0 }}>{error}</p>}

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => goTo(2)} style={{ flex: 1, padding: "12px", background: "#f5f5f5", color: "#333", fontWeight: 600, border: "none", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem" }}>← Back</button>
                <button onClick={handleStep3Continue} disabled={!distanceKm || routeLoading}
                  style={{ flex: 2, padding: "12px", background: "#000", color: "#fff", fontWeight: 700, border: "none", borderRadius: "10px", cursor: (!distanceKm || routeLoading) ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: "0.88rem", opacity: (!distanceKm || routeLoading) ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  {routeLoading ? <><Spinner /> Calculating…</> : "See rides →"}
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              STEP 4 — CHOOSE VEHICLE & BOOK
          ════════════════════════════════════════════════ */}
          {step === 4 && carpoolStep === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

              {/* Summary bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#000", margin: 0, letterSpacing: "-0.02em" }}>Choose a ride</h2>
                  <button onClick={() => goTo(3)} style={{ background: "none", border: "none", cursor: "pointer", color: "#000", fontSize: "0.76rem", textDecoration: "underline", fontFamily: "inherit" }}>← Edit</button>
                </div>
                <p style={{ fontSize: "0.74rem", color: "#717171", margin: 0 }}>{pickupText} → {destText}</p>
                <p style={{ fontSize: "0.74rem", color: "#717171", margin: "2px 0 0" }}>
                  {fmtDist(distanceKm)} · {fmtDur(durationMin)} · {passengerCount} pax
                  {isCarpool && ` · ${genderLabel}`}
                  {surge > 1 && <span style={{ marginLeft: "8px", background: "#fff3cd", color: "#856404", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", fontSize: "0.7rem" }}>{surge}x surge</span>}
                </p>
                {isCarpool && (
                  <p style={{ fontSize: "0.7rem", color: "#0369a1", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "6px", padding: "4px 10px", margin: "6px 0 0", display: "inline-block" }}>
                    🔗 {matchLabel}
                  </p>
                )}
              </div>

              {/* AC filter */}
              <div style={{ display: "flex", gap: "6px" }}>
                {[["all", "All"], ["ac", "❄️ AC"], ["nonac", "Non-AC"]].map(([val, label]) => (
                  <button key={val} onClick={() => setAcFilter(val)}
                    style={{ padding: "5px 12px", borderRadius: "999px", border: acFilter === val ? "2px solid #000" : "1px solid #e2e2e2", background: acFilter === val ? "#000" : "#fff", color: acFilter === val ? "#fff" : "#000", fontSize: "0.74rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Vehicle cards */}
              <div style={{ border: "1px solid #e2e2e2", borderRadius: "12px", overflow: "hidden" }}>
                {filteredVehicles.length === 0
                  ? <p style={{ padding: "20px", color: "#999", fontSize: "0.85rem", textAlign: "center" }}>No rides for this filter.</p>
                  : filteredVehicles.map((v, idx) => {
                    const isSel = selected?.id === v.id;
                    const displayPrice = isCarpool ? Math.round(v.price * 0.7) : v.price;
                    return (
                      <div key={v.id} onClick={() => setSelected(v)}
                        style={{ display: "flex", alignItems: "center", padding: "13px 14px", cursor: "pointer", background: isSel ? "#000" : "#fff", borderBottom: idx < filteredVehicles.length - 1 ? "1px solid #f0f0f0" : "none", transition: "background 0.15s" }}>
                        <div style={{ fontSize: "1.8rem", width: "46px", textAlign: "center", flexShrink: 0 }}>{v.emoji}</div>
                        <div style={{ flex: 1, marginLeft: "10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: isSel ? "#fff" : "#000" }}>{v.name}</span>
                            <span style={{ fontSize: "0.72rem", color: isSel ? "#ccc" : "#717171" }}>👤 {v.capacity}</span>
                            {v.acLabel && <span style={{ fontSize: "0.63rem", fontWeight: 600, padding: "1px 5px", borderRadius: "4px", background: isSel ? "#222" : v.ac ? "#e8f4fd" : "#f5f5f5", color: isSel ? "#93c5fd" : v.ac ? "#0066cc" : "#555" }}>{v.acLabel}</span>}
                          </div>
                          <p style={{ fontSize: "0.72rem", color: isSel ? "#aaa" : "#717171", margin: 0 }}>{v.eta} mins · {v.arrivalTime}</p>
                          {v.tag && <span style={{ fontSize: "0.63rem", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", background: isSel ? "#1a1a1a" : "#fff3cd", color: isSel ? "#fcd34d" : "#856404" }}>{v.tag}</span>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {isCarpool && <p style={{ margin: "0 0 1px", fontSize: "0.68rem", color: isSel ? "#666" : "#bbb", textDecoration: "line-through" }}>₹{v.price}</p>}
                          <span style={{ fontWeight: 700, fontSize: "1rem", color: isSel ? "#fff" : "#000" }}>₹{displayPrice}</span>
                        </div>
                      </div>
                    );
                  })
                }
              </div>

              {error && <p style={{ color: "#e53e3e", fontSize: "0.82rem", margin: 0 }}>{error}</p>}

              {/* Payment + Book */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {!isCarpool && (
                  <select value={payment} onChange={(e) => setPayment(e.target.value)}
                    style={{ flex: 1, padding: "12px 10px", border: "1.5px solid #e2e2e2", borderRadius: "10px", fontSize: "0.84rem", fontFamily: "inherit", background: "#fff", cursor: "pointer" }}>
                    <option>💵 Cash</option>
                    <option>💳 Card</option>
                    <option>📱 UPI</option>
                  </select>
                )}
                <button onClick={handleBookRide} disabled={!selected || booking}
                  style={{ flex: isCarpool ? 1 : 2, padding: "13px", background: "#000", color: "#fff", fontWeight: 700, fontSize: "0.9rem", border: "none", borderRadius: "10px", cursor: (!selected || booking) ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: !selected ? 0.5 : 1 }}>
                  {booking ? <><Spinner /> Booking…</> : isCarpool
                    ? `Find Pool · ₹${selected ? Math.round(selected.price * 0.7) : "—"}`
                    : `Request ${selected?.name ?? ""} · ₹${selected?.price ?? "—"}`
                  }
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              CARPOOL MATCH OVERLAY
              Shown over Step 4 after tapping "Find Pool"
          ════════════════════════════════════════════════ */}
          {step === 4 && carpoolStep > 0 && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", overflowY: "auto" }}>

              {/* Overlay header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Carpool Request</h2>
                {carpoolStep === 1 && (
                  <button onClick={() => { setCarpoolStep(0); setBooking(false); }}
                    style={{ background: "none", border: "none", padding: 0, color: "#e53e3e", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                )}
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

                {/* ── Finding match state ── */}
                {carpoolStep === 1 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginTop: "40px", gap: "16px" }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#E1F5EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", animation: "pulse 1.4s ease-in-out infinite" }}>
                      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}`}</style>
                      🔍
                    </div>
                    <div>
                      <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#000", margin: "0 0 8px" }}>Finding your pool…</h3>
                      <p style={{ fontSize: "0.88rem", color: "#717171", margin: 0, lineHeight: 1.6 }}>
                        Matching you with {matchPref === "same" ? "same-gender" : matchPref === "coed" ? "mixed-gender" : "other"} riders<br />
                        on a similar route.<br />
                        <span style={{ fontSize: "0.75rem", color: "#aaa" }}>Priority: {matchLabel}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Confirmed state ── */}
                {carpoolStep === 2 && allocation && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                    {/* Success banner */}
                    <div style={{ background: "#E1F5EE", border: "1px solid #9FE1CB", borderRadius: "12px", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ fontSize: "1.5rem" }}>🎉</div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "#085041" }}>Carpool Confirmed!</p>
                        <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "#0F6E56" }}>Driver is {allocation.eta} mins away</p>
                      </div>
                    </div>

                    {/* Savings + CO₂ */}
                    <div style={{ display: "flex", gap: "10px" }}>
                      <div style={{ flex: 1, background: "#f0faeb", border: "1px solid #dcf2cf", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: "0.72rem", color: "#4f7a37", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>You saved</p>
                        <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "#2B5219" }}>₹{selected.price - Math.round(selected.price * 0.7)}</p>
                      </div>
                      <div style={{ flex: 1, background: "#e8fafe", border: "1px solid #c7f2fd", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: "0.72rem", color: "#19667c", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>CO₂ saved</p>
                        <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "#0B4C60" }}>{((distanceKm * 180) / 1000).toFixed(1)} kg</p>
                      </div>
                    </div>

                    {/* Driver card */}
                    <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: "12px", padding: "16px" }}>
                      <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Your vehicle</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <Avatar name={allocation.driverName} gender="X" size={42} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "#000" }}>{allocation.driverName}</p>
                          <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "#717171" }}>{allocation.vehicleModel} · {allocation.vehicleNo}</p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#aaa" }}>⭐ {allocation.rating}</p>
                        </div>
                      </div>
                    </div>

                    {/* Riders list */}
                    <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: "12px", padding: "16px" }}>
                      <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Your Pool ({allocation.riders.length} riders)</p>
                      {allocation.riders.map((r, i) => {
                        const isMe = r.userId === user?.uid;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: i < allocation.riders.length - 1 ? "10px" : 0 }}>
                            <Avatar name={isMe ? "You" : r.userName} gender={r.gender} size={32} />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: isMe ? 700 : 500, color: "#000" }}>
                                {isMe ? "You" : r.userName}
                              </span>
                              {isMe && <span style={{ fontSize: "0.62rem", background: "#000", color: "#fff", padding: "2px 6px", borderRadius: "12px", marginLeft: "6px", fontWeight: 600 }}>Me</span>}
                            </div>
                            <span style={{ fontSize: "0.68rem", background: "#f5f5f5", color: "#555", padding: "2px 8px", borderRadius: "12px" }}>{r.passengers} pax</span>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                )}
              </div>

              {/* Confirmed: Done button */}
              {carpoolStep === 2 && (
                <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e2e2", background: "#f8f8f8", flexShrink: 0 }}>
                  <button
                    onClick={() => {
                      setCarpoolStep(0); setAllocation(null); setMatchedRiders([]);
                      setStep(1); setRouteCoords(null);
                      setPickupText(""); setDestText("");
                      setPickup(null); setDestination(null);
                      setLocationLocked(false);
                    }}
                    style={{ width: "100%", padding: "14px", background: "#000", color: "#fff", fontWeight: 700, fontSize: "0.95rem", border: "none", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit" }}>
                    Done
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ══ RIGHT — MAP ════════════════════════════════════════ */}
      <div style={{ flex: 1, position: "relative", background: "#e8e8e8" }}>
        <RideMap
          pickup={pickup}
          destination={destination}
          routeCoords={routeCoords}
          center={pickup ? [pickup.lng, pickup.lat] : [88.3639, 22.5726]}
        />

        {distanceKm && durationMin && (
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", background: "#000", color: "#fff", borderRadius: "20px", padding: "7px 18px", fontSize: "0.8rem", fontWeight: 600, display: "flex", gap: "14px", zIndex: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>
            <span>📍 {fmtDist(distanceKm)}</span>
            <span>⏱ {fmtDur(durationMin)}</span>
          </div>
        )}

        {routeLoading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", zIndex: 20 }}>
            <Spinner />
            <p style={{ fontSize: "0.85rem", color: "#555", fontWeight: 600 }}>Finding best route…</p>
          </div>
        )}
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────
export default function RidePage() {
  return (
    <Suspense fallback={
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading…
      </div>
    }>
      <RidePageContent />
    </Suspense>
  );
}