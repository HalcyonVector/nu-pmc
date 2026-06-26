-- ============================================================================
-- ⛔  DO NOT RUN THIS FILE AGAINST ANY POPULATED DATABASE.  ⛔
-- ----------------------------------------------------------------------------
-- This is a STALE point-in-time snapshot kept ONLY as a fixture for
-- tests/v6_02-audit-decisions.test.js. It contains DROP/CREATE statements that
-- will WIPE business tables. It is NOT the install path.
--
-- To install a fresh nu PMC database, use:  bash setup.sh
--   (loads schema.sql → seed-config.sql → governance sheets via the loader)
-- See README / setup.sh for the canonical procedure.
-- ============================================================================

-- ============================================================
-- nu PMC — Complete Database Install
-- Version: v5.41 (consolidated)
-- Date: 2 May 2026
-- 
-- Run this single file on a fresh database.
-- Creates all tables, seed data, and applies all migrations
-- through v5.41 in the correct order.
-- 
-- Usage:
--   mysql -u nu_app -p nu_pmc < nu-pmc-install-20260502.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- ── BASE SCHEMA (v5.21) ─────────────────────────────────────
/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.14-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: install_build
-- ------------------------------------------------------
-- Server version	10.11.14-MariaDB-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
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
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `advance_recovery_schedule` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `engagement_id` int(10) unsigned NOT NULL,
  `advance_type` enum('mobilisation','material','other') NOT NULL,
  `advance_amount` decimal(14,2) NOT NULL,
  `advance_date` date NOT NULL,
  `recovery_pct_per_bill` decimal(5,2) NOT NULL DEFAULT 10.00,
  `total_recovered` decimal(14,2) NOT NULL DEFAULT 0.00,
  `fully_recovered` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `engagement_id` (`engagement_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `advance_recovery_schedule_ibfk_1` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `advance_recovery_schedule_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `advance_recovery_schedule`
--

LOCK TABLES `advance_recovery_schedule` WRITE;
/*!40000 ALTER TABLE `advance_recovery_schedule` DISABLE KEYS */;
/*!40000 ALTER TABLE `advance_recovery_schedule` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `approval_document_links`
--

DROP TABLE IF EXISTS `approval_document_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `approval_document_links` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` enum('vendor_engagement','payment_request','drawing_version','change_notice','grn','meeting','other') NOT NULL,
  `entity_id` int(10) unsigned NOT NULL,
  `document_version_id` int(10) unsigned NOT NULL,
  `linked_by` int(10) unsigned NOT NULL,
  `linked_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_entity` (`entity_type`,`entity_id`),
  KEY `idx_docv` (`document_version_id`),
  KEY `linked_by` (`linked_by`),
  CONSTRAINT `approval_document_links_ibfk_1` FOREIGN KEY (`document_version_id`) REFERENCES `project_document_versions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `approval_document_links_ibfk_2` FOREIGN KEY (`linked_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `approval_document_links`
--

LOCK TABLES `approval_document_links` WRITE;
/*!40000 ALTER TABLE `approval_document_links` DISABLE KEYS */;
/*!40000 ALTER TABLE `approval_document_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `archival_log`
--

DROP TABLE IF EXISTS `archival_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `archival_log` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `archived_at` datetime NOT NULL DEFAULT current_timestamp(),
  `archived_by` int(10) unsigned NOT NULL,
  `retain_until` date NOT NULL,
  `notes` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `archived_by` (`archived_by`),
  CONSTRAINT `archival_log_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `archival_log_ibfk_2` FOREIGN KEY (`archived_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `archival_log`
--

LOCK TABLES `archival_log` WRITE;
/*!40000 ALTER TABLE `archival_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `archival_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `entity_type` varchar(40) DEFAULT NULL,
  `entity_id` int(10) unsigned DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`,`created_at`),
  KEY `idx_audit_action` (`action`,`created_at`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `boq_items`
--

DROP TABLE IF EXISTS `boq_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `boq_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `boq_version_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `parent_id` int(10) unsigned DEFAULT NULL,
  `trade` varchar(50) NOT NULL,
  `item_code` varchar(50) DEFAULT NULL,
  `item_name` varchar(300) NOT NULL,
  `display_order` int(10) unsigned NOT NULL DEFAULT 0,
  `is_section` tinyint(1) NOT NULL DEFAULT 0,
  `unit` varchar(30) NOT NULL,
  `quantity` decimal(12,3) NOT NULL DEFAULT 0.000,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `bank_verified` tinyint(1) NOT NULL DEFAULT 0,
  `bank_verification_sent_at` datetime DEFAULT NULL,
  `vendor_confirmed_at` datetime DEFAULT NULL,
  `payment_eligible` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `boq_version_id` (`boq_version_id`),
  KEY `project_id` (`project_id`),
  KEY `parent_id` (`parent_id`),
  CONSTRAINT `boq_items_ibfk_1` FOREIGN KEY (`boq_version_id`) REFERENCES `boq_versions` (`id`),
  CONSTRAINT `boq_items_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `boq_items_ibfk_3` FOREIGN KEY (`parent_id`) REFERENCES `boq_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `boq_items`
--

LOCK TABLES `boq_items` WRITE;
/*!40000 ALTER TABLE `boq_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `boq_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `boq_versions`
--

DROP TABLE IF EXISTS `boq_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `boq_versions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `stream` enum('design','services') NOT NULL,
  `version_number` int(10) unsigned NOT NULL DEFAULT 1,
  `label` varchar(10) NOT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 0,
  `uploaded_by` int(10) unsigned NOT NULL,
  `change_notice_id` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_boq_version` (`project_id`,`stream`,`version_number`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `boq_versions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `boq_versions_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `boq_versions`
--

LOCK TABLES `boq_versions` WRITE;
/*!40000 ALTER TABLE `boq_versions` DISABLE KEYS */;
/*!40000 ALTER TABLE `boq_versions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `budget_cost_heads`
--

DROP TABLE IF EXISTS `budget_cost_heads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_cost_heads` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `code` varchar(30) NOT NULL,
  `name` varchar(100) NOT NULL,
  `stream` enum('design','services','common') NOT NULL DEFAULT 'common',
  `sanctioned` decimal(14,2) NOT NULL DEFAULT 0.00,
  `is_custom` tinyint(1) NOT NULL DEFAULT 0,
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `status` enum('pending','approved') NOT NULL DEFAULT 'approved',
  `display_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_by` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_code` (`project_id`,`code`),
  KEY `created_by` (`created_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_budget_cost_heads_proj_status` (`project_id`,`status`),
  CONSTRAINT `budget_cost_heads_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `budget_cost_heads_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `budget_cost_heads_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_bch_sanctioned` CHECK (`sanctioned` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_cost_heads`
--

LOCK TABLES `budget_cost_heads` WRITE;
/*!40000 ALTER TABLE `budget_cost_heads` DISABLE KEYS */;
/*!40000 ALTER TABLE `budget_cost_heads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `budget_flags`
--

DROP TABLE IF EXISTS `budget_flags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_flags` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `cost_head_id` int(10) unsigned NOT NULL,
  `boq_item_id` int(10) unsigned DEFAULT NULL,
  `flag_level` enum('line_item','trade','project') NOT NULL,
  `pct_over` decimal(6,3) NOT NULL,
  `sanctioned` decimal(14,2) NOT NULL,
  `committed` decimal(14,2) NOT NULL,
  `trigger_stage` enum('engagement','po') NOT NULL,
  `engagement_id` int(10) unsigned DEFAULT NULL,
  `strike_number` int(10) unsigned NOT NULL DEFAULT 1,
  `signoff_by` int(10) unsigned DEFAULT NULL,
  `signoff_at` datetime DEFAULT NULL,
  `signoff_note` text DEFAULT NULL,
  `escalated` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
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
-- Dumping data for table `budget_flags`
--

LOCK TABLES `budget_flags` WRITE;
/*!40000 ALTER TABLE `budget_flags` DISABLE KEYS */;
/*!40000 ALTER TABLE `budget_flags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `change_notice_signatories`
--

DROP TABLE IF EXISTS `change_notice_signatories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `change_notice_signatories` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `change_notice_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `signed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cn_user` (`change_notice_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `change_notice_signatories_ibfk_1` FOREIGN KEY (`change_notice_id`) REFERENCES `change_notices` (`id`),
  CONSTRAINT `change_notice_signatories_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `change_notice_signatories`
--

LOCK TABLES `change_notice_signatories` WRITE;
/*!40000 ALTER TABLE `change_notice_signatories` DISABLE KEYS */;
/*!40000 ALTER TABLE `change_notice_signatories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `change_notices`
--

DROP TABLE IF EXISTS `change_notices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `change_notices` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `cn_number` varchar(20) NOT NULL,
  `title` varchar(300) NOT NULL,
  `description` text NOT NULL,
  `source` enum('client','site','design','statutory') NOT NULL,
  `affected_drawings` text DEFAULT NULL,
  `boq_impact` tinyint(1) NOT NULL DEFAULT 0,
  `schedule_impact_days` int(11) NOT NULL DEFAULT 0,
  `cost_impact` decimal(14,2) NOT NULL DEFAULT 0.00,
  `stream` enum('design','services','both') NOT NULL DEFAULT 'both',
  `raised_by` int(10) unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT current_timestamp(),
  `sig_design_head` tinyint(1) NOT NULL DEFAULT 0,
  `sig_design_head_at` datetime DEFAULT NULL,
  `sig_services_head` tinyint(1) NOT NULL DEFAULT 0,
  `sig_services_head_at` datetime DEFAULT NULL,
  `sig_pmc` int(10) unsigned DEFAULT NULL,
  `sig_pmc_at` datetime DEFAULT NULL,
  `status` enum('collecting_sigs','pending_approval','approved','rejected') NOT NULL DEFAULT 'collecting_sigs',
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rfi_id` int(10) unsigned DEFAULT NULL,
  `rejection_note` text DEFAULT NULL,
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
  CONSTRAINT `chk_cn_self_ref` CHECK (`approved_by` is null or `approved_by` <> `raised_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `change_notices`
--

LOCK TABLES `change_notices` WRITE;
/*!40000 ALTER TABLE `change_notices` DISABLE KEYS */;
/*!40000 ALTER TABLE `change_notices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `claim_items`
--

DROP TABLE IF EXISTS `claim_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `claim_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `claim_id` int(10) unsigned NOT NULL,
  `client_boq_item_id` int(10) unsigned NOT NULL,
  `claimed_qty` decimal(12,3) NOT NULL DEFAULT 0.000,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_claim_item` (`claim_id`,`client_boq_item_id`),
  KEY `client_boq_item_id` (`client_boq_item_id`),
  KEY `idx_claim_items_claim` (`claim_id`),
  CONSTRAINT `claim_items_ibfk_1` FOREIGN KEY (`claim_id`) REFERENCES `client_claims` (`id`),
  CONSTRAINT `claim_items_ibfk_2` FOREIGN KEY (`client_boq_item_id`) REFERENCES `client_boq_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `claim_items`
--

LOCK TABLES `claim_items` WRITE;
/*!40000 ALTER TABLE `claim_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `claim_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_boq_items`
--

DROP TABLE IF EXISTS `client_boq_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_boq_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `boq_version_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `stream` enum('design','services','civil','all') NOT NULL DEFAULT 'all',
  `trade` varchar(50) NOT NULL,
  `item_code` varchar(50) DEFAULT NULL,
  `item_name` varchar(300) NOT NULL,
  `unit` varchar(30) NOT NULL,
  `quantity` decimal(12,3) NOT NULL DEFAULT 0.000,
  `client_rate` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `display_order` int(10) unsigned NOT NULL DEFAULT 0,
  `hsn_code` varchar(10) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `boq_version_id` (`boq_version_id`),
  KEY `idx_client_boq_project` (`project_id`,`stream`),
  CONSTRAINT `client_boq_items_ibfk_1` FOREIGN KEY (`boq_version_id`) REFERENCES `client_boq_versions` (`id`),
  CONSTRAINT `client_boq_items_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_boq_items`
--

LOCK TABLES `client_boq_items` WRITE;
/*!40000 ALTER TABLE `client_boq_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_boq_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_boq_versions`
--

DROP TABLE IF EXISTS `client_boq_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_boq_versions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `stream` enum('design','services','civil','all') NOT NULL DEFAULT 'all',
  `version_number` int(10) unsigned NOT NULL DEFAULT 1,
  `label` varchar(10) NOT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 0,
  `uploaded_by` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_client_boq_version` (`project_id`,`stream`,`version_number`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `client_boq_versions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `client_boq_versions_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_boq_versions`
--

LOCK TABLES `client_boq_versions` WRITE;
/*!40000 ALTER TABLE `client_boq_versions` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_boq_versions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_claims`
--

DROP TABLE IF EXISTS `client_claims`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_claims` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `ra_bill_number` varchar(20) NOT NULL,
  `discipline` varchar(50) NOT NULL,
  `measurement_id` int(10) unsigned DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `pmc_signoff` int(10) unsigned DEFAULT NULL,
  `pmc_signoff_at` datetime DEFAULT NULL,
  `rs_signoff` int(10) unsigned DEFAULT NULL,
  `rs_signoff_at` datetime DEFAULT NULL,
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `invoice_number` varchar(50) DEFAULT NULL,
  `invoice_date` date DEFAULT NULL,
  `invoice_sequence` int(10) unsigned DEFAULT NULL,
  `invoiced_by` int(10) unsigned DEFAULT NULL,
  `invoiced_at` datetime DEFAULT NULL,
  `raised_by` int(10) unsigned NOT NULL,
  `status` enum('draft','pending_approval','approved','invoiced') NOT NULL DEFAULT 'draft',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `invoice_prefix` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_client_claims_invoice_number` (`invoice_number`),
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
-- Dumping data for table `client_claims`
--

LOCK TABLES `client_claims` WRITE;
/*!40000 ALTER TABLE `client_claims` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_claims` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_comms`
--

DROP TABLE IF EXISTS `client_comms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_comms` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `comm_date` datetime NOT NULL DEFAULT current_timestamp(),
  `document_type` enum('measurement_certificate','mom','weekly_report','drawing','snag_update','ncr_update','change_notice','invoice','other') NOT NULL,
  `document_ref` varchar(100) DEFAULT NULL,
  `document_path` varchar(500) DEFAULT NULL,
  `sent_by` int(10) unsigned NOT NULL,
  `method` enum('whatsapp','email','hard_copy','courier','in_person_handover') NOT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `client_ack_at` datetime DEFAULT NULL,
  `client_response` text DEFAULT NULL,
  `auto_logged` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `sent_by` (`sent_by`),
  KEY `idx_comms_project` (`project_id`,`comm_date`),
  CONSTRAINT `client_comms_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `client_comms_ibfk_2` FOREIGN KEY (`sent_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_comms`
--

LOCK TABLES `client_comms` WRITE;
/*!40000 ALTER TABLE `client_comms` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_comms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_errors`
--

DROP TABLE IF EXISTS `client_errors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_errors` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `user_role` varchar(40) DEFAULT NULL,
  `user_full_name` varchar(120) DEFAULT NULL,
  `request_method` varchar(10) NOT NULL,
  `request_path` varchar(500) NOT NULL,
  `http_status` smallint(5) unsigned DEFAULT NULL,
  `error_code` varchar(40) DEFAULT NULL,
  `response_excerpt` varchar(1000) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `client_path` varchar(200) DEFAULT NULL,
  `triaged_at` datetime DEFAULT NULL,
  `triaged_by` int(10) unsigned DEFAULT NULL,
  `triage_note` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ce_created` (`created_at`),
  KEY `idx_ce_method_path` (`request_method`,`request_path`),
  KEY `idx_ce_user` (`user_id`,`created_at`),
  KEY `idx_ce_untriaged` (`triaged_at`,`created_at`),
  KEY `fk_ce_triager` (`triaged_by`),
  CONSTRAINT `fk_ce_triager` FOREIGN KEY (`triaged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ce_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_errors`
--

LOCK TABLES `client_errors` WRITE;
/*!40000 ALTER TABLE `client_errors` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_errors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_receipts`
--

DROP TABLE IF EXISTS `client_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_receipts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `pi_id` int(10) unsigned NOT NULL,
  `receipt_date` date NOT NULL,
  `amount_received` decimal(14,2) NOT NULL,
  `tds_deducted` decimal(14,2) NOT NULL DEFAULT 0.00,
  `net_received` decimal(14,2) NOT NULL,
  `utr` varchar(100) DEFAULT NULL,
  `bank_ref` varchar(100) DEFAULT NULL,
  `notes` varchar(300) DEFAULT NULL,
  `recorded_by` int(10) unsigned NOT NULL,
  `recorded_at` datetime NOT NULL DEFAULT current_timestamp(),
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
-- Dumping data for table `client_receipts`
--

LOCK TABLES `client_receipts` WRITE;
/*!40000 ALTER TABLE `client_receipts` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_receipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `client_name` varchar(200) NOT NULL,
  `display_name` varchar(100) DEFAULT NULL,
  `gstin` varchar(15) DEFAULT NULL,
  `pan` varchar(10) DEFAULT NULL,
  `state_name` varchar(50) DEFAULT NULL,
  `state_code` tinyint(3) unsigned DEFAULT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `contact_phone` varchar(20) DEFAULT NULL,
  `contact_whatsapp` varchar(20) DEFAULT NULL,
  `contact_email` varchar(100) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `gst_treatment` enum('regular','unregistered','sez','exempt') NOT NULL DEFAULT 'regular',
  `tally_party_ledger` varchar(200) DEFAULT NULL,
  `tally_income_ledger` varchar(200) NOT NULL DEFAULT 'Construction Works Income',
  `invoice_prefix` varchar(30) NOT NULL DEFAULT 'NUALL/26-27/',
  `invoice_sequence` int(10) unsigned NOT NULL DEFAULT 0,
  `payment_terms_days` tinyint(3) unsigned NOT NULL DEFAULT 30,
  `registered_address` text DEFAULT NULL,
  `is_interstate` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `master_complete` tinyint(1) NOT NULL DEFAULT 1,
  `stub_reason` varchar(200) DEFAULT NULL,
  `completed_by` int(10) unsigned DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_by` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gstin` (`gstin`),
  KEY `idx_master_complete` (`master_complete`,`is_active`),
  KEY `created_by` (`created_by`),
  KEY `completed_by` (`completed_by`),
  CONSTRAINT `clients_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `clients_ibfk_2` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clients`
--

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comms_log`
--

DROP TABLE IF EXISTS `comms_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `comms_log` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `channel` enum('whatsapp','email','sms') NOT NULL,
  `direction` enum('inbound','outbound') NOT NULL DEFAULT 'outbound',
  `user_id` int(10) unsigned DEFAULT NULL,
  `to_address` varchar(200) NOT NULL,
  `subject` varchar(300) DEFAULT NULL,
  `body` text DEFAULT NULL,
  `message_type` varchar(50) DEFAULT NULL,
  `provider_msg_id` varchar(100) DEFAULT NULL,
  `status` enum('queued','sent','delivered','read','failed','bounced','complaint') NOT NULL DEFAULT 'queued',
  `error_code` varchar(20) DEFAULT NULL,
  `sent_at` datetime NOT NULL DEFAULT current_timestamp(),
  `delivered_at` datetime DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `bounced_at` datetime DEFAULT NULL,
  `project_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_comms_log_proj_status` (`project_id`,`status`),
  CONSTRAINT `comms_log_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `comms_log_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comms_log`
--

LOCK TABLES `comms_log` WRITE;
/*!40000 ALTER TABLE `comms_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `comms_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `company_entities`
--

DROP TABLE IF EXISTS `company_entities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_entities` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `entity_code` varchar(20) NOT NULL,
  `legal_name` varchar(200) NOT NULL,
  `address_line1` varchar(200) NOT NULL,
  `address_line2` varchar(200) DEFAULT NULL,
  `city` varchar(100) NOT NULL DEFAULT 'Bengaluru',
  `state` varchar(50) NOT NULL DEFAULT 'Karnataka',
  `pincode` varchar(10) NOT NULL DEFAULT '560070',
  `gstin` varchar(20) NOT NULL,
  `state_code` varchar(5) NOT NULL DEFAULT '29',
  `email_primary` varchar(100) NOT NULL,
  `email_finance` varchar(100) DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `sac_code` varchar(10) NOT NULL DEFAULT '998311',
  `bank_name` varchar(100) NOT NULL,
  `bank_account_no` varchar(30) NOT NULL,
  `bank_ifsc` varchar(15) NOT NULL,
  `bank_account_holder` varchar(200) NOT NULL,
  `bank_branch` varchar(100) DEFAULT NULL,
  `upi_id` varchar(100) DEFAULT NULL,
  `bank2_name` varchar(100) DEFAULT NULL,
  `bank2_account_no` varchar(30) DEFAULT NULL,
  `bank2_ifsc` varchar(15) DEFAULT NULL,
  `bank2_account_holder` varchar(200) DEFAULT NULL,
  `bank2_branch` varchar(100) DEFAULT NULL,
  `bank2_upi_id` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `entity_code` (`entity_code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_entities`
--

LOCK TABLES `company_entities` WRITE;
/*!40000 ALTER TABLE `company_entities` DISABLE KEYS */;
-- Company entity rows are in nu-pmc-seed-example.sql (placeholder data).
-- Load that file after this one, then update your real details via
-- Settings → Account Setup in the app.
/*!40000 ALTER TABLE `company_entities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `current_pmc_assignments`
--

DROP TABLE IF EXISTS `current_pmc_assignments`;
/*!50001 DROP VIEW IF EXISTS `current_pmc_assignments`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `current_pmc_assignments` AS SELECT
 1 AS `project_id`,
  1 AS `project_code`,
  1 AS `primary_pmc_id`,
  1 AS `primary_assignment_id`,
  1 AS `backup_pmc_id`,
  1 AS `backup_assignment_id` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `daily_reports`
--

DROP TABLE IF EXISTS `daily_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_reports` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `report_date` date NOT NULL,
  `site_manager_id` int(10) unsigned NOT NULL,
  `source` enum('whatsapp','manual_upload','app') NOT NULL DEFAULT 'app',
  `raw_file_path` varchar(500) DEFAULT NULL,
  `overall_notes` text DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT current_timestamp(),
  `processed_at` datetime DEFAULT NULL,
  `ai_flag_reason` text DEFAULT NULL,
  `ai_flag_acknowledged` tinyint(1) NOT NULL DEFAULT 0,
  `ai_flag_ack_at` datetime DEFAULT NULL,
  `status` enum('pending_review','approved','flagged','auto_locked') NOT NULL DEFAULT 'pending_review',
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `flag_reason` text DEFAULT NULL,
  `flagged_by` int(10) unsigned DEFAULT NULL,
  `flagged_at` datetime DEFAULT NULL,
  `locked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_date_manager` (`project_id`,`report_date`,`site_manager_id`),
  KEY `idx_daily_reports_lock_scan` (`status`,`report_date`),
  KEY `site_manager_id` (`site_manager_id`),
  KEY `approved_by` (`approved_by`),
  KEY `flagged_by` (`flagged_by`),
  KEY `idx_daily_reports_project` (`project_id`,`report_date`),
  CONSTRAINT `daily_reports_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `daily_reports_ibfk_2` FOREIGN KEY (`site_manager_id`) REFERENCES `users` (`id`),
  CONSTRAINT `daily_reports_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `daily_reports_ibfk_4` FOREIGN KEY (`flagged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_reports`
--

LOCK TABLES `daily_reports` WRITE;
/*!40000 ALTER TABLE `daily_reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `daily_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `date_sanity_checks`
--

DROP TABLE IF EXISTS `date_sanity_checks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `date_sanity_checks` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `check_trigger` enum('entry','schedule_upload','revision') NOT NULL,
  `dates_checked` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`dates_checked`)),
  `issues` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`issues`)),
  `warnings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`warnings`)),
  `verdict` varchar(500) DEFAULT NULL,
  `checked_at` datetime NOT NULL DEFAULT current_timestamp(),
  `acknowledged_by` int(10) unsigned DEFAULT NULL,
  `acknowledged_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `acknowledged_by` (`acknowledged_by`),
  CONSTRAINT `date_sanity_checks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `date_sanity_checks_ibfk_2` FOREIGN KEY (`acknowledged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `date_sanity_checks`
--

LOCK TABLES `date_sanity_checks` WRITE;
/*!40000 ALTER TABLE `date_sanity_checks` DISABLE KEYS */;
/*!40000 ALTER TABLE `date_sanity_checks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delegations`
--

DROP TABLE IF EXISTS `delegations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `delegations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `from_user_id` int(10) unsigned NOT NULL,
  `to_user_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned DEFAULT NULL,
  `scope` enum('full','limited_pmc','photo_tags_only') NOT NULL DEFAULT 'full',
  `start_at` datetime NOT NULL DEFAULT current_timestamp(),
  `end_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `revoked_at` datetime DEFAULT NULL,
  `revoked_by` int(10) unsigned DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `created_by` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delegations`
--

LOCK TABLES `delegations` WRITE;
/*!40000 ALTER TABLE `delegations` DISABLE KEYS */;
/*!40000 ALTER TABLE `delegations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `drawing_ai_checks`
--

DROP TABLE IF EXISTS `drawing_ai_checks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `drawing_ai_checks` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `drawing_version_id` int(10) unsigned NOT NULL,
  `check_type` enum('common_sense','detail_context','rfi_relevance','revision_change') NOT NULL,
  `result_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`result_json`)),
  `ok` tinyint(1) DEFAULT NULL,
  `severity` enum('info','warn','error') DEFAULT NULL,
  `summary` text DEFAULT NULL,
  `acknowledged_by` int(10) unsigned DEFAULT NULL,
  `acknowledged_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `acknowledged_by` (`acknowledged_by`),
  KEY `idx_dwg_ai_checks_version` (`drawing_version_id`),
  CONSTRAINT `drawing_ai_checks_ibfk_1` FOREIGN KEY (`drawing_version_id`) REFERENCES `drawing_versions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `drawing_ai_checks_ibfk_2` FOREIGN KEY (`acknowledged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drawing_ai_checks`
--

LOCK TABLES `drawing_ai_checks` WRITE;
/*!40000 ALTER TABLE `drawing_ai_checks` DISABLE KEYS */;
/*!40000 ALTER TABLE `drawing_ai_checks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `drawing_register`
--

DROP TABLE IF EXISTS `drawing_register`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `drawing_register` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `drawing_number` varchar(50) NOT NULL,
  `drawing_name` varchar(300) NOT NULL,
  `category` enum('Architectural','Structural','Civil','Interior','Electrical','HVAC','Plumbing','Fire','IT') NOT NULL,
  `stream` enum('design','services') NOT NULL,
  `expected_revision` varchar(10) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('pending','in_progress','issued') NOT NULL DEFAULT 'pending',
  `uploaded_by` int(10) unsigned NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  `signed_off_by` int(10) unsigned DEFAULT NULL,
  `signed_off_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reg_project_drawing` (`project_id`,`drawing_number`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `signed_off_by` (`signed_off_by`),
  KEY `idx_drawing_register_project` (`project_id`,`stream`),
  KEY `idx_drawing_register_status` (`project_id`,`status`),
  CONSTRAINT `drawing_register_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `drawing_register_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `drawing_register_ibfk_3` FOREIGN KEY (`signed_off_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drawing_register`
--

LOCK TABLES `drawing_register` WRITE;
/*!40000 ALTER TABLE `drawing_register` DISABLE KEYS */;
/*!40000 ALTER TABLE `drawing_register` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `drawing_versions`
--

DROP TABLE IF EXISTS `drawing_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `drawing_versions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `drawing_id` int(10) unsigned NOT NULL,
  `revision` varchar(10) NOT NULL,
  `revision_number` int(10) unsigned NOT NULL DEFAULT 0,
  `file_path` varchar(500) NOT NULL,
  `file_size_kb` int(10) unsigned NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `change_notice_id` int(10) unsigned DEFAULT NULL,
  `approval_level` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `status` enum('pending_l1','pending_l2','issued','rejected','superseded') NOT NULL DEFAULT 'pending_l1',
  `l1_reviewed_by` int(10) unsigned DEFAULT NULL,
  `l1_reviewed_at` datetime DEFAULT NULL,
  `l1_rejection_note` text DEFAULT NULL,
  `l2_approved_by` int(10) unsigned DEFAULT NULL,
  `l2_approved_at` datetime DEFAULT NULL,
  `l2_rejection_note` text DEFAULT NULL,
  `issued_at` datetime DEFAULT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 0,
  `flag_comment` text DEFAULT NULL,
  `flag_by` int(10) unsigned DEFAULT NULL,
  `flag_at` datetime DEFAULT NULL,
  `is_held` tinyint(1) NOT NULL DEFAULT 0,
  `held_at` datetime DEFAULT NULL,
  `held_by` int(10) unsigned DEFAULT NULL,
  `uploaded_by` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_drawing_revision` (`drawing_id`,`revision_number`),
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drawing_versions`
--

LOCK TABLES `drawing_versions` WRITE;
/*!40000 ALTER TABLE `drawing_versions` DISABLE KEYS */;
/*!40000 ALTER TABLE `drawing_versions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `drawings`
--

DROP TABLE IF EXISTS `drawings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `drawings` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `drawing_number` varchar(50) NOT NULL,
  `drawing_name` varchar(300) NOT NULL,
  `category` enum('Architectural','Structural','Civil','Interior','Electrical','HVAC','Plumbing','Fire','IT') NOT NULL,
  `stream` enum('design','services') NOT NULL,
  `drawing_type` enum('main','detail','rfi_response') NOT NULL DEFAULT 'main',
  `parent_drawing_id` int(10) unsigned DEFAULT NULL,
  `rfi_issue_id` int(10) unsigned DEFAULT NULL,
  `register_entry_id` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_drawing` (`project_id`,`drawing_number`),
  KEY `parent_drawing_id` (`parent_drawing_id`),
  KEY `register_entry_id` (`register_entry_id`),
  KEY `idx_drawings_project` (`project_id`),
  KEY `idx_drawings_type` (`project_id`,`drawing_type`),
  CONSTRAINT `drawings_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `drawings_ibfk_2` FOREIGN KEY (`parent_drawing_id`) REFERENCES `drawings` (`id`) ON DELETE SET NULL,
  CONSTRAINT `drawings_ibfk_3` FOREIGN KEY (`register_entry_id`) REFERENCES `drawing_register` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drawings`
--

LOCK TABLES `drawings` WRITE;
/*!40000 ALTER TABLE `drawings` DISABLE KEYS */;
/*!40000 ALTER TABLE `drawings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entity_photo_links`
--

DROP TABLE IF EXISTS `entity_photo_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `entity_photo_links` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `photo_id` int(10) unsigned NOT NULL,
  `entity_type` enum('project_progress','issue','meeting','daily_report','snag','weekly_report') NOT NULL,
  `entity_id` int(10) unsigned NOT NULL,
  `linked_by` int(10) unsigned NOT NULL,
  `linked_at` datetime NOT NULL DEFAULT current_timestamp(),
  `link_caption` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_photo_entity` (`photo_id`,`entity_type`,`entity_id`),
  KEY `idx_epl_entity` (`entity_type`,`entity_id`),
  KEY `fk_epl_linker` (`linked_by`),
  CONSTRAINT `fk_epl_linker` FOREIGN KEY (`linked_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_epl_photo` FOREIGN KEY (`photo_id`) REFERENCES `entity_photos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entity_photo_links`
--

LOCK TABLES `entity_photo_links` WRITE;
/*!40000 ALTER TABLE `entity_photo_links` DISABLE KEYS */;
/*!40000 ALTER TABLE `entity_photo_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entity_photos`
--

DROP TABLE IF EXISTS `entity_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `entity_photos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size_kb` int(10) unsigned NOT NULL DEFAULT 0,
  `caption` varchar(500) DEFAULT NULL,
  `source` enum('app','whatsapp','site_visit') NOT NULL DEFAULT 'app',
  `uploaded_by` int(10) unsigned NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  `primary_entity_type` enum('project_progress','issue','meeting','daily_report','snag','generic') NOT NULL DEFAULT 'generic',
  `primary_entity_id` int(10) unsigned DEFAULT NULL,
  `is_locked` tinyint(1) NOT NULL DEFAULT 0,
  `locked_at` datetime DEFAULT NULL,
  `locked_by_report_id` int(10) unsigned DEFAULT NULL,
  `photo_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_entity_photos_project` (`project_id`),
  KEY `idx_entity_photos_primary_entity` (`primary_entity_type`,`primary_entity_id`),
  KEY `idx_entity_photos_date` (`project_id`,`photo_date`),
  KEY `fk_ep_uploader` (`uploaded_by`),
  CONSTRAINT `fk_ep_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ep_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entity_photos`
--

LOCK TABLES `entity_photos` WRITE;
/*!40000 ALTER TABLE `entity_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `entity_photos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_emails`
--

DROP TABLE IF EXISTS `failed_emails`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_emails` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `attempted_at` datetime NOT NULL DEFAULT current_timestamp(),
  `to_address` varchar(255) NOT NULL,
  `subject` varchar(500) NOT NULL,
  `body_preview` varchar(500) DEFAULT NULL,
  `error_message` varchar(500) DEFAULT NULL,
  `project_id` int(10) unsigned DEFAULT NULL,
  `retry_count` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `next_retry_at` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fe_next_retry` (`next_retry_at`),
  KEY `idx_fe_resolved` (`resolved_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_emails`
--

LOCK TABLES `failed_emails` WRITE;
/*!40000 ALTER TABLE `failed_emails` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_emails` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fee_schedule`
--

DROP TABLE IF EXISTS `fee_schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `fee_schedule` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `milestone_name` varchar(300) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `gst_pct` decimal(5,2) NOT NULL DEFAULT 18.00,
  `display_order` int(10) unsigned NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `fee_schedule_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fee_schedule_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fee_schedule`
--

LOCK TABLES `fee_schedule` WRITE;
/*!40000 ALTER TABLE `fee_schedule` DISABLE KEYS */;
/*!40000 ALTER TABLE `fee_schedule` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fee_schedule_history`
--

DROP TABLE IF EXISTS `fee_schedule_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `fee_schedule_history` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `fee_schedule_id` int(10) unsigned NOT NULL,
  `previous_amount` decimal(14,2) NOT NULL,
  `revised_amount` decimal(14,2) NOT NULL,
  `reason` varchar(300) NOT NULL,
  `revised_by` int(10) unsigned NOT NULL,
  `revised_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fee_schedule_id` (`fee_schedule_id`),
  KEY `revised_by` (`revised_by`),
  CONSTRAINT `fee_schedule_history_ibfk_1` FOREIGN KEY (`fee_schedule_id`) REFERENCES `fee_schedule` (`id`),
  CONSTRAINT `fee_schedule_history_ibfk_2` FOREIGN KEY (`revised_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fee_schedule_history`
--

LOCK TABLES `fee_schedule_history` WRITE;
/*!40000 ALTER TABLE `fee_schedule_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `fee_schedule_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `form_submissions`
--

DROP TABLE IF EXISTS `form_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `form_submissions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int(10) unsigned NOT NULL,
  `template_version` int(10) unsigned NOT NULL DEFAULT 1,
  `project_id` int(10) unsigned NOT NULL,
  `submitted_by` int(10) unsigned NOT NULL,
  `submitted_at` datetime NOT NULL DEFAULT current_timestamp(),
  `responses_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`responses_json`)),
  `file_path` varchar(500) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `template_id` (`template_id`),
  KEY `project_id` (`project_id`),
  KEY `submitted_by` (`submitted_by`),
  CONSTRAINT `form_submissions_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `form_templates` (`id`),
  CONSTRAINT `form_submissions_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `form_submissions_ibfk_3` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `form_submissions`
--

LOCK TABLES `form_submissions` WRITE;
/*!40000 ALTER TABLE `form_submissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `form_submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `form_templates`
--

DROP TABLE IF EXISTS `form_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `form_templates` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `category` enum('quality','safety','inspection','handover','custom') NOT NULL DEFAULT 'custom',
  `is_standard` tinyint(1) NOT NULL DEFAULT 0,
  `version` int(10) unsigned NOT NULL DEFAULT 1,
  `fields_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`fields_json`)),
  `created_by` int(10) unsigned NOT NULL,
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `status` enum('draft','approved','archived') NOT NULL DEFAULT 'draft',
  `project_id` int(10) unsigned DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_form_templates_proj_status` (`project_id`,`status`),
  CONSTRAINT `form_templates_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `form_templates_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `form_templates_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `form_templates`
--

LOCK TABLES `form_templates` WRITE;
/*!40000 ALTER TABLE `form_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `form_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `governance_uploads`
--

DROP TABLE IF EXISTS `governance_uploads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `governance_uploads` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `sheet_type` enum('permissions','workflows','notifications','slas','visibility','audit_events','sequences','open_gaps') NOT NULL,
  `uploaded_by` int(10) unsigned NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `rows_updated` int(10) unsigned NOT NULL DEFAULT 0,
  `rows_added` int(10) unsigned NOT NULL DEFAULT 0,
  `rows_removed` int(10) unsigned NOT NULL DEFAULT 0,
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `governance_uploads_ibfk_1` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `governance_uploads`
--

LOCK TABLES `governance_uploads` WRITE;
/*!40000 ALTER TABLE `governance_uploads` DISABLE KEYS */;
/*!40000 ALTER TABLE `governance_uploads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `grns`
--

DROP TABLE IF EXISTS `grns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `grns` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `grn_number` varchar(20) NOT NULL,
  `engagement_id` int(10) unsigned NOT NULL,
  `material_request_id` int(10) unsigned DEFAULT NULL,
  `delivery_date` date NOT NULL,
  `description` text NOT NULL,
  `quantity_received` decimal(12,3) NOT NULL,
  `unit` varchar(30) DEFAULT NULL,
  `delivery_note_ref` varchar(100) DEFAULT NULL,
  `invoice_ref` varchar(100) DEFAULT NULL,
  `delivery_note_path` varchar(500) DEFAULT NULL,
  `invoice_path` varchar(500) DEFAULT NULL,
  `is_unplanned` tinyint(1) NOT NULL DEFAULT 0,
  `raised_by` int(10) unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT current_timestamp(),
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `rejection_reason` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_grn_project_number` (`project_id`,`grn_number`),
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
  CONSTRAINT `chk_grn_qty` CHECK (`quantity_received` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grns`
--

LOCK TABLES `grns` WRITE;
/*!40000 ALTER TABLE `grns` DISABLE KEYS */;
/*!40000 ALTER TABLE `grns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `handover_checklist_items`
--

DROP TABLE IF EXISTS `handover_checklist_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `handover_checklist_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `item_name` varchar(200) NOT NULL,
  `discipline` varchar(40) NOT NULL,
  `is_applicable` tinyint(1) NOT NULL DEFAULT 1,
  `file_path` varchar(500) DEFAULT NULL,
  `uploaded_by` int(10) unsigned DEFAULT NULL,
  `uploaded_at` datetime DEFAULT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_checklist_project` (`project_id`,`discipline`,`sort_order`),
  KEY `fk_checklist_uploader` (`uploaded_by`),
  CONSTRAINT `fk_checklist_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_checklist_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `handover_checklist_items`
--

LOCK TABLES `handover_checklist_items` WRITE;
/*!40000 ALTER TABLE `handover_checklist_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `handover_checklist_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `handover_checklist_template`
--

DROP TABLE IF EXISTS `handover_checklist_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `handover_checklist_template` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `item_name` varchar(200) NOT NULL,
  `discipline` varchar(40) NOT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `handover_checklist_template`
--

LOCK TABLES `handover_checklist_template` WRITE;
/*!40000 ALTER TABLE `handover_checklist_template` DISABLE KEYS */;
INSERT INTO `handover_checklist_template` VALUES (1,'As-built drawings (architectural set)','architectural',10,1);
INSERT INTO `handover_checklist_template` VALUES (2,'As-built model files','architectural',20,1);
INSERT INTO `handover_checklist_template` VALUES (3,'As-built MEP drawings','services',30,1);
INSERT INTO `handover_checklist_template` VALUES (4,'Equipment manuals and warranty register','services',40,1);
INSERT INTO `handover_checklist_template` VALUES (5,'Final project report','pmc',50,1);
INSERT INTO `handover_checklist_template` VALUES (6,'Vendor warranty consolidated register','pmc',60,1);
INSERT INTO `handover_checklist_template` VALUES (7,'Occupancy / Completion certificate','statutory',70,1);
INSERT INTO `handover_checklist_template` VALUES (8,'Fire NOC','statutory',80,1);
/*!40000 ALTER TABLE `handover_checklist_template` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `handover_closure_signoffs`
--

DROP TABLE IF EXISTS `handover_closure_signoffs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `handover_closure_signoffs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `signed_for_role` varchar(30) NOT NULL,
  `signed_by_user_id` int(10) unsigned NOT NULL,
  `signed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `notes` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_closure_role` (`project_id`,`signed_for_role`),
  KEY `fk_closure_user` (`signed_by_user_id`),
  CONSTRAINT `fk_closure_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_closure_user` FOREIGN KEY (`signed_by_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `handover_closure_signoffs`
--

LOCK TABLES `handover_closure_signoffs` WRITE;
/*!40000 ALTER TABLE `handover_closure_signoffs` DISABLE KEYS */;
/*!40000 ALTER TABLE `handover_closure_signoffs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `issue_photos`
--

DROP TABLE IF EXISTS `issue_photos`;
/*!50001 DROP VIEW IF EXISTS `issue_photos`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `issue_photos` AS SELECT
 1 AS `id`,
  1 AS `issue_id`,
  1 AS `project_id`,
  1 AS `submitted_by`,
  1 AS `file_path`,
  1 AS `source`,
  1 AS `caption`,
  1 AS `submitted_at` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `issue_signoffs`
--

DROP TABLE IF EXISTS `issue_signoffs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `issue_signoffs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `issue_id` int(10) unsigned NOT NULL,
  `signed_for_role` varchar(30) NOT NULL,
  `signed_by_user_id` int(10) unsigned NOT NULL,
  `signed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `notes` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_issue_role` (`issue_id`,`signed_for_role`),
  KEY `fk_issue_signoff_user` (`signed_by_user_id`),
  CONSTRAINT `fk_issue_signoff_issue` FOREIGN KEY (`issue_id`) REFERENCES `issues` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_issue_signoff_user` FOREIGN KEY (`signed_by_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `issue_signoffs`
--

LOCK TABLES `issue_signoffs` WRITE;
/*!40000 ALTER TABLE `issue_signoffs` DISABLE KEYS */;
/*!40000 ALTER TABLE `issue_signoffs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `issues`
--

DROP TABLE IF EXISTS `issues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `issues` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `issue_number` varchar(20) NOT NULL,
  `issue_type` enum('safety','quality','design','rfi','compliance','snag') NOT NULL,
  `severity` enum('minor','major','critical') DEFAULT NULL,
  `priority` enum('low','medium','high','urgent') DEFAULT NULL,
  `title` varchar(300) NOT NULL,
  `description` text NOT NULL,
  `raised_by` int(10) unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT current_timestamp(),
  `confirmed_by` int(10) unsigned DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `assigned_to` int(10) unsigned DEFAULT NULL,
  `assigned_vendor_id` int(10) unsigned DEFAULT NULL,
  `drawing_id` int(10) unsigned DEFAULT NULL,
  `location` varchar(200) DEFAULT NULL,
  `trade` varchar(40) DEFAULT NULL,
  `raised_from` enum('meeting','ncr','dlp','other') DEFAULT NULL,
  `meeting_id` int(10) unsigned DEFAULT NULL,
  `ncr_id` int(10) unsigned DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('draft','open','in_progress','resolved','closed','signed_off','accepted_by_client') NOT NULL DEFAULT 'draft',
  `signed_off_at` datetime DEFAULT NULL,
  `client_acceptance_note` varchar(1000) DEFAULT NULL,
  `is_overdue` tinyint(1) NOT NULL DEFAULT 0,
  `rfi_response` text DEFAULT NULL,
  `rfi_responded_by` int(10) unsigned DEFAULT NULL,
  `rfi_responded_at` datetime DEFAULT NULL,
  `ncr_number` varchar(20) DEFAULT NULL,
  `vendor_accountability` tinyint(1) NOT NULL DEFAULT 0,
  `vendor_acknowledged` tinyint(1) NOT NULL DEFAULT 0,
  `vendor_ack_at` datetime DEFAULT NULL,
  `vendor_disputed` tinyint(1) NOT NULL DEFAULT 0,
  `rectification_date` date DEFAULT NULL,
  `rectification_note` text DEFAULT NULL,
  `drawing_version_id` int(10) unsigned DEFAULT NULL,
  `query_stream` enum('design','services') DEFAULT NULL,
  `response_type` enum('text','photo','both') NOT NULL DEFAULT 'text',
  `photo_deadline` date DEFAULT NULL,
  `assigned_to_site` int(10) unsigned DEFAULT NULL,
  `wa_request_sid` varchar(64) DEFAULT NULL,
  `resolution_note` text DEFAULT NULL,
  `resolved_by` int(10) unsigned DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `closed_by` int(10) unsigned DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `amber_sent` tinyint(1) NOT NULL DEFAULT 0,
  `red_sent` tinyint(1) NOT NULL DEFAULT 0,
  `file_path` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_issue_project_number` (`project_id`,`issue_number`),
  KEY `raised_by` (`raised_by`),
  KEY `confirmed_by` (`confirmed_by`),
  KEY `assigned_to` (`assigned_to`),
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
  CONSTRAINT `issues_ibfk_5` FOREIGN KEY (`assigned_vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_6` FOREIGN KEY (`drawing_id`) REFERENCES `drawings` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_7` FOREIGN KEY (`rfi_responded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_8` FOREIGN KEY (`assigned_to_site`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_9` FOREIGN KEY (`drawing_version_id`) REFERENCES `drawing_versions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `issues`
--

LOCK TABLES `issues` WRITE;
/*!40000 ALTER TABLE `issues` DISABLE KEYS */;
/*!40000 ALTER TABLE `issues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `labour_compliance`
--

DROP TABLE IF EXISTS `labour_compliance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `labour_compliance` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int(10) unsigned NOT NULL,
  `engagement_id` int(10) unsigned NOT NULL,
  `pf_number` varchar(50) DEFAULT NULL,
  `esi_number` varchar(50) DEFAULT NULL,
  `labour_licence_number` varchar(50) DEFAULT NULL,
  `labour_licence_expiry` date DEFAULT NULL,
  `alert_sent` tinyint(1) NOT NULL DEFAULT 0,
  `updated_by` int(10) unsigned NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
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
-- Dumping data for table `labour_compliance`
--

LOCK TABLES `labour_compliance` WRITE;
/*!40000 ALTER TABLE `labour_compliance` DISABLE KEYS */;
/*!40000 ALTER TABLE `labour_compliance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `labour_register`
--

DROP TABLE IF EXISTS `labour_register`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `labour_register` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `engagement_id` int(10) unsigned NOT NULL,
  `register_date` date NOT NULL,
  `trade` varchar(50) NOT NULL,
  `headcount` int(10) unsigned NOT NULL DEFAULT 0,
  `wages_paid` decimal(10,2) DEFAULT NULL,
  `recorded_by` int(10) unsigned NOT NULL,
  `recorded_at` datetime NOT NULL DEFAULT current_timestamp(),
  `notes` varchar(300) DEFAULT NULL,
  `validated_by` int(10) unsigned DEFAULT NULL,
  `validated_at` datetime DEFAULT NULL,
  `validation_notes` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_labour_date` (`project_id`,`engagement_id`,`register_date`,`trade`),
  KEY `validated_by` (`validated_by`),
  KEY `engagement_id` (`engagement_id`),
  KEY `recorded_by` (`recorded_by`),
  CONSTRAINT `labour_register_ibfk_1` FOREIGN KEY (`validated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `labour_register_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `labour_register_ibfk_3` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `labour_register_ibfk_4` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `labour_register`
--

LOCK TABLES `labour_register` WRITE;
/*!40000 ALTER TABLE `labour_register` DISABLE KEYS */;
/*!40000 ALTER TABLE `labour_register` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lessons_learned`
--

DROP TABLE IF EXISTS `lessons_learned`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lessons_learned` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `ai_draft` mediumtext DEFAULT NULL,
  `ai_drafted_at` datetime DEFAULT NULL,
  `published_content` mediumtext DEFAULT NULL,
  `published_at` datetime DEFAULT NULL,
  `published_by` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_id` (`project_id`),
  KEY `fk_lessons_publisher` (`published_by`),
  CONSTRAINT `fk_lessons_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_lessons_publisher` FOREIGN KEY (`published_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lessons_learned`
--

LOCK TABLES `lessons_learned` WRITE;
/*!40000 ALTER TABLE `lessons_learned` DISABLE KEYS */;
/*!40000 ALTER TABLE `lessons_learned` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lessons_learned_inputs`
--

DROP TABLE IF EXISTS `lessons_learned_inputs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lessons_learned_inputs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `input_text` text NOT NULL,
  `category` enum('what_went_well','improvement','recommendation','other') NOT NULL DEFAULT 'other',
  `signoff` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inputs_project_user` (`project_id`,`user_id`),
  KEY `fk_inputs_user` (`user_id`),
  CONSTRAINT `fk_inputs_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inputs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lessons_learned_inputs`
--

LOCK TABLES `lessons_learned_inputs` WRITE;
/*!40000 ALTER TABLE `lessons_learned_inputs` DISABLE KEYS */;
/*!40000 ALTER TABLE `lessons_learned_inputs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_approvals`
--

DROP TABLE IF EXISTS `material_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_approvals` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `trade` varchar(50) NOT NULL,
  `material_name` varchar(200) NOT NULL,
  `brand_spec` varchar(300) DEFAULT NULL,
  `sample_submitted_date` date DEFAULT NULL,
  `submitted_by` int(10) unsigned NOT NULL,
  `approval_status` enum('pending','approved','rejected','revision_required') NOT NULL DEFAULT 'pending',
  `client_response_date` date DEFAULT NULL,
  `client_comments` text DEFAULT NULL,
  `is_mockup` tinyint(1) NOT NULL DEFAULT 0,
  `file_path` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `submitted_by` (`submitted_by`),
  CONSTRAINT `material_approvals_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `material_approvals_ibfk_2` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_approvals`
--

LOCK TABLES `material_approvals` WRITE;
/*!40000 ALTER TABLE `material_approvals` DISABLE KEYS */;
/*!40000 ALTER TABLE `material_approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_requests`
--

DROP TABLE IF EXISTS `material_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_requests` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `boq_item_id` int(10) unsigned NOT NULL,
  `quantity_needed` decimal(12,3) NOT NULL,
  `needed_by_date` date NOT NULL,
  `status` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  `raised_by` int(10) unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT current_timestamp(),
  `ordered_by` int(10) unsigned DEFAULT NULL,
  `ordered_at` datetime DEFAULT NULL,
  `dispatched_at` datetime DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `validated_by` int(10) unsigned DEFAULT NULL,
  `validated_at` datetime DEFAULT NULL,
  `is_overdue` tinyint(1) NOT NULL DEFAULT 0,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_requests`
--

LOCK TABLES `material_requests` WRITE;
/*!40000 ALTER TABLE `material_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `material_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `measurement_items`
--

DROP TABLE IF EXISTS `measurement_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `measurement_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `measurement_id` int(10) unsigned NOT NULL,
  `client_boq_item_id` int(10) unsigned NOT NULL,
  `measured_qty` decimal(12,3) NOT NULL DEFAULT 0.000,
  `quality_note` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_meas_item` (`measurement_id`,`client_boq_item_id`),
  KEY `client_boq_item_id` (`client_boq_item_id`),
  CONSTRAINT `measurement_items_ibfk_1` FOREIGN KEY (`measurement_id`) REFERENCES `measurements` (`id`),
  CONSTRAINT `measurement_items_ibfk_2` FOREIGN KEY (`client_boq_item_id`) REFERENCES `client_boq_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `measurement_items`
--

LOCK TABLES `measurement_items` WRITE;
/*!40000 ALTER TABLE `measurement_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `measurement_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `measurements`
--

DROP TABLE IF EXISTS `measurements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `measurements` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `ra_bill_number` varchar(20) NOT NULL,
  `discipline` varchar(50) NOT NULL,
  `measurement_date` date NOT NULL,
  `notes` text DEFAULT NULL,
  `checked_by` int(10) unsigned DEFAULT NULL,
  `checked_at` datetime DEFAULT NULL,
  `rs_notes` text DEFAULT NULL,
  `client_rep_name` varchar(100) DEFAULT NULL,
  `client_rep_designation` varchar(100) DEFAULT NULL,
  `client_accepted_at` date DEFAULT NULL,
  `deductions_notes` text DEFAULT NULL,
  `signed_certificate_path` varchar(500) DEFAULT NULL,
  `status` enum('draft','rs_signed','client_accepted') NOT NULL DEFAULT 'draft',
  `recorded_by` int(10) unsigned NOT NULL,
  `approved_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
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
-- Dumping data for table `measurements`
--

LOCK TABLES `measurements` WRITE;
/*!40000 ALTER TABLE `measurements` DISABLE KEYS */;
/*!40000 ALTER TABLE `measurements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `meeting_actions`
--

DROP TABLE IF EXISTS `meeting_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `meeting_actions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `meeting_id` int(10) unsigned NOT NULL,
  `action_text` text NOT NULL,
  `assigned_to` int(10) unsigned DEFAULT NULL,
  `assignee_name` varchar(200) DEFAULT NULL,
  `countersign_by` int(10) unsigned DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('pending','acknowledged','in_progress','completed','overdue') NOT NULL DEFAULT 'pending',
  `acknowledged_at` datetime DEFAULT NULL,
  `countersigned_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `completion_note` text DEFAULT NULL,
  `escalated` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `assigned_to` (`assigned_to`),
  KEY `countersign_by` (`countersign_by`),
  KEY `idx_meeting_actions_status` (`meeting_id`,`status`),
  CONSTRAINT `meeting_actions_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `meeting_actions_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`),
  CONSTRAINT `meeting_actions_ibfk_3` FOREIGN KEY (`countersign_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meeting_actions`
--

LOCK TABLES `meeting_actions` WRITE;
/*!40000 ALTER TABLE `meeting_actions` DISABLE KEYS */;
/*!40000 ALTER TABLE `meeting_actions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `meeting_photos`
--

DROP TABLE IF EXISTS `meeting_photos`;
/*!50001 DROP VIEW IF EXISTS `meeting_photos`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `meeting_photos` AS SELECT
 1 AS `id`,
  1 AS `meeting_id`,
  1 AS `file_path`,
  1 AS `file_size_kb`,
  1 AS `caption`,
  1 AS `doc_type`,
  1 AS `uploaded_by`,
  1 AS `uploaded_at` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `meeting_revisions`
--

DROP TABLE IF EXISTS `meeting_revisions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `meeting_revisions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `meeting_id` int(10) unsigned NOT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT 1,
  `issued_by` int(10) unsigned NOT NULL,
  `issued_at` datetime NOT NULL DEFAULT current_timestamp(),
  `window_days` int(10) unsigned NOT NULL DEFAULT 3,
  `lock_deadline` datetime NOT NULL,
  `locked_at` datetime DEFAULT NULL,
  `locked` tinyint(1) NOT NULL DEFAULT 0,
  `revision_reason` text DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `meeting_id` (`meeting_id`),
  KEY `issued_by` (`issued_by`),
  CONSTRAINT `meeting_revisions_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `meeting_revisions_ibfk_2` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meeting_revisions`
--

LOCK TABLES `meeting_revisions` WRITE;
/*!40000 ALTER TABLE `meeting_revisions` DISABLE KEYS */;
/*!40000 ALTER TABLE `meeting_revisions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `meetings`
--

DROP TABLE IF EXISTS `meetings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `meetings` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `row_version` int(10) unsigned NOT NULL DEFAULT 1,
  `project_id` int(10) unsigned NOT NULL,
  `client_id` int(10) unsigned DEFAULT NULL,
  `meeting_number` varchar(20) DEFAULT NULL,
  `type` enum('site_visit','internal','client','design_review','principal_visit','statutory','other') NOT NULL DEFAULT 'site_visit',
  `visibility` enum('internal','client_draft','sent_to_client','acknowledged') NOT NULL DEFAULT 'internal',
  `title` varchar(300) DEFAULT NULL,
  `meeting_date` date NOT NULL,
  `time_in` time DEFAULT NULL,
  `time_out` time DEFAULT NULL,
  `location` varchar(200) DEFAULT NULL,
  `attendees_internal` text DEFAULT NULL,
  `attendees_external` text DEFAULT NULL,
  `agenda` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `summary` text DEFAULT NULL,
  `next_meeting_date` date DEFAULT NULL,
  `drafted_by` int(10) unsigned DEFAULT NULL,
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `issued_at` datetime DEFAULT NULL,
  `client_acked_at` datetime DEFAULT NULL,
  `client_ack_by` varchar(100) DEFAULT NULL,
  `client_ack_response` varchar(200) DEFAULT NULL,
  `status` enum('draft','approved','issued','shared','acknowledged','closed') NOT NULL DEFAULT 'draft',
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meetings`
--

LOCK TABLES `meetings` WRITE;
/*!40000 ALTER TABLE `meetings` DISABLE KEYS */;
/*!40000 ALTER TABLE `meetings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mom_items`
--

DROP TABLE IF EXISTS `mom_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `mom_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `weekly_report_id` int(10) unsigned DEFAULT NULL,
  `trade` varchar(50) DEFAULT NULL,
  `description` text NOT NULL,
  `responsible` varchar(100) NOT NULL DEFAULT 'NU',
  `remarks` text DEFAULT NULL,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `resolution_note` text DEFAULT NULL,
  `carried_from` int(10) unsigned DEFAULT NULL,
  `created_by` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
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
-- Dumping data for table `mom_items`
--

LOCK TABLES `mom_items` WRITE;
/*!40000 ALTER TABLE `mom_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `mom_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_triggers`
--

DROP TABLE IF EXISTS `notification_triggers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_triggers` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `module` varchar(50) NOT NULL,
  `event_key` varchar(100) NOT NULL,
  `event_label` varchar(200) NOT NULL,
  `recipient_role` varchar(50) NOT NULL,
  `channel` enum('whatsapp','email','both') NOT NULL DEFAULT 'whatsapp',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `source_ref` varchar(100) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_role` (`event_key`,`recipient_role`),
  KEY `idx_event` (`event_key`),
  KEY `idx_module` (`module`)
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_triggers`
--

LOCK TABLES `notification_triggers` WRITE;
/*!40000 ALTER TABLE `notification_triggers` DISABLE KEYS */;
INSERT INTO `notification_triggers` VALUES (1,'Claims','claim.approved','Claim approved','principal','whatsapp',1,'claims.js:244','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (2,'Claims','claim.approved','Claim approved','design_principal','whatsapp',1,'claims.js:244','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (3,'Claims','claim.approved','Claim approved','pmc_head','whatsapp',1,'claims.js:250','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (4,'Drawings','drawing.approved','Drawing approved / issued','principal','whatsapp',1,'drawings.js:621','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (5,'Drawings','drawing.approved','Drawing approved / issued','design_principal','whatsapp',1,'drawings.js:621','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (6,'Drawings','drawing.flagged','Drawing flagged at L1 review','uploader','whatsapp',1,'drawings.js:542','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (7,'GRN','grn.ncr-raised','NCR / non-conformance flagged','principal','whatsapp',1,'grn.js:340','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (8,'GRN','grn.ncr-raised','NCR / non-conformance flagged','design_principal','whatsapp',1,'grn.js:340','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (9,'GRN','grn.ncr-raised','NCR / non-conformance flagged','pmc_head','whatsapp',1,'grn.js:340','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (10,'GRN','grn.ncr-raised','NCR / non-conformance flagged','design_head','whatsapp',1,'grn.js:345','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (11,'GRN','grn.ncr-raised','NCR / non-conformance flagged','services_head','whatsapp',1,'grn.js:345','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (12,'GRN','grn.ncr-raised','NCR / non-conformance flagged','vendor','whatsapp',1,'grn.js:353','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (13,'Issues','issue.auto-assigned','Issue auto-assigned','assignee','whatsapp',1,'issues.js:121','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (14,'Issues','issue.assigned','Issue assigned (manual)','assignee','whatsapp',1,'issues.js:152','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (15,'Issues','issue.ncr-vendor','Issue NCR sent to vendor','vendor','whatsapp',1,'issues.js:160','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (16,'Meetings','meeting.action-item-assigned','MOM action item assigned','assignee','whatsapp',1,'meetings.js:428','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (17,'Payments','payment.confirmed-utr','Payment confirmed (UTR applied)','principal','whatsapp',1,'payments.js:480','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (18,'Payments','payment.confirmed-utr','Payment confirmed (UTR applied)','design_principal','whatsapp',1,'payments.js:480','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (19,'Payments','payment.confirmed-utr','Payment confirmed (UTR applied)','vendor','whatsapp',1,'payments.js:480','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (20,'Payments','payment.utr-batch','UTR batch consolidated','principal','whatsapp',1,'payments.js:844','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (21,'Payments','payment.utr-batch','UTR batch consolidated','design_principal','whatsapp',1,'payments.js:844','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (22,'PaymentReq','payment-request.raised','Payment request raised','pmc_head','whatsapp',1,'payment-requests.js:214','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (23,'PaymentReq','payment-request.raised','Payment request raised','principal','whatsapp',1,'payment-requests.js:214','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (24,'PaymentReq','payment-request.pmc-approved','PR PMC approved','principal','whatsapp',1,'payment-requests.js:334','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (25,'PaymentReq','payment-request.pmc-approved','PR PMC approved','design_principal','whatsapp',1,'payment-requests.js:334','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (26,'PaymentReq','payment-request.pmc-approved','PR PMC approved','finance_admin','whatsapp',1,'payment-requests.js:352','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (27,'PaymentReq','payment-request.pmc-rejected','PR rejected by PMC','raiser','whatsapp',1,'payment-requests.js:303','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (28,'PaymentReq','payment-request.principal-approved','PR approved by Principal','finance_admin','whatsapp',1,'payment-requests.js:427','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (29,'PaymentReq','payment-request.principal-approved','PR approved by Principal','raiser','whatsapp',1,'payment-requests.js:427','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (30,'PaymentReq','payment-request.principal-rejected','PR rejected by Principal','raiser','whatsapp',1,'payment-requests.js:430','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (31,'PaymentReq','payment-request.principal-rejected','PR rejected by Principal','pmc_reviewer','whatsapp',1,'payment-requests.js:431','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (32,'PaymentReq','payment-request.vendor-confirmed','Vendor payment confirmed','vendor','whatsapp',1,'payment-requests.js:502','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (33,'PaymentReq','payment-request.vendor-confirmed','Vendor payment confirmed','raiser','whatsapp',1,'payment-requests.js:508','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (34,'PaymentReq','urgent-payment.raised','Urgent payment raised','pmc_head','whatsapp',1,'urgent-payments.js:111','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (35,'PaymentReq','urgent-payment.raised','Urgent payment raised','principal','whatsapp',1,'urgent-payments.js:124','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (36,'PaymentReq','urgent-payment.raised','Urgent payment raised','design_principal','whatsapp',1,'urgent-payments.js:124','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (37,'Reports','report.ready-for-review','Weekly report ready for review','principal','whatsapp',1,'reports.js:134','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (38,'Reports','report.ready-for-review','Weekly report ready for review','design_principal','whatsapp',1,'reports.js:134','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (39,'Reports','report.drag-flag','Drag flag on weekly report','principal','whatsapp',1,'reports.js:195,365','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (40,'Reports','report.drag-flag','Drag flag on weekly report','design_principal','whatsapp',1,'reports.js:195,365','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (41,'Reports','report.pmc-approved','Weekly report approved by PMC Head','principal','whatsapp',1,'reports.js:234','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (42,'Reports','report.pmc-approved','Weekly report approved by PMC Head','design_principal','whatsapp',1,'reports.js:234','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (43,'Schedule','schedule.version-uploaded','Schedule version uploaded','principal','whatsapp',1,'schedule.js:252','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (44,'Schedule','schedule.version-uploaded','Schedule version uploaded','design_principal','whatsapp',1,'schedule.js:252','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (45,'Schedule','schedule.drift-acknowledged','Schedule drift acknowledged','principal','whatsapp',1,'schedule.js:281','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (46,'Schedule','schedule.drift-acknowledged','Schedule drift acknowledged','design_principal','whatsapp',1,'schedule.js:281','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (47,'Schedule','schedule.task-outlier','Task outlier detected (AI flag)','principal','whatsapp',1,'schedule.js:366','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (48,'Schedule','schedule.task-outlier','Task outlier detected (AI flag)','design_principal','whatsapp',1,'schedule.js:366','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (49,'Users','user.pending-approval','New user pending approval','principal','whatsapp',1,'user-management.js:61','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (50,'Users','user.pending-approval','New user pending approval','design_principal','whatsapp',1,'user-management.js:61','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (51,'Users','user.activated','New user activated','new_user','whatsapp',1,'user-management.js:94','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (52,'Vendors','vendor.pending-clearance','Vendor pending finance clearance','finance_admin','whatsapp',1,'vendors.js:114','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (53,'Vendors','vendor.engagement-pending','Vendor engagement pending approval','principal','whatsapp',1,'vendors.js:423','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (54,'Vendors','vendor.engagement-pending','Vendor engagement pending approval','design_principal','whatsapp',1,'vendors.js:423','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (55,'Vendors','vendor.engagement-approved','Vendor engagement approved','raiser','whatsapp',1,'vendors.js:469','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (56,'Vendors','vendor.engagement-rejected','Vendor engagement rejected','raiser','whatsapp',1,'vendors.js:500','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (57,'Budget','budget.custom-head','Custom budget head approved/rejected','principal','whatsapp',1,'budget.js:193','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (58,'Budget','budget.custom-head','Custom budget head approved/rejected','design_principal','whatsapp',1,'budget.js:200','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (59,'Changes','change-notice.ready','CN ready for principal approval','principal','whatsapp',1,'changes.js:148','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (60,'Changes','change-notice.ready','CN ready for principal approval','design_principal','whatsapp',1,'changes.js:148','2026-04-28 08:51:54');
INSERT INTO `notification_triggers` VALUES (61,'Projects','project.client-incomplete','Client master incomplete','finance_admin','whatsapp',1,'projects.js:462','2026-04-28 08:51:54');
/*!40000 ALTER TABLE `notification_triggers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_request_evidence`
--

DROP TABLE IF EXISTS `payment_request_evidence`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_request_evidence` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `payment_request_id` int(10) unsigned NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_type` enum('photo','ra_bill','measurement_sheet','other') NOT NULL DEFAULT 'other',
  `uploaded_by` int(10) unsigned NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `payment_request_id` (`payment_request_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `payment_request_evidence_ibfk_1` FOREIGN KEY (`payment_request_id`) REFERENCES `payment_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payment_request_evidence_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_request_evidence`
--

LOCK TABLES `payment_request_evidence` WRITE;
/*!40000 ALTER TABLE `payment_request_evidence` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_request_evidence` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_requests`
--

DROP TABLE IF EXISTS `payment_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_requests` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `row_version` int(10) unsigned NOT NULL DEFAULT 1,
  `project_id` int(10) unsigned NOT NULL,
  `vendor_id` int(10) unsigned NOT NULL,
  `engagement_id` int(10) unsigned DEFAULT NULL,
  `requested_by` int(10) unsigned NOT NULL,
  `amount_requested` decimal(14,2) NOT NULL,
  `reason` text NOT NULL,
  `payment_type` enum('labour','site_material','design_material','mep_material','mobilisation_advance','material_advance','advance','running_account_bill','final_bill','retention_release','other') NOT NULL DEFAULT 'other',
  `status` enum('pending_pmc','pmc_approved','pmc_rejected','pending_principal','principal_approved','principal_rejected','paid') NOT NULL DEFAULT 'pending_pmc',
  `pmc_reviewed_by` int(10) unsigned DEFAULT NULL,
  `pmc_reviewed_at` datetime DEFAULT NULL,
  `pmc_amount` decimal(14,2) DEFAULT NULL,
  `pmc_notes` text DEFAULT NULL,
  `principal_reviewed_by` int(10) unsigned DEFAULT NULL,
  `principal_reviewed_at` datetime DEFAULT NULL,
  `principal_notes` text DEFAULT NULL,
  `actual_paid` decimal(14,2) DEFAULT NULL,
  `payment_date` date DEFAULT NULL,
  `utr_number` varchar(50) DEFAULT NULL,
  `paid_by` int(10) unsigned DEFAULT NULL,
  `principal_override` tinyint(1) NOT NULL DEFAULT 0,
  `rs_override` tinyint(1) NOT NULL DEFAULT 0,
  `is_urgent` tinyint(1) NOT NULL DEFAULT 0,
  `is_adhoc` tinyint(1) NOT NULL DEFAULT 0,
  `adhoc_name` varchar(100) DEFAULT NULL,
  `adhoc_phone` varchar(15) DEFAULT NULL,
  `adhoc_gstin` varchar(15) DEFAULT NULL,
  `adhoc_pan` varchar(10) DEFAULT NULL,
  `adhoc_bank_account` varchar(20) DEFAULT NULL,
  `adhoc_bank_ifsc` varchar(11) DEFAULT NULL,
  `adhoc_upi_id` varchar(50) DEFAULT NULL,
  `adhoc_upi_qr_path` varchar(300) DEFAULT NULL,
  `payment_lane` enum('bank','upi','icici_bulk') NOT NULL DEFAULT 'icici_bulk',
  `invoice_override_reason` varchar(300) DEFAULT NULL,
  `gst_rate` decimal(5,2) NOT NULL DEFAULT 18.00,
  `hsn_code` varchar(20) DEFAULT NULL,
  `is_interstate` tinyint(1) NOT NULL DEFAULT 0,
  `schedule_compliant` tinyint(1) NOT NULL DEFAULT 0,
  `compliance_checked_by` int(10) unsigned DEFAULT NULL,
  `compliance_checked_at` datetime DEFAULT NULL,
  `work_done_pct` decimal(5,2) DEFAULT NULL,
  `raised_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
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
  CONSTRAINT `chk_pr_amount` CHECK (`amount_requested` > 0),
  CONSTRAINT `chk_pr_pmc_amount` CHECK (`pmc_amount` is null or `pmc_amount` > 0),
  CONSTRAINT `chk_pr_actual_paid` CHECK (`actual_paid` is null or `actual_paid` >= 0),
  CONSTRAINT `chk_pr_gst` CHECK (`gst_rate` between 0 and 50),
  CONSTRAINT `chk_pr_work_pct` CHECK (`work_done_pct` is null or `work_done_pct` between 0 and 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_requests`
--

LOCK TABLES `payment_requests` WRITE;
/*!40000 ALTER TABLE `payment_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `petty_cash_transactions`
--

DROP TABLE IF EXISTS `petty_cash_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `petty_cash_transactions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `txn_date` date NOT NULL,
  `description` varchar(300) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `txn_type` enum('spend','replenishment') NOT NULL DEFAULT 'spend',
  `category` enum('labour','material','site_expense','other') NOT NULL DEFAULT 'other',
  `bill_available` tinyint(1) NOT NULL DEFAULT 0,
  `file_path` varchar(500) DEFAULT NULL,
  `recorded_by` int(10) unsigned NOT NULL,
  `recorded_at` datetime NOT NULL DEFAULT current_timestamp(),
  `approved_by` int(10) unsigned DEFAULT NULL,
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
-- Dumping data for table `petty_cash_transactions`
--

LOCK TABLES `petty_cash_transactions` WRITE;
/*!40000 ALTER TABLE `petty_cash_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `petty_cash_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `photo_tags`
--

DROP TABLE IF EXISTS `photo_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `photo_tags` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `photo_id` int(10) unsigned NOT NULL,
  `task_id` int(10) unsigned DEFAULT NULL,
  `trade` varchar(50) DEFAULT NULL,
  `caption` varchar(500) DEFAULT NULL,
  `tagged_by` int(10) unsigned DEFAULT NULL,
  `tag_source` enum('ai','site_manager','pmc','design','services','principal') NOT NULL DEFAULT 'ai',
  `is_current` tinyint(1) NOT NULL DEFAULT 1,
  `ai_confidence` enum('low','medium','high') DEFAULT NULL,
  `ai_note` text DEFAULT NULL,
  `replaces_tag_id` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `tagged_by` (`tagged_by`),
  KEY `replaces_tag_id` (`replaces_tag_id`),
  KEY `idx_photo_tags_photo` (`photo_id`,`is_current`),
  KEY `idx_photo_tags_source` (`tag_source`),
  CONSTRAINT `fk_photo_tags_entity` FOREIGN KEY (`photo_id`) REFERENCES `entity_photos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `photo_tags_ibfk_2` FOREIGN KEY (`task_id`) REFERENCES `schedule_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `photo_tags_ibfk_3` FOREIGN KEY (`tagged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `photo_tags_ibfk_4` FOREIGN KEY (`replaces_tag_id`) REFERENCES `photo_tags` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `photo_tags`
--

LOCK TABLES `photo_tags` WRITE;
/*!40000 ALTER TABLE `photo_tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `photo_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `principal_direct_payments`
--

DROP TABLE IF EXISTS `principal_direct_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `principal_direct_payments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `payment_date` date NOT NULL,
  `payment_type` enum('upi','cash') NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `paid_to` varchar(200) NOT NULL,
  `description` varchar(300) NOT NULL,
  `upi_ref` varchar(100) DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `boq_head` varchar(100) DEFAULT NULL,
  `tagged_by` int(10) unsigned DEFAULT NULL,
  `recorded_by` int(10) unsigned NOT NULL,
  `recorded_at` datetime NOT NULL DEFAULT current_timestamp(),
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
-- Dumping data for table `principal_direct_payments`
--

LOCK TABLES `principal_direct_payments` WRITE;
/*!40000 ALTER TABLE `principal_direct_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `principal_direct_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `proforma_invoices`
--

DROP TABLE IF EXISTS `proforma_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `proforma_invoices` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `pi_number` varchar(30) NOT NULL,
  `fee_schedule_id` int(10) unsigned NOT NULL,
  `schedule_task_id` int(10) unsigned DEFAULT NULL,
  `amount_ex_gst` decimal(14,2) NOT NULL,
  `gst_pct` decimal(5,2) NOT NULL DEFAULT 18.00,
  `amount_gst` decimal(14,2) NOT NULL,
  `amount_total` decimal(14,2) NOT NULL,
  `status` enum('draft','sent','acknowledged','paid') NOT NULL DEFAULT 'draft',
  `raised_by` int(10) unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT current_timestamp(),
  `sent_at` datetime DEFAULT NULL,
  `acknowledged_at` datetime DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
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
  CONSTRAINT `chk_pi_amount_ex` CHECK (`amount_ex_gst` > 0),
  CONSTRAINT `chk_pi_gst` CHECK (`gst_pct` between 0 and 50),
  CONSTRAINT `chk_pi_amount_total` CHECK (`amount_total` >= `amount_ex_gst`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `proforma_invoices`
--

LOCK TABLES `proforma_invoices` WRITE;
/*!40000 ALTER TABLE `proforma_invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `proforma_invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_assignments`
--

DROP TABLE IF EXISTS `project_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_assignments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `role` varchar(30) NOT NULL DEFAULT 'member',
  `assigned_by` int(10) unsigned NOT NULL,
  `assigned_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_user` (`project_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `assigned_by` (`assigned_by`),
  CONSTRAINT `project_assignments_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_assignments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `project_assignments_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_assignments`
--

LOCK TABLES `project_assignments` WRITE;
/*!40000 ALTER TABLE `project_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_document_versions`
--

DROP TABLE IF EXISTS `project_document_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_document_versions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `document_id` int(10) unsigned NOT NULL,
  `version_number` int(10) unsigned NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_name` varchar(300) NOT NULL,
  `file_size_kb` int(10) unsigned NOT NULL DEFAULT 0,
  `mime_type` varchar(100) DEFAULT NULL,
  `change_note` varchar(500) DEFAULT NULL,
  `uploaded_by` int(10) unsigned NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_doc_version` (`document_id`,`version_number`),
  KEY `idx_document` (`document_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `project_document_versions_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `project_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_document_versions_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_document_versions`
--

LOCK TABLES `project_document_versions` WRITE;
/*!40000 ALTER TABLE `project_document_versions` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_document_versions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_documents`
--

DROP TABLE IF EXISTS `project_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_documents` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `title` varchar(300) DEFAULT NULL,
  `doc_date` date DEFAULT NULL,
  `doc_type` enum('appointment_letter','contract','po','challan','invoice','other') NOT NULL DEFAULT 'other',
  `category` enum('contract','drawing','quote','approval','statutory','invoice','photo','report','other') NOT NULL DEFAULT 'other',
  `file_path` varchar(500) NOT NULL,
  `file_name` varchar(300) DEFAULT NULL,
  `file_size_kb` int(10) unsigned NOT NULL DEFAULT 0,
  `current_version_number` int(10) unsigned NOT NULL DEFAULT 1,
  `latest_version_id` int(10) unsigned DEFAULT NULL,
  `is_classified` tinyint(1) NOT NULL DEFAULT 0,
  `notes` varchar(500) DEFAULT NULL,
  `uploaded_by` int(10) unsigned NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `project_documents_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_documents_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_documents`
--

LOCK TABLES `project_documents` WRITE;
/*!40000 ALTER TABLE `project_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `project_photos`
--

DROP TABLE IF EXISTS `project_photos`;
/*!50001 DROP VIEW IF EXISTS `project_photos`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `project_photos` AS SELECT
 1 AS `id`,
  1 AS `project_id`,
  1 AS `task_id`,
  1 AS `daily_report_id`,
  1 AS `photo_date`,
  1 AS `file_path`,
  1 AS `file_size_kb`,
  1 AS `caption`,
  1 AS `uploaded_by`,
  1 AS `source`,
  1 AS `uploaded_at`,
  1 AS `is_locked`,
  1 AS `locked_at`,
  1 AS `locked_by_report_id` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `project_pmc_assignments`
--

DROP TABLE IF EXISTS `project_pmc_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_pmc_assignments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `kind` enum('primary','backup') NOT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `effective_to_key` date GENERATED ALWAYS AS (coalesce(`effective_to`,'9999-12-31')) STORED,
  `assigned_by` int(10) unsigned NOT NULL,
  `assigned_at` datetime NOT NULL DEFAULT current_timestamp(),
  `note` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_kind_effective` (`project_id`,`kind`,`effective_to_key`),
  KEY `assigned_by` (`assigned_by`),
  KEY `idx_project_kind_active` (`project_id`,`kind`,`effective_to`),
  KEY `idx_user_active` (`user_id`,`effective_to`),
  CONSTRAINT `project_pmc_assignments_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_pmc_assignments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `project_pmc_assignments_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_pmc_assignments`
--

LOCK TABLES `project_pmc_assignments` WRITE;
/*!40000 ALTER TABLE `project_pmc_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_pmc_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_scope`
--

DROP TABLE IF EXISTS `project_scope`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_scope` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `scope_type` set('architecture','structure','mep','interior','pmc','other') NOT NULL,
  `sqft_area` decimal(12,2) DEFAULT NULL,
  `num_floors` int(10) unsigned DEFAULT NULL,
  `num_blocks` int(10) unsigned DEFAULT NULL,
  `description` text DEFAULT NULL,
  `requires_statutory_approvals` tinyint(1) NOT NULL DEFAULT 0,
  `dlp_months` int(10) unsigned NOT NULL DEFAULT 12,
  `planned_handover_date` date DEFAULT NULL,
  `retention_amount` decimal(14,2) DEFAULT NULL,
  `retention_due_date` date DEFAULT NULL,
  `petty_cash_limit` decimal(10,2) DEFAULT NULL,
  `petty_cash_txn_limit` decimal(10,2) DEFAULT NULL,
  `updated_by` int(10) unsigned NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_id` (`project_id`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `project_scope_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_scope_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_scope`
--

LOCK TABLES `project_scope` WRITE;
/*!40000 ALTER TABLE `project_scope` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_scope` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_setup_tracking`
--

DROP TABLE IF EXISTS `project_setup_tracking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_setup_tracking` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `checklist_item_id` int(10) unsigned NOT NULL,
  `is_complete` tinyint(1) DEFAULT 0,
  `completed_at` timestamp NULL DEFAULT NULL,
  `completed_by` int(10) unsigned DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
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
-- Dumping data for table `project_setup_tracking`
--

LOCK TABLES `project_setup_tracking` WRITE;
/*!40000 ALTER TABLE `project_setup_tracking` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_setup_tracking` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_slas`
--

DROP TABLE IF EXISTS `project_slas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_slas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `item_type` enum('grn','drawing','rfi','clearance','mom','pr') NOT NULL,
  `sla_days` int(11) NOT NULL,
  `updated_by` int(10) unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_item` (`project_id`,`item_type`),
  CONSTRAINT `project_slas_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_slas`
--

LOCK TABLES `project_slas` WRITE;
/*!40000 ALTER TABLE `project_slas` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_slas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `entity_id` int(10) unsigned NOT NULL DEFAULT 2,
  `billing_account` enum('primary','secondary') NOT NULL DEFAULT 'primary',
  `code` varchar(20) NOT NULL,
  `name` varchar(200) NOT NULL,
  `client` varchar(200) NOT NULL,
  `client_id` int(10) unsigned DEFAULT NULL,
  `location` varchar(200) NOT NULL,
  `site_lat` decimal(10,7) DEFAULT NULL,
  `site_lng` decimal(10,7) DEFAULT NULL,
  `project_type` enum('industrial','institutional','residential','commercial','infrastructure','interior') NOT NULL,
  `r0_start_date` date NOT NULL,
  `r0_end_date` date NOT NULL,
  `jurisdiction` varchar(100) DEFAULT NULL,
  `contract_value` decimal(14,2) DEFAULT NULL,
  `setup_template_id` int(10) unsigned DEFAULT 1,
  `payment_approval_threshold` decimal(14,2) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `completion_date` date DEFAULT NULL,
  `status` enum('initialising','active','on_hold','completed') NOT NULL DEFAULT 'initialising',
  `checklist_project_created` tinyint(1) NOT NULL DEFAULT 0,
  `checklist_design_register` tinyint(1) NOT NULL DEFAULT 0,
  `checklist_services_register` tinyint(1) NOT NULL DEFAULT 0,
  `checklist_design_boq` tinyint(1) NOT NULL DEFAULT 0,
  `checklist_services_boq` tinyint(1) NOT NULL DEFAULT 0,
  `checklist_schedule` tinyint(1) NOT NULL DEFAULT 0,
  `checklist_site_manager` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `payment_approval_authority` enum('principal_only','pmc_with_limit') NOT NULL DEFAULT 'principal_only',
  `pmc_approval_limit` decimal(10,4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `entity_id` (`entity_id`),
  KEY `client_id` (`client_id`),
  KEY `created_by` (`created_by`),
  KEY `fk_setup_template` (`setup_template_id`),
  CONSTRAINT `fk_setup_template` FOREIGN KEY (`setup_template_id`) REFERENCES `setup_checklist_templates` (`id`),
  CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`entity_id`) REFERENCES `company_entities` (`id`),
  CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `projects_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_proj_dates` CHECK (`r0_end_date` >= `r0_start_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_nav`
--

DROP TABLE IF EXISTS `role_nav`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_nav` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `role` varchar(30) NOT NULL,
  `bucket` enum('home','work','money','more','pending','strip') NOT NULL,
  `tab_key` varchar(40) NOT NULL,
  `sort_order` int(11) NOT NULL,
  `is_visible` tinyint(1) NOT NULL DEFAULT 1,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_tab` (`role`,`tab_key`),
  KEY `idx_role_bucket_sort` (`role`,`bucket`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=204 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_nav`
--

LOCK TABLES `role_nav` WRITE;
/*!40000 ALTER TABLE `role_nav` DISABLE KEYS */;
INSERT INTO `role_nav` VALUES (1,'principal','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (2,'principal','home','monthly',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (3,'principal','home','projects',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (4,'principal','home','project_detail',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (5,'principal','money','payments',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (6,'principal','money','vendors_master',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (7,'principal','money','budget',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (8,'principal','money','boq_mapping',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (9,'principal','money','client_boq',5,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (10,'principal','pending','pending',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (11,'principal','more','register',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (12,'principal','more','delegations',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (13,'principal','more','changes',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (14,'principal','more','weekly_health',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (15,'principal','more','users',7,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (16,'design_principal','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (17,'design_principal','home','monthly',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (18,'design_principal','home','projects',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (19,'design_principal','home','project_detail',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (20,'design_principal','money','payments',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (21,'design_principal','money','vendors_master',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (22,'design_principal','money','budget',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (23,'design_principal','money','boq_mapping',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (24,'design_principal','money','client_boq',5,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (25,'design_principal','pending','pending',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (26,'design_principal','more','register',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (27,'design_principal','more','delegations',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (28,'design_principal','more','changes',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (29,'design_principal','more','weekly_health',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (30,'design_principal','more','users',7,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (31,'pmc_head','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (32,'pmc_head','home','monthly',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (33,'pmc_head','home','project_detail',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (35,'pmc_head','work','issues',3,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (36,'pmc_head','work','meetings',4,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (37,'pmc_head','work','drawings',5,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (38,'pmc_head','work','register',6,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (39,'pmc_head','work','materials',7,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (40,'pmc_head','work','labour',8,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (41,'pmc_head','money','grn',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (42,'pmc_head','money','payments',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (43,'pmc_head','money','vendors',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (44,'pmc_head','money','vendors_master',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (45,'pmc_head','pending','pending',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (46,'design_head','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (47,'design_head','home','monthly',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (48,'design_head','home','project_detail',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (49,'design_head','work','drawings',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (50,'design_head','work','issues',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (51,'design_head','work','submittals',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (52,'design_head','work','register',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (53,'design_head','work','phototags',5,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (54,'design_head','money','materials',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (55,'design_head','money','budget',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (56,'design_head','money','payments',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (57,'design_head','more','signoff',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (58,'design_head','more','delegations',4,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (59,'services_head','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (60,'services_head','home','monthly',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (61,'services_head','home','project_detail',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (62,'services_head','work','drawings',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (63,'services_head','work','issues',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (64,'services_head','work','submittals',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (65,'services_head','work','register',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (66,'services_head','work','phototags',5,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (67,'services_head','money','materials',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (68,'services_head','money','budget',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (69,'services_head','money','payments',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (70,'services_head','more','signoff',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (71,'services_head','more','delegations',4,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (72,'site_manager','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (73,'site_manager','home','project_detail',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (74,'site_manager','work','tasks',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (75,'site_manager','work','photos',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (76,'site_manager','work','issues_site',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (77,'site_manager','work','issues',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (78,'site_manager','work','labour',5,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (79,'site_manager','work','drawings',6,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (80,'site_manager','work','register',7,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (81,'site_manager','money','grn',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (82,'site_manager','money','payments',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (83,'site_manager','money','materials_site',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (84,'senior_site_manager','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (85,'senior_site_manager','home','project_detail',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (86,'senior_site_manager','work','tasks',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (87,'senior_site_manager','work','photos',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (88,'senior_site_manager','work','issues_site',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (89,'senior_site_manager','work','issues',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (90,'senior_site_manager','work','labour',5,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (91,'senior_site_manager','work','drawings',6,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (92,'senior_site_manager','work','register',7,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (93,'senior_site_manager','money','grn',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (94,'senior_site_manager','money','payments',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (95,'senior_site_manager','money','materials_site',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (96,'finance_admin','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (97,'finance_admin','home','monthly',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (98,'finance_admin','home','project_detail',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (99,'finance_admin','money','payments_fin',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (100,'finance_admin','money','vendors_master',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (101,'finance_admin','money','client_receipts',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (102,'finance_admin','money','petty_cash',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (103,'finance_admin','money','pi',5,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (104,'finance_admin','money','gst_statement',6,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (105,'finance_admin','money','client_boq',7,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (106,'finance_admin','money','clients',8,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (107,'team_lead','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (108,'team_lead','home','project_detail',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (109,'team_lead','work','drawings',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (110,'team_lead','work','register',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (111,'team_lead','work','issues',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (112,'team_lead','work','submittals',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (113,'team_lead','work','phototags',5,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (114,'detailing_head','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (115,'detailing_head','home','project_detail',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (116,'detailing_head','work','drawings',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (117,'detailing_head','work','issues',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (118,'detailing_head','work','register',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (119,'detailing_head','work','submittals',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (121,'jr_architect','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (122,'jr_architect','home','project_detail',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (123,'jr_architect','work','drawings',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (124,'jr_architect','work','issues',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (125,'jr_architect','work','submittals',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (126,'services_engineer','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (127,'services_engineer','home','project_detail',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (128,'services_engineer','work','drawings',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (129,'services_engineer','work','issues',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (130,'services_engineer','work','submittals',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (131,'services_engineer','work','phototags',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (132,'coordinator','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (133,'coordinator','home','project_detail',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (134,'coordinator','work','meetings',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (135,'coordinator','work','tasks',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (136,'coordinator','work','issues',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (137,'coordinator','work','drawings',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (138,'coordinator','work','register',5,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (139,'coordinator','work','photos',6,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (140,'coordinator','work','grn',7,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (141,'trainee','strip','drawings',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (142,'trainee','strip','schedule_view',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (143,'detailing','strip','drawings',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (144,'detailing','strip','submittals',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (145,'audit','home','dashboard',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (146,'audit','home','monthly',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (147,'audit','home','projects',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (148,'audit','home','project_detail',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (149,'audit','money','payments',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (150,'audit','money','payments_fin',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (151,'audit','money','vendors',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (152,'audit','money','vendors_master',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (153,'audit','money','finance_clearance',5,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (154,'audit','money','budget',6,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (155,'audit','money','budget_tree',7,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (156,'audit','money','boq_mapping',8,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (157,'audit','money','client_boq',9,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (158,'audit','money','materials',10,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (159,'audit','money','grn',11,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (160,'audit','money','pi',12,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (161,'audit','money','petty_cash',13,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (162,'audit','money','client_receipts',14,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (163,'audit','money','gst_statement',15,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (164,'audit','money','clients',16,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (165,'audit','pending','pending',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (166,'audit','more','register',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (167,'audit','more','drawings',2,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (168,'audit','more','submittals',3,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (169,'audit','more','issues',4,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (170,'audit','more','issues_site',5,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (171,'audit','more','tasks',6,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (172,'audit','more','photos',7,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (173,'audit','more','phototags',8,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (174,'audit','more','meetings',9,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (176,'audit','more','labour',12,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (177,'audit','more','schedule_view',13,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (178,'audit','more','approvals',14,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (179,'audit','more','signoff',15,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (180,'audit','more','changes',16,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (181,'audit','more','delegations',17,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (183,'audit','more','weekly_health',19,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (184,'audit','more','users',20,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (185,'audit','more','ncr',21,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (186,'audit','more','compliance',22,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (187,'audit','more','tally',23,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (188,'audit','more','notifications',24,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (189,'it_admin','home','nav_editor',1,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (190,'principal','more','governance',50,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (191,'design_principal','more','governance',50,1,'2026-04-28 08:51:54');
INSERT INTO `role_nav` VALUES (192,'pmc_head','work','reports_daily',1,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (193,'pmc_head','work','reports_weekly',2,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (194,'audit','more','reports_daily',10,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (195,'audit','more','reports_weekly',11,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (196,'design_head','more','reports_daily',2,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (197,'design_head','more','reports_weekly',3,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (198,'services_head','more','reports_daily',2,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (199,'services_head','more','reports_weekly',3,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (200,'principal','more','reports_daily',5,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (201,'principal','more','reports_weekly',6,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (202,'design_principal','more','reports_daily',5,1,'2026-04-28 08:51:55');
INSERT INTO `role_nav` VALUES (203,'design_principal','more','reports_weekly',6,1,'2026-04-28 08:51:55');
/*!40000 ALTER TABLE `role_nav` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_nav_audit`
--

DROP TABLE IF EXISTS `role_nav_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_nav_audit` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `draft_group_id` int(10) unsigned NOT NULL,
  `role` varchar(40) NOT NULL,
  `action` enum('approved','rejected') NOT NULL,
  `proposed_by` int(10) unsigned NOT NULL,
  `reviewed_by` int(10) unsigned NOT NULL,
  `reviewed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `snapshot_json` text NOT NULL,
  `reject_reason` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `proposed_by` (`proposed_by`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_nav_audit_role` (`role`),
  CONSTRAINT `role_nav_audit_ibfk_1` FOREIGN KEY (`proposed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `role_nav_audit_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_nav_audit`
--

LOCK TABLES `role_nav_audit` WRITE;
/*!40000 ALTER TABLE `role_nav_audit` DISABLE KEYS */;
/*!40000 ALTER TABLE `role_nav_audit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_nav_drafts`
--

DROP TABLE IF EXISTS `role_nav_drafts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_nav_drafts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `draft_group_id` int(10) unsigned NOT NULL,
  `role` varchar(40) NOT NULL,
  `bucket` enum('home','work','money','more','pending','strip') NOT NULL,
  `tab_key` varchar(40) NOT NULL,
  `sort_order` tinyint(3) unsigned NOT NULL,
  `is_visible` tinyint(1) NOT NULL DEFAULT 1,
  `proposed_by` int(10) unsigned NOT NULL,
  `proposed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `status` enum('pending_principal','approved','rejected') NOT NULL DEFAULT 'pending_principal',
  `reviewed_by` int(10) unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `reject_reason` text DEFAULT NULL,
  `note` text DEFAULT NULL,
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
-- Dumping data for table `role_nav_drafts`
--

LOCK TABLES `role_nav_drafts` WRITE;
/*!40000 ALTER TABLE `role_nav_drafts` DISABLE KEYS */;
/*!40000 ALTER TABLE `role_nav_drafts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `role` varchar(50) NOT NULL,
  `action` varchar(100) NOT NULL,
  `level` enum('W','R','A','') NOT NULL DEFAULT '',
  `group_name` varchar(50) NOT NULL,
  `label` varchar(200) NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_action` (`role`,`action`),
  KEY `idx_action` (`action`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=243 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,'principal','finance.petty-cash.read','R','Finance','View petty cash','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (2,'design_principal','finance.petty-cash.read','R','Finance','View petty cash','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (3,'pmc_head','finance.petty-cash.read','R','Finance','View petty cash','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (4,'finance_admin','finance.petty-cash.read','R','Finance','View petty cash','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (5,'design_head','finance.petty-cash.read','R','Finance','View petty cash','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (6,'services_head','finance.petty-cash.read','R','Finance','View petty cash','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (7,'principal','finance.petty-cash.write','W','Finance','Create petty cash entry','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (8,'design_principal','finance.petty-cash.write','W','Finance','Create petty cash entry','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (9,'pmc_head','finance.petty-cash.write','W','Finance','Create petty cash entry','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (10,'principal','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (11,'design_principal','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (12,'pmc_head','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (13,'finance_admin','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (14,'principal','finance.client-receipt.read','R','Finance','View client receipts','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (15,'design_principal','finance.client-receipt.read','R','Finance','View client receipts','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (16,'pmc_head','finance.client-receipt.read','R','Finance','View client receipts','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (17,'finance_admin','finance.client-receipt.read','R','Finance','View client receipts','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (18,'design_head','finance.client-receipt.read','R','Finance','View client receipts','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (19,'services_head','finance.client-receipt.read','R','Finance','View client receipts','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (20,'principal','finance.payment-request.write','W','Finance','Raise payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (21,'design_principal','finance.payment-request.write','W','Finance','Raise payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (22,'pmc_head','finance.payment-request.write','W','Finance','Raise payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (23,'design_head','finance.payment-request.write','W','Finance','Raise payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (24,'services_head','finance.payment-request.write','W','Finance','Raise payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (25,'finance_admin','finance.payment-request.write','W','Finance','Raise payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (26,'site_manager','finance.payment-request.write','W','Finance','Raise payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (27,'senior_site_manager','finance.payment-request.write','W','Finance','Raise payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (28,'principal','finance.payment-request.approve-pmc','A','Finance','PMC approve payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (29,'design_principal','finance.payment-request.approve-pmc','A','Finance','PMC approve payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (30,'pmc_head','finance.payment-request.approve-pmc','A','Finance','PMC approve payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (31,'principal','finance.payment-request.approve-principal','A','Finance','Principal approve payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (32,'design_principal','finance.payment-request.approve-principal','A','Finance','Principal approve payment request','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (33,'principal','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (34,'design_principal','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (35,'pmc_head','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (36,'site_manager','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (37,'senior_site_manager','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (38,'finance_admin','finance.vendor-clearance.approve','A','Finance','Clear vendor','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (39,'principal','finance.vendor-pan.approve','A','Finance','Validate vendor PAN','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (40,'design_principal','finance.vendor-pan.approve','A','Finance','Validate vendor PAN','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (41,'finance_admin','finance.vendor-pan.approve','A','Finance','Validate vendor PAN','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (42,'principal','claims.raise','W','Services','Raise claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (43,'design_principal','claims.raise','W','Services','Raise claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (44,'pmc_head','claims.raise','W','Services','Raise claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (45,'principal','claims.pmc-signoff','A','Services','PMC sign-off claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (46,'design_principal','claims.pmc-signoff','A','Services','PMC sign-off claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (47,'pmc_head','claims.pmc-signoff','A','Services','PMC sign-off claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (48,'principal','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (49,'design_principal','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (50,'design_head','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (51,'services_head','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (52,'principal','claims.approve','A','Services','Approve claim (final)','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (53,'design_principal','claims.approve','A','Services','Approve claim (final)','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (54,'principal','claims.invoice','W','Services','Record invoice number on claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (55,'design_principal','claims.invoice','W','Services','Record invoice number on claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (56,'pmc_head','claims.invoice','W','Services','Record invoice number on claim','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (57,'principal','governance.change-notice.raise','W','Governance','Raise change notice','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (58,'design_principal','governance.change-notice.raise','W','Governance','Raise change notice','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (59,'principal','governance.change-notice.approve','A','Governance','Approve change notice','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (60,'design_principal','governance.change-notice.approve','A','Governance','Approve change notice','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (61,'principal','governance.weekly-report.send','A','Governance','Mark weekly report sent to client','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (62,'design_principal','governance.weekly-report.send','A','Governance','Mark weekly report sent to client','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (63,'principal','governance.anomaly.acknowledge','A','Governance','Acknowledge AI anomaly flag','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (64,'design_principal','governance.anomaly.acknowledge','A','Governance','Acknowledge AI anomaly flag','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (65,'pmc_head','governance.anomaly.acknowledge','A','Governance','Acknowledge AI anomaly flag','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (66,'principal','admin.user.initiate','W','Admin','Initiate new user','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (67,'design_principal','admin.user.initiate','W','Admin','Initiate new user','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (68,'pmc_head','admin.user.initiate','W','Admin','Initiate new user','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (69,'design_head','admin.user.initiate','W','Admin','Initiate new user','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (70,'services_head','admin.user.initiate','W','Admin','Initiate new user','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (71,'principal','admin.user.approve','A','Admin','Approve new user','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (72,'design_principal','admin.user.approve','A','Admin','Approve new user','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (73,'principal','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (74,'design_principal','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (75,'pmc_head','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (76,'design_head','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (77,'services_head','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (78,'finance_admin','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (79,'principal','admin.nav.approve','A','Admin','Edit nav / role tabs','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (80,'it_admin','admin.nav.propose','W','Admin','Propose nav / role tab changes','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (81,'principal','admin.password-reset','W','Admin','Reset another user password (unrestricted)','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (82,'design_principal','admin.password-reset','W','Admin','Reset another user password (unrestricted)','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (83,'it_admin','admin.password-reset','W','Admin','Reset another user password (unrestricted)','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (84,'finance_admin','finance.payment-request.mark-paid','A','Finance','Mark payment request as paid','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (85,'principal','finance.payment-request.mark-paid','A','Finance','Mark payment request as paid','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (86,'design_principal','finance.payment-request.mark-paid','A','Finance','Mark payment request as paid','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (87,'finance_admin','finance.payment.pre-upload-check','A','Finance','Pre-upload payment validation','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (88,'principal','finance.payment.pre-upload-check','A','Finance','Pre-upload payment validation','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (89,'design_principal','finance.payment.pre-upload-check','A','Finance','Pre-upload payment validation','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (90,'pmc_head','pmc.issue.close-resolved','A','PMC / Site','Close resolved issue','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (91,'principal','pmc.issue.close-resolved','A','PMC / Site','Close resolved issue','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (92,'design_principal','pmc.issue.close-resolved','A','PMC / Site','Close resolved issue','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (93,'pmc_head','pmc.issue.reactivate','A','PMC / Site','Reopen closed issue','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (94,'principal','pmc.issue.reactivate','A','PMC / Site','Reopen closed issue','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (95,'design_principal','pmc.issue.reactivate','A','PMC / Site','Reopen closed issue','2026-04-28 08:51:54',NULL);
INSERT INTO `role_permissions` VALUES (121,'pmc_head','pmc.handover.checklist-init','A','PMC / Site','Initialise handover checklist','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (122,'design_head','pmc.handover.checklist-init','A','PMC / Site','Initialise handover checklist','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (123,'services_head','pmc.handover.checklist-init','A','PMC / Site','Initialise handover checklist','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (124,'principal','pmc.handover.checklist-init','A','PMC / Site','Initialise handover checklist','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (125,'design_principal','pmc.handover.checklist-init','A','PMC / Site','Initialise handover checklist','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (126,'design_head','pmc.handover.checklist-upload','A','PMC / Site','Upload handover document','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (127,'services_head','pmc.handover.checklist-upload','A','PMC / Site','Upload handover document','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (128,'pmc_head','pmc.handover.checklist-upload','A','PMC / Site','Upload handover document','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (129,'principal','pmc.handover.checklist-upload','A','PMC / Site','Upload handover document','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (130,'design_principal','pmc.handover.checklist-upload','A','PMC / Site','Upload handover document','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (131,'pmc_head','pmc.handover.closure-signoff','A','PMC / Site','Sign off project closure','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (132,'design_head','pmc.handover.closure-signoff','A','PMC / Site','Sign off project closure','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (133,'services_head','pmc.handover.closure-signoff','A','PMC / Site','Sign off project closure','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (134,'principal','pmc.handover.closure-signoff','A','PMC / Site','Sign off project closure','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (135,'design_principal','pmc.handover.closure-signoff','A','PMC / Site','Sign off project closure','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (136,'principal','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (137,'design_principal','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (138,'design_head','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (139,'services_head','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (140,'pmc_head','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (141,'team_lead','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (142,'jr_architect','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (143,'detailing_head','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (144,'detailing','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (145,'services_engineer','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (146,'site_manager','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (147,'senior_site_manager','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (148,'coordinator','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (149,'trainee','pmc.lessons.input-write','A','PMC / Site','Write lessons-learned input','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (150,'principal','pmc.lessons.report-view','A','PMC / Site','View consolidated lessons report','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (151,'design_principal','pmc.lessons.report-view','A','PMC / Site','View consolidated lessons report','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (152,'pmc_head','pmc.lessons.report-view','A','PMC / Site','View consolidated lessons report','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (153,'design_head','pmc.lessons.report-view','A','PMC / Site','View consolidated lessons report','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (154,'services_head','pmc.lessons.report-view','A','PMC / Site','View consolidated lessons report','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (155,'principal','pmc.lessons.publish','A','PMC / Site','Publish lessons to firm Knowledge Library','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (156,'design_principal','pmc.lessons.publish','A','PMC / Site','Publish lessons to firm Knowledge Library','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (157,'principal','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (158,'design_principal','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (159,'design_head','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (160,'services_head','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (161,'pmc_head','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (162,'team_lead','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (163,'jr_architect','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (164,'detailing_head','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (165,'detailing','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (166,'services_engineer','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (167,'site_manager','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (168,'senior_site_manager','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (169,'coordinator','pmc.issue.snag-raise','A','PMC / Site','Raise DLP defect','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (170,'pmc_head','pmc.issue.snag-resolve','A','PMC / Site','Mark defect as fixed','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (171,'site_manager','pmc.issue.snag-resolve','A','PMC / Site','Mark defect as fixed','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (172,'senior_site_manager','pmc.issue.snag-resolve','A','PMC / Site','Mark defect as fixed','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (173,'principal','pmc.issue.snag-resolve','A','PMC / Site','Mark defect as fixed','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (174,'design_principal','pmc.issue.snag-resolve','A','PMC / Site','Mark defect as fixed','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (175,'design_head','pmc.issue.snag-resolve','A','PMC / Site','Mark defect as fixed','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (176,'services_head','pmc.issue.snag-resolve','A','PMC / Site','Mark defect as fixed','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (177,'pmc_head','pmc.issue.snag-signoff','A','PMC / Site','Sign off resolved snag','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (178,'design_head','pmc.issue.snag-signoff','A','PMC / Site','Sign off resolved snag','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (179,'services_head','pmc.issue.snag-signoff','A','PMC / Site','Sign off resolved snag','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (180,'principal','pmc.issue.snag-signoff','A','PMC / Site','Sign off resolved snag','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (181,'design_principal','pmc.issue.snag-signoff','A','PMC / Site','Sign off resolved snag','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (182,'principal','pmc.measurement.create','A','PMC / Site','Create measurement / RA bill','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (183,'design_principal','pmc.measurement.create','A','PMC / Site','Create measurement / RA bill','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (184,'pmc_head','pmc.measurement.create','A','PMC / Site','Create measurement / RA bill','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (185,'design_head','pmc.measurement.create','A','PMC / Site','Create measurement / RA bill','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (186,'services_head','pmc.measurement.create','A','PMC / Site','Create measurement / RA bill','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (187,'principal','pmc.measurement.add-items','A','PMC / Site','Add measured quantities to RA bill','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (188,'design_principal','pmc.measurement.add-items','A','PMC / Site','Add measured quantities to RA bill','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (189,'pmc_head','pmc.measurement.add-items','A','PMC / Site','Add measured quantities to RA bill','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (190,'design_head','pmc.measurement.add-items','A','PMC / Site','Add measured quantities to RA bill','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (191,'services_head','pmc.measurement.add-items','A','PMC / Site','Add measured quantities to RA bill','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (192,'principal','finance.client-boq.edit-rate','A','Finance','Edit client BOQ rate','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (193,'design_principal','finance.client-boq.edit-rate','A','Finance','Edit client BOQ rate','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (194,'pmc_head','finance.client-boq.edit-rate','A','Finance','Edit client BOQ rate','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (195,'design_head','finance.client-boq.edit-rate','A','Finance','Edit client BOQ rate','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (196,'services_head','finance.client-boq.edit-rate','A','Finance','Edit client BOQ rate','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (197,'principal','finance.client-boq.edit-hsn','A','Finance','Edit client BOQ HSN','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (198,'design_principal','finance.client-boq.edit-hsn','A','Finance','Edit client BOQ HSN','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (199,'pmc_head','finance.client-boq.edit-hsn','A','Finance','Edit client BOQ HSN','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (200,'design_head','finance.client-boq.edit-hsn','A','Finance','Edit client BOQ HSN','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (201,'services_head','finance.client-boq.edit-hsn','A','Finance','Edit client BOQ HSN','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (202,'principal','onboarding.project-setup.edit-scope','A','Onboarding','Edit project setup scope','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (203,'design_principal','onboarding.project-setup.edit-scope','A','Onboarding','Edit project setup scope','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (204,'pmc_head','onboarding.project-setup.edit-scope','A','Onboarding','Edit project setup scope','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (205,'design_head','onboarding.project-setup.edit-scope','A','Onboarding','Edit project setup scope','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (206,'services_head','onboarding.project-setup.edit-scope','A','Onboarding','Edit project setup scope','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (207,'principal','workflow.submittal.review','A','Workflow','Review submittal','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (208,'design_principal','workflow.submittal.review','A','Workflow','Review submittal','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (209,'pmc_head','workflow.submittal.review','A','Workflow','Review submittal','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (210,'design_head','workflow.submittal.review','A','Workflow','Review submittal','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (211,'services_head','workflow.submittal.review','A','Workflow','Review submittal','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (212,'principal','onboarding.boq.upload','A','Onboarding','Upload BOQ','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (213,'design_principal','onboarding.boq.upload','A','Onboarding','Upload BOQ','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (214,'design_head','onboarding.boq.upload','A','Onboarding','Upload BOQ','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (215,'services_head','onboarding.boq.upload','A','Onboarding','Upload BOQ','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (216,'principal','finance.payment.bulk-batch-export','A','Finance','Export ICICI bulk-payment batch','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (217,'design_principal','finance.payment.bulk-batch-export','A','Finance','Export ICICI bulk-payment batch','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (218,'pmc_head','finance.payment.bulk-batch-export','A','Finance','Export ICICI bulk-payment batch','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (219,'finance_admin','finance.payment.bulk-batch-export','A','Finance','Export ICICI bulk-payment batch','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (220,'audit','finance.payment.bulk-batch-export','A','Finance','Export ICICI bulk-payment batch','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (221,'principal','clients.read','R','Onboarding','Read client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (222,'design_principal','clients.read','R','Onboarding','Read client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (223,'pmc_head','clients.read','R','Onboarding','Read client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (224,'design_head','clients.read','R','Onboarding','Read client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (225,'services_head','clients.read','R','Onboarding','Read client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (226,'finance_admin','clients.read','R','Onboarding','Read client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (227,'it_admin','clients.read','R','Onboarding','Read client master (for IT support diagnostics)','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (228,'principal','clients.create','W','Onboarding','Create / edit client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (229,'design_principal','clients.create','W','Onboarding','Create / edit client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (230,'finance_admin','clients.create','W','Onboarding','Create / edit client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (231,'principal','clients.bulk_upload','W','Onboarding','Bulk upload client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (232,'design_principal','clients.bulk_upload','W','Onboarding','Bulk upload client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (233,'finance_admin','clients.bulk_upload','W','Onboarding','Bulk upload client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (234,'principal','clients.edit','W','Onboarding','Edit client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (235,'design_principal','clients.edit','W','Onboarding','Edit client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (236,'finance_admin','clients.edit','W','Onboarding','Edit client master','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (237,'it_admin','system.users.read','R','Admin','View users','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (238,'it_admin','system.audit.read','R','Admin','View audit log','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (239,'it_admin','system.troubleshoot.read','R','Admin','Read project data for troubleshooting','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (240,'principal','users.bulk_upload','W','Admin','Bulk upload users','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (241,'design_principal','users.bulk_upload','W','Admin','Bulk upload users','2026-04-28 08:51:55',NULL);
INSERT INTO `role_permissions` VALUES (242,'pmc_head','users.bulk_upload','W','Admin','Bulk upload users','2026-04-28 08:51:55',NULL);
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schedule_risk_narratives`
--

DROP TABLE IF EXISTS `schedule_risk_narratives`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule_risk_narratives` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `trade` varchar(50) NOT NULL,
  `week_ending` date NOT NULL,
  `planned_pct` decimal(5,2) NOT NULL,
  `actual_pct` decimal(5,2) NOT NULL,
  `gap_pct` decimal(5,2) NOT NULL,
  `weeks_behind` decimal(4,1) NOT NULL DEFAULT 0.0,
  `forecast_delay` decimal(4,1) NOT NULL DEFAULT 0.0,
  `narrative` text NOT NULL,
  `escalation_level` enum('amber','red','critical') NOT NULL DEFAULT 'amber',
  `notified_pmc` tinyint(1) NOT NULL DEFAULT 0,
  `notified_principal` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_trade_week` (`project_id`,`trade`,`week_ending`),
  CONSTRAINT `schedule_risk_narratives_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_risk_narratives`
--

LOCK TABLES `schedule_risk_narratives` WRITE;
/*!40000 ALTER TABLE `schedule_risk_narratives` DISABLE KEYS */;
/*!40000 ALTER TABLE `schedule_risk_narratives` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schedule_tasks`
--

DROP TABLE IF EXISTS `schedule_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule_tasks` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `schedule_version_id` int(10) unsigned NOT NULL,
  `trade` varchar(50) NOT NULL,
  `task_name` varchar(300) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `depends_on_task_id` int(10) unsigned DEFAULT NULL,
  `is_milestone` tinyint(1) NOT NULL DEFAULT 0,
  `is_payment_milestone` tinyint(1) NOT NULL DEFAULT 0,
  `milestone_type` enum('schedule','payment','both','none') NOT NULL DEFAULT 'none',
  `milestone_label` varchar(200) DEFAULT NULL,
  `display_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `schedule_version_id` (`schedule_version_id`),
  KEY `depends_on_task_id` (`depends_on_task_id`),
  KEY `idx_schedule_tasks_project` (`project_id`,`schedule_version_id`),
  CONSTRAINT `schedule_tasks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `schedule_tasks_ibfk_2` FOREIGN KEY (`schedule_version_id`) REFERENCES `schedule_versions` (`id`),
  CONSTRAINT `schedule_tasks_ibfk_3` FOREIGN KEY (`depends_on_task_id`) REFERENCES `schedule_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_st_dates` CHECK (`end_date` >= `start_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_tasks`
--

LOCK TABLES `schedule_tasks` WRITE;
/*!40000 ALTER TABLE `schedule_tasks` DISABLE KEYS */;
/*!40000 ALTER TABLE `schedule_tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schedule_versions`
--

DROP TABLE IF EXISTS `schedule_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule_versions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `row_version` int(10) unsigned NOT NULL DEFAULT 1,
  `project_id` int(10) unsigned NOT NULL,
  `version_number` int(10) unsigned NOT NULL DEFAULT 0,
  `label` varchar(10) NOT NULL,
  `end_date` date NOT NULL,
  `drift_days` int(11) NOT NULL DEFAULT 0,
  `status` enum('draft','pending_approval','approved','rejected') NOT NULL DEFAULT 'draft',
  `reason` text DEFAULT NULL,
  `uploaded_by` int(10) unsigned NOT NULL,
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_note` text DEFAULT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 0,
  `drift_acknowledged` tinyint(1) NOT NULL DEFAULT 0,
  `drift_acknowledged_by` int(10) unsigned DEFAULT NULL,
  `drift_acknowledged_at` datetime DEFAULT NULL,
  `drift_mitigation` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_schedule_version` (`project_id`,`version_number`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `approved_by` (`approved_by`),
  KEY `drift_acknowledged_by` (`drift_acknowledged_by`),
  KEY `idx_schedule_versions_proj_status` (`project_id`,`status`),
  CONSTRAINT `schedule_versions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `schedule_versions_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `schedule_versions_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `schedule_versions_ibfk_4` FOREIGN KEY (`drift_acknowledged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_versions`
--

LOCK TABLES `schedule_versions` WRITE;
/*!40000 ALTER TABLE `schedule_versions` DISABLE KEYS */;
/*!40000 ALTER TABLE `schedule_versions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `setup_checklist_items`
--

DROP TABLE IF EXISTS `setup_checklist_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `setup_checklist_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int(10) unsigned NOT NULL,
  `task_name` varchar(200) NOT NULL,
  `task_description` text DEFAULT NULL,
  `task_category` varchar(50) DEFAULT NULL,
  `owner_role` varchar(50) NOT NULL,
  `is_mandatory` tinyint(1) DEFAULT 1,
  `blocks_operations` tinyint(1) DEFAULT 0,
  `validation_type` varchar(50) DEFAULT NULL,
  `validation_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`validation_config`)),
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_template` (`template_id`),
  KEY `idx_category` (`task_category`),
  KEY `idx_owner` (`owner_role`),
  CONSTRAINT `setup_checklist_items_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `setup_checklist_templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `setup_checklist_items`
--

LOCK TABLES `setup_checklist_items` WRITE;
/*!40000 ALTER TABLE `setup_checklist_items` DISABLE KEYS */;
INSERT INTO `setup_checklist_items` VALUES (1,1,'Project Team Assigned','Assign PMC Head, Design Head, Services Head, and Site Manager to project','core','principal',1,1,'sql_query','{\"query\": \"SELECT COUNT(DISTINCT role) FROM project_assignments WHERE project_id = ? AND is_active = 1 AND role IN (\'pmc_head\',\'design_head\',\'services_head\',\'site_manager\')\"}',1,'2026-04-28 08:51:55','2026-04-28 08:51:55');
INSERT INTO `setup_checklist_items` VALUES (2,1,'Client Details Complete','Verify client has GSTIN, PAN, and bank account for billing','core','principal',1,1,'field_populated','{\"table\": \"clients\", \"fields\": [\"gstin\", \"pan_number\", \"bank_account\", \"bank_ifsc\"]}',2,'2026-04-28 08:51:55','2026-04-28 08:51:55');
INSERT INTO `setup_checklist_items` VALUES (3,1,'Internal BOQ Uploaded','Upload project materials BOQ with items, quantities, and units','boq','pmc_head',1,1,'row_count','{\"table\": \"boq_versions\", \"min_count\": 1}',10,'2026-04-28 08:51:55','2026-04-28 08:51:55');
INSERT INTO `setup_checklist_items` VALUES (4,1,'BOQ Has Items','BOQ must contain at least 1 line item','boq','pmc_head',1,1,'row_count','{\"table\": \"boq_items\", \"min_count\": 1}',11,'2026-04-28 08:51:55','2026-04-28 08:51:55');
INSERT INTO `setup_checklist_items` VALUES (5,1,'Client BOQ Uploaded','Upload client billing BOQ with package-level items and rates','boq','pmc_head',1,1,'row_count','{\"table\": \"client_boq_items\", \"min_count\": 1}',12,'2026-04-28 08:51:55','2026-04-28 08:51:55');
INSERT INTO `setup_checklist_items` VALUES (6,1,'Vendors Cleared','At least 1 vendor must be cleared through finance','vendors','pmc_head',1,1,'sql_query','{\"query\": \"SELECT COUNT(*) FROM vendors WHERE clearance_status = \'approved\'\"}',20,'2026-04-28 08:51:55','2026-04-28 08:51:55');
INSERT INTO `setup_checklist_items` VALUES (7,1,'Vendor Engagements Approved','At least 1 vendor engagement must be approved','vendors','principal',1,1,'sql_query','{\"query\": \"SELECT COUNT(*) FROM vendor_engagements WHERE project_id = ? AND approval_status = \'approved\'\"}',21,'2026-04-28 08:51:55','2026-04-28 08:51:55');
INSERT INTO `setup_checklist_items` VALUES (8,1,'BOQ Vendor Mapping Complete','Map BOQ items to vendor engagements (required for payments)','vendors','pmc_head',1,1,'row_count','{\"table\": \"vendor_boq_mapping\", \"min_count\": 1}',22,'2026-04-28 08:51:55','2026-04-28 08:51:55');
INSERT INTO `setup_checklist_items` VALUES (9,1,'Drawing Register Initialized (Design)','Initialize drawing register with design stream drawings','drawings','design_head',0,0,'sql_query','{\"query\": \"SELECT COUNT(*) FROM drawing_register WHERE project_id = ? AND stream = \'design\'\"}',30,'2026-04-28 08:51:55','2026-04-28 08:51:55');
INSERT INTO `setup_checklist_items` VALUES (10,1,'Drawing Register Initialized (Services)','Initialize drawing register with services stream drawings','drawings','services_head',0,0,'sql_query','{\"query\": \"SELECT COUNT(*) FROM drawing_register WHERE project_id = ? AND stream = \'services\'\"}',31,'2026-04-28 08:51:55','2026-04-28 08:51:55');
INSERT INTO `setup_checklist_items` VALUES (11,1,'R0 Schedule Baselined','Upload baseline schedule (version 1)','schedule','pmc_head',1,1,'sql_query','{\"query\": \"SELECT COUNT(*) FROM schedule_versions WHERE project_id = ? AND version_number = 1\"}',40,'2026-04-28 08:51:55','2026-04-28 08:51:55');
INSERT INTO `setup_checklist_items` VALUES (12,1,'Schedule Has Tasks','Schedule must contain at least 1 task','schedule','pmc_head',1,1,'row_count','{\"table\": \"schedule_tasks\", \"min_count\": 1}',41,'2026-04-28 08:51:55','2026-04-28 08:51:55');
INSERT INTO `setup_checklist_items` VALUES (13,1,'Budget Cost Heads Defined','Define budget cost heads for financial tracking (optional)','finance','finance_admin',0,0,'manual','{}',50,'2026-04-28 08:51:55','2026-04-28 08:51:55');
/*!40000 ALTER TABLE `setup_checklist_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `setup_checklist_templates`
--

DROP TABLE IF EXISTS `setup_checklist_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `setup_checklist_templates` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `template_name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `template_name` (`template_name`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `setup_checklist_templates_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `setup_checklist_templates`
--

LOCK TABLES `setup_checklist_templates` WRITE;
/*!40000 ALTER TABLE `setup_checklist_templates` DISABLE KEYS */;
INSERT INTO `setup_checklist_templates` VALUES (1,'Standard PMC Project','Default checklist for full PMC engagements with design, construction, and site supervision',1,1,'2026-04-28 08:51:55','2026-04-28 08:51:55');
/*!40000 ALTER TABLE `setup_checklist_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `site_checkins`
--

DROP TABLE IF EXISTS `site_checkins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_checkins` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `checkin_date` date NOT NULL,
  `checkin_time` time NOT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `accuracy` decimal(8,2) DEFAULT NULL,
  `address` varchar(300) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_date` (`user_id`,`checkin_date`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `site_checkins_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `site_checkins_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `site_checkins`
--

LOCK TABLES `site_checkins` WRITE;
/*!40000 ALTER TABLE `site_checkins` DISABLE KEYS */;
/*!40000 ALTER TABLE `site_checkins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `site_manager_leave`
--

DROP TABLE IF EXISTS `site_manager_leave`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_manager_leave` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `leave_from` date NOT NULL,
  `leave_to` date NOT NULL,
  `reason` varchar(300) DEFAULT NULL,
  `marked_by` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
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
-- Dumping data for table `site_manager_leave`
--

LOCK TABLES `site_manager_leave` WRITE;
/*!40000 ALTER TABLE `site_manager_leave` DISABLE KEYS */;
/*!40000 ALTER TABLE `site_manager_leave` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `submittals`
--

DROP TABLE IF EXISTS `submittals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `submittals` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `submittal_number` varchar(20) NOT NULL,
  `engagement_id` int(10) unsigned NOT NULL,
  `title` varchar(300) NOT NULL,
  `submittal_type` enum('shop_drawing','material_sample','product_data','test_report','other') NOT NULL DEFAULT 'shop_drawing',
  `submitted_by` int(10) unsigned NOT NULL,
  `submitted_at` datetime NOT NULL DEFAULT current_timestamp(),
  `file_path` varchar(500) DEFAULT NULL,
  `reviewed_by` int(10) unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `status` enum('submitted','under_review','approved','approved_with_comments','resubmit_required','rejected') NOT NULL DEFAULT 'submitted',
  `review_comments` text DEFAULT NULL,
  `resubmit_count` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_submittals_project_number` (`project_id`,`submittal_number`),
  KEY `engagement_id` (`engagement_id`),
  KEY `submitted_by` (`submitted_by`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_submittals_proj_status` (`project_id`,`status`),
  CONSTRAINT `submittals_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `submittals_ibfk_2` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`),
  CONSTRAINT `submittals_ibfk_3` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`),
  CONSTRAINT `submittals_ibfk_4` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `submittals`
--

LOCK TABLES `submittals` WRITE;
/*!40000 ALTER TABLE `submittals` DISABLE KEYS */;
/*!40000 ALTER TABLE `submittals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_updates`
--

DROP TABLE IF EXISTS `task_updates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_updates` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `task_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `report_date` date NOT NULL,
  `pct_complete` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `is_flagged` tinyint(1) NOT NULL DEFAULT 0,
  `flag_note` text DEFAULT NULL,
  `updated_by` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `daily_report_id` int(10) unsigned DEFAULT NULL,
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
  CONSTRAINT `chk_tu_pct` CHECK (`pct_complete` between 0 and 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_updates`
--

LOCK TABLES `task_updates` WRITE;
/*!40000 ALTER TABLE `task_updates` DISABLE KEYS */;
/*!40000 ALTER TABLE `task_updates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_validations`
--

DROP TABLE IF EXISTS `task_validations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_validations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `task_update_id` int(10) unsigned NOT NULL,
  `status` enum('pending','validated','rejected') NOT NULL DEFAULT 'pending',
  `validated_by` int(10) unsigned NOT NULL,
  `rejection_note` text DEFAULT NULL,
  `validated_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_update_id` (`task_update_id`),
  KEY `validated_by` (`validated_by`),
  CONSTRAINT `task_validations_ibfk_1` FOREIGN KEY (`task_update_id`) REFERENCES `task_updates` (`id`),
  CONSTRAINT `task_validations_ibfk_2` FOREIGN KEY (`validated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_validations`
--

LOCK TABLES `task_validations` WRITE;
/*!40000 ALTER TABLE `task_validations` DISABLE KEYS */;
/*!40000 ALTER TABLE `task_validations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tds_records`
--

DROP TABLE IF EXISTS `tds_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tds_records` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `pi_id` int(10) unsigned NOT NULL,
  `receipt_id` int(10) unsigned NOT NULL,
  `tds_amount` decimal(14,2) NOT NULL,
  `tds_rate` decimal(5,2) NOT NULL DEFAULT 10.00,
  `tds_section` varchar(20) NOT NULL DEFAULT '194J',
  `form16a_received` tinyint(1) NOT NULL DEFAULT 0,
  `quarter` varchar(10) DEFAULT NULL,
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
-- Dumping data for table `tds_records`
--

LOCK TABLES `tds_records` WRITE;
/*!40000 ALTER TABLE `tds_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `tds_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_leave_requests`
--

DROP TABLE IF EXISTS `user_leave_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_leave_requests` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `from_date` date NOT NULL,
  `to_date` date NOT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ulr_user_dates` (`user_id`,`from_date`,`to_date`),
  CONSTRAINT `fk_ulr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_leave_requests`
--

LOCK TABLES `user_leave_requests` WRITE;
/*!40000 ALTER TABLE `user_leave_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_leave_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_pending`
--

DROP TABLE IF EXISTS `user_pending`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_pending` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `role` varchar(30) NOT NULL,
  `stream` varchar(20) NOT NULL DEFAULT 'all',
  `initiated_by` int(10) unsigned NOT NULL,
  `initiated_at` datetime NOT NULL DEFAULT current_timestamp(),
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by` int(10) unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `initiated_by` (`initiated_by`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `user_pending_ibfk_1` FOREIGN KEY (`initiated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `user_pending_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_pending`
--

LOCK TABLES `user_pending` WRITE;
/*!40000 ALTER TABLE `user_pending` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_pending` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `role` enum('principal','design_principal','design_head','services_head','pmc_head','detailing_head','team_lead','jr_architect','detailing','services_engineer','coordinator','site_manager','senior_site_manager','finance_admin','trainee','audit','it_admin') NOT NULL,
  `stream` enum('design','services','pmc','site','all') NOT NULL DEFAULT 'all',
  `phone` varchar(20) DEFAULT NULL,
  `matrix_user_id` varchar(255) DEFAULT NULL,
  `matrix_room_id` varchar(255) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `whatsapp_notifications` tinyint(1) NOT NULL DEFAULT 1,
  `force_password_change` tinyint(1) NOT NULL DEFAULT 1,
  `login_count` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Incremented on each successful login. Used to defer forced password change.',
  `temp_password` varchar(100) DEFAULT NULL,
  `reset_by` int(10) unsigned DEFAULT NULL,
  `reset_at` datetime DEFAULT NULL,
  `managed_by` int(10) unsigned DEFAULT NULL,
  `deputy_id` int(10) unsigned DEFAULT NULL,
  `deputy_from` date DEFAULT NULL,
  `deputy_until` date DEFAULT NULL,
  `deputy_reason` varchar(300) DEFAULT NULL,
  `deputy_set_by` int(10) unsigned DEFAULT NULL,
  `deputy_overridden_by` int(10) unsigned DEFAULT NULL,
  `deputy_overridden_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_users_matrix` (`matrix_user_id`),
  KEY `managed_by` (`managed_by`),
  KEY `deputy_id` (`deputy_id`),
  KEY `fk_users_deputy_set_by` (`deputy_set_by`),
  KEY `fk_users_deputy_overridden_by` (`deputy_overridden_by`),
  CONSTRAINT `fk_users_deputy_overridden_by` FOREIGN KEY (`deputy_overridden_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_users_deputy_set_by` FOREIGN KEY (`deputy_set_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`managed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`deputy_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
-- User rows are in nu-pmc-seed-example.sql (placeholder data, password Welcome@123).
-- Load that file after this one.
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `validation_retry_queue`
--

DROP TABLE IF EXISTS `validation_retry_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `validation_retry_queue` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(20) NOT NULL,
  `entity_id` int(10) unsigned NOT NULL,
  `validation_type` enum('gstin','tan','pan','ifsc') NOT NULL,
  `value` varchar(20) NOT NULL,
  `retry_count` int(10) unsigned NOT NULL DEFAULT 0,
  `status` enum('pending','resolved','failed') NOT NULL DEFAULT 'pending',
  `error` varchar(200) DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_entity_type_val` (`entity_id`,`validation_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `validation_retry_queue`
--

LOCK TABLES `validation_retry_queue` WRITE;
/*!40000 ALTER TABLE `validation_retry_queue` DISABLE KEYS */;
/*!40000 ALTER TABLE `validation_retry_queue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_acknowledgements`
--

DROP TABLE IF EXISTS `vendor_acknowledgements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_acknowledgements` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int(10) unsigned NOT NULL,
  `engagement_id` int(10) unsigned NOT NULL,
  `ack_type` enum('contract','loi','payment','defect') NOT NULL,
  `reference_id` int(10) unsigned DEFAULT NULL,
  `message_sent` text DEFAULT NULL,
  `wa_reply` varchar(100) DEFAULT NULL,
  `acknowledged` tinyint(1) NOT NULL DEFAULT 0,
  `acknowledged_at` datetime DEFAULT NULL,
  `sent_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `engagement_id` (`engagement_id`),
  CONSTRAINT `vendor_acknowledgements_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `vendor_acknowledgements_ibfk_2` FOREIGN KEY (`engagement_id`) REFERENCES `vendor_engagements` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_acknowledgements`
--

LOCK TABLES `vendor_acknowledgements` WRITE;
/*!40000 ALTER TABLE `vendor_acknowledgements` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_acknowledgements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_boq_items`
--

DROP TABLE IF EXISTS `vendor_boq_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_boq_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int(10) unsigned NOT NULL,
  `engagement_id` int(10) unsigned NOT NULL,
  `boq_item_id` int(10) unsigned NOT NULL,
  `our_cost_rate` decimal(12,4) NOT NULL DEFAULT 0.0000,
  `our_cost_total` decimal(14,4) NOT NULL DEFAULT 0.0000,
  `notes` varchar(300) DEFAULT NULL,
  `entered_by` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
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
-- Dumping data for table `vendor_boq_items`
--

LOCK TABLES `vendor_boq_items` WRITE;
/*!40000 ALTER TABLE `vendor_boq_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_boq_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_boq_mapping`
--

DROP TABLE IF EXISTS `vendor_boq_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_boq_mapping` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `engagement_id` int(10) unsigned NOT NULL,
  `boq_item_id` int(10) unsigned NOT NULL,
  `split_pct` decimal(5,2) DEFAULT NULL,
  `notes` varchar(300) DEFAULT NULL,
  `mapped_by` int(10) unsigned NOT NULL,
  `ai_suggested` tinyint(1) NOT NULL DEFAULT 0,
  `ai_confidence` decimal(4,3) DEFAULT NULL,
  `confirmed_by` int(10) unsigned DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
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
-- Dumping data for table `vendor_boq_mapping`
--

LOCK TABLES `vendor_boq_mapping` WRITE;
/*!40000 ALTER TABLE `vendor_boq_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_boq_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_contract_history`
--

DROP TABLE IF EXISTS `vendor_contract_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_contract_history` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `engagement_id` int(10) unsigned NOT NULL,
  `previous_value` decimal(14,2) NOT NULL,
  `revised_value` decimal(14,2) NOT NULL,
  `reason` varchar(300) NOT NULL,
  `change_notice_id` int(10) unsigned DEFAULT NULL,
  `revised_by` int(10) unsigned NOT NULL,
  `revised_at` datetime NOT NULL DEFAULT current_timestamp(),
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
-- Dumping data for table `vendor_contract_history`
--

LOCK TABLES `vendor_contract_history` WRITE;
/*!40000 ALTER TABLE `vendor_contract_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_contract_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_engagements`
--

DROP TABLE IF EXISTS `vendor_engagements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_engagements` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `scope` varchar(300) NOT NULL,
  `contract_value` decimal(14,2) DEFAULT NULL,
  `mobilisation_status` enum('not_started','active','partially_complete','complete','off_site') NOT NULL DEFAULT 'not_started',
  `mobilisation_date` date DEFAULT NULL,
  `completion_date` date DEFAULT NULL,
  `engaged_by` int(10) unsigned NOT NULL,
  `approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendor_project` (`vendor_id`,`project_id`),
  KEY `engaged_by` (`engaged_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_vendor_engagements_proj_status` (`project_id`,`approval_status`),
  CONSTRAINT `vendor_engagements_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `vendor_engagements_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `vendor_engagements_ibfk_3` FOREIGN KEY (`engaged_by`) REFERENCES `users` (`id`),
  CONSTRAINT `vendor_engagements_ibfk_4` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_ve_contract` CHECK (`contract_value` is null or `contract_value` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_engagements`
--

LOCK TABLES `vendor_engagements` WRITE;
/*!40000 ALTER TABLE `vendor_engagements` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_engagements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_payment_cycles`
--

DROP TABLE IF EXISTS `vendor_payment_cycles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_payment_cycles` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `cycle_date` date NOT NULL,
  `cycle_type` enum('weekly','on_demand') NOT NULL DEFAULT 'weekly',
  `status` enum('draft','icici_generated','icici_uploaded','confirmed','whatsapp_sent') NOT NULL DEFAULT 'draft',
  `generated_by` int(10) unsigned NOT NULL,
  `confirmed_by` int(10) unsigned DEFAULT NULL,
  `icici_file_path` varchar(500) DEFAULT NULL,
  `confirm_file_path` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
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
-- Dumping data for table `vendor_payment_cycles`
--

LOCK TABLES `vendor_payment_cycles` WRITE;
/*!40000 ALTER TABLE `vendor_payment_cycles` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_payment_cycles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_payment_exceptions`
--

DROP TABLE IF EXISTS `vendor_payment_exceptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_payment_exceptions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `engagement_id` int(10) unsigned NOT NULL,
  `payment_id` int(10) unsigned DEFAULT NULL,
  `exception_count` int(10) unsigned NOT NULL DEFAULT 1,
  `reason` text NOT NULL,
  `approved_by` int(10) unsigned NOT NULL,
  `approved_at` datetime NOT NULL DEFAULT current_timestamp(),
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
-- Dumping data for table `vendor_payment_exceptions`
--

LOCK TABLES `vendor_payment_exceptions` WRITE;
/*!40000 ALTER TABLE `vendor_payment_exceptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_payment_exceptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_payments`
--

DROP TABLE IF EXISTS `vendor_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_payments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `vendor_id` int(10) unsigned NOT NULL,
  `engagement_id` int(10) unsigned NOT NULL,
  `payment_type` enum('running_account_bill','advance','mobilisation_advance','material_advance','final_bill','retention_release','extra_item','deduction') NOT NULL DEFAULT 'running_account_bill',
  `amount_requested` decimal(14,2) NOT NULL,
  `work_done_pct` decimal(5,2) DEFAULT NULL,
  `amount_auto_calc` tinyint(1) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `raised_by` int(10) unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT current_timestamp(),
  `week_ending` date NOT NULL,
  `status` enum('pending','approved','processed','paid') NOT NULL DEFAULT 'pending',
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `processed_at` datetime DEFAULT NULL,
  `ai_flag` tinyint(1) NOT NULL DEFAULT 0,
  `ai_flag_note` text DEFAULT NULL,
  `recommended_amount` decimal(14,2) DEFAULT NULL,
  `actual_amount` decimal(14,2) DEFAULT NULL,
  `utr_number` varchar(50) DEFAULT NULL,
  `payment_date` date DEFAULT NULL,
  `adjustment_reason` text DEFAULT NULL,
  `icici_ref` varchar(100) DEFAULT NULL,
  `payment_cycle_id` int(10) unsigned DEFAULT NULL,
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
  CONSTRAINT `chk_vp_amount` CHECK (`actual_amount` is null or `actual_amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_payments`
--

LOCK TABLES `vendor_payments` WRITE;
/*!40000 ALTER TABLE `vendor_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `trade` varchar(50) NOT NULL,
  `vendor_name` varchar(200) NOT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `gst_number` varchar(20) DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `bank_account` varchar(30) DEFAULT NULL,
  `bank_ifsc` varchar(15) DEFAULT NULL,
  `registered_by` int(10) unsigned NOT NULL,
  `pan_number` varchar(10) DEFAULT NULL,
  `pan_validated` tinyint(1) NOT NULL DEFAULT 0,
  `pan_validated_by` int(10) unsigned DEFAULT NULL,
  `pan_validated_at` datetime DEFAULT NULL,
  `gstin_validated` tinyint(1) NOT NULL DEFAULT 0,
  `gstin_validated_at` datetime DEFAULT NULL,
  `clearance_status` enum('pending','cleared','rejected') NOT NULL DEFAULT 'pending',
  `cleared_by` int(10) unsigned DEFAULT NULL,
  `cleared_at` datetime DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `ai_flags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`ai_flags`)),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendors_gst_number` (`gst_number`),
  KEY `registered_by` (`registered_by`),
  KEY `cleared_by` (`cleared_by`),
  KEY `pan_validated_by` (`pan_validated_by`),
  CONSTRAINT `vendors_ibfk_1` FOREIGN KEY (`registered_by`) REFERENCES `users` (`id`),
  CONSTRAINT `vendors_ibfk_2` FOREIGN KEY (`cleared_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vendors_ibfk_3` FOREIGN KEY (`pan_validated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wa_pending_actions`
--

DROP TABLE IF EXISTS `wa_pending_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `wa_pending_actions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned DEFAULT NULL,
  `request_type` varchar(50) DEFAULT NULL,
  `title` varchar(300) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `drift_days` int(11) DEFAULT NULL,
  `rejection_note` text DEFAULT NULL,
  `raised_by` int(10) unsigned DEFAULT NULL,
  `raised_at` datetime NOT NULL DEFAULT current_timestamp(),
  `actioned_by` int(10) unsigned DEFAULT NULL,
  `actioned_at` datetime DEFAULT NULL,
  `action_type` enum('anomaly_ack','grn_approve','report_update','issue_confirm','vendor_defect_ack','urgent_payment_fyi','mom_client_ack','udupa_excel_request','drawing_query','drawing_approval','rfi_photo_reply','schedule_change','cn_approval') DEFAULT NULL,
  `ref_id` int(10) unsigned DEFAULT NULL,
  `ref_table` varchar(50) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `user_id` int(10) unsigned DEFAULT NULL,
  `message_sent` text DEFAULT NULL,
  `sent_at` datetime NOT NULL DEFAULT current_timestamp(),
  `reply_received` varchar(500) DEFAULT NULL,
  `replied_at` datetime DEFAULT NULL,
  `channel` enum('whatsapp','app','both') NOT NULL DEFAULT 'whatsapp',
  `budget_flag_id` int(10) unsigned DEFAULT NULL,
  `rfi_id` int(10) unsigned DEFAULT NULL,
  `status` enum('pending','acted','approved','rejected','expired','cancelled') NOT NULL DEFAULT 'pending',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wa_pending_actions`
--

LOCK TABLES `wa_pending_actions` WRITE;
/*!40000 ALTER TABLE `wa_pending_actions` DISABLE KEYS */;
/*!40000 ALTER TABLE `wa_pending_actions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wa_send_failures`
--

DROP TABLE IF EXISTS `wa_send_failures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `wa_send_failures` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `attempted_at` datetime NOT NULL DEFAULT current_timestamp(),
  `to_phone` varchar(20) NOT NULL,
  `message_type` varchar(80) NOT NULL,
  `message_body` text DEFAULT NULL,
  `error_message` varchar(500) DEFAULT NULL,
  `project_id` int(10) unsigned DEFAULT NULL,
  `user_id` int(10) unsigned DEFAULT NULL,
  `retry_count` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wf_phone` (`to_phone`),
  KEY `idx_wf_attempted` (`attempted_at`),
  KEY `idx_wf_resolved` (`resolved_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wa_send_failures`
--

LOCK TABLES `wa_send_failures` WRITE;
/*!40000 ALTER TABLE `wa_send_failures` DISABLE KEYS */;
/*!40000 ALTER TABLE `wa_send_failures` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `weekly_report_documents`
--

DROP TABLE IF EXISTS `weekly_report_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `weekly_report_documents` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `week_ending` date NOT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT 1,
  `doc_type` enum('draft','final') NOT NULL DEFAULT 'draft',
  `file_path` varchar(500) DEFAULT NULL,
  `generated_by` int(10) unsigned DEFAULT NULL,
  `generated_at` datetime DEFAULT NULL,
  `uploaded_by` int(10) unsigned DEFAULT NULL,
  `uploaded_at` datetime DEFAULT NULL,
  `notes` varchar(300) DEFAULT NULL,
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
-- Dumping data for table `weekly_report_documents`
--

LOCK TABLES `weekly_report_documents` WRITE;
/*!40000 ALTER TABLE `weekly_report_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `weekly_report_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `weekly_report_photos`
--

DROP TABLE IF EXISTS `weekly_report_photos`;
/*!50001 DROP VIEW IF EXISTS `weekly_report_photos`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `weekly_report_photos` AS SELECT
 1 AS `id`,
  1 AS `weekly_report_id`,
  1 AS `photo_id` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `weekly_reports`
--

DROP TABLE IF EXISTS `weekly_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `weekly_reports` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `week_ending` date NOT NULL,
  `week_number` int(10) unsigned NOT NULL,
  `summary` text DEFAULT NULL,
  `issues_for_client` text DEFAULT NULL,
  `status` enum('draft','pending_approval','approved','sent') NOT NULL DEFAULT 'draft',
  `drafted_by` int(10) unsigned NOT NULL,
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `sent_by` int(10) unsigned DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `ai_drag_detected` tinyint(1) NOT NULL DEFAULT 0,
  `ai_drag_summary` text DEFAULT NULL,
  `drag_acknowledged` tinyint(1) NOT NULL DEFAULT 0,
  `drag_ack_by` int(10) unsigned DEFAULT NULL,
  `drag_ack_at` datetime DEFAULT NULL,
  `mitigation_note` text DEFAULT NULL,
  `sig_pmc_by` int(10) unsigned DEFAULT NULL,
  `sig_pmc_at` datetime DEFAULT NULL,
  `sig_design_by` int(10) unsigned DEFAULT NULL,
  `sig_design_at` datetime DEFAULT NULL,
  `sig_services_by` int(10) unsigned DEFAULT NULL,
  `sig_services_at` datetime DEFAULT NULL,
  `pmc_section` mediumtext DEFAULT NULL,
  `design_section` mediumtext DEFAULT NULL,
  `services_section` mediumtext DEFAULT NULL,
  `pdf_path` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `weekly_reports`
--

LOCK TABLES `weekly_reports` WRITE;
/*!40000 ALTER TABLE `weekly_reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `weekly_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `whatsapp_notifications`
--

DROP TABLE IF EXISTS `whatsapp_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `whatsapp_notifications` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `message_type` varchar(50) NOT NULL,
  `message_body` text NOT NULL,
  `status` enum('pending','sent','failed','queued') NOT NULL DEFAULT 'queued',
  `sent_at` datetime DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `pdf_path` varchar(500) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_unread` (`user_id`,`read_at`),
  CONSTRAINT `whatsapp_notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `whatsapp_notifications`
--

LOCK TABLES `whatsapp_notifications` WRITE;
/*!40000 ALTER TABLE `whatsapp_notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `whatsapp_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workflow_transitions`
--

DROP TABLE IF EXISTS `workflow_transitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_transitions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `object_type` varchar(50) NOT NULL,
  `from_state` varchar(50) NOT NULL,
  `to_state` varchar(50) NOT NULL,
  `roles_who` varchar(500) NOT NULL,
  `label` varchar(200) NOT NULL,
  `is_exception` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transition` (`object_type`,`from_state`,`to_state`),
  KEY `idx_object` (`object_type`),
  KEY `idx_from` (`object_type`,`from_state`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_transitions`
--

LOCK TABLES `workflow_transitions` WRITE;
/*!40000 ALTER TABLE `workflow_transitions` DISABLE KEYS */;
INSERT INTO `workflow_transitions` VALUES (1,'claims','draft','pmc_signed','principal,design_principal,pmc_head','PMC signs off',0,1,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (2,'claims','pmc_signed','stream_signed','principal,design_principal,design_head,services_head','Stream head signs',0,2,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (3,'claims','stream_signed','approved','principal,design_principal','Principal approves',0,3,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (4,'claims','approved','invoiced','principal,design_principal,pmc_head','Invoice number recorded',0,4,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (5,'measurements','draft','rs_signed','principal,design_principal,design_head,services_head','Stream sign-off',0,1,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (6,'measurements','rs_signed','client_accepted','principal,design_principal,pmc_head','Client acceptance recorded',0,2,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (7,'snags','open','rectified','principal,design_principal,pmc_head,site_manager,senior_site_manager','Mark rectified',0,1,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (8,'snags','rectified','closed','principal,design_principal,pmc_head,design_head,services_head','Verify and close',0,2,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (9,'snags','open','closed','principal,design_principal,pmc_head,design_head,services_head','Direct close (minor)',1,3,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (10,'weekly_reports','draft','pending_review','principal,design_principal,pmc_head,design_head,services_head','All sections signed',0,1,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (11,'weekly_reports','pending_review','approved','principal,design_principal','Principal approves',0,2,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (12,'weekly_reports','approved','sent','principal,design_principal','Marked sent to client',0,3,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (13,'payment_requests','pending_pmc','pmc_approved','principal,design_principal,pmc_head','PMC approves',0,1,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (14,'payment_requests','pmc_approved','pending_principal','system','Above threshold — to Principal',0,2,'2026-04-28 08:51:55');
INSERT INTO `workflow_transitions` VALUES (15,'payment_requests','pmc_approved','principal_approved','system','Below threshold — auto-approved',0,3,'2026-04-28 08:51:55');
INSERT INTO `workflow_transitions` VALUES (16,'payment_requests','pending_principal','principal_approved','principal,design_principal','Principal approves',0,4,'2026-04-28 08:51:55');
INSERT INTO `workflow_transitions` VALUES (17,'payment_requests','pending_principal','principal_rejected','principal,design_principal','Principal rejects',1,5,'2026-04-28 08:51:55');
INSERT INTO `workflow_transitions` VALUES (18,'payment_requests','principal_approved','paid','principal,design_principal,finance_admin','Payment released',0,6,'2026-04-28 08:51:55');
INSERT INTO `workflow_transitions` VALUES (19,'issues','open','in_progress','assignee','Work started',0,1,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (20,'issues','in_progress','resolved','assignee','Mark resolved',0,2,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (21,'issues','resolved','closed','principal,design_principal,pmc_head,design_head,services_head','Verify and close',0,3,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (22,'issues','open','closed','principal,design_principal,pmc_head,design_head,services_head','Direct close',1,4,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (23,'change_notices','draft','pending_approval','principal,design_principal,pmc_head,design_head,services_head','Stream heads sign',0,1,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (24,'change_notices','pending_approval','approved','principal,design_principal','Principal approves',0,2,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (25,'change_notices','pending_approval','rejected','principal,design_principal','Principal rejects',1,3,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (26,'drawings','uploaded','issued','principal,design_principal,design_head,services_head','Approve and issue',0,1,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (27,'drawings','issued','superseded','principal,design_principal,design_head','Superseded by new revision',1,2,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (28,'drawings','uploaded','rejected','principal,design_principal,design_head,services_head','Reject with comments',1,3,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (29,'submittals','submitted','under_review','principal,design_principal,design_head,services_head','Start review',0,1,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (30,'submittals','under_review','approved','principal,design_principal,design_head,services_head','Approve',0,2,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (31,'submittals','under_review','resubmit_required','principal,design_principal,design_head,services_head','Request resubmit',1,3,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (32,'submittals','under_review','rejected','principal,design_principal,design_head,services_head','Reject',1,4,'2026-04-28 08:51:54');
INSERT INTO `workflow_transitions` VALUES (33,'submittals','resubmit_required','submitted','site_manager,coordinator','Vendor resubmits',0,5,'2026-04-28 08:51:54');
/*!40000 ALTER TABLE `workflow_transitions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'install_build'
--

--
-- Dumping routines for database 'install_build'
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
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `current_pmc_assignments` AS select `p`.`id` AS `project_id`,`p`.`code` AS `project_code`,max(case when `a`.`kind` = 'primary' then `a`.`user_id` end) AS `primary_pmc_id`,max(case when `a`.`kind` = 'primary' then `a`.`id` end) AS `primary_assignment_id`,max(case when `a`.`kind` = 'backup' then `a`.`user_id` end) AS `backup_pmc_id`,max(case when `a`.`kind` = 'backup' then `a`.`id` end) AS `backup_assignment_id` from (`projects` `p` left join `project_pmc_assignments` `a` on(`a`.`project_id` = `p`.`id` and `a`.`effective_to` is null)) group by `p`.`id`,`p`.`code` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `issue_photos`
--

/*!50001 DROP VIEW IF EXISTS `issue_photos`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `issue_photos` AS select `ep`.`id` AS `id`,`ep`.`primary_entity_id` AS `issue_id`,`ep`.`project_id` AS `project_id`,`ep`.`uploaded_by` AS `submitted_by`,`ep`.`file_path` AS `file_path`,`ep`.`source` AS `source`,`ep`.`caption` AS `caption`,`ep`.`uploaded_at` AS `submitted_at` from `entity_photos` `ep` where `ep`.`primary_entity_type` = 'issue' */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `meeting_photos`
--

/*!50001 DROP VIEW IF EXISTS `meeting_photos`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `meeting_photos` AS select `ep`.`id` AS `id`,`ep`.`primary_entity_id` AS `meeting_id`,`ep`.`file_path` AS `file_path`,`ep`.`file_size_kb` AS `file_size_kb`,`ep`.`caption` AS `caption`,'photo' AS `doc_type`,`ep`.`uploaded_by` AS `uploaded_by`,`ep`.`uploaded_at` AS `uploaded_at` from `entity_photos` `ep` where `ep`.`primary_entity_type` = 'meeting' */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `project_photos`
--

/*!50001 DROP VIEW IF EXISTS `project_photos`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `project_photos` AS select `ep`.`id` AS `id`,`ep`.`project_id` AS `project_id`,`ep`.`primary_entity_id` AS `task_id`,cast(NULL as unsigned) AS `daily_report_id`,`ep`.`photo_date` AS `photo_date`,`ep`.`file_path` AS `file_path`,`ep`.`file_size_kb` AS `file_size_kb`,`ep`.`caption` AS `caption`,`ep`.`uploaded_by` AS `uploaded_by`,`ep`.`source` AS `source`,`ep`.`uploaded_at` AS `uploaded_at`,`ep`.`is_locked` AS `is_locked`,`ep`.`locked_at` AS `locked_at`,`ep`.`locked_by_report_id` AS `locked_by_report_id` from `entity_photos` `ep` where `ep`.`primary_entity_type` = 'project_progress' */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `weekly_report_photos`
--

/*!50001 DROP VIEW IF EXISTS `weekly_report_photos`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `weekly_report_photos` AS select `epl`.`id` AS `id`,`epl`.`entity_id` AS `weekly_report_id`,`epl`.`photo_id` AS `photo_id` from `entity_photo_links` `epl` where `epl`.`entity_type` = 'weekly_report' */;
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

-- Dump completed on 2026-04-28  8:52:11


-- ── v5.22-vendor-bank-protection.sql ─────────────────────────────────────────
-- migrations/v5.22-vendor-bank-protection.sql
-- ============================================================
-- V8 — Vendor Bank Detail Protection (Layers 2 + 3)
--
-- Layer 1 (auto-uncheck on bank change) was shipped as B36 in v5.x.
-- This migration adds:
--   Layer 2 — Dual approval: bank changes are proposed, then approved by a
--             different role.
--   Layer 3 — Alert mechanism: alerts written to vendor_alerts table.
--             A future Matrix bot reads/posts from this table.
--
-- Tables created:
--   vendor_bank_change_approvals — proposed/approved/rejected lifecycle for
--                                  any change to bank_account/bank_ifsc/bank_name
--   vendor_alerts                 — Matrix-bound queue (placeholder until bot lives)
--
-- ============================================================

-- ── 1. vendor_bank_change_approvals ─────────────────────────
--
-- One row per proposed change. Lives until either approved (then change is
-- committed to vendors row) or rejected. Carries the BEFORE and AFTER
-- snapshot so the approver sees exactly what's changing, and so an audit
-- trail survives even if the underlying vendor is edited again later.
--
-- Concurrency: row_version (optimistic-lock pattern, same as payment_requests).
-- If two finance_admins simultaneously propose two different changes to the
-- same vendor, one wins, the other gets a 409 + reload prompt.
CREATE TABLE IF NOT EXISTS vendor_bank_change_approvals (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  row_version         INT UNSIGNED NOT NULL DEFAULT 1,    -- optimistic lock
  vendor_id           INT UNSIGNED NOT NULL,

  -- Lifecycle
  status              ENUM('pending', 'approved', 'rejected', 'cancelled')
                        NOT NULL DEFAULT 'pending',

  -- Proposer
  proposed_by         INT UNSIGNED NOT NULL,
  proposed_by_role    VARCHAR(40)  NOT NULL,       -- snapshot at time of proposal
  proposed_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  proposal_reason     TEXT         NULL,

  -- Snapshot — BEFORE
  before_bank_name    VARCHAR(200) NULL,
  before_bank_account VARCHAR(50)  NULL,
  before_bank_ifsc    VARCHAR(20)  NULL,

  -- Snapshot — AFTER
  after_bank_name     VARCHAR(200) NULL,
  after_bank_account  VARCHAR(50)  NULL,
  after_bank_ifsc     VARCHAR(20)  NULL,

  -- Approver (set when status flips to approved/rejected)
  approved_by         INT UNSIGNED NULL,
  approved_by_role    VARCHAR(40)  NULL,
  approved_at         DATETIME     NULL,
  rejection_reason    TEXT         NULL,

  -- Committed (set when the change is actually applied to vendors row).
  -- Separate column so we can detect the small window between "approved"
  -- and "committed" — useful for forensics if a commit ever fails.
  committed_at        DATETIME     NULL,

  FOREIGN KEY (vendor_id)   REFERENCES vendors(id) ON DELETE CASCADE,
  FOREIGN KEY (proposed_by) REFERENCES users(id)   ON DELETE RESTRICT,
  FOREIGN KEY (approved_by) REFERENCES users(id)   ON DELETE SET NULL,
  INDEX idx_vbc_status (status),
  INDEX idx_vbc_vendor (vendor_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 2. vendor_alerts ─────────────────────────────────────────
--
-- Generic alert queue for vendor-related events that should be visible to
-- principals/finance even when no app session is open. Bound for Matrix when
-- the bot is live; until then, the queue accumulates rows that the dashboard
-- reads from.
--
-- alert_type values used by V8:
--   bank_change.proposed   — proposer submitted
--   bank_change.approved   — approver approved (and change is being committed)
--   bank_change.rejected   — approver rejected
--   bank_change.committed  — change has been applied to vendors row
--   bank_change.cancelled  — proposer withdrew before any approval
--
-- Future extension: vendor.created (paired with V8 spec "new vendor creation
-- also requires two-person approval"), vendor.engagement.flagged, etc.
CREATE TABLE IF NOT EXISTS vendor_alerts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id       INT UNSIGNED NOT NULL,
  alert_type      VARCHAR(60) NOT NULL,        -- e.g. bank_change.proposed
  payload_json    JSON NOT NULL,               -- structured alert body
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Matrix delivery tracking (filled by future bot; NULL until bot is live)
  matrix_event_id VARCHAR(255) NULL,
  matrix_room_id  VARCHAR(255) NULL,
  posted_at       DATETIME NULL,

  -- Read tracking (future use — bot can mark alerts as read)
  read_by         INT UNSIGNED NULL,
  read_at         DATETIME NULL,

  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  FOREIGN KEY (read_by)   REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_va_unposted (matrix_event_id, created_at),
  INDEX idx_va_vendor (vendor_id, created_at),
  INDEX idx_va_type (alert_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 3. Permission seed for new actions ───────────────────────
--
-- Two new actions enforced via requirePermission():
--   admin.vendor.bank-change.propose  — finance_admin, pmc_head, design_head, services_head
--   admin.vendor.bank-change.approve  — principal, design_principal, finance_admin
--                                        (finance_admin only when proposer is a non-finance role)
--
-- Cross-check enforcement: the route handler verifies that the same user is
-- not both proposer and approver. The role allow-list here is just the
-- "may do this in principle" gate.
--
-- These are seeded; the runtime enforcement is in the route handler.
INSERT INTO role_permissions (role, action, level, group_name, label) VALUES
  ('principal',        'admin.vendor.bank-change.propose', 'W', 'Vendor Master', 'Propose vendor bank detail change'),
  ('design_principal', 'admin.vendor.bank-change.propose', 'W', 'Vendor Master', 'Propose vendor bank detail change'),
  -- Principals do NOT propose per spec, but seeding the row keeps the
  -- governance sheet consistent. The route enforces "principals don't propose".
  ('finance_admin',    'admin.vendor.bank-change.propose', 'W', 'Vendor Master', 'Propose vendor bank detail change'),
  ('pmc_head',         'admin.vendor.bank-change.propose', 'W', 'Vendor Master', 'Propose vendor bank detail change'),
  ('design_head',      'admin.vendor.bank-change.propose', 'W', 'Vendor Master', 'Propose vendor bank detail change'),
  ('services_head',    'admin.vendor.bank-change.propose', 'W', 'Vendor Master', 'Propose vendor bank detail change'),

  ('principal',        'admin.vendor.bank-change.approve', 'A', 'Vendor Master', 'Approve vendor bank detail change'),
  ('design_principal', 'admin.vendor.bank-change.approve', 'A', 'Vendor Master', 'Approve vendor bank detail change'),
  ('finance_admin',    'admin.vendor.bank-change.approve', 'A', 'Vendor Master', 'Approve vendor bank detail change')
ON DUPLICATE KEY UPDATE label = VALUES(label);


-- ── 4. Document this migration ratifies an architectural commitment ──
SELECT 1 AS v5_22_vendor_bank_protection_layers_2_3;


-- ── v5.23-matrix-substrate.sql ─────────────────────────────────────────
-- migrations/v5.23-matrix-substrate.sql
-- ============================================================
-- Matrix substrate — schema for messaging adapter, room mapping, outbox.
--
-- Adds the persistent state that the Matrix integration needs:
--   - users.matrix_user_id            — bot needs to know who to mention/DM
--   - users.notification_channel      — per-user pref (matrix | whatsapp | both)
--   - matrix_rooms                    — room mapping per project/room_type
--   - matrix_outbox                   — pending sends (dry-run + retry queue)
--
-- The runtime adapter (services/matrix-adapter.js) reads/writes these.
-- Once EMS is provisioned and the bot account exists, the only wiring
-- step is populating users.matrix_user_id and creating room rows.
-- ============================================================

-- ── 1. Per-user Matrix identity + notification preference ────
-- Existing column: users.whatsapp_notifications (TINYINT bool).
-- New: matrix_user_id is the per-user Matrix MXID. Nullable so users
-- created before Matrix rollout don't break.
-- New: notification_channel adds a per-user override on top of the
-- global NOTIFICATIONS env flag.
-- NOTE: matrix_user_id, matrix_room_id, notification_channel are now in the
-- base CREATE TABLE users above. ALTER skipped to avoid duplicate column error.

-- ── 2. Room mapping: project_id × room_type → room_id ────────
-- room_type values:
--   'site'             — #PV90-site (project-scoped)
--   'finance'          — #PV90-finance
--   'design'           — #PV90-design
--   'general'          — #PV90-general (encrypted, human-only)
--   'internal_principal'  — #internal-principal (project_id NULL)
--   'internal_finance' — #internal-finance (project_id NULL)
--   'system_health'    — #system-health (project_id NULL)
--
-- encrypted defaults to 0 because bot rooms must be unencrypted (polls
-- don't work in encrypted rooms — brief 7.2). 'general' sets it to 1.
-- The column is captured on creation and not editable after — Matrix
-- can't toggle encryption post-hoc.
CREATE TABLE IF NOT EXISTS matrix_rooms (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id  INT UNSIGNED NULL,                 -- NULL for system/personal rooms
  room_type   ENUM('site','finance','design','general',
                   'internal_principal','internal_finance','system_health')
                NOT NULL,
  room_id     VARCHAR(255) NOT NULL,             -- !abcdef:nuassociates.ems.host
  room_alias  VARCHAR(255) NULL,                 -- #PV90-site:nuassociates.ems.host
  encrypted   TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at DATETIME NULL,                     -- set when project closes
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  -- A given project has at most one room per room_type.
  UNIQUE KEY uq_project_room (project_id, room_type),
  INDEX idx_room_id (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. Outbox: pending sends ─────────────────────────────────
-- When the adapter is configured but the network/server is unreachable,
-- pending messages queue here and a retry worker drains them. Also used
-- in dry-run mode (no MATRIX_BOT_TOKEN) so a developer can inspect what
-- WOULD have been sent.
--
-- status:
--   'pending'   — queued, not yet attempted
--   'sending'   — adapter is currently posting
--   'sent'      — Matrix returned an event_id
--   'failed'    — terminal failure (after max retries)
--   'dry_run'   — captured because no token was configured (POC mode)
CREATE TABLE IF NOT EXISTS matrix_outbox (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id         VARCHAR(255) NOT NULL,         -- raw Matrix room id
  txn_id          VARCHAR(64)  NOT NULL,         -- idempotency key for PUT /send
  msg_type        ENUM('text','poll','image','file') NOT NULL DEFAULT 'text',
  body            TEXT NOT NULL,                 -- body for text; JSON-encoded payload otherwise
  mxc_url         VARCHAR(500) NULL,             -- mxc:// URI for image/file sends
  recipient_uid   INT UNSIGNED NULL,             -- users.id of intended recipient (for tracking)
  status          ENUM('pending','sending','sent','failed','dry_run')
                    NOT NULL DEFAULT 'pending',
  attempts        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_error      TEXT NULL,
  matrix_event_id VARCHAR(255) NULL,             -- $abcdef:server — set on success
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at         DATETIME NULL,
  -- Idempotency: same txn_id should not be re-queued
  UNIQUE KEY uq_txn (txn_id),
  INDEX idx_status_created (status, created_at),
  INDEX idx_recipient (recipient_uid, created_at),
  FOREIGN KEY (recipient_uid) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. Migration ratification marker ────────────────────────
SELECT 1 AS v5_23_matrix_substrate;


-- ── v5.24-iteration1-vendor-onboarding.sql ─────────────────────────────────────────
-- migrations/v5.24-iteration1-vendor-onboarding.sql
-- ============================================================
-- Iteration 1 — vendor onboarding via wa.me + unified approvals.
-- See handoff-2026-04-28/2_ForMe/BUILD-COMMIT-30-April.md "Iteration 1"
--
-- Adds:
--   - 6 columns on `vendors` for Matrix tier + bank-validation tracking
--   - `vendor_onboarding_tokens` — secure single-use 48h tokens for wa.me links
--   - `vendor_contacts` — three-role model (owner / site / accounts)
--   - `approval_type_config` — Sheet 9 destination (per-type signers/quorum/scope)
--   - `approvals` — per-instance approval state (parallel to wa_pending_actions)
--   - `approval_signoffs` — per-signer rows for multi-signer approvals
--
-- Pre-emptive re-validation migration is deliberately NOT run here.
-- That's a deploy-day operation triggered by an operator script — it's a
-- one-shot rather than an idempotent migration. See scripts/iter1-deploy-day.js
-- for that step (built separately).
-- ============================================================

-- ── 1. Vendor columns: Matrix tier + bank-validation tracking ─

ALTER TABLE vendors
  ADD COLUMN bank_validated_by_vendor TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN bank_validated_at        DATETIME NULL,
  ADD COLUMN bank_validation_method   ENUM('matrix','wa_form','manual_attestation') NULL,
  ADD COLUMN matrix_user_id           VARCHAR(255) NULL,
  ADD COLUMN matrix_room_id           VARCHAR(255) NULL,
  ADD COLUMN matrix_status            ENUM('not_invited','invited_pending','joined','declined') NOT NULL DEFAULT 'not_invited',
  ADD INDEX idx_vendors_matrix_status (matrix_status),
  ADD INDEX idx_vendors_bank_validated (bank_validated_by_vendor);


-- ── 2. Vendor contacts (three-role model) ──────────────────
-- Some vendors have separate accountancy/site/owner contacts. Each can have
-- their own phone (for wa.me) and matrix_user_id (when migrated to Tier A).
-- vendors.phone remains the primary contact for backward compat.

-- vendor_contacts is created by v5.38 with the schema the application
-- actually uses (vc.name / vc.whatsapp / vc.matrix_room_id, per
-- services/signoff-gate.js). The prototype CREATE that lived here was
-- superseded; removing it so the canonical shape is the one that lands.


-- ── 3. Vendor onboarding tokens ─────────────────────────────
-- Single-use, 48-hour expiry per build-commit lock #4.
-- Generated when an internal user clicks "Send onboarding via WhatsApp".
-- Consumed when the vendor opens the public form via the wa.me link.

CREATE TABLE IF NOT EXISTS vendor_onboarding_tokens (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id     INT UNSIGNED NOT NULL,
  -- 32-byte hex string = 64 chars. URL-safe.
  token         VARCHAR(64)  NOT NULL,
  -- Purpose: which flow this token is for
  --   bank_confirm     — vendor confirms their bank details (V8 vendor-side)
  --   onboard          — first-time onboarding form (full vendor self-fill)
  --   re_validation    — deploy-day re-validation flow
  purpose       ENUM('bank_confirm','onboard','re_validation') NOT NULL,
  -- Status progression: issued → opened → consumed | expired | revoked
  --   issued    — generated, link sent (or generated but not yet sent)
  --   opened    — vendor's browser hit GET /vendor-onboard/:token
  --                (preview-crawler detection: a single GET that ALSO posts data
  --                 within seconds is likely a real human; a GET with no follow-up
  --                 within 60s is treated suspiciously and the token doesn't
  --                 auto-consume on next preview hit. See vendor-onboarding.js.)
  --   consumed  — vendor submitted the form successfully
  --   expired   — past expires_at without consume
  --   revoked   — internal user regenerated, invalidating the previous one
  status        ENUM('issued','opened','consumed','expired','revoked') NOT NULL DEFAULT 'issued',
  issued_by     INT UNSIGNED NULL,
  issued_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME NOT NULL,
  opened_at     DATETIME NULL,
  consumed_at   DATETIME NULL,
  -- Snapshot of what was sent, so we can show a meaningful confirmation
  -- back to internal users ("you sent BANK ABC1234 to vendor on 25 Apr").
  payload_json  JSON NULL,
  -- For bank_confirm purpose: link back to the V8 approval row
  approval_id   INT UNSIGNED NULL,
  -- Number of times the GET endpoint was hit (preview crawlers + real opens)
  open_count    INT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approval_id) REFERENCES vendor_bank_change_approvals(id) ON DELETE SET NULL,
  UNIQUE KEY uq_token (token),
  INDEX idx_vendor_status (vendor_id, status, expires_at),
  INDEX idx_status_expires (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 4. Approval type config (Sheet 9 destination) ──────────
-- Declares per approval-type the rules — signers, quorum, scope,
-- vendor-confirm requirement, expiry. Sheet 9 ingestion populates this
-- from a governance Excel file. New approval workflows = uploading a row,
-- zero code changes.

CREATE TABLE IF NOT EXISTS approval_type_config (
  id                       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  approval_type            VARCHAR(60) NOT NULL UNIQUE,
  -- The required signer roles (JSON array, e.g. ["principal","finance_admin"]).
  -- All listed roles are eligible signers; quorum says how many must sign.
  signer_roles_json        JSON NOT NULL,
  -- Quorum: number of distinct signers required (1..N).
  -- 1 = single-approval; N = multi-signer.
  quorum                   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  -- Scope: 'project' | 'global'. Project-scoped approvals require the signer
  -- to be assigned to the project; global ones do not.
  scope                    ENUM('project','global') NOT NULL DEFAULT 'project',
  -- Whether the approval type also requires a vendor-side confirmation
  -- (e.g. bank-change does; CN approval does not).
  requires_vendor_confirm  TINYINT(1) NOT NULL DEFAULT 0,
  -- Approval expires after this many hours if no signers act.
  -- NULL = never expires.
  expires_after_hours      INT UNSIGNED NULL,
  -- Human-readable label for the dashboard
  label                    VARCHAR(120) NOT NULL,
  -- Free-form description shown to signers
  description              TEXT NULL,
  -- Sheet 9 row id for traceability (so we can detect drift between sheet & DB)
  sheet_source             VARCHAR(40) NULL,
  active                   TINYINT(1) NOT NULL DEFAULT 1,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 5. Approvals — per-instance state ───────────────────────
-- Parallels wa_pending_actions but uses the unified Sheet 9 model.
-- Existing wa_pending_actions stays untouched — legacy callers keep working
-- via services/approvals.js register/close.

CREATE TABLE IF NOT EXISTS approvals (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  approval_type   VARCHAR(60) NOT NULL,
  -- What's being approved
  ref_table       VARCHAR(50) NOT NULL,
  ref_id          INT UNSIGNED NOT NULL,
  project_id      INT UNSIGNED NULL,
  -- Who proposed it
  raised_by       INT UNSIGNED NOT NULL,
  raised_by_role  VARCHAR(40)  NOT NULL,
  raised_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Title + details for dashboard display
  title           VARCHAR(300) NOT NULL,
  details         TEXT NULL,
  -- Lifecycle:
  --   pending   — awaiting signer votes
  --   approved  — quorum reached, all signers said yes
  --   rejected  — at least one signer voted no (any reject vetoes)
  --   expired   — expires_at passed before quorum
  --   cancelled — proposer withdrew
  status          ENUM('pending','approved','rejected','expired','cancelled')
                    NOT NULL DEFAULT 'pending',
  -- Resolution
  resolved_at     DATETIME NULL,
  resolved_by     INT UNSIGNED NULL,
  resolution_note TEXT NULL,
  expires_at      DATETIME NULL,
  -- Vendor-confirm tracking (when approval_type.requires_vendor_confirm=1)
  vendor_id       INT UNSIGNED NULL,
  vendor_confirmed_at DATETIME NULL,
  -- row_version: optimistic-lock pattern for concurrent vote attempts
  row_version     INT UNSIGNED NOT NULL DEFAULT 1,
  FOREIGN KEY (raised_by)   REFERENCES users(id)    ON DELETE RESTRICT,
  FOREIGN KEY (resolved_by) REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id)   REFERENCES vendors(id)  ON DELETE SET NULL,
  -- A given (ref_table, ref_id) has at most one open approval at a time —
  -- we enforce this in the service layer (a partial unique index would
  -- need MariaDB 10.5+). Index for fast lookup:
  INDEX idx_approvals_ref (ref_table, ref_id, status),
  INDEX idx_approvals_status (status, raised_at),
  INDEX idx_approvals_project (project_id, status),
  INDEX idx_approvals_vendor (vendor_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 6. Approval signoffs — per-signer rows ──────────────────
-- One row per signer who has voted on an approval. For quorum=1, at most
-- one row exists per approval. For quorum=N, each distinct signer creates
-- a row. The service prevents double-voting per signer.

CREATE TABLE IF NOT EXISTS approval_signoffs (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  approval_id     INT UNSIGNED NOT NULL,
  signer_id       INT UNSIGNED NOT NULL,
  signer_role     VARCHAR(40)  NOT NULL,
  vote            ENUM('approve','reject') NOT NULL,
  comment         TEXT NULL,
  voted_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE CASCADE,
  FOREIGN KEY (signer_id)   REFERENCES users(id)     ON DELETE RESTRICT,
  -- A signer votes at most once per approval
  UNIQUE KEY uq_approval_signer (approval_id, signer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 7. Seed initial approval_type_config rows (8 types per spec) ─
-- IMPORTANT — these are CONSERVATIVE PLACEHOLDERS, audited against the
-- current legacy gates as of v5.24. Most workflows have nuanced approval
-- chains (e.g. CN's <₹1L two-signer-peer path; claim_invoice's three-step
-- PMC→RS→principal sequence; V8's proposer-role-dependent approver list)
-- that a single row cannot model. Until each workflow is migrated to the
-- unified approvals API, the safe default here is principals-only — that
-- subset is in every legacy gate, so widening through Sheet 9 upload is
-- always safe; narrowing is impossible without code-side knowledge.
--
-- Principal MUST review and widen each row before migrating its workflow.
-- The legacy approval routes (changes.js, weekly-signoff.js, payments.js,
-- claims.js, etc.) remain authoritative until a workflow is moved over.
INSERT INTO approval_type_config
  (approval_type, signer_roles_json, quorum, scope, requires_vendor_confirm,
   expires_after_hours, label, description, sheet_source, active)
VALUES
  -- CN approval today is dual-tiered: ≥1% project budget = principals-only;
  -- <1% = stream_head + pmc_head peer (two-signer scheme, NOT modellable in
  -- one row). Placeholder picks the high-value gate.
  ('cn_approval',
   JSON_ARRAY('principal','design_principal'), 1, 'project', 0,
   72, 'Change Notice approval',
   'PLACEHOLDER: high-value path only. Low-value (<1% budget) needs stream_head + pmc_head peer scheme — not yet modellable.',
   'sheet9_seed_v5.24', 1),

  -- Schedule change today: requirePrincipal — ONLY principal/design_principal.
  -- (My earlier v5.24 draft included pmc_head; that was wrong. Tightened.)
  ('schedule_change',
   JSON_ARRAY('principal','design_principal'), 1, 'project', 0,
   72, 'Schedule baseline change',
   'PLACEHOLDER: matches current requirePrincipal gate. Widen via Sheet 9 if pmc_head should also approve.',
   'sheet9_seed_v5.24', 1),

  -- Weekly report: principal-approve endpoint = principal/design_principal only.
  -- (My earlier draft included pmc_head; that gate is for daily reports, not weekly.)
  ('weekly_report',
   JSON_ARRAY('principal','design_principal'), 1, 'project', 0,
   168, 'Weekly report sign-off',
   'PLACEHOLDER: principals only — matches current requireRole(...PRINCIPALS) on /weekly-signoff/:id/principal-approve.',
   'sheet9_seed_v5.24', 1),

  -- Vendor payment approve: requirePMC = principal/design_principal/pmc_head.
  -- (My earlier draft listed finance_admin instead of pmc_head — wrong.
  -- finance_admin DOES NOT have approve rights on payments today.)
  ('vendor_payment',
   JSON_ARRAY('principal','design_principal','pmc_head'), 1, 'project', 0,
   168, 'Vendor payment approval',
   'PLACEHOLDER: matches current requirePMC gate on PATCH /api/payments/:project_id/payments/:id/approve.',
   'sheet9_seed_v5.24', 1),

  -- V8 vendor bank change: dynamic — head-proposed → principals approve;
  -- finance-proposed → principals + finance_admin approve. The unified
  -- model can't capture proposer-dependent rules. Placeholder = principals.
  ('vendor_bank_change',
   JSON_ARRAY('principal','design_principal'), 1, 'global', 1,
   72, 'Vendor bank change',
   'PLACEHOLDER: principals only. V8 has proposer-dependent rules (head → principals; finance → principals+finance_admin) that need a dual-row model when migrating.',
   'sheet9_seed_v5.24', 1),

  -- Claim invoice today is a 3-step chain: PMC sign-off → RS (stream-head)
  -- sign-off → principal final approval. Single seed row models only the
  -- final step. Placeholder picks principals (the final step).
  ('claim_invoice',
   JSON_ARRAY('principal','design_principal'), 1, 'project', 0,
   168, 'Client claim approval',
   'PLACEHOLDER: final-approve step only. The full chain (PMC sign-off → RS sign-off → principal approve) needs a multi-row model when migrating.',
   'sheet9_seed_v5.24', 1),

  -- Budget cost head: principals tighten by default. (No legacy approve
  -- handler found in this audit; widen if/when one exists.)
  ('budget_cost_head',
   JSON_ARRAY('principal','design_principal'), 1, 'project', 0,
   72, 'Budget cost head approval',
   'PLACEHOLDER: principals only. No clear legacy handler — confirm signer list with Principal before migrating.',
   'sheet9_seed_v5.24', 1),

  -- Handover closure: multi-signer scheme (4 of: principal, design_principal,
  -- pmc_head, finance_admin). matrix-runner.js comments confirm this is
  -- lifecycle-mutating and tested separately — the 4-signer model is the
  -- intended new design, not a legacy match.
  ('handover_closure',
   JSON_ARRAY('principal','design_principal','pmc_head','finance_admin'), 4, 'project', 0,
   NULL, 'Project handover closure',
   'PLACEHOLDER: 4-signer quorum design. Confirm signer list + quorum with Principal before migrating.',
   'sheet9_seed_v5.24', 1)
ON DUPLICATE KEY UPDATE
  signer_roles_json = VALUES(signer_roles_json),
  quorum            = VALUES(quorum),
  description       = VALUES(description),
  label             = VALUES(label);


-- ── 8. Migration ratification marker ─────────────────────────

-- ── Per build-commit lock #6: PATCH /master/:id moves from requirePMC
-- to requirePermission('admin.vendor.update'). Seed the perm to 6 roles
-- so the new gate doesn't lock out finance/pmc/heads.
INSERT INTO role_permissions (role, action, level, group_name, label) VALUES
  ('finance_admin',    'admin.vendor.update', 'W', 'Vendor Master', 'Update vendor master record (bank/GST/contact)'),
  ('pmc_head',         'admin.vendor.update', 'W', 'Vendor Master', 'Update vendor master record (bank/GST/contact)'),
  ('design_head',      'admin.vendor.update', 'W', 'Vendor Master', 'Update vendor master record (bank/GST/contact)'),
  ('services_head',    'admin.vendor.update', 'W', 'Vendor Master', 'Update vendor master record (bank/GST/contact)'),
  ('principal',        'admin.vendor.update', 'A', 'Vendor Master', 'Update vendor master record (bank/GST/contact)'),
  ('design_principal', 'admin.vendor.update', 'A', 'Vendor Master', 'Update vendor master record (bank/GST/contact)')
ON DUPLICATE KEY UPDATE label = VALUES(label);

SELECT 1 AS v5_24_iteration1_vendor_onboarding;


-- ── v5.25-strike-thresholds-to-db.sql ─────────────────────────────────────────
-- migrations/v5.25-strike-thresholds-to-db.sql
-- ============================================================
-- D12 — Strike thresholds for vendor-payment-without-BOQ exceptions
-- moved from hardcoded JS to per-project DB columns.
--
-- Background: modules/finance/routes/payments.js had hardcoded thresholds
-- (`if strikes === 0`, `else if strikes === 1`, else hard-block) and
-- hardcoded recipients (all principals on every strike). Principal wanted:
--   - Strike rules editable without a code change
--   - Strike 1 → PMC head only (was: principals)
--   - Strike 2 → PMC + finance_admin (was: hard-block, no alert)
--   - Strike 3 → principal sign-off required (matches: Principal/Design Principal override)
--
-- Per-project columns (matching the existing payment_approval_threshold
-- pattern at projects.payment_approval_threshold).
-- ============================================================

ALTER TABLE projects
  ADD COLUMN strike_warn_until INT UNSIGNED NOT NULL DEFAULT 0
    COMMENT 'Up to and including this count of prior BOQ-less payments, just warn (Strike 1). Per-project; NULL not allowed — every project has a value.',
  ADD COLUMN strike_block_until INT UNSIGNED NOT NULL DEFAULT 1
    COMMENT 'Up to and including this count, soft-block requiring PMC + finance confirmation (Strike 2). Above this count: hard-block requiring principal sign-off (Strike 3).';

-- Backfill: existing projects keep current behavior (0/1, matching the
-- previously-hardcoded thresholds).
-- (DEFAULT 0 / DEFAULT 1 in ALTER above already does this; explicit UPDATE
-- not needed since both columns are NOT NULL with DEFAULT.)

-- Sanity assertion: strike_warn_until must be < strike_block_until.
-- MySQL CHECK constraints are enforced from 8.0.16+; safe to add.
ALTER TABLE projects
  ADD CONSTRAINT strike_thresholds_ordered
  CHECK (strike_warn_until < strike_block_until);


-- ── v5.26-notification-triggers-rename.sql ─────────────────────────────────────────
-- migrations/v5.26-notification-triggers-rename.sql
-- ============================================================
-- D11 — Rename notification_triggers event_keys from dotted module-prefix
-- format (e.g. 'schedule.version-uploaded') to the underscored format
-- the route code actually passes (e.g. 'schedule_change').
--
-- Background: v4.6 seeded notification_triggers with carefully-designed
-- dotted event names. The route handlers, written separately, used
-- underscored ad-hoc event names. Result: the DB lookup never matched
-- code's event_key strings, so _notifyByEvent always fell back to the
-- hardcoded role list. The whole DB-driven routing infrastructure was
-- bypassed. Of 21 seeded events, only `claim.approved` happened to match
-- code's `claim_approved`... wait, no — code uses `claim_approved` (with
-- underscore) and seed uses `claim.approved` (with dot), so even that
-- one didn't match. Zero matches.
--
-- Decision 1 (May 2026 — Principal): rename the table to match code, not
-- code to match table. Reason: code-naming wins on flexibility — when
-- adding a new event, no dotted-naming convention to follow.
--
-- ALSO: this migration adds NEW rows for events that exist in code but
-- have no triggers seeded (per Events 1-18 recipient decisions, May 2026).
--
-- Idempotent: safe to run on a partially-renamed DB (UPDATE matches only
-- rows still on old name), safe on a freshly-installed DB (will UPDATE 0
-- rows since v4.6's INSERT for those names is now stale-by-default — but
-- the v4.6 seed remains for installations that still apply migrations in
-- order; this migration corrects the result).
-- ============================================================

-- ── 1. RENAME existing rows ─────────────────────────────────────────

-- Claims
UPDATE notification_triggers SET event_key = 'claim_approved'
  WHERE event_key = 'claim.approved';

-- Drawings
UPDATE notification_triggers SET event_key = 'drawing_approval'
  WHERE event_key = 'drawing.approved';
UPDATE notification_triggers SET event_key = 'drawing_flag'
  WHERE event_key = 'drawing.flagged';

-- GRN
UPDATE notification_triggers SET event_key = 'ncr'
  WHERE event_key = 'grn.ncr-raised';

-- Issues
UPDATE notification_triggers SET event_key = 'issue_auto'
  WHERE event_key = 'issue.auto-assigned';
UPDATE notification_triggers SET event_key = 'issue'
  WHERE event_key = 'issue.assigned';
-- 'issue.ncr-vendor' has no underscored equivalent in code (the vendor send
-- is via direct WhatsApp, not through notify). Leaving the seeded row in
-- place; it will continue to never-match-code (harmless).

-- Meetings
UPDATE notification_triggers SET event_key = 'action_item'
  WHERE event_key = 'meeting.action-item-assigned';

-- Payments — split per Decision 4 (May 2026): standard vs urgent are
-- different routes. Code uses 'utr_consolidated' for end-of-week batch
-- notification on standard payments. Urgent UTR is direct wa.send (Path C
-- per Decision Event 3).
UPDATE notification_triggers SET event_key = 'utr_consolidated'
  WHERE event_key = 'payment.utr-batch';
-- 'payment.confirmed-utr' has no clean underscored mapping (the standard
-- per-payment confirmation is the same `utr_consolidated` event). Removing
-- the redundant rows:
DELETE FROM notification_triggers WHERE event_key = 'payment.confirmed-utr';

-- Payment Requests — code uses different event keys per state transition.
-- Mapping each:
UPDATE notification_triggers SET event_key = 'payment_request_raised'
  WHERE event_key = 'payment-request.raised';
UPDATE notification_triggers SET event_key = 'payment_request_pmc_approved'
  WHERE event_key = 'payment-request.pmc-approved';
UPDATE notification_triggers SET event_key = 'payment_request_pmc_rejected'
  WHERE event_key = 'payment-request.pmc-rejected';
UPDATE notification_triggers SET event_key = 'payment_request_principal_approved'
  WHERE event_key = 'payment-request.principal-approved';
UPDATE notification_triggers SET event_key = 'payment_request_principal_rejected'
  WHERE event_key = 'payment-request.principal-rejected';
UPDATE notification_triggers SET event_key = 'payment_request_vendor_confirmed'
  WHERE event_key = 'payment-request.vendor-confirmed';
UPDATE notification_triggers SET event_key = 'urgent_payment'
  WHERE event_key = 'urgent-payment.raised';

-- Reports
UPDATE notification_triggers SET event_key = 'weekly_report_ready'
  WHERE event_key = 'report.ready-for-review';
UPDATE notification_triggers SET event_key = 'drag_flag'
  WHERE event_key = 'report.drag-flag';
UPDATE notification_triggers SET event_key = 'weekly_report'
  WHERE event_key = 'report.pmc-approved';

-- Schedule
UPDATE notification_triggers SET event_key = 'schedule_change'
  WHERE event_key = 'schedule.version-uploaded';
UPDATE notification_triggers SET event_key = 'schedule_drift'
  WHERE event_key = 'schedule.drift-acknowledged';
UPDATE notification_triggers SET event_key = 'task_outlier'
  WHERE event_key = 'schedule.task-outlier';

-- Users
UPDATE notification_triggers SET event_key = 'user_pending'
  WHERE event_key = 'user.pending-approval';
UPDATE notification_triggers SET event_key = 'user_activated'
  WHERE event_key = 'user.activated';

-- Vendors
UPDATE notification_triggers SET event_key = 'vendor_pending_clearance'
  WHERE event_key = 'vendor.pending-clearance';
UPDATE notification_triggers SET event_key = 'engagement_pending_approval'
  WHERE event_key = 'vendor.engagement-pending';
UPDATE notification_triggers SET event_key = 'engagement_approved'
  WHERE event_key = 'vendor.engagement-approved';
UPDATE notification_triggers SET event_key = 'engagement_rejected'
  WHERE event_key = 'vendor.engagement-rejected';

-- Budget
UPDATE notification_triggers SET event_key = 'budget_custom_head'
  WHERE event_key = 'budget.custom-head';

-- Changes
UPDATE notification_triggers SET event_key = 'cn_ready'
  WHERE event_key = 'change-notice.ready';

-- Projects
UPDATE notification_triggers SET event_key = 'client_incomplete'
  WHERE event_key = 'project.client-incomplete';

-- ── 2. ADD missing rows per Decisions 1-18 (May 2026) ───────────────
-- Some events fire in code but had no triggers seeded. Adding now.

-- Update Claim recipients per re-confirmed Event 11+12 (no change but ensures
-- data is current — `claim_approved` was renamed above; now add finance_admin
-- if missing).
INSERT IGNORE INTO notification_triggers (module, event_key, event_label, recipient_role, channel, source_ref) VALUES
  ('Claims',       'claim_approved',           'Claim approved (client RA-bill)',                   'finance_admin',     'whatsapp', 'claims.js:268'),
  ('Claims',       'claim_approved',           'Claim approved (client RA-bill)',                   'pmc_head',          'whatsapp', 'claims.js:274');

-- Event 2 — payment_exception strikes 1+2 per Decision 4 (May 2026)
INSERT IGNORE INTO notification_triggers (module, event_key, event_label, recipient_role, channel, source_ref) VALUES
  ('Payments',     'payment_exception',        'Payment exception (no BOQ — strike 1 or 2)',        'pmc_head',          'whatsapp', 'payments.js:117'),
  ('Payments',     'payment_exception',        'Payment exception (no BOQ — strike 1 or 2)',        'finance_admin',     'whatsapp', 'payments.js:138');

-- Event 4 — vendor_pending_clearance per Decision (May 2026): finance + PMC
-- + stream head. The stream head is route-resolved (not role-listed) because
-- it depends on the vendor's trade, not a fixed role. Adding finance_admin
-- and pmc_head; the stream head call is in route code.
INSERT IGNORE INTO notification_triggers (module, event_key, event_label, recipient_role, channel, source_ref) VALUES
  ('Vendors',      'vendor_pending_clearance', 'Vendor pending finance clearance',                  'pmc_head',          'whatsapp', 'vendors.js:_vendorClearanceRecipients');

-- Event 6 — pi_raised per Decision (May 2026): principals + finance + PMC
INSERT IGNORE INTO notification_triggers (module, event_key, event_label, recipient_role, channel, source_ref) VALUES
  ('Invoices',     'pi_raised',                'Proforma Invoice raised',                            'principal',         'whatsapp', 'invoices.js:184'),
  ('Invoices',     'pi_raised',                'Proforma Invoice raised',                            'design_principal',  'whatsapp', 'invoices.js:184'),
  ('Invoices',     'pi_raised',                'Proforma Invoice raised',                            'finance_admin',     'whatsapp', 'invoices.js:184'),
  ('Invoices',     'pi_raised',                'Proforma Invoice raised',                            'pmc_head',          'whatsapp', 'invoices.js:184');

-- Event 10 — budget_custom_head approved per Decision (May 2026):
-- The REQUEST goes to principals (already seeded as 'budget.custom-head'
-- now renamed to 'budget_custom_head'). The APPROVED notification needs to
-- go to finance_admin. They're different events from a recipient standpoint
-- but share an event_key in code. The route distinguishes via context.
INSERT IGNORE INTO notification_triggers (module, event_key, event_label, recipient_role, channel, source_ref) VALUES
  ('Budget',       'budget_custom_head',       'Custom budget head request or approval',             'finance_admin',     'whatsapp', 'budget.js:259');

-- Event 5 — tally_xml_ready (already finance-only, just adding row)
INSERT IGNORE INTO notification_triggers (module, event_key, event_label, recipient_role, channel, source_ref) VALUES
  ('Clients',      'tally_xml_ready',          'Tally XML ready for import',                         'finance_admin',     'whatsapp', 'clients.js:311');

-- Event 13 — sanity_check (project setup)
INSERT IGNORE INTO notification_triggers (module, event_key, event_label, recipient_role, channel, source_ref) VALUES
  ('Projects',     'sanity_check',             'Date sanity check acknowledged',                     'principal',         'whatsapp', 'project-setup.js:152'),
  ('Projects',     'sanity_check',             'Date sanity check acknowledged',                     'design_principal',  'whatsapp', 'project-setup.js:152');

-- Event 16 — weekly_health_report
INSERT IGNORE INTO notification_triggers (module, event_key, event_label, recipient_role, channel, source_ref) VALUES
  ('Reports',      'weekly_health_report',     'Weekly health report ready',                         'principal',         'whatsapp', 'weekly-health.js:617'),
  ('Reports',      'weekly_health_report',     'Weekly health report ready',                         'design_principal',  'whatsapp', 'weekly-health.js:617');

-- ── 3. INDEX rebuild (event_key was renamed; existing index still valid) ─
-- (Existing INDEX idx_event_key on notification_triggers handles the new
-- values without rebuild — UPDATE doesn't invalidate B-tree indexes on the
-- updated column.)


-- ── v5.27-matrix-pending-polls.sql ─────────────────────────────────────────
-- migrations/v5.27-matrix-pending-polls.sql
-- ============================================================
-- Matrix inbound correlation: pending polls awaiting votes.
--
-- This is the Matrix-side equivalent of wa_pending_actions. When the bot
-- posts a poll for an actionable decision (GRN approve, issue confirm,
-- MOM client ack, etc.), we record a row here keyed on the Matrix poll
-- event_id. A scheduled poll-vote reader scans for new poll responses
-- and correlates them to records in this table to fire state transitions.
--
-- Status lifecycle:
--   pending  → row inserted when poll is sent
--   acted    → vote received and dispatched (terminal)
--   expired  → past expires_at without a vote (terminal)
--   cancelled → superseded by another poll for same ref (terminal)
--
-- Key differences from wa_pending_actions:
--   1. Correlation is by poll event_id, not by phone — Matrix knows which
--      poll a vote is for, so phone lookup ambiguity goes away.
--   2. Voter identity comes from the Matrix sender field on the response
--      event — no need to map phone-to-user-id at vote time.
--   3. Auto-accept on no-reply is preserved as a column but Phase 2 only
--      builds the registration + read path; auto-accept worker is Phase 3.
-- ============================================================

CREATE TABLE IF NOT EXISTS matrix_pending_polls (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- The Matrix event_id of the poll start event, returned by the
  -- adapter's sendPoll() call. We correlate poll responses back to this.
  poll_event_id    VARCHAR(255) NOT NULL,

  -- The room the poll was posted to. Required for the reader to know
  -- which rooms to scan (we don't scan every room every cycle).
  room_id          VARCHAR(255) NOT NULL,

  -- What this poll is FOR. action_type discriminates handler logic;
  -- ref_id + ref_table point at the business object being decided on.
  action_type      VARCHAR(64)  NOT NULL,
  ref_id           INT UNSIGNED NOT NULL,
  ref_table        VARCHAR(64)  NOT NULL,

  -- Optional: the user we expected to vote. NULL means "any room member".
  -- For DM polls (one approver), set this to constrain. For multi-voter
  -- rooms (e.g. GRN approval where any PMC head is fine), leave NULL.
  expected_voter_uid INT UNSIGNED NULL,

  -- The poll question text — denormalised here for audit/debug. Source
  -- of truth is the Matrix room.
  question         TEXT NOT NULL,

  -- Lifecycle
  status           ENUM('pending','acted','expired','cancelled')
                     NOT NULL DEFAULT 'pending',
  expires_at       DATETIME NOT NULL,
  auto_accept_at   DATETIME NULL,

  -- Recorded when a vote is processed
  voter_mxid       VARCHAR(255) NULL,    -- Matrix user id of the voter
  voter_uid        INT UNSIGNED NULL,    -- resolved nu PMC user id (NULL if unknown)
  vote_answer_id   VARCHAR(64)  NULL,    -- e.g. 'yes', 'no', 'approve', 'mismatch'
  vote_event_id    VARCHAR(255) NULL,    -- Matrix event_id of the response
  acted_at         DATETIME NULL,

  -- Bookkeeping
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Idempotency: the same poll cannot be registered twice
  UNIQUE KEY uq_poll_event (poll_event_id),
  -- Reader filter: only scan rooms with pending polls in their window
  INDEX idx_status_room (status, room_id, expires_at),
  -- Cancel-on-supersede lookup
  INDEX idx_active_ref (action_type, ref_id, status),
  -- Voter resolution
  INDEX idx_voter (voter_uid),

  FOREIGN KEY (expected_voter_uid) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (voter_uid)          REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Reader cursor: track last-read event per room ───────────────────
-- Matrix's /rooms/{roomId}/messages endpoint returns events in reverse
-- chronological order. To avoid reprocessing every poll vote on every
-- reader cycle, we record the highest event timestamp we've seen per
-- room. The reader filters on origin_server_ts > last_seen_ts.
--
-- last_seen_ts is the Unix ms timestamp of the most recent event we
-- processed (poll response or otherwise) on that room. Initialised to
-- NOW() the first time the reader visits a room.

CREATE TABLE IF NOT EXISTS matrix_reader_cursor (
  room_id        VARCHAR(255) NOT NULL PRIMARY KEY,
  last_seen_ts   BIGINT UNSIGNED NOT NULL,
  last_run_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 1 AS v5_27_matrix_pending_polls;


-- ── v5.28-matrix-rooms-retypeenum.sql ─────────────────────────────────────────
-- migrations/v5.28-matrix-rooms-retypeenum.sql
-- ============================================================
-- Retype matrix_rooms.room_type enum per Principal's May 2026 decision.
--
-- v5.23 originally seeded the enum from brief §7.1's project room
-- structure: site / finance / design / general (+ org-wide rooms).
-- Principal's revised structure (recorded in MATRIX_MIGRATION_PLAN.md):
--   - 'coordination' (was 'site' + adds vendors)
--   - 'internal'     (was 'design'; merges all internal-only streams)
--   - 'finance'      (unchanged)
--   - 'general'      DROPPED — Element X covers personal chat
--
-- This migration:
--   1. Maps any existing rows from old values → new values
--      (defensive — likely no production rows exist yet, but safe to run)
--   2. Replaces the enum definition
--   3. Documents the change inline so a future reader sees both states
--
-- Org-wide values (internal_principal, internal_finance, system_health)
-- are unchanged and carried forward verbatim.
--
-- Idempotency: running twice is safe — UPDATE matches zero rows the
-- second time, ALTER TABLE is destructive on enum but lossless when
-- new enum is a superset of distinct existing values.
-- ============================================================

-- 1. Map old room_type values to new ones.
-- 'site'    → 'coordination'  (now includes vendors via bridge)
-- 'design'  → 'internal'      (merged stream-specific rooms)
-- 'general' → row DELETED     (drop the encrypted human-only room;
--                              Element X covers personal team chat)
-- 'finance' → unchanged
UPDATE matrix_rooms SET room_type = 'coordination' WHERE room_type = 'site';
UPDATE matrix_rooms SET room_type = 'internal'     WHERE room_type = 'design';

-- 'general' rooms had encrypted=1 and were the only encrypted entries.
-- We archive rather than delete (preserve audit trail) but exclude
-- them from active room_type values via the enum re-definition below.
UPDATE matrix_rooms SET archived_at = NOW() WHERE room_type = 'general' AND archived_at IS NULL;

-- 2. Re-declare the enum to reflect the new project room types.
-- Pre-condition: no active rows on dropped values (handled above).
ALTER TABLE matrix_rooms
  MODIFY COLUMN room_type ENUM(
    -- Project rooms (per-project)
    'coordination',
    'internal',
    'finance',
    -- Org-wide rooms (project_id NULL)
    'internal_principal',
    'internal_finance',
    'system_health',
    -- Legacy values — kept in enum so archived 'general' rows remain
    -- queryable; do NOT use for new rows. Provisioning scripts only
    -- emit values from the active set above.
    'site',
    'design',
    'general'
  ) NOT NULL;

-- Note on the legacy values: keeping 'site', 'design', 'general' in
-- the enum is a transitional accommodation. A future migration (post
-- Phase 4 of Matrix migration) can drop them once we confirm no
-- archived rows still reference them in queries downstream of any
-- analytics / audit views.

SELECT 1 AS v5_28_matrix_rooms_retypeenum;


-- ── v5.29-config-tables.sql ─────────────────────────────────────────
-- migrations/v5.29-config-tables.sql
-- ============================================================
-- v2 brief alignment — add the four config tables mandated by C7.
--
-- Brief context (v2.0, 1 May 2026):
--   C7 — "Configuration — NOTHING hardcoded". Routing, timing, and
--   threshold values must live in the database, not in code.
--
-- This migration adds:
--   1. signoff_workflows     — one row per (workflow_type), drives the
--                              poll-vs-PWA gate (P6) for every sign-off
--   2. notifications_config  — digest schedule (P5/P7.4)
--   3. project_thresholds    — per-project headcount, float, overdue
--                              alert thresholds; replaces hardcoded values
--                              currently scattered in scripts/overdue-checker.js
--                              and elsewhere
--   4. security_config       — vendor cooling hours (P9.1, deferred per V8
--                              decision but the slot stays), canary time
--                              (P10.1), max vote window
--
-- A fifth table (formal_communications) is added in this same migration
-- because v2 P4.3 / C10 mandate it for the mailto "Mark as Sent" flow.
--
-- Related but separate: notification_triggers (v4.6 + v5.26) already
-- exists and continues to drive role→event recipient mapping; it is
-- complementary to signoff_workflows (which drives channel routing) and
-- not duplicated by it.
-- ============================================================

-- ── 1. signoff_workflows ─────────────────────────────────────────────
-- One row per workflow_type. Every sign-off in the app reads its row
-- to decide whether to use the poll path (single/relay/acknowledgement)
-- or the PWA path (multi-person sign-off).
--
-- signoff_type:
--   'poll' → matrixPoll() to first/sole approver's room. For relay,
--            server advances to next approver on each vote.
--   'pwa'  → matrixSend() to each approver's room with a deep link.
--            Approvers act in PWA; quorum tracked by server.
--
-- closing_minutes:
--   For time-based polls (daily report, GRN approval, snag rectified),
--   a scheduled job closes the poll after this many minutes. Latest
--   vote per sender wins.
--   NULL means quorum-based: poll closes when quorum_required votes
--   are received (used for payment_batch).
--
-- pwa_route:
--   For 'pwa' type, the relative route the deep link points at. The
--   message generator will prepend PWA_BASE_URL.
DROP TABLE IF EXISTS signoff_workflows;
CREATE TABLE IF NOT EXISTS signoff_workflows (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workflow_type       VARCHAR(64)  NOT NULL UNIQUE,
  signoff_type        ENUM('poll','pwa') NOT NULL,
  -- For poll: number of approvers required (1 for single, N for relay).
  -- For pwa:  number of distinct sign-offs required for quorum.
  quorum_required     INT UNSIGNED NOT NULL DEFAULT 1,
  -- Time-based close window for routine polls. NULL = quorum-based.
  closing_minutes     INT UNSIGNED NULL,
  -- Comma-separated role keys; resolved against users.role at runtime.
  -- For 'all_heads' shortcuts (project_closure), expand at the gate.
  required_roles      VARCHAR(255) NOT NULL,
  -- User who's notified on SLA breach / no quorum within window.
  -- NULL = no escalation (escalation is governed elsewhere if needed).
  escalation_user_id  INT UNSIGNED NULL,
  -- For 'pwa' type: relative path opened on tap.
  pwa_route           VARCHAR(255) NULL,
  active              TINYINT(1)   NOT NULL DEFAULT 1,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (active),
  FOREIGN KEY (escalation_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed from brief §P6.4 — complete workflow list.
-- closing_minutes only set for time-based polls (the routine ones).
-- Everything else is quorum-based (closing_minutes = NULL).
INSERT INTO signoff_workflows (workflow_type, signoff_type, quorum_required, closing_minutes, required_roles, pwa_route) VALUES
  ('daily_report',     'poll', 1, 120,  'pmc_head',                                                   NULL),
  ('grn_approval',     'poll', 1, 120,  'pmc_head',                                                   NULL),
  ('snag_rectified',   'poll', 1, 60,   'pmc_head',                                                   NULL),
  ('mom_ack',          'poll', 1, 1440, 'recipient',                                                  NULL),
  ('drawing_query_ack','poll', 1, 1440, 'recipient',                                                  NULL),
  ('payment_batch',    'poll', 2, NULL, 'finance_admin,principal',                                    NULL),
  ('change_notice',    'pwa',  3, NULL, 'pmc_head,design_principal,principal',                        '/sign-off/change-notice'),
  ('weekly_report',    'pwa',  2, NULL, 'pmc_head,principal',                                         '/sign-off/weekly-report'),
  ('project_closure',  'pwa',  4, NULL, 'pmc_head,design_principal,principal,finance_admin',          '/sign-off/project-closure'),
  ('final_settlement', 'pwa',  3, NULL, 'pmc_head,principal,finance_admin',                           '/sign-off/final-settlement'),
  ('handover_checklist','pwa', 2, NULL, 'pmc_head,principal',                                         '/sign-off/handover'),
  ('dlp_signoff',      'pwa',  3, NULL, 'pmc_head,design_principal,principal',                        '/sign-off/dlp');

-- ── 2. notifications_config ──────────────────────────────────────────
-- Brief §P7.4 / C11. Drives daily digest send times. One row per
-- digest type. Application code reads (digest_type, send_time, active)
-- and the cron worker fires at the configured times.
DROP TABLE IF EXISTS notifications_config;
CREATE TABLE IF NOT EXISTS notifications_config (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  digest_type   VARCHAR(50) NOT NULL UNIQUE,
  send_time     TIME        NOT NULL,
  active        TINYINT(1)  NOT NULL DEFAULT 1,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO notifications_config (digest_type, send_time) VALUES
  ('morning_pmc',     '07:00:00'),  -- per-project digest to PMC heads
  ('principal_morning',  '08:00:00'),  -- cross-project digest to principals
  ('closeout',        '21:00:00');  -- end-of-day status digest

-- ── 3. project_thresholds ────────────────────────────────────────────
-- Brief §P2.5. Per-project alert thresholds. Replaces hardcoded numbers
-- across scripts/overdue-checker.js, scripts/schedule-health-checker.js,
-- and various route handlers (D12 in May 2026 audit).
--
-- Optional global defaults: a row with project_id NULL acts as the
-- fallback when a project doesn't have a per-project override. Lookup
-- helper picks per-project row first, falls back to NULL row.
DROP TABLE IF EXISTS project_thresholds;
CREATE TABLE IF NOT EXISTS project_thresholds (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id       INT UNSIGNED NULL,
  threshold_type   VARCHAR(50)  NOT NULL,  -- min_headcount|float_days|overdue_days|grn_pending_days|...
  threshold_value  INT          NOT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- A project has at most one row per threshold_type.
  -- For global defaults (project_id NULL), uniqueness enforced via UNIQUE on threshold_type
  -- alone is wrong — multiple project rows would conflict. Use a generated column trick:
  -- here we just rely on app-level uniqueness for project rows + a separate UNIQUE index
  -- on (threshold_type) WHERE project_id IS NULL would be ideal but MySQL pre-8 doesn't
  -- support filtered indexes; emulate with a NULL-handling unique key.
  UNIQUE KEY uq_project_threshold (project_id, threshold_type),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Global defaults — used when a project doesn't override.
-- These mirror current hardcoded values so behaviour doesn't change
-- on rollout; per-project tuning happens later via PWA settings.
INSERT INTO project_thresholds (project_id, threshold_type, threshold_value) VALUES
  (NULL, 'min_headcount',     8),    -- per brief P2.5 example
  (NULL, 'float_days',        3),    -- per brief P2.5 example
  (NULL, 'overdue_days',      2),    -- daily reports overdue alert
  (NULL, 'grn_pending_days',  3),    -- GRN sitting un-approved
  (NULL, 'snag_pending_days', 7),    -- snag awaiting rectification
  (NULL, 'budget_alert_pct',  90);   -- C3: alert Finance + Principal when category spend reaches 90%

-- ── 4. security_config ───────────────────────────────────────────────
-- Brief §P2.6. Single global key/value table for security-sensitive
-- and operational tunables. Strings only — callers parse to int/time
-- as needed. Safer than per-type ENUM because new keys land without
-- migration.
DROP TABLE IF EXISTS security_config;
CREATE TABLE IF NOT EXISTS security_config (
  config_key    VARCHAR(100) PRIMARY KEY,
  config_value  VARCHAR(255) NOT NULL,
  description   VARCHAR(500) NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO security_config (config_key, config_value, description) VALUES
  -- v2 P9.1's V7 vendor-bank-confirm cooling period.
  -- Note: nu PMC uses V8 (peer-approval) per Principal's May 2026 decision;
  -- this row is reserved for the day V7 might be revisited. Currently
  -- unread by code.
  ('vendor_bank_change_cooling_hours', '24',  'V7 vendor-confirm cooling window. UNUSED while V8 peer-approval model is in effect.'),
  ('canary_time',                      '06:00','When the daily canary suite runs. HH:MM in IST.'),
  ('max_vote_window_minutes',          '1440','Hard cap on poll closing_minutes; rejected at gate if exceeded.'),
  ('signoff_lock_after_close_minutes', '5',   'Grace period after a poll closes before vote rows become read-only.');

-- ── 5. formal_communications ─────────────────────────────────────────
-- Brief §P4.3 / C10. Audit record for tap-mailto formal external
-- documents. Server cannot detect that the email was sent (mail client
-- is local), so the user taps "Mark as Sent" in the PWA after sending.
-- That call lands here.
--
-- Used by: PI raised → client, weekly report → client, change notice
-- → client, final settlement → vendor, NCR → contractor, DLP → vendor.
DROP TABLE IF EXISTS formal_communications;
CREATE TABLE IF NOT EXISTS formal_communications (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_type     VARCHAR(64)  NOT NULL,  -- pi|weekly_report|change_notice|final_settlement|ncr|dlp
  document_id       INT UNSIGNED NOT NULL,  -- FK varies by document_type — denormalised for cross-doc audit
  -- The "ours" side: who sent it (the named nu PMC user whose mail client did the send).
  sender_user_id    INT UNSIGNED NULL,
  sender_email      VARCHAR(255) NULL,      -- snapshot at send time
  -- The "their" side: who got it. May be a vendor row, client row, or external email.
  recipient_kind    ENUM('vendor','client','external') NOT NULL,
  recipient_ref_id  INT UNSIGNED NULL,      -- vendors.id or client_master.id when applicable
  recipient_email   VARCHAR(255) NOT NULL,
  -- The user pressed "Mark as Sent" in PWA at this time.
  sent_at           DATETIME     NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Audit hooks
  matrix_event_id   VARCHAR(255) NULL,      -- the bot message that posted the mailto link
  notes             TEXT         NULL,
  INDEX idx_document (document_type, document_id),
  INDEX idx_sender   (sender_user_id, sent_at),
  INDEX idx_recipient(recipient_kind, recipient_ref_id),
  FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 1 AS v5_29_config_tables;


-- ── v5.30-drop-notification-channel.sql ─────────────────────────────────────────
-- migrations/v5.30-drop-notification-channel.sql
-- ============================================================
-- Drop users.notification_channel — v2 brief alignment.
--
-- Brief context (v2.0, 1 May 2026):
--   §P5.2: "All notification calls go through NotificationService.
--   One environment variable switches between Matrix and WhatsApp."
--   No per-user override; channel is an ops-level decision only.
--
-- Principal's prior decision (May 2026): "If a user checks into matrix,
-- then he cannot get out, internal or external." Lock-in by design,
-- no per-user opt-out — which is what this column was implementing.
--
-- The column was added in v5.23 as part of the dual-substrate rollout.
-- v2 brief makes the dual-substrate temporary: WhatsApp is emergency
-- rollback only (P10.2), driven by NOTIFICATIONS env flag.
--
-- This migration:
--   1. Removes the index that depends on the column
--   2. Drops the column
--   3. Leaves users.matrix_user_id, users.matrix_room_id, users.phone
--      as the only Matrix-relevant columns
--
-- Code side: services/messaging.js is being simplified in the same
-- changeset to read only the env flag, not user pref.
-- ============================================================

-- NOTE: notification_channel was never added (v5.23 ALTER skipped — column
-- is not in the base CREATE TABLE users). DROP skipped to avoid error.

SELECT 1 AS v5_30_drop_notification_channel;


-- ── v5.31-signoff-relay-schema.sql ─────────────────────────────────────────
-- migrations/v5.31-signoff-relay-schema.sql
-- ============================================================
-- Sign-off relay model — schema deltas per delta brief (1 May 2026).
--
-- Brief context:
--   nu-pmc-signoff-delta-brief.docx supersedes v2 brief P6.4. Almost
--   every sign-off becomes a relay-style poll (sequence-driven).
--   Multi-person PWA sign-offs from v2 brief are gone; the only PWA
--   touchpoint left is the mailto fallback when an external client
--   isn't on Element X.
--
-- This migration:
--   1. signoff_workflows  — rename required_roles → sequence
--                         — add principal_threshold_pct
--                         — drop pwa_route (no PWA path now)
--   2. projects           — contract_value already exists in baseline,
--                            confirmed (we re-use, no add)
--   3. change_notices     — add cn_origin, cost_liability, is_emergency
--   4. project_closures   — table doesn't exist yet, create with brief fields
--   5. client_contacts    — table doesn't exist yet, create with matrix_room_id
--   6. signoff_workflows reseed — Section 2 of delta brief
-- ============================================================

-- ── 1. signoff_workflows ─────────────────────────────────────────────
-- Rename required_roles → sequence (semantic clarity for relay), add
-- principal_threshold_pct, drop pwa_route.
ALTER TABLE signoff_workflows
  CHANGE COLUMN required_roles sequence VARCHAR(255) NOT NULL,
  ADD COLUMN principal_threshold_pct DECIMAL(5,2) NULL
    COMMENT 'NULL = always involve principal. N.NN = skip principal if doc value < N.NN%% of contract_value' AFTER closing_minutes,
  DROP COLUMN pwa_route;

-- The signoff_type enum stays { poll, pwa } even though after this
-- delta brief almost everything is poll. The pwa value remains valid
-- for handover_checklist client mailto fallback (decided at the gate,
-- not from this column — kept here for future PWA-shape sign-offs if
-- the model swings back).

-- ── 2. change_notices — three new fields ──────────────────────────
-- cn_origin discriminates internal (raised by us) from external (client).
-- It's derivable from existing `source` column ('client' → external,
-- {site, design, statutory} → internal) — but the delta brief wants it
-- as a distinct field, so we surface it explicitly. Application code
-- fills both at insert time; downstream readers use cn_origin.
--
-- cost_liability is financial-record-only (not a routing decision per
-- §3.3 of the delta brief).
--
-- is_emergency = 1 → Design Lead skipped from main relay; cn_design_ratification
-- workflow auto-triggered after Principal approves.
ALTER TABLE change_notices
  ADD COLUMN cn_origin     ENUM('internal','external') NULL AFTER source,
  ADD COLUMN cost_liability ENUM('client','consultant','contractor','absorbed') NULL AFTER cn_origin,
  ADD COLUMN is_emergency  TINYINT(1) NOT NULL DEFAULT 0 AFTER cost_liability;

-- Backfill existing rows: derive cn_origin from source.
UPDATE change_notices
   SET cn_origin = CASE WHEN source = 'client' THEN 'external' ELSE 'internal' END
 WHERE cn_origin IS NULL;

-- ── 3. project_closures table ────────────────────────────────────────
-- Doesn't exist in baseline — create it. Tracks the project-closure
-- relay state so we can pause/resume the Finance step pending
-- final_settlement completion.
CREATE TABLE IF NOT EXISTS project_closures (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id            INT UNSIGNED NOT NULL,
  closure_block_id      INT UNSIGNED NULL,
    -- NULL = whole-project closure
    -- non-NULL = partial block closure (FK to project_blocks once that
    -- table exists; brief mentions it but it's not in baseline either)
  finance_step_blocked  TINYINT(1) NOT NULL DEFAULT 0,
    -- TRUE while final_settlement is pending; relay scheduler resumes
    -- the Finance step when settlement completes
  status                ENUM('pending','in_progress','completed','cancelled')
                          NOT NULL DEFAULT 'pending',
  initiated_by          INT UNSIGNED NULL,
  initiated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at          DATETIME NULL,
  notes                 TEXT NULL,
  INDEX idx_project (project_id),
  INDEX idx_blocked (finance_step_blocked, status),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. clients — add matrix_room_id ─────────────────────────────────
-- Delta brief §3.5 said "ALTER TABLE client_contacts ADD COLUMN
-- matrix_room_id" — but client_contacts doesn't exist. Client contact
-- info lives on the existing clients master table (contact_person,
-- contact_phone, contact_whatsapp, contact_email). We add matrix_room_id
-- there. NULL = client not on Element X; sign-offs needing the client
-- go via mailto fallback through PMC's room (delta brief §6.2).
ALTER TABLE clients
  ADD COLUMN matrix_room_id VARCHAR(255) NULL
    COMMENT 'Element X room id for this client. NULL = use mailto fallback via PMC.';

-- ── 5. signoff_workflows reseed ──────────────────────────────────────
-- v5.29 seeded v2-brief workflows. Delta brief §2 redefines them.
-- Truncate-and-reseed is safe here because no live signoff_instances
-- depend on workflow_type identity (the FK is by workflow_type STRING,
-- not workflow_id, in the delta brief's design — so the row contents
-- are config, not entity references).
TRUNCATE TABLE signoff_workflows;

-- closing_minutes:
--   value (e.g. 120) = time-based close. Single-approver routine workflows.
--   NULL              = quorum-based close. Relay sequences.
--
-- principal_threshold_pct:
--   NULL  = always involve principal
--   N.NN  = skip principal if document value < N.NN% of project.contract_value
INSERT INTO signoff_workflows (workflow_type, signoff_type, quorum_required, closing_minutes, sequence, principal_threshold_pct) VALUES
  ('daily_report',           'poll', 1, 120,  'pmc',                                    NULL),
  ('grn_approval',           'poll', 1, 120,  'pmc',                                    NULL),
  ('snag_rectified',         'poll', 1, 60,   'pmc',                                    NULL),
  ('mom_acknowledgement',    'poll', 1, 1440, 'recipient',                              NULL),
  ('drawing_query_ack',      'poll', 1, 1440, 'pmc',                                    NULL),
  ('payment_batch',          'poll', 2, NULL, 'finance,principal',                         NULL),
  ('weekly_report',          'poll', 2, NULL, 'pmc,principal',                          NULL),
  ('final_settlement',       'poll', 3, NULL, 'finance,principal,principal',               2.00),
  ('dlp_signoff',            'poll', 3, NULL, 'design_lead,services_head,pmc',          NULL),
  -- change_notice base sequence: full ladder. Conditional skips/appends
  -- are applied by the gate via signoff_sequence_rules at trigger time
  -- (added in v5.33). DO NOT shorten this sequence here; the rules
  -- engine assumes it has the full set to trim from.
  ('change_notice',          'poll', 0, NULL, 'site_manager,pmc,design_lead,principal', 1.00),
    -- quorum_required=0 because the rules engine determines effective
    -- quorum at runtime; the gate uses the post-rules sequence length.
  -- project_closure: same pattern. Base = full sequence, rules trim.
  ('project_closure',        'poll', 0, NULL, 'site_manager,design_lead,finance,principal', NULL),
  ('handover_checklist',     'poll', 2, NULL, 'pmc,client_rep',                         NULL),
  ('cn_design_ratification', 'poll', 1, 2880, 'design_lead',                            NULL);

SELECT 1 AS v5_31_signoff_relay_schema;


-- ── v5.32-signoff-instances.sql ─────────────────────────────────────────
-- migrations/v5.32-signoff-instances.sql
-- ============================================================
-- signoff_instances — one row per active sign-off, tracks relay state.
--
-- Delta brief §8 (1 May 2026) introduces signoff_instances as the
-- universal store for in-flight sign-offs. Replaces matrix_pending_polls
-- (v5.27) for sign-off purposes; matrix_pending_polls is kept around
-- for low-stakes one-shot polls (e.g. acknowledgement-style flows that
-- aren't part of a workflow_type).
--
-- Columns reflect the brief's relay model:
--   workflow_type        — FK-by-string to signoff_workflows.workflow_type
--   document_id          — PK of the business object being signed off
--   project_id           — denormalised for room/threshold lookups
--   poll_event_id        — current Matrix poll event_id awaiting vote
--   current_approver_id  — whose vote we're currently waiting on
--   remaining_approvers  — JSON array of user_ids in relay order
--   status               — pending|in_progress|completed|cancelled|expired
--   closes_at            — for time-based closures only; NULL for quorum
--   question / options   — denormalised so triggerNextRelayStep can
--                            re-send the SAME poll content to the next
--                            approver without re-deriving it
--
-- Concurrency: relay advancement (triggerNextRelayStep) updates
-- current_approver_id + remaining_approvers atomically with a status
-- check, so two concurrent vote-receivers can't both advance.
-- ============================================================

CREATE TABLE IF NOT EXISTS signoff_instances (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workflow_type         VARCHAR(64)  NOT NULL,
  document_id           INT UNSIGNED NOT NULL,
  project_id            INT UNSIGNED NULL,
    -- Some sign-offs are not project-scoped (e.g. organisation-wide
    -- workflows in future). NULL allowed.

  -- Active poll state
  poll_event_id         VARCHAR(255) NULL,
    -- The current Matrix poll event_id we're waiting for a vote on.
    -- NULL between vote-received and next-poll-sent (very brief).
  poll_room_id          VARCHAR(255) NULL,
    -- The room the current poll was sent to (for vote-reader correlation).
  current_approver_id   INT UNSIGNED NULL,
    -- The user we're currently waiting on. NULL when status terminal.

  -- Relay sequence (after the current approver)
  remaining_approvers   JSON NOT NULL,
    -- Ordered array of user_ids. Empty array = current approver is the
    -- last in the relay; voting closes the workflow.
  full_sequence         JSON NOT NULL,
    -- Full relay as resolved at trigger time. Useful for audit and for
    -- regenerating remaining_approvers on retry.

  -- Poll content (denormalised so we don't rebuild it for each relay step)
  question              TEXT NULL,
  options               JSON NULL,
    -- e.g. [{"id":"yes","text":"✅ Approve"},{"id":"no","text":"❌ Reject"}]

  -- Lifecycle
  status                ENUM('pending','in_progress','completed','cancelled','expired')
                          NOT NULL DEFAULT 'pending',
  closes_at             DATETIME NULL,
    -- Time-based close target. NULL for quorum-based.

  -- Outcome
  result                ENUM('approved','rejected','no_quorum','timed_out') NULL,
    -- Set on terminal status

  -- Bookkeeping
  triggered_by_user_id  INT UNSIGNED NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at          DATETIME NULL,

  -- Indices for the hot paths
  INDEX idx_active_lookup (workflow_type, document_id, status),
    -- triggerSignoff: cancel any prior pending instance for same (type, doc)
  INDEX idx_poll_event (poll_event_id),
    -- vote reader: correlate vote → instance via poll event_id
  INDEX idx_pending_close (status, closes_at),
    -- expirer: find pending rows past closes_at
  INDEX idx_current_approver (current_approver_id, status),
    -- "What's pending for me" lookups

  FOREIGN KEY (project_id)          REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (current_approver_id) REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (triggered_by_user_id) REFERENCES users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── signoff_votes — audit trail of every vote received ──────────────
-- One row per (instance, approver). Records what each approver voted
-- and when, even if the poll has since advanced. Useful for showing
-- "who has voted so far" on PWA detail screens and for post-mortem.
CREATE TABLE IF NOT EXISTS signoff_votes (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  signoff_instance_id INT UNSIGNED NOT NULL,
  voter_user_id       INT UNSIGNED NULL,
    -- NULL only if vote came from someone outside our user table
    -- (e.g. a client_rep sign-off where client isn't a system user)
  voter_mxid          VARCHAR(255) NULL,
  vote_answer_id      VARCHAR(64)  NOT NULL,
    -- 'yes'/'no' or whatever the poll options used
  vote_event_id       VARCHAR(255) NULL,
    -- Matrix event_id of the response
  voted_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- One vote per approver per instance.
  UNIQUE KEY uq_instance_voter (signoff_instance_id, voter_user_id),
  INDEX idx_instance (signoff_instance_id),
  FOREIGN KEY (signoff_instance_id) REFERENCES signoff_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (voter_user_id)       REFERENCES users(id)             ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Note: matrix_pending_polls (v5.27) is NOT dropped by this migration.
-- It continues to handle one-shot polls that aren't part of a workflow.
-- Phase 4 of the Matrix migration will revisit whether to consolidate.

SELECT 1 AS v5_32_signoff_instances;


-- ── v5.33-signoff-sequence-rules.sql ─────────────────────────────────────────
-- migrations/v5.33-signoff-sequence-rules.sql
-- ============================================================
-- signoff_sequence_rules — data-driven dynamic relay logic.
--
-- The delta brief (1 May 2026) describes two dynamic builders:
--   buildCNRelaySequence   (skip Design Lead if emergency, skip
--                            Principal below threshold, append client_rep
--                            if external origin)
--   buildClosureRelaySequence (skip Design Lead if no snags, skip
--                                Finance until settlement complete)
--
-- Rather than encoding those as two if/else functions in code, this
-- migration represents them as rows in a rules table. The gate has
-- ONE builder that:
--
--   1. Loads the workflow's `sequence` column. If it starts with a comma-
--      separated list of roles, that's the base sequence.
--   2. Loads all rows from signoff_sequence_rules for the workflow_type.
--   3. Evaluates each predicate (by name — see below). If the predicate
--      is true, applies the rule's action to the sequence.
--   4. Returns the resulting ordered list of role tokens.
--
-- This means a new conditional rule (e.g. "PMC also skipped if site
-- already handed over") is one INSERT, not a code change.
--
-- predicate_name / action_name are NAMED TOKENS — the gate registers
-- a small set of predicate evaluators and action appliers. New tokens
-- require code (because predicates need to read DB state and actions
-- mutate the sequence in specific ways), but new RULES using existing
-- tokens are data only.
--
-- Predicate registry (initial set):
--   is_emergency           change_notices.is_emergency = 1
--   below_threshold        document value < signoff_workflows.principal_threshold_pct% of project.contract_value
--   external_origin        change_notices.cn_origin = 'external'
--   no_snags               COUNT(issues WHERE issue_type IN ('snag','dlp_snag')) = 0
--   settlement_pending     no completed final_settlement signoff_instance for project
--   always                 always true (used for unconditional rules like "strip initiator")
--
-- Action registry (initial set):
--   skip_role              remove `role_token` from sequence
--   append_role            push `role_token` onto end of sequence
--   strip_initiator        remove the document's initiator role from sequence
-- ============================================================

CREATE TABLE IF NOT EXISTS signoff_sequence_rules (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workflow_type   VARCHAR(64)  NOT NULL,
  -- Order rules apply in. Lower = earlier. strip_initiator typically
  -- runs first (priority 10), then conditional skips (priority 20-30),
  -- then appends (priority 90).
  priority        INT UNSIGNED NOT NULL DEFAULT 50,
  -- Named predicate from the registry above. NULL or 'always' = unconditional.
  predicate_name  VARCHAR(64)  NULL,
  -- Named action from the registry above.
  action_name     VARCHAR(64)  NOT NULL,
  -- Role token the action operates on (e.g. 'design_lead' for skip_role).
  -- NULL when the action doesn't need it (e.g. strip_initiator).
  role_token      VARCHAR(64)  NULL,
  -- Free-form notes for governance.
  notes           VARCHAR(500) NULL,
  active          TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_workflow_priority (workflow_type, active, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Seed rules for change_notice ────────────────────────────────────
-- Base sequence in signoff_workflows.sequence is the FULL ladder
-- 'site_manager,pmc,design_lead,principal' (seeded in v5.31). Rules
-- below trim/extend at trigger time.

INSERT INTO signoff_sequence_rules (workflow_type, priority, predicate_name, action_name, role_token, notes) VALUES
  -- Always strip initiator (the person raising the CN doesn't approve themselves).
  ('change_notice', 10, 'always',           'strip_initiator', NULL,         'CN initiator does not approve own document'),
  -- Emergency CN: Design Lead skipped (handled later via cn_design_ratification follow-up).
  ('change_notice', 20, 'is_emergency',     'skip_role',       'design_lead','Emergency CN — Design ratifies after, not before'),
  -- Below 1% of contract value: Principal not required.
  ('change_notice', 30, 'below_threshold',  'skip_role',       'principal',  'Below 1% threshold — PMC + Design only'),
  -- External (client-raised) CN: client confirms cost at the end.
  ('change_notice', 90, 'external_origin',  'append_role',     'client_rep', 'External CN closes with client confirmation');

-- ── Seed rules for project_closure ──────────────────────────────────

INSERT INTO signoff_sequence_rules (workflow_type, priority, predicate_name, action_name, role_token, notes) VALUES
  -- Skip Design Lead if no snags raised on this project.
  ('project_closure', 20, 'no_snags',           'skip_role', 'design_lead',
   'No snags ever raised — Design Lead has nothing to confirm cleared'),
  -- Block Finance step until final_settlement completes. Builder also
  -- sets project_closures.finance_step_blocked = 1; scheduler resumes
  -- the relay when settlement completes.
  ('project_closure', 30, 'settlement_pending', 'skip_role', 'finance',
   'Final settlement not complete — Finance step deferred and resumed');

SELECT 1 AS v5_33_signoff_sequence_rules;


-- ── v5.34-additional-signoff-workflows.sql ─────────────────────────────────────────
-- migrations/v5.34-additional-signoff-workflows.sql
-- ============================================================
-- Add workflow types that exist as wa-reply-actions in code but are
-- missing from the v5.31 signoff_workflows seed.
--
-- v5.31 seeded the workflow types listed in the v2/delta briefs.
-- During Phase 3 caller migration we discovered caller sites using
-- actionType values not in that list:
--
--   issue_confirm        — PMC confirms a newly-raised issue is real
--                          (site/issues.js create flow) — MIGRATED
--   urgent_payment_fyi   — PMC informational ack on an urgent payment
--                          (finance/payment-requests.js urgent flow)
--                          — pending Phase 3
--   mom_client_ack       — Client acknowledges meeting minutes. The
--                          MOM caller in meetings.js dispatches to a
--                          client. Now that clients.matrix_room_id
--                          exists (v5.31, corrected from delta brief's
--                          mythical client_contacts table), the gate's
--                          'client_rep' resolver can resolve to it.
--                          When matrix_room_id is NULL the gate's
--                          INSERT still records the signoff_instance
--                          but pollEventId is null — the caller must
--                          handle the mailto fallback for legacy clients
--                          not yet on Element X. (Today's behaviour
--                          for those clients is unchanged: the mailto
--                          deep link in the WhatsApp message is the
--                          fallback, with PMC tapping Mark as Sent.
--                          That UI path stays in meetings.js until
--                          most clients are onboarded.)
--                          MIGRATED below.
--
--   drawing_approval     — Design / Services head approves a drawing
--                          revision. The WhatsApp path attached a
--                          thumbnail image alongside the Approve/Hold
--                          buttons for minor revisions (R1/R2). The
--                          gate's _dispatchPoll now supports an
--                          opts.attachImage parameter that uploads to
--                          Matrix and posts as an image immediately
--                          before the poll. Inline thumbnail preserved.
-- closing_minutes is 1440 (24h) — same as the WA expiry window.
--
--   change_notice principal-approval (changes.js line 167) — DEFERRED.
--                          The signoff_workflows row for change_notice
--                          already has the dynamic relay sequence
--                          builder (v5.31 + v5.33). The existing
--                          changes.js handler runs a parallel peer-
--                          signature flow that pre-dates the gate, with
--                          its own state transitions and signature
--                          recording. Migrating means replacing the
--                          whole CN approval handler against the gate
--                          model — a workflow refactor, not a single
--                          caller migration. Tracking separately.
--
-- closing_minutes values mirror EXPIRY_HOURS in services/matrix-reply-
-- actions.js so behaviour is unchanged from the WhatsApp path:
--   issue_confirm:      24h (1440 min)
--   urgent_payment_fyi:  4h ( 240 min)
-- ============================================================

INSERT INTO signoff_workflows
  (workflow_type, signoff_type, quorum_required, closing_minutes, sequence, principal_threshold_pct)
VALUES
  ('issue_confirm',      'poll', 1, 1440, 'pmc',                       NULL),
  ('urgent_payment_fyi', 'poll', 1, 240,  'pmc',                       NULL),
  -- drawing_approval base sequence is BOTH possible heads. The rules
  -- engine (signoff_sequence_rules) trims one based on the drawing's
  -- stream — same pattern as change_notice: full sequence + rules trim.
  -- Caller passes documentRow with stream='design'|'services' and the
  -- predicates use it.
  ('drawing_approval',   'poll', 1, 1440, 'design_lead,services_head', NULL);

-- Rules: drawing_approval — strip the head whose stream this drawing
-- isn't part of. Two rules, mutually exclusive predicates.
INSERT INTO signoff_sequence_rules
  (workflow_type, priority, predicate_name, action_name, role_token, notes)
VALUES
  ('drawing_approval', 20, 'is_services_stream', 'skip_role', 'design_lead',
    'services drawing — design lead does not approve'),
  ('drawing_approval', 20, 'is_design_stream',   'skip_role', 'services_head',
    'design drawing — services head does not approve');

SELECT 1 AS v5_34_additional_signoff_workflows;


-- ── v5.35-vendors-matrix-user.sql ─────────────────────────────────────────
-- migrations/v5.35-vendors-matrix-user.sql
-- ============================================================
-- Add Matrix addressing to vendors per v2 brief A4 + Principal's decision
-- (May 2026): if vendor has Element X, dispatch via Matrix; else via
-- WhatsApp using phone. The DB is the source of truth — no derivation,
-- no cache, no provisioning step.
--
-- Two columns mirror the users-row pattern (v5.23):
--   matrix_user_id  — vendor's Element X identity (e.g. @abccon:nuassociates.in)
--   matrix_room_id  — the DM room between the bot and the vendor
--
-- Lifecycle:
--   - Vendor created → matrix_user_id NULL, matrix_room_id NULL.
--     Notifications go via phone (WhatsApp).
--   - Vendor onboards to Element X → admin/onboarding flow creates a
--     DM room and writes BOTH columns. From then on, Matrix.
--
-- The gate's _dispatchPoll checks matrix_room_id first (Matrix), and
-- if absent falls back to phone (WhatsApp). matrix_user_id is stored
-- for audit/identity but not strictly required for dispatch — the room
-- id is the dispatch address. Keeping both lets us distinguish "vendor
-- on Matrix but DM room not yet created" from "vendor not on Matrix".
-- ============================================================

-- Columns matrix_user_id and matrix_room_id are added on vendors by v5.24
-- (see "Vendor columns: Matrix tier + bank-validation tracking"). v5.35
-- previously re-declared them with COMMENTs, which fails with a duplicate
-- column error on a fresh install. The ALTER is dropped here; column docs
-- live in v5.24 and in this header.

SELECT 1 AS v5_35_vendors_matrix_user;


-- ── v5.36-vendor-bank-peer-approve.sql ─────────────────────────────────────────
-- migrations/v5.36-vendor-bank-peer-approve.sql
-- ============================================================
-- Sign-off workflow for V8 vendor-bank-change peer approval.
--
-- V8 (Principal's May 2026 decision) requires a SECOND finance-admin /
-- principal to approve any bank-detail change before it commits. Today
-- modules/onboarding/lib/vendor-bank-change.js writes the approval row
-- and a vendor_alerts entry, but NO ONE GETS NOTIFIED — the peer
-- approver has to find the pending approval by manually browsing the
-- PWA. This migration + its caller-side wiring fix that.
--
-- Workflow:
--   sequence: 'finance,principal'
--     base sequence = any active finance_admin then any principal
--   strip_initiator rule:
--     proposer must not approve their own proposal (separation of duties).
--     The strip_initiator action removes the proposer's role from the
--     sequence, so if proposer is finance_admin the relay goes to
--     principal directly; if proposer is principal it goes to finance.
--   closing_minutes: NULL (quorum-based; closes when one approver acts)
--   quorum_required: 1 (a single peer approval is enough — V8 is a
--     "second pair of eyes", not a multi-person ceremony)
-- ============================================================

INSERT INTO signoff_workflows
  (workflow_type, signoff_type, quorum_required, closing_minutes, sequence, principal_threshold_pct)
VALUES
  ('vendor_bank_peer_approve', 'poll', 1, NULL, 'finance,principal', NULL);

INSERT INTO signoff_sequence_rules
  (workflow_type, priority, predicate_name, action_name, role_token, notes)
VALUES
  ('vendor_bank_peer_approve', 10, 'always', 'strip_initiator', NULL,
    'V8 separation of duties — proposer cannot approve their own bank-change proposal');

SELECT 1 AS v5_36_vendor_bank_peer_approve;


-- ── v5.37-signoff-workflow-destinations.sql ─────────────────────────────────────────
-- migrations/v5.37-signoff-workflow-destinations.sql
-- ============================================================
-- Formalise the personal-vs-community message distinction on
-- signoff_workflows.
--
-- The brief uses both kinds (personal in P9.1 vendor bank flow, A4
-- vendor onboarding; project rooms in P6.2 relay code) but never
-- codifies the split as a column. We do that here.
--
-- The principle (Principal's call, May 2026):
--   - Bank notifications and individual BOQ sign-offs are PERSONAL
--     (1-1 to entity's matrix_room_id). Only that one entity sees it.
--   - Everything else is COMMUNITY (project room or org room).
--
-- Pick the smallest audience that needs to see the message.
--
-- Two new columns:
--
--   destination_kind ENUM('personal','project','org') NOT NULL
--     personal — DM the resolved entity in their own matrix_room_id
--     project — post in #PV{code}-internal or #PV{code}-finance
--     org     — post in a fixed org-wide room (#internal-principal, etc)
--
--   destination_qualifier VARCHAR(50) NULL
--     personal: the role token of the entity whose room to use
--               ('recipient', 'vendor_rep', 'client_rep', etc).
--               When NULL, defaults to the current approver's room.
--     project:  'internal' | 'finance'
--     org:      'internal_principal' | 'internal_finance' | 'system_health'
--
-- The dispatcher (services/signoff-gate.js _dispatchPoll) reads these
-- and routes accordingly. project + community sends @mention the
-- current approver inline since multiple people can see the room.
-- ============================================================

ALTER TABLE signoff_workflows
  ADD COLUMN destination_kind     VARCHAR(10)  NOT NULL DEFAULT 'project'
    COMMENT 'personal | project | org — where the bot posts',
  ADD COLUMN destination_qualifier VARCHAR(50) NULL
    COMMENT 'personal:role-token | project:internal/finance | org:room-name';

-- ── Backfill existing rows per Principal's classification (May 2026) ────

-- Personal: bank-related + BOQ + personal digests + client 1-1 acks
UPDATE signoff_workflows SET destination_kind = 'personal',
       destination_qualifier = 'recipient'
 WHERE workflow_type IN ('mom_client_ack');

-- vendor_bank_peer_approve goes to #internal-finance (org-wide; vendor
-- master is not project-scoped). Org room.
UPDATE signoff_workflows SET destination_kind = 'org',
       destination_qualifier = 'internal_finance'
 WHERE workflow_type IN ('vendor_bank_peer_approve');

-- payment_batch and final_settlement go to project's finance room
UPDATE signoff_workflows SET destination_kind = 'project',
       destination_qualifier = 'finance'
 WHERE workflow_type IN ('payment_batch', 'final_settlement');

-- Everything else community in project's internal room
UPDATE signoff_workflows SET destination_kind = 'project',
       destination_qualifier = 'internal'
 WHERE workflow_type IN (
   'daily_report', 'grn_approval', 'snag_rectified', 'issue_confirm',
   'urgent_payment_fyi', 'drawing_approval', 'weekly_report',
   'change_notice', 'project_closure', 'dlp_signoff', 'handover_checklist',
   'acknowledgement'
 );

SELECT 1 AS v5_37_signoff_workflow_destinations;


-- ── v5.38-vendor-bank-vendor-confirm.sql ─────────────────────────────────────────
-- migrations/v5.38-vendor-bank-vendor-confirm.sql
-- ============================================================
-- Two changes in one migration:
--
-- A. Vendor bank confirmation workflow.
--
--    Step 1 of the vendor bank flow (as decided by Principal, May 2026):
--    After finance proposes a bank-detail change, bot sends a poll to
--    the VENDOR's personal Matrix room asking them to confirm.
--    If vendor confirms → peer approval (vendor_bank_peer_approve) fires.
--    If vendor rejects → proposal cancelled, finance alerted.
--    Step 3 (24hr Principal window) is DROPPED.
--
--    destination_kind = 'personal', qualifier = NULL (approver IS the
--    vendor — their matrix_room_id is the dispatch address).
--
-- B. Fix v5.37 destination backfill bugs.
--
--    v5.37 UPDATE for 'mom_client_ack' matched 0 rows (correct name is
--    'mom_acknowledgement'). Correcting here.
--    Also classifying drawing_query_ack and cn_design_ratification
--    explicitly rather than relying on the 'project' default.
-- ============================================================

-- ── A. vendor_bank_vendor_confirm workflow ───────────────────────────

INSERT INTO signoff_workflows
  (workflow_type, signoff_type, quorum_required, closing_minutes,
   sequence, principal_threshold_pct, destination_kind, destination_qualifier)
VALUES
  ('vendor_bank_vendor_confirm', 'poll', 1, 4320,
   -- 4320 min = 72 hours. Vendor gets 3 days to confirm their own
   -- bank details. If no vote in 72h, proposal auto-expires and
   -- finance is alerted (handled by the poll-expiry worker).
   'vendor_rep', NULL,
   -- destination_kind = personal: poll goes to vendor's own
   -- matrix_room_id (1-1 DM with the bot). Only this vendor sees it.
   -- No @mention needed — they're the only recipient.
   'personal', NULL);

-- ── B. Fix v5.37 destination backfill bugs ───────────────────────────

-- ── B1. mom_acknowledgement — fix sequence and destination ──────────────
-- v5.31 seeded sequence='recipient' which resolves to a users row via
-- raised_by. For MOM acknowledgement the recipient is the CLIENT, not
-- an internal user. The client_rep resolver reads from clients via
-- projects.client_id. Fix: sequence='client_rep', destination=personal.
UPDATE signoff_workflows
   SET sequence             = 'client_rep',
       destination_kind     = 'personal',
       destination_qualifier = NULL
 WHERE workflow_type = 'mom_acknowledgement';

-- B2. drawing_query_ack — single approver ack, goes to PMC's personal room.
UPDATE signoff_workflows
   SET destination_kind = 'personal', destination_qualifier = NULL
 WHERE workflow_type = 'drawing_query_ack';

-- B3. cn_design_ratification — design lead's personal room (single approver).
UPDATE signoff_workflows
   SET destination_kind = 'personal', destination_qualifier = NULL
 WHERE workflow_type = 'cn_design_ratification';

-- Note: 'acknowledgement' row referenced in v5.37 doesn't exist in any seed.
-- No action needed — the dead UPDATE in v5.37 matched 0 rows and is harmless.

-- ── D. vendor_contacts table ─────────────────────────────────────────
-- Addendum A.2 (line 107-146): three fixed roles per vendor.
-- Routing: bank polls → accounts, site coordination → site, disputes → owner.
-- Fallback: is_primary=TRUE contact, then vendors.phone.

CREATE TABLE IF NOT EXISTS vendor_contacts (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id      INT UNSIGNED NOT NULL,
  role           ENUM('owner','site','accounts') NOT NULL,
  name           VARCHAR(200) NOT NULL,
  phone          VARCHAR(20)  NULL,
  whatsapp       VARCHAR(20)  NULL,
  email          VARCHAR(255) NULL,
  matrix_user_id VARCHAR(255) NULL,
  matrix_room_id VARCHAR(255) NULL,
  is_primary     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vendor_role (vendor_id, role),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── C. vendors.matrix_status ────────────────────────────────────────
-- Addendum A.3/A.4 (line 209): tier is computed from this field.
-- Tier A = 'joined' (Matrix). Tier B = everything else (WhatsApp).
-- Flips automatically when vendor onboards to Element X.
--
-- Column is added by v5.24 (Iteration 1 vendor onboarding). The ALTER
-- previously here re-declared it just to attach a COMMENT, which fails
-- with a duplicate column error on a fresh install. Doc lives in this
-- header instead.

-- ── E. security_config — vendor_bank_alert_days ─────────────────────
-- Window (in days) within which a payment to a recently-changed vendor
-- bank account triggers a Principal FYI alert (V8 step 4). Configurable
-- so ops can tighten or widen without a code deploy.
INSERT INTO security_config (config_key, config_value, description)
VALUES ('vendor_bank_alert_days', '90',
        'Days after a vendor bank change within which the first payment triggers a Principal FYI alert.')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

SELECT 1 AS v5_38_vendor_bank_vendor_confirm;


-- ── v5.39-phase4-cleanup.sql ─────────────────────────────────────────
-- migrations/v5.39-phase4-cleanup.sql
-- ============================================================
-- Phase 4 cleanup: drop legacy tables no longer written to.
--
-- matrix_pending_polls (v5.27): superseded by signoff_instances (v5.32)
-- for all sign-off purposes. No caller in modules/ or scripts/ calls
-- registerPendingPoll() any longer — all call triggerSignoff() instead.
-- The POLL_OWNERS registry in matrix-reply-actions.js still reads this
-- table for legacy in-flight rows. Drop the table and remove the reader
-- entry together.
--
-- wa_pending_actions: WhatsApp reply-correlation table. All callers
-- migrated to Matrix. Table is empty in production.
--
-- wa_send_failures: Twilio-specific failure log. Matrix has its own
-- matrix_outbox with retry semantics.
--
-- matrix_reader_cursor: per-room read cursor used alongside
-- matrix_pending_polls. Once the pending_polls table is dropped the
-- cursor table serves no purpose.
--
-- Pre-condition: verify no rows in matrix_pending_polls with
-- status='pending' before running (an in-flight poll would be orphaned).
--
--   SELECT COUNT(*) FROM matrix_pending_polls WHERE status='pending';
--
-- If count > 0, wait for those polls to expire/complete before running.
-- ============================================================

-- Safety guard: fail fast if any polls are still pending.
-- Remove this guard only after verifying count = 0 in production.
-- (In development/test the table is empty so this is a no-op.)
SET @pending_count = (SELECT COUNT(*) FROM matrix_pending_polls WHERE status = 'pending');
-- Not using SIGNAL here (MySQL version compat) — operator checks output.
SELECT IF(@pending_count > 0,
  CONCAT('WARNING: ', @pending_count, ' pending polls still in matrix_pending_polls — check before proceeding'),
  'OK: matrix_pending_polls is clear'
) AS pre_check;

DROP TABLE IF EXISTS matrix_pending_polls;
DROP TABLE IF EXISTS matrix_reader_cursor;

-- WhatsApp legacy tables (callers migrated to Matrix in Phase 3)
-- wa_pending_actions retained: services/approvals.js, services/wa-reply-actions.js,
-- and scripts/overdue-checker.js still read and write this table. Drop deferred
-- until those callers are removed or migrated to Matrix.
-- DROP TABLE IF EXISTS wa_pending_actions;
DROP TABLE IF EXISTS wa_send_failures;

SELECT 1 AS v5_39_phase4_cleanup;


-- ── v5.40-login-count.sql ─────────────────────────────────────────
-- migrations/v5.40-login-count.sql
-- ============================================================
-- Add login_count to users table.
--
-- Required by auth.js Change P2: force-password-change triggers
-- after FORCE_CHANGE_AFTER logins (currently 25 for testing),
-- not on the very first login.
--
-- DEPLOYMENT ORDER: this migration MUST run before auth.js is
-- deployed. If auth.js deploys first, logins fail immediately
-- because login_count column does not exist.
-- ============================================================

-- NOTE: login_count is now in the base CREATE TABLE users above.
-- ALTER skipped to avoid duplicate column error.

SELECT 1 AS v5_40_login_count;


-- ── v5.41-external-comm-assignments.sql ─────────────────────────────────────────
-- migrations/v5.41-external-comm-assignments.sql
-- ============================================================
-- External communication assignment system.
--
-- When a vendor (or external party) is not on Matrix, the system
-- cannot send automated messages. Instead it creates an assignment
-- row for the responsible internal person to send manually via
-- a wa.me deep link.
--
-- The friction is intentional: every manual send creates pressure
-- to onboard the vendor to Matrix.
--
-- Two tables:
--   external_comm_config  — one row per activity type, maps to a role
--   external_comm_assignments — one row per pending manual send
--
-- No re-assignment. The assigned person owns it until they mark it sent.
-- ============================================================

-- ── Config: activity type → responsible role ─────────────────────────

CREATE TABLE IF NOT EXISTS external_comm_config (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  activity_type    VARCHAR(80)  NOT NULL UNIQUE,
  -- workflow_type from signoff_workflows that maps to this activity.
  -- Gate uses this to look up the activity_type without a hardcoded map.
  workflow_type    VARCHAR(100) NULL,
  responsible_role VARCHAR(80)  NOT NULL,
  due_hours        SMALLINT     NOT NULL DEFAULT 4,
  label            VARCHAR(200) NOT NULL,
  active           TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO external_comm_config
  (activity_type,              workflow_type,                responsible_role, due_hours, label)
VALUES
  ('vendor_bank_confirm',      'vendor_bank_vendor_confirm', 'finance_admin',  4,  'Send bank confirmation request to vendor'),
  ('vendor_bank_new',          'vendor_bank_vendor_confirm', 'finance_admin',  4,  'Send new bank details confirmation to vendor'),
  ('payment_utr_confirm',      NULL,                         'finance_admin',  2,  'Send payment UTR confirmation to vendor'),
  ('vendor_defect_raised',     NULL,                         'pmc_head',       8,  'Notify vendor: defect raised'),
  ('grn_pending',              NULL,                         'pmc_head',       8,  'Notify vendor: GRN pending approval');

-- ── Assignments: one row per pending manual send ──────────────────────

CREATE TABLE IF NOT EXISTS external_comm_assignments (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  activity_type    VARCHAR(80)  NOT NULL,
  vendor_id        INT UNSIGNED NULL,
  -- Generic document reference — can point to any table.
  document_id      INT UNSIGNED NULL,
  document_table   VARCHAR(80)  NULL,
  -- The pre-generated wa.me link. One tap opens WhatsApp pre-filled.
  wa_me_link       TEXT         NOT NULL,
  -- Message body stored for audit even if wa.me is tapped and not returned to.
  message_body     TEXT         NOT NULL,
  -- Who is responsible. Set at creation. Never re-assigned.
  assigned_to      INT UNSIGNED NOT NULL,
  project_id       INT UNSIGNED NULL,
  -- Status
  status           ENUM('pending','sent','expired','cancelled')
                   NOT NULL DEFAULT 'pending',
  -- Timestamps
  assigned_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at           DATETIME     NOT NULL,
  sent_at          DATETIME     NULL,
  marked_sent_by   INT UNSIGNED NULL,
  cancelled_at     DATETIME     NULL,
  cancelled_reason VARCHAR(255) NULL,
  -- Audit: which Matrix dispatch path triggered this
  triggered_by_signoff_instance INT UNSIGNED NULL,

  INDEX idx_assigned_pending (assigned_to, status, due_at),
  INDEX idx_vendor_activity  (vendor_id, activity_type, status),
  FOREIGN KEY (assigned_to)   REFERENCES users(id)    ON DELETE RESTRICT,
  FOREIGN KEY (vendor_id)     REFERENCES vendors(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 1 AS v5_41_external_comm_assignments;


-- ── v5.43-document-attachments.sql ───────────────────────────────────
-- Delta brief §11.5 (1 May 2026) — incoming files via Matrix.
--
-- When team members or vendors send photos, PDFs, or documents via
-- Element X, the bot's reader job downloads each file from the EMS
-- media server and stores a local copy. Each file maps to a row here.
--
-- Tagging:
--   - project_id   — derived from project_matrix_rooms by the room id
--   - document_id  — non-NULL when the file was sent inside a thread
--                    that correlates to a signoff_instance.poll_event_id;
--                    NULL for ad-hoc files in the main room
--   - workflow_type— same shape as document_id (NULL when not threaded)
--   - matrix_event_id — UNIQUE, used for de-dup. The reader may scan
--     the same window twice; the unique key makes the second processing
--     attempt a no-op.

CREATE TABLE IF NOT EXISTS document_attachments (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id       INT UNSIGNED NOT NULL,
  document_id      INT UNSIGNED NULL,
    -- NULL until manually linked or thread-derived
  workflow_type    VARCHAR(64) NULL,
    -- e.g. 'snag_rectified', 'change_notice'; NULL when not threaded
  filename         VARCHAR(255) NOT NULL,
  mimetype         VARCHAR(100) NULL,
  size_bytes       BIGINT UNSIGNED NULL,
  stored_path      VARCHAR(500) NOT NULL,
    -- relative to UPLOAD_DIR or absolute S3 key
  uploaded_by_mxid VARCHAR(255) NULL,
    -- Matrix sender id (e.g. @anjaneya:nuassociates.in). Resolve to
    -- users.id via users.matrix_user_id when needed for audit.
  uploaded_by_uid  INT UNSIGNED NULL,
    -- Resolved user id at intake time, NULL if sender isn't a known user
  uploaded_at      DATETIME NOT NULL,
  matrix_event_id  VARCHAR(255) NOT NULL,
  mxc_url          VARCHAR(500) NULL,
  source           ENUM('matrix','pwa') NOT NULL DEFAULT 'matrix',
  reviewed         TINYINT(1) NOT NULL DEFAULT 0,
  reviewed_by      INT UNSIGNED NULL,
  reviewed_at      DATETIME NULL,
  rejected         TINYINT(1) NOT NULL DEFAULT 0,
    -- TRUE when intake refused the file (e.g. video > 25MB cap).
    -- Row is still recorded so the reader can dedupe on re-scan.
  rejection_reason VARCHAR(200) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_matrix_event (matrix_event_id),
  INDEX idx_project_doc (project_id, document_id),
  INDEX idx_workflow    (workflow_type, document_id),
  FOREIGN KEY (project_id)  REFERENCES projects(id),
  FOREIGN KEY (uploaded_by_uid) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by)     REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 1 AS v5_43_document_attachments;

SET FOREIGN_KEY_CHECKS = 1;

-- ── v5.42-account-setup-nav.sql ──────────────────────────────────────────────
-- Add Account Setup nav entry for principal and design_principal.
-- Goes in the More bucket, after Governance.

INSERT IGNORE INTO role_nav (role, bucket, tab_key, sort_order, is_visible)
VALUES
  ('principal',        'more', 'account_setup', 16, 1),
  ('design_principal', 'more', 'account_setup', 16, 1);

SELECT 1 AS v5_42_account_setup_nav;

-- ── v5.44-ncr-endorsement-workflow.sql ───────────────────────────────────────
-- NCR endorsement poll — Principal endorses every NCR before rectification.
-- Triggered from POST /api/issues/ncr/:project_id on creation.

INSERT IGNORE INTO signoff_workflows
  (workflow_type, signoff_type, quorum_required, closing_minutes, sequence, principal_threshold_pct)
VALUES
  ('ncr_endorsement',               'poll', 1, 2880, 'principal',      NULL),
  ('payment_request_finance_review','poll', 1, 480,  'finance_admin',  NULL),
  ('petty_cash_replenishment',      'poll', 1, 480,  'finance_admin',  NULL),
  ('submittal_pmc_review',          'poll', 1, 1440, 'pmc',            NULL),
  ('submittal_design_review',       'poll', 1, 1440, 'design_head',    NULL),
  ('submittal_services_review',     'poll', 1, 1440, 'services_head',  NULL),
  ('drawing_approval_design',       'poll', 1, 1440, 'design_head',    NULL),
  ('drawing_approval_services',     'poll', 1, 1440, 'services_head',  NULL),
  ('measurement_approval',          'poll', 1, 1440, 'services_head',  NULL);

-- Zero float de-dup column on schedule_tasks
ALTER TABLE schedule_tasks
  ADD COLUMN notified_zero_float_at DATETIME NULL DEFAULT NULL
    COMMENT 'Set when zero-float alert fires. Cleared on task completion. Prevents repeat alerts same day.',
  ADD COLUMN float_days INT NULL
    COMMENT 'Schedule slack in days. NULL = unscored. <=0 triggers zero-float alert. Populated by schedule re-score job.';

-- Budget threshold alerts de-dup table (C3)
CREATE TABLE IF NOT EXISTS budget_threshold_alerts (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id   INT UNSIGNED NOT NULL,
  category_name VARCHAR(120) NOT NULL,
  alert_pct    TINYINT UNSIGNED NOT NULL,
  alerted_at   DATETIME NOT NULL,
  INDEX idx_bta_project (project_id, category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- PO fields on vendor_engagements (F7)
ALTER TABLE vendor_engagements
  ADD COLUMN po_required        BOOLEAN DEFAULT FALSE,
  ADD COLUMN po_approved_by     INT UNSIGNED NULL,
  ADD COLUMN po_approved_at     DATETIME NULL,
  ADD COLUMN po_generated_at    DATETIME NULL,
  ADD COLUMN po_matrix_event_id VARCHAR(255) NULL;

SELECT 1 AS v5_44_ncr_endorsement_workflow;

-- ── v6.02 — nav-audit decisions (4 May 2026) ───────────────────────────
-- (1) GRN reclassified as FYI:
--     grn_approval workflow deactivated. Replaced by grn_vendor_confirm —
--     poll goes to vendor (not PMC), routes through the gate so a 'rejected'
--     vote (vendor disputed) fires the POST_COMPLETION_HOOK alerting PMC.
--     Payment has no link to GRN — payment is on work done.
UPDATE signoff_workflows SET active = 0 WHERE workflow_type = 'grn_approval';

INSERT IGNORE INTO signoff_workflows
  (workflow_type, signoff_type, quorum_required, closing_minutes, sequence,
   destination_kind, destination_qualifier)
VALUES
  ('grn_vendor_confirm', 'poll', 1, 1440, 'vendor_rep', 'personal', NULL);

-- (2) Vendor BOQ acceptance — post-hook on change_notice and NCR-descope.
--     Triggered programmatically from POST_COMPLETION_HOOKS. One workflow,
--     two upstream callers (CN approved + NCR-descope approved).
INSERT IGNORE INTO signoff_workflows
  (workflow_type, signoff_type, quorum_required, closing_minutes, sequence,
   destination_kind, destination_qualifier)
VALUES
  ('vendor_boq_acceptance', 'poll', 1, 2880, 'vendor_rep', 'personal', NULL);

ALTER TABLE vendor_engagements
  ADD COLUMN boq_last_acknowledged_at DATETIME NULL DEFAULT NULL
  COMMENT 'Set when vendor accepts revised BOQ via vendor_boq_acceptance poll. v6.02.';

-- v6.02: track which vendor engagement was affected by a CN or NCR.
-- Populated at CN/NCR creation by PMC. The change_notice and issue
-- POST_COMPLETION_HOOKS read this to trigger vendor_boq_acceptance.
ALTER TABLE change_notices
  ADD COLUMN affected_engagement_id INT UNSIGNED NULL
  COMMENT 'v6.02: vendor whose BOQ qty changed by this CN. Triggers vendor_boq_acceptance on CN approval.';

ALTER TABLE issues
  ADD COLUMN descope_engagement_id INT UNSIGNED NULL
  COMMENT 'v6.02: for NCR-descope (issue_type=quality, descope flag), vendor whose scope was removed.';

-- (3) Add New Vendor — vendor onboarding goes Finance → Principal.
--     PMC/heads initiate via POST /api/vendors. signoff fires on creation.
INSERT IGNORE INTO signoff_workflows
  (workflow_type, signoff_type, quorum_required, closing_minutes, sequence,
   destination_kind, destination_qualifier)
VALUES
  ('vendor_onboarding', 'poll', 2, 2880, 'finance,principal', 'personal', NULL);

SELECT 1 AS v6_02_audit_decisions;

-- ── v6.03 — approvals + approval_signoffs tables ─────────────────────────────
-- These tables were defined in schema.sql but never included in the install
-- script. The approvals-expire-overdue scheduler and vendor-onboarding-token-
-- expiry scheduler both fail at startup because the tables don't exist.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approvals (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  approval_type   VARCHAR(60) NOT NULL,
  ref_table       VARCHAR(50) NOT NULL,
  ref_id          INT UNSIGNED NOT NULL,
  project_id      INT UNSIGNED NULL,
  raised_by       INT UNSIGNED NOT NULL,
  raised_by_role  VARCHAR(40)  NOT NULL,
  raised_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title           VARCHAR(300) NOT NULL,
  details         TEXT NULL,
  status          ENUM('pending','approved','rejected','expired','cancelled')
                    NOT NULL DEFAULT 'pending',
  resolved_at     DATETIME NULL,
  resolved_by     INT UNSIGNED NULL,
  resolution_note TEXT NULL,
  expires_at      DATETIME NULL,
  vendor_id       INT UNSIGNED NULL,
  vendor_confirmed_at DATETIME NULL,
  row_version     INT UNSIGNED NOT NULL DEFAULT 1,
  FOREIGN KEY (raised_by)   REFERENCES users(id)    ON DELETE RESTRICT,
  FOREIGN KEY (resolved_by) REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id)   REFERENCES vendors(id)  ON DELETE SET NULL,
  INDEX idx_approvals_ref    (ref_table, ref_id, status),
  INDEX idx_approvals_status (status, raised_at),
  INDEX idx_approvals_project (project_id, status),
  INDEX idx_approvals_vendor  (vendor_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_signoffs (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  approval_id     INT UNSIGNED NOT NULL,
  signer_id       INT UNSIGNED NOT NULL,
  signer_role     VARCHAR(40)  NOT NULL,
  vote            ENUM('approve','reject') NOT NULL,
  comment         TEXT NULL,
  voted_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE CASCADE,
  FOREIGN KEY (signer_id)   REFERENCES users(id)     ON DELETE RESTRICT,
  UNIQUE KEY uq_approval_signer (approval_id, signer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 1 AS v6_03_approvals_tables;

-- ── Install complete: nu PMC v6.03 ─────────────────────────
