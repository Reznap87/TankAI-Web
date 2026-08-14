CREATE TABLE `react_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text,
  `objective` text NOT NULL,
  `definition_of_done` text NOT NULL,
  `status` text NOT NULL,
  `current_step` integer DEFAULT 0 NOT NULL,
  `max_steps` integer NOT NULL,
  `model_calls_used` integer DEFAULT 0 NOT NULL,
  `max_model_calls` integer NOT NULL,
  `tool_actions_used` integer DEFAULT 0 NOT NULL,
  `max_tool_actions` integer NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `final_answer` text,
  `error_code` text,
  `error_message` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `completed_at` text,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `react_runs_status_check` CHECK (`status` IN ('ready','running','waiting_tool','verifying','completed','failed','cancelled','budget_exhausted')),
  CONSTRAINT `react_runs_steps_check` CHECK (`current_step` >= 0 AND `max_steps` >= 1 AND `max_steps` <= 32 AND `current_step` <= `max_steps`),
  CONSTRAINT `react_runs_model_budget_check` CHECK (`model_calls_used` >= 0 AND `max_model_calls` >= 1 AND `max_model_calls` <= 64 AND `model_calls_used` <= `max_model_calls`),
  CONSTRAINT `react_runs_tool_budget_check` CHECK (`tool_actions_used` >= 0 AND `max_tool_actions` >= 0 AND `max_tool_actions` <= 32 AND `tool_actions_used` <= `max_tool_actions`),
  CONSTRAINT `react_runs_version_check` CHECK (`version` >= 1),
  CONSTRAINT `react_runs_objective_check` CHECK (length(`objective`) >= 1 AND length(`objective`) <= 8000),
  CONSTRAINT `react_runs_done_check` CHECK (length(`definition_of_done`) >= 1 AND length(`definition_of_done`) <= 4000),
  CONSTRAINT `react_runs_final_size_check` CHECK (`final_answer` IS NULL OR length(CAST(`final_answer` AS BLOB)) <= 48000),
  CONSTRAINT `react_runs_terminal_check` CHECK ((`status` IN ('completed','failed','cancelled','budget_exhausted') AND `completed_at` IS NOT NULL) OR (`status` NOT IN ('completed','failed','cancelled','budget_exhausted') AND `completed_at` IS NULL))
);
--> statement-breakpoint
CREATE INDEX `react_runs_user_updated_idx` ON `react_runs` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `react_runs_project_updated_idx` ON `react_runs` (`project_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `react_runs_user_status_idx` ON `react_runs` (`user_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `react_steps` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `user_id` text NOT NULL,
  `sequence_number` integer NOT NULL,
  `status` text NOT NULL,
  `decision_summary` text NOT NULL,
  `action_type` text NOT NULL,
  `tool_name` text,
  `tool_job_id` text,
  `action_input_json` text,
  `observation_json` text,
  `observation_sha256` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `completed_at` text,
  FOREIGN KEY (`run_id`) REFERENCES `react_runs`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`tool_job_id`) REFERENCES `tool_jobs`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `react_steps_sequence_check` CHECK (`sequence_number` >= 1 AND `sequence_number` <= 32),
  CONSTRAINT `react_steps_status_check` CHECK (`status` IN ('waiting_tool','observed','completed','failed')),
  CONSTRAINT `react_steps_action_check` CHECK (`action_type` IN ('tool','final')),
  CONSTRAINT `react_steps_summary_check` CHECK (length(`decision_summary`) >= 1 AND length(`decision_summary`) <= 1000),
  CONSTRAINT `react_steps_tool_check` CHECK ((`action_type` = 'tool' AND `tool_name` IS NOT NULL AND `tool_job_id` IS NOT NULL AND `action_input_json` IS NOT NULL) OR (`action_type` = 'final' AND `tool_name` IS NULL AND `tool_job_id` IS NULL AND `action_input_json` IS NULL)),
  CONSTRAINT `react_steps_tool_name_check` CHECK (`tool_name` IS NULL OR `tool_name` IN ('text.sha256','text.analyze','json.validate','memory.retention','web.fetch','project.document.inspect','code.patch.inspect')),
  CONSTRAINT `react_steps_input_size_check` CHECK (`action_input_json` IS NULL OR length(CAST(`action_input_json` AS BLOB)) <= 24000),
  CONSTRAINT `react_steps_observation_size_check` CHECK (`observation_json` IS NULL OR length(CAST(`observation_json` AS BLOB)) <= 48000),
  CONSTRAINT `react_steps_observation_hash_check` CHECK (`observation_sha256` IS NULL OR (length(`observation_sha256`) = 64 AND `observation_sha256` NOT GLOB '*[^0-9a-f]*'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `react_steps_run_sequence_idx` ON `react_steps` (`run_id`,`sequence_number`);
--> statement-breakpoint
CREATE INDEX `react_steps_user_created_idx` ON `react_steps` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `react_steps_tool_job_idx` ON `react_steps` (`tool_job_id`);
--> statement-breakpoint
CREATE TABLE `react_events` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `step_id` text,
  `user_id` text NOT NULL,
  `event_type` text NOT NULL,
  `run_version` integer NOT NULL,
  `sequence_number` integer NOT NULL,
  `note` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `react_runs`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`step_id`) REFERENCES `react_steps`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `react_events_type_check` CHECK (`event_type` IN ('created','decision','tool_dispatched','observation','completed','failed','cancelled','budget_exhausted')),
  CONSTRAINT `react_events_version_check` CHECK (`run_version` >= 1),
  CONSTRAINT `react_events_sequence_check` CHECK (`sequence_number` >= 0 AND `sequence_number` <= 32),
  CONSTRAINT `react_events_note_check` CHECK (`note` IS NULL OR length(`note`) <= 1000)
);
--> statement-breakpoint
CREATE INDEX `react_events_run_created_idx` ON `react_events` (`run_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `react_events_user_created_idx` ON `react_events` (`user_id`,`created_at`);
