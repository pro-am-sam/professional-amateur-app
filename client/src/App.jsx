import { useEffect, useState } from "react";
import LoginView from "./components/LoginView.jsx";
import PasteInput from "./components/PasteInput.jsx";
import PreviewView from "./components/PreviewView.jsx";
import ProgramView from "./components/ProgramView.jsx";
import ProgramLibrary from "./components/ProgramLibrary.jsx";
import ClientManagement from "./components/ClientManagement.jsx";
import ChangePassword from "./components/ChangePassword.jsx";
import EditProgram from "./components/EditProgram.jsx";
import ExerciseHistory from "./components/ExerciseHistory.jsx";
import Benchmarks from "./components/Benchmarks.jsx";
import CredentialsBanner from "./components/CredentialsBanner.jsx";

// Several stages belong under the same top-level tab (e.g. pasting,
// previewing, viewing, and editing a program are all part of "My programs" -
// there's no separate tab for them), so the nav highlights by section rather
// than by exact stage.
function sectionForStage(stage) {
  if (["input", "preview", "view", "edit", "library"].includes(stage)) return "library";
  return stage;
}

// The app moves through stages, one at a time:
//   "input"   - paste raw text (coach only)
//   "preview" - check Claude's structured read of it before trusting it (coach only)
//   "view"    - the clean, rendered program (coach or the owning client)
//   "library" - browse saved programs (coach sees all, client sees only their own)
//   "clients" - manage client logins (coach only)
export default function App() {
  const [role, setRole] = useState(undefined); // undefined = still checking, null = logged out
  const [clientSelf, setClientSelf] = useState(null);
  const [stage, setStage] = useState(null);

  const [program, setProgram] = useState(null);
  const [programId, setProgramId] = useState(null);
  const [programMeta, setProgramMeta] = useState({ clientId: null, clientName: "", title: "" });
  const [comments, setComments] = useState({});
  const [appendTarget, setAppendTarget] = useState(null); // set while adding weeks to an existing program
  const [pendingCredentials, setPendingCredentials] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.role) afterAuth(data);
        else setRole(null);
      })
      .catch(() => setRole(null));
  }, []);

  // Runs right after we know we're logged in, whether that's from the
  // initial session check or a fresh login just now. A saved program's link
  // looks like ?program=<id> - if one is present, load straight into it.
  function afterAuth(data) {
    setRole(data.role);
    if (data.role === "client") setClientSelf(data.client);

    const pendingId = new URLSearchParams(window.location.search).get("program");
    if (pendingId) {
      loadProgram(pendingId);
    } else {
      setStage(data.role === "coach" ? "input" : "library");
    }
  }

  async function loadProgram(id) {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/programs/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load that program.");
      setProgram(data.program);
      setProgramId(data.id);
      setProgramMeta({ clientId: data.clientId, clientName: data.clientName, title: data.title });
      setComments(data.comments || {});
      const url = new URL(window.location.href);
      url.searchParams.set("program", data.id);
      window.history.pushState({}, "", url);
      setStage("view");
    } catch (err) {
      setError(err.message);
      // A bad/foreign ?program= link shouldn't leave the app stuck - fall
      // back to a sensible home screen for whoever is logged in.
      const url = new URL(window.location.href);
      url.searchParams.delete("program");
      window.history.replaceState({}, "", url);
      setStage(role === "coach" ? "input" : "library");
    } finally {
      setIsLoading(false);
    }
  }

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

  function goHome() {
    setStage(role === "coach" ? "input" : "library");
  }

  function handleShowLibrary() {
    setError("");
    setAppendTarget(null);
    setStage("library");
  }

  function handleShowClients() {
    setError("");
    setAppendTarget(null);
    setStage("clients");
  }

  function handleShowPassword() {
    setError("");
    setAppendTarget(null);
    setStage("password");
  }

  function handleShowEdit() {
    setError("");
    setStage("edit");
  }

  function handleShowHistory() {
    setError("");
    setAppendTarget(null);
    setStage("history");
  }

  function handleShowBenchmarks() {
    setError("");
    setAppendTarget(null);
    setStage("benchmarks");
  }

  function handleProgramSaved(updatedProgram) {
    setProgram(updatedProgram);
    setStage("view");
  }

  function handleShowAddWeek() {
    setError("");
    setAppendTarget({
      id: programId,
      title: programMeta.title,
      clientName: programMeta.clientName,
      existingMaxWeek: program.weeks.reduce((max, w) => Math.max(max, w.weekNumber || 0), 0),
    });
    setStage("input");
  }

  function handleCancelAppend() {
    setError("");
    setAppendTarget(null);
    setStage("view");
  }

  async function handleAppendWeeks() {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/programs/${appendTarget.id}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add those weeks.");
      setProgram(data.program);
      setAppendTarget(null);
      setStage("view");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm({ title, clientId, newClientName, clientDisplayName }) {
    setIsLoading(true);
    setError("");
    try {
      let finalClientId = clientId;

      if (newClientName) {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newClientName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not create client.");
        finalClientId = data.id;
        setPendingCredentials({ name: data.name, username: data.username, password: data.password });
      }

      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program, title, clientId: finalClientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not save the program.");
      }
      setProgramId(data.id);
      setProgramMeta({ clientId: finalClientId, clientName: clientDisplayName, title: title || "" });
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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setRole(null);
    setClientSelf(null);
    setProgram(null);
    setProgramId(null);
    setStage(null);
    setError("");
    setPendingCredentials(null);
    setComments({});
    setAppendTarget(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("program");
    window.history.replaceState({}, "", url);
  }

  const activeSection = sectionForStage(stage);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-top">
          <div className="brand-lockup">
            <img src="/logo-mark.png" alt="" width="48" height="48" className="brand-mark" />
            <h1>
              PROFESSIONAL <span className="brand-accent">AMATEUR</span>
            </h1>
          </div>
          {role && (
            <button type="button" className="logout-link" onClick={handleLogout}>
              Log out
            </button>
          )}
        </div>
        <p className="app-subtitle">
          {role === "client" && clientSelf
            ? `Welcome back, ${clientSelf.name}.`
            : "Paste a program, check it, view it clean."}
        </p>
      </header>

      {role === undefined && <p className="preview-hint">Loading...</p>}

      {role === null && <LoginView onLogin={afterAuth} />}

      {role && (
        <>
          <nav className="tab-row app-nav-tabs">
            <button
              type="button"
              className={`tab ${activeSection === "library" ? "tab-active" : ""}`}
              onClick={handleShowLibrary}
            >
              📂 My programs
            </button>
            {role === "coach" && (
              <button
                type="button"
                className={`tab ${activeSection === "clients" ? "tab-active" : ""}`}
                onClick={handleShowClients}
              >
                👥 Manage clients
              </button>
            )}
            <button
              type="button"
              className={`tab ${activeSection === "history" ? "tab-active" : ""}`}
              onClick={handleShowHistory}
            >
              📊 Exercise history
            </button>
            <button
              type="button"
              className={`tab ${activeSection === "benchmarks" ? "tab-active" : ""}`}
              onClick={handleShowBenchmarks}
            >
              🏆 1RMs and Benchmarks
            </button>
            {role === "client" && (
              <button
                type="button"
                className={`tab ${activeSection === "password" ? "tab-active" : ""}`}
                onClick={handleShowPassword}
              >
                🔑 Change password
              </button>
            )}
          </nav>

          {pendingCredentials && (
            <CredentialsBanner
              credentials={pendingCredentials}
              onDismiss={() => setPendingCredentials(null)}
            />
          )}

          {stage === "input" && role === "coach" && (
            <PasteInput
              onParse={handleParse}
              isLoading={isLoading}
              error={error}
              appendTarget={appendTarget}
              onCancelAppend={handleCancelAppend}
            />
          )}

          {stage === "preview" && role === "coach" && program && (
            <PreviewView
              program={program}
              onBack={handleBackToEdit}
              onConfirm={handleConfirm}
              onAppend={handleAppendWeeks}
              appendTarget={appendTarget}
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
              onBack={goHome}
              role={role}
              onEdit={handleShowEdit}
              onAddWeek={handleShowAddWeek}
              onReassigned={() => loadProgram(programId)}
            />
          )}

          {stage === "edit" && role === "coach" && program && (
            <EditProgram
              program={program}
              programId={programId}
              onSaved={handleProgramSaved}
              onCancel={() => setStage("view")}
            />
          )}

          {stage === "history" && <ExerciseHistory role={role} onBack={goHome} />}

          {stage === "benchmarks" && <Benchmarks role={role} onBack={goHome} />}

          {stage === "library" && (
            <ProgramLibrary
              role={role}
              onSelect={loadProgram}
              onNew={handleBackToEdit}
              isLoading={isLoading}
              error={error}
            />
          )}

          {stage === "clients" && role === "coach" && (
            <ClientManagement onBack={goHome} onSelectProgram={loadProgram} />
          )}

          {stage === "password" && role === "client" && <ChangePassword onBack={goHome} />}
        </>
      )}
    </div>
  );
}
