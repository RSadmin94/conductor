const { query } = require('../db');
const { randomUUID } = require('crypto');
const { PLAN_TYPE, validatePlan, generatePlanFallback } = require('../intelligence/contracts');
const { logPlanningRun } = require('../utils/runLogger');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

/**
 * System prompt for Claude 3.5 Sonnet - Execution Planning
 * Ensures strict JSON output with realistic, concrete plans
 */
const PLANNING_SYSTEM_PROMPT = `You are Conductor, a senior delivery lead + architect. Your job is to create a concrete execution plan for a project based on the idea and the feasibility analysis artifact, and output a STRICT JSON object that conforms exactly to the execution_plan_v1 schema.

OUTPUT RULES (NON-NEGOTIABLE):
- Output MUST be valid JSON only. No markdown, no commentary, no code fences.
- Do NOT include placeholder text (e.g., "TBD", "standard tasks", "various", "N/A").
- The plan MUST be consistent with the feasibility analysis verdict, risks, and assumptions.
- If feasibility verdict is "no_go": still produce a plan, but it should focus on a "revise/validate first" plan with short timeline, heavy discovery, and clear stop conditions.
- Ensure minimum counts:
  - phases: at least 4 phases (Discovery, Build, Test, Launch — naming can vary but must map to these)
  - milestones: at least 5 items
  - immediate_next_actions: at least 7 items
  - components: at least 6 items (unless the project is truly tiny; still try for 6)
- timeline_weeks should approximately equal the sum of phases.duration_weeks (be honest).
- complexity MUST be one of: "low", "medium", "high".

PHASE STRUCTURE:
- Discovery & Requirements (20% of timeline)
- Core Build (50% of timeline)
- Testing & Refinement (20% of timeline)
- Launch & Deployment (10% of timeline)

COMPONENT QUALITY BAR:
- Map to real software parts (auth, data model, API, UI, background jobs, observability, security)
- Include dependencies between components
- Assign realistic complexity levels
- Include build notes for implementation guidance

MILESTONE QUALITY BAR:
- Milestones must be testable outcomes, not vague intentions
- Include explicit risk-mitigating tasks drawn from feasibility risks
- Acceptance criteria must be measurable

IMMEDIATE NEXT ACTIONS QUALITY BAR:
- Must be actionable within 24–72 hours
- Should include: setup, planning, communication, and resource allocation
- Should be specific (not "start building" but "set up CI/CD pipeline")

If feasibility is missing or obviously low-confidence, increase open_questions and make Phase 1 discovery heavier.

Return ONLY valid JSON matching this exact structure:
{
  "schema_version": "v1",
  "project_id": "...",
  "timeline_weeks": 0,
  "phases": [
    {
      "name": "...",
      "duration_weeks": 0,
      "objectives": ["..."],
      "deliverables": ["..."],
      "success_criteria": ["..."]
    }
  ],
  "components": [
    {
      "name": "...",
      "purpose": "...",
      "complexity": "low|medium|high",
      "dependencies": ["..."],
      "build_notes": ["..."]
    }
  ],
  "roles": [
    {
      "role": "...",
      "responsibilities": ["..."]
    }
  ],
  "milestones": [
    {
      "milestone": "...",
      "week": 0,
      "acceptance_criteria": ["..."]
    }
  ],
  "open_questions": ["..."],
  "immediate_next_actions": ["..."]
}`;

/**
 * Call Claude 3.5 Sonnet to generate execution plan
 */
