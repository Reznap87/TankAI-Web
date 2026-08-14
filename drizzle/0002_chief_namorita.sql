CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`objective` text NOT NULL,
	`definition_of_done` text NOT NULL,
	`status` text NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`current_step` text,
	`next_action` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	CONSTRAINT "goals_progress_check" CHECK("goals"."progress_percent" >= 0 AND "goals"."progress_percent" <= 100),
	CONSTRAINT "goals_version_check" CHECK("goals"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `goals_user_updated_idx` ON `goals` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `goals_user_status_updated_idx` ON `goals` (`user_id`,`status`,`updated_at`);
--> statement-breakpoint
ALTER TABLE `runs` ADD `goal_id` text REFERENCES `goals`(`id`) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `runs_goal_created_idx` ON `runs` (`goal_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `goal_events` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`run_id` text,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`progress_percent` integer,
	`current_step` text,
	`next_action` text,
	`note` text,
	`goal_version` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "goal_events_progress_check" CHECK("goal_events"."progress_percent" IS NULL OR ("goal_events"."progress_percent" >= 0 AND "goal_events"."progress_percent" <= 100))
);
--> statement-breakpoint
CREATE INDEX `goal_events_goal_created_idx` ON `goal_events` (`goal_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `goal_events_user_created_idx` ON `goal_events` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `goal_events_run_idx` ON `goal_events` (`run_id`);
