import { useEffect, useState } from "react";
import CredentialsBanner from "./CredentialsBanner.jsx";

function formatDateTime(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const CATEGORY_LABELS = { "1rm": "1RM", wod: "Benchmark", mono: "Monostructural" };

export default function ClientManagement({ onBack, onSelectProgram }) {
  const [clients, setClients] = useState(null);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(null); // { name, username, password }
  const [resettingId, setResettingId] = useState(null);

  const [selectedClientId, setSelectedClientId] = useState(null);
  const [detail, setDetail] = useState(null);

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

  function loadDetail(clientId) {
    setDetail(null);
    setError("");
    fetch(`/api/clients/${clientId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load client.");
        setDetail(data);
      })
      .catch((err) => setError(err.message));
  }

  function openClient(clientId) {
    setSelectedClientId(clientId);
    loadDetail(clientId);
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
      if (selectedClientId === client.id) loadDetail(client.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setResettingId(null);
    }
  }

  if (selectedClientId) {
    return (
      <div className="card">
        <div className="preview-actions-top">
          <button type="button" className="secondary" onClick={() => setSelectedClientId(null)}>
            ← Back to clients
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}

        {revealed && (
          <CredentialsBanner credentials={revealed} onDismiss={() => setRevealed(null)} />
        )}

        {!detail && !error && <p className="preview-hint">Loading...</p>}

        {detail && (
          <>
            <h2 className="library-client-name">{detail.client.name}</h2>
            <p className="preview-hint">
              {detail.client.username} ·{" "}
              {detail.client.hasPassword ? "login set up" : "no password set yet"}
            </p>
            <button
              type="button"
              className="secondary"
              onClick={() => resetPassword(detail.client)}
              disabled={resettingId === detail.client.id}
            >
              {resettingId === detail.client.id
                ? "Resetting..."
                : detail.client.hasPassword
                ? "Reset password"
                : "Set password"}
            </button>

            <p className="rail-label">Programs</p>
            {detail.programs.length === 0 && (
              <p className="preview-hint">Nothing saved for this client yet.</p>
            )}
            {detail.programs.length > 0 && (
              <ul className="library-list">
                {detail.programs.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="library-item"
                      onClick={() => onSelectProgram(p.id)}
                    >
                      <span className="library-item-title">{p.title}</span>
                      <span className="library-item-meta">
                        {p.weekLabel} · saved {formatDateTime(p.savedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="rail-label">Recently logged</p>
            {detail.recentComments.length === 0 && detail.recentBenchmarks.length === 0 && (
              <p className="preview-hint">No comments or benchmark entries logged yet.</p>
            )}
            {(detail.recentComments.length > 0 || detail.recentBenchmarks.length > 0) && (
              <ul className="library-list">
                {detail.recentComments.map((c, i) => (
                  <li key={`c${i}`} className="client-row">
                    <div>
                      <span className="library-item-title">{c.label}</span>
                      <span className="library-item-meta">
                        {" "}
                        · {c.programTitle} · {formatDateTime(c.updatedAt)}
                      </span>
                      <p className="preview-hint" style={{ margin: "4px 0 0" }}>
                        {c.text}
                      </p>
                    </div>
                  </li>
                ))}
                {detail.recentBenchmarks.map((b, i) => (
                  <li key={`b${i}`} className="client-row">
                    <div>
                      <span className="library-item-title">
                        {b.name}: {b.value}
                      </span>
                      <span className="library-item-meta">
                        {" "}
                        · {CATEGORY_LABELS[b.category]} · {formatDateTime(b.recordedAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    );
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
              <button type="button" className="client-row-name" onClick={() => openClient(c.id)}>
                <span className="library-item-title">{c.name}</span>
                <span className="library-item-meta">
                  {" "}
                  · {c.username} · {c.hasPassword ? "login set up" : "no password set yet"}
                </span>
              </button>
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
