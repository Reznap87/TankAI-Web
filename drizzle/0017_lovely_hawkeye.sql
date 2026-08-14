PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project_document_versions` (
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
	CONSTRAINT "project_document_versions_version_check" CHECK("__new_project_document_versions"."version" >= 1),
	CONSTRAINT "project_document_versions_kind_check" CHECK("__new_project_document_versions"."kind" IN ('markdown', 'text', 'json', 'csv')),
	CONSTRAINT "project_document_versions_size_check" CHECK("__new_project_document_versions"."size_bytes" >= 0 AND "__new_project_document_versions"."size_bytes" <= 24000 AND "__new_project_document_versions"."size_bytes" = length(CAST("__new_project_document_versions"."content" AS BLOB))),
	CONSTRAINT "project_document_versions_content_length_check" CHECK(length("__new_project_document_versions"."content") <= 20000),
	CONSTRAINT "project_document_versions_hash_check" CHECK(length("__new_project_document_versions"."content_sha256") = 64 AND "__new_project_document_versions"."content_sha256" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
INSERT INTO `__new_project_document_versions`("id", "document_id", "project_id", "user_id", "version", "name", "kind", "content", "content_sha256", "size_bytes", "change_note", "created_at") SELECT "id", "document_id", "project_id", "user_id", "version", "name", "kind", "content", "content_sha256", "size_bytes", "change_note", "created_at" FROM `project_document_versions`;--> statement-breakpoint
DROP TABLE `project_document_versions`;--> statement-breakpoint
ALTER TABLE `__new_project_document_versions` RENAME TO `project_document_versions`;--> statement-breakpoint
CREATE UNIQUE INDEX `project_document_versions_document_version_idx` ON `project_document_versions` (`document_id`,`version`);--> statement-breakpoint
CREATE INDEX `project_document_versions_project_created_idx` ON `project_document_versions` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `project_document_versions_user_created_idx` ON `project_document_versions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_project_documents` (
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
	CONSTRAINT "project_documents_version_check" CHECK("__new_project_documents"."version" >= 1),
	CONSTRAINT "project_documents_kind_check" CHECK("__new_project_documents"."kind" IN ('markdown', 'text', 'json', 'csv')),
	CONSTRAINT "project_documents_size_check" CHECK("__new_project_documents"."size_bytes" >= 0 AND "__new_project_documents"."size_bytes" <= 24000 AND "__new_project_documents"."size_bytes" = length(CAST("__new_project_documents"."content" AS BLOB))),
	CONSTRAINT "project_documents_content_length_check" CHECK(length("__new_project_documents"."content") <= 20000),
	CONSTRAINT "project_documents_hash_check" CHECK(length("__new_project_documents"."content_sha256") = 64 AND "__new_project_documents"."content_sha256" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
INSERT INTO `__new_project_documents`("id", "project_id", "user_id", "name", "kind", "content", "content_sha256", "size_bytes", "version", "created_at", "updated_at") SELECT "id", "project_id", "user_id", "name", "kind", "content", "content_sha256", "size_bytes", "version", "created_at", "updated_at" FROM `project_documents`;--> statement-breakpoint
DROP TABLE `project_documents`;--> statement-breakpoint
ALTER TABLE `__new_project_documents` RENAME TO `project_documents`;--> statement-breakpoint
CREATE INDEX `project_documents_project_updated_idx` ON `project_documents` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `project_documents_user_updated_idx` ON `project_documents` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_documents_project_name_idx` ON `project_documents` (`project_id`,`name`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
