/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.14-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: nu_pmc
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
-- Current Database: `nu_pmc`
--

/*!40000 DROP DATABASE IF EXISTS `nu_pmc`*/;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `nu_pmc` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;

USE `nu_pmc`;

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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `boq_items`
--

LOCK TABLES `boq_items` WRITE;
/*!40000 ALTER TABLE `boq_items` DISABLE KEYS */;
INSERT INTO `boq_items` VALUES
(1,1,1,NULL,'Civil','CIV-001','Excavation in ordinary soil',1,0,'CUM',180.000,1,0,NULL,NULL,0),
(2,1,1,NULL,'Civil','CIV-002','M25 concrete (foundation)',2,0,'CUM',90.000,1,0,NULL,NULL,0),
(3,1,1,NULL,'Civil','CIV-003','M30 concrete (columns+slab)',3,0,'CUM',140.000,1,0,NULL,NULL,0),
(4,1,1,NULL,'Civil','CIV-004','Reinforcement steel Fe550',4,0,'MT',18.000,1,0,NULL,NULL,0),
(5,2,1,NULL,'Electrical','ELC-001','3C x 4 sqmm XLPE cable',1,0,'MTR',600.000,1,0,NULL,NULL,0),
(6,2,1,NULL,'Electrical','ELC-002','63A MCCB 4-pole',2,0,'NOS',12.000,1,0,NULL,NULL,0),
(7,2,1,NULL,'Electrical','ELC-003','DB 12-way TPN',3,0,'NOS',4.000,1,0,NULL,NULL,0),
(8,2,1,NULL,'HVAC','HVAC-001','7.5TR VRV outdoor unit',4,0,'NOS',2.000,1,0,NULL,NULL,0),
(9,2,1,NULL,'HVAC','HVAC-002','Ceiling cassette 2TR',5,0,'NOS',8.000,1,0,NULL,NULL,0);
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
  KEY `project_id` (`project_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `boq_versions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `boq_versions_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `boq_versions`
--

LOCK TABLES `boq_versions` WRITE;
/*!40000 ALTER TABLE `boq_versions` DISABLE KEYS */;
INSERT INTO `boq_versions` VALUES
(1,1,'design',1,'v1',NULL,1,1,NULL,'2026-04-22 17:25:19'),
(2,1,'services',1,'v1',NULL,1,1,NULL,'2026-04-22 17:25:19');
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
  KEY `project_id` (`project_id`),
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
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
INSERT INTO `company_entities` VALUES
(1,'PROP','NU ASSOCIATES','No.940, Shantha Complex, 1st Floor, 20th Main Road, Banashankari Stage 2, Bengaluru 560070',NULL,'Bengaluru','Karnataka','560070','29AHSPB4003H1ZH','29','naveen@nuassociates.com','finance@nuassociates.com','9886050673','998311','ICICI Bank','233705001068','ICIC0002337','NU ASSOCIATES','Banashankari, Bengaluru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:16'),
(2,'LLP','NU ASSOCIATES LLP','1st Floor, No.940, Shantha Complex, 20th Main Road, Banashankari Stage 2, Bengaluru 560070',NULL,'Bengaluru','Karnataka','560070','29AAVFN2055K1ZM','29','naveen@nuassociates.com','finance@nuassociates.com','9886050673','998311','ICICI Bank','233705000984','ICIC0002337','NU ASSOCIATES LLP','Banashankari, Bengaluru','nuassociatesllp.ibz@icici',NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:16');
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
  `status` enum('pending_review','approved','flagged') NOT NULL DEFAULT 'pending_review',
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `flag_reason` text DEFAULT NULL,
  `flagged_by` int(10) unsigned DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_reports`
--

LOCK TABLES `daily_reports` WRITE;
/*!40000 ALTER TABLE `daily_reports` DISABLE KEYS */;
INSERT INTO `daily_reports` VALUES
(1,1,'2026-04-21',1,'app',NULL,'Foundation work progressing on schedule. Cement delivery slightly delayed (~2hrs). 12 skilled + 18 unskilled on site.','2026-04-22 17:25:19',NULL,NULL,0,NULL,'approved',1,'2026-04-22 17:25:19',NULL,NULL,NULL),
(2,1,'2026-04-22',1,'app',NULL,'Column formwork for Grid A complete. Electrical team mobilised for conduit install. 14 skilled + 20 unskilled on site.','2026-04-22 17:25:19',NULL,NULL,0,NULL,'pending_review',NULL,NULL,NULL,NULL,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drawing_register`
--

LOCK TABLES `drawing_register` WRITE;
/*!40000 ALTER TABLE `drawing_register` DISABLE KEYS */;
INSERT INTO `drawing_register` VALUES
(1,1,'A-101','Ground Floor Plan','Architectural','design',NULL,NULL,'in_progress',1,'2026-04-22 17:25:19',NULL,NULL),
(2,1,'A-102','Production Area Layout','Architectural','design',NULL,NULL,'in_progress',1,'2026-04-22 17:25:19',NULL,NULL),
(3,1,'S-201','Foundation Details','Structural','design',NULL,NULL,'pending',1,'2026-04-22 17:25:19',NULL,NULL),
(4,1,'E-301','Power Distribution','Electrical','services',NULL,NULL,'in_progress',1,'2026-04-22 17:25:19',NULL,NULL),
(5,1,'M-401','HVAC Ductwork Layout','HVAC','services',NULL,NULL,'pending',1,'2026-04-22 17:25:19',NULL,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drawing_versions`
--

LOCK TABLES `drawing_versions` WRITE;
/*!40000 ALTER TABLE `drawing_versions` DISABLE KEYS */;
INSERT INTO `drawing_versions` VALUES
(1,1,'R0',0,'/uploads/pv90/A-101_R0.pdf',820,NULL,NULL,1,'pending_l1',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,NULL,1,'2026-04-22 17:25:19'),
(2,2,'R0',0,'/uploads/pv90/A-102_R0.pdf',940,NULL,NULL,1,'pending_l2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,NULL,1,'2026-04-22 17:25:19'),
(3,3,'R0',0,'/uploads/pv90/E-301_R0.pdf',680,NULL,NULL,1,'issued',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,NULL,1,'2026-04-22 17:25:19');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drawings`
--

LOCK TABLES `drawings` WRITE;
/*!40000 ALTER TABLE `drawings` DISABLE KEYS */;
INSERT INTO `drawings` VALUES
(1,1,'A-101','Ground Floor Plan','Architectural','design','main',NULL,NULL,NULL,'2026-04-22 17:25:19'),
(2,1,'A-102','Production Area Layout','Architectural','design','main',NULL,NULL,NULL,'2026-04-22 17:25:19'),
(3,1,'E-301','Power Distribution','Electrical','services','main',NULL,NULL,NULL,'2026-04-22 17:25:19');
/*!40000 ALTER TABLE `drawings` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grns`
--

LOCK TABLES `grns` WRITE;
/*!40000 ALTER TABLE `grns` DISABLE KEYS */;
INSERT INTO `grns` VALUES
(1,1,'GRN-001',1,NULL,'2026-04-18','OPC 53 Grade Cement',200.000,'BAGS',NULL,NULL,NULL,NULL,0,1,'2026-04-22 17:25:19',NULL,NULL,'pending',NULL),
(2,1,'GRN-002',2,NULL,'2026-04-20','3C x 4 sqmm XLPE cable',300.000,'MTR',NULL,NULL,NULL,NULL,0,1,'2026-04-22 17:25:19',NULL,NULL,'pending',NULL),
(3,1,'GRN-003',1,NULL,'2026-04-15','Reinforcement steel 16mm',2.500,'MT',NULL,NULL,NULL,NULL,0,1,'2026-04-22 17:25:19',NULL,NULL,'pending',NULL);
/*!40000 ALTER TABLE `grns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `issue_photos`
--

DROP TABLE IF EXISTS `issue_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `issue_photos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `issue_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `submitted_by` int(10) unsigned NOT NULL,
  `file_path` varchar(300) NOT NULL,
  `source` enum('whatsapp','app') NOT NULL DEFAULT 'app',
  `caption` varchar(200) DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT current_timestamp(),
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
-- Dumping data for table `issue_photos`
--

LOCK TABLES `issue_photos` WRITE;
/*!40000 ALTER TABLE `issue_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `issue_photos` ENABLE KEYS */;
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
  `issue_type` enum('safety','quality','design','rfi','compliance') NOT NULL,
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
  `due_date` date DEFAULT NULL,
  `status` enum('draft','open','in_progress','resolved','closed') NOT NULL DEFAULT 'draft',
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `issues`
--

LOCK TABLES `issues` WRITE;
/*!40000 ALTER TABLE `issues` DISABLE KEYS */;
INSERT INTO `issues` VALUES
(1,1,'ISS-001','rfi','Clarify foundation depth at Grid A1','Drawing shows 1200mm but site soil report suggests 1500mm. Please confirm.',1,'2026-04-22 17:25:19',NULL,NULL,NULL,NULL,1,NULL,NULL,'open',0,NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL),
(2,1,'ISS-002','design','Column C3 spec mismatch','BOQ says M30 but drawing notes M25. Confirm which is correct.',1,'2026-04-22 17:25:19',NULL,NULL,NULL,NULL,1,NULL,NULL,'open',0,NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL),
(3,1,'ISS-003','safety','Scaffolding stability â€” east facade','Wind load conditions require additional bracing. Inspect.',1,'2026-04-22 17:25:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'open',0,NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL),
(4,1,'ISS-004','quality','Concrete honeycombing at column C3','Surface finish not as per spec. Re-pour or patch?',1,'2026-04-22 17:25:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'open',0,NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL);
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
-- Table structure for table `meeting_photos`
--

DROP TABLE IF EXISTS `meeting_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `meeting_photos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `meeting_id` int(10) unsigned NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size_kb` int(10) unsigned NOT NULL DEFAULT 0,
  `caption` varchar(500) DEFAULT NULL,
  `doc_type` enum('photo','report_draft','report_final','attachment') NOT NULL DEFAULT 'photo',
  `uploaded_by` int(10) unsigned DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `meeting_id` (`meeting_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `meeting_photos_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `meeting_photos_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meeting_photos`
--

LOCK TABLES `meeting_photos` WRITE;
/*!40000 ALTER TABLE `meeting_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `meeting_photos` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meetings`
--

LOCK TABLES `meetings` WRITE;
/*!40000 ALTER TABLE `meetings` DISABLE KEYS */;
INSERT INTO `meetings` VALUES
(1,1,1,NULL,'MOM-001','client','sent_to_client','Kickoff meeting with TLD MAINI','2026-03-20',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'draft',NULL,'2026-04-22 17:25:19'),
(2,1,1,NULL,'MOM-002','site_visit','internal','Foundation progress review','2026-04-05',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'draft',NULL,'2026-04-22 17:25:19'),
(3,1,1,NULL,'MOM-003','design_review','internal','Drawing review â€” Electrical R0','2026-04-12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'draft',NULL,'2026-04-22 17:25:19');
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
INSERT INTO `notification_triggers` VALUES
(1,'Claims','claim.approved','Claim approved','principal','whatsapp',1,'claims.js:244','2026-04-22 17:25:19'),
(2,'Claims','claim.approved','Claim approved','design_principal','whatsapp',1,'claims.js:244','2026-04-22 17:25:19'),
(3,'Claims','claim.approved','Claim approved','pmc_head','whatsapp',1,'claims.js:250','2026-04-22 17:25:19'),
(4,'Drawings','drawing.approved','Drawing approved / issued','principal','whatsapp',1,'drawings.js:621','2026-04-22 17:25:19'),
(5,'Drawings','drawing.approved','Drawing approved / issued','design_principal','whatsapp',1,'drawings.js:621','2026-04-22 17:25:19'),
(6,'Drawings','drawing.flagged','Drawing flagged at L1 review','uploader','whatsapp',1,'drawings.js:542','2026-04-22 17:25:19'),
(7,'GRN','grn.ncr-raised','NCR / non-conformance flagged','principal','whatsapp',1,'grn.js:340','2026-04-22 17:25:19'),
(8,'GRN','grn.ncr-raised','NCR / non-conformance flagged','design_principal','whatsapp',1,'grn.js:340','2026-04-22 17:25:19'),
(9,'GRN','grn.ncr-raised','NCR / non-conformance flagged','pmc_head','whatsapp',1,'grn.js:340','2026-04-22 17:25:19'),
(10,'GRN','grn.ncr-raised','NCR / non-conformance flagged','design_head','whatsapp',1,'grn.js:345','2026-04-22 17:25:19'),
(11,'GRN','grn.ncr-raised','NCR / non-conformance flagged','services_head','whatsapp',1,'grn.js:345','2026-04-22 17:25:19'),
(12,'GRN','grn.ncr-raised','NCR / non-conformance flagged','vendor','whatsapp',1,'grn.js:353','2026-04-22 17:25:19'),
(13,'Issues','issue.auto-assigned','Issue auto-assigned','assignee','whatsapp',1,'issues.js:121','2026-04-22 17:25:19'),
(14,'Issues','issue.assigned','Issue assigned (manual)','assignee','whatsapp',1,'issues.js:152','2026-04-22 17:25:19'),
(15,'Issues','issue.ncr-vendor','Issue NCR sent to vendor','vendor','whatsapp',1,'issues.js:160','2026-04-22 17:25:19'),
(16,'Meetings','meeting.action-item-assigned','MOM action item assigned','assignee','whatsapp',1,'meetings.js:428','2026-04-22 17:25:19'),
(17,'Payments','payment.confirmed-utr','Payment confirmed (UTR applied)','principal','whatsapp',1,'payments.js:480','2026-04-22 17:25:19'),
(18,'Payments','payment.confirmed-utr','Payment confirmed (UTR applied)','design_principal','whatsapp',1,'payments.js:480','2026-04-22 17:25:19'),
(19,'Payments','payment.confirmed-utr','Payment confirmed (UTR applied)','vendor','whatsapp',1,'payments.js:480','2026-04-22 17:25:19'),
(20,'Payments','payment.utr-batch','UTR batch consolidated','principal','whatsapp',1,'payments.js:844','2026-04-22 17:25:19'),
(21,'Payments','payment.utr-batch','UTR batch consolidated','design_principal','whatsapp',1,'payments.js:844','2026-04-22 17:25:19'),
(22,'PaymentReq','payment-request.raised','Payment request raised','pmc_head','whatsapp',1,'payment-requests.js:214','2026-04-22 17:25:19'),
(23,'PaymentReq','payment-request.raised','Payment request raised','principal','whatsapp',1,'payment-requests.js:214','2026-04-22 17:25:19'),
(24,'PaymentReq','payment-request.pmc-approved','PR PMC approved','principal','whatsapp',1,'payment-requests.js:334','2026-04-22 17:25:19'),
(25,'PaymentReq','payment-request.pmc-approved','PR PMC approved','design_principal','whatsapp',1,'payment-requests.js:334','2026-04-22 17:25:19'),
(26,'PaymentReq','payment-request.pmc-approved','PR PMC approved','finance_admin','whatsapp',1,'payment-requests.js:352','2026-04-22 17:25:19'),
(27,'PaymentReq','payment-request.pmc-rejected','PR rejected by PMC','raiser','whatsapp',1,'payment-requests.js:303','2026-04-22 17:25:19'),
(28,'PaymentReq','payment-request.principal-approved','PR approved by Principal','finance_admin','whatsapp',1,'payment-requests.js:427','2026-04-22 17:25:19'),
(29,'PaymentReq','payment-request.principal-approved','PR approved by Principal','raiser','whatsapp',1,'payment-requests.js:427','2026-04-22 17:25:19'),
(30,'PaymentReq','payment-request.principal-rejected','PR rejected by Principal','raiser','whatsapp',1,'payment-requests.js:430','2026-04-22 17:25:19'),
(31,'PaymentReq','payment-request.principal-rejected','PR rejected by Principal','pmc_reviewer','whatsapp',1,'payment-requests.js:431','2026-04-22 17:25:19'),
(32,'PaymentReq','payment-request.vendor-confirmed','Vendor payment confirmed','vendor','whatsapp',1,'payment-requests.js:502','2026-04-22 17:25:19'),
(33,'PaymentReq','payment-request.vendor-confirmed','Vendor payment confirmed','raiser','whatsapp',1,'payment-requests.js:508','2026-04-22 17:25:19'),
(34,'PaymentReq','urgent-payment.raised','Urgent payment raised','pmc_head','whatsapp',1,'urgent-payments.js:111','2026-04-22 17:25:19'),
(35,'PaymentReq','urgent-payment.raised','Urgent payment raised','principal','whatsapp',1,'urgent-payments.js:124','2026-04-22 17:25:19'),
(36,'PaymentReq','urgent-payment.raised','Urgent payment raised','design_principal','whatsapp',1,'urgent-payments.js:124','2026-04-22 17:25:19'),
(37,'Reports','report.ready-for-review','Weekly report ready for review','principal','whatsapp',1,'reports.js:134','2026-04-22 17:25:19'),
(38,'Reports','report.ready-for-review','Weekly report ready for review','design_principal','whatsapp',1,'reports.js:134','2026-04-22 17:25:19'),
(39,'Reports','report.drag-flag','Drag flag on weekly report','principal','whatsapp',1,'reports.js:195,365','2026-04-22 17:25:19'),
(40,'Reports','report.drag-flag','Drag flag on weekly report','design_principal','whatsapp',1,'reports.js:195,365','2026-04-22 17:25:19'),
(41,'Reports','report.pmc-approved','Weekly report approved by PMC Head','principal','whatsapp',1,'reports.js:234','2026-04-22 17:25:19'),
(42,'Reports','report.pmc-approved','Weekly report approved by PMC Head','design_principal','whatsapp',1,'reports.js:234','2026-04-22 17:25:19'),
(43,'Schedule','schedule.version-uploaded','Schedule version uploaded','principal','whatsapp',1,'schedule.js:252','2026-04-22 17:25:19'),
(44,'Schedule','schedule.version-uploaded','Schedule version uploaded','design_principal','whatsapp',1,'schedule.js:252','2026-04-22 17:25:19'),
(45,'Schedule','schedule.drift-acknowledged','Schedule drift acknowledged','principal','whatsapp',1,'schedule.js:281','2026-04-22 17:25:19'),
(46,'Schedule','schedule.drift-acknowledged','Schedule drift acknowledged','design_principal','whatsapp',1,'schedule.js:281','2026-04-22 17:25:19'),
(47,'Schedule','schedule.task-outlier','Task outlier detected (AI flag)','principal','whatsapp',1,'schedule.js:366','2026-04-22 17:25:19'),
(48,'Schedule','schedule.task-outlier','Task outlier detected (AI flag)','design_principal','whatsapp',1,'schedule.js:366','2026-04-22 17:25:19'),
(49,'Users','user.pending-approval','New user pending approval','principal','whatsapp',1,'user-management.js:61','2026-04-22 17:25:19'),
(50,'Users','user.pending-approval','New user pending approval','design_principal','whatsapp',1,'user-management.js:61','2026-04-22 17:25:19'),
(51,'Users','user.activated','New user activated','new_user','whatsapp',1,'user-management.js:94','2026-04-22 17:25:19'),
(52,'Vendors','vendor.pending-clearance','Vendor pending finance clearance','finance_admin','whatsapp',1,'vendors.js:114','2026-04-22 17:25:19'),
(53,'Vendors','vendor.engagement-pending','Vendor engagement pending approval','principal','whatsapp',1,'vendors.js:423','2026-04-22 17:25:19'),
(54,'Vendors','vendor.engagement-pending','Vendor engagement pending approval','design_principal','whatsapp',1,'vendors.js:423','2026-04-22 17:25:19'),
(55,'Vendors','vendor.engagement-approved','Vendor engagement approved','raiser','whatsapp',1,'vendors.js:469','2026-04-22 17:25:19'),
(56,'Vendors','vendor.engagement-rejected','Vendor engagement rejected','raiser','whatsapp',1,'vendors.js:500','2026-04-22 17:25:19'),
(57,'Budget','budget.custom-head','Custom budget head approved/rejected','principal','whatsapp',1,'budget.js:193','2026-04-22 17:25:19'),
(58,'Budget','budget.custom-head','Custom budget head approved/rejected','design_principal','whatsapp',1,'budget.js:200','2026-04-22 17:25:19'),
(59,'Changes','change-notice.ready','CN ready for principal approval','principal','whatsapp',1,'changes.js:148','2026-04-22 17:25:19'),
(60,'Changes','change-notice.ready','CN ready for principal approval','design_principal','whatsapp',1,'changes.js:148','2026-04-22 17:25:19'),
(61,'Projects','project.client-incomplete','Client master incomplete','finance_admin','whatsapp',1,'projects.js:462','2026-04-22 17:25:19');
/*!40000 ALTER TABLE `notification_triggers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_otps`
--

DROP TABLE IF EXISTS `password_reset_otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_otps` (
  `user_id` int(10) unsigned NOT NULL,
  `otp_hash` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `password_reset_otps_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_otps`
--

LOCK TABLES `password_reset_otps` WRITE;
/*!40000 ALTER TABLE `password_reset_otps` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_otps` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_requests`
--

LOCK TABLES `payment_requests` WRITE;
/*!40000 ALTER TABLE `payment_requests` DISABLE KEYS */;
INSERT INTO `payment_requests` VALUES
(1,1,1,1,1,1,450000.00,'RA Bill #1 â€” civil works 10%','running_account_bill','pending_pmc',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(2,1,1,2,2,1,320000.00,'Mobilisation advance 10%','mobilisation_advance','pmc_approved',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(3,1,1,3,3,1,280000.00,'Equipment advance for VRV units','material_advance','principal_approved',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-04-22 17:25:19','2026-04-22 17:25:19');
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
  CONSTRAINT `photo_tags_ibfk_1` FOREIGN KEY (`photo_id`) REFERENCES `project_photos` (`id`) ON DELETE CASCADE,
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
-- Table structure for table `pre_handover_snags`
--

DROP TABLE IF EXISTS `pre_handover_snags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_handover_snags` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `trade` varchar(50) NOT NULL,
  `location` varchar(200) DEFAULT NULL,
  `description` text NOT NULL,
  `severity` enum('critical','major','minor') NOT NULL DEFAULT 'minor',
  `responsible_vendor_id` int(10) unsigned DEFAULT NULL,
  `raised_by` int(10) unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT current_timestamp(),
  `due_date` date DEFAULT NULL,
  `status` enum('open','in_progress','resolved','accepted_by_client') NOT NULL DEFAULT 'open',
  `resolved_by` int(10) unsigned DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `resolution_note` text DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
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
-- Dumping data for table `pre_handover_snags`
--

LOCK TABLES `pre_handover_snags` WRITE;
/*!40000 ALTER TABLE `pre_handover_snags` DISABLE KEYS */;
/*!40000 ALTER TABLE `pre_handover_snags` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_assignments`
--

LOCK TABLES `project_assignments` WRITE;
/*!40000 ALTER TABLE `project_assignments` DISABLE KEYS */;
INSERT INTO `project_assignments` VALUES
(1,1,2,'member',1,'2026-04-22 17:25:19',1),
(2,1,16,'member',1,'2026-04-22 17:25:19',1),
(3,1,3,'member',1,'2026-04-22 17:25:19',1),
(4,1,1,'member',1,'2026-04-22 17:25:19',1),
(5,1,5,'member',1,'2026-04-22 17:25:19',1),
(6,1,6,'member',1,'2026-04-22 17:25:19',1),
(7,1,37,'member',1,'2026-04-22 17:25:19',1),
(8,1,31,'member',1,'2026-04-22 17:25:19',1),
(9,1,24,'member',1,'2026-04-22 17:25:19',1),
(10,1,23,'member',1,'2026-04-22 17:25:19',1),
(11,1,29,'member',1,'2026-04-22 17:25:19',1),
(12,1,27,'member',1,'2026-04-22 17:25:19',1),
(13,1,35,'member',1,'2026-04-22 17:25:19',1),
(14,1,38,'member',1,'2026-04-22 17:25:19',1),
(15,1,28,'member',1,'2026-04-22 17:25:19',1),
(16,1,32,'member',1,'2026-04-22 17:25:19',1),
(17,1,22,'member',1,'2026-04-22 17:25:19',1),
(18,1,30,'member',1,'2026-04-22 17:25:19',1),
(19,1,26,'member',1,'2026-04-22 17:25:19',1),
(20,1,33,'member',1,'2026-04-22 17:25:19',1),
(21,1,34,'member',1,'2026-04-22 17:25:19',1),
(22,1,25,'member',1,'2026-04-22 17:25:19',1),
(23,1,36,'member',1,'2026-04-22 17:25:19',1);
/*!40000 ALTER TABLE `project_assignments` ENABLE KEYS */;
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
  `doc_date` date DEFAULT NULL,
  `doc_type` enum('appointment_letter','contract','po','challan','invoice','other') NOT NULL DEFAULT 'other',
  `file_path` varchar(500) NOT NULL,
  `file_name` varchar(300) DEFAULT NULL,
  `file_size_kb` int(10) unsigned NOT NULL DEFAULT 0,
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
-- Table structure for table `project_photos`
--

DROP TABLE IF EXISTS `project_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_photos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `task_id` int(10) unsigned DEFAULT NULL,
  `daily_report_id` int(10) unsigned DEFAULT NULL,
  `photo_date` date NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size_kb` int(10) unsigned NOT NULL DEFAULT 0,
  `caption` varchar(500) DEFAULT NULL,
  `uploaded_by` int(10) unsigned NOT NULL,
  `source` enum('app','whatsapp','site_visit') NOT NULL DEFAULT 'app',
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_locked` tinyint(1) NOT NULL DEFAULT 0,
  `locked_at` datetime DEFAULT NULL,
  `locked_by_report_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `daily_report_id` (`daily_report_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_photos_project_date` (`project_id`,`photo_date`),
  KEY `idx_photos_task` (`task_id`),
  CONSTRAINT `project_photos_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `project_photos_ibfk_2` FOREIGN KEY (`task_id`) REFERENCES `schedule_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_photos_ibfk_3` FOREIGN KEY (`daily_report_id`) REFERENCES `daily_reports` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_photos_ibfk_4` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_photos`
--

LOCK TABLES `project_photos` WRITE;
/*!40000 ALTER TABLE `project_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_photos` ENABLE KEYS */;
UNLOCK TABLES;

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
  CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`entity_id`) REFERENCES `company_entities` (`id`),
  CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `projects_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_proj_dates` CHECK (`r0_end_date` >= `r0_start_date`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES
(1,2,'primary','PV90','PV 90 Production Line','TLD MAINI GSE Pvt Ltd',NULL,'Nelamangala, Bengaluru',NULL,NULL,'industrial','2026-03-23','2026-05-25',NULL,12500000.00,NULL,NULL,NULL,'active',1,1,1,1,1,1,1,1,'2026-04-22 17:25:19','2026-04-22 17:25:19','principal_only',NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=192 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_nav`
--

LOCK TABLES `role_nav` WRITE;
/*!40000 ALTER TABLE `role_nav` DISABLE KEYS */;
INSERT INTO `role_nav` VALUES
(1,'principal','home','dashboard',1,1,'2026-04-22 17:25:18'),
(2,'principal','home','monthly',2,1,'2026-04-22 17:25:18'),
(3,'principal','home','projects',3,1,'2026-04-22 17:25:18'),
(4,'principal','home','project_detail',4,1,'2026-04-22 17:25:18'),
(5,'principal','money','payments',1,1,'2026-04-22 17:25:18'),
(6,'principal','money','vendors_master',2,1,'2026-04-22 17:25:18'),
(7,'principal','money','budget',3,1,'2026-04-22 17:25:18'),
(8,'principal','money','boq_mapping',4,1,'2026-04-22 17:25:18'),
(9,'principal','money','client_boq',5,1,'2026-04-22 17:25:18'),
(10,'principal','pending','pending',1,1,'2026-04-22 17:25:18'),
(11,'principal','more','register',1,1,'2026-04-22 17:25:18'),
(12,'principal','more','delegations',2,1,'2026-04-22 17:25:18'),
(13,'principal','more','changes',3,1,'2026-04-22 17:25:18'),
(14,'principal','more','weekly_health',4,1,'2026-04-22 17:25:18'),
(15,'principal','more','users',5,1,'2026-04-22 17:25:18'),
(16,'design_principal','home','dashboard',1,1,'2026-04-22 17:25:18'),
(17,'design_principal','home','monthly',2,1,'2026-04-22 17:25:18'),
(18,'design_principal','home','projects',3,1,'2026-04-22 17:25:18'),
(19,'design_principal','home','project_detail',4,1,'2026-04-22 17:25:18'),
(20,'design_principal','money','payments',1,1,'2026-04-22 17:25:18'),
(21,'design_principal','money','vendors_master',2,1,'2026-04-22 17:25:18'),
(22,'design_principal','money','budget',3,1,'2026-04-22 17:25:18'),
(23,'design_principal','money','boq_mapping',4,1,'2026-04-22 17:25:18'),
(24,'design_principal','money','client_boq',5,1,'2026-04-22 17:25:18'),
(25,'design_principal','pending','pending',1,1,'2026-04-22 17:25:18'),
(26,'design_principal','more','register',1,1,'2026-04-22 17:25:18'),
(27,'design_principal','more','delegations',2,1,'2026-04-22 17:25:18'),
(28,'design_principal','more','changes',3,1,'2026-04-22 17:25:18'),
(29,'design_principal','more','weekly_health',4,1,'2026-04-22 17:25:18'),
(30,'design_principal','more','users',5,1,'2026-04-22 17:25:18'),
(31,'pmc_head','home','dashboard',1,1,'2026-04-22 17:25:18'),
(32,'pmc_head','home','monthly',2,1,'2026-04-22 17:25:18'),
(33,'pmc_head','home','project_detail',3,1,'2026-04-22 17:25:18'),
(34,'pmc_head','work','reports',1,1,'2026-04-22 17:25:18'),
(35,'pmc_head','work','issues',2,1,'2026-04-22 17:25:18'),
(36,'pmc_head','work','meetings',3,1,'2026-04-22 17:25:18'),
(37,'pmc_head','work','drawings',4,1,'2026-04-22 17:25:18'),
(38,'pmc_head','work','register',5,1,'2026-04-22 17:25:18'),
(39,'pmc_head','work','materials',6,1,'2026-04-22 17:25:18'),
(40,'pmc_head','work','labour',7,1,'2026-04-22 17:25:18'),
(41,'pmc_head','money','grn',1,1,'2026-04-22 17:25:18'),
(42,'pmc_head','money','payments',2,1,'2026-04-22 17:25:18'),
(43,'pmc_head','money','vendors',3,1,'2026-04-22 17:25:18'),
(44,'pmc_head','money','vendors_master',4,1,'2026-04-22 17:25:18'),
(45,'pmc_head','pending','pending',1,1,'2026-04-22 17:25:18'),
(46,'design_head','home','dashboard',1,1,'2026-04-22 17:25:18'),
(47,'design_head','home','monthly',2,1,'2026-04-22 17:25:18'),
(48,'design_head','home','project_detail',3,1,'2026-04-22 17:25:18'),
(49,'design_head','work','drawings',1,1,'2026-04-22 17:25:18'),
(50,'design_head','work','issues',2,1,'2026-04-22 17:25:18'),
(51,'design_head','work','submittals',3,1,'2026-04-22 17:25:18'),
(52,'design_head','work','register',4,1,'2026-04-22 17:25:18'),
(53,'design_head','work','phototags',5,1,'2026-04-22 17:25:18'),
(54,'design_head','money','materials',1,1,'2026-04-22 17:25:18'),
(55,'design_head','money','budget',2,1,'2026-04-22 17:25:18'),
(56,'design_head','money','payments',3,1,'2026-04-22 17:25:18'),
(57,'design_head','more','signoff',1,1,'2026-04-22 17:25:18'),
(58,'design_head','more','delegations',2,1,'2026-04-22 17:25:18'),
(59,'services_head','home','dashboard',1,1,'2026-04-22 17:25:18'),
(60,'services_head','home','monthly',2,1,'2026-04-22 17:25:18'),
(61,'services_head','home','project_detail',3,1,'2026-04-22 17:25:18'),
(62,'services_head','work','drawings',1,1,'2026-04-22 17:25:18'),
(63,'services_head','work','issues',2,1,'2026-04-22 17:25:18'),
(64,'services_head','work','submittals',3,1,'2026-04-22 17:25:18'),
(65,'services_head','work','register',4,1,'2026-04-22 17:25:18'),
(66,'services_head','work','phototags',5,1,'2026-04-22 17:25:18'),
(67,'services_head','money','materials',1,1,'2026-04-22 17:25:18'),
(68,'services_head','money','budget',2,1,'2026-04-22 17:25:18'),
(69,'services_head','money','payments',3,1,'2026-04-22 17:25:18'),
(70,'services_head','more','signoff',1,1,'2026-04-22 17:25:18'),
(71,'services_head','more','delegations',2,1,'2026-04-22 17:25:18'),
(72,'site_manager','home','dashboard',1,1,'2026-04-22 17:25:18'),
(73,'site_manager','home','project_detail',2,1,'2026-04-22 17:25:18'),
(74,'site_manager','work','tasks',1,1,'2026-04-22 17:25:18'),
(75,'site_manager','work','photos',2,1,'2026-04-22 17:25:18'),
(76,'site_manager','work','issues_site',3,1,'2026-04-22 17:25:18'),
(77,'site_manager','work','issues',4,1,'2026-04-22 17:25:18'),
(78,'site_manager','work','labour',5,1,'2026-04-22 17:25:18'),
(79,'site_manager','work','drawings',6,1,'2026-04-22 17:25:18'),
(80,'site_manager','work','register',7,1,'2026-04-22 17:25:18'),
(81,'site_manager','money','grn',1,1,'2026-04-22 17:25:18'),
(82,'site_manager','money','payments',2,1,'2026-04-22 17:25:18'),
(83,'site_manager','money','materials_site',3,1,'2026-04-22 17:25:18'),
(84,'senior_site_manager','home','dashboard',1,1,'2026-04-22 17:25:18'),
(85,'senior_site_manager','home','project_detail',2,1,'2026-04-22 17:25:18'),
(86,'senior_site_manager','work','tasks',1,1,'2026-04-22 17:25:18'),
(87,'senior_site_manager','work','photos',2,1,'2026-04-22 17:25:18'),
(88,'senior_site_manager','work','issues_site',3,1,'2026-04-22 17:25:18'),
(89,'senior_site_manager','work','issues',4,1,'2026-04-22 17:25:18'),
(90,'senior_site_manager','work','labour',5,1,'2026-04-22 17:25:18'),
(91,'senior_site_manager','work','drawings',6,1,'2026-04-22 17:25:18'),
(92,'senior_site_manager','work','register',7,1,'2026-04-22 17:25:18'),
(93,'senior_site_manager','money','grn',1,1,'2026-04-22 17:25:18'),
(94,'senior_site_manager','money','payments',2,1,'2026-04-22 17:25:18'),
(95,'senior_site_manager','money','materials_site',3,1,'2026-04-22 17:25:18'),
(96,'finance_admin','home','dashboard',1,1,'2026-04-22 17:25:18'),
(97,'finance_admin','home','monthly',2,1,'2026-04-22 17:25:18'),
(98,'finance_admin','home','project_detail',3,1,'2026-04-22 17:25:18'),
(99,'finance_admin','money','payments_fin',1,1,'2026-04-22 17:25:18'),
(100,'finance_admin','money','vendors_master',2,1,'2026-04-22 17:25:18'),
(101,'finance_admin','money','client_receipts',3,1,'2026-04-22 17:25:18'),
(102,'finance_admin','money','petty_cash',4,1,'2026-04-22 17:25:18'),
(103,'finance_admin','money','pi',5,1,'2026-04-22 17:25:18'),
(104,'finance_admin','money','gst_statement',6,1,'2026-04-22 17:25:18'),
(105,'finance_admin','money','client_boq',7,1,'2026-04-22 17:25:18'),
(106,'finance_admin','money','clients',8,1,'2026-04-22 17:25:18'),
(107,'team_lead','home','dashboard',1,1,'2026-04-22 17:25:18'),
(108,'team_lead','home','project_detail',2,1,'2026-04-22 17:25:18'),
(109,'team_lead','work','drawings',1,1,'2026-04-22 17:25:18'),
(110,'team_lead','work','register',2,1,'2026-04-22 17:25:18'),
(111,'team_lead','work','issues',3,1,'2026-04-22 17:25:18'),
(112,'team_lead','work','submittals',4,1,'2026-04-22 17:25:18'),
(113,'team_lead','work','phototags',5,1,'2026-04-22 17:25:18'),
(121,'jr_architect','home','dashboard',1,1,'2026-04-22 17:25:18'),
(122,'jr_architect','home','project_detail',2,1,'2026-04-22 17:25:18'),
(123,'jr_architect','work','drawings',1,1,'2026-04-22 17:25:18'),
(124,'jr_architect','work','issues',2,1,'2026-04-22 17:25:18'),
(125,'jr_architect','work','submittals',3,1,'2026-04-22 17:25:18'),
(126,'services_engineer','home','dashboard',1,1,'2026-04-22 17:25:18'),
(127,'services_engineer','home','project_detail',2,1,'2026-04-22 17:25:18'),
(128,'services_engineer','work','drawings',1,1,'2026-04-22 17:25:18'),
(129,'services_engineer','work','issues',2,1,'2026-04-22 17:25:18'),
(130,'services_engineer','work','submittals',3,1,'2026-04-22 17:25:18'),
(131,'services_engineer','work','phototags',4,1,'2026-04-22 17:25:18'),
(132,'coordinator','home','dashboard',1,1,'2026-04-22 17:25:18'),
(133,'coordinator','home','project_detail',2,1,'2026-04-22 17:25:18'),
(134,'coordinator','work','meetings',1,1,'2026-04-22 17:25:18'),
(135,'coordinator','work','tasks',2,1,'2026-04-22 17:25:18'),
(136,'coordinator','work','issues',3,1,'2026-04-22 17:25:18'),
(137,'coordinator','work','drawings',4,1,'2026-04-22 17:25:18'),
(138,'coordinator','work','register',5,1,'2026-04-22 17:25:18'),
(139,'coordinator','work','photos',6,1,'2026-04-22 17:25:18'),
(140,'coordinator','work','grn',7,1,'2026-04-22 17:25:18'),
(141,'trainee','strip','drawings',1,1,'2026-04-22 17:25:18'),
(142,'trainee','strip','schedule_view',2,1,'2026-04-22 17:25:18'),
(143,'detailing','strip','drawings',1,1,'2026-04-22 17:25:18'),
(144,'detailing','strip','submittals',2,1,'2026-04-22 17:25:18'),
(145,'audit','home','dashboard',1,1,'2026-04-22 17:25:18'),
(146,'audit','home','monthly',2,1,'2026-04-22 17:25:18'),
(147,'audit','home','projects',3,1,'2026-04-22 17:25:18'),
(148,'audit','home','project_detail',4,1,'2026-04-22 17:25:18'),
(149,'audit','money','payments',1,1,'2026-04-22 17:25:18'),
(150,'audit','money','payments_fin',2,1,'2026-04-22 17:25:18'),
(151,'audit','money','vendors',3,1,'2026-04-22 17:25:18'),
(152,'audit','money','vendors_master',4,1,'2026-04-22 17:25:18'),
(153,'audit','money','finance_clearance',5,1,'2026-04-22 17:25:18'),
(154,'audit','money','budget',6,1,'2026-04-22 17:25:18'),
(155,'audit','money','budget_tree',7,1,'2026-04-22 17:25:18'),
(156,'audit','money','boq_mapping',8,1,'2026-04-22 17:25:18'),
(157,'audit','money','client_boq',9,1,'2026-04-22 17:25:18'),
(158,'audit','money','materials',10,1,'2026-04-22 17:25:18'),
(159,'audit','money','grn',11,1,'2026-04-22 17:25:18'),
(160,'audit','money','pi',12,1,'2026-04-22 17:25:18'),
(161,'audit','money','petty_cash',13,1,'2026-04-22 17:25:18'),
(162,'audit','money','client_receipts',14,1,'2026-04-22 17:25:18'),
(163,'audit','money','gst_statement',15,1,'2026-04-22 17:25:18'),
(164,'audit','money','clients',16,1,'2026-04-22 17:25:18'),
(165,'audit','pending','pending',1,1,'2026-04-22 17:25:18'),
(166,'audit','more','register',1,1,'2026-04-22 17:25:18'),
(167,'audit','more','drawings',2,1,'2026-04-22 17:25:18'),
(168,'audit','more','submittals',3,1,'2026-04-22 17:25:18'),
(169,'audit','more','issues',4,1,'2026-04-22 17:25:18'),
(170,'audit','more','issues_site',5,1,'2026-04-22 17:25:18'),
(171,'audit','more','tasks',6,1,'2026-04-22 17:25:18'),
(172,'audit','more','photos',7,1,'2026-04-22 17:25:18'),
(173,'audit','more','phototags',8,1,'2026-04-22 17:25:18'),
(174,'audit','more','meetings',9,1,'2026-04-22 17:25:18'),
(175,'audit','more','reports',10,1,'2026-04-22 17:25:18'),
(176,'audit','more','labour',11,1,'2026-04-22 17:25:18'),
(177,'audit','more','schedule_view',12,1,'2026-04-22 17:25:18'),
(178,'audit','more','approvals',13,1,'2026-04-22 17:25:18'),
(179,'audit','more','signoff',14,1,'2026-04-22 17:25:18'),
(180,'audit','more','changes',15,1,'2026-04-22 17:25:18'),
(181,'audit','more','delegations',16,1,'2026-04-22 17:25:18'),
(182,'audit','more','deputy',17,1,'2026-04-22 17:25:18'),
(183,'audit','more','weekly_health',18,1,'2026-04-22 17:25:18'),
(184,'audit','more','users',19,1,'2026-04-22 17:25:18'),
(185,'audit','more','ncr',20,1,'2026-04-22 17:25:18'),
(186,'audit','more','compliance',21,1,'2026-04-22 17:25:18'),
(187,'audit','more','tally',22,1,'2026-04-22 17:25:18'),
(188,'audit','more','notifications',23,1,'2026-04-22 17:25:18'),
(189,'it_admin','home','nav_editor',1,1,'2026-04-22 17:25:18'),
(190,'principal','more','governance',50,1,'2026-04-22 17:25:19'),
(191,'design_principal','more','governance',50,1,'2026-04-22 17:25:19');
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
) ENGINE=InnoDB AUTO_INCREMENT=84 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES
(1,'principal','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),
(2,'design_principal','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),
(3,'pmc_head','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),
(4,'finance_admin','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),
(5,'design_head','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),
(6,'services_head','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),
(7,'principal','finance.petty-cash.write','W','Finance','Create petty cash entry','2026-04-22 17:25:19',NULL),
(8,'design_principal','finance.petty-cash.write','W','Finance','Create petty cash entry','2026-04-22 17:25:19',NULL),
(9,'pmc_head','finance.petty-cash.write','W','Finance','Create petty cash entry','2026-04-22 17:25:19',NULL),
(10,'principal','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-22 17:25:19',NULL),
(11,'design_principal','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-22 17:25:19',NULL),
(12,'pmc_head','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-22 17:25:19',NULL),
(13,'finance_admin','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-22 17:25:19',NULL),
(14,'principal','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),
(15,'design_principal','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),
(16,'pmc_head','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),
(17,'finance_admin','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),
(18,'design_head','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),
(19,'services_head','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),
(20,'principal','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),
(21,'design_principal','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),
(22,'pmc_head','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),
(23,'design_head','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),
(24,'services_head','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),
(25,'finance_admin','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),
(26,'site_manager','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),
(27,'senior_site_manager','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),
(28,'principal','finance.payment-request.approve-pmc','A','Finance','PMC approve payment request','2026-04-22 17:25:19',NULL),
(29,'design_principal','finance.payment-request.approve-pmc','A','Finance','PMC approve payment request','2026-04-22 17:25:19',NULL),
(30,'pmc_head','finance.payment-request.approve-pmc','A','Finance','PMC approve payment request','2026-04-22 17:25:19',NULL),
(31,'principal','finance.payment-request.approve-principal','A','Finance','Principal approve payment request','2026-04-22 17:25:19',NULL),
(32,'design_principal','finance.payment-request.approve-principal','A','Finance','Principal approve payment request','2026-04-22 17:25:19',NULL),
(33,'principal','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),
(34,'design_principal','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),
(35,'pmc_head','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),
(36,'site_manager','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),
(37,'senior_site_manager','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),
(38,'finance_admin','finance.vendor-clearance.approve','A','Finance','Clear vendor','2026-04-22 17:25:19',NULL),
(39,'principal','finance.vendor-pan.approve','A','Finance','Validate vendor PAN','2026-04-22 17:25:19',NULL),
(40,'design_principal','finance.vendor-pan.approve','A','Finance','Validate vendor PAN','2026-04-22 17:25:19',NULL),
(41,'finance_admin','finance.vendor-pan.approve','A','Finance','Validate vendor PAN','2026-04-22 17:25:19',NULL),
(42,'principal','claims.raise','W','Services','Raise claim','2026-04-22 17:25:19',NULL),
(43,'design_principal','claims.raise','W','Services','Raise claim','2026-04-22 17:25:19',NULL),
(44,'pmc_head','claims.raise','W','Services','Raise claim','2026-04-22 17:25:19',NULL),
(45,'principal','claims.pmc-signoff','A','Services','PMC sign-off claim','2026-04-22 17:25:19',NULL),
(46,'design_principal','claims.pmc-signoff','A','Services','PMC sign-off claim','2026-04-22 17:25:19',NULL),
(47,'pmc_head','claims.pmc-signoff','A','Services','PMC sign-off claim','2026-04-22 17:25:19',NULL),
(48,'principal','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-22 17:25:19',NULL),
(49,'design_principal','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-22 17:25:19',NULL),
(50,'design_head','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-22 17:25:19',NULL),
(51,'services_head','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-22 17:25:19',NULL),
(52,'principal','claims.approve','A','Services','Approve claim (final)','2026-04-22 17:25:19',NULL),
(53,'design_principal','claims.approve','A','Services','Approve claim (final)','2026-04-22 17:25:19',NULL),
(54,'principal','claims.invoice','W','Services','Record invoice number on claim','2026-04-22 17:25:19',NULL),
(55,'design_principal','claims.invoice','W','Services','Record invoice number on claim','2026-04-22 17:25:19',NULL),
(56,'pmc_head','claims.invoice','W','Services','Record invoice number on claim','2026-04-22 17:25:19',NULL),
(57,'principal','governance.change-notice.raise','W','Governance','Raise change notice','2026-04-22 17:25:19',NULL),
(58,'design_principal','governance.change-notice.raise','W','Governance','Raise change notice','2026-04-22 17:25:19',NULL),
(59,'principal','governance.change-notice.approve','A','Governance','Approve change notice','2026-04-22 17:25:19',NULL),
(60,'design_principal','governance.change-notice.approve','A','Governance','Approve change notice','2026-04-22 17:25:19',NULL),
(61,'principal','governance.weekly-report.send','A','Governance','Mark weekly report sent to client','2026-04-22 17:25:19',NULL),
(62,'design_principal','governance.weekly-report.send','A','Governance','Mark weekly report sent to client','2026-04-22 17:25:19',NULL),
(63,'principal','governance.anomaly.acknowledge','A','Governance','Acknowledge AI anomaly flag','2026-04-22 17:25:19',NULL),
(64,'design_principal','governance.anomaly.acknowledge','A','Governance','Acknowledge AI anomaly flag','2026-04-22 17:25:19',NULL),
(65,'pmc_head','governance.anomaly.acknowledge','A','Governance','Acknowledge AI anomaly flag','2026-04-22 17:25:19',NULL),
(66,'principal','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),
(67,'design_principal','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),
(68,'pmc_head','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),
(69,'design_head','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),
(70,'services_head','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),
(71,'principal','admin.user.approve','A','Admin','Approve new user','2026-04-22 17:25:19',NULL),
(72,'design_principal','admin.user.approve','A','Admin','Approve new user','2026-04-22 17:25:19',NULL),
(73,'principal','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),
(74,'design_principal','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),
(75,'pmc_head','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),
(76,'design_head','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),
(77,'services_head','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),
(78,'finance_admin','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),
(79,'principal','admin.nav.approve','A','Admin','Edit nav / role tabs','2026-04-22 17:25:19',NULL),
(80,'it_admin','admin.nav.propose','W','Admin','Propose nav / role tab changes','2026-04-22 17:25:19',NULL),
(81,'principal','admin.password-reset','W','Admin','Reset another user password (unrestricted)','2026-04-22 17:25:19',NULL),
(82,'design_principal','admin.password-reset','W','Admin','Reset another user password (unrestricted)','2026-04-22 17:25:19',NULL),
(83,'it_admin','admin.password-reset','W','Admin','Reset another user password (unrestricted)','2026-04-22 17:25:19',NULL);
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
  `notified_naveen` tinyint(1) NOT NULL DEFAULT 0,
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
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_tasks`
--

LOCK TABLES `schedule_tasks` WRITE;
/*!40000 ALTER TABLE `schedule_tasks` DISABLE KEYS */;
INSERT INTO `schedule_tasks` VALUES
(1,1,1,'Civil','Site mobilisation','2026-03-23','2026-03-25',NULL,1,0,'schedule','Mobilisation complete',1,'2026-04-22 17:25:19'),
(2,1,1,'Civil','Foundation excavation','2026-03-26','2026-04-02',NULL,0,0,'none',NULL,2,'2026-04-22 17:25:19'),
(3,1,1,'Civil','Foundation concrete','2026-04-03','2026-04-10',NULL,1,0,'both','Foundation cast',3,'2026-04-22 17:25:19'),
(4,1,1,'Civil','Floor slab + columns','2026-04-11','2026-04-24',NULL,0,0,'none',NULL,4,'2026-04-22 17:25:19'),
(5,1,1,'Electrical','Conduit rough-in','2026-04-15','2026-04-25',NULL,0,0,'none',NULL,5,'2026-04-22 17:25:19'),
(6,1,1,'Electrical','Cable pulling','2026-04-26','2026-05-05',NULL,0,0,'none',NULL,6,'2026-04-22 17:25:19'),
(7,1,1,'Electrical','Panel termination','2026-05-06','2026-05-12',NULL,1,0,'payment','Power-on milestone',7,'2026-04-22 17:25:19'),
(8,1,1,'HVAC','Ductwork install','2026-04-28','2026-05-08',NULL,0,0,'none',NULL,8,'2026-04-22 17:25:19'),
(9,1,1,'HVAC','AHU commissioning','2026-05-10','2026-05-18',NULL,1,0,'payment','HVAC live',9,'2026-04-22 17:25:19'),
(10,1,1,'Civil','Snagging + handover','2026-05-19','2026-05-25',NULL,1,0,'both','Practical completion',10,'2026-04-22 17:25:19');
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
  KEY `uploaded_by` (`uploaded_by`),
  KEY `approved_by` (`approved_by`),
  KEY `drift_acknowledged_by` (`drift_acknowledged_by`),
  KEY `idx_schedule_versions_proj_status` (`project_id`,`status`),
  CONSTRAINT `schedule_versions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `schedule_versions_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `schedule_versions_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `schedule_versions_ibfk_4` FOREIGN KEY (`drift_acknowledged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_versions`
--

LOCK TABLES `schedule_versions` WRITE;
/*!40000 ALTER TABLE `schedule_versions` DISABLE KEYS */;
INSERT INTO `schedule_versions` VALUES
(1,1,1,0,'R0','2026-05-25',0,'approved',NULL,1,NULL,NULL,NULL,1,0,NULL,NULL,NULL,'2026-04-22 17:25:19');
/*!40000 ALTER TABLE `schedule_versions` ENABLE KEYS */;
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
-- Table structure for table `snags`
--

DROP TABLE IF EXISTS `snags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `snags` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `snag_number` varchar(20) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `location` varchar(200) DEFAULT NULL,
  `trade` varchar(50) DEFAULT NULL,
  `raised_by` int(10) unsigned NOT NULL,
  `raised_at` datetime NOT NULL DEFAULT current_timestamp(),
  `raised_from` enum('meeting','ncr','other') NOT NULL DEFAULT 'other',
  `meeting_id` int(10) unsigned DEFAULT NULL,
  `ncr_id` int(10) unsigned DEFAULT NULL,
  `assigned_vendor` int(10) unsigned DEFAULT NULL,
  `target_close_date` date DEFAULT NULL,
  `rectified_by` int(10) unsigned DEFAULT NULL,
  `rectified_at` datetime DEFAULT NULL,
  `verified_by` int(10) unsigned DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `status` enum('open','rectified','closed') NOT NULL DEFAULT 'open',
  `priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
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
-- Dumping data for table `snags`
--

LOCK TABLES `snags` WRITE;
/*!40000 ALTER TABLE `snags` DISABLE KEYS */;
/*!40000 ALTER TABLE `snags` ENABLE KEYS */;
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
  `email` varchar(100) DEFAULT NULL,
  `whatsapp_notifications` tinyint(1) NOT NULL DEFAULT 1,
  `force_password_change` tinyint(1) NOT NULL DEFAULT 1,
  `temp_password` varchar(100) DEFAULT NULL,
  `reset_by` int(10) unsigned DEFAULT NULL,
  `reset_at` datetime DEFAULT NULL,
  `managed_by` int(10) unsigned DEFAULT NULL,
  `deputy_id` int(10) unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `managed_by` (`managed_by`),
  KEY `deputy_id` (`deputy_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`managed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`deputy_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,'naveen','$2b$10$placeholder','Naveen Kumar Bhat','principal','all',NULL,NULL,1,1,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(2,'ajay','$2b$10$placeholder','Ajay Appachu','design_principal','all',NULL,NULL,1,1,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(3,'murugesan','$2b$10$placeholder','Murugesan K','pmc_head','pmc',NULL,NULL,1,1,NULL,NULL,NULL,1,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(4,'praveen','$2b$10$placeholder','Praveen Kumar','pmc_head','pmc',NULL,NULL,1,1,NULL,NULL,NULL,1,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(5,'rajani','$2b$10$placeholder','Rajani Gowda K','design_head','design',NULL,NULL,1,1,NULL,NULL,NULL,2,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(6,'srinath','$2b$10$placeholder','Srinath','services_head','services',NULL,NULL,1,1,NULL,NULL,NULL,2,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(7,'sahana','$2b$10$placeholder','Sahana R','team_lead','design',NULL,NULL,1,1,NULL,NULL,NULL,5,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:18'),
(8,'sushmitha','$2b$10$placeholder','Sushmitha H N','team_lead','design',NULL,NULL,1,1,NULL,NULL,NULL,5,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:18'),
(9,'preethi','$2b$10$placeholder','Preethi R','jr_architect','design',NULL,NULL,1,1,NULL,NULL,NULL,5,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(10,'satish','$2b$10$placeholder','Satish Rajakumar','jr_architect','design',NULL,NULL,1,1,NULL,NULL,NULL,5,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(11,'abhishek','$2b$10$placeholder','Abhishek K C','detailing','design',NULL,NULL,1,1,NULL,NULL,NULL,7,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(12,'bhumika','$2b$10$placeholder','Bhumika Y M','detailing','design',NULL,NULL,1,1,NULL,NULL,NULL,7,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(13,'ajay_a','$2b$10$placeholder','Ajay Acharya','detailing','design',NULL,NULL,1,1,NULL,NULL,NULL,7,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(14,'shreyas','$2b$10$placeholder','Shreyas Y Acharya','detailing','design',NULL,NULL,1,1,NULL,NULL,NULL,7,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(15,'karthik','$2b$10$placeholder','Karthik','services_engineer','services',NULL,NULL,1,1,NULL,NULL,NULL,6,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(16,'anjaneya','$2b$10$placeholder','Anjaneya','site_manager','site',NULL,NULL,1,1,NULL,NULL,NULL,3,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(17,'suleman','$2b$10$placeholder','Suleman Saiyed','site_manager','site',NULL,NULL,1,1,NULL,NULL,NULL,3,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(18,'prajwal','$2b$10$placeholder','Prajwal S Thantry','site_manager','site',NULL,NULL,1,1,NULL,NULL,NULL,3,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(19,'arun','$2b$10$placeholder','Arun Kumar B R','site_manager','site',NULL,NULL,1,1,NULL,NULL,NULL,3,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),
(20,'udupa','$2b$10$placeholder','Udupa','principal','all',NULL,NULL,1,1,NULL,NULL,NULL,1,NULL,1,'2026-04-22 17:25:16','2026-04-22 17:25:16'),
(21,'audit','$2a$10$8NkaWss83QE2iJy8x6P21u4wuwBpeLtm1XS2mRGGzRf8J6D2E/RCi','Audit Account','audit','all',NULL,NULL,1,1,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:18','2026-04-22 17:25:18'),
(22,'test_principal','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Principal','principal','all',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(23,'test_design_principal','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Design Principal','design_principal','design',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(24,'test_design_head','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Design Head','design_head','design',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(25,'test_team_lead','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Team Lead','team_lead','design',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(26,'test_services_head','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Services Head','services_head','services',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(27,'test_detailing_head','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Detailing Head','detailing_head','design',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(28,'test_jr_architect','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Junior Architect','jr_architect','design',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(29,'test_detailing','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Detailing','detailing','design',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(30,'test_services_eng','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Services Eng','services_engineer','services',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(31,'test_coordinator','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Coordinator','coordinator','pmc',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(32,'test_pmc_head','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test PMC Head','pmc_head','pmc',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(33,'test_site_manager','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Site Manager','site_manager','site',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(34,'test_sr_site_manager','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Sr Site Manager','senior_site_manager','site',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(35,'test_finance_admin','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Finance Admin','finance_admin','pmc',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(36,'test_trainee','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Trainee','trainee','all',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(37,'test_audit','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test Audit','audit','all',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19'),
(38,'test_it_admin','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Test IT Admin','it_admin','all',NULL,NULL,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-04-22 17:25:19');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_engagements`
--

LOCK TABLES `vendor_engagements` WRITE;
/*!40000 ALTER TABLE `vendor_engagements` DISABLE KEYS */;
INSERT INTO `vendor_engagements` VALUES
(1,1,1,'Civil & Structural Works',4500000.00,'active',NULL,NULL,1,'approved',1,'2026-04-22 17:25:19',NULL,1,NULL,'2026-04-22 17:25:19'),
(2,2,1,'Electrical Installation',3200000.00,'active',NULL,NULL,1,'approved',1,'2026-04-22 17:25:19',NULL,1,NULL,'2026-04-22 17:25:19'),
(3,3,1,'HVAC Systems',2800000.00,'not_started',NULL,NULL,1,'approved',1,'2026-04-22 17:25:19',NULL,1,NULL,'2026-04-22 17:25:19');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES
(1,'Civil','BlueStone Constructions','Ravi K','+919900010001','29ABCDE1234F1Z1','HDFC Bank','50100012345678','HDFC0001234',1,'ABCDE1234F',1,NULL,NULL,1,NULL,'pending',NULL,NULL,NULL,NULL,1,NULL,'2026-04-22 17:25:19'),
(2,'Electrical','VoltEdge Systems','Suresh M','+919900010002','29FGHIJ5678K2Z2','ICICI Bank','001701012345','ICIC0000017',1,'FGHIJ5678K',1,NULL,NULL,1,NULL,'pending',NULL,NULL,NULL,NULL,1,NULL,'2026-04-22 17:25:19'),
(3,'HVAC','CoolAir Mechanical','Praveen N','+919900010003','29LMNOP9012Q3Z3','SBI','30012345678','SBIN0001234',1,'LMNOP9012Q',1,NULL,NULL,1,NULL,'pending',NULL,NULL,NULL,NULL,1,NULL,'2026-04-22 17:25:19');
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
-- Table structure for table `weekly_report_photos`
--

DROP TABLE IF EXISTS `weekly_report_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `weekly_report_photos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `weekly_report_id` int(10) unsigned NOT NULL,
  `photo_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `weekly_report_id` (`weekly_report_id`),
  KEY `photo_id` (`photo_id`),
  CONSTRAINT `weekly_report_photos_ibfk_1` FOREIGN KEY (`weekly_report_id`) REFERENCES `weekly_reports` (`id`),
  CONSTRAINT `weekly_report_photos_ibfk_2` FOREIGN KEY (`photo_id`) REFERENCES `project_photos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `weekly_report_photos`
--

LOCK TABLES `weekly_report_photos` WRITE;
/*!40000 ALTER TABLE `weekly_report_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `weekly_report_photos` ENABLE KEYS */;
UNLOCK TABLES;

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
  `pdf_path` varchar(500) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
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
INSERT INTO `workflow_transitions` VALUES
(1,'claims','draft','pmc_signed','principal,design_principal,pmc_head','PMC signs off',0,1,'2026-04-22 17:25:19'),
(2,'claims','pmc_signed','stream_signed','principal,design_principal,design_head,services_head','Stream head signs',0,2,'2026-04-22 17:25:19'),
(3,'claims','stream_signed','approved','principal,design_principal','Principal approves',0,3,'2026-04-22 17:25:19'),
(4,'claims','approved','invoiced','principal,design_principal,pmc_head','Invoice number recorded',0,4,'2026-04-22 17:25:19'),
(5,'measurements','draft','rs_signed','principal,design_principal,design_head,services_head','Stream sign-off',0,1,'2026-04-22 17:25:19'),
(6,'measurements','rs_signed','client_accepted','principal,design_principal,pmc_head','Client acceptance recorded',0,2,'2026-04-22 17:25:19'),
(7,'snags','open','rectified','principal,design_principal,pmc_head,site_manager,senior_site_manager','Mark rectified',0,1,'2026-04-22 17:25:19'),
(8,'snags','rectified','closed','principal,design_principal,pmc_head,design_head,services_head','Verify and close',0,2,'2026-04-22 17:25:19'),
(9,'snags','open','closed','principal,design_principal,pmc_head,design_head,services_head','Direct close (minor)',1,3,'2026-04-22 17:25:19'),
(10,'weekly_reports','draft','pending_review','principal,design_principal,pmc_head,design_head,services_head','All sections signed',0,1,'2026-04-22 17:25:19'),
(11,'weekly_reports','pending_review','approved','principal,design_principal','Principal approves',0,2,'2026-04-22 17:25:19'),
(12,'weekly_reports','approved','sent','principal,design_principal','Marked sent to client',0,3,'2026-04-22 17:25:19'),
(13,'payment_requests','pending_pmc','pmc_approved','principal,design_principal,pmc_head','PMC approves',0,1,'2026-04-22 17:25:19'),
(14,'payment_requests','pmc_approved','pending_principal','system','Above threshold â€” to Principal',0,2,'2026-04-22 17:25:19'),
(15,'payment_requests','pmc_approved','principal_approved','system','Below threshold â€” auto-approved',0,3,'2026-04-22 17:25:19'),
(16,'payment_requests','pending_principal','principal_approved','principal,design_principal','Principal approves',0,4,'2026-04-22 17:25:19'),
(17,'payment_requests','pending_principal','principal_rejected','principal,design_principal','Principal rejects',1,5,'2026-04-22 17:25:19'),
(18,'payment_requests','principal_approved','paid','principal,design_principal,finance_admin','Payment released',0,6,'2026-04-22 17:25:19'),
(19,'issues','open','in_progress','assignee','Work started',0,1,'2026-04-22 17:25:19'),
(20,'issues','in_progress','resolved','assignee','Mark resolved',0,2,'2026-04-22 17:25:19'),
(21,'issues','resolved','closed','principal,design_principal,pmc_head,design_head,services_head','Verify and close',0,3,'2026-04-22 17:25:19'),
(22,'issues','open','closed','principal,design_principal,pmc_head,design_head,services_head','Direct close',1,4,'2026-04-22 17:25:19'),
(23,'change_notices','draft','pending_approval','principal,design_principal,pmc_head,design_head,services_head','Stream heads sign',0,1,'2026-04-22 17:25:19'),
(24,'change_notices','pending_approval','approved','principal,design_principal','Principal approves',0,2,'2026-04-22 17:25:19'),
(25,'change_notices','pending_approval','rejected','principal,design_principal','Principal rejects',1,3,'2026-04-22 17:25:19'),
(26,'drawings','uploaded','issued','principal,design_principal,design_head,services_head','Approve and issue',0,1,'2026-04-22 17:25:19'),
(27,'drawings','issued','superseded','principal,design_principal,design_head','Superseded by new revision',1,2,'2026-04-22 17:25:19'),
(28,'drawings','uploaded','rejected','principal,design_principal,design_head,services_head','Reject with comments',1,3,'2026-04-22 17:25:19'),
(29,'submittals','submitted','under_review','principal,design_principal,design_head,services_head','Start review',0,1,'2026-04-22 17:25:19'),
(30,'submittals','under_review','approved','principal,design_principal,design_head,services_head','Approve',0,2,'2026-04-22 17:25:19'),
(31,'submittals','under_review','resubmit_required','principal,design_principal,design_head,services_head','Request resubmit',1,3,'2026-04-22 17:25:19'),
(32,'submittals','under_review','rejected','principal,design_principal,design_head,services_head','Reject',1,4,'2026-04-22 17:25:19'),
(33,'submittals','resubmit_required','submitted','site_manager,coordinator','Vendor resubmits',0,5,'2026-04-22 17:25:19');
/*!40000 ALTER TABLE `workflow_transitions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'nu_pmc'
--

--
-- Current Database: `nu_pmc`
--

USE `nu_pmc`;

--
-- Final view structure for view `current_pmc_assignments`
--

/*!50001 DROP VIEW IF EXISTS `current_pmc_assignments`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = latin1 */;
/*!50001 SET character_set_results     = latin1 */;
/*!50001 SET collation_connection      = latin1_swedish_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED DEFINER=`` SQL SECURITY DEFINER VIEW `current_pmc_assignments` AS select `p`.`id` AS `project_id`,`p`.`code` AS `project_code`,max(case when `a`.`kind` = 'primary' then `a`.`user_id` end) AS `primary_pmc_id`,max(case when `a`.`kind` = 'primary' then `a`.`id` end) AS `primary_assignment_id`,max(case when `a`.`kind` = 'backup' then `a`.`user_id` end) AS `backup_pmc_id`,max(case when `a`.`kind` = 'backup' then `a`.`id` end) AS `backup_assignment_id` from (`projects` `p` left join `project_pmc_assignments` `a` on(`a`.`project_id` = `p`.`id` and `a`.`effective_to` is null)) group by `p`.`id`,`p`.`code` */;
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

-- Dump completed on 2026-04-22 17:25:20
