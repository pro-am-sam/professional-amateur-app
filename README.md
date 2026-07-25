# Professional Amateur

Paste a training program (from Word or Excel) → Claude parses it into structured
data → you preview it → it renders as a clean, mobile-friendly page. Clients
log in with their own username/password to see and comment on just their own
saved program — nobody else's.

Can run entirely locally, or be deployed to Render so links work off your
machine (see **Deploying** below).

## Logging in

- **You (the coach)** log in with a single password, set as `COACH_PASSWORD`.
- **Each client** logs in with a username/password created for them. There's
  no self-signup or email — when you save a program for a new client, the app
  generates their login and shows it to you once on screen, so you can pass
  it along yourself (text, call, in person).

## One-time setup

1. **Install Node.js** (if you haven't): download the LTS installer from
   [nodejs.org](https://nodejs.org) and run it.
2. **Set up your `.env` file**:
   - In the `server` folder, copy `.env.example` to a new file named `.env`
   - Open `.env`, replace `your-api-key-here` with your real Anthropic API key,
     and replace `choose-your-own-password-here` with whatever password you
     want to use to log in as the coach
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

1. Log in with your coach password.
2. Paste your program text into the box and click **Parse Program**.
3. Review the table that comes back against your original text.
4. If something's off, click **Back to edit**, fix the pasted text, and
   re-parse. If it looks right, pick the **client** it's for (or create a new
   one right there) and optionally a program title (e.g. "Block 1"), then
   click **Looks good, view program** to save it.
5. If you created a new client, their username and password show up once on
   screen — copy them now and send them to your client yourself.
6. Use the Week/Day tabs to navigate, and click **Show notes** on any
   movement to expand your own coaching notes.
7. Your client logs in with their own username/password and can type in the
   **Your comment** box under any block — it auto-saves a couple seconds
   after they stop typing. They only ever see their own program(s).
8. Click **📂 My programs** any time to browse everything you've saved,
   grouped by client. Click **👥 Manage clients** to see everyone's login
   status or reset a client's password if they forget it.

## Project layout

- `server/` — Express server with these endpoints:
  - `POST /api/auth/coach-login` / `POST /api/auth/client-login` / `POST /api/auth/logout` / `GET /api/auth/session` — cookie-based login.
  - `GET /api/clients` / `POST /api/clients` / `POST /api/clients/:id/reset-password` — coach-only client management.
  - `POST /api/parse` — sends pasted text to Claude, returns structured JSON (coach-only).
  - `POST /api/programs` / `GET /api/programs/:id` — save/load a parsed
    program. Loading requires being the coach or the program's own client.
  - `GET /api/programs` — list saved programs: everything for the coach, only
    your own if you're a client.
  - `POST /api/programs/:id/comments` — save a comment against one block.
  Saved programs, clients, and comments live in `server/data/app.db`, a real
  SQLite database (gitignored) — safe against the kind of data corruption a
  plain JSON file risks under concurrent writes. Passwords are hashed
  (never stored in plain text). Your Anthropic API key and coach password
  live only in `server/.env`, never in the browser.
- `client/` — React app (built with Vite): login screen, paste box, preview
  table with client picker, final rendered program view with per-block
  comment boxes, a library screen, and client management.
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
3. When prompted, paste your Anthropic API key in for `ANTHROPIC_API_KEY` and
   choose a `COACH_PASSWORD` (this is a one-time manual step since secrets
   aren't stored in the repo).
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
