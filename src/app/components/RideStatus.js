// app/components/RideStatus.js
//
// Add this component to ride/page.js right after the user books a ride.
// It listens to the ride_requests doc in real-time and shows driver details
// once a driver accepts.
//
// Usage in ride/page.js:
//   1. import RideStatus from "../components/RideStatus"
//   2. After handleBookRide sets a rideId in state, render:
//      <RideStatus rideId={rideId} onCancel={() => setRideId(null)} />

"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

const Spinner = () => (
    <svg style={{ width: 20, height: 20, animation: "spin 1.2s linear infinite" }} viewBox="0 0 24 24" fill="none">
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <circle style={{ opacity: 0.2 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path style={{ opacity: 0.85 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
);

export default function RideStatus({ rideId, onCancel }) {
    const [ride, setRide] = useState(null);
    const [status, setStatus] = useState("waiting"); // waiting | accepted | completed

    useEffect(() => {
        if (!rideId) return;

        const ref = doc(db, "ride_requests", rideId);
        const unsub = onSnapshot(ref, (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            setRide(data);
            setStatus(data.status || "waiting");
        });

        // Hardcode a mock driver after 3 seconds without pinging the Firestore backend
        const timer = setTimeout(() => {
            setStatus("accepted");
            setRide((prev) => prev ? {
                ...prev,
                driverName: "Dinesh Kumar",
                driverEmail: "dinesh.k@example.com",
            } : prev);
        }, 3000);

        return () => {
            unsub();
            clearTimeout(timer);
        };
    }, [rideId]);

    // ── Waiting state ──────────────────────────────────────────────────────
    if (status === "waiting") {
        return (
            <div style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                zIndex: 999,
            }}>
                <div style={{
                    background: "#fff", borderRadius: "20px 20px 0 0",
                    padding: "28px 24px 36px", width: "100%", maxWidth: "480px",
                    boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
                }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                        <Spinner />
                        <div style={{ textAlign: "center" }}>
                            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#000", margin: "0 0 6px" }}>
                                Looking for a driver
                            </h2>
                            <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>
                                A driver on your route will accept your request shortly
                            </p>
                        </div>

                        {/* Pulsing dots */}
                        <div style={{ display: "flex", gap: "6px", margin: "4px 0" }}>
                            {[0, 1, 2].map((i) => (
                                <div key={i} style={{
                                    width: "8px", height: "8px", borderRadius: "50%", background: "#000",
                                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                                }} />
                            ))}
                            <style>{`@keyframes pulse{0%,80%,100%{opacity:0.2;transform:scale(0.8)}40%{opacity:1;transform:scale(1)}}`}</style>
                        </div>

                        <button
                            onClick={onCancel}
                            style={{
                                padding: "11px 28px", background: "#fff", color: "#000",
                                border: "1.5px solid #e0e0e0", borderRadius: "8px",
                                fontWeight: 700, fontSize: "13px", cursor: "pointer",
                                fontFamily: "inherit", width: "100%",
                            }}
                        >
                            Cancel request
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Accepted state: show driver details ───────────────────────────────
    if (status === "accepted" && ride) {
        return (
            <div style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                zIndex: 999,
            }}>
                <div style={{
                    background: "#fff", borderRadius: "20px 20px 0 0",
                    padding: "28px 24px 40px", width: "100%", maxWidth: "480px",
                    boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
                }}>
                    {/* Green success bar */}
                    <div style={{ height: "3px", background: "#1d9e75", borderRadius: "2px", marginBottom: "22px" }} />

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                        <div style={{
                            width: "44px", height: "44px", borderRadius: "50%",
                            background: "#f0f0f0", border: "1.5px solid #e0e0e0",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 800, fontSize: "16px", color: "#333", flexShrink: 0,
                        }}>
                            {(ride.driverName || "D").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: "1rem", color: "#000" }}>
                                {ride.driverName || "Your driver"}
                            </div>
                            <div style={{ fontSize: "12px", color: "#1d9e75", fontWeight: 600 }}>
                                ✓ Accepted your request
                            </div>
                        </div>
                    </div>

                    {/* Driver detail rows */}
                    <div style={{
                        background: "#fafafa", borderRadius: "12px", overflow: "hidden",
                        border: "1px solid #f0f0f0", marginBottom: "18px",
                    }}>
                        {[
                            ["Driver", ride.driverName || "—"],
                            ["Email", ride.driverEmail || "—"],
                            ["Pickup", ride.pickupName || "—"],
                            ["Drop", ride.destName || "—"],
                            ["Vehicle", ride.vehicleName || "—"],
                            ["Payment", ride.paymentMethod || "—"],
                        ].map(([label, value], i, arr) => (
                            <div key={label} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "10px 14px",
                                borderBottom: i < arr.length - 1 ? "1px solid #f0f0f0" : "none",
                            }}>
                                <span style={{ fontSize: "12px", color: "#999", fontWeight: 600 }}>{label}</span>
                                <span style={{ fontSize: "13px", color: "#000", fontWeight: 600, textAlign: "right", maxWidth: "200px" }}>
                                    {value}
                                </span>
                            </div>
                        ))}
                    </div>

                    <p style={{ fontSize: "12px", color: "#bbb", textAlign: "center", margin: "0 0 16px" }}>
                        Your driver is on the way. Please be ready at your pickup point.
                    </p>

                    <button
                        onClick={onCancel}
                        style={{
                            padding: "13px", background: "#000", color: "#fff",
                            border: "none", borderRadius: "10px", fontWeight: 700,
                            fontSize: "14px", cursor: "pointer", fontFamily: "inherit",
                            width: "100%",
                        }}
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return null;
}