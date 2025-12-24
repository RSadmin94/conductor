'''
import fs from "fs";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { startFeasibilityWorker } from "./workers/feasibilityWorker.js";
import { startPlanningWorker } from "./workers/planningWorker.js";
import { startExecutionWorker } from "./workers/executionWorker.js";

import { createIdea } from "./handlers/ideas.js";
import { triggerFeasibility } from "./handlers/feasibility.js";
import { triggerPlanning } from "./handlers/planning.js";
import { startExecution } from "./handlers/execution.js";
import { listArtifacts } from "./handlers/artifacts.js";
import { getProject } from "./handlers/projects.js";
import { getReport } from "./handlers/report.js";

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

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// API Routes
app.get("/", (req, res) => {
  res.sendFile("landing.html", { root: "public" });
});

app.post("/api/ideas", createIdea);
app.post("/api/projects/:projectId/feasibility", triggerFeasibility);
app.post("/api/projects/:projectId/planning", triggerPlanning);
app.post("/api/projects/:projectId/execution/start", startExecution);
app.get("/api/projects/:projectId/artifacts", listArtifacts);
app.get("/api/projects/:projectId", getProject);
app.get("/api/projects/:projectId/report", getReport);

// Health endpoint
app.get("/health", (req, res) => {
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
  });
}

start().catch(console.error);
'''
