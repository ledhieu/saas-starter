CREATE TABLE "search_session_competitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"competitor_id" integer NOT NULL,
	"distance_km" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"address_query" text,
	"radius_km" integer,
	"business_type" varchar(50),
	"latitude" text,
	"longitude" text,
	"results_count" integer,
	"cursor" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "search_session_competitors" ADD CONSTRAINT "search_session_competitors_session_id_search_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."search_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_session_competitors" ADD CONSTRAINT "search_session_competitors_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_sessions" ADD CONSTRAINT "search_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;