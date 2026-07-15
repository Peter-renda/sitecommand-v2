-- Add is_private flag to tasks. When true, the task is only visible to
-- the creator, assignees, and members of the distribution list.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
