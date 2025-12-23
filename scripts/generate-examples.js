#!/usr/bin/env node

/**
 * Generate 5 example reports using the 4-step planning approach
 * Uses OpenAI for feasibility (fast) and Claude for planning sub-steps
 */

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI();
const claude = new Anthropic();

const FEASIBILITY_SYSTEM_PROMPT = `You are Conductor, a senior technical analyst. Evaluate a project idea and return STRICT JSON ONLY.

OUTPUT RULES:
- Output ONLY valid JSON. No markdown, no commentary.
- verdict: "go", "revise", or "no_go"
- confidence: 0.0 to 1.0
- Minimum 5 risks with likelihood/impact
- Minimum 3 assumptions and 3 unknowns
- Minimum 5 next steps

Return ONLY this JSON structure:
{
  "schema_version": "v1",
  "verdict": "go|revise|no_go",
  "confidence": 0.0,
  "summary": "...",
  "key_assumptions": ["..."],
  "risks": [
    {"risk":"...","likelihood":"low|medium|high","impact":"low|medium|high","mitigation":"..."}
  ],
  "unknowns": ["..."],
  "recommended_next_steps": ["..."],
  "suggested_stack": {
    "frontend": ["..."],
    "backend": ["..."],
    "data": ["..."],
    "ai": ["..."],
    "infra": ["..."]
  },
  "estimates": {
    "mvp_weeks": 0,
    "team_size": "solo|2-3|4-6|7+",
    "cost_band": "low|medium|high"
  }
}`;

const IDEAS = [
  {
    title: 'AI-Powered Project Management System',
    description: 'Build an intelligent project management tool that uses AI to analyze project scope, automatically break down tasks, estimate timelines, identify risks, and provide real-time recommendations.'
  },
  {
    title: 'Internal CRM for Sales Teams',
    description: 'Create a lightweight CRM specifically designed for small sales teams (5-20 people). Focus on deal tracking, pipeline visualization, contact management, and integration with email and calendar.'
  },
  {
    title: 'Marketplace MVP for Freelance Services',
    description: 'Build a marketplace platform connecting freelancers with clients for various services (design, writing, development, marketing). Features: service listings, booking/scheduling, payments, reviews, messaging.'
  },
  {
    title: 'Developer Productivity CLI Tool',
    description: 'Create a command-line tool that helps developers automate repetitive tasks: scaffolding new projects, managing dependencies, running tests, deploying code, managing environment variables.'
  },
  {
    title: 'Blockchain-Based Supply Chain Tracker',
    description: 'Build a supply chain tracking system using blockchain to ensure transparency and immutability. Track products from manufacturer to consumer using QR codes.'
  }
];

/**
 * Step 1: Generate feasibility using OpenAI
 */
async function generateFeasibility(idea) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    max_tokens: 1500,
    temperature: 0.3,
    messages: [{
      role: 'system',
      content: FEASIBILITY_SYSTEM_PROMPT
    }, {
      role: 'user',
      content: `Analyze this project idea:\n\n${idea.description}\n\nReturn ONLY valid JSON.`
    }]
  });

  const text = response.choices[0].message.content;
  return JSON.parse(text);
}

/**
 * Step 2a: Generate phases and timeline using Claude
 */
