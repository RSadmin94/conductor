const { query } = require('../db');
const { randomUUID } = require('crypto');
const { PLAN_TYPE, validatePlan, generatePlanFallback } = require('../intelligence/contracts');

/**
 * Generate execution_plan_v1 artifact
 * 
 * In production, this would call an AI model
 * For MVP, we generate a realistic plan based on idea and feasibility data
 */
function generateExecutionPlan(projectId, ideaContent, feasibilityData) {
  const ideaLower = ideaContent.toLowerCase();
  
  // Determine timeline based on feasibility estimates
  let timelineWeeks = 8;
  let teamSize = '2-3';
  
  if (feasibilityData && feasibilityData.estimates) {
    timelineWeeks = feasibilityData.estimates.mvp_weeks || 8;
    teamSize = feasibilityData.estimates.team_size || '2-3';
  }
  
  const plan = {
    schema_version: 'v1',
    project_id: projectId,
    timeline_weeks: timelineWeeks,
    phases: generatePhases(ideaContent, timelineWeeks),
    components: generateComponents(ideaContent),
    roles: generateRoles(teamSize),
    milestones: generateMilestones(timelineWeeks),
    open_questions: generateOpenQuestions(feasibilityData),
    immediate_next_actions: generateImmediateActions(ideaContent)
  };
  
  return plan;
}

function generatePhases(idea, timelineWeeks) {
  const discoveryWeeks = Math.ceil(timelineWeeks * 0.2);
  const buildWeeks = Math.ceil(timelineWeeks * 0.5);
  const testWeeks = Math.ceil(timelineWeeks * 0.2);
  const launchWeeks = Math.max(1, timelineWeeks - discoveryWeeks - buildWeeks - testWeeks);
  
  return [
    {
      name: 'Discovery & Requirements',
      duration_weeks: discoveryWeeks,
      objectives: [
        'Gather detailed requirements from stakeholders',
        'Define user personas and use cases',
        'Create technical architecture',
        'Identify dependencies and integrations'
      ],
      deliverables: [
        'Requirements document',
        'Architecture diagram',
        'Technology stack decision',
        'Project timeline and milestones'
      ],
      success_criteria: [
        'Stakeholder sign-off on requirements',
        'Architecture approved by technical lead',
        'Team trained on selected technologies'
      ]
    },
    {
      name: 'Core System Build',
      duration_weeks: buildWeeks,
      objectives: [
        'Implement core features and functionality',
        'Set up CI/CD pipeline',
        'Build data models and APIs',
        'Integrate external services'
      ],
      deliverables: [
        'Working prototype',
        'API documentation',
        'Database schema',
        'Automated test suite'
      ],
      success_criteria: [
        'Core features functional',
        'Tests passing (>80% coverage)',
        'API endpoints documented',
        'Performance benchmarks met'
      ]
    },
    {
      name: 'Testing & Refinement',
      duration_weeks: testWeeks,
      objectives: [
        'Conduct QA and user testing',
        'Fix bugs and optimize performance',
        'Security audit and hardening',
        'Documentation and training'
      ],
      deliverables: [
        'Test report and bug fixes',
        'Security audit report',
        'User documentation',
        'Training materials'
      ],
      success_criteria: [
        'Critical bugs resolved',
        'Security vulnerabilities addressed',
        'Performance optimized',
        'User acceptance testing passed'
      ]
    },
    {
      name: 'Launch & Deployment',
      duration_weeks: launchWeeks,
      objectives: [
        'Deploy to production',
        'Monitor system health',
        'Provide user support',
        'Plan post-launch improvements'
      ],
      deliverables: [
        'Production deployment',
        'Monitoring and alerting setup',
        'Support documentation',
        'Post-launch roadmap'
      ],
      success_criteria: [
        'System live and stable',
        'Monitoring in place',
        'Support team trained',
        'User feedback collected'
      ]
    }
  ];
}

