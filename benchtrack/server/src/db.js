const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://bench:bench@localhost:5432/benchtrack' });
const schema = `
CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY, date DATE NOT NULL, variation TEXT NOT NULL DEFAULT 'Competition Bench',
  grip TEXT, bodyweight NUMERIC, notes TEXT);
CREATE TABLE IF NOT EXISTS sets (
  id SERIAL PRIMARY KEY, workout_id INT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  set_number INT NOT NULL, weight NUMERIC NOT NULL CHECK (weight > 0), reps INT NOT NULL CHECK (reps > 0),
  rpe NUMERIC CHECK (rpe BETWEEN 1 AND 10), is_warmup BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS goal (id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), target NUMERIC, target_date DATE);`;
module.exports = { pool, init: () => pool.query(schema) };
