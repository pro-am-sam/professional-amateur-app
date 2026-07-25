import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { programSchema, systemPrompt } from "./parseProgram.js";
import {
  saveProgram,
  getProgram,
  listPrograms,
  upsertComment,
  createClient,
  resetClientPassword,
  listClients,
  getClientById,
  verifyClientLogin,
  createSession,
  getSession,
  deleteSession,
} from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, "../client/dist");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "Missing ANTHROPIC_API_KEY. Copy .env.example to .env and add your key."
  );
  process.exit(1);
}
if (!process.env.COACH_PASSWORD) {
  console.error(
    "Missing COACH_PASSWORD. Add it to .env locally (or Render's environment variables in production) - this is the password you'll use to log in."
  );
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Occasionally the model returns `weeks` as a JSON-encoded string instead of
// the actual array (a known quirk of structured tool output). Unwrap it if so.
function normalizeProgram(input) {
  if (input && typeof input.weeks === "string") {
    try {
      const parsed = JSON.parse(input.weeks);
      if (Array.isArray(parsed)) return { weeks: parsed };
      if (parsed && Array.isArray(parsed.weeks)) return parsed;
    } catch {
      return input;
    }
  }
  return input;
}

async function attemptParse(rawText) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: "user", content: rawText }],
    tools: [
      {
        name: "record_training_program",
        description:
          "Records a structured training program parsed from raw coaching notes.",
        input_schema: programSchema,
      },
    ],
    tool_choice: { type: "tool", name: "record_training_program" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse) {
    return { ok: false, reason: "Claude did not return a tool_use block." };
  }

  const program = normalizeProgram(toolUse.input);
  if (!Array.isArray(program?.weeks)) {
    return { ok: false, reason: "weeks was not an array after normalizing.", raw: toolUse.input };
  }

  return { ok: true, program };
}

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

/* ---------------- Auth helpers ---------------- */

const COOKIE_NAME = "pa_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function currentSession(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  return getSession(token);
}

function requireCoach(req, res, next) {
  const session = currentSession(req);
  if (!session || session.role !== "coach") {
    return res.status(401).json({ error: "Coach login required." });
  }
  req.session = session;
  next();
}

function requireAuth(req, res, next) {
  const session = currentSession(req);
  if (!session) {
    return res.status(401).json({ error: "Login required." });
  }
  req.session = session;
  next();
}

// Coach can touch any program; a client can only touch their own.
function canAccessProgram(session, program) {
  if (session.role === "coach") return true;
  return session.role === "client" && session.clientId === program.clientId;
}

/* ---------------- Auth routes ---------------- */

app.post("/api/auth/coach-login", (req, res) => {
  const password = req.body?.password || "";
  if (password !== process.env.COACH_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password." });
  }
  const token = createSession("coach");
  setSessionCookie(res, token);
  res.json({ role: "coach" });
});

app.post("/api/auth/client-login", (req, res) => {
  const { username, password } = req.body || {};
  const client = verifyClientLogin(username || "", password || "");
  if (!client) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  const token = createSession("client", client.id);
  setSessionCookie(res, token);
  res.json({ role: "client", client });
});

app.post("/api/auth/logout", (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) deleteSession(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/session", (req, res) => {
  const session = currentSession(req);
  if (!session) return res.json({ role: null });
  if (session.role === "coach") return res.json({ role: "coach" });
  res.json({ role: "client", client: getClientById(session.clientId) });
});

/* ---------------- Client management (coach-only) ---------------- */

app.get("/api/clients", requireCoach, (req, res) => {
  res.json({ clients: listClients() });
});

app.post("/api/clients", requireCoach, (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "A client name is required." });
  }
  res.json(createClient(name));
});

app.post("/api/clients/:id/reset-password", requireCoach, (req, res) => {
  const result = resetClientPassword(req.params.id);
  if (!result) {
    return res.status(404).json({ error: "Client not found." });
  }
  res.json(result);
});

/* ---------------- Parsing ---------------- */

app.post("/api/parse", requireCoach, async (req, res) => {
  const rawText = (req.body?.rawText || "").trim();

  if (!rawText) {
    return res.status(400).json({ error: "No program text was provided." });
  }

  try {
    let result = await attemptParse(rawText);
    if (!result.ok) {
      console.error(
        "Parse attempt 1 failed:",
        result.reason,
        JSON.stringify(result.raw)?.slice(0, 1000)
      );
      result = await attemptParse(rawText); // LLM output can be flaky - one retry usually succeeds
    }
    if (!result.ok) {
      console.error(
        "Parse attempt 2 failed:",
        result.reason,
        JSON.stringify(result.raw)?.slice(0, 1000)
      );
      return res
        .status(502)
        .json({ error: "Claude had trouble parsing that. Please try again." });
    }
    res.json(result.program);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to parse program: " + err.message });
  }
});

/* ---------------- Programs ---------------- */

app.post("/api/programs", requireCoach, async (req, res) => {
  const program = req.body?.program;
  const title = req.body?.title;
  const clientId = req.body?.clientId;

  if (!program || !Array.isArray(program.weeks)) {
    return res.status(400).json({ error: "No valid program was provided." });
  }
  if (!clientId || !getClientById(clientId)) {
    return res.status(400).json({ error: "A valid client is required." });
  }

  try {
    const id = await saveProgram(program, title, clientId);
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save program: " + err.message });
  }
});

app.get("/api/programs", requireAuth, async (req, res) => {
  try {
    const scope = req.session.role === "coach" ? null : req.session.clientId;
    const programs = await listPrograms(scope);
    res.json({ programs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list programs: " + err.message });
  }
});

app.get("/api/programs/:id", requireAuth, async (req, res) => {
  try {
    const entry = await getProgram(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: "Program not found." });
    }
    if (!canAccessProgram(req.session, entry)) {
      return res.status(403).json({ error: "You don't have access to this program." });
    }
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load program: " + err.message });
  }
});

app.post("/api/programs/:id/comments", requireAuth, async (req, res) => {
  const key = (req.body?.key || "").trim();
  const text = req.body?.text || "";

  if (!key) {
    return res.status(400).json({ error: "No exercise key was provided." });
  }

  try {
    const program = await getProgram(req.params.id);
    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }
    if (!canAccessProgram(req.session, program)) {
      return res.status(403).json({ error: "You don't have access to this program." });
    }

    const comments = await upsertComment(req.params.id, key, text);
    res.json({ comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save comment: " + err.message });
  }
});

// Serve the built React app (client/dist) for everything that isn't an API
// route, so one process can handle both in production. In local dev, the
// Vite dev server (port 5173) is used instead of this - client/dist won't
// exist until `npm run build` has been run, so skip registering these
// routes rather than 500ing on every unmatched request.
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get("*", (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
