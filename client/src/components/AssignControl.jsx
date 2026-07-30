import { useState } from "react";

// Coach-only inline control to move or duplicate a saved program onto a
// (possibly different) client. Duplicate always starts with zero comments -
// it's a brand-new program row, so there's nothing to carry over.
export default function AssignControl({ programId, clients, currentClientId, onDone }) {
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = target && !busy;

  async function run(action) {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const url =
        action === "move"
          ? `/api/programs/${programId}/client`
          : `/api/programs/${programId}/duplicate`;
      const res = await fetch(url, {
        method: action === "move" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not complete that.");
      const clientName = clients.find((c) => c.id === target)?.name || "";
      onDone(action, { ...data, clientId: target, clientName });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="assign-control">
      <select
        className="title-input"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        disabled={busy}
      >
        <option value="" disabled>
          Select a client
        </option>
        {clients.map((c) => (
          <option key={c.id} value={c.id} disabled={c.id === currentClientId}>
            {c.name}
            {c.id === currentClientId ? " (current)" : ""}
          </option>
        ))}
      </select>
      <div className="assign-control-actions">
        <button type="button" className="secondary" onClick={() => run("move")} disabled={!canSubmit}>
          {busy ? "Working..." : "Move here"}
        </button>
        <button type="button" className="secondary" onClick={() => run("duplicate")} disabled={!canSubmit}>
          {busy ? "Working..." : "Duplicate here"}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