function generateComponents(idea) {
  const ideaLower = idea.toLowerCase();
  
  const components = [
    {
      name: 'API Server',
      purpose: 'Handle business logic and data operations',
      complexity: 'medium',
      dependencies: ['Database', 'Authentication'],
      build_notes: ['RESTful design', 'Rate limiting', 'Error handling']
    },
    {
      name: 'Frontend Application',
      purpose: 'User interface and interaction',
      complexity: 'medium',
      dependencies: ['API Server'],
      build_notes: ['Responsive design', 'Accessibility', 'Performance optimization']
    },
    {
      name: 'Database',
      purpose: 'Data persistence and retrieval',
      complexity: 'medium',
      dependencies: [],
      build_notes: ['Schema design', 'Indexing', 'Backup strategy']
    },
    {
      name: 'Authentication & Authorization',
      purpose: 'User identity and access control',
      complexity: 'high',
      dependencies: ['Database'],
      build_notes: ['OAuth/JWT', 'Role-based access', 'Security best practices']
    }
  ];
  
  // Add conditional components based on idea
  if (ideaLower.includes('ai') || ideaLower.includes('machine learning')) {
    components.push({
      name: 'AI/ML Integration',
      purpose: 'Machine learning model inference and training',
      complexity: 'high',
      dependencies: ['API Server', 'Database'],
      build_notes: ['Model selection', 'Training pipeline', 'Inference optimization']
    });
  }
  
  if (ideaLower.includes('real-time') || ideaLower.includes('websocket')) {
    components.push({
      name: 'Real-time Communication',
      purpose: 'WebSocket or event-driven updates',
      complexity: 'high',
      dependencies: ['API Server'],
      build_notes: ['Connection management', 'Message queuing', 'Scalability']
    });
  }
  
  if (ideaLower.includes('integration') || ideaLower.includes('api')) {
    components.push({
      name: 'Third-party Integrations',
      purpose: 'Connect with external services',
      complexity: 'medium',
      dependencies: ['API Server'],
      build_notes: ['API client libraries', 'Error handling', 'Webhook support']
    });
  }
  
  return components;
}

function generateRoles(teamSize) {
  const roles = [
    {
      role: 'Product Manager',
      responsibilities: [
        'Define requirements and priorities',
        'Communicate with stakeholders',
        'Track progress and manage scope'
      ]
    },
    {
      role: 'Backend Engineer',
      responsibilities: [
        'Design and implement APIs',
        'Manage database schema',
        'Handle integrations'
      ]
    },
    {
      role: 'Frontend Engineer',
      responsibilities: [
        'Build user interface',
        'Implement client-side logic',
        'Optimize performance'
      ]
    }
  ];
  
  // Add QA role for larger teams
  if (teamSize === '4-6' || teamSize === '7+') {
    roles.push({
      role: 'QA Engineer',
      responsibilities: [
        'Test functionality and edge cases',
        'Automate test suite',
        'Report and track bugs'
      ]
    });
  }
  
  // Add DevOps role for larger teams
  if (teamSize === '7+') {
    roles.push({
      role: 'DevOps Engineer',
      responsibilities: [
        'Set up CI/CD pipeline',
        'Manage infrastructure',
        'Monitor production systems'
      ]
    });
  }
  
  return roles;
}

