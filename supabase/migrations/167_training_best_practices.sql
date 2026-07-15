-- Training → Company Guides: Best Practice Templates.
--
-- A Company Super Admin documents the company's standards / best practices for
-- each step of the construction process (Submittals, Specifications, Buyout,
-- RFIs, Closeout, …) as titled, free-text entries. Two things consume them:
--   1. The Company Guides page renders them as editable "Best Practice Templates"
--      that everyone in the company can read.
--   2. The AI features (Assist, Looking Ahead, To Do recommendations) treat them
--      as authoritative company policy — e.g. a rule like "buyout must be done
--      within 90 days of contract" lets Looking Ahead/To Do derive the dated
--      item for the relevant contract.
--
-- Company-scoped; access control is enforced in the API routes (the app uses the
-- Supabase service-role key, which bypasses RLS), consistent with the rest of
-- the codebase.

CREATE TABLE IF NOT EXISTS training_best_practices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- The process step / topic, e.g. "Buyout", "Electrical Submittals", "Specs".
  title       TEXT NOT NULL,
  -- The company's standards / rules / best practices for that step. Free text so
  -- the AI can read concrete requirements ("all buyout within 90 days of contract").
  content     TEXT NOT NULL DEFAULT '',

  -- Display order within the Best Practice Templates list.
  sort_order  INTEGER NOT NULL DEFAULT 0,

  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_best_practices_company
  ON training_best_practices(company_id, sort_order, created_at);
