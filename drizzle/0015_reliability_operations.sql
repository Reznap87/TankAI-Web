CREATE TABLE `deployment_operations_policies` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `rate_limit_per_minute` integer DEFAULT 60 NOT NULL,
  `max_concurrency` integer DEFAULT 4 NOT NULL,
  `inflight_lease_seconds` integer DEFAULT 180 NOT NULL,
  `slo_window_minutes` integer DEFAULT 60 NOT NULL,
  `slo_min_requests` integer DEFAULT 20 NOT NULL,
  `min_success_rate_bps` integer DEFAULT 9900 NOT NULL,
  `max_p95_latency_ms` integer DEFAULT 5000 NOT NULL,
  `alert_cooldown_minutes` integer DEFAULT 15 NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  CONSTRAINT `deployment_operations_rate_limit_check` CHECK (`rate_limit_per_minute` BETWEEN 1 AND 10000),
  CONSTRAINT `deployment_operations_concurrency_check` CHECK (`max_concurrency` BETWEEN 1 AND 100),
  CONSTRAINT `deployment_operations_lease_check` CHECK (`inflight_lease_seconds` BETWEEN 5 AND 600),
  CONSTRAINT `deployment_operations_slo_window_check` CHECK (`slo_window_minutes` BETWEEN 5 AND 1440),
  CONSTRAINT `deployment_operations_slo_min_requests_check` CHECK (`slo_min_requests` BETWEEN 1 AND 10000),
  CONSTRAINT `deployment_operations_success_rate_check` CHECK (`min_success_rate_bps` BETWEEN 0 AND 10000),
  CONSTRAINT `deployment_operations_latency_check` CHECK (`max_p95_latency_ms` BETWEEN 1 AND 120000),
  CONSTRAINT `deployment_operations_cooldown_check` CHECK (`alert_cooldown_minutes` BETWEEN 1 AND 1440),
  CONSTRAINT `deployment_operations_enabled_check` CHECK (`enabled` IN (0,1)),
  CONSTRAINT `deployment_operations_version_check` CHECK (`version` >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deployment_operations_policy_project_idx` ON `deployment_operations_policies` (`user_id`,`project_id`);
--> statement-breakpoint
CREATE INDEX `deployment_operations_policy_updated_idx` ON `deployment_operations_policies` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `deployment_admission_buckets` (
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `window_start` text NOT NULL,
  `request_count` integer DEFAULT 0 NOT NULL,
  `rejected_count` integer DEFAULT 0 NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`,`project_id`,`window_start`),
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  CONSTRAINT `deployment_admission_request_count_check` CHECK (`request_count` >= 0),
  CONSTRAINT `deployment_admission_rejected_count_check` CHECK (`rejected_count` >= 0),
  CONSTRAINT `deployment_admission_version_check` CHECK (`version` >= 1)
);
--> statement-breakpoint
CREATE INDEX `deployment_admission_project_window_idx` ON `deployment_admission_buckets` (`user_id`,`project_id`,`window_start`);
--> statement-breakpoint
CREATE TABLE `deployment_inflight_leases` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `acquired_at` text NOT NULL,
  `expires_at` text NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  CONSTRAINT `deployment_inflight_expiry_check` CHECK (`expires_at` > `acquired_at`)
);
--> statement-breakpoint
CREATE INDEX `deployment_inflight_project_expiry_idx` ON `deployment_inflight_leases` (`user_id`,`project_id`,`expires_at`);
--> statement-breakpoint
CREATE TABLE `deployment_slo_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `policy_id` text NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `window_started_at` text NOT NULL,
  `window_ended_at` text NOT NULL,
  `request_count` integer NOT NULL,
  `success_count` integer NOT NULL,
  `success_rate_bps` integer NOT NULL,
  `p95_latency_ms` integer NOT NULL,
  `status` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`policy_id`) REFERENCES `deployment_operations_policies`(`id`) ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  CONSTRAINT `deployment_slo_snapshot_counts_check` CHECK (`request_count` >= 0 AND `success_count` >= 0 AND `success_count` <= `request_count`),
  CONSTRAINT `deployment_slo_snapshot_rate_check` CHECK (`success_rate_bps` BETWEEN 0 AND 10000),
  CONSTRAINT `deployment_slo_snapshot_latency_check` CHECK (`p95_latency_ms` BETWEEN 0 AND 120000),
  CONSTRAINT `deployment_slo_snapshot_status_check` CHECK (`status` IN ('healthy','breached','insufficient'))
);
--> statement-breakpoint
CREATE INDEX `deployment_slo_snapshots_project_created_idx` ON `deployment_slo_snapshots` (`user_id`,`project_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `deployment_alerts` (
  `id` text PRIMARY KEY NOT NULL,
  `policy_id` text NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `kind` text NOT NULL,
  `status` text NOT NULL,
  `severity` text NOT NULL,
  `dedupe_key` text NOT NULL,
  `message` text NOT NULL,
  `observed_value` integer NOT NULL,
  `threshold_value` integer NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `first_seen_at` text NOT NULL,
  `last_seen_at` text NOT NULL,
  `acknowledged_at` text,
  `resolved_at` text,
  FOREIGN KEY (`policy_id`) REFERENCES `deployment_operations_policies`(`id`) ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  CONSTRAINT `deployment_alert_kind_check` CHECK (`kind` IN ('success_rate','latency','rate_limit','concurrency','dead_letter')),
  CONSTRAINT `deployment_alert_status_check` CHECK (`status` IN ('open','acknowledged','resolved')),
  CONSTRAINT `deployment_alert_severity_check` CHECK (`severity` IN ('warning','critical')),
  CONSTRAINT `deployment_alert_value_check` CHECK (`observed_value` >= 0 AND `threshold_value` >= 0),
  CONSTRAINT `deployment_alert_version_check` CHECK (`version` >= 1),
  CONSTRAINT `deployment_alert_state_check` CHECK ((`status`='open' AND `acknowledged_at` IS NULL AND `resolved_at` IS NULL) OR (`status`='acknowledged' AND `acknowledged_at` IS NOT NULL AND `resolved_at` IS NULL) OR (`status`='resolved' AND `resolved_at` IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deployment_alerts_active_dedupe_idx` ON `deployment_alerts` (`user_id`,`project_id`,`dedupe_key`) WHERE `status` IN ('open','acknowledged');
--> statement-breakpoint
CREATE INDEX `deployment_alerts_project_status_idx` ON `deployment_alerts` (`user_id`,`project_id`,`status`,`last_seen_at`);
--> statement-breakpoint
CREATE TABLE `tool_job_replays` (
  `id` text PRIMARY KEY NOT NULL,
  `source_job_id` text NOT NULL,
  `replay_job_id` text NOT NULL,
  `lease_id` text NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text,
  `source_job_version` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`source_job_id`) REFERENCES `tool_jobs`(`id`) ON DELETE restrict,
  FOREIGN KEY (`replay_job_id`) REFERENCES `tool_jobs`(`id`) ON DELETE cascade,
  FOREIGN KEY (`lease_id`) REFERENCES `tool_execution_leases`(`id`) ON DELETE restrict,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  CONSTRAINT `tool_job_replays_source_version_check` CHECK (`source_job_version` >= 1),
  CONSTRAINT `tool_job_replays_distinct_check` CHECK (`source_job_id` <> `replay_job_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tool_job_replays_replay_job_idx` ON `tool_job_replays` (`replay_job_id`);
--> statement-breakpoint
CREATE INDEX `tool_job_replays_source_created_idx` ON `tool_job_replays` (`source_job_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `deployment_operations_events` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `event_type` text NOT NULL,
  `entity_id` text,
  `entity_version` integer NOT NULL,
  `note` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  CONSTRAINT `deployment_operations_event_type_check` CHECK (`event_type` IN ('policy_configured','policy_reconfigured','admission_granted','rate_limited','concurrency_limited','inflight_recovered','slo_evaluated','alert_opened','alert_updated','alert_acknowledged','alert_resolved','dead_letter_replayed','audit_exported')),
  CONSTRAINT `deployment_operations_event_version_check` CHECK (`entity_version` >= 1)
);
--> statement-breakpoint
CREATE INDEX `deployment_operations_events_project_created_idx` ON `deployment_operations_events` (`user_id`,`project_id`,`created_at`);
