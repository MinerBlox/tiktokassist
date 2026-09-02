PRAGMA foreign_keys = ON;

CREATE TABLE `entries` (
  `id` text PRIMARY KEY NOT NULL,
  `text` text NOT NULL,
  `urls_json` text NOT NULL,
  `normalized_urls_json` text NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE `entry_links` (
  `normalized_url` text PRIMARY KEY NOT NULL,
  `entry_id` text NOT NULL,
  FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `idx_entry_links_entry_id` ON `entry_links` (`entry_id`);

PRAGMA optimize;
