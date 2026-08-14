CREATE TABLE `project_document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`content_sha256` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`change_note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `project_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_document_versions_version_check" CHECK("project_document_versions"."version" >= 1),
	CONSTRAINT "project_document_versions_kind_check" CHECK("project_document_versions"."kind" IN ('markdown', 'text', 'json')),
	CONSTRAINT "project_document_versions_size_check" CHECK("project_document_versions"."size_bytes" >= 0 AND "project_document_versions"."size_bytes" <= 24000 AND "project_document_versions"."size_bytes" = length(CAST("project_document_versions"."content" AS BLOB))),
	CONSTRAINT "project_document_versions_content_length_check" CHECK(length("project_document_versions"."content") <= 20000),
	CONSTRAINT "project_document_versions_hash_check" CHECK(length("project_document_versions"."content_sha256") = 64 AND "project_document_versions"."content_sha256" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_document_versions_document_version_idx` ON `project_document_versions` (`document_id`,`version`);--> statement-breakpoint
CREATE INDEX `project_document_versions_project_created_idx` ON `project_document_versions` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `project_document_versions_user_created_idx` ON `project_document_versions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`content_sha256` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_documents_version_check" CHECK("project_documents"."version" >= 1),
	CONSTRAINT "project_documents_kind_check" CHECK("project_documents"."kind" IN ('markdown', 'text', 'json')),
	CONSTRAINT "project_documents_size_check" CHECK("project_documents"."size_bytes" >= 0 AND "project_documents"."size_bytes" <= 24000 AND "project_documents"."size_bytes" = length(CAST("project_documents"."content" AS BLOB))),
	CONSTRAINT "project_documents_content_length_check" CHECK(length("project_documents"."content") <= 20000),
	CONSTRAINT "project_documents_hash_check" CHECK(length("project_documents"."content_sha256") = 64 AND "project_documents"."content_sha256" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE INDEX `project_documents_project_updated_idx` ON `project_documents` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `project_documents_user_updated_idx` ON `project_documents` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_documents_project_name_idx` ON `project_documents` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `project_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`document_id` text,
	`run_id` text,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`project_version` integer NOT NULL,
	`document_version` integer,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `project_documents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "project_events_project_version_check" CHECK("project_events"."project_version" >= 1),
	CONSTRAINT "project_events_type_check" CHECK("project_events"."event_type" IN ('project_created', 'project_updated', 'project_archived', 'project_restored', 'document_created', 'document_updated', 'run_started', 'run_completed', 'run_failed')),
	CONSTRAINT "project_events_document_version_check" CHECK("project_events"."document_version" IS NULL OR "project_events"."document_version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `project_events_project_created_idx` ON `project_events` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `project_events_document_created_idx` ON `project_events` (`document_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `project_events_user_created_idx` ON `project_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `project_events_run_idx` ON `project_events` (`run_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`content_revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "projects_version_check" CHECK("projects"."version" >= 1),
	CONSTRAINT "projects_status_check" CHECK("projects"."status" IN ('active', 'archived')),
	CONSTRAINT "projects_content_revision_check" CHECK("projects"."content_revision" >= 0)
);
--> statement-breakpoint
CREATE INDEX `projects_user_updated_idx` ON `projects` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `projects_user_status_updated_idx` ON `projects` (`user_id`,`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `runs` ADD `project_id` text REFERENCES `projects`(`id`) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `runs_project_created_idx` ON `runs` (`project_id`,`created_at`);
