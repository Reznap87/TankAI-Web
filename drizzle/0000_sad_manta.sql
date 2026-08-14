CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `conversations_user_updated_idx` ON `conversations` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`correction` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feedback_run_user_idx` ON `feedback` (`run_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`run_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_user_created_idx` ON `messages` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`prompt_version` text NOT NULL,
	`trace_json` text,
	`error_code` text,
	`model_calls` integer DEFAULT 0 NOT NULL,
	`elapsed_ms` integer,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `runs_user_created_idx` ON `runs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `runs_conversation_created_idx` ON `runs` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `usage_buckets` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`requests` integer NOT NULL,
	`model_calls` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `day`)
);
--> statement-breakpoint
CREATE INDEX `usage_day_idx` ON `usage_buckets` (`day`);