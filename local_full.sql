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
  `advance_amount` decimal(14,2) NOT NULL,
  `advance_date` date NOT NULL,
  `recovery_pct_per_bill` decimal(5,2) NOT NULL DEFAULT '10.00',
  `total_recovered` decimal(14,2) NOT NULL DEFAULT '0.00',
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
-- Dumping data for table `advance_recovery_schedule`
--

LOCK TABLES `advance_recovery_schedule` WRITE;
/*!40000 ALTER TABLE `advance_recovery_schedule` DISABLE KEYS */;
/*!40000 ALTER TABLE `advance_recovery_schedule` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `ai_feature_toggles`
--

LOCK TABLES `ai_feature_toggles` WRITE;
/*!40000 ALTER TABLE `ai_feature_toggles` DISABLE KEYS */;
INSERT INTO `ai_feature_toggles` VALUES ('autofill_boq_hsn',0,'Auto-fill BOQ HSN','Wires suggestHSN button in BOQ edit modal',17,'2026-06-17 14:11:56'),('detail_drawing_analysis',0,'Auto Detail Drawing Analysis','Extracts trade/reference info from detail uploads',17,'2026-06-17 14:11:57'),('drawing_sanity_check',0,'Auto Drawing Sanity Check','Drawing upload metadata validation',NULL,'2026-06-17 14:07:55'),('hsn_code_suggestion',0,'HSN Code Suggestion','Auto-suggests HSN code on BOQ item edit',NULL,'2026-06-17 14:07:55'),('material_approval_check',0,'Material Approval Check','Flags BOQ items needing client material approval',NULL,'2026-06-17 14:07:55'),('photo_auto_tagging',0,'Photo Auto-Tagging','Suggests task association for uploaded site photos',NULL,'2026-06-17 14:07:55'),('revision_change_analysis',0,'Auto Revision Change Analysis','Compares old vs new drawing, flags impacts',NULL,'2026-06-17 14:07:55'),('rfi_response_check',0,'Auto RFI Response Check','Checks if uploaded drawing answers the RFI',NULL,'2026-06-17 14:07:55'),('similar_query_dedup',0,'Similar Query Dedup','Wires checkSimilarQueries button in Raise Query modal',NULL,'2026-06-17 14:07:55'),('similar_query_search',0,'Similar Query Search','Shows past matching queries while raising a new one',NULL,'2026-06-17 14:07:55');
/*!40000 ALTER TABLE `ai_feature_toggles` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `approval_signoffs`
--

LOCK TABLES `approval_signoffs` WRITE;
/*!40000 ALTER TABLE `approval_signoffs` DISABLE KEYS */;
/*!40000 ALTER TABLE `approval_signoffs` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `approval_type_config`
--

LOCK TABLES `approval_type_config` WRITE;
/*!40000 ALTER TABLE `approval_type_config` DISABLE KEYS */;
INSERT INTO `approval_type_config` VALUES (1,'cn_approval','[\"principal\",\"design_principal\"]',1,'project',0,72,'Change Notice approval','PLACEHOLDER: high-value path only.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(2,'schedule_change','[\"principal\",\"design_principal\"]',1,'project',0,72,'Schedule baseline change','PLACEHOLDER: matches current requirePrincipal gate.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(3,'weekly_report','[\"principal\",\"design_principal\"]',1,'project',0,168,'Weekly report sign-off','PLACEHOLDER: principals only.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(4,'vendor_payment','[\"principal\",\"design_principal\",\"pmc_head\"]',1,'project',0,168,'Vendor payment approval','PLACEHOLDER: matches current requirePMC gate.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(5,'vendor_bank_change','[\"principal\",\"design_principal\"]',1,'global',1,72,'Vendor bank change','PLACEHOLDER: principals only.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(6,'claim_invoice','[\"principal\",\"design_principal\"]',1,'project',0,168,'Client claim approval','PLACEHOLDER: final-approve step only.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(7,'budget_cost_head','[\"principal\",\"design_principal\"]',1,'project',0,72,'Budget cost head approval','PLACEHOLDER: principals only.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(8,'handover_closure','[\"principal\",\"design_principal\",\"pmc_head\",\"finance_admin\"]',4,'project',0,NULL,'Project handover closure','PLACEHOLDER: 4-signer quorum design.','sheet9_seed_v5.24',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(9,'vendor_onboarding','[\"finance_admin\",\"principal\"]',2,'global',0,2880,'Vendor onboarding','Vendor onboarding approval ΓÇö finance then principal.','sheet9_seed_v6.02',1,'2026-06-16 09:38:00','2026-06-16 09:38:00');
/*!40000 ALTER TABLE `approval_type_config` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `approvals`
--

LOCK TABLES `approvals` WRITE;
/*!40000 ALTER TABLE `approvals` DISABLE KEYS */;
/*!40000 ALTER TABLE `approvals` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=164 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
INSERT INTO `audit_log` VALUES (1,10,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 15:10:29'),(2,10,'auth.end_impersonation','users',39,'{\"from_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 15:37:09'),(3,10,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 15:37:40'),(4,10,'auth.end_impersonation','users',39,'{\"from_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 15:53:05'),(5,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 17:16:18'),(6,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"jr_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 19:58:21'),(7,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 19:58:24'),(8,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 19:58:26'),(9,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 19:58:27'),(10,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"jr_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 19:58:29'),(11,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 20:15:01'),(12,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 20:18:13'),(13,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 20:25:55'),(14,17,'task_update.create','task_updates',NULL,'{\"project_id\":2,\"task_id\":16,\"pct_complete\":15,\"regression\":false,\"report_date\":\"2026-06-16\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 20:26:14'),(15,17,'task_update.create','task_updates',NULL,'{\"project_id\":2,\"task_id\":16,\"pct_complete\":0,\"regression\":false,\"report_date\":\"2026-06-16\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 20:26:15'),(16,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 20:46:41'),(17,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 20:46:47'),(18,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 20:47:24'),(19,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 20:47:27'),(20,17,'auth.end_impersonation','users',17,'{\"from_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 20:55:27'),(21,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 20:58:15'),(22,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 20:58:17'),(23,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 21:07:30'),(24,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 21:07:39'),(25,17,'auth.end_impersonation','users',17,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 21:07:56'),(26,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-16 21:07:58'),(27,17,'auth.end_impersonation','users',17,'{\"from_role\":\"services_head\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-16 21:57:50'),(28,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-16 21:57:56'),(29,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-16 22:00:47'),(30,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-16 22:00:50'),(31,17,'auth.end_impersonation','users',17,'{\"from_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-16 22:07:49'),(32,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-16 22:14:16'),(33,17,'auth.end_impersonation','users',17,'{\"from_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-16 22:15:22'),(34,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 12:39:08'),(35,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 12:39:11'),(36,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 12:48:49'),(37,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 12:51:04'),(38,17,'drawing.approve','drawing_versions',10,'{\"from\":\"pending_l1\",\"to\":\"pending_l2\",\"project_id\":2,\"stream\":\"design\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 12:51:14'),(39,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 12:51:25'),(40,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 12:51:49'),(41,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 12:52:05'),(42,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"jr_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 12:52:50'),(43,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 12:54:46'),(44,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:02:36'),(45,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:02:54'),(46,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:06:45'),(47,17,'photo.upload','project_photos',NULL,'{\"project_id\":2,\"count\":1,\"ids\":[1],\"task_id\":null,\"source\":\"app\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:15:25'),(48,17,'labour.record','labour_register',NULL,'{\"project_id\":2,\"engagement_id\":8,\"register_date\":\"2026-06-17\",\"trade\":\"Civil\",\"headcount\":45,\"wages_paid\":null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:16:43'),(49,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:21:32'),(50,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:22:03'),(51,17,'labour.record','labour_register',NULL,'{\"project_id\":2,\"engagement_id\":8,\"register_date\":\"2026-06-17\",\"trade\":\"Civil\",\"headcount\":100,\"wages_paid\":null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:28:14'),(52,17,'labour.record','labour_register',NULL,'{\"project_id\":2,\"engagement_id\":9,\"register_date\":\"2026-06-17\",\"trade\":\"Civil\",\"headcount\":152,\"wages_paid\":null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:28:43'),(53,17,'material_request.create','material_requests',2,'{\"project_id\":2,\"boq_item_id\":11,\"quantity_needed\":\"130\",\"needed_by_date\":\"2026-12-10\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:32:51'),(54,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:37:44'),(55,17,'meeting.create','meetings',9,'{\"project_id\":1,\"meeting_number\":\"MOM-001\",\"type\":\"internal\",\"meeting_date\":\"2026-06-17\",\"client_id\":null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:38:49'),(56,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:40:26'),(57,17,'photo.upload','project_photos',NULL,'{\"project_id\":2,\"count\":1,\"ids\":[2],\"task_id\":null,\"source\":\"app\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:40:38'),(58,17,'grn.create','grns',13,'{\"project_id\":2,\"grn_number\":\"GRN-003\",\"engagement_id\":9,\"quantity_received\":145,\"unit_rate\":1200,\"is_unplanned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:43:03'),(59,17,'grn.create','grns',14,'{\"project_id\":2,\"grn_number\":\"GRN-004\",\"engagement_id\":9,\"quantity_received\":145,\"unit_rate\":1200,\"is_unplanned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:43:04'),(60,17,'grn.create','grns',15,'{\"project_id\":2,\"grn_number\":\"GRN-005\",\"engagement_id\":9,\"quantity_received\":145,\"unit_rate\":1200,\"is_unplanned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:43:07'),(61,17,'grn.create','grns',16,'{\"project_id\":2,\"grn_number\":\"GRN-006\",\"engagement_id\":9,\"quantity_received\":145,\"unit_rate\":1200,\"is_unplanned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:44:49'),(62,17,'grn.create','grns',17,'{\"project_id\":2,\"grn_number\":\"GRN-007\",\"engagement_id\":8,\"quantity_received\":10,\"unit_rate\":12,\"is_unplanned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:53:45'),(63,17,'grn.create','grns',18,'{\"project_id\":2,\"grn_number\":\"GRN-008\",\"engagement_id\":8,\"quantity_received\":10,\"unit_rate\":12,\"is_unplanned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:56:39'),(64,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:58:15'),(65,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:58:39'),(66,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:58:53'),(67,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:59:31'),(68,17,'grn.create','grns',19,'{\"project_id\":2,\"grn_number\":\"GRN-009\",\"engagement_id\":8,\"quantity_received\":150,\"unit_rate\":1000,\"is_unplanned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 13:59:48'),(69,17,'auth.end_impersonation','users',17,'{\"from_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:01:25'),(70,17,'vendor.bulk_upload','vendors',NULL,'{\"added\":0,\"skipped\":16,\"file_path\":\"C:\\\\Users\\\\basus\\\\Documents\\\\Internship\\\\NUAssociates\\\\nu-pmc-main\\\\uploads\\\\documents\\\\1781685375989_a01e454f6ac8_nu_pmc_bulkupload_templates_v1__1_.xlsx\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:06:16'),(71,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:07:58'),(72,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:08:13'),(73,17,'grn.create','grns',20,'{\"project_id\":2,\"grn_number\":\"GRN-010\",\"engagement_id\":8,\"quantity_received\":140,\"unit_rate\":1000,\"is_unplanned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:08:30'),(74,17,'auth.end_impersonation','users',17,'{\"from_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:11:40'),(75,17,'ai_settings.toggle','ai_feature_toggles',NULL,'{\"feature_key\":\"autofill_boq_hsn\",\"enabled\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:11:53'),(76,17,'ai_settings.toggle','ai_feature_toggles',NULL,'{\"feature_key\":\"detail_drawing_analysis\",\"enabled\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:11:55'),(77,17,'ai_settings.toggle','ai_feature_toggles',NULL,'{\"feature_key\":\"autofill_boq_hsn\",\"enabled\":false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:11:56'),(78,17,'ai_settings.toggle','ai_feature_toggles',NULL,'{\"feature_key\":\"detail_drawing_analysis\",\"enabled\":false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:11:57'),(79,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:12:02'),(80,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:14:40'),(81,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:20:51'),(82,17,'photo.upload','project_photos',NULL,'{\"project_id\":2,\"count\":1,\"ids\":[3],\"task_id\":null,\"source\":\"app\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:20:59'),(83,17,'grn.approve','grns',19,'{\"from\":\"pending\",\"to\":\"approved\",\"approver_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:23:24'),(84,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:25:28'),(85,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:25:44'),(86,17,'auth.end_impersonation','users',17,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:26:13'),(87,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:26:14'),(88,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:27:11'),(89,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:27:13'),(90,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:27:41'),(91,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:27:44'),(92,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:27:50'),(93,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:28:09'),(94,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:28:10'),(95,17,'drawing_register.add','drawing_register',30,'{\"project_id\":2,\"drawing_number\":\"DRW-HVAC-401\",\"drawing_name\":\"Power Layout Diagram\",\"category\":\"IT\",\"stream\":\"services\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:29:33'),(96,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"jr_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:29:49'),(97,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:29:53'),(98,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:30:19'),(99,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:30:32'),(100,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:31:20'),(101,17,'drawing.approve','drawing_versions',11,'{\"from\":\"pending_l1\",\"to\":\"issued\",\"project_id\":2,\"stream\":\"services\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:31:25'),(102,17,'auth.end_impersonation','users',17,'{\"from_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:31:30'),(103,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:31:55'),(104,17,'photo.upload','project_photos',NULL,'{\"project_id\":2,\"count\":1,\"ids\":[4],\"task_id\":null,\"source\":\"app\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:32:04'),(105,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:34:07'),(106,17,'grn.create','grns',21,'{\"project_id\":2,\"grn_number\":\"GRN-011\",\"engagement_id\":7,\"quantity_received\":150,\"unit_rate\":1000,\"is_unplanned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:34:29'),(107,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:44:10'),(108,17,'photo.upload','project_photos',NULL,'{\"project_id\":2,\"count\":1,\"ids\":[5],\"task_id\":null,\"source\":\"app\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:44:21'),(109,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:49:29'),(110,17,'grn.create','grns',22,'{\"project_id\":2,\"grn_number\":\"GRN-012\",\"engagement_id\":9,\"quantity_received\":1545,\"unit_rate\":1201,\"is_unplanned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:50:01'),(111,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:50:18'),(112,17,'grn.create','grns',23,'{\"project_id\":2,\"grn_number\":\"GRN-013\",\"engagement_id\":7,\"quantity_received\":1450,\"unit_rate\":10000,\"is_unplanned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 14:51:01'),(113,17,'labour.record','labour_register',NULL,'{\"project_id\":2,\"engagement_id\":8,\"register_date\":\"2026-06-17\",\"trade\":\"Civil\",\"headcount\":150,\"wages_paid\":null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 15:03:09'),(114,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 15:17:39'),(115,17,'grn.reject','grns',13,'{\"rejection_reason\":null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 15:18:50'),(116,17,'grn.reject','grns',14,'{\"rejection_reason\":null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 15:18:52'),(117,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 15:18:58'),(118,17,'grn.create','grns',24,'{\"project_id\":2,\"grn_number\":\"GRN-014\",\"engagement_id\":8,\"quantity_received\":1,\"unit_rate\":1,\"is_unplanned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 15:19:17'),(119,17,'auth.end_impersonation','users',17,'{\"from_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-17 15:21:31'),(120,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 00:36:38'),(121,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 00:36:52'),(122,17,'auth.end_impersonation','users',17,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 00:36:55'),(123,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 00:36:57'),(124,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 00:37:25'),(125,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 00:49:02'),(126,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 00:49:09'),(127,17,'labour.record','labour_register',NULL,'{\"project_id\":1,\"engagement_id\":1,\"register_date\":\"2026-06-18\",\"trade\":\"Civil\",\"headcount\":150,\"wages_paid\":null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 00:57:04'),(128,17,'issue.rfi.create','issues',17,'{\"project_id\":2,\"issue_number\":\"ISS-003\",\"drawing_version_id\":null,\"stream\":\"design\",\"auto_assigned\":true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:02:16'),(129,17,'grn.reject','grns',15,'{\"rejection_reason\":null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:06:37'),(130,17,'grn.reject','grns',16,'{\"rejection_reason\":null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:06:38'),(131,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:06:46'),(132,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:07:28'),(133,17,'weekly_report.transition','weekly_report',6,'{\"from\":\"pending_approval\",\"to\":\"approved\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:07:51'),(134,17,'material_request.status_change','material_requests',1,'{\"from\":1,\"new_status\":2}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:08:19'),(135,17,'material_request.status_change','material_requests',1,'{\"from\":2,\"new_status\":3}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:08:22'),(136,17,'material_request.status_change','material_requests',1,'{\"from\":3,\"new_status\":4}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:08:23'),(137,17,'material_request.status_change','material_requests',1,'{\"from\":4,\"new_status\":5}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:08:24'),(138,17,'material_request.status_change','material_requests',2,'{\"from\":1,\"new_status\":2}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:08:29'),(139,17,'material_request.status_change','material_requests',2,'{\"from\":2,\"new_status\":3}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:08:30'),(140,17,'grn.reject','grns',21,'{\"rejection_reason\":null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:10:31'),(141,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:10:54'),(142,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:11:14'),(143,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"jr_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:15:01'),(144,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:15:09'),(145,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:15:15'),(146,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:19:58'),(147,17,'auth.end_impersonation','users',17,'{\"from_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:20:41'),(148,17,'cn.raise','change_notices',11,'{\"project_id\":2,\"cn_number\":\"CN003\",\"title\":\"Hello\",\"source\":\"client\",\"boq_impact\":false,\"schedule_impact_days\":3}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 01:55:27'),(149,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 13:38:16'),(150,17,'action_item.complete','meeting_actions',6,'{\"meeting_id\":7,\"completion_note\":null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 13:57:13'),(151,17,'auth.end_impersonation','users',17,'{\"from_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 13:57:58'),(152,17,'project.create','projects',7,'{\"code\":\"PV91\",\"name\":\"Test Production Line\",\"client_id\":2,\"client_stub_created\":true,\"project_type\":\"industrial\",\"r0_start_date\":\"2026-06-10\",\"r0_end_date\":\"2027-02-14\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 14:06:31'),(153,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 14:06:39'),(154,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 14:06:49'),(155,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 14:58:14'),(156,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 14:58:54'),(157,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 15:05:53'),(158,17,'auth.end_impersonation','users',17,'{\"from_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 15:06:21'),(159,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 15:12:30'),(160,17,'auth.end_impersonation','users',17,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 16:36:18'),(161,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 16:36:25'),(162,17,'auth.start_impersonation','users',17,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 16:36:28'),(163,17,'photo.upload','project_photos',NULL,'{\"project_id\":2,\"count\":1,\"ids\":[6],\"task_id\":null,\"source\":\"app\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-18 16:36:46');
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

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
  `quantity` decimal(12,3) NOT NULL DEFAULT '0.000',
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
-- Dumping data for table `boq_items`
--

LOCK TABLES `boq_items` WRITE;
/*!40000 ALTER TABLE `boq_items` DISABLE KEYS */;
INSERT INTO `boq_items` VALUES (1,1,1,NULL,'Civil','CIV-001','Excavation in ordinary soil',1,0,'CUM',180.000,1,0,NULL,NULL,0),(2,1,1,NULL,'Civil','CIV-002','M25 concrete (foundation)',2,0,'CUM',90.000,1,0,NULL,NULL,0),(3,1,1,NULL,'Civil','CIV-003','M30 concrete (columns+slab)',3,0,'CUM',140.000,1,0,NULL,NULL,0),(4,1,1,NULL,'Civil','CIV-004','Reinforcement steel Fe550',4,0,'MT',18.000,1,0,NULL,NULL,0),(5,2,1,NULL,'Electrical','ELC-001','3C x 4 sqmm XLPE cable',1,0,'MTR',600.000,1,0,NULL,NULL,0),(6,2,1,NULL,'Electrical','ELC-002','63A MCCB 4-pole',2,0,'NOS',12.000,1,0,NULL,NULL,0),(7,2,1,NULL,'Electrical','ELC-003','DB 12-way TPN',3,0,'NOS',4.000,1,0,NULL,NULL,0),(8,2,1,NULL,'HVAC','HVAC-001','7.5TR VRV outdoor unit',4,0,'NOS',2.000,1,0,NULL,NULL,0),(9,2,1,NULL,'HVAC','HVAC-002','Ceiling cassette 2TR',5,0,'NOS',8.000,1,0,NULL,NULL,0),(10,3,2,NULL,'Civil','CIV-101','Earth excavation and sorting',0,0,'CUM',250.000,1,1,'2026-06-16 15:18:48',NULL,0),(11,3,2,NULL,'Civil','CIV-102','PCC Foundation layer M15',0,0,'CUM',50.000,1,0,NULL,NULL,0),(12,3,2,NULL,'Civil','CIV-103','RCC Columns and beams',0,0,'CUM',120.000,1,1,'2026-06-16 15:18:48',NULL,0),(13,4,3,NULL,'Civil','CIV-101','Earth excavation and sorting',0,0,'CUM',250.000,1,1,'2026-06-16 15:18:48',NULL,0),(14,4,3,NULL,'Civil','CIV-102','PCC Foundation layer M15',0,0,'CUM',50.000,1,0,NULL,NULL,0),(15,4,3,NULL,'Civil','CIV-103','RCC Columns and beams',0,0,'CUM',120.000,1,1,'2026-06-16 15:18:48',NULL,0);
/*!40000 ALTER TABLE `boq_items` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `boq_versions`
--

LOCK TABLES `boq_versions` WRITE;
/*!40000 ALTER TABLE `boq_versions` DISABLE KEYS */;
INSERT INTO `boq_versions` VALUES (1,1,'design',1,'v1',NULL,1,1,NULL,'2026-04-22 17:25:19'),(2,1,'services',1,'v1',NULL,1,1,NULL,'2026-04-22 17:25:19'),(3,2,'design',1,'v1',NULL,1,4,NULL,'2026-06-16 15:18:47'),(4,3,'design',1,'v1',NULL,1,4,NULL,'2026-06-16 15:18:47');
/*!40000 ALTER TABLE `boq_versions` ENABLE KEYS */;
UNLOCK TABLES;

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
  `sanctioned` decimal(14,2) NOT NULL DEFAULT '0.00',
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
-- Dumping data for table `budget_cost_heads`
--

LOCK TABLES `budget_cost_heads` WRITE;
/*!40000 ALTER TABLE `budget_cost_heads` DISABLE KEYS */;
INSERT INTO `budget_cost_heads` VALUES (1,1,'CIVIL','Civil and Structural Works','common',8500000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(2,1,'ELEC','Electrical and Cabling Works','services',4200000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(3,1,'HVAC','Air Conditioning & Ventilation','services',3600000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(4,1,'ARCH','Interior Fitouts & Finishes','design',2200000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(5,2,'CIVIL','Civil and Structural Works','common',8500000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(6,2,'ELEC','Electrical and Cabling Works','services',4200000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(7,2,'HVAC','Air Conditioning & Ventilation','services',3600000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(8,2,'ARCH','Interior Fitouts & Finishes','design',2200000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(9,3,'CIVIL','Civil and Structural Works','common',8500000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(10,3,'ELEC','Electrical and Cabling Works','services',4200000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(11,3,'HVAC','Air Conditioning & Ventilation','services',3600000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(12,3,'ARCH','Interior Fitouts & Finishes','design',2200000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(13,4,'CIVIL','Civil and Structural Works','common',8500000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(14,4,'ELEC','Electrical and Cabling Works','services',4200000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(15,4,'HVAC','Air Conditioning & Ventilation','services',3600000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53'),(16,4,'ARCH','Interior Fitouts & Finishes','design',2200000.00,0,NULL,NULL,'approved',0,1,'2026-06-16 15:49:53');
/*!40000 ALTER TABLE `budget_cost_heads` ENABLE KEYS */;
UNLOCK TABLES;

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
  `pct_over` decimal(6,3) NOT NULL,
  `sanctioned` decimal(14,2) NOT NULL,
  `committed` decimal(14,2) NOT NULL,
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
-- Dumping data for table `budget_flags`
--

LOCK TABLES `budget_flags` WRITE;
/*!40000 ALTER TABLE `budget_flags` DISABLE KEYS */;
/*!40000 ALTER TABLE `budget_flags` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=320 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_threshold_alerts`
--

LOCK TABLES `budget_threshold_alerts` WRITE;
/*!40000 ALTER TABLE `budget_threshold_alerts` DISABLE KEYS */;
INSERT INTO `budget_threshold_alerts` VALUES (1,1,'Electrical',110,'2026-06-16 16:01:38'),(2,1,'Earthwork',211,'2026-06-16 16:01:38'),(3,4,'Electrical',134,'2026-06-16 16:01:38'),(4,4,'HVAC',94,'2026-06-16 16:01:38'),(5,4,'Earthwork',255,'2026-06-16 16:01:38'),(6,2,'Electrical',134,'2026-06-16 16:31:38'),(7,2,'HVAC',94,'2026-06-16 16:31:38'),(8,2,'Earthwork',255,'2026-06-16 16:31:38'),(9,3,'Electrical',134,'2026-06-16 16:31:38'),(10,3,'HVAC',94,'2026-06-16 16:31:38'),(11,3,'Earthwork',255,'2026-06-16 16:31:38'),(12,4,'Electrical',255,'2026-06-16 16:31:38'),(13,4,'HVAC',188,'2026-06-16 16:31:38'),(14,4,'Earthwork',255,'2026-06-16 16:31:38'),(15,4,'Concrete',134,'2026-06-16 16:31:38'),(16,4,'Electrical',255,'2026-06-16 16:34:30'),(17,4,'Earthwork',255,'2026-06-16 16:34:30'),(18,4,'Electrical',255,'2026-06-16 16:49:30'),(19,4,'Earthwork',255,'2026-06-16 16:49:30'),(20,4,'Electrical',255,'2026-06-16 16:55:29'),(21,4,'Earthwork',255,'2026-06-16 16:55:29'),(22,4,'Electrical',255,'2026-06-16 16:56:26'),(23,4,'Earthwork',255,'2026-06-16 16:56:26'),(24,4,'Electrical',255,'2026-06-16 16:58:32'),(25,4,'Earthwork',255,'2026-06-16 16:58:32'),(26,4,'Electrical',255,'2026-06-16 17:13:32'),(27,4,'Earthwork',255,'2026-06-16 17:13:32'),(28,4,'Electrical',255,'2026-06-16 17:28:32'),(29,4,'Earthwork',255,'2026-06-16 17:28:32'),(30,4,'Electrical',255,'2026-06-16 17:43:32'),(31,4,'Earthwork',255,'2026-06-16 17:43:32'),(32,4,'Electrical',255,'2026-06-16 17:55:36'),(33,4,'Earthwork',255,'2026-06-16 17:55:36'),(34,4,'Electrical',255,'2026-06-16 17:56:30'),(35,4,'Earthwork',255,'2026-06-16 17:56:30'),(36,4,'Electrical',255,'2026-06-16 18:11:30'),(37,4,'Earthwork',255,'2026-06-16 18:11:30'),(38,4,'Electrical',255,'2026-06-16 18:26:30'),(39,4,'Earthwork',255,'2026-06-16 18:26:30'),(40,4,'Electrical',255,'2026-06-16 18:41:30'),(41,4,'Earthwork',255,'2026-06-16 18:41:30'),(42,4,'Electrical',255,'2026-06-16 18:56:30'),(43,4,'Earthwork',255,'2026-06-16 18:56:30'),(44,4,'Electrical',255,'2026-06-16 19:11:30'),(45,4,'Earthwork',255,'2026-06-16 19:11:30'),(46,4,'Electrical',255,'2026-06-16 19:47:50'),(47,4,'Earthwork',255,'2026-06-16 19:47:50'),(48,4,'Electrical',255,'2026-06-16 19:58:10'),(49,4,'Earthwork',255,'2026-06-16 19:58:10'),(50,4,'Electrical',255,'2026-06-16 20:12:27'),(51,4,'Earthwork',255,'2026-06-16 20:12:27'),(52,4,'Electrical',255,'2026-06-16 20:27:27'),(53,4,'Earthwork',255,'2026-06-16 20:27:27'),(54,4,'Electrical',255,'2026-06-16 20:42:27'),(55,4,'Earthwork',255,'2026-06-16 20:42:27'),(56,4,'Electrical',255,'2026-06-16 20:47:28'),(57,4,'Earthwork',255,'2026-06-16 20:47:28'),(58,2,'Electrical',205,'2026-06-16 21:02:28'),(59,2,'HVAC',144,'2026-06-16 21:02:28'),(60,2,'Earthwork',255,'2026-06-16 21:02:28'),(61,2,'Concrete',103,'2026-06-16 21:02:28'),(62,3,'Electrical',232,'2026-06-16 21:02:28'),(63,3,'HVAC',163,'2026-06-16 21:02:28'),(64,3,'Earthwork',255,'2026-06-16 21:02:28'),(65,3,'Concrete',116,'2026-06-16 21:02:28'),(66,4,'Electrical',255,'2026-06-16 21:02:28'),(67,4,'Earthwork',255,'2026-06-16 21:02:28'),(68,2,'Earthwork',255,'2026-06-16 21:17:28'),(69,3,'Earthwork',255,'2026-06-16 21:17:28'),(70,4,'Electrical',255,'2026-06-16 21:17:28'),(71,4,'Earthwork',255,'2026-06-16 21:17:28'),(72,2,'Earthwork',255,'2026-06-16 21:32:28'),(73,3,'Earthwork',255,'2026-06-16 21:32:28'),(74,4,'Electrical',255,'2026-06-16 21:32:28'),(75,4,'Earthwork',255,'2026-06-16 21:32:28'),(76,2,'Earthwork',255,'2026-06-16 21:47:28'),(77,3,'Earthwork',255,'2026-06-16 21:47:28'),(78,4,'Electrical',255,'2026-06-16 21:47:28'),(79,4,'Earthwork',255,'2026-06-16 21:47:28'),(80,2,'Earthwork',255,'2026-06-16 22:02:28'),(81,3,'Earthwork',255,'2026-06-16 22:02:28'),(82,4,'Electrical',255,'2026-06-16 22:02:28'),(83,4,'Earthwork',255,'2026-06-16 22:02:28'),(84,2,'Earthwork',255,'2026-06-16 22:17:28'),(85,3,'Earthwork',255,'2026-06-16 22:17:28'),(86,4,'Electrical',255,'2026-06-16 22:17:28'),(87,4,'Earthwork',255,'2026-06-16 22:17:28'),(88,2,'Earthwork',255,'2026-06-16 22:32:28'),(89,3,'Earthwork',255,'2026-06-16 22:32:28'),(90,4,'Electrical',255,'2026-06-16 22:32:28'),(91,4,'Earthwork',255,'2026-06-16 22:32:28'),(92,2,'Earthwork',255,'2026-06-16 23:00:22'),(93,3,'Earthwork',255,'2026-06-16 23:00:22'),(94,4,'Electrical',255,'2026-06-16 23:00:22'),(95,4,'Earthwork',255,'2026-06-16 23:00:22'),(96,2,'Earthwork',255,'2026-06-16 23:15:22'),(97,3,'Earthwork',255,'2026-06-16 23:15:22'),(98,4,'Electrical',255,'2026-06-16 23:15:22'),(99,4,'Earthwork',255,'2026-06-16 23:15:22'),(100,2,'Earthwork',255,'2026-06-16 23:30:23'),(101,3,'Earthwork',255,'2026-06-16 23:30:23'),(102,4,'Electrical',255,'2026-06-16 23:30:23'),(103,4,'Earthwork',255,'2026-06-16 23:30:24'),(104,2,'Earthwork',255,'2026-06-16 23:45:24'),(105,3,'Earthwork',255,'2026-06-16 23:45:24'),(106,4,'Electrical',255,'2026-06-16 23:45:24'),(107,4,'Earthwork',255,'2026-06-16 23:45:24'),(108,2,'Earthwork',255,'2026-06-17 00:00:24'),(109,3,'Earthwork',255,'2026-06-17 00:00:24'),(110,4,'Electrical',255,'2026-06-17 00:00:24'),(111,4,'Earthwork',255,'2026-06-17 00:00:24'),(112,2,'Earthwork',255,'2026-06-17 00:15:24'),(113,3,'Earthwork',255,'2026-06-17 00:15:24'),(114,4,'Electrical',255,'2026-06-17 00:15:24'),(115,4,'Earthwork',255,'2026-06-17 00:15:24'),(116,2,'Earthwork',255,'2026-06-17 00:30:24'),(117,3,'Earthwork',255,'2026-06-17 00:30:24'),(118,4,'Electrical',255,'2026-06-17 00:30:24'),(119,4,'Earthwork',255,'2026-06-17 00:30:24'),(120,2,'Earthwork',255,'2026-06-17 00:45:24'),(121,3,'Earthwork',255,'2026-06-17 00:45:24'),(122,4,'Electrical',255,'2026-06-17 00:45:24'),(123,4,'Earthwork',255,'2026-06-17 00:45:24'),(124,2,'Earthwork',255,'2026-06-17 01:00:24'),(125,3,'Earthwork',255,'2026-06-17 01:00:24'),(126,4,'Electrical',255,'2026-06-17 01:00:24'),(127,4,'Earthwork',255,'2026-06-17 01:00:24'),(128,2,'Earthwork',255,'2026-06-17 12:14:21'),(129,3,'Earthwork',255,'2026-06-17 12:14:21'),(130,4,'Electrical',255,'2026-06-17 12:14:21'),(131,4,'Earthwork',255,'2026-06-17 12:14:21'),(132,2,'Earthwork',255,'2026-06-17 12:39:29'),(133,3,'Earthwork',255,'2026-06-17 12:39:29'),(134,4,'Electrical',255,'2026-06-17 12:39:29'),(135,4,'Earthwork',255,'2026-06-17 12:39:29'),(136,2,'Earthwork',255,'2026-06-17 12:48:47'),(137,3,'Earthwork',255,'2026-06-17 12:48:47'),(138,4,'Electrical',255,'2026-06-17 12:48:47'),(139,4,'Earthwork',255,'2026-06-17 12:48:47'),(140,2,'Earthwork',255,'2026-06-17 13:03:55'),(141,3,'Earthwork',255,'2026-06-17 13:03:55'),(142,4,'Electrical',255,'2026-06-17 13:03:55'),(143,4,'Earthwork',255,'2026-06-17 13:03:55'),(144,2,'Earthwork',255,'2026-06-17 13:07:07'),(145,3,'Earthwork',255,'2026-06-17 13:07:07'),(146,4,'Electrical',255,'2026-06-17 13:07:07'),(147,4,'Earthwork',255,'2026-06-17 13:07:07'),(148,2,'Earthwork',255,'2026-06-17 13:15:41'),(149,3,'Earthwork',255,'2026-06-17 13:15:41'),(150,4,'Electrical',255,'2026-06-17 13:15:41'),(151,4,'Earthwork',255,'2026-06-17 13:15:41'),(152,2,'Earthwork',255,'2026-06-17 13:21:47'),(153,3,'Earthwork',255,'2026-06-17 13:21:47'),(154,4,'Electrical',255,'2026-06-17 13:21:47'),(155,4,'Earthwork',255,'2026-06-17 13:21:47'),(156,2,'Earthwork',255,'2026-06-17 13:28:34'),(157,3,'Earthwork',255,'2026-06-17 13:28:34'),(158,4,'Electrical',255,'2026-06-17 13:28:35'),(159,4,'Earthwork',255,'2026-06-17 13:28:35'),(160,2,'Earthwork',255,'2026-06-17 13:35:03'),(161,3,'Earthwork',255,'2026-06-17 13:35:03'),(162,4,'Electrical',255,'2026-06-17 13:35:03'),(163,4,'Earthwork',255,'2026-06-17 13:35:03'),(164,2,'Earthwork',255,'2026-06-17 13:40:52'),(165,3,'Earthwork',255,'2026-06-17 13:40:52'),(166,4,'Electrical',255,'2026-06-17 13:40:52'),(167,4,'Earthwork',255,'2026-06-17 13:40:52'),(168,2,'Earthwork',255,'2026-06-17 13:43:09'),(169,3,'Earthwork',255,'2026-06-17 13:43:09'),(170,4,'Electrical',255,'2026-06-17 13:43:09'),(171,4,'Earthwork',255,'2026-06-17 13:43:09'),(172,2,'Earthwork',255,'2026-06-17 13:54:01'),(173,3,'Earthwork',255,'2026-06-17 13:54:01'),(174,4,'Electrical',255,'2026-06-17 13:54:01'),(175,4,'Earthwork',255,'2026-06-17 13:54:01'),(176,2,'Earthwork',255,'2026-06-17 13:59:56'),(177,3,'Earthwork',255,'2026-06-17 13:59:56'),(178,4,'Electrical',255,'2026-06-17 13:59:56'),(179,4,'Earthwork',255,'2026-06-17 13:59:56'),(180,2,'Earthwork',255,'2026-06-17 14:08:23'),(181,3,'Earthwork',255,'2026-06-17 14:08:23'),(182,4,'Electrical',255,'2026-06-17 14:08:24'),(183,4,'Earthwork',255,'2026-06-17 14:08:24'),(184,2,'Earthwork',255,'2026-06-17 14:23:23'),(185,3,'Earthwork',255,'2026-06-17 14:23:23'),(186,4,'Electrical',255,'2026-06-17 14:23:23'),(187,4,'Earthwork',255,'2026-06-17 14:23:23'),(188,2,'Earthwork',255,'2026-06-17 14:32:18'),(189,3,'Earthwork',255,'2026-06-17 14:32:18'),(190,4,'Electrical',255,'2026-06-17 14:32:18'),(191,4,'Earthwork',255,'2026-06-17 14:32:18'),(192,2,'Earthwork',255,'2026-06-17 14:44:28'),(193,3,'Earthwork',255,'2026-06-17 14:44:28'),(194,4,'Electrical',255,'2026-06-17 14:44:28'),(195,4,'Earthwork',255,'2026-06-17 14:44:28'),(196,2,'Earthwork',255,'2026-06-17 14:50:06'),(197,3,'Earthwork',255,'2026-06-17 14:50:06'),(198,4,'Electrical',255,'2026-06-17 14:50:06'),(199,4,'Earthwork',255,'2026-06-17 14:50:06'),(200,2,'Earthwork',255,'2026-06-17 14:57:50'),(201,3,'Earthwork',255,'2026-06-17 14:57:50'),(202,4,'Electrical',255,'2026-06-17 14:57:50'),(203,4,'Earthwork',255,'2026-06-17 14:57:50'),(204,2,'Earthwork',255,'2026-06-17 15:12:50'),(205,3,'Earthwork',255,'2026-06-17 15:12:50'),(206,4,'Electrical',255,'2026-06-17 15:12:50'),(207,4,'Earthwork',255,'2026-06-17 15:12:50'),(208,2,'Earthwork',255,'2026-06-17 15:17:56'),(209,3,'Earthwork',255,'2026-06-17 15:17:56'),(210,4,'Electrical',255,'2026-06-17 15:17:56'),(211,4,'Earthwork',255,'2026-06-17 15:17:56'),(212,2,'Earthwork',255,'2026-06-18 00:36:47'),(213,3,'Earthwork',255,'2026-06-18 00:36:47'),(214,4,'Electrical',255,'2026-06-18 00:36:47'),(215,4,'Earthwork',255,'2026-06-18 00:36:47'),(216,2,'Earthwork',255,'2026-06-18 00:51:47'),(217,3,'Earthwork',255,'2026-06-18 00:51:47'),(218,4,'Electrical',255,'2026-06-18 00:51:47'),(219,4,'Earthwork',255,'2026-06-18 00:51:47'),(220,2,'Earthwork',255,'2026-06-18 01:02:30'),(221,3,'Earthwork',255,'2026-06-18 01:02:30'),(222,4,'Electrical',255,'2026-06-18 01:02:30'),(223,4,'Earthwork',255,'2026-06-18 01:02:30'),(224,2,'Earthwork',255,'2026-06-18 01:17:30'),(225,3,'Earthwork',255,'2026-06-18 01:17:30'),(226,4,'Electrical',255,'2026-06-18 01:17:30'),(227,4,'Earthwork',255,'2026-06-18 01:17:30'),(228,2,'Earthwork',255,'2026-06-18 01:32:30'),(229,3,'Earthwork',255,'2026-06-18 01:32:30'),(230,4,'Electrical',255,'2026-06-18 01:32:30'),(231,4,'Earthwork',255,'2026-06-18 01:32:30'),(232,2,'Earthwork',255,'2026-06-18 01:47:30'),(233,3,'Earthwork',255,'2026-06-18 01:47:30'),(234,4,'Electrical',255,'2026-06-18 01:47:30'),(235,4,'Earthwork',255,'2026-06-18 01:47:30'),(236,2,'Earthwork',255,'2026-06-18 12:55:02'),(237,3,'Earthwork',255,'2026-06-18 12:55:02'),(238,4,'Electrical',255,'2026-06-18 12:55:02'),(239,4,'Earthwork',255,'2026-06-18 12:55:02'),(240,2,'Earthwork',255,'2026-06-18 13:06:47'),(241,3,'Earthwork',255,'2026-06-18 13:06:47'),(242,4,'Electrical',255,'2026-06-18 13:06:47'),(243,4,'Earthwork',255,'2026-06-18 13:06:47'),(244,2,'Earthwork',255,'2026-06-18 13:08:16'),(245,3,'Earthwork',255,'2026-06-18 13:08:16'),(246,4,'Electrical',255,'2026-06-18 13:08:16'),(247,4,'Earthwork',255,'2026-06-18 13:08:16'),(248,2,'Earthwork',255,'2026-06-18 13:23:16'),(249,3,'Earthwork',255,'2026-06-18 13:23:16'),(250,4,'Electrical',255,'2026-06-18 13:23:16'),(251,4,'Earthwork',255,'2026-06-18 13:23:16'),(252,2,'Earthwork',255,'2026-06-18 13:35:24'),(253,3,'Earthwork',255,'2026-06-18 13:35:24'),(254,4,'Electrical',255,'2026-06-18 13:35:24'),(255,4,'Earthwork',255,'2026-06-18 13:35:24'),(256,2,'Earthwork',255,'2026-06-18 13:50:24'),(257,3,'Earthwork',255,'2026-06-18 13:50:24'),(258,4,'Electrical',255,'2026-06-18 13:50:24'),(259,4,'Earthwork',255,'2026-06-18 13:50:24'),(260,2,'Earthwork',255,'2026-06-18 13:57:37'),(261,3,'Earthwork',255,'2026-06-18 13:57:37'),(262,4,'Electrical',255,'2026-06-18 13:57:37'),(263,4,'Earthwork',255,'2026-06-18 13:57:37'),(264,2,'Earthwork',255,'2026-06-18 14:12:37'),(265,3,'Earthwork',255,'2026-06-18 14:12:37'),(266,4,'Electrical',255,'2026-06-18 14:12:37'),(267,4,'Earthwork',255,'2026-06-18 14:12:37'),(268,2,'Earthwork',255,'2026-06-18 14:31:37'),(269,3,'Earthwork',255,'2026-06-18 14:31:37'),(270,4,'Electrical',255,'2026-06-18 14:31:37'),(271,4,'Earthwork',255,'2026-06-18 14:31:37'),(272,2,'Earthwork',255,'2026-06-18 14:47:15'),(273,3,'Earthwork',255,'2026-06-18 14:47:15'),(274,4,'Electrical',255,'2026-06-18 14:47:15'),(275,4,'Earthwork',255,'2026-06-18 14:47:15'),(276,2,'Earthwork',255,'2026-06-18 15:02:15'),(277,3,'Earthwork',255,'2026-06-18 15:02:15'),(278,4,'Electrical',255,'2026-06-18 15:02:15'),(279,4,'Earthwork',255,'2026-06-18 15:02:15'),(280,2,'Earthwork',255,'2026-06-18 15:17:15'),(281,3,'Earthwork',255,'2026-06-18 15:17:15'),(282,4,'Electrical',255,'2026-06-18 15:17:15'),(283,4,'Earthwork',255,'2026-06-18 15:17:15'),(284,2,'Earthwork',255,'2026-06-18 15:32:15'),(285,3,'Earthwork',255,'2026-06-18 15:32:15'),(286,4,'Electrical',255,'2026-06-18 15:32:15'),(287,4,'Earthwork',255,'2026-06-18 15:32:15'),(288,2,'Earthwork',255,'2026-06-18 15:47:15'),(289,3,'Earthwork',255,'2026-06-18 15:47:15'),(290,4,'Electrical',255,'2026-06-18 15:47:15'),(291,4,'Earthwork',255,'2026-06-18 15:47:15'),(292,2,'Earthwork',255,'2026-06-18 16:02:15'),(293,3,'Earthwork',255,'2026-06-18 16:02:15'),(294,4,'Electrical',255,'2026-06-18 16:02:15'),(295,4,'Earthwork',255,'2026-06-18 16:02:15'),(296,2,'Earthwork',255,'2026-06-18 16:36:44'),(297,3,'Earthwork',255,'2026-06-18 16:36:44'),(298,4,'Electrical',255,'2026-06-18 16:36:44'),(299,4,'Earthwork',255,'2026-06-18 16:36:45'),(300,2,'Earthwork',255,'2026-06-18 16:40:52'),(301,3,'Earthwork',255,'2026-06-18 16:40:52'),(302,4,'Electrical',255,'2026-06-18 16:40:53'),(303,4,'Earthwork',255,'2026-06-18 16:40:53'),(304,2,'Earthwork',255,'2026-06-18 16:55:52'),(305,3,'Earthwork',255,'2026-06-18 16:55:52'),(306,4,'Electrical',255,'2026-06-18 16:55:52'),(307,4,'Earthwork',255,'2026-06-18 16:55:52'),(308,2,'Earthwork',255,'2026-06-18 17:10:52'),(309,3,'Earthwork',255,'2026-06-18 17:10:53'),(310,4,'Electrical',255,'2026-06-18 17:10:53'),(311,4,'Earthwork',255,'2026-06-18 17:10:53'),(312,2,'Earthwork',255,'2026-06-18 17:25:53'),(313,3,'Earthwork',255,'2026-06-18 17:25:53'),(314,4,'Electrical',255,'2026-06-18 17:25:53'),(315,4,'Earthwork',255,'2026-06-18 17:25:53'),(316,2,'Earthwork',255,'2026-06-18 17:40:53'),(317,3,'Earthwork',255,'2026-06-18 17:40:53'),(318,4,'Electrical',255,'2026-06-18 17:40:53'),(319,4,'Earthwork',255,'2026-06-18 17:40:53');
/*!40000 ALTER TABLE `budget_threshold_alerts` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `change_notices`
--

LOCK TABLES `change_notices` WRITE;
/*!40000 ALTER TABLE `change_notices` DISABLE KEYS */;
INSERT INTO `change_notices` VALUES (2,1,'CN001','Column shift grid B','Shift columns along Grid B to accommodate larger production machinery layout.','site','A-101, A-102',1,3,3,'2026-06-16 15:49:53',0,NULL,0,NULL,NULL,NULL,'collecting_sigs',NULL,NULL,NULL,NULL),(3,1,'CN002','Air conditioning duct rerouting','Reroute central HVAC ducts to avoid conflicts with ceiling beams.','design','M-201',0,0,3,'2026-06-16 15:49:53',0,NULL,0,NULL,NULL,NULL,'collecting_sigs',NULL,NULL,NULL,NULL),(4,4,'CN003','Fa├ºade design change','Upgrade glazing specifications for better thermal performance.','client','WD-401',1,5,3,'2026-06-16 15:49:53',0,NULL,0,NULL,NULL,NULL,'collecting_sigs',NULL,NULL,NULL,NULL),(5,2,'CN-REV-01','Electrical conduit shift','Re-route main conduits to bypass lift shaft wall change.','site','DRW-ELEC-201',0,1,3,'2026-06-16 16:18:45',0,NULL,0,NULL,NULL,NULL,'collecting_sigs',NULL,NULL,NULL,NULL),(6,2,'CN-REV-02','HVAC Grill Layout change','Acoustic revisions to HVAC diffusers in boardroom.','design','DRW-HVAC-301',1,0,3,'2026-06-16 16:18:45',0,NULL,0,NULL,NULL,NULL,'collecting_sigs',NULL,NULL,NULL,NULL),(7,3,'CN-REV-01','Electrical conduit shift','Re-route main conduits to bypass lift shaft wall change.','site','DRW-ELEC-201',0,1,3,'2026-06-16 16:18:45',0,NULL,0,NULL,NULL,NULL,'collecting_sigs',NULL,NULL,NULL,NULL),(8,3,'CN-REV-02','HVAC Grill Layout change','Acoustic revisions to HVAC diffusers in boardroom.','design','DRW-HVAC-301',1,0,3,'2026-06-16 16:18:45',0,NULL,0,NULL,NULL,NULL,'collecting_sigs',NULL,NULL,NULL,NULL),(9,4,'CN-REV-01','Electrical conduit shift','Re-route main conduits to bypass lift shaft wall change.','site','DRW-ELEC-201',0,1,3,'2026-06-16 16:18:45',0,NULL,0,NULL,NULL,NULL,'collecting_sigs',NULL,NULL,NULL,NULL),(10,4,'CN-REV-02','HVAC Grill Layout change','Acoustic revisions to HVAC diffusers in boardroom.','design','DRW-HVAC-301',1,0,3,'2026-06-16 16:18:45',0,NULL,0,NULL,NULL,NULL,'collecting_sigs',NULL,NULL,NULL,NULL),(11,2,'CN003','Hello','I dont know','client','DRW-ELEC-201',0,3,17,'2026-06-18 01:55:27',0,NULL,0,NULL,NULL,NULL,'collecting_sigs',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `change_notices` ENABLE KEYS */;
UNLOCK TABLES;

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
  `claimed_qty` decimal(12,3) NOT NULL DEFAULT '0.000',
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
  `quantity` decimal(12,3) NOT NULL DEFAULT '0.000',
  `client_rate` decimal(12,4) NOT NULL DEFAULT '0.0000',
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
-- Dumping data for table `client_boq_items`
--

LOCK TABLES `client_boq_items` WRITE;
/*!40000 ALTER TABLE `client_boq_items` DISABLE KEYS */;
INSERT INTO `client_boq_items` VALUES (1,1,1,'civil','Earthwork','BOQ-CIV-01','Excavation in all soils up to 1.5m depth','Cum',500.000,350.0000,1,NULL,1),(2,1,1,'civil','Concrete','BOQ-CIV-02','Providing and laying M25 grade concrete','Cum',120.000,5600.0000,2,NULL,1),(3,1,1,'services','Electrical','BOQ-ELE-01','Supplying and laying 3C x 4 sqmm XLPE Armoured copper cable','Mtr',1200.000,280.0000,3,NULL,1),(4,1,1,'services','HVAC','BOQ-MEC-01','Supplying 2.0 TR VRF high-wall indoor unit','Nos',15.000,32000.0000,4,NULL,1),(5,2,2,'civil','Earthwork','BOQ-CIV-01','Excavation in all soils up to 1.5m depth','Cum',500.000,350.0000,1,NULL,1),(6,2,2,'civil','Concrete','BOQ-CIV-02','Providing and laying M25 grade concrete','Cum',120.000,5600.0000,2,NULL,1),(7,2,2,'services','Electrical','BOQ-ELE-01','Supplying and laying 3C x 4 sqmm XLPE Armoured copper cable','Mtr',1200.000,280.0000,3,NULL,1),(8,2,2,'services','HVAC','BOQ-MEC-01','Supplying 2.0 TR VRF high-wall indoor unit','Nos',15.000,32000.0000,4,NULL,1),(9,3,3,'civil','Earthwork','BOQ-CIV-01','Excavation in all soils up to 1.5m depth','Cum',500.000,350.0000,1,NULL,1),(10,3,3,'civil','Concrete','BOQ-CIV-02','Providing and laying M25 grade concrete','Cum',120.000,5600.0000,2,NULL,1),(11,3,3,'services','Electrical','BOQ-ELE-01','Supplying and laying 3C x 4 sqmm XLPE Armoured copper cable','Mtr',1200.000,280.0000,3,NULL,1),(12,3,3,'services','HVAC','BOQ-MEC-01','Supplying 2.0 TR VRF high-wall indoor unit','Nos',15.000,32000.0000,4,NULL,1),(13,4,4,'civil','Earthwork','BOQ-CIV-01','Excavation in all soils up to 1.5m depth','Cum',500.000,350.0000,1,NULL,1),(14,4,4,'civil','Concrete','BOQ-CIV-02','Providing and laying M25 grade concrete','Cum',120.000,5600.0000,2,NULL,1),(15,4,4,'services','Electrical','BOQ-ELE-01','Supplying and laying 3C x 4 sqmm XLPE Armoured copper cable','Mtr',1200.000,280.0000,3,NULL,1),(16,4,4,'services','HVAC','BOQ-MEC-01','Supplying 2.0 TR VRF high-wall indoor unit','Nos',15.000,32000.0000,4,NULL,1);
/*!40000 ALTER TABLE `client_boq_items` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `client_boq_versions`
--

LOCK TABLES `client_boq_versions` WRITE;
/*!40000 ALTER TABLE `client_boq_versions` DISABLE KEYS */;
INSERT INTO `client_boq_versions` VALUES (1,1,'all',1,'V1',NULL,1,1,'2026-06-16 15:49:53'),(2,2,'all',1,'V1',NULL,1,1,'2026-06-16 15:49:53'),(3,3,'all',1,'V1',NULL,1,1,'2026-06-16 15:49:53'),(4,4,'all',1,'V1',NULL,1,1,'2026-06-16 15:49:53');
/*!40000 ALTER TABLE `client_boq_versions` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=267 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_errors`
--

LOCK TABLES `client_errors` WRITE;
/*!40000 ALTER TABLE `client_errors` DISABLE KEYS */;
INSERT INTO `client_errors` VALUES (1,39,'principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:09:37'),(2,39,'principal','Dev Tester','GET','/api/payment-requests/1/weekly-batch',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:09:56'),(3,39,'design_principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:13:29'),(4,39,'design_principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:13:29'),(5,39,'design_principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:13:30'),(6,39,'design_principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:13:30'),(7,39,'design_principal','Dev Tester','GET','/api/users/me',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:13:31'),(8,39,'design_principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:31:09'),(9,39,'design_principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:31:09'),(10,39,'design_principal','Dev Tester','GET','/api/projects/1',500,'ER_NO_SUCH_USER','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_USER\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:31:32'),(11,39,'design_principal','Dev Tester','GET','/api/payment-requests/1/weekly-batch',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:32:03'),(12,39,'design_principal','Dev Tester','GET','/api/payment-requests/1/weekly-batch',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:35:29'),(13,39,'design_principal','Dev Tester','GET','/api/projects/1',500,'ER_NO_SUCH_USER','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_USER\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:36:18'),(14,39,'jr_architect','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:53:03'),(15,39,'jr_architect','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 15:53:03'),(16,17,'principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 16:19:44'),(17,17,'principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 16:19:44'),(18,17,'principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 16:19:45'),(19,17,'principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 16:49:25'),(20,17,'principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 16:49:25'),(21,17,'principal','Dev Tester','GET','/api/payment-requests/1/weekly-batch',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 16:49:31'),(22,17,'principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 17:14:41'),(23,17,'principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 17:14:41'),(24,17,'principal','Dev Tester','GET','/api/payment-requests/2/weekly-batch',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 17:15:37'),(25,17,'design_principal','Dev Tester','GET','/api/payment-requests/2/weekly-batch',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 17:17:09'),(26,17,'design_principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 17:59:25'),(27,17,'design_principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 17:59:25'),(28,17,'design_principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 17:59:27'),(29,17,'design_principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 17:59:27'),(30,17,'design_principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 19:48:24'),(31,17,'design_principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 19:48:24'),(32,17,'design_principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 19:53:01'),(33,17,'design_principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 19:53:01'),(34,17,'design_principal','Dev Tester','GET','/api/payment-requests/2/weekly-batch',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 19:53:05'),(35,17,'design_principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 19:57:41'),(36,17,'design_principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 19:57:41'),(37,17,'design_principal','Dev Tester','GET','/api/payment-requests/2/weekly-batch',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 19:57:55'),(38,17,'jr_engineer','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:11:59'),(39,17,'jr_engineer','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:11:59'),(40,17,'jr_engineer','Dev Tester','GET','/api/submittals/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:12:19'),(41,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:15:01'),(42,17,'pmc_head','Dev Tester','GET','/api/labour/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:15:22'),(43,17,'pmc_head','Dev Tester','GET','/api/grn/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:15:26'),(44,17,'pmc_head','Dev Tester','GET','/api/grn/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:16:15'),(45,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:16:35'),(46,17,'pmc_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:16:58'),(47,17,'pmc_head','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:16:58'),(48,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:16:59'),(49,17,'pmc_head','Dev Tester','GET','/api/labour/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:17:50'),(50,17,'pmc_head','Dev Tester','GET','/api/grn/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:18:04'),(51,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:18:08'),(52,17,'services_engineer','Dev Tester','GET','/api/submittals/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:18:18'),(53,17,'services_engineer','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:23:18'),(54,17,'services_engineer','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:23:18'),(55,17,'services_engineer','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:23:38'),(56,17,'senior_site_manager','Dev Tester','GET','/api/grn/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:25:55'),(57,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-16&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:26:18'),(58,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-16&types=project_progress',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:26:20'),(59,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-16&types=issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:26:21'),(60,17,'senior_site_manager','Dev Tester','GET','/api/labour/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:26:25'),(61,17,'senior_site_manager','Dev Tester','GET','/api/grn/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:26:30'),(62,17,'coordinator','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:46:41'),(63,17,'senior_site_manager','Dev Tester','GET','/api/grn/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:46:47'),(64,17,'principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:47:13'),(65,17,'principal','Dev Tester','GET','/api/payment-requests/2/weekly-batch',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:47:14'),(66,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:47:27'),(67,17,'pmc_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:47:44'),(68,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:47:44'),(69,17,'pmc_head','Dev Tester','GET','/api/labour/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:47:52'),(70,17,'pmc_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:51:59'),(71,17,'pmc_head','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:51:59'),(72,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:51:59'),(73,17,'pmc_head','Dev Tester','GET','/api/labour/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:52:10'),(74,17,'pmc_head','Dev Tester','GET','/api/grn/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:52:11'),(75,17,'pmc_head','Dev Tester','GET','/api/payment-requests/2/weekly-batch',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:52:13'),(76,17,'pmc_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:52:32'),(77,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:52:32'),(78,17,'pmc_head','Dev Tester','GET','/api/grn/2',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:52:33'),(79,17,'pmc_head','Dev Tester','GET','/api/payment-requests/2/weekly-batch',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:52:34'),(80,17,'pmc_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:54:51'),(81,17,'pmc_head','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:54:51'),(82,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:54:52'),(83,17,'pmc_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:54:53'),(84,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 20:54:53'),(85,17,'services_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 21:06:49'),(86,17,'services_head','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 21:06:49'),(87,17,'services_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 21:41:29'),(88,17,'services_head','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 21:41:29'),(89,17,'services_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 21:49:29'),(90,17,'services_head','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 21:49:29'),(91,17,'services_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 21:49:29'),(92,17,'services_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 21:57:41'),(93,17,'services_head','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 21:57:41'),(94,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-16&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 21:58:06'),(95,17,'finance_admin','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 22:00:47'),(96,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-16&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 22:00:55'),(97,17,'senior_site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 22:06:29'),(98,17,'principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 22:14:12'),(99,17,'principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 22:14:12'),(100,17,'principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 22:14:13'),(101,17,'senior_site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-16 22:14:18'),(102,17,'site_manager','Dev Tester','GET','/api/schedule/2/lookahead/workspace?_cb=1781680153450',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:39:13'),(103,17,'site_manager','Dev Tester','GET','/api/schedule/2/lookahead/workspace?_cb=1781680161159',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:39:21'),(104,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:39:25'),(105,17,'site_manager','Dev Tester','GET','/api/schedule/2/lookahead/workspace?_cb=1781680169442',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:39:29'),(106,17,'site_manager','Dev Tester','GET','/api/schedule/2/lookahead/workspace?_cb=1781680224538',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:40:24'),(107,17,'site_manager','Dev Tester','GET','/api/schedule/2/lookahead/workspace?_cb=1781680227348',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:40:27'),(108,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:40:28'),(109,17,'site_manager','Dev Tester','POST','/api/photos/2/upload',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:40:51'),(110,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:40:57'),(111,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:40:58'),(112,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:40:58'),(113,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:42:37'),(114,17,'site_manager','Dev Tester','GET','/api/schedule/2/lookahead/workspace?_cb=1781680363799',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:42:43'),(115,17,'site_manager','Dev Tester','GET','/api/schedule/2/lookahead/workspace?_cb=1781680500007',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:45:00'),(116,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:45:03'),(117,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:45:39'),(118,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:45:41'),(119,17,'site_manager','Dev Tester','POST','/api/photos/2/upload',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:45:55'),(120,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:46:00'),(121,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:48:18'),(122,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:48:20'),(123,17,'site_manager','Dev Tester','POST','/api/photos/2/upload',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:48:30'),(124,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:48:34'),(125,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:48:39'),(126,17,'jr_architect','Dev Tester','POST','/api/drawings/2/upload',400,NULL,'{\"error\":\"drawing_not_on_register\",\"message\":\"Drawing \\\"D-102\\\" is not on the approved drawing register for this project.\\n\\nOnly drawings pre-registered by Design Head (PMC Head) or Services Head (Services Head) at project initiation can be uploaded as main drawings.\\n\\nIf this is a detail drawing, upload it under \\\"Detail Drawing\\\" instead. If it is a response to an RFI, use the RFI reply flow.\\n\\nIf it should be on the register, ask PMC Head or Services Head to add it first.\",\"hint\":{\"stream\":\"design\",\"valid_drawing_numbers_on_register\":[\"DRW-ARCH-001\",\"DRW-ARCH-002\",\"DRW-STR-101\"]}}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:49:19'),(127,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:51:26'),(128,17,'pmc_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:51:35'),(129,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:51:35'),(130,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:52:05'),(131,17,'jr_engineer','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:54:40'),(132,17,'jr_engineer','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:54:40'),(133,17,'site_manager','Dev Tester','GET','/api/schedule/2/lookahead/workspace?_cb=1781681091763',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:54:51'),(134,17,'site_manager','Dev Tester','GET','/api/schedule/2/lookahead/workspace?_cb=1781681094361',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:54:54'),(135,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:54:54'),(136,17,'site_manager','Dev Tester','POST','/api/photos/2/upload',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 12:55:02'),(137,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:02:27'),(138,17,'design_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:03:27'),(139,17,'design_head','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:03:27'),(140,17,'design_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:06:39'),(141,17,'design_head','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:06:39'),(142,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:06:46'),(143,17,'site_manager','Dev Tester','POST','/api/photos/2/upload',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:06:56'),(144,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:07:01'),(145,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:07:04'),(146,17,'site_manager','Dev Tester','POST','/api/photos/2/upload',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:07:11'),(147,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:15:12'),(148,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:15:18'),(149,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:15:30'),(150,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:15:34'),(151,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:15:44'),(152,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=issue',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:15:45'),(153,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:16:46'),(154,17,'senior_site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:24:00'),(155,17,'senior_site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:28:19'),(156,17,'senior_site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:28:44'),(157,17,'senior_site_manager','Dev Tester','GET','/api/materials/2/boq/versions',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:32:51'),(158,17,'senior_site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:34:36'),(159,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:34:40'),(160,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:34:48'),(161,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:34:48'),(162,17,'senior_site_manager','Dev Tester','POST','/api/photos/2/upload',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:34:55'),(163,17,'senior_site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:35:01'),(164,17,'senior_site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:35:03'),(165,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:35:07'),(166,17,'senior_site_manager','Dev Tester','POST','/api/photos/2/upload',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:35:25'),(167,17,'senior_site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:36:25'),(168,17,'senior_site_manager','Dev Tester','POST','/api/grn/2',400,NULL,'{\"error\":\"Invalid input\",\"issues\":[{\"field\":\"engagement_id\",\"message\":\"Expected number, received nan\"},{\"field\":\"description\",\"message\":\"Required\"}]}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:36:55'),(169,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:37:44'),(170,17,'pmc_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:38:52'),(171,17,'pmc_head','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:38:52'),(172,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:38:52'),(173,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:39:32'),(174,17,'pmc_head','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:40:24'),(175,17,'pmc_head','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:40:24'),(176,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:40:24'),(177,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:40:30'),(178,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:40:43'),(179,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:40:46'),(180,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:40:47'),(181,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:40:48'),(182,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:42:42'),(183,17,'site_manager','Dev Tester','POST','/api/grn/2',500,NULL,'{\"error\":\"Failed to create GRN\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:43:03'),(184,17,'site_manager','Dev Tester','POST','/api/grn/2',500,NULL,'{\"error\":\"Failed to create GRN\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:44:49'),(185,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:53:23'),(186,17,'site_manager','Dev Tester','POST','/api/grn/2',500,NULL,'{\"error\":\"Failed to create GRN: eng is not defined\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:53:45'),(187,17,'site_manager','Dev Tester','POST','/api/grn/2',500,NULL,'{\"error\":\"Failed to create GRN: eng is not defined\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:56:39'),(188,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:58:02'),(189,17,'services_engineer','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:59:21'),(190,17,'services_engineer','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:59:21'),(191,17,'site_manager','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 13:59:51'),(192,17,'principal','Dev Tester','GET','/api/ai-settings',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:01:27'),(193,17,'principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:01:30'),(194,17,'principal','Dev Tester','GET','/api/ai-settings/enabled',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:01:30'),(195,17,'principal','Dev Tester','GET','/api/ai-settings',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:01:32'),(196,17,'principal','Dev Tester','GET','/api/ai/settings/active',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:02:00'),(197,17,'principal','Dev Tester','GET','/api/ai-settings',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:04:31'),(198,17,'finance_admin','Dev Tester','POST','/api/payments/pre-upload-check',403,'INSUFFICIENT_PERMISSIONS','{\"error\":\"Not authorised\",\"code\":\"INSUFFICIENT_PERMISSIONS\",\"action\":\"finance.payment.pre-upload-check\",\"role\":\"finance_admin\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:14:51'),(199,17,'finance_admin','Dev Tester','POST','/api/vendors/master',400,NULL,'{\"error\":\"Invalid input\",\"issues\":[{\"field\":\"gst_number\",\"message\":\"Invalid GSTIN format\"},{\"field\":\"bank_ifsc\",\"message\":\"Invalid IFSC\"}]}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:17:57'),(200,17,'finance_admin','Dev Tester','GET','/api/client-boq/2',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:19:35'),(201,17,'finance_admin','Dev Tester','GET','/api/clients',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:19:36'),(202,17,'finance_admin','Dev Tester','GET','/api/clients/incomplete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:19:36'),(203,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:20:53'),(204,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:21:05'),(205,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:22:55'),(206,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/19/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:23:21'),(207,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/13/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:23:25'),(208,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/14/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:23:27'),(209,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/15/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:23:28'),(210,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/16/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:23:29'),(211,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/18/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:23:31'),(212,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/20/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:23:32'),(213,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/17/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:25:26'),(214,17,'services_engineer','Dev Tester','POST','/api/drawings/2/upload',400,NULL,'{\"error\":\"register_mismatch\",\"message\":\"Drawing \\\"DRW-STR-101\\\" is on the register under category \\\"Structural\\\" (design stream) ΓÇö but you submitted it as \\\"Fire\\\" (services stream). Fix the category to match, or ask the Design/Services Head to amend the register.\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:26:49'),(215,17,'services_engineer','Dev Tester','POST','/api/drawings/2/upload',400,NULL,'{\"error\":\"register_mismatch\",\"message\":\"Drawing \\\"DRW-PLUMB-401\\\" is on the register under category \\\"Plumbing\\\" (services stream) ΓÇö but you submitted it as \\\"Fire\\\" (services stream). Fix the category to match, or ask the Design/Services Head to amend the register.\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:28:04'),(216,17,'services_head','Dev Tester','POST','/api/register/2/add',400,NULL,'{\"error\":\"Invalid input\",\"issues\":[{\"field\":\"expected_revision\",\"message\":\"String must contain at least 1 character(s)\"}]}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:28:49'),(217,17,'services_head','Dev Tester','POST','/api/register/2/add',400,NULL,'{\"error\":\"Invalid input\",\"issues\":[{\"field\":\"expected_revision\",\"message\":\"String must contain at least 1 character(s)\"}]}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:29:25'),(218,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:31:57'),(219,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:32:09'),(220,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/13/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:34:05'),(221,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:43:17'),(222,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:44:13'),(223,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:44:27'),(224,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/13/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:50:40'),(225,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/14/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:50:41'),(226,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/15/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:50:42'),(227,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/10/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:50:45'),(228,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/14/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 14:51:25'),(229,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/13/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 15:03:59'),(230,17,'senior_site_manager','Dev Tester','PATCH','/api/grn/16/reject',403,NULL,'{\"error\":\"PMC access required\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 15:13:51'),(231,17,'senior_site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 15:17:41'),(232,17,'senior_site_manager','Dev Tester','POST','/api/photos/2/upload',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 15:17:57'),(233,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-17&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-17 15:20:05'),(234,17,'finance_admin','Dev Tester','POST','/api/finance/2/client-receipts',400,NULL,'{\"error\":\"Invalid input\",\"issues\":[{\"field\":\"pi_id\",\"message\":\"Expected number, received nan\"},{\"field\":\"amount_received\",\"message\":\"Required\"}]}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 00:39:08'),(235,17,'finance_admin','Dev Tester','GET','/api/client-boq/2',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 00:41:41'),(236,17,'finance_admin','Dev Tester','GET','/api/clients',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 00:41:43'),(237,17,'finance_admin','Dev Tester','GET','/api/clients/incomplete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 00:41:43'),(238,17,'finance_admin','Dev Tester','GET','/api/client-boq/2',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 00:43:32'),(239,17,'finance_admin','Dev Tester','GET','/api/client-boq/1',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 00:43:54'),(240,17,'finance_admin','Dev Tester','GET','/api/clients',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 00:48:42'),(241,17,'finance_admin','Dev Tester','GET','/api/clients/incomplete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 00:48:42'),(242,17,'finance_admin','Dev Tester','GET','/api/client-boq/1',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 00:48:43'),(243,17,'senior_site_manager','Dev Tester','GET','/api/schedule/1/lookahead/workspace?_cb=1781723961465',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 00:49:21'),(244,17,'senior_site_manager','Dev Tester','POST','/api/issues/rfi/2',400,NULL,'{\"error\":\"Invalid input\",\"issues\":[{\"field\":\"drawing_version_id\",\"message\":\"Expected number, received nan\"},{\"field\":\"question\",\"message\":\"Required\"}]}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 00:59:12'),(245,17,'senior_site_manager','Dev Tester','POST','/api/issues/rfi/2',400,NULL,'{\"error\":\"Invalid input\",\"issues\":[{\"field\":\"drawing_version_id\",\"message\":\"Expected number, received nan\"},{\"field\":\"question\",\"message\":\"Required\"}]}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 01:01:48'),(246,17,'senior_site_manager','Dev Tester','POST','/api/issues/rfi/17/assign',403,NULL,'{\"error\":\"Not authorised to assign RFIs\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 01:02:20'),(247,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 01:07:28'),(248,17,'pmc_head','Dev Tester','PATCH','/api/materials/requests/1/status',400,'INVALID_STATE_TRANSITION','{\"error\":\"material_request: cannot go from \\\"1\\\" to \\\"4\\\". Allowed: 2\",\"code\":\"INVALID_STATE_TRANSITION\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 01:08:17'),(249,17,'pmc_head','Dev Tester','PATCH','/api/materials/requests/2/status',400,'INVALID_STATE_TRANSITION','{\"error\":\"material_request: cannot go from \\\"3\\\" to \\\"5\\\". Allowed: 4\",\"code\":\"INVALID_STATE_TRANSITION\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 01:08:31'),(250,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 13:38:16'),(251,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 13:41:44'),(252,17,'pmc_head','Dev Tester','PATCH','/api/meetings/action-items/6/complete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 13:41:52'),(253,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 13:50:26'),(254,17,'pmc_head','Dev Tester','PATCH','/api/meetings/action-items/6/complete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 13:50:31'),(255,17,'pmc_head','Dev Tester','PATCH','/api/meetings/action-items/5/complete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 13:50:44'),(256,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 13:56:56'),(257,17,'pmc_head','Dev Tester','PATCH','/api/meetings/action-items/6/complete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 13:57:00'),(258,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 13:57:07'),(259,17,'pmc_head','Dev Tester','GET','/api/dashboard/morning-brief',403,NULL,'{\"error\":\"Principals only\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 13:57:08'),(260,17,'pmc_head','Dev Tester','PATCH','/api/meetings/action-items/6/complete',400,'INVALID_STATE_TRANSITION','{\"error\":\"meeting_action: cannot go from \\\"completed\\\" to \\\"completed\\\". Allowed: (terminal)\",\"code\":\"INVALID_STATE_TRANSITION\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 13:57:17'),(261,17,'pmc_head','Dev Tester','PATCH','/api/meetings/action-items/5/complete',400,'INVALID_STATE_TRANSITION','{\"error\":\"meeting_action: cannot go from \\\"pending\\\" to \\\"completed\\\". Allowed: acknowledged, overdue\",\"code\":\"INVALID_STATE_TRANSITION\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 13:57:20'),(262,17,'principal','Dev Tester','GET','/api/clients',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 14:05:49'),(263,17,'senior_site_manager','Dev Tester','GET','/api/schedule/1/lookahead/workspace?_cb=1781774899778',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 14:58:19'),(264,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-18&types=project_progress,issue',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 16:36:46'),(265,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-18&types=project_progress,issue',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 16:36:52'),(266,17,'site_manager','Dev Tester','GET','/api/photos/2?date=2026-06-18&types=issue',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-18 16:36:53');
/*!40000 ALTER TABLE `client_errors` ENABLE KEYS */;
UNLOCK TABLES;

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
  `amount_received` decimal(14,2) NOT NULL,
  `tds_deducted` decimal(14,2) NOT NULL DEFAULT '0.00',
  `net_received` decimal(14,2) NOT NULL,
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
-- Dumping data for table `clients`
--

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
INSERT INTO `clients` VALUES (1,'Sterling Developers Ltd','Sterling','29STDE1234F1Z1','ASTDE1234F','Karnataka',29,NULL,NULL,NULL,NULL,NULL,'regular',NULL,'Construction Works Income','NUALL/26-27/',0,30,NULL,0,1,1,NULL,NULL,NULL,1,'2026-06-16 15:49:43','2026-06-16 15:49:43'),(2,'Test Client',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'regular',NULL,'Construction Works Income','NUALL/26-27/',0,30,NULL,0,1,0,'auto-created from project PV91',NULL,NULL,17,'2026-06-18 14:06:31','2026-06-18 14:06:31');
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `company_entities`
--

LOCK TABLES `company_entities` WRITE;
/*!40000 ALTER TABLE `company_entities` DISABLE KEYS */;
INSERT INTO `company_entities` VALUES (1,'PROP','NU ASSOCIATES','No.940, Shantha Complex, 1st Floor, 20th Main Road, Banashankari Stage 2, Bengaluru 560070',NULL,'Bengaluru','Karnataka','560070','29AHSPB4003H1ZH','29','naveen@nuassociates.com','finance@nuassociates.com','9886050673','998311','ICICI Bank','233705001068','ICIC0002337','NU ASSOCIATES','Banashankari, Bengaluru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:16'),(2,'LLP','NU ASSOCIATES LLP','1st Floor, No.940, Shantha Complex, 20th Main Road, Banashankari Stage 2, Bengaluru 560070',NULL,'Bengaluru','Karnataka','560070','29AAVFN2055K1ZM','29','naveen@nuassociates.com','finance@nuassociates.com','9886050673','998311','ICICI Bank','233705000984','ICIC0002337','NU ASSOCIATES LLP','Banashankari, Bengaluru','nuassociatesllp.ibz@icici',NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:16');
/*!40000 ALTER TABLE `company_entities` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `daily_reports`
--

LOCK TABLES `daily_reports` WRITE;
/*!40000 ALTER TABLE `daily_reports` DISABLE KEYS */;
INSERT INTO `daily_reports` VALUES (1,1,'2026-04-21',1,'app',NULL,'Foundation work progressing on schedule. Cement delivery slightly delayed (~2hrs). 12 skilled + 18 unskilled on site.','2026-04-22 17:25:19',NULL,NULL,0,NULL,'approved',1,'2026-04-22 17:25:19',NULL,NULL,NULL),(2,1,'2026-04-22',1,'app',NULL,'Column formwork for Grid A complete. Electrical team mobilised for conduit install. 14 skilled + 20 unskilled on site.','2026-04-22 17:25:19',NULL,NULL,0,NULL,'pending_review',NULL,NULL,NULL,NULL,NULL),(3,2,'2026-06-15',7,'app',NULL,'Completed Column casting of 4 columns on Grid A.','2026-06-16 15:20:45',NULL,NULL,0,NULL,'pending_review',NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `daily_reports` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `delegations`
--

LOCK TABLES `delegations` WRITE;
/*!40000 ALTER TABLE `delegations` DISABLE KEYS */;
INSERT INTO `delegations` VALUES (1,3,1,1,'full','2026-06-15 15:49:53','2026-06-26 15:49:53',1,NULL,NULL,NULL,1,'2026-06-16 15:49:53'),(2,1,2,NULL,'full','2026-06-15 15:49:53',NULL,1,NULL,NULL,NULL,1,'2026-06-16 15:49:53'),(3,17,2,5,'full','2026-06-18 13:05:39','2027-02-14 00:00:00',0,'2026-06-18 13:05:54',17,NULL,17,'2026-06-18 13:05:39');
/*!40000 ALTER TABLE `delegations` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `document_attachments`
--

LOCK TABLES `document_attachments` WRITE;
/*!40000 ALTER TABLE `document_attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `document_attachments` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `drawing_register`
--

LOCK TABLES `drawing_register` WRITE;
/*!40000 ALTER TABLE `drawing_register` DISABLE KEYS */;
INSERT INTO `drawing_register` VALUES (6,1,'DRW-ARCH-001','Architectural Layout Plan','Architectural','design','R0',NULL,'issued',3,'2026-06-16 16:18:45',1,NULL),(7,1,'DRW-ARCH-002','Section Details Ground Floor','Architectural','design','R1',NULL,'in_progress',3,'2026-06-16 16:18:45',NULL,NULL),(8,1,'DRW-STR-101','Foundation Details','Structural','design','R0',NULL,'pending',3,'2026-06-16 16:18:45',NULL,NULL),(9,1,'DRW-ELEC-201','Power Layout & Conduit Routing','Electrical','services','R0',NULL,'issued',3,'2026-06-16 16:18:45',1,NULL),(10,1,'DRW-HVAC-301','Ducting Routing Diagram','HVAC','services','R1',NULL,'in_progress',3,'2026-06-16 16:18:45',NULL,NULL),(11,1,'DRW-PLUMB-401','Water Supply & Plumbing layout','Plumbing','services','R0',NULL,'pending',3,'2026-06-16 16:18:45',NULL,NULL),(12,2,'DRW-ARCH-001','Architectural Layout Plan','Architectural','design','R0',NULL,'issued',3,'2026-06-16 16:18:45',1,NULL),(13,2,'DRW-ARCH-002','Section Details Ground Floor','Architectural','design','R1',NULL,'in_progress',3,'2026-06-16 16:18:45',NULL,NULL),(14,2,'DRW-STR-101','Foundation Details','Structural','design','R0',NULL,'in_progress',3,'2026-06-16 16:18:45',NULL,NULL),(15,2,'DRW-ELEC-201','Power Layout & Conduit Routing','Electrical','services','R0',NULL,'issued',3,'2026-06-16 16:18:45',1,NULL),(16,2,'DRW-HVAC-301','Ducting Routing Diagram','HVAC','services','R1',NULL,'in_progress',3,'2026-06-16 16:18:45',NULL,NULL),(17,2,'DRW-PLUMB-401','Water Supply & Plumbing layout','Plumbing','services','R0',NULL,'pending',3,'2026-06-16 16:18:45',NULL,NULL),(18,3,'DRW-ARCH-001','Architectural Layout Plan','Architectural','design','R0',NULL,'issued',3,'2026-06-16 16:18:45',1,NULL),(19,3,'DRW-ARCH-002','Section Details Ground Floor','Architectural','design','R1',NULL,'in_progress',3,'2026-06-16 16:18:45',NULL,NULL),(20,3,'DRW-STR-101','Foundation Details','Structural','design','R0',NULL,'pending',3,'2026-06-16 16:18:45',NULL,NULL),(21,3,'DRW-ELEC-201','Power Layout & Conduit Routing','Electrical','services','R0',NULL,'issued',3,'2026-06-16 16:18:45',1,NULL),(22,3,'DRW-HVAC-301','Ducting Routing Diagram','HVAC','services','R1',NULL,'in_progress',3,'2026-06-16 16:18:45',NULL,NULL),(23,3,'DRW-PLUMB-401','Water Supply & Plumbing layout','Plumbing','services','R0',NULL,'pending',3,'2026-06-16 16:18:45',NULL,NULL),(24,4,'DRW-ARCH-001','Architectural Layout Plan','Architectural','design','R0',NULL,'issued',3,'2026-06-16 16:18:45',1,NULL),(25,4,'DRW-ARCH-002','Section Details Ground Floor','Architectural','design','R1',NULL,'in_progress',3,'2026-06-16 16:18:45',NULL,NULL),(26,4,'DRW-STR-101','Foundation Details','Structural','design','R0',NULL,'pending',3,'2026-06-16 16:18:45',NULL,NULL),(27,4,'DRW-ELEC-201','Power Layout & Conduit Routing','Electrical','services','R0',NULL,'issued',3,'2026-06-16 16:18:45',1,NULL),(28,4,'DRW-HVAC-301','Ducting Routing Diagram','HVAC','services','R1',NULL,'in_progress',3,'2026-06-16 16:18:45',NULL,NULL),(29,4,'DRW-PLUMB-401','Water Supply & Plumbing layout','Plumbing','services','R0',NULL,'pending',3,'2026-06-16 16:18:45',NULL,NULL),(30,2,'DRW-HVAC-401','Power Layout Diagram','IT','services','R0',NULL,'issued',17,'2026-06-17 14:29:33',NULL,NULL);
/*!40000 ALTER TABLE `drawing_register` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `drawing_versions`
--

LOCK TABLES `drawing_versions` WRITE;
/*!40000 ALTER TABLE `drawing_versions` DISABLE KEYS */;
INSERT INTO `drawing_versions` VALUES (1,1,'R0',0,'/uploads/pv90/A-101_R0.pdf',820,NULL,NULL,1,'pending_l2',NULL,'2026-06-16 15:09:59','Auto-escalated after 2 days',NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,NULL,1,'2026-04-22 17:25:19'),(2,2,'R0',0,'/uploads/pv90/A-102_R0.pdf',940,NULL,NULL,1,'pending_l2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,NULL,1,'2026-04-22 17:25:19'),(3,3,'R0',0,'/uploads/pv90/E-301_R0.pdf',680,NULL,NULL,1,'issued',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,NULL,1,'2026-04-22 17:25:19'),(4,4,'R0',0,'uploads/drawings/DEMO-DRW-001_R0.pdf',1240,'Initial release for testing',NULL,1,'pending_l2',NULL,'2026-06-18 00:36:47','Auto-escalated after 2 days',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,0,NULL,NULL,4,'2026-06-16 15:17:30'),(5,5,'R0',0,'uploads/drawings/DEMO-DRW-002_R0.pdf',1240,'Initial release for testing',NULL,1,'issued',3,'2026-06-16 15:17:30',NULL,3,'2026-06-16 15:17:30',NULL,'2026-06-16 15:17:30',1,NULL,NULL,NULL,0,NULL,NULL,4,'2026-06-16 15:17:30'),(6,6,'R0',0,'uploads/drawings/ind-arch-001.pdf',1850,'Auto-seeded for testing',NULL,1,'pending_l2',NULL,'2026-06-18 00:36:47','Auto-escalated after 2 days',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,0,NULL,NULL,4,'2026-06-16 15:18:47'),(7,7,'R0',0,'uploads/drawings/ind-str-002.jpg',1850,'Auto-seeded for testing',NULL,1,'issued',3,'2026-06-16 15:18:48',NULL,3,'2026-06-16 15:18:48',NULL,'2026-06-16 15:18:48',1,NULL,NULL,NULL,0,NULL,NULL,4,'2026-06-16 15:18:47'),(8,8,'R0',0,'uploads/drawings/res-hvac-001.pdf',1850,'Auto-seeded for testing',NULL,1,'pending_l2',4,'2026-06-16 15:18:48',NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,0,NULL,NULL,4,'2026-06-16 15:18:47'),(9,9,'R0',0,'uploads/drawings/res-plum-002.jpg',1850,'Auto-seeded for testing',NULL,1,'rejected',4,'2026-06-16 15:18:48','Piping coordinates clash with columns at Grid 2.',NULL,NULL,'Piping coordinates clash with columns at Grid 2.',NULL,1,NULL,NULL,NULL,0,NULL,NULL,4,'2026-06-16 15:18:47'),(10,21,'R0',0,'C:\\Users\\basus\\Documents\\Internship\\NUAssociates\\nu-pmc-main\\uploads\\drawings\\1781680782702_93569c96a253_8._point_and_interval_estimation.pdf',344,NULL,NULL,1,'pending_l2',17,'2026-06-17 12:51:15',NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,0,NULL,NULL,17,'2026-06-17 12:49:42'),(11,34,'R0',0,'C:\\Users\\basus\\Documents\\Internship\\NUAssociates\\nu-pmc-main\\uploads\\drawings\\1781686865719_220c703440c4_7._sampling_and_clt.pdf',401,NULL,NULL,1,'issued',17,'2026-06-17 14:31:25',NULL,17,'2026-06-17 14:31:25',NULL,'2026-06-17 14:31:25',1,NULL,NULL,NULL,0,NULL,NULL,17,'2026-06-17 14:31:05');
/*!40000 ALTER TABLE `drawing_versions` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `drawings`
--

LOCK TABLES `drawings` WRITE;
/*!40000 ALTER TABLE `drawings` DISABLE KEYS */;
INSERT INTO `drawings` VALUES (1,1,'A-101','Ground Floor Plan','Architectural','design','main',NULL,NULL,NULL,'2026-04-22 17:25:19'),(2,1,'A-102','Production Area Layout','Architectural','design','main',NULL,NULL,NULL,'2026-04-22 17:25:19'),(3,1,'E-301','Power Distribution','Electrical','services','main',NULL,NULL,NULL,'2026-04-22 17:25:19'),(4,1,'DEMO-DRW-001','Foundation Plan Block A','Structural','design','main',NULL,NULL,NULL,'2026-06-16 15:17:30'),(5,1,'DEMO-DRW-002','Electrical Duct Layout v1','Electrical','services','main',NULL,NULL,NULL,'2026-06-16 15:17:30'),(6,2,'IND-ARCH-001','Warehouse Layout Plan','Architectural','design','main',NULL,NULL,NULL,'2026-06-16 15:18:47'),(7,2,'IND-STR-002','Foundation Reinforcement Detail','Structural','design','main',NULL,NULL,NULL,'2026-06-16 15:18:47'),(8,3,'RES-HVAC-001','Villa A HVAC Ducting Plan','HVAC','services','main',NULL,NULL,NULL,'2026-06-16 15:18:47'),(9,3,'RES-PLUM-002','Villa A Plumbing Layout','Plumbing','services','main',NULL,NULL,NULL,'2026-06-16 15:18:47'),(10,1,'DRW-ARCH-001','Architectural Layout Plan','Architectural','design','main',NULL,NULL,6,'2026-06-16 16:18:45'),(11,1,'DRW-ARCH-002','Section Details Ground Floor','Architectural','design','main',NULL,NULL,7,'2026-06-16 16:18:45'),(12,1,'DRW-ELEC-201','Power Layout & Conduit Routing','Electrical','services','main',NULL,NULL,9,'2026-06-16 16:18:45'),(13,1,'DRW-HVAC-301','Ducting Routing Diagram','HVAC','services','main',NULL,NULL,10,'2026-06-16 16:18:45'),(14,1,'DRW-PLUMB-401','Water Supply & Plumbing layout','Plumbing','services','main',NULL,NULL,11,'2026-06-16 16:18:45'),(15,1,'DRW-STR-101','Foundation Details','Structural','design','main',NULL,NULL,8,'2026-06-16 16:18:45'),(16,2,'DRW-ARCH-001','Architectural Layout Plan','Architectural','design','main',NULL,NULL,12,'2026-06-16 16:18:45'),(17,2,'DRW-ARCH-002','Section Details Ground Floor','Architectural','design','main',NULL,NULL,13,'2026-06-16 16:18:45'),(18,2,'DRW-ELEC-201','Power Layout & Conduit Routing','Electrical','services','main',NULL,NULL,15,'2026-06-16 16:18:45'),(19,2,'DRW-HVAC-301','Ducting Routing Diagram','HVAC','services','main',NULL,NULL,16,'2026-06-16 16:18:45'),(20,2,'DRW-PLUMB-401','Water Supply & Plumbing layout','Plumbing','services','main',NULL,NULL,17,'2026-06-16 16:18:45'),(21,2,'DRW-STR-101','Foundation Details','Structural','design','main',NULL,NULL,14,'2026-06-16 16:18:45'),(22,3,'DRW-ARCH-001','Architectural Layout Plan','Architectural','design','main',NULL,NULL,18,'2026-06-16 16:18:45'),(23,3,'DRW-ARCH-002','Section Details Ground Floor','Architectural','design','main',NULL,NULL,19,'2026-06-16 16:18:45'),(24,3,'DRW-ELEC-201','Power Layout & Conduit Routing','Electrical','services','main',NULL,NULL,21,'2026-06-16 16:18:45'),(25,3,'DRW-HVAC-301','Ducting Routing Diagram','HVAC','services','main',NULL,NULL,22,'2026-06-16 16:18:45'),(26,3,'DRW-PLUMB-401','Water Supply & Plumbing layout','Plumbing','services','main',NULL,NULL,23,'2026-06-16 16:18:45'),(27,3,'DRW-STR-101','Foundation Details','Structural','design','main',NULL,NULL,20,'2026-06-16 16:18:45'),(28,4,'DRW-ARCH-001','Architectural Layout Plan','Architectural','design','main',NULL,NULL,24,'2026-06-16 16:18:45'),(29,4,'DRW-ARCH-002','Section Details Ground Floor','Architectural','design','main',NULL,NULL,25,'2026-06-16 16:18:45'),(30,4,'DRW-ELEC-201','Power Layout & Conduit Routing','Electrical','services','main',NULL,NULL,27,'2026-06-16 16:18:45'),(31,4,'DRW-HVAC-301','Ducting Routing Diagram','HVAC','services','main',NULL,NULL,28,'2026-06-16 16:18:45'),(32,4,'DRW-PLUMB-401','Water Supply & Plumbing layout','Plumbing','services','main',NULL,NULL,29,'2026-06-16 16:18:45'),(33,4,'DRW-STR-101','Foundation Details','Structural','design','main',NULL,NULL,26,'2026-06-16 16:18:45'),(34,2,'DRW-HVAC-401','Power Layout Diagram','IT','services','main',NULL,NULL,30,'2026-06-17 14:31:05');
/*!40000 ALTER TABLE `drawings` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `external_comm_assignments`
--

LOCK TABLES `external_comm_assignments` WRITE;
/*!40000 ALTER TABLE `external_comm_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `external_comm_assignments` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `external_comm_config`
--

LOCK TABLES `external_comm_config` WRITE;
/*!40000 ALTER TABLE `external_comm_config` DISABLE KEYS */;
INSERT INTO `external_comm_config` VALUES (1,'vendor_bank_confirm','vendor_bank_vendor_confirm','finance_admin',4,'Send bank confirmation request to vendor',1,'2026-05-09 07:01:31'),(2,'vendor_bank_new','vendor_bank_vendor_confirm','finance_admin',4,'Send new bank details confirmation to vendor',1,'2026-05-09 07:01:31'),(3,'payment_utr_confirm',NULL,'finance_admin',2,'Send payment UTR confirmation to vendor',1,'2026-05-09 07:01:31'),(4,'vendor_defect_raised',NULL,'pmc_head',8,'Notify vendor: defect raised',1,'2026-05-09 07:01:31'),(5,'grn_pending',NULL,'pmc_head',8,'Notify vendor: GRN pending approval',1,'2026-05-09 07:01:31');
/*!40000 ALTER TABLE `external_comm_config` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fee_schedule` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `milestone_name` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `gst_pct` decimal(5,2) NOT NULL DEFAULT '18.00',
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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fee_schedule_history` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `fee_schedule_id` int unsigned NOT NULL,
  `previous_amount` decimal(14,2) NOT NULL,
  `revised_amount` decimal(14,2) NOT NULL,
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
-- Dumping data for table `form_templates`
--

LOCK TABLES `form_templates` WRITE;
/*!40000 ALTER TABLE `form_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `form_templates` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `formal_communications`
--

LOCK TABLES `formal_communications` WRITE;
/*!40000 ALTER TABLE `formal_communications` DISABLE KEYS */;
/*!40000 ALTER TABLE `formal_communications` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grns` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `grn_number` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `engagement_id` int unsigned NOT NULL,
  `material_request_id` int unsigned DEFAULT NULL,
  `delivery_date` date NOT NULL,
  `description` text COLLATE utf8mb4_general_ci NOT NULL,
  `quantity_received` decimal(12,3) NOT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grns`
--

LOCK TABLES `grns` WRITE;
/*!40000 ALTER TABLE `grns` DISABLE KEYS */;
INSERT INTO `grns` VALUES (9,2,'GRN-001',7,NULL,'2026-06-10','50 bags of OPC 53 Grade cement delivered.',50.000,'bags','DN-B-998','INV-B-432',NULL,NULL,1,11,'2026-06-16 20:53:36',3,'2026-06-16 20:53:36','approved',NULL),(10,2,'GRN-002',8,NULL,'2026-06-12','2.5 sqmm copper cable coils - 10 rolls.',10.000,'rolls','DN-V-101','INV-V-1209',NULL,NULL,1,11,'2026-06-16 20:53:36',NULL,NULL,'pending',NULL),(11,3,'GRN-003',10,NULL,'2026-06-14','8mm steel rebar consignment - 2.5 metric tonnes.',2.500,'MT','DN-B-999','INV-B-435',NULL,NULL,1,11,'2026-06-16 20:53:36',NULL,NULL,'pending',NULL),(12,4,'GRN-004',15,NULL,'2026-06-15','HVAC Outdoor Unit brackets - 8 sets.',8.000,'sets','DN-C-88','INV-C-987',NULL,NULL,1,12,'2026-06-16 20:53:36',3,'2026-06-16 20:53:36','approved',NULL),(13,2,'GRN-003',9,NULL,'2026-06-19','Dont know',145.000,'sqm',NULL,NULL,NULL,NULL,1,17,'2026-06-17 13:43:03',17,'2026-06-17 15:18:51','rejected',NULL),(14,2,'GRN-004',9,NULL,'2026-06-19','Dont know',145.000,'sqm',NULL,NULL,NULL,NULL,1,17,'2026-06-17 13:43:04',17,'2026-06-17 15:18:53','rejected',NULL),(15,2,'GRN-005',9,NULL,'2026-06-19','Dont know',145.000,'sqm',NULL,NULL,NULL,NULL,1,17,'2026-06-17 13:43:07',17,'2026-06-18 01:06:38','rejected',NULL),(16,2,'GRN-006',9,NULL,'2026-06-19','Dont know',145.000,'sqm',NULL,NULL,NULL,NULL,1,17,'2026-06-17 13:44:49',17,'2026-06-18 01:06:39','rejected',NULL),(17,2,'GRN-007',8,NULL,'2026-06-17','Dont know',10.000,'14',NULL,NULL,NULL,NULL,1,17,'2026-06-17 13:53:45',NULL,NULL,'pending',NULL),(18,2,'GRN-008',8,NULL,'2026-06-17','Dont know',10.000,'14',NULL,NULL,NULL,NULL,1,17,'2026-06-17 13:56:39',NULL,NULL,'pending',NULL),(19,2,'GRN-009',8,NULL,'2026-06-20','Light',150.000,'sqm',NULL,NULL,NULL,NULL,1,17,'2026-06-17 13:59:48',17,'2026-06-17 14:23:25','approved',NULL),(20,2,'GRN-010',8,NULL,'2026-06-17','Dont know',140.000,'sqm',NULL,NULL,NULL,NULL,1,17,'2026-06-17 14:08:30',NULL,NULL,'pending',NULL),(21,2,'GRN-011',7,NULL,'2026-06-18','Dont know',150.000,'sqm',NULL,NULL,NULL,NULL,1,17,'2026-06-17 14:34:29',17,'2026-06-18 01:10:32','rejected',NULL),(22,2,'GRN-012',9,NULL,'2026-06-17','VoltEdge',1545.000,'bags',NULL,NULL,NULL,NULL,1,17,'2026-06-17 14:50:01',NULL,NULL,'pending',NULL),(23,2,'GRN-013',7,NULL,'2026-06-17','Light',1450.000,'bags',NULL,NULL,NULL,NULL,1,17,'2026-06-17 14:51:01',NULL,NULL,'pending',NULL),(24,2,'GRN-014',8,NULL,'2026-06-17','Dont know',1.000,'bag',NULL,NULL,NULL,NULL,1,17,'2026-06-17 15:19:17',NULL,NULL,'pending',NULL);
/*!40000 ALTER TABLE `grns` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `issues`
--

LOCK TABLES `issues` WRITE;
/*!40000 ALTER TABLE `issues` DISABLE KEYS */;
INSERT INTO `issues` VALUES (12,2,'ISS-001','safety','Missing edge protection on First Floor slab','Open edges present fall hazards. Immediate scaffolding railing required.',11,'2026-06-16 20:53:36',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'open',0,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL),(13,2,'ISS-002','quality','Honeycombing in Column C12 shear key','Voiding observed after formwork strike. Requires structure review and polymer repair.',11,'2026-06-16 20:53:36',NULL,NULL,8,NULL,NULL,NULL,NULL,NULL,'in_progress',0,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL),(14,3,'ISS-003','rfi','Clarification on DB Room wall thickness','Architectural shows 230mm brick wall while Electrical suggests 115mm to save space.',11,'2026-06-16 20:53:36',NULL,NULL,4,NULL,NULL,NULL,NULL,NULL,'open',0,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL),(15,4,'ISS-004','design','HVAC Grill alignment with lighting tracks','HVAC layout conflicts with direct lighting tracks on 2nd floor ceiling plan.',12,'2026-06-16 20:53:36',NULL,NULL,5,NULL,NULL,NULL,NULL,NULL,'resolved',0,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,'Rerouted lights by 150mm outwards.',5,'2026-06-16 20:53:36',NULL,NULL,0,0,NULL),(16,4,'ISS-005','compliance','Labour PF compliance documentation missing','VoltEdge Systems did not submit PF returns for May 2026 payroll.',13,'2026-06-16 20:53:36',NULL,NULL,NULL,NULL,2,NULL,NULL,NULL,'open',0,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL),(17,2,'ISS-003','rfi','Hello there friend','Hello there friend',17,'2026-06-18 01:02:16',17,'2026-06-18 01:02:16',4,NULL,NULL,NULL,NULL,NULL,'open',0,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,'design','text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL);
/*!40000 ALTER TABLE `issues` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `labour_register` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `engagement_id` int unsigned NOT NULL,
  `register_date` date NOT NULL,
  `trade` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `headcount` int unsigned NOT NULL DEFAULT '0',
  `wages_paid` decimal(10,2) DEFAULT NULL,
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
-- Dumping data for table `labour_register`
--

LOCK TABLES `labour_register` WRITE;
/*!40000 ALTER TABLE `labour_register` DISABLE KEYS */;
INSERT INTO `labour_register` VALUES (47,2,7,'2026-06-11','Civil',17,11050.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(48,2,7,'2026-06-12','Civil',13,8450.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(49,2,7,'2026-06-13','Civil',14,9100.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(50,2,7,'2026-06-14','Civil',18,11700.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(51,2,7,'2026-06-15','Civil',15,9750.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(52,2,8,'2026-06-11','Electrical',4,2600.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(53,2,8,'2026-06-12','Electrical',7,4550.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(54,2,8,'2026-06-13','Electrical',4,2600.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(55,2,8,'2026-06-14','Electrical',7,4550.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(56,2,8,'2026-06-15','Electrical',7,4550.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(57,2,9,'2026-06-11','HVAC',5,3250.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(58,2,9,'2026-06-12','HVAC',3,1950.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(59,2,9,'2026-06-13','HVAC',5,3250.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(60,2,9,'2026-06-14','HVAC',5,3250.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(61,2,9,'2026-06-15','HVAC',4,2600.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(62,3,10,'2026-06-11','Civil',16,10400.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(63,3,10,'2026-06-12','Civil',13,8450.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(64,3,10,'2026-06-13','Civil',13,8450.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(65,3,10,'2026-06-14','Civil',19,12350.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(66,3,10,'2026-06-15','Civil',19,12350.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(67,3,11,'2026-06-11','Electrical',4,2600.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(68,3,11,'2026-06-12','Electrical',7,4550.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(69,3,11,'2026-06-13','Electrical',6,3900.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(70,3,11,'2026-06-14','Electrical',6,3900.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(71,3,11,'2026-06-15','Electrical',4,2600.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(72,3,12,'2026-06-11','HVAC',5,3250.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(73,3,12,'2026-06-12','HVAC',4,2600.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(74,3,12,'2026-06-13','HVAC',5,3250.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(75,3,12,'2026-06-14','HVAC',4,2600.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(76,3,12,'2026-06-15','HVAC',4,2600.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(77,4,13,'2026-06-11','Civil',13,8450.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(78,4,13,'2026-06-12','Civil',15,9750.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(79,4,13,'2026-06-13','Civil',17,11050.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(80,4,13,'2026-06-14','Civil',12,7800.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(81,4,13,'2026-06-15','Civil',15,9750.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(82,4,14,'2026-06-11','Electrical',4,2600.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(83,4,14,'2026-06-12','Electrical',5,3250.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(84,4,14,'2026-06-13','Electrical',4,2600.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(85,4,14,'2026-06-14','Electrical',5,3250.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(86,4,14,'2026-06-15','Electrical',6,3900.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(87,4,15,'2026-06-11','HVAC',5,3250.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(88,4,15,'2026-06-12','HVAC',3,1950.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(89,4,15,'2026-06-13','HVAC',3,1950.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(90,4,15,'2026-06-14','HVAC',4,2600.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(91,4,15,'2026-06-15','HVAC',3,1950.00,11,'2026-06-16 20:53:36','Daily headcount recorded on site.',NULL,NULL,NULL),(92,2,8,'2026-06-17','Civil',150,NULL,17,'2026-06-17 13:16:43','Wages: 5000',NULL,NULL,NULL),(94,2,9,'2026-06-17','Civil',152,NULL,17,'2026-06-17 13:28:43',NULL,NULL,NULL,NULL),(96,1,1,'2026-06-18','Civil',150,NULL,17,'2026-06-18 00:57:04',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `labour_register` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_requests` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `boq_item_id` int unsigned NOT NULL,
  `quantity_needed` decimal(12,3) NOT NULL,
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
-- Dumping data for table `material_requests`
--

LOCK TABLES `material_requests` WRITE;
/*!40000 ALTER TABLE `material_requests` DISABLE KEYS */;
INSERT INTO `material_requests` VALUES (1,2,10,100.000,'2026-07-01',5,'Urgent cement order for foundations',7,'2026-06-16 15:20:00',17,'2026-06-18 01:08:20','2026-06-18 01:08:23','2026-06-18 01:08:24',17,'2026-06-18 01:08:25',0),(2,2,11,130.000,'2026-12-10',3,NULL,17,'2026-06-17 13:32:51',17,'2026-06-18 01:08:30','2026-06-18 01:08:30',NULL,NULL,NULL,0);
/*!40000 ALTER TABLE `material_requests` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `matrix_outbox`
--

LOCK TABLES `matrix_outbox` WRITE;
/*!40000 ALTER TABLE `matrix_outbox` DISABLE KEYS */;
/*!40000 ALTER TABLE `matrix_outbox` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `matrix_rooms`
--

LOCK TABLES `matrix_rooms` WRITE;
/*!40000 ALTER TABLE `matrix_rooms` DISABLE KEYS */;
/*!40000 ALTER TABLE `matrix_rooms` ENABLE KEYS */;
UNLOCK TABLES;

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
  `measured_qty` decimal(12,3) NOT NULL DEFAULT '0.000',
  `quality_note` text COLLATE utf8mb4_general_ci,
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
-- Dumping data for table `meeting_actions`
--

LOCK TABLES `meeting_actions` WRITE;
/*!40000 ALTER TABLE `meeting_actions` DISABLE KEYS */;
INSERT INTO `meeting_actions` VALUES (5,7,'Install handrail barricades on open slab edge',NULL,'BlueStone Site Lead',NULL,'2026-06-18','pending',NULL,NULL,NULL,NULL,0),(6,7,'Submit detailed polymer repair method statement for Column C12',NULL,'BlueStone QC Engineer',NULL,'2026-06-19','completed',NULL,NULL,'2026-06-18 13:57:13',NULL,0),(7,8,'Reroute HVAC duct design and issue DRW-HVAC-301-R1',NULL,'CoolAir Designer',NULL,'2026-06-20','pending',NULL,NULL,NULL,NULL,0),(8,8,'Verify lighting track placement',NULL,'Services Head',NULL,'2026-06-18','completed',NULL,NULL,NULL,NULL,0);
/*!40000 ALTER TABLE `meeting_actions` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `meetings`
--

LOCK TABLES `meetings` WRITE;
/*!40000 ALTER TABLE `meetings` DISABLE KEYS */;
INSERT INTO `meetings` VALUES (7,1,2,NULL,'MOM-01','site_visit','sent_to_client','Weekly Progress & Quality Review','2026-06-15',NULL,NULL,'Site Office Conference Room','PMC Head, Site Manager','BlueStone Project Lead','1. Progress check\n2. Safety issues\n3. Next milestones','Reviewed foundation progress. Scaffolding edge safety highlighted.','Meeting went well. Milestones are aligned with R0 schedule.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',3,'2026-06-16 20:53:36'),(8,1,4,NULL,'MOM-02','design_review','internal','Services Coordination Meeting','2026-06-12',NULL,NULL,'Corporate HQ Office','Design Head, Services Head','HVAC Vendor Consultant','Coordinate HVAC duct routing and ceiling layouts','HVAC duct conflicts identified. Drawings to be revised.','Coordinated ceiling layouts.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'draft',3,'2026-06-16 20:53:36'),(9,1,1,NULL,'MOM-001','internal','internal','Idk','2026-06-17',NULL,NULL,NULL,'Principal, Pmc Head, Jr Engineer',NULL,NULL,NULL,NULL,NULL,17,NULL,NULL,NULL,NULL,NULL,NULL,'draft',17,'2026-06-17 13:38:49');
/*!40000 ALTER TABLE `meetings` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `notification_triggers`
--

LOCK TABLES `notification_triggers` WRITE;
/*!40000 ALTER TABLE `notification_triggers` DISABLE KEYS */;
INSERT INTO `notification_triggers` VALUES (1,'Claims','claim.approved','Claim approved','principal','whatsapp',1,'claims.js:244','2026-04-22 17:25:19'),(2,'Claims','claim.approved','Claim approved','design_principal','whatsapp',1,'claims.js:244','2026-04-22 17:25:19'),(3,'Claims','claim.approved','Claim approved','pmc_head','whatsapp',1,'claims.js:250','2026-04-22 17:25:19'),(4,'Drawings','drawing.approved','Drawing approved / issued','principal','whatsapp',1,'drawings.js:621','2026-04-22 17:25:19'),(5,'Drawings','drawing.approved','Drawing approved / issued','design_principal','whatsapp',1,'drawings.js:621','2026-04-22 17:25:19'),(6,'Drawings','drawing.flagged','Drawing flagged at L1 review','uploader','whatsapp',1,'drawings.js:542','2026-04-22 17:25:19'),(7,'GRN','grn.ncr-raised','NCR / non-conformance flagged','principal','whatsapp',1,'grn.js:340','2026-04-22 17:25:19'),(8,'GRN','grn.ncr-raised','NCR / non-conformance flagged','design_principal','whatsapp',1,'grn.js:340','2026-04-22 17:25:19'),(9,'GRN','grn.ncr-raised','NCR / non-conformance flagged','pmc_head','whatsapp',1,'grn.js:340','2026-04-22 17:25:19'),(10,'GRN','grn.ncr-raised','NCR / non-conformance flagged','design_head','whatsapp',1,'grn.js:345','2026-04-22 17:25:19'),(11,'GRN','grn.ncr-raised','NCR / non-conformance flagged','services_head','whatsapp',1,'grn.js:345','2026-04-22 17:25:19'),(12,'GRN','grn.ncr-raised','NCR / non-conformance flagged','vendor','whatsapp',1,'grn.js:353','2026-04-22 17:25:19'),(13,'Issues','issue.auto-assigned','Issue auto-assigned','assignee','whatsapp',1,'issues.js:121','2026-04-22 17:25:19'),(14,'Issues','issue.assigned','Issue assigned (manual)','assignee','whatsapp',1,'issues.js:152','2026-04-22 17:25:19'),(15,'Issues','issue.ncr-vendor','Issue NCR sent to vendor','vendor','whatsapp',1,'issues.js:160','2026-04-22 17:25:19'),(16,'Meetings','meeting.action-item-assigned','MOM action item assigned','assignee','whatsapp',1,'meetings.js:428','2026-04-22 17:25:19'),(17,'Payments','payment.confirmed-utr','Payment confirmed (UTR applied)','principal','whatsapp',1,'payments.js:480','2026-04-22 17:25:19'),(18,'Payments','payment.confirmed-utr','Payment confirmed (UTR applied)','design_principal','whatsapp',1,'payments.js:480','2026-04-22 17:25:19'),(19,'Payments','payment.confirmed-utr','Payment confirmed (UTR applied)','vendor','whatsapp',1,'payments.js:480','2026-04-22 17:25:19'),(20,'Payments','payment.utr-batch','UTR batch consolidated','principal','whatsapp',1,'payments.js:844','2026-04-22 17:25:19'),(21,'Payments','payment.utr-batch','UTR batch consolidated','design_principal','whatsapp',1,'payments.js:844','2026-04-22 17:25:19'),(22,'PaymentReq','payment-request.raised','Payment request raised','pmc_head','whatsapp',1,'payment-requests.js:214','2026-04-22 17:25:19'),(23,'PaymentReq','payment-request.raised','Payment request raised','principal','whatsapp',1,'payment-requests.js:214','2026-04-22 17:25:19'),(24,'PaymentReq','payment-request.pmc-approved','PR PMC approved','principal','whatsapp',1,'payment-requests.js:334','2026-04-22 17:25:19'),(25,'PaymentReq','payment-request.pmc-approved','PR PMC approved','design_principal','whatsapp',1,'payment-requests.js:334','2026-04-22 17:25:19'),(26,'PaymentReq','payment-request.pmc-approved','PR PMC approved','finance_admin','whatsapp',1,'payment-requests.js:352','2026-04-22 17:25:19'),(27,'PaymentReq','payment-request.pmc-rejected','PR rejected by PMC','raiser','whatsapp',1,'payment-requests.js:303','2026-04-22 17:25:19'),(28,'PaymentReq','payment-request.principal-approved','PR approved by Principal','finance_admin','whatsapp',1,'payment-requests.js:427','2026-04-22 17:25:19'),(29,'PaymentReq','payment-request.principal-approved','PR approved by Principal','raiser','whatsapp',1,'payment-requests.js:427','2026-04-22 17:25:19'),(30,'PaymentReq','payment-request.principal-rejected','PR rejected by Principal','raiser','whatsapp',1,'payment-requests.js:430','2026-04-22 17:25:19'),(31,'PaymentReq','payment-request.principal-rejected','PR rejected by Principal','pmc_reviewer','whatsapp',1,'payment-requests.js:431','2026-04-22 17:25:19'),(32,'PaymentReq','payment-request.vendor-confirmed','Vendor payment confirmed','vendor','whatsapp',1,'payment-requests.js:502','2026-04-22 17:25:19'),(33,'PaymentReq','payment-request.vendor-confirmed','Vendor payment confirmed','raiser','whatsapp',1,'payment-requests.js:508','2026-04-22 17:25:19'),(34,'PaymentReq','urgent-payment.raised','Urgent payment raised','pmc_head','whatsapp',1,'urgent-payments.js:111','2026-04-22 17:25:19'),(35,'PaymentReq','urgent-payment.raised','Urgent payment raised','principal','whatsapp',1,'urgent-payments.js:124','2026-04-22 17:25:19'),(36,'PaymentReq','urgent-payment.raised','Urgent payment raised','design_principal','whatsapp',1,'urgent-payments.js:124','2026-04-22 17:25:19'),(37,'Reports','report.ready-for-review','Weekly report ready for review','principal','whatsapp',1,'reports.js:134','2026-04-22 17:25:19'),(38,'Reports','report.ready-for-review','Weekly report ready for review','design_principal','whatsapp',1,'reports.js:134','2026-04-22 17:25:19'),(39,'Reports','report.drag-flag','Drag flag on weekly report','principal','whatsapp',1,'reports.js:195,365','2026-04-22 17:25:19'),(40,'Reports','report.drag-flag','Drag flag on weekly report','design_principal','whatsapp',1,'reports.js:195,365','2026-04-22 17:25:19'),(41,'Reports','report.pmc-approved','Weekly report approved by PMC Head','principal','whatsapp',1,'reports.js:234','2026-04-22 17:25:19'),(42,'Reports','report.pmc-approved','Weekly report approved by PMC Head','design_principal','whatsapp',1,'reports.js:234','2026-04-22 17:25:19'),(43,'Schedule','schedule.version-uploaded','Schedule version uploaded','principal','whatsapp',1,'schedule.js:252','2026-04-22 17:25:19'),(44,'Schedule','schedule.version-uploaded','Schedule version uploaded','design_principal','whatsapp',1,'schedule.js:252','2026-04-22 17:25:19'),(45,'Schedule','schedule.drift-acknowledged','Schedule drift acknowledged','principal','whatsapp',1,'schedule.js:281','2026-04-22 17:25:19'),(46,'Schedule','schedule.drift-acknowledged','Schedule drift acknowledged','design_principal','whatsapp',1,'schedule.js:281','2026-04-22 17:25:19'),(47,'Schedule','schedule.task-outlier','Task outlier detected (AI flag)','principal','whatsapp',1,'schedule.js:366','2026-04-22 17:25:19'),(48,'Schedule','schedule.task-outlier','Task outlier detected (AI flag)','design_principal','whatsapp',1,'schedule.js:366','2026-04-22 17:25:19'),(49,'Users','user.pending-approval','New user pending approval','principal','whatsapp',1,'user-management.js:61','2026-04-22 17:25:19'),(50,'Users','user.pending-approval','New user pending approval','design_principal','whatsapp',1,'user-management.js:61','2026-04-22 17:25:19'),(51,'Users','user.activated','New user activated','new_user','whatsapp',1,'user-management.js:94','2026-04-22 17:25:19'),(52,'Vendors','vendor.pending-clearance','Vendor pending finance clearance','finance_admin','whatsapp',1,'vendors.js:114','2026-04-22 17:25:19'),(53,'Vendors','vendor.engagement-pending','Vendor engagement pending approval','principal','whatsapp',1,'vendors.js:423','2026-04-22 17:25:19'),(54,'Vendors','vendor.engagement-pending','Vendor engagement pending approval','design_principal','whatsapp',1,'vendors.js:423','2026-04-22 17:25:19'),(55,'Vendors','vendor.engagement-approved','Vendor engagement approved','raiser','whatsapp',1,'vendors.js:469','2026-04-22 17:25:19'),(56,'Vendors','vendor.engagement-rejected','Vendor engagement rejected','raiser','whatsapp',1,'vendors.js:500','2026-04-22 17:25:19'),(57,'Budget','budget.custom-head','Custom budget head approved/rejected','principal','whatsapp',1,'budget.js:193','2026-04-22 17:25:19'),(58,'Budget','budget.custom-head','Custom budget head approved/rejected','design_principal','whatsapp',1,'budget.js:200','2026-04-22 17:25:19'),(59,'Changes','change-notice.ready','CN ready for principal approval','principal','whatsapp',1,'changes.js:148','2026-04-22 17:25:19'),(60,'Changes','change-notice.ready','CN ready for principal approval','design_principal','whatsapp',1,'changes.js:148','2026-04-22 17:25:19'),(61,'Projects','project.client-incomplete','Client master incomplete','finance_admin','whatsapp',1,'projects.js:462','2026-04-22 17:25:19');
/*!40000 ALTER TABLE `notification_triggers` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `notifications_config`
--

LOCK TABLES `notifications_config` WRITE;
/*!40000 ALTER TABLE `notifications_config` DISABLE KEYS */;
INSERT INTO `notifications_config` VALUES (1,'morning_pmc','07:00:00',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(2,'naveen_morning','08:00:00',1,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(3,'closeout','21:00:00',1,'2026-06-16 09:38:00','2026-06-16 09:38:00');
/*!40000 ALTER TABLE `notifications_config` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_requests` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `row_version` int unsigned NOT NULL DEFAULT '1',
  `project_id` int unsigned NOT NULL,
  `vendor_id` int unsigned NOT NULL,
  `engagement_id` int unsigned DEFAULT NULL,
  `requested_by` int unsigned NOT NULL,
  `amount_requested` decimal(14,2) NOT NULL,
  `reason` text COLLATE utf8mb4_general_ci NOT NULL,
  `payment_type` enum('labour','site_material','design_material','mep_material','mobilisation_advance','material_advance','advance','running_account_bill','final_bill','retention_release','other') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'other',
  `status` enum('pending_pmc','pmc_approved','pmc_rejected','pending_principal','principal_approved','principal_rejected','paid') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending_pmc',
  `pmc_reviewed_by` int unsigned DEFAULT NULL,
  `pmc_reviewed_at` datetime DEFAULT NULL,
  `pmc_amount` decimal(14,2) DEFAULT NULL,
  `pmc_notes` text COLLATE utf8mb4_general_ci,
  `principal_reviewed_by` int unsigned DEFAULT NULL,
  `principal_reviewed_at` datetime DEFAULT NULL,
  `principal_notes` text COLLATE utf8mb4_general_ci,
  `actual_paid` decimal(14,2) DEFAULT NULL,
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
  `gst_rate` decimal(5,2) NOT NULL DEFAULT '18.00',
  `hsn_code` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_interstate` tinyint(1) NOT NULL DEFAULT '0',
  `schedule_compliant` tinyint(1) NOT NULL DEFAULT '0',
  `compliance_checked_by` int unsigned DEFAULT NULL,
  `compliance_checked_at` datetime DEFAULT NULL,
  `work_done_pct` decimal(5,2) DEFAULT NULL,
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
-- Dumping data for table `payment_requests`
--

LOCK TABLES `payment_requests` WRITE;
/*!40000 ALTER TABLE `payment_requests` DISABLE KEYS */;
INSERT INTO `payment_requests` VALUES (29,1,2,1,7,11,320000.00,'Excavation & Shuttering work completion RA-1','running_account_bill','pending_pmc',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-06-16 20:53:36','2026-06-16 20:53:36'),(30,1,3,2,11,11,180000.00,'Material advance for conduit pipes and DB boxes','material_advance','pending_pmc',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-06-16 20:53:36','2026-06-16 20:53:36'),(31,1,4,3,15,12,150000.00,'HVAC copper piping layout advance','advance','pending_pmc',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-06-16 20:53:36','2026-06-16 20:53:36'),(32,1,2,2,8,11,250000.00,'Cable laying and earthing grid execution','running_account_bill','pmc_approved',3,'2026-06-16 20:53:36',245000.00,'Deducted 5000 due to minor cleanup pending.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-06-16 20:53:36','2026-06-16 20:53:36'),(33,1,3,1,10,11,600000.00,'RA Bill 02 for retaining wall concrete casting','running_account_bill','pending_principal',3,'2026-06-16 20:53:36',600000.00,'Fully verified and measurements certified.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-06-16 20:53:36','2026-06-16 20:53:36'),(34,1,4,1,13,12,400000.00,'Mobilisation advance for foundation structure','mobilisation_advance','pmc_approved',3,'2026-06-16 20:53:36',400000.00,'Site setup complete, approved.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-06-16 20:53:36','2026-06-16 20:53:36'),(35,1,2,3,9,11,120000.00,'RA Bill 01 for AHU stand fabrication','running_account_bill','principal_approved',3,'2026-06-16 20:53:36',120000.00,'Approved.',1,'2026-06-16 20:53:36','Ok to pay.',NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-06-16 20:53:36','2026-06-16 20:53:36'),(36,1,4,2,14,12,350000.00,'Procurement of main panels advance payment','material_advance','principal_approved',3,'2026-06-16 20:53:36',350000.00,'OEM proforma invoice attached.',1,'2026-06-16 20:53:36','Approved for panel delivery.',NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-06-16 20:53:36','2026-06-16 20:53:36');
/*!40000 ALTER TABLE `payment_requests` ENABLE KEYS */;
UNLOCK TABLES;

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
  `amount` decimal(10,2) NOT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `photo_tags`
--

LOCK TABLES `photo_tags` WRITE;
/*!40000 ALTER TABLE `photo_tags` DISABLE KEYS */;
INSERT INTO `photo_tags` VALUES (1,6,NULL,'defect',NULL,17,'site_manager',1,NULL,NULL,NULL,'2026-06-18 16:36:46');
/*!40000 ALTER TABLE `photo_tags` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `principal_direct_payments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `payment_date` date NOT NULL,
  `payment_type` enum('upi','cash') COLLATE utf8mb4_general_ci NOT NULL,
  `amount` decimal(14,2) NOT NULL,
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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `proforma_invoices` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `pi_number` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `fee_schedule_id` int unsigned NOT NULL,
  `schedule_task_id` int unsigned DEFAULT NULL,
  `amount_ex_gst` decimal(14,2) NOT NULL,
  `gst_pct` decimal(5,2) NOT NULL DEFAULT '18.00',
  `amount_gst` decimal(14,2) NOT NULL,
  `amount_total` decimal(14,2) NOT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_assignments`
--

LOCK TABLES `project_assignments` WRITE;
/*!40000 ALTER TABLE `project_assignments` DISABLE KEYS */;
INSERT INTO `project_assignments` VALUES (1,1,1,'principal',1,'2026-06-16 16:10:32',1),(2,1,2,'design_principal',1,'2026-06-16 16:10:32',1),(3,1,3,'pmc_head',1,'2026-06-16 16:10:32',1),(4,1,4,'design_head',1,'2026-06-16 16:10:32',1),(5,1,5,'services_head',1,'2026-06-16 16:10:32',1),(6,1,13,'finance_admin',1,'2026-06-16 16:10:32',1),(7,1,15,'audit',1,'2026-06-16 16:10:32',1),(8,1,17,'principal',1,'2026-06-16 16:10:32',1),(9,1,6,'team_lead',1,'2026-06-16 16:10:32',1),(10,1,8,'jr_engineer',1,'2026-06-16 16:10:32',1),(11,1,11,'site_manager',1,'2026-06-16 16:10:32',1),(12,1,14,'trainee',1,'2026-06-16 16:10:32',1),(13,2,1,'principal',1,'2026-06-16 16:10:32',1),(14,2,2,'design_principal',1,'2026-06-16 16:10:32',1),(15,2,3,'pmc_head',1,'2026-06-16 16:10:32',1),(16,2,4,'design_head',1,'2026-06-16 16:10:32',1),(17,2,5,'services_head',1,'2026-06-16 16:10:32',1),(18,2,13,'finance_admin',1,'2026-06-16 16:10:32',1),(19,2,15,'audit',1,'2026-06-16 16:10:32',1),(20,2,17,'principal',1,'2026-06-16 16:10:32',1),(21,2,6,'team_lead',1,'2026-06-16 16:10:32',1),(22,2,8,'jr_engineer',1,'2026-06-16 16:10:32',1),(23,2,12,'senior_site_manager',1,'2026-06-16 16:10:32',1),(24,3,1,'principal',1,'2026-06-16 16:10:32',1),(25,3,2,'design_principal',1,'2026-06-16 16:10:32',1),(26,3,3,'pmc_head',1,'2026-06-16 16:10:32',1),(27,3,4,'design_head',1,'2026-06-16 16:10:32',1),(28,3,5,'services_head',1,'2026-06-16 16:10:32',1),(29,3,13,'finance_admin',1,'2026-06-16 16:10:32',1),(30,3,15,'audit',1,'2026-06-16 16:10:32',1),(31,3,17,'principal',1,'2026-06-16 16:10:32',1),(32,3,7,'jr_architect',1,'2026-06-16 16:10:32',1),(33,3,10,'coordinator',1,'2026-06-16 16:10:32',1),(34,3,11,'site_manager',1,'2026-06-16 16:10:32',1),(35,3,14,'trainee',1,'2026-06-16 16:10:32',1),(36,4,1,'principal',1,'2026-06-16 16:10:32',1),(37,4,2,'design_principal',1,'2026-06-16 16:10:32',1),(38,4,3,'pmc_head',1,'2026-06-16 16:10:32',1),(39,4,4,'design_head',1,'2026-06-16 16:10:32',1),(40,4,5,'services_head',1,'2026-06-16 16:10:32',1),(41,4,13,'finance_admin',1,'2026-06-16 16:10:32',1),(42,4,15,'audit',1,'2026-06-16 16:10:32',1),(43,4,17,'principal',1,'2026-06-16 16:10:32',1),(44,4,7,'jr_architect',1,'2026-06-16 16:10:32',1),(45,4,9,'services_engineer',1,'2026-06-16 16:10:32',1),(46,4,10,'coordinator',1,'2026-06-16 16:10:32',1),(47,4,12,'senior_site_manager',1,'2026-06-16 16:10:32',1);
/*!40000 ALTER TABLE `project_assignments` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `project_closures`
--

LOCK TABLES `project_closures` WRITE;
/*!40000 ALTER TABLE `project_closures` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_closures` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_photos`
--

LOCK TABLES `project_photos` WRITE;
/*!40000 ALTER TABLE `project_photos` DISABLE KEYS */;
INSERT INTO `project_photos` VALUES (1,2,NULL,NULL,'2026-06-17','C:\\Users\\basus\\Documents\\Internship\\NUAssociates\\nu-pmc-main\\uploads\\photos\\1781682325880_bbddd41d08aa_the_1975_poster.jpg',96,NULL,17,'app','2026-06-17 13:15:25',0,NULL,NULL),(2,2,NULL,NULL,'2026-06-17','C:\\Users\\basus\\Documents\\Internship\\NUAssociates\\nu-pmc-main\\uploads\\photos\\1781683838883_9691a3573b78_suits.jpg',39,NULL,17,'app','2026-06-17 13:40:38',0,NULL,NULL),(3,2,NULL,NULL,'2026-06-17','C:\\Users\\basus\\Documents\\Internship\\NUAssociates\\nu-pmc-main\\uploads\\photos\\1781686259768_d8cb1b7a5aa0_batman___arkham_origins__newgotham_rooftops_by_inetgrafx_d6ttsfp.jpg',217,NULL,17,'app','2026-06-17 14:20:59',0,NULL,NULL),(4,2,NULL,NULL,'2026-06-17','C:\\Users\\basus\\Documents\\Internship\\NUAssociates\\nu-pmc-main\\uploads\\photos\\1781686924691_5cb3896e9c36_the_1975_poster.jpg',96,NULL,17,'app','2026-06-17 14:32:04',0,NULL,NULL),(5,2,NULL,NULL,'2026-06-17','C:\\Users\\basus\\Documents\\Internship\\NUAssociates\\nu-pmc-main\\uploads\\photos\\1781687661088_06ebc2895684_download__1_.jpg',143,NULL,17,'app','2026-06-17 14:44:21',0,NULL,NULL),(6,2,NULL,NULL,'2026-06-18','C:\\Users\\basus\\Documents\\Internship\\NUAssociates\\nu-pmc-main\\uploads\\photos\\1781780806449_026e0882b248_a93255aa94608e023146cd547f72e774.jpg',158,NULL,17,'app','2026-06-18 16:36:46',0,NULL,NULL);
/*!40000 ALTER TABLE `project_photos` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `project_pmc_assignments`
--

LOCK TABLES `project_pmc_assignments` WRITE;
/*!40000 ALTER TABLE `project_pmc_assignments` DISABLE KEYS */;
INSERT INTO `project_pmc_assignments` (`id`, `project_id`, `user_id`, `kind`, `effective_from`, `effective_to`, `assigned_by`, `assigned_at`, `note`) VALUES (1,1,3,'primary','2026-01-01',NULL,1,'2026-06-16 16:10:32',NULL),(2,2,3,'primary','2026-01-01',NULL,1,'2026-06-16 16:10:32',NULL),(3,3,3,'primary','2026-01-01',NULL,1,'2026-06-16 16:10:32',NULL),(4,4,3,'primary','2026-01-01',NULL,1,'2026-06-16 16:10:32',NULL);
/*!40000 ALTER TABLE `project_pmc_assignments` ENABLE KEYS */;
UNLOCK TABLES;

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
  `sqft_area` decimal(12,2) DEFAULT NULL,
  `num_floors` int unsigned DEFAULT NULL,
  `num_blocks` int unsigned DEFAULT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `requires_statutory_approvals` tinyint(1) NOT NULL DEFAULT '0',
  `dlp_months` int unsigned NOT NULL DEFAULT '12',
  `planned_handover_date` date DEFAULT NULL,
  `retention_amount` decimal(14,2) DEFAULT NULL,
  `retention_due_date` date DEFAULT NULL,
  `petty_cash_limit` decimal(10,2) DEFAULT NULL,
  `petty_cash_txn_limit` decimal(10,2) DEFAULT NULL,
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
-- Dumping data for table `project_slas`
--

LOCK TABLES `project_slas` WRITE;
/*!40000 ALTER TABLE `project_slas` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_slas` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `project_thresholds`
--

LOCK TABLES `project_thresholds` WRITE;
/*!40000 ALTER TABLE `project_thresholds` DISABLE KEYS */;
INSERT INTO `project_thresholds` VALUES (1,NULL,'min_headcount',8,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(2,NULL,'float_days',3,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(3,NULL,'overdue_days',2,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(4,NULL,'grn_pending_days',3,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(5,NULL,'snag_pending_days',7,'2026-06-16 09:38:00','2026-06-16 09:38:00'),(6,NULL,'budget_alert_pct',90,'2026-06-16 09:38:00','2026-06-16 09:38:00');
/*!40000 ALTER TABLE `project_thresholds` ENABLE KEYS */;
UNLOCK TABLES;

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
  `site_lat` decimal(10,7) DEFAULT NULL,
  `site_lng` decimal(10,7) DEFAULT NULL,
  `project_type` enum('industrial','institutional','residential','commercial','infrastructure','interior') COLLATE utf8mb4_general_ci NOT NULL,
  `r0_start_date` date NOT NULL,
  `r0_end_date` date NOT NULL,
  `jurisdiction` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `contract_value` decimal(14,2) DEFAULT NULL,
  `payment_approval_threshold` decimal(14,2) DEFAULT NULL,
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
  `pmc_approval_limit` decimal(10,4) DEFAULT NULL,
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
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (1,2,'primary','PV90','PV 90 Production Line','TLD MAINI GSE Pvt Ltd',NULL,'Nelamangala, Bengaluru',NULL,NULL,'industrial','2026-03-23','2026-05-25',NULL,12500000.00,NULL,NULL,NULL,'active',1,1,1,1,1,1,1,1,'2026-04-22 17:25:19','2026-04-22 17:25:19','principal_only',NULL),(2,2,'primary','PROJ-IND','Industrial Warehouse Complex','Sterling Developers Ltd',1,'KIADB Industrial Area, Bangalore',12.9715987,77.5945627,'industrial','2026-06-01','2027-06-01',NULL,18500000.00,NULL,'2026-02-15','2026-11-30','active',1,1,1,1,1,1,1,1,'2026-06-16 15:18:22','2026-06-16 15:49:43','principal_only',NULL),(3,2,'primary','PROJ-RES','Residential Green Villa Complex','Sterling Developers Ltd',1,'Whitefield, Bangalore',12.9715987,77.5945627,'residential','2026-06-01','2027-06-01',NULL,24500000.00,NULL,'2026-03-01','2026-12-15','active',1,1,1,1,1,1,1,1,'2026-06-16 15:18:47','2026-06-16 15:49:43','principal_only',NULL),(4,2,'primary','PROJ-HQ','NU Associates Head Office','Sterling Developers Ltd',1,'Indiranagar, Bengaluru',12.9784000,77.6408000,'commercial','2026-01-01','2026-12-31','BBMP',35000000.00,NULL,'2026-01-05','2026-12-25','active',1,1,1,1,1,1,1,1,'2026-06-16 15:49:43','2026-06-16 15:49:43','principal_only',NULL),(5,2,'primary','PROJ-EXP','Industrial Expansion Phase 2','Sterling Developers Ltd',1,'KIADB Industrial Area, Bangalore',NULL,NULL,'industrial','2026-06-01','2027-02-28',NULL,12000000.00,NULL,NULL,NULL,'initialising',1,0,0,0,0,0,0,1,'2026-06-16 16:18:03','2026-06-16 16:18:03','principal_only',NULL),(6,2,'primary','PROJ-MET','Metro Station Detailing','Sterling Developers Ltd',1,'Whitefield, Bangalore',NULL,NULL,'commercial','2026-07-01','2027-03-31',NULL,8500000.00,NULL,NULL,NULL,'initialising',1,0,0,1,0,0,0,1,'2026-06-16 16:18:03','2026-06-16 16:18:03','principal_only',NULL),(7,2,'primary','PV91','Test Production Line','Test Client',2,'Koramangala, Bengaluru',NULL,NULL,'industrial','2026-06-10','2027-02-14',NULL,NULL,NULL,'2026-06-10','2027-02-14','initialising',1,0,0,0,0,0,0,17,'2026-06-18 14:06:31','2026-06-18 14:06:31','principal_only',NULL);
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=207 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_nav`
--

LOCK TABLES `role_nav` WRITE;
/*!40000 ALTER TABLE `role_nav` DISABLE KEYS */;
INSERT INTO `role_nav` VALUES (1,'principal','home','dashboard',1,1,'2026-04-22 17:25:18'),(2,'principal','home','monthly',2,1,'2026-04-22 17:25:18'),(3,'principal','home','projects',3,1,'2026-04-22 17:25:18'),(4,'principal','home','project_detail',4,1,'2026-04-22 17:25:18'),(5,'principal','money','payments',1,1,'2026-04-22 17:25:18'),(6,'principal','money','vendors_master',2,1,'2026-04-22 17:25:18'),(7,'principal','money','budget',3,1,'2026-04-22 17:25:18'),(8,'principal','money','boq_mapping',4,1,'2026-04-22 17:25:18'),(9,'principal','money','client_boq',5,1,'2026-04-22 17:25:18'),(10,'principal','pending','pending',1,1,'2026-04-22 17:25:18'),(11,'principal','more','register',1,1,'2026-04-22 17:25:18'),(12,'principal','more','delegations',2,1,'2026-04-22 17:25:18'),(13,'principal','more','changes',3,1,'2026-04-22 17:25:18'),(14,'principal','more','weekly_health',4,1,'2026-04-22 17:25:18'),(15,'principal','more','users',5,1,'2026-04-22 17:25:18'),(16,'design_principal','home','dashboard',1,1,'2026-04-22 17:25:18'),(17,'design_principal','home','monthly',2,1,'2026-04-22 17:25:18'),(18,'design_principal','home','projects',3,1,'2026-04-22 17:25:18'),(19,'design_principal','home','project_detail',4,1,'2026-04-22 17:25:18'),(20,'design_principal','money','payments',1,1,'2026-04-22 17:25:18'),(21,'design_principal','money','vendors_master',2,1,'2026-04-22 17:25:18'),(22,'design_principal','money','budget',3,1,'2026-04-22 17:25:18'),(23,'design_principal','money','boq_mapping',4,1,'2026-04-22 17:25:18'),(24,'design_principal','money','client_boq',5,1,'2026-04-22 17:25:18'),(25,'design_principal','pending','pending',1,1,'2026-04-22 17:25:18'),(26,'design_principal','more','register',1,1,'2026-04-22 17:25:18'),(27,'design_principal','more','delegations',2,1,'2026-04-22 17:25:18'),(28,'design_principal','more','changes',3,1,'2026-04-22 17:25:18'),(29,'design_principal','more','weekly_health',4,1,'2026-04-22 17:25:18'),(30,'design_principal','more','users',5,1,'2026-04-22 17:25:18'),(31,'pmc_head','home','dashboard',1,1,'2026-04-22 17:25:18'),(32,'pmc_head','home','monthly',2,1,'2026-04-22 17:25:18'),(33,'pmc_head','home','project_detail',3,1,'2026-04-22 17:25:18'),(34,'pmc_head','work','reports',1,1,'2026-04-22 17:25:18'),(35,'pmc_head','work','issues',2,1,'2026-04-22 17:25:18'),(36,'pmc_head','work','meetings',3,1,'2026-04-22 17:25:18'),(37,'pmc_head','work','drawings',4,1,'2026-04-22 17:25:18'),(38,'pmc_head','work','register',5,1,'2026-04-22 17:25:18'),(39,'pmc_head','work','materials',6,1,'2026-04-22 17:25:18'),(40,'pmc_head','work','labour',7,1,'2026-04-22 17:25:18'),(41,'pmc_head','money','grn',1,1,'2026-04-22 17:25:18'),(42,'pmc_head','money','payments',2,1,'2026-04-22 17:25:18'),(43,'pmc_head','money','vendors',3,1,'2026-04-22 17:25:18'),(44,'pmc_head','money','vendors_master',4,1,'2026-04-22 17:25:18'),(45,'pmc_head','pending','pending',1,1,'2026-04-22 17:25:18'),(46,'design_head','home','dashboard',1,1,'2026-04-22 17:25:18'),(47,'design_head','home','monthly',2,1,'2026-04-22 17:25:18'),(48,'design_head','home','project_detail',3,1,'2026-04-22 17:25:18'),(49,'design_head','work','drawings',1,1,'2026-04-22 17:25:18'),(50,'design_head','work','issues',2,1,'2026-04-22 17:25:18'),(51,'design_head','work','submittals',3,1,'2026-04-22 17:25:18'),(52,'design_head','work','register',4,1,'2026-04-22 17:25:18'),(53,'design_head','work','phototags',5,1,'2026-04-22 17:25:18'),(54,'design_head','money','materials',1,1,'2026-04-22 17:25:18'),(55,'design_head','money','budget',2,1,'2026-04-22 17:25:18'),(56,'design_head','money','payments',3,1,'2026-04-22 17:25:18'),(57,'design_head','more','signoff',1,1,'2026-04-22 17:25:18'),(58,'design_head','more','delegations',2,1,'2026-04-22 17:25:18'),(59,'services_head','home','dashboard',1,1,'2026-04-22 17:25:18'),(60,'services_head','home','monthly',2,1,'2026-04-22 17:25:18'),(61,'services_head','home','project_detail',3,1,'2026-04-22 17:25:18'),(62,'services_head','work','drawings',1,1,'2026-04-22 17:25:18'),(63,'services_head','work','issues',2,1,'2026-04-22 17:25:18'),(64,'services_head','work','submittals',3,1,'2026-04-22 17:25:18'),(65,'services_head','work','register',4,1,'2026-04-22 17:25:18'),(66,'services_head','work','phototags',5,1,'2026-04-22 17:25:18'),(67,'services_head','money','materials',1,1,'2026-04-22 17:25:18'),(68,'services_head','money','budget',2,1,'2026-04-22 17:25:18'),(69,'services_head','money','payments',3,1,'2026-04-22 17:25:18'),(70,'services_head','more','signoff',1,1,'2026-04-22 17:25:18'),(71,'services_head','more','delegations',2,1,'2026-04-22 17:25:18'),(72,'site_manager','home','dashboard',1,1,'2026-04-22 17:25:18'),(73,'site_manager','home','project_detail',2,1,'2026-04-22 17:25:18'),(74,'site_manager','work','tasks',1,1,'2026-04-22 17:25:18'),(75,'site_manager','work','photos',2,1,'2026-04-22 17:25:18'),(76,'site_manager','work','issues_site',3,1,'2026-04-22 17:25:18'),(77,'site_manager','work','issues',4,1,'2026-04-22 17:25:18'),(78,'site_manager','work','labour',5,1,'2026-04-22 17:25:18'),(79,'site_manager','work','drawings',6,1,'2026-04-22 17:25:18'),(80,'site_manager','work','register',7,1,'2026-04-22 17:25:18'),(81,'site_manager','money','grn',1,1,'2026-04-22 17:25:18'),(82,'site_manager','money','payments',2,1,'2026-04-22 17:25:18'),(83,'site_manager','money','materials_site',3,1,'2026-04-22 17:25:18'),(84,'senior_site_manager','home','dashboard',1,1,'2026-04-22 17:25:18'),(85,'senior_site_manager','home','project_detail',2,1,'2026-04-22 17:25:18'),(86,'senior_site_manager','work','tasks',1,1,'2026-04-22 17:25:18'),(87,'senior_site_manager','work','photos',2,1,'2026-04-22 17:25:18'),(88,'senior_site_manager','work','issues_site',3,1,'2026-04-22 17:25:18'),(89,'senior_site_manager','work','issues',4,1,'2026-04-22 17:25:18'),(90,'senior_site_manager','work','labour',5,1,'2026-04-22 17:25:18'),(91,'senior_site_manager','work','drawings',6,1,'2026-04-22 17:25:18'),(92,'senior_site_manager','work','register',7,1,'2026-04-22 17:25:18'),(93,'senior_site_manager','money','grn',1,1,'2026-04-22 17:25:18'),(94,'senior_site_manager','money','payments',2,1,'2026-04-22 17:25:18'),(95,'senior_site_manager','money','materials_site',3,1,'2026-04-22 17:25:18'),(96,'finance_admin','home','dashboard',1,1,'2026-04-22 17:25:18'),(97,'finance_admin','home','monthly',2,1,'2026-04-22 17:25:18'),(98,'finance_admin','home','project_detail',3,1,'2026-04-22 17:25:18'),(99,'finance_admin','money','payments_fin',1,1,'2026-04-22 17:25:18'),(100,'finance_admin','money','vendors_master',2,1,'2026-04-22 17:25:18'),(101,'finance_admin','money','client_receipts',3,1,'2026-04-22 17:25:18'),(102,'finance_admin','money','petty_cash',4,1,'2026-04-22 17:25:18'),(103,'finance_admin','money','pi',5,1,'2026-04-22 17:25:18'),(104,'finance_admin','money','gst_statement',6,1,'2026-04-22 17:25:18'),(105,'finance_admin','money','client_boq',7,1,'2026-04-22 17:25:18'),(106,'finance_admin','money','clients',8,1,'2026-04-22 17:25:18'),(107,'team_lead','home','dashboard',1,1,'2026-04-22 17:25:18'),(108,'team_lead','home','project_detail',2,1,'2026-04-22 17:25:18'),(109,'team_lead','work','drawings',1,1,'2026-04-22 17:25:18'),(110,'team_lead','work','register',2,1,'2026-04-22 17:25:18'),(111,'team_lead','work','issues',3,1,'2026-04-22 17:25:18'),(112,'team_lead','work','submittals',4,1,'2026-04-22 17:25:18'),(113,'team_lead','work','phototags',5,1,'2026-04-22 17:25:18'),(121,'jr_architect','home','dashboard',1,1,'2026-04-22 17:25:18'),(122,'jr_architect','home','project_detail',2,1,'2026-04-22 17:25:18'),(123,'jr_architect','work','drawings',1,1,'2026-04-22 17:25:18'),(124,'jr_architect','work','issues',2,1,'2026-04-22 17:25:18'),(125,'jr_architect','work','submittals',3,1,'2026-04-22 17:25:18'),(126,'services_engineer','home','dashboard',1,1,'2026-04-22 17:25:18'),(127,'services_engineer','home','project_detail',2,1,'2026-04-22 17:25:18'),(128,'services_engineer','work','drawings',1,1,'2026-04-22 17:25:18'),(129,'services_engineer','work','issues',2,1,'2026-04-22 17:25:18'),(130,'services_engineer','work','submittals',3,1,'2026-04-22 17:25:18'),(131,'services_engineer','work','phototags',4,1,'2026-04-22 17:25:18'),(132,'coordinator','home','dashboard',1,1,'2026-04-22 17:25:18'),(133,'coordinator','home','project_detail',2,1,'2026-04-22 17:25:18'),(134,'coordinator','work','meetings',1,1,'2026-04-22 17:25:18'),(135,'coordinator','work','tasks',2,1,'2026-04-22 17:25:18'),(136,'coordinator','work','issues',3,1,'2026-04-22 17:25:18'),(137,'coordinator','work','drawings',4,1,'2026-04-22 17:25:18'),(138,'coordinator','work','register',5,1,'2026-04-22 17:25:18'),(139,'coordinator','work','photos',6,1,'2026-04-22 17:25:18'),(140,'coordinator','work','grn',7,1,'2026-04-22 17:25:18'),(141,'trainee','strip','drawings',1,1,'2026-04-22 17:25:18'),(142,'trainee','strip','schedule_view',2,1,'2026-04-22 17:25:18'),(145,'audit','home','dashboard',1,1,'2026-04-22 17:25:18'),(146,'audit','home','monthly',2,1,'2026-04-22 17:25:18'),(147,'audit','home','projects',3,1,'2026-04-22 17:25:18'),(148,'audit','home','project_detail',4,1,'2026-04-22 17:25:18'),(149,'audit','money','payments',1,1,'2026-04-22 17:25:18'),(150,'audit','money','payments_fin',2,1,'2026-04-22 17:25:18'),(151,'audit','money','vendors',3,1,'2026-04-22 17:25:18'),(152,'audit','money','vendors_master',4,1,'2026-04-22 17:25:18'),(153,'audit','money','finance_clearance',5,1,'2026-04-22 17:25:18'),(154,'audit','money','budget',6,1,'2026-04-22 17:25:18'),(155,'audit','money','budget_tree',7,1,'2026-04-22 17:25:18'),(156,'audit','money','boq_mapping',8,1,'2026-04-22 17:25:18'),(157,'audit','money','client_boq',9,1,'2026-04-22 17:25:18'),(158,'audit','money','materials',10,1,'2026-04-22 17:25:18'),(159,'audit','money','grn',11,1,'2026-04-22 17:25:18'),(160,'audit','money','pi',12,1,'2026-04-22 17:25:18'),(161,'audit','money','petty_cash',13,1,'2026-04-22 17:25:18'),(162,'audit','money','client_receipts',14,1,'2026-04-22 17:25:18'),(163,'audit','money','gst_statement',15,1,'2026-04-22 17:25:18'),(164,'audit','money','clients',16,1,'2026-04-22 17:25:18'),(165,'audit','pending','pending',1,1,'2026-04-22 17:25:18'),(166,'audit','more','register',1,1,'2026-04-22 17:25:18'),(167,'audit','more','drawings',2,1,'2026-04-22 17:25:18'),(168,'audit','more','submittals',3,1,'2026-04-22 17:25:18'),(169,'audit','more','issues',4,1,'2026-04-22 17:25:18'),(170,'audit','more','issues_site',5,1,'2026-04-22 17:25:18'),(171,'audit','more','tasks',6,1,'2026-04-22 17:25:18'),(172,'audit','more','photos',7,1,'2026-04-22 17:25:18'),(173,'audit','more','phototags',8,1,'2026-04-22 17:25:18'),(174,'audit','more','meetings',9,1,'2026-04-22 17:25:18'),(175,'audit','more','reports',10,1,'2026-04-22 17:25:18'),(176,'audit','more','labour',11,1,'2026-04-22 17:25:18'),(177,'audit','more','schedule_view',12,1,'2026-04-22 17:25:18'),(178,'audit','more','approvals',13,1,'2026-04-22 17:25:18'),(179,'audit','more','signoff',14,1,'2026-04-22 17:25:18'),(180,'audit','more','changes',15,1,'2026-04-22 17:25:18'),(181,'audit','more','delegations',16,1,'2026-04-22 17:25:18'),(182,'audit','more','deputy',17,1,'2026-04-22 17:25:18'),(183,'audit','more','weekly_health',18,1,'2026-04-22 17:25:18'),(184,'audit','more','users',19,1,'2026-04-22 17:25:18'),(185,'audit','more','ncr',20,1,'2026-04-22 17:25:18'),(186,'audit','more','compliance',21,1,'2026-04-22 17:25:18'),(187,'audit','more','tally',22,1,'2026-04-22 17:25:18'),(188,'audit','more','notifications',23,1,'2026-04-22 17:25:18'),(189,'it_admin','home','nav_editor',1,1,'2026-04-22 17:25:18'),(190,'principal','more','governance',50,1,'2026-04-22 17:25:19'),(191,'design_principal','more','governance',50,1,'2026-04-22 17:25:19'),(192,'principal','pending','flags',2,1,'2026-06-16 16:53:14'),(193,'pmc_head','pending','flags',2,1,'2026-06-16 16:53:14'),(194,'design_principal','pending','flags',2,1,'2026-06-16 16:53:14'),(195,'audit','pending','flags',2,1,'2026-06-16 16:53:14'),(196,'jr_engineer','strip','drawings',1,1,'2026-06-16 20:05:12'),(197,'jr_engineer','strip','submittals',2,1,'2026-06-16 20:05:12'),(198,'jr_engineer','strip','phototags',3,1,'2026-06-16 20:05:12'),(199,'jr_architect','work','phototags',30,1,'2026-06-16 22:23:23'),(200,'principal','more','ai_settings',99,1,'2026-06-16 22:23:23'),(201,'design_principal','more','ai_settings',99,1,'2026-06-16 22:23:23'),(202,'pmc_head','work','schedule_view',5,1,'2026-06-17 12:41:48'),(203,'principal','more','schedule_view',50,1,'2026-06-17 12:41:48'),(204,'design_principal','more','schedule_view',50,1,'2026-06-17 12:41:48'),(205,'site_manager','work','schedule_view',5,1,'2026-06-17 12:43:09'),(206,'senior_site_manager','work','schedule_view',5,1,'2026-06-17 12:43:09');
/*!40000 ALTER TABLE `role_nav` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,'principal','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),(2,'design_principal','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),(3,'pmc_head','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),(4,'finance_admin','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),(5,'design_head','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),(6,'services_head','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),(7,'principal','finance.petty-cash.write','W','Finance','Create petty cash entry','2026-04-22 17:25:19',NULL),(8,'design_principal','finance.petty-cash.write','W','Finance','Create petty cash entry','2026-04-22 17:25:19',NULL),(9,'pmc_head','finance.petty-cash.write','W','Finance','Create petty cash entry','2026-04-22 17:25:19',NULL),(10,'principal','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-22 17:25:19',NULL),(11,'design_principal','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-22 17:25:19',NULL),(12,'pmc_head','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-22 17:25:19',NULL),(13,'finance_admin','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-22 17:25:19',NULL),(14,'principal','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),(15,'design_principal','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),(16,'pmc_head','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),(17,'finance_admin','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),(18,'design_head','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),(19,'services_head','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),(20,'principal','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(21,'design_principal','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(22,'pmc_head','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(23,'design_head','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(24,'services_head','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(25,'finance_admin','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(26,'site_manager','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(27,'senior_site_manager','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(28,'principal','finance.payment-request.approve-pmc','A','Finance','PMC approve payment request','2026-04-22 17:25:19',NULL),(29,'design_principal','finance.payment-request.approve-pmc','A','Finance','PMC approve payment request','2026-04-22 17:25:19',NULL),(30,'pmc_head','finance.payment-request.approve-pmc','A','Finance','PMC approve payment request','2026-04-22 17:25:19',NULL),(31,'principal','finance.payment-request.approve-principal','A','Finance','Principal approve payment request','2026-04-22 17:25:19',NULL),(32,'design_principal','finance.payment-request.approve-principal','A','Finance','Principal approve payment request','2026-04-22 17:25:19',NULL),(33,'principal','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),(34,'design_principal','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),(35,'pmc_head','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),(36,'site_manager','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),(37,'senior_site_manager','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),(38,'finance_admin','finance.vendor-clearance.approve','A','Finance','Clear vendor','2026-04-22 17:25:19',NULL),(39,'principal','finance.vendor-pan.approve','A','Finance','Validate vendor PAN','2026-04-22 17:25:19',NULL),(40,'design_principal','finance.vendor-pan.approve','A','Finance','Validate vendor PAN','2026-04-22 17:25:19',NULL),(41,'finance_admin','finance.vendor-pan.approve','A','Finance','Validate vendor PAN','2026-04-22 17:25:19',NULL),(42,'principal','claims.raise','W','Services','Raise claim','2026-04-22 17:25:19',NULL),(43,'design_principal','claims.raise','W','Services','Raise claim','2026-04-22 17:25:19',NULL),(44,'pmc_head','claims.raise','W','Services','Raise claim','2026-04-22 17:25:19',NULL),(45,'principal','claims.pmc-signoff','A','Services','PMC sign-off claim','2026-04-22 17:25:19',NULL),(46,'design_principal','claims.pmc-signoff','A','Services','PMC sign-off claim','2026-04-22 17:25:19',NULL),(47,'pmc_head','claims.pmc-signoff','A','Services','PMC sign-off claim','2026-04-22 17:25:19',NULL),(48,'principal','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-22 17:25:19',NULL),(49,'design_principal','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-22 17:25:19',NULL),(50,'design_head','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-22 17:25:19',NULL),(51,'services_head','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-22 17:25:19',NULL),(52,'principal','claims.approve','A','Services','Approve claim (final)','2026-04-22 17:25:19',NULL),(53,'design_principal','claims.approve','A','Services','Approve claim (final)','2026-04-22 17:25:19',NULL),(54,'principal','claims.invoice','W','Services','Record invoice number on claim','2026-04-22 17:25:19',NULL),(55,'design_principal','claims.invoice','W','Services','Record invoice number on claim','2026-04-22 17:25:19',NULL),(56,'pmc_head','claims.invoice','W','Services','Record invoice number on claim','2026-04-22 17:25:19',NULL),(57,'principal','governance.change-notice.raise','W','Governance','Raise change notice','2026-04-22 17:25:19',NULL),(58,'design_principal','governance.change-notice.raise','W','Governance','Raise change notice','2026-04-22 17:25:19',NULL),(59,'principal','governance.change-notice.approve','A','Governance','Approve change notice','2026-04-22 17:25:19',NULL),(60,'design_principal','governance.change-notice.approve','A','Governance','Approve change notice','2026-04-22 17:25:19',NULL),(61,'principal','governance.weekly-report.send','A','Governance','Mark weekly report sent to client','2026-04-22 17:25:19',NULL),(62,'design_principal','governance.weekly-report.send','A','Governance','Mark weekly report sent to client','2026-04-22 17:25:19',NULL),(63,'principal','governance.anomaly.acknowledge','A','Governance','Acknowledge AI anomaly flag','2026-04-22 17:25:19',NULL),(64,'design_principal','governance.anomaly.acknowledge','A','Governance','Acknowledge AI anomaly flag','2026-04-22 17:25:19',NULL),(65,'pmc_head','governance.anomaly.acknowledge','A','Governance','Acknowledge AI anomaly flag','2026-04-22 17:25:19',NULL),(66,'principal','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),(67,'design_principal','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),(68,'pmc_head','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),(69,'design_head','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),(70,'services_head','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),(71,'principal','admin.user.approve','A','Admin','Approve new user','2026-04-22 17:25:19',NULL),(72,'design_principal','admin.user.approve','A','Admin','Approve new user','2026-04-22 17:25:19',NULL),(73,'principal','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),(74,'design_principal','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),(75,'pmc_head','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),(76,'design_head','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),(77,'services_head','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),(78,'finance_admin','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),(79,'principal','admin.nav.approve','A','Admin','Edit nav / role tabs','2026-04-22 17:25:19',NULL),(80,'it_admin','admin.nav.propose','W','Admin','Propose nav / role tab changes','2026-04-22 17:25:19',NULL),(81,'principal','admin.password-reset','W','Admin','Reset another user password (unrestricted)','2026-04-22 17:25:19',NULL),(82,'design_principal','admin.password-reset','W','Admin','Reset another user password (unrestricted)','2026-04-22 17:25:19',NULL),(83,'it_admin','admin.password-reset','W','Admin','Reset another user password (unrestricted)','2026-04-22 17:25:19',NULL),(84,'principal','workflow.submittal.review','A','Workflow','Review submittal','2026-06-19 10:18:55',NULL),(85,'design_principal','workflow.submittal.review','A','Workflow','Review submittal','2026-06-19 10:18:55',NULL),(86,'pmc_head','workflow.submittal.review','A','Workflow','Review submittal','2026-06-19 10:18:55',NULL),(87,'design_head','workflow.submittal.review','A','Workflow','Review submittal','2026-06-19 10:18:55',NULL),(88,'services_head','workflow.submittal.review','A','Workflow','Review submittal','2026-06-19 10:18:55',NULL);
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

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
  `planned_pct` decimal(5,2) NOT NULL,
  `actual_pct` decimal(5,2) NOT NULL,
  `gap_pct` decimal(5,2) NOT NULL,
  `weeks_behind` decimal(4,1) NOT NULL DEFAULT '0.0',
  `forecast_delay` decimal(4,1) NOT NULL DEFAULT '0.0',
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
  PRIMARY KEY (`id`),
  KEY `schedule_version_id` (`schedule_version_id`),
  KEY `depends_on_task_id` (`depends_on_task_id`),
  KEY `idx_schedule_tasks_project` (`project_id`,`schedule_version_id`),
  CONSTRAINT `schedule_tasks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `schedule_tasks_ibfk_2` FOREIGN KEY (`schedule_version_id`) REFERENCES `schedule_versions` (`id`),
  CONSTRAINT `schedule_tasks_ibfk_3` FOREIGN KEY (`depends_on_task_id`) REFERENCES `schedule_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_st_dates` CHECK ((`end_date` >= `start_date`))
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_tasks`
--

LOCK TABLES `schedule_tasks` WRITE;
/*!40000 ALTER TABLE `schedule_tasks` DISABLE KEYS */;
INSERT INTO `schedule_tasks` VALUES (1,1,1,'Civil','Site mobilisation','2026-03-23','2026-03-25',NULL,1,0,'schedule','Mobilisation complete',1,0,'not_started','2026-06-18 00:36:47','2026-04-22 17:25:19'),(2,1,1,'Civil','Foundation excavation','2026-03-26','2026-04-02',NULL,0,0,'none',NULL,2,0,'not_started','2026-06-18 00:36:47','2026-04-22 17:25:19'),(3,1,1,'Civil','Foundation concrete','2026-04-03','2026-04-10',NULL,1,0,'both','Foundation cast',3,0,'not_started','2026-06-18 00:36:47','2026-04-22 17:25:19'),(4,1,1,'Civil','Floor slab + columns','2026-04-11','2026-04-24',NULL,0,0,'none',NULL,4,0,'not_started','2026-06-18 00:36:47','2026-04-22 17:25:19'),(5,1,1,'Electrical','Conduit rough-in','2026-04-15','2026-04-25',NULL,0,0,'none',NULL,5,0,'not_started','2026-06-18 00:36:47','2026-04-22 17:25:19'),(6,1,1,'Electrical','Cable pulling','2026-04-26','2026-05-05',NULL,0,0,'none',NULL,6,0,'not_started','2026-06-18 00:36:47','2026-04-22 17:25:19'),(7,1,1,'Electrical','Panel termination','2026-05-06','2026-05-12',NULL,1,0,'payment','Power-on milestone',7,0,'not_started','2026-06-18 00:36:47','2026-04-22 17:25:19'),(8,1,1,'HVAC','Ductwork install','2026-04-28','2026-05-08',NULL,0,0,'none',NULL,8,0,'not_started','2026-06-18 00:36:47','2026-04-22 17:25:19'),(9,1,1,'HVAC','AHU commissioning','2026-05-10','2026-05-18',NULL,1,0,'payment','HVAC live',9,0,'not_started','2026-06-18 00:36:47','2026-04-22 17:25:19'),(10,1,1,'Civil','Snagging + handover','2026-05-19','2026-05-25',NULL,1,0,'both','Practical completion',10,0,'not_started','2026-06-18 00:36:47','2026-04-22 17:25:19'),(15,2,2,'Civil','Civil Foundations','2026-03-01','2026-06-01',NULL,0,0,'none',NULL,1,0,'in_progress','2026-06-18 00:36:47','2026-06-16 16:18:45'),(16,2,2,'Civil','Superstructure Works','2026-06-02','2026-09-01',NULL,0,0,'none',NULL,2,0,'not_started','2026-06-18 00:36:47','2026-06-16 16:18:45'),(17,2,2,'Electrical','Electrical Cabling & Conduit','2026-09-02','2026-10-31',NULL,0,0,'none',NULL,3,0,'not_started','2026-06-18 00:36:47','2026-06-16 16:18:45'),(18,2,2,'HVAC','HVAC Ducting & Install','2026-11-01','2026-12-10',NULL,0,0,'none',NULL,4,0,'not_started','2026-06-18 00:36:47','2026-06-16 16:18:45'),(19,3,5,'Civil','Civil Foundations','2026-03-01','2026-06-01',NULL,0,0,'none',NULL,1,0,'in_progress','2026-06-18 00:36:47','2026-06-16 16:18:45'),(20,3,5,'Civil','Superstructure Works','2026-06-02','2026-09-01',NULL,0,0,'none',NULL,2,0,'not_started','2026-06-18 00:36:47','2026-06-16 16:18:45'),(21,3,5,'Electrical','Electrical Cabling & Conduit','2026-09-02','2026-10-31',NULL,0,0,'none',NULL,3,0,'not_started','2026-06-18 00:36:47','2026-06-16 16:18:45'),(22,3,5,'HVAC','HVAC Ducting & Install','2026-11-01','2026-12-10',NULL,0,0,'none',NULL,4,0,'not_started','2026-06-18 00:36:47','2026-06-16 16:18:45'),(23,4,6,'Civil','Civil Foundations','2026-03-01','2026-06-01',NULL,0,0,'none',NULL,1,0,'in_progress','2026-06-18 00:36:47','2026-06-16 16:18:45'),(24,4,6,'Civil','Superstructure Works','2026-06-02','2026-09-01',NULL,0,0,'none',NULL,2,0,'not_started','2026-06-18 00:36:47','2026-06-16 16:18:45'),(25,4,6,'Electrical','Electrical Cabling & Conduit','2026-09-02','2026-10-31',NULL,0,0,'none',NULL,3,0,'not_started','2026-06-18 00:36:47','2026-06-16 16:18:45'),(26,4,6,'HVAC','HVAC Ducting & Install','2026-11-01','2026-12-10',NULL,0,0,'none',NULL,4,0,'not_started','2026-06-18 00:36:47','2026-06-16 16:18:45');
/*!40000 ALTER TABLE `schedule_tasks` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `schedule_versions`
--

LOCK TABLES `schedule_versions` WRITE;
/*!40000 ALTER TABLE `schedule_versions` DISABLE KEYS */;
INSERT INTO `schedule_versions` VALUES (1,1,1,0,'R0','2026-05-25',0,'approved',NULL,1,NULL,NULL,NULL,1,0,NULL,NULL,NULL,'2026-04-22 17:25:19'),(2,1,2,0,'R0','2026-12-15',0,'approved',NULL,1,1,NULL,NULL,1,0,NULL,NULL,NULL,'2026-06-16 16:18:17'),(3,1,2,0,'R0','2026-12-15',0,'approved',NULL,1,1,NULL,NULL,1,0,NULL,NULL,NULL,'2026-06-16 16:18:31'),(4,1,2,0,'R0','2026-12-15',0,'approved',NULL,1,1,NULL,NULL,1,0,NULL,NULL,NULL,'2026-06-16 16:18:45'),(5,1,3,0,'R0','2026-12-15',0,'approved',NULL,1,1,NULL,NULL,1,0,NULL,NULL,NULL,'2026-06-16 16:18:45'),(6,1,4,0,'R0','2026-12-25',0,'approved',NULL,1,1,NULL,NULL,1,0,NULL,NULL,NULL,'2026-06-16 16:18:45');
/*!40000 ALTER TABLE `schedule_versions` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `security_config`
--

LOCK TABLES `security_config` WRITE;
/*!40000 ALTER TABLE `security_config` DISABLE KEYS */;
INSERT INTO `security_config` VALUES ('canary_time','06:00','When the daily canary suite runs. HH:MM in IST.','2026-05-09 07:01:31'),('max_vote_window_minutes','1440','Hard cap on poll closing_minutes; rejected at gate if exceeded.','2026-05-09 07:01:31'),('signoff_lock_after_close_minutes','5','Grace period after a poll closes before vote rows become read-only.','2026-05-09 07:01:31'),('vendor_bank_alert_days','90','Days after a vendor bank change within which the first payment triggers a Naveen FYI alert.','2026-05-09 07:01:31'),('vendor_bank_change_cooling_hours','24','V7 vendor-confirm cooling window. UNUSED while V8 peer-approval model is in effect.','2026-05-09 07:01:31');
/*!40000 ALTER TABLE `security_config` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES ('o0VD0HSLFG124GKK5sS6DNcv20GuOiKi',1781809832,'{\"cookie\":{\"originalMaxAge\":28800000,\"expires\":\"2026-06-18T19:06:28.149Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"strict\"},\"user\":{\"id\":17,\"username\":\"user1\",\"full_name\":\"Dev Tester\",\"role\":\"site_manager\",\"stream\":\"all\",\"managed_by\":null,\"matrix_room_id\":null,\"matrix_user_id\":null,\"force_password_change\":false,\"projects\":[{\"id\":2,\"code\":\"PROJ-IND\",\"name\":\"Industrial Warehouse Complex\",\"client\":\"Sterling Developers Ltd\",\"location\":\"KIADB Industrial Area, Bangalore\",\"status\":\"active\",\"r0_start_date\":\"2026-05-31T18:30:00.000Z\",\"r0_end_date\":\"2027-05-31T18:30:00.000Z\"},{\"id\":4,\"code\":\"PROJ-HQ\",\"name\":\"NU Associates Head Office\",\"client\":\"Sterling Developers Ltd\",\"location\":\"Indiranagar, Bengaluru\",\"status\":\"active\",\"r0_start_date\":\"2025-12-31T18:30:00.000Z\",\"r0_end_date\":\"2026-12-30T18:30:00.000Z\"},{\"id\":1,\"code\":\"PV90\",\"name\":\"PV 90 Production Line\",\"client\":\"TLD MAINI GSE Pvt Ltd\",\"location\":\"Nelamangala, Bengaluru\",\"status\":\"active\",\"r0_start_date\":\"2026-03-22T18:30:00.000Z\",\"r0_end_date\":\"2026-05-24T18:30:00.000Z\"},{\"id\":3,\"code\":\"PROJ-RES\",\"name\":\"Residential Green Villa Complex\",\"client\":\"Sterling Developers Ltd\",\"location\":\"Whitefield, Bangalore\",\"status\":\"active\",\"r0_start_date\":\"2026-05-31T18:30:00.000Z\",\"r0_end_date\":\"2027-05-31T18:30:00.000Z\"}],\"projects_at\":1781780788130,\"real_role\":\"principal\"},\"csrf_token\":\"5b47ac11646b85bf075ec50117e795cfefbf91527e8e636d2ccfb15038ff00a5\"}');
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `setup_checklist_items`
--

LOCK TABLES `setup_checklist_items` WRITE;
/*!40000 ALTER TABLE `setup_checklist_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `setup_checklist_items` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `setup_checklist_templates`
--

LOCK TABLES `setup_checklist_templates` WRITE;
/*!40000 ALTER TABLE `setup_checklist_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `setup_checklist_templates` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `signoff_instances`
--

LOCK TABLES `signoff_instances` WRITE;
/*!40000 ALTER TABLE `signoff_instances` DISABLE KEYS */;
INSERT INTO `signoff_instances` VALUES (1,'grn_vendor_confirm',19,2,NULL,NULL,2,'[]','[2]','GRN GRN-009 ΓÇö 150 sqm received ΓÇö Γé╣1,50,000. Confirm delivery matches?','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-18 13:59:49',NULL,17,'2026-06-17 13:59:48','2026-06-17 13:59:48',NULL),(2,'grn_vendor_confirm',20,2,NULL,NULL,2,'[]','[2]','GRN GRN-010 ΓÇö 140 sqm received ΓÇö Γé╣1,40,000. Confirm delivery matches?','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-18 14:08:31',NULL,17,'2026-06-17 14:08:30','2026-06-17 14:08:30',NULL),(3,'drawing_approval_services',11,2,NULL,NULL,5,'[]','[5]','DRW-HVAC-401 R0 ΓÇö Power Layout Diagram ΓÇö approval required.','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-18 14:31:06',NULL,17,'2026-06-17 14:31:05','2026-06-17 14:31:05',NULL),(4,'grn_vendor_confirm',21,2,NULL,NULL,1,'[]','[1]','GRN GRN-011 ΓÇö 150 sqm received ΓÇö Γé╣1,50,000. Confirm delivery matches?','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-18 14:34:29',NULL,17,'2026-06-17 14:34:29','2026-06-17 14:34:29',NULL),(5,'grn_vendor_confirm',22,2,NULL,NULL,3,'[]','[3]','GRN GRN-012 ΓÇö 1545 bags received ΓÇö Γé╣18,55,545. Confirm delivery matches?','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-18 14:50:02',NULL,17,'2026-06-17 14:50:01','2026-06-17 14:50:01',NULL),(6,'grn_vendor_confirm',23,2,NULL,NULL,1,'[]','[1]','GRN GRN-013 ΓÇö 1450 bags received ΓÇö Γé╣1,45,00,000. Confirm delivery matches?','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-18 14:51:01',NULL,17,'2026-06-17 14:51:01','2026-06-17 14:51:01',NULL),(7,'grn_vendor_confirm',24,2,NULL,NULL,2,'[]','[2]','GRN GRN-014 ΓÇö 1 bag received ΓÇö Γé╣1. Confirm delivery matches?','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-18 15:19:17',NULL,17,'2026-06-17 15:19:17','2026-06-17 15:19:17',NULL);
/*!40000 ALTER TABLE `signoff_instances` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `signoff_sequence_rules`
--

LOCK TABLES `signoff_sequence_rules` WRITE;
/*!40000 ALTER TABLE `signoff_sequence_rules` DISABLE KEYS */;
INSERT INTO `signoff_sequence_rules` VALUES (1,'change_notice',10,'always','strip_initiator',NULL,'CN initiator does not approve own document',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(2,'change_notice',20,'is_emergency','skip_role','design_lead','Emergency CN ΓÇö Design ratifies after, not before',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(3,'change_notice',30,'below_threshold','skip_role','principal','Below 1% threshold ΓÇö PMC + Design only',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(4,'change_notice',90,'external_origin','append_role','client_rep','External CN closes with client confirmation',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(5,'project_closure',20,'no_snags','skip_role','design_lead','No snags ever raised ΓÇö Design Lead has nothing to confirm cleared',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(6,'project_closure',30,'settlement_pending','skip_role','finance','Final settlement not complete ΓÇö Finance step deferred and resumed',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(7,'drawing_approval',20,'is_services_stream','skip_role','design_lead','services drawing ΓÇö design lead does not approve',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(8,'drawing_approval',20,'is_design_stream','skip_role','services_head','design drawing ΓÇö services head does not approve',1,'2026-05-09 07:01:31','2026-05-09 07:01:31'),(9,'vendor_bank_peer_approve',10,'always','strip_initiator',NULL,'V8 separation of duties ΓÇö proposer cannot approve their own bank-change proposal',1,'2026-05-09 07:01:31','2026-05-09 07:01:31');
/*!40000 ALTER TABLE `signoff_sequence_rules` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `signoff_votes`
--

LOCK TABLES `signoff_votes` WRITE;
/*!40000 ALTER TABLE `signoff_votes` DISABLE KEYS */;
/*!40000 ALTER TABLE `signoff_votes` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `signoff_workflows`
--

LOCK TABLES `signoff_workflows` WRITE;
/*!40000 ALTER TABLE `signoff_workflows` DISABLE KEYS */;
INSERT INTO `signoff_workflows` VALUES (1,'daily_report','poll',1,120,NULL,'pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(2,'grn_approval','poll',1,120,NULL,'pmc',NULL,0,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(3,'snag_rectified','poll',1,60,NULL,'pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(4,'mom_acknowledgement','poll',1,1440,NULL,'client_rep',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL),(5,'drawing_query_ack','poll',1,1440,NULL,'pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL),(6,'payment_batch','poll',2,NULL,NULL,'finance,naveen',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','finance'),(7,'weekly_report','poll',2,NULL,NULL,'pmc,principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(8,'final_settlement','poll',3,NULL,2.00,'finance,naveen,principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','finance'),(9,'dlp_signoff','poll',3,NULL,NULL,'design_lead,services_head,pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(10,'change_notice','poll',0,NULL,1.00,'site_manager,pmc,design_lead,principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(11,'project_closure','poll',0,NULL,NULL,'site_manager,design_lead,finance,principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(12,'handover_checklist','poll',2,NULL,NULL,'pmc,client_rep',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(13,'cn_design_ratification','poll',1,2880,NULL,'design_lead',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL),(14,'issue_confirm','poll',1,1440,NULL,'pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(15,'urgent_payment_fyi','poll',1,240,NULL,'pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(16,'drawing_approval','poll',1,1440,NULL,'design_lead,services_head',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project','internal'),(17,'vendor_bank_peer_approve','poll',1,NULL,NULL,'finance,principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','org','internal_finance'),(18,'vendor_bank_vendor_confirm','poll',1,4320,NULL,'vendor_rep',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL),(19,'ncr_endorsement','poll',1,2880,NULL,'principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(20,'payment_request_finance_review','poll',1,480,NULL,'finance_admin',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(21,'petty_cash_replenishment','poll',1,480,NULL,'finance_admin',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(22,'submittal_pmc_review','poll',1,1440,NULL,'pmc',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(23,'submittal_design_review','poll',1,1440,NULL,'design_head',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(24,'submittal_services_review','poll',1,1440,NULL,'services_head',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(25,'drawing_approval_design','poll',1,1440,NULL,'design_head',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(26,'drawing_approval_services','poll',1,1440,NULL,'services_head',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(27,'measurement_approval','poll',1,1440,NULL,'services_head',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','project',NULL),(28,'grn_vendor_confirm','poll',1,1440,NULL,'vendor_rep',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL),(29,'vendor_boq_acceptance','poll',1,2880,NULL,'vendor_rep',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL),(30,'vendor_onboarding','poll',2,2880,NULL,'finance,principal',NULL,1,'2026-05-09 07:01:31','2026-05-09 07:01:31','personal',NULL);
/*!40000 ALTER TABLE `signoff_workflows` ENABLE KEYS */;
UNLOCK TABLES;

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
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `accuracy` decimal(8,2) DEFAULT NULL,
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
-- Dumping data for table `submittals`
--

LOCK TABLES `submittals` WRITE;
/*!40000 ALTER TABLE `submittals` DISABLE KEYS */;
INSERT INTO `submittals` VALUES (1,2,'SUB-001',1,'Concrete Strength Test Report','test_report',10,'2026-06-16 15:20:17','uploads/documents/concrete_test_m30.pdf',5,NULL,'under_review',NULL,0);
/*!40000 ALTER TABLE `submittals` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `task_updates`
--

LOCK TABLES `task_updates` WRITE;
/*!40000 ALTER TABLE `task_updates` DISABLE KEYS */;
INSERT INTO `task_updates` VALUES (1,15,2,'2026-06-16',25,'Foundations 25% complete',1,'Excavation machinery breakdown causing 3-day delay.',3,'2026-06-16 16:18:45',NULL,0,NULL,NULL,NULL),(2,19,3,'2026-06-16',25,'Foundations 25% complete',1,'Water ingress detected at foundation level, waterproofing team notified.',3,'2026-06-16 16:18:45',NULL,0,NULL,NULL,NULL),(3,23,4,'2026-06-16',25,'Foundations 25% complete',1,'Steel structural member delivery delayed by logistics vendor.',3,'2026-06-16 16:18:45',NULL,0,NULL,NULL,NULL),(4,1,1,'2026-06-16',30,'Weekly site status update with flag alert.',1,'Slab reinforcement inspection failed, structural review required.',3,'2026-06-16 16:20:19',NULL,0,NULL,NULL,NULL),(10,3,1,'2026-04-08',45,'Concrete pour delayed due to rain',1,'Foundation concrete is running 5 days behind planned completion. Rain-related delays have impacted curing schedule. Needs rescheduling.',11,'2026-06-16 16:31:36',NULL,0,NULL,NULL,NULL),(11,5,1,'2026-04-23',30,'Conduit materials not delivered on site',1,'Conduit rough-in blocked ΓÇö materials delivery delayed by supplier. Civil works still ongoing on same floor. Risk of cascading delay on electrical schedule.',11,'2026-06-16 16:31:36',NULL,0,NULL,NULL,NULL),(12,8,1,'2026-05-06',60,'Ductwork install partially complete, coordination issues with civil',1,'HVAC ductwork installation behind by 3 days. Coordination conflict with slab shuttering team. Ceiling plenum access blocked.',11,'2026-06-16 16:31:36',NULL,0,NULL,NULL,NULL),(13,15,2,'2026-05-20',55,'Foundation works partially stalled ΓÇö soil contamination discovered',1,'Soil contamination found in Zone B during excavation. Additional geotechnical survey ordered. Estimated 2-week delay to civil foundations milestone.',11,'2026-06-16 16:31:36',NULL,0,NULL,NULL,NULL),(14,17,2,'2026-10-15',20,'Electrical subcontractor mobilisation delayed',1,'Electrical cabling subcontractor has not mobilised as planned. Only 20% progress vs 40% planned. Risk of not meeting October 31 deadline.',11,'2026-06-16 16:31:36',NULL,0,NULL,NULL,NULL),(15,19,3,'2026-05-18',40,'Foundation piling delayed ΓÇö equipment breakdown',1,'Piling rig breakdown has caused 4-day stoppage. Only 40% of piles cast. Catch-up plan required from contractor.',11,'2026-06-16 16:31:36',NULL,0,NULL,NULL,NULL),(16,21,3,'2026-10-10',15,'Electrical package not awarded yet',1,'Electrical cabling & conduit work not started ΓÇö subcontract package still under negotiation. Serious risk to overall programme.',11,'2026-06-16 16:31:36',NULL,0,NULL,NULL,NULL),(17,22,3,'2026-11-20',0,'HVAC works cannot start until electrical conduit complete',1,'HVAC ducting cannot begin as electrical conduit is incomplete. Cascading delay risk. Contractor requested 3-week extension.',11,'2026-06-16 16:31:36',NULL,0,NULL,NULL,NULL),(18,23,4,'2026-05-10',65,'Reinforcement bar shortage causing delays',1,'TMT rebar supply constrained due to market shortage. Foundation work is 35% behind plan. Alternative supplier identified but lead time is 10 days.',11,'2026-06-16 16:31:36',NULL,0,NULL,NULL,NULL),(19,25,4,'2026-10-05',25,'Conduit installation quality issues flagged',1,'QA inspection found conduit bends non-compliant with specification in Level 2 office area. Contractor instructed to rectify. Progress halted for 3 areas.',11,'2026-06-16 16:31:36',NULL,0,NULL,NULL,NULL),(20,16,2,'2026-06-16',0,NULL,0,NULL,17,'2026-06-16 20:26:14',NULL,0,NULL,NULL,NULL);
/*!40000 ALTER TABLE `task_updates` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tds_records` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `pi_id` int unsigned NOT NULL,
  `receipt_id` int unsigned NOT NULL,
  `tds_amount` decimal(14,2) NOT NULL,
  `tds_rate` decimal(5,2) NOT NULL DEFAULT '10.00',
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
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'principal','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Principal','principal','all',NULL,NULL,NULL,NULL,1,1,3,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:17:48'),(2,'design_principal','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Design Principal','design_principal','all',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(3,'pmc_head','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','PMC Head','pmc_head','pmc',NULL,NULL,NULL,NULL,1,1,3,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:17:11'),(4,'design_head','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Design Head','design_head','design',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(5,'services_head','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Services Head','services_head','services',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(6,'team_lead','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Team Lead','team_lead','design',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(7,'jr_architect','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Junior Architect','jr_architect','design',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(8,'jr_engineer','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Jr Engineer','jr_engineer','design',NULL,NULL,NULL,NULL,1,1,3,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:17:29'),(9,'services_eng','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Services Eng','services_engineer','services',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(10,'coordinator','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Coordinator','coordinator','design',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(11,'site_manager','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Site Manager','site_manager','site',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(12,'sr_site_manager','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Sr Site Manager','senior_site_manager','site',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(13,'finance_admin','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Finance Admin','finance_admin','all',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(14,'trainee','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Trainee','trainee','all',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(15,'audit','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Audit Account','audit','all',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(16,'it_admin','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','IT Admin','it_admin','all',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32'),(17,'user1','$2a$10$zaNW983ik2EDVA/pfrbZwuuhtBNgh2wlrhkb01VjWmalxui/HYFpS','Dev Tester','principal','all',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-16 16:01:30','2026-06-17 12:16:32');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `vendor_acknowledgements`
--

LOCK TABLES `vendor_acknowledgements` WRITE;
/*!40000 ALTER TABLE `vendor_acknowledgements` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_acknowledgements` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `vendor_alerts`
--

LOCK TABLES `vendor_alerts` WRITE;
/*!40000 ALTER TABLE `vendor_alerts` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_alerts` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `vendor_bank_change_approvals`
--

LOCK TABLES `vendor_bank_change_approvals` WRITE;
/*!40000 ALTER TABLE `vendor_bank_change_approvals` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_bank_change_approvals` ENABLE KEYS */;
UNLOCK TABLES;

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
  `our_cost_rate` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `our_cost_total` decimal(14,4) NOT NULL DEFAULT '0.0000',
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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_boq_mapping` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `engagement_id` int unsigned NOT NULL,
  `boq_item_id` int unsigned NOT NULL,
  `split_pct` decimal(5,2) DEFAULT NULL,
  `notes` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mapped_by` int unsigned NOT NULL,
  `ai_suggested` tinyint(1) NOT NULL DEFAULT '0',
  `ai_confidence` decimal(4,3) DEFAULT NULL,
  `confirmed_by` int unsigned DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
-- Dumping data for table `vendor_contacts`
--

LOCK TABLES `vendor_contacts` WRITE;
/*!40000 ALTER TABLE `vendor_contacts` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_contacts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_contract_history`
--

DROP TABLE IF EXISTS `vendor_contract_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_contract_history` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `engagement_id` int unsigned NOT NULL,
  `previous_value` decimal(14,2) NOT NULL,
  `revised_value` decimal(14,2) NOT NULL,
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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_engagements` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int unsigned NOT NULL,
  `project_id` int unsigned NOT NULL,
  `scope` varchar(300) COLLATE utf8mb4_general_ci NOT NULL,
  `contract_value` decimal(14,2) DEFAULT NULL,
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
-- Dumping data for table `vendor_engagements`
--

LOCK TABLES `vendor_engagements` WRITE;
/*!40000 ALTER TABLE `vendor_engagements` DISABLE KEYS */;
INSERT INTO `vendor_engagements` VALUES (1,1,1,'Civil & Structural Works',4500000.00,'active',NULL,NULL,1,'approved',1,'2026-04-22 17:25:19',NULL,1,NULL,'2026-04-22 17:25:19'),(2,2,1,'Electrical Installation',3200000.00,'active',NULL,NULL,1,'approved',1,'2026-04-22 17:25:19',NULL,1,NULL,'2026-04-22 17:25:19'),(3,3,1,'HVAC Systems',2800000.00,'not_started',NULL,NULL,1,'approved',1,'2026-04-22 17:25:19',NULL,1,NULL,'2026-04-22 17:25:19'),(7,1,2,'Civil & Structural Works',4500000.00,'active',NULL,NULL,1,'approved',1,'2026-06-16 15:49:53',NULL,1,NULL,'2026-06-16 15:49:53'),(8,2,2,'Electrical Installation',3200000.00,'active',NULL,NULL,1,'approved',1,'2026-06-16 15:49:53',NULL,1,NULL,'2026-06-16 15:49:53'),(9,3,2,'HVAC Systems',2800000.00,'active',NULL,NULL,1,'approved',1,'2026-06-16 15:49:53',NULL,1,NULL,'2026-06-16 15:49:53'),(10,1,3,'Civil & Structural Works',4500000.00,'active',NULL,NULL,1,'approved',1,'2026-06-16 15:49:53',NULL,1,NULL,'2026-06-16 15:49:53'),(11,2,3,'Electrical Installation',3200000.00,'active',NULL,NULL,1,'approved',1,'2026-06-16 15:49:53',NULL,1,NULL,'2026-06-16 15:49:53'),(12,3,3,'HVAC Systems',2800000.00,'active',NULL,NULL,1,'approved',1,'2026-06-16 15:49:53',NULL,1,NULL,'2026-06-16 15:49:53'),(13,1,4,'Civil & Structural Works',4500000.00,'active',NULL,NULL,1,'approved',1,'2026-06-16 15:49:53',NULL,1,NULL,'2026-06-16 15:49:53'),(14,2,4,'Electrical Installation',3200000.00,'active',NULL,NULL,1,'approved',1,'2026-06-16 15:49:53',NULL,1,NULL,'2026-06-16 15:49:53'),(15,3,4,'HVAC Systems',2800000.00,'active',NULL,NULL,1,'approved',1,'2026-06-16 15:49:53',NULL,1,NULL,'2026-06-16 15:49:53');
/*!40000 ALTER TABLE `vendor_engagements` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `vendor_onboarding_tokens`
--

LOCK TABLES `vendor_onboarding_tokens` WRITE;
/*!40000 ALTER TABLE `vendor_onboarding_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_onboarding_tokens` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_payments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `vendor_id` int unsigned NOT NULL,
  `engagement_id` int unsigned NOT NULL,
  `payment_type` enum('running_account_bill','advance','mobilisation_advance','material_advance','final_bill','retention_release','extra_item','deduction') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'running_account_bill',
  `amount_requested` decimal(14,2) NOT NULL,
  `work_done_pct` decimal(5,2) DEFAULT NULL,
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
  `recommended_amount` decimal(14,2) DEFAULT NULL,
  `actual_amount` decimal(14,2) DEFAULT NULL,
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
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (1,'Civil','BlueStone Constructions','Ravi K','+919900010001','29ABCDE1234F1Z1','HDFC Bank','50100012345678','HDFC0001234',1,'ABCDE1234F',1,NULL,NULL,1,NULL,'pending',NULL,NULL,NULL,NULL,1,NULL,'2026-04-22 17:25:19',0,NULL,NULL,NULL,NULL,'not_invited'),(2,'Electrical','VoltEdge Systems','Suresh M','+919900010002','29FGHIJ5678K2Z2','ICICI Bank','001701012345','ICIC0000017',1,'FGHIJ5678K',1,NULL,NULL,1,NULL,'pending',NULL,NULL,NULL,NULL,1,NULL,'2026-04-22 17:25:19',0,NULL,NULL,NULL,NULL,'not_invited'),(3,'HVAC','CoolAir Mechanical','Praveen N','+919900010003','29LMNOP9012Q3Z3','SBI','30012345678','SBIN0001234',1,'LMNOP9012Q',1,NULL,NULL,1,NULL,'pending',NULL,NULL,NULL,NULL,1,NULL,'2026-04-22 17:25:19',0,NULL,NULL,NULL,NULL,'not_invited');
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `wa_pending_actions`
--

LOCK TABLES `wa_pending_actions` WRITE;
/*!40000 ALTER TABLE `wa_pending_actions` DISABLE KEYS */;
INSERT INTO `wa_pending_actions` VALUES (1,2,'drawing_approval','Drawing DRW-STR-101 rev R0','Ready for principal approval (L2)',NULL,NULL,17,'2026-06-17 12:51:14',NULL,NULL,NULL,10,'drawing_versions',NULL,NULL,'Drawing DRW-STR-101 rev R0','2026-06-17 12:51:14',NULL,NULL,'app',NULL,NULL,'pending',NULL,NULL);
/*!40000 ALTER TABLE `wa_pending_actions` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `weekly_reports`
--

LOCK TABLES `weekly_reports` WRITE;
/*!40000 ALTER TABLE `weekly_reports` DISABLE KEYS */;
INSERT INTO `weekly_reports` VALUES (5,2,'2026-06-07',18,'Progress on structural works. Foundations completed, columns rising.','Minor delays due to local rains, catch-up plan initiated.','approved',3,1,'2026-06-16 20:53:36',NULL,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-16 20:53:36','2026-06-16 20:53:36'),(6,2,'2026-06-14',19,'Slab reinforcement complete. Casting scheduled for tomorrow.','Electrical conduit drawing clarifications resolved.','approved',3,17,'2026-06-18 01:07:51',NULL,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-16 20:53:36','2026-06-18 01:07:51'),(7,3,'2026-06-14',15,'Excavation completed. PCC casting in progress.','PCC approvals received.','draft',3,NULL,NULL,NULL,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-16 20:53:36','2026-06-16 20:53:36'),(8,4,'2026-06-14',24,'Fa├ºade fabrication started at factory. Site waterproofing progressing.','Waterproofing material inspection scheduled.','sent',3,1,'2026-06-16 20:53:36',3,'2026-06-16 20:53:36',0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-16 20:53:36','2026-06-16 20:53:36'),(9,1,'2026-06-17',25,'Idk','Idk','draft',17,NULL,NULL,NULL,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-17 13:38:26','2026-06-17 13:38:26'),(10,2,'2026-06-18',25,'Progress on structural works. Foundations completed, columns rising.',NULL,'draft',17,NULL,NULL,NULL,NULL,0,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'C:\\Users\\basus\\Documents\\Internship\\NUAssociates\\nu-pmc-main\\uploads\\documents\\weekly_report_2_wk25_1781725082919.pdf','2026-06-18 01:07:42','2026-06-18 01:08:02');
/*!40000 ALTER TABLE `weekly_reports` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `whatsapp_notifications`
--

LOCK TABLES `whatsapp_notifications` WRITE;
/*!40000 ALTER TABLE `whatsapp_notifications` DISABLE KEYS */;
INSERT INTO `whatsapp_notifications` VALUES (1,1,'+919900010001','payment_requested','Payment request PR-004 raised for BlueStone Constructions - Γé╣2,50,000 pending your review.','sent','2026-06-16 15:49:53',NULL,NULL,'2026-06-16 15:49:53'),(2,1,'+919900010001','cn_raised','Change Notice CN001: Column shift grid B has been raised by Murugesan.','sent','2026-06-16 15:49:53',NULL,NULL,'2026-06-16 15:49:53'),(3,1,'+919900010001','rfi_raised','RFI RFI-003: Clarification on Column C3 spec has been raised by Praveen.','sent','2026-06-16 15:49:53',NULL,NULL,'2026-06-16 15:49:53'),(4,1,'+919900010001','weekly_health_alert','Weekly health report alert: 3 items flagged in PV 90 Production Line.','sent','2026-06-14 15:49:53',NULL,NULL,'2026-06-14 15:49:53'),(5,1,'+919900010001','daily_report_submitted','Daily Report for Industrial Warehouse Complex has been submitted by Suleman.','sent','2026-06-15 15:49:53',NULL,NULL,'2026-06-15 15:49:53'),(6,4,NULL,'pending_items','nu PMC: 3 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-16 21:02:28'),(7,5,NULL,'pending_items','nu PMC: 3 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-16 21:02:28'),(8,4,NULL,'pending_items','nu PMC: 3 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-16 21:17:28'),(9,5,NULL,'pending_items','nu PMC: 3 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-16 21:17:28'),(10,4,NULL,'pending_items','nu PMC: 3 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-16 21:32:28'),(11,5,NULL,'pending_items','nu PMC: 3 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-16 21:32:28'),(12,4,NULL,'pending_items','nu PMC: 3 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-16 21:47:28'),(13,5,NULL,'pending_items','nu PMC: 3 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-16 21:47:28');
/*!40000 ALTER TABLE `whatsapp_notifications` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `workflow_transitions`
--

LOCK TABLES `workflow_transitions` WRITE;
/*!40000 ALTER TABLE `workflow_transitions` DISABLE KEYS */;
INSERT INTO `workflow_transitions` VALUES (1,'claims','draft','pmc_signed','principal,design_principal,pmc_head','PMC signs off',0,1,'2026-04-22 17:25:19'),(2,'claims','pmc_signed','stream_signed','principal,design_principal,design_head,services_head','Stream head signs',0,2,'2026-04-22 17:25:19'),(3,'claims','stream_signed','approved','principal,design_principal','Principal approves',0,3,'2026-04-22 17:25:19'),(4,'claims','approved','invoiced','principal,design_principal,pmc_head','Invoice number recorded',0,4,'2026-04-22 17:25:19'),(5,'measurements','draft','rs_signed','principal,design_principal,design_head,services_head','Stream sign-off',0,1,'2026-04-22 17:25:19'),(6,'measurements','rs_signed','client_accepted','principal,design_principal,pmc_head','Client acceptance recorded',0,2,'2026-04-22 17:25:19'),(7,'snags','open','rectified','principal,design_principal,pmc_head,site_manager,senior_site_manager','Mark rectified',0,1,'2026-04-22 17:25:19'),(8,'snags','rectified','closed','principal,design_principal,pmc_head,design_head,services_head','Verify and close',0,2,'2026-04-22 17:25:19'),(9,'snags','open','closed','principal,design_principal,pmc_head,design_head,services_head','Direct close (minor)',1,3,'2026-04-22 17:25:19'),(10,'weekly_reports','draft','pending_review','principal,design_principal,pmc_head,design_head,services_head','All sections signed',0,1,'2026-04-22 17:25:19'),(11,'weekly_reports','pending_review','approved','principal,design_principal','Principal approves',0,2,'2026-04-22 17:25:19'),(12,'weekly_reports','approved','sent','principal,design_principal','Marked sent to client',0,3,'2026-04-22 17:25:19'),(13,'payment_requests','pending_pmc','pmc_approved','principal,design_principal,pmc_head','PMC approves',0,1,'2026-04-22 17:25:19'),(14,'payment_requests','pmc_approved','pending_principal','system','Above threshold ├óΓé¼ΓÇ¥ to Principal',0,2,'2026-04-22 17:25:19'),(15,'payment_requests','pmc_approved','principal_approved','system','Below threshold ├óΓé¼ΓÇ¥ auto-approved',0,3,'2026-04-22 17:25:19'),(16,'payment_requests','pending_principal','principal_approved','principal,design_principal','Principal approves',0,4,'2026-04-22 17:25:19'),(17,'payment_requests','pending_principal','principal_rejected','principal,design_principal','Principal rejects',1,5,'2026-04-22 17:25:19'),(18,'payment_requests','principal_approved','paid','principal,design_principal,finance_admin','Payment released',0,6,'2026-04-22 17:25:19'),(19,'issues','open','in_progress','assignee','Work started',0,1,'2026-04-22 17:25:19'),(20,'issues','in_progress','resolved','assignee','Mark resolved',0,2,'2026-04-22 17:25:19'),(21,'issues','resolved','closed','principal,design_principal,pmc_head,design_head,services_head','Verify and close',0,3,'2026-04-22 17:25:19'),(22,'issues','open','closed','principal,design_principal,pmc_head,design_head,services_head','Direct close',1,4,'2026-04-22 17:25:19'),(23,'change_notices','draft','pending_approval','principal,design_principal,pmc_head,design_head,services_head','Stream heads sign',0,1,'2026-04-22 17:25:19'),(24,'change_notices','pending_approval','approved','principal,design_principal','Principal approves',0,2,'2026-04-22 17:25:19'),(25,'change_notices','pending_approval','rejected','principal,design_principal','Principal rejects',1,3,'2026-04-22 17:25:19'),(26,'drawings','uploaded','issued','principal,design_principal,design_head,services_head','Approve and issue',0,1,'2026-04-22 17:25:19'),(27,'drawings','issued','superseded','principal,design_principal,design_head','Superseded by new revision',1,2,'2026-04-22 17:25:19'),(28,'drawings','uploaded','rejected','principal,design_principal,design_head,services_head','Reject with comments',1,3,'2026-04-22 17:25:19'),(29,'submittals','submitted','under_review','principal,design_principal,design_head,services_head','Start review',0,1,'2026-04-22 17:25:19'),(30,'submittals','under_review','approved','principal,design_principal,design_head,services_head','Approve',0,2,'2026-04-22 17:25:19'),(31,'submittals','under_review','resubmit_required','principal,design_principal,design_head,services_head','Request resubmit',1,3,'2026-04-22 17:25:19'),(32,'submittals','under_review','rejected','principal,design_principal,design_head,services_head','Reject',1,4,'2026-04-22 17:25:19'),(33,'submittals','resubmit_required','submitted','site_manager,coordinator','Vendor resubmits',0,5,'2026-04-22 17:25:19');
/*!40000 ALTER TABLE `workflow_transitions` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY INVOKER */
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

-- Dump completed on 2026-06-19 10:41:06
