import React, { useState } from "react";
import ConversationList from "./ConversationList";
import PeopleList from "./PeopleList";
import Avatar from "./Avatar";
import { MoreVertical } from "lucide-react";

export default function Sidebar({
  username,
  activeTab,
  onTabChange,
  connections,
  onlineUsers,
  activePeer,
  unreadCounts,
  onSelectConversation,
  users,
  incomingRequests,
  onFollow,
  onAccept,
  onReject,
  onLogout,
  onDeleteAccount,
  theme,
  toggleTheme,
}) {
  const requestCount = incomingRequests.length;
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");

  const handleDeleteClick = () => {
    setMenuOpen(false);
    const confirmed = window.confirm(
      "Delete your account? This permanently deletes your account, your connections, and every conversation you're part of. This can't be undone.",
    );
    if (confirmed) onDeleteAccount();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-profile">
        <Avatar username={username} size={40} online />
        <div className="sidebar-profile-body">
          <span className="sidebar-profile-name">{username}</span>
          <span className="sidebar-profile-sub">Online</span>
        </div>
        <div className="profile-menu-wrap">
          <button
            className="icon-btn logout-icon"
            title="Account menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical size={20} />
          </button>
          {menuOpen && (
            <>
              <div
                className="profile-menu-backdrop"
                onClick={() => setMenuOpen(false)}
              />
              <div className="profile-menu">
                <button
                  className="profile-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                >
                  Log out
                </button>
                <button
                  className="profile-menu-item danger"
                  onClick={handleDeleteClick}
                >
                  Delete account
                </button>
                <button
                  className="profile-menu-item-theme"
                  onClick={toggleTheme}
                >
                  {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === "chats" ? "active" : ""}`}
          onClick={() => onTabChange("chats")}
        >
          Chats
        </button>
        <button
          className={`sidebar-tab ${activeTab === "people" ? "active" : ""}`}
          onClick={() => onTabChange("people")}
        >
          People
          {requestCount > 0 && (
            <span className="tab-badge">{requestCount}</span>
          )}
        </button>
      </div>

      <div className="sidebar-content">
        {activeTab === "chats" ? (
          <ConversationList
            connections={connections}
            onlineUsers={onlineUsers}
            activePeer={activePeer}
            unreadCounts={unreadCounts}
            onSelect={onSelectConversation}
            chatSearch={chatSearch}
            setChatSearch={setChatSearch}
          />
        ) : (
          <PeopleList
            users={users}
            incomingRequests={incomingRequests}
            onFollow={onFollow}
            onAccept={onAccept}
            onReject={onReject}
            onSelectConversation={(peer) => {
              onSelectConversation(peer);
              onTabChange("chats");
            }}
          />
        )}
      </div>
    </aside>
  );
}
