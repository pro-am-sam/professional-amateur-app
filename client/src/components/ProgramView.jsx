import { useEffect, useRef, useState } from "react";
import AssignControl from "./AssignControl.jsx";

export default function ProgramView({
  program,
  programId,
  programMeta,
  comments,
  onCommentsChange,
  onBack,
  role,
  onEdit,
  onAddWeek,
  onReassigned,
}) {
  const weeks = program.weeks;
  const [weekIndex, setWeekIndex] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const [oneRMs, setOneRMs] = useState([]);
  const [clients, setClients] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignNotice, setAssignNotice] = useState("");

  useEffect(() => {
    if (role !== "coach") return;
    fetch("/api/clients")
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setClients(data.clients);
      })
      .catch(() => {});
  }, [role]);

  function handleAssignDone(action, data) {
    setAssignOpen(false);
    if (action === "move") {
      setAssignNotice(`Moved to ${data.clientName}.`);
      onReassigned?.();
    } else {
      setAssignNotice(`Duplicated to ${data.clientName} — find it under My Programs.`);
    }
    setTimeout(() => setAssignNotice(""), 4000);
  }

  // Fetched once so any "% of 1RM" exercise can compute a real weight
  // without a network round-trip per click. Coach needs to say which
  // client; a client session is auto-scoped to their own on the backend.
  useEffect(() => {
    const params = new URLSearchParams();
    if (role === "coach" && programMeta?.clientId) params.set("clientId", programMeta.clientId);
    params.set("category", "1rm");
    fetch(`/api/benchmarks?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { benchmarks: [] }))
      .then((data) => setOneRMs((data.benchmarks || []).filter((b) => b.latestValue)))
      .catch(() => setOneRMs([]));
  }, [role, programMeta?.clientId]);

  const activeWeek = weeks[weekIndex];
  const days = activeWeek?.days || [];
  const activeDay = days[dayIndex];

  function selectWeek(i) {
    setWeekIndex(i);
    setDayIndex(0);
  }

  return (
    <div>
      <div className="preview-actions-top">
        <button type="button" className="secondary" onClick={onBack}>
          ← Back
        </button>
        {role === "coach" && (
          <button type="button" className="secondary" onClick={onEdit}>
            ✏️ Edit program
          </button>
        )}
        {role === "coach" && (
          <button type="button" className="secondary" onClick={onAddWeek}>
            ➕ Add week
          </button>
        )}
        {role === "coach" && (
          <button type="button" className="secondary" onClick={() => setAssignOpen(!assignOpen)}>
            🔀 Assign to client
          </button>
        )}
      </div>

      {assignNotice && <p className="success-text">{assignNotice}</p>}
      {role === "coach" && assignOpen && (
        <AssignControl
          programId={programId}
          clients={clients}
          currentClientId={programMeta?.clientId}
          onDone={handleAssignDone}
        />
      )}

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
          {activeDay.blocks.map((block, bi) => {
            const blockKey = `w${activeWeek.weekNumber}-d${activeDay.dayOrder}-b${block.letter}`;
            return (
              <BlockCard
                key={blockKey}
                block={block}
                blockKey={blockKey}
                programId={programId}
                comments={comments}
                onCommentsChange={onCommentsChange}
                oneRMs={oneRMs}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function BlockCard({ block, blockKey, programId, comments, onCommentsChange, oneRMs }) {
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
          <ExerciseRow key={ei} exercise={ex} oneRMs={oneRMs} />
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

function ExerciseRow({ exercise, oneRMs }) {
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
        <WeightReveal exercise={exercise} oneRMs={oneRMs} />
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
      <WeightReveal exercise={exercise} oneRMs={oneRMs} />
      {exercise.notes && <NoteToggle notes={exercise.notes} />}
    </li>
  );
}

// Matches a load like "90%" or a range like "75-77.5%". Anything else
// (weights, RPE, "70%+", etc.) intentionally doesn't match - better to show
// nothing than compute a wrong number from a pattern we're not sure about.
function parsePercentageLoad(load) {
  if (!load) return null;
  const match = load.trim().match(/^(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?)\s*)?%$/);
  if (!match) return null;
  return { min: parseFloat(match[1]), max: match[2] ? parseFloat(match[2]) : null };
}

function parseOneRMValue(value) {
  if (!value) return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(kg|lbs?|lb)?/i);
  if (!match) return null;
  return { amount: parseFloat(match[1]), unit: match[2] ? match[2].toLowerCase().replace(/s$/, "") : "" };
}

// Exact name match first ("Deadlift" -> "Deadlift"); otherwise the longest
// logged 1RM name that appears inside the exercise name, so a complex like
// "Snatch pull + Hang muscle snatch" still finds the "Snatch" 1RM.
function matchOneRM(oneRMs, exerciseName) {
  if (!exerciseName || !oneRMs?.length) return null;
  const name = exerciseName.toLowerCase();
  const exact = oneRMs.find((b) => b.name.toLowerCase() === name);
  if (exact) return exact;
  const candidates = oneRMs
    .filter((b) => name.includes(b.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  return candidates[0] || null;
}

function computeWeight(percent, oneRM) {
  const parsed = parseOneRMValue(oneRM.latestValue);
  if (!parsed) return null;
  const rounded = Math.round(((percent / 100) * parsed.amount) * 10) / 10;
  return `${rounded}${parsed.unit}`;
}

function WeightReveal({ exercise, oneRMs }) {
  const [open, setOpen] = useState(false);
  const pct = parsePercentageLoad(exercise.load);
  if (!pct) return null;

  const match = matchOneRM(oneRMs, exercise.name);
  let message;
  if (!match) {
    message = `No 1RM logged for "${exercise.name}" yet — log one under 1RMs and Benchmarks.`;
  } else {
    const minWeight = computeWeight(pct.min, match);
    const maxWeight = pct.max ? computeWeight(pct.max, match) : null;
    if (!minWeight) {
      message = `Couldn't read a number from the logged ${match.name} (${match.latestValue}).`;
    } else if (maxWeight) {
      message = `${pct.min}-${pct.max}% of ${match.name} (${match.latestValue}) = ${minWeight} - ${maxWeight}`;
    } else {
      message = `${pct.min}% of ${match.name} (${match.latestValue}) = ${minWeight}`;
    }
  }

  return (
    <div className="note-toggle">
      <button type="button" className="note-button" onClick={() => setOpen(!open)}>
        {open ? "Hide weight ▲" : "🧮 Show weight ▼"}
      </button>
      {open && <p className="note-text">{message}</p>}
    </div>
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
