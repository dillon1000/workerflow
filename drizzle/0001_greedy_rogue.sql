CREATE TABLE "workflow_effects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"run_id" text NOT NULL,
	"node_id" text NOT NULL,
	"effect_key" text NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"status" text NOT NULL,
	"request_hash" text NOT NULL,
	"output_json" text,
	"remote_ref" text,
	"error" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ADD COLUMN "trace_json" text;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_effects_user_effect_key_idx" ON "workflow_effects" USING btree ("user_id","effect_key");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_run_steps_run_node_idx" ON "workflow_run_steps" USING btree ("run_id","node_id");