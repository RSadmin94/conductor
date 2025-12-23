const { query } = require('../db');
const { randomUUID } = require('crypto');
const { PLAN_TYPE, validatePlan, generatePlanFallback } = require('../intelligence/contracts');
const { logPlanningRun } = require('../utils/runLogger');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

/**
 * Sub-generator 1: Phases and Timeline
 * Returns: { phases: [...], timeline_weeks: number }
 */
async function generatePhasesAndTimeline(ideaContent, feasibilityData) {
  const prompt = `You are a project planning expert. Based on this project idea and feasibility analysis, generate a realistic project timeline with 4 phases.

IDEA: ${ideaContent}

FEASIBILITY VERDICT: ${feasibilityData?.verdict || 'unknown'}
ESTIMATED MVP WEEKS: ${feasibilityData?.estimates?.mvp_weeks || 10}

Return ONLY valid JSON:
{
  "timeline_weeks": number,
  "phases": [
    {
      "name": "Phase name",
      "duration_weeks": number,
      "objectives": ["objective 1", "objective 2"],
      "deliverables": ["deliverable 1", "deliverable 2"],
      "success_criteria": ["criteria 1", "criteria 2"]
    }
  ]
}

Requirements:
- Exactly 4 phases: Discovery, Build, Test, Launch (names can vary)
- timeline_weeks = sum of all phase duration_weeks
- Each phase must have 2-3 objectives, deliverables, and success criteria
- Be realistic based on feasibility verdict`;

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 600,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in phases response');
  
  return JSON.parse(jsonMatch[0]);
}

/**
 * Sub-generator 2: Components
 * Returns: { components: [...] }
 */
async function generateComponents(ideaContent, feasibilityData) {
  const prompt = `You are a software architect. Based on this project idea, list the core components needed.

IDEA: ${ideaContent}

TECHNOLOGY STACK: ${feasibilityData?.suggested_stack ? JSON.stringify(feasibilityData.suggested_stack) : 'standard web stack'}

Return ONLY valid JSON:
{
  "components": [
    {
      "name": "Component name",
      "purpose": "What it does",
      "complexity": "low|medium|high",
      "dependencies": ["dependency1", "dependency2"],
      "build_notes": ["note1", "note2"]
    }
  ]
}

Requirements:
- At least 6 components
- Include: API, Frontend, Database, Auth, Integration, Infrastructure
- Each component must have 1-2 dependencies and 2-3 build notes
- Be specific to the project type`;

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 700,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in components response');
  
  return JSON.parse(jsonMatch[0]);
}

/**
 * Sub-generator 3: Roles and Milestones
 * Returns: { roles: [...], milestones: [...] }
 */
async function generateRolesAndMilestones(ideaContent, phasesData) {
  const phaseNames = phasesData.phases.map(p => `${p.name} (${p.duration_weeks}w)`).join(', ');
  
  const prompt = `You are a project manager. Based on these project phases, define team roles and milestones.

PHASES: ${phaseNames}
TOTAL TIMELINE: ${phasesData.timeline_weeks} weeks

Return ONLY valid JSON:
{
  "roles": [
    {
      "role": "Role name",
      "responsibilities": ["responsibility1", "responsibility2", "responsibility3"]
    }
  ],
  "milestones": [
    {
      "milestone": "Milestone name",
      "week": number,
      "acceptance_criteria": ["criteria1", "criteria2"]
    }
  ]
}

Requirements:
- 3-5 roles (e.g., Product Manager, Backend Engineer, Frontend Engineer, DevOps, QA)
- At least 5 milestones spread across the timeline
- Each role needs 2-3 responsibilities
- Each milestone needs 2-3 acceptance criteria
- Milestone weeks should map to phase boundaries`;

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 600,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in roles/milestones response');
  
  return JSON.parse(jsonMatch[0]);
}

/**
 * Sub-generator 4: Open Questions and Next Actions
 * Returns: { open_questions: [...], immediate_next_actions: [...] }
 */
