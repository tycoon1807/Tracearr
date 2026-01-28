-- Drop views that depend on sessions.grandparent_title
-- These will be recreated by initTimescaleDB() on server startup
DROP VIEW IF EXISTS top_shows_by_engagement CASCADE;
DROP VIEW IF EXISTS show_engagement_summary CASCADE;
DROP VIEW IF EXISTS user_engagement_profile CASCADE;
DROP VIEW IF EXISTS top_content_by_plays CASCADE;
DROP VIEW IF EXISTS daily_show_intensity CASCADE;
DROP VIEW IF EXISTS content_engagement_summary CASCADE;
DROP VIEW IF EXISTS episode_continuity_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS daily_content_engagement CASCADE;
--> statement-breakpoint
ALTER TABLE "library_items" ALTER COLUMN "title" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "library_items" ALTER COLUMN "grandparent_title" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "library_items" ALTER COLUMN "parent_title" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "grandparent_title" SET DATA TYPE text;
