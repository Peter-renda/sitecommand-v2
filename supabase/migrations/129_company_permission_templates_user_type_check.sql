-- Allow custom user_type values in company_permission_templates.
--
-- The Permission Templates UI lets a Super Admin create new templates with
-- arbitrary user-type names (for example "estimator"). The original CHECK
-- constraint only permitted the six built-in user types and blocked saves
-- with "violates check constraint company_permission_templates_user_type_check".
--
-- user_category is still constrained to ('company', 'invitee'); only the
-- user_type list is opened up. Application-layer validation in
-- isTemplateUserType() still requires a non-empty string.

ALTER TABLE company_permission_templates
  DROP CONSTRAINT IF EXISTS company_permission_templates_user_type_check;

ALTER TABLE company_permission_templates
  ADD CONSTRAINT company_permission_templates_user_type_nonempty
  CHECK (length(trim(user_type)) > 0);
