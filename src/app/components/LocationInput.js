"use client";

import { useState, useRef } from "react";

// ─── Nominatim place search ───────────────────────────────────────────────────
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

// ─── LocationInput Component ──────────────────────────────────────────────────
export default function LocationInput({ placeholder, value, onChange, onSelect, dotShape }) {
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
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0" }}>
        <div style={{ width: "10px", height: "10px", flexShrink: 0, borderRadius: dotShape === "circle" ? "50%" : "0", background: "#000" }} />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setShowDrop(true)}
          onBlur={() => setTimeout(() => setShowDrop(false), 200)}
          style={{ flex: 1, border: "none", outline: "none", fontSize: "0.95rem", fontFamily: "inherit", background: "transparent", color: "#000" }}
        />
      </div>
      
      {showDrop && (
        <div style={{ position: "absolute", top: "calc(100% - 6px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e2e2", borderRadius: "8px", zIndex: 1000, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          {suggestions.map((item, i) => (
            <button
              key={i}
              onMouseDown={() => { onChange(item.short); if(onSelect) onSelect(item); setSuggestions([]); setShowDrop(false); }}
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
