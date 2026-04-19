// ─────────────────────────────────────────────────────────────────────────────
// lib/routeMatch.js
// Pure utility — no Firebase, no UI.
// Calculates how well a passenger's pickup point sits on a driver's route.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimum distance (in metres) from a point to a line segment.
 * All inputs are [lng, lat] pairs (matching OSRM / GeoJSON order).
 */
function pointToSegmentDistMetres(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
        t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
    }

    const nearX = ax + t * dx;
    const nearY = ay + t * dy;

    // Convert degree difference → metres (approximate, good enough for city scale)
    const dLng = (px - nearX) * Math.cos(((py + nearY) / 2) * (Math.PI / 180));
    const dLat = py - nearY;
    return Math.sqrt(dLng * dLng + dLat * dLat) * 111_320;
}

/**
 * Minimum distance in metres from a point to the closest segment of a polyline.
 *
 * @param {[number, number][]} routeCoords  - OSRM coords: array of [lng, lat]
 * @param {number}             pickupLng
 * @param {number}             pickupLat
 * @returns {number} metres
 */
export function minDistToRoute(routeCoords, pickupLng, pickupLat) {
    if (!routeCoords || routeCoords.length < 2) return Infinity;

    let minDist = Infinity;

    for (let i = 0; i < routeCoords.length - 1; i++) {
        const [ax, ay] = routeCoords[i];
        const [bx, by] = routeCoords[i + 1];
        const d = pointToSegmentDistMetres(pickupLng, pickupLat, ax, ay, bx, by);
        if (d < minDist) minDist = d;
    }

    return minDist;
}

/**
 * Convert metres off-route → a 0–100 match score.
 * 0 m off  → 100 %
 * 500 m off → ~90 %
 * 2 km off  → ~60 %
 * 5 km off  → 0 %
 *
 * @param {number} metres
 * @returns {number} 0–100
 */
export function matchScore(metres) {
    const MAX_METRES = 5000; // beyond this = 0 %
    return Math.max(0, Math.round(100 - (metres / MAX_METRES) * 100));
}

/**
 * Human-readable detour tag based on metres off-route.
 * @param {number} metres
 * @returns {"on route"|"slight detour"|"off route"}
 */
export function detourTag(metres) {
    if (metres <= 600) return "on route";
    if (metres <= 2000) return "slight detour";
    return "off route";
}

/**
 * Full scoring helper — given a driver's OSRM route coords and one passenger
 * ride_request doc, returns enriched match data.
 *
 * @param {[number,number][]} routeCoords  Driver's OSRM route
 * @param {Object}            request      Firestore ride_request document data
 * @returns {{ metres: number, score: number, tag: string }}
 */
export function scoreRequest(routeCoords, request) {
    const metres = minDistToRoute(routeCoords, request.pickupLng, request.pickupLat);
    return {
        metres: Math.round(metres),
        score: matchScore(metres),
        tag: detourTag(metres),
    };
}