#!/usr/bin/env node

/**
 * Generate 5 example reports for marketing/sales assets
 * Uses OpenAI API (available in sandbox)
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const client = new OpenAI();

const FEASIBILITY_SYSTEM_PROMPT = `You are Conductor, a senior technical product + engineering analyst. Your job is to evaluate a single project idea and output a STRICT JSON object that conforms exactly to the feasibility_analysis_v1 schema.

OUTPUT RULES (NON-NEGOTIABLE):
- Output MUST be valid JSON only. No markdown, no commentary, no code fences.
- Do NOT include placeholder text (e.g., "TBD", "standard risks", "pending", "various", "N/A").
- Be specific to the idea provided. Use concrete risks, assumptions, unknowns, and next steps.
- Use concise but substantive language. Avoid generic buzzwords.
- If the user's idea is ambiguous, infer reasonable assumptions and list them under key_assumptions and unknowns.
- Ensure minimum counts:
  - risks: at least 5 items
  - key_assumptions: 3–7 items
  - unknowns: 3–7 items
  - recommended_next_steps: 5–10 items
- confidence MUST be a number from 0.0 to 1.0.
- verdict MUST be one of: "go", "revise", "no_go".
- likelihood and impact MUST be one of: "low", "medium", "high".

CONFIDENCE GUIDELINE:
- Confidence reflects strength of recommendation given the information quality and known risks, NOT probability of success.
- Higher confidence when: scope is clear, path is proven, risks are manageable, unknowns are limited.
- Lower confidence when: unclear user/market, heavy integration dependence, unclear data/privacy, unclear feasibility.

ESTIMATES GUIDELINE:
- mvp_weeks: realistic MVP timeline assuming a lean build.
- team_size: choose one of "solo", "2-3", "4-6", "7+".
- cost_band: choose one of "low", "medium", "high" based on complexity and dependencies.

SUGGESTED_STACK:
- Provide 1–4 items per category. Keep it practical and MVP-oriented. Avoid exotic tech unless necessary.

QUALITY BAR:
This should read like an experienced tech lead advising whether to proceed, including uncomfortable risks and clear next steps.

Return ONLY valid JSON matching this exact structure:
{
  "schema_version": "v1",
  "idea": {
    "project_id": "example-1",
    "idea_id": "latest",
    "title": "...",
    "one_liner": "..."
  },
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

Return ONLY valid JSON matching this exact structure:
{
  "schema_version": "v1",
  "project_id": "example-1",
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

const IDEAS = [
  {
    title: 'AI-Powered Project Management System',
    description: 'Build an intelligent project management tool that uses AI to analyze project scope, automatically break down tasks, estimate timelines, identify risks, and provide real-time recommendations. Features include natural language task creation, AI-powered timeline estimation, risk prediction, and smart resource allocation.'
  },
  {
    title: 'Internal CRM for Sales Teams',
    description: 'Create a lightweight CRM specifically designed for small sales teams (5-20 people). Focus on deal tracking, pipeline visualization, contact management, and integration with email and calendar. Emphasis on ease of use over feature bloat. Target: SMBs who find Salesforce too complex and expensive.'
  },
  {
    title: 'Marketplace MVP for Freelance Services',
    description: 'Build a marketplace platform connecting freelancers with clients for various services (design, writing, development, marketing). Features: service listings, booking/scheduling, payments, reviews, messaging. Start with 2-3 service categories and expand based on demand.'
  },
  {
    title: 'Developer Productivity CLI Tool',
    description: 'Create a command-line tool that helps developers automate repetitive tasks: scaffolding new projects, managing dependencies, running tests, deploying code, managing environment variables. Integrate with popular frameworks (React, Node, Python) and cloud platforms (AWS, Vercel, Heroku).'
  },
  {
    title: 'Blockchain-Based Supply Chain Tracker',
    description: 'Build a supply chain tracking system using blockchain to ensure transparency and immutability. Track products from manufacturer to consumer. Use QR codes for physical tracking. Target: luxury goods, pharmaceuticals, food safety. No prior blockchain experience on the team.'
  }
];

async function generateFeasibility(idea, index) {
  console.log(`\n📊 [${index}/5] Generating feasibility for: ${idea.title}`);
  
  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    max_tokens: 1500,
    temperature: 0.3,
    messages: [{
      role: 'system',
      content: FEASIBILITY_SYSTEM_PROMPT
    }, {
      role: 'user',
      content: `Analyze this project idea and return ONLY valid JSON:

IDEA:
${idea.description}

Return the feasibility_analysis_v1 JSON object.`
    }]
  });

  const text = response.choices[0].message.content;
  const feasibility = JSON.parse(text);
  console.log(`✓ Feasibility: ${feasibility.verdict} (confidence: ${feasibility.confidence})`);
  return feasibility;
}

async function generatePlan(idea, feasibility, index) {
  console.log(`📋 Generating plan for: ${idea.title}`);
  
  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    max_tokens: 1200,
    temperature: 0.1,
    messages: [{
      role: 'system',
      content: PLANNING_SYSTEM_PROMPT
    }, {
      role: 'user',
      content: `Create a detailed execution plan for this project:

IDEA:
${idea.description}

FEASIBILITY ANALYSIS:
${JSON.stringify(feasibility, null, 2)}

Return the execution_plan_v1 JSON object.`
    }]
  });

  let text = response.choices[0].message.content;
  let plan;
  
  try {
    plan = JSON.parse(text);
  } catch (parseError) {
    console.log(`  ⚠️  JSON parse error, attempting repair...`);
    // Try to extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        plan = JSON.parse(jsonMatch[0]);
        console.log(`  ✓ JSON repaired successfully`);
      } catch (repairError) {
        console.log(`  ❌ JSON repair failed, using fallback`);
        throw new Error('Could not parse or repair JSON from Claude response');
      }
    } else {
      throw parseError;
    }
  }
  
  console.log(`✓ Plan: ${plan.timeline_weeks} weeks, ${plan.phases.length} phases`);
  return plan;
}

function generateMarkdownReport(idea, feasibility, plan) {
  const report = `# ${idea.title}

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

${plan.milestones.map((m, i) => `
**Week ${m.week}: ${m.milestone}**
- Acceptance Criteria: ${m.acceptance_criteria.join(', ')}
`).join('\n')}

### Open Questions

${plan.open_questions.map(q => `- ${q}`).join('\n')}

### Immediate Next Actions (First 72 Hours)

${plan.immediate_next_actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

---

*Report generated by Conductor MVP*
`;

  return report;
}

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
      const feasibility = await generateFeasibility(idea, i + 1);
      const plan = await generatePlan(idea, feasibility, i + 1);
      const report = generateMarkdownReport(idea, feasibility, plan);
      
      fs.writeFileSync(filePath, report);
      console.log(`✅ Saved: ${fileName}\n`);
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Error generating example for "${idea.title}":`, error.message);
    }
  }
  
  console.log('\n✅ All examples generated successfully!');
  console.log(`📁 Examples saved to: ${examplesDir}`);
}

main().catch(console.error);
