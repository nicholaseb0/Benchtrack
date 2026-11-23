const app = require('./app'), { init } = require('./db');
(async () => {
  for (let i = 0; i < 20; i++) { try { await init(); break; } catch (e) { console.log('Waiting for database...'); await new Promise((r) => setTimeout(r, 1500)); } }
  app.listen(4000, () => console.log('BenchTrack API on :4000'));
})();
