CREATE TABLE "temp_dispute" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"field" varchar(50) NOT NULL,
	"discovered_value" text,
	"db_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
