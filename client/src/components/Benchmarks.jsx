import { useEffect, useState } from "react";

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const CUSTOM = "__custom__";

const CATEGORY_COPY = {
  "1rm": { noun: "lift", namePlaceholder: "e.g. Split Jerk", valuePlaceholder: "e.g. 140kg" },
  wod: { noun: "benchmark", namePlaceholder: "e.g. Filthy Fifty", valuePlaceholder: "e.g. 3:45 or 20 rounds + 5" },
  mono: { noun: "monostructural test", namePlaceholder: "e.g. Ski Erg - 2km", valuePlaceholder: "e.g. 8:12 or 42 cal" },
};

export default function Benchmarks({ role, onBack }) {
  const isCoach = role === "coach";

  const [clients, setClients] = useState(null);
  const [clientId, setClientId] = useState("");
  const [category, setCategory] = useState("1rm");
  const [list, setList] = useState(null);
  const [error, setError] = useState("");

  const [selectedName, setSelectedName] = useState(null); // null = list view
  const [history, setHistory] = useState(null);
  const [formName, setFormName] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDate, setFormDate] = useState(todayIso());
  const [formNotes, setFormNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isCoach) return;
    fetch("/api/clients")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load clients.");
        setClients(data.clients);
      })
      .catch((err) => setError(err.message));
  }, [isCoach]);

  const activeClientId = isCoach ? clientId : "self";
  const canBrowse = !isCoach || !!clientId;

  function benchmarksUrl(extra = "") {
    const params = new URLSearchParams(extra);
    if (isCoach) params.set("clientId", clientId);
    params.set("category", category);
    return `/api/benchmarks?${params.toString()}`;
  }

  function loadList() {
    if (!canBrowse) {
      setList(null);
      return;
    }
    fetch(benchmarksUrl())
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load benchmarks.");
        setList(data.benchmarks);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    setSelectedName(null);
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClientId, category]);

  function loadHistory(name) {
    const params = new URLSearchParams();
    if (isCoach) params.set("clientId", clientId);
    params.set("category", category);
    params.set("name", name);
    fetch(`/api/benchmarks/history?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load history.");
        setHistory(data.entries);
      })
      .catch((err) => setError(err.message));
  }

  function openDetail(name) {
    setError("");
    setSelectedName(name || CUSTOM);
    setFormName(name || "");
    setFormValue("");
    setFormDate(todayIso());
    setFormNotes("");
    if (name) loadHistory(name);
    else setHistory([]);
  }

  async function handleAddEntry(e) {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      const body = { category, name: formName, value: formValue, recordedAt: formDate, notes: formNotes };
      if (isCoach) body.clientId = clientId;
      const res = await fetch("/api/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save entry.");
      const savedName = formName.trim();
      setSelectedName(savedName);
      setFormValue("");
      setFormNotes("");
      loadList();
      loadHistory(savedName);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id) {
    setError("");
    try {
      const params = new URLSearchParams();
      if (isCoach) params.set("clientId", clientId);
      const res = await fetch(`/api/benchmarks/${id}?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete entry.");
      loadList();
      loadHistory(selectedName);
    } catch (err) {
      setError(err.message);
    }
  }

  const isCustomEntry = selectedName === CUSTOM;

  return (
    <div className="card">
      <div className="preview-actions-top">
        <button
          type="button"
          className="secondary"
          onClick={selectedName ? () => setSelectedName(null) : onBack}
        >
          ← Back
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {isCoach && !selectedName && (
        <>
          <label htmlFor="benchmark-client" className="title-label">
            Client
          </label>
          <select
            id="benchmark-client"
            className="title-input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Select a client...</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </>
      )}

      {canBrowse && !selectedName && (
        <>
          <nav className="tab-row week-tabs">
            <button
              type="button"
              className={`tab ${category === "1rm" ? "tab-active" : ""}`}
              onClick={() => setCategory("1rm")}
            >
              1RMs
            </button>
            <button
              type="button"
              className={`tab ${category === "wod" ? "tab-active" : ""}`}
              onClick={() => setCategory("wod")}
            >
              Benchmarks
            </button>
            <button
              type="button"
              className={`tab ${category === "mono" ? "tab-active" : ""}`}
              onClick={() => setCategory("mono")}
            >
              Monostructural
            </button>
          </nav>

          {list && (
            <ul className="library-list">
              {list.map((b) => (
                <li key={b.name}>
                  <button type="button" className="library-item" onClick={() => openDetail(b.name)}>
                    <span className="library-item-title">{b.name}</span>
                    <span className="library-item-meta">
                      {b.latestValue ? `${b.latestValue} · ${formatDate(b.latestDate)}` : "No data yet"}
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="library-item" onClick={() => openDetail(null)}>
                  <span className="library-item-title">+ Add custom {CATEGORY_COPY[category].noun}</span>
                </button>
              </li>
            </ul>
          )}
        </>
      )}

      {selectedName && (
        <>
          <h2 className="library-client-name">{isCustomEntry ? "New entry" : selectedName}</h2>

          <form onSubmit={handleAddEntry}>
            {isCustomEntry && (
              <>
                <label htmlFor="benchmark-name" className="title-label">
                  Name
                </label>
                <input
                  id="benchmark-name"
                  className="title-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={CATEGORY_COPY[category].namePlaceholder}
                />
              </>
            )}

            <label htmlFor="benchmark-value" className="title-label">
              Value
            </label>
            <input
              id="benchmark-value"
              className="title-input"
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              placeholder={CATEGORY_COPY[category].valuePlaceholder}
            />

            <label htmlFor="benchmark-date" className="title-label">
              Date
            </label>
            <input
              id="benchmark-date"
              type="date"
              className="title-input"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />

            <label htmlFor="benchmark-notes" className="title-label">
              Notes (optional)
            </label>
            <input
              id="benchmark-notes"
              className="title-input"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="How it felt, conditions, etc."
            />

            <button type="submit" disabled={isSaving || !formName.trim() || !formValue.trim()}>
              {isSaving ? "Saving..." : "Log entry"}
            </button>
          </form>

          {history && history.length === 0 && (
            <p className="preview-hint">No entries yet — log the first one above.</p>
          )}
          {history && history.length > 0 && (
            <ul className="library-list">
              {history.map((entry) => (
                <li key={entry.id} className="client-row">
                  <div>
                    <span className="library-item-title">{entry.value}</span>
                    <span className="library-item-meta">
                      {" "}
                      · {formatDate(entry.recordedAt)}
                      {entry.notes ? ` · ${entry.notes}` : ""}
                    </span>
                  </div>
                  <button type="button" className="secondary" onClick={() => handleDelete(entry.id)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
