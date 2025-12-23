/**
 * Artifact Contract Schemas for Conductor MVP
 * 
 * These schemas define the exact structure of artifacts produced by each job.
 * Version them explicitly to avoid collisions.
 */

/**
 * Feasibility Analysis Artifact (v1)
 * Produced by: feasibilityJob
 * Used by: planningJob, report renderer
 */
const feasibilityAnalysisV1Schema = {
  schema_version: 'v1',
  idea: {
    project_id: 'string (uuid)',
    idea_id: 'string (uuid)',
    title: 'string',
    one_liner: 'string'
  },
  verdict: 'enum: "go" | "revise" | "no_go"',
  confidence: 'number (0-1)',
  summary: 'string (3-6 sentences, idea-specific)',
  key_assumptions: 'array of strings (3-7 bullets)',
  risks: [
    {
      risk: 'string',
      likelihood: 'enum: "low" | "medium" | "high"',
      impact: 'enum: "low" | "medium" | "high"',
      mitigation: 'string'
    }
  ],
  unknowns: 'array of strings (3-7 bullets)',
  recommended_next_steps: 'array of strings (5-10 bullets)',
  suggested_stack: {
    frontend: 'array of strings',
    backend: 'array of strings',
    data: 'array of strings',
    ai: 'array of strings',
    infra: 'array of strings'
  },
  estimates: {
    mvp_weeks: 'number',
    team_size: 'enum: "solo" | "2-3" | "4-6" | "7+"',
    cost_band: 'enum: "low" | "medium" | "high"'
  }
};

/**
 * Execution Plan Artifact (v1)
 * Produced by: planningJob
 * Used by: executionJob, report renderer
 */
const executionPlanV1Schema = {
  schema_version: 'v1',
  project_id: 'string (uuid)',
  timeline_weeks: 'number (sum of phase durations)',
  phases: [
    {
      name: 'string',
      duration_weeks: 'number',
      objectives: 'array of strings',
      deliverables: 'array of strings',
      success_criteria: 'array of strings'
    }
  ],
  components: [
    {
      name: 'string',
      purpose: 'string',
      complexity: 'enum: "low" | "medium" | "high"',
      dependencies: 'array of strings',
      build_notes: 'array of strings'
    }
  ],
  roles: [
    {
      role: 'string',
      responsibilities: 'array of strings'
    }
  ],
  milestones: [
    {
      milestone: 'string',
      week: 'number',
      acceptance_criteria: 'array of strings'
    }
  ],
  open_questions: 'array of strings',
  immediate_next_actions: 'array of strings (minimum 7, actionable)'
};

/**
 * Validation Rules
 */
const validationRules = {
  feasibilityAnalysisV1: {
    required: ['verdict', 'confidence', 'summary', 'risks'],
    rules: [
      'confidence must be 0-1',
      'summary must be 3-6 sentences, idea-specific',
      'risks must have at least 5 items for MVP realism',
      'verdict must be "go", "revise", or "no_go"'
    ]
  },
  executionPlanV1: {
    required: ['timeline_weeks', 'phases', 'milestones', 'immediate_next_actions'],
    rules: [
      'timeline_weeks = sum of phase durations (or close; don\'t lie)',
      'phases minimum 4 (Discovery, Build, Test, Launch)',
      'milestones minimum 5',
      'immediate_next_actions minimum 7 (actionable, not vague)'
    ]
  }
};

/**
 * Fallback/Default Values
 * Used when validation fails to keep pipeline moving
 */
const fallbacks = {
  feasibilityAnalysisV1: {
    verdict: 'revise',
    confidence: 0.4,
    summary: 'Analysis incomplete. See unknowns for missing information.',
    risks: [
      {
        risk: 'Incomplete feasibility analysis',
        likelihood: 'high',
        impact: 'high',
        mitigation: 'Gather missing information before proceeding'
      }
    ],
    unknowns: ['Complete feasibility analysis']
  },
  executionPlanV1: {
    timeline_weeks: 8,
    phases: [
      {
        name: 'Discovery & Requirements',
        duration_weeks: 2,
        objectives: ['Understand requirements'],
        deliverables: ['Requirements document'],
        success_criteria: ['Stakeholder approval']
      },
      {
        name: 'Build',
        duration_weeks: 4,
        objectives: ['Implement core features'],
        deliverables: ['Working prototype'],
        success_criteria: ['Core features functional']
      },
      {
        name: 'Test & Refine',
        duration_weeks: 1,
        objectives: ['QA and bug fixes'],
        deliverables: ['Test report'],
        success_criteria: ['Critical bugs resolved']
      },
      {
        name: 'Launch',
        duration_weeks: 1,
        objectives: ['Deploy to production'],
        deliverables: ['Launch checklist'],
        success_criteria: ['Live and stable']
      }
    ],
    open_questions: ['Complete feasibility analysis before detailed planning'],
    immediate_next_actions: [
      'Complete feasibility analysis',
      'Gather stakeholder requirements',
      'Define success metrics',
      'Identify resource constraints',
      'Create detailed timeline',
      'Assign team roles',
      'Schedule kickoff meeting'
    ]
  }
};

module.exports = {
  feasibilityAnalysisV1Schema,
  executionPlanV1Schema,
  validationRules,
  fallbacks
};
