import React, { useEffect, useState } from "react";
import { forgotPassword, resetPassword } from "../api/auth";

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

export default function Login({ onSubmit, error, isSubmitting }) {
  // "login" | "register" | "forgot" | "reset"
  const [mode, setMode] = useState(() => (getTokenFromUrl() ? "reset" : "login"));
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [resetToken, setResetToken] = useState(() => getTokenFromUrl() || "");
  const [newPassword, setNewPassword] = useState("");
  const [forgotStatus, setForgotStatus] = useState(null); // { message } | { message, isError }
  const [resetStatus, setResetStatus] = useState(null); // { message } | { error }
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    // Clean the token out of the visible URL once we've picked it up
    if (getTokenFromUrl()) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    onSubmit(mode, username.trim(), password, email.trim());
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setIsWorking(true);
    setForgotStatus(null);
    try {
      const data = await forgotPassword(username.trim());
      setForgotStatus(data);
    } catch (err) {
      setForgotStatus({ message: err.message, isError: true });
    } finally {
      setIsWorking(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetToken.trim() || newPassword.length < 6) return;
    setIsWorking(true);
    setResetStatus(null);
    try {
      const data = await resetPassword(resetToken.trim(), newPassword);
      setResetStatus(data);
    } catch (err) {
      setResetStatus({ message: err.message, isError: true });
    } finally {
      setIsWorking(false);
    }
  };

  if (mode === "forgot") {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={handleForgotSubmit}>
          <h1>Reset your password</h1>
          <p className="login-subtitle">Enter your username and we'll send you a reset link.</p>

          <input
            className="login-input"
            type="text"
            placeholder="Username"
            value={username}
            autoFocus
            onChange={(e) => setUsername(e.target.value)}
          />

          {forgotStatus && (
            <div className={forgotStatus.isError ? "login-error" : "login-success"}>
              {forgotStatus.message}
            </div>
          )}

          <button className="login-button" type="submit" disabled={!username.trim() || isWorking}>
            {isWorking ? "Sending..." : "Send reset link"}
          </button>
          <button type="button" className="login-switch" onClick={() => setMode("login")}>
            Back to log in
          </button>
        </form>
      </div>
    );
  }

  if (mode === "reset") {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={handleResetSubmit}>
          <h1>Choose a new password</h1>
          <p className="login-subtitle">Paste your reset token if it wasn't filled in automatically.</p>

          <input
            className="login-input"
            type="text"
            placeholder="Reset token"
            value={resetToken}
            onChange={(e) => setResetToken(e.target.value)}
          />
          <input
            className="login-input"
            type="password"
            placeholder="New password"
            value={newPassword}
            autoComplete="new-password"
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <p className="login-hint">Password: 6+ characters.</p>

          {resetStatus && (
            <div className={resetStatus.isError ? "login-error" : "login-success"}>{resetStatus.message}</div>
          )}

          <button
            className="login-button"
            type="submit"
            disabled={!resetToken.trim() || newPassword.length < 6 || isWorking}
          >
            {isWorking ? "Updating..." : "Update password"}
          </button>
          <button type="button" className="login-switch" onClick={() => setMode("login")}>
            Back to log in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>💬 Realtime Chat</h1>
        <p className="login-subtitle">
          {mode === "login" ? "Log in to join the conversation" : "Create an account to get started"}
        </p>

        <input
          className="login-input"
          type="text"
          placeholder="Username"
          value={username}
          maxLength={20}
          autoFocus
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />
        {mode === "register" && (
          <input
            className="login-input"
            type="email"
            placeholder="Email (optional, for password resets)"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <input
          className="login-input"
          type="password"
          placeholder="Password"
          value={password}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode === "register" && (
          <p className="login-hint">
            3-20 characters, letters/numbers/underscores. Password: 6+ characters.
          </p>
        )}

        {mode === "login" && (
          <button type="button" className="login-forgot-link" onClick={() => setMode("forgot")}>
            Forgot password?
          </button>
        )}

        {error && <div className="login-error">{error}</div>}

        <button
          className="login-button"
          type="submit"
          disabled={!username.trim() || !password || isSubmitting}
        >
          {isSubmitting
            ? mode === "login"
              ? "Logging in..."
              : "Creating account..."
            : mode === "login"
            ? "Log in"
            : "Create account"}
        </button>

        <button
          type="button"
          className="login-switch"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