async function generatePhasesAndTimeline(ideaDescription, feasibility) {
  const prompt = `Based on this project and feasibility analysis, generate 4 project phases with realistic timeline.

PROJECT: ${ideaDescription}
VERDICT: ${feasibility.verdict}
ESTIMATED MVP: ${feasibility.estimates.mvp_weeks} weeks

Return ONLY valid JSON:
{
  "timeline_weeks": number,
  "phases": [
    {
      "name": "Phase name",
      "duration_weeks": number,
      "objectives": ["obj1", "obj2"],
      "deliverables": ["del1", "del2"],
      "success_criteria": ["crit1", "crit2"]
    }
  ]
}`;

  const response = await claude.messages.create({
    model: 'claude-opus-4-1-20250805',
    max_tokens: 600,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in phases response');
  return JSON.parse(jsonMatch[0]);
}

/**
 * Step 2b: Generate components using Claude
 */
async function generateComponents(ideaDescription, feasibility) {
  const prompt = `Based on this project, list 6+ core components needed.

PROJECT: ${ideaDescription}
TECH STACK: ${JSON.stringify(feasibility.suggested_stack)}

Return ONLY valid JSON:
{
  "components": [
    {
      "name": "Component name",
      "purpose": "What it does",
      "complexity": "low|medium|high",
      "dependencies": ["dep1"],
      "build_notes": ["note1"]
    }
  ]
}`;

  const response = await claude.messages.create({
    model: 'claude-opus-4-1-20250805',
    max_tokens: 700,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in components response');
  return JSON.parse(jsonMatch[0]);
}

/**
 * Step 2c: Generate roles and milestones using Claude
 */
async function generateRolesAndMilestones(phasesData) {
  const phaseNames = phasesData.phases.map(p => `${p.name} (${p.duration_weeks}w)`).join(', ');
  
  const prompt = `Based on these project phases, define team roles and milestones.

PHASES: ${phaseNames}
TOTAL: ${phasesData.timeline_weeks} weeks

Return ONLY valid JSON:
{
  "roles": [
    {
      "role": "Role name",
      "responsibilities": ["resp1", "resp2"]
    }
  ],
  "milestones": [
    {
      "milestone": "Milestone name",
      "week": number,
      "acceptance_criteria": ["crit1"]
    }
  ]
}`;

  const response = await claude.messages.create({
    model: 'claude-opus-4-1-20250805',
    max_tokens: 600,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in roles/milestones response');
  return JSON.parse(jsonMatch[0]);
}

/**
 * Step 2d: Generate questions and next actions using Claude
 */
async function generateQuestionsAndActions(ideaDescription, feasibility) {
  const topRisks = feasibility.risks.slice(0, 2).map(r => r.risk).join(', ');
  
  const prompt = `Based on this project and risks, identify open questions and immediate next actions.

PROJECT: ${ideaDescription}
TOP RISKS: ${topRisks}

Return ONLY valid JSON:
{
  "open_questions": ["q1", "q2", "q3"],
  "immediate_next_actions": ["a1", "a2", "a3", "a4", "a5", "a6", "a7"]
}`;

  const response = await claude.messages.create({
    model: 'claude-opus-4-1-20250805',
    max_tokens: 500,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in questions/actions response');
  return JSON.parse(jsonMatch[0]);
}

/**
 * Assemble final plan from sub-components
 */
function assemblePlan(phasesData, componentsData, rolesData, questionsData) {
  return {
    schema_version: 'v1',
    timeline_weeks: phasesData.timeline_weeks,
    phases: phasesData.phases,
    components: componentsData.components,
    roles: rolesData.roles,
    milestones: rolesData.milestones,
    open_questions: questionsData.open_questions,
    immediate_next_actions: questionsData.immediate_next_actions
  };
}

/**
 * Generate markdown report from feasibility and plan
 */
function generateMarkdownReport(idea, feasibility, plan) {
  return `# ${idea.title}

## Executive Summary

**Verdict:** ${feasibility.verdict.toUpperCase()}  
**Confidence:** ${(feasibility.confidence * 100).toFixed(0)}%  
**Timeline:** ${plan.timeline_weeks} weeks  
**Team Size:** ${feasibility.estimates.team_size}  
**Cost Band:** ${feasibility.estimates.cost_band}

${feasibility.summary}

---

## Feasibility Analysis

### Key Assumptions
${feasibility.key_assumptions.map(a => `- ${a}`).join('\n')}

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
${feasibility.risks.map(r => `| ${r.risk} | ${r.likelihood} | ${r.impact} | ${r.mitigation} |`).join('\n')}

### Unknowns
${feasibility.unknowns.map(u => `- ${u}`).join('\n')}

### Recommended Next Steps
${feasibility.recommended_next_steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### Suggested Technology Stack

**Frontend:** ${feasibility.suggested_stack.frontend.join(', ')}  
**Backend:** ${feasibility.suggested_stack.backend.join(', ')}  
**Data:** ${feasibility.suggested_stack.data.join(', ')}  
**AI/ML:** ${feasibility.suggested_stack.ai.join(', ') || 'N/A'}  
**Infrastructure:** ${feasibility.suggested_stack.infra.join(', ')}

---

## Execution Plan

### Timeline & Phases

**Total Duration:** ${plan.timeline_weeks} weeks

${plan.phases.map((phase, i) => `
#### Phase ${i + 1}: ${phase.name} (${phase.duration_weeks} weeks)

**Objectives:**
${phase.objectives.map(o => `- ${o}`).join('\n')}

**Deliverables:**
${phase.deliverables.map(d => `- ${d}`).join('\n')}

**Success Criteria:**
${phase.success_criteria.map(s => `- ${s}`).join('\n')}
`).join('\n')}

### Components

| Component | Purpose | Complexity | Dependencies |
|-----------|---------|-----------|--------------|
${plan.components.map(c => `| ${c.name} | ${c.purpose} | ${c.complexity} | ${c.dependencies.join(', ') || 'None'} |`).join('\n')}

### Team Roles

${plan.roles.map(r => `- **${r.role}:** ${r.responsibilities.join(', ')}`).join('\n')}

### Milestones

${plan.milestones.map(m => `**Week ${m.week}: ${m.milestone}**\n- Acceptance Criteria: ${m.acceptance_criteria.join(', ')}`).join('\n\n')}

### Open Questions

${plan.open_questions.map(q => `- ${q}`).join('\n')}

### Immediate Next Actions (First 72 Hours)

${plan.immediate_next_actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

---

*Report generated by Conductor MVP*
`;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Generating 5 Example Reports for Conductor MVP\n');
  
  const examplesDir = path.join(__dirname, '../examples');
  if (!fs.existsSync(examplesDir)) {
    fs.mkdirSync(examplesDir, { recursive: true });
  }
  
  for (let i = 0; i < IDEAS.length; i++) {
    const idea = IDEAS[i];
    const fileName = `example-${i + 1}-${idea.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    const filePath = path.join(examplesDir, fileName);
    
    try {
      console.log(`📊 [${i + 1}/5] ${idea.title}`);
      
      // Step 1: Feasibility
      console.log(`  ✓ Generating feasibility...`);
      const feasibility = await generateFeasibility(idea);
      console.log(`    Verdict: ${feasibility.verdict} (${(feasibility.confidence * 100).toFixed(0)}%)`);
      
      // Step 2: Planning (4 sub-steps)
      console.log(`  ✓ Generating plan (phases, components, roles, actions)...`);
      const phasesData = await generatePhasesAndTimeline(idea.description, feasibility);
      const componentsData = await generateComponents(idea.description, feasibility);
      const rolesData = await generateRolesAndMilestones(phasesData);
      const questionsData = await generateQuestionsAndActions(idea.description, feasibility);
      
      // Step 3: Assemble
      const plan = assemblePlan(phasesData, componentsData, rolesData, questionsData);
      console.log(`    Timeline: ${plan.timeline_weeks} weeks, ${plan.phases.length} phases`);
      
      // Step 4: Generate report
      const report = generateMarkdownReport(idea, feasibility, plan);
      fs.writeFileSync(filePath, report);
      console.log(`  ✅ Saved: ${fileName}\n`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
    }
  }
  
  console.log('✅ All examples generated successfully!');
  console.log(`📁 Examples saved to: ${examplesDir}`);
}

main().catch(console.error);