async function generateOpenQuestionsAndNextActions(ideaContent, feasibilityData) {
  const risks = feasibilityData?.risks?.map(r => r.risk).slice(0, 3).join(', ') || 'standard project risks';
  
  const prompt = `You are a project strategist. Based on this project and its risks, identify open questions and immediate next actions.

IDEA: ${ideaContent}

TOP RISKS: ${risks}

Return ONLY valid JSON:
{
  "open_questions": ["question1", "question2", "question3"],
  "immediate_next_actions": ["action1", "action2", "action3", "action4", "action5"]
}

Requirements:
- 3-5 open questions that need clarification before or during the project
- At least 7 immediate next actions (first 72 hours)
- Actions should be specific and actionable
- Include: kickoff, setup, planning, communication, resource allocation
- Questions should address risks and unknowns`;

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in questions/actions response');
  
  return JSON.parse(jsonMatch[0]);
}

/**
 * Assemble and validate the final execution plan
 */
function assemblePlan(projectId, phasesData, componentsData, rolesData, questionsData) {
  const plan = {
    schema_version: 'v1',
    project_id: projectId,
    timeline_weeks: phasesData.timeline_weeks,
    phases: phasesData.phases,
    components: componentsData.components,
    roles: rolesData.roles,
    milestones: rolesData.milestones,
    open_questions: questionsData.open_questions,
    immediate_next_actions: questionsData.immediate_next_actions
  };

  // Validate minimum counts
  const errors = [];
  if (!plan.phases || plan.phases.length < 4) errors.push('phases must have at least 4 items');
  if (!plan.components || plan.components.length < 6) errors.push('components must have at least 6 items');
  if (!plan.milestones || plan.milestones.length < 5) errors.push('milestones must have at least 5 items');
  if (!plan.immediate_next_actions || plan.immediate_next_actions.length < 7) errors.push('immediate_next_actions must have at least 7 items');

  return { plan, errors };
}

/**
 * Main planning job with sub-generators
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
    
    // 3. Generate plan sub-components
    console.log(`[PlanningJob] Generating phases and timeline for project ${projectId}`);
    const phasesData = await generatePhasesAndTimeline(ideaContent, feasibilityData);
    
    console.log(`[PlanningJob] Generating components`);
    const componentsData = await generateComponents(ideaContent, feasibilityData);
    
    console.log(`[PlanningJob] Generating roles and milestones`);
    const rolesData = await generateRolesAndMilestones(ideaContent, phasesData);
    
    console.log(`[PlanningJob] Generating open questions and next actions`);
    const questionsData = await generateOpenQuestionsAndNextActions(ideaContent, feasibilityData);
    
    // 4. Assemble and validate
    const { plan, errors } = assemblePlan(projectId, phasesData, componentsData, rolesData, questionsData);
    
    let artifact = plan;
    if (errors.length > 0) {
      console.warn(`[PlanningJob] Validation errors:`, errors);
      artifact = generatePlanFallback(projectId, errors);
    }
    
    // 5. Persist artifact
    const artifactId = randomUUID();
    await query(
      'INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING',
      [artifactId, projectId, 'planning', PLAN_TYPE, PLAN_TYPE, JSON.stringify(artifact)]
    );
    
    console.log(`[PlanningJob] Persisted artifact ${artifactId}`);
    
    // 6. Advance project stage
    await query(
      'UPDATE projects SET stage = $1, updated_at = NOW() WHERE id = $2',
      ['PlanningComplete', projectId]
    );
    
    // Commit transaction
    await query('COMMIT');
    
    const duration = Date.now() - startTime;
    
    console.log(`[PlanningJob] Completed for project ${projectId}`);
    console.log(`[PlanningJob] Timeline: ${artifact.timeline_weeks} weeks, ${artifact.phases.length} phases`);
    console.log(`[PlanningJob] Duration: ${duration}ms`);
    
    const result = {
      ok: true,
      projectId,
      timeline_weeks: artifact.timeline_weeks,
      phases: artifact.phases.length,
      validated: errors.length === 0,
      tokens: { input: 0, output: 0 }, // Not tracked for sub-calls
      cost: 0,
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
