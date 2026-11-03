import { useState } from "react";
import { normalizeVideoUrl } from "../videoUrl.js";

// Content-only editor: exercise/block text fields are editable, but
// weekNumber, dayOrder, and block letter stay fixed - those are exactly the
// pieces comment keys are built from, so changing them would silently
// orphan any comments a client already left on this program.
export default function EditProgram({ program, programId, onSaved, onCancel }) {
  const [draft, setDraft] = useState(() => structuredClone(program));
  const [weekIndex, setWeekIndex] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const weeks = draft.weeks;
  const activeWeek = weeks[weekIndex];
  const days = activeWeek?.days || [];
  const activeDay = days[dayIndex];

  function selectWeek(i) {
    setWeekIndex(i);
    setDayIndex(0);
  }

  function updateBlockField(blockIndex, field, value) {
    setDraft((prev) => {
      const next = structuredClone(prev);
      next.weeks[weekIndex].days[dayIndex].blocks[blockIndex][field] = value;
      return next;
    });
  }

  function updateExerciseField(blockIndex, exerciseIndex, field, value) {
    setDraft((prev) => {
      const next = structuredClone(prev);
      next.weeks[weekIndex].days[dayIndex].blocks[blockIndex].exercises[exerciseIndex][field] = value;
      return next;
    });
  }

  // Tidies every demo link (adds https:// if missing) and refuses to save if
  // one isn't a usable web link, naming the movement so it's easy to find.
  function prepareForSave() {
    const next = structuredClone(draft);
    for (const week of next.weeks) {
      for (const day of week.days) {
        for (const block of day.blocks) {
          for (const ex of block.exercises) {
            const raw = (ex.videoUrl || "").trim();
            if (!raw) {
              ex.videoUrl = null;
              continue;
            }
            const url = normalizeVideoUrl(raw);
            if (!url) {
              throw new Error(
                `The video link for "${ex.name}" (Week ${week.weekNumber}, ${day.dayLabel}) isn't a valid web link. Paste the full address, e.g. https://youtu.be/...`
              );
            }
            ex.videoUrl = url;
          }
        }
      }
    }
    return next;
  }

  async function handleSave() {
    setIsSaving(true);
    setError("");
    try {
      const toSave = prepareForSave();
      const res = await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program: toSave }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save changes.");
      onSaved(toSave);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <div className="preview-actions-top">
        <button type="button" className="secondary" onClick={onCancel} disabled={isSaving}>
          ← Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <p className="rail-label">Select week</p>
      <nav className="tab-row week-tabs">
        {weeks.map((week, i) => (
          <button
            key={i}
            type="button"
            className={`tab ${i === weekIndex ? "tab-active" : ""}`}
            onClick={() => selectWeek(i)}
          >
            Week {week.weekNumber}
          </button>
        ))}
      </nav>

      <nav className="tab-row day-tabs">
        {days.map((day, i) => (
          <button
            key={i}
            type="button"
            className={`tab ${i === dayIndex ? "tab-active" : ""}`}
            onClick={() => setDayIndex(i)}
          >
            {day.dayLabel}
          </button>
        ))}
      </nav>

      {activeDay && (
        <div className="whiteboard">
          {activeDay.blocks.map((block, bi) => (
            <EditBlockCard
              key={bi}
              block={block}
              onChangeField={(field, value) => updateBlockField(bi, field, value)}
              onChangeExercise={(ei, field, value) => updateExerciseField(bi, ei, field, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EditBlockCard({ block, onChangeField, onChangeExercise }) {
  return (
    <div className="block-card">
      <div className="block-title">
        <span className="block-letter">{block.letter}</span>
        <div className="edit-block-fields">
          <input
            className="edit-input"
            value={block.blockName || ""}
            onChange={(e) => onChangeField("blockName", e.target.value)}
            placeholder="Block name (optional)"
          />
          <input
            className="edit-input"
            value={block.tag || ""}
            onChange={(e) => onChangeField("tag", e.target.value)}
            placeholder="Tag (e.g. Strength)"
          />
          <input
            className="edit-input"
            value={block.blockScheme || ""}
            onChange={(e) => onChangeField("blockScheme", e.target.value)}
            placeholder="Block-wide scheme (optional)"
          />
        </div>
      </div>

      <ul className="exercise-list">
        {block.exercises.map((ex, ei) => (
          <EditExerciseRow
            key={ei}
            exercise={ex}
            onChange={(field, value) => onChangeExercise(ei, field, value)}
          />
        ))}
      </ul>

      <label className="comment-label">Block notes</label>
      <textarea
        className="comment-textarea"
        value={block.blockNotes || ""}
        onChange={(e) => onChangeField("blockNotes", e.target.value)}
        placeholder="Coaching notes for this block (optional)"
      />
    </div>
  );
}

function EditExerciseRow({ exercise, onChange }) {
  return (
    <li className="exercise-row edit-exercise-row">
      <input
        className="edit-input edit-exercise-name"
        value={exercise.name || ""}
        onChange={(e) => onChange("name", e.target.value)}
        placeholder="Movement name"
      />
      <div className="edit-exercise-grid">
        <input
          className="edit-input"
          value={exercise.scheme || ""}
          onChange={(e) => onChange("scheme", e.target.value)}
          placeholder="Scheme"
        />
        <input
          className="edit-input"
          value={exercise.reps || ""}
          onChange={(e) => onChange("reps", e.target.value)}
          placeholder="Reps"
        />
        <input
          className="edit-input"
          value={exercise.load || ""}
          onChange={(e) => onChange("load", e.target.value)}
          placeholder="Load"
        />
        <input
          className="edit-input"
          value={exercise.rest || ""}
          onChange={(e) => onChange("rest", e.target.value)}
          placeholder="Rest"
        />
      </div>
      <input
        className="edit-input"
        type="url"
        value={exercise.videoUrl || ""}
        onChange={(e) => onChange("videoUrl", e.target.value)}
        placeholder="Demo video link (optional, e.g. a YouTube URL)"
      />
      <textarea
        className="comment-textarea edit-exercise-notes"
        value={exercise.notes || ""}
        onChange={(e) => onChange("notes", e.target.value)}
        placeholder="Notes for this movement (optional)"
      />
    </li>
  );
}
