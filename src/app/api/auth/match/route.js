// // ─────────────────────────────────────────────────────────────────────────────
// // app/api/match/route.js
// //
// // GET /api/match?driverLng=88.36&driverLat=22.57&destLng=88.43&destLat=22.62
// //
// // 1. Fetches all "waiting" ride_requests from Firestore
// // 2. Gets the driver's OSRM route
// // 3. Scores each passenger pickup against that route
// // 4. Returns passengers sorted by match score (best first)
// // ─────────────────────────────────────────────────────────────────────────────

// import { NextResponse } from "next/server";
// import { collection, getDocs, query, where } from "firebase/firestore";
// import { db } from "@/app/lib/firebase";
// import { scoreRequest } from "@/app/lib/routeMatch";

// /**
//  * Fetch OSRM route between two points.
//  * Returns array of [lng, lat] coordinates.
//  */
// async function getOSRMRoute(fromLng, fromLat, toLng, toLat) {
//     const url =
//         `https://router.project-osrm.org/route/v1/driving/` +
//         `${fromLng},${fromLat};${toLng},${toLat}` +
//         `?overview=full&geometries=geojson`;

//     const res = await fetch(url);
//     const data = await res.json();

//     if (!data.routes?.length) throw new Error("OSRM route not found");
//     return data.routes[0].geometry.coordinates; // [[lng,lat], ...]
// }

// export async function GET(request) {
//     try {
//         const { searchParams } = new URL(request.url);

//         const driverLng = parseFloat(searchParams.get("driverLng"));
//         const driverLat = parseFloat(searchParams.get("driverLat"));
//         const destLng = parseFloat(searchParams.get("destLng"));
//         const destLat = parseFloat(searchParams.get("destLat"));

//         if ([driverLng, driverLat, destLng, destLat].some(isNaN)) {
//             return NextResponse.json(
//                 { error: "Missing or invalid coordinates. Required: driverLng, driverLat, destLng, destLat" },
//                 { status: 400 }
//             );
//         }

//         // 1. Get driver's route from OSRM
//         const routeCoords = await getOSRMRoute(driverLng, driverLat, destLng, destLat);

//         // 2. Fetch all waiting ride requests from Firestore
//         const q = query(
//             collection(db, "ride_requests"),
//             where("status", "==", "waiting")
//         );
//         const snapshot = await getDocs(q);

//         const requests = [];
//         snapshot.forEach((doc) => {
//             requests.push({ id: doc.id, ...doc.data() });
//         });

//         // 3. Score each request
//         const scored = requests
//             .filter((r) => r.pickupLng && r.pickupLat) // skip incomplete data
//             .map((r) => {
//                 const match = scoreRequest(routeCoords, r);
//                 return {
//                     id: r.id,
//                     userId: r.userId,
//                     userName: r.userName || "Passenger",
//                     pickupName: r.pickupName,
//                     pickupLat: r.pickupLat,
//                     pickupLng: r.pickupLng,
//                     destName: r.destName,
//                     destLat: r.destLat,
//                     destLng: r.destLng,
//                     vehicleName: r.vehicleName,
//                     passengers: r.passengers || 1,
//                     paymentMethod: r.paymentMethod,
//                     distanceKm: r.distanceKm,
//                     createdAt: r.createdAt?.toMillis?.() ?? null,
//                     // Match data
//                     metres: match.metres,
//                     score: match.score,
//                     tag: match.tag,
//                 };
//             })
//             .sort((a, b) => b.score - a.score); // best match first

//         return NextResponse.json({ routeCoords, passengers: scored });

//     } catch (err) {
//         console.error("[api/match] error:", err.message);
//         return NextResponse.json({ error: err.message }, { status: 500 });
//     }
// }


// app/api/match/route.js
//
// GET /api/match?driverLng=88.36&driverLat=22.57&destLng=88.43&destLat=22.62
//
// Uses Firestore REST API — no Firebase Admin SDK needed.
// Reads all "waiting" ride_requests, scores each pickup against the driver's
// OSRM route, returns sorted list.

import { NextResponse } from "next/server";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;   // ridesync-4cf67
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;       // AIzaSy...

