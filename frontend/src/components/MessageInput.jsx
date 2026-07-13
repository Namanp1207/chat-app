import React, { useRef, useState } from "react";

const TYPING_STOP_DELAY_MS = 1500;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function MessageInput({ onSend, onSendImage, onTypingStart, onTypingStop, disabled }) {
  const [text, setText] = useState("");
  const [imageError, setImageError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setText(e.target.value);

    // Emit typing:start once, then debounce typing:stop
    onTypingStart();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop();
    }, TYPING_STOP_DELAY_MS);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    onSend(trimmed);
    setText("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onTypingStop();
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow picking the same file twice in a row
    if (!file) return;

    setImageError("");

    if (!file.type.startsWith("image/")) {
      setImageError("Please choose an image file");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image is too large (max 5MB)");
      return;
    }

    setIsUploading(true);
    try {
      await onSendImage(file);
    } catch (err) {
      setImageError(err.message || "Failed to send image");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="message-input-wrapper">
      {imageError && <div className="banner banner-error image-error">{imageError}</div>}
      <form className="message-input-bar" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="attach-button"
          onClick={handlePickImage}
          disabled={disabled || isUploading}
          title="Send an image"
        >
          {isUploading ? "…" : "📎"}
        </button>
        <input
          className="message-input"
          type="text"
          placeholder={disabled ? "Reconnecting..." : "Type a message..."}
          value={text}
          onChange={handleChange}
          disabled={disabled}
          maxLength={2000}
        />
        <button className="send-button" type="submit" disabled={disabled || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
