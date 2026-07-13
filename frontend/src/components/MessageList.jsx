import React, { useEffect, useRef } from "react";
import { SERVER_URL } from "../api/api";

function formatTime(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

// Image URLs from the server are relative ("/uploads/xyz.jpg"); resolve
// them against the backend origin so <img> works regardless of where the
// frontend is hosted.
function resolveImageUrl(url) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${SERVER_URL}${url}`;
}

export default function MessageList({ messages, currentUsername }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="message-list message-list-empty">
        <div className="empty-state-icon">👋</div>
        <p>No messages yet. Say hello!</p>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((msg) => {
        const isOwn = msg.fromUsername === currentUsername;
        const isImage = msg.type === "image";
        return (
          <div key={msg.id} className={`message-row ${isOwn ? "own" : "other"}`}>
            <div className={`message-bubble ${isOwn ? "own" : "other"} ${isImage ? "image-bubble" : ""}`}>
              {isImage ? (
                <a href={resolveImageUrl(msg.imageUrl)} target="_blank" rel="noopener noreferrer">
                  <img
                    className="message-image"
                    src={resolveImageUrl(msg.imageUrl)}
                    alt="Shared attachment"
                    loading="lazy"
                  />
                </a>
              ) : (
                <div className="message-text">{msg.text}</div>
              )}
              <div className="message-meta">
                <span>{formatTime(msg.timestamp)}</span>
                {isOwn && (
                  <span className={`message-status ${msg.status}`}>
                    {msg.status === "delivered" ? "✓✓" : "✓"}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
