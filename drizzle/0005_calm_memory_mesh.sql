CREATE TABLE `memory_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text,
  `related_run_id` text,
  `related_goal_id` text,
  `scope_kind` text NOT NULL,
  `memory_type` text NOT NULL,
  `verification_status` text NOT NULL,
  `retention_policy` text NOT NULL,
  `source` text NOT NULL,
  `content` text NOT NULL,
  `content_sha256` text NOT NULL,
  `confidence` real NOT NULL,
  `embedding_model` text NOT NULL,
  `embedding_dimensions` integer NOT NULL,
  `embedding_base64` text NOT NULL,
  `provenance_json` text NOT NULL,
  `metadata_json` text NOT NULL,
  `access_count` integer DEFAULT 0 NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `last_accessed_at` text NOT NULL,
  `expires_at` text,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`related_run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`related_goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT "memory_entries_scope_check" CHECK((`scope_kind` = 'account' AND `project_id` IS NULL) OR (`scope_kind` = 'project' AND `project_id` IS NOT NULL)),
  CONSTRAINT "memory_entries_type_check" CHECK(`memory_type` IN ('episodic', 'semantic', 'procedural')),
  CONSTRAINT "memory_entries_verification_check" CHECK(`verification_status` IN ('observed', 'candidate', 'confirmed', 'disputed', 'revoked')),
  CONSTRAINT "memory_entries_retention_check" CHECK(`retention_policy` IN ('hot', 'warm', 'cold', 'deleted')),
  CONSTRAINT "memory_entries_confidence_check" CHECK(`confidence` >= 0 AND `confidence` <= 1),
  CONSTRAINT "memory_entries_content_size_check" CHECK(length(`content`) <= 6000 AND length(CAST(`content` AS BLOB)) <= 12000),
  CONSTRAINT "memory_entries_hash_check" CHECK(length(`content_sha256`) = 64 AND `content_sha256` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT "memory_entries_embedding_check" CHECK(`embedding_dimensions` = 192 AND length(`embedding_base64`) > 0),
  CONSTRAINT "memory_entries_access_check" CHECK(`access_count` >= 0),
  CONSTRAINT "memory_entries_version_check" CHECK(`version` >= 1)
);
--> statement-breakpoint
CREATE INDEX `memory_entries_user_recent_idx` ON `memory_entries` (`user_id`,`retention_policy`,`last_accessed_at`);
--> statement-breakpoint
CREATE INDEX `memory_entries_project_recent_idx` ON `memory_entries` (`project_id`,`retention_policy`,`last_accessed_at`);
--> statement-breakpoint
CREATE INDEX `memory_entries_run_idx` ON `memory_entries` (`related_run_id`);
--> statement-breakpoint
CREATE INDEX `memory_entries_goal_idx` ON `memory_entries` (`related_goal_id`);
--> statement-breakpoint
CREATE INDEX `memory_entries_user_type_idx` ON `memory_entries` (`user_id`,`memory_type`,`verification_status`);
--> statement-breakpoint
CREATE INDEX `memory_entries_hash_idx` ON `memory_entries` (`user_id`,`content_sha256`);
--> statement-breakpoint
CREATE TABLE `memory_events` (
  `id` text PRIMARY KEY NOT NULL,
  `memory_id` text NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text,
  `run_id` text,
  `event_type` text NOT NULL,
  `memory_version` integer NOT NULL,
  `note` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`memory_id`) REFERENCES `memory_entries`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT "memory_events_type_check" CHECK(`event_type` IN ('created', 'recalled', 'confirmed', 'disputed', 'warmed', 'cooled', 'archived', 'restored', 'expired', 'deleted')),
  CONSTRAINT "memory_events_version_check" CHECK(`memory_version` >= 1)
);
--> statement-breakpoint
CREATE INDEX `memory_events_memory_created_idx` ON `memory_events` (`memory_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `memory_events_user_created_idx` ON `memory_events` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `memory_events_run_idx` ON `memory_events` (`run_id`);
