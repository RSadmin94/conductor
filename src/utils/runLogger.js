
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, '../../logs');
const RUN_LOG_FILE = path.join(LOG_DIR, 'runs.jsonl');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function logRun(runData) {
  try {
    ensureLogDir();
    
    const entry = {
      timestamp: new Date().toISOString(),
      ...runData
    };
    
    fs.appendFileSync(RUN_LOG_FILE, JSON.stringify(entry) + '\n');
    
    console.log(`[RunLogger] Logged run for project ${runData.project_id} stage ${runData.stage}`);
  } catch (error) {
    console.error('[RunLogger] Error writing log:', error.message);
  }
}

export function logFeasibilityRun(projectId, result) {
  logRun({
    project_id: projectId,
    stage: 'feasibility',
    verdict: result.verdict,
    confidence: result.confidence,
    validated: result.validated,
    tokens_input: result.tokens?.input || 0,
    tokens_output: result.tokens?.output || 0,
    tokens_total: (result.tokens?.input || 0) + (result.tokens?.output || 0),
    cost: result.cost || 0,
    duration_ms: result.duration || 0,
    status: 'completed'
  });
}

export function logPlanningRun(projectId, result) {
  logRun({
    project_id: projectId,
    stage: 'planning',
    timeline_weeks: result.timeline_weeks,
    phases: result.phases,
    validated: result.validated,
    tokens_input: result.tokens?.input || 0,
    tokens_output: result.tokens?.output || 0,
    tokens_total: (result.tokens?.input || 0) + (result.tokens?.output || 0),
    cost: result.cost || 0,
    duration_ms: result.duration || 0,
    status: 'completed'
  });
}

export function logExecutionRun(projectId, result) {
  logRun({
    project_id: projectId,
    stage: 'execution',
    status: result.ok ? 'completed' : 'failed',
    duration_ms: result.duration || 0
  });
}

export function getSummaryStats() {
  try {
    ensureLogDir();
    
    if (!fs.existsSync(RUN_LOG_FILE)) {
      return {
        total_runs: 0,
        total_cost: 0,
        total_tokens: 0,
        avg_cost_per_run: 0,
        avg_tokens_per_run: 0,
        avg_duration_ms: 0,
        by_stage: {}
      };
    }
    
    const lines = fs.readFileSync(RUN_LOG_FILE, 'utf8').split('\n').filter(l => l.trim());
    const runs = lines.map(l => JSON.parse(l));
    
    const stats = {
      total_runs: runs.length,
      total_cost: 0,
      total_tokens: 0,
      total_duration_ms: 0,
      avg_cost_per_run: 0,
      avg_tokens_per_run: 0,
      avg_duration_ms: 0,
      by_stage: {},
      by_verdict: {}
    };
    
    runs.forEach(run => {
      stats.total_cost += run.cost || 0;
      stats.total_tokens += run.tokens_total || 0;
      stats.total_duration_ms += run.duration_ms || 0;
      
      if (!stats.by_stage[run.stage]) {
        stats.by_stage[run.stage] = {
          count: 0,
          cost: 0,
          tokens: 0,
          duration_ms: 0
        };
      }
      stats.by_stage[run.stage].count++;
      stats.by_stage[run.stage].cost += run.cost || 0;
      stats.by_stage[run.stage].tokens += run.tokens_total || 0;
      stats.by_stage[run.stage].duration_ms += run.duration_ms || 0;
      
      if (run.verdict) {
        if (!stats.by_verdict[run.verdict]) {
          stats.by_verdict[run.verdict] = { count: 0, avg_confidence: 0 };
        }
        stats.by_verdict[run.verdict].count++;
        stats.by_verdict[run.verdict].avg_confidence = 
          (stats.by_verdict[run.verdict].avg_confidence * (stats.by_verdict[run.verdict].count - 1) + run.confidence) / 
          stats.by_verdict[run.verdict].count;
      }
    });
    
    if (stats.total_runs > 0) {
      stats.avg_cost_per_run = stats.total_cost / stats.total_runs;
      stats.avg_tokens_per_run = Math.round(stats.total_tokens / stats.total_runs);
      stats.avg_duration_ms = Math.round(stats.total_duration_ms / stats.total_runs);
    }
    
    return stats;
  } catch (error) {
    console.error('[RunLogger] Error reading stats:', error.message);
    return null;
  }
}

export function printSummaryStats() {
  const stats = getSummaryStats();
  if (!stats) return;
  
  console.log('\n=== CONDUCTOR RUN SUMMARY ===');
  console.log(`Total Runs: ${stats.total_runs}`);
  console.log(`Total Cost: $${stats.total_cost.toFixed(2)}`);
  console.log(`Total Tokens: ${stats.total_tokens}`);
  console.log(`Avg Cost/Run: $${stats.avg_cost_per_run.toFixed(4)}`);
  console.log(`Avg Tokens/Run: ${stats.avg_tokens_per_run}`);
  console.log(`Avg Duration: ${stats.avg_duration_ms}ms`);
  
  if (Object.keys(stats.by_stage).length > 0) {
    console.log('\nBy Stage:');
    Object.entries(stats.by_stage).forEach(([stage, data]) => {
      console.log(`  ${stage}: ${data.count} runs, $${data.cost.toFixed(2)}, ${data.tokens} tokens`);
    });
  }
  
  if (Object.keys(stats.by_verdict).length > 0) {
    console.log('\nBy Verdict:');
    Object.entries(stats.by_verdict).forEach(([verdict, data]) => {
      console.log(`  ${verdict}: ${data.count} runs, avg confidence: ${data.avg_confidence.toFixed(2)}`);
    });
  }
  
  console.log('============================\n');
}