// ── Firestore REST: list all ride_requests ─────────────────────────────────
async function getWaitingRequests() {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/ride_requests?key=${API_KEY}&pageSize=200`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Firestore fetch failed: ${res.status}`);
    const data = await res.json();

    if (!data.documents?.length) return [];

    return data.documents
        .map((doc) => {
            const f = doc.fields || {};
            const id = doc.name.split("/").pop();

            // Helper: safely read any Firestore value type
            const str = (k) => f[k]?.stringValue ?? null;
            const num = (k) => parseFloat(f[k]?.doubleValue ?? f[k]?.integerValue ?? 0);
            const int = (k) => parseInt(f[k]?.integerValue ?? f[k]?.doubleValue ?? 0);
            const ts = (k) => f[k]?.timestampValue ? new Date(f[k].timestampValue).getTime() : null;

            return {
                id,
                userId: str("userId"),
                userName: str("userName") || "Passenger",
                pickupName: str("pickupName") || "Unknown pickup",
                pickupLat: num("pickupLat"),
                pickupLng: num("pickupLng"),
                destName: str("destName") || "Unknown destination",
                destLat: num("destLat"),
                destLng: num("destLng"),
                vehicleName: str("vehicleName") || "Any",
                passengers: int("passengers") || 1,
                paymentMethod: str("paymentMethod") || "Cash",
                distanceKm: num("distanceKm"),
                durationMin: num("durationMin"),
                status: str("status"),
                createdAt: ts("createdAt"),
            };
        })
        // Only include "waiting" requests that have valid coordinates
        .filter((r) => r.status === "waiting" && r.pickupLng !== 0 && r.pickupLat !== 0);
}

// ── OSRM route between two points ─────────────────────────────────────────
async function getOSRMRoute(fromLng, fromLat, toLng, toLat) {
    const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${fromLng},${fromLat};${toLng},${toLat}` +
        `?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.routes?.length) throw new Error("Could not calculate route. Try different locations.");
    return {
        coords: data.routes[0].geometry.coordinates, // [[lng,lat], ...]
        distanceKm: data.routes[0].distance / 1000,
        durationMin: data.routes[0].duration / 60,
    };
}

// ── Point-to-polyline distance in metres ──────────────────────────────────
function ptSegDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    // Convert degrees → metres (good enough for city scale)
    const avgLat = ((py + ay) / 2) * (Math.PI / 180);
    const dLng = (px - (ax + t * dx)) * Math.cos(avgLat);
    const dLat = py - (ay + t * dy);
    return Math.sqrt(dLng * dLng + dLat * dLat) * 111_320;
}

function minDistToRoute(coords, lng, lat) {
    let min = Infinity;
    for (let i = 0; i < coords.length - 1; i++) {
        const d = ptSegDist(lng, lat, coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
        if (d < min) min = d;
    }
    return min;
}

function scoreAndTag(metres) {
    const score = Math.max(0, Math.round(100 - (metres / 5000) * 100));
    const tag = metres <= 600 ? "on route" : metres <= 2000 ? "slight detour" : "off route";
    return { score, tag, metres: Math.round(metres) };
}

// ── GET /api/match ─────────────────────────────────────────────────────────
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const driverLng = parseFloat(searchParams.get("driverLng"));
        const driverLat = parseFloat(searchParams.get("driverLat"));
        const destLng = parseFloat(searchParams.get("destLng"));
        const destLat = parseFloat(searchParams.get("destLat"));

        if ([driverLng, driverLat, destLng, destLat].some(isNaN)) {
            return NextResponse.json(
                { error: "Missing coordinates: driverLng, driverLat, destLng, destLat" },
                { status: 400 }
            );
        }

        // Run both in parallel
        const [route, requests] = await Promise.all([
            getOSRMRoute(driverLng, driverLat, destLng, destLat),
            getWaitingRequests(),
        ]);

        // Score every passenger pickup against the driver's route
        const passengers = requests
            .map((r) => {
                const metres = minDistToRoute(route.coords, r.pickupLng, r.pickupLat);
                return { ...r, ...scoreAndTag(metres) };
            })
            .sort((a, b) => b.score - a.score); // best match first

        return NextResponse.json({
            routeCoords: route.coords,
            distanceKm: Math.round(route.distanceKm * 10) / 10,
            durationMin: Math.round(route.durationMin),
            passengers,
        });

    } catch (err) {
        console.error("[api/match] error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}