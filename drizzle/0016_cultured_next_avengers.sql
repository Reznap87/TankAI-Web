CREATE TABLE `data_deletion_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`report_sha256` text NOT NULL,
	`proof_sha256` text NOT NULL,
	`deleted_row_count` integer NOT NULL,
	`dataset_count` integer NOT NULL,
	`software_release` text NOT NULL,
	`completed_at` text NOT NULL,
	CONSTRAINT "data_deletion_receipts_report_hash_check" CHECK(length("data_deletion_receipts"."report_sha256") = 64 AND "data_deletion_receipts"."report_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "data_deletion_receipts_proof_hash_check" CHECK(length("data_deletion_receipts"."proof_sha256") = 64 AND "data_deletion_receipts"."proof_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "data_deletion_receipts_counts_check" CHECK("data_deletion_receipts"."deleted_row_count" >= 0 AND "data_deletion_receipts"."dataset_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `data_deletion_receipts_report_hash_idx` ON `data_deletion_receipts` (`report_sha256`);--> statement-breakpoint
CREATE TABLE `data_subject_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`request_version` integer NOT NULL,
	`evidence_sha256` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `data_subject_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "data_subject_events_type_check" CHECK("data_subject_events"."event_type" IN ('export_completed', 'deletion_requested', 'deletion_scheduled', 'deletion_cancelled', 'deletion_executing')),
	CONSTRAINT "data_subject_events_version_check" CHECK("data_subject_events"."request_version" >= 1),
	CONSTRAINT "data_subject_events_evidence_hash_check" CHECK("data_subject_events"."evidence_sha256" IS NULL OR (length("data_subject_events"."evidence_sha256") = 64 AND "data_subject_events"."evidence_sha256" NOT GLOB '*[^0-9a-f]*'))
);
--> statement-breakpoint
CREATE INDEX `data_subject_events_request_created_idx` ON `data_subject_events` (`request_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `data_subject_events_user_created_idx` ON `data_subject_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `data_subject_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_type` text NOT NULL,
	`status` text NOT NULL,
	`manifest_sha256` text,
	`payload_sha256` text,
	`dataset_count` integer,
	`row_count` integer,
	`confirmation_sha256` text,
	`confirmation_hint` text,
	`confirm_by` text,
	`execute_after` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	`cancelled_at` text,
	CONSTRAINT "data_subject_requests_type_check" CHECK("data_subject_requests"."request_type" IN ('export', 'deletion')),
	CONSTRAINT "data_subject_requests_status_check" CHECK("data_subject_requests"."status" IN ('requested', 'scheduled', 'executing', 'completed', 'cancelled', 'failed')),
	CONSTRAINT "data_subject_requests_version_check" CHECK("data_subject_requests"."version" >= 1),
	CONSTRAINT "data_subject_requests_counts_check" CHECK(("data_subject_requests"."dataset_count" IS NULL OR "data_subject_requests"."dataset_count" >= 0) AND ("data_subject_requests"."row_count" IS NULL OR "data_subject_requests"."row_count" >= 0)),
	CONSTRAINT "data_subject_requests_manifest_hash_check" CHECK("data_subject_requests"."manifest_sha256" IS NULL OR (length("data_subject_requests"."manifest_sha256") = 64 AND "data_subject_requests"."manifest_sha256" NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "data_subject_requests_payload_hash_check" CHECK("data_subject_requests"."payload_sha256" IS NULL OR (length("data_subject_requests"."payload_sha256") = 64 AND "data_subject_requests"."payload_sha256" NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "data_subject_requests_confirmation_hash_check" CHECK("data_subject_requests"."confirmation_sha256" IS NULL OR (length("data_subject_requests"."confirmation_sha256") = 64 AND "data_subject_requests"."confirmation_sha256" NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "data_subject_requests_export_state_check" CHECK("data_subject_requests"."request_type" <> 'export' OR ("data_subject_requests"."status" = 'completed' AND "data_subject_requests"."manifest_sha256" IS NOT NULL AND "data_subject_requests"."payload_sha256" IS NOT NULL AND "data_subject_requests"."dataset_count" IS NOT NULL AND "data_subject_requests"."row_count" IS NOT NULL AND "data_subject_requests"."completed_at" IS NOT NULL AND "data_subject_requests"."cancelled_at" IS NULL)),
	CONSTRAINT "data_subject_requests_deletion_state_check" CHECK("data_subject_requests"."request_type" <> 'deletion' OR ("data_subject_requests"."status" = 'requested' AND "data_subject_requests"."confirmation_sha256" IS NOT NULL AND "data_subject_requests"."confirmation_hint" IS NOT NULL AND "data_subject_requests"."confirm_by" IS NOT NULL AND "data_subject_requests"."execute_after" IS NULL AND "data_subject_requests"."completed_at" IS NULL AND "data_subject_requests"."cancelled_at" IS NULL) OR ("data_subject_requests"."status" IN ('scheduled', 'executing') AND "data_subject_requests"."confirmation_sha256" IS NOT NULL AND "data_subject_requests"."confirmation_hint" IS NOT NULL AND "data_subject_requests"."confirm_by" IS NOT NULL AND "data_subject_requests"."execute_after" IS NOT NULL AND "data_subject_requests"."completed_at" IS NULL AND "data_subject_requests"."cancelled_at" IS NULL) OR ("data_subject_requests"."status" = 'cancelled' AND "data_subject_requests"."cancelled_at" IS NOT NULL AND "data_subject_requests"."completed_at" IS NULL) OR ("data_subject_requests"."status" = 'failed' AND "data_subject_requests"."completed_at" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `data_subject_requests_user_created_idx` ON `data_subject_requests` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `data_subject_requests_user_status_idx` ON `data_subject_requests` (`user_id`,`request_type`,`status`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `data_subject_requests_active_deletion_idx` ON `data_subject_requests` (`user_id`) WHERE "data_subject_requests"."request_type" = 'deletion' AND "data_subject_requests"."status" IN ('requested', 'scheduled', 'executing');