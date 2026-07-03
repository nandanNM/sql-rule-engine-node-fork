CREATE TABLE "attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"session_question_id" text NOT NULL,
	"final_query" text,
	"explanation_text" text,
	"edge_case_text" text,
	"is_correct" boolean,
	"score" integer,
	"final_submitted_at" timestamp DEFAULT now(),
	"feedback_summary" text,
	"rubric_scores" jsonb,
	"rule_results" jsonb
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"problem_id" text,
	"session_mode" text DEFAULT 'interview' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_question_id_session_questions_id_fk" FOREIGN KEY ("session_question_id") REFERENCES "public"."session_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_questions" ADD CONSTRAINT "session_questions_problem_id_problems_problem_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("problem_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");