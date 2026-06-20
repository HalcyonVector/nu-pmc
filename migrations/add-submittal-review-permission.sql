-- Add workflow.submittal.review permission for roles that need it
-- These were present in nu-pmc-install-20260502.sql but missing from local DB

INSERT IGNORE INTO role_permissions (role, action, level, group_name, label)
VALUES
  ('principal',         'workflow.submittal.review', 'A', 'Workflow', 'Review submittal'),
  ('design_principal',  'workflow.submittal.review', 'A', 'Workflow', 'Review submittal'),
  ('pmc_head',          'workflow.submittal.review', 'A', 'Workflow', 'Review submittal'),
  ('design_head',       'workflow.submittal.review', 'A', 'Workflow', 'Review submittal'),
  ('services_head',     'workflow.submittal.review', 'A', 'Workflow', 'Review submittal');

-- Add onboarding.boq.upload permission
INSERT IGNORE INTO role_permissions (role, action, level, group_name, label)
VALUES
  ('principal',         'onboarding.boq.upload', 'A', 'Onboarding', 'Upload BOQ'),
  ('design_principal',  'onboarding.boq.upload', 'A', 'Onboarding', 'Upload BOQ'),
  ('design_head',       'onboarding.boq.upload', 'A', 'Onboarding', 'Upload BOQ'),
  ('services_head',     'onboarding.boq.upload', 'A', 'Onboarding', 'Upload BOQ');
