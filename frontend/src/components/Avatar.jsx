import React from "react";

// Deterministic color per username so the same person always gets the same
// avatar color across sessions/devices, without storing anything extra.
const PALETTE = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444", "#3b82f6"];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function Avatar({ username, size = 40, online }) {
  const initial = username ? username[0].toUpperCase() : "?";
  return (
    <span className="avatar-wrap" style={{ width: size, height: size }}>
      <span
        className="avatar"
        style={{ background: colorFor(username || ""), width: size, height: size, fontSize: size * 0.42 }}
      >
        {initial}
      </span>
      {online && <span className="avatar-online-dot" />}
    </span>
  );
}
