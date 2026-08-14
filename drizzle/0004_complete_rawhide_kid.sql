CREATE TABLE `capability_lease_events` (
	`id` text PRIMARY KEY NOT NULL,
	`lease_id` text NOT NULL,
	`run_id` text,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`lease_version` integer NOT NULL,
	`remaining_uses` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`lease_id`) REFERENCES `capability_leases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "capability_lease_events_type_check" CHECK("capability_lease_events"."event_type" IN ('created', 'consumed', 'revoked')),
	CONSTRAINT "capability_lease_events_version_check" CHECK("capability_lease_events"."lease_version" >= 1),
	CONSTRAINT "capability_lease_events_remaining_check" CHECK("capability_lease_events"."remaining_uses" >= 0)
);
--> statement-breakpoint
CREATE INDEX `capability_lease_events_lease_created_idx` ON `capability_lease_events` (`lease_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `capability_lease_events_user_created_idx` ON `capability_lease_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `capability_lease_events_run_idx` ON `capability_lease_events` (`run_id`);--> statement-breakpoint
CREATE TABLE `capability_leases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`capability` text NOT NULL,
	`mode` text NOT NULL,
	`scope_kind` text NOT NULL,
	`project_id` text,
	`status` text NOT NULL,
	`max_uses` integer NOT NULL,
	`remaining_uses` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`expires_at` text NOT NULL,
	`last_event_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "capability_leases_capability_check" CHECK("capability_leases"."capability" = 'model.run'),
	CONSTRAINT "capability_leases_mode_check" CHECK("capability_leases"."mode" IN ('fast', 'team', 'deep')),
	CONSTRAINT "capability_leases_scope_check" CHECK(("capability_leases"."scope_kind" = 'account' AND "capability_leases"."project_id" IS NULL) OR ("capability_leases"."scope_kind" = 'project' AND "capability_leases"."project_id" IS NOT NULL)),
	CONSTRAINT "capability_leases_status_check" CHECK("capability_leases"."status" IN ('active', 'revoked', 'depleted')),
	CONSTRAINT "capability_leases_usage_check" CHECK("capability_leases"."max_uses" >= 1 AND "capability_leases"."max_uses" <= 20 AND "capability_leases"."remaining_uses" >= 0 AND "capability_leases"."remaining_uses" <= "capability_leases"."max_uses"),
	CONSTRAINT "capability_leases_version_check" CHECK("capability_leases"."version" >= 1),
	CONSTRAINT "capability_leases_state_check" CHECK(("capability_leases"."status" = 'active' AND "capability_leases"."remaining_uses" > 0 AND "capability_leases"."revoked_at" IS NULL) OR ("capability_leases"."status" = 'revoked' AND "capability_leases"."revoked_at" IS NOT NULL) OR ("capability_leases"."status" = 'depleted' AND "capability_leases"."remaining_uses" = 0 AND "capability_leases"."revoked_at" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `capability_leases_user_status_expires_idx` ON `capability_leases` (`user_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `capability_leases_project_status_idx` ON `capability_leases` (`project_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `capability_leases_last_event_idx` ON `capability_leases` (`last_event_id`);--> statement-breakpoint
ALTER TABLE `runs` ADD `capability_lease_id` text REFERENCES capability_leases(id);--> statement-breakpoint
CREATE INDEX `runs_capability_lease_created_idx` ON `runs` (`capability_lease_id`,`created_at`);