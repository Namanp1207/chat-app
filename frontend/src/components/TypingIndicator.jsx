import React from "react";

export default function TypingIndicator({ typingUsers }) {
  if (typingUsers.length === 0) return <div className="typing-indicator-placeholder" />;

  const label =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing...`
      : `${typingUsers.join(", ")} are typing...`;

  return (
    <div className="typing-indicator">
      <span className="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </span>
      {label}
    </div>
  );
}
