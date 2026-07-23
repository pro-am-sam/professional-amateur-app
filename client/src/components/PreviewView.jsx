import { useState } from "react";

// Lets the coach sanity-check what Claude extracted before trusting it enough
// to render as the final client-facing page. Deliberately plain/dense (like a
// spreadsheet readout) so mistakes are easy to spot at a glance.
export default function PreviewView({ program, onBack, onConfirm, isSaving, error }) {
  const [clientName, setClientName] = useState("");
  const [title, setTitle] = useState("");

  const canConfirm = !isSaving && clientName.trim().length > 0;

  function confirm() {
    if (!canConfirm) return;
    onConfirm(title, clientName);
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
        Client name (required — use your own name for your own training)
      </label>
      <input
        id="program-client"
        type="text"
        className="title-input"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
        placeholder="e.g. Jack"
        disabled={isSaving}
      />

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
