-- Migration: Create lessons_learned tables
-- Required for Feature 12 — Lessons Learned Draft (AI-powered)

CREATE TABLE IF NOT EXISTS `lessons_learned` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `ai_draft` text COLLATE utf8mb4_general_ci,
  `ai_drafted_at` datetime DEFAULT NULL,
  `published_content` text COLLATE utf8mb4_general_ci,
  `published_at` datetime DEFAULT NULL,
  `published_by` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lessons_project` (`project_id`),
  KEY `published_by` (`published_by`),
  CONSTRAINT `lessons_learned_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lessons_learned_ibfk_2` FOREIGN KEY (`published_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `lessons_learned_inputs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `input_text` text COLLATE utf8mb4_general_ci NOT NULL,
  `category` enum('what_went_well','improvement','recommendation','other') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'other',
  `signoff` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lessons_input_user` (`project_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `lessons_inputs_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lessons_inputs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
