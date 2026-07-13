import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

// Call lifecycle: "idle" -> "outgoing" | "incoming" -> "in-call" -> "idle"
const initialState = {
  status: "idle",
  remoteUsername: null,
  callType: null, // "audio" | "video"
  error: null,
};

export default function useCall(socket, username) {
  const [state, setState] = useState(initialState);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const pcRef = useRef(null);
  const pendingOfferRef = useRef(null); // { offer, callType } while ringing
  const pendingCandidatesRef = useRef([]); // ICE candidates that arrive before remoteDescription is set
  const remoteUsernameRef = useRef(null); // mirrors state.remoteUsername for use inside socket callbacks

  const setRemoteUsername = (name) => {
    remoteUsernameRef.current = name;
  };

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setLocalStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setRemoteStream(null);
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    setRemoteUsername(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setState(initialState);
  }, []);

  const createPeerConnection = useCallback(
    (remoteUser) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("call:ice-candidate", { toUsername: remoteUser, candidate: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        setRemoteStream(e.streams[0]);
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "closed"].includes(pc.connectionState)) {
          cleanup();
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [socket, cleanup]
  );

  const getMedia = async (callType) => {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === "video",
    });
  };

  // --- Outgoing call ---
  const startCall = useCallback(
    async (toUsername, callType) => {
      try {
        setState({ status: "outgoing", remoteUsername: toUsername, callType, error: null });
        setRemoteUsername(toUsername);

        const stream = await getMedia(callType);
        setLocalStream(stream);

        const pc = createPeerConnection(toUsername);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("call:invite", { toUsername, offer, callType }, (ack) => {
          if (!ack || !ack.success) {
            setState((s) => ({ ...s, error: (ack && ack.error) || "Call failed to connect" }));
            cleanup();
          }
        });
      } catch (err) {
        console.error("startCall error", err);
        setState((s) => ({ ...s, error: err.message || "Could not access camera/microphone" }));
        cleanup();
      }
    },
    [socket, createPeerConnection, cleanup]
  );

  // --- Accept an incoming call ---
  const acceptCall = useCallback(async () => {
    const pending = pendingOfferRef.current;
    if (!pending) return;
    const { offer, callType, fromUsername } = pending;

    try {
      const stream = await getMedia(callType);
      setLocalStream(stream);

      const pc = createPeerConnection(fromUsername);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      // Flush any ICE candidates that arrived before we had a remote description
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(candidate).catch((e) => console.error("addIceCandidate error", e));
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:answer", { toUsername: fromUsername, answer });
      setState({ status: "in-call", remoteUsername: fromUsername, callType, error: null });
    } catch (err) {
      console.error("acceptCall error", err);
      socket.emit("call:reject", { toUsername: fromUsername });
      setState((s) => ({ ...s, error: err.message || "Could not access camera/microphone" }));
      cleanup();
    }
  }, [socket, createPeerConnection, cleanup]);

  const rejectCall = useCallback(() => {
    const pending = pendingOfferRef.current;
    if (pending) {
      socket.emit("call:reject", { toUsername: pending.fromUsername });
    }
    cleanup();
  }, [socket, cleanup]);

  const endCall = useCallback(() => {
    const remoteUser = remoteUsernameRef.current;
    if (remoteUser) {
      socket.emit("call:end", { toUsername: remoteUser });
    }
    cleanup();
  }, [socket, cleanup]);

  const toggleMute = useCallback(() => {
    setLocalStream((stream) => {
      if (stream) {
        stream.getAudioTracks().forEach((t) => (t.enabled = isMuted));
      }
      return stream;
    });
    setIsMuted((m) => !m);
  }, [isMuted]);

  const toggleVideo = useCallback(() => {
    setLocalStream((stream) => {
      if (stream) {
        stream.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
      }
      return stream;
    });
    setIsVideoOff((v) => !v);
  }, [isVideoOff]);

  // --- Socket event wiring ---
  useEffect(() => {
    const handleIncoming = ({ fromUsername, offer, callType }) => {
      // Already on a call/ringing -> auto-decline to keep this simple (single active call)
      if (pcRef.current || pendingOfferRef.current) {
        socket.emit("call:reject", { toUsername: fromUsername });
        return;
      }
      pendingOfferRef.current = { offer, callType, fromUsername };
      setRemoteUsername(fromUsername);
      setState({ status: "incoming", remoteUsername: fromUsername, callType, error: null });
    };

    const handleAnswered = async ({ fromUsername, answer }) => {
      if (fromUsername !== remoteUsernameRef.current || !pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        for (const candidate of pendingCandidatesRef.current) {
          await pcRef.current.addIceCandidate(candidate).catch((e) => console.error(e));
        }
        pendingCandidatesRef.current = [];
        setState((s) => ({ ...s, status: "in-call" }));
      } catch (err) {
        console.error("handleAnswered error", err);
      }
    };

    const handleIceCandidate = async ({ fromUsername, candidate }) => {
      if (fromUsername !== remoteUsernameRef.current) return;
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        pc.addIceCandidate(candidate).catch((e) => console.error("addIceCandidate error", e));
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const handleRejected = ({ fromUsername }) => {
      if (fromUsername !== remoteUsernameRef.current) return;
      setState((s) => ({ ...initialState, error: `${fromUsername} declined the call` }));
      cleanup();
    };

    const handleEnded = ({ fromUsername }) => {
      if (fromUsername !== remoteUsernameRef.current) return;
      cleanup();
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:answered", handleAnswered);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:rejected", handleRejected);
    socket.on("call:ended", handleEnded);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:answered", handleAnswered);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:rejected", handleRejected);
      socket.off("call:ended", handleEnded);
    };
  }, [socket, cleanup]);

  // Clean up any active call if the component unmounts (e.g. logout)
  useEffect(() => {
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}
