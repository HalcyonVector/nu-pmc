-- Add workflow.submittal.review permission for roles that need it
-- These were present in nu-pmc-install-20260502.sql but missing from local DB

INSERT IGNORE INTO role_permissions (role, action, level, group_name, label)
VALUES
  ('principal',         'workflow.submittal.review', 'A', 'Workflow', 'Review submittal'),
  ('design_principal',  'workflow.submittal.review', 'A', 'Workflow', 'Review submittal'),
  ('pmc_head',          'workflow.submittal.review', 'A', 'Workflow', 'Review submittal'),
  ('design_head',       'workflow.submittal.review', 'A', 'Workflow', 'Review submittal'),
  ('services_head',     'workflow.submittal.review', 'A', 'Workflow', 'Review submittal');
