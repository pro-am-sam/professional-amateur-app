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

export default function ProgramLibrary({ role, onSelect, onNew, isLoading, error }) {
  const [programs, setPrograms] = useState(null);
  const [listError, setListError] = useState("");
  const isCoach = role === "coach";

  useEffect(() => {
    fetch("/api/programs")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load your programs.");
        setPrograms(data.programs);
      })
      .catch((err) => setListError(err.message));
  }, []);

  // A client only ever sees their own programs, so grouping by client name
  // would just repeat their own name over and over - skip it for them.
  const groups = programs ? (isCoach ? groupByClient(programs) : [{ clientName: null, programs }]) : [];

  return (
    <div className="card">
      {isCoach && (
        <div className="preview-actions-top">
          <button type="button" onClick={onNew} disabled={isLoading}>
            + New program
          </button>
        </div>
      )}

      {(error || listError) && <p className="error-text">{error || listError}</p>}

      {programs === null && !listError && <p className="preview-hint">Loading...</p>}

      {programs && programs.length === 0 && (
        <p className="preview-hint">
          {isCoach
            ? "Nothing saved yet. Parse and confirm a program to see it here."
            : "Nothing here yet - check back once your coach has saved you a program."}
        </p>
      )}

      {groups.map((group) => (
        <div key={group.clientName || "self"} className="library-group">
          {group.clientName && <h2 className="library-client-name">{group.clientName}</h2>}
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
