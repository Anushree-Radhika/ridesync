import { createClient } from "@supabase/supabase-js";

// ── Supabase client ────────────────────────────────────────────────────────
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// ── Request a carpool ride ─────────────────────────────────────────────────
export async function requestRide({ userId, pickup, destination, zone = "default" }) {
  const res = await fetch(`${BACKEND}/request-ride`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      pickup_lat: pickup.lat,
      pickup_lon: pickup.lon,
      dest_lat: destination.lat,
      dest_lon: destination.lon,
      zone,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to request ride");
  }

  return res.json();
  // Returns: { ride_id, status, group_id, partners }
}

// ── Listen for real-time match updates via Supabase Realtime ──────────────
// Call this right after requestRide() — pass the ride_id you get back
// onMatch fires when a carpool partner is found
export function listenForMatch(rideId, onMatch) {
  const channel = supabase
    .channel(`ride:${rideId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rides",
        filter: `id=eq.${rideId}`,
      },
      (payload) => {
        const ride = payload.new;
        if (ride.status === "matched") {
          onMatch(ride);
        }
      }
    )
    .subscribe();

  // Return an unsubscribe function — call it when component unmounts
  return () => supabase.removeChannel(channel);
}

// ── Fallback: poll for status if Realtime isn't available ─────────────────
export async function pollRideStatus(rideId) {
  const res = await fetch(`${BACKEND}/ride-status/${rideId}`);
  if (!res.ok) throw new Error("Failed to fetch ride status");
  return res.json();
}

// ── Get user's current GPS location ───────────────────────────────────────
export function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported by your browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true }
    );
  });
}