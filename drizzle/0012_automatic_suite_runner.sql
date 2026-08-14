CREATE TABLE `tankbench_suite_executions` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `baseline_capability_lease_id` text NOT NULL,
  `candidate_capability_lease_id` text NOT NULL,
  `status` text NOT NULL,
  `cursor_ordinal` integer DEFAULT 0 NOT NULL,
  `completed_items` integer DEFAULT 0 NOT NULL,
  `total_items` integer NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `completed_at` text,
  FOREIGN KEY (`run_id`) REFERENCES `tankbench_runs`(`id`) ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  FOREIGN KEY (`baseline_capability_lease_id`) REFERENCES `capability_leases`(`id`) ON DELETE restrict,
  FOREIGN KEY (`candidate_capability_lease_id`) REFERENCES `capability_leases`(`id`) ON DELETE restrict,
  CONSTRAINT `tankbench_suite_executions_status_check` CHECK (`status` IN ('queued','running','waiting','completed','failed','cancelled')),
  CONSTRAINT `tankbench_suite_executions_counts_check` CHECK (`cursor_ordinal` >= 0 AND `completed_items` >= 0 AND `total_items` BETWEEN 2 AND 400 AND `completed_items` <= `total_items`),
  CONSTRAINT `tankbench_suite_executions_version_check` CHECK (`version` >= 1),
  CONSTRAINT `tankbench_suite_executions_terminal_check` CHECK ((`status` IN ('completed','failed','cancelled') AND `completed_at` IS NOT NULL) OR (`status` IN ('queued','running','waiting') AND `completed_at` IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tankbench_suite_executions_run_idx` ON `tankbench_suite_executions` (`run_id`);
--> statement-breakpoint
CREATE INDEX `tankbench_suite_executions_user_status_idx` ON `tankbench_suite_executions` (`user_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `tankbench_suite_execution_items` (
  `id` text PRIMARY KEY NOT NULL,
  `execution_id` text NOT NULL,
  `case_id` text NOT NULL,
  `variant` text NOT NULL,
  `ordinal` integer NOT NULL,
  `status` text NOT NULL,
  `commander_run_id` text,
  `error_code` text,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `completed_at` text,
  FOREIGN KEY (`execution_id`) REFERENCES `tankbench_suite_executions`(`id`) ON DELETE cascade,
  FOREIGN KEY (`case_id`) REFERENCES `tankbench_cases`(`id`) ON DELETE restrict,
  FOREIGN KEY (`commander_run_id`) REFERENCES `commander_runs`(`id`) ON DELETE restrict,
  CONSTRAINT `tankbench_suite_execution_items_variant_check` CHECK (`variant` IN ('baseline','candidate')),
  CONSTRAINT `tankbench_suite_execution_items_status_check` CHECK (`status` IN ('queued','commander_created','running','waiting','completed','failed')),
  CONSTRAINT `tankbench_suite_execution_items_ordinal_check` CHECK (`ordinal` >= 0 AND `ordinal` <= 399),
  CONSTRAINT `tankbench_suite_execution_items_version_check` CHECK (`version` >= 1),
  CONSTRAINT `tankbench_suite_execution_items_terminal_check` CHECK ((`status` IN ('completed','failed') AND `completed_at` IS NOT NULL) OR (`status` IN ('queued','commander_created','running','waiting') AND `completed_at` IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tankbench_suite_execution_items_unique_idx` ON `tankbench_suite_execution_items` (`execution_id`,`case_id`,`variant`);
--> statement-breakpoint
CREATE INDEX `tankbench_suite_execution_items_next_idx` ON `tankbench_suite_execution_items` (`execution_id`,`status`,`ordinal`);
--> statement-breakpoint
CREATE TABLE `tankbench_route_events` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `routing_key_hash` text NOT NULL,
  `selected_release_id` text NOT NULL,
  `active_release_id` text,
  `canary_release_id` text,
  `bucket` integer NOT NULL,
  `canary_percent` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  FOREIGN KEY (`selected_release_id`) REFERENCES `tankbench_releases`(`id`) ON DELETE restrict,
  FOREIGN KEY (`active_release_id`) REFERENCES `tankbench_releases`(`id`) ON DELETE set null,
  FOREIGN KEY (`canary_release_id`) REFERENCES `tankbench_releases`(`id`) ON DELETE set null,
  CONSTRAINT `tankbench_route_events_hash_check` CHECK (length(`routing_key_hash`) = 64 AND `routing_key_hash` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `tankbench_route_events_bucket_check` CHECK (`bucket` BETWEEN 0 AND 99),
  CONSTRAINT `tankbench_route_events_percent_check` CHECK (`canary_percent` IN (0,5,25,50,100))
);
--> statement-breakpoint
CREATE INDEX `tankbench_route_events_project_created_idx` ON `tankbench_route_events` (`project_id`,`created_at`);
