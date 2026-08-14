CREATE TABLE `tankbench_suites` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `name` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `status` text NOT NULL,
  `case_count` integer NOT NULL,
  `suite_sha256` text NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `frozen_at` text,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `tankbench_suites_status_check` CHECK (`status` IN ('frozen','archived')),
  CONSTRAINT `tankbench_suites_case_count_check` CHECK (`case_count` >= 1 AND `case_count` <= 200),
  CONSTRAINT `tankbench_suites_hash_check` CHECK (length(`suite_sha256`) = 64 AND `suite_sha256` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `tankbench_suites_version_check` CHECK (`version` >= 1),
  CONSTRAINT `tankbench_suites_frozen_check` CHECK ((`status` = 'frozen' AND `frozen_at` IS NOT NULL) OR `status` = 'archived')
);
--> statement-breakpoint
CREATE INDEX `tankbench_suites_user_updated_idx` ON `tankbench_suites` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `tankbench_suites_project_updated_idx` ON `tankbench_suites` (`project_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `tankbench_suites_hash_idx` ON `tankbench_suites` (`suite_sha256`);
--> statement-breakpoint
CREATE TABLE `tankbench_cases` (
  `id` text PRIMARY KEY NOT NULL,
  `suite_id` text NOT NULL,
  `user_id` text NOT NULL,
  `ordinal` integer NOT NULL,
  `title` text NOT NULL,
  `category` text NOT NULL,
  `prompt` text NOT NULL,
  `definition_of_done` text NOT NULL,
  `assertions_json` text NOT NULL,
  `case_sha256` text NOT NULL,
  `weight` integer DEFAULT 1 NOT NULL,
  `required` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`suite_id`) REFERENCES `tankbench_suites`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `tankbench_cases_ordinal_check` CHECK (`ordinal` >= 1 AND `ordinal` <= 200),
  CONSTRAINT `tankbench_cases_category_check` CHECK (`category` IN ('completion','factuality','tool_use','build','recovery','safety','efficiency')),
  CONSTRAINT `tankbench_cases_weight_check` CHECK (`weight` >= 1 AND `weight` <= 20),
  CONSTRAINT `tankbench_cases_required_check` CHECK (`required` IN (0,1)),
  CONSTRAINT `tankbench_cases_text_check` CHECK (length(`title`) BETWEEN 1 AND 240 AND length(`prompt`) BETWEEN 1 AND 8000 AND length(`definition_of_done`) BETWEEN 1 AND 4000),
  CONSTRAINT `tankbench_cases_assertions_size_check` CHECK (length(CAST(`assertions_json` AS BLOB)) <= 16000),
  CONSTRAINT `tankbench_cases_hash_check` CHECK (length(`case_sha256`) = 64 AND `case_sha256` NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tankbench_cases_suite_ordinal_idx` ON `tankbench_cases` (`suite_id`,`ordinal`);
--> statement-breakpoint
CREATE INDEX `tankbench_cases_suite_category_idx` ON `tankbench_cases` (`suite_id`,`category`,`ordinal`);
--> statement-breakpoint
CREATE INDEX `tankbench_cases_user_created_idx` ON `tankbench_cases` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `tankbench_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `suite_id` text NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `baseline_label` text NOT NULL,
  `candidate_label` text NOT NULL,
  `status` text NOT NULL,
  `min_score_delta_bps` integer DEFAULT 0 NOT NULL,
  `max_regressions` integer DEFAULT 0 NOT NULL,
  `baseline_score_bps` integer,
  `candidate_score_bps` integer,
  `delta_bps` integer,
  `regression_count` integer DEFAULT 0 NOT NULL,
  `required_failure_count` integer DEFAULT 0 NOT NULL,
  `safety_failure_count` integer DEFAULT 0 NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `evaluated_at` text,
  `completed_at` text,
  FOREIGN KEY (`suite_id`) REFERENCES `tankbench_suites`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `tankbench_runs_status_check` CHECK (`status` IN ('collecting','passed','failed','cancelled')),
  CONSTRAINT `tankbench_runs_delta_gate_check` CHECK (`min_score_delta_bps` >= -10000 AND `min_score_delta_bps` <= 10000),
  CONSTRAINT `tankbench_runs_regression_gate_check` CHECK (`max_regressions` >= 0 AND `max_regressions` <= 200 AND `regression_count` >= 0 AND `regression_count` <= 200),
  CONSTRAINT `tankbench_runs_failure_counts_check` CHECK (`required_failure_count` >= 0 AND `required_failure_count` <= 200 AND `safety_failure_count` >= 0 AND `safety_failure_count` <= 200),
  CONSTRAINT `tankbench_runs_scores_check` CHECK ((`baseline_score_bps` IS NULL OR (`baseline_score_bps` BETWEEN 0 AND 10000)) AND (`candidate_score_bps` IS NULL OR (`candidate_score_bps` BETWEEN 0 AND 10000)) AND (`delta_bps` IS NULL OR (`delta_bps` BETWEEN -10000 AND 10000))),
  CONSTRAINT `tankbench_runs_version_check` CHECK (`version` >= 1),
  CONSTRAINT `tankbench_runs_labels_check` CHECK (length(`baseline_label`) BETWEEN 1 AND 160 AND length(`candidate_label`) BETWEEN 1 AND 160 AND `baseline_label` <> `candidate_label`),
  CONSTRAINT `tankbench_runs_terminal_check` CHECK ((`status` IN ('passed','failed','cancelled') AND `completed_at` IS NOT NULL) OR (`status` = 'collecting' AND `completed_at` IS NULL))
);
--> statement-breakpoint
CREATE INDEX `tankbench_runs_user_updated_idx` ON `tankbench_runs` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `tankbench_runs_project_updated_idx` ON `tankbench_runs` (`project_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `tankbench_runs_suite_updated_idx` ON `tankbench_runs` (`suite_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `tankbench_runs_status_updated_idx` ON `tankbench_runs` (`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `tankbench_results` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `case_id` text NOT NULL,
  `commander_run_id` text NOT NULL,
  `user_id` text NOT NULL,
  `variant` text NOT NULL,
  `outcome` text NOT NULL,
  `score_bps` integer NOT NULL,
  `checks_passed` integer NOT NULL,
  `checks_total` integer NOT NULL,
  `evidence_json` text NOT NULL,
  `output_sha256` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `tankbench_runs`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`case_id`) REFERENCES `tankbench_cases`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`commander_run_id`) REFERENCES `commander_runs`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `tankbench_results_variant_check` CHECK (`variant` IN ('baseline','candidate')),
  CONSTRAINT `tankbench_results_outcome_check` CHECK (`outcome` IN ('pass','fail','error')),
  CONSTRAINT `tankbench_results_score_check` CHECK (`score_bps` BETWEEN 0 AND 10000),
  CONSTRAINT `tankbench_results_checks_check` CHECK (`checks_total` >= 1 AND `checks_total` <= 64 AND `checks_passed` >= 0 AND `checks_passed` <= `checks_total`),
  CONSTRAINT `tankbench_results_evidence_size_check` CHECK (length(CAST(`evidence_json` AS BLOB)) <= 24000),
  CONSTRAINT `tankbench_results_hash_check` CHECK (length(`output_sha256`) = 64 AND `output_sha256` NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tankbench_results_run_case_variant_idx` ON `tankbench_results` (`run_id`,`case_id`,`variant`);
--> statement-breakpoint
CREATE INDEX `tankbench_results_run_variant_idx` ON `tankbench_results` (`run_id`,`variant`,`created_at`);
--> statement-breakpoint
CREATE INDEX `tankbench_results_commander_idx` ON `tankbench_results` (`commander_run_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `tankbench_releases` (
  `id` text PRIMARY KEY NOT NULL,
  `source_run_id` text NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `label` text NOT NULL,
  `status` text NOT NULL,
  `traffic_percent` integer DEFAULT 0 NOT NULL,
  `max_error_rate_bps` integer NOT NULL,
  `max_p95_latency_ms` integer NOT NULL,
  `min_stage_observations` integer NOT NULL,
  `stage_observation_offset` integer DEFAULT 0 NOT NULL,
  `observation_count` integer DEFAULT 0 NOT NULL,
  `error_count` integer DEFAULT 0 NOT NULL,
  `rollback_release_id` text,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `promoted_at` text,
  `rolled_back_at` text,
  FOREIGN KEY (`source_run_id`) REFERENCES `tankbench_runs`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`rollback_release_id`) REFERENCES `tankbench_releases`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `tankbench_releases_status_check` CHECK (`status` IN ('candidate','canary','active','rejected','rolled_back','superseded')),
  CONSTRAINT `tankbench_releases_traffic_check` CHECK (`traffic_percent` IN (0,5,25,50,100)),
  CONSTRAINT `tankbench_releases_error_gate_check` CHECK (`max_error_rate_bps` BETWEEN 0 AND 10000),
  CONSTRAINT `tankbench_releases_latency_gate_check` CHECK (`max_p95_latency_ms` BETWEEN 1 AND 120000),
  CONSTRAINT `tankbench_releases_observation_gate_check` CHECK (`min_stage_observations` BETWEEN 3 AND 1000 AND `stage_observation_offset` >= 0 AND `observation_count` >= 0 AND `error_count` >= 0 AND `error_count` <= `observation_count`),
  CONSTRAINT `tankbench_releases_label_check` CHECK (length(`label`) BETWEEN 1 AND 160),
  CONSTRAINT `tankbench_releases_version_check` CHECK (`version` >= 1),
  CONSTRAINT `tankbench_releases_state_check` CHECK ((`status` = 'candidate' AND `traffic_percent` = 0) OR (`status` = 'canary' AND `traffic_percent` IN (5,25,50)) OR (`status` = 'active' AND `traffic_percent` = 100) OR (`status` IN ('rejected','rolled_back','superseded') AND `traffic_percent` = 0))
);
--> statement-breakpoint
CREATE INDEX `tankbench_releases_user_updated_idx` ON `tankbench_releases` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `tankbench_releases_project_status_idx` ON `tankbench_releases` (`project_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `tankbench_releases_source_run_idx` ON `tankbench_releases` (`source_run_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `tankbench_canary_observations` (
  `id` text PRIMARY KEY NOT NULL,
  `release_id` text NOT NULL,
  `user_id` text NOT NULL,
  `success` integer NOT NULL,
  `latency_ms` integer NOT NULL,
  `error_code` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`release_id`) REFERENCES `tankbench_releases`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `tankbench_canary_success_check` CHECK (`success` IN (0,1)),
  CONSTRAINT `tankbench_canary_latency_check` CHECK (`latency_ms` BETWEEN 0 AND 120000),
  CONSTRAINT `tankbench_canary_error_check` CHECK ((`success` = 1 AND `error_code` IS NULL) OR (`success` = 0 AND `error_code` IS NOT NULL AND length(`error_code`) BETWEEN 1 AND 120))
);
--> statement-breakpoint
CREATE INDEX `tankbench_canary_release_created_idx` ON `tankbench_canary_observations` (`release_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `tankbench_canary_user_created_idx` ON `tankbench_canary_observations` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `tankbench_events` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `suite_id` text,
  `run_id` text,
  `release_id` text,
  `event_type` text NOT NULL,
  `entity_version` integer NOT NULL,
  `note` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`suite_id`) REFERENCES `tankbench_suites`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`run_id`) REFERENCES `tankbench_runs`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`release_id`) REFERENCES `tankbench_releases`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `tankbench_events_type_check` CHECK (`event_type` IN ('suite_frozen','run_created','case_evaluated','run_passed','run_failed','release_created','canary_started','canary_advanced','release_activated','release_rolled_back','release_rejected')),
  CONSTRAINT `tankbench_events_entity_check` CHECK ((`suite_id` IS NOT NULL AND `run_id` IS NULL AND `release_id` IS NULL) OR (`suite_id` IS NULL AND `run_id` IS NOT NULL AND `release_id` IS NULL) OR (`suite_id` IS NULL AND `run_id` IS NULL AND `release_id` IS NOT NULL)),
  CONSTRAINT `tankbench_events_version_check` CHECK (`entity_version` >= 1),
  CONSTRAINT `tankbench_events_note_check` CHECK (`note` IS NULL OR length(`note`) <= 2000)
);
--> statement-breakpoint
CREATE INDEX `tankbench_events_suite_created_idx` ON `tankbench_events` (`suite_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `tankbench_events_run_created_idx` ON `tankbench_events` (`run_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `tankbench_events_release_created_idx` ON `tankbench_events` (`release_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `tankbench_events_user_created_idx` ON `tankbench_events` (`user_id`,`created_at`);
