ALTER TABLE "problems" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "difficulty" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "concepts" jsonb;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "problem_statement" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "expected_rule_codes" jsonb;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "followup_question" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "debrief_hint" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "developer_note" text;