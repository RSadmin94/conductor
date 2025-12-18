-- Add stage column to projects table
-- T9: Separate coarse state from fine-grained stage

ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'Idea';

-- Update existing rows to have stage='Idea' if null (shouldn't happen with NOT NULL, but safe)
UPDATE projects SET stage = 'Idea' WHERE stage IS NULL;

-- Create index on stage for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_stage ON projects(stage);

