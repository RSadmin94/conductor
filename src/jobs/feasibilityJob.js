const { query } = require('../db');
const { randomUUID } = require('crypto');
const { fallbacks } = require('../schemas/artifacts');

async function processFeasibilityJob(job) {
  const { projectId } = job.data;
  
  try {
    // Begin transaction (no-op for in-memory)
    await query('BEGIN');
    
    // Get idea content
    const ideaResult = await query(
      'SELECT content FROM ideas WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [projectId]
    );
    
    if (ideaResult.rows.length === 0) {
      throw new Error('No idea found for project');
    }
    
    const ideaContent = ideaResult.rows[0].content;
    
    // Generate feasibility_analysis_v1 artifact
    // In production, this would call an AI model (GPT, Claude, etc.)
    // For now, we generate a realistic structured analysis based on the idea
    const feasibilityAnalysis = generateFeasibilityAnalysis(projectId, ideaContent);
    
    // Create artifact with type: feasibility_analysis_v1
    const artifactContent = JSON.stringify(feasibilityAnalysis);
    
    await query(
      'INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING',
      [randomUUID(), projectId, 'feasibility', 'feasibility_analysis_v1', 'feasibility_analysis_v1', artifactContent]
    );
    
    // Update project stage
    console.log(`[FeasibilityJob] Updating project ${projectId}: stage=Idea → FeasibilityComplete`);
    await query(
      'UPDATE projects SET stage = $1, state = $2, updated_at = NOW() WHERE id = $3',
      ['FeasibilityComplete', 'Active', projectId]
    );
    
    // Commit transaction (no-op for in-memory)
    await query('COMMIT');
    
    console.log(`[FeasibilityJob] Completed for project ${projectId}`);
    console.log(`[FeasibilityJob] Verdict: ${feasibilityAnalysis.verdict}, Confidence: ${feasibilityAnalysis.confidence}`);
    
    return { projectId, verdict: feasibilityAnalysis.verdict, confidence: feasibilityAnalysis.confidence };
  } catch (error) {
    // Rollback transaction (no-op for in-memory)
    await query('ROLLBACK');
    console.error(`[FeasibilityJob] Error for project ${projectId}:`, error.message);
    throw error;
  }
}

/**
 * Generate feasibility_analysis_v1 artifact
 * In production, this would call an AI model
 * For MVP, we generate a realistic analysis based on idea keywords
 */
function generateFeasibilityAnalysis(projectId, ideaContent) {
  // Extract key indicators from idea content
  const ideaLower = ideaContent.toLowerCase();
  
  // Determine verdict based on idea complexity indicators
  let verdict = 'go';
  let confidence = 0.75;
  
  const complexityIndicators = ['blockchain', 'quantum', 'neural network', 'real-time', 'distributed'];
  const riskIndicators = ['security', 'compliance', 'integration', 'scale', 'privacy'];
  
  const hasComplexity = complexityIndicators.some(indicator => ideaLower.includes(indicator));
  const hasRisks = riskIndicators.some(indicator => ideaLower.includes(indicator));
  
  if (hasComplexity && hasRisks) {
    verdict = 'revise';
    confidence = 0.55;
  } else if (hasComplexity) {
    confidence = 0.65;
  }
  
  // Build the feasibility analysis object
  const analysis = {
    schema_version: 'v1',
    idea: {
      project_id: projectId,
      idea_id: randomUUID(),
      title: ideaContent.substring(0, 80),
      one_liner: ideaContent.substring(0, 120)
    },
    verdict: verdict,
    confidence: confidence,
    summary: generateSummary(ideaContent, verdict),
    key_assumptions: generateAssumptions(ideaContent),
    risks: generateRisks(ideaContent),
    unknowns: generateUnknowns(ideaContent),
    recommended_next_steps: generateNextSteps(ideaContent, verdict),
    suggested_stack: generateStack(ideaContent),
    estimates: {
      mvp_weeks: hasComplexity ? 10 : 6,
      team_size: hasComplexity ? '4-6' : '2-3',
      cost_band: hasComplexity ? 'high' : 'medium'
    }
  };
  
  return analysis;
}

