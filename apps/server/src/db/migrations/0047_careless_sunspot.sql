CREATE TABLE "rule_action_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"violation_id" uuid,
	"rule_id" uuid,
	"action_type" varchar(50) NOT NULL,
	"success" boolean NOT NULL,
	"skipped" boolean DEFAULT false,
	"skip_reason" text,
	"error_message" text,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rule_action_results" ADD CONSTRAINT "rule_action_results_violation_id_violations_id_fk" FOREIGN KEY ("violation_id") REFERENCES "public"."violations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_action_results" ADD CONSTRAINT "rule_action_results_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rule_action_results_violation" ON "rule_action_results" USING btree ("violation_id");--> statement-breakpoint
CREATE INDEX "idx_rule_action_results_rule" ON "rule_action_results" USING btree ("rule_id");