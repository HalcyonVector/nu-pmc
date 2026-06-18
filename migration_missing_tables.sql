-- Migration: Create missing tables for pv90 deployment
-- Generated from local_full.sql schema
SET FOREIGN_KEY_CHECKS=0;

-- Table: approval_signoffs
CREATE TABLE IF NOT EXISTS `approval_signoffs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `approval_id` int unsigned NOT NULL,
  `signer_id` int unsigned NOT NULL,
  `signer_role` varchar(40) COLLATE utf8mb4_general_ci NOT NULL,
  `vote` enum('approve','reject') COLLATE utf8mb4_general_ci NOT NULL,
  `comment` text COLLATE utf8mb4_general_ci,
  `voted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_approval_signer` (`approval_id`,`signer_id`),
  KEY `signer_id` (`signer_id`),
  CONSTRAINT `approval_signoffs_ibfk_1` FOREIGN KEY (`approval_id`) REFERENCES `approvals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `approval_signoffs_ibfk_2` FOREIGN KEY (`signer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: approval_type_config
CREATE TABLE IF NOT EXISTS `approval_type_config` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `approval_type` varchar(60) COLLATE utf8mb4_general_ci NOT NULL,
  `signer_roles_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `quorum` tinyint unsigned NOT NULL DEFAULT '1',
  `scope` enum('project','global') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'project',
  `requires_vendor_confirm` tinyint(1) NOT NULL DEFAULT '0',
  `expires_after_hours` int unsigned DEFAULT NULL,
  `label` varchar(120) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `sheet_source` varchar(40) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `approval_type` (`approval_type`),
  CONSTRAINT `approval_type_config_chk_1` CHECK (json_valid(`signer_roles_json`))
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: approvals
CREATE TABLE IF NOT EXISTS `approvals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `approval_type` varchar(60) COLLATE utf8mb4_general_ci NOT NULL,
  `ref_table` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `ref_id` int unsigned NOT NULL,
  `project_id` int unsigned DEFAULT NULL,
  `raised_by` int unsigned NOT NULL,
  `raised_by_role` varchar(40) COLLATE utf8mb4_general_ci NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `title` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `details` text COLLATE utf8mb4_general_ci,
  `status` enum('pending','approved','rejected','expired','cancelled') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `resolved_at` datetime DEFAULT NULL,
  `resolved_by` int unsigned DEFAULT NULL,
  `resolution_note` text COLLATE utf8mb4_general_ci,
  `expires_at` datetime DEFAULT NULL,
  `vendor_id` int unsigned DEFAULT NULL,
  `vendor_confirmed_at` datetime DEFAULT NULL,
  `row_version` int unsigned NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_approvals_ref` (`ref_table`,`ref_id`,`status`),
  KEY `idx_approvals_status` (`status`,`raised_at`),
  KEY `idx_approvals_project` (`project_id`,`status`),
  KEY `idx_approvals_vendor` (`vendor_id`,`status`),
  KEY `approvals_ibfk_1` (`raised_by`),
  KEY `approvals_ibfk_2` (`resolved_by`),
  CONSTRAINT `approvals_ibfk_1` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `approvals_ibfk_2` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `approvals_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `approvals_ibfk_4` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: budget_threshold_alerts
CREATE TABLE IF NOT EXISTS `budget_threshold_alerts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `category_name` varchar(120) NOT NULL,
  `alert_pct` tinyint unsigned NOT NULL,
  `alerted_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_bta_project` (`project_id`,`category_name`)
) ENGINE=InnoDB AUTO_INCREMENT=132 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: client_errors
CREATE TABLE IF NOT EXISTS `client_errors` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned DEFAULT NULL,
  `user_role` varchar(40) DEFAULT NULL,
  `user_full_name` varchar(120) DEFAULT NULL,
  `request_method` varchar(10) NOT NULL,
  `request_path` varchar(500) NOT NULL,
  `http_status` int DEFAULT NULL,
  `error_code` varchar(40) DEFAULT NULL,
  `response_excerpt` varchar(1000) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `client_path` varchar(200) DEFAULT NULL,
  `triaged_at` datetime DEFAULT NULL,
  `triaged_by` int unsigned DEFAULT NULL,
  `triage_note` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_errors_created` (`created_at`),
  KEY `idx_client_errors_untriaged` (`triaged_at`,`created_at`),
  KEY `idx_client_errors_path` (`request_method`,`request_path`)
) ENGINE=InnoDB AUTO_INCREMENT=102 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: document_attachments
CREATE TABLE IF NOT EXISTS `document_attachments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `document_id` int unsigned DEFAULT NULL,
  `workflow_type` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `filename` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mimetype` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `size_bytes` bigint unsigned DEFAULT NULL,
  `stored_path` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `uploaded_by_mxid` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `uploaded_by_uid` int unsigned DEFAULT NULL,
  `uploaded_at` datetime NOT NULL,
  `matrix_event_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mxc_url` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `source` enum('matrix','pwa') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'matrix',
  `reviewed` tinyint(1) NOT NULL DEFAULT '0',
  `reviewed_by` int unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `rejected` tinyint(1) NOT NULL DEFAULT '0',
  `rejection_reason` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_matrix_event` (`matrix_event_id`),
  KEY `idx_project_doc` (`project_id`,`document_id`),
  KEY `idx_workflow` (`workflow_type`,`document_id`),
  KEY `uploaded_by_uid` (`uploaded_by_uid`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `document_attachments_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `document_attachments_ibfk_2` FOREIGN KEY (`uploaded_by_uid`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `document_attachments_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: external_comm_assignments
CREATE TABLE IF NOT EXISTS `external_comm_assignments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `activity_type` varchar(80) COLLATE utf8mb4_general_ci NOT NULL,
  `vendor_id` int unsigned DEFAULT NULL,
  `document_id` int unsigned DEFAULT NULL,
  `document_table` varchar(80) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `wa_me_link` text COLLATE utf8mb4_general_ci NOT NULL,
  `message_body` text COLLATE utf8mb4_general_ci NOT NULL,
  `assigned_to` int unsigned NOT NULL,
  `project_id` int unsigned DEFAULT NULL,
  `status` enum('pending','sent','expired','cancelled') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `due_at` datetime NOT NULL,
  `sent_at` datetime DEFAULT NULL,
  `marked_sent_by` int unsigned DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancelled_reason` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `triggered_by_signoff_instance` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_assigned_pending` (`assigned_to`,`status`,`due_at`),
  KEY `idx_vendor_activity` (`vendor_id`,`activity_type`,`status`),
  CONSTRAINT `external_comm_assignments_ibfk_1` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `external_comm_assignments_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: external_comm_config
CREATE TABLE IF NOT EXISTS `external_comm_config` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `activity_type` varchar(80) COLLATE utf8mb4_general_ci NOT NULL,
  `workflow_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `responsible_role` varchar(80) COLLATE utf8mb4_general_ci NOT NULL,
  `due_hours` smallint NOT NULL DEFAULT '4',
  `label` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `activity_type` (`activity_type`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: formal_communications
CREATE TABLE IF NOT EXISTS `formal_communications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `document_type` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `document_id` int unsigned NOT NULL,
  `sender_user_id` int unsigned DEFAULT NULL,
  `sender_email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `recipient_kind` enum('vendor','client','external') COLLATE utf8mb4_general_ci NOT NULL,
  `recipient_ref_id` int unsigned DEFAULT NULL,
  `recipient_email` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `sent_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `matrix_event_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  KEY `idx_document` (`document_type`,`document_id`),
  KEY `idx_sender` (`sender_user_id`,`sent_at`),
  KEY `idx_recipient` (`recipient_kind`,`recipient_ref_id`),
  CONSTRAINT `formal_communications_ibfk_1` FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: matrix_outbox
CREATE TABLE IF NOT EXISTS `matrix_outbox` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `room_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `txn_id` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `msg_type` enum('text','poll','image','file') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'text',
  `body` text COLLATE utf8mb4_general_ci NOT NULL,
  `mxc_url` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `recipient_uid` int unsigned DEFAULT NULL,
  `status` enum('pending','sending','sent','failed','dry_run') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `attempts` tinyint unsigned NOT NULL DEFAULT '0',
  `last_error` text COLLATE utf8mb4_general_ci,
  `matrix_event_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_txn` (`txn_id`),
  KEY `idx_status_created` (`status`,`created_at`),
  KEY `idx_recipient` (`recipient_uid`,`created_at`),
  CONSTRAINT `matrix_outbox_ibfk_1` FOREIGN KEY (`recipient_uid`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: matrix_rooms
CREATE TABLE IF NOT EXISTS `matrix_rooms` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned DEFAULT NULL,
  `room_type` enum('site','finance','design','general','internal_principal','internal_finance','system_health') COLLATE utf8mb4_general_ci NOT NULL,
  `room_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `room_alias` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `encrypted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `archived_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_room` (`project_id`,`room_type`),
  KEY `idx_room_id` (`room_id`),
  CONSTRAINT `matrix_rooms_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: notifications_config
CREATE TABLE IF NOT EXISTS `notifications_config` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `digest_type` varchar(50) NOT NULL,
  `send_time` time NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `digest_type` (`digest_type`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: project_closures
CREATE TABLE IF NOT EXISTS `project_closures` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `closure_block_id` int unsigned DEFAULT NULL,
  `finance_step_blocked` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('pending','in_progress','completed','cancelled') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `initiated_by` int unsigned DEFAULT NULL,
  `initiated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  KEY `idx_project` (`project_id`),
  KEY `idx_blocked` (`finance_step_blocked`,`status`),
  KEY `initiated_by` (`initiated_by`),
  CONSTRAINT `project_closures_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_closures_ibfk_2` FOREIGN KEY (`initiated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: project_setup_tracking
CREATE TABLE IF NOT EXISTS `project_setup_tracking` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `checklist_item_id` int unsigned NOT NULL,
  `is_complete` tinyint(1) DEFAULT '0',
  `completed_at` timestamp NULL DEFAULT NULL,
  `completed_by` int unsigned DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_project_item` (`project_id`,`checklist_item_id`),
  KEY `checklist_item_id` (`checklist_item_id`),
  KEY `completed_by` (`completed_by`),
  KEY `idx_project` (`project_id`),
  KEY `idx_incomplete` (`project_id`,`is_complete`),
  CONSTRAINT `project_setup_tracking_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_setup_tracking_ibfk_2` FOREIGN KEY (`checklist_item_id`) REFERENCES `setup_checklist_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_setup_tracking_ibfk_3` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: project_thresholds
CREATE TABLE IF NOT EXISTS `project_thresholds` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned DEFAULT NULL,
  `threshold_type` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `threshold_value` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_threshold` (`project_id`,`threshold_type`),
  CONSTRAINT `project_thresholds_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: security_config
CREATE TABLE IF NOT EXISTS `security_config` (
  `config_key` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `config_value` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: sessions
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int unsigned NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: setup_checklist_items
CREATE TABLE IF NOT EXISTS `setup_checklist_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int unsigned NOT NULL,
  `task_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `task_description` text COLLATE utf8mb4_general_ci,
  `task_category` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `owner_role` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `is_mandatory` tinyint(1) DEFAULT '1',
  `blocks_operations` tinyint(1) DEFAULT '0',
  `validation_type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `validation_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_template` (`template_id`),
  KEY `idx_category` (`task_category`),
  KEY `idx_owner` (`owner_role`),
  CONSTRAINT `setup_checklist_items_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `setup_checklist_templates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `setup_checklist_items_chk_1` CHECK (json_valid(`validation_config`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: setup_checklist_templates
CREATE TABLE IF NOT EXISTS `setup_checklist_templates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `template_name` (`template_name`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `setup_checklist_templates_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: signoff_instances
CREATE TABLE IF NOT EXISTS `signoff_instances` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `workflow_type` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `document_id` int unsigned NOT NULL,
  `project_id` int unsigned DEFAULT NULL,
  `poll_event_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `poll_room_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `current_approver_id` int unsigned DEFAULT NULL,
  `remaining_approvers` json NOT NULL,
  `full_sequence` json NOT NULL,
  `question` text COLLATE utf8mb4_general_ci,
  `options` json DEFAULT NULL,
  `status` enum('pending','in_progress','completed','cancelled','expired') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `closes_at` datetime DEFAULT NULL,
  `result` enum('approved','rejected','no_quorum','timed_out') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `triggered_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_active_lookup` (`workflow_type`,`document_id`,`status`),
  KEY `idx_poll_event` (`poll_event_id`),
  KEY `idx_pending_close` (`status`,`closes_at`),
  KEY `idx_current_approver` (`current_approver_id`,`status`),
  KEY `project_id` (`project_id`),
  KEY `triggered_by_user_id` (`triggered_by_user_id`),
  CONSTRAINT `signoff_instances_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `signoff_instances_ibfk_2` FOREIGN KEY (`current_approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `signoff_instances_ibfk_3` FOREIGN KEY (`triggered_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: signoff_sequence_rules
CREATE TABLE IF NOT EXISTS `signoff_sequence_rules` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `workflow_type` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `priority` int unsigned NOT NULL DEFAULT '50',
  `predicate_name` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `action_name` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `role_token` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_workflow_priority` (`workflow_type`,`active`,`priority`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: signoff_votes
CREATE TABLE IF NOT EXISTS `signoff_votes` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `signoff_instance_id` int unsigned NOT NULL,
  `voter_user_id` int unsigned DEFAULT NULL,
  `voter_mxid` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vote_answer_id` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `vote_event_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `voted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_instance_voter` (`signoff_instance_id`,`voter_user_id`),
  KEY `idx_instance` (`signoff_instance_id`),
  KEY `voter_user_id` (`voter_user_id`),
  CONSTRAINT `signoff_votes_ibfk_1` FOREIGN KEY (`signoff_instance_id`) REFERENCES `signoff_instances` (`id`) ON DELETE CASCADE,
  CONSTRAINT `signoff_votes_ibfk_2` FOREIGN KEY (`voter_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: signoff_workflows
CREATE TABLE IF NOT EXISTS `signoff_workflows` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `workflow_type` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `signoff_type` enum('poll','pwa') COLLATE utf8mb4_general_ci NOT NULL,
  `quorum_required` int unsigned NOT NULL DEFAULT '1',
  `closing_minutes` int unsigned DEFAULT NULL,
  `principal_threshold_pct` decimal(5,2) DEFAULT NULL COMMENT 'NULL = always involve principal. N.NN = skip principal if doc value < N.NN%% of contract_value',
  `sequence` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `escalation_user_id` int unsigned DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `destination_kind` varchar(10) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'project' COMMENT 'personal | project | org ΓÇö where the bot posts',
  `destination_qualifier` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'personal:role-token | project:internal/finance | org:room-name',
  PRIMARY KEY (`id`),
  UNIQUE KEY `workflow_type` (`workflow_type`),
  KEY `idx_active` (`active`),
  KEY `escalation_user_id` (`escalation_user_id`),
  CONSTRAINT `signoff_workflows_ibfk_1` FOREIGN KEY (`escalation_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: vendor_alerts
CREATE TABLE IF NOT EXISTS `vendor_alerts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int unsigned NOT NULL,
  `alert_type` varchar(60) COLLATE utf8mb4_general_ci NOT NULL,
  `payload_json` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `matrix_event_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `matrix_room_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `posted_at` datetime DEFAULT NULL,
  `read_by` int unsigned DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `read_by` (`read_by`),
  KEY `idx_va_unposted` (`matrix_event_id`,`created_at`),
  KEY `idx_va_vendor` (`vendor_id`,`created_at`),
  KEY `idx_va_type` (`alert_type`,`created_at`),
  CONSTRAINT `vendor_alerts_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vendor_alerts_ibfk_2` FOREIGN KEY (`read_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: vendor_bank_change_approvals
CREATE TABLE IF NOT EXISTS `vendor_bank_change_approvals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `row_version` int unsigned NOT NULL DEFAULT '1',
  `vendor_id` int unsigned NOT NULL,
  `status` enum('pending','approved','rejected','cancelled') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `proposed_by` int unsigned NOT NULL,
  `proposed_by_role` varchar(40) COLLATE utf8mb4_general_ci NOT NULL,
  `proposed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `proposal_reason` text COLLATE utf8mb4_general_ci,
  `before_bank_name` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `before_bank_account` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `before_bank_ifsc` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `after_bank_name` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `after_bank_account` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `after_bank_ifsc` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_by_role` varchar(40) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_general_ci,
  `committed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `proposed_by` (`proposed_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_vbc_status` (`status`),
  KEY `idx_vbc_vendor` (`vendor_id`,`status`),
  CONSTRAINT `vendor_bank_change_approvals_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vendor_bank_change_approvals_ibfk_2` FOREIGN KEY (`proposed_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `vendor_bank_change_approvals_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: vendor_contacts
CREATE TABLE IF NOT EXISTS `vendor_contacts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int unsigned NOT NULL,
  `role` enum('owner','site','accounts') COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `whatsapp` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `matrix_user_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `matrix_room_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendor_role` (`vendor_id`,`role`),
  CONSTRAINT `vendor_contacts_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: vendor_onboarding_tokens
CREATE TABLE IF NOT EXISTS `vendor_onboarding_tokens` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int unsigned NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `purpose` enum('bank_confirm','onboard','re_validation') COLLATE utf8mb4_general_ci NOT NULL,
  `status` enum('issued','opened','consumed','expired','revoked') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'issued',
  `issued_by` int unsigned DEFAULT NULL,
  `issued_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `opened_at` datetime DEFAULT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `payload_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `approval_id` int unsigned DEFAULT NULL,
  `open_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_token` (`token`),
  KEY `idx_vendor_status` (`vendor_id`,`status`,`expires_at`),
  KEY `idx_status_expires` (`status`,`expires_at`),
  KEY `issued_by` (`issued_by`),
  KEY `approval_id` (`approval_id`),
  CONSTRAINT `vendor_onboarding_tokens_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vendor_onboarding_tokens_ibfk_2` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vendor_onboarding_tokens_ibfk_3` FOREIGN KEY (`approval_id`) REFERENCES `vendor_bank_change_approvals` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vendor_onboarding_tokens_chk_1` CHECK (json_valid(`payload_json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS=1;


-- Seed: approval_type_config
INSERT INTO `approval_type_config` VALUES (1,'cn_approval','[\"principal\",\"design_principal\"]',1,'project',0,72,'Change Notice approval','PLACEHOLDER: high-value path only.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(2,'schedule_change','[\"principal\",\"design_principal\"]',1,'project',0,72,'Schedule baseline change','PLACEHOLDER: matches current requirePrincipal gate.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(3,'weekly_report','[\"principal\",\"design_principal\"]',1,'project',0,168,'Weekly report sign-off','PLACEHOLDER: principals only.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(4,'vendor_payment','[\"principal\",\"design_principal\",\"pmc_head\"]',1,'project',0,168,'Vendor payment approval','PLACEHOLDER: matches current requirePMC gate.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(5,'vendor_bank_change','[\"principal\",\"design_principal\"]',1,'global',1,72,'Vendor bank change','PLACEHOLDER: principals only.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(6,'claim_invoice','[\"principal\",\"design_principal\"]',1,'project',0,168,'Client claim approval','PLACEHOLDER: final-approve step only.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(7,'budget_cost_head','[\"principal\",\"design_principal\"]',1,'project',0,72,'Budget cost head approval','PLACEHOLDER: principals only.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(8,'handover_closure','[\"principal\",\"design_principal\",\"pmc_head\",\"finance_admin\"]',4,'project',0,NULL,'Project handover closure','PLACEHOLDER: 4-signer quorum design.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(9,'vendor_onboarding','[\"finance_admin\",\"principal\"]',2,'global',0,2880,'Vendor onboarding','Vendor onboarding approval ΓÇö finance then principal.','sheet9_seed_v6.02',1,'2026-06-16 09:38:00','2026-06-16 09:38:00');


-- Seed: signoff_workflows
INSERT INTO `signoff_workflows` VALUES (1,'daily_report','poll',1,120,NULL,'pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(2,'grn_approval','poll',1,120,NULL,'pmc',NULL,0,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(3,'snag_rectified','poll',1,60,NULL,'pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(4,'mom_acknowledgement','poll',1,1440,NULL,'client_rep',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL),(5,'drawing_query_ack','poll',1,1440,NULL,'pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL),(6,'payment_batch','poll',2,NULL,NULL,'finance,naveen',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','finance'),(7,'weekly_report','poll',2,NULL,NULL,'pmc,principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(8,'final_settlement','poll',3,NULL,2.00,'finance,naveen,principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','finance'),(9,'dlp_signoff','poll',3,NULL,NULL,'design_lead,services_head,pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(10,'change_notice','poll',0,NULL,1.00,'site_manager,pmc,design_lead,principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(11,'project_closure','poll',0,NULL,NULL,'site_manager,design_lead,finance,principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(12,'handover_checklist','poll',2,NULL,NULL,'pmc,client_rep',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(13,'cn_design_ratification','poll',1,2880,NULL,'design_lead',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL),(14,'issue_confirm','poll',1,1440,NULL,'pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(15,'urgent_payment_fyi','poll',1,240,NULL,'pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(16,'drawing_approval','poll',1,1440,NULL,'design_lead,services_head',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(17,'vendor_bank_peer_approve','poll',1,NULL,NULL,'finance,principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','org','internal_finance'),(18,'vendor_bank_vendor_confirm','poll',1,4320,NULL,'vendor_rep',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL),(19,'ncr_endorsement','poll',1,2880,NULL,'principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(20,'payment_request_finance_review','poll',1,480,NULL,'finance_admin',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(21,'petty_cash_replenishment','poll',1,480,NULL,'finance_admin',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(22,'submittal_pmc_review','poll',1,1440,NULL,'pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(23,'submittal_design_review','poll',1,1440,NULL,'design_head',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(24,'submittal_services_review','poll',1,1440,NULL,'services_head',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(25,'drawing_approval_design','poll',1,1440,NULL,'design_head',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(26,'drawing_approval_services','poll',1,1440,NULL,'services_head',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(27,'measurement_approval','poll',1,1440,NULL,'services_head',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(28,'grn_vendor_confirm','poll',1,1440,NULL,'vendor_rep',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL),(29,'vendor_boq_acceptance','poll',1,2880,NULL,'vendor_rep',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL),(30,'vendor_onboarding','poll',2,2880,NULL,'finance,principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL);


-- Seed: signoff_sequence_rules
INSERT INTO `signoff_sequence_rules` VALUES (1,'change_notice',10,'always','strip_initiator',NULL,'CN initiator does not approve own document',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(2,'change_notice',20,'is_emergency','skip_role','design_lead','Emergency CN ΓÇö Design ratifies after, not before',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(3,'change_notice',30,'below_threshold','skip_role','principal','Below 1% threshold ΓÇö PMC + Design only',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(4,'change_notice',90,'external_origin','append_role','client_rep','External CN closes with client confirmation',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(5,'project_closure',20,'no_snags','skip_role','design_lead','No snags ever raised ΓÇö Design Lead has nothing to confirm cleared',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(6,'project_closure',30,'settlement_pending','skip_role','finance','Final settlement not complete ΓÇö Finance step deferred and resumed',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(7,'drawing_approval',20,'is_services_stream','skip_role','design_lead','services drawing ΓÇö design lead does not approve',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(8,'drawing_approval',20,'is_design_stream','skip_role','services_head','design drawing ΓÇö services head does not approve',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(9,'vendor_bank_peer_approve',10,'always','strip_initiator',NULL,'V8 separation of duties ΓÇö proposer cannot approve their own bank-change proposal',1,'2026-05-09 07:01:31','2026-05-09 07:01:31');


-- Add missing role_nav entries for flags and ai_settings
INSERT IGNORE INTO role_nav (role, bucket, tab_key, sort_order, is_visible) VALUES
('principal','pending','flags',2,1),
('pmc_head','pending','flags',2,1),
('design_principal','pending','flags',2,1),
('audit','pending','flags',2,1),
('principal','more','ai_settings',99,1),
('design_principal','more','ai_settings',99,1);
