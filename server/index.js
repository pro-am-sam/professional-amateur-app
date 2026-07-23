import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { programSchema, systemPrompt } from "./parseProgram.js";
import { saveProgram, getProgram, listPrograms, upsertComment } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, "../client/dist");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "Missing ANTHROPIC_API_KEY. Copy .env.example to .env and add your key."
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

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.post("/api/parse", async (req, res) => {
  const rawText = (req.body?.rawText || "").trim();

  if (!rawText) {
    return res.status(400).json({ error: "No program text was provided." });
  }

  try {
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
      return res
        .status(502)
        .json({ error: "Claude did not return structured data. Please try again." });
    }

    const program = normalizeProgram(toolUse.input);

    if (!Array.isArray(program?.weeks)) {
      return res
        .status(502)
        .json({ error: "Claude returned malformed data. Please try again." });
    }

    res.json(program);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to parse program: " + err.message });
  }
});

app.post("/api/programs", async (req, res) => {
  const program = req.body?.program;
  const title = req.body?.title;
  const clientName = (req.body?.clientName || "").trim();

  if (!program || !Array.isArray(program.weeks)) {
    return res.status(400).json({ error: "No valid program was provided." });
  }
  if (!clientName) {
    return res.status(400).json({ error: "A client name is required." });
  }

  try {
    const id = await saveProgram(program, title, clientName);
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save program: " + err.message });
  }
});

app.get("/api/programs", async (req, res) => {
  try {
    const programs = await listPrograms();
    res.json({ programs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list programs: " + err.message });
  }
});

app.get("/api/programs/:id", async (req, res) => {
  try {
    const entry = await getProgram(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: "Program not found." });
    }
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load program: " + err.message });
  }
});

app.post("/api/programs/:id/comments", async (req, res) => {
  const key = (req.body?.key || "").trim();
  const text = req.body?.text || "";

  if (!key) {
    return res.status(400).json({ error: "No exercise key was provided." });
  }

  try {
    const comments = await upsertComment(req.params.id, key, text);
    if (!comments) {
      return res.status(404).json({ error: "Program not found." });
    }
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
