-- Complete PostgreSQL Schema for Deployment
-- Includes all migrations

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state TEXT NOT NULL DEFAULT 'Active',
    stage TEXT NOT NULL DEFAULT 'Idea',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_state ON projects(state);
CREATE INDEX IF NOT EXISTS idx_projects_stage ON projects(stage);

-- Ideas table
CREATE TABLE IF NOT EXISTS ideas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideas_project_id ON ideas(project_id);

-- Decisions table
-- DB-level idempotency: UNIQUE(project_id, stage)
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    stage TEXT NOT NULL,
    outcome TEXT NOT NULL,
    rationale TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_decisions_project_id ON decisions(project_id);

-- Runs table
-- History preserved: NO CASCADE
CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    state TEXT NOT NULL,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runs_project_id ON runs(project_id);

-- Artifacts table
-- History preserved: NO CASCADE
-- DB-level idempotency: UNIQUE(project_id, stage, type)
CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    run_id UUID REFERENCES runs(id) ON DELETE RESTRICT,
    stage TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT,
    content TEXT,
    uri TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, stage, type)
);

CREATE INDEX IF NOT EXISTS idx_artifacts_project_id ON artifacts(project_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_run_id ON artifacts(run_id);

-- Messages table
-- History preserved: NO CASCADE
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);

