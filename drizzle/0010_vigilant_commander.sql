CREATE TABLE `commander_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `react_run_id` text NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text,
  `capability_lease_id` text NOT NULL,
  `status` text NOT NULL,
  `cycle_count` integer DEFAULT 0 NOT NULL,
  `max_cycles` integer NOT NULL,
  `model_calls_used` integer DEFAULT 0 NOT NULL,
  `max_model_calls` integer NOT NULL,
  `review_calls_used` integer DEFAULT 0 NOT NULL,
  `max_review_calls` integer NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `final_answer` text,
  `error_code` text,
  `error_message` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `completed_at` text,
  FOREIGN KEY (`react_run_id`) REFERENCES `react_runs`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`capability_lease_id`) REFERENCES `capability_leases`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `commander_runs_status_check` CHECK (`status` IN ('ready','running','waiting_tool','reviewing','completed','failed','cancelled','budget_exhausted','model_unavailable')),
  CONSTRAINT `commander_runs_cycles_check` CHECK (`cycle_count` >= 0 AND `max_cycles` >= 1 AND `max_cycles` <= 24 AND `cycle_count` <= `max_cycles`),
  CONSTRAINT `commander_runs_model_budget_check` CHECK (`model_calls_used` >= 0 AND `max_model_calls` >= 2 AND `max_model_calls` <= 20 AND `model_calls_used` <= `max_model_calls`),
  CONSTRAINT `commander_runs_review_budget_check` CHECK (`review_calls_used` >= 0 AND `max_review_calls` >= 1 AND `max_review_calls` <= 16 AND `review_calls_used` <= `max_review_calls`),
  CONSTRAINT `commander_runs_version_check` CHECK (`version` >= 1),
  CONSTRAINT `commander_runs_final_size_check` CHECK (`final_answer` IS NULL OR length(CAST(`final_answer` AS BLOB)) <= 48000),
  CONSTRAINT `commander_runs_terminal_check` CHECK ((`status` IN ('completed','failed','cancelled','budget_exhausted','model_unavailable') AND `completed_at` IS NOT NULL) OR (`status` NOT IN ('completed','failed','cancelled','budget_exhausted','model_unavailable') AND `completed_at` IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commander_runs_react_idx` ON `commander_runs` (`react_run_id`);
--> statement-breakpoint
CREATE INDEX `commander_runs_user_updated_idx` ON `commander_runs` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `commander_runs_user_status_idx` ON `commander_runs` (`user_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `commander_runs_project_updated_idx` ON `commander_runs` (`project_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `commander_runs_capability_lease_idx` ON `commander_runs` (`capability_lease_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `commander_capability_events` (
  `id` text PRIMARY KEY NOT NULL,
  `capability_lease_id` text NOT NULL,
  `commander_run_id` text NOT NULL,
  `user_id` text NOT NULL,
  `phase` text NOT NULL,
  `lease_version` integer NOT NULL,
  `remaining_uses` integer NOT NULL,
  `cycle_number` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`capability_lease_id`) REFERENCES `capability_leases`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`commander_run_id`) REFERENCES `commander_runs`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `commander_capability_events_phase_check` CHECK (`phase` IN ('decision','review')),
  CONSTRAINT `commander_capability_events_version_check` CHECK (`lease_version` >= 2),
  CONSTRAINT `commander_capability_events_remaining_check` CHECK (`remaining_uses` >= 0),
  CONSTRAINT `commander_capability_events_cycle_check` CHECK (`cycle_number` >= 0 AND `cycle_number` <= 24)
);
--> statement-breakpoint
CREATE INDEX `commander_capability_events_run_created_idx` ON `commander_capability_events` (`commander_run_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `commander_capability_events_lease_created_idx` ON `commander_capability_events` (`capability_lease_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `commander_capability_events_user_created_idx` ON `commander_capability_events` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `commander_decisions` (
  `id` text PRIMARY KEY NOT NULL,
  `commander_run_id` text NOT NULL,
  `react_step_id` text,
  `user_id` text NOT NULL,
  `cycle_number` integer NOT NULL,
  `phase` text NOT NULL,
  `provider_id` text NOT NULL,
  `provider_family` text NOT NULL,
  `provider_name` text NOT NULL,
  `model` text NOT NULL,
  `status` text NOT NULL,
  `summary` text NOT NULL,
  `action_type` text,
  `tool_name` text,
  `payload_json` text,
  `payload_sha256` text,
  `raw_response_sha256` text NOT NULL,
  `latency_ms` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`commander_run_id`) REFERENCES `commander_runs`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`react_step_id`) REFERENCES `react_steps`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `commander_decisions_cycle_check` CHECK (`cycle_number` >= 1 AND `cycle_number` <= 24),
  CONSTRAINT `commander_decisions_phase_check` CHECK (`phase` IN ('decision','review')),
  CONSTRAINT `commander_decisions_status_check` CHECK (`status` IN ('accepted','rejected','failed')),
  CONSTRAINT `commander_decisions_action_check` CHECK (`action_type` IS NULL OR `action_type` IN ('tool','final','review')),
  CONSTRAINT `commander_decisions_tool_check` CHECK (`tool_name` IS NULL OR `tool_name` IN ('text.sha256','text.analyze','json.validate','memory.retention','web.fetch','project.document.inspect','code.patch.inspect')),
  CONSTRAINT `commander_decisions_summary_check` CHECK (length(`summary`) >= 1 AND length(`summary`) <= 2000),
  CONSTRAINT `commander_decisions_payload_size_check` CHECK (`payload_json` IS NULL OR length(CAST(`payload_json` AS BLOB)) <= 48000),
  CONSTRAINT `commander_decisions_hash_check` CHECK ((`payload_sha256` IS NULL OR (length(`payload_sha256`) = 64 AND `payload_sha256` NOT GLOB '*[^0-9a-f]*')) AND length(`raw_response_sha256`) = 64 AND `raw_response_sha256` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `commander_decisions_latency_check` CHECK (`latency_ms` >= 0 AND `latency_ms` <= 120000)
);
--> statement-breakpoint
CREATE INDEX `commander_decisions_run_cycle_idx` ON `commander_decisions` (`commander_run_id`,`cycle_number`,`created_at`);
--> statement-breakpoint
CREATE INDEX `commander_decisions_user_created_idx` ON `commander_decisions` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `commander_events` (
  `id` text PRIMARY KEY NOT NULL,
  `commander_run_id` text NOT NULL,
  `react_run_id` text NOT NULL,
  `user_id` text NOT NULL,
  `event_type` text NOT NULL,
  `commander_version` integer NOT NULL,
  `cycle_number` integer NOT NULL,
  `note` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`commander_run_id`) REFERENCES `commander_runs`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`react_run_id`) REFERENCES `react_runs`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `commander_events_type_check` CHECK (`event_type` IN ('created','decision_requested','decision_accepted','decision_rejected','tool_dispatched','tool_waiting','observation_synced','review_requested','review_approved','review_rejected','completed','failed','cancelled','budget_exhausted','model_unavailable')),
  CONSTRAINT `commander_events_version_check` CHECK (`commander_version` >= 1),
  CONSTRAINT `commander_events_cycle_check` CHECK (`cycle_number` >= 0 AND `cycle_number` <= 24),
  CONSTRAINT `commander_events_note_check` CHECK (`note` IS NULL OR length(`note`) <= 2000)
);
--> statement-breakpoint
CREATE INDEX `commander_events_run_created_idx` ON `commander_events` (`commander_run_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `commander_events_user_created_idx` ON `commander_events` (`user_id`,`created_at`);