function generateMilestones(timelineWeeks) {
  const milestones = [];
  
  // Week 1-2: Discovery complete
  milestones.push({
    milestone: 'Discovery & Requirements Complete',
    week: Math.ceil(timelineWeeks * 0.2),
    acceptance_criteria: [
      'Requirements document approved',
      'Architecture designed',
      'Team ready to build'
    ]
  });
  
  // Mid-project: Core features done
  milestones.push({
    milestone: 'Core Features Implemented',
    week: Math.ceil(timelineWeeks * 0.6),
    acceptance_criteria: [
      'MVP features working',
      'APIs functional',
      'Basic testing passing'
    ]
  });
  
  // Week before launch: Testing complete
  milestones.push({
    milestone: 'Testing & QA Complete',
    week: Math.ceil(timelineWeeks * 0.8),
    acceptance_criteria: [
      'Critical bugs fixed',
      'Performance optimized',
      'Security audit passed'
    ]
  });
  
  // Final: Launch
  milestones.push({
    milestone: 'Production Launch',
    week: timelineWeeks,
    acceptance_criteria: [
      'System live',
      'Monitoring active',
      'Support team ready'
    ]
  });
  
  // Add mid-point milestone
  milestones.push({
    milestone: 'Mid-Project Review',
    week: Math.ceil(timelineWeeks * 0.5),
    acceptance_criteria: [
      'Progress on track',
      'No blocking issues',
      'Stakeholder alignment'
    ]
  });
  
  return milestones.sort((a, b) => a.week - b.week);
}

function generateOpenQuestions(feasibilityData) {
  const questions = [
    'What is the target user scale and growth trajectory?',
    'Are there regulatory or compliance requirements?',
    'What is the budget and resource allocation?',
    'How will success be measured?'
  ];
  
  if (feasibilityData && feasibilityData.unknowns) {
    questions.push(...feasibilityData.unknowns.slice(0, 2));
  }
  
  return questions;
}

function generateImmediateActions(idea) {
  return [
    'Schedule kickoff meeting with all stakeholders',
    'Set up development environment and repositories',
    'Create detailed project timeline in project management tool',
    'Establish communication channels and meeting cadence',
    'Assign team members to roles and responsibilities',
    'Set up CI/CD pipeline and deployment infrastructure',
    'Create initial database schema and API specifications',
    'Begin first sprint with highest-priority features'
  ];
}

/**
 * Main planning job
 * 
 * Pattern:
 * 1. Load idea content
 * 2. Load feasibility artifact (if available)
 * 3. Generate artifact
 * 4. Validate artifact
 * 5. Use fallback if validation fails
 * 6. Persist artifact
 * 7. Advance project stage
 */
async function processPlanningJob(job) {
  const { projectId } = job.data;
  
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
    
    // 3. Generate execution plan artifact
    let artifact = generateExecutionPlan(projectId, ideaContent, feasibilityData);
    
    // 4. Validate artifact
    const validation = validatePlan(artifact);
    
    // 5. Use fallback if validation fails
    if (!validation.ok) {
      console.warn(`[PlanningJob] Validation failed for project ${projectId}:`, validation.errors);
      artifact = generatePlanFallback(projectId, validation.errors);
      console.log(`[PlanningJob] Using fallback artifact`);
    }
    
    // 6. Persist artifact
    const artifactId = randomUUID();
    await query(
      'INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING',
      [artifactId, projectId, 'planning', PLAN_TYPE, PLAN_TYPE, JSON.stringify(artifact)]
    );
    
    console.log(`[PlanningJob] Persisted artifact ${artifactId} for project ${projectId}`);
    
    // 7. Advance project stage
    console.log(`[PlanningJob] Updating project ${projectId}: stage → PlanningComplete`);
    await query(
      'UPDATE projects SET stage = $1, updated_at = NOW() WHERE id = $2',
      ['PlanningComplete', projectId]
    );
    
    // Commit transaction
    await query('COMMIT');
    
    console.log(`[PlanningJob] Completed for project ${projectId}`);
    console.log(`[PlanningJob] Timeline: ${artifact.timeline_weeks} weeks, ${artifact.phases.length} phases`);
    
    return {
      ok: true,
      projectId,
      timeline_weeks: artifact.timeline_weeks,
      phases: artifact.phases.length,
      validated: validation.ok
    };
  } catch (error) {
    // Rollback transaction
    await query('ROLLBACK');
    console.error(`[PlanningJob] Error for project ${projectId}:`, error.message);
    throw error;
  }
}

module.exports = { processPlanningJob };
