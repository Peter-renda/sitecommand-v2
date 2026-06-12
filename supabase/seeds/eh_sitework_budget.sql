-- =============================================================================
-- EH SITEWORK – Budget Line Items Seed
-- Source: budget_details.csv export
-- Generated: 2026-06-12
--
-- Usage:
--   psql "$DATABASE_URL" -f supabase/seeds/eh_sitework_budget.sql
--
-- The script locates the project by name (case-insensitive partial match on
-- "EH Sitework").  Adjust the WHERE clause below if the project name differs.
--
-- By default the INSERT uses ON CONFLICT DO NOTHING so re-running is safe.
-- To replace existing lines first, uncomment the DELETE statement below.
-- =============================================================================

DO $$
DECLARE
  v_project_id UUID;
BEGIN

  -- ── Locate project ─────────────────────────────────────────────────────────
  SELECT id
    INTO v_project_id
    FROM projects
   WHERE name ILIKE '%EH Sitework%'
   LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION
      'Project matching "EH Sitework" not found. '
      'Check the projects table and update the WHERE clause if the name differs.';
  END IF;

  RAISE NOTICE 'Seeding budget for project id: %', v_project_id;

  -- ── Optional: wipe existing lines first ───────────────────────────────────
  -- DELETE FROM budget_line_items WHERE project_id = v_project_id;

  -- ── Insert budget line items ───────────────────────────────────────────────
  -- Columns sourced from CSV:
  --   original_budget_amount  → "Original Budget Amount"
  --   budget_modifications    → "Budget Modifications"
  --   approved_cos            → "Approved COs"
  --   pending_budget_changes  → "Pending Budget Changes"
  --   committed_costs         → "Committed Costs"
  --   job_to_date_costs       → "Job to Date Costs"
  --   pending_cost_changes    → "Pending Cost Changes"
  --
  -- Derived / calculated columns (Revised Budget, Projected Budget,
  -- Projected Costs, EAC, Projected Over/Under, Forecast to Complete)
  -- are NOT stored – the app computes them at read time.
  --
  -- cost_type stores the single-letter code embedded in the budget code
  -- (C = Contract, E = Equipment, L = Labor, M = Materials,
  --  P = Payroll Burden/Overhead @ 48%)

  INSERT INTO budget_line_items (
    project_id,
    cost_code,
    cost_type,
    description,
    original_budget_amount,
    budget_modifications,
    approved_cos,
    pending_budget_changes,
    committed_costs,
    job_to_date_costs,
    pending_cost_changes,
    commitments_invoiced,
    sort_order
  ) VALUES

  -- ── 01 GENERAL REQUIREMENTS ──────────────────────────────────────────────
  (v_project_id, '01-030.C', 'C', 'Workmen''s Facility',
   6300.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1),

  (v_project_id, '01-030.M', 'M', 'Workmen''s Facility',
   0.00, 0.00, 0.00, 0.00, 0.00, 768.66, 0.00, 0.00, 2),

  (v_project_id, '01-040.E', 'E', 'Truck & Auto',
   6278.00, 0.00, 0.00, 0.00, 0.00, 8201.67, 0.00, 0.00, 3),

  (v_project_id, '01-040.M', 'M', 'Truck & Auto',
   5940.00, 0.00, 0.00, 0.00, 0.00, 2454.66, 0.00, 0.00, 4),

  (v_project_id, '01-045.M', 'M', 'Auto Allowance',
   2588.00, 0.00, 0.00, 0.00, 0.00, 583.30, 0.00, 0.00, 5),

  (v_project_id, '01-050.C', 'C', 'Field Office',
   13500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 6),

  (v_project_id, '01-050.M', 'M', 'Field Office',
   7260.00, 0.00, 0.00, 0.00, 0.00, 2737.55, 0.00, 0.00, 7),

  (v_project_id, '01-080.M', 'M', 'Legal Fees',
   0.00, 0.00, 0.00, 0.00, 0.00, 172.50, 0.00, 0.00, 8),

  (v_project_id, '01-090.M', 'M', 'Security',
   8000.00, 0.00, 0.00, 0.00, 0.00, 5307.00, 0.00, 0.00, 9),

  (v_project_id, '01-410.L', 'L', 'Supervision',
   207000.00, 0.00, 12800.12, 18044.22, 0.00, 107743.06, 0.00, 0.00, 10),

  (v_project_id, '01-410.P', 'P', 'Supervision',
   124200.00, 0.00, 17066.83, 24058.96, 0.00, 64646.49, 0.00, 0.00, 11),

  (v_project_id, '01-470.M', 'M', 'Photographs',
   500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 12),

  (v_project_id, '01-475.M', 'M', 'Plans Reproduction',
   1000.00, 0.00, 0.00, 0.00, 0.00, 1759.67, 0.00, 0.00, 13),

  (v_project_id, '01-480.M', 'M', 'Construction Signs',
   1200.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 14),

  (v_project_id, '01-500.M', 'M', 'Temporary Facilities',
   26865.00, 0.00, 0.00, 0.00, 0.00, 4973.30, 0.00, 0.00, 15),

  (v_project_id, '01-710.M', 'M', 'Project Management Software',
   6525.00, 0.00, 0.00, 0.00, 0.00, 5340.00, 0.00, 0.00, 16),

  -- ── 02 SITEWORK ──────────────────────────────────────────────────────────
  (v_project_id, '02-070.C', 'C', 'Surveying & Engineering',
   267500.00, 0.00, 0.00, 0.00, 242500.00, 71140.00, 0.00, 0.00, 17),

  (v_project_id, '02-310.C', 'C', 'Earthwork & Grading',
   679105.00, 0.00, 529404.70, 531920.00, 1232728.70, 1027943.60, 0.00, 0.00, 18),

  (v_project_id, '02-510.C', 'C', 'Water Distribution',
   1409721.00, 0.00, 0.00, 69554.00, 1443274.00, 6500.00, 0.00, 0.00, 19),

  (v_project_id, '02-530.C', 'C', 'Sanitary Sewerage',
   1193491.00, 0.00, 0.00, 0.00, 1210652.03, 392647.03, 0.00, 0.00, 20),

  (v_project_id, '02-630.C', 'C', 'Storm Drainage',
   238980.00, 0.00, 0.00, 0.00, 238980.00, 25095.00, 0.00, 0.00, 21),

  (v_project_id, '02-770.C', 'C', 'Curbs and Gutters',
   58800.00, 0.00, 0.00, 0.00, 56000.00, 0.00, 0.00, 0.00, 22),

  (v_project_id, '02-775.C', 'C', 'Sidewalks & Site Concrete',
   120535.00, 0.00, 0.00, 0.00, 164537.00, 0.00, 0.00, 0.00, 23),

  (v_project_id, '02-785.C', 'C', 'Precast Concrete Pavers',
   1280000.00, 0.00, 0.00, 0.00, 1280000.00, 0.00, 0.00, 0.00, 24),

  (v_project_id, '02-820.C', 'C', 'Fences and Gates',
   22900.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 25),

  (v_project_id, '02-821.C', 'C', 'Temporary Fencing',
   14850.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 26),

  (v_project_id, '02-821.M', 'M', 'Temporary Fencing',
   0.00, 0.00, 0.00, 0.00, 0.00, 4340.00, 0.00, 0.00, 27),

  (v_project_id, '02-835.C', 'C', 'Modular Block Retaining Walls',
   224335.00, 0.00, 0.00, 0.00, 216835.00, 0.00, 0.00, 0.00, 28),

  -- ── 06 WOOD & PLASTICS ───────────────────────────────────────────────────
  (v_project_id, '06-660.M', 'M', 'Safety Materials',
   0.00, 0.00, 0.00, 0.00, 0.00, 171.75, 0.00, 0.00, 29),

  (v_project_id, '06-665.L', 'L', 'Safety Inspections',
   0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 30),

  (v_project_id, '06-665.M', 'M', 'Safety Inspections',
   5850.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 31),

  (v_project_id, '06-665.P', 'P', 'Safety Inspections',
   0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 32),

  (v_project_id, '06-720.M', 'M', 'Misc. Carpentry Materials',
   3000.00, 0.00, 0.00, 0.00, 0.00, 180.00, 0.00, 0.00, 33),

  -- ── 09 FINISHES ──────────────────────────────────────────────────────────
  (v_project_id, '09-915.M', 'M', 'Equipment Rental',
   4500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 34),

  (v_project_id, '09-918.C', 'C', 'Debris Disposal',
   5100.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 35),

  (v_project_id, '09-918.M', 'M', 'Debris Disposal',
   0.00, 0.00, 0.00, 0.00, 0.00, 75.00, 0.00, 0.00, 36),

  (v_project_id, '09-920.M', 'M', 'Clean-up Labor',
   4000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 37),

  (v_project_id, '09-925.L', 'L', 'Punchout Labor',
   0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 38),

  (v_project_id, '09-925.M', 'M', 'Punchout Labor',
   2000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 39),

  (v_project_id, '09-925.P', 'P', 'Punchout Labor',
   0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 40),

  -- ── 17 BONDS, PERMITS, & FEES ────────────────────────────────────────────
  (v_project_id, '17-010.M', 'M', 'Performance Bond',
   37879.00, 0.00, 2773.36, 3937.40, 0.00, 37879.00, 0.00, 0.00, 41),

  (v_project_id, '17-021.M', 'M', 'General Liability Insurance',
   26783.00, 0.00, 1920.02, 2706.63, 0.00, 26783.00, 0.00, 0.00, 42),

  (v_project_id, '17-035.M', 'M', 'Third Party Inspections',
   0.00, 0.00, 0.00, 0.00, 0.00, 1704.45, 0.00, 0.00, 43),

  (v_project_id, '17-050.M', 'M', 'Audit Fees',
   15000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 44),

  (v_project_id, '17-110.M', 'M', 'Contractor''s Contingency',
   119036.00, 0.00, -102733.97, 0.00, 0.00, 0.00, 0.00, 0.00, 45)

  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Done – % budget line items written for project %.',
    (SELECT COUNT(*) FROM budget_line_items WHERE project_id = v_project_id),
    v_project_id;

END $$;
