import { useEffect, useRef, useState } from "react";

export default function ProgramView({
  program,
  programId,
  programMeta,
  comments,
  onCommentsChange,
  onBack,
}) {
  const weeks = program.weeks;
  const [weekIndex, setWeekIndex] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);

  const activeWeek = weeks[weekIndex];
  const days = activeWeek?.days || [];
  const activeDay = days[dayIndex];

  function selectWeek(i) {
    setWeekIndex(i);
    setDayIndex(0);
  }

  return (
    <div>
      <button type="button" className="secondary back-link" onClick={onBack}>
        ← Back to edit
      </button>

      {programMeta?.clientName && (
        <div className="program-meta">
          <span className="program-meta-client">{programMeta.clientName}</span>
          {programMeta.title && <span className="program-meta-title"> — {programMeta.title}</span>}
        </div>
      )}

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
            <BlockCard
              key={bi}
              block={block}
              blockKey={`w${activeWeek.weekNumber}-d${activeDay.dayOrder}-b${block.letter}`}
              programId={programId}
              comments={comments}
              onCommentsChange={onCommentsChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BlockCard({ block, blockKey, programId, comments, onCommentsChange }) {
  return (
    <div className="block-card">
      <div className="block-title">
        <span className="block-letter">{block.letter}</span>
        <div>
          {block.blockName && <div className="block-name">{block.blockName}</div>}
          {block.tag && <span className="block-tag">{block.tag}</span>}
          {block.blockScheme && <div className="block-scheme">{block.blockScheme}</div>}
        </div>
      </div>

      <ul className="exercise-list">
        {block.exercises.map((ex, ei) => (
          <ExerciseRow key={ei} exercise={ex} />
        ))}
      </ul>

      {block.blockNotes && <NoteToggle notes={block.blockNotes} />}

      <CommentBox
        programId={programId}
        commentKey={blockKey}
        comments={comments}
        onCommentsChange={onCommentsChange}
      />
    </div>
  );
}

const EMOM_SCHEME = /^minute\s*\d+/i;

function ExerciseRow({ exercise }) {
  const isEmomMinute = exercise.scheme && EMOM_SCHEME.test(exercise.scheme);

  if (isEmomMinute) {
    return (
      <li className="exercise-row">
        <div className="exercise-main">
          <span className="exercise-name">
            {exercise.scheme}: {exercise.name}
            {exercise.reps && <span className="exercise-details"> . {exercise.reps}</span>}
          </span>
          {exercise.load && <span className="exercise-details">{exercise.load}</span>}
          {exercise.rest && <span className="exercise-rest">Rest {exercise.rest}</span>}
        </div>
        {exercise.notes && <NoteToggle notes={exercise.notes} />}
      </li>
    );
  }

  const details = [exercise.scheme, exercise.reps, exercise.load]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="exercise-row">
      <div className="exercise-main">
        <span className="exercise-name">{exercise.name}</span>
        {details && <span className="exercise-details">{details}</span>}
        {exercise.rest && <span className="exercise-rest">Rest {exercise.rest}</span>}
      </div>
      {exercise.notes && <NoteToggle notes={exercise.notes} />}
    </li>
  );
}

function NoteToggle({ notes }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="note-toggle">
      <button type="button" className="note-button" onClick={() => setOpen(!open)}>
        {open ? "Hide notes ▲" : "Show notes ▼"}
      </button>
      {open && <p className="note-text">{notes}</p>}
    </div>
  );
}

// Coach-authored notes (above) come from the parsed program. This is the
// opposite direction: a client's own comment on how a block went, saved to
// the backend against this specific saved program + block.
function CommentBox({ programId, commentKey, comments, onCommentsChange }) {
  const [text, setText] = useState(comments[commentKey]?.text || "");
  const [showSaved, setShowSaved] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  function handleChange(e) {
    const value = e.target.value;
    setText(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(value), 700);
  }

  async function save(value) {
    if (!programId) return;
    try {
      const res = await fetch(`/api/programs/${programId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: commentKey, text: value }),
      });
      const data = await res.json();
      if (res.ok) {
        onCommentsChange(data.comments);
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 1200);
      }
    } catch {
      // Silently ignore - the comment stays in the textarea and the next
      // successful save will pick it up.
    }
  }

  return (
    <div className="comment-box">
      <label className="comment-label">Your comment</label>
      <textarea
        className="comment-textarea"
        value={text}
        onChange={handleChange}
        placeholder="How did this feel? Loads used, how it went..."
      />
      <div className={`comment-saved ${showSaved ? "show" : ""}`}>Saved</div>
    </div>
  );
}
