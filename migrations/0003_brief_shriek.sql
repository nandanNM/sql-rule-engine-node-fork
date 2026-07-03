CREATE TABLE "problem_run_counts" (
	"user_id" uuid NOT NULL,
	"problem_id" text NOT NULL,
	"run_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "problem_run_counts_user_id_problem_id_pk" PRIMARY KEY("user_id","problem_id")
);
--> statement-breakpoint
CREATE TABLE "problem_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"problem_id" text NOT NULL,
	"schema_name" text NOT NULL,
	"sql" text NOT NULL,
	"correct" boolean,
	"runtime_ms" integer,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "problem_run_counts" ADD CONSTRAINT "problem_run_counts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_run_counts" ADD CONSTRAINT "problem_run_counts_problem_id_problems_problem_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("problem_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_runs" ADD CONSTRAINT "problem_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_runs" ADD CONSTRAINT "problem_runs_problem_id_problems_problem_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("problem_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "problem_runs_user_id_idx" ON "problem_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "problem_runs_problem_id_idx" ON "problem_runs" USING btree ("problem_id");