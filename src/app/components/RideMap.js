"use client";

import { useEffect, useRef, memo } from "react";
import maplibregl from "maplibre-gl";

function RideMap({ pickup, destination, routeCoords, center }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // ── Initialise map once ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: center || [88.3639, 22.5726],
      zoom: 12,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once only

  // ── Update center when user location resolves ───────────────────────────
  useEffect(() => {
    if (!mapRef.current || !center) return;

    let rafId;
    const doFly = () => {
      rafId = requestAnimationFrame(() => {
        if (!mapRef.current) return;
        try {
          mapRef.current.resize(); // Ensure container size is updated before projection calc
          if (!routeCoords) {
            mapRef.current.flyTo({ center, zoom: 13, duration: 800 });
          }
        } catch (e) {
          console.warn("MapLibre flyTo error (safe to ignore if map is resizing):", e);
        }
      });
    };

    if (mapRef.current.isStyleLoaded()) {
      doFly();
    } else {
      mapRef.current.once("load", doFly);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [center, routeCoords]);

  // ── Draw / clear markers and route ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const drawVisuals = () => {
      if (!mapRef.current) return;

      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Clear old route layer/source
      if (map.getLayer("route")) map.removeLayer("route");
      if (map.getSource("route")) map.removeSource("route");

      // Pickup marker
      if (pickup && pickup.lng && pickup.lat) {
        const el = document.createElement("div");
        el.style.cssText = "width:14px;height:14px;border-radius:50%;background:#000;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);";
        markersRef.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat([pickup.lng, pickup.lat])
            .addTo(map)
        );
      }

      // Destination marker
      if (destination && destination.lng && destination.lat) {
        const el = document.createElement("div");
        el.style.cssText = "width:14px;height:14px;background:#000;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);";
        markersRef.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat([destination.lng, destination.lat])
            .addTo(map)
        );
      }

      // Route polyline
      if (routeCoords && routeCoords.length > 0) {
        if (!map.getSource("route")) {
          map.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "LineString", coordinates: routeCoords },
            },
          });
          map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#000", "line-width": 4, "line-opacity": 0.85 },
          });
        }

        // Fit bounds to the route safely
        requestAnimationFrame(() => {
          if (!mapRef.current) return;
          try {
            mapRef.current.resize(); // Ensure container size is updated
            const bounds = routeCoords.reduce(
              (b, c) => b.extend(c),
              new maplibregl.LngLatBounds(routeCoords[0], routeCoords[0])
            );
            map.fitBounds(bounds, { padding: 60, duration: 800 });
          } catch (e) {
            console.warn("MapLibre fitBounds error:", e);
          }
        });
      }
    };

    if (map.isStyleLoaded()) {
      drawVisuals();
    } else {
      map.once("load", drawVisuals);
    }
  }, [pickup, destination, routeCoords]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "300px" }} />;
}

// ─── KEY FIX ─────────────────────────────────────────────────────────────────
// React.memo with a custom comparator.
// The map only re-renders when routeCoords or center actually change.
// pickup / destination text changes while typing never reach this component.
// ─────────────────────────────────────────────────────────────────────────────
export default memo(RideMap, (prev, next) => {
  const sameRoute = prev.routeCoords === next.routeCoords;
  const sameCenter = prev.center?.[0] === next.center?.[0] && prev.center?.[1] === next.center?.[1];
  const samePickup =
    prev.pickup?.lat === next.pickup?.lat && prev.pickup?.lng === next.pickup?.lng;
  const sameDest =
    prev.destination?.lat === next.destination?.lat && prev.destination?.lng === next.destination?.lng;

  // Return true = skip re-render (props are "equal" for our purposes)
  return sameRoute && sameCenter && samePickup && sameDest;
});