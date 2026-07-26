import { useEffect, useState } from "react";

const NEW_CLIENT = "__new__";

// Lets the coach sanity-check what Claude extracted before trusting it enough
// to render as the final client-facing page. Deliberately plain/dense (like a
// spreadsheet readout) so mistakes are easy to spot at a glance.
//
// Two modes: normal (save as a new program - pick/create a client + title)
// and append (adding weeks onto an existing program - appendTarget is set,
// no client/title fields needed, week numbers preview as they'll actually
// land after the backend renumbers them to continue past the program's
// current last week).
export default function PreviewView({
  program,
  onBack,
  onConfirm,
  onAppend,
  appendTarget,
  isSaving,
  error,
}) {
  const [clients, setClients] = useState(null);
  const [selection, setSelection] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (appendTarget) return;
    fetch("/api/clients")
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setClients(data.clients);
      })
      .catch(() => {});
  }, [appendTarget]);

  const isNewClient = selection === NEW_CLIENT;
  const canConfirm = appendTarget
    ? !isSaving
    : !isSaving && (isNewClient ? newClientName.trim().length > 0 : selection.length > 0);

  const weekOffset = appendTarget
    ? appendTarget.existingMaxWeek + 1 - (program.weeks[0]?.weekNumber ?? 1)
    : 0;

  function confirm() {
    if (!canConfirm) return;
    if (appendTarget) {
      onAppend();
      return;
    }
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
          {isSaving
            ? appendTarget
              ? "Adding..."
              : "Saving..."
            : appendTarget
              ? "Add to program →"
              : "Looks good, view program →"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {appendTarget && (
        <div className="append-banner">
          <span>
            Adding to <strong>{appendTarget.clientName}</strong>
            {appendTarget.title ? ` — ${appendTarget.title}` : ""}
          </span>
        </div>
      )}

      {!appendTarget && (
        <>
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
        </>
      )}

      <p className="preview-hint">
        {appendTarget
          ? "Week numbers below show what they'll become once added - they're renumbered to continue after the program's current last week."
          : "Check this against your original text. If anything's wrong, go back and edit the pasted text, then parse again."}
      </p>

      {program.weeks.map((week, wi) => (
        <section key={wi} className="preview-week">
          <h2>Week {week.weekNumber + weekOffset}</h2>

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
          {isSaving
            ? appendTarget
              ? "Adding..."
              : "Saving..."
            : appendTarget
              ? "Add to program →"
              : "Looks good, view program →"}
        </button>
      </div>
    </div>
  );
}
