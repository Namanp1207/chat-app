import React from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";
import Sidebar from "./Sidebar";
import CallModal from "./CallModal";
import Avatar from "./Avatar";

export default function ChatWindow({
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
  messages,
  typingUsers,
  isConnected,
  loadError,
  onSend,
  onSendImage,
  onTypingStart,
  onTypingStop,
  call,
  onStartCall,
  theme,
  toggleTheme,
}) {
  const isPeerOnline = activePeer && onlineUsers.includes(activePeer);

  return (
    <div className={`chat-app ${activePeer ? "has-active-peer" : ""}`}>
      <Sidebar
        username={username}
        activeTab={activeTab}
        onTabChange={onTabChange}
        connections={connections}
        onlineUsers={onlineUsers}
        activePeer={activePeer}
        unreadCounts={unreadCounts}
        onSelectConversation={onSelectConversation}
        users={users}
        incomingRequests={incomingRequests}
        onFollow={onFollow}
        onAccept={onAccept}
        onReject={onReject}
        onLogout={onLogout}
        onDeleteAccount={onDeleteAccount}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <div className="chat-main">
        {activePeer ? (
          <>
            <header className="chat-header">
              <div className="chat-header-peer">
                <button className="back-button" title="Back" onClick={() => onSelectConversation(null)}>
                  ←
                </button>
                <Avatar username={activePeer} online={isPeerOnline} />
                <div>
                  <h1>{activePeer}</h1>
                  <span className={`connection-badge ${isPeerOnline ? "online" : "offline"}`}>
                    {isPeerOnline ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
              <div className="chat-header-actions">
                <button className="icon-btn call-icon" title="Voice call" onClick={() => onStartCall(activePeer, "audio")}>
                  📞
                </button>
                <button className="icon-btn call-icon" title="Video call" onClick={() => onStartCall(activePeer, "video")}>
                  🎥
                </button>
              </div>
            </header>

            {loadError && <div className="banner banner-error">{loadError}</div>}
            {call.error && <div className="banner banner-error">{call.error}</div>}

            <MessageList messages={messages} currentUsername={username} />
            <TypingIndicator typingUsers={typingUsers} />
            <MessageInput
              onSend={onSend}
              onSendImage={onSendImage}
              onTypingStart={onTypingStart}
              onTypingStop={onTypingStop}
              disabled={!isConnected}
            />
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <h2>Select a conversation</h2>
            <p>Pick someone from Chats, or find and follow someone new in People.</p>
            {!isConnected && <span className="connection-badge offline">Disconnected — retrying...</span>}
          </div>
        )}
      </div>

      <CallModal call={call} />
    </div>
  );
}
