BenchTrack
A bench-press-specific training log, analytics dashboard and program builder. React + Node/Express + PostgreSQL, with unit tests, Docker and GitHub Actions CI. Next feature to implement in next update: video analysis for bench press. 

Features
Log workouts (variation, grip, bodyweight, RPE, warm-ups, notes); edit/delete via API, delete in UI
Estimated 1RM (Brzycki / Epley / Lombardi), kept separate from actual logged 1RMs
Rep-PR board (1/2/3/5/8/10) per bench variation, with "new PR" detection when you save
Weekly volume, sessions/week, average RPE, bench-to-bodyweight ratio, plateau detection
Goal tracking, plate calculator (lb/kg)
Program builder: rule engine mapping weak points (off chest, lockout, ...) to variations/accessories, with simple 5x5, percentage and RPE styles
Progression engine: increase on success, repeat after 1st failure, deload 10% after 2nd
The weak-point mappings in server/src/lib/program.js are editable starting templates, not professional coaching advice.

Run it
Prereqs: Node 20+, Docker Desktop.

docker compose up --build        # terminal 1: Postgres + API on :4000
cd client && npm install && npm run dev   # terminal 2: UI on http://localhost:5173
Tests (no database needed): cd server && npm install && npm test

Layout
server/src/lib/   analytics.js, program.js, plates.js   (pure, tested logic)
server/src/app.js REST API      server/src/db.js  PostgreSQL schema
client/src/App.jsx React UI     .github/workflows/ci.yml
Roadmap
Workout mode with rest timer, authentication, API integration tests, bar-path video analysis (OpenCV).
