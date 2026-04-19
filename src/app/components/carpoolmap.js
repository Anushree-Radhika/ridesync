"use client";

import { useEffect, useRef } from "react";

// We import Leaflet dynamically because it uses window — not available in SSR
let L;

export default function CarpoolMap({ pickup, destination, partners = [], className = "" }) {
  const mapRef = useRef(null);   // DOM node
  const leafletRef = useRef(null);   // Leaflet map instance

  useEffect(() => {
    // Dynamically import Leaflet (avoids SSR window error in Next.js)
    import("leaflet").then((leaflet) => {
      L = leaflet.default;

      // Fix Leaflet's broken default icon path in Next.js
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!mapRef.current || leafletRef.current) return;

      // Default center: Kolkata (change to your city)
      const center = pickup || { lat: 22.5726, lng: 88.3639 };

      const map = L.map(mapRef.current, {
        center: [center.lat, center.lon || center.lng],
        zoom: 13,
        zoomControl: true,
      });

      // OpenStreetMap tiles — completely free
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      leafletRef.current = map;
    });

    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
      }
    };
  }, []);

  // Update markers whenever pickup / destination / partners change
  useEffect(() => {
    if (!leafletRef.current || !L) return;
    const map = leafletRef.current;

    // Clear all existing layers except the tile layer
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    const bounds = [];

    // ── Your pickup marker (blue) ──────────────────────────────────────────
    if (pickup) {
      const pickupIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:14px;height:14px;border-radius:50%;
          background:#4A90E2;border:2.5px solid white;
          box-shadow:0 1px 4px rgba(0,0,0,0.3)">
        </div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([pickup.lat, pickup.lon], { icon: pickupIcon })
        .addTo(map)
        .bindPopup("Your pickup point");
      bounds.push([pickup.lat, pickup.lon]);

      // 2km radius circle around pickup
      L.circle([pickup.lat, pickup.lon], {
        radius: 2000,
        color: "#4A90E2",
        fillColor: "#4A90E2",
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: "5 5",
      }).addTo(map);
    }

    // ── Your destination marker (orange diamond) ───────────────────────────
    if (destination) {
      const destIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:12px;height:12px;
          background:#E2784A;border:2px solid white;
          transform:rotate(45deg);
          box-shadow:0 1px 4px rgba(0,0,0,0.3)">
        </div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      L.marker([destination.lat, destination.lon], { icon: destIcon })
        .addTo(map)
        .bindPopup("Your destination");
      bounds.push([destination.lat, destination.lon]);

      // Dashed line from pickup to destination
      if (pickup) {
        L.polyline(
          [[pickup.lat, pickup.lon], [destination.lat, destination.lon]],
          { color: "#4A90E2", weight: 1.5, dashArray: "6 4", opacity: 0.6 }
        ).addTo(map);
      }
    }

    // ── Partner markers (green) ────────────────────────────────────────────
    partners.forEach((partner, i) => {
      if (!partner.pickup_lat) return;

      const partnerIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:12px;height:12px;border-radius:50%;
          background:#26A69A;border:2px solid white;
          box-shadow:0 1px 4px rgba(0,0,0,0.3)">
        </div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      L.marker([partner.pickup_lat, partner.pickup_lon], { icon: partnerIcon })
        .addTo(map)
        .bindPopup(`Carpool partner ${i + 1}`);
      bounds.push([partner.pickup_lat, partner.pickup_lon]);
    });

    // Fit map to show all markers
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    }
  }, [pickup, destination, partners]);

  return (
    <>
      {/* Leaflet CSS — loaded once */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div ref={mapRef} className={`${styles.map} ${className}`} />
    </>
  );
}