async function generatePlanWithClaude(projectId, ideaContent, feasibilityArtifact) {
  try {
    console.log(`[PlanningJob] Calling Claude 3.5 Sonnet for project ${projectId}`);
    
    const feasibilityContext = feasibilityArtifact 
      ? JSON.stringify(feasibilityArtifact, null, 2)
      : 'Feasibility analysis not available or failed validation';
    
    const userPrompt = `Create a detailed execution plan for this project:

Project ID: ${projectId}

IDEA:
${ideaContent}

FEASIBILITY ANALYSIS:
${feasibilityContext}

Return the execution_plan_v1 JSON object. The plan must be realistic, internally consistent, and account for the risks and assumptions identified in feasibility.`;

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.3,
      system: PLANNING_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Log token usage and cost
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const estimatedCost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000; // Claude 3.5 Sonnet pricing
    
    console.log(`[PlanningJob] Claude response received`);
    console.log(`[PlanningJob] Tokens: input=${inputTokens}, output=${outputTokens}, cost=$${estimatedCost.toFixed(4)}`);

    // Parse JSON response
    let artifact;
    try {
      artifact = JSON.parse(responseText);
    } catch (parseError) {
      console.warn(`[PlanningJob] JSON parse error, attempting repair`);
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        artifact = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not extract valid JSON from Claude response');
      }
    }

    return {
      artifact,
      tokens: { input: inputTokens, output: outputTokens },
      cost: estimatedCost
    };
  } catch (error) {
    console.error(`[PlanningJob] Claude API error:`, error.message);
    throw error;
  }
}

/**
 * Main planning job with Claude integration
 */
async function processPlanningJob(job) {
  const { projectId } = job.data;
  const startTime = Date.now();
  
  try {
    // Begin transaction
    await query('BEGIN');
    
    // 1. Load idea content
    const ideaResult = await query(
      'SELECT content FROM ideas WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [projectId]
    );
    
    const ideaContent = ideaResult.rows.length > 0 ? ideaResult.rows[0].content : 'Unknown project';
    
    // 2. Load feasibility artifact (if available)
    const feasibilityResult = await query(
      'SELECT content FROM artifacts WHERE project_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT 1',
      [projectId, 'feasibility_analysis_v1']
    );
    
    let feasibilityData = null;
    if (feasibilityResult.rows.length > 0) {
      try {
        feasibilityData = JSON.parse(feasibilityResult.rows[0].content);
      } catch (e) {
        console.warn('[PlanningJob] Could not parse feasibility artifact');
      }
    }
    
    // 3. Call Claude to generate execution plan
    let artifact, tokens, cost;
    try {
      const result = await generatePlanWithClaude(projectId, ideaContent, feasibilityData);
      artifact = result.artifact;
      tokens = result.tokens;
      cost = result.cost;
    } catch (claudeError) {
      console.error(`[PlanningJob] Claude generation failed, using fallback`);
      artifact = generatePlanFallback(projectId, [claudeError.message]);
      tokens = { input: 0, output: 0 };
      cost = 0;
    }
    
    // 4. Validate artifact
    const validation = validatePlan(artifact);
    
    // 5. Use fallback if validation fails
    if (!validation.ok) {
      console.warn(`[PlanningJob] Validation failed:`, validation.errors);
      artifact = generatePlanFallback(projectId, validation.errors);
      console.log(`[PlanningJob] Using fallback artifact`);
    }
    
    // 6. Persist artifact
    const artifactId = randomUUID();
    await query(
      'INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING',
      [artifactId, projectId, 'planning', PLAN_TYPE, PLAN_TYPE, JSON.stringify(artifact)]
    );
    
    console.log(`[PlanningJob] Persisted artifact ${artifactId}`);
    
    // 7. Advance project stage
    await query(
      'UPDATE projects SET stage = $1, updated_at = NOW() WHERE id = $2',
      ['PlanningComplete', projectId]
    );
    
    // Commit transaction
    await query('COMMIT');
    
    const duration = Date.now() - startTime;
    
    console.log(`[PlanningJob] Completed for project ${projectId}`);
    console.log(`[PlanningJob] Timeline: ${artifact.timeline_weeks} weeks, ${artifact.phases.length} phases`);
    console.log(`[PlanningJob] Duration: ${duration}ms, Cost: $${cost.toFixed(4)}`);
    
    // Log run metrics
    const result = {
      ok: true,
      projectId,
      timeline_weeks: artifact.timeline_weeks,
      phases: artifact.phases.length,
      validated: validation.ok,
      tokens,
      cost,
      duration
    };
    
    logPlanningRun(projectId, result);
    return result;
  } catch (error) {
    // Rollback transaction
    await query('ROLLBACK');
    console.error(`[PlanningJob] Error for project ${projectId}:`, error.message);
    throw error;
  }
}

module.exports = { processPlanningJob };
