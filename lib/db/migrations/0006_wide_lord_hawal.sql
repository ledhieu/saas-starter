CREATE TABLE "service_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"competitor_id" integer NOT NULL,
	"catalog_id" varchar(50),
	"service_name" varchar(255) NOT NULL,
	"field" varchar(50) NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_audit_log" ADD CONSTRAINT "service_audit_log_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;