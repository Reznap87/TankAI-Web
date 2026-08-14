ALTER TABLE `deployment_release_configs` ADD `fallback_provider_ids_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `deployment_release_configs` ADD `failure_threshold` integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
ALTER TABLE `deployment_release_configs` ADD `recovery_timeout_seconds` integer DEFAULT 60 NOT NULL;
--> statement-breakpoint
ALTER TABLE `deployment_release_configs` ADD `half_open_successes` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `deployment_requests` ADD `source` text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE `deployment_requests` ADD `attempt_count` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE TABLE `deployment_traffic_overrides` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `canary_release_id` text NOT NULL,
  `traffic_percent` integer NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  FOREIGN KEY (`canary_release_id`) REFERENCES `tankbench_releases`(`id`) ON DELETE cascade,
  CONSTRAINT `deployment_traffic_percent_check` CHECK (`traffic_percent` BETWEEN 0 AND 100),
  CONSTRAINT `deployment_traffic_enabled_check` CHECK (`enabled` IN (0,1)),
  CONSTRAINT `deployment_traffic_version_check` CHECK (`version` >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deployment_traffic_project_idx` ON `deployment_traffic_overrides` (`user_id`,`project_id`);
--> statement-breakpoint
CREATE INDEX `deployment_traffic_release_idx` ON `deployment_traffic_overrides` (`canary_release_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `deployment_circuit_breakers` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `release_id` text NOT NULL,
  `provider_id` text NOT NULL,
  `state` text DEFAULT 'closed' NOT NULL,
  `consecutive_failures` integer DEFAULT 0 NOT NULL,
  `half_open_success_count` integer DEFAULT 0 NOT NULL,
  `opened_at` text,
  `next_probe_at` text,
  `last_failure_at` text,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  FOREIGN KEY (`release_id`) REFERENCES `tankbench_releases`(`id`) ON DELETE cascade,
  CONSTRAINT `deployment_breaker_state_check` CHECK (`state` IN ('closed','open','half_open')),
  CONSTRAINT `deployment_breaker_failures_check` CHECK (`consecutive_failures` >= 0),
  CONSTRAINT `deployment_breaker_successes_check` CHECK (`half_open_success_count` >= 0),
  CONSTRAINT `deployment_breaker_version_check` CHECK (`version` >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deployment_breaker_release_provider_idx` ON `deployment_circuit_breakers` (`release_id`,`provider_id`);
--> statement-breakpoint
CREATE INDEX `deployment_breaker_project_state_idx` ON `deployment_circuit_breakers` (`user_id`,`project_id`,`state`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `deployment_request_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `release_id` text NOT NULL,
  `attempt_ordinal` integer NOT NULL,
  `provider_id` text NOT NULL,
  `status` text NOT NULL,
  `latency_ms` integer NOT NULL,
  `error_code` text,
  `response_sha256` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`request_id`) REFERENCES `deployment_requests`(`id`) ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  FOREIGN KEY (`release_id`) REFERENCES `tankbench_releases`(`id`) ON DELETE restrict,
  CONSTRAINT `deployment_attempt_ordinal_check` CHECK (`attempt_ordinal` BETWEEN 1 AND 4),
  CONSTRAINT `deployment_attempt_status_check` CHECK (`status` IN ('succeeded','failed','skipped_open','unavailable')),
  CONSTRAINT `deployment_attempt_latency_check` CHECK (`latency_ms` BETWEEN 0 AND 120000),
  CONSTRAINT `deployment_attempt_terminal_check` CHECK ((`status`='succeeded' AND `response_sha256` IS NOT NULL AND `error_code` IS NULL) OR (`status`<>'succeeded' AND `response_sha256` IS NULL AND `error_code` IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `deployment_attempts_request_idx` ON `deployment_request_attempts` (`request_id`,`attempt_ordinal`);
--> statement-breakpoint
CREATE INDEX `deployment_attempts_provider_created_idx` ON `deployment_request_attempts` (`provider_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `deployment_control_events` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `release_id` text,
  `provider_id` text,
  `event_type` text NOT NULL,
  `entity_version` integer NOT NULL,
  `note` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  FOREIGN KEY (`release_id`) REFERENCES `tankbench_releases`(`id`) ON DELETE cascade,
  CONSTRAINT `deployment_control_event_type_check` CHECK (`event_type` IN ('traffic_shifted','traffic_automatic','breaker_opened','breaker_half_opened','breaker_closed','breaker_reset','fallback_used')),
  CONSTRAINT `deployment_control_event_version_check` CHECK (`entity_version` >= 1)
);
--> statement-breakpoint
CREATE INDEX `deployment_control_events_project_created_idx` ON `deployment_control_events` (`user_id`,`project_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `deployment_control_events_release_created_idx` ON `deployment_control_events` (`release_id`,`created_at`);
