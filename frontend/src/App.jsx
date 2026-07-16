import React, { useCallback, useEffect, useRef, useState } from "react";
import Login from "./components/Login";
import ChatWindow from "./components/ChatWindow";
import {
  fetchConversation,
  uploadImage,
  fetchUsers,
  fetchConnections,
  sendFollowRequest,
  acceptConnection,
  rejectConnection,
  UnauthorizedError,
} from "./api/api";
import {
  login as apiLogin,
  register as apiRegister,
  saveSession,
  clearSession,
  getToken,
  getStoredUser,
  deleteAccount as apiDeleteAccount,
} from "./api/auth";
import { socket, connectSocket, disconnectSocket } from "./socket/socket";
import { conversationIdFor } from "./utils/conversation";
import useCall from "./hooks/useCall";
import "./styles/App.css";

const EMPTY_CONNECTIONS = { accepted: [], incoming: [], outgoing: [] };

export default function App() {
  const [token, setToken] = useState(() => getToken());
  const [username, setUsername] = useState(() => {
    const stored = getStoredUser();
    return stored ? stored.username : "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState("chats");
  const [activePeer, setActivePeer] = useState(null);
  const [connections, setConnections] = useState(EMPTY_CONNECTIONS);
  const [users, setUsers] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [loadedConversations, setLoadedConversations] = useState(new Set());
  const [unreadCounts, setUnreadCounts] = useState({});

  const [loadError, setLoadError] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingPeers, setTypingPeers] = useState(new Set());
  const [isConnected, setIsConnected] = useState(false);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const isTypingRef = useRef(false);
  const activePeerRef = useRef(null);
  const call = useCall(socket, username);

  useEffect(() => {
    activePeerRef.current = activePeer;
  }, [activePeer]);

  const handleLogout = useCallback(() => {
    clearSession();
    disconnectSocket();
    setToken(null);
    setUsername("");
    setConnections(EMPTY_CONNECTIONS);
    setUsers([]);
    setActivePeer(null);
    setMessagesByConversation({});
    setLoadedConversations(new Set());
    setUnreadCounts({});
    setOnlineUsers([]);
    setTypingPeers(new Set());
    setIsConnected(false);
  }, []);

  const refreshConnections = useCallback(() => {
    if (!token) return;
    fetchConnections(token)
      .then(setConnections)
      .catch((err) => {
        if (err instanceof UnauthorizedError) handleLogout();
      });
  }, [token, handleLogout]);

  const refreshUsers = useCallback(() => {
    if (!token) return;
    fetchUsers(token)
      .then(setUsers)
      .catch((err) => {
        if (err instanceof UnauthorizedError) handleLogout();
      });
  }, [token, handleLogout]);

  // --- Load connections + directory once authenticated ---
  useEffect(() => {
    if (!token) return;
    refreshConnections();
    refreshUsers();
  }, [token, refreshConnections, refreshUsers]);

  // --- Connect the socket once authenticated ---
  useEffect(() => {
    if (token) connectSocket(token);
  }, [token]);

  // --- Wire up socket listeners once ---
  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleConnectError = (err) => {
      console.error("Socket connection error:", err.message);
      setIsConnected(false);
      if (err.message && err.message.toLowerCase().includes("authentication")) {
        handleLogout();
      }
    };

    const handleMessageReceive = (message) => {
      setMessagesByConversation((prev) => {
        const list = prev[message.conversationId] || [];
        if (list.some((m) => m.id === message.id)) return prev;
        return { ...prev, [message.conversationId]: [...list, message] };
      });

      const peer =
        message.fromUsername === username
          ? message.toUsername
          : message.fromUsername;
      if (peer !== activePeerRef.current) {
        setUnreadCounts((prev) => ({ ...prev, [peer]: (prev[peer] || 0) + 1 }));
      }
    };

    const handleStatusUpdate = ({ id, status }) => {
      setMessagesByConversation((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key].some((m) => m.id === id)) {
            next[key] = next[key].map((m) =>
              m.id === id ? { ...m, status } : m,
            );
          }
        }
        return next;
      });
    };

    const handleUsersOnline = (list) => setOnlineUsers(list);

    const handleTypingUpdate = ({ username: typer, isTyping }) => {
      setTypingPeers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(typer);
        else next.delete(typer);
        return next;
      });
    };

    const handleConnectionChange = () => {
      refreshConnections();
      refreshUsers();
    };

    const handleConnectionRemoved = ({ username: removedUsername }) => {
      refreshConnections();
      refreshUsers();
      setActivePeer((prev) => (prev === removedUsername ? null : prev));
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("message:receive", handleMessageReceive);
    socket.on("message:statusUpdate", handleStatusUpdate);
    socket.on("users:online", handleUsersOnline);
    socket.on("typing:update", handleTypingUpdate);
    socket.on("connection:incoming", handleConnectionChange);
    socket.on("connection:accepted", handleConnectionChange);
    socket.on("connection:rejected", handleConnectionChange);
    socket.on("connection:removed", handleConnectionRemoved);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("message:receive", handleMessageReceive);
      socket.off("message:statusUpdate", handleStatusUpdate);
      socket.off("users:online", handleUsersOnline);
      socket.off("typing:update", handleTypingUpdate);
      socket.off("connection:incoming", handleConnectionChange);
      socket.off("connection:accepted", handleConnectionChange);
      socket.off("connection:rejected", handleConnectionChange);
      socket.off("connection:removed", handleConnectionRemoved);
    };
  }, [handleLogout, username, refreshConnections, refreshUsers]);

  const handleAuthSubmit = useCallback(async (mode, name, password, email) => {
    setAuthError("");
    setIsSubmitting(true);
    try {
      const data =
        mode === "login"
          ? await apiLogin(name, password)
          : await apiRegister(name, password, email);
      saveSession(data.token, data.user);
      setToken(data.token);
      setUsername(data.user.username);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleSelectConversation = useCallback(
    (peer) => {
      setActivePeer(peer);
      if (!peer) return;
      setUnreadCounts((prev) => ({ ...prev, [peer]: 0 }));

      const conversationId = conversationIdFor(username, peer);
      if (!loadedConversations.has(conversationId)) {
        fetchConversation(token, peer)
          .then((history) => {
            setMessagesByConversation((prev) => ({
              ...prev,
              [conversationId]: history,
            }));
            setLoadedConversations((prev) => new Set(prev).add(conversationId));
          })
          .catch((err) => {
            if (err instanceof UnauthorizedError) handleLogout();
            else setLoadError(`Could not load conversation: ${err.message}`);
          });
      }
    },
    [username, token, loadedConversations, handleLogout],
  );

  const handleSend = useCallback(
    (text) => {
      if (!activePeer) return;
      socket.emit(
        "message:send",
        { toUsername: activePeer, type: "text", text },
        (response) => {
          if (!response || !response.success) {
            setLoadError(
              `Message failed to send: ${(response && response.error) || "unknown error"}`,
            );
            setTimeout(() => setLoadError(""), 4000);
          }
        },
      );
    },
    [activePeer],
  );

  const handleSendImage = useCallback(
    async (file) => {
      if (!activePeer) return;
      const { url } = await uploadImage(token, file);
      return new Promise((resolve, reject) => {
        socket.emit(
          "message:send",
          { toUsername: activePeer, type: "image", imageUrl: url },
          (response) => {
            if (!response || !response.success) {
              reject(
                new Error(
                  (response && response.error) || "Failed to send image",
                ),
              );
            } else {
              resolve(response.data);
            }
          },
        );
      });
    },
    [token, activePeer],
  );

  const handleTypingStart = useCallback(() => {
    if (isTypingRef.current || !activePeer) return;
    isTypingRef.current = true;
    socket.emit("typing:start", { toUsername: activePeer });
  }, [activePeer]);

  const handleTypingStop = useCallback(() => {
    if (!isTypingRef.current || !activePeer) return;
    isTypingRef.current = false;
    socket.emit("typing:stop", { toUsername: activePeer });
  }, [activePeer]);

  const handleStartCall = useCallback(
    (toUsername, callType) => {
      call.startCall(toUsername, callType);
    },
    [call],
  );

  const handleFollow = useCallback(
    (toUsername) => {
      sendFollowRequest(token, toUsername)
        .then(() => refreshUsers())
        .catch((err) => setLoadError(err.message));
    },
    [token, refreshUsers],
  );

  const handleAccept = useCallback(
    (id) => {
      acceptConnection(token, id)
        .then(() => {
          refreshConnections();
          refreshUsers();
        })
        .catch((err) => setLoadError(err.message));
    },
    [token, refreshConnections, refreshUsers],
  );

  const handleReject = useCallback(
    (id) => {
      rejectConnection(token, id)
        .then(() => {
          refreshConnections();
          refreshUsers();
        })
        .catch((err) => setLoadError(err.message));
    },
    [token, refreshConnections, refreshUsers],
  );

  const handleDeleteAccount = useCallback(async () => {
    try {
      await apiDeleteAccount(token);
    } finally {
      // Log out locally regardless of whether the request succeeded, since
      // an already-deleted account can't be logged back into anyway.
      handleLogout();
    }
  }, [token, handleLogout]);

  if (!token || !username) {
    return (
      <Login
        onSubmit={handleAuthSubmit}
        error={authError}
        isSubmitting={isSubmitting}
      />
    );
  }

  const conversationId = activePeer
    ? conversationIdFor(username, activePeer)
    : null;
  const messages = conversationId
    ? messagesByConversation[conversationId] || []
    : [];
  const typingUsers =
    activePeer && typingPeers.has(activePeer) ? [activePeer] : [];

  return (
    <ChatWindow
      username={username}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      connections={connections.accepted}
      onlineUsers={onlineUsers}
      activePeer={activePeer}
      unreadCounts={unreadCounts}
      onSelectConversation={handleSelectConversation}
      users={users}
      incomingRequests={connections.incoming}
      onFollow={handleFollow}
      onAccept={handleAccept}
      onReject={handleReject}
      onLogout={handleLogout}
      onDeleteAccount={handleDeleteAccount}
      messages={messages}
      typingUsers={typingUsers}
      isConnected={isConnected}
      loadError={loadError}
      onSend={handleSend}
      onSendImage={handleSendImage}
      onTypingStart={handleTypingStart}
      onTypingStop={handleTypingStop}
      call={call}
      onStartCall={handleStartCall}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
}
