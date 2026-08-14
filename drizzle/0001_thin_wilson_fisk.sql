CREATE TABLE `learning_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`feedback_id` text NOT NULL,
	`run_id` text NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`feedback_id`) REFERENCES `feedback`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `learning_cases_user_status_idx` ON `learning_cases` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `learning_cases_feedback_idx` ON `learning_cases` (`feedback_id`);