const { query } = require('../db');
const { randomUUID } = require('crypto');
const { FEASIBILITY_TYPE, validateFeasibility, generateFeasibilityFallback } = require('../intelligence/contracts');
const { logFeasibilityRun } = require('../utils/runLogger');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

/**
 * System prompt for Claude 3.5 Sonnet - Feasibility Analysis
 * Ensures strict JSON output with no placeholders or generic content
 */
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
    "project_id": "...",
    "idea_id": "...",
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

/**
 * Call Claude 3.5 Sonnet to generate feasibility analysis
 */
async function generateFeasibilityWithClaude(projectId, ideaId, ideaContent) {
  try {
    console.log(`[FeasibilityJob] Calling Claude 3.5 Sonnet for project ${projectId}`);
    
    const userPrompt = `Analyze this project idea and return ONLY valid JSON:

Project ID: ${projectId}
Idea ID: ${ideaId}

IDEA:
${ideaContent}

Return the feasibility_analysis_v1 JSON object.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      temperature: 0.3,
      system: FEASIBILITY_SYSTEM_PROMPT,
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
    
    console.log(`[FeasibilityJob] Claude response received`);
    console.log(`[FeasibilityJob] Tokens: input=${inputTokens}, output=${outputTokens}, cost=$${estimatedCost.toFixed(4)}`);

    // Parse JSON response
    let artifact;
    try {
      artifact = JSON.parse(responseText);
    } catch (parseError) {
      console.warn(`[FeasibilityJob] JSON parse error, attempting repair`);
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
    console.error(`[FeasibilityJob] Claude API error:`, error.message);
    throw error;
  }
}

/**
 * Main feasibility job with Claude integration
 */
async function processFeasibilityJob(job) {
  const { projectId } = job.data;
  const startTime = Date.now();
  
  // Startup checks
  console.log('[FeasibilityJob] START', {
    projectId,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL || 'unset'
  });
  
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is missing in worker environment');
  }
  
  try {
    // Begin transaction
    await query('BEGIN');
    
    // 1. Load latest idea content
    const ideaResult = await query(
      'SELECT content FROM ideas WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [projectId]
    );
    
    if (ideaResult.rows.length === 0) {
      throw new Error('No idea found for project');
    }
    
    const ideaContent = ideaResult.rows[0].content;
    const ideaId = 'latest';
    
    // 2. Call Claude to generate feasibility analysis
    let artifact, tokens, cost;
    try {
      const result = await generateFeasibilityWithClaude(projectId, ideaId, ideaContent);
      artifact = result.artifact;
      tokens = result.tokens;
      cost = result.cost;
    } catch (claudeError) {
      console.error(`[FeasibilityJob] Claude generation failed, using fallback`);
      artifact = generateFeasibilityFallback(projectId, ideaId, ideaContent, [claudeError.message]);
      tokens = { input: 0, output: 0 };
      cost = 0;
    }
    
    // 3. Validate artifact
    const validation = validateFeasibility(artifact);
    
    // 4. Use fallback if validation fails
    if (!validation.ok) {
      console.warn(`[FeasibilityJob] Validation failed:`, validation.errors);
      artifact = generateFeasibilityFallback(projectId, ideaId, ideaContent, validation.errors);
      console.log(`[FeasibilityJob] Using fallback artifact`);
    }
    
    // 5. Persist artifact
    const artifactId = randomUUID();
    await query(
      'INSERT INTO artifacts (id, project_id, stage, type, name, content) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (project_id, stage, type) DO NOTHING',
      [artifactId, projectId, 'feasibility', FEASIBILITY_TYPE, FEASIBILITY_TYPE, JSON.stringify(artifact)]
    );
    
    console.log(`[FeasibilityJob] Persisted artifact ${artifactId}`);
    
    // 6. Advance project stage
    await query(
      'UPDATE projects SET stage = $1, state = $2, updated_at = NOW() WHERE id = $3',
      ['FeasibilityComplete', 'Active', projectId]
    );
    
    // Commit transaction
    await query('COMMIT');
    
    const duration = Date.now() - startTime;
    
    console.log(`[FeasibilityJob] Completed for project ${projectId}`);
    console.log(`[FeasibilityJob] Verdict: ${artifact.verdict}, Confidence: ${artifact.confidence}`);
    console.log(`[FeasibilityJob] Duration: ${duration}ms, Cost: $${cost.toFixed(4)}`);
    
    // Log run metrics
    const result = {
      ok: true,
      projectId,
      verdict: artifact.verdict,
      confidence: artifact.confidence,
      validated: validation.ok,
      tokens,
      cost,
      duration
    };
    
    logFeasibilityRun(projectId, result);
    return result;
  } catch (error) {
    try {
      await query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[FeasibilityJob] Rollback failed:', rollbackErr.message);
    }
    console.error('[FeasibilityJob] ERROR', {
      projectId,
      message: error?.message
    });
    throw error;
  }
}

module.exports = { processFeasibilityJob };
