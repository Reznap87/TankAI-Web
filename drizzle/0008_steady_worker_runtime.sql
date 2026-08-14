PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `worker_agents` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `name` text NOT NULL,
  `status` text NOT NULL,
  `token_sha256` text NOT NULL,
  `max_concurrency` integer DEFAULT 1 NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `last_seen_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `revoked_at` text,
  CONSTRAINT `worker_agents_status_check` CHECK (`status` IN ('active', 'draining', 'revoked')),
  CONSTRAINT `worker_agents_name_check` CHECK (length(`name`) >= 1 AND length(`name`) <= 80),
  CONSTRAINT `worker_agents_token_hash_check` CHECK (length(`token_sha256`) = 64 AND `token_sha256` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `worker_agents_concurrency_check` CHECK (`max_concurrency` >= 1 AND `max_concurrency` <= 4),
  CONSTRAINT `worker_agents_version_check` CHECK (`version` >= 1),
  CONSTRAINT `worker_agents_state_check` CHECK ((`status` IN ('active', 'draining') AND `revoked_at` IS NULL) OR (`status` = 'revoked' AND `revoked_at` IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `worker_agents_token_sha256_idx` ON `worker_agents` (`token_sha256`);
--> statement-breakpoint
CREATE INDEX `worker_agents_user_status_idx` ON `worker_agents` (`user_id`,`status`);
--> statement-breakpoint
CREATE TABLE `worker_agent_events` (
  `id` text PRIMARY KEY NOT NULL,
  `worker_id` text NOT NULL,
  `user_id` text NOT NULL,
  `event_type` text NOT NULL,
  `worker_version` integer NOT NULL,
  `note` text,
  `created_at` text NOT NULL,
  CONSTRAINT `worker_agent_events_type_check` CHECK (`event_type` IN ('registered', 'activated', 'draining', 'revoked')),
  CONSTRAINT `worker_agent_events_version_check` CHECK (`worker_version` >= 1),
  FOREIGN KEY (`worker_id`) REFERENCES `worker_agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `worker_agent_events_worker_created_idx` ON `worker_agent_events` (`worker_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `worker_agent_events_user_created_idx` ON `worker_agent_events` (`user_id`,`created_at`);
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
  `worker_id` text,
  `claim_token` text,
  `heartbeat_at` text,
  `claim_expires_at` text,
  `available_at` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `started_at` text,
  `completed_at` text,
  CONSTRAINT `tool_jobs_tool_check` CHECK (`tool_name` IN ('text.sha256', 'text.analyze', 'json.validate', 'memory.retention', 'web.fetch', 'project.document.inspect', 'code.patch.inspect')),
  CONSTRAINT `tool_jobs_status_check` CHECK (`status` IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'dead_letter')),
  CONSTRAINT `tool_jobs_progress_check` CHECK (`progress_percent` >= 0 AND `progress_percent` <= 100),
  CONSTRAINT `tool_jobs_attempt_check` CHECK (`attempt` >= 0 AND `max_attempts` >= 1 AND `max_attempts` <= 3 AND `attempt` <= `max_attempts`),
  CONSTRAINT `tool_jobs_version_check` CHECK (`version` >= 1),
  CONSTRAINT `tool_jobs_input_size_check` CHECK (length(CAST(`input_json` AS BLOB)) <= 24000),
  CONSTRAINT `tool_jobs_output_size_check` CHECK (`output_json` IS NULL OR length(CAST(`output_json` AS BLOB)) <= 48000),
  CONSTRAINT `tool_jobs_hash_check` CHECK (length(`input_sha256`) = 64 AND `input_sha256` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `tool_jobs_worker_claim_check` CHECK ((`worker_id` IS NULL AND `claim_expires_at` IS NULL) OR (`worker_id` IS NOT NULL AND `claim_expires_at` IS NOT NULL)),
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`lease_id`) REFERENCES `tool_execution_leases`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`worker_id`) REFERENCES `worker_agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_tool_jobs`
  (`id`, `user_id`, `project_id`, `lease_id`, `tool_name`, `status`,
   `input_json`, `input_sha256`, `output_json`, `error_code`, `error_message`,
   `progress_percent`, `attempt`, `max_attempts`, `version`, `worker_id`,
   `claim_token`, `heartbeat_at`, `claim_expires_at`, `available_at`,
   `idempotency_key`, `created_at`, `updated_at`, `started_at`, `completed_at`)
SELECT `id`, `user_id`, `project_id`, `lease_id`, `tool_name`, `status`,
       `input_json`, `input_sha256`, `output_json`, `error_code`, `error_message`,
       `progress_percent`, `attempt`, `max_attempts`, `version`, NULL,
       `claim_token`, `heartbeat_at`, NULL, `available_at`, `idempotency_key`,
       `created_at`, `updated_at`, `started_at`, `completed_at`
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
CREATE INDEX `tool_jobs_worker_status_expires_idx` ON `tool_jobs` (`worker_id`,`status`,`claim_expires_at`);
--> statement-breakpoint
CREATE TABLE `__new_tool_job_events` (
  `id` text PRIMARY KEY NOT NULL,
  `job_id` text NOT NULL,
  `user_id` text NOT NULL,
  `worker_id` text,
  `event_type` text NOT NULL,
  `job_version` integer NOT NULL,
  `attempt` integer NOT NULL,
  `progress_percent` integer NOT NULL,
  `note` text,
  `created_at` text NOT NULL,
  CONSTRAINT `tool_job_events_type_check` CHECK (`event_type` IN ('created', 'claimed', 'heartbeat', 'progress', 'succeeded', 'failed', 'requeued', 'retry_scheduled', 'cancelled', 'recovered', 'dead_letter')),
  CONSTRAINT `tool_job_events_version_check` CHECK (`job_version` >= 1),
  CONSTRAINT `tool_job_events_attempt_check` CHECK (`attempt` >= 0),
  CONSTRAINT `tool_job_events_progress_check` CHECK (`progress_percent` >= 0 AND `progress_percent` <= 100),
  FOREIGN KEY (`job_id`) REFERENCES `tool_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`worker_id`) REFERENCES `worker_agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_tool_job_events`
  (`id`, `job_id`, `user_id`, `worker_id`, `event_type`, `job_version`,
   `attempt`, `progress_percent`, `note`, `created_at`)
SELECT `id`, `job_id`, `user_id`, NULL, `event_type`, `job_version`,
       `attempt`, `progress_percent`, `note`, `created_at`
FROM `tool_job_events`;
--> statement-breakpoint
DROP TABLE `tool_job_events`;
--> statement-breakpoint
ALTER TABLE `__new_tool_job_events` RENAME TO `tool_job_events`;
--> statement-breakpoint
CREATE INDEX `tool_job_events_job_created_idx` ON `tool_job_events` (`job_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `tool_job_events_user_created_idx` ON `tool_job_events` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `tool_job_events_worker_created_idx` ON `tool_job_events` (`worker_id`,`created_at`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
