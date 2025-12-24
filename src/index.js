import fs from "fs";

const envPath = "/etc/secrets/conductor.env";

if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i === -1) continue;
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v; // do not override existing
  }
}

const u = process.env.DATABASE_URL || "";
console.log("[BOOT] DATABASE_URL present?", !!u);

const express = require('express');
const cors = require('cors');
const { startFeasibilityWorker } = require('./workers/feasibilityWorker');
const { startPlanningWorker } = require('./workers/planningWorker');
const { startExecutionWorker } = require('./workers/executionWorker');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Routes
const ideasHandler = require('./handlers/ideas');
const feasibilityHandler = require('./handlers/feasibility');
const planningHandler = require('./handlers/planning');
const executionHandler = require('./handlers/execution');
const artifactsHandler = require('./handlers/artifacts');
const projectsHandler = require('./handlers/projects');
const reportHandler = require('./handlers/report');

// Landing page route (before API routes)
app.get('/', (req, res) => {
  res.sendFile('landing.html', { root: 'public' });
});

app.post('/api/ideas', ideasHandler.createIdea);
app.post('/api/projects/:projectId/feasibility', feasibilityHandler.triggerFeasibility);
app.post('/api/projects/:projectId/planning', planningHandler.triggerPlanning);
app.post('/api/projects/:projectId/execution/start', executionHandler.startExecution);
app.get('/api/projects/:projectId/artifacts', artifactsHandler.listArtifacts);
app.get('/api/projects/:projectId', projectsHandler.getProject);
app.get('/api/projects/:projectId/report', reportHandler.getReport);

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

async function start() {
  // Start workers
  await startFeasibilityWorker();
  await startPlanningWorker();
  await startExecutionWorker();
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API endpoints:`);
    console.log(`  POST /api/ideas`);
    console.log(`  POST /api/projects/:projectId/feasibility`);
    console.log(`  POST /api/projects/:projectId/planning`);
    console.log(`  POST /api/projects/:projectId/execution/start`);
    console.log(`  GET /api/projects/:projectId/artifacts`);
    console.log(`  GET /api/projects/:projectId`);
    console.log(`  GET /api/projects/:projectId/report`);
  });
}

start().catch(console.error);
