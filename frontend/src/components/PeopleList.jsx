import React, { useMemo, useState } from "react";
import Avatar from "./Avatar";

const STATUS_LABEL = {
  none: "Follow",
  outgoing_pending: "Requested",
  incoming_pending: "Respond below",
  connected: "Message",
};

export default function PeopleList({
  users,
  incomingRequests,
  onFollow,
  onAccept,
  onReject,
  onSelectConversation,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.username.toLowerCase().includes(q));
  }, [users, query]);

  return (
    <div className="people-panel">
      {incomingRequests.length > 0 && (
        <div className="requests-section">
          <h3>Follow requests</h3>
          <ul className="requests-list">
            {incomingRequests.map((req) => (
              <li key={req.id} className="request-item">
                <Avatar username={req.fromUsername} size={34} />
                <span className="request-name">{req.fromUsername}</span>
                <div className="request-actions">
                  <button className="pill-btn accept" onClick={() => onAccept(req.id)}>
                    Accept
                  </button>
                  <button className="pill-btn reject" onClick={() => onReject(req.id)}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <input
        className="people-search"
        type="text"
        placeholder="Search people..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ul className="people-list">
        {filtered.map((u) => (
          <li key={u.username} className="people-item">
            <Avatar username={u.username} size={36} online={u.online} />
            <span className="people-item-name">{u.username}</span>
            {u.status === "connected" ? (
              <button className="pill-btn subtle" onClick={() => onSelectConversation(u.username)}>
                Message
              </button>
            ) : u.status === "incoming_pending" ? (
              <div className="request-actions">
                <button className="pill-btn accept" onClick={() => onAccept(u.requestId)}>
                  Accept
                </button>
                <button className="pill-btn reject" onClick={() => onReject(u.requestId)}>
                  Decline
                </button>
              </div>
            ) : (
              <button
                className={`pill-btn ${u.status === "outgoing_pending" ? "subtle" : "primary"}`}
                disabled={u.status === "outgoing_pending"}
                onClick={() => onFollow(u.username)}
              >
                {STATUS_LABEL[u.status] || "Follow"}
              </button>
            )}
          </li>
        ))}
        {filtered.length === 0 && <li className="sidebar-empty-hint">No matching users</li>}
      </ul>
    </div>
  );
}
