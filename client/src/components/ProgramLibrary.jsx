import { useEffect, useState } from "react";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Backend already sorts by client name then most-recent-first, so grouping
// is just "start a new section whenever the client name changes".
function groupByClient(programs) {
  const groups = [];
  for (const p of programs) {
    const last = groups[groups.length - 1];
    if (last && last.clientName === p.clientName) {
      last.programs.push(p);
    } else {
      groups.push({ clientName: p.clientName, programs: [p] });
    }
  }
  return groups;
}

export default function ProgramLibrary({ onSelect, onNew, isLoading, error }) {
  const [programs, setPrograms] = useState(null);
  const [listError, setListError] = useState("");

  useEffect(() => {
    fetch("/api/programs")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load your programs.");
        setPrograms(data.programs);
      })
      .catch((err) => setListError(err.message));
  }, []);

  const groups = programs ? groupByClient(programs) : [];

  return (
    <div className="card">
      <div className="preview-actions-top">
        <button type="button" onClick={onNew} disabled={isLoading}>
          + New program
        </button>
      </div>

      {(error || listError) && <p className="error-text">{error || listError}</p>}

      {programs === null && !listError && <p className="preview-hint">Loading...</p>}

      {programs && programs.length === 0 && (
        <p className="preview-hint">
          Nothing saved yet. Parse and confirm a program to see it here.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.clientName} className="library-group">
          <h2 className="library-client-name">{group.clientName}</h2>
          <ul className="library-list">
            {group.programs.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="library-item"
                  onClick={() => onSelect(p.id)}
                  disabled={isLoading}
                >
                  <span className="library-item-title">{p.title}</span>
                  <span className="library-item-meta">
                    {p.weekLabel} · saved {formatDate(p.savedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
