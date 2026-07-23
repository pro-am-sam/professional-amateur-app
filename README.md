# Professional Amateur

Paste a training program (from Word or Excel) → Claude parses it into structured
data → you preview it → it renders as a clean, mobile-friendly page. Once
saved, whoever has the link can leave a comment on any block, and those
comments are there next time you open that same link.

Can run entirely locally, or be deployed to Render so links work off your
machine (see **Deploying** below). No accounts/login yet either way — anyone
with a saved program's link can currently view and comment on it (there's no
way to separate "coach" from "client" access).

## One-time setup

1. **Install Node.js** (if you haven't): download the LTS installer from
   [nodejs.org](https://nodejs.org) and run it.
2. **Add your Anthropic API key**:
   - In the `server` folder, copy `.env.example` to a new file named `.env`
   - Open `.env` and replace `your-api-key-here` with your real key
3. **Install dependencies** (from a terminal, in this project folder):
   ```
   cd server
   npm install
   cd ../client
   npm install
   ```

## Running the app

You need **two terminals** open at the same time — one for the backend, one
for the frontend.

**Terminal 1 — backend:**
```
cd server
npm start
```
You should see `Server running at http://localhost:3001`.

**Terminal 2 — frontend:**
```
cd client
npm run dev
```
It will print a local URL, usually `http://localhost:5173`. Open that in
your browser.

## Using it

1. Paste your program text into the box and click **Parse Program**.
2. Review the table that comes back against your original text.
3. If something's off, click **Back to edit**, fix the pasted text, and
   re-parse. If it looks right, enter the **client's name** (required — use
   your own name for your own training) and optionally a program title (e.g.
   "Block 1"), then click **Looks good, view program** — this saves it and
   puts a program ID in the page's URL.
4. Use the Week/Day tabs to navigate, and click **Show notes** on any
   movement to expand your own coaching notes.
5. Anyone viewing that URL can type in the **Your comment** box under any
   block — it auto-saves a couple seconds after you stop typing.
6. Click **📂 My programs** any time to browse everything you've saved,
   grouped by client — no need to keep bookmarks of individual links.

## Project layout

- `server/` — Express server with these endpoints:
  - `POST /api/parse` — sends pasted text to Claude, returns structured JSON.
  - `POST /api/programs` / `GET /api/programs/:id` — save/load a parsed
    program.
  - `GET /api/programs` — list every saved program (for the library screen).
  - `POST /api/programs/:id/comments` — save a comment against one block.
  Saved programs and comments live in `server/data/app.db`, a real SQLite
  database (gitignored) — safe against the kind of data corruption a plain
  JSON file risks under concurrent writes. Your Anthropic API key lives only
  in `server/.env`, never in the browser.
- `client/` — React app (built with Vite): paste box, preview table, final
  rendered program view with per-block comment boxes, and a library screen
  for browsing everything you've saved.
- `render.yaml` — a Render "Blueprint" that describes how to host this: one
  web service running `node server/index.js`, built by first building the
  React app and installing server dependencies, with a 1GB persistent disk
  mounted at `/data` for the SQLite database to live on.

## Deploying (Render)

The app is one Express server that serves both the API and the built React
frontend, so it deploys as a single web service.

1. Push this repo to GitHub (see below if you haven't done this before).
2. In [Render's dashboard](https://dashboard.render.com), choose **New >
   Blueprint**, and connect the GitHub repo. Render will read `render.yaml`
   and set up the service and its persistent disk automatically.
3. When prompted, paste your Anthropic API key in for the `ANTHROPIC_API_KEY`
   variable (this is a one-time manual step since secrets aren't stored in
   the repo).
4. Render will build and deploy. Once it's live, the URL Render gives you
   works the same way `localhost:5173` did locally — paste, preview, save,
   share the `?program=<id>` link, browse the library — except now it's
   reachable from any device, not just this computer.

**Pushing to GitHub for the first time**, from this project folder:
```
git remote add origin <your-new-repo-URL>
git branch -M main
git push -u origin main
```
(Create the empty repo on github.com first, then copy its URL for
`<your-new-repo-URL>`.) Git may open a browser window to confirm it's really
you — that's normal, just approve it there.
