CREATE TABLE `instances` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `api_url` text NOT NULL,
  `api_key_encrypted` text,
  `oidc_client_id` text,
  `oidc_client_secret_encrypted` text,
  `is_default` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
