import React, { useEffect, useRef } from "react";

export default function CallModal({ call }) {
  const {
    status,
    remoteUsername,
    callType,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = call;

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (callType === "video" && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
    if (callType === "audio" && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream, callType]);

  if (status === "idle") return null;

  const isVideo = callType === "video";

  return (
    <div className="call-overlay">
      <div className="call-modal">
        {status === "incoming" && (
          <>
            <div className="call-avatar">{remoteUsername?.[0]?.toUpperCase()}</div>
            <h2>{remoteUsername}</h2>
            <p className="call-status-text">Incoming {isVideo ? "video" : "voice"} call...</p>
            <div className="call-controls">
              <button className="call-btn reject" onClick={rejectCall} title="Decline">
                ✕
              </button>
              <button className="call-btn accept" onClick={acceptCall} title="Accept">
                ✓
              </button>
            </div>
          </>
        )}

        {status === "outgoing" && (
          <>
            <div className="call-avatar">{remoteUsername?.[0]?.toUpperCase()}</div>
            <h2>{remoteUsername}</h2>
            <p className="call-status-text">Calling...</p>
            <div className="call-controls">
              <button className="call-btn reject" onClick={endCall} title="Cancel">
                ✕
              </button>
            </div>
          </>
        )}

        {status === "in-call" && (
          <>
            {isVideo ? (
              <div className="video-grid">
                <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
                <video ref={localVideoRef} className="local-video" autoPlay playsInline muted />
              </div>
            ) : (
              <>
                <audio ref={remoteAudioRef} autoPlay />
                <div className="call-avatar">{remoteUsername?.[0]?.toUpperCase()}</div>
                <h2>{remoteUsername}</h2>
                <p className="call-status-text">In call</p>
              </>
            )}

            <div className="call-controls">
              <button
                className={`call-btn secondary ${isMuted ? "active" : ""}`}
                onClick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? "🔇" : "🎤"}
              </button>
              {isVideo && (
                <button
                  className={`call-btn secondary ${isVideoOff ? "active" : ""}`}
                  onClick={toggleVideo}
                  title={isVideoOff ? "Turn camera on" : "Turn camera off"}
                >
                  {isVideoOff ? "📷" : "🎥"}
                </button>
              )}
              <button className="call-btn reject" onClick={endCall} title="End call">
                ✕
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
