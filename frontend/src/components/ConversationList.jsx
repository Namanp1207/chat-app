import React from "react";
import Avatar from "./Avatar";

export default function ConversationList({ connections, onlineUsers, activePeer, unreadCounts, onSelect, chatSearch, setChatSearch, }) {
  if (connections.length === 0) {
    return (
      <div className="sidebar-empty">
        <p>No conversations yet.</p>
        <p className="sidebar-empty-hint">Go to the People tab to find and follow someone.</p>
      </div>
      
    );
  }

  return (
  <>
    <div className="people-panel">
      <input
        className="people-search"
        type="text"
        placeholder="Search chats..."
        value={chatSearch}
        onChange={(e) => setChatSearch(e.target.value)}
      />
    </div>

    <ul className="conversation-list">
      {connections
        .filter((peer) =>
          peer.toLowerCase().includes(chatSearch.toLowerCase())
        )
        .map((peer) => {
          const isOnline = onlineUsers.includes(peer);
          const unread = unreadCounts[peer] || 0;

          return (
            <li
              key={peer}
              className={`conversation-item ${
                activePeer === peer ? "active" : ""
              }`}
              onClick={() => onSelect(peer)}
            >
              <Avatar username={peer} online={isOnline} />

              <div className="conversation-item-body">
                <span className="conversation-item-name">{peer}</span>

                <span className="conversation-item-status">
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>

              {unread > 0 && (
                <span className="unread-badge">{unread}</span>
              )}
            </li>
          );
        })}
    </ul>
  </>
);

}
