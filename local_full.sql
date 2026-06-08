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
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `approval_type_config`
--

LOCK TABLES `approval_type_config` WRITE;
/*!40000 ALTER TABLE `approval_type_config` DISABLE KEYS */;
INSERT INTO `approval_type_config` VALUES (1,'cn_approval','[\"principal\",\"design_principal\"]',1,'project',0,72,'Change Notice approval','PLACEHOLDER: high-value path only. Low-value (<1% budget) needs stream_head + pmc_head peer scheme ├óΓé¼ΓÇ¥ not yet modellable.','sheet9_xlsx',1,'2026-06-02 12:12:00','2026-06-05 09:46:47'),(2,'schedule_change','[\"principal\",\"design_principal\"]',1,'project',0,72,'Schedule baseline change','PLACEHOLDER: matches current requirePrincipal gate. Widen via Sheet 9 if pmc_head should also approve.','sheet9_xlsx',1,'2026-06-02 12:12:00','2026-06-05 09:46:47'),(3,'weekly_report','[\"principal\",\"design_principal\"]',1,'project',0,168,'Weekly report sign-off','PLACEHOLDER: principals only ├óΓé¼ΓÇ¥ matches current requireRole(...PRINCIPALS).','sheet9_xlsx',1,'2026-06-02 12:12:00','2026-06-05 09:46:47'),(4,'vendor_payment','[\"principal\",\"design_principal\",\"pmc_head\"]',1,'project',0,168,'Vendor payment approval','PLACEHOLDER: matches current requirePMC gate.','sheet9_xlsx',1,'2026-06-02 12:12:00','2026-06-05 09:46:47'),(5,'vendor_bank_change','[\"principal\",\"design_principal\"]',1,'global',1,72,'Vendor bank change','PLACEHOLDER: principals only.','sheet9_xlsx',1,'2026-06-02 12:12:00','2026-06-05 09:46:47'),(6,'claim_invoice','[\"principal\",\"design_principal\"]',1,'project',0,168,'Client claim approval','PLACEHOLDER: final-approve step only.','sheet9_xlsx',1,'2026-06-02 12:12:00','2026-06-05 09:46:47'),(7,'budget_cost_head','[\"principal\",\"design_principal\"]',1,'project',0,72,'Budget cost head approval','PLACEHOLDER: principals only.','sheet9_xlsx',1,'2026-06-02 12:12:00','2026-06-05 09:46:47'),(8,'handover_closure','[\"principal\",\"design_principal\",\"pmc_head\",\"finance_admin\"]',4,'project',0,NULL,'Project handover closure','PLACEHOLDER: 4-signer quorum design.','sheet9_xlsx',1,'2026-06-02 12:12:00','2026-06-05 09:46:47'),(9,'vendor_onboarding','[\"finance_admin\",\"principal\"]',2,'global',0,2880,'Vendor onboarding','Vendor onboarding approval ΓÇö finance then principal.','sheet9_seed_v6.02',1,'2026-06-02 12:12:00','2026-06-02 12:12:00');
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
) ENGINE=InnoDB AUTO_INCREMENT=484 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
INSERT INTO `audit_log` VALUES (1,1,'auth.start_impersonation','users',22,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-02 18:01:49'),(2,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:38:40'),(3,39,'auth.end_impersonation','users',39,'{\"from_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:38:42'),(4,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:38:45'),(5,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:38:48'),(6,39,'auth.end_impersonation','users',39,'{\"from_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:38:50'),(7,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:47:34'),(8,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:47:37'),(9,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:47:38'),(10,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:47:40'),(11,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:47:41'),(12,39,'auth.end_impersonation','users',39,'{\"from_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:47:43'),(13,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:51:12'),(14,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:51:13'),(15,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:51:15'),(16,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:51:17'),(17,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:51:19'),(18,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:51:23'),(19,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:51:26'),(20,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:51:27'),(21,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:51:40'),(22,39,'auth.end_impersonation','users',39,'{\"from_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:51:42'),(23,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:52:10'),(24,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 08:52:30'),(25,39,'auth.end_impersonation','users',39,'{\"from_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 09:32:54'),(26,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 09:33:18'),(27,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 09:34:29'),(28,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 09:54:03'),(29,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:34:23'),(30,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:34:43'),(31,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:35:08'),(32,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:35:54'),(33,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:36:29'),(34,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:37:25'),(35,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:37:34'),(36,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:37:46'),(37,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:37:52'),(38,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:38:57'),(39,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:39:22'),(40,1,'auth.end_impersonation','users',1,'{\"from_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:39:24'),(41,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:39:50'),(42,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:40:08'),(43,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:41:50'),(44,1,'auth.end_impersonation','users',1,'{\"from_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:45:25'),(45,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:45:47'),(46,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:46:28'),(47,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:47:06'),(48,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:47:10'),(49,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:47:27'),(50,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:47:33'),(51,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 10:47:44'),(52,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 11:22:33'),(53,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 11:38:34'),(54,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 11:41:15'),(55,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 12:03:03'),(56,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0','2026-06-03 12:04:23'),(57,1,'user.create','users',43,'{\"username\":\"test_pmc\",\"full_name\":\"Test PMC Head\",\"role\":\"pmc_head\",\"stream\":\"all\",\"managed_by\":null}','::ffff:127.0.0.1',NULL,'2026-06-03 13:33:50'),(58,1,'user.create','users',44,'{\"username\":\"test_site\",\"full_name\":\"Test Site Manager\",\"role\":\"site_manager\",\"stream\":\"site\",\"managed_by\":null}','::ffff:127.0.0.1',NULL,'2026-06-03 13:33:50'),(59,1,'user.create','users',45,'{\"username\":\"test_finance\",\"full_name\":\"Test Finance Admin\",\"role\":\"finance_admin\",\"stream\":\"all\",\"managed_by\":null}','::ffff:127.0.0.1',NULL,'2026-06-03 13:33:51'),(60,1,'vendor.create','vendors',4,'{\"vendor_name\":\"Test Civil Contractor\",\"trade\":\"Civil\",\"gst_number\":null,\"contact_person\":null,\"phone_tail\":\"0010\"}','::ffff:127.0.0.1',NULL,'2026-06-03 13:33:51'),(61,1,'vendor.create','vendors',5,'{\"vendor_name\":\"Test Structural Pvt Ltd\",\"trade\":\"Structural\",\"gst_number\":null,\"contact_person\":null,\"phone_tail\":\"0010\"}','::ffff:127.0.0.1',NULL,'2026-06-03 13:33:51'),(62,1,'vendor.create','vendors',6,'{\"vendor_name\":\"Test MEP Solutions\",\"trade\":\"HVAC\",\"gst_number\":null,\"contact_person\":null,\"phone_tail\":\"0010\"}','::ffff:127.0.0.1',NULL,'2026-06-03 13:33:51'),(63,1,'project.create','projects',2,'{\"code\":\"TESTP1\",\"name\":\"Test Project Alpha\",\"client_id\":2,\"client_stub_created\":true,\"project_type\":\"industrial\",\"r0_start_date\":\"2026-05-01\",\"r0_end_date\":\"2027-04-30\"}','::ffff:127.0.0.1',NULL,'2026-06-03 13:33:51'),(64,1,'project.create','projects',3,'{\"code\":\"STUBP1\",\"name\":\"Stub Client Test Project\",\"client_id\":3,\"client_stub_created\":true,\"project_type\":\"commercial\",\"r0_start_date\":\"2026-06-01\",\"r0_end_date\":\"2027-05-31\"}','::ffff:127.0.0.1',NULL,'2026-06-03 13:33:51'),(65,1,'project.create','projects',4,'{\"code\":\"STUBP2\",\"name\":\"Reuse Existing Client Project\",\"client_id\":3,\"client_stub_created\":false,\"project_type\":\"commercial\",\"r0_start_date\":\"2026-07-01\",\"r0_end_date\":\"2027-06-30\"}','::ffff:127.0.0.1',NULL,'2026-06-03 13:33:51'),(66,1,'project.assign','project_assignments',NULL,'{\"project_id\":2,\"assigned_user_id\":43,\"assignment_role\":\"pmc_head\"}','::ffff:127.0.0.1',NULL,'2026-06-03 13:33:51'),(67,1,'project.assign','project_assignments',NULL,'{\"project_id\":2,\"assigned_user_id\":44,\"assignment_role\":\"site_manager\"}','::ffff:127.0.0.1',NULL,'2026-06-03 13:33:51'),(68,1,'schedule_task.create','schedule_tasks',11,'{\"project_id\":1,\"task_name\":\"Ad-hoc Planning Task\",\"planned_date\":\"2026-06-03\",\"priority\":\"high\"}','::ffff:127.0.0.1',NULL,'2026-06-03 13:42:02'),(69,1,'schedule_task.create','schedule_tasks',12,'{\"project_id\":1,\"task_name\":\"Ad-hoc Planning Task\",\"planned_date\":\"2026-06-03\",\"priority\":\"high\"}','::ffff:127.0.0.1',NULL,'2026-06-03 13:45:25'),(70,39,'task_update.create','task_updates',NULL,'{\"project_id\":1,\"task_id\":12,\"pct_complete\":15,\"regression\":false,\"report_date\":\"2026-06-03\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 13:49:38'),(71,39,'task_update.create','task_updates',NULL,'{\"project_id\":1,\"task_id\":12,\"pct_complete\":30,\"regression\":false,\"report_date\":\"2026-06-03\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 13:49:39'),(72,39,'task_update.create','task_updates',NULL,'{\"project_id\":1,\"task_id\":12,\"pct_complete\":0,\"regression\":false,\"report_date\":\"2026-06-03\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 13:49:41'),(73,39,'task_update.create','task_updates',NULL,'{\"project_id\":1,\"task_id\":11,\"pct_complete\":95,\"regression\":false,\"report_date\":\"2026-06-03\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 18:43:33'),(74,39,'task_update.create','task_updates',NULL,'{\"project_id\":1,\"task_id\":11,\"pct_complete\":30,\"regression\":false,\"report_date\":\"2026-06-03\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 18:43:35'),(75,39,'task_update.create','task_updates',NULL,'{\"project_id\":1,\"task_id\":11,\"pct_complete\":0,\"regression\":false,\"report_date\":\"2026-06-03\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 18:44:03'),(76,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 18:51:44'),(77,39,'task_update.create','task_updates',NULL,'{\"project_id\":1,\"task_id\":11,\"pct_complete\":100,\"regression\":false,\"report_date\":\"2026-06-03\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:15:38'),(78,39,'task_update.create','task_updates',NULL,'{\"project_id\":1,\"task_id\":11,\"pct_complete\":70,\"regression\":false,\"report_date\":\"2026-06-03\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:15:53'),(79,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:16:10'),(80,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:19:11'),(81,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:19:17'),(82,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:19:24'),(83,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:19:28'),(84,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:20:48'),(85,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:50:00'),(86,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:50:18'),(87,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:52:48'),(88,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:52:51'),(89,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 20:53:10'),(90,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:00:56'),(91,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:01:02'),(92,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:01:13'),(93,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:01:15'),(94,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:01:32'),(95,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:02:20'),(96,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:33:19'),(97,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:33:21'),(98,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:33:56'),(99,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:34:06'),(100,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:34:44'),(101,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:34:46'),(102,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:34:57'),(103,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 21:55:04'),(104,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 22:00:11'),(105,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 22:02:10'),(106,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 22:02:22'),(107,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 22:02:45'),(108,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 23:23:25'),(109,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 23:23:40'),(110,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 23:23:42'),(111,39,'auth.end_impersonation','users',39,'{\"from_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 23:28:29'),(112,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 23:28:53'),(113,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 23:31:59'),(114,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 23:40:53'),(115,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 23:40:56'),(116,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 23:42:21'),(117,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 23:47:32'),(118,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-03 23:47:41'),(119,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:05:25'),(120,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:26:52'),(121,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:28:13'),(122,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:28:15'),(123,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:28:19'),(124,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:28:52'),(125,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:29:32'),(126,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:35:15'),(127,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:36:13'),(128,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:36:14'),(129,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:36:16'),(130,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:36:22'),(131,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:38:17'),(132,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:38:27'),(133,39,'auth.end_impersonation','users',39,'{\"from_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:38:32'),(134,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:38:55'),(135,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:40:18'),(136,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:40:23'),(137,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:41:00'),(138,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:45:35'),(139,39,'auth.end_impersonation','users',39,'{\"from_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:55:13'),(140,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:55:14'),(141,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:55:17'),(142,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:55:26'),(143,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:55:33'),(144,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:55:41'),(145,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 00:55:52'),(146,39,'auth.end_impersonation','users',39,'{\"from_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:10:01'),(147,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:10:07'),(148,39,'auth.end_impersonation','users',39,'{\"from_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:10:09'),(149,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:10:22'),(150,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:10:31'),(151,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:10:35'),(152,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:10:50'),(153,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:10:53'),(154,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:10:56'),(155,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:10:59'),(156,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:11:08'),(157,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:11:24'),(158,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:11:26'),(159,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:11:45'),(160,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:12:05'),(161,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:36:29'),(162,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 01:36:32'),(163,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:37:52'),(164,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:38:08'),(165,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:38:52'),(166,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:39:02'),(167,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:39:18'),(168,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:39:33'),(169,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:39:45'),(170,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:48:09'),(171,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:48:14'),(172,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:48:58'),(173,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:49:00'),(174,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:49:58'),(175,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:55:52'),(176,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:56:06'),(177,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 10:56:14'),(178,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 11:07:55'),(179,39,'auth.end_impersonation','users',39,'{\"from_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 11:07:56'),(180,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 11:16:04'),(181,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 11:16:11'),(182,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 11:18:28'),(183,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 11:18:32'),(184,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 11:18:54'),(185,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 11:20:19'),(186,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:01:17'),(187,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:01:18'),(188,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:01:20'),(189,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:01:21'),(190,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:01:24'),(191,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:01:27'),(192,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:01:33'),(193,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:01:38'),(194,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:01:48'),(195,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:01:57'),(196,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:02:05'),(197,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:02:20'),(198,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:03:02'),(199,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:03:31'),(200,39,'auth.end_impersonation','users',39,'{\"from_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:14:27'),(201,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:19:13'),(202,39,'auth.end_impersonation','users',39,'{\"from_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:24:29'),(203,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:40:34'),(204,39,'auth.end_impersonation','users',39,'{\"from_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:43:40'),(205,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:44:58'),(206,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:45:07'),(207,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:45:20'),(208,39,'auth.end_impersonation','users',39,'{\"from_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:46:57'),(209,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:47:00'),(210,39,'auth.end_impersonation','users',39,'{\"from_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:48:28'),(211,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:51:56'),(212,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:51:58'),(213,39,'auth.end_impersonation','users',39,'{\"from_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 13:52:14'),(214,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 14:09:55'),(215,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 14:10:16'),(216,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 14:10:26'),(217,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 14:11:23'),(218,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 14:12:09'),(219,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 14:12:32'),(220,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 14:12:48'),(221,39,'auth.end_impersonation','users',39,'{\"from_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 14:13:35'),(222,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 14:13:51'),(223,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 14:14:05'),(224,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 15:48:15'),(225,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 15:48:39'),(226,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 15:48:41'),(227,39,'auth.end_impersonation','users',39,'{\"from_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-04 15:48:45'),(228,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:19:24'),(229,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:19:45'),(230,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:19:49'),(231,39,'auth.end_impersonation','users',39,'{\"from_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:25:00'),(232,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:36:32'),(233,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:36:55'),(234,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:37:23'),(235,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:37:25'),(236,39,'auth.end_impersonation','users',39,'{\"from_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:37:33'),(237,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:37:51'),(238,39,'auth.end_impersonation','users',39,'{\"from_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:51:27'),(239,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:51:37'),(240,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:51:46'),(241,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:52:07'),(242,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:52:11'),(243,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:52:14'),(244,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:52:30'),(245,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:52:33'),(246,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:52:57'),(247,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:53:06'),(248,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:53:16'),(249,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:53:27'),(250,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:53:29'),(251,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:53:32'),(252,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:53:37'),(253,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:53:45'),(254,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:53:47'),(255,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:53:49'),(256,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:53:51'),(257,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:53:58'),(258,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:54:01'),(259,39,'auth.end_impersonation','users',39,'{\"from_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:54:30'),(260,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 10:54:44'),(261,39,'auth.end_impersonation','users',39,'{\"from_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:03:31'),(262,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:03:48'),(263,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:04:02'),(264,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:04:18'),(265,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:04:55'),(266,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:08:15'),(267,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:08:19'),(268,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:08:23'),(269,39,'auth.end_impersonation','users',39,'{\"from_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:08:28'),(270,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:13:34'),(271,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:13:40'),(272,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:13:44'),(273,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:14:00'),(274,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:14:02'),(275,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:14:05'),(276,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:14:09'),(277,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:14:16'),(278,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:14:18'),(279,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:14:20'),(280,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:14:22'),(281,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:14:26'),(282,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:14:30'),(283,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:14:35'),(284,39,'auth.end_impersonation','users',39,'{\"from_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:19:59'),(285,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:05'),(286,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:07'),(287,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:09'),(288,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:11'),(289,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:16'),(290,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:18'),(291,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:20'),(292,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:27'),(293,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:29'),(294,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:31'),(295,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:33'),(296,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:35'),(297,39,'auth.end_impersonation','users',39,'{\"from_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:37'),(298,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:55'),(299,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:20:58'),(300,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:21:00'),(301,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:21:02'),(302,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:21:03'),(303,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:21:10'),(304,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:21:23'),(305,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:21:25'),(306,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:21:34'),(307,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:21:48'),(308,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:21:51'),(309,39,'auth.end_impersonation','users',39,'{\"from_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:27:52'),(310,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:27:54'),(311,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:27:55'),(312,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:28:01'),(313,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:37:46'),(314,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:37:50'),(315,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:37:53'),(316,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:37:57'),(317,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:38:00'),(318,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:38:03'),(319,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:38:06'),(320,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:38:09'),(321,39,'auth.end_impersonation','users',39,'{\"from_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:38:12'),(322,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:38:22'),(323,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:38:38'),(324,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:38:50'),(325,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:38:56'),(326,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:39:14'),(327,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:39:20'),(328,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:39:26'),(329,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:39:29'),(330,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:39:35'),(331,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:39:58'),(332,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:40:26'),(333,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:52:49'),(334,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:53:04'),(335,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:53:17'),(336,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 11:53:42'),(337,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 14:39:11'),(338,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 15:00:30'),(339,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 15:01:10'),(340,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 15:06:27'),(341,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 15:07:46'),(342,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 15:09:40'),(343,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 15:13:28'),(344,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 15:14:38'),(345,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 15:14:40'),(346,39,'auth.end_impersonation','users',39,'{\"from_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 15:15:10'),(347,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 16:04:47'),(348,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 16:14:49'),(349,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 16:16:53'),(350,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 16:28:33'),(351,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 16:28:45'),(352,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 16:29:06'),(353,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 16:29:08'),(354,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 16:29:13'),(355,1,'auth.end_impersonation','users',1,'{\"from_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 16:30:30'),(356,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 16:31:30'),(357,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:20:25'),(358,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:20:29'),(359,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:20:36'),(360,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:21:25'),(361,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:21:29'),(362,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:22:47'),(363,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:22:49'),(364,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:25:09'),(365,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:25:11'),(366,1,'auth.end_impersonation','users',1,'{\"from_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 17:30:38'),(367,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:40:16'),(368,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:40:19'),(369,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:40:20'),(370,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:40:22'),(371,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:40:26'),(372,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:40:28'),(373,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:40:30'),(374,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 17:41:07'),(375,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 17:41:54'),(376,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:17:01'),(377,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:17:03'),(378,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:17:08'),(379,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:22:46'),(380,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:22:48'),(381,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:22:55'),(382,1,'auth.end_impersonation','users',1,'{\"from_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:23:48'),(383,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"design_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:23:49'),(384,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:23:51'),(385,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:23:53'),(386,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:44:37'),(387,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:48:27'),(388,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:48:32'),(389,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:48:37'),(390,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:48:39'),(391,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:48:41'),(392,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 18:52:23'),(393,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 18:52:27'),(394,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"detailing\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:54:11'),(395,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:54:13'),(396,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:54:15'),(397,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 18:54:17'),(398,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 19:02:34'),(399,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 19:02:36'),(400,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 19:02:53'),(401,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 19:02:55'),(402,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 19:05:30'),(403,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 19:05:34'),(404,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 19:05:41'),(405,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 19:36:20'),(406,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 19:36:28'),(407,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 19:43:10'),(408,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 19:48:27'),(409,1,'auth.end_impersonation','users',1,'{\"from_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 19:48:55'),(410,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 19:49:08'),(411,1,'auth.end_impersonation','users',1,'{\"from_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 19:49:39'),(412,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 20:02:41'),(413,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 20:03:10'),(414,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 20:03:14'),(415,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 20:14:30'),(416,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 20:14:33'),(417,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 20:14:40'),(418,1,'auth.end_impersonation','users',1,'{\"from_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 20:58:28'),(419,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 20:58:33'),(420,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 20:58:37'),(421,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 21:58:04'),(422,1,'auth.end_impersonation','users',1,'{\"from_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 21:58:19'),(423,1,'auth.start_impersonation','users',1,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:03:56'),(424,1,'auth.end_impersonation','users',1,'{\"from_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:03:57'),(425,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:27:44'),(426,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:27:51'),(427,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:27:58'),(428,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:34:11'),(429,39,'auth.end_impersonation','users',39,'{\"from_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:34:14'),(430,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:36:09'),(431,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:36:25'),(432,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 22:37:00'),(433,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 22:37:06'),(434,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','2026-06-05 22:37:42'),(435,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:38:12'),(436,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:38:15'),(437,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:38:17'),(438,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:38:23'),(439,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:38:25'),(440,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:38:29'),(441,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:39:49'),(442,39,'auth.end_impersonation','users',39,'{\"from_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:39:53'),(443,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:41:06'),(444,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 22:58:45'),(445,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 23:27:14'),(446,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 23:27:30'),(447,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 23:27:44'),(448,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 23:27:56'),(449,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 23:28:31'),(450,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 23:28:51'),(451,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 23:28:57'),(452,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 23:34:10'),(453,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-06-05 23:34:29'),(454,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-06 09:21:23'),(455,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-06 10:01:37'),(456,39,'auth.end_impersonation','users',39,'{\"from_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-06 10:06:24'),(457,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"design_principal\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-06 10:08:35'),(458,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-06 10:08:51'),(459,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:09:18'),(460,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:09:37'),(461,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"trainee\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:09:39'),(462,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:09:45'),(463,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:10:03'),(464,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-06 10:22:44'),(465,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-06 10:22:46'),(466,39,'auth.end_impersonation','users',39,'{\"from_role\":\"site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:23:17'),(467,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','2026-06-06 10:30:10'),(468,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:30:43'),(469,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:30:48'),(470,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:31:25'),(471,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"it_admin\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:31:59'),(472,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"audit\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:32:02'),(473,39,'auth.end_impersonation','users',39,'{\"from_role\":\"audit\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:32:16'),(474,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"finance_admin\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:32:18'),(475,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"senior_site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:32:25'),(476,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"site_manager\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:32:29'),(477,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"pmc_head\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:32:35'),(478,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"coordinator\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:32:42'),(479,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_engineer\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:32:49'),(480,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"jr_architect\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:32:58'),(481,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"detailing_head\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:33:05'),(482,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"services_head\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:33:10'),(483,39,'auth.start_impersonation','users',39,'{\"from_role\":\"principal\",\"to_role\":\"team_lead\"}','::1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','2026-06-06 10:33:21');
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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `boq_items`
--

LOCK TABLES `boq_items` WRITE;
/*!40000 ALTER TABLE `boq_items` DISABLE KEYS */;
INSERT INTO `boq_items` VALUES (1,1,1,NULL,'Civil','CIV-001','Excavation in ordinary soil',1,0,'CUM',180.000,1,0,NULL,NULL,0),(2,1,1,NULL,'Civil','CIV-002','M25 concrete (foundation)',2,0,'CUM',90.000,1,0,NULL,NULL,0),(3,1,1,NULL,'Civil','CIV-003','M30 concrete (columns+slab)',3,0,'CUM',140.000,1,0,NULL,NULL,0),(4,1,1,NULL,'Civil','CIV-004','Reinforcement steel Fe550',4,0,'MT',18.000,1,0,NULL,NULL,0),(5,2,1,NULL,'Electrical','ELC-001','3C x 4 sqmm XLPE cable',1,0,'MTR',600.000,1,0,NULL,NULL,0),(6,2,1,NULL,'Electrical','ELC-002','63A MCCB 4-pole',2,0,'NOS',12.000,1,0,NULL,NULL,0),(7,2,1,NULL,'Electrical','ELC-003','DB 12-way TPN',3,0,'NOS',4.000,1,0,NULL,NULL,0),(8,2,1,NULL,'HVAC','HVAC-001','7.5TR VRV outdoor unit',4,0,'NOS',2.000,1,0,NULL,NULL,0),(9,2,1,NULL,'HVAC','HVAC-002','Ceiling cassette 2TR',5,0,'NOS',8.000,1,0,NULL,NULL,0);
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `boq_versions`
--

LOCK TABLES `boq_versions` WRITE;
/*!40000 ALTER TABLE `boq_versions` DISABLE KEYS */;
INSERT INTO `boq_versions` VALUES (1,1,'design',1,'v1',NULL,1,1,NULL,'2026-04-22 17:25:19'),(2,1,'services',1,'v1',NULL,1,1,NULL,'2026-04-22 17:25:19');
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_threshold_alerts`
--

LOCK TABLES `budget_threshold_alerts` WRITE;
/*!40000 ALTER TABLE `budget_threshold_alerts` DISABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=260 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_errors`
--

LOCK TABLES `client_errors` WRITE;
/*!40000 ALTER TABLE `client_errors` DISABLE KEYS */;
INSERT INTO `client_errors` VALUES (1,4,'pmc_head','Praveen Kumar','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-02 18:01:15'),(2,4,'pmc_head','Praveen Kumar','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-02 18:01:17'),(3,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 08:38:48'),(4,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 08:47:40'),(5,39,'services_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 08:51:26'),(6,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 08:52:30'),(7,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 09:00:34'),(8,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 09:32:30'),(9,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 09:32:50'),(10,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 09:34:29'),(11,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 09:44:53'),(12,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 09:53:00'),(13,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 09:53:54'),(14,1,'design_head','Naveen Kumar Bhat','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 10:34:23'),(15,1,'design_head','Naveen Kumar Bhat','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 10:35:08'),(16,1,'design_head','Naveen Kumar Bhat','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 10:35:49'),(17,1,'services_head','Naveen Kumar Bhat','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 10:36:29'),(18,1,'services_head','Naveen Kumar Bhat','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 10:37:04'),(19,1,'coordinator','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 10:39:17'),(20,1,'design_head','Naveen Kumar Bhat','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 10:40:08'),(21,1,'services_head','Naveen Kumar Bhat','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 10:41:50'),(22,1,'services_head','Naveen Kumar Bhat','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 10:45:03'),(23,1,'services_head','Naveen Kumar Bhat','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 10:46:28'),(24,1,'coordinator','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-02&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 11:11:14'),(25,1,'coordinator','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-03&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 11:12:13'),(26,1,'coordinator','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-03&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 11:19:13'),(27,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-03&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 12:19:07'),(28,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-03&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 12:19:54'),(29,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-03&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 12:23:38'),(30,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-03&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 12:25:09'),(31,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-03&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 12:26:50'),(32,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-03&types=project_progress',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 12:27:33'),(33,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-03&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 18:45:47'),(34,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 20:16:02'),(35,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 20:16:10'),(36,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 20:17:15'),(37,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-03&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 20:50:13'),(38,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 20:50:18'),(39,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 20:53:10'),(40,39,'site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:00:56'),(41,39,'site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:01:32'),(42,39,'site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-03&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:01:41'),(43,39,'site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:02:11'),(44,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:28:55'),(45,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:33:13'),(46,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:33:13'),(47,39,'finance_admin','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:34:57'),(48,39,'finance_admin','Dev Tester','GET','/api/clients',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:35:17'),(49,39,'finance_admin','Dev Tester','GET','/api/clients/incomplete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:35:17'),(50,39,'finance_admin','Dev Tester','GET','/api/client-boq/1',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:35:19'),(51,39,'finance_admin','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:47:05'),(52,39,'finance_admin','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:47:09'),(53,39,'finance_admin','Dev Tester','GET','/api/clients',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:47:14'),(54,39,'finance_admin','Dev Tester','GET','/api/clients/incomplete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:47:14'),(55,39,'finance_admin','Dev Tester','GET','/api/client-boq/1',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:47:15'),(56,39,'finance_admin','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:47:20'),(57,39,'finance_admin','Dev Tester','GET','/api/client-boq/1',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:47:23'),(58,39,'finance_admin','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:53:18'),(59,39,'finance_admin','Dev Tester','GET','/api/clients',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:54:41'),(60,39,'finance_admin','Dev Tester','GET','/api/clients/incomplete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:54:41'),(61,39,'finance_admin','Dev Tester','GET','/api/client-boq/1',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:54:42'),(62,39,'finance_admin','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 21:54:47'),(63,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-03 23:23:41'),(64,39,'finance_admin','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:28:20'),(65,39,'finance_admin','Dev Tester','GET','/api/client-boq/1',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:28:44'),(66,39,'finance_admin','Dev Tester','GET','/api/clients',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:28:46'),(67,39,'finance_admin','Dev Tester','GET','/api/clients/incomplete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:28:46'),(68,39,'senior_site_manager','Dev Tester','GET','/api/budget/1/digest',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:28:52'),(69,39,'senior_site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:28:52'),(70,39,'senior_site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:29:05'),(71,39,'site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:29:32'),(72,39,'site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:30:27'),(73,39,'site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:30:35'),(74,39,'site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:34:52'),(75,39,'site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:35:06'),(76,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:35:57'),(77,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:36:09'),(78,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:38:14'),(79,39,'senior_site_manager','Dev Tester','GET','/api/budget/1/digest',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:40:18'),(80,39,'senior_site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:40:18'),(81,39,'site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:40:50'),(82,39,'site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:40:57'),(83,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:41:13'),(84,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:43:47'),(85,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:43:49'),(86,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:45:33'),(87,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:45:42'),(88,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:55:04'),(89,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:55:49'),(90,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:55:52'),(91,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:55:59'),(92,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:58:57'),(93,39,'pmc_head','Dev Tester','GET','/api/reports/1/generate',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 00:58:59'),(94,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:03:58'),(95,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:04:00'),(96,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:04:08'),(97,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:04:09'),(98,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:04:11'),(99,39,'pmc_head','Dev Tester','GET','/api/reports/1/generate',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:04:12'),(100,39,'pmc_head','Dev Tester','GET','/api/reports/1/generate',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:05:00'),(101,39,'pmc_head','Dev Tester','GET','/api/reports/1/generate',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:06:11'),(102,39,'services_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:10:35'),(103,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:11:08'),(104,39,'pmc_head','Dev Tester','GET','/api/reports/1/generate',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:11:09'),(105,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:11:11'),(106,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:11:13'),(107,39,'senior_site_manager','Dev Tester','GET','/api/budget/1/digest',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:11:25'),(108,39,'site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:11:37'),(109,39,'senior_site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:11:45'),(110,39,'finance_admin','Dev Tester','GET','/api/client-boq/1',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:12:18'),(111,39,'finance_admin','Dev Tester','GET','/api/clients',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:12:19'),(112,39,'finance_admin','Dev Tester','GET','/api/clients/incomplete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:12:19'),(113,39,'finance_admin','Dev Tester','GET','/api/client-boq/1',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:36:26'),(114,39,'finance_admin','Dev Tester','GET','/api/clients',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:36:26'),(115,39,'finance_admin','Dev Tester','GET','/api/clients/incomplete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 01:36:26'),(116,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 10:38:08'),(117,39,'finance_admin','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 10:39:02'),(118,39,'finance_admin','Dev Tester','GET','/api/client-boq/1',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 10:39:13'),(119,39,'finance_admin','Dev Tester','GET','/api/clients',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 10:39:14'),(120,39,'finance_admin','Dev Tester','GET','/api/clients/incomplete',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 10:39:14'),(121,39,'senior_site_manager','Dev Tester','GET','/api/budget/1/digest',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 10:39:18'),(122,39,'senior_site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 10:39:22'),(123,39,'site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 10:39:33'),(124,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 10:45:28'),(125,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 10:45:36'),(126,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 10:45:37'),(127,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 10:55:52'),(128,39,'detailing_head','Dev Tester','GET','/api/materials/1/requests',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 11:07:42'),(129,39,'detailing_head','Dev Tester','GET','/api/materials/1/boq',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 11:07:42'),(130,39,'detailing_head','Dev Tester','GET','/api/materials/1/boq/versions',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 11:07:42'),(131,39,'detailing_head','Dev Tester','GET','/api/daily-reports/1',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 11:07:44'),(132,39,'services_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 11:07:55'),(133,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 11:16:11'),(134,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 11:17:04'),(135,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 11:18:28'),(136,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 11:20:19'),(137,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 13:01:18'),(138,39,'detailing_head','Dev Tester','GET','/api/materials/1/requests',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 13:01:43'),(139,39,'detailing_head','Dev Tester','GET','/api/materials/1/boq',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 13:01:43'),(140,39,'detailing_head','Dev Tester','GET','/api/materials/1/boq/versions',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 13:01:43'),(141,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 13:02:29'),(142,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 13:03:02'),(143,39,'site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 13:12:25'),(144,39,'site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 13:14:12'),(145,39,'site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-04&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 13:14:17'),(146,39,'site_manager','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 13:45:07'),(147,39,'pmc_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 13:47:00'),(148,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 13:51:56'),(149,39,'team_lead','Dev Tester','GET','/api/drawings/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 14:10:21'),(150,39,'design_head','Dev Tester','GET','/api/project-setup/3/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 14:10:26'),(151,39,'team_lead','Dev Tester','GET','/api/drawings/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 14:11:34'),(152,39,'team_lead','Dev Tester','GET','/api/register/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 14:11:36'),(153,39,'team_lead','Dev Tester','GET','/api/issues/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 14:11:37'),(154,39,'team_lead','Dev Tester','GET','/api/submittals/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 14:11:38'),(155,39,'services_head','Dev Tester','GET','/api/project-setup/3/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 14:12:09'),(156,39,'jr_architect','Dev Tester','GET','/api/drawings/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 14:12:33'),(157,39,'jr_architect','Dev Tester','GET','/api/issues/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 14:12:34'),(158,39,'jr_architect','Dev Tester','GET','/api/submittals/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-04 14:12:35'),(159,39,'principal','Dev Tester','GET','/api/projects/3',500,NULL,'{\"error\":\"Internal server error\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:04:26'),(160,39,'principal','Dev Tester','GET','/api/projects/4',500,NULL,'{\"error\":\"Internal server error\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:04:30'),(161,39,'principal','Dev Tester','GET','/api/projects/1',500,NULL,'{\"error\":\"Internal server error\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:09:34'),(162,39,'design_principal','Dev Tester','GET','/api/projects/1',500,NULL,'{\"error\":\"Internal server error\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:19:28'),(163,39,'design_head','Dev Tester','GET','/api/project-setup/1/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:19:45'),(164,39,'detailing_head','Dev Tester','GET','/api/materials/1/requests',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:19:54'),(165,39,'detailing_head','Dev Tester','GET','/api/materials/1/boq/versions',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:19:54'),(166,39,'detailing_head','Dev Tester','GET','/api/materials/1/boq',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:19:54'),(167,39,'detailing_head','Dev Tester','GET','/api/materials/1/requests',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:21:11'),(168,39,'detailing_head','Dev Tester','GET','/api/materials/1/boq',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:21:11'),(169,39,'detailing_head','Dev Tester','GET','/api/materials/1/boq/versions',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:21:11'),(170,39,'principal','Dev Tester','GET','/api/projects/1',500,NULL,'{\"error\":\"Internal server error\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:25:02'),(171,39,'principal','Dev Tester','GET','/api/projects/1',500,NULL,'{\"error\":\"Internal server error\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:25:07'),(172,39,'principal','Dev Tester','GET','/api/projects/4',500,NULL,'{\"error\":\"Internal server error\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:25:38'),(173,39,'principal','Dev Tester','GET','/api/projects/3',500,NULL,'{\"error\":\"Internal server error\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:25:40'),(174,39,'principal','Dev Tester','GET','/api/projects/2',500,NULL,'{\"error\":\"Internal server error\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:25:41'),(175,39,'principal','Dev Tester','GET','/api/projects/1',500,NULL,'{\"error\":\"Internal server error\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:25:42'),(176,39,'principal','Dev Tester','GET','/api/projects/1',500,NULL,'{\"error\":\"Internal server error\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:27:01'),(177,39,'principal','Dev Tester','GET','/api/projects/1',500,NULL,'{\"error\":\"Internal server error\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:27:06'),(178,39,'design_head','Dev Tester','GET','/api/project-setup/4/checklist',500,'ER_BAD_FIELD_ERROR','{\"error\":\"Internal server error\",\"code\":\"ER_BAD_FIELD_ERROR\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:37:51'),(179,39,'senior_site_manager','Dev Tester','GET','/api/budget/1/digest',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 10:52:57'),(180,39,'senior_site_manager','Dev Tester','GET','/api/budget/1/digest',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 11:20:11'),(181,39,'coordinator','Dev Tester','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 11:39:41'),(182,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-05',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:04:47'),(183,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:05:21'),(184,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?date=2026-06-05',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:05:21'),(185,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?_cb=1780655721217',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:05:21'),(186,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-05',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:05:21'),(187,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3/lookahead/workspace?_cb=1780655754690',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:05:54'),(188,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:05:56'),(189,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?date=2026-06-05',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:05:56'),(190,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-05',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:05:56'),(191,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3/lookahead/workspace?_cb=1780655758445',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:05:58'),(192,1,'site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:06:05'),(193,1,'site_manager','Naveen Kumar Bhat','GET','/api/issues/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:06:09'),(194,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?_cb=1780655769538',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:06:09'),(195,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:06:28'),(196,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?date=2026-06-05',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:06:28'),(197,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-05',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:06:28'),(198,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3/lookahead/workspace?_cb=1780655860545',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:07:40'),(199,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:07:41'),(200,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?date=2026-06-05',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:07:41'),(201,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-05',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:07:41'),(202,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?_cb=1780655873997',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:07:54'),(203,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?date=2026-06-02',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:07:58'),(204,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-02',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:07:58'),(205,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?date=2026-06-03',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:07:59'),(206,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-03',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:07:59'),(207,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?date=2026-06-04',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:08:00'),(208,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-04',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:08:00'),(209,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-05',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:08:12'),(210,1,'site_manager','Naveen Kumar Bhat','GET','/api/issues/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:08:15'),(211,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:08:26'),(212,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?_cb=1780655906792',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:08:26'),(213,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?date=2026-06-05',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:08:26'),(214,1,'site_manager','Naveen Kumar Bhat','GET','/api/grn/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:08:38'),(215,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-05',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:08:44'),(216,1,'site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:08:48'),(217,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:09:13'),(218,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?date=2026-06-05',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:09:13'),(219,1,'site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:09:38'),(220,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-05',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:09:42'),(221,1,'site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:09:53'),(222,1,'site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:10:00'),(223,1,'site_manager','Naveen Kumar Bhat','GET','/api/issues/rfi/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:10:08'),(224,1,'site_manager','Naveen Kumar Bhat','GET','/api/issues/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:10:13'),(225,1,'site_manager','Naveen Kumar Bhat','GET','/api/labour/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:10:18'),(226,1,'site_manager','Naveen Kumar Bhat','GET','/api/vendors/3/engagements',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:10:25'),(227,1,'site_manager','Naveen Kumar Bhat','GET','/api/drawings/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:10:30'),(228,1,'site_manager','Naveen Kumar Bhat','GET','/api/drawings/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:11:22'),(229,1,'site_manager','Naveen Kumar Bhat','GET','/api/register/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:11:24'),(230,1,'site_manager','Naveen Kumar Bhat','GET','/api/grn/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:12:15'),(231,1,'site_manager','Naveen Kumar Bhat','GET','/api/grn/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:13:14'),(232,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:13:18'),(233,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?_cb=1780656198277',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:13:18'),(234,1,'site_manager','Naveen Kumar Bhat','GET','/api/daily-reports/3/today?date=2026-06-05',403,NULL,'{\"error\":\"Not assigned to this project\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:13:18'),(235,1,'site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-05',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:13:18'),(236,1,'senior_site_manager','Naveen Kumar Bhat','GET','/api/schedule/3?date=2026-06-05',403,'PROJECT_SCOPE_DENIED','{\"error\":\"Not assigned to this project\",\"code\":\"PROJECT_SCOPE_DENIED\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:14:49'),(237,1,'senior_site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:15:04'),(238,1,'senior_site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 16:15:36'),(239,1,'senior_site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 17:24:58'),(240,1,'site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 18:44:44'),(241,1,'senior_site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 19:02:44'),(242,1,'site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 19:02:58'),(243,1,'site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 19:43:38'),(244,1,'site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 19:49:25'),(245,1,'site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 19:49:27'),(246,1,'site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 19:49:28'),(247,1,'pmc_head','Naveen Kumar Bhat','GET','/api/nav-admin/drafts',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 20:03:07'),(248,1,'site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 20:03:25'),(249,1,'senior_site_manager','Naveen Kumar Bhat','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 21:58:10'),(250,39,'senior_site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 22:36:34'),(251,39,'site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 22:37:45'),(252,39,'senior_site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 22:41:10'),(253,39,'site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 23:20:09'),(254,39,'senior_site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 23:27:22'),(255,39,'site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 23:28:34'),(256,39,'senior_site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-05&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','/',NULL,NULL,NULL,'2026-06-05 23:34:14'),(257,39,'finance_admin','Dev Tester','GET','/api/client-boq/1',403,NULL,'{\"error\":\"Insufficient permissions\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-06 10:10:00'),(258,39,'finance_admin','Dev Tester','GET','/api/clients',403,NULL,'{\"error\":\"Not authorised\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-06 10:10:01'),(259,39,'site_manager','Dev Tester','GET','/api/photos/1?date=2026-06-06&types=project_progress,issue',500,'ER_NO_SUCH_TABLE','{\"error\":\"Internal server error\",\"code\":\"ER_NO_SUCH_TABLE\"}','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36','/',NULL,NULL,NULL,'2026-06-06 10:30:53');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clients`
--

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
INSERT INTO `clients` VALUES (2,'Test Client Pvt Ltd',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'regular',NULL,'Construction Works Income','NUALL/26-27/',0,30,NULL,0,1,0,'auto-created from project TESTP1',NULL,NULL,1,'2026-06-03 13:33:51','2026-06-06 09:37:06'),(3,'Acme Brand New Industries Ltd',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'regular',NULL,'Construction Works Income','NUALL/26-27/',0,30,NULL,0,1,0,'auto-created from project STUBP1',NULL,NULL,1,'2026-06-03 13:33:51','2026-06-06 09:37:06');
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_reports`
--

LOCK TABLES `daily_reports` WRITE;
/*!40000 ALTER TABLE `daily_reports` DISABLE KEYS */;
INSERT INTO `daily_reports` VALUES (1,1,'2026-04-21',1,'app',NULL,'Foundation work progressing on schedule. Cement delivery slightly delayed (~2hrs). 12 skilled + 18 unskilled on site.','2026-04-22 17:25:19',NULL,NULL,0,NULL,'approved',1,'2026-04-22 17:25:19',NULL,NULL,NULL),(2,1,'2026-04-22',1,'app',NULL,'Column formwork for Grid A complete. Electrical team mobilised for conduit install. 14 skilled + 20 unskilled on site.','2026-04-22 17:25:19',NULL,NULL,0,NULL,'pending_review',NULL,NULL,NULL,NULL,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drawing_register`
--

LOCK TABLES `drawing_register` WRITE;
/*!40000 ALTER TABLE `drawing_register` DISABLE KEYS */;
INSERT INTO `drawing_register` VALUES (1,1,'A-101','Ground Floor Plan','Architectural','design',NULL,NULL,'in_progress',1,'2026-04-22 17:25:19',NULL,NULL),(2,1,'A-102','Production Area Layout','Architectural','design',NULL,NULL,'in_progress',1,'2026-04-22 17:25:19',NULL,NULL),(3,1,'S-201','Foundation Details','Structural','design',NULL,NULL,'pending',1,'2026-04-22 17:25:19',NULL,NULL),(4,1,'E-301','Power Distribution','Electrical','services',NULL,NULL,'in_progress',1,'2026-04-22 17:25:19',NULL,NULL),(5,1,'M-401','HVAC Ductwork Layout','HVAC','services',NULL,NULL,'pending',1,'2026-04-22 17:25:19',NULL,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drawing_versions`
--

LOCK TABLES `drawing_versions` WRITE;
/*!40000 ALTER TABLE `drawing_versions` DISABLE KEYS */;
INSERT INTO `drawing_versions` VALUES (1,1,'R0',0,'/uploads/pv90/A-101_R0.pdf',820,NULL,NULL,1,'pending_l2',NULL,'2026-06-02 18:01:19','Auto-escalated after 2 days',NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,NULL,1,'2026-04-22 17:25:19'),(2,2,'R0',0,'/uploads/pv90/A-102_R0.pdf',940,NULL,NULL,1,'pending_l2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,NULL,1,'2026-04-22 17:25:19'),(3,3,'R0',0,'/uploads/pv90/E-301_R0.pdf',680,NULL,NULL,1,'issued',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,0,NULL,NULL,1,'2026-04-22 17:25:19');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drawings`
--

LOCK TABLES `drawings` WRITE;
/*!40000 ALTER TABLE `drawings` DISABLE KEYS */;
INSERT INTO `drawings` VALUES (1,1,'A-101','Ground Floor Plan','Architectural','design','main',NULL,NULL,NULL,'2026-04-22 17:25:19'),(2,1,'A-102','Production Area Layout','Architectural','design','main',NULL,NULL,NULL,'2026-04-22 17:25:19'),(3,1,'E-301','Power Distribution','Electrical','services','main',NULL,NULL,NULL,'2026-04-22 17:25:19');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `external_comm_assignments`
--

LOCK TABLES `external_comm_assignments` WRITE;
/*!40000 ALTER TABLE `external_comm_assignments` DISABLE KEYS */;
INSERT INTO `external_comm_assignments` VALUES (1,'vendor_bank_confirm',4,NULL,NULL,'https://wa.me/919000000010?text=Test%20Civil%20Contractor%20%E2%80%94%20new%20vendor%20bank%20details%20added.%20Please%20confirm%20this%20is%20correct.','Test Civil Contractor ΓÇö new vendor bank details added. Please confirm this is correct.',35,NULL,'pending','2026-06-03 13:33:51','2026-06-03 17:33:51',NULL,NULL,NULL,NULL,NULL),(2,'vendor_bank_confirm',5,NULL,NULL,'https://wa.me/919000000010?text=Test%20Structural%20Pvt%20Ltd%20%E2%80%94%20new%20vendor%20bank%20details%20added.%20Please%20confirm%20this%20is%20correct.','Test Structural Pvt Ltd ΓÇö new vendor bank details added. Please confirm this is correct.',35,NULL,'pending','2026-06-03 13:33:51','2026-06-03 17:33:51',NULL,NULL,NULL,NULL,NULL),(3,'vendor_bank_confirm',6,NULL,NULL,'https://wa.me/919000000010?text=Test%20MEP%20Solutions%20%E2%80%94%20new%20vendor%20bank%20details%20added.%20Please%20confirm%20this%20is%20correct.','Test MEP Solutions ΓÇö new vendor bank details added. Please confirm this is correct.',35,NULL,'pending','2026-06-03 13:33:51','2026-06-03 17:33:51',NULL,NULL,NULL,NULL,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grns`
--

LOCK TABLES `grns` WRITE;
/*!40000 ALTER TABLE `grns` DISABLE KEYS */;
INSERT INTO `grns` VALUES (1,1,'GRN-001',1,NULL,'2026-04-18','OPC 53 Grade Cement',200.000,'BAGS',NULL,NULL,NULL,NULL,0,1,'2026-04-22 17:25:19',NULL,NULL,'pending',NULL),(2,1,'GRN-002',2,NULL,'2026-04-20','3C x 4 sqmm XLPE cable',300.000,'MTR',NULL,NULL,NULL,NULL,0,1,'2026-04-22 17:25:19',NULL,NULL,'pending',NULL),(3,1,'GRN-003',1,NULL,'2026-04-15','Reinforcement steel 16mm',2.500,'MT',NULL,NULL,NULL,NULL,0,1,'2026-04-22 17:25:19',NULL,NULL,'pending',NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `issues`
--

LOCK TABLES `issues` WRITE;
/*!40000 ALTER TABLE `issues` DISABLE KEYS */;
INSERT INTO `issues` VALUES (1,1,'ISS-001','rfi','Clarify foundation depth at Grid A1','Drawing shows 1200mm but site soil report suggests 1500mm. Please confirm.',1,'2026-04-22 17:25:19',NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,'open',1,NULL,'0',NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL),(2,1,'ISS-002','design','Column C3 spec mismatch','BOQ says M30 but drawing notes M25. Confirm which is correct.',1,'2026-04-22 17:25:19',NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,'open',1,NULL,'0',NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL),(3,1,'ISS-003','safety','Scaffolding stability ├óΓé¼ΓÇ¥ east facade','Wind load conditions require additional bracing. Inspect.',1,'2026-04-22 17:25:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'open',1,NULL,'0',NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL),(4,1,'ISS-004','quality','Concrete honeycombing at column C3','Surface finish not as per spec. Re-pour or patch?',1,'2026-04-22 17:25:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'open',1,NULL,'0',NULL,NULL,NULL,NULL,0,0,NULL,0,NULL,NULL,NULL,NULL,'text',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL);
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
  `room_type` enum('coordination','internal','finance','internal_naveen','internal_finance','system_health','site','design','general') COLLATE utf8mb4_general_ci NOT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meetings`
--

LOCK TABLES `meetings` WRITE;
/*!40000 ALTER TABLE `meetings` DISABLE KEYS */;
INSERT INTO `meetings` VALUES (1,1,1,NULL,'MOM-001','client','sent_to_client','Kickoff meeting with TLD MAINI','2026-03-20',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'draft',NULL,'2026-04-22 17:25:19'),(2,1,1,NULL,'MOM-002','site_visit','internal','Foundation progress review','2026-04-05',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'draft',NULL,'2026-04-22 17:25:19'),(3,1,1,NULL,'MOM-003','design_review','internal','Drawing review ├óΓé¼ΓÇ¥ Electrical R0','2026-04-12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'draft',NULL,'2026-04-22 17:25:19');
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
) ENGINE=InnoDB AUTO_INCREMENT=166 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_triggers`
--

LOCK TABLES `notification_triggers` WRITE;
/*!40000 ALTER TABLE `notification_triggers` DISABLE KEYS */;
INSERT INTO `notification_triggers` VALUES (1,'Claims','claim.approved','Claim approved','principal','whatsapp',1,'claims.js:244','2026-04-22 17:25:19'),(2,'Claims','claim.approved','Claim approved','design_principal','whatsapp',1,'claims.js:244','2026-04-22 17:25:19'),(3,'Claims','claim.approved','Claim approved','pmc_head','whatsapp',1,'claims.js:250','2026-04-22 17:25:19'),(4,'Drawings','drawing.approved','Drawing approved / issued','principal','whatsapp',1,'drawings.js:621','2026-04-22 17:25:19'),(5,'Drawings','drawing.approved','Drawing approved / issued','design_principal','whatsapp',1,'drawings.js:621','2026-04-22 17:25:19'),(6,'Drawings','drawing.flagged','Drawing flagged at L1 review','uploader','whatsapp',1,'drawings.js:542','2026-04-22 17:25:19'),(7,'GRN','grn.ncr-raised','NCR / non-conformance flagged','principal','whatsapp',1,'grn.js:340','2026-04-22 17:25:19'),(8,'GRN','grn.ncr-raised','NCR / non-conformance flagged','design_principal','whatsapp',1,'grn.js:340','2026-04-22 17:25:19'),(9,'GRN','grn.ncr-raised','NCR / non-conformance flagged','pmc_head','whatsapp',1,'grn.js:340','2026-04-22 17:25:19'),(10,'GRN','grn.ncr-raised','NCR / non-conformance flagged','design_head','whatsapp',1,'grn.js:345','2026-04-22 17:25:19'),(11,'GRN','grn.ncr-raised','NCR / non-conformance flagged','services_head','whatsapp',1,'grn.js:345','2026-04-22 17:25:19'),(12,'GRN','grn.ncr-raised','NCR / non-conformance flagged','vendor','whatsapp',1,'grn.js:353','2026-04-22 17:25:19'),(13,'Issues','issue.auto-assigned','Issue auto-assigned','assignee','whatsapp',1,'issues.js:121','2026-04-22 17:25:19'),(14,'Issues','issue.assigned','Issue assigned (manual)','assignee','whatsapp',1,'issues.js:152','2026-04-22 17:25:19'),(15,'Issues','issue.ncr-vendor','Issue NCR sent to vendor','vendor','whatsapp',1,'issues.js:160','2026-04-22 17:25:19'),(16,'Meetings','meeting.action-item-assigned','MOM action item assigned','assignee','whatsapp',1,'meetings.js:428','2026-04-22 17:25:19'),(17,'Payments','payment.confirmed-utr','Payment confirmed (UTR applied)','principal','whatsapp',1,'payments.js:480','2026-04-22 17:25:19'),(18,'Payments','payment.confirmed-utr','Payment confirmed (UTR applied)','design_principal','whatsapp',1,'payments.js:480','2026-04-22 17:25:19'),(19,'Payments','payment.confirmed-utr','Payment confirmed (UTR applied)','vendor','whatsapp',1,'payments.js:480','2026-04-22 17:25:19'),(20,'Payments','payment.utr-batch','UTR batch consolidated','principal','whatsapp',1,'payments.js:844','2026-04-22 17:25:19'),(21,'Payments','payment.utr-batch','UTR batch consolidated','design_principal','whatsapp',1,'payments.js:844','2026-04-22 17:25:19'),(22,'PaymentReq','payment-request.raised','Payment request raised','pmc_head','whatsapp',1,'payment-requests.js:214','2026-04-22 17:25:19'),(23,'PaymentReq','payment-request.raised','Payment request raised','principal','whatsapp',1,'payment-requests.js:214','2026-04-22 17:25:19'),(24,'PaymentReq','payment-request.pmc-approved','PR PMC approved','principal','whatsapp',1,'payment-requests.js:334','2026-04-22 17:25:19'),(25,'PaymentReq','payment-request.pmc-approved','PR PMC approved','design_principal','whatsapp',1,'payment-requests.js:334','2026-04-22 17:25:19'),(26,'PaymentReq','payment-request.pmc-approved','PR PMC approved','finance_admin','whatsapp',1,'payment-requests.js:352','2026-04-22 17:25:19'),(27,'PaymentReq','payment-request.pmc-rejected','PR rejected by PMC','raiser','whatsapp',1,'payment-requests.js:303','2026-04-22 17:25:19'),(28,'PaymentReq','payment-request.principal-approved','PR approved by Principal','finance_admin','whatsapp',1,'payment-requests.js:427','2026-04-22 17:25:19'),(29,'PaymentReq','payment-request.principal-approved','PR approved by Principal','raiser','whatsapp',1,'payment-requests.js:427','2026-04-22 17:25:19'),(30,'PaymentReq','payment-request.principal-rejected','PR rejected by Principal','raiser','whatsapp',1,'payment-requests.js:430','2026-04-22 17:25:19'),(31,'PaymentReq','payment-request.principal-rejected','PR rejected by Principal','pmc_reviewer','whatsapp',1,'payment-requests.js:431','2026-04-22 17:25:19'),(32,'PaymentReq','payment-request.vendor-confirmed','Vendor payment confirmed','vendor','whatsapp',1,'payment-requests.js:502','2026-04-22 17:25:19'),(33,'PaymentReq','payment-request.vendor-confirmed','Vendor payment confirmed','raiser','whatsapp',1,'payment-requests.js:508','2026-04-22 17:25:19'),(34,'PaymentReq','urgent-payment.raised','Urgent payment raised','pmc_head','whatsapp',1,'urgent-payments.js:111','2026-04-22 17:25:19'),(35,'PaymentReq','urgent-payment.raised','Urgent payment raised','principal','whatsapp',1,'urgent-payments.js:124','2026-04-22 17:25:19'),(36,'PaymentReq','urgent-payment.raised','Urgent payment raised','design_principal','whatsapp',1,'urgent-payments.js:124','2026-04-22 17:25:19'),(37,'Reports','report.ready-for-review','Weekly report ready for review','principal','whatsapp',1,'reports.js:134','2026-04-22 17:25:19'),(38,'Reports','report.ready-for-review','Weekly report ready for review','design_principal','whatsapp',1,'reports.js:134','2026-04-22 17:25:19'),(39,'Reports','report.drag-flag','Drag flag on weekly report','principal','whatsapp',1,'reports.js:195,365','2026-04-22 17:25:19'),(40,'Reports','report.drag-flag','Drag flag on weekly report','design_principal','whatsapp',1,'reports.js:195,365','2026-04-22 17:25:19'),(41,'Reports','report.pmc-approved','Weekly report approved by PMC Head','principal','whatsapp',1,'reports.js:234','2026-04-22 17:25:19'),(42,'Reports','report.pmc-approved','Weekly report approved by PMC Head','design_principal','whatsapp',1,'reports.js:234','2026-04-22 17:25:19'),(43,'Schedule','schedule.version-uploaded','Schedule version uploaded','principal','whatsapp',1,'schedule.js:252','2026-04-22 17:25:19'),(44,'Schedule','schedule.version-uploaded','Schedule version uploaded','design_principal','whatsapp',1,'schedule.js:252','2026-04-22 17:25:19'),(45,'Schedule','schedule.drift-acknowledged','Schedule drift acknowledged','principal','whatsapp',1,'schedule.js:281','2026-04-22 17:25:19'),(46,'Schedule','schedule.drift-acknowledged','Schedule drift acknowledged','design_principal','whatsapp',1,'schedule.js:281','2026-04-22 17:25:19'),(47,'Schedule','schedule.task-outlier','Task outlier detected (AI flag)','principal','whatsapp',1,'schedule.js:366','2026-04-22 17:25:19'),(48,'Schedule','schedule.task-outlier','Task outlier detected (AI flag)','design_principal','whatsapp',1,'schedule.js:366','2026-04-22 17:25:19'),(49,'Users','user.pending-approval','New user pending approval','principal','whatsapp',1,'user-management.js:61','2026-04-22 17:25:19'),(50,'Users','user.pending-approval','New user pending approval','design_principal','whatsapp',1,'user-management.js:61','2026-04-22 17:25:19'),(51,'Users','user.activated','New user activated','new_user','whatsapp',1,'user-management.js:94','2026-04-22 17:25:19'),(52,'Vendors','vendor.pending-clearance','Vendor pending finance clearance','finance_admin','whatsapp',1,'vendors.js:114','2026-04-22 17:25:19'),(53,'Vendors','vendor.engagement-pending','Vendor engagement pending approval','principal','whatsapp',1,'vendors.js:423','2026-04-22 17:25:19'),(54,'Vendors','vendor.engagement-pending','Vendor engagement pending approval','design_principal','whatsapp',1,'vendors.js:423','2026-04-22 17:25:19'),(55,'Vendors','vendor.engagement-approved','Vendor engagement approved','raiser','whatsapp',1,'vendors.js:469','2026-04-22 17:25:19'),(56,'Vendors','vendor.engagement-rejected','Vendor engagement rejected','raiser','whatsapp',1,'vendors.js:500','2026-04-22 17:25:19'),(57,'Budget','budget.custom-head','Custom budget head approved/rejected','principal','whatsapp',1,'budget.js:193','2026-04-22 17:25:19'),(58,'Budget','budget.custom-head','Custom budget head approved/rejected','design_principal','whatsapp',1,'budget.js:200','2026-04-22 17:25:19'),(59,'Changes','change-notice.ready','CN ready for principal approval','principal','whatsapp',1,'changes.js:148','2026-04-22 17:25:19'),(60,'Changes','change-notice.ready','CN ready for principal approval','design_principal','whatsapp',1,'changes.js:148','2026-04-22 17:25:19'),(61,'Projects','project.client-incomplete','Client master incomplete','finance_admin','whatsapp',1,'projects.js:462','2026-04-22 17:25:19'),(114,'Claims','claims.claim.approved','Claim approved','principal','whatsapp',1,'claims.js:244,250','2026-06-05 09:46:47'),(115,'Claims','claims.claim.approved','Claim approved','design_principal','whatsapp',1,'claims.js:244,250','2026-06-05 09:46:47'),(116,'Claims','claims.claim.approved','Claim approved','pmc_head','whatsapp',1,'claims.js:244,250','2026-06-05 09:46:47'),(117,'Drawings','drawings.drawing.approved.issued','Drawing approved / issued','principal','whatsapp',1,'drawings.js:621','2026-06-05 09:46:47'),(118,'Drawings','drawings.drawing.approved.issued','Drawing approved / issued','design_principal','whatsapp',1,'drawings.js:621','2026-06-05 09:46:47'),(119,'GRN','grn.ncr.non.conformance.flagged','NCR / non-conformance flagged','principal','whatsapp',1,'grn.js:340,345,353','2026-06-05 09:46:47'),(120,'GRN','grn.ncr.non.conformance.flagged','NCR / non-conformance flagged','design_principal','whatsapp',1,'grn.js:340,345,353','2026-06-05 09:46:47'),(121,'GRN','grn.ncr.non.conformance.flagged','NCR / non-conformance flagged','pmc_head','whatsapp',1,'grn.js:340,345,353','2026-06-05 09:46:47'),(122,'GRN','grn.ncr.non.conformance.flagged','NCR / non-conformance flagged','design_head','whatsapp',1,'grn.js:340,345,353','2026-06-05 09:46:47'),(123,'GRN','grn.ncr.non.conformance.flagged','NCR / non-conformance flagged','services_head','whatsapp',1,'grn.js:340,345,353','2026-06-05 09:46:47'),(124,'Payments','payments.payment.confirmed.utr.applied.','Payment confirmed (UTR applied)','principal','whatsapp',1,'payments.js:480','2026-06-05 09:46:47'),(125,'Payments','payments.payment.confirmed.utr.applied.','Payment confirmed (UTR applied)','design_principal','whatsapp',1,'payments.js:480','2026-06-05 09:46:47'),(126,'Payments','payments.utr.batch.consolidated','UTR batch consolidated','principal','whatsapp',1,'payments.js:844','2026-06-05 09:46:47'),(127,'Payments','payments.utr.batch.consolidated','UTR batch consolidated','design_principal','whatsapp',1,'payments.js:844','2026-06-05 09:46:47'),(128,'Payment Requests','payment.requests.pr.raised.by.site.team','PR raised by site/team','principal','whatsapp',1,'payment-requests.js:214','2026-06-05 09:46:47'),(129,'Payment Requests','payment.requests.pr.raised.by.site.team','PR raised by site/team','design_principal','whatsapp',1,'payment-requests.js:214','2026-06-05 09:46:47'),(130,'Payment Requests','payment.requests.pr.raised.by.site.team','PR raised by site/team','pmc_head','whatsapp',1,'payment-requests.js:214','2026-06-05 09:46:47'),(131,'Payment Requests','payment.requests.pr.pmc.approved','PR PMC approved','principal','whatsapp',1,'payment-requests.js:334,352','2026-06-05 09:46:47'),(132,'Payment Requests','payment.requests.pr.pmc.approved','PR PMC approved','design_principal','whatsapp',1,'payment-requests.js:334,352','2026-06-05 09:46:47'),(133,'Payment Requests','payment.requests.pr.pmc.approved','PR PMC approved','finance_admin','whatsapp',1,'payment-requests.js:334,352','2026-06-05 09:46:47'),(134,'Payment Requests','payment.requests.pr.approved.by.principal','PR approved by Principal','finance_admin','whatsapp',1,'payment-requests.js:427','2026-06-05 09:46:47'),(135,'Payment Requests','payment.requests.urgent.payment.raised','Urgent payment raised','principal','whatsapp',1,'urgent-payments.js:111,124','2026-06-05 09:46:47'),(136,'Payment Requests','payment.requests.urgent.payment.raised','Urgent payment raised','design_principal','whatsapp',1,'urgent-payments.js:111,124','2026-06-05 09:46:47'),(137,'Payment Requests','payment.requests.urgent.payment.raised','Urgent payment raised','pmc_head','whatsapp',1,'urgent-payments.js:111,124','2026-06-05 09:46:47'),(138,'PMC Deputy','pmc.deputy.deputy.assigned','Deputy assigned','principal','whatsapp',1,'pmc-deputy.js:81,91','2026-06-05 09:46:47'),(139,'PMC Deputy','pmc.deputy.deputy.assigned','Deputy assigned','design_principal','whatsapp',1,'pmc-deputy.js:81,91','2026-06-05 09:46:47'),(140,'PMC Deputy','pmc.deputy.deputy.returned.pmc.head.restored','Deputy returned / PMC Head restored','principal','whatsapp',1,'pmc-deputy.js:116','2026-06-05 09:46:47'),(141,'PMC Deputy','pmc.deputy.deputy.returned.pmc.head.restored','Deputy returned / PMC Head restored','design_principal','whatsapp',1,'pmc-deputy.js:116','2026-06-05 09:46:47'),(142,'Projects','projects.client.master.incomplete.on.new.project','Client master incomplete on new project','finance_admin','whatsapp',1,'projects.js:462','2026-06-05 09:46:47'),(143,'Reports','reports.weekly.report.ready.for.review','Weekly report ready for review','principal','whatsapp',1,'reports.js:134','2026-06-05 09:46:47'),(144,'Reports','reports.weekly.report.ready.for.review','Weekly report ready for review','design_principal','whatsapp',1,'reports.js:134','2026-06-05 09:46:47'),(145,'Reports','reports.drag.flag.on.report','Drag flag on report','principal','whatsapp',1,'reports.js:195,365','2026-06-05 09:46:47'),(146,'Reports','reports.drag.flag.on.report','Drag flag on report','design_principal','whatsapp',1,'reports.js:195,365','2026-06-05 09:46:47'),(147,'Reports','reports.weekly.report.approved.by.pmc.head','Weekly report approved by PMC Head','principal','whatsapp',1,'reports.js:234','2026-06-05 09:46:47'),(148,'Reports','reports.weekly.report.approved.by.pmc.head','Weekly report approved by PMC Head','design_principal','whatsapp',1,'reports.js:234','2026-06-05 09:46:47'),(149,'Schedule','schedule.schedule.version.uploaded.drift.detected.','Schedule version uploaded (drift detected)','principal','whatsapp',1,'schedule.js:252','2026-06-05 09:46:47'),(150,'Schedule','schedule.schedule.version.uploaded.drift.detected.','Schedule version uploaded (drift detected)','design_principal','whatsapp',1,'schedule.js:252','2026-06-05 09:46:47'),(151,'Schedule','schedule.schedule.drift.acknowledged.by.pmc.head','Schedule drift acknowledged by PMC Head','principal','whatsapp',1,'schedule.js:281','2026-06-05 09:46:47'),(152,'Schedule','schedule.schedule.drift.acknowledged.by.pmc.head','Schedule drift acknowledged by PMC Head','design_principal','whatsapp',1,'schedule.js:281','2026-06-05 09:46:47'),(153,'Schedule','schedule.task.outlier.detected.ai.','Task outlier detected (AI)','principal','whatsapp',1,'schedule.js:366','2026-06-05 09:46:47'),(154,'Schedule','schedule.task.outlier.detected.ai.','Task outlier detected (AI)','design_principal','whatsapp',1,'schedule.js:366','2026-06-05 09:46:47'),(155,'Users','users.new.user.pending.approval','New user pending approval','principal','whatsapp',1,'user-management.js:61','2026-06-05 09:46:47'),(156,'Users','users.new.user.pending.approval','New user pending approval','design_principal','whatsapp',1,'user-management.js:61','2026-06-05 09:46:47'),(157,'Vendors','vendors.vendor.added.pending.finance.clearance','Vendor added ΓÇö pending finance clearance','finance_admin','whatsapp',1,'vendors.js:114,307','2026-06-05 09:46:47'),(158,'Vendors','vendors.vendor.engagement.pending.approval','Vendor engagement pending approval','principal','whatsapp',1,'vendors.js:423','2026-06-05 09:46:47'),(159,'Vendors','vendors.vendor.engagement.pending.approval','Vendor engagement pending approval','design_principal','whatsapp',1,'vendors.js:423','2026-06-05 09:46:47'),(160,'Budget','budget.custom.budget.head.approved.rejected','Custom budget head approved/rejected','principal','whatsapp',1,'budget.js:193,200,230','2026-06-05 09:46:47'),(161,'Budget','budget.custom.budget.head.approved.rejected','Custom budget head approved/rejected','design_principal','whatsapp',1,'budget.js:193,200,230','2026-06-05 09:46:47'),(162,'Change Notices','change.notices.cn.ready.for.principal.approval','CN ready for principal approval','principal','whatsapp',1,'changes.js:148','2026-06-05 09:46:47'),(163,'Change Notices','change.notices.cn.ready.for.principal.approval','CN ready for principal approval','design_principal','whatsapp',1,'changes.js:148','2026-06-05 09:46:47'),(164,'Project Setup','project.setup.date.sanity.check.acknowledged','Date sanity check acknowledged','principal','whatsapp',1,'project-setup.js:138','2026-06-05 09:46:47'),(165,'Project Setup','project.setup.date.sanity.check.acknowledged','Date sanity check acknowledged','design_principal','whatsapp',1,'project-setup.js:138','2026-06-05 09:46:47');
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
INSERT INTO `notifications_config` VALUES (1,'morning_pmc','07:00:00',1,'2026-06-02 12:12:00','2026-06-02 12:12:00'),(2,'naveen_morning','08:00:00',1,'2026-06-02 12:12:00','2026-06-02 12:12:00'),(3,'closeout','21:00:00',1,'2026-06-02 12:12:00','2026-06-02 12:12:00');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_requests`
--

LOCK TABLES `payment_requests` WRITE;
/*!40000 ALTER TABLE `payment_requests` DISABLE KEYS */;
INSERT INTO `payment_requests` VALUES (1,1,1,1,1,1,450000.00,'RA Bill #1 ├óΓé¼ΓÇ¥ civil works 10%','running_account_bill','pending_pmc',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-04-22 17:25:19','2026-04-22 17:25:19'),(2,1,1,2,2,1,320000.00,'Mobilisation advance 10%','mobilisation_advance','pmc_approved',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-04-22 17:25:19','2026-04-22 17:25:19'),(3,1,1,3,3,1,280000.00,'Equipment advance for VRV units','material_advance','principal_approved',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'icici_bulk',NULL,18.00,NULL,0,0,NULL,NULL,NULL,'2026-04-22 17:25:19','2026-04-22 17:25:19');
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
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_assignments`
--

LOCK TABLES `project_assignments` WRITE;
/*!40000 ALTER TABLE `project_assignments` DISABLE KEYS */;
INSERT INTO `project_assignments` VALUES (1,1,2,'member',1,'2026-04-22 17:25:19',1),(4,1,1,'member',1,'2026-04-22 17:25:19',1),(7,1,21,'member',1,'2026-04-22 17:25:19',1),(8,1,31,'member',1,'2026-04-22 17:25:19',1),(9,1,24,'member',1,'2026-04-22 17:25:19',1),(11,1,29,'member',1,'2026-04-22 17:25:19',1),(12,1,27,'member',1,'2026-04-22 17:25:19',1),(13,1,35,'member',1,'2026-04-22 17:25:19',1),(14,1,38,'member',1,'2026-04-22 17:25:19',1),(15,1,28,'member',1,'2026-04-22 17:25:19',1),(16,1,32,'member',1,'2026-04-22 17:25:19',1),(18,1,30,'member',1,'2026-04-22 17:25:19',1),(19,1,26,'member',1,'2026-04-22 17:25:19',1),(20,1,33,'member',1,'2026-04-22 17:25:19',1),(21,1,34,'member',1,'2026-04-22 17:25:19',1),(22,1,25,'member',1,'2026-04-22 17:25:19',1),(23,1,36,'member',1,'2026-04-22 17:25:19',1),(32,2,32,'pmc_head',1,'2026-06-03 13:33:51',1),(33,2,33,'site_manager',1,'2026-06-03 13:33:51',1),(35,4,25,'member',1,'2026-06-05 11:26:44',1),(37,4,28,'member',1,'2026-06-05 11:26:44',1),(46,1,39,'member',1,'2026-06-05 11:35:17',1);
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_setup_tracking`
--

LOCK TABLES `project_setup_tracking` WRITE;
/*!40000 ALTER TABLE `project_setup_tracking` DISABLE KEYS */;
INSERT INTO `project_setup_tracking` VALUES (1,1,3,1,'2026-06-05 05:21:08',NULL,NULL,'2026-06-05 05:21:08','2026-06-05 05:21:08'),(2,1,7,1,'2026-06-05 05:21:08',NULL,NULL,'2026-06-05 05:21:08','2026-06-05 05:21:08'),(3,1,4,1,'2026-06-05 05:21:08',NULL,NULL,'2026-06-05 05:21:08','2026-06-05 05:21:08'),(4,1,9,1,'2026-06-05 05:21:08',NULL,NULL,'2026-06-05 05:21:08','2026-06-05 05:21:08'),(5,1,10,1,'2026-06-05 05:21:08',NULL,NULL,'2026-06-05 05:21:08','2026-06-05 05:21:08'),(6,1,12,1,'2026-06-05 05:21:08',NULL,NULL,'2026-06-05 05:21:08','2026-06-05 05:21:08');
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
INSERT INTO `project_thresholds` VALUES (1,NULL,'min_headcount',8,'2026-06-02 12:12:00','2026-06-02 12:12:00'),(2,NULL,'float_days',3,'2026-06-02 12:12:00','2026-06-02 12:12:00'),(3,NULL,'overdue_days',2,'2026-06-02 12:12:00','2026-06-02 12:12:00'),(4,NULL,'grn_pending_days',3,'2026-06-02 12:12:00','2026-06-02 12:12:00'),(5,NULL,'snag_pending_days',7,'2026-06-02 12:12:00','2026-06-02 12:12:00'),(6,NULL,'budget_alert_pct',90,'2026-06-02 12:12:00','2026-06-02 12:12:00');
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
  `setup_template_id` int unsigned DEFAULT '1',
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
  CONSTRAINT `chk_proj_dates` CHECK ((`r0_end_date` >= `r0_start_date`))
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (1,2,'primary','PV90','PV 90 Production Line','TLD MAINI GSE Pvt Ltd',NULL,'Nelamangala, Bengaluru',NULL,NULL,'industrial','2026-03-23','2026-05-25',NULL,12500000.00,NULL,NULL,NULL,'active',1,1,1,1,1,1,1,1,'2026-04-22 17:25:19','2026-04-22 17:25:19','principal_only',NULL,1),(2,2,'primary','TESTP1','Test Project Alpha','Test Client Pvt Ltd',2,'Electronic City, Bengaluru',NULL,NULL,'industrial','2026-05-01','2027-04-30','BBMP',25000000.00,NULL,'2026-05-01','2027-05-01','initialising',1,0,0,0,0,0,0,1,'2026-06-03 13:33:51','2026-06-06 09:37:06','principal_only',NULL,1),(3,2,'primary','STUBP1','Stub Client Test Project','Acme Brand New Industries Ltd',3,'Sarjapur',NULL,NULL,'commercial','2026-06-01','2027-05-31',NULL,NULL,NULL,'2026-06-01','2027-05-31','initialising',1,0,0,0,0,0,0,1,'2026-06-03 13:33:51','2026-06-06 09:37:06','principal_only',NULL,1),(4,2,'primary','STUBP2','Reuse Existing Client Project','Acme Brand New Industries Ltd',3,'Sarjapur',NULL,NULL,'commercial','2026-07-01','2027-06-30',NULL,NULL,NULL,'2026-07-01','2027-06-30','active',1,0,0,1,1,1,1,1,'2026-06-03 13:33:51','2026-06-06 09:37:06','principal_only',NULL,1);
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
) ENGINE=InnoDB AUTO_INCREMENT=222 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_nav`
--

LOCK TABLES `role_nav` WRITE;
/*!40000 ALTER TABLE `role_nav` DISABLE KEYS */;
INSERT INTO `role_nav` VALUES (1,'principal','home','dashboard',1,1,'2026-04-22 17:25:18'),(2,'principal','home','monthly',2,1,'2026-04-22 17:25:18'),(3,'principal','home','projects',3,1,'2026-04-22 17:25:18'),(4,'principal','home','project_detail',4,1,'2026-04-22 17:25:18'),(5,'principal','money','payments',1,1,'2026-04-22 17:25:18'),(6,'principal','money','vendors_master',2,1,'2026-04-22 17:25:18'),(7,'principal','money','budget',3,1,'2026-04-22 17:25:18'),(8,'principal','money','boq_mapping',4,1,'2026-04-22 17:25:18'),(9,'principal','money','client_boq',5,1,'2026-04-22 17:25:18'),(10,'principal','pending','pending',1,1,'2026-04-22 17:25:18'),(11,'principal','more','register',1,1,'2026-04-22 17:25:18'),(12,'principal','more','delegations',2,1,'2026-04-22 17:25:18'),(13,'principal','more','changes',3,1,'2026-04-22 17:25:18'),(14,'principal','more','weekly_health',4,1,'2026-04-22 17:25:18'),(15,'principal','more','users',5,1,'2026-04-22 17:25:18'),(16,'design_principal','home','dashboard',1,1,'2026-04-22 17:25:18'),(17,'design_principal','home','monthly',2,1,'2026-04-22 17:25:18'),(18,'design_principal','home','projects',3,1,'2026-04-22 17:25:18'),(19,'design_principal','home','project_detail',4,1,'2026-04-22 17:25:18'),(20,'design_principal','money','payments',1,1,'2026-04-22 17:25:18'),(21,'design_principal','money','vendors_master',2,1,'2026-04-22 17:25:18'),(22,'design_principal','money','budget',3,1,'2026-04-22 17:25:18'),(23,'design_principal','money','boq_mapping',4,1,'2026-04-22 17:25:18'),(24,'design_principal','money','client_boq',5,1,'2026-04-22 17:25:18'),(25,'design_principal','pending','pending',1,1,'2026-04-22 17:25:18'),(26,'design_principal','more','register',1,1,'2026-04-22 17:25:18'),(27,'design_principal','more','delegations',2,1,'2026-04-22 17:25:18'),(28,'design_principal','more','changes',3,1,'2026-04-22 17:25:18'),(29,'design_principal','more','weekly_health',4,1,'2026-04-22 17:25:18'),(30,'design_principal','more','users',5,1,'2026-04-22 17:25:18'),(31,'pmc_head','home','dashboard',1,1,'2026-04-22 17:25:18'),(32,'pmc_head','home','monthly',2,1,'2026-04-22 17:25:18'),(33,'pmc_head','home','project_detail',4,1,'2026-06-05 15:12:24'),(35,'pmc_head','work','issues',2,1,'2026-04-22 17:25:18'),(36,'pmc_head','work','meetings',3,1,'2026-04-22 17:25:18'),(37,'pmc_head','work','drawings',4,1,'2026-04-22 17:25:18'),(38,'pmc_head','work','register',5,1,'2026-04-22 17:25:18'),(39,'pmc_head','work','materials',6,1,'2026-04-22 17:25:18'),(40,'pmc_head','work','labour',7,1,'2026-04-22 17:25:18'),(41,'pmc_head','money','grn',1,1,'2026-04-22 17:25:18'),(42,'pmc_head','money','payments',2,1,'2026-04-22 17:25:18'),(43,'pmc_head','money','vendors',3,1,'2026-04-22 17:25:18'),(44,'pmc_head','money','vendors_master',4,1,'2026-04-22 17:25:18'),(45,'pmc_head','pending','pending',1,1,'2026-04-22 17:25:18'),(46,'design_head','home','dashboard',1,1,'2026-04-22 17:25:18'),(47,'design_head','home','monthly',2,1,'2026-04-22 17:25:18'),(48,'design_head','home','project_detail',4,1,'2026-06-05 15:14:11'),(49,'design_head','work','drawings',1,1,'2026-04-22 17:25:18'),(50,'design_head','work','issues',2,1,'2026-04-22 17:25:18'),(51,'design_head','work','submittals',3,1,'2026-04-22 17:25:18'),(52,'design_head','work','register',4,1,'2026-04-22 17:25:18'),(53,'design_head','work','phototags',5,1,'2026-04-22 17:25:18'),(54,'design_head','money','materials',1,1,'2026-04-22 17:25:18'),(55,'design_head','money','budget',2,1,'2026-04-22 17:25:18'),(56,'design_head','money','payments',3,1,'2026-04-22 17:25:18'),(57,'design_head','more','signoff',1,1,'2026-04-22 17:25:18'),(58,'design_head','more','delegations',2,1,'2026-04-22 17:25:18'),(59,'services_head','home','dashboard',1,1,'2026-04-22 17:25:18'),(60,'services_head','home','monthly',2,1,'2026-04-22 17:25:18'),(61,'services_head','home','project_detail',4,1,'2026-06-05 15:14:11'),(62,'services_head','work','drawings',1,1,'2026-04-22 17:25:18'),(63,'services_head','work','issues',2,1,'2026-04-22 17:25:18'),(64,'services_head','work','submittals',3,1,'2026-04-22 17:25:18'),(65,'services_head','work','register',4,1,'2026-04-22 17:25:18'),(66,'services_head','work','phototags',5,1,'2026-04-22 17:25:18'),(67,'services_head','money','materials',1,1,'2026-04-22 17:25:18'),(68,'services_head','money','budget',2,1,'2026-04-22 17:25:18'),(69,'services_head','money','payments',3,1,'2026-04-22 17:25:18'),(70,'services_head','more','signoff',1,1,'2026-04-22 17:25:18'),(71,'services_head','more','delegations',2,1,'2026-04-22 17:25:18'),(72,'site_manager','home','dashboard',1,1,'2026-04-22 17:25:18'),(73,'site_manager','home','project_detail',2,1,'2026-04-22 17:25:18'),(74,'site_manager','work','tasks',1,1,'2026-04-22 17:25:18'),(75,'site_manager','work','photos',2,1,'2026-04-22 17:25:18'),(76,'site_manager','work','issues_site',3,1,'2026-04-22 17:25:18'),(77,'site_manager','work','issues',4,1,'2026-04-22 17:25:18'),(78,'site_manager','work','labour',5,1,'2026-04-22 17:25:18'),(79,'site_manager','work','drawings',6,1,'2026-04-22 17:25:18'),(80,'site_manager','work','register',7,1,'2026-04-22 17:25:18'),(81,'site_manager','money','grn',1,1,'2026-04-22 17:25:18'),(82,'site_manager','money','payments',2,1,'2026-04-22 17:25:18'),(83,'site_manager','money','materials_site',3,1,'2026-04-22 17:25:18'),(84,'senior_site_manager','home','dashboard',1,1,'2026-04-22 17:25:18'),(85,'senior_site_manager','home','project_detail',2,1,'2026-04-22 17:25:18'),(86,'senior_site_manager','work','tasks',1,1,'2026-04-22 17:25:18'),(87,'senior_site_manager','work','photos',2,1,'2026-04-22 17:25:18'),(88,'senior_site_manager','work','issues_site',3,1,'2026-04-22 17:25:18'),(89,'senior_site_manager','work','issues',4,1,'2026-04-22 17:25:18'),(90,'senior_site_manager','work','labour',5,1,'2026-04-22 17:25:18'),(91,'senior_site_manager','work','drawings',6,1,'2026-04-22 17:25:18'),(92,'senior_site_manager','work','register',7,1,'2026-04-22 17:25:18'),(93,'senior_site_manager','money','grn',1,1,'2026-04-22 17:25:18'),(94,'senior_site_manager','money','payments',2,1,'2026-04-22 17:25:18'),(95,'senior_site_manager','money','materials_site',3,1,'2026-04-22 17:25:18'),(96,'finance_admin','home','dashboard',1,1,'2026-04-22 17:25:18'),(97,'finance_admin','home','monthly',2,1,'2026-04-22 17:25:18'),(98,'finance_admin','home','project_detail',3,1,'2026-04-22 17:25:18'),(99,'finance_admin','money','payments_fin',1,1,'2026-04-22 17:25:18'),(100,'finance_admin','money','vendors_master',2,1,'2026-04-22 17:25:18'),(101,'finance_admin','money','client_receipts',3,1,'2026-04-22 17:25:18'),(102,'finance_admin','money','petty_cash',4,1,'2026-04-22 17:25:18'),(103,'finance_admin','money','pi',5,1,'2026-04-22 17:25:18'),(104,'finance_admin','money','gst_statement',6,1,'2026-04-22 17:25:18'),(105,'finance_admin','money','client_boq',7,1,'2026-04-22 17:25:18'),(106,'finance_admin','money','clients',8,1,'2026-04-22 17:25:18'),(107,'team_lead','home','dashboard',1,1,'2026-04-22 17:25:18'),(108,'team_lead','home','project_detail',2,1,'2026-04-22 17:25:18'),(109,'team_lead','work','drawings',1,1,'2026-04-22 17:25:18'),(110,'team_lead','work','register',2,1,'2026-04-22 17:25:18'),(111,'team_lead','work','issues',3,1,'2026-04-22 17:25:18'),(112,'team_lead','work','submittals',4,1,'2026-04-22 17:25:18'),(113,'team_lead','work','phototags',5,1,'2026-04-22 17:25:18'),(121,'jr_architect','home','dashboard',1,1,'2026-04-22 17:25:18'),(122,'jr_architect','home','project_detail',2,1,'2026-04-22 17:25:18'),(123,'jr_architect','work','drawings',1,1,'2026-04-22 17:25:18'),(124,'jr_architect','work','issues',2,1,'2026-04-22 17:25:18'),(125,'jr_architect','work','submittals',3,1,'2026-04-22 17:25:18'),(126,'services_engineer','home','dashboard',1,1,'2026-04-22 17:25:18'),(127,'services_engineer','home','project_detail',2,1,'2026-04-22 17:25:18'),(128,'services_engineer','work','drawings',1,1,'2026-04-22 17:25:18'),(129,'services_engineer','work','issues',2,1,'2026-04-22 17:25:18'),(130,'services_engineer','work','submittals',3,1,'2026-04-22 17:25:18'),(131,'services_engineer','work','phototags',4,1,'2026-04-22 17:25:18'),(132,'coordinator','home','dashboard',1,1,'2026-04-22 17:25:18'),(133,'coordinator','home','project_detail',2,1,'2026-04-22 17:25:18'),(134,'coordinator','work','meetings',1,1,'2026-04-22 17:25:18'),(135,'coordinator','work','tasks',2,1,'2026-04-22 17:25:18'),(136,'coordinator','work','issues',3,1,'2026-04-22 17:25:18'),(137,'coordinator','work','drawings',4,1,'2026-04-22 17:25:18'),(138,'coordinator','work','register',5,1,'2026-04-22 17:25:18'),(139,'coordinator','work','photos',6,1,'2026-04-22 17:25:18'),(140,'coordinator','work','grn',7,1,'2026-04-22 17:25:18'),(141,'trainee','strip','drawings',1,1,'2026-04-22 17:25:18'),(142,'trainee','strip','schedule_view',2,1,'2026-04-22 17:25:18'),(143,'detailing','strip','drawings',1,1,'2026-04-22 17:25:18'),(144,'detailing','strip','submittals',2,1,'2026-04-22 17:25:18'),(145,'audit','home','dashboard',1,1,'2026-04-22 17:25:18'),(146,'audit','home','monthly',2,1,'2026-04-22 17:25:18'),(147,'audit','home','projects',3,1,'2026-04-22 17:25:18'),(148,'audit','home','project_detail',4,1,'2026-04-22 17:25:18'),(149,'audit','money','payments',1,1,'2026-04-22 17:25:18'),(150,'audit','money','payments_fin',2,1,'2026-04-22 17:25:18'),(151,'audit','money','vendors',3,1,'2026-04-22 17:25:18'),(152,'audit','money','vendors_master',4,1,'2026-04-22 17:25:18'),(153,'audit','money','finance_clearance',5,1,'2026-04-22 17:25:18'),(154,'audit','money','budget',6,1,'2026-04-22 17:25:18'),(155,'audit','money','budget_tree',7,1,'2026-04-22 17:25:18'),(156,'audit','money','boq_mapping',8,1,'2026-04-22 17:25:18'),(157,'audit','money','client_boq',9,1,'2026-04-22 17:25:18'),(158,'audit','money','materials',10,1,'2026-04-22 17:25:18'),(159,'audit','money','grn',11,1,'2026-04-22 17:25:18'),(160,'audit','money','pi',12,1,'2026-04-22 17:25:18'),(161,'audit','money','petty_cash',13,1,'2026-04-22 17:25:18'),(162,'audit','money','client_receipts',14,1,'2026-04-22 17:25:18'),(163,'audit','money','gst_statement',15,1,'2026-04-22 17:25:18'),(164,'audit','money','clients',16,1,'2026-04-22 17:25:18'),(165,'audit','pending','pending',1,1,'2026-04-22 17:25:18'),(166,'audit','more','register',1,1,'2026-04-22 17:25:18'),(167,'audit','more','drawings',2,1,'2026-04-22 17:25:18'),(168,'audit','more','submittals',3,1,'2026-04-22 17:25:18'),(169,'audit','more','issues',4,1,'2026-04-22 17:25:18'),(170,'audit','more','issues_site',5,1,'2026-04-22 17:25:18'),(171,'audit','more','tasks',6,1,'2026-04-22 17:25:18'),(172,'audit','more','photos',7,1,'2026-04-22 17:25:18'),(173,'audit','more','phototags',8,1,'2026-04-22 17:25:18'),(174,'audit','more','meetings',9,1,'2026-04-22 17:25:18'),(176,'audit','more','labour',11,1,'2026-04-22 17:25:18'),(177,'audit','more','schedule_view',12,1,'2026-04-22 17:25:18'),(178,'audit','more','approvals',13,1,'2026-04-22 17:25:18'),(179,'audit','more','signoff',14,1,'2026-04-22 17:25:18'),(180,'audit','more','changes',15,1,'2026-04-22 17:25:18'),(181,'audit','more','delegations',16,1,'2026-04-22 17:25:18'),(183,'audit','more','weekly_health',18,1,'2026-04-22 17:25:18'),(184,'audit','more','users',19,1,'2026-04-22 17:25:18'),(185,'audit','more','ncr',20,1,'2026-04-22 17:25:18'),(186,'audit','more','compliance',21,1,'2026-04-22 17:25:18'),(187,'audit','more','tally',22,1,'2026-04-22 17:25:18'),(188,'audit','more','notifications',23,1,'2026-04-22 17:25:18'),(189,'it_admin','home','nav_editor',1,1,'2026-04-22 17:25:18'),(190,'principal','more','governance',50,1,'2026-04-22 17:25:19'),(191,'design_principal','more','governance',50,1,'2026-04-22 17:25:19'),(192,'detailing_head','home','dashboard',1,1,'2026-06-04 11:06:42'),(194,'detailing_head','home','project_detail',3,1,'2026-06-04 11:06:42'),(195,'detailing_head','work','drawings',1,1,'2026-06-04 11:06:42'),(196,'detailing_head','work','issues',2,1,'2026-06-04 11:06:42'),(197,'detailing_head','work','submittals',3,1,'2026-06-04 11:06:42'),(198,'detailing_head','work','register',4,1,'2026-06-04 11:06:42'),(207,'principal','more','reports_daily',10,1,'2026-06-05 11:00:01'),(208,'principal','more','reports_weekly',11,1,'2026-06-05 11:00:01'),(209,'design_principal','more','reports_daily',10,1,'2026-06-05 11:00:01'),(210,'design_principal','more','reports_weekly',11,1,'2026-06-05 11:00:01'),(211,'design_head','more','reports_daily',10,1,'2026-06-05 11:00:01'),(212,'design_head','more','reports_weekly',11,1,'2026-06-05 11:00:01'),(213,'services_head','more','reports_daily',10,1,'2026-06-05 11:00:01'),(214,'services_head','more','reports_weekly',11,1,'2026-06-05 11:00:01'),(215,'audit','more','reports_daily',10,1,'2026-06-05 11:00:01'),(216,'audit','more','reports_weekly',11,1,'2026-06-05 11:00:01'),(217,'pmc_head','work','reports_daily',12,1,'2026-06-05 11:00:01'),(218,'pmc_head','work','reports_weekly',13,1,'2026-06-05 11:00:02'),(219,'pmc_head','home','projects',3,1,'2026-06-05 15:12:24'),(220,'design_head','home','projects',3,1,'2026-06-05 15:14:11'),(221,'services_head','home','projects',3,1,'2026-06-05 15:14:11');
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
) ENGINE=InnoDB AUTO_INCREMENT=2470 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,'principal','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),(2,'design_principal','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),(3,'pmc_head','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),(4,'finance_admin','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),(5,'design_head','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),(6,'services_head','finance.petty-cash.read','R','Finance','View petty cash','2026-04-22 17:25:19',NULL),(7,'principal','finance.petty-cash.write','W','Finance','Create petty cash entry','2026-04-22 17:25:19',NULL),(8,'design_principal','finance.petty-cash.write','W','Finance','Create petty cash entry','2026-04-22 17:25:19',NULL),(9,'pmc_head','finance.petty-cash.write','W','Finance','Create petty cash entry','2026-04-22 17:25:19',NULL),(10,'principal','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-22 17:25:19',NULL),(11,'design_principal','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-22 17:25:19',NULL),(12,'pmc_head','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-22 17:25:19',NULL),(13,'finance_admin','finance.client-receipt.write','W','Finance','Record client receipt','2026-04-22 17:25:19',NULL),(14,'principal','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),(15,'design_principal','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),(16,'pmc_head','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),(17,'finance_admin','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),(18,'design_head','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),(19,'services_head','finance.client-receipt.read','R','Finance','View client receipts','2026-04-22 17:25:19',NULL),(20,'principal','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(21,'design_principal','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(22,'pmc_head','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(23,'design_head','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(24,'services_head','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(25,'finance_admin','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(26,'site_manager','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(27,'senior_site_manager','finance.payment-request.write','W','Finance','Raise payment request','2026-04-22 17:25:19',NULL),(28,'principal','finance.payment-request.approve-pmc','A','Finance','PMC approve payment request','2026-04-22 17:25:19',NULL),(29,'design_principal','finance.payment-request.approve-pmc','A','Finance','PMC approve payment request','2026-04-22 17:25:19',NULL),(30,'pmc_head','finance.payment-request.approve-pmc','A','Finance','PMC approve payment request','2026-04-22 17:25:19',NULL),(31,'principal','finance.payment-request.approve-principal','A','Finance','Principal approve payment request','2026-04-22 17:25:19',NULL),(32,'design_principal','finance.payment-request.approve-principal','A','Finance','Principal approve payment request','2026-04-22 17:25:19',NULL),(33,'principal','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),(34,'design_principal','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),(35,'pmc_head','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),(36,'site_manager','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),(37,'senior_site_manager','finance.urgent-payment.write','W','Finance','Raise urgent payment','2026-04-22 17:25:19',NULL),(38,'finance_admin','finance.vendor-clearance.approve','A','Finance','Clear vendor','2026-04-22 17:25:19',NULL),(39,'principal','finance.vendor-pan.approve','A','Finance','Validate vendor PAN','2026-04-22 17:25:19',NULL),(40,'design_principal','finance.vendor-pan.approve','A','Finance','Validate vendor PAN','2026-04-22 17:25:19',NULL),(41,'finance_admin','finance.vendor-pan.approve','A','Finance','Validate vendor PAN','2026-04-22 17:25:19',NULL),(42,'principal','claims.raise','W','Services','Raise claim','2026-04-22 17:25:19',NULL),(43,'design_principal','claims.raise','W','Services','Raise claim','2026-04-22 17:25:19',NULL),(44,'pmc_head','claims.raise','W','Services','Raise claim','2026-04-22 17:25:19',NULL),(45,'principal','claims.pmc-signoff','A','Services','PMC sign-off claim','2026-04-22 17:25:19',NULL),(46,'design_principal','claims.pmc-signoff','A','Services','PMC sign-off claim','2026-04-22 17:25:19',NULL),(47,'pmc_head','claims.pmc-signoff','A','Services','PMC sign-off claim','2026-04-22 17:25:19',NULL),(48,'principal','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-22 17:25:19',NULL),(49,'design_principal','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-22 17:25:19',NULL),(50,'design_head','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-22 17:25:19',NULL),(51,'services_head','claims.stream-signoff','A','Services','Stream sign-off claim','2026-04-22 17:25:19',NULL),(52,'principal','claims.approve','A','Services','Approve claim (final)','2026-04-22 17:25:19',NULL),(53,'design_principal','claims.approve','A','Services','Approve claim (final)','2026-04-22 17:25:19',NULL),(54,'principal','claims.invoice','W','Services','Record invoice number on claim','2026-04-22 17:25:19',NULL),(55,'design_principal','claims.invoice','W','Services','Record invoice number on claim','2026-04-22 17:25:19',NULL),(56,'pmc_head','claims.invoice','W','Services','Record invoice number on claim','2026-04-22 17:25:19',NULL),(57,'principal','governance.change-notice.raise','W','Governance','Raise change notice','2026-04-22 17:25:19',NULL),(58,'design_principal','governance.change-notice.raise','W','Governance','Raise change notice','2026-04-22 17:25:19',NULL),(59,'principal','governance.change-notice.approve','A','Governance','Approve change notice','2026-04-22 17:25:19',NULL),(60,'design_principal','governance.change-notice.approve','A','Governance','Approve change notice','2026-04-22 17:25:19',NULL),(61,'principal','governance.weekly-report.send','A','Governance','Mark weekly report sent to client','2026-04-22 17:25:19',NULL),(62,'design_principal','governance.weekly-report.send','A','Governance','Mark weekly report sent to client','2026-04-22 17:25:19',NULL),(63,'principal','governance.anomaly.acknowledge','A','Governance','Acknowledge AI anomaly flag','2026-04-22 17:25:19',NULL),(64,'design_principal','governance.anomaly.acknowledge','A','Governance','Acknowledge AI anomaly flag','2026-04-22 17:25:19',NULL),(65,'pmc_head','governance.anomaly.acknowledge','A','Governance','Acknowledge AI anomaly flag','2026-04-22 17:25:19',NULL),(66,'principal','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),(67,'design_principal','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),(68,'pmc_head','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),(69,'design_head','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),(70,'services_head','admin.user.initiate','W','Admin','Initiate new user','2026-04-22 17:25:19',NULL),(71,'principal','admin.user.approve','A','Admin','Approve new user','2026-04-22 17:25:19',NULL),(72,'design_principal','admin.user.approve','A','Admin','Approve new user','2026-04-22 17:25:19',NULL),(73,'principal','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),(74,'design_principal','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),(75,'pmc_head','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),(76,'design_head','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),(77,'services_head','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),(78,'finance_admin','admin.vendor.create','W','Admin','Create vendor master entry','2026-04-22 17:25:19',NULL),(79,'principal','admin.nav.approve','A','Admin','Edit nav / role tabs','2026-04-22 17:25:19',NULL),(80,'it_admin','admin.nav.propose','W','Admin','Propose nav / role tab changes','2026-04-22 17:25:19',NULL),(81,'principal','admin.password-reset','W','Admin','Reset another user password (unrestricted)','2026-04-22 17:25:19',NULL),(82,'design_principal','admin.password-reset','W','Admin','Reset another user password (unrestricted)','2026-04-22 17:25:19',NULL),(83,'it_admin','admin.password-reset','W','Admin','Reset another user password (unrestricted)','2026-04-22 17:25:19',NULL),(787,'principal','finance.view-petty-cash','R','Finance','View petty cash','2026-06-05 09:46:46',NULL),(788,'principal','finance.create-petty-cash-entry','W','Finance','Create petty cash entry','2026-06-05 09:46:46',NULL),(789,'principal','finance.replenish-petty-cash','W','Finance','Replenish petty cash','2026-06-05 09:46:46',NULL),(790,'principal','finance.view-direct-payments','R','Finance','View direct payments','2026-06-05 09:46:46',NULL),(791,'principal','finance.record-direct-payment','W','Finance','Record direct payment','2026-06-05 09:46:46',NULL),(792,'principal','finance.view-client-receipts','R','Finance','View client receipts','2026-06-05 09:46:46',NULL),(793,'principal','finance.record-client-receipt','W','Finance','Record client receipt','2026-06-05 09:46:46',NULL),(794,'principal','finance.view-advance-recovery','R','Finance','View advance recovery','2026-06-05 09:46:46',NULL),(795,'principal','finance.record-advance-recovery','W','Finance','Record advance recovery','2026-06-05 09:46:46',NULL),(796,'principal','finance.view-payment-requests','R','Finance','View payment requests','2026-06-05 09:46:46',NULL),(797,'principal','finance.raise-payment-request','W','Finance','Raise payment request','2026-06-05 09:46:46',NULL),(798,'principal','finance.raise-urgent-payment','W','Finance','Raise urgent payment','2026-06-05 09:46:46',NULL),(799,'principal','finance.pmc-approve-payment-request','A','Finance','PMC approve payment request','2026-06-05 09:46:46',NULL),(800,'principal','finance.principal-approve-payment-request','A','Finance','Principal approve payment request','2026-06-05 09:46:46',NULL),(801,'principal','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:46',NULL),(802,'principal','finance.validate-vendor-pan','A','Finance','Validate vendor PAN','2026-06-05 09:46:46',NULL),(803,'principal','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:46',NULL),(804,'principal','design.upload-drawing','W','Design','Upload drawing','2026-06-05 09:46:46',NULL),(805,'principal','design.approve-reject-drawing-l2-','A','Design','Approve / reject drawing (L2)','2026-06-05 09:46:46',NULL),(806,'principal','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:46',NULL),(807,'principal','design.upload-to-drawing-register','W','Design','Upload to drawing register','2026-06-05 09:46:46',NULL),(808,'principal','design.view-submittals','R','Design','View submittals','2026-06-05 09:46:46',NULL),(809,'principal','design.create-submittal','W','Design','Create submittal','2026-06-05 09:46:46',NULL),(810,'principal','design.review-submittal','A','Design','Review submittal','2026-06-05 09:46:46',NULL),(811,'principal','design.answer-drawing-rfi','W','Design','Answer drawing RFI','2026-06-05 09:46:46',NULL),(812,'principal','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:46',NULL),(813,'principal','design.create-form-template','W','Design','Create form template','2026-06-05 09:46:46',NULL),(814,'principal','design.approve-form-template','A','Design','Approve form template','2026-06-05 09:46:46',NULL),(815,'principal','services.view-measurements','R','Services','View measurements','2026-06-05 09:46:46',NULL),(816,'principal','services.create-measurement','W','Services','Create measurement','2026-06-05 09:46:46',NULL),(817,'principal','services.add-measurement-items','W','Services','Add measurement items','2026-06-05 09:46:46',NULL),(818,'principal','services.stream-sign-off-measurement','A','Services','Stream sign-off measurement','2026-06-05 09:46:46',NULL),(819,'principal','services.record-client-acceptance','A','Services','Record client acceptance','2026-06-05 09:46:46',NULL),(820,'principal','services.view-claims','R','Services','View claims','2026-06-05 09:46:46',NULL),(821,'principal','services.raise-claim','W','Services','Raise claim','2026-06-05 09:46:46',NULL),(822,'principal','services.add-claim-items','W','Services','Add claim items','2026-06-05 09:46:46',NULL),(823,'principal','services.pmc-sign-off-claim','A','Services','PMC sign-off claim','2026-06-05 09:46:46',NULL),(824,'principal','services.stream-sign-off-claim','A','Services','Stream sign-off claim','2026-06-05 09:46:46',NULL),(825,'principal','services.approve-claim-final-','A','Services','Approve claim (final)','2026-06-05 09:46:46',NULL),(826,'principal','services.record-invoice-number-on-claim','W','Services','Record invoice number on claim','2026-06-05 09:46:46',NULL),(827,'principal','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:46',NULL),(828,'principal','pmc-site.update-task-progress','W','PMC / Site','Update task progress','2026-06-05 09:46:46',NULL),(829,'principal','pmc-site.view-grns','R','PMC / Site','View GRNs','2026-06-05 09:46:46',NULL),(830,'principal','pmc-site.create-grn','W','PMC / Site','Create GRN','2026-06-05 09:46:46',NULL),(831,'principal','pmc-site.approve-grn','A','PMC / Site','Approve GRN','2026-06-05 09:46:46',NULL),(832,'principal','pmc-site.flag-grn-non-conformance','W','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:46',NULL),(833,'principal','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:46',NULL),(834,'principal','pmc-site.raise-snag','W','PMC / Site','Raise snag','2026-06-05 09:46:46',NULL),(835,'principal','pmc-site.mark-snag-rectified','W','PMC / Site','Mark snag rectified','2026-06-05 09:46:46',NULL),(836,'principal','pmc-site.close-snag-verify-','A','PMC / Site','Close snag (verify)','2026-06-05 09:46:46',NULL),(837,'principal','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:46',NULL),(838,'principal','pmc-site.upload-site-photo','W','PMC / Site','Upload site photo','2026-06-05 09:46:46',NULL),(839,'principal','pmc-site.upload-project-document','W','PMC / Site','Upload project document','2026-06-05 09:46:46',NULL),(840,'principal','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:46',NULL),(841,'principal','pmc-site.raise-issue','W','PMC / Site','Raise issue','2026-06-05 09:46:46',NULL),(842,'principal','pmc-site.close-issue','A','PMC / Site','Close issue','2026-06-05 09:46:46',NULL),(843,'principal','pmc-site.raise-drawing-rfi','W','PMC / Site','Raise drawing RFI','2026-06-05 09:46:46',NULL),(844,'principal','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:46',NULL),(845,'principal','pmc-site.create-meeting-mom-draft-','W','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:46',NULL),(846,'principal','pmc-site.log-site-visit','W','PMC / Site','Log site visit','2026-06-05 09:46:46',NULL),(847,'principal','pmc-site.add-observation-to-meeting','W','PMC / Site','Add observation to meeting','2026-06-05 09:46:46',NULL),(848,'principal','pmc-site.upload-file-to-meeting','W','PMC / Site','Upload file to meeting','2026-06-05 09:46:46',NULL),(849,'principal','pmc-site.acknowledge-own-meeting-action-item','W','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:46',NULL),(850,'principal','pmc-site.complete-own-meeting-action-item','W','PMC / Site','Complete own meeting action item','2026-06-05 09:46:46',NULL),(851,'principal','pmc-site.log-client-communication','W','PMC / Site','Log client communication','2026-06-05 09:46:46',NULL),(852,'principal','pmc-site.submit-form-fill-and-send-','W','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:46',NULL),(853,'principal','governance.view-change-notices','R','Governance','View change notices','2026-06-05 09:46:46',NULL),(854,'principal','governance.raise-change-notice','W','Governance','Raise change notice','2026-06-05 09:46:46',NULL),(855,'principal','governance.sign-change-notice','A','Governance','Sign change notice','2026-06-05 09:46:46',NULL),(856,'principal','governance.approve-change-notice','A','Governance','Approve change notice','2026-06-05 09:46:46',NULL),(857,'principal','governance.view-weekly-reports','R','Governance','View weekly reports','2026-06-05 09:46:46',NULL),(858,'principal','governance.edit-pmc-section','W','Governance','Edit PMC section','2026-06-05 09:46:46',NULL),(859,'principal','governance.edit-design-section','W','Governance','Edit design section','2026-06-05 09:46:46',NULL),(860,'principal','governance.edit-services-section','W','Governance','Edit services section','2026-06-05 09:46:46',NULL),(861,'principal','governance.sign-weekly-report-section','A','Governance','Sign weekly report section','2026-06-05 09:46:46',NULL),(862,'principal','governance.mark-weekly-report-sent-to-client','A','Governance','Mark weekly report sent to client','2026-06-05 09:46:46',NULL),(863,'principal','governance.acknowledge-ai-anomaly-flag','A','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:46',NULL),(864,'principal','governance.reset-another-user-s-password','W','Governance','Reset another user\'s password','2026-06-05 09:46:46',NULL),(865,'principal','admin.initiate-new-user','W','Admin','Initiate new user','2026-06-05 09:46:46',NULL),(866,'principal','admin.approve-new-user','A','Admin','Approve new user','2026-06-05 09:46:46',NULL),(867,'principal','admin.view-vendor-master','R','Admin','View vendor master','2026-06-05 09:46:46',NULL),(868,'principal','admin.create-vendor-master-entry','W','Admin','Create vendor master entry','2026-06-05 09:46:46',NULL),(869,'principal','admin.edit-nav-role-tabs','A','Admin','Edit nav / role tabs','2026-06-05 09:46:46',NULL),(870,'principal','admin.manage-delegations','W','Admin','Manage delegations','2026-06-05 09:46:46',NULL),(871,'principal','admin.project-setup','W','Admin','Project setup','2026-06-05 09:46:46',NULL),(872,'principal','admin.trigger-ai-photo-tag','W','Admin','Trigger AI photo tag','2026-06-05 09:46:46',NULL),(873,'principal','vendors.create','W','Admin','vendors.create','2026-06-05 09:46:46',NULL),(874,'principal','users.bulk_upload','W','Admin','users.bulk_upload','2026-06-05 09:46:46',NULL),(875,'principal','users.deactivate','W','Admin','users.deactivate','2026-06-05 09:46:46',NULL),(876,'principal','clients.create','W','Admin','clients.create','2026-06-05 09:46:46',NULL),(877,'principal','clients.edit','W','Admin','clients.edit','2026-06-05 09:46:46',NULL),(878,'principal','clients.bulk_upload','W','Admin','clients.bulk_upload','2026-06-05 09:46:46',NULL),(879,'principal','vendors.bulk_upload','W','Admin','vendors.bulk_upload','2026-06-05 09:46:46',NULL),(880,'principal','vendors.engage','W','Admin','vendors.engage','2026-06-05 09:46:46',NULL),(881,'principal','projects.create','W','Admin','projects.create','2026-06-05 09:46:46',NULL),(882,'principal','projects.edit','W','Admin','projects.edit','2026-06-05 09:46:46',NULL),(883,'principal','invoices.raise','W','Finance','invoices.raise','2026-06-05 09:46:46',NULL),(884,'principal','payments.execute','W','Finance','payments.execute','2026-06-05 09:46:46',NULL),(885,'principal','gst.view','R','Finance','gst.view','2026-06-05 09:46:46',NULL),(886,'principal','boq.upload','W','Services','boq.upload','2026-06-05 09:46:46',NULL),(887,'principal','boq.map','W','Services','boq.map','2026-06-05 09:46:46',NULL),(888,'principal','budget.approve','A','Services','budget.approve','2026-06-05 09:46:46',NULL),(889,'principal','mom.issue','W','PMC / Site','mom.issue','2026-06-05 09:46:46',NULL),(890,'principal','mom.sign','A','PMC / Site','mom.sign','2026-06-05 09:46:46',NULL),(891,'principal','reports.approve','A','Governance','reports.approve','2026-06-05 09:46:46',NULL),(892,'principal','finance.finance-payment-request-mark-paid','A','Finance','finance.payment-request.mark-paid','2026-06-05 09:46:46',NULL),(893,'principal','finance.finance-payment-pre-upload-check','A','Finance','finance.payment.pre-upload-check','2026-06-05 09:46:46',NULL),(894,'principal','pmc-site.pmc-issue-close-resolved','A','PMC / Site','pmc.issue.close-resolved','2026-06-05 09:46:46',NULL),(895,'principal','pmc.issue.reactivate','A','PMC / Site','pmc.issue.reactivate','2026-06-05 09:46:46',NULL),(896,'principal','pmc-site.pmc-issue-snag-raise','A','PMC / Site','pmc.issue.snag-raise','2026-06-05 09:46:46',NULL),(897,'principal','pmc-site.pmc-issue-snag-resolve','A','PMC / Site','pmc.issue.snag-resolve','2026-06-05 09:46:46',NULL),(898,'principal','pmc-site.pmc-issue-snag-signoff','A','PMC / Site','pmc.issue.snag-signoff','2026-06-05 09:46:46',NULL),(899,'principal','pmc-site.pmc-handover-checklist-init','A','PMC / Site','pmc.handover.checklist-init','2026-06-05 09:46:46',NULL),(900,'principal','pmc-site.pmc-handover-checklist-upload','A','PMC / Site','pmc.handover.checklist-upload','2026-06-05 09:46:46',NULL),(901,'principal','pmc-site.pmc-handover-closure-signoff','A','PMC / Site','pmc.handover.closure-signoff','2026-06-05 09:46:46',NULL),(902,'principal','pmc-site.pmc-lessons-input-write','A','PMC / Site','pmc.lessons.input-write','2026-06-05 09:46:46',NULL),(903,'principal','pmc-site.pmc-lessons-report-view','A','PMC / Site','pmc.lessons.report-view','2026-06-05 09:46:46',NULL),(904,'principal','pmc.lessons.publish','A','PMC / Site','pmc.lessons.publish','2026-06-05 09:46:46',NULL),(905,'principal','pmc.measurement.create','A','PMC / Site','pmc.measurement.create','2026-06-05 09:46:46',NULL),(906,'principal','pmc-site.pmc-measurement-add-items','A','PMC / Site','pmc.measurement.add-items','2026-06-05 09:46:46',NULL),(907,'principal','finance.finance-client-boq-edit-rate','A','Finance','finance.client-boq.edit-rate','2026-06-05 09:46:46',NULL),(908,'principal','finance.finance-client-boq-edit-hsn','A','Finance','finance.client-boq.edit-hsn','2026-06-05 09:46:46',NULL),(909,'principal','onboarding.onboarding-project-setup-edit-scope','A','Onboarding','onboarding.project-setup.edit-scope','2026-06-05 09:46:46',NULL),(910,'principal','workflow.submittal.review','A','Workflow','workflow.submittal.review','2026-06-05 09:46:46',NULL),(911,'principal','onboarding.boq.upload','A','Onboarding','onboarding.boq.upload','2026-06-05 09:46:46',NULL),(912,'principal','finance.finance-payment-bulk-batch-export','A','Finance','finance.payment.bulk-batch-export','2026-06-05 09:46:46',NULL),(913,'design_principal','finance.view-petty-cash','R','Finance','View petty cash','2026-06-05 09:46:46',NULL),(914,'design_principal','finance.create-petty-cash-entry','W','Finance','Create petty cash entry','2026-06-05 09:46:46',NULL),(915,'design_principal','finance.replenish-petty-cash','W','Finance','Replenish petty cash','2026-06-05 09:46:46',NULL),(916,'design_principal','finance.view-direct-payments','R','Finance','View direct payments','2026-06-05 09:46:46',NULL),(917,'design_principal','finance.record-direct-payment','W','Finance','Record direct payment','2026-06-05 09:46:46',NULL),(918,'design_principal','finance.view-client-receipts','R','Finance','View client receipts','2026-06-05 09:46:46',NULL),(919,'design_principal','finance.record-client-receipt','W','Finance','Record client receipt','2026-06-05 09:46:46',NULL),(920,'design_principal','finance.view-advance-recovery','R','Finance','View advance recovery','2026-06-05 09:46:46',NULL),(921,'design_principal','finance.record-advance-recovery','W','Finance','Record advance recovery','2026-06-05 09:46:46',NULL),(922,'design_principal','finance.view-payment-requests','R','Finance','View payment requests','2026-06-05 09:46:46',NULL),(923,'design_principal','finance.raise-payment-request','W','Finance','Raise payment request','2026-06-05 09:46:46',NULL),(924,'design_principal','finance.raise-urgent-payment','W','Finance','Raise urgent payment','2026-06-05 09:46:46',NULL),(925,'design_principal','finance.pmc-approve-payment-request','A','Finance','PMC approve payment request','2026-06-05 09:46:46',NULL),(926,'design_principal','finance.principal-approve-payment-request','A','Finance','Principal approve payment request','2026-06-05 09:46:46',NULL),(927,'design_principal','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:46',NULL),(928,'design_principal','finance.validate-vendor-pan','A','Finance','Validate vendor PAN','2026-06-05 09:46:46',NULL),(929,'design_principal','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:46',NULL),(930,'design_principal','design.upload-drawing','W','Design','Upload drawing','2026-06-05 09:46:46',NULL),(931,'design_principal','design.approve-reject-drawing-l2-','A','Design','Approve / reject drawing (L2)','2026-06-05 09:46:46',NULL),(932,'design_principal','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:46',NULL),(933,'design_principal','design.upload-to-drawing-register','W','Design','Upload to drawing register','2026-06-05 09:46:46',NULL),(934,'design_principal','design.view-submittals','R','Design','View submittals','2026-06-05 09:46:46',NULL),(935,'design_principal','design.create-submittal','W','Design','Create submittal','2026-06-05 09:46:46',NULL),(936,'design_principal','design.review-submittal','A','Design','Review submittal','2026-06-05 09:46:46',NULL),(937,'design_principal','design.answer-drawing-rfi','W','Design','Answer drawing RFI','2026-06-05 09:46:46',NULL),(938,'design_principal','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:46',NULL),(939,'design_principal','design.create-form-template','W','Design','Create form template','2026-06-05 09:46:46',NULL),(940,'design_principal','design.approve-form-template','A','Design','Approve form template','2026-06-05 09:46:46',NULL),(941,'design_principal','services.view-measurements','R','Services','View measurements','2026-06-05 09:46:46',NULL),(942,'design_principal','services.create-measurement','W','Services','Create measurement','2026-06-05 09:46:46',NULL),(943,'design_principal','services.add-measurement-items','W','Services','Add measurement items','2026-06-05 09:46:46',NULL),(944,'design_principal','services.stream-sign-off-measurement','A','Services','Stream sign-off measurement','2026-06-05 09:46:46',NULL),(945,'design_principal','services.record-client-acceptance','A','Services','Record client acceptance','2026-06-05 09:46:46',NULL),(946,'design_principal','services.view-claims','R','Services','View claims','2026-06-05 09:46:46',NULL),(947,'design_principal','services.raise-claim','W','Services','Raise claim','2026-06-05 09:46:46',NULL),(948,'design_principal','services.add-claim-items','W','Services','Add claim items','2026-06-05 09:46:46',NULL),(949,'design_principal','services.pmc-sign-off-claim','A','Services','PMC sign-off claim','2026-06-05 09:46:46',NULL),(950,'design_principal','services.stream-sign-off-claim','A','Services','Stream sign-off claim','2026-06-05 09:46:46',NULL),(951,'design_principal','services.approve-claim-final-','A','Services','Approve claim (final)','2026-06-05 09:46:46',NULL),(952,'design_principal','services.record-invoice-number-on-claim','W','Services','Record invoice number on claim','2026-06-05 09:46:46',NULL),(953,'design_principal','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:46',NULL),(954,'design_principal','pmc-site.update-task-progress','W','PMC / Site','Update task progress','2026-06-05 09:46:46',NULL),(955,'design_principal','pmc-site.view-grns','R','PMC / Site','View GRNs','2026-06-05 09:46:46',NULL),(956,'design_principal','pmc-site.create-grn','W','PMC / Site','Create GRN','2026-06-05 09:46:46',NULL),(957,'design_principal','pmc-site.approve-grn','A','PMC / Site','Approve GRN','2026-06-05 09:46:46',NULL),(958,'design_principal','pmc-site.flag-grn-non-conformance','W','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:46',NULL),(959,'design_principal','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:46',NULL),(960,'design_principal','pmc-site.raise-snag','W','PMC / Site','Raise snag','2026-06-05 09:46:46',NULL),(961,'design_principal','pmc-site.mark-snag-rectified','W','PMC / Site','Mark snag rectified','2026-06-05 09:46:46',NULL),(962,'design_principal','pmc-site.close-snag-verify-','A','PMC / Site','Close snag (verify)','2026-06-05 09:46:46',NULL),(963,'design_principal','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:46',NULL),(964,'design_principal','pmc-site.upload-site-photo','W','PMC / Site','Upload site photo','2026-06-05 09:46:46',NULL),(965,'design_principal','pmc-site.upload-project-document','W','PMC / Site','Upload project document','2026-06-05 09:46:46',NULL),(966,'design_principal','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:46',NULL),(967,'design_principal','pmc-site.raise-issue','W','PMC / Site','Raise issue','2026-06-05 09:46:46',NULL),(968,'design_principal','pmc-site.close-issue','A','PMC / Site','Close issue','2026-06-05 09:46:46',NULL),(969,'design_principal','pmc-site.raise-drawing-rfi','W','PMC / Site','Raise drawing RFI','2026-06-05 09:46:46',NULL),(970,'design_principal','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:46',NULL),(971,'design_principal','pmc-site.create-meeting-mom-draft-','W','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:46',NULL),(972,'design_principal','pmc-site.log-site-visit','W','PMC / Site','Log site visit','2026-06-05 09:46:46',NULL),(973,'design_principal','pmc-site.add-observation-to-meeting','W','PMC / Site','Add observation to meeting','2026-06-05 09:46:46',NULL),(974,'design_principal','pmc-site.upload-file-to-meeting','W','PMC / Site','Upload file to meeting','2026-06-05 09:46:46',NULL),(975,'design_principal','pmc-site.acknowledge-own-meeting-action-item','W','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:46',NULL),(976,'design_principal','pmc-site.complete-own-meeting-action-item','W','PMC / Site','Complete own meeting action item','2026-06-05 09:46:46',NULL),(977,'design_principal','pmc-site.log-client-communication','W','PMC / Site','Log client communication','2026-06-05 09:46:46',NULL),(978,'design_principal','pmc-site.submit-form-fill-and-send-','W','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:46',NULL),(979,'design_principal','governance.view-change-notices','R','Governance','View change notices','2026-06-05 09:46:46',NULL),(980,'design_principal','governance.raise-change-notice','W','Governance','Raise change notice','2026-06-05 09:46:46',NULL),(981,'design_principal','governance.sign-change-notice','A','Governance','Sign change notice','2026-06-05 09:46:46',NULL),(982,'design_principal','governance.approve-change-notice','A','Governance','Approve change notice','2026-06-05 09:46:46',NULL),(983,'design_principal','governance.view-weekly-reports','R','Governance','View weekly reports','2026-06-05 09:46:46',NULL),(984,'design_principal','governance.edit-pmc-section','W','Governance','Edit PMC section','2026-06-05 09:46:46',NULL),(985,'design_principal','governance.edit-design-section','W','Governance','Edit design section','2026-06-05 09:46:46',NULL),(986,'design_principal','governance.edit-services-section','W','Governance','Edit services section','2026-06-05 09:46:46',NULL),(987,'design_principal','governance.sign-weekly-report-section','A','Governance','Sign weekly report section','2026-06-05 09:46:46',NULL),(988,'design_principal','governance.mark-weekly-report-sent-to-client','A','Governance','Mark weekly report sent to client','2026-06-05 09:46:46',NULL),(989,'design_principal','governance.acknowledge-ai-anomaly-flag','A','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:46',NULL),(990,'design_principal','governance.reset-another-user-s-password','W','Governance','Reset another user\'s password','2026-06-05 09:46:46',NULL),(991,'design_principal','admin.initiate-new-user','W','Admin','Initiate new user','2026-06-05 09:46:46',NULL),(992,'design_principal','admin.approve-new-user','A','Admin','Approve new user','2026-06-05 09:46:46',NULL),(993,'design_principal','admin.view-vendor-master','R','Admin','View vendor master','2026-06-05 09:46:46',NULL),(994,'design_principal','admin.create-vendor-master-entry','W','Admin','Create vendor master entry','2026-06-05 09:46:46',NULL),(995,'design_principal','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:46',NULL),(996,'design_principal','admin.manage-delegations','W','Admin','Manage delegations','2026-06-05 09:46:46',NULL),(997,'design_principal','admin.project-setup','W','Admin','Project setup','2026-06-05 09:46:46',NULL),(998,'design_principal','admin.trigger-ai-photo-tag','W','Admin','Trigger AI photo tag','2026-06-05 09:46:46',NULL),(999,'design_principal','vendors.create','W','Admin','vendors.create','2026-06-05 09:46:46',NULL),(1000,'design_principal','users.bulk_upload','W','Admin','users.bulk_upload','2026-06-05 09:46:46',NULL),(1001,'design_principal','users.deactivate','W','Admin','users.deactivate','2026-06-05 09:46:46',NULL),(1002,'design_principal','clients.create','W','Admin','clients.create','2026-06-05 09:46:46',NULL),(1003,'design_principal','clients.edit','W','Admin','clients.edit','2026-06-05 09:46:46',NULL),(1004,'design_principal','clients.bulk_upload','W','Admin','clients.bulk_upload','2026-06-05 09:46:46',NULL),(1005,'design_principal','vendors.bulk_upload','W','Admin','vendors.bulk_upload','2026-06-05 09:46:46',NULL),(1006,'design_principal','vendors.engage','W','Admin','vendors.engage','2026-06-05 09:46:46',NULL),(1007,'design_principal','projects.create','W','Admin','projects.create','2026-06-05 09:46:46',NULL),(1008,'design_principal','projects.edit','W','Admin','projects.edit','2026-06-05 09:46:46',NULL),(1009,'design_principal','invoices.raise','W','Finance','invoices.raise','2026-06-05 09:46:46',NULL),(1010,'design_principal','payments.execute','W','Finance','payments.execute','2026-06-05 09:46:46',NULL),(1011,'design_principal','gst.view','R','Finance','gst.view','2026-06-05 09:46:46',NULL),(1012,'design_principal','boq.upload','W','Services','boq.upload','2026-06-05 09:46:46',NULL),(1013,'design_principal','boq.map','W','Services','boq.map','2026-06-05 09:46:46',NULL),(1014,'design_principal','budget.approve','A','Services','budget.approve','2026-06-05 09:46:46',NULL),(1015,'design_principal','mom.issue','W','PMC / Site','mom.issue','2026-06-05 09:46:46',NULL),(1016,'design_principal','mom.sign','A','PMC / Site','mom.sign','2026-06-05 09:46:46',NULL),(1017,'design_principal','reports.approve','A','Governance','reports.approve','2026-06-05 09:46:46',NULL),(1018,'design_principal','finance.finance-payment-request-mark-paid','A','Finance','finance.payment-request.mark-paid','2026-06-05 09:46:46',NULL),(1019,'design_principal','finance.finance-payment-pre-upload-check','A','Finance','finance.payment.pre-upload-check','2026-06-05 09:46:46',NULL),(1020,'design_principal','pmc-site.pmc-issue-close-resolved','A','PMC / Site','pmc.issue.close-resolved','2026-06-05 09:46:46',NULL),(1021,'design_principal','pmc.issue.reactivate','A','PMC / Site','pmc.issue.reactivate','2026-06-05 09:46:46',NULL),(1022,'design_principal','pmc-site.pmc-issue-snag-raise','A','PMC / Site','pmc.issue.snag-raise','2026-06-05 09:46:46',NULL),(1023,'design_principal','pmc-site.pmc-issue-snag-resolve','A','PMC / Site','pmc.issue.snag-resolve','2026-06-05 09:46:46',NULL),(1024,'design_principal','pmc-site.pmc-issue-snag-signoff','A','PMC / Site','pmc.issue.snag-signoff','2026-06-05 09:46:46',NULL),(1025,'design_principal','pmc-site.pmc-handover-checklist-init','A','PMC / Site','pmc.handover.checklist-init','2026-06-05 09:46:47',NULL),(1026,'design_principal','pmc-site.pmc-handover-checklist-upload','A','PMC / Site','pmc.handover.checklist-upload','2026-06-05 09:46:47',NULL),(1027,'design_principal','pmc-site.pmc-handover-closure-signoff','A','PMC / Site','pmc.handover.closure-signoff','2026-06-05 09:46:47',NULL),(1028,'design_principal','pmc-site.pmc-lessons-input-write','A','PMC / Site','pmc.lessons.input-write','2026-06-05 09:46:47',NULL),(1029,'design_principal','pmc-site.pmc-lessons-report-view','A','PMC / Site','pmc.lessons.report-view','2026-06-05 09:46:47',NULL),(1030,'design_principal','pmc.lessons.publish','A','PMC / Site','pmc.lessons.publish','2026-06-05 09:46:47',NULL),(1031,'design_principal','pmc.measurement.create','A','PMC / Site','pmc.measurement.create','2026-06-05 09:46:47',NULL),(1032,'design_principal','pmc-site.pmc-measurement-add-items','A','PMC / Site','pmc.measurement.add-items','2026-06-05 09:46:47',NULL),(1033,'design_principal','finance.finance-client-boq-edit-rate','A','Finance','finance.client-boq.edit-rate','2026-06-05 09:46:47',NULL),(1034,'design_principal','finance.finance-client-boq-edit-hsn','A','Finance','finance.client-boq.edit-hsn','2026-06-05 09:46:47',NULL),(1035,'design_principal','onboarding.onboarding-project-setup-edit-scope','A','Onboarding','onboarding.project-setup.edit-scope','2026-06-05 09:46:47',NULL),(1036,'design_principal','workflow.submittal.review','A','Workflow','workflow.submittal.review','2026-06-05 09:46:47',NULL),(1037,'design_principal','onboarding.boq.upload','A','Onboarding','onboarding.boq.upload','2026-06-05 09:46:47',NULL),(1038,'design_principal','finance.finance-payment-bulk-batch-export','A','Finance','finance.payment.bulk-batch-export','2026-06-05 09:46:47',NULL),(1039,'pmc_head','finance.view-petty-cash','R','Finance','View petty cash','2026-06-05 09:46:47',NULL),(1040,'pmc_head','finance.create-petty-cash-entry','W','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(1041,'pmc_head','finance.replenish-petty-cash','W','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(1042,'pmc_head','finance.view-direct-payments','R','Finance','View direct payments','2026-06-05 09:46:47',NULL),(1043,'pmc_head','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(1044,'pmc_head','finance.view-client-receipts','R','Finance','View client receipts','2026-06-05 09:46:47',NULL),(1045,'pmc_head','finance.record-client-receipt','W','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(1046,'pmc_head','finance.view-advance-recovery','R','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(1047,'pmc_head','finance.record-advance-recovery','W','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(1048,'pmc_head','finance.view-payment-requests','R','Finance','View payment requests','2026-06-05 09:46:47',NULL),(1049,'pmc_head','finance.raise-payment-request','W','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(1050,'pmc_head','finance.raise-urgent-payment','W','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(1051,'pmc_head','finance.pmc-approve-payment-request','A','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(1052,'pmc_head','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(1053,'pmc_head','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(1054,'pmc_head','finance.validate-vendor-pan','','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(1055,'pmc_head','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:47',NULL),(1056,'pmc_head','design.upload-drawing','','Design','Upload drawing','2026-06-05 09:46:47',NULL),(1057,'pmc_head','design.approve-reject-drawing-l2-','','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(1058,'pmc_head','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:47',NULL),(1059,'pmc_head','design.upload-to-drawing-register','','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(1060,'pmc_head','design.view-submittals','R','Design','View submittals','2026-06-05 09:46:47',NULL),(1061,'pmc_head','design.create-submittal','','Design','Create submittal','2026-06-05 09:46:47',NULL),(1062,'pmc_head','design.review-submittal','A','Design','Review submittal','2026-06-05 09:46:47',NULL),(1063,'pmc_head','design.answer-drawing-rfi','','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(1064,'pmc_head','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:47',NULL),(1065,'pmc_head','design.create-form-template','W','Design','Create form template','2026-06-05 09:46:47',NULL),(1066,'pmc_head','design.approve-form-template','A','Design','Approve form template','2026-06-05 09:46:47',NULL),(1067,'pmc_head','services.view-measurements','R','Services','View measurements','2026-06-05 09:46:47',NULL),(1068,'pmc_head','services.create-measurement','W','Services','Create measurement','2026-06-05 09:46:47',NULL),(1069,'pmc_head','services.add-measurement-items','W','Services','Add measurement items','2026-06-05 09:46:47',NULL),(1070,'pmc_head','services.stream-sign-off-measurement','','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(1071,'pmc_head','services.record-client-acceptance','A','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(1072,'pmc_head','services.view-claims','R','Services','View claims','2026-06-05 09:46:47',NULL),(1073,'pmc_head','services.raise-claim','W','Services','Raise claim','2026-06-05 09:46:47',NULL),(1074,'pmc_head','services.add-claim-items','W','Services','Add claim items','2026-06-05 09:46:47',NULL),(1075,'pmc_head','services.pmc-sign-off-claim','A','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(1076,'pmc_head','services.stream-sign-off-claim','','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(1077,'pmc_head','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(1078,'pmc_head','services.record-invoice-number-on-claim','W','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(1079,'pmc_head','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(1080,'pmc_head','pmc-site.update-task-progress','W','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(1081,'pmc_head','pmc-site.view-grns','R','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(1082,'pmc_head','pmc-site.create-grn','W','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(1083,'pmc_head','pmc-site.approve-grn','A','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(1084,'pmc_head','pmc-site.flag-grn-non-conformance','W','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(1085,'pmc_head','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(1086,'pmc_head','pmc-site.raise-snag','W','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(1087,'pmc_head','pmc-site.mark-snag-rectified','W','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(1088,'pmc_head','pmc-site.close-snag-verify-','A','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(1089,'pmc_head','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(1090,'pmc_head','pmc-site.upload-site-photo','W','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(1091,'pmc_head','pmc-site.upload-project-document','W','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(1092,'pmc_head','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(1093,'pmc_head','pmc-site.raise-issue','W','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(1094,'pmc_head','pmc-site.close-issue','A','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(1095,'pmc_head','pmc-site.raise-drawing-rfi','W','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(1096,'pmc_head','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(1097,'pmc_head','pmc-site.create-meeting-mom-draft-','W','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(1098,'pmc_head','pmc-site.log-site-visit','W','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(1099,'pmc_head','pmc-site.add-observation-to-meeting','W','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(1100,'pmc_head','pmc-site.upload-file-to-meeting','W','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(1101,'pmc_head','pmc-site.acknowledge-own-meeting-action-item','W','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(1102,'pmc_head','pmc-site.complete-own-meeting-action-item','W','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(1103,'pmc_head','pmc-site.log-client-communication','W','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(1104,'pmc_head','pmc-site.submit-form-fill-and-send-','W','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(1105,'pmc_head','governance.view-change-notices','R','Governance','View change notices','2026-06-05 09:46:47',NULL),(1106,'pmc_head','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(1107,'pmc_head','governance.sign-change-notice','A','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(1108,'pmc_head','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(1109,'pmc_head','governance.view-weekly-reports','R','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(1110,'pmc_head','governance.edit-pmc-section','W','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(1111,'pmc_head','governance.edit-design-section','','Governance','Edit design section','2026-06-05 09:46:47',NULL),(1112,'pmc_head','governance.edit-services-section','','Governance','Edit services section','2026-06-05 09:46:47',NULL),(1113,'pmc_head','governance.sign-weekly-report-section','A','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(1114,'pmc_head','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(1115,'pmc_head','governance.acknowledge-ai-anomaly-flag','A','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(1116,'pmc_head','governance.reset-another-user-s-password','W','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(1117,'pmc_head','admin.initiate-new-user','W','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(1118,'pmc_head','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(1119,'pmc_head','admin.view-vendor-master','R','Admin','View vendor master','2026-06-05 09:46:47',NULL),(1120,'pmc_head','admin.create-vendor-master-entry','W','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(1121,'pmc_head','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(1122,'pmc_head','admin.manage-delegations','W','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(1123,'pmc_head','admin.project-setup','W','Admin','Project setup','2026-06-05 09:46:47',NULL),(1124,'pmc_head','admin.trigger-ai-photo-tag','W','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(1125,'pmc_head','vendors.create','W','Admin','vendors.create','2026-06-05 09:46:47',NULL),(1126,'pmc_head','users.bulk_upload','','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(1127,'pmc_head','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(1128,'pmc_head','clients.create','','Admin','clients.create','2026-06-05 09:46:47',NULL),(1129,'pmc_head','clients.edit','','Admin','clients.edit','2026-06-05 09:46:47',NULL),(1130,'pmc_head','clients.bulk_upload','','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(1131,'pmc_head','vendors.bulk_upload','W','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(1132,'pmc_head','vendors.engage','W','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(1133,'pmc_head','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(1134,'pmc_head','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(1135,'pmc_head','invoices.raise','','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(1136,'pmc_head','payments.execute','','Finance','payments.execute','2026-06-05 09:46:47',NULL),(1137,'pmc_head','gst.view','','Finance','gst.view','2026-06-05 09:46:47',NULL),(1138,'pmc_head','boq.upload','','Services','boq.upload','2026-06-05 09:46:47',NULL),(1139,'pmc_head','boq.map','W','Services','boq.map','2026-06-05 09:46:47',NULL),(1140,'pmc_head','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(1141,'pmc_head','mom.issue','W','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(1142,'pmc_head','mom.sign','A','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(1143,'pmc_head','reports.approve','A','Governance','reports.approve','2026-06-05 09:46:47',NULL),(1144,'pmc_head','pmc-site.pmc-issue-close-resolved','A','PMC / Site','pmc.issue.close-resolved','2026-06-05 09:46:47',NULL),(1145,'pmc_head','pmc.issue.reactivate','A','PMC / Site','pmc.issue.reactivate','2026-06-05 09:46:47',NULL),(1146,'pmc_head','pmc-site.pmc-issue-snag-raise','A','PMC / Site','pmc.issue.snag-raise','2026-06-05 09:46:47',NULL),(1147,'pmc_head','pmc-site.pmc-issue-snag-resolve','A','PMC / Site','pmc.issue.snag-resolve','2026-06-05 09:46:47',NULL),(1148,'pmc_head','pmc-site.pmc-issue-snag-signoff','A','PMC / Site','pmc.issue.snag-signoff','2026-06-05 09:46:47',NULL),(1149,'pmc_head','pmc-site.pmc-handover-checklist-init','A','PMC / Site','pmc.handover.checklist-init','2026-06-05 09:46:47',NULL),(1150,'pmc_head','pmc-site.pmc-handover-checklist-upload','A','PMC / Site','pmc.handover.checklist-upload','2026-06-05 09:46:47',NULL),(1151,'pmc_head','pmc-site.pmc-handover-closure-signoff','A','PMC / Site','pmc.handover.closure-signoff','2026-06-05 09:46:47',NULL),(1152,'pmc_head','pmc-site.pmc-lessons-input-write','A','PMC / Site','pmc.lessons.input-write','2026-06-05 09:46:47',NULL),(1153,'pmc_head','pmc-site.pmc-lessons-report-view','A','PMC / Site','pmc.lessons.report-view','2026-06-05 09:46:47',NULL),(1154,'pmc_head','pmc.measurement.create','A','PMC / Site','pmc.measurement.create','2026-06-05 09:46:47',NULL),(1155,'pmc_head','pmc-site.pmc-measurement-add-items','A','PMC / Site','pmc.measurement.add-items','2026-06-05 09:46:47',NULL),(1156,'pmc_head','finance.finance-client-boq-edit-rate','A','Finance','finance.client-boq.edit-rate','2026-06-05 09:46:47',NULL),(1157,'pmc_head','finance.finance-client-boq-edit-hsn','A','Finance','finance.client-boq.edit-hsn','2026-06-05 09:46:47',NULL),(1158,'pmc_head','onboarding.onboarding-project-setup-edit-scope','A','Onboarding','onboarding.project-setup.edit-scope','2026-06-05 09:46:47',NULL),(1159,'pmc_head','workflow.submittal.review','A','Workflow','workflow.submittal.review','2026-06-05 09:46:47',NULL),(1160,'pmc_head','finance.finance-payment-bulk-batch-export','A','Finance','finance.payment.bulk-batch-export','2026-06-05 09:46:47',NULL),(1161,'design_head','finance.view-petty-cash','R','Finance','View petty cash','2026-06-05 09:46:47',NULL),(1162,'design_head','finance.create-petty-cash-entry','','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(1163,'design_head','finance.replenish-petty-cash','','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(1164,'design_head','finance.view-direct-payments','','Finance','View direct payments','2026-06-05 09:46:47',NULL),(1165,'design_head','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(1166,'design_head','finance.view-client-receipts','R','Finance','View client receipts','2026-06-05 09:46:47',NULL),(1167,'design_head','finance.record-client-receipt','','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(1168,'design_head','finance.view-advance-recovery','','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(1169,'design_head','finance.record-advance-recovery','','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(1170,'design_head','finance.view-payment-requests','R','Finance','View payment requests','2026-06-05 09:46:47',NULL),(1171,'design_head','finance.raise-payment-request','W','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(1172,'design_head','finance.raise-urgent-payment','','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(1173,'design_head','finance.pmc-approve-payment-request','','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(1174,'design_head','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(1175,'design_head','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(1176,'design_head','finance.validate-vendor-pan','','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(1177,'design_head','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:47',NULL),(1178,'design_head','design.upload-drawing','W','Design','Upload drawing','2026-06-05 09:46:47',NULL),(1179,'design_head','design.approve-reject-drawing-l2-','A','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(1180,'design_head','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:47',NULL),(1181,'design_head','design.upload-to-drawing-register','W','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(1182,'design_head','design.view-submittals','R','Design','View submittals','2026-06-05 09:46:47',NULL),(1183,'design_head','design.create-submittal','W','Design','Create submittal','2026-06-05 09:46:47',NULL),(1184,'design_head','design.review-submittal','A','Design','Review submittal','2026-06-05 09:46:47',NULL),(1185,'design_head','design.answer-drawing-rfi','W','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(1186,'design_head','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:47',NULL),(1187,'design_head','design.create-form-template','W','Design','Create form template','2026-06-05 09:46:47',NULL),(1188,'design_head','design.approve-form-template','','Design','Approve form template','2026-06-05 09:46:47',NULL),(1189,'design_head','services.view-measurements','R','Services','View measurements','2026-06-05 09:46:47',NULL),(1190,'design_head','services.create-measurement','W','Services','Create measurement','2026-06-05 09:46:47',NULL),(1191,'design_head','services.add-measurement-items','W','Services','Add measurement items','2026-06-05 09:46:47',NULL),(1192,'design_head','services.stream-sign-off-measurement','A','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(1193,'design_head','services.record-client-acceptance','','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(1194,'design_head','services.view-claims','R','Services','View claims','2026-06-05 09:46:47',NULL),(1195,'design_head','services.raise-claim','','Services','Raise claim','2026-06-05 09:46:47',NULL),(1196,'design_head','services.add-claim-items','W','Services','Add claim items','2026-06-05 09:46:47',NULL),(1197,'design_head','services.pmc-sign-off-claim','','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(1198,'design_head','services.stream-sign-off-claim','A','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(1199,'design_head','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(1200,'design_head','services.record-invoice-number-on-claim','','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(1201,'design_head','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(1202,'design_head','pmc-site.update-task-progress','W','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(1203,'design_head','pmc-site.view-grns','','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(1204,'design_head','pmc-site.create-grn','','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(1205,'design_head','pmc-site.approve-grn','','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(1206,'design_head','pmc-site.flag-grn-non-conformance','','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(1207,'design_head','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(1208,'design_head','pmc-site.raise-snag','W','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(1209,'design_head','pmc-site.mark-snag-rectified','','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(1210,'design_head','pmc-site.close-snag-verify-','A','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(1211,'design_head','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(1212,'design_head','pmc-site.upload-site-photo','W','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(1213,'design_head','pmc-site.upload-project-document','W','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(1214,'design_head','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(1215,'design_head','pmc-site.raise-issue','W','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(1216,'design_head','pmc-site.close-issue','A','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(1217,'design_head','pmc-site.raise-drawing-rfi','W','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(1218,'design_head','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(1219,'design_head','pmc-site.create-meeting-mom-draft-','W','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(1220,'design_head','pmc-site.log-site-visit','W','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(1221,'design_head','pmc-site.add-observation-to-meeting','W','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(1222,'design_head','pmc-site.upload-file-to-meeting','W','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(1223,'design_head','pmc-site.acknowledge-own-meeting-action-item','W','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(1224,'design_head','pmc-site.complete-own-meeting-action-item','W','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(1225,'design_head','pmc-site.log-client-communication','','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(1226,'design_head','pmc-site.submit-form-fill-and-send-','W','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(1227,'design_head','governance.view-change-notices','R','Governance','View change notices','2026-06-05 09:46:47',NULL),(1228,'design_head','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(1229,'design_head','governance.sign-change-notice','A','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(1230,'design_head','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(1231,'design_head','governance.view-weekly-reports','R','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(1232,'design_head','governance.edit-pmc-section','','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(1233,'design_head','governance.edit-design-section','W','Governance','Edit design section','2026-06-05 09:46:47',NULL),(1234,'design_head','governance.edit-services-section','','Governance','Edit services section','2026-06-05 09:46:47',NULL),(1235,'design_head','governance.sign-weekly-report-section','A','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(1236,'design_head','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(1237,'design_head','governance.acknowledge-ai-anomaly-flag','','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(1238,'design_head','governance.reset-another-user-s-password','W','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(1239,'design_head','admin.initiate-new-user','W','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(1240,'design_head','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(1241,'design_head','admin.view-vendor-master','R','Admin','View vendor master','2026-06-05 09:46:47',NULL),(1242,'design_head','admin.create-vendor-master-entry','W','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(1243,'design_head','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(1244,'design_head','admin.manage-delegations','','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(1245,'design_head','admin.project-setup','','Admin','Project setup','2026-06-05 09:46:47',NULL),(1246,'design_head','admin.trigger-ai-photo-tag','W','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(1247,'design_head','vendors.create','','Admin','vendors.create','2026-06-05 09:46:47',NULL),(1248,'design_head','users.bulk_upload','','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(1249,'design_head','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(1250,'design_head','clients.create','','Admin','clients.create','2026-06-05 09:46:47',NULL),(1251,'design_head','clients.edit','','Admin','clients.edit','2026-06-05 09:46:47',NULL),(1252,'design_head','clients.bulk_upload','','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(1253,'design_head','vendors.bulk_upload','','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(1254,'design_head','vendors.engage','','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(1255,'design_head','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(1256,'design_head','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(1257,'design_head','invoices.raise','','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(1258,'design_head','payments.execute','','Finance','payments.execute','2026-06-05 09:46:47',NULL),(1259,'design_head','gst.view','','Finance','gst.view','2026-06-05 09:46:47',NULL),(1260,'design_head','boq.upload','W','Services','boq.upload','2026-06-05 09:46:47',NULL),(1261,'design_head','boq.map','','Services','boq.map','2026-06-05 09:46:47',NULL),(1262,'design_head','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(1263,'design_head','mom.issue','','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(1264,'design_head','mom.sign','','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(1265,'design_head','reports.approve','','Governance','reports.approve','2026-06-05 09:46:47',NULL),(1266,'design_head','pmc-site.pmc-issue-snag-raise','A','PMC / Site','pmc.issue.snag-raise','2026-06-05 09:46:47',NULL),(1267,'design_head','pmc-site.pmc-issue-snag-resolve','A','PMC / Site','pmc.issue.snag-resolve','2026-06-05 09:46:47',NULL),(1268,'design_head','pmc-site.pmc-issue-snag-signoff','A','PMC / Site','pmc.issue.snag-signoff','2026-06-05 09:46:47',NULL),(1269,'design_head','pmc-site.pmc-handover-checklist-init','A','PMC / Site','pmc.handover.checklist-init','2026-06-05 09:46:47',NULL),(1270,'design_head','pmc-site.pmc-handover-checklist-upload','A','PMC / Site','pmc.handover.checklist-upload','2026-06-05 09:46:47',NULL),(1271,'design_head','pmc-site.pmc-handover-closure-signoff','A','PMC / Site','pmc.handover.closure-signoff','2026-06-05 09:46:47',NULL),(1272,'design_head','pmc-site.pmc-lessons-input-write','A','PMC / Site','pmc.lessons.input-write','2026-06-05 09:46:47',NULL),(1273,'design_head','pmc-site.pmc-lessons-report-view','A','PMC / Site','pmc.lessons.report-view','2026-06-05 09:46:47',NULL),(1274,'design_head','pmc.measurement.create','A','PMC / Site','pmc.measurement.create','2026-06-05 09:46:47',NULL),(1275,'design_head','pmc-site.pmc-measurement-add-items','A','PMC / Site','pmc.measurement.add-items','2026-06-05 09:46:47',NULL),(1276,'design_head','finance.finance-client-boq-edit-rate','A','Finance','finance.client-boq.edit-rate','2026-06-05 09:46:47',NULL),(1277,'design_head','finance.finance-client-boq-edit-hsn','A','Finance','finance.client-boq.edit-hsn','2026-06-05 09:46:47',NULL),(1278,'design_head','onboarding.onboarding-project-setup-edit-scope','A','Onboarding','onboarding.project-setup.edit-scope','2026-06-05 09:46:47',NULL),(1279,'design_head','workflow.submittal.review','A','Workflow','workflow.submittal.review','2026-06-05 09:46:47',NULL),(1280,'design_head','onboarding.boq.upload','A','Onboarding','onboarding.boq.upload','2026-06-05 09:46:47',NULL),(1281,'services_head','finance.view-petty-cash','R','Finance','View petty cash','2026-06-05 09:46:47',NULL),(1282,'services_head','finance.create-petty-cash-entry','','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(1283,'services_head','finance.replenish-petty-cash','','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(1284,'services_head','finance.view-direct-payments','','Finance','View direct payments','2026-06-05 09:46:47',NULL),(1285,'services_head','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(1286,'services_head','finance.view-client-receipts','R','Finance','View client receipts','2026-06-05 09:46:47',NULL),(1287,'services_head','finance.record-client-receipt','','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(1288,'services_head','finance.view-advance-recovery','','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(1289,'services_head','finance.record-advance-recovery','','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(1290,'services_head','finance.view-payment-requests','R','Finance','View payment requests','2026-06-05 09:46:47',NULL),(1291,'services_head','finance.raise-payment-request','W','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(1292,'services_head','finance.raise-urgent-payment','','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(1293,'services_head','finance.pmc-approve-payment-request','','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(1294,'services_head','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(1295,'services_head','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(1296,'services_head','finance.validate-vendor-pan','','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(1297,'services_head','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:47',NULL),(1298,'services_head','design.upload-drawing','W','Design','Upload drawing','2026-06-05 09:46:47',NULL),(1299,'services_head','design.approve-reject-drawing-l2-','A','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(1300,'services_head','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:47',NULL),(1301,'services_head','design.upload-to-drawing-register','W','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(1302,'services_head','design.view-submittals','R','Design','View submittals','2026-06-05 09:46:47',NULL),(1303,'services_head','design.create-submittal','W','Design','Create submittal','2026-06-05 09:46:47',NULL),(1304,'services_head','design.review-submittal','A','Design','Review submittal','2026-06-05 09:46:47',NULL),(1305,'services_head','design.answer-drawing-rfi','W','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(1306,'services_head','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:47',NULL),(1307,'services_head','design.create-form-template','W','Design','Create form template','2026-06-05 09:46:47',NULL),(1308,'services_head','design.approve-form-template','','Design','Approve form template','2026-06-05 09:46:47',NULL),(1309,'services_head','services.view-measurements','R','Services','View measurements','2026-06-05 09:46:47',NULL),(1310,'services_head','services.create-measurement','W','Services','Create measurement','2026-06-05 09:46:47',NULL),(1311,'services_head','services.add-measurement-items','W','Services','Add measurement items','2026-06-05 09:46:47',NULL),(1312,'services_head','services.stream-sign-off-measurement','A','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(1313,'services_head','services.record-client-acceptance','','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(1314,'services_head','services.view-claims','R','Services','View claims','2026-06-05 09:46:47',NULL),(1315,'services_head','services.raise-claim','','Services','Raise claim','2026-06-05 09:46:47',NULL),(1316,'services_head','services.add-claim-items','W','Services','Add claim items','2026-06-05 09:46:47',NULL),(1317,'services_head','services.pmc-sign-off-claim','','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(1318,'services_head','services.stream-sign-off-claim','A','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(1319,'services_head','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(1320,'services_head','services.record-invoice-number-on-claim','','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(1321,'services_head','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(1322,'services_head','pmc-site.update-task-progress','W','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(1323,'services_head','pmc-site.view-grns','','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(1324,'services_head','pmc-site.create-grn','','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(1325,'services_head','pmc-site.approve-grn','','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(1326,'services_head','pmc-site.flag-grn-non-conformance','','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(1327,'services_head','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(1328,'services_head','pmc-site.raise-snag','W','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(1329,'services_head','pmc-site.mark-snag-rectified','','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(1330,'services_head','pmc-site.close-snag-verify-','A','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(1331,'services_head','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(1332,'services_head','pmc-site.upload-site-photo','W','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(1333,'services_head','pmc-site.upload-project-document','W','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(1334,'services_head','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(1335,'services_head','pmc-site.raise-issue','W','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(1336,'services_head','pmc-site.close-issue','A','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(1337,'services_head','pmc-site.raise-drawing-rfi','W','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(1338,'services_head','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(1339,'services_head','pmc-site.create-meeting-mom-draft-','W','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(1340,'services_head','pmc-site.log-site-visit','W','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(1341,'services_head','pmc-site.add-observation-to-meeting','W','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(1342,'services_head','pmc-site.upload-file-to-meeting','W','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(1343,'services_head','pmc-site.acknowledge-own-meeting-action-item','W','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(1344,'services_head','pmc-site.complete-own-meeting-action-item','W','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(1345,'services_head','pmc-site.log-client-communication','','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(1346,'services_head','pmc-site.submit-form-fill-and-send-','W','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(1347,'services_head','governance.view-change-notices','R','Governance','View change notices','2026-06-05 09:46:47',NULL),(1348,'services_head','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(1349,'services_head','governance.sign-change-notice','A','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(1350,'services_head','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(1351,'services_head','governance.view-weekly-reports','R','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(1352,'services_head','governance.edit-pmc-section','','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(1353,'services_head','governance.edit-design-section','','Governance','Edit design section','2026-06-05 09:46:47',NULL),(1354,'services_head','governance.edit-services-section','W','Governance','Edit services section','2026-06-05 09:46:47',NULL),(1355,'services_head','governance.sign-weekly-report-section','A','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(1356,'services_head','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(1357,'services_head','governance.acknowledge-ai-anomaly-flag','','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(1358,'services_head','governance.reset-another-user-s-password','W','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(1359,'services_head','admin.initiate-new-user','W','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(1360,'services_head','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(1361,'services_head','admin.view-vendor-master','R','Admin','View vendor master','2026-06-05 09:46:47',NULL),(1362,'services_head','admin.create-vendor-master-entry','W','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(1363,'services_head','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(1364,'services_head','admin.manage-delegations','','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(1365,'services_head','admin.project-setup','','Admin','Project setup','2026-06-05 09:46:47',NULL),(1366,'services_head','admin.trigger-ai-photo-tag','W','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(1367,'services_head','vendors.create','','Admin','vendors.create','2026-06-05 09:46:47',NULL),(1368,'services_head','users.bulk_upload','','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(1369,'services_head','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(1370,'services_head','clients.create','','Admin','clients.create','2026-06-05 09:46:47',NULL),(1371,'services_head','clients.edit','','Admin','clients.edit','2026-06-05 09:46:47',NULL),(1372,'services_head','clients.bulk_upload','','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(1373,'services_head','vendors.bulk_upload','','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(1374,'services_head','vendors.engage','','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(1375,'services_head','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(1376,'services_head','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(1377,'services_head','invoices.raise','','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(1378,'services_head','payments.execute','','Finance','payments.execute','2026-06-05 09:46:47',NULL),(1379,'services_head','gst.view','','Finance','gst.view','2026-06-05 09:46:47',NULL),(1380,'services_head','boq.upload','W','Services','boq.upload','2026-06-05 09:46:47',NULL),(1381,'services_head','boq.map','','Services','boq.map','2026-06-05 09:46:47',NULL),(1382,'services_head','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(1383,'services_head','mom.issue','','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(1384,'services_head','mom.sign','','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(1385,'services_head','reports.approve','','Governance','reports.approve','2026-06-05 09:46:47',NULL),(1386,'services_head','pmc-site.pmc-issue-snag-raise','A','PMC / Site','pmc.issue.snag-raise','2026-06-05 09:46:47',NULL),(1387,'services_head','pmc-site.pmc-issue-snag-resolve','A','PMC / Site','pmc.issue.snag-resolve','2026-06-05 09:46:47',NULL),(1388,'services_head','pmc-site.pmc-issue-snag-signoff','A','PMC / Site','pmc.issue.snag-signoff','2026-06-05 09:46:47',NULL),(1389,'services_head','pmc-site.pmc-handover-checklist-init','A','PMC / Site','pmc.handover.checklist-init','2026-06-05 09:46:47',NULL),(1390,'services_head','pmc-site.pmc-handover-checklist-upload','A','PMC / Site','pmc.handover.checklist-upload','2026-06-05 09:46:47',NULL),(1391,'services_head','pmc-site.pmc-handover-closure-signoff','A','PMC / Site','pmc.handover.closure-signoff','2026-06-05 09:46:47',NULL),(1392,'services_head','pmc-site.pmc-lessons-input-write','A','PMC / Site','pmc.lessons.input-write','2026-06-05 09:46:47',NULL),(1393,'services_head','pmc-site.pmc-lessons-report-view','A','PMC / Site','pmc.lessons.report-view','2026-06-05 09:46:47',NULL),(1394,'services_head','pmc.measurement.create','A','PMC / Site','pmc.measurement.create','2026-06-05 09:46:47',NULL),(1395,'services_head','pmc-site.pmc-measurement-add-items','A','PMC / Site','pmc.measurement.add-items','2026-06-05 09:46:47',NULL),(1396,'services_head','finance.finance-client-boq-edit-rate','A','Finance','finance.client-boq.edit-rate','2026-06-05 09:46:47',NULL),(1397,'services_head','finance.finance-client-boq-edit-hsn','A','Finance','finance.client-boq.edit-hsn','2026-06-05 09:46:47',NULL),(1398,'services_head','onboarding.onboarding-project-setup-edit-scope','A','Onboarding','onboarding.project-setup.edit-scope','2026-06-05 09:46:47',NULL),(1399,'services_head','workflow.submittal.review','A','Workflow','workflow.submittal.review','2026-06-05 09:46:47',NULL),(1400,'services_head','onboarding.boq.upload','A','Onboarding','onboarding.boq.upload','2026-06-05 09:46:47',NULL),(1401,'team_lead','finance.view-petty-cash','','Finance','View petty cash','2026-06-05 09:46:47',NULL),(1402,'team_lead','finance.create-petty-cash-entry','','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(1403,'team_lead','finance.replenish-petty-cash','','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(1404,'team_lead','finance.view-direct-payments','','Finance','View direct payments','2026-06-05 09:46:47',NULL),(1405,'team_lead','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(1406,'team_lead','finance.view-client-receipts','','Finance','View client receipts','2026-06-05 09:46:47',NULL),(1407,'team_lead','finance.record-client-receipt','','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(1408,'team_lead','finance.view-advance-recovery','','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(1409,'team_lead','finance.record-advance-recovery','','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(1410,'team_lead','finance.view-payment-requests','','Finance','View payment requests','2026-06-05 09:46:47',NULL),(1411,'team_lead','finance.raise-payment-request','','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(1412,'team_lead','finance.raise-urgent-payment','','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(1413,'team_lead','finance.pmc-approve-payment-request','','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(1414,'team_lead','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(1415,'team_lead','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(1416,'team_lead','finance.validate-vendor-pan','','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(1417,'team_lead','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:47',NULL),(1418,'team_lead','design.upload-drawing','W','Design','Upload drawing','2026-06-05 09:46:47',NULL),(1419,'team_lead','design.approve-reject-drawing-l2-','','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(1420,'team_lead','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:47',NULL),(1421,'team_lead','design.upload-to-drawing-register','W','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(1422,'team_lead','design.view-submittals','R','Design','View submittals','2026-06-05 09:46:47',NULL),(1423,'team_lead','design.create-submittal','W','Design','Create submittal','2026-06-05 09:46:47',NULL),(1424,'team_lead','design.review-submittal','','Design','Review submittal','2026-06-05 09:46:47',NULL),(1425,'team_lead','design.answer-drawing-rfi','','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(1426,'team_lead','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:47',NULL),(1427,'team_lead','design.create-form-template','','Design','Create form template','2026-06-05 09:46:47',NULL),(1428,'team_lead','design.approve-form-template','','Design','Approve form template','2026-06-05 09:46:47',NULL),(1429,'team_lead','services.view-measurements','','Services','View measurements','2026-06-05 09:46:47',NULL),(1430,'team_lead','services.create-measurement','','Services','Create measurement','2026-06-05 09:46:47',NULL),(1431,'team_lead','services.add-measurement-items','','Services','Add measurement items','2026-06-05 09:46:47',NULL),(1432,'team_lead','services.stream-sign-off-measurement','','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(1433,'team_lead','services.record-client-acceptance','','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(1434,'team_lead','services.view-claims','','Services','View claims','2026-06-05 09:46:47',NULL),(1435,'team_lead','services.raise-claim','','Services','Raise claim','2026-06-05 09:46:47',NULL),(1436,'team_lead','services.add-claim-items','','Services','Add claim items','2026-06-05 09:46:47',NULL),(1437,'team_lead','services.pmc-sign-off-claim','','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(1438,'team_lead','services.stream-sign-off-claim','','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(1439,'team_lead','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(1440,'team_lead','services.record-invoice-number-on-claim','','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(1441,'team_lead','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(1442,'team_lead','pmc-site.update-task-progress','W','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(1443,'team_lead','pmc-site.view-grns','','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(1444,'team_lead','pmc-site.create-grn','','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(1445,'team_lead','pmc-site.approve-grn','','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(1446,'team_lead','pmc-site.flag-grn-non-conformance','','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(1447,'team_lead','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(1448,'team_lead','pmc-site.raise-snag','W','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(1449,'team_lead','pmc-site.mark-snag-rectified','','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(1450,'team_lead','pmc-site.close-snag-verify-','','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(1451,'team_lead','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(1452,'team_lead','pmc-site.upload-site-photo','W','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(1453,'team_lead','pmc-site.upload-project-document','W','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(1454,'team_lead','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(1455,'team_lead','pmc-site.raise-issue','W','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(1456,'team_lead','pmc-site.close-issue','','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(1457,'team_lead','pmc-site.raise-drawing-rfi','W','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(1458,'team_lead','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(1459,'team_lead','pmc-site.create-meeting-mom-draft-','W','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(1460,'team_lead','pmc-site.log-site-visit','','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(1461,'team_lead','pmc-site.add-observation-to-meeting','','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(1462,'team_lead','pmc-site.upload-file-to-meeting','','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(1463,'team_lead','pmc-site.acknowledge-own-meeting-action-item','W','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(1464,'team_lead','pmc-site.complete-own-meeting-action-item','W','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(1465,'team_lead','pmc-site.log-client-communication','','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(1466,'team_lead','pmc-site.submit-form-fill-and-send-','W','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(1467,'team_lead','governance.view-change-notices','','Governance','View change notices','2026-06-05 09:46:47',NULL),(1468,'team_lead','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(1469,'team_lead','governance.sign-change-notice','','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(1470,'team_lead','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(1471,'team_lead','governance.view-weekly-reports','R','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(1472,'team_lead','governance.edit-pmc-section','','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(1473,'team_lead','governance.edit-design-section','W','Governance','Edit design section','2026-06-05 09:46:47',NULL),(1474,'team_lead','governance.edit-services-section','','Governance','Edit services section','2026-06-05 09:46:47',NULL),(1475,'team_lead','governance.sign-weekly-report-section','','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(1476,'team_lead','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(1477,'team_lead','governance.acknowledge-ai-anomaly-flag','','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(1478,'team_lead','governance.reset-another-user-s-password','','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(1479,'team_lead','admin.initiate-new-user','','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(1480,'team_lead','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(1481,'team_lead','admin.view-vendor-master','','Admin','View vendor master','2026-06-05 09:46:47',NULL),(1482,'team_lead','admin.create-vendor-master-entry','','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(1483,'team_lead','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(1484,'team_lead','admin.manage-delegations','','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(1485,'team_lead','admin.project-setup','','Admin','Project setup','2026-06-05 09:46:47',NULL),(1486,'team_lead','admin.trigger-ai-photo-tag','W','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(1487,'team_lead','vendors.create','','Admin','vendors.create','2026-06-05 09:46:47',NULL),(1488,'team_lead','users.bulk_upload','','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(1489,'team_lead','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(1490,'team_lead','clients.create','','Admin','clients.create','2026-06-05 09:46:47',NULL),(1491,'team_lead','clients.edit','','Admin','clients.edit','2026-06-05 09:46:47',NULL),(1492,'team_lead','clients.bulk_upload','','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(1493,'team_lead','vendors.bulk_upload','','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(1494,'team_lead','vendors.engage','','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(1495,'team_lead','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(1496,'team_lead','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(1497,'team_lead','invoices.raise','','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(1498,'team_lead','payments.execute','','Finance','payments.execute','2026-06-05 09:46:47',NULL),(1499,'team_lead','gst.view','','Finance','gst.view','2026-06-05 09:46:47',NULL),(1500,'team_lead','boq.upload','W','Services','boq.upload','2026-06-05 09:46:47',NULL),(1501,'team_lead','boq.map','','Services','boq.map','2026-06-05 09:46:47',NULL),(1502,'team_lead','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(1503,'team_lead','mom.issue','','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(1504,'team_lead','mom.sign','','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(1505,'team_lead','reports.approve','','Governance','reports.approve','2026-06-05 09:46:47',NULL),(1506,'team_lead','pmc-site.pmc-issue-snag-raise','A','PMC / Site','pmc.issue.snag-raise','2026-06-05 09:46:47',NULL),(1507,'team_lead','pmc-site.pmc-lessons-input-write','A','PMC / Site','pmc.lessons.input-write','2026-06-05 09:46:47',NULL),(1508,'jr_architect','finance.view-petty-cash','','Finance','View petty cash','2026-06-05 09:46:47',NULL),(1509,'jr_architect','finance.create-petty-cash-entry','','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(1510,'jr_architect','finance.replenish-petty-cash','','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(1511,'jr_architect','finance.view-direct-payments','','Finance','View direct payments','2026-06-05 09:46:47',NULL),(1512,'jr_architect','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(1513,'jr_architect','finance.view-client-receipts','','Finance','View client receipts','2026-06-05 09:46:47',NULL),(1514,'jr_architect','finance.record-client-receipt','','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(1515,'jr_architect','finance.view-advance-recovery','','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(1516,'jr_architect','finance.record-advance-recovery','','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(1517,'jr_architect','finance.view-payment-requests','','Finance','View payment requests','2026-06-05 09:46:47',NULL),(1518,'jr_architect','finance.raise-payment-request','','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(1519,'jr_architect','finance.raise-urgent-payment','','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(1520,'jr_architect','finance.pmc-approve-payment-request','','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(1521,'jr_architect','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(1522,'jr_architect','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(1523,'jr_architect','finance.validate-vendor-pan','','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(1524,'jr_architect','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:47',NULL),(1525,'jr_architect','design.upload-drawing','W','Design','Upload drawing','2026-06-05 09:46:47',NULL),(1526,'jr_architect','design.approve-reject-drawing-l2-','','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(1527,'jr_architect','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:47',NULL),(1528,'jr_architect','design.upload-to-drawing-register','W','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(1529,'jr_architect','design.view-submittals','R','Design','View submittals','2026-06-05 09:46:47',NULL),(1530,'jr_architect','design.create-submittal','','Design','Create submittal','2026-06-05 09:46:47',NULL),(1531,'jr_architect','design.review-submittal','','Design','Review submittal','2026-06-05 09:46:47',NULL),(1532,'jr_architect','design.answer-drawing-rfi','','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(1533,'jr_architect','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:47',NULL),(1534,'jr_architect','design.create-form-template','','Design','Create form template','2026-06-05 09:46:47',NULL),(1535,'jr_architect','design.approve-form-template','','Design','Approve form template','2026-06-05 09:46:47',NULL),(1536,'jr_architect','services.view-measurements','','Services','View measurements','2026-06-05 09:46:47',NULL),(1537,'jr_architect','services.create-measurement','','Services','Create measurement','2026-06-05 09:46:47',NULL),(1538,'jr_architect','services.add-measurement-items','','Services','Add measurement items','2026-06-05 09:46:47',NULL),(1539,'jr_architect','services.stream-sign-off-measurement','','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(1540,'jr_architect','services.record-client-acceptance','','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(1541,'jr_architect','services.view-claims','','Services','View claims','2026-06-05 09:46:47',NULL),(1542,'jr_architect','services.raise-claim','','Services','Raise claim','2026-06-05 09:46:47',NULL),(1543,'jr_architect','services.add-claim-items','','Services','Add claim items','2026-06-05 09:46:47',NULL),(1544,'jr_architect','services.pmc-sign-off-claim','','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(1545,'jr_architect','services.stream-sign-off-claim','','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(1546,'jr_architect','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(1547,'jr_architect','services.record-invoice-number-on-claim','','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(1548,'jr_architect','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(1549,'jr_architect','pmc-site.update-task-progress','','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(1550,'jr_architect','pmc-site.view-grns','','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(1551,'jr_architect','pmc-site.create-grn','','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(1552,'jr_architect','pmc-site.approve-grn','','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(1553,'jr_architect','pmc-site.flag-grn-non-conformance','','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(1554,'jr_architect','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(1555,'jr_architect','pmc-site.raise-snag','W','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(1556,'jr_architect','pmc-site.mark-snag-rectified','','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(1557,'jr_architect','pmc-site.close-snag-verify-','','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(1558,'jr_architect','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(1559,'jr_architect','pmc-site.upload-site-photo','W','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(1560,'jr_architect','pmc-site.upload-project-document','W','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(1561,'jr_architect','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(1562,'jr_architect','pmc-site.raise-issue','W','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(1563,'jr_architect','pmc-site.close-issue','','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(1564,'jr_architect','pmc-site.raise-drawing-rfi','W','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(1565,'jr_architect','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(1566,'jr_architect','pmc-site.create-meeting-mom-draft-','','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(1567,'jr_architect','pmc-site.log-site-visit','','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(1568,'jr_architect','pmc-site.add-observation-to-meeting','','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(1569,'jr_architect','pmc-site.upload-file-to-meeting','','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(1570,'jr_architect','pmc-site.acknowledge-own-meeting-action-item','W','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(1571,'jr_architect','pmc-site.complete-own-meeting-action-item','W','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(1572,'jr_architect','pmc-site.log-client-communication','','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(1573,'jr_architect','pmc-site.submit-form-fill-and-send-','W','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(1574,'jr_architect','governance.view-change-notices','','Governance','View change notices','2026-06-05 09:46:47',NULL),(1575,'jr_architect','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(1576,'jr_architect','governance.sign-change-notice','','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(1577,'jr_architect','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(1578,'jr_architect','governance.view-weekly-reports','R','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(1579,'jr_architect','governance.edit-pmc-section','','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(1580,'jr_architect','governance.edit-design-section','','Governance','Edit design section','2026-06-05 09:46:47',NULL),(1581,'jr_architect','governance.edit-services-section','','Governance','Edit services section','2026-06-05 09:46:47',NULL),(1582,'jr_architect','governance.sign-weekly-report-section','','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(1583,'jr_architect','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(1584,'jr_architect','governance.acknowledge-ai-anomaly-flag','','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(1585,'jr_architect','governance.reset-another-user-s-password','','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(1586,'jr_architect','admin.initiate-new-user','','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(1587,'jr_architect','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(1588,'jr_architect','admin.view-vendor-master','','Admin','View vendor master','2026-06-05 09:46:47',NULL),(1589,'jr_architect','admin.create-vendor-master-entry','','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(1590,'jr_architect','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(1591,'jr_architect','admin.manage-delegations','','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(1592,'jr_architect','admin.project-setup','','Admin','Project setup','2026-06-05 09:46:47',NULL),(1593,'jr_architect','admin.trigger-ai-photo-tag','W','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(1594,'jr_architect','vendors.create','','Admin','vendors.create','2026-06-05 09:46:47',NULL),(1595,'jr_architect','users.bulk_upload','','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(1596,'jr_architect','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(1597,'jr_architect','clients.create','','Admin','clients.create','2026-06-05 09:46:47',NULL),(1598,'jr_architect','clients.edit','','Admin','clients.edit','2026-06-05 09:46:47',NULL),(1599,'jr_architect','clients.bulk_upload','','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(1600,'jr_architect','vendors.bulk_upload','','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(1601,'jr_architect','vendors.engage','','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(1602,'jr_architect','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(1603,'jr_architect','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(1604,'jr_architect','invoices.raise','','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(1605,'jr_architect','payments.execute','','Finance','payments.execute','2026-06-05 09:46:47',NULL),(1606,'jr_architect','gst.view','','Finance','gst.view','2026-06-05 09:46:47',NULL),(1607,'jr_architect','boq.upload','','Services','boq.upload','2026-06-05 09:46:47',NULL),(1608,'jr_architect','boq.map','','Services','boq.map','2026-06-05 09:46:47',NULL),(1609,'jr_architect','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(1610,'jr_architect','mom.issue','','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(1611,'jr_architect','mom.sign','','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(1612,'jr_architect','reports.approve','','Governance','reports.approve','2026-06-05 09:46:47',NULL),(1613,'jr_architect','pmc-site.pmc-issue-snag-raise','A','PMC / Site','pmc.issue.snag-raise','2026-06-05 09:46:47',NULL),(1614,'jr_architect','pmc-site.pmc-lessons-input-write','A','PMC / Site','pmc.lessons.input-write','2026-06-05 09:46:47',NULL),(1615,'detailing_head','finance.view-petty-cash','','Finance','View petty cash','2026-06-05 09:46:47',NULL),(1616,'detailing_head','finance.create-petty-cash-entry','','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(1617,'detailing_head','finance.replenish-petty-cash','','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(1618,'detailing_head','finance.view-direct-payments','','Finance','View direct payments','2026-06-05 09:46:47',NULL),(1619,'detailing_head','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(1620,'detailing_head','finance.view-client-receipts','','Finance','View client receipts','2026-06-05 09:46:47',NULL),(1621,'detailing_head','finance.record-client-receipt','','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(1622,'detailing_head','finance.view-advance-recovery','','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(1623,'detailing_head','finance.record-advance-recovery','','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(1624,'detailing_head','finance.view-payment-requests','','Finance','View payment requests','2026-06-05 09:46:47',NULL),(1625,'detailing_head','finance.raise-payment-request','','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(1626,'detailing_head','finance.raise-urgent-payment','','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(1627,'detailing_head','finance.pmc-approve-payment-request','','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(1628,'detailing_head','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(1629,'detailing_head','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(1630,'detailing_head','finance.validate-vendor-pan','','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(1631,'detailing_head','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:47',NULL),(1632,'detailing_head','design.upload-drawing','W','Design','Upload drawing','2026-06-05 09:46:47',NULL),(1633,'detailing_head','design.approve-reject-drawing-l2-','','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(1634,'detailing_head','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:47',NULL),(1635,'detailing_head','design.upload-to-drawing-register','W','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(1636,'detailing_head','design.view-submittals','R','Design','View submittals','2026-06-05 09:46:47',NULL),(1637,'detailing_head','design.create-submittal','','Design','Create submittal','2026-06-05 09:46:47',NULL),(1638,'detailing_head','design.review-submittal','','Design','Review submittal','2026-06-05 09:46:47',NULL),(1639,'detailing_head','design.answer-drawing-rfi','','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(1640,'detailing_head','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:47',NULL),(1641,'detailing_head','design.create-form-template','','Design','Create form template','2026-06-05 09:46:47',NULL),(1642,'detailing_head','design.approve-form-template','','Design','Approve form template','2026-06-05 09:46:47',NULL),(1643,'detailing_head','services.view-measurements','','Services','View measurements','2026-06-05 09:46:47',NULL),(1644,'detailing_head','services.create-measurement','','Services','Create measurement','2026-06-05 09:46:47',NULL),(1645,'detailing_head','services.add-measurement-items','','Services','Add measurement items','2026-06-05 09:46:47',NULL),(1646,'detailing_head','services.stream-sign-off-measurement','','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(1647,'detailing_head','services.record-client-acceptance','','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(1648,'detailing_head','services.view-claims','','Services','View claims','2026-06-05 09:46:47',NULL),(1649,'detailing_head','services.raise-claim','','Services','Raise claim','2026-06-05 09:46:47',NULL),(1650,'detailing_head','services.add-claim-items','','Services','Add claim items','2026-06-05 09:46:47',NULL),(1651,'detailing_head','services.pmc-sign-off-claim','','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(1652,'detailing_head','services.stream-sign-off-claim','','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(1653,'detailing_head','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(1654,'detailing_head','services.record-invoice-number-on-claim','','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(1655,'detailing_head','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(1656,'detailing_head','pmc-site.update-task-progress','','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(1657,'detailing_head','pmc-site.view-grns','','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(1658,'detailing_head','pmc-site.create-grn','','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(1659,'detailing_head','pmc-site.approve-grn','','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(1660,'detailing_head','pmc-site.flag-grn-non-conformance','','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(1661,'detailing_head','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(1662,'detailing_head','pmc-site.raise-snag','W','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(1663,'detailing_head','pmc-site.mark-snag-rectified','','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(1664,'detailing_head','pmc-site.close-snag-verify-','','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(1665,'detailing_head','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(1666,'detailing_head','pmc-site.upload-site-photo','W','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(1667,'detailing_head','pmc-site.upload-project-document','W','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(1668,'detailing_head','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(1669,'detailing_head','pmc-site.raise-issue','W','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(1670,'detailing_head','pmc-site.close-issue','','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(1671,'detailing_head','pmc-site.raise-drawing-rfi','W','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(1672,'detailing_head','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(1673,'detailing_head','pmc-site.create-meeting-mom-draft-','','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(1674,'detailing_head','pmc-site.log-site-visit','','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(1675,'detailing_head','pmc-site.add-observation-to-meeting','','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(1676,'detailing_head','pmc-site.upload-file-to-meeting','','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(1677,'detailing_head','pmc-site.acknowledge-own-meeting-action-item','W','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(1678,'detailing_head','pmc-site.complete-own-meeting-action-item','W','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(1679,'detailing_head','pmc-site.log-client-communication','','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(1680,'detailing_head','pmc-site.submit-form-fill-and-send-','W','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(1681,'detailing_head','governance.view-change-notices','','Governance','View change notices','2026-06-05 09:46:47',NULL),(1682,'detailing_head','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(1683,'detailing_head','governance.sign-change-notice','','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(1684,'detailing_head','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(1685,'detailing_head','governance.view-weekly-reports','R','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(1686,'detailing_head','governance.edit-pmc-section','','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(1687,'detailing_head','governance.edit-design-section','','Governance','Edit design section','2026-06-05 09:46:47',NULL),(1688,'detailing_head','governance.edit-services-section','','Governance','Edit services section','2026-06-05 09:46:47',NULL),(1689,'detailing_head','governance.sign-weekly-report-section','','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(1690,'detailing_head','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(1691,'detailing_head','governance.acknowledge-ai-anomaly-flag','','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(1692,'detailing_head','governance.reset-another-user-s-password','','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(1693,'detailing_head','admin.initiate-new-user','','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(1694,'detailing_head','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(1695,'detailing_head','admin.view-vendor-master','','Admin','View vendor master','2026-06-05 09:46:47',NULL),(1696,'detailing_head','admin.create-vendor-master-entry','','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(1697,'detailing_head','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(1698,'detailing_head','admin.manage-delegations','','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(1699,'detailing_head','admin.project-setup','','Admin','Project setup','2026-06-05 09:46:47',NULL),(1700,'detailing_head','admin.trigger-ai-photo-tag','W','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(1701,'detailing_head','vendors.create','','Admin','vendors.create','2026-06-05 09:46:47',NULL),(1702,'detailing_head','users.bulk_upload','','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(1703,'detailing_head','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(1704,'detailing_head','clients.create','','Admin','clients.create','2026-06-05 09:46:47',NULL),(1705,'detailing_head','clients.edit','','Admin','clients.edit','2026-06-05 09:46:47',NULL),(1706,'detailing_head','clients.bulk_upload','','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(1707,'detailing_head','vendors.bulk_upload','','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(1708,'detailing_head','vendors.engage','','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(1709,'detailing_head','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(1710,'detailing_head','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(1711,'detailing_head','invoices.raise','','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(1712,'detailing_head','payments.execute','','Finance','payments.execute','2026-06-05 09:46:47',NULL),(1713,'detailing_head','gst.view','','Finance','gst.view','2026-06-05 09:46:47',NULL),(1714,'detailing_head','boq.upload','','Services','boq.upload','2026-06-05 09:46:47',NULL),(1715,'detailing_head','boq.map','','Services','boq.map','2026-06-05 09:46:47',NULL),(1716,'detailing_head','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(1717,'detailing_head','mom.issue','','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(1718,'detailing_head','mom.sign','','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(1719,'detailing_head','reports.approve','','Governance','reports.approve','2026-06-05 09:46:47',NULL),(1720,'detailing_head','pmc-site.pmc-issue-snag-raise','A','PMC / Site','pmc.issue.snag-raise','2026-06-05 09:46:47',NULL),(1721,'detailing_head','pmc-site.pmc-lessons-input-write','A','PMC / Site','pmc.lessons.input-write','2026-06-05 09:46:47',NULL),(1722,'site_manager','finance.view-petty-cash','','Finance','View petty cash','2026-06-05 09:46:47',NULL),(1723,'site_manager','finance.create-petty-cash-entry','','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(1724,'site_manager','finance.replenish-petty-cash','','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(1725,'site_manager','finance.view-direct-payments','','Finance','View direct payments','2026-06-05 09:46:47',NULL),(1726,'site_manager','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(1727,'site_manager','finance.view-client-receipts','','Finance','View client receipts','2026-06-05 09:46:47',NULL),(1728,'site_manager','finance.record-client-receipt','','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(1729,'site_manager','finance.view-advance-recovery','','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(1730,'site_manager','finance.record-advance-recovery','','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(1731,'site_manager','finance.view-payment-requests','R','Finance','View payment requests','2026-06-05 09:46:47',NULL),(1732,'site_manager','finance.raise-payment-request','W','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(1733,'site_manager','finance.raise-urgent-payment','W','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(1734,'site_manager','finance.pmc-approve-payment-request','','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(1735,'site_manager','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(1736,'site_manager','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(1737,'site_manager','finance.validate-vendor-pan','','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(1738,'site_manager','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:47',NULL),(1739,'site_manager','design.upload-drawing','','Design','Upload drawing','2026-06-05 09:46:47',NULL),(1740,'site_manager','design.approve-reject-drawing-l2-','','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(1741,'site_manager','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:47',NULL),(1742,'site_manager','design.upload-to-drawing-register','','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(1743,'site_manager','design.view-submittals','R','Design','View submittals','2026-06-05 09:46:47',NULL),(1744,'site_manager','design.create-submittal','W','Design','Create submittal','2026-06-05 09:46:47',NULL),(1745,'site_manager','design.review-submittal','','Design','Review submittal','2026-06-05 09:46:47',NULL),(1746,'site_manager','design.answer-drawing-rfi','','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(1747,'site_manager','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:47',NULL),(1748,'site_manager','design.create-form-template','','Design','Create form template','2026-06-05 09:46:47',NULL),(1749,'site_manager','design.approve-form-template','','Design','Approve form template','2026-06-05 09:46:47',NULL),(1750,'site_manager','services.view-measurements','','Services','View measurements','2026-06-05 09:46:47',NULL),(1751,'site_manager','services.create-measurement','','Services','Create measurement','2026-06-05 09:46:47',NULL),(1752,'site_manager','services.add-measurement-items','','Services','Add measurement items','2026-06-05 09:46:47',NULL),(1753,'site_manager','services.stream-sign-off-measurement','','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(1754,'site_manager','services.record-client-acceptance','','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(1755,'site_manager','services.view-claims','','Services','View claims','2026-06-05 09:46:47',NULL),(1756,'site_manager','services.raise-claim','','Services','Raise claim','2026-06-05 09:46:47',NULL),(1757,'site_manager','services.add-claim-items','','Services','Add claim items','2026-06-05 09:46:47',NULL),(1758,'site_manager','services.pmc-sign-off-claim','','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(1759,'site_manager','services.stream-sign-off-claim','','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(1760,'site_manager','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(1761,'site_manager','services.record-invoice-number-on-claim','','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(1762,'site_manager','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(1763,'site_manager','pmc-site.update-task-progress','W','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(1764,'site_manager','pmc-site.view-grns','R','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(1765,'site_manager','pmc-site.create-grn','W','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(1766,'site_manager','pmc-site.approve-grn','','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(1767,'site_manager','pmc-site.flag-grn-non-conformance','W','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(1768,'site_manager','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(1769,'site_manager','pmc-site.raise-snag','W','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(1770,'site_manager','pmc-site.mark-snag-rectified','W','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(1771,'site_manager','pmc-site.close-snag-verify-','','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(1772,'site_manager','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(1773,'site_manager','pmc-site.upload-site-photo','W','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(1774,'site_manager','pmc-site.upload-project-document','W','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(1775,'site_manager','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(1776,'site_manager','pmc-site.raise-issue','W','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(1777,'site_manager','pmc-site.close-issue','','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(1778,'site_manager','pmc-site.raise-drawing-rfi','W','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(1779,'site_manager','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(1780,'site_manager','pmc-site.create-meeting-mom-draft-','W','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(1781,'site_manager','pmc-site.log-site-visit','W','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(1782,'site_manager','pmc-site.add-observation-to-meeting','W','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(1783,'site_manager','pmc-site.upload-file-to-meeting','W','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(1784,'site_manager','pmc-site.acknowledge-own-meeting-action-item','W','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(1785,'site_manager','pmc-site.complete-own-meeting-action-item','W','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(1786,'site_manager','pmc-site.log-client-communication','','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(1787,'site_manager','pmc-site.submit-form-fill-and-send-','W','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(1788,'site_manager','governance.view-change-notices','','Governance','View change notices','2026-06-05 09:46:47',NULL),(1789,'site_manager','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(1790,'site_manager','governance.sign-change-notice','','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(1791,'site_manager','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(1792,'site_manager','governance.view-weekly-reports','R','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(1793,'site_manager','governance.edit-pmc-section','','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(1794,'site_manager','governance.edit-design-section','','Governance','Edit design section','2026-06-05 09:46:47',NULL),(1795,'site_manager','governance.edit-services-section','','Governance','Edit services section','2026-06-05 09:46:47',NULL),(1796,'site_manager','governance.sign-weekly-report-section','','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(1797,'site_manager','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(1798,'site_manager','governance.acknowledge-ai-anomaly-flag','','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(1799,'site_manager','governance.reset-another-user-s-password','','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(1800,'site_manager','admin.initiate-new-user','','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(1801,'site_manager','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(1802,'site_manager','admin.view-vendor-master','','Admin','View vendor master','2026-06-05 09:46:47',NULL),(1803,'site_manager','admin.create-vendor-master-entry','','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(1804,'site_manager','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(1805,'site_manager','admin.manage-delegations','','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(1806,'site_manager','admin.project-setup','','Admin','Project setup','2026-06-05 09:46:47',NULL),(1807,'site_manager','admin.trigger-ai-photo-tag','W','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(1808,'site_manager','vendors.create','','Admin','vendors.create','2026-06-05 09:46:47',NULL),(1809,'site_manager','users.bulk_upload','','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(1810,'site_manager','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(1811,'site_manager','clients.create','','Admin','clients.create','2026-06-05 09:46:47',NULL),(1812,'site_manager','clients.edit','','Admin','clients.edit','2026-06-05 09:46:47',NULL),(1813,'site_manager','clients.bulk_upload','','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(1814,'site_manager','vendors.bulk_upload','','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(1815,'site_manager','vendors.engage','','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(1816,'site_manager','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(1817,'site_manager','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(1818,'site_manager','invoices.raise','','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(1819,'site_manager','payments.execute','','Finance','payments.execute','2026-06-05 09:46:47',NULL),(1820,'site_manager','gst.view','','Finance','gst.view','2026-06-05 09:46:47',NULL),(1821,'site_manager','boq.upload','','Services','boq.upload','2026-06-05 09:46:47',NULL),(1822,'site_manager','boq.map','','Services','boq.map','2026-06-05 09:46:47',NULL),(1823,'site_manager','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(1824,'site_manager','mom.issue','','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(1825,'site_manager','mom.sign','','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(1826,'site_manager','reports.approve','','Governance','reports.approve','2026-06-05 09:46:47',NULL),(1827,'site_manager','pmc-site.pmc-issue-snag-raise','A','PMC / Site','pmc.issue.snag-raise','2026-06-05 09:46:47',NULL),(1828,'site_manager','pmc-site.pmc-issue-snag-resolve','A','PMC / Site','pmc.issue.snag-resolve','2026-06-05 09:46:47',NULL),(1829,'site_manager','pmc-site.pmc-lessons-input-write','A','PMC / Site','pmc.lessons.input-write','2026-06-05 09:46:47',NULL),(1830,'senior_site_manager','finance.view-petty-cash','','Finance','View petty cash','2026-06-05 09:46:47',NULL),(1831,'senior_site_manager','finance.create-petty-cash-entry','','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(1832,'senior_site_manager','finance.replenish-petty-cash','','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(1833,'senior_site_manager','finance.view-direct-payments','','Finance','View direct payments','2026-06-05 09:46:47',NULL),(1834,'senior_site_manager','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(1835,'senior_site_manager','finance.view-client-receipts','','Finance','View client receipts','2026-06-05 09:46:47',NULL),(1836,'senior_site_manager','finance.record-client-receipt','','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(1837,'senior_site_manager','finance.view-advance-recovery','','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(1838,'senior_site_manager','finance.record-advance-recovery','','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(1839,'senior_site_manager','finance.view-payment-requests','R','Finance','View payment requests','2026-06-05 09:46:47',NULL),(1840,'senior_site_manager','finance.raise-payment-request','W','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(1841,'senior_site_manager','finance.raise-urgent-payment','W','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(1842,'senior_site_manager','finance.pmc-approve-payment-request','','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(1843,'senior_site_manager','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(1844,'senior_site_manager','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(1845,'senior_site_manager','finance.validate-vendor-pan','','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(1846,'senior_site_manager','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:47',NULL),(1847,'senior_site_manager','design.upload-drawing','','Design','Upload drawing','2026-06-05 09:46:47',NULL),(1848,'senior_site_manager','design.approve-reject-drawing-l2-','','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(1849,'senior_site_manager','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:47',NULL),(1850,'senior_site_manager','design.upload-to-drawing-register','','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(1851,'senior_site_manager','design.view-submittals','R','Design','View submittals','2026-06-05 09:46:47',NULL),(1852,'senior_site_manager','design.create-submittal','W','Design','Create submittal','2026-06-05 09:46:47',NULL),(1853,'senior_site_manager','design.review-submittal','','Design','Review submittal','2026-06-05 09:46:47',NULL),(1854,'senior_site_manager','design.answer-drawing-rfi','','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(1855,'senior_site_manager','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:47',NULL),(1856,'senior_site_manager','design.create-form-template','','Design','Create form template','2026-06-05 09:46:47',NULL),(1857,'senior_site_manager','design.approve-form-template','','Design','Approve form template','2026-06-05 09:46:47',NULL),(1858,'senior_site_manager','services.view-measurements','','Services','View measurements','2026-06-05 09:46:47',NULL),(1859,'senior_site_manager','services.create-measurement','','Services','Create measurement','2026-06-05 09:46:47',NULL),(1860,'senior_site_manager','services.add-measurement-items','','Services','Add measurement items','2026-06-05 09:46:47',NULL),(1861,'senior_site_manager','services.stream-sign-off-measurement','','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(1862,'senior_site_manager','services.record-client-acceptance','','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(1863,'senior_site_manager','services.view-claims','','Services','View claims','2026-06-05 09:46:47',NULL),(1864,'senior_site_manager','services.raise-claim','','Services','Raise claim','2026-06-05 09:46:47',NULL),(1865,'senior_site_manager','services.add-claim-items','','Services','Add claim items','2026-06-05 09:46:47',NULL),(1866,'senior_site_manager','services.pmc-sign-off-claim','','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(1867,'senior_site_manager','services.stream-sign-off-claim','','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(1868,'senior_site_manager','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(1869,'senior_site_manager','services.record-invoice-number-on-claim','','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(1870,'senior_site_manager','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(1871,'senior_site_manager','pmc-site.update-task-progress','W','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(1872,'senior_site_manager','pmc-site.view-grns','R','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(1873,'senior_site_manager','pmc-site.create-grn','W','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(1874,'senior_site_manager','pmc-site.approve-grn','','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(1875,'senior_site_manager','pmc-site.flag-grn-non-conformance','W','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(1876,'senior_site_manager','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(1877,'senior_site_manager','pmc-site.raise-snag','W','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(1878,'senior_site_manager','pmc-site.mark-snag-rectified','W','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(1879,'senior_site_manager','pmc-site.close-snag-verify-','','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(1880,'senior_site_manager','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(1881,'senior_site_manager','pmc-site.upload-site-photo','W','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(1882,'senior_site_manager','pmc-site.upload-project-document','W','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(1883,'senior_site_manager','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(1884,'senior_site_manager','pmc-site.raise-issue','W','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(1885,'senior_site_manager','pmc-site.close-issue','','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(1886,'senior_site_manager','pmc-site.raise-drawing-rfi','W','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(1887,'senior_site_manager','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(1888,'senior_site_manager','pmc-site.create-meeting-mom-draft-','W','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(1889,'senior_site_manager','pmc-site.log-site-visit','W','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(1890,'senior_site_manager','pmc-site.add-observation-to-meeting','W','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(1891,'senior_site_manager','pmc-site.upload-file-to-meeting','W','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(1892,'senior_site_manager','pmc-site.acknowledge-own-meeting-action-item','W','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(1893,'senior_site_manager','pmc-site.complete-own-meeting-action-item','W','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(1894,'senior_site_manager','pmc-site.log-client-communication','','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(1895,'senior_site_manager','pmc-site.submit-form-fill-and-send-','W','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(1896,'senior_site_manager','governance.view-change-notices','','Governance','View change notices','2026-06-05 09:46:47',NULL),(1897,'senior_site_manager','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(1898,'senior_site_manager','governance.sign-change-notice','','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(1899,'senior_site_manager','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(1900,'senior_site_manager','governance.view-weekly-reports','R','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(1901,'senior_site_manager','governance.edit-pmc-section','','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(1902,'senior_site_manager','governance.edit-design-section','','Governance','Edit design section','2026-06-05 09:46:47',NULL),(1903,'senior_site_manager','governance.edit-services-section','','Governance','Edit services section','2026-06-05 09:46:47',NULL),(1904,'senior_site_manager','governance.sign-weekly-report-section','','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(1905,'senior_site_manager','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(1906,'senior_site_manager','governance.acknowledge-ai-anomaly-flag','','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(1907,'senior_site_manager','governance.reset-another-user-s-password','','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(1908,'senior_site_manager','admin.initiate-new-user','','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(1909,'senior_site_manager','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(1910,'senior_site_manager','admin.view-vendor-master','','Admin','View vendor master','2026-06-05 09:46:47',NULL),(1911,'senior_site_manager','admin.create-vendor-master-entry','','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(1912,'senior_site_manager','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(1913,'senior_site_manager','admin.manage-delegations','','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(1914,'senior_site_manager','admin.project-setup','','Admin','Project setup','2026-06-05 09:46:47',NULL),(1915,'senior_site_manager','admin.trigger-ai-photo-tag','W','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(1916,'senior_site_manager','vendors.create','W','Admin','vendors.create','2026-06-05 09:46:47',NULL),(1917,'senior_site_manager','users.bulk_upload','','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(1918,'senior_site_manager','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(1919,'senior_site_manager','clients.create','','Admin','clients.create','2026-06-05 09:46:47',NULL),(1920,'senior_site_manager','clients.edit','','Admin','clients.edit','2026-06-05 09:46:47',NULL),(1921,'senior_site_manager','clients.bulk_upload','','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(1922,'senior_site_manager','vendors.bulk_upload','','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(1923,'senior_site_manager','vendors.engage','','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(1924,'senior_site_manager','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(1925,'senior_site_manager','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(1926,'senior_site_manager','invoices.raise','','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(1927,'senior_site_manager','payments.execute','','Finance','payments.execute','2026-06-05 09:46:47',NULL),(1928,'senior_site_manager','gst.view','','Finance','gst.view','2026-06-05 09:46:47',NULL),(1929,'senior_site_manager','boq.upload','','Services','boq.upload','2026-06-05 09:46:47',NULL),(1930,'senior_site_manager','boq.map','','Services','boq.map','2026-06-05 09:46:47',NULL),(1931,'senior_site_manager','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(1932,'senior_site_manager','mom.issue','','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(1933,'senior_site_manager','mom.sign','','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(1934,'senior_site_manager','reports.approve','A','Governance','reports.approve','2026-06-05 09:46:47',NULL),(1935,'senior_site_manager','pmc-site.pmc-issue-snag-raise','A','PMC / Site','pmc.issue.snag-raise','2026-06-05 09:46:47',NULL),(1936,'senior_site_manager','pmc-site.pmc-issue-snag-resolve','A','PMC / Site','pmc.issue.snag-resolve','2026-06-05 09:46:47',NULL),(1937,'senior_site_manager','pmc-site.pmc-lessons-input-write','A','PMC / Site','pmc.lessons.input-write','2026-06-05 09:46:47',NULL),(1938,'finance_admin','finance.view-petty-cash','R','Finance','View petty cash','2026-06-05 09:46:47',NULL),(1939,'finance_admin','finance.create-petty-cash-entry','','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(1940,'finance_admin','finance.replenish-petty-cash','','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(1941,'finance_admin','finance.view-direct-payments','R','Finance','View direct payments','2026-06-05 09:46:47',NULL),(1942,'finance_admin','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(1943,'finance_admin','finance.view-client-receipts','R','Finance','View client receipts','2026-06-05 09:46:47',NULL),(1944,'finance_admin','finance.record-client-receipt','W','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(1945,'finance_admin','finance.view-advance-recovery','R','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(1946,'finance_admin','finance.record-advance-recovery','','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(1947,'finance_admin','finance.view-payment-requests','R','Finance','View payment requests','2026-06-05 09:46:47',NULL),(1948,'finance_admin','finance.raise-payment-request','W','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(1949,'finance_admin','finance.raise-urgent-payment','','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(1950,'finance_admin','finance.pmc-approve-payment-request','','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(1951,'finance_admin','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(1952,'finance_admin','finance.clear-vendor-finance-','A','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(1953,'finance_admin','finance.validate-vendor-pan','A','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(1954,'finance_admin','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:47',NULL),(1955,'finance_admin','design.upload-drawing','','Design','Upload drawing','2026-06-05 09:46:47',NULL),(1956,'finance_admin','design.approve-reject-drawing-l2-','','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(1957,'finance_admin','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:47',NULL),(1958,'finance_admin','design.upload-to-drawing-register','','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(1959,'finance_admin','design.view-submittals','','Design','View submittals','2026-06-05 09:46:47',NULL),(1960,'finance_admin','design.create-submittal','','Design','Create submittal','2026-06-05 09:46:47',NULL),(1961,'finance_admin','design.review-submittal','','Design','Review submittal','2026-06-05 09:46:47',NULL),(1962,'finance_admin','design.answer-drawing-rfi','','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(1963,'finance_admin','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:47',NULL),(1964,'finance_admin','design.create-form-template','','Design','Create form template','2026-06-05 09:46:47',NULL),(1965,'finance_admin','design.approve-form-template','','Design','Approve form template','2026-06-05 09:46:47',NULL),(1966,'finance_admin','services.view-measurements','','Services','View measurements','2026-06-05 09:46:47',NULL),(1967,'finance_admin','services.create-measurement','','Services','Create measurement','2026-06-05 09:46:47',NULL),(1968,'finance_admin','services.add-measurement-items','','Services','Add measurement items','2026-06-05 09:46:47',NULL),(1969,'finance_admin','services.stream-sign-off-measurement','','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(1970,'finance_admin','services.record-client-acceptance','','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(1971,'finance_admin','services.view-claims','R','Services','View claims','2026-06-05 09:46:47',NULL),(1972,'finance_admin','services.raise-claim','','Services','Raise claim','2026-06-05 09:46:47',NULL),(1973,'finance_admin','services.add-claim-items','','Services','Add claim items','2026-06-05 09:46:47',NULL),(1974,'finance_admin','services.pmc-sign-off-claim','','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(1975,'finance_admin','services.stream-sign-off-claim','','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(1976,'finance_admin','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(1977,'finance_admin','services.record-invoice-number-on-claim','','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(1978,'finance_admin','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(1979,'finance_admin','pmc-site.update-task-progress','','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(1980,'finance_admin','pmc-site.view-grns','R','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(1981,'finance_admin','pmc-site.create-grn','','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(1982,'finance_admin','pmc-site.approve-grn','','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(1983,'finance_admin','pmc-site.flag-grn-non-conformance','','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(1984,'finance_admin','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(1985,'finance_admin','pmc-site.raise-snag','','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(1986,'finance_admin','pmc-site.mark-snag-rectified','','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(1987,'finance_admin','pmc-site.close-snag-verify-','','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(1988,'finance_admin','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(1989,'finance_admin','pmc-site.upload-site-photo','','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(1990,'finance_admin','pmc-site.upload-project-document','','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(1991,'finance_admin','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(1992,'finance_admin','pmc-site.raise-issue','','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(1993,'finance_admin','pmc-site.close-issue','','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(1994,'finance_admin','pmc-site.raise-drawing-rfi','','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(1995,'finance_admin','pmc-site.view-meetings-moms','','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(1996,'finance_admin','pmc-site.create-meeting-mom-draft-','','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(1997,'finance_admin','pmc-site.log-site-visit','','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(1998,'finance_admin','pmc-site.add-observation-to-meeting','','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(1999,'finance_admin','pmc-site.upload-file-to-meeting','','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(2000,'finance_admin','pmc-site.acknowledge-own-meeting-action-item','','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(2001,'finance_admin','pmc-site.complete-own-meeting-action-item','','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(2002,'finance_admin','pmc-site.log-client-communication','','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(2003,'finance_admin','pmc-site.submit-form-fill-and-send-','','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(2004,'finance_admin','governance.view-change-notices','','Governance','View change notices','2026-06-05 09:46:47',NULL),(2005,'finance_admin','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(2006,'finance_admin','governance.sign-change-notice','','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(2007,'finance_admin','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(2008,'finance_admin','governance.view-weekly-reports','','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(2009,'finance_admin','governance.edit-pmc-section','','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(2010,'finance_admin','governance.edit-design-section','','Governance','Edit design section','2026-06-05 09:46:47',NULL),(2011,'finance_admin','governance.edit-services-section','','Governance','Edit services section','2026-06-05 09:46:47',NULL),(2012,'finance_admin','governance.sign-weekly-report-section','','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(2013,'finance_admin','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(2014,'finance_admin','governance.acknowledge-ai-anomaly-flag','','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(2015,'finance_admin','governance.reset-another-user-s-password','','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(2016,'finance_admin','admin.initiate-new-user','','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(2017,'finance_admin','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(2018,'finance_admin','admin.view-vendor-master','R','Admin','View vendor master','2026-06-05 09:46:47',NULL),(2019,'finance_admin','admin.create-vendor-master-entry','W','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(2020,'finance_admin','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(2021,'finance_admin','admin.manage-delegations','','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(2022,'finance_admin','admin.project-setup','','Admin','Project setup','2026-06-05 09:46:47',NULL),(2023,'finance_admin','admin.trigger-ai-photo-tag','','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(2024,'finance_admin','vendors.create','','Admin','vendors.create','2026-06-05 09:46:47',NULL),(2025,'finance_admin','users.bulk_upload','W','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(2026,'finance_admin','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(2027,'finance_admin','clients.create','W','Admin','clients.create','2026-06-05 09:46:47',NULL),(2028,'finance_admin','clients.edit','W','Admin','clients.edit','2026-06-05 09:46:47',NULL),(2029,'finance_admin','clients.bulk_upload','W','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(2030,'finance_admin','vendors.bulk_upload','','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(2031,'finance_admin','vendors.engage','','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(2032,'finance_admin','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(2033,'finance_admin','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(2034,'finance_admin','invoices.raise','W','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(2035,'finance_admin','payments.execute','W','Finance','payments.execute','2026-06-05 09:46:47',NULL),(2036,'finance_admin','gst.view','R','Finance','gst.view','2026-06-05 09:46:47',NULL),(2037,'finance_admin','boq.upload','','Services','boq.upload','2026-06-05 09:46:47',NULL),(2038,'finance_admin','boq.map','','Services','boq.map','2026-06-05 09:46:47',NULL),(2039,'finance_admin','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(2040,'finance_admin','mom.issue','','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(2041,'finance_admin','mom.sign','','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(2042,'finance_admin','reports.approve','','Governance','reports.approve','2026-06-05 09:46:47',NULL),(2043,'finance_admin','finance.finance-payment-request-mark-paid','A','Finance','finance.payment-request.mark-paid','2026-06-05 09:46:47',NULL),(2044,'finance_admin','finance.finance-payment-pre-upload-check','A','Finance','finance.payment.pre-upload-check','2026-06-05 09:46:47',NULL),(2045,'finance_admin','finance.finance-payment-bulk-batch-export','A','Finance','finance.payment.bulk-batch-export','2026-06-05 09:46:47',NULL),(2046,'coordinator','finance.view-petty-cash','','Finance','View petty cash','2026-06-05 09:46:47',NULL),(2047,'coordinator','finance.create-petty-cash-entry','','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(2048,'coordinator','finance.replenish-petty-cash','','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(2049,'coordinator','finance.view-direct-payments','','Finance','View direct payments','2026-06-05 09:46:47',NULL),(2050,'coordinator','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(2051,'coordinator','finance.view-client-receipts','','Finance','View client receipts','2026-06-05 09:46:47',NULL),(2052,'coordinator','finance.record-client-receipt','','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(2053,'coordinator','finance.view-advance-recovery','','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(2054,'coordinator','finance.record-advance-recovery','','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(2055,'coordinator','finance.view-payment-requests','','Finance','View payment requests','2026-06-05 09:46:47',NULL),(2056,'coordinator','finance.raise-payment-request','','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(2057,'coordinator','finance.raise-urgent-payment','','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(2058,'coordinator','finance.pmc-approve-payment-request','','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(2059,'coordinator','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(2060,'coordinator','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(2061,'coordinator','finance.validate-vendor-pan','','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(2062,'coordinator','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:47',NULL),(2063,'coordinator','design.upload-drawing','','Design','Upload drawing','2026-06-05 09:46:47',NULL),(2064,'coordinator','design.approve-reject-drawing-l2-','','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(2065,'coordinator','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:47',NULL),(2066,'coordinator','design.upload-to-drawing-register','','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(2067,'coordinator','design.view-submittals','R','Design','View submittals','2026-06-05 09:46:47',NULL),(2068,'coordinator','design.create-submittal','W','Design','Create submittal','2026-06-05 09:46:47',NULL),(2069,'coordinator','design.review-submittal','','Design','Review submittal','2026-06-05 09:46:47',NULL),(2070,'coordinator','design.answer-drawing-rfi','','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(2071,'coordinator','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:47',NULL),(2072,'coordinator','design.create-form-template','','Design','Create form template','2026-06-05 09:46:47',NULL),(2073,'coordinator','design.approve-form-template','','Design','Approve form template','2026-06-05 09:46:47',NULL),(2074,'coordinator','services.view-measurements','','Services','View measurements','2026-06-05 09:46:47',NULL),(2075,'coordinator','services.create-measurement','','Services','Create measurement','2026-06-05 09:46:47',NULL),(2076,'coordinator','services.add-measurement-items','','Services','Add measurement items','2026-06-05 09:46:47',NULL),(2077,'coordinator','services.stream-sign-off-measurement','','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(2078,'coordinator','services.record-client-acceptance','','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(2079,'coordinator','services.view-claims','','Services','View claims','2026-06-05 09:46:47',NULL),(2080,'coordinator','services.raise-claim','','Services','Raise claim','2026-06-05 09:46:47',NULL),(2081,'coordinator','services.add-claim-items','','Services','Add claim items','2026-06-05 09:46:47',NULL),(2082,'coordinator','services.pmc-sign-off-claim','','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(2083,'coordinator','services.stream-sign-off-claim','','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(2084,'coordinator','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(2085,'coordinator','services.record-invoice-number-on-claim','','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(2086,'coordinator','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(2087,'coordinator','pmc-site.update-task-progress','W','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(2088,'coordinator','pmc-site.view-grns','','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(2089,'coordinator','pmc-site.create-grn','','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(2090,'coordinator','pmc-site.approve-grn','','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(2091,'coordinator','pmc-site.flag-grn-non-conformance','','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(2092,'coordinator','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(2093,'coordinator','pmc-site.raise-snag','W','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(2094,'coordinator','pmc-site.mark-snag-rectified','','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(2095,'coordinator','pmc-site.close-snag-verify-','','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(2096,'coordinator','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(2097,'coordinator','pmc-site.upload-site-photo','W','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(2098,'coordinator','pmc-site.upload-project-document','W','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(2099,'coordinator','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(2100,'coordinator','pmc-site.raise-issue','W','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(2101,'coordinator','pmc-site.close-issue','','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(2102,'coordinator','pmc-site.raise-drawing-rfi','W','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(2103,'coordinator','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(2104,'coordinator','pmc-site.create-meeting-mom-draft-','W','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(2105,'coordinator','pmc-site.log-site-visit','','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(2106,'coordinator','pmc-site.add-observation-to-meeting','','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(2107,'coordinator','pmc-site.upload-file-to-meeting','','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(2108,'coordinator','pmc-site.acknowledge-own-meeting-action-item','W','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(2109,'coordinator','pmc-site.complete-own-meeting-action-item','W','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(2110,'coordinator','pmc-site.log-client-communication','','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(2111,'coordinator','pmc-site.submit-form-fill-and-send-','W','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(2112,'coordinator','governance.view-change-notices','','Governance','View change notices','2026-06-05 09:46:47',NULL),(2113,'coordinator','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(2114,'coordinator','governance.sign-change-notice','','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(2115,'coordinator','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(2116,'coordinator','governance.view-weekly-reports','R','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(2117,'coordinator','governance.edit-pmc-section','','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(2118,'coordinator','governance.edit-design-section','','Governance','Edit design section','2026-06-05 09:46:47',NULL),(2119,'coordinator','governance.edit-services-section','','Governance','Edit services section','2026-06-05 09:46:47',NULL),(2120,'coordinator','governance.sign-weekly-report-section','','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(2121,'coordinator','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(2122,'coordinator','governance.acknowledge-ai-anomaly-flag','','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(2123,'coordinator','governance.reset-another-user-s-password','','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(2124,'coordinator','admin.initiate-new-user','','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(2125,'coordinator','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(2126,'coordinator','admin.view-vendor-master','','Admin','View vendor master','2026-06-05 09:46:47',NULL),(2127,'coordinator','admin.create-vendor-master-entry','','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(2128,'coordinator','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(2129,'coordinator','admin.manage-delegations','','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(2130,'coordinator','admin.project-setup','','Admin','Project setup','2026-06-05 09:46:47',NULL),(2131,'coordinator','admin.trigger-ai-photo-tag','W','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(2132,'coordinator','vendors.create','','Admin','vendors.create','2026-06-05 09:46:47',NULL),(2133,'coordinator','users.bulk_upload','','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(2134,'coordinator','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(2135,'coordinator','clients.create','','Admin','clients.create','2026-06-05 09:46:47',NULL),(2136,'coordinator','clients.edit','','Admin','clients.edit','2026-06-05 09:46:47',NULL),(2137,'coordinator','clients.bulk_upload','','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(2138,'coordinator','vendors.bulk_upload','','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(2139,'coordinator','vendors.engage','','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(2140,'coordinator','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(2141,'coordinator','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(2142,'coordinator','invoices.raise','','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(2143,'coordinator','payments.execute','','Finance','payments.execute','2026-06-05 09:46:47',NULL),(2144,'coordinator','gst.view','','Finance','gst.view','2026-06-05 09:46:47',NULL),(2145,'coordinator','boq.upload','','Services','boq.upload','2026-06-05 09:46:47',NULL),(2146,'coordinator','boq.map','','Services','boq.map','2026-06-05 09:46:47',NULL),(2147,'coordinator','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(2148,'coordinator','mom.issue','','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(2149,'coordinator','mom.sign','','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(2150,'coordinator','reports.approve','','Governance','reports.approve','2026-06-05 09:46:47',NULL),(2151,'coordinator','pmc-site.pmc-issue-snag-raise','A','PMC / Site','pmc.issue.snag-raise','2026-06-05 09:46:47',NULL),(2152,'coordinator','pmc-site.pmc-lessons-input-write','A','PMC / Site','pmc.lessons.input-write','2026-06-05 09:46:47',NULL),(2153,'trainee','finance.view-petty-cash','','Finance','View petty cash','2026-06-05 09:46:47',NULL),(2154,'trainee','finance.create-petty-cash-entry','','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(2155,'trainee','finance.replenish-petty-cash','','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(2156,'trainee','finance.view-direct-payments','','Finance','View direct payments','2026-06-05 09:46:47',NULL),(2157,'trainee','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(2158,'trainee','finance.view-client-receipts','','Finance','View client receipts','2026-06-05 09:46:47',NULL),(2159,'trainee','finance.record-client-receipt','','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(2160,'trainee','finance.view-advance-recovery','','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(2161,'trainee','finance.record-advance-recovery','','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(2162,'trainee','finance.view-payment-requests','','Finance','View payment requests','2026-06-05 09:46:47',NULL),(2163,'trainee','finance.raise-payment-request','','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(2164,'trainee','finance.raise-urgent-payment','','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(2165,'trainee','finance.pmc-approve-payment-request','','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(2166,'trainee','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(2167,'trainee','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(2168,'trainee','finance.validate-vendor-pan','','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(2169,'trainee','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:47',NULL),(2170,'trainee','design.upload-drawing','','Design','Upload drawing','2026-06-05 09:46:47',NULL),(2171,'trainee','design.approve-reject-drawing-l2-','','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(2172,'trainee','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:47',NULL),(2173,'trainee','design.upload-to-drawing-register','','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(2174,'trainee','design.view-submittals','','Design','View submittals','2026-06-05 09:46:47',NULL),(2175,'trainee','design.create-submittal','','Design','Create submittal','2026-06-05 09:46:47',NULL),(2176,'trainee','design.review-submittal','','Design','Review submittal','2026-06-05 09:46:47',NULL),(2177,'trainee','design.answer-drawing-rfi','','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(2178,'trainee','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:47',NULL),(2179,'trainee','design.create-form-template','','Design','Create form template','2026-06-05 09:46:47',NULL),(2180,'trainee','design.approve-form-template','','Design','Approve form template','2026-06-05 09:46:47',NULL),(2181,'trainee','services.view-measurements','','Services','View measurements','2026-06-05 09:46:47',NULL),(2182,'trainee','services.create-measurement','','Services','Create measurement','2026-06-05 09:46:47',NULL),(2183,'trainee','services.add-measurement-items','','Services','Add measurement items','2026-06-05 09:46:47',NULL),(2184,'trainee','services.stream-sign-off-measurement','','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(2185,'trainee','services.record-client-acceptance','','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(2186,'trainee','services.view-claims','','Services','View claims','2026-06-05 09:46:47',NULL),(2187,'trainee','services.raise-claim','','Services','Raise claim','2026-06-05 09:46:47',NULL),(2188,'trainee','services.add-claim-items','','Services','Add claim items','2026-06-05 09:46:47',NULL),(2189,'trainee','services.pmc-sign-off-claim','','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(2190,'trainee','services.stream-sign-off-claim','','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(2191,'trainee','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(2192,'trainee','services.record-invoice-number-on-claim','','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(2193,'trainee','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(2194,'trainee','pmc-site.update-task-progress','','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(2195,'trainee','pmc-site.view-grns','','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(2196,'trainee','pmc-site.create-grn','','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(2197,'trainee','pmc-site.approve-grn','','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(2198,'trainee','pmc-site.flag-grn-non-conformance','','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(2199,'trainee','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(2200,'trainee','pmc-site.raise-snag','','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(2201,'trainee','pmc-site.mark-snag-rectified','','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(2202,'trainee','pmc-site.close-snag-verify-','','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(2203,'trainee','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(2204,'trainee','pmc-site.upload-site-photo','W','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(2205,'trainee','pmc-site.upload-project-document','','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(2206,'trainee','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(2207,'trainee','pmc-site.raise-issue','W','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(2208,'trainee','pmc-site.close-issue','','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(2209,'trainee','pmc-site.raise-drawing-rfi','W','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(2210,'trainee','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(2211,'trainee','pmc-site.create-meeting-mom-draft-','','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(2212,'trainee','pmc-site.log-site-visit','','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(2213,'trainee','pmc-site.add-observation-to-meeting','','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(2214,'trainee','pmc-site.upload-file-to-meeting','','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(2215,'trainee','pmc-site.acknowledge-own-meeting-action-item','','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(2216,'trainee','pmc-site.complete-own-meeting-action-item','','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(2217,'trainee','pmc-site.log-client-communication','','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(2218,'trainee','pmc-site.submit-form-fill-and-send-','','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(2219,'trainee','governance.view-change-notices','','Governance','View change notices','2026-06-05 09:46:47',NULL),(2220,'trainee','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(2221,'trainee','governance.sign-change-notice','','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(2222,'trainee','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(2223,'trainee','governance.view-weekly-reports','','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(2224,'trainee','governance.edit-pmc-section','','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(2225,'trainee','governance.edit-design-section','','Governance','Edit design section','2026-06-05 09:46:47',NULL),(2226,'trainee','governance.edit-services-section','','Governance','Edit services section','2026-06-05 09:46:47',NULL),(2227,'trainee','governance.sign-weekly-report-section','','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(2228,'trainee','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(2229,'trainee','governance.acknowledge-ai-anomaly-flag','','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(2230,'trainee','governance.reset-another-user-s-password','','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(2231,'trainee','admin.initiate-new-user','','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(2232,'trainee','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(2233,'trainee','admin.view-vendor-master','','Admin','View vendor master','2026-06-05 09:46:47',NULL),(2234,'trainee','admin.create-vendor-master-entry','','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(2235,'trainee','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(2236,'trainee','admin.manage-delegations','','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(2237,'trainee','admin.project-setup','','Admin','Project setup','2026-06-05 09:46:47',NULL),(2238,'trainee','admin.trigger-ai-photo-tag','','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(2239,'trainee','vendors.create','','Admin','vendors.create','2026-06-05 09:46:47',NULL),(2240,'trainee','users.bulk_upload','','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(2241,'trainee','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(2242,'trainee','clients.create','','Admin','clients.create','2026-06-05 09:46:47',NULL),(2243,'trainee','clients.edit','','Admin','clients.edit','2026-06-05 09:46:47',NULL),(2244,'trainee','clients.bulk_upload','','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(2245,'trainee','vendors.bulk_upload','','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(2246,'trainee','vendors.engage','','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(2247,'trainee','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(2248,'trainee','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(2249,'trainee','invoices.raise','','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(2250,'trainee','payments.execute','','Finance','payments.execute','2026-06-05 09:46:47',NULL),(2251,'trainee','gst.view','','Finance','gst.view','2026-06-05 09:46:47',NULL),(2252,'trainee','boq.upload','','Services','boq.upload','2026-06-05 09:46:47',NULL),(2253,'trainee','boq.map','','Services','boq.map','2026-06-05 09:46:47',NULL),(2254,'trainee','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(2255,'trainee','mom.issue','','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(2256,'trainee','mom.sign','','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(2257,'trainee','reports.approve','','Governance','reports.approve','2026-06-05 09:46:47',NULL),(2258,'trainee','pmc-site.pmc-lessons-input-write','A','PMC / Site','pmc.lessons.input-write','2026-06-05 09:46:47',NULL),(2259,'audit','finance.view-petty-cash','','Finance','View petty cash','2026-06-05 09:46:47',NULL),(2260,'audit','finance.create-petty-cash-entry','','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(2261,'audit','finance.replenish-petty-cash','','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(2262,'audit','finance.view-direct-payments','','Finance','View direct payments','2026-06-05 09:46:47',NULL),(2263,'audit','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(2264,'audit','finance.view-client-receipts','','Finance','View client receipts','2026-06-05 09:46:47',NULL),(2265,'audit','finance.record-client-receipt','','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(2266,'audit','finance.view-advance-recovery','','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(2267,'audit','finance.record-advance-recovery','','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(2268,'audit','finance.view-payment-requests','','Finance','View payment requests','2026-06-05 09:46:47',NULL),(2269,'audit','finance.raise-payment-request','','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(2270,'audit','finance.raise-urgent-payment','','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(2271,'audit','finance.pmc-approve-payment-request','','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(2272,'audit','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(2273,'audit','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(2274,'audit','finance.validate-vendor-pan','','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(2275,'audit','design.view-drawings','R','Design','View drawings','2026-06-05 09:46:47',NULL),(2276,'audit','design.upload-drawing','','Design','Upload drawing','2026-06-05 09:46:47',NULL),(2277,'audit','design.approve-reject-drawing-l2-','','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(2278,'audit','design.view-drawing-register','R','Design','View drawing register','2026-06-05 09:46:47',NULL),(2279,'audit','design.upload-to-drawing-register','','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(2280,'audit','design.view-submittals','R','Design','View submittals','2026-06-05 09:46:47',NULL),(2281,'audit','design.create-submittal','','Design','Create submittal','2026-06-05 09:46:47',NULL),(2282,'audit','design.review-submittal','','Design','Review submittal','2026-06-05 09:46:47',NULL),(2283,'audit','design.answer-drawing-rfi','','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(2284,'audit','design.view-form-templates','R','Design','View form templates','2026-06-05 09:46:47',NULL),(2285,'audit','design.create-form-template','','Design','Create form template','2026-06-05 09:46:47',NULL),(2286,'audit','design.approve-form-template','','Design','Approve form template','2026-06-05 09:46:47',NULL),(2287,'audit','services.view-measurements','','Services','View measurements','2026-06-05 09:46:47',NULL),(2288,'audit','services.create-measurement','','Services','Create measurement','2026-06-05 09:46:47',NULL),(2289,'audit','services.add-measurement-items','','Services','Add measurement items','2026-06-05 09:46:47',NULL),(2290,'audit','services.stream-sign-off-measurement','','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(2291,'audit','services.record-client-acceptance','','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(2292,'audit','services.view-claims','','Services','View claims','2026-06-05 09:46:47',NULL),(2293,'audit','services.raise-claim','','Services','Raise claim','2026-06-05 09:46:47',NULL),(2294,'audit','services.add-claim-items','','Services','Add claim items','2026-06-05 09:46:47',NULL),(2295,'audit','services.pmc-sign-off-claim','','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(2296,'audit','services.stream-sign-off-claim','','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(2297,'audit','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(2298,'audit','services.record-invoice-number-on-claim','','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(2299,'audit','pmc-site.view-schedule','R','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(2300,'audit','pmc-site.update-task-progress','','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(2301,'audit','pmc-site.view-grns','','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(2302,'audit','pmc-site.create-grn','','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(2303,'audit','pmc-site.approve-grn','','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(2304,'audit','pmc-site.flag-grn-non-conformance','','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(2305,'audit','pmc-site.view-snags','R','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(2306,'audit','pmc-site.raise-snag','','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(2307,'audit','pmc-site.mark-snag-rectified','','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(2308,'audit','pmc-site.close-snag-verify-','','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(2309,'audit','pmc-site.view-photos','R','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(2310,'audit','pmc-site.upload-site-photo','','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(2311,'audit','pmc-site.upload-project-document','','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(2312,'audit','pmc-site.view-issues','R','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(2313,'audit','pmc-site.raise-issue','','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(2314,'audit','pmc-site.close-issue','','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(2315,'audit','pmc-site.raise-drawing-rfi','','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(2316,'audit','pmc-site.view-meetings-moms','R','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(2317,'audit','pmc-site.create-meeting-mom-draft-','','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(2318,'audit','pmc-site.log-site-visit','','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(2319,'audit','pmc-site.add-observation-to-meeting','','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(2320,'audit','pmc-site.upload-file-to-meeting','','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(2321,'audit','pmc-site.acknowledge-own-meeting-action-item','','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(2322,'audit','pmc-site.complete-own-meeting-action-item','','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(2323,'audit','pmc-site.log-client-communication','','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(2324,'audit','pmc-site.submit-form-fill-and-send-','','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(2325,'audit','governance.view-change-notices','R','Governance','View change notices','2026-06-05 09:46:47',NULL),(2326,'audit','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(2327,'audit','governance.sign-change-notice','','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(2328,'audit','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(2329,'audit','governance.view-weekly-reports','R','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(2330,'audit','governance.edit-pmc-section','','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(2331,'audit','governance.edit-design-section','','Governance','Edit design section','2026-06-05 09:46:47',NULL),(2332,'audit','governance.edit-services-section','','Governance','Edit services section','2026-06-05 09:46:47',NULL),(2333,'audit','governance.sign-weekly-report-section','','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(2334,'audit','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(2335,'audit','governance.acknowledge-ai-anomaly-flag','','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(2336,'audit','governance.reset-another-user-s-password','','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(2337,'audit','admin.initiate-new-user','','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(2338,'audit','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(2339,'audit','admin.view-vendor-master','','Admin','View vendor master','2026-06-05 09:46:47',NULL),(2340,'audit','admin.create-vendor-master-entry','','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(2341,'audit','admin.edit-nav-role-tabs','','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(2342,'audit','admin.manage-delegations','','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(2343,'audit','admin.project-setup','','Admin','Project setup','2026-06-05 09:46:47',NULL),(2344,'audit','admin.trigger-ai-photo-tag','','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(2345,'audit','vendors.create','','Admin','vendors.create','2026-06-05 09:46:47',NULL),(2346,'audit','users.bulk_upload','','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(2347,'audit','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(2348,'audit','clients.create','','Admin','clients.create','2026-06-05 09:46:47',NULL),(2349,'audit','clients.edit','','Admin','clients.edit','2026-06-05 09:46:47',NULL),(2350,'audit','clients.bulk_upload','','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(2351,'audit','vendors.bulk_upload','','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(2352,'audit','vendors.engage','','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(2353,'audit','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(2354,'audit','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(2355,'audit','invoices.raise','','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(2356,'audit','payments.execute','','Finance','payments.execute','2026-06-05 09:46:47',NULL),(2357,'audit','gst.view','','Finance','gst.view','2026-06-05 09:46:47',NULL),(2358,'audit','boq.upload','','Services','boq.upload','2026-06-05 09:46:47',NULL),(2359,'audit','boq.map','','Services','boq.map','2026-06-05 09:46:47',NULL),(2360,'audit','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(2361,'audit','mom.issue','','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(2362,'audit','mom.sign','','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(2363,'audit','reports.approve','','Governance','reports.approve','2026-06-05 09:46:47',NULL),(2364,'audit','finance.finance-payment-bulk-batch-export','A','Finance','finance.payment.bulk-batch-export','2026-06-05 09:46:47',NULL),(2365,'it_admin','finance.view-petty-cash','','Finance','View petty cash','2026-06-05 09:46:47',NULL),(2366,'it_admin','finance.create-petty-cash-entry','','Finance','Create petty cash entry','2026-06-05 09:46:47',NULL),(2367,'it_admin','finance.replenish-petty-cash','','Finance','Replenish petty cash','2026-06-05 09:46:47',NULL),(2368,'it_admin','finance.view-direct-payments','','Finance','View direct payments','2026-06-05 09:46:47',NULL),(2369,'it_admin','finance.record-direct-payment','','Finance','Record direct payment','2026-06-05 09:46:47',NULL),(2370,'it_admin','finance.view-client-receipts','','Finance','View client receipts','2026-06-05 09:46:47',NULL),(2371,'it_admin','finance.record-client-receipt','','Finance','Record client receipt','2026-06-05 09:46:47',NULL),(2372,'it_admin','finance.view-advance-recovery','','Finance','View advance recovery','2026-06-05 09:46:47',NULL),(2373,'it_admin','finance.record-advance-recovery','','Finance','Record advance recovery','2026-06-05 09:46:47',NULL),(2374,'it_admin','finance.view-payment-requests','','Finance','View payment requests','2026-06-05 09:46:47',NULL),(2375,'it_admin','finance.raise-payment-request','','Finance','Raise payment request','2026-06-05 09:46:47',NULL),(2376,'it_admin','finance.raise-urgent-payment','','Finance','Raise urgent payment','2026-06-05 09:46:47',NULL),(2377,'it_admin','finance.pmc-approve-payment-request','','Finance','PMC approve payment request','2026-06-05 09:46:47',NULL),(2378,'it_admin','finance.principal-approve-payment-request','','Finance','Principal approve payment request','2026-06-05 09:46:47',NULL),(2379,'it_admin','finance.clear-vendor-finance-','','Finance','Clear vendor (finance)','2026-06-05 09:46:47',NULL),(2380,'it_admin','finance.validate-vendor-pan','','Finance','Validate vendor PAN','2026-06-05 09:46:47',NULL),(2381,'it_admin','design.view-drawings','','Design','View drawings','2026-06-05 09:46:47',NULL),(2382,'it_admin','design.upload-drawing','','Design','Upload drawing','2026-06-05 09:46:47',NULL),(2383,'it_admin','design.approve-reject-drawing-l2-','','Design','Approve / reject drawing (L2)','2026-06-05 09:46:47',NULL),(2384,'it_admin','design.view-drawing-register','','Design','View drawing register','2026-06-05 09:46:47',NULL),(2385,'it_admin','design.upload-to-drawing-register','','Design','Upload to drawing register','2026-06-05 09:46:47',NULL),(2386,'it_admin','design.view-submittals','','Design','View submittals','2026-06-05 09:46:47',NULL),(2387,'it_admin','design.create-submittal','','Design','Create submittal','2026-06-05 09:46:47',NULL),(2388,'it_admin','design.review-submittal','','Design','Review submittal','2026-06-05 09:46:47',NULL),(2389,'it_admin','design.answer-drawing-rfi','','Design','Answer drawing RFI','2026-06-05 09:46:47',NULL),(2390,'it_admin','design.view-form-templates','','Design','View form templates','2026-06-05 09:46:47',NULL),(2391,'it_admin','design.create-form-template','','Design','Create form template','2026-06-05 09:46:47',NULL),(2392,'it_admin','design.approve-form-template','','Design','Approve form template','2026-06-05 09:46:47',NULL),(2393,'it_admin','services.view-measurements','','Services','View measurements','2026-06-05 09:46:47',NULL),(2394,'it_admin','services.create-measurement','','Services','Create measurement','2026-06-05 09:46:47',NULL),(2395,'it_admin','services.add-measurement-items','','Services','Add measurement items','2026-06-05 09:46:47',NULL),(2396,'it_admin','services.stream-sign-off-measurement','','Services','Stream sign-off measurement','2026-06-05 09:46:47',NULL),(2397,'it_admin','services.record-client-acceptance','','Services','Record client acceptance','2026-06-05 09:46:47',NULL),(2398,'it_admin','services.view-claims','','Services','View claims','2026-06-05 09:46:47',NULL),(2399,'it_admin','services.raise-claim','','Services','Raise claim','2026-06-05 09:46:47',NULL),(2400,'it_admin','services.add-claim-items','','Services','Add claim items','2026-06-05 09:46:47',NULL),(2401,'it_admin','services.pmc-sign-off-claim','','Services','PMC sign-off claim','2026-06-05 09:46:47',NULL),(2402,'it_admin','services.stream-sign-off-claim','','Services','Stream sign-off claim','2026-06-05 09:46:47',NULL),(2403,'it_admin','services.approve-claim-final-','','Services','Approve claim (final)','2026-06-05 09:46:47',NULL),(2404,'it_admin','services.record-invoice-number-on-claim','','Services','Record invoice number on claim','2026-06-05 09:46:47',NULL),(2405,'it_admin','pmc-site.view-schedule','','PMC / Site','View schedule','2026-06-05 09:46:47',NULL),(2406,'it_admin','pmc-site.update-task-progress','','PMC / Site','Update task progress','2026-06-05 09:46:47',NULL),(2407,'it_admin','pmc-site.view-grns','','PMC / Site','View GRNs','2026-06-05 09:46:47',NULL),(2408,'it_admin','pmc-site.create-grn','','PMC / Site','Create GRN','2026-06-05 09:46:47',NULL),(2409,'it_admin','pmc-site.approve-grn','','PMC / Site','Approve GRN','2026-06-05 09:46:47',NULL),(2410,'it_admin','pmc-site.flag-grn-non-conformance','','PMC / Site','Flag GRN non-conformance','2026-06-05 09:46:47',NULL),(2411,'it_admin','pmc-site.view-snags','','PMC / Site','View snags','2026-06-05 09:46:47',NULL),(2412,'it_admin','pmc-site.raise-snag','','PMC / Site','Raise snag','2026-06-05 09:46:47',NULL),(2413,'it_admin','pmc-site.mark-snag-rectified','','PMC / Site','Mark snag rectified','2026-06-05 09:46:47',NULL),(2414,'it_admin','pmc-site.close-snag-verify-','','PMC / Site','Close snag (verify)','2026-06-05 09:46:47',NULL),(2415,'it_admin','pmc-site.view-photos','','PMC / Site','View photos','2026-06-05 09:46:47',NULL),(2416,'it_admin','pmc-site.upload-site-photo','','PMC / Site','Upload site photo','2026-06-05 09:46:47',NULL),(2417,'it_admin','pmc-site.upload-project-document','','PMC / Site','Upload project document','2026-06-05 09:46:47',NULL),(2418,'it_admin','pmc-site.view-issues','','PMC / Site','View issues','2026-06-05 09:46:47',NULL),(2419,'it_admin','pmc-site.raise-issue','','PMC / Site','Raise issue','2026-06-05 09:46:47',NULL),(2420,'it_admin','pmc-site.close-issue','','PMC / Site','Close issue','2026-06-05 09:46:47',NULL),(2421,'it_admin','pmc-site.raise-drawing-rfi','','PMC / Site','Raise drawing RFI','2026-06-05 09:46:47',NULL),(2422,'it_admin','pmc-site.view-meetings-moms','','PMC / Site','View meetings / MOMs','2026-06-05 09:46:47',NULL),(2423,'it_admin','pmc-site.create-meeting-mom-draft-','','PMC / Site','Create meeting / MOM (draft)','2026-06-05 09:46:47',NULL),(2424,'it_admin','pmc-site.log-site-visit','','PMC / Site','Log site visit','2026-06-05 09:46:47',NULL),(2425,'it_admin','pmc-site.add-observation-to-meeting','','PMC / Site','Add observation to meeting','2026-06-05 09:46:47',NULL),(2426,'it_admin','pmc-site.upload-file-to-meeting','','PMC / Site','Upload file to meeting','2026-06-05 09:46:47',NULL),(2427,'it_admin','pmc-site.acknowledge-own-meeting-action-item','','PMC / Site','Acknowledge own meeting action item','2026-06-05 09:46:47',NULL),(2428,'it_admin','pmc-site.complete-own-meeting-action-item','','PMC / Site','Complete own meeting action item','2026-06-05 09:46:47',NULL),(2429,'it_admin','pmc-site.log-client-communication','','PMC / Site','Log client communication','2026-06-05 09:46:47',NULL),(2430,'it_admin','pmc-site.submit-form-fill-and-send-','','PMC / Site','Submit form (fill and send)','2026-06-05 09:46:47',NULL),(2431,'it_admin','governance.view-change-notices','','Governance','View change notices','2026-06-05 09:46:47',NULL),(2432,'it_admin','governance.raise-change-notice','','Governance','Raise change notice','2026-06-05 09:46:47',NULL),(2433,'it_admin','governance.sign-change-notice','','Governance','Sign change notice','2026-06-05 09:46:47',NULL),(2434,'it_admin','governance.approve-change-notice','','Governance','Approve change notice','2026-06-05 09:46:47',NULL),(2435,'it_admin','governance.view-weekly-reports','','Governance','View weekly reports','2026-06-05 09:46:47',NULL),(2436,'it_admin','governance.edit-pmc-section','','Governance','Edit PMC section','2026-06-05 09:46:47',NULL),(2437,'it_admin','governance.edit-design-section','','Governance','Edit design section','2026-06-05 09:46:47',NULL),(2438,'it_admin','governance.edit-services-section','','Governance','Edit services section','2026-06-05 09:46:47',NULL),(2439,'it_admin','governance.sign-weekly-report-section','','Governance','Sign weekly report section','2026-06-05 09:46:47',NULL),(2440,'it_admin','governance.mark-weekly-report-sent-to-client','','Governance','Mark weekly report sent to client','2026-06-05 09:46:47',NULL),(2441,'it_admin','governance.acknowledge-ai-anomaly-flag','','Governance','Acknowledge AI anomaly flag','2026-06-05 09:46:47',NULL),(2442,'it_admin','governance.reset-another-user-s-password','W','Governance','Reset another user\'s password','2026-06-05 09:46:47',NULL),(2443,'it_admin','admin.initiate-new-user','','Admin','Initiate new user','2026-06-05 09:46:47',NULL),(2444,'it_admin','admin.approve-new-user','','Admin','Approve new user','2026-06-05 09:46:47',NULL),(2445,'it_admin','admin.view-vendor-master','','Admin','View vendor master','2026-06-05 09:46:47',NULL),(2446,'it_admin','admin.create-vendor-master-entry','','Admin','Create vendor master entry','2026-06-05 09:46:47',NULL),(2447,'it_admin','admin.edit-nav-role-tabs','W','Admin','Edit nav / role tabs','2026-06-05 09:46:47',NULL),(2448,'it_admin','admin.manage-delegations','','Admin','Manage delegations','2026-06-05 09:46:47',NULL),(2449,'it_admin','admin.project-setup','W','Admin','Project setup','2026-06-05 09:46:47',NULL),(2450,'it_admin','admin.trigger-ai-photo-tag','','Admin','Trigger AI photo tag','2026-06-05 09:46:47',NULL),(2451,'it_admin','vendors.create','','Admin','vendors.create','2026-06-05 09:46:47',NULL),(2452,'it_admin','users.bulk_upload','','Admin','users.bulk_upload','2026-06-05 09:46:47',NULL),(2453,'it_admin','users.deactivate','','Admin','users.deactivate','2026-06-05 09:46:47',NULL),(2454,'it_admin','clients.create','','Admin','clients.create','2026-06-05 09:46:47',NULL),(2455,'it_admin','clients.edit','','Admin','clients.edit','2026-06-05 09:46:47',NULL),(2456,'it_admin','clients.bulk_upload','','Admin','clients.bulk_upload','2026-06-05 09:46:47',NULL),(2457,'it_admin','vendors.bulk_upload','','Admin','vendors.bulk_upload','2026-06-05 09:46:47',NULL),(2458,'it_admin','vendors.engage','','Admin','vendors.engage','2026-06-05 09:46:47',NULL),(2459,'it_admin','projects.create','','Admin','projects.create','2026-06-05 09:46:47',NULL),(2460,'it_admin','projects.edit','','Admin','projects.edit','2026-06-05 09:46:47',NULL),(2461,'it_admin','invoices.raise','','Finance','invoices.raise','2026-06-05 09:46:47',NULL),(2462,'it_admin','payments.execute','','Finance','payments.execute','2026-06-05 09:46:47',NULL),(2463,'it_admin','gst.view','','Finance','gst.view','2026-06-05 09:46:47',NULL),(2464,'it_admin','boq.upload','','Services','boq.upload','2026-06-05 09:46:47',NULL),(2465,'it_admin','boq.map','','Services','boq.map','2026-06-05 09:46:47',NULL),(2466,'it_admin','budget.approve','','Services','budget.approve','2026-06-05 09:46:47',NULL),(2467,'it_admin','mom.issue','','PMC / Site','mom.issue','2026-06-05 09:46:47',NULL),(2468,'it_admin','mom.sign','','PMC / Site','mom.sign','2026-06-05 09:46:47',NULL),(2469,'it_admin','reports.approve','','Governance','reports.approve','2026-06-05 09:46:47',NULL);
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
  `notified_naveen` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_trade_week` (`project_id`,`trade`,`week_ending`),
  CONSTRAINT `schedule_risk_narratives_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_risk_narratives`
--

LOCK TABLES `schedule_risk_narratives` WRITE;
/*!40000 ALTER TABLE `schedule_risk_narratives` DISABLE KEYS */;
INSERT INTO `schedule_risk_narratives` VALUES (1,1,'Civil','2026-06-04',100.00,0.00,100.00,8.5,10.2,'Civil is 100.0% behind plan. Forecast delay: 10.2 weeks. (AI narrative pending batch processing)','critical',1,1,'2026-06-04 13:34:14'),(2,1,'Electrical','2026-06-04',100.00,0.00,100.00,8.5,10.2,'Electrical is 100.0% behind plan. Forecast delay: 10.2 weeks. (AI narrative pending batch processing)','critical',1,1,'2026-06-04 13:34:14'),(3,1,'HVAC','2026-06-04',100.00,0.00,100.00,8.5,10.2,'HVAC is 100.0% behind plan. Forecast delay: 10.2 weeks. (AI narrative pending batch processing)','critical',1,1,'2026-06-04 13:34:14');
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
  `description` text COLLATE utf8mb4_general_ci,
  `assignee_id` int unsigned DEFAULT NULL,
  `priority` enum('low','medium','high','urgent') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'medium',
  PRIMARY KEY (`id`),
  KEY `schedule_version_id` (`schedule_version_id`),
  KEY `depends_on_task_id` (`depends_on_task_id`),
  KEY `idx_schedule_tasks_project` (`project_id`,`schedule_version_id`),
  KEY `fk_schedule_tasks_assignee` (`assignee_id`),
  CONSTRAINT `fk_schedule_tasks_assignee` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `schedule_tasks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `schedule_tasks_ibfk_2` FOREIGN KEY (`schedule_version_id`) REFERENCES `schedule_versions` (`id`),
  CONSTRAINT `schedule_tasks_ibfk_3` FOREIGN KEY (`depends_on_task_id`) REFERENCES `schedule_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_st_dates` CHECK ((`end_date` >= `start_date`))
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_tasks`
--

LOCK TABLES `schedule_tasks` WRITE;
/*!40000 ALTER TABLE `schedule_tasks` DISABLE KEYS */;
INSERT INTO `schedule_tasks` VALUES (1,1,1,'Civil','Site mobilisation','2026-03-23','2026-03-25',NULL,1,0,'schedule','Mobilisation complete',1,0,'not_started','2026-06-08 13:33:05','2026-04-22 17:25:19',NULL,NULL,'medium'),(2,1,1,'Civil','Foundation excavation','2026-03-26','2026-04-02',NULL,0,0,'none',NULL,2,0,'not_started','2026-06-08 13:33:05','2026-04-22 17:25:19',NULL,NULL,'medium'),(3,1,1,'Civil','Foundation concrete','2026-04-03','2026-04-10',NULL,1,0,'both','Foundation cast',3,0,'not_started','2026-06-08 13:33:06','2026-04-22 17:25:19',NULL,NULL,'medium'),(4,1,1,'Civil','Floor slab + columns','2026-04-11','2026-04-24',NULL,0,0,'none',NULL,4,0,'not_started','2026-06-08 13:33:06','2026-04-22 17:25:19',NULL,NULL,'medium'),(5,1,1,'Electrical','Conduit rough-in','2026-04-15','2026-04-25',NULL,0,0,'none',NULL,5,0,'not_started','2026-06-08 13:33:06','2026-04-22 17:25:19',NULL,NULL,'medium'),(6,1,1,'Electrical','Cable pulling','2026-04-26','2026-05-05',NULL,0,0,'none',NULL,6,0,'not_started','2026-06-08 13:33:06','2026-04-22 17:25:19',NULL,NULL,'medium'),(7,1,1,'Electrical','Panel termination','2026-05-06','2026-05-12',NULL,1,0,'payment','Power-on milestone',7,0,'not_started','2026-06-08 13:33:06','2026-04-22 17:25:19',NULL,NULL,'medium'),(8,1,1,'HVAC','Ductwork install','2026-04-28','2026-05-08',NULL,0,0,'none',NULL,8,0,'not_started','2026-06-08 13:33:06','2026-04-22 17:25:19',NULL,NULL,'medium'),(9,1,1,'HVAC','AHU commissioning','2026-05-10','2026-05-18',NULL,1,0,'payment','HVAC live',9,0,'not_started','2026-06-08 13:33:06','2026-04-22 17:25:19',NULL,NULL,'medium'),(10,1,1,'Civil','Snagging + handover','2026-05-19','2026-05-25',NULL,1,0,'both','Practical completion',10,0,'not_started','2026-06-08 13:33:06','2026-04-22 17:25:19',NULL,NULL,'medium'),(11,1,1,'Civil','Ad-hoc Planning Task','2026-06-03','2026-06-03',NULL,0,0,'none',NULL,11,0,'not_started','2026-06-08 13:33:06','2026-06-03 13:42:02','Scheduled from Look Ahead workspace test',NULL,'high'),(12,1,1,'Civil','Ad-hoc Planning Task','2026-06-03','2026-06-03',NULL,0,0,'none',NULL,12,0,'not_started','2026-06-08 13:33:06','2026-06-03 13:45:25','Scheduled from Look Ahead workspace test',NULL,'high');
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_versions`
--

LOCK TABLES `schedule_versions` WRITE;
/*!40000 ALTER TABLE `schedule_versions` DISABLE KEYS */;
INSERT INTO `schedule_versions` VALUES (1,1,1,0,'R0','2026-05-25',0,'approved',NULL,1,NULL,NULL,NULL,1,0,NULL,NULL,NULL,'2026-04-22 17:25:19');
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
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `setup_checklist_items`
--

LOCK TABLES `setup_checklist_items` WRITE;
/*!40000 ALTER TABLE `setup_checklist_items` DISABLE KEYS */;
INSERT INTO `setup_checklist_items` VALUES (1,1,'Project Team Assigned','Assign PMC Head, Design Head, Services Head, and Site Manager to project','core','principal',1,1,'sql_query','{\"query\": \"SELECT COUNT(DISTINCT role) FROM project_assignments WHERE project_id = ? AND is_active = 1 AND role IN (\'pmc_head\',\'design_head\',\'services_head\',\'site_manager\')\"}',1,'2026-06-05 05:18:51','2026-06-05 05:18:51'),(2,1,'Client Details Complete','Verify client has GSTIN, PAN, and bank account for billing','core','principal',1,1,'field_populated','{\"table\": \"clients\", \"fields\": [\"gstin\", \"pan_number\", \"bank_account\", \"bank_ifsc\"]}',2,'2026-06-05 05:18:51','2026-06-05 05:18:51'),(3,1,'Internal BOQ Uploaded','Upload project materials BOQ with items, quantities, and units','boq','pmc_head',1,1,'row_count','{\"table\": \"boq_versions\", \"min_count\": 1}',10,'2026-06-05 05:18:51','2026-06-05 05:18:51'),(4,1,'BOQ Has Items','BOQ must contain at least 1 line item','boq','pmc_head',1,1,'row_count','{\"table\": \"boq_items\", \"min_count\": 1}',11,'2026-06-05 05:18:51','2026-06-05 05:18:51'),(5,1,'Client BOQ Uploaded','Upload client billing BOQ with package-level items and rates','boq','pmc_head',1,1,'row_count','{\"table\": \"client_boq_items\", \"min_count\": 1}',12,'2026-06-05 05:18:51','2026-06-05 05:18:51'),(6,1,'Vendors Cleared','At least 1 vendor must be cleared through finance','vendors','pmc_head',1,1,'sql_query','{\"query\": \"SELECT COUNT(*) FROM vendors WHERE clearance_status = \'approved\'\"}',20,'2026-06-05 05:18:51','2026-06-05 05:18:51'),(7,1,'Vendor Engagements Approved','At least 1 vendor engagement must be approved','vendors','principal',1,1,'sql_query','{\"query\": \"SELECT COUNT(*) FROM vendor_engagements WHERE project_id = ? AND approval_status = \'approved\'\"}',21,'2026-06-05 05:18:51','2026-06-05 05:18:51'),(8,1,'BOQ Vendor Mapping Complete','Map BOQ items to vendor engagements (required for payments)','vendors','pmc_head',1,1,'row_count','{\"table\": \"vendor_boq_mapping\", \"min_count\": 1}',22,'2026-06-05 05:18:51','2026-06-05 05:18:51'),(9,1,'Drawing Register Initialized (Design)','Initialize drawing register with design stream drawings','drawings','design_head',0,0,'sql_query','{\"query\": \"SELECT COUNT(*) FROM drawing_register WHERE project_id = ? AND stream = \'design\'\"}',30,'2026-06-05 05:18:51','2026-06-05 05:18:51'),(10,1,'Drawing Register Initialized (Services)','Initialize drawing register with services stream drawings','drawings','services_head',0,0,'sql_query','{\"query\": \"SELECT COUNT(*) FROM drawing_register WHERE project_id = ? AND stream = \'services\'\"}',31,'2026-06-05 05:18:51','2026-06-05 05:18:51'),(11,1,'R0 Schedule Baselined','Upload baseline schedule (version 1)','schedule','pmc_head',1,1,'sql_query','{\"query\": \"SELECT COUNT(*) FROM schedule_versions WHERE project_id = ? AND version_number = 1\"}',40,'2026-06-05 05:18:51','2026-06-05 05:18:51'),(12,1,'Schedule Has Tasks','Schedule must contain at least 1 task','schedule','pmc_head',1,1,'row_count','{\"table\": \"schedule_tasks\", \"min_count\": 1}',41,'2026-06-05 05:18:51','2026-06-05 05:18:51'),(13,1,'Budget Cost Heads Defined','Define budget cost heads for financial tracking (optional)','finance','finance_admin',0,0,'manual','{}',50,'2026-06-05 05:18:51','2026-06-05 05:18:51');
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `setup_checklist_templates`
--

LOCK TABLES `setup_checklist_templates` WRITE;
/*!40000 ALTER TABLE `setup_checklist_templates` DISABLE KEYS */;
INSERT INTO `setup_checklist_templates` VALUES (1,'Standard PMC Project','Default checklist for full PMC engagements with design, construction, and site supervision',1,1,'2026-06-05 05:18:51','2026-06-05 05:18:51');
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `signoff_instances`
--

LOCK TABLES `signoff_instances` WRITE;
/*!40000 ALTER TABLE `signoff_instances` DISABLE KEYS */;
INSERT INTO `signoff_instances` VALUES (1,'vendor_bank_vendor_confirm',1,NULL,NULL,NULL,32,'[]','[4]','Test Civil Contractor ΓÇö new vendor bank details added. Please confirm this is correct.','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-06 13:33:51',NULL,1,'2026-06-03 13:33:51','2026-06-06 09:37:06',NULL),(2,'vendor_onboarding',4,NULL,NULL,NULL,35,'[1]','[20, 1]','New vendor ΓÇö Test Civil Contractor (Civil) ΓÇö initiated by Test Principal. Approve onboarding?','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-05 13:33:51',NULL,1,'2026-06-03 13:33:51','2026-06-06 09:37:06',NULL),(3,'vendor_bank_vendor_confirm',2,NULL,NULL,NULL,24,'[]','[5]','Test Structural Pvt Ltd ΓÇö new vendor bank details added. Please confirm this is correct.','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-06 13:33:51',NULL,1,'2026-06-03 13:33:51','2026-06-06 09:37:06',NULL),(4,'vendor_onboarding',5,NULL,NULL,NULL,35,'[1]','[20, 1]','New vendor ΓÇö Test Structural Pvt Ltd (Structural) ΓÇö initiated by Test Principal. Approve onboarding?','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-05 13:33:51',NULL,1,'2026-06-03 13:33:51','2026-06-06 09:37:06',NULL),(5,'vendor_bank_vendor_confirm',3,NULL,NULL,NULL,26,'[]','[6]','Test MEP Solutions ΓÇö new vendor bank details added. Please confirm this is correct.','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-06 13:33:51',NULL,1,'2026-06-03 13:33:51','2026-06-06 09:37:06',NULL),(6,'vendor_onboarding',6,NULL,NULL,NULL,35,'[1]','[20, 1]','New vendor ΓÇö Test MEP Solutions (HVAC) ΓÇö initiated by Test Principal. Approve onboarding?','[{\"id\": \"yes\", \"text\": \"Γ£à Approve\"}, {\"id\": \"no\", \"text\": \"Γ¥î Reject\"}]','in_progress','2026-06-05 13:33:51',NULL,1,'2026-06-03 13:33:51','2026-06-06 09:37:06',NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_updates`
--

LOCK TABLES `task_updates` WRITE;
/*!40000 ALTER TABLE `task_updates` DISABLE KEYS */;
INSERT INTO `task_updates` VALUES (1,12,1,'2026-06-03',0,NULL,0,NULL,39,'2026-06-03 13:49:38',NULL),(4,11,1,'2026-06-03',70,NULL,0,NULL,39,'2026-06-03 18:43:33',NULL),(9,2,1,'2026-06-04',0,NULL,1,'Auto-flagged: 100.0% behind plan',32,'2026-06-04 13:34:14',NULL),(10,4,1,'2026-06-04',0,NULL,1,'Auto-flagged: 100.0% behind plan',32,'2026-06-04 13:34:14',NULL),(11,5,1,'2026-06-04',0,NULL,1,'Auto-flagged: 100.0% behind plan',32,'2026-06-04 13:34:14',NULL),(12,6,1,'2026-06-04',0,NULL,1,'Auto-flagged: 100.0% behind plan',32,'2026-06-04 13:34:14',NULL),(13,8,1,'2026-06-04',0,NULL,1,'Auto-flagged: 100.0% behind plan',32,'2026-06-04 13:34:14',NULL);
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
  `role` enum('principal','design_principal','design_head','services_head','pmc_head','detailing_head','team_lead','jr_architect','detailing','services_engineer','coordinator','site_manager','senior_site_manager','finance_admin','trainee','audit','it_admin') COLLATE utf8mb4_general_ci NOT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'naveen','$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','Naveen Kumar Bhat','principal','all',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),(2,'ajay','$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','Ajay Appachu','design_principal','all',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:13','2026-04-22 17:25:13'),(21,'audit','$2a$10$8NkaWss83QE2iJy8x6P21u4wuwBpeLtm1XS2mRGGzRf8J6D2E/RCi','Audit Account','audit','all',NULL,NULL,NULL,NULL,1,1,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:18','2026-04-22 17:25:18'),(24,'design_head','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Design Head','design_head','design',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(25,'team_lead','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Team Lead','team_lead','design',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(26,'services_head','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Services Head','services_head','services',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(27,'detailing_head','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Detailing Head','detailing_head','design',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(28,'jr_architect','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Junior Architect','jr_architect','design',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(29,'detailing','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Detailing','detailing','design',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(30,'services_eng','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Services Eng','services_engineer','services',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(31,'coordinator','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Coordinator','coordinator','pmc',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(32,'pmc_head','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','PMC Head','pmc_head','pmc',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(33,'site_manager','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Site Manager','site_manager','site',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(34,'sr_site_manager','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Sr Site Manager','senior_site_manager','site',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(35,'finance_admin','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Finance Admin','finance_admin','pmc',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(36,'trainee','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','Trainee','trainee','all',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(38,'it_admin','$2a$10$IUj8O7gwV8E3ESTJ906U3e1JPzttDma7vZ82C3FDkrqMLqkZe57pa','IT Admin','it_admin','all',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-04-22 17:25:19','2026-06-06 09:44:15'),(39,'user1','$2a$12$WR1J/znsNn5M64XBVHCfOOcV.U4BbdLXzZCLr/D5fp2CcaKixS0W.','Dev Tester','principal','all',NULL,NULL,NULL,NULL,1,0,0,NULL,NULL,NULL,NULL,NULL,1,'2026-06-02 17:42:24','2026-06-02 17:42:24');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_bank_change_approvals`
--

LOCK TABLES `vendor_bank_change_approvals` WRITE;
/*!40000 ALTER TABLE `vendor_bank_change_approvals` DISABLE KEYS */;
INSERT INTO `vendor_bank_change_approvals` VALUES (1,1,4,'pending',1,'principal','2026-06-03 13:33:51','New vendor ΓÇö initial bank details require dual approval',NULL,NULL,NULL,NULL,'10001000000001','SBIN0001234',NULL,NULL,NULL,NULL,NULL),(2,1,5,'pending',1,'principal','2026-06-03 13:33:51','New vendor ΓÇö initial bank details require dual approval',NULL,NULL,NULL,NULL,'10001000000002','HDFC0001234',NULL,NULL,NULL,NULL,NULL),(3,1,6,'pending',1,'principal','2026-06-03 13:33:51','New vendor ΓÇö initial bank details require dual approval',NULL,NULL,NULL,NULL,'10001000000003','ICIC0001234',NULL,NULL,NULL,NULL,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_engagements`
--

LOCK TABLES `vendor_engagements` WRITE;
/*!40000 ALTER TABLE `vendor_engagements` DISABLE KEYS */;
INSERT INTO `vendor_engagements` VALUES (1,1,1,'Civil & Structural Works',4500000.00,'active',NULL,NULL,1,'approved',1,'2026-04-22 17:25:19',NULL,1,NULL,'2026-04-22 17:25:19'),(2,2,1,'Electrical Installation',3200000.00,'active',NULL,NULL,1,'approved',1,'2026-04-22 17:25:19',NULL,1,NULL,'2026-04-22 17:25:19'),(3,3,1,'HVAC Systems',2800000.00,'not_started',NULL,NULL,1,'approved',1,'2026-04-22 17:25:19',NULL,1,NULL,'2026-04-22 17:25:19');
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (1,'Civil','BlueStone Constructions','Ravi K','+919900010001','29ABCDE1234F1Z1','HDFC Bank','50100012345678','HDFC0001234',1,'ABCDE1234F',1,NULL,NULL,1,NULL,'pending',NULL,NULL,NULL,NULL,1,NULL,'2026-04-22 17:25:19',0,NULL,NULL,NULL,NULL,'not_invited'),(2,'Electrical','VoltEdge Systems','Suresh M','+919900010002','29FGHIJ5678K2Z2','ICICI Bank','001701012345','ICIC0000017',1,'FGHIJ5678K',1,NULL,NULL,1,NULL,'pending',NULL,NULL,NULL,NULL,1,NULL,'2026-04-22 17:25:19',0,NULL,NULL,NULL,NULL,'not_invited'),(3,'HVAC','CoolAir Mechanical','Praveen N','+919900010003','29LMNOP9012Q3Z3','SBI','30012345678','SBIN0001234',1,'LMNOP9012Q',1,NULL,NULL,1,NULL,'pending',NULL,NULL,NULL,NULL,1,NULL,'2026-04-22 17:25:19',0,NULL,NULL,NULL,NULL,'not_invited'),(4,'Civil','Test Civil Contractor',NULL,'919000000010',NULL,NULL,'10001000000001','SBIN0001234',1,NULL,0,NULL,NULL,0,NULL,'pending',NULL,NULL,NULL,NULL,1,NULL,'2026-06-03 13:33:51',0,NULL,NULL,NULL,NULL,'not_invited'),(5,'Structural','Test Structural Pvt Ltd',NULL,'919000000010',NULL,NULL,'10001000000002','HDFC0001234',1,NULL,0,NULL,NULL,0,NULL,'pending',NULL,NULL,NULL,NULL,1,NULL,'2026-06-03 13:33:51',0,NULL,NULL,NULL,NULL,'not_invited'),(6,'HVAC','Test MEP Solutions',NULL,'919000000010',NULL,NULL,'10001000000003','ICIC0001234',1,NULL,0,NULL,NULL,0,NULL,'pending',NULL,NULL,NULL,NULL,1,NULL,'2026-06-03 13:33:51',0,NULL,NULL,NULL,NULL,'not_invited');
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
  KEY `user_id` (`user_id`),
  KEY `idx_wa_pending_actions_proj_status` (`project_id`,`status`),
  CONSTRAINT `wa_pending_actions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `wa_pending_actions_ibfk_2` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `whatsapp_notifications`
--

LOCK TABLES `whatsapp_notifications` WRITE;
/*!40000 ALTER TABLE `whatsapp_notifications` DISABLE KEYS */;
INSERT INTO `whatsapp_notifications` VALUES (1,32,'919000000002','user_activated','nu PMC account activated.\nUsername: test_pmc\nTemporary password: NuPMC@2026\nYou will be asked to change it on first login.','sent','2026-06-03 13:33:51',NULL,NULL,'2026-06-03 13:33:50'),(2,33,'919000000003','user_activated','nu PMC account activated.\nUsername: test_site\nTemporary password: NuPMC@2026\nYou will be asked to change it on first login.','sent','2026-06-03 13:33:51',NULL,NULL,'2026-06-03 13:33:50'),(3,35,'919000000004','user_activated','nu PMC account activated.\nUsername: test_finance\nTemporary password: NuPMC@2026\nYou will be asked to change it on first login.','sent','2026-06-03 13:33:51',NULL,NULL,'2026-06-03 13:33:51'),(4,35,'919000000004','vendor_pending_clearance','Test Civil Contractor added by Test Principal ΓÇö pending finance clearance.','sent','2026-06-03 13:33:51',NULL,NULL,'2026-06-03 13:33:51'),(5,32,'919000000002','vendor_pending_clearance','Test Civil Contractor added by Test Principal ΓÇö pending finance clearance.','sent','2026-06-03 13:33:51',NULL,NULL,'2026-06-03 13:33:51'),(6,35,'919000000004','vendor_pending_clearance','Test Structural Pvt Ltd added by Test Principal ΓÇö pending finance clearance.','sent','2026-06-03 13:33:51',NULL,NULL,'2026-06-03 13:33:51'),(7,32,'919000000002','vendor_pending_clearance','Test Structural Pvt Ltd added by Test Principal ΓÇö pending finance clearance.','sent','2026-06-03 13:33:51',NULL,NULL,'2026-06-03 13:33:51'),(8,35,'919000000004','vendor_pending_clearance','Test MEP Solutions added by Test Principal ΓÇö pending finance clearance.','sent','2026-06-03 13:33:51',NULL,NULL,'2026-06-03 13:33:51'),(9,32,'919000000002','vendor_pending_clearance','Test MEP Solutions added by Test Principal ΓÇö pending finance clearance.','sent','2026-06-03 13:33:51',NULL,NULL,'2026-06-03 13:33:51'),(10,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:08:18'),(11,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:08:18'),(12,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:08:18'),(13,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:08:18'),(14,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:23:18'),(15,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:23:18'),(16,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:23:18'),(17,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:23:18'),(18,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:38:18'),(19,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:38:18'),(20,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:38:18'),(21,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:38:18'),(22,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:53:18'),(23,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:53:18'),(24,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:53:18'),(25,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-03 21:53:18'),(26,32,NULL,'schedule_risk','CRITICAL: PV 90 Production Line ΓÇö Civil is 100.0% behind plan. Civil is 100.0% behind plan. Forecast delay: 10.2 weeks. (AI narrative pending batch processing)','pending',NULL,NULL,NULL,'2026-06-04 13:34:14'),(27,32,NULL,'schedule_risk','CRITICAL: PV 90 Production Line ΓÇö Civil is 100.0% behind plan. Civil is 100.0% behind plan. Forecast delay: 10.2 weeks. (AI narrative pending batch processing)','pending',NULL,NULL,NULL,'2026-06-04 13:34:14'),(28,32,NULL,'schedule_risk','CRITICAL: PV 90 Production Line ΓÇö Electrical is 100.0% behind plan. Electrical is 100.0% behind plan. Forecast delay: 10.2 weeks. (AI narrative pending batch processing)','pending',NULL,NULL,NULL,'2026-06-04 13:34:14'),(29,32,NULL,'schedule_risk','CRITICAL: PV 90 Production Line ΓÇö Electrical is 100.0% behind plan. Electrical is 100.0% behind plan. Forecast delay: 10.2 weeks. (AI narrative pending batch processing)','pending',NULL,NULL,NULL,'2026-06-04 13:34:14'),(30,32,NULL,'schedule_risk','CRITICAL: PV 90 Production Line ΓÇö HVAC is 100.0% behind plan. HVAC is 100.0% behind plan. Forecast delay: 10.2 weeks. (AI narrative pending batch processing)','pending',NULL,NULL,NULL,'2026-06-04 13:34:14'),(31,32,NULL,'schedule_risk','CRITICAL: PV 90 Production Line ΓÇö HVAC is 100.0% behind plan. HVAC is 100.0% behind plan. Forecast delay: 10.2 weeks. (AI narrative pending batch processing)','pending',NULL,NULL,NULL,'2026-06-04 13:34:14'),(32,24,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:00:04'),(33,24,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:00:04'),(34,26,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:00:04'),(35,26,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:00:04'),(36,24,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:15:04'),(37,24,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:15:04'),(38,26,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:15:04'),(39,26,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:15:04'),(40,24,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:30:04'),(41,24,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:30:04'),(42,26,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:30:04'),(43,26,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:30:04'),(44,24,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:45:04'),(45,24,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:45:04'),(46,26,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:45:04'),(47,26,NULL,'weekly_digest','nu PMC - Weekly Digest\nPV 90 Production Line\n\n4 issues open\n\nOpen app for full detail.','pending',NULL,NULL,NULL,'2026-06-05 18:45:04'),(48,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:00:04'),(49,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:00:04'),(50,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:00:04'),(51,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:00:04'),(52,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:15:04'),(53,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:15:04'),(54,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:15:04'),(55,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:15:04'),(56,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:30:04'),(57,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:30:04'),(58,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:30:04'),(59,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:30:04'),(60,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:45:04'),(61,24,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:45:04'),(62,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:45:04'),(63,26,NULL,'pending_items','nu PMC: 2 drawings to approve, 0 queries pending.','pending',NULL,NULL,NULL,'2026-06-05 21:45:04');
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
) ENGINE=InnoDB AUTO_INCREMENT=102 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_transitions`
--

LOCK TABLES `workflow_transitions` WRITE;
/*!40000 ALTER TABLE `workflow_transitions` DISABLE KEYS */;
INSERT INTO `workflow_transitions` VALUES (1,'claims','draft','pmc_signed','PMC Head or Principal','Reviews draft claim and signs off',0,1,'2026-06-05 09:46:47'),(2,'claims','pmc_signed','stream_signed','Design Head or Services Head','Stream head reviews and signs',0,2,'2026-06-05 09:46:47'),(3,'claims','stream_signed','approved','Principal','Principal gives final approval',0,3,'2026-06-05 09:46:47'),(4,'claims','approved','invoiced','PMC Head or Principal','Records invoice number ΓÇö claim becomes a live invoice',0,4,'2026-06-05 09:46:47'),(5,'measurements','draft','rs_signed','Design Head or Services Head','Stream head reviews and signs',0,1,'2026-06-05 09:46:47'),(6,'measurements','rs_signed','client_accepted','PMC Head or Principal','Records client formal acceptance ΓÇö signed certificate uploaded',0,2,'2026-06-05 09:46:47'),(7,'snags','open','rectified','Site Mgr, Sr Site Mgr, PMC Head or Principal','Marks snag rectified once vendor has fixed it',0,1,'2026-06-05 09:46:47'),(8,'snags','rectified','closed','PMC Head, Design Head, Services Head or Principal','Verifies fix on site and closes snag',0,2,'2026-06-05 09:46:47'),(9,'snags','open','closed','PMC Head, Design Head, Services Head or Principal','Minor snags closed directly without rectified step',1,3,'2026-06-05 09:46:47'),(10,'weekly_reports','draft','pending_review','PMC, Design, Services Heads','Each head signs their section. All three signed ΓåÆ moves automatically.',0,1,'2026-06-05 09:46:47'),(11,'weekly_reports','pending_review','approved','Principal','Principal approves the report',0,2,'2026-06-05 09:46:47'),(12,'weekly_reports','approved','sent','Principal','Marks report as sent to client (timestamp + audit)',0,3,'2026-06-05 09:46:47'),(13,'payment_requests','pending_pmc','pmc_approved','PMC Head or Principal','PMC reviews and approves',0,1,'2026-06-05 09:46:47'),(14,'payment_requests','pmc_approved','pending_principal','system','Above threshold ├óΓé¼ΓÇ¥ to Principal',0,2,'2026-04-22 17:25:19'),(15,'payment_requests','pmc_approved','principal_approved','system','Below threshold ├óΓé¼ΓÇ¥ auto-approved',0,3,'2026-04-22 17:25:19'),(16,'payment_requests','pending_principal','principal_approved','principal,design_principal','Principal approves',0,4,'2026-04-22 17:25:19'),(17,'payment_requests','pending_principal','principal_rejected','principal,design_principal','Principal rejects',1,5,'2026-04-22 17:25:19'),(18,'payment_requests','principal_approved','paid','principal,design_principal,finance_admin','Payment released',0,6,'2026-04-22 17:25:19'),(19,'issues','open','in_progress','Assignee','Starts working on it',0,1,'2026-06-05 09:46:47'),(20,'issues','in_progress','resolved','Assignee','Marks it resolved',0,2,'2026-06-05 09:46:47'),(21,'issues','resolved','closed','PMC Head, Design/Services Head or Principal','Verifies and closes',0,3,'2026-06-05 09:46:47'),(22,'issues','open','closed','PMC Head, Design/Services Head or Principal','Direct close for minor issues',1,4,'2026-06-05 09:46:47'),(23,'change_notices','draft','pending_approval','PMC, Design, Services Heads + Principal','Stream heads sign the change notice',0,1,'2026-06-05 09:46:47'),(24,'change_notices','pending_approval','approved','Principal','Principal approves',0,2,'2026-06-05 09:46:47'),(25,'change_notices','pending_approval','rejected','Principal','Principal rejects ΓÇö change not recorded as approved',1,3,'2026-06-05 09:46:47'),(26,'drawings','uploaded','issued','principal,design_principal,design_head,services_head','Approve and issue',0,1,'2026-04-22 17:25:19'),(27,'drawings','issued','superseded','Design Head or Principal','Newer revision issued ΓÇö old one locked',1,2,'2026-06-05 09:46:47'),(28,'drawings','uploaded','rejected','principal,design_principal,design_head,services_head','Reject with comments',1,3,'2026-04-22 17:25:19'),(29,'submittals','submitted','under_review','Design Head, Services Head or Principal','Starts reviewing',0,1,'2026-06-05 09:46:47'),(30,'submittals','under_review','approved','Design Head, Services Head or Principal','Approves (clean or comments)',0,2,'2026-06-05 09:46:47'),(31,'submittals','under_review','resubmit_required','Design Head, Services Head or Principal','Revisions needed ΓÇö vendor resubmits',1,3,'2026-06-05 09:46:47'),(32,'submittals','under_review','rejected','Design Head, Services Head or Principal','Rejected outright',1,4,'2026-06-05 09:46:47'),(33,'submittals','resubmit_required','submitted','Site Manager or Coordinator','Vendor resubmits revised submittal',1,5,'2026-06-05 09:46:47'),(81,'payment_requests','pmc_approved','pending_naveen','System (automatic)','Below threshold ΓåÆ auto-approved. Above ΓåÆ goes to Principal.',0,2,'2026-06-05 09:46:47'),(82,'payment_requests','pending_naveen','approved','Principal','Principal approves or rejects',0,3,'2026-06-05 09:46:47'),(83,'payment_requests','approved','paid','Finance Admin or Principal','Payment released; UTR recorded',0,4,'2026-06-05 09:46:47'),(84,'payment_requests','pending_naveen','rejected','Principal','Rejected ΓÇö raiser and PMC reviewer both notified via WhatsApp',1,15,'2026-06-05 09:46:47'),(85,'payment_requests','approved','cleared','Finance Admin','ICICI batch file processed ΓÇö status moves to cleared then paid',1,16,'2026-06-05 09:46:47'),(93,'drawings','uploaded','under_review','Design Head, Services Head or Principal','Starts review (L1 or direct to L2)',0,1,'2026-06-05 09:46:47'),(94,'drawings','under_review','issued','Design Head, Services Head or Principal','Approves and issues to site',0,2,'2026-06-05 09:46:47'),(95,'drawings','under_review','rejected','Design Head, Services Head or Principal','Revision required ΓÇö sent back with comments',1,13,'2026-06-05 09:46:47');
/*!40000 ALTER TABLE `workflow_transitions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Final view structure for view `current_pmc_assignments`
--

/*!50001 DROP VIEW IF EXISTS `current_pmc_assignments`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
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

-- Dump completed on 2026-06-08 13:52:02