function generateSummary(idea, verdict) {
  const ideaPreview = idea.substring(0, 100);
  
  if (verdict === 'go') {
    return `This project is technically feasible and aligns with current market trends. The core concept of "${ideaPreview}..." is achievable with standard technologies and a focused team. Success depends on clear requirements definition and realistic timeline expectations.`;
  } else if (verdict === 'revise') {
    return `This project shows promise but requires refinement before proceeding. The concept of "${ideaPreview}..." involves complexity that needs further analysis. Recommend clarifying scope, dependencies, and resource constraints before full commitment.`;
  } else {
    return `This project faces significant technical or market challenges. The concept of "${ideaPreview}..." would require substantial resources or novel approaches. Consider pivoting scope or exploring alternative approaches.`;
  }
}

function generateAssumptions(idea) {
  return [
    'Team has access to required technologies and platforms',
    'Project scope remains stable during initial development',
    'Stakeholders are available for requirements clarification',
    'External dependencies (APIs, services) remain available',
    'Budget and timeline estimates are realistic for team size'
  ];
}

function generateRisks(idea) {
  const ideaLower = idea.toLowerCase();
  const risks = [];
  
  // Base risks
  risks.push({
    risk: 'Scope creep during development',
    likelihood: 'high',
    impact: 'high',
    mitigation: 'Define clear MVP scope and use iterative delivery'
  });
  
  risks.push({
    risk: 'Technical complexity underestimation',
    likelihood: 'medium',
    impact: 'high',
    mitigation: 'Conduct technical spike for critical components'
  });
  
  risks.push({
    risk: 'Resource availability constraints',
    likelihood: 'medium',
    impact: 'medium',
    mitigation: 'Secure team commitments early and plan for contingencies'
  });
  
  // Conditional risks based on idea content
  if (ideaLower.includes('ai') || ideaLower.includes('machine learning')) {
    risks.push({
      risk: 'Model accuracy and performance variability',
      likelihood: 'high',
      impact: 'high',
      mitigation: 'Establish clear performance baselines and testing frameworks'
    });
  }
  
  if (ideaLower.includes('integration') || ideaLower.includes('api')) {
    risks.push({
      risk: 'Third-party API changes or deprecation',
      likelihood: 'medium',
      impact: 'medium',
      mitigation: 'Design abstraction layers and monitor API status'
    });
  }
  
  if (ideaLower.includes('security') || ideaLower.includes('data')) {
    risks.push({
      risk: 'Security vulnerabilities and data protection',
      likelihood: 'medium',
      impact: 'high',
      mitigation: 'Implement security reviews and compliance checks early'
    });
  }
  
  return risks;
}

function generateUnknowns(idea) {
  return [
    'Exact user requirements and feature prioritization',
    'Integration points with existing systems',
    'Performance and scalability requirements',
    'Regulatory or compliance constraints',
    'Team skill gaps and training needs'
  ];
}

function generateNextSteps(idea, verdict) {
  const steps = [
    'Conduct detailed requirements workshop with stakeholders',
    'Create technical architecture diagram',
    'Identify and evaluate technology options',
    'Break down project into phases and milestones',
    'Define success metrics and acceptance criteria'
  ];
  
  if (verdict === 'revise') {
    steps.push('Address identified risks and unknowns');
    steps.push('Refine scope and get stakeholder alignment');
  }
  
  steps.push('Schedule kickoff meeting and team onboarding');
  steps.push('Establish communication and reporting cadence');
  
  return steps;
}

function generateStack(idea) {
  const ideaLower = idea.toLowerCase();
  
  const stack = {
    frontend: ['React', 'TypeScript', 'TailwindCSS'],
    backend: ['Node.js', 'Express'],
    data: ['PostgreSQL'],
    ai: [],
    infra: ['Docker', 'Render']
  };
  
  // Adjust stack based on idea content
  if (ideaLower.includes('ai') || ideaLower.includes('machine learning')) {
    stack.ai = ['OpenAI API', 'LangChain'];
  }
  
  if (ideaLower.includes('real-time') || ideaLower.includes('websocket')) {
    stack.backend.push('Socket.io');
  }
  
  if (ideaLower.includes('mobile')) {
    stack.frontend = ['React Native', 'Expo'];
  }
  
  return stack;
}

module.exports = { processFeasibilityJob };
