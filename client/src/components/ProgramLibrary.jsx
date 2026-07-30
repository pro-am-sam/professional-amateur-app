import { useEffect, useState } from "react";
import AssignControl from "./AssignControl.jsx";

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
  const [clients, setClients] = useState([]);
  const [openAssignId, setOpenAssignId] = useState(null);
  const [notice, setNotice] = useState("");
  const isCoach = role === "coach";

  useEffect(() => {
    loadPrograms();
    if (isCoach) {
      fetch("/api/clients")
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) setClients(data.clients);
        })
        .catch(() => {});
    }
  }, []);

  function loadPrograms() {
    fetch("/api/programs")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load your programs.");
        setPrograms(data.programs);
      })
      .catch((err) => setListError(err.message));
  }

  function handleAssignDone(action, data) {
    setOpenAssignId(null);
    setNotice(action === "move" ? `Moved to ${data.clientName}.` : `Duplicated to ${data.clientName}.`);
    setTimeout(() => setNotice(""), 3000);
    loadPrograms();
  }

  // A client only ever sees their own programs, so grouping by client name
  // would just repeat their own name over and over - skip it for them.
  const activePrograms = programs ? programs.filter((p) => !p.clientDeleted) : [];
  const pastPrograms = programs ? programs.filter((p) => p.clientDeleted) : [];
  const groups = programs ? (isCoach ? groupByClient(activePrograms) : [{ clientName: null, programs: activePrograms }]) : [];
  const pastGroups = isCoach && programs ? groupByClient(pastPrograms) : [];

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
      {notice && <p className="success-text">{notice}</p>}

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
              <ProgramRow
                key={p.id}
                program={p}
                isCoach={isCoach}
                isLoading={isLoading}
                onSelect={onSelect}
                clients={clients}
                assignOpen={openAssignId === p.id}
                onToggleAssign={() => setOpenAssignId(openAssignId === p.id ? null : p.id)}
                onAssignDone={handleAssignDone}
              />
            ))}
          </ul>
        </div>
      ))}

      {pastGroups.length > 0 && (
        <div className="library-group">
          <h2 className="library-client-name">Past Programs</h2>
          {pastGroups.map((group) => (
            <div key={group.clientName} className="library-group">
              <h3 className="library-client-name">{group.clientName}</h3>
              <ul className="library-list">
                {group.programs.map((p) => (
                  <ProgramRow
                    key={p.id}
                    program={p}
                    isCoach={isCoach}
                    isLoading={isLoading}
                    onSelect={onSelect}
                    clients={clients}
                    assignOpen={openAssignId === p.id}
                    onToggleAssign={() => setOpenAssignId(openAssignId === p.id ? null : p.id)}
                    onAssignDone={handleAssignDone}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgramRow({ program: p, isCoach, isLoading, onSelect, clients, assignOpen, onToggleAssign, onAssignDone }) {
  return (
    <li className="client-row">
      <button
        type="button"
        className="program-row-name"
        onClick={() => onSelect(p.id)}
        disabled={isLoading}
      >
        <span className="library-item-title">{p.title}</span>
        <span className="library-item-meta">
          {p.weekLabel} · saved {formatDate(p.savedAt)}
        </span>
      </button>
      {isCoach && (
        <button type="button" className="secondary" onClick={onToggleAssign}>
          🔀 Assign
        </button>
      )}
      {isCoach && assignOpen && (
        <AssignControl
          programId={p.id}
          clients={clients}
          currentClientId={p.clientId}
          onDone={onAssignDone}
        />
      )}
    </li>
  );
}
