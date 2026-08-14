CREATE TABLE `tool_execution_leases` (
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
  CONSTRAINT `tool_execution_leases_tool_check` CHECK (`tool_name` IN ('text.sha256', 'text.analyze', 'json.validate', 'memory.retention')),
  CONSTRAINT `tool_execution_leases_status_check` CHECK (`status` IN ('active', 'revoked', 'depleted')),
  CONSTRAINT `tool_execution_leases_usage_check` CHECK (`max_uses` >= 1 AND `max_uses` <= 20 AND `remaining_uses` >= 0 AND `remaining_uses` <= `max_uses`),
  CONSTRAINT `tool_execution_leases_version_check` CHECK (`version` >= 1),
  CONSTRAINT `tool_execution_leases_state_check` CHECK ((`status` = 'active' AND `remaining_uses` > 0 AND `revoked_at` IS NULL) OR (`status` = 'revoked' AND `revoked_at` IS NOT NULL) OR (`status` = 'depleted' AND `remaining_uses` = 0 AND `revoked_at` IS NULL)),
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tool_execution_leases_user_status_expires_idx` ON `tool_execution_leases` (`user_id`,`status`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `tool_execution_leases_project_status_idx` ON `tool_execution_leases` (`project_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tool_execution_leases_last_event_idx` ON `tool_execution_leases` (`last_event_id`);
--> statement-breakpoint
CREATE TABLE `tool_jobs` (
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
  CONSTRAINT `tool_jobs_tool_check` CHECK (`tool_name` IN ('text.sha256', 'text.analyze', 'json.validate', 'memory.retention')),
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
CREATE UNIQUE INDEX `tool_jobs_user_idempotency_idx` ON `tool_jobs` (`user_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `tool_jobs_user_status_available_idx` ON `tool_jobs` (`user_id`,`status`,`available_at`);
--> statement-breakpoint
CREATE INDEX `tool_jobs_project_created_idx` ON `tool_jobs` (`project_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `tool_jobs_lease_created_idx` ON `tool_jobs` (`lease_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `tool_execution_lease_events` (
  `id` text PRIMARY KEY NOT NULL,
  `lease_id` text NOT NULL,
  `job_id` text,
  `user_id` text NOT NULL,
  `event_type` text NOT NULL,
  `lease_version` integer NOT NULL,
  `remaining_uses` integer NOT NULL,
  `created_at` text NOT NULL,
  CONSTRAINT `tool_execution_lease_events_type_check` CHECK (`event_type` IN ('created', 'consumed', 'revoked')),
  CONSTRAINT `tool_execution_lease_events_version_check` CHECK (`lease_version` >= 1),
  CONSTRAINT `tool_execution_lease_events_remaining_check` CHECK (`remaining_uses` >= 0),
  FOREIGN KEY (`lease_id`) REFERENCES `tool_execution_leases`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`job_id`) REFERENCES `tool_jobs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tool_execution_lease_events_lease_created_idx` ON `tool_execution_lease_events` (`lease_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `tool_execution_lease_events_user_created_idx` ON `tool_execution_lease_events` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `tool_execution_lease_events_job_idx` ON `tool_execution_lease_events` (`job_id`);
--> statement-breakpoint
CREATE TABLE `tool_job_events` (
  `id` text PRIMARY KEY NOT NULL,
  `job_id` text NOT NULL,
  `user_id` text NOT NULL,
  `event_type` text NOT NULL,
  `job_version` integer NOT NULL,
  `attempt` integer NOT NULL,
  `progress_percent` integer NOT NULL,
  `note` text,
  `created_at` text NOT NULL,
  CONSTRAINT `tool_job_events_type_check` CHECK (`event_type` IN ('created', 'claimed', 'progress', 'succeeded', 'failed', 'requeued', 'cancelled', 'recovered')),
  CONSTRAINT `tool_job_events_version_check` CHECK (`job_version` >= 1),
  CONSTRAINT `tool_job_events_attempt_check` CHECK (`attempt` >= 0),
  CONSTRAINT `tool_job_events_progress_check` CHECK (`progress_percent` >= 0 AND `progress_percent` <= 100),
  FOREIGN KEY (`job_id`) REFERENCES `tool_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tool_job_events_job_created_idx` ON `tool_job_events` (`job_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `tool_job_events_user_created_idx` ON `tool_job_events` (`user_id`,`created_at`);
