import { useEffect, useState } from "react";

const NEW_CLIENT = "__new__";

// Lets the coach sanity-check what Claude extracted before trusting it enough
// to render as the final client-facing page. Deliberately plain/dense (like a
// spreadsheet readout) so mistakes are easy to spot at a glance.
export default function PreviewView({ program, onBack, onConfirm, isSaving, error }) {
  const [clients, setClients] = useState(null);
  const [selection, setSelection] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    fetch("/api/clients")
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setClients(data.clients);
      })
      .catch(() => {});
  }, []);

  const isNewClient = selection === NEW_CLIENT;
  const canConfirm =
    !isSaving && (isNewClient ? newClientName.trim().length > 0 : selection.length > 0);

  function confirm() {
    if (!canConfirm) return;
    const existingClient = clients?.find((c) => c.id === selection);
    onConfirm({
      title,
      clientId: isNewClient ? null : selection,
      newClientName: isNewClient ? newClientName.trim() : null,
      clientDisplayName: isNewClient ? newClientName.trim() : existingClient?.name || "",
    });
  }

  return (
    <div className="card">
      <div className="preview-actions-top">
        <button type="button" className="secondary" onClick={onBack} disabled={isSaving}>
          ← Back to edit
        </button>
        <button type="button" onClick={confirm} disabled={!canConfirm}>
          {isSaving ? "Saving..." : "Looks good, view program →"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <label htmlFor="program-client" className="title-label">
        Client (required)
      </label>
      <select
        id="program-client"
        className="title-input"
        value={selection}
        onChange={(e) => setSelection(e.target.value)}
        disabled={isSaving || clients === null}
      >
        <option value="" disabled>
          {clients === null ? "Loading clients..." : "Select a client"}
        </option>
        {clients?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={NEW_CLIENT}>+ New client...</option>
      </select>

      {isNewClient && (
        <>
          <label htmlFor="program-new-client" className="title-label">
            New client's name (use your own name for your own training)
          </label>
          <input
            id="program-new-client"
            type="text"
            className="title-input"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="e.g. Jack"
            disabled={isSaving}
          />
        </>
      )}

      <label htmlFor="program-title" className="title-label">
        Name this program (optional, e.g. "Block 1")
      </label>
      <input
        id="program-title"
        type="text"
        className="title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Leave blank to auto-name from the week numbers"
        disabled={isSaving}
      />

      <p className="preview-hint">
        Check this against your original text. If anything's wrong, go back and
        edit the pasted text, then parse again.
      </p>

      {program.weeks.map((week, wi) => (
        <section key={wi} className="preview-week">
          <h2>Week {week.weekNumber}</h2>

          {week.days.map((day, di) => (
            <div key={di} className="preview-day">
              <h3>{day.dayLabel}</h3>

              {day.blocks.map((block, bi) => (
                <div key={bi} className="preview-block">
                  <div className="preview-block-header">
                    <strong>{block.letter}.</strong>
                    {block.blockName && <span> {block.blockName}</span>}
                    {block.tag && <span className="preview-tag">{block.tag}</span>}
                    {block.blockScheme && (
                      <span className="preview-scheme"> — {block.blockScheme}</span>
                    )}
                  </div>
                  {block.blockNotes && (
                    <div className="preview-notes">Note: {block.blockNotes}</div>
                  )}

                  <div className="table-scroll">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Movement</th>
                          <th>Scheme</th>
                          <th>Reps</th>
                          <th>Load</th>
                          <th>Rest</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.exercises.map((ex, ei) => (
                          <tr key={ei}>
                            <td>{ex.name}</td>
                            <td>{ex.scheme || "—"}</td>
                            <td>{ex.reps || "—"}</td>
                            <td>{ex.load || "—"}</td>
                            <td>{ex.rest || "—"}</td>
                            <td>{ex.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}

      <div className="preview-actions-bottom">
        <button type="button" className="secondary" onClick={onBack} disabled={isSaving}>
          ← Back to edit
        </button>
        <button type="button" onClick={confirm} disabled={!canConfirm}>
          {isSaving ? "Saving..." : "Looks good, view program →"}
        </button>
      </div>
    </div>
  );
}
