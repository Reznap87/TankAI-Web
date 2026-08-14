CREATE TABLE `deployment_release_configs` (
  `id` text PRIMARY KEY NOT NULL,
  `release_id` text NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `provider_id` text NOT NULL,
  `max_output_tokens` integer NOT NULL,
  `config_sha256` text NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`release_id`) REFERENCES `tankbench_releases`(`id`) ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  CONSTRAINT `deployment_release_configs_tokens_check` CHECK (`max_output_tokens` BETWEEN 64 AND 32768),
  CONSTRAINT `deployment_release_configs_hash_check` CHECK (length(`config_sha256`) = 64 AND `config_sha256` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `deployment_release_configs_version_check` CHECK (`version` >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deployment_release_configs_release_idx` ON `deployment_release_configs` (`release_id`);
--> statement-breakpoint
CREATE INDEX `deployment_release_configs_project_idx` ON `deployment_release_configs` (`user_id`,`project_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `deployment_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `release_id` text NOT NULL,
  `config_id` text NOT NULL,
  `provider_id` text NOT NULL,
  `routing_key_hash` text NOT NULL,
  `request_sha256` text NOT NULL,
  `response_sha256` text,
  `status` text NOT NULL,
  `latency_ms` integer NOT NULL,
  `error_code` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`release_id`) REFERENCES `tankbench_releases`(`id`) ON DELETE restrict,
  FOREIGN KEY (`config_id`) REFERENCES `deployment_release_configs`(`id`) ON DELETE restrict,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  CONSTRAINT `deployment_requests_status_check` CHECK (`status` IN ('succeeded','failed')),
  CONSTRAINT `deployment_requests_latency_check` CHECK (`latency_ms` BETWEEN 0 AND 120000),
  CONSTRAINT `deployment_requests_hashes_check` CHECK (length(`routing_key_hash`) = 64 AND length(`request_sha256`) = 64 AND (`response_sha256` IS NULL OR length(`response_sha256`) = 64)),
  CONSTRAINT `deployment_requests_terminal_check` CHECK ((`status`='succeeded' AND `response_sha256` IS NOT NULL AND `error_code` IS NULL) OR (`status`='failed' AND `response_sha256` IS NULL AND `error_code` IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `deployment_requests_release_created_idx` ON `deployment_requests` (`release_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `deployment_requests_project_created_idx` ON `deployment_requests` (`project_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `deployment_events` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `release_id` text NOT NULL,
  `event_type` text NOT NULL,
  `entity_version` integer NOT NULL,
  `note` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`release_id`) REFERENCES `tankbench_releases`(`id`) ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  CONSTRAINT `deployment_events_type_check` CHECK (`event_type` IN ('configured','reconfigured','request_succeeded','request_failed')),
  CONSTRAINT `deployment_events_version_check` CHECK (`entity_version` >= 1)
);
--> statement-breakpoint
CREATE INDEX `deployment_events_release_created_idx` ON `deployment_events` (`release_id`,`created_at`);
