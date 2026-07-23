import { useEffect, useState } from "react";
import PasteInput from "./components/PasteInput.jsx";
import PreviewView from "./components/PreviewView.jsx";
import ProgramView from "./components/ProgramView.jsx";
import ProgramLibrary from "./components/ProgramLibrary.jsx";

// The app moves through stages, one at a time:
//   "input"   - paste raw text
//   "preview" - check Claude's structured read of it before trusting it
//   "view"    - the clean, client-facing rendered program
//   "library" - browse everything you've saved
export default function App() {
  const [stage, setStage] = useState("input");
  const [program, setProgram] = useState(null);
  const [programId, setProgramId] = useState(null);
  const [programMeta, setProgramMeta] = useState({ clientName: "", title: "" });
  const [comments, setComments] = useState({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadProgram(id) {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/programs/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load that program.");
      setProgram(data.program);
      setProgramId(data.id);
      setProgramMeta({ clientName: data.clientName, title: data.title });
      setComments(data.comments || {});
      const url = new URL(window.location.href);
      url.searchParams.set("program", data.id);
      window.history.pushState({}, "", url);
      setStage("view");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // A saved program's link looks like ?program=<id>. Load straight into the
  // view stage if one is present, so bookmarking/reopening that link works.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("program");
    if (id) loadProgram(id);
  }, []);

  async function handleParse(rawText) {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong while parsing.");
      }
      setProgram(data);
      setStage("preview");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleBackToEdit() {
    setStage("input");
  }

  function handleShowLibrary() {
    setError("");
    setStage("library");
  }

  async function handleConfirm(title, clientName) {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program, title, clientName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not save the program.");
      }
      setProgramId(data.id);
      setProgramMeta({ clientName, title: title || "" });
      setComments({});
      const url = new URL(window.location.href);
      url.searchParams.set("program", data.id);
      window.history.replaceState({}, "", url);
      setStage("view");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Professional Amateur</h1>
        <p className="app-subtitle">Paste a program, check it, view it clean.</p>
      </header>

      {stage !== "library" && (
        <button type="button" className="secondary library-link" onClick={handleShowLibrary}>
          📂 My programs
        </button>
      )}

      {stage === "input" && (
        <PasteInput onParse={handleParse} isLoading={isLoading} error={error} />
      )}

      {stage === "preview" && program && (
        <PreviewView
          program={program}
          onBack={handleBackToEdit}
          onConfirm={handleConfirm}
          isSaving={isLoading}
          error={error}
        />
      )}

      {stage === "view" && program && (
        <ProgramView
          program={program}
          programId={programId}
          programMeta={programMeta}
          comments={comments}
          onCommentsChange={setComments}
          onBack={handleBackToEdit}
        />
      )}

      {stage === "library" && (
        <ProgramLibrary
          onSelect={loadProgram}
          onNew={handleBackToEdit}
          isLoading={isLoading}
          error={error}
        />
      )}
    </div>
  );
}
