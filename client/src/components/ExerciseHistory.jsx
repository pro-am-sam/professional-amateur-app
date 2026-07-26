import { useEffect, useState } from "react";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ExerciseHistory({ role, onBack }) {
  const isCoach = role === "coach";

  const [clients, setClients] = useState(null);
  const [clientId, setClientId] = useState("");
  const [names, setNames] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

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

  useEffect(() => {
    setNames([]);
    setResults(null);
    if (isCoach && !clientId) return;

    const url = isCoach
      ? `/api/exercise-history/names?clientId=${clientId}`
      : "/api/exercise-history/names";
    fetch(url)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load exercise names.");
        setNames(data.names);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClientId]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setError("");
    try {
      const url = isCoach
        ? `/api/exercise-history?clientId=${clientId}&exercise=${encodeURIComponent(query)}`
        : `/api/exercise-history?exercise=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      setResults(data.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSearching(false);
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

      {isCoach && (
        <>
          <label htmlFor="history-client" className="title-label">
            Client
          </label>
          <select
            id="history-client"
            className="title-input"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setQuery("");
            }}
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

      {(!isCoach || clientId) && (
        <form onSubmit={handleSearch}>
          <label htmlFor="history-query" className="title-label">
            Movement
          </label>
          <input
            id="history-query"
            list="exercise-name-options"
            className="title-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Back Squat"
          />
          <datalist id="exercise-name-options">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <button type="submit" disabled={isSearching || !query.trim()}>
            {isSearching ? "Searching..." : "Search"}
          </button>
        </form>
      )}

      {results && results.length === 0 && (
        <p className="preview-hint">No history found for "{query}".</p>
      )}

      {results && results.length > 0 && (
        <div className="table-scroll">
          <table className="preview-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Week</th>
                <th>Day</th>
                <th>Movement</th>
                <th>Scheme</th>
                <th>Reps</th>
                <th>Load</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{formatDate(r.programSavedAt)}</td>
                  <td>{r.weekNumber}</td>
                  <td>{r.dayLabel}</td>
                  <td>{r.exerciseName}</td>
                  <td>{r.scheme || "—"}</td>
                  <td>{r.reps || "—"}</td>
                  <td>{r.load || "—"}</td>
                  <td>{r.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
