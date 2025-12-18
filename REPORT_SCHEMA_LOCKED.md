# REPORT SCHEMA (LOCKED)

## Structure (Exact Order, All 6 Sections Required)

1. **Header** (metadata)
   - Project ID
   - Generated (timestamp)
   - Status

2. **Executive Summary**
   - Your Idea

3. **Feasibility Analysis**
   - Outcome
   - Summary
   - Risks

4. **Execution Plan**
   - Timeline
   - Phases
   - Components

5. **Next Steps** (static)

6. **Footer** (static)

## Field Mapping (Locked)

- `projectId` ← `projects.id`
- `outcome` ← `decisions.outcome` (where stage='feasibility')
- `summary` ← `artifacts.content.summary` (where stage='feasibility', type='feasibility_report')
- `risks` ← `artifacts.content.risks` (where stage='feasibility', type='feasibility_report')
- `timeline` ← `artifacts.content.timeline` (where stage='planning', type='planning_plan')
- `phases` ← `artifacts.content.phases` (where stage='planning', type='planning_plan') - comma-separated
- `components` ← `artifacts.content.components` (where stage='planning', type='planning_plan') - comma-separated
- `idea` ← `ideas.content` (latest for project)

## Fallbacks (Defined)

- Missing feasibility summary → "Feasibility analysis completed"
- Missing risks → "Standard project risks"
- Missing timeline → "TBD"
- Missing phases → "Multiple phases"
- Missing components → "Core components defined"

## Validation Rules

- All 6 sections required, exact order
- No extra sections
- Standard Markdown only
- Valid if all fields present or fallback used

## Format (Markdown)

```markdown
# Project Report

## Header
- **Project ID:** {projectId}
- **Generated:** {timestamp}
- **Status:** {status}

## Executive Summary

### Your Idea
{idea}

## Feasibility Analysis

### Outcome
{outcome}

### Summary
{summary}

### Risks
{risks}

## Execution Plan

### Timeline
{timeline}

### Phases
{phases}

### Components
{components}

## Next Steps

[Static content]

## Footer

[Static content]
```

