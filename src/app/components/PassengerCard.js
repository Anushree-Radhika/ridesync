// app/components/PassengerCard.js
"use client";

const TAG_STYLES = {
    "on route": { background: "#e8f5ee", color: "#0f6e56", border: "1px solid #a8dfc4" },
    "slight detour": { background: "#fef9ec", color: "#854f0b", border: "1px solid #fac775" },
    "off route": { background: "#fef0f0", color: "#a32d2d", border: "1px solid #f09595" },
};

function scoreColor(s) {
    return s >= 80 ? "#0f6e56" : s >= 55 ? "#854f0b" : "#a32d2d";
}

function timeAgo(ms) {
    if (!ms) return "";
    const mins = Math.floor((Date.now() - ms) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
}

export default function PassengerCard({
    passenger, selected, onSelect, onAccept, onDecline,
}) {
    const {
        id, userName, pickupName, destName, score, tag, metres,
        passengers, vehicleName, paymentMethod, distanceKm, durationMin,
        createdAt, status,
    } = passenger;

    const tagStyle = TAG_STYLES[tag] || TAG_STYLES["off route"];
    const isAccepted = status === "accepted";

    return (
        <div
            onClick={() => onSelect(id)}
            style={{
                background: selected ? "#fafafa" : "#fff",
                border: selected ? "1.5px solid #000" : "1px solid #ebebeb",
                borderRadius: "12px",
                padding: "14px",
                cursor: "pointer",
                transition: "border 0.12s, background 0.12s",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Accepted accent bar */}
            {isAccepted && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "#1d9e75" }} />
            )}

            {/* ── Top row: avatar + name + score ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0,
                        background: "#f0f0f0", border: "1.5px solid #e0e0e0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: "13px", color: "#333",
                    }}>
                        {(userName || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "#000" }}>{userName}</div>
                        <div style={{ fontSize: "11px", color: "#999", marginTop: "1px" }}>
                            {passengers} seat{passengers > 1 ? "s" : ""} · {vehicleName}
                            {createdAt ? ` · ${timeAgo(createdAt)}` : ""}
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: "17px", fontFamily: "monospace", color: scoreColor(score) }}>
                        {score}%
                    </div>
                    <div style={{ fontSize: "10px", color: "#bbb" }}>match</div>
                </div>
            </div>

            {/* ── Route ── */}
            <div style={{ paddingLeft: "4px", display: "flex", flexDirection: "column", gap: "4px", margin: "8px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1d9e75", flexShrink: 0 }} />
                    <span style={{ color: "#888" }}>From</span>
                    <span style={{ fontWeight: 600, color: "#000" }}>{pickupName}</span>
                </div>
                <div style={{ width: "1px", height: "10px", background: "#ddd", marginLeft: "3px" }} />
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                    <div style={{ width: "8px", height: "8px", background: "#7f77dd", flexShrink: 0 }} />
                    <span style={{ color: "#888" }}>To</span>
                    <span style={{ fontWeight: 600, color: "#000" }}>{destName}</span>
                </div>
            </div>

            {/* ── Tags row ── */}
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 9px", borderRadius: "20px", ...tagStyle }}>
                    {tag === "on route"
                        ? "✓ On your route"
                        : tag === "slight detour"
                            ? `+${(metres / 1000).toFixed(1)} km detour`
                            : `${(metres / 1000).toFixed(1)} km off route`}
                </span>

                {distanceKm > 0 && (
                    <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: "#f5f5f5", color: "#555", border: "1px solid #ebebeb" }}>
                        {distanceKm.toFixed(1)} km
                    </span>
                )}

                {durationMin > 0 && (
                    <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: "#f5f5f5", color: "#555", border: "1px solid #ebebeb" }}>
                        ~{Math.round(durationMin)} min
                    </span>
                )}

                <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: "#f5f5f5", color: "#555", border: "1px solid #ebebeb" }}>
                    {paymentMethod}
                </span>

                {isAccepted && (
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "20px", background: "#e8f5ee", color: "#0f6e56", border: "1px solid #a8dfc4" }}>
                        ✓ Accepted
                    </span>
                )}
            </div>

            {/* ── Action buttons ── */}
            {!isAccepted && (
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onAccept(id); }}
                        style={{
                            flex: 1, padding: "9px", background: "#000", color: "#fff",
                            border: "none", borderRadius: "8px", fontWeight: 700,
                            fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
                        }}
                    >
                        Accept
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDecline(id); }}
                        style={{
                            flex: 1, padding: "9px", background: "#fff", color: "#666",
                            border: "1px solid #e0e0e0", borderRadius: "8px", fontWeight: 600,
                            fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
                        }}
                    >
                        Decline
                    </button>
                </div>
            )}
        </div>
    );
}