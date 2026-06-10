-- Phase 2 AI Feature Toggles table
-- Allows Principal to enable/disable AI features from the UI

CREATE TABLE IF NOT EXISTS ai_feature_toggles (
  id int unsigned NOT NULL AUTO_INCREMENT,
  feature_key varchar(60) NOT NULL,
  enabled tinyint(1) NOT NULL DEFAULT 0,
  updated_by int unsigned DEFAULT NULL,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_feature_key (feature_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Seed all 10 Phase 2 features (disabled by default)
INSERT IGNORE INTO ai_feature_toggles (feature_key, enabled) VALUES
  ('drawing_sanity_check', 0),
  ('detail_drawing_analysis', 0),
  ('rfi_response_check', 0),
  ('revision_change_analysis', 0),
  ('photo_auto_tagging', 0),
  ('hsn_code_suggestion', 0),
  ('similar_query_search', 0),
  ('material_approval_check', 0),
  ('boq_hsn_autofill', 0),
  ('similar_query_dedup', 0);

-- Add ai_settings nav entry for principal and design_principal
INSERT IGNORE INTO role_nav (role, bucket, tab_key, sort_order, is_visible)
VALUES
  ('principal', 'more', 'ai_settings', 8, 1),
  ('design_principal', 'more', 'ai_settings', 8, 1);
