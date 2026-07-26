import { useState } from "react";

export default function PasteInput({ onParse, isLoading, error, appendTarget, onCancelAppend }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    onParse(text);
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      {appendTarget && (
        <div className="append-banner">
          <span>
            Adding a new week to <strong>{appendTarget.clientName}</strong>
            {appendTarget.title ? ` — ${appendTarget.title}` : ""}
          </span>
          <button type="button" className="secondary" onClick={onCancelAppend}>
            ← Cancel, back to program
          </button>
        </div>
      )}

      <label htmlFor="program-text">
        Paste your training program (copied from Word or Excel)
      </label>
      <textarea
        id="program-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Week 1&#10;Session 1:&#10;A. Back Squat&#10;5x5 @75%&#10;..."
        rows={18}
      />

      {error && <p className="error-text">{error}</p>}

      <button type="submit" disabled={isLoading || !text.trim()}>
        {isLoading ? "Parsing with Claude..." : "Parse Program"}
      </button>
    </form>
  );
}
