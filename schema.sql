-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: nu_pmc
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `advance_recovery_schedule`
--

DROP TABLE IF EXISTS `advance_recovery_schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `advance_recovery_schedule` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `engagement_id` int unsigned NOT NULL,
  `advance_type` enum('mobilisation','material','other') COLLATE utf8mb4_general_ci NOT NULL,
  `advance_amount` DECIMAL(14,2) NOT NULL,
  `advance_date` date NOT NULL,
  `recovery_pct_per_bill` DECIMAL(5,2) NOT NULL DEFAULT '10.00',
  `total_recovered` DECIMAL(14,2) NOT NULL DEFAULT '0.00',
  `fully_recovered` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `engagement_id` (`engagement_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `advance_recovery_schedule_ibfk_1` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `advance_recovery_schedule_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_feature_toggles`
--

DROP TABLE IF EXISTS `ai_feature_toggles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_feature_toggles` (
  `feature_key` varchar(60) COLLATE utf8mb4_general_ci NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `label` varchar(120) COLLATE utf8mb4_general_ci NOT NULL,
  `description` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`feature_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `approval_signoffs`
--

DROP TABLE IF EXISTS `approval_signoffs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `approval_signoffs` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `approval_type_config`
--

DROP TABLE IF EXISTS `approval_type_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `approval_type_config` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `approvals`
--

DROP TABLE IF EXISTS `approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `approvals` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `archival_log`
--

DROP TABLE IF EXISTS `archival_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `archival_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `archived_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `archived_by` int unsigned NOT NULL,
  `retain_until` date NOT NULL,
  `notes` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `archived_by` (`archived_by`),
  CONSTRAINT `archival_log_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `archival_log_ibfk_2` FOREIGN KEY (`archived_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned DEFAULT NULL,
  `action` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `entity_type` varchar(40) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_id` int unsigned DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `ip_address` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`,`created_at`),
  KEY `idx_audit_action` (`action`,`created_at`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `audit_log_chk_1` CHECK (json_valid(`details`))
) ENGINE=InnoDB AUTO_INCREMENT=234 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `boq_items`
--

DROP TABLE IF EXISTS `boq_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boq_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `boq_version_id` int unsigned NOT NULL,
  `project_id` int unsigned NOT NULL,
  `parent_id` int unsigned DEFAULT NULL,
  `trade` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `item_code` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `item_name` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `display_order` int unsigned NOT NULL DEFAULT '0',
  `is_section` tinyint(1) NOT NULL DEFAULT '0',
  `unit` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `quantity` DECIMAL(12,3) NOT NULL DEFAULT '0.000',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `bank_verified` tinyint(1) NOT NULL DEFAULT '0',
  `bank_verification_sent_at` datetime DEFAULT NULL,
  `vendor_confirmed_at` datetime DEFAULT NULL,
  `payment_eligible` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `boq_version_id` (`boq_version_id`),
  KEY `project_id` (`project_id`),
  KEY `parent_id` (`parent_id`),
  CONSTRAINT `boq_items_ibfk_1` FOREIGN KEY (`boq_version_id`) REFERENCES `boq_versions` (`id`),
  CONSTRAINT `boq_items_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `boq_items_ibfk_3` FOREIGN KEY (`parent_id`) REFERENCES `boq_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `boq_versions`
--

DROP TABLE IF EXISTS `boq_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boq_versions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `stream` enum('design','services') COLLATE utf8mb4_general_ci NOT NULL,
  `version_number` int unsigned NOT NULL DEFAULT '1',
  `label` varchar(10) COLLATE utf8mb4_general_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT '0',
  `uploaded_by` int unsigned NOT NULL,
  `change_notice_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `boq_versions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `boq_versions_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `budget_cost_heads`
--

DROP TABLE IF EXISTS `budget_cost_heads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_cost_heads` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `code` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `stream` enum('design','services','common') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'common',
  `sanctioned` DECIMAL(14,2) NOT NULL DEFAULT '0.00',
  `is_custom` tinyint(1) NOT NULL DEFAULT '0',
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `status` enum('pending','approved') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'approved',
  `display_order` int unsigned NOT NULL DEFAULT '0',
  `created_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_code` (`project_id`,`code`),
  KEY `created_by` (`created_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_budget_cost_heads_proj_status` (`project_id`,`status`),
  CONSTRAINT `budget_cost_heads_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `budget_cost_heads_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `budget_cost_heads_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_bch_sanctioned` CHECK ((`sanctioned` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `budget_flags`
--

DROP TABLE IF EXISTS `budget_flags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_flags` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `cost_head_id` int unsigned NOT NULL,
  `boq_item_id` int unsigned DEFAULT NULL,
  `flag_level` enum('line_item','trade','project') COLLATE utf8mb4_general_ci NOT NULL,
  `pct_over` DECIMAL(6,3) NOT NULL,
  `sanctioned` DECIMAL(14,2) NOT NULL,
  `committed` DECIMAL(14,2) NOT NULL,
  `trigger_stage` enum('engagement','po') COLLATE utf8mb4_general_ci NOT NULL,
  `engagement_id` int unsigned DEFAULT NULL,
  `strike_number` int unsigned NOT NULL DEFAULT '1',
  `signoff_by` int unsigned DEFAULT NULL,
  `signoff_at` datetime DEFAULT NULL,
  `signoff_note` text COLLATE utf8mb4_general_ci,
  `escalated` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `cost_head_id` (`cost_head_id`),
  KEY `boq_item_id` (`boq_item_id`),
  KEY `engagement_id` (`engagement_id`),
  KEY `signoff_by` (`signoff_by`),
  CONSTRAINT `budget_flags_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `budget_flags_ibfk_2` FOREIGN KEY (`cost_head_id`) REFERENCES `budget_cost_heads` (`id`),
  CONSTRAINT `budget_flags_ibfk_3` FOREIGN KEY (`boq_item_id`) REFERENCES `boq_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `budget_flags_ibfk_4` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`) ON DELETE SET NULL,
  CONSTRAINT `budget_flags_ibfk_5` FOREIGN KEY (`signoff_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `budget_threshold_alerts`
--

DROP TABLE IF EXISTS `budget_threshold_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_threshold_alerts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `category_name` varchar(120) NOT NULL,
  `alert_pct` tinyint unsigned NOT NULL,
  `alerted_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_bta_project` (`project_id`,`category_name`)
) ENGINE=InnoDB AUTO_INCREMENT=820 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `change_notice_signatories`
--

DROP TABLE IF EXISTS `change_notice_signatories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `change_notice_signatories` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `change_notice_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `signed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cn_user` (`change_notice_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `change_notice_signatories_ibfk_1` FOREIGN KEY (`change_notice_id`) REFERENCES `change_notices` (`id`),
  CONSTRAINT `change_notice_signatories_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `change_notices`
--

DROP TABLE IF EXISTS `change_notices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `change_notices` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `cn_number` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci NOT NULL,
  `source` enum('client','site','design','statutory') COLLATE utf8mb4_general_ci NOT NULL,
  `affected_drawings` text COLLATE utf8mb4_general_ci,
  `boq_impact` tinyint(1) NOT NULL DEFAULT '0',
  `schedule_impact_days` int NOT NULL DEFAULT '0',
  `raised_by` int unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sig_design_head` tinyint(1) NOT NULL DEFAULT '0',
  `sig_design_head_at` datetime DEFAULT NULL,
  `sig_services_head` tinyint(1) NOT NULL DEFAULT '0',
  `sig_services_head_at` datetime DEFAULT NULL,
  `sig_pmc` int unsigned DEFAULT NULL,
  `sig_pmc_at` datetime DEFAULT NULL,
  `status` enum('collecting_sigs','pending_approval','approved','rejected') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'collecting_sigs',
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rfi_id` int unsigned DEFAULT NULL,
  `rejection_note` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cn_number` (`project_id`,`cn_number`),
  KEY `raised_by` (`raised_by`),
  KEY `sig_pmc` (`sig_pmc`),
  KEY `approved_by` (`approved_by`),
  KEY `rfi_id` (`rfi_id`),
  KEY `idx_cn_status` (`status`),
  KEY `idx_change_notices_proj_status` (`project_id`,`status`),
  CONSTRAINT `change_notices_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `change_notices_ibfk_2` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`),
  CONSTRAINT `change_notices_ibfk_3` FOREIGN KEY (`sig_pmc`) REFERENCES `users` (`id`),
  CONSTRAINT `change_notices_ibfk_4` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `change_notices_ibfk_5` FOREIGN KEY (`rfi_id`) REFERENCES `issues` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_cn_self_ref` CHECK (((`approved_by` is null) or (`approved_by` <> `raised_by`)))
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `claim_items`
--

DROP TABLE IF EXISTS `claim_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `claim_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `claim_id` int unsigned NOT NULL,
  `client_boq_item_id` int unsigned NOT NULL,
  `claimed_qty` DECIMAL(12,3) NOT NULL DEFAULT '0.000',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_claim_item` (`claim_id`,`client_boq_item_id`),
  KEY `client_boq_item_id` (`client_boq_item_id`),
  KEY `idx_claim_items_claim` (`claim_id`),
  CONSTRAINT `claim_items_ibfk_1` FOREIGN KEY (`claim_id`) REFERENCES `client_claims` (`id`),
  CONSTRAINT `claim_items_ibfk_2` FOREIGN KEY (`client_boq_item_id`) REFERENCES `client_boq_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `client_boq_items`
--

DROP TABLE IF EXISTS `client_boq_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_boq_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `boq_version_id` int unsigned NOT NULL,
  `project_id` int unsigned NOT NULL,
  `stream` enum('design','services','civil','all') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'all',
  `trade` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `item_code` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `item_name` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `unit` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `quantity` DECIMAL(12,3) NOT NULL DEFAULT '0.000',
  `client_rate` DECIMAL(12,4) NOT NULL DEFAULT '0.0000',
  `display_order` int unsigned NOT NULL DEFAULT '0',
  `hsn_code` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `boq_version_id` (`boq_version_id`),
  KEY `idx_client_boq_project` (`project_id`,`stream`),
  CONSTRAINT `client_boq_items_ibfk_1` FOREIGN KEY (`boq_version_id`) REFERENCES `client_boq_versions` (`id`),
  CONSTRAINT `client_boq_items_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `client_boq_versions`
--

DROP TABLE IF EXISTS `client_boq_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_boq_versions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `stream` enum('design','services','civil','all') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'all',
  `version_number` int unsigned NOT NULL DEFAULT '1',
  `label` varchar(10) COLLATE utf8mb4_general_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT '0',
  `uploaded_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `client_boq_versions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `client_boq_versions_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `client_claims`
--

DROP TABLE IF EXISTS `client_claims`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_claims` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `ra_bill_number` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `discipline` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `measurement_id` int unsigned DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `pmc_signoff` int unsigned DEFAULT NULL,
  `pmc_signoff_at` datetime DEFAULT NULL,
  `rs_signoff` int unsigned DEFAULT NULL,
  `rs_signoff_at` datetime DEFAULT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `invoice_number` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `invoice_date` date DEFAULT NULL,
  `invoice_sequence` int unsigned DEFAULT NULL,
  `invoiced_by` int unsigned DEFAULT NULL,
  `invoiced_at` datetime DEFAULT NULL,
  `raised_by` int unsigned NOT NULL,
  `status` enum('draft','pending_approval','approved','invoiced') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `invoice_prefix` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `measurement_id` (`measurement_id`),
  KEY `pmc_signoff` (`pmc_signoff`),
  KEY `rs_signoff` (`rs_signoff`),
  KEY `approved_by` (`approved_by`),
  KEY `invoiced_by` (`invoiced_by`),
  KEY `raised_by` (`raised_by`),
  KEY `idx_claims_project_status` (`project_id`,`status`),
  CONSTRAINT `client_claims_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `client_claims_ibfk_2` FOREIGN KEY (`measurement_id`) REFERENCES `measurements` (`id`),
  CONSTRAINT `client_claims_ibfk_3` FOREIGN KEY (`pmc_signoff`) REFERENCES `users` (`id`),
  CONSTRAINT `client_claims_ibfk_4` FOREIGN KEY (`rs_signoff`) REFERENCES `users` (`id`),
  CONSTRAINT `client_claims_ibfk_5` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `client_claims_ibfk_6` FOREIGN KEY (`invoiced_by`) REFERENCES `users` (`id`),
  CONSTRAINT `client_claims_ibfk_7` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `client_comms`
--

DROP TABLE IF EXISTS `client_comms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_comms` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `comm_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `document_type` enum('measurement_certificate','mom','weekly_report','drawing','snag_update','ncr_update','change_notice','invoice','other') COLLATE utf8mb4_general_ci NOT NULL,
  `document_ref` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `document_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sent_by` int unsigned NOT NULL,
  `method` enum('whatsapp','email','hard_copy','courier','in_person_handover') COLLATE utf8mb4_general_ci NOT NULL,
  `notes` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `client_ack_at` datetime DEFAULT NULL,
  `client_response` text COLLATE utf8mb4_general_ci,
  `auto_logged` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `sent_by` (`sent_by`),
  KEY `idx_comms_project` (`project_id`,`comm_date`),
  CONSTRAINT `client_comms_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `client_comms_ibfk_2` FOREIGN KEY (`sent_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `client_errors`
--

DROP TABLE IF EXISTS `client_errors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_errors` (
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
) ENGINE=InnoDB AUTO_INCREMENT=310 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `client_receipts`
--

DROP TABLE IF EXISTS `client_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_receipts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `pi_id` int unsigned NOT NULL,
  `receipt_date` date NOT NULL,
  `amount_received` DECIMAL(14,2) NOT NULL,
  `tds_deducted` DECIMAL(14,2) NOT NULL DEFAULT '0.00',
  `net_received` DECIMAL(14,2) NOT NULL,
  `utr` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bank_ref` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `recorded_by` int unsigned NOT NULL,
  `recorded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `pi_id` (`pi_id`),
  KEY `recorded_by` (`recorded_by`),
  CONSTRAINT `client_receipts_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `client_receipts_ibfk_2` FOREIGN KEY (`pi_id`) REFERENCES `proforma_invoices` (`id`),
  CONSTRAINT `client_receipts_ibfk_3` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `client_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `display_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `gstin` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `pan` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `state_name` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `state_code` tinyint unsigned DEFAULT NULL,
  `contact_person` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `contact_phone` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `contact_whatsapp` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `contact_email` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_general_ci,
  `gst_treatment` enum('regular','unregistered','sez','exempt') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'regular',
  `tally_party_ledger` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tally_income_ledger` varchar(200) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Construction Works Income',
  `invoice_prefix` varchar(30) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'NUALL/26-27/',
  `invoice_sequence` int unsigned NOT NULL DEFAULT '0',
  `payment_terms_days` tinyint unsigned NOT NULL DEFAULT '30',
  `registered_address` text COLLATE utf8mb4_general_ci,
  `is_interstate` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `master_complete` tinyint(1) NOT NULL DEFAULT '1',
  `stub_reason` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `completed_by` int unsigned DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gstin` (`gstin`),
  KEY `idx_master_complete` (`master_complete`,`is_active`),
  KEY `created_by` (`created_by`),
  KEY `completed_by` (`completed_by`),
  CONSTRAINT `clients_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `clients_ibfk_2` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `comms_log`
--

DROP TABLE IF EXISTS `comms_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comms_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `channel` enum('whatsapp','email','sms') COLLATE utf8mb4_general_ci NOT NULL,
  `direction` enum('inbound','outbound') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'outbound',
  `user_id` int unsigned DEFAULT NULL,
  `to_address` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `subject` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `body` text COLLATE utf8mb4_general_ci,
  `message_type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `provider_msg_id` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('queued','sent','delivered','read','failed','bounced','complaint') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'queued',
  `error_code` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sent_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `delivered_at` datetime DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `bounced_at` datetime DEFAULT NULL,
  `project_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_comms_log_proj_status` (`project_id`,`status`),
  CONSTRAINT `comms_log_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `comms_log_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `company_entities`
--

DROP TABLE IF EXISTS `company_entities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_entities` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entity_code` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `legal_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `address_line1` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `address_line2` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Bengaluru',
  `state` varchar(50) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Karnataka',
  `pincode` varchar(10) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '560070',
  `gstin` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `state_code` varchar(5) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '29',
  `email_primary` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `email_finance` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sac_code` varchar(10) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '998311',
  `bank_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `bank_account_no` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `bank_ifsc` varchar(15) COLLATE utf8mb4_general_ci NOT NULL,
  `bank_account_holder` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `bank_branch` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `upi_id` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bank2_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bank2_account_no` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bank2_ifsc` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bank2_account_holder` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bank2_branch` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bank2_upi_id` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `entity_code` (`entity_code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `current_pmc_assignments`
--

DROP TABLE IF EXISTS `current_pmc_assignments`;
/*!50001 DROP VIEW IF EXISTS `current_pmc_assignments`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `current_pmc_assignments` AS SELECT 
 1 AS `project_id`,
 1 AS `project_code`,
 1 AS `primary_pmc_id`,
 1 AS `primary_assignment_id`,
 1 AS `backup_pmc_id`,
 1 AS `backup_assignment_id`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `daily_reports`
--

DROP TABLE IF EXISTS `daily_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_reports` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `report_date` date NOT NULL,
  `site_manager_id` int unsigned NOT NULL,
  `source` enum('whatsapp','manual_upload','app') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'app',
  `raw_file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `overall_notes` text COLLATE utf8mb4_general_ci,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  `ai_flag_reason` text COLLATE utf8mb4_general_ci,
  `ai_flag_acknowledged` tinyint(1) NOT NULL DEFAULT '0',
  `ai_flag_ack_at` datetime DEFAULT NULL,
  `status` enum('pending_review','approved','flagged') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending_review',
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `flag_reason` text COLLATE utf8mb4_general_ci,
  `flagged_by` int unsigned DEFAULT NULL,
  `flagged_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_date_manager` (`project_id`,`report_date`,`site_manager_id`),
  KEY `site_manager_id` (`site_manager_id`),
  KEY `approved_by` (`approved_by`),
  KEY `flagged_by` (`flagged_by`),
  KEY `idx_daily_reports_project` (`project_id`,`report_date`),
  CONSTRAINT `daily_reports_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `daily_reports_ibfk_2` FOREIGN KEY (`site_manager_id`) REFERENCES `users` (`id`),
  CONSTRAINT `daily_reports_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `daily_reports_ibfk_4` FOREIGN KEY (`flagged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `date_sanity_checks`
--

DROP TABLE IF EXISTS `date_sanity_checks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `date_sanity_checks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `check_trigger` enum('entry','schedule_upload','revision') COLLATE utf8mb4_general_ci NOT NULL,
  `dates_checked` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `issues` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `warnings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `verdict` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `checked_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `acknowledged_by` int unsigned DEFAULT NULL,
  `acknowledged_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `acknowledged_by` (`acknowledged_by`),
  CONSTRAINT `date_sanity_checks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `date_sanity_checks_ibfk_2` FOREIGN KEY (`acknowledged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `date_sanity_checks_chk_1` CHECK (json_valid(`dates_checked`)),
  CONSTRAINT `date_sanity_checks_chk_2` CHECK (json_valid(`issues`)),
  CONSTRAINT `date_sanity_checks_chk_3` CHECK (json_valid(`warnings`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `delegations`
--

DROP TABLE IF EXISTS `delegations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delegations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `from_user_id` int unsigned NOT NULL,
  `to_user_id` int unsigned NOT NULL,
  `project_id` int unsigned DEFAULT NULL,
  `scope` enum('full','limited_pmc','photo_tags_only') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'full',
  `start_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `end_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `revoked_at` datetime DEFAULT NULL,
  `revoked_by` int unsigned DEFAULT NULL,
  `reason` text COLLATE utf8mb4_general_ci,
  `created_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `revoked_by` (`revoked_by`),
  KEY `created_by` (`created_by`),
  KEY `idx_delegations_to` (`to_user_id`,`is_active`),
  KEY `idx_delegations_from` (`from_user_id`,`is_active`),
  KEY `idx_delegations_window` (`is_active`,`start_at`,`end_at`),
  CONSTRAINT `delegations_ibfk_1` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `delegations_ibfk_2` FOREIGN KEY (`to_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `delegations_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `delegations_ibfk_4` FOREIGN KEY (`revoked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `delegations_ibfk_5` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `document_attachments`
--

DROP TABLE IF EXISTS `document_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_attachments` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `drawing_ai_checks`
--

DROP TABLE IF EXISTS `drawing_ai_checks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `drawing_ai_checks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `drawing_version_id` int unsigned NOT NULL,
  `check_type` enum('common_sense','detail_context','rfi_relevance','revision_change') COLLATE utf8mb4_general_ci NOT NULL,
  `result_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `ok` tinyint(1) DEFAULT NULL,
  `severity` enum('info','warn','error') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `summary` text COLLATE utf8mb4_general_ci,
  `acknowledged_by` int unsigned DEFAULT NULL,
  `acknowledged_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `acknowledged_by` (`acknowledged_by`),
  KEY `idx_dwg_ai_checks_version` (`drawing_version_id`),
  CONSTRAINT `drawing_ai_checks_ibfk_1` FOREIGN KEY (`drawing_version_id`) REFERENCES `drawing_versions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `drawing_ai_checks_ibfk_2` FOREIGN KEY (`acknowledged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `drawing_ai_checks_chk_1` CHECK (json_valid(`result_json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `drawing_register`
--

DROP TABLE IF EXISTS `drawing_register`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `drawing_register` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `drawing_number` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `drawing_name` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `category` enum('Architectural','Structural','Civil','Interior','Electrical','HVAC','Plumbing','Fire','IT') COLLATE utf8mb4_general_ci NOT NULL,
  `stream` enum('design','services') COLLATE utf8mb4_general_ci NOT NULL,
  `expected_revision` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `status` enum('pending','in_progress','issued') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `uploaded_by` int unsigned NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `signed_off_by` int unsigned DEFAULT NULL,
  `signed_off_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reg_project_drawing` (`project_id`,`drawing_number`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `signed_off_by` (`signed_off_by`),
  KEY `idx_drawing_register_project` (`project_id`,`stream`),
  KEY `idx_drawing_register_status` (`project_id`,`status`),
  CONSTRAINT `drawing_register_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `drawing_register_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `drawing_register_ibfk_3` FOREIGN KEY (`signed_off_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `drawing_versions`
--

DROP TABLE IF EXISTS `drawing_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `drawing_versions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `drawing_id` int unsigned NOT NULL,
  `revision` varchar(10) COLLATE utf8mb4_general_ci NOT NULL,
  `revision_number` int unsigned NOT NULL DEFAULT '0',
  `file_path` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `file_size_kb` int unsigned NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_general_ci,
  `change_notice_id` int unsigned DEFAULT NULL,
  `approval_level` tinyint unsigned NOT NULL DEFAULT '1',
  `status` enum('pending_l1','pending_l2','issued','rejected','superseded') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending_l1',
  `l1_reviewed_by` int unsigned DEFAULT NULL,
  `l1_reviewed_at` datetime DEFAULT NULL,
  `l1_rejection_note` text COLLATE utf8mb4_general_ci,
  `l2_approved_by` int unsigned DEFAULT NULL,
  `l2_approved_at` datetime DEFAULT NULL,
  `l2_rejection_note` text COLLATE utf8mb4_general_ci,
  `issued_at` datetime DEFAULT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT '0',
  `flag_comment` text COLLATE utf8mb4_general_ci,
  `flag_by` int unsigned DEFAULT NULL,
  `flag_at` datetime DEFAULT NULL,
  `is_held` tinyint(1) NOT NULL DEFAULT '0',
  `held_at` datetime DEFAULT NULL,
  `held_by` int unsigned DEFAULT NULL,
  `uploaded_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `l1_reviewed_by` (`l1_reviewed_by`),
  KEY `l2_approved_by` (`l2_approved_by`),
  KEY `flag_by` (`flag_by`),
  KEY `held_by` (`held_by`),
  KEY `idx_drawing_versions_drawing` (`drawing_id`),
  KEY `idx_drawing_versions_status` (`status`),
  CONSTRAINT `drawing_versions_ibfk_1` FOREIGN KEY (`drawing_id`) REFERENCES `drawings` (`id`),
  CONSTRAINT `drawing_versions_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `drawing_versions_ibfk_3` FOREIGN KEY (`l1_reviewed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `drawing_versions_ibfk_4` FOREIGN KEY (`l2_approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `drawing_versions_ibfk_5` FOREIGN KEY (`flag_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `drawing_versions_ibfk_6` FOREIGN KEY (`held_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `drawings`
--

DROP TABLE IF EXISTS `drawings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `drawings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `drawing_number` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `drawing_name` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `category` enum('Architectural','Structural','Civil','Interior','Electrical','HVAC','Plumbing','Fire','IT') COLLATE utf8mb4_general_ci NOT NULL,
  `stream` enum('design','services') COLLATE utf8mb4_general_ci NOT NULL,
  `drawing_type` enum('main','detail','rfi_response') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'main',
  `parent_drawing_id` int unsigned DEFAULT NULL,
  `rfi_issue_id` int unsigned DEFAULT NULL,
  `register_entry_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_drawing` (`project_id`,`drawing_number`),
  KEY `parent_drawing_id` (`parent_drawing_id`),
  KEY `register_entry_id` (`register_entry_id`),
  KEY `idx_drawings_project` (`project_id`),
  KEY `idx_drawings_type` (`project_id`,`drawing_type`),
  CONSTRAINT `drawings_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `drawings_ibfk_2` FOREIGN KEY (`parent_drawing_id`) REFERENCES `drawings` (`id`) ON DELETE SET NULL,
  CONSTRAINT `drawings_ibfk_3` FOREIGN KEY (`register_entry_id`) REFERENCES `drawing_register` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `external_comm_assignments`
--

DROP TABLE IF EXISTS `external_comm_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `external_comm_assignments` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `external_comm_config`
--

DROP TABLE IF EXISTS `external_comm_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `external_comm_config` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `failed_emails`
--

DROP TABLE IF EXISTS `failed_emails`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_emails` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `attempted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `to_address` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `subject` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `body_preview` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `error_message` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `project_id` int unsigned DEFAULT NULL,
  `retry_count` tinyint unsigned NOT NULL DEFAULT '0',
  `next_retry_at` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fe_next_retry` (`next_retry_at`),
  KEY `idx_fe_resolved` (`resolved_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fee_schedule`
--

DROP TABLE IF EXISTS `fee_schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fee_schedule` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `milestone_name` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `gst_pct` DECIMAL(5,2) NOT NULL DEFAULT '18.00',
  `display_order` int unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `fee_schedule_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fee_schedule_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fee_schedule_history`
--

DROP TABLE IF EXISTS `fee_schedule_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fee_schedule_history` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `fee_schedule_id` int unsigned NOT NULL,
  `previous_amount` DECIMAL(14,2) NOT NULL,
  `revised_amount` DECIMAL(14,2) NOT NULL,
  `reason` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `revised_by` int unsigned NOT NULL,
  `revised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fee_schedule_id` (`fee_schedule_id`),
  KEY `revised_by` (`revised_by`),
  CONSTRAINT `fee_schedule_history_ibfk_1` FOREIGN KEY (`fee_schedule_id`) REFERENCES `fee_schedule` (`id`),
  CONSTRAINT `fee_schedule_history_ibfk_2` FOREIGN KEY (`revised_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `form_submissions`
--

DROP TABLE IF EXISTS `form_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `form_submissions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int unsigned NOT NULL,
  `template_version` int unsigned NOT NULL DEFAULT '1',
  `project_id` int unsigned NOT NULL,
  `submitted_by` int unsigned NOT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `responses_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  KEY `template_id` (`template_id`),
  KEY `project_id` (`project_id`),
  KEY `submitted_by` (`submitted_by`),
  CONSTRAINT `form_submissions_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `form_templates` (`id`),
  CONSTRAINT `form_submissions_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `form_submissions_ibfk_3` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`),
  CONSTRAINT `form_submissions_chk_1` CHECK (json_valid(`responses_json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `form_templates`
--

DROP TABLE IF EXISTS `form_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `form_templates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `category` enum('quality','safety','inspection','handover','custom') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'custom',
  `is_standard` tinyint(1) NOT NULL DEFAULT '0',
  `version` int unsigned NOT NULL DEFAULT '1',
  `fields_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `created_by` int unsigned NOT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `status` enum('draft','approved','archived') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `project_id` int unsigned DEFAULT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_form_templates_proj_status` (`project_id`,`status`),
  CONSTRAINT `form_templates_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `form_templates_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `form_templates_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `form_templates_chk_1` CHECK (json_valid(`fields_json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `formal_communications`
--

DROP TABLE IF EXISTS `formal_communications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formal_communications` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `governance_uploads`
--

DROP TABLE IF EXISTS `governance_uploads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `governance_uploads` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `sheet_type` enum('permissions','workflows','notifications','slas','visibility','audit_events','sequences','open_gaps') COLLATE utf8mb4_general_ci NOT NULL,
  `uploaded_by` int unsigned NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `rows_updated` int unsigned NOT NULL DEFAULT '0',
  `rows_added` int unsigned NOT NULL DEFAULT '0',
  `rows_removed` int unsigned NOT NULL DEFAULT '0',
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `governance_uploads_ibfk_1` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `grns`
--

DROP TABLE IF EXISTS `grns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grns` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `grn_number` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `engagement_id` int unsigned NOT NULL,
  `material_request_id` int unsigned DEFAULT NULL,
  `delivery_date` date NOT NULL,
  `description` text COLLATE utf8mb4_general_ci NOT NULL,
  `quantity_received` DECIMAL(12,3) NOT NULL,
  `unit` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `delivery_note_ref` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `invoice_ref` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `delivery_note_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `invoice_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_unplanned` tinyint(1) NOT NULL DEFAULT '0',
  `raised_by` int unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `rejection_reason` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `engagement_id` (`engagement_id`),
  KEY `material_request_id` (`material_request_id`),
  KEY `raised_by` (`raised_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_grns_proj_status` (`project_id`,`status`),
  CONSTRAINT `grns_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `grns_ibfk_2` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `grns_ibfk_3` FOREIGN KEY (`material_request_id`) REFERENCES `material_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `grns_ibfk_4` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`),
  CONSTRAINT `grns_ibfk_5` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_grn_qty` CHECK ((`quantity_received` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `issue_photos`
--

DROP TABLE IF EXISTS `issue_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `issue_photos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `issue_id` int unsigned NOT NULL,
  `project_id` int unsigned NOT NULL,
  `submitted_by` int unsigned NOT NULL,
  `file_path` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `source` enum('whatsapp','app') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'app',
  `caption` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `issue_id` (`issue_id`),
  KEY `project_id` (`project_id`),
  KEY `submitted_by` (`submitted_by`),
  CONSTRAINT `issue_photos_ibfk_1` FOREIGN KEY (`issue_id`) REFERENCES `issues` (`id`),
  CONSTRAINT `issue_photos_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `issue_photos_ibfk_3` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `issues`
--

DROP TABLE IF EXISTS `issues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `issues` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `issue_number` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `issue_type` enum('safety','quality','design','rfi','compliance') COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci NOT NULL,
  `raised_by` int unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_by` int unsigned DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `assigned_to` int unsigned DEFAULT NULL,
  `assigned_by` int unsigned DEFAULT NULL,
  `assigned_vendor_id` int unsigned DEFAULT NULL,
  `drawing_id` int unsigned DEFAULT NULL,
  `location` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('draft','open','in_progress','resolved','closed') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `is_overdue` tinyint(1) NOT NULL DEFAULT '0',
  `severity` enum('minor','major','critical') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `answer` text COLLATE utf8mb4_general_ci,
  `rfi_response` text COLLATE utf8mb4_general_ci,
  `rfi_responded_by` int unsigned DEFAULT NULL,
  `rfi_responded_at` datetime DEFAULT NULL,
  `ncr_number` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vendor_accountability` tinyint(1) NOT NULL DEFAULT '0',
  `vendor_acknowledged` tinyint(1) NOT NULL DEFAULT '0',
  `vendor_ack_at` datetime DEFAULT NULL,
  `vendor_disputed` tinyint(1) NOT NULL DEFAULT '0',
  `rectification_date` date DEFAULT NULL,
  `rectification_note` text COLLATE utf8mb4_general_ci,
  `drawing_version_id` int unsigned DEFAULT NULL,
  `query_stream` enum('design','services') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `response_type` enum('text','photo','both') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'text',
  `photo_deadline` date DEFAULT NULL,
  `assigned_to_site` int unsigned DEFAULT NULL,
  `wa_request_sid` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `resolution_note` text COLLATE utf8mb4_general_ci,
  `resolved_by` int unsigned DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `closed_by` int unsigned DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `amber_sent` tinyint(1) NOT NULL DEFAULT '0',
  `red_sent` tinyint(1) NOT NULL DEFAULT '0',
  `file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_issue_project_number` (`project_id`,`issue_number`),
  KEY `raised_by` (`raised_by`),
  KEY `confirmed_by` (`confirmed_by`),
  KEY `assigned_to` (`assigned_to`),
  KEY `assigned_by` (`assigned_by`),
  KEY `assigned_vendor_id` (`assigned_vendor_id`),
  KEY `drawing_id` (`drawing_id`),
  KEY `rfi_responded_by` (`rfi_responded_by`),
  KEY `assigned_to_site` (`assigned_to_site`),
  KEY `drawing_version_id` (`drawing_version_id`),
  KEY `resolved_by` (`resolved_by`),
  KEY `idx_issues_proj_status` (`project_id`,`status`),
  KEY `fk_issues_closed_by` (`closed_by`),
  KEY `idx_issues_closed_at` (`closed_at`),
  CONSTRAINT `fk_issues_closed_by` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `issues_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `issues_ibfk_10` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_2` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`),
  CONSTRAINT `issues_ibfk_3` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_4` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_4b` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_5` FOREIGN KEY (`assigned_vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_6` FOREIGN KEY (`drawing_id`) REFERENCES `drawings` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_7` FOREIGN KEY (`rfi_responded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_8` FOREIGN KEY (`assigned_to_site`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_9` FOREIGN KEY (`drawing_version_id`) REFERENCES `drawing_versions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `labour_compliance`
--

DROP TABLE IF EXISTS `labour_compliance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `labour_compliance` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int unsigned NOT NULL,
  `engagement_id` int unsigned NOT NULL,
  `pf_number` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `esi_number` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `labour_licence_number` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `labour_licence_expiry` date DEFAULT NULL,
  `alert_sent` tinyint(1) NOT NULL DEFAULT '0',
  `updated_by` int unsigned NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `engagement_id` (`engagement_id`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `labour_compliance_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `labour_compliance_ibfk_2` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `labour_compliance_ibfk_3` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `labour_register`
--

DROP TABLE IF EXISTS `labour_register`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `labour_register` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `engagement_id` int unsigned NOT NULL,
  `register_date` date NOT NULL,
  `trade` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `headcount` int unsigned NOT NULL DEFAULT '0',
  `wages_paid` DECIMAL(10,2) DEFAULT NULL,
  `recorded_by` int unsigned NOT NULL,
  `recorded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `validated_by` int unsigned DEFAULT NULL,
  `validated_at` datetime DEFAULT NULL,
  `validation_notes` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_labour_date` (`project_id`,`engagement_id`,`register_date`,`trade`),
  KEY `validated_by` (`validated_by`),
  KEY `engagement_id` (`engagement_id`),
  KEY `recorded_by` (`recorded_by`),
  CONSTRAINT `labour_register_ibfk_1` FOREIGN KEY (`validated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `labour_register_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `labour_register_ibfk_3` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `labour_register_ibfk_4` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=97 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `material_approvals`
--

DROP TABLE IF EXISTS `material_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_approvals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `trade` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `material_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `brand_spec` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sample_submitted_date` date DEFAULT NULL,
  `submitted_by` int unsigned NOT NULL,
  `approval_status` enum('pending','approved','rejected','revision_required') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `client_response_date` date DEFAULT NULL,
  `client_comments` text COLLATE utf8mb4_general_ci,
  `is_mockup` tinyint(1) NOT NULL DEFAULT '0',
  `file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `submitted_by` (`submitted_by`),
  CONSTRAINT `material_approvals_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `material_approvals_ibfk_2` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `material_requests`
--

DROP TABLE IF EXISTS `material_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_requests` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `boq_item_id` int unsigned NOT NULL,
  `quantity_needed` DECIMAL(12,3) NOT NULL,
  `needed_by_date` date NOT NULL,
  `status` tinyint unsigned NOT NULL DEFAULT '1',
  `notes` text COLLATE utf8mb4_general_ci,
  `raised_by` int unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ordered_by` int unsigned DEFAULT NULL,
  `ordered_at` datetime DEFAULT NULL,
  `dispatched_at` datetime DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `validated_by` int unsigned DEFAULT NULL,
  `validated_at` datetime DEFAULT NULL,
  `is_overdue` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `boq_item_id` (`boq_item_id`),
  KEY `raised_by` (`raised_by`),
  KEY `ordered_by` (`ordered_by`),
  KEY `validated_by` (`validated_by`),
  KEY `idx_material_project_status` (`project_id`,`status`),
  KEY `idx_material_overdue` (`is_overdue`),
  CONSTRAINT `material_requests_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `material_requests_ibfk_2` FOREIGN KEY (`boq_item_id`) REFERENCES `boq_items` (`id`),
  CONSTRAINT `material_requests_ibfk_3` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`),
  CONSTRAINT `material_requests_ibfk_4` FOREIGN KEY (`ordered_by`) REFERENCES `users` (`id`),
  CONSTRAINT `material_requests_ibfk_5` FOREIGN KEY (`validated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matrix_outbox`
--

DROP TABLE IF EXISTS `matrix_outbox`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matrix_outbox` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matrix_rooms`
--

DROP TABLE IF EXISTS `matrix_rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matrix_rooms` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `measurement_items`
--

DROP TABLE IF EXISTS `measurement_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `measurement_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `measurement_id` int unsigned NOT NULL,
  `client_boq_item_id` int unsigned NOT NULL,
  `measured_qty` DECIMAL(12,3) NOT NULL DEFAULT '0.000',
  `quality_note` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_meas_item` (`measurement_id`,`client_boq_item_id`),
  KEY `client_boq_item_id` (`client_boq_item_id`),
  CONSTRAINT `measurement_items_ibfk_1` FOREIGN KEY (`measurement_id`) REFERENCES `measurements` (`id`),
  CONSTRAINT `measurement_items_ibfk_2` FOREIGN KEY (`client_boq_item_id`) REFERENCES `client_boq_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `measurements`
--

DROP TABLE IF EXISTS `measurements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `measurements` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `ra_bill_number` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `discipline` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `measurement_date` date NOT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  `checked_by` int unsigned DEFAULT NULL,
  `checked_at` datetime DEFAULT NULL,
  `rs_notes` text COLLATE utf8mb4_general_ci,
  `client_rep_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `client_rep_designation` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `client_accepted_at` date DEFAULT NULL,
  `deductions_notes` text COLLATE utf8mb4_general_ci,
  `signed_certificate_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('draft','rs_signed','client_accepted') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `recorded_by` int unsigned NOT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `recorded_by` (`recorded_by`),
  KEY `checked_by` (`checked_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_measurements_proj_status` (`project_id`,`status`),
  KEY `idx_measurements_project` (`project_id`,`discipline`),
  CONSTRAINT `measurements_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `measurements_ibfk_2` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `measurements_ibfk_3` FOREIGN KEY (`checked_by`) REFERENCES `users` (`id`),
  CONSTRAINT `measurements_ibfk_4` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `meeting_actions`
--

DROP TABLE IF EXISTS `meeting_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meeting_actions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `meeting_id` int unsigned NOT NULL,
  `action_text` text COLLATE utf8mb4_general_ci NOT NULL,
  `assigned_to` int unsigned DEFAULT NULL,
  `assignee_name` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `countersign_by` int unsigned DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('pending','acknowledged','in_progress','completed','overdue') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `acknowledged_at` datetime DEFAULT NULL,
  `countersigned_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `completion_note` text COLLATE utf8mb4_general_ci,
  `escalated` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `assigned_to` (`assigned_to`),
  KEY `countersign_by` (`countersign_by`),
  KEY `idx_meeting_actions_status` (`meeting_id`,`status`),
  CONSTRAINT `meeting_actions_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `meeting_actions_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`),
  CONSTRAINT `meeting_actions_ibfk_3` FOREIGN KEY (`countersign_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `meeting_photos`
--

DROP TABLE IF EXISTS `meeting_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meeting_photos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `meeting_id` int unsigned NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `file_size_kb` int unsigned NOT NULL DEFAULT '0',
  `caption` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `doc_type` enum('photo','report_draft','report_final','attachment') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'photo',
  `uploaded_by` int unsigned DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `meeting_id` (`meeting_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `meeting_photos_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `meeting_photos_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `meeting_revisions`
--

DROP TABLE IF EXISTS `meeting_revisions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meeting_revisions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `meeting_id` int unsigned NOT NULL,
  `version` int unsigned NOT NULL DEFAULT '1',
  `issued_by` int unsigned NOT NULL,
  `issued_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `window_days` int unsigned NOT NULL DEFAULT '3',
  `lock_deadline` datetime NOT NULL,
  `locked_at` datetime DEFAULT NULL,
  `locked` tinyint(1) NOT NULL DEFAULT '0',
  `revision_reason` text COLLATE utf8mb4_general_ci,
  `file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `meeting_id` (`meeting_id`),
  KEY `issued_by` (`issued_by`),
  CONSTRAINT `meeting_revisions_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `meeting_revisions_ibfk_2` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `meetings`
--

DROP TABLE IF EXISTS `meetings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meetings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `row_version` int unsigned NOT NULL DEFAULT '1',
  `project_id` int unsigned NOT NULL,
  `client_id` int unsigned DEFAULT NULL,
  `meeting_number` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `type` enum('site_visit','internal','client','design_review','principal_visit','statutory','other') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'site_visit',
  `visibility` enum('internal','client_draft','sent_to_client','acknowledged') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'internal',
  `title` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `meeting_date` date NOT NULL,
  `time_in` time DEFAULT NULL,
  `time_out` time DEFAULT NULL,
  `location` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `attendees_internal` text COLLATE utf8mb4_general_ci,
  `attendees_external` text COLLATE utf8mb4_general_ci,
  `agenda` text COLLATE utf8mb4_general_ci,
  `notes` text COLLATE utf8mb4_general_ci,
  `summary` text COLLATE utf8mb4_general_ci,
  `next_meeting_date` date DEFAULT NULL,
  `drafted_by` int unsigned DEFAULT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `issued_at` datetime DEFAULT NULL,
  `client_acked_at` datetime DEFAULT NULL,
  `client_ack_by` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `client_ack_response` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('draft','approved','issued','shared','acknowledged','closed') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `created_by` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_meeting_project_number` (`project_id`,`meeting_number`),
  KEY `client_id` (`client_id`),
  KEY `drafted_by` (`drafted_by`),
  KEY `approved_by` (`approved_by`),
  KEY `created_by` (`created_by`),
  KEY `idx_meetings_proj_status` (`project_id`,`status`),
  KEY `idx_meetings_proj_type` (`project_id`,`type`),
  CONSTRAINT `meetings_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `meetings_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `meetings_ibfk_3` FOREIGN KEY (`drafted_by`) REFERENCES `users` (`id`),
  CONSTRAINT `meetings_ibfk_4` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `meetings_ibfk_5` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `mom_items`
--

DROP TABLE IF EXISTS `mom_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mom_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `weekly_report_id` int unsigned DEFAULT NULL,
  `trade` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_general_ci NOT NULL,
  `responsible` varchar(100) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'NU',
  `remarks` text COLLATE utf8mb4_general_ci,
  `status` enum('open','closed') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'open',
  `resolution_note` text COLLATE utf8mb4_general_ci,
  `carried_from` int unsigned DEFAULT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `weekly_report_id` (`weekly_report_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `mom_items_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `mom_items_ibfk_2` FOREIGN KEY (`weekly_report_id`) REFERENCES `weekly_reports` (`id`) ON DELETE SET NULL,
  CONSTRAINT `mom_items_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notification_triggers`
--

DROP TABLE IF EXISTS `notification_triggers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_triggers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `module` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `event_key` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `event_label` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `recipient_role` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `channel` enum('whatsapp','email','both') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'whatsapp',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `source_ref` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_role` (`event_key`,`recipient_role`),
  KEY `idx_event` (`event_key`),
  KEY `idx_module` (`module`)
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications_config`
--

DROP TABLE IF EXISTS `notifications_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications_config` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `digest_type` varchar(50) NOT NULL,
  `send_time` time NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `digest_type` (`digest_type`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `password_reset_otps`
--

DROP TABLE IF EXISTS `password_reset_otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_otps` (
  `user_id` int unsigned NOT NULL,
  `otp_hash` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `password_reset_otps_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_request_evidence`
--

DROP TABLE IF EXISTS `payment_request_evidence`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_request_evidence` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `payment_request_id` int unsigned NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `file_type` enum('photo','ra_bill','measurement_sheet','other') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'other',
  `uploaded_by` int unsigned NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `payment_request_id` (`payment_request_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `payment_request_evidence_ibfk_1` FOREIGN KEY (`payment_request_id`) REFERENCES `payment_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payment_request_evidence_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_requests`
--

DROP TABLE IF EXISTS `payment_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_requests` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `row_version` int unsigned NOT NULL DEFAULT '1',
  `project_id` int unsigned NOT NULL,
  `vendor_id` int unsigned NOT NULL,
  `engagement_id` int unsigned DEFAULT NULL,
  `requested_by` int unsigned NOT NULL,
  `amount_requested` DECIMAL(14,2) NOT NULL,
  `reason` text COLLATE utf8mb4_general_ci NOT NULL,
  `payment_type` enum('labour','site_material','design_material','mep_material','mobilisation_advance','material_advance','advance','running_account_bill','final_bill','retention_release','other') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'other',
  `status` enum('pending_pmc','pmc_approved','pmc_rejected','pending_principal','principal_approved','principal_rejected','paid') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending_pmc',
  `pmc_reviewed_by` int unsigned DEFAULT NULL,
  `pmc_reviewed_at` datetime DEFAULT NULL,
  `pmc_amount` DECIMAL(14,2) DEFAULT NULL,
  `pmc_notes` text COLLATE utf8mb4_general_ci,
  `principal_reviewed_by` int unsigned DEFAULT NULL,
  `principal_reviewed_at` datetime DEFAULT NULL,
  `principal_notes` text COLLATE utf8mb4_general_ci,
  `actual_paid` DECIMAL(14,2) DEFAULT NULL,
  `payment_date` date DEFAULT NULL,
  `utr_number` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `paid_by` int unsigned DEFAULT NULL,
  `principal_override` tinyint(1) NOT NULL DEFAULT '0',
  `rs_override` tinyint(1) NOT NULL DEFAULT '0',
  `is_urgent` tinyint(1) NOT NULL DEFAULT '0',
  `is_adhoc` tinyint(1) NOT NULL DEFAULT '0',
  `adhoc_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `adhoc_phone` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `adhoc_gstin` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `adhoc_pan` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `adhoc_bank_account` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `adhoc_bank_ifsc` varchar(11) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `adhoc_upi_id` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `adhoc_upi_qr_path` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payment_lane` enum('bank','upi','icici_bulk') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'icici_bulk',
  `invoice_override_reason` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `gst_rate` DECIMAL(5,2) NOT NULL DEFAULT '18.00',
  `hsn_code` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_interstate` tinyint(1) NOT NULL DEFAULT '0',
  `schedule_compliant` tinyint(1) NOT NULL DEFAULT '0',
  `compliance_checked_by` int unsigned DEFAULT NULL,
  `compliance_checked_at` datetime DEFAULT NULL,
  `work_done_pct` DECIMAL(5,2) DEFAULT NULL,
  `raised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `engagement_id` (`engagement_id`),
  KEY `requested_by` (`requested_by`),
  KEY `compliance_checked_by` (`compliance_checked_by`),
  KEY `pmc_reviewed_by` (`pmc_reviewed_by`),
  KEY `principal_reviewed_by` (`principal_reviewed_by`),
  KEY `paid_by` (`paid_by`),
  KEY `idx_payment_requests_proj_status` (`project_id`,`status`),
  CONSTRAINT `payment_requests_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `payment_requests_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `payment_requests_ibfk_3` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payment_requests_ibfk_4` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`),
  CONSTRAINT `payment_requests_ibfk_5` FOREIGN KEY (`compliance_checked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payment_requests_ibfk_6` FOREIGN KEY (`pmc_reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payment_requests_ibfk_7` FOREIGN KEY (`principal_reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payment_requests_ibfk_8` FOREIGN KEY (`paid_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_pr_actual_paid` CHECK (((`actual_paid` is null) or (`actual_paid` >= 0))),
  CONSTRAINT `chk_pr_amount` CHECK ((`amount_requested` > 0)),
  CONSTRAINT `chk_pr_gst` CHECK ((`gst_rate` between 0 and 50)),
  CONSTRAINT `chk_pr_pmc_amount` CHECK (((`pmc_amount` is null) or (`pmc_amount` > 0))),
  CONSTRAINT `chk_pr_work_pct` CHECK (((`work_done_pct` is null) or (`work_done_pct` between 0 and 100)))
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `petty_cash_transactions`
--

DROP TABLE IF EXISTS `petty_cash_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `petty_cash_transactions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `txn_date` date NOT NULL,
  `description` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `txn_type` enum('spend','replenishment') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'spend',
  `category` enum('labour','material','site_expense','other') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'other',
  `bill_available` tinyint(1) NOT NULL DEFAULT '0',
  `file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `recorded_by` int unsigned NOT NULL,
  `recorded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `recorded_by` (`recorded_by`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `petty_cash_transactions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `petty_cash_transactions_ibfk_2` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `petty_cash_transactions_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `photo_tags`
--

DROP TABLE IF EXISTS `photo_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `photo_tags` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `photo_id` int unsigned NOT NULL,
  `task_id` int unsigned DEFAULT NULL,
  `trade` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `caption` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tagged_by` int unsigned DEFAULT NULL,
  `tag_source` enum('ai','site_manager','pmc','design','services','principal') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'ai',
  `is_current` tinyint(1) NOT NULL DEFAULT '1',
  `ai_confidence` enum('low','medium','high') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ai_note` text COLLATE utf8mb4_general_ci,
  `replaces_tag_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `tagged_by` (`tagged_by`),
  KEY `replaces_tag_id` (`replaces_tag_id`),
  KEY `idx_photo_tags_photo` (`photo_id`,`is_current`),
  KEY `idx_photo_tags_source` (`tag_source`),
  CONSTRAINT `photo_tags_ibfk_1` FOREIGN KEY (`photo_id`) REFERENCES `project_photos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `photo_tags_ibfk_2` FOREIGN KEY (`task_id`) REFERENCES `schedule_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `photo_tags_ibfk_3` FOREIGN KEY (`tagged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `photo_tags_ibfk_4` FOREIGN KEY (`replaces_tag_id`) REFERENCES `photo_tags` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_handover_snags`
--

DROP TABLE IF EXISTS `pre_handover_snags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_handover_snags` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `trade` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `location` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_general_ci NOT NULL,
  `severity` enum('critical','major','minor') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'minor',
  `responsible_vendor_id` int unsigned DEFAULT NULL,
  `raised_by` int unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `due_date` date DEFAULT NULL,
  `status` enum('open','in_progress','resolved','accepted_by_client') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'open',
  `resolved_by` int unsigned DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `resolution_note` text COLLATE utf8mb4_general_ci,
  `file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `responsible_vendor_id` (`responsible_vendor_id`),
  KEY `raised_by` (`raised_by`),
  KEY `resolved_by` (`resolved_by`),
  KEY `idx_pre_handover_snags_proj_status` (`project_id`,`status`),
  CONSTRAINT `pre_handover_snags_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `pre_handover_snags_ibfk_2` FOREIGN KEY (`responsible_vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `pre_handover_snags_ibfk_3` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`),
  CONSTRAINT `pre_handover_snags_ibfk_4` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `principal_direct_payments`
--

DROP TABLE IF EXISTS `principal_direct_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `principal_direct_payments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `payment_date` date NOT NULL,
  `payment_type` enum('upi','cash') COLLATE utf8mb4_general_ci NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `paid_to` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `description` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `upi_ref` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `boq_head` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tagged_by` int unsigned DEFAULT NULL,
  `recorded_by` int unsigned NOT NULL,
  `recorded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `recorded_by` (`recorded_by`),
  KEY `tagged_by` (`tagged_by`),
  CONSTRAINT `principal_direct_payments_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `principal_direct_payments_ibfk_2` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `principal_direct_payments_ibfk_3` FOREIGN KEY (`tagged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `proforma_invoices`
--

DROP TABLE IF EXISTS `proforma_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `proforma_invoices` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `pi_number` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `fee_schedule_id` int unsigned NOT NULL,
  `schedule_task_id` int unsigned DEFAULT NULL,
  `amount_ex_gst` DECIMAL(14,2) NOT NULL,
  `gst_pct` DECIMAL(5,2) NOT NULL DEFAULT '18.00',
  `amount_gst` DECIMAL(14,2) NOT NULL,
  `amount_total` DECIMAL(14,2) NOT NULL,
  `status` enum('draft','sent','acknowledged','paid') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `raised_by` int unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` datetime DEFAULT NULL,
  `acknowledged_at` datetime DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pi_number` (`project_id`,`pi_number`),
  KEY `fee_schedule_id` (`fee_schedule_id`),
  KEY `schedule_task_id` (`schedule_task_id`),
  KEY `raised_by` (`raised_by`),
  KEY `idx_proforma_invoices_proj_status` (`project_id`,`status`),
  CONSTRAINT `proforma_invoices_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `proforma_invoices_ibfk_2` FOREIGN KEY (`fee_schedule_id`) REFERENCES `fee_schedule` (`id`),
  CONSTRAINT `proforma_invoices_ibfk_3` FOREIGN KEY (`schedule_task_id`) REFERENCES `schedule_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `proforma_invoices_ibfk_4` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_pi_amount_ex` CHECK ((`amount_ex_gst` > 0)),
  CONSTRAINT `chk_pi_amount_total` CHECK ((`amount_total` >= `amount_ex_gst`)),
  CONSTRAINT `chk_pi_gst` CHECK ((`gst_pct` between 0 and 50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_assignments`
--

DROP TABLE IF EXISTS `project_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_assignments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `role` varchar(30) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'member',
  `assigned_by` int unsigned NOT NULL,
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_user` (`project_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `assigned_by` (`assigned_by`),
  CONSTRAINT `project_assignments_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_assignments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `project_assignments_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_closures`
--

DROP TABLE IF EXISTS `project_closures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_closures` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_documents`
--

DROP TABLE IF EXISTS `project_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_documents` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `doc_date` date DEFAULT NULL,
  `doc_type` enum('appointment_letter','contract','po','challan','invoice','other') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'other',
  `file_path` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `file_name` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_size_kb` int unsigned NOT NULL DEFAULT '0',
  `is_classified` tinyint(1) NOT NULL DEFAULT '0',
  `notes` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `uploaded_by` int unsigned NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `project_documents_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_documents_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_photos`
--

DROP TABLE IF EXISTS `project_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_photos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `task_id` int unsigned DEFAULT NULL,
  `daily_report_id` int unsigned DEFAULT NULL,
  `photo_date` date NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `file_size_kb` int unsigned NOT NULL DEFAULT '0',
  `caption` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `uploaded_by` int unsigned NOT NULL,
  `source` enum('app','whatsapp','site_visit') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'app',
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `locked_at` datetime DEFAULT NULL,
  `locked_by_report_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `daily_report_id` (`daily_report_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_photos_project_date` (`project_id`,`photo_date`),
  KEY `idx_photos_task` (`task_id`),
  CONSTRAINT `project_photos_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_photos_ibfk_2` FOREIGN KEY (`task_id`) REFERENCES `schedule_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_photos_ibfk_3` FOREIGN KEY (`daily_report_id`) REFERENCES `daily_reports` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_photos_ibfk_4` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_pmc_assignments`
--

DROP TABLE IF EXISTS `project_pmc_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_pmc_assignments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `kind` enum('primary','backup') COLLATE utf8mb4_general_ci NOT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `effective_to_key` date GENERATED ALWAYS AS (coalesce(`effective_to`,_utf8mb4'9999-12-31')) STORED,
  `assigned_by` int unsigned NOT NULL,
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `note` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_kind_effective` (`project_id`,`kind`,`effective_to_key`),
  KEY `assigned_by` (`assigned_by`),
  KEY `idx_project_kind_active` (`project_id`,`kind`,`effective_to`),
  KEY `idx_user_active` (`user_id`,`effective_to`),
  CONSTRAINT `project_pmc_assignments_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_pmc_assignments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `project_pmc_assignments_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_scope`
--

DROP TABLE IF EXISTS `project_scope`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_scope` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `scope_type` set('architecture','structure','mep','interior','pmc','other') COLLATE utf8mb4_general_ci NOT NULL,
  `sqft_area` DECIMAL(12,2) DEFAULT NULL,
  `num_floors` int unsigned DEFAULT NULL,
  `num_blocks` int unsigned DEFAULT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `requires_statutory_approvals` tinyint(1) NOT NULL DEFAULT '0',
  `dlp_months` int unsigned NOT NULL DEFAULT '12',
  `planned_handover_date` date DEFAULT NULL,
  `retention_amount` DECIMAL(14,2) DEFAULT NULL,
  `retention_due_date` date DEFAULT NULL,
  `petty_cash_limit` DECIMAL(10,2) DEFAULT NULL,
  `petty_cash_txn_limit` DECIMAL(10,2) DEFAULT NULL,
  `updated_by` int unsigned NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_id` (`project_id`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `project_scope_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_scope_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_setup_tracking`
--

DROP TABLE IF EXISTS `project_setup_tracking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_setup_tracking` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_slas`
--

DROP TABLE IF EXISTS `project_slas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_slas` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `item_type` enum('grn','drawing','rfi','clearance','mom','pr') COLLATE utf8mb4_general_ci NOT NULL,
  `sla_days` int NOT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_item` (`project_id`,`item_type`),
  CONSTRAINT `project_slas_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_thresholds`
--

DROP TABLE IF EXISTS `project_thresholds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_thresholds` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entity_id` int unsigned NOT NULL DEFAULT '2',
  `billing_account` enum('primary','secondary') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'primary',
  `code` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `client` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `client_id` int unsigned DEFAULT NULL,
  `location` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `site_lat` DECIMAL(10,7) DEFAULT NULL,
  `site_lng` DECIMAL(10,7) DEFAULT NULL,
  `project_type` enum('industrial','institutional','residential','commercial','infrastructure','interior') COLLATE utf8mb4_general_ci NOT NULL,
  `r0_start_date` date NOT NULL,
  `r0_end_date` date NOT NULL,
  `jurisdiction` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `contract_value` DECIMAL(14,2) DEFAULT NULL,
  `payment_approval_threshold` DECIMAL(14,2) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `completion_date` date DEFAULT NULL,
  `status` enum('initialising','active','on_hold','completed') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'initialising',
  `checklist_project_created` tinyint(1) NOT NULL DEFAULT '0',
  `checklist_design_register` tinyint(1) NOT NULL DEFAULT '0',
  `checklist_services_register` tinyint(1) NOT NULL DEFAULT '0',
  `checklist_design_boq` tinyint(1) NOT NULL DEFAULT '0',
  `checklist_services_boq` tinyint(1) NOT NULL DEFAULT '0',
  `checklist_schedule` tinyint(1) NOT NULL DEFAULT '0',
  `checklist_site_manager` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `payment_approval_authority` enum('principal_only','pmc_with_limit') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'principal_only',
  `pmc_approval_limit` DECIMAL(10,4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `entity_id` (`entity_id`),
  KEY `client_id` (`client_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`entity_id`) REFERENCES `company_entities` (`id`),
  CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `projects_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_proj_dates` CHECK ((`r0_end_date` >= `r0_start_date`))
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_nav`
--

DROP TABLE IF EXISTS `role_nav`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_nav` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `role` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `bucket` enum('home','work','money','more','pending','strip') COLLATE utf8mb4_general_ci NOT NULL,
  `tab_key` varchar(40) COLLATE utf8mb4_general_ci NOT NULL,
  `sort_order` int NOT NULL,
  `is_visible` tinyint(1) NOT NULL DEFAULT '1',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_tab` (`role`,`tab_key`),
  KEY `idx_role_bucket_sort` (`role`,`bucket`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=212 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_nav_audit`
--

DROP TABLE IF EXISTS `role_nav_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_nav_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `draft_group_id` int unsigned NOT NULL,
  `role` varchar(40) COLLATE utf8mb4_general_ci NOT NULL,
  `action` enum('approved','rejected') COLLATE utf8mb4_general_ci NOT NULL,
  `proposed_by` int unsigned NOT NULL,
  `reviewed_by` int unsigned NOT NULL,
  `reviewed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `snapshot_json` text COLLATE utf8mb4_general_ci NOT NULL,
  `reject_reason` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  KEY `proposed_by` (`proposed_by`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_nav_audit_role` (`role`),
  CONSTRAINT `role_nav_audit_ibfk_1` FOREIGN KEY (`proposed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `role_nav_audit_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_nav_drafts`
--

DROP TABLE IF EXISTS `role_nav_drafts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_nav_drafts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `draft_group_id` int unsigned NOT NULL,
  `role` varchar(40) COLLATE utf8mb4_general_ci NOT NULL,
  `bucket` enum('home','work','money','more','pending','strip') COLLATE utf8mb4_general_ci NOT NULL,
  `tab_key` varchar(40) COLLATE utf8mb4_general_ci NOT NULL,
  `sort_order` tinyint unsigned NOT NULL,
  `is_visible` tinyint(1) NOT NULL DEFAULT '1',
  `proposed_by` int unsigned NOT NULL,
  `proposed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending_principal','approved','rejected') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending_principal',
  `reviewed_by` int unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `reject_reason` text COLLATE utf8mb4_general_ci,
  `note` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  KEY `proposed_by` (`proposed_by`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_nav_draft_group` (`draft_group_id`),
  KEY `idx_nav_draft_status` (`status`),
  KEY `idx_nav_draft_role` (`role`),
  CONSTRAINT `role_nav_drafts_ibfk_1` FOREIGN KEY (`proposed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `role_nav_drafts_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `role` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `action` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `level` enum('W','R','A','') COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `group_name` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `label` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_action` (`role`,`action`),
  KEY `idx_action` (`action`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=94 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schedule_risk_narratives`
--

DROP TABLE IF EXISTS `schedule_risk_narratives`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule_risk_narratives` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `trade` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `week_ending` date NOT NULL,
  `planned_pct` DECIMAL(5,2) NOT NULL,
  `actual_pct` DECIMAL(5,2) NOT NULL,
  `gap_pct` DECIMAL(5,2) NOT NULL,
  `weeks_behind` DECIMAL(4,1) NOT NULL DEFAULT '0.0',
  `forecast_delay` DECIMAL(4,1) NOT NULL DEFAULT '0.0',
  `narrative` text COLLATE utf8mb4_general_ci NOT NULL,
  `escalation_level` enum('amber','red','critical') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'amber',
  `notified_pmc` tinyint(1) NOT NULL DEFAULT '0',
  `notified_principal` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_trade_week` (`project_id`,`trade`,`week_ending`),
  CONSTRAINT `schedule_risk_narratives_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schedule_tasks`
--

DROP TABLE IF EXISTS `schedule_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule_tasks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `schedule_version_id` int unsigned NOT NULL,
  `trade` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `task_name` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `depends_on_task_id` int unsigned DEFAULT NULL,
  `is_milestone` tinyint(1) NOT NULL DEFAULT '0',
  `is_payment_milestone` tinyint(1) NOT NULL DEFAULT '0',
  `milestone_type` enum('schedule','payment','both','none') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'none',
  `milestone_label` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `display_order` int unsigned NOT NULL DEFAULT '0',
  `float_days` int NOT NULL DEFAULT '0',
  `status` enum('not_started','in_progress','completed','on_hold') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'not_started',
  `notified_zero_float_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `planning_note` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  KEY `schedule_version_id` (`schedule_version_id`),
  KEY `depends_on_task_id` (`depends_on_task_id`),
  KEY `idx_schedule_tasks_project` (`project_id`,`schedule_version_id`),
  CONSTRAINT `schedule_tasks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `schedule_tasks_ibfk_2` FOREIGN KEY (`schedule_version_id`) REFERENCES `schedule_versions` (`id`),
  CONSTRAINT `schedule_tasks_ibfk_3` FOREIGN KEY (`depends_on_task_id`) REFERENCES `schedule_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_st_dates` CHECK ((`end_date` >= `start_date`))
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schedule_versions`
--

DROP TABLE IF EXISTS `schedule_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule_versions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `row_version` int unsigned NOT NULL DEFAULT '1',
  `project_id` int unsigned NOT NULL,
  `version_number` int unsigned NOT NULL DEFAULT '0',
  `label` varchar(10) COLLATE utf8mb4_general_ci NOT NULL,
  `end_date` date NOT NULL,
  `drift_days` int NOT NULL DEFAULT '0',
  `status` enum('draft','pending_approval','approved','rejected') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `reason` text COLLATE utf8mb4_general_ci,
  `uploaded_by` int unsigned NOT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_note` text COLLATE utf8mb4_general_ci,
  `is_current` tinyint(1) NOT NULL DEFAULT '0',
  `drift_acknowledged` tinyint(1) NOT NULL DEFAULT '0',
  `drift_acknowledged_by` int unsigned DEFAULT NULL,
  `drift_acknowledged_at` datetime DEFAULT NULL,
  `drift_mitigation` text COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `approved_by` (`approved_by`),
  KEY `drift_acknowledged_by` (`drift_acknowledged_by`),
  KEY `idx_schedule_versions_proj_status` (`project_id`,`status`),
  CONSTRAINT `schedule_versions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `schedule_versions_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `schedule_versions_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `schedule_versions_ibfk_4` FOREIGN KEY (`drift_acknowledged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `security_config`
--

DROP TABLE IF EXISTS `security_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `security_config` (
  `config_key` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `config_value` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int unsigned NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `setup_checklist_items`
--

DROP TABLE IF EXISTS `setup_checklist_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `setup_checklist_items` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `setup_checklist_templates`
--

DROP TABLE IF EXISTS `setup_checklist_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `setup_checklist_templates` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `signoff_instances`
--

DROP TABLE IF EXISTS `signoff_instances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `signoff_instances` (
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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `signoff_sequence_rules`
--

DROP TABLE IF EXISTS `signoff_sequence_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `signoff_sequence_rules` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `signoff_votes`
--

DROP TABLE IF EXISTS `signoff_votes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `signoff_votes` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `signoff_workflows`
--

DROP TABLE IF EXISTS `signoff_workflows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `signoff_workflows` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `workflow_type` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `signoff_type` enum('poll','pwa') COLLATE utf8mb4_general_ci NOT NULL,
  `quorum_required` int unsigned NOT NULL DEFAULT '1',
  `closing_minutes` int unsigned DEFAULT NULL,
  `principal_threshold_pct` DECIMAL(5,2) DEFAULT NULL COMMENT 'NULL = always involve principal. N.NN = skip principal if doc value < N.NN%% of contract_value',
  `sequence` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `escalation_user_id` int unsigned DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `destination_kind` varchar(10) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'project' COMMENT 'personal | project | org — where the bot posts',
  `destination_qualifier` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'personal:role-token | project:internal/finance | org:room-name',
  PRIMARY KEY (`id`),
  UNIQUE KEY `workflow_type` (`workflow_type`),
  KEY `idx_active` (`active`),
  KEY `escalation_user_id` (`escalation_user_id`),
  CONSTRAINT `signoff_workflows_ibfk_1` FOREIGN KEY (`escalation_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_checkins`
--

DROP TABLE IF EXISTS `site_checkins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_checkins` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `project_id` int unsigned NOT NULL,
  `checkin_date` date NOT NULL,
  `checkin_time` time NOT NULL,
  `latitude` DECIMAL(10,7) DEFAULT NULL,
  `longitude` DECIMAL(10,7) DEFAULT NULL,
  `accuracy` DECIMAL(8,2) DEFAULT NULL,
  `address` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_date` (`user_id`,`checkin_date`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `site_checkins_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `site_checkins_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_manager_leave`
--

DROP TABLE IF EXISTS `site_manager_leave`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_manager_leave` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `project_id` int unsigned NOT NULL,
  `leave_from` date NOT NULL,
  `leave_to` date NOT NULL,
  `reason` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `marked_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `project_id` (`project_id`),
  KEY `marked_by` (`marked_by`),
  CONSTRAINT `site_manager_leave_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `site_manager_leave_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `site_manager_leave_ibfk_3` FOREIGN KEY (`marked_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `snags`
--

DROP TABLE IF EXISTS `snags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `snags` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `snag_number` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `location` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `trade` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `raised_by` int unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `raised_from` enum('meeting','ncr','other') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'other',
  `meeting_id` int unsigned DEFAULT NULL,
  `ncr_id` int unsigned DEFAULT NULL,
  `assigned_vendor` int unsigned DEFAULT NULL,
  `target_close_date` date DEFAULT NULL,
  `rectified_by` int unsigned DEFAULT NULL,
  `rectified_at` datetime DEFAULT NULL,
  `verified_by` int unsigned DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `status` enum('open','rectified','closed') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'open',
  `priority` enum('low','medium','high','urgent') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'medium',
  PRIMARY KEY (`id`),
  KEY `raised_by` (`raised_by`),
  KEY `assigned_vendor` (`assigned_vendor`),
  KEY `rectified_by` (`rectified_by`),
  KEY `verified_by` (`verified_by`),
  KEY `meeting_id` (`meeting_id`),
  KEY `ncr_id` (`ncr_id`),
  KEY `idx_snag_project_status` (`project_id`,`status`),
  CONSTRAINT `snags_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `snags_ibfk_2` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`),
  CONSTRAINT `snags_ibfk_3` FOREIGN KEY (`assigned_vendor`) REFERENCES `vendors` (`id`),
  CONSTRAINT `snags_ibfk_4` FOREIGN KEY (`rectified_by`) REFERENCES `users` (`id`),
  CONSTRAINT `snags_ibfk_5` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`),
  CONSTRAINT `snags_ibfk_6` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE SET NULL,
  CONSTRAINT `snags_ibfk_7` FOREIGN KEY (`ncr_id`) REFERENCES `issues` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `submittals`
--

DROP TABLE IF EXISTS `submittals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `submittals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `submittal_number` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `engagement_id` int unsigned NOT NULL,
  `title` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `submittal_type` enum('shop_drawing','material_sample','product_data','test_report','other') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'shop_drawing',
  `submitted_by` int unsigned NOT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reviewed_by` int unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `status` enum('submitted','under_review','approved','approved_with_comments','resubmit_required','rejected') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'submitted',
  `review_comments` text COLLATE utf8mb4_general_ci,
  `resubmit_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `engagement_id` (`engagement_id`),
  KEY `submitted_by` (`submitted_by`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_submittals_proj_status` (`project_id`,`status`),
  CONSTRAINT `submittals_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `submittals_ibfk_2` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `submittals_ibfk_3` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`),
  CONSTRAINT `submittals_ibfk_4` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `task_updates`
--

DROP TABLE IF EXISTS `task_updates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_updates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `task_id` int unsigned NOT NULL,
  `project_id` int unsigned NOT NULL,
  `report_date` date NOT NULL,
  `pct_complete` tinyint unsigned NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_general_ci,
  `is_flagged` tinyint(1) NOT NULL DEFAULT '0',
  `flag_note` text COLLATE utf8mb4_general_ci,
  `updated_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `daily_report_id` int unsigned DEFAULT NULL,
  `flag_resolved` tinyint(1) NOT NULL DEFAULT '0',
  `flag_resolved_by` int unsigned DEFAULT NULL,
  `flag_resolved_at` datetime DEFAULT NULL,
  `flag_resolution_note` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_task_date_user` (`task_id`,`report_date`,`updated_by`),
  KEY `updated_by` (`updated_by`),
  KEY `daily_report_id` (`daily_report_id`),
  KEY `idx_task_updates_task_date` (`task_id`,`report_date`),
  KEY `idx_task_updates_project` (`project_id`),
  CONSTRAINT `task_updates_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `schedule_tasks` (`id`),
  CONSTRAINT `task_updates_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `task_updates_ibfk_3` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `task_updates_ibfk_4` FOREIGN KEY (`daily_report_id`) REFERENCES `daily_reports` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_tu_pct` CHECK ((`pct_complete` between 0 and 100))
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `task_validations`
--

DROP TABLE IF EXISTS `task_validations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_validations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `task_update_id` int unsigned NOT NULL,
  `status` enum('pending','validated','rejected') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `validated_by` int unsigned NOT NULL,
  `rejection_note` text COLLATE utf8mb4_general_ci,
  `validated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_update_id` (`task_update_id`),
  KEY `validated_by` (`validated_by`),
  CONSTRAINT `task_validations_ibfk_1` FOREIGN KEY (`task_update_id`) REFERENCES `task_updates` (`id`),
  CONSTRAINT `task_validations_ibfk_2` FOREIGN KEY (`validated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tds_records`
--

DROP TABLE IF EXISTS `tds_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tds_records` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `pi_id` int unsigned NOT NULL,
  `receipt_id` int unsigned NOT NULL,
  `tds_amount` DECIMAL(14,2) NOT NULL,
  `tds_rate` DECIMAL(5,2) NOT NULL DEFAULT '10.00',
  `tds_section` varchar(20) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '194J',
  `form16a_received` tinyint(1) NOT NULL DEFAULT '0',
  `quarter` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `pi_id` (`pi_id`),
  KEY `receipt_id` (`receipt_id`),
  CONSTRAINT `tds_records_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `tds_records_ibfk_2` FOREIGN KEY (`pi_id`) REFERENCES `proforma_invoices` (`id`),
  CONSTRAINT `tds_records_ibfk_3` FOREIGN KEY (`receipt_id`) REFERENCES `client_receipts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_pending`
--

DROP TABLE IF EXISTS `user_pending`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_pending` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `phone` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `role` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `stream` varchar(20) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'all',
  `initiated_by` int unsigned NOT NULL,
  `initiated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `reviewed_by` int unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `initiated_by` (`initiated_by`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `user_pending_ibfk_1` FOREIGN KEY (`initiated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `user_pending_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `role` enum('principal','design_principal','design_head','services_head','pmc_head','detailing_head','team_lead','jr_architect','jr_engineer','detailing','services_engineer','coordinator','site_manager','senior_site_manager','finance_admin','trainee','audit','it_admin') COLLATE utf8mb4_general_ci NOT NULL,
  `stream` enum('design','services','pmc','site','all') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'all',
  `phone` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `matrix_user_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `matrix_room_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `whatsapp_notifications` tinyint(1) NOT NULL DEFAULT '1',
  `force_password_change` tinyint(1) NOT NULL DEFAULT '1',
  `login_count` int unsigned NOT NULL DEFAULT '0' COMMENT 'Incremented on each successful login. Used to defer forced password change.',
  `temp_password` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reset_by` int unsigned DEFAULT NULL,
  `reset_at` datetime DEFAULT NULL,
  `managed_by` int unsigned DEFAULT NULL,
  `deputy_id` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_users_matrix` (`matrix_user_id`),
  KEY `managed_by` (`managed_by`),
  KEY `deputy_id` (`deputy_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`managed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`deputy_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `validation_retry_queue`
--

DROP TABLE IF EXISTS `validation_retry_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `validation_retry_queue` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `entity_id` int unsigned NOT NULL,
  `validation_type` enum('gstin','tan','pan','ifsc') COLLATE utf8mb4_general_ci NOT NULL,
  `value` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `retry_count` int unsigned NOT NULL DEFAULT '0',
  `status` enum('pending','resolved','failed') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `error` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_entity_type_val` (`entity_id`,`validation_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_acknowledgements`
--

DROP TABLE IF EXISTS `vendor_acknowledgements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_acknowledgements` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int unsigned NOT NULL,
  `engagement_id` int unsigned NOT NULL,
  `ack_type` enum('contract','loi','payment','defect') COLLATE utf8mb4_general_ci NOT NULL,
  `reference_id` int unsigned DEFAULT NULL,
  `message_sent` text COLLATE utf8mb4_general_ci,
  `wa_reply` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `acknowledged` tinyint(1) NOT NULL DEFAULT '0',
  `acknowledged_at` datetime DEFAULT NULL,
  `sent_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `engagement_id` (`engagement_id`),
  CONSTRAINT `vendor_acknowledgements_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `vendor_acknowledgements_ibfk_2` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_alerts`
--

DROP TABLE IF EXISTS `vendor_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_alerts` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_bank_change_approvals`
--

DROP TABLE IF EXISTS `vendor_bank_change_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_bank_change_approvals` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_boq_items`
--

DROP TABLE IF EXISTS `vendor_boq_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_boq_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int unsigned NOT NULL,
  `engagement_id` int unsigned NOT NULL,
  `boq_item_id` int unsigned NOT NULL,
  `our_cost_rate` DECIMAL(12,4) NOT NULL DEFAULT '0.0000',
  `our_cost_total` DECIMAL(14,4) NOT NULL DEFAULT '0.0000',
  `notes` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entered_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendor_item` (`vendor_id`,`boq_item_id`),
  KEY `engagement_id` (`engagement_id`),
  KEY `boq_item_id` (`boq_item_id`),
  KEY `entered_by` (`entered_by`),
  CONSTRAINT `vendor_boq_items_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `vendor_boq_items_ibfk_2` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `vendor_boq_items_ibfk_3` FOREIGN KEY (`boq_item_id`) REFERENCES `boq_items` (`id`),
  CONSTRAINT `vendor_boq_items_ibfk_4` FOREIGN KEY (`entered_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_boq_mapping`
--

DROP TABLE IF EXISTS `vendor_boq_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_boq_mapping` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `engagement_id` int unsigned NOT NULL,
  `boq_item_id` int unsigned NOT NULL,
  `split_pct` DECIMAL(5,2) DEFAULT NULL,
  `notes` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mapped_by` int unsigned NOT NULL,
  `ai_suggested` tinyint(1) NOT NULL DEFAULT '0',
  `ai_confidence` DECIMAL(4,3) DEFAULT NULL,
  `confirmed_by` int unsigned DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_eng_boq` (`engagement_id`,`boq_item_id`),
  KEY `project_id` (`project_id`),
  KEY `boq_item_id` (`boq_item_id`),
  KEY `mapped_by` (`mapped_by`),
  KEY `confirmed_by` (`confirmed_by`),
  CONSTRAINT `vendor_boq_mapping_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `vendor_boq_mapping_ibfk_2` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `vendor_boq_mapping_ibfk_3` FOREIGN KEY (`boq_item_id`) REFERENCES `boq_items` (`id`),
  CONSTRAINT `vendor_boq_mapping_ibfk_4` FOREIGN KEY (`mapped_by`) REFERENCES `users` (`id`),
  CONSTRAINT `vendor_boq_mapping_ibfk_5` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_contacts`
--

DROP TABLE IF EXISTS `vendor_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_contacts` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_contract_history`
--

DROP TABLE IF EXISTS `vendor_contract_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_contract_history` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `engagement_id` int unsigned NOT NULL,
  `previous_value` DECIMAL(14,2) NOT NULL,
  `revised_value` DECIMAL(14,2) NOT NULL,
  `reason` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `change_notice_id` int unsigned DEFAULT NULL,
  `revised_by` int unsigned NOT NULL,
  `revised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `engagement_id` (`engagement_id`),
  KEY `change_notice_id` (`change_notice_id`),
  KEY `revised_by` (`revised_by`),
  CONSTRAINT `vendor_contract_history_ibfk_1` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `vendor_contract_history_ibfk_2` FOREIGN KEY (`change_notice_id`) REFERENCES `change_notices` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vendor_contract_history_ibfk_3` FOREIGN KEY (`revised_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_engagements`
--

DROP TABLE IF EXISTS `vendor_engagements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_engagements` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int unsigned NOT NULL,
  `project_id` int unsigned NOT NULL,
  `scope` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `contract_value` DECIMAL(14,2) DEFAULT NULL,
  `mobilisation_status` enum('not_started','active','partially_complete','complete','off_site') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'not_started',
  `mobilisation_date` date DEFAULT NULL,
  `completion_date` date DEFAULT NULL,
  `engaged_by` int unsigned NOT NULL,
  `approval_status` enum('pending','approved','rejected') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `notes` text COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendor_project` (`vendor_id`,`project_id`),
  KEY `engaged_by` (`engaged_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_vendor_engagements_proj_status` (`project_id`,`approval_status`),
  CONSTRAINT `vendor_engagements_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `vendor_engagements_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `vendor_engagements_ibfk_3` FOREIGN KEY (`engaged_by`) REFERENCES `users` (`id`),
  CONSTRAINT `vendor_engagements_ibfk_4` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_ve_contract` CHECK (((`contract_value` is null) or (`contract_value` >= 0)))
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_onboarding_tokens`
--

DROP TABLE IF EXISTS `vendor_onboarding_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_onboarding_tokens` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_payment_cycles`
--

DROP TABLE IF EXISTS `vendor_payment_cycles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_payment_cycles` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `cycle_date` date NOT NULL,
  `cycle_type` enum('weekly','on_demand') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'weekly',
  `status` enum('draft','icici_generated','icici_uploaded','confirmed','whatsapp_sent') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `generated_by` int unsigned NOT NULL,
  `confirmed_by` int unsigned DEFAULT NULL,
  `icici_file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `confirm_file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `generated_by` (`generated_by`),
  KEY `confirmed_by` (`confirmed_by`),
  KEY `idx_vendor_payment_cycles_proj_status` (`project_id`,`status`),
  CONSTRAINT `vendor_payment_cycles_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `vendor_payment_cycles_ibfk_2` FOREIGN KEY (`generated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `vendor_payment_cycles_ibfk_3` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_payment_exceptions`
--

DROP TABLE IF EXISTS `vendor_payment_exceptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_payment_exceptions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `engagement_id` int unsigned NOT NULL,
  `payment_id` int unsigned DEFAULT NULL,
  `exception_count` int unsigned NOT NULL DEFAULT '1',
  `reason` text COLLATE utf8mb4_general_ci NOT NULL,
  `approved_by` int unsigned NOT NULL,
  `approved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `engagement_id` (`engagement_id`),
  KEY `payment_id` (`payment_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `vendor_payment_exceptions_ibfk_1` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `vendor_payment_exceptions_ibfk_2` FOREIGN KEY (`payment_id`) REFERENCES `vendor_payments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vendor_payment_exceptions_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendor_payments`
--

DROP TABLE IF EXISTS `vendor_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_payments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `vendor_id` int unsigned NOT NULL,
  `engagement_id` int unsigned NOT NULL,
  `payment_type` enum('running_account_bill','advance','mobilisation_advance','material_advance','final_bill','retention_release','extra_item','deduction') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'running_account_bill',
  `amount_requested` DECIMAL(14,2) NOT NULL,
  `work_done_pct` DECIMAL(5,2) DEFAULT NULL,
  `amount_auto_calc` tinyint(1) NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_general_ci,
  `raised_by` int unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `week_ending` date NOT NULL,
  `status` enum('pending','approved','processed','paid') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `processed_at` datetime DEFAULT NULL,
  `ai_flag` tinyint(1) NOT NULL DEFAULT '0',
  `ai_flag_note` text COLLATE utf8mb4_general_ci,
  `recommended_amount` DECIMAL(14,2) DEFAULT NULL,
  `actual_amount` DECIMAL(14,2) DEFAULT NULL,
  `utr_number` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payment_date` date DEFAULT NULL,
  `adjustment_reason` text COLLATE utf8mb4_general_ci,
  `icici_ref` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payment_cycle_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `engagement_id` (`engagement_id`),
  KEY `raised_by` (`raised_by`),
  KEY `approved_by` (`approved_by`),
  KEY `payment_cycle_id` (`payment_cycle_id`),
  KEY `idx_vendor_payments_proj_status` (`project_id`,`status`),
  CONSTRAINT `vendor_payments_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `vendor_payments_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `vendor_payments_ibfk_3` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `vendor_payments_ibfk_4` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`),
  CONSTRAINT `vendor_payments_ibfk_5` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `vendor_payments_ibfk_6` FOREIGN KEY (`payment_cycle_id`) REFERENCES `vendor_payment_cycles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_vp_amount` CHECK (((`actual_amount` is null) or (`actual_amount` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `trade` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `vendor_name` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `contact_person` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `gst_number` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bank_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bank_account` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bank_ifsc` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `registered_by` int unsigned NOT NULL,
  `pan_number` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `pan_validated` tinyint(1) NOT NULL DEFAULT '0',
  `pan_validated_by` int unsigned DEFAULT NULL,
  `pan_validated_at` datetime DEFAULT NULL,
  `gstin_validated` tinyint(1) NOT NULL DEFAULT '0',
  `gstin_validated_at` datetime DEFAULT NULL,
  `clearance_status` enum('pending','cleared','rejected') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `cleared_by` int unsigned DEFAULT NULL,
  `cleared_at` datetime DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_general_ci,
  `ai_flags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `notes` text COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `bank_validated_by_vendor` tinyint(1) NOT NULL DEFAULT '0',
  `bank_validated_at` datetime DEFAULT NULL,
  `bank_validation_method` enum('matrix','wa_form','manual_attestation') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `matrix_user_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `matrix_room_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `matrix_status` enum('not_invited','invited_pending','joined','declined') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'not_invited',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendors_gst_number` (`gst_number`),
  KEY `registered_by` (`registered_by`),
  KEY `cleared_by` (`cleared_by`),
  KEY `pan_validated_by` (`pan_validated_by`),
  KEY `idx_vendors_matrix_status` (`matrix_status`),
  KEY `idx_vendors_bank_validated` (`bank_validated_by_vendor`),
  CONSTRAINT `vendors_ibfk_1` FOREIGN KEY (`registered_by`) REFERENCES `users` (`id`),
  CONSTRAINT `vendors_ibfk_2` FOREIGN KEY (`cleared_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vendors_ibfk_3` FOREIGN KEY (`pan_validated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vendors_chk_1` CHECK (json_valid(`ai_flags`))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wa_pending_actions`
--

DROP TABLE IF EXISTS `wa_pending_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wa_pending_actions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned DEFAULT NULL,
  `request_type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `title` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `details` text COLLATE utf8mb4_general_ci,
  `drift_days` int DEFAULT NULL,
  `rejection_note` text COLLATE utf8mb4_general_ci,
  `raised_by` int unsigned DEFAULT NULL,
  `raised_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actioned_by` int unsigned DEFAULT NULL,
  `actioned_at` datetime DEFAULT NULL,
  `action_type` enum('anomaly_ack','grn_approve','report_update','issue_confirm','vendor_defect_ack','urgent_payment_fyi','mom_client_ack','udupa_excel_request','drawing_query','drawing_approval','rfi_photo_reply','schedule_change','cn_approval') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ref_id` int unsigned DEFAULT NULL,
  `ref_table` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `message_sent` text COLLATE utf8mb4_general_ci,
  `sent_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reply_received` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `replied_at` datetime DEFAULT NULL,
  `channel` enum('whatsapp','app','both') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'whatsapp',
  `budget_flag_id` int unsigned DEFAULT NULL,
  `rfi_id` int unsigned DEFAULT NULL,
  `status` enum('pending','acted','approved','rejected','expired','cancelled') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `expires_at` datetime DEFAULT NULL,
  `auto_accept_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `raised_by` (`raised_by`),
  KEY `actioned_by` (`actioned_by`),
  KEY `user_id` (`user_id`),
  KEY `idx_wa_pending_actions_proj_status` (`project_id`,`status`),
  CONSTRAINT `wa_pending_actions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `wa_pending_actions_ibfk_2` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `wa_pending_actions_ibfk_3` FOREIGN KEY (`actioned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `wa_pending_actions_ibfk_4` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wa_send_failures`
--

DROP TABLE IF EXISTS `wa_send_failures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wa_send_failures` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `attempted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `to_phone` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `message_type` varchar(80) COLLATE utf8mb4_general_ci NOT NULL,
  `message_body` text COLLATE utf8mb4_general_ci,
  `error_message` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `project_id` int unsigned DEFAULT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `retry_count` tinyint unsigned NOT NULL DEFAULT '0',
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wf_phone` (`to_phone`),
  KEY `idx_wf_attempted` (`attempted_at`),
  KEY `idx_wf_resolved` (`resolved_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `weekly_report_documents`
--

DROP TABLE IF EXISTS `weekly_report_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `weekly_report_documents` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `week_ending` date NOT NULL,
  `version` int unsigned NOT NULL DEFAULT '1',
  `doc_type` enum('draft','final') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `file_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `generated_by` int unsigned DEFAULT NULL,
  `generated_at` datetime DEFAULT NULL,
  `uploaded_by` int unsigned DEFAULT NULL,
  `uploaded_at` datetime DEFAULT NULL,
  `notes` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `generated_by` (`generated_by`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `weekly_report_documents_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `weekly_report_documents_ibfk_2` FOREIGN KEY (`generated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `weekly_report_documents_ibfk_3` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `weekly_report_photos`
--

DROP TABLE IF EXISTS `weekly_report_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `weekly_report_photos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `weekly_report_id` int unsigned NOT NULL,
  `photo_id` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `weekly_report_id` (`weekly_report_id`),
  KEY `photo_id` (`photo_id`),
  CONSTRAINT `weekly_report_photos_ibfk_1` FOREIGN KEY (`weekly_report_id`) REFERENCES `weekly_reports` (`id`),
  CONSTRAINT `weekly_report_photos_ibfk_2` FOREIGN KEY (`photo_id`) REFERENCES `project_photos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `weekly_reports`
--

DROP TABLE IF EXISTS `weekly_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `weekly_reports` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `week_ending` date NOT NULL,
  `week_number` int unsigned NOT NULL,
  `summary` text COLLATE utf8mb4_general_ci,
  `issues_for_client` text COLLATE utf8mb4_general_ci,
  `status` enum('draft','pending_approval','approved','sent') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `drafted_by` int unsigned NOT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `sent_by` int unsigned DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `ai_drag_detected` tinyint(1) NOT NULL DEFAULT '0',
  `ai_drag_summary` text COLLATE utf8mb4_general_ci,
  `drag_acknowledged` tinyint(1) NOT NULL DEFAULT '0',
  `drag_ack_by` int unsigned DEFAULT NULL,
  `drag_ack_at` datetime DEFAULT NULL,
  `mitigation_note` text COLLATE utf8mb4_general_ci,
  `sig_pmc_by` int unsigned DEFAULT NULL,
  `sig_pmc_at` datetime DEFAULT NULL,
  `sig_design_by` int unsigned DEFAULT NULL,
  `sig_design_at` datetime DEFAULT NULL,
  `sig_services_by` int unsigned DEFAULT NULL,
  `sig_services_at` datetime DEFAULT NULL,
  `pmc_section` mediumtext COLLATE utf8mb4_general_ci,
  `design_section` mediumtext COLLATE utf8mb4_general_ci,
  `services_section` mediumtext COLLATE utf8mb4_general_ci,
  `pdf_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_week` (`project_id`,`week_ending`),
  KEY `drafted_by` (`drafted_by`),
  KEY `approved_by` (`approved_by`),
  KEY `sent_by` (`sent_by`),
  KEY `drag_ack_by` (`drag_ack_by`),
  KEY `sig_pmc_by` (`sig_pmc_by`),
  KEY `sig_design_by` (`sig_design_by`),
  KEY `sig_services_by` (`sig_services_by`),
  KEY `idx_weekly_reports_proj_status` (`project_id`,`status`),
  CONSTRAINT `weekly_reports_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `weekly_reports_ibfk_2` FOREIGN KEY (`drafted_by`) REFERENCES `users` (`id`),
  CONSTRAINT `weekly_reports_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `weekly_reports_ibfk_4` FOREIGN KEY (`sent_by`) REFERENCES `users` (`id`),
  CONSTRAINT `weekly_reports_ibfk_5` FOREIGN KEY (`drag_ack_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `weekly_reports_ibfk_6` FOREIGN KEY (`sig_pmc_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `weekly_reports_ibfk_7` FOREIGN KEY (`sig_design_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `weekly_reports_ibfk_8` FOREIGN KEY (`sig_services_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `whatsapp_notifications`
--

DROP TABLE IF EXISTS `whatsapp_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `whatsapp_notifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `phone` varchar(15) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `message_type` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `message_body` text COLLATE utf8mb4_general_ci NOT NULL,
  `status` enum('pending','sent','failed','queued') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'queued',
  `sent_at` datetime DEFAULT NULL,
  `pdf_path` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `whatsapp_notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workflow_transitions`
--

DROP TABLE IF EXISTS `workflow_transitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_transitions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `object_type` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `from_state` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `to_state` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `roles_who` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `label` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `is_exception` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int unsigned NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transition` (`object_type`,`from_state`,`to_state`),
  KEY `idx_object` (`object_type`),
  KEY `idx_from` (`object_type`,`from_state`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping events for database 'nu_pmc'
--

--
-- Dumping routines for database 'nu_pmc'
--

--
-- Final view structure for view `current_pmc_assignments`
--

/*!50001 DROP VIEW IF EXISTS `current_pmc_assignments`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 SQL SECURITY INVOKER */
/*!50001 VIEW `current_pmc_assignments` AS select `p`.`id` AS `project_id`,`p`.`code` AS `project_code`,max((case when (`a`.`kind` = 'primary') then `a`.`user_id` end)) AS `primary_pmc_id`,max((case when (`a`.`kind` = 'primary') then `a`.`id` end)) AS `primary_assignment_id`,max((case when (`a`.`kind` = 'backup') then `a`.`user_id` end)) AS `backup_pmc_id`,max((case when (`a`.`kind` = 'backup') then `a`.`id` end)) AS `backup_assignment_id` from (`projects` `p` left join `project_pmc_assignments` `a` on(((`a`.`project_id` = `p`.`id`) and (`a`.`effective_to` is null)))) group by `p`.`id`,`p`.`code` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-27  1:30:37
