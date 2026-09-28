CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY,
	`actor_id` text,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`details` text,
	`created_at` integer NOT NULL
);
