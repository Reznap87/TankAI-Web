PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_tool_execution_leases` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text,
  `scope_kind` text NOT NULL,
  `tool_name` text NOT NULL,
  `status` text NOT NULL,
  `max_uses` integer NOT NULL,
  `remaining_uses` integer NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `expires_at` text NOT NULL,
  `last_event_id` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `last_used_at` text,
  `revoked_at` text,
  CONSTRAINT `tool_execution_leases_scope_check` CHECK ((`scope_kind` = 'account' AND `project_id` IS NULL) OR (`scope_kind` = 'project' AND `project_id` IS NOT NULL)),
  CONSTRAINT `tool_execution_leases_tool_check` CHECK (`tool_name` IN ('text.sha256', 'text.analyze', 'json.validate', 'memory.retention', 'web.fetch', 'project.document.inspect', 'code.patch.inspect')),
  CONSTRAINT `tool_execution_leases_status_check` CHECK (`status` IN ('active', 'revoked', 'depleted')),
  CONSTRAINT `tool_execution_leases_usage_check` CHECK (`max_uses` >= 1 AND `max_uses` <= 20 AND `remaining_uses` >= 0 AND `remaining_uses` <= `max_uses`),
  CONSTRAINT `tool_execution_leases_version_check` CHECK (`version` >= 1),
  CONSTRAINT `tool_execution_leases_state_check` CHECK ((`status` = 'active' AND `remaining_uses` > 0 AND `revoked_at` IS NULL) OR (`status` = 'revoked' AND `revoked_at` IS NOT NULL) OR (`status` = 'depleted' AND `remaining_uses` = 0 AND `revoked_at` IS NULL)),
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tool_execution_leases`
  (`id`, `user_id`, `project_id`, `scope_kind`, `tool_name`, `status`,
   `max_uses`, `remaining_uses`, `version`, `expires_at`, `last_event_id`,
   `created_at`, `updated_at`, `last_used_at`, `revoked_at`)
SELECT `id`, `user_id`, `project_id`, `scope_kind`, `tool_name`, `status`,
       `max_uses`, `remaining_uses`, `version`, `expires_at`, `last_event_id`,
       `created_at`, `updated_at`, `last_used_at`, `revoked_at`
FROM `tool_execution_leases`;
--> statement-breakpoint
DROP TABLE `tool_execution_leases`;
--> statement-breakpoint
ALTER TABLE `__new_tool_execution_leases` RENAME TO `tool_execution_leases`;
--> statement-breakpoint
CREATE INDEX `tool_execution_leases_user_status_expires_idx` ON `tool_execution_leases` (`user_id`,`status`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `tool_execution_leases_project_status_idx` ON `tool_execution_leases` (`project_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tool_execution_leases_last_event_idx` ON `tool_execution_leases` (`last_event_id`);
--> statement-breakpoint
CREATE TABLE `__new_tool_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text,
  `lease_id` text NOT NULL,
  `tool_name` text NOT NULL,
  `status` text NOT NULL,
  `input_json` text NOT NULL,
  `input_sha256` text NOT NULL,
  `output_json` text,
  `error_code` text,
  `error_message` text,
  `progress_percent` integer DEFAULT 0 NOT NULL,
  `attempt` integer DEFAULT 0 NOT NULL,
  `max_attempts` integer DEFAULT 1 NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `claim_token` text,
  `heartbeat_at` text,
  `available_at` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `started_at` text,
  `completed_at` text,
  CONSTRAINT `tool_jobs_tool_check` CHECK (`tool_name` IN ('text.sha256', 'text.analyze', 'json.validate', 'memory.retention', 'web.fetch', 'project.document.inspect', 'code.patch.inspect')),
  CONSTRAINT `tool_jobs_status_check` CHECK (`status` IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT `tool_jobs_progress_check` CHECK (`progress_percent` >= 0 AND `progress_percent` <= 100),
  CONSTRAINT `tool_jobs_attempt_check` CHECK (`attempt` >= 0 AND `max_attempts` >= 1 AND `max_attempts` <= 3 AND `attempt` <= `max_attempts`),
  CONSTRAINT `tool_jobs_version_check` CHECK (`version` >= 1),
  CONSTRAINT `tool_jobs_input_size_check` CHECK (length(CAST(`input_json` AS BLOB)) <= 24000),
  CONSTRAINT `tool_jobs_output_size_check` CHECK (`output_json` IS NULL OR length(CAST(`output_json` AS BLOB)) <= 48000),
  CONSTRAINT `tool_jobs_hash_check` CHECK (length(`input_sha256`) = 64 AND `input_sha256` NOT GLOB '*[^0-9a-f]*'),
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`lease_id`) REFERENCES `tool_execution_leases`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_tool_jobs`
  (`id`, `user_id`, `project_id`, `lease_id`, `tool_name`, `status`,
   `input_json`, `input_sha256`, `output_json`, `error_code`, `error_message`,
   `progress_percent`, `attempt`, `max_attempts`, `version`, `claim_token`,
   `heartbeat_at`, `available_at`, `idempotency_key`, `created_at`, `updated_at`,
   `started_at`, `completed_at`)
SELECT `id`, `user_id`, `project_id`, `lease_id`, `tool_name`, `status`,
       `input_json`, `input_sha256`, `output_json`, `error_code`, `error_message`,
       `progress_percent`, `attempt`, `max_attempts`, `version`, `claim_token`,
       `heartbeat_at`, `available_at`, `idempotency_key`, `created_at`, `updated_at`,
       `started_at`, `completed_at`
FROM `tool_jobs`;
--> statement-breakpoint
DROP TABLE `tool_jobs`;
--> statement-breakpoint
ALTER TABLE `__new_tool_jobs` RENAME TO `tool_jobs`;
--> statement-breakpoint
CREATE UNIQUE INDEX `tool_jobs_user_idempotency_idx` ON `tool_jobs` (`user_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `tool_jobs_user_status_available_idx` ON `tool_jobs` (`user_id`,`status`,`available_at`);
--> statement-breakpoint
CREATE INDEX `tool_jobs_project_created_idx` ON `tool_jobs` (`project_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `tool_jobs_lease_created_idx` ON `tool_jobs` (`lease_id`,`created_at`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
