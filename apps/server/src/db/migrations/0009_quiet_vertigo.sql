-- TimescaleDB hypertables with columnstore don't allow non-constant defaults like now()
-- So we add columns as nullable first, backfill, then set NOT NULL

-- Add last_seen_at as nullable first
ALTER TABLE "sessions" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint

-- Backfill existing rows: use started_at as the initial last_seen_at value
UPDATE "sessions" SET "last_seen_at" = "started_at" WHERE "last_seen_at" IS NULL;--> statement-breakpoint

-- Now set NOT NULL constraint (no default needed - app always provides value)
ALTER TABLE "sessions" ALTER COLUMN "last_seen_at" SET NOT NULL;--> statement-breakpoint

-- Add force_stopped column
ALTER TABLE "sessions" ADD COLUMN "force_stopped" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Add short_session column
ALTER TABLE "sessions" ADD COLUMN "short_session" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Create index for stale session detection
CREATE INDEX "sessions_stale_detection_idx" ON "sessions" USING btree ("last_seen_at","stopped_at");
