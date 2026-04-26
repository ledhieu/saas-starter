CREATE TABLE "competitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"fresha_pid" varchar(50),
	"business_type" varchar(50),
	"address" text,
	"city" varchar(100),
	"latitude" text,
	"longitude" text,
	"rating" text,
	"reviews_count" integer,
	"phone" varchar(50),
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "competitors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "search_lookups" (
	"id" serial PRIMARY KEY NOT NULL,
	"address_query" text NOT NULL,
	"radius_km" integer NOT NULL,
	"business_type" varchar(50),
	"latitude" text,
	"longitude" text,
	"results_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"competitor_id" integer NOT NULL,
	"category_name" varchar(255),
	"name" varchar(255) NOT NULL,
	"duration_caption" varchar(100),
	"price_formatted" varchar(50),
	"price_value_min" integer,
	"price_value_max" integer,
	"catalog_id" varchar(50),
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;