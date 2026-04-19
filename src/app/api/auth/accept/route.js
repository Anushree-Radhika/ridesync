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


// app/api/accept/route.js
//
// POST /api/accept
// Body: { rideId, driverId, driverName, driverEmail }
//
// Updates the ride_request doc in Firestore via REST API:
//   status     → "accepted"
//   driverId   → driverId
//   driverName → driverName
//   acceptedAt → current timestamp

import { NextResponse } from "next/server";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export async function POST(request) {
    try {
        const { rideId, driverId, driverName, driverEmail } = await request.json();

        if (!rideId || !driverId) {
            return NextResponse.json({ error: "rideId and driverId are required" }, { status: 400 });
        }

        const url =
            `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/ride_requests/${rideId}` +
            `?key=${API_KEY}` +
            `&updateMask.fieldPaths=status` +
            `&updateMask.fieldPaths=driverId` +
            `&updateMask.fieldPaths=driverName` +
            `&updateMask.fieldPaths=driverEmail` +
            `&updateMask.fieldPaths=acceptedAt`;

        const body = {
            fields: {
                status: { stringValue: "accepted" },
                driverId: { stringValue: driverId },
                driverName: { stringValue: driverName || "Driver" },
                driverEmail: { stringValue: driverEmail || "" },
                acceptedAt: { timestampValue: new Date().toISOString() },
            },
        };

        const res = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || "Firestore update failed");
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error("[api/accept] error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}