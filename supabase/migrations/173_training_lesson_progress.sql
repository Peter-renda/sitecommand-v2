-- Training → Lessons: per-user completion tracking.
--
-- Lesson content itself is static/curated (lib/training-lessons.ts), not
-- stored in the database. This table only tracks which lessons a given user
-- has marked complete, so the Lessons page can show progress and a resume
-- point. lesson_id is a free-text key matching Lesson.id in that module
-- (not a foreign key, since lessons aren't database rows).

CREATE TABLE IF NOT EXISTS training_lesson_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id     TEXT NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_training_lesson_progress_user
  ON training_lesson_progress(user_id);
