import { useState } from "react";

export default function LoginView({ onLogin }) {
  const [mode, setMode] = useState("client");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [coachPassword, setCoachPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  async function submitClient(e) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");
      onLogin({ role: "client", client: data.client });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitCoach(e) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/coach-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: coachPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");
      onLogin({ role: "coach" });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="card">
      <nav className="tab-row login-tabs">
        <button
          type="button"
          className={`tab ${mode === "client" ? "tab-active" : ""}`}
          onClick={() => switchMode("client")}
        >
          Client login
        </button>
        <button
          type="button"
          className={`tab ${mode === "coach" ? "tab-active" : ""}`}
          onClick={() => switchMode("coach")}
        >
          Coach login
        </button>
      </nav>

      {mode === "client" ? (
        <form onSubmit={submitClient}>
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            className="title-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            className="title-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={isLoading || !username.trim() || !password}>
            {isLoading ? "Logging in..." : "Log in"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCoach}>
          <label htmlFor="coach-password">Coach password</label>
          <input
            id="coach-password"
            type="password"
            className="title-input"
            value={coachPassword}
            onChange={(e) => setCoachPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={isLoading || !coachPassword}>
            {isLoading ? "Logging in..." : "Log in"}
          </button>
        </form>
      )}
    </div>
  );
}
