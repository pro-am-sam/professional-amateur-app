import { useEffect, useState } from "react";
import CredentialsBanner from "./CredentialsBanner.jsx";

export default function ClientManagement({ onBack }) {
  const [clients, setClients] = useState(null);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(null); // { name, username, password }
  const [resettingId, setResettingId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    fetch("/api/clients")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load clients.");
        setClients(data.clients);
      })
      .catch((err) => setError(err.message));
  }

  async function resetPassword(client) {
    setResettingId(client.id);
    setError("");
    try {
      const res = await fetch(`/api/clients/${client.id}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reset password.");
      setRevealed(data);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div className="card">
      <div className="preview-actions-top">
        <button type="button" className="secondary" onClick={onBack}>
          ← Back
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {revealed && (
        <CredentialsBanner credentials={revealed} onDismiss={() => setRevealed(null)} />
      )}

      {clients === null && !error && <p className="preview-hint">Loading...</p>}
      {clients && clients.length === 0 && (
        <p className="preview-hint">
          No clients yet — they're created automatically when you save a program for a new client.
        </p>
      )}

      {clients && clients.length > 0 && (
        <ul className="library-list">
          {clients.map((c) => (
            <li key={c.id} className="client-row">
              <div>
                <span className="library-item-title">{c.name}</span>
                <span className="library-item-meta">
                  {" "}
                  · {c.username} · {c.hasPassword ? "login set up" : "no password set yet"}
                </span>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => resetPassword(c)}
                disabled={resettingId === c.id}
              >
                {resettingId === c.id ? "Resetting..." : c.hasPassword ? "Reset password" : "Set password"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
