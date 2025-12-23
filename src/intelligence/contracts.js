/**
 * Shared Intelligence Contracts
 * 
 * This module defines:
 * - Artifact type constants
 * - Validation functions with clear error reporting
 * - Safe fallback generators
 * 
 * Usage:
 * const { FEASIBILITY_TYPE, validateFeasibility } = require('./contracts');
 * const result = validateFeasibility(artifact);
 * if (!result.ok) { use fallback }
 */

const FEASIBILITY_TYPE = 'feasibility_analysis_v1';
const PLAN_TYPE = 'execution_plan_v1';

/**
 * Clamp a number to 0-1 range (for confidence scores)
 */
function clamp01(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * Validate feasibility_analysis_v1 artifact
 * 
 * Returns: { ok: boolean, errors: string[], artifact: object }
 */
function validateFeasibility(a) {
  const errors = [];
  
  // Schema version check
  if (!a || a.schema_version !== 'v1') {
    errors.push('schema_version must be "v1"');
  }
  
  // Idea metadata
  if (!a?.idea?.project_id) {
    errors.push('idea.project_id is required');
  }
  
  // Verdict
  if (!a?.verdict || !['go', 'revise', 'no_go'].includes(a.verdict)) {
    errors.push('verdict must be "go", "revise", or "no_go"');
  }
  
  // Confidence (clamp to 0-1)
  if (typeof a?.confidence === 'number') {
    a.confidence = clamp01(a.confidence);
  } else {
    errors.push('confidence must be a number (0-1)');
  }
  
  // Summary (minimum length check)
  if (!a?.summary || typeof a.summary !== 'string' || a.summary.length < 20) {
    errors.push('summary must be a string with at least 20 characters');
  }
  
  // Risks (minimum 5 required)
  if (!Array.isArray(a?.risks) || a.risks.length < 5) {
    errors.push('risks must be an array with at least 5 items');
  } else {
    // Validate each risk object
    a.risks.forEach((risk, i) => {
      if (!risk.risk || !risk.likelihood || !risk.impact || !risk.mitigation) {
        errors.push(`risks[${i}] missing required fields (risk, likelihood, impact, mitigation)`);
      }
    });
  }
  
  // Key assumptions
  if (!Array.isArray(a?.key_assumptions)) {
    errors.push('key_assumptions must be an array');
  }
  
  // Unknowns
  if (!Array.isArray(a?.unknowns)) {
    errors.push('unknowns must be an array');
  }
  
  // Recommended next steps
  if (!Array.isArray(a?.recommended_next_steps)) {
    errors.push('recommended_next_steps must be an array');
  }
  
  // Suggested stack
  if (!a?.suggested_stack || typeof a.suggested_stack !== 'object') {
    errors.push('suggested_stack must be an object');
  }
  
  // Estimates
  if (!a?.estimates || typeof a.estimates !== 'object') {
    errors.push('estimates must be an object');
  }
  
  return {
    ok: errors.length === 0,
    errors,
    artifact: a
  };
}

/**
 * Validate execution_plan_v1 artifact
 * 
 * Returns: { ok: boolean, errors: string[], artifact: object }
 */
function validatePlan(p) {
  const errors = [];
  
  // Schema version check
  if (!p || p.schema_version !== 'v1') {
    errors.push('schema_version must be "v1"');
  }
  
  // Project ID
  if (!p?.project_id) {
    errors.push('project_id is required');
  }
  
  // Phases (minimum 4)
  if (!Array.isArray(p?.phases) || p.phases.length < 4) {
    errors.push('phases must be an array with at least 4 items (Discovery, Build, Test, Launch)');
  } else {
    // Validate each phase
    p.phases.forEach((phase, i) => {
      if (!phase.name || !Array.isArray(phase.objectives) || !Array.isArray(phase.deliverables)) {
        errors.push(`phases[${i}] missing required fields (name, objectives, deliverables)`);
      }
    });
  }
  
  // Milestones (minimum 5)
  if (!Array.isArray(p?.milestones) || p.milestones.length < 5) {
    errors.push('milestones must be an array with at least 5 items');
  } else {
    // Validate each milestone
    p.milestones.forEach((milestone, i) => {
      if (!milestone.milestone || typeof milestone.week !== 'number') {
        errors.push(`milestones[${i}] missing required fields (milestone, week)`);
      }
    });
  }
  
  // Components
  if (!Array.isArray(p?.components)) {
    errors.push('components must be an array');
  }
  
  // Roles
  if (!Array.isArray(p?.roles)) {
    errors.push('roles must be an array');
  }
  
  // Immediate next actions (minimum 7)
  if (!Array.isArray(p?.immediate_next_actions) || p.immediate_next_actions.length < 7) {
    errors.push('immediate_next_actions must be an array with at least 7 items');
  }
  
  // Open questions
  if (!Array.isArray(p?.open_questions)) {
    errors.push('open_questions must be an array');
  }
  
  // Timeline sanity check
  const phaseSum = (p?.phases || []).reduce((acc, ph) => acc + (Number(ph.duration_weeks) || 0), 0);
  if (!p?.timeline_weeks || p.timeline_weeks <= 0) {
    p.timeline_weeks = phaseSum || 8;
  }
  
  // Warn if timeline doesn't match phase sum (but don't fail)
  if (phaseSum > 0 && Math.abs(p.timeline_weeks - phaseSum) > 1) {
    console.warn(`[validatePlan] timeline_weeks (${p.timeline_weeks}) doesn't match phase sum (${phaseSum})`);
  }
  
  return {
    ok: errors.length === 0,
    errors,
    artifact: p
  };
}

/**
 * Generate fallback feasibility artifact when validation fails
 */
function generateFeasibilityFallback(projectId, ideaId, ideaText, validationErrors) {
  return {
    schema_version: 'v1',
    idea: {
      project_id: projectId,
      idea_id: ideaId,
      title: 'Validation Fallback',
      one_liner: ideaText.slice(0, 160)
    },
    verdict: 'revise',
    confidence: 0.4,
    summary: 'Feasibility artifact failed validation. System generated a fallback. See unknowns for validation errors.',
    key_assumptions: [],
    risks: [
      {
        risk: 'Artifact validation failure',
        likelihood: 'high',
        impact: 'medium',
        mitigation: 'Fix generator to include all required fields'
      },
      {
        risk: 'Missing or incomplete risks list',
        likelihood: 'high',
        impact: 'medium',
        mitigation: 'Ensure at least 5 risks are generated'
      },
      {
        risk: 'Incomplete idea parsing',
        likelihood: 'medium',
        impact: 'medium',
        mitigation: 'Improve title and one-liner extraction from idea text'
      },
      {
        risk: 'Downstream planning blocked',
        likelihood: 'medium',
        impact: 'high',
        mitigation: 'Planning should handle incomplete feasibility gracefully'
      },
      {
        risk: 'Report quality degraded',
        likelihood: 'high',
        impact: 'low',
        mitigation: 'Renderer should clearly show validation errors'
      }
    ],
    unknowns: [
      `Validation errors: ${validationErrors.join('; ')}`
    ],
    recommended_next_steps: [
      'Fix feasibility generator to satisfy schema v1 requirements',
      'Ensure all required fields are present',
      'Run validation before persisting artifacts',
      'Add logging to debug generation failures',
      'Test with various idea formats'
    ],
    suggested_stack: {
      frontend: [],
      backend: [],
      data: [],
      ai: [],
      infra: []
    },
    estimates: {
      mvp_weeks: 8,
      team_size: 'solo',
      cost_band: 'low'
    }
  };
}

/**
 * Generate fallback execution plan when validation fails
 */
function generatePlanFallback(projectId, validationErrors) {
  return {
    schema_version: 'v1',
    project_id: projectId,
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
    components: [
      {
        name: 'Core System',
        purpose: 'Main application logic',
        complexity: 'medium',
        dependencies: [],
        build_notes: ['TBD']
      }
    ],
    roles: [
      {
        role: 'Product Manager',
        responsibilities: ['Define requirements', 'Track progress']
      },
      {
        role: 'Engineer',
        responsibilities: ['Build and test', 'Deploy']
      }
    ],
    milestones: [
      {
        milestone: 'Discovery Complete',
        week: 2,
        acceptance_criteria: ['Requirements approved']
      },
      {
        milestone: 'Core Features Done',
        week: 6,
        acceptance_criteria: ['MVP features working']
      },
      {
        milestone: 'Testing Complete',
        week: 7,
        acceptance_criteria: ['Critical bugs fixed']
      },
      {
        milestone: 'Launch',
        week: 8,
        acceptance_criteria: ['System live']
      },
      {
        milestone: 'Mid-Point Review',
        week: 4,
        acceptance_criteria: ['Progress on track']
      }
    ],
    open_questions: [
      'Complete feasibility analysis before detailed planning'
    ],
    immediate_next_actions: [
      'Complete feasibility analysis',
      'Gather stakeholder requirements',
      'Define success metrics',
      'Identify resource constraints',
      'Create detailed timeline',
      'Assign team roles',
      'Schedule kickoff meeting'
    ]
  };
}

module.exports = {
  FEASIBILITY_TYPE,
  PLAN_TYPE,
  clamp01,
  validateFeasibility,
  validatePlan,
  generateFeasibilityFallback,
  generatePlanFallback
};
