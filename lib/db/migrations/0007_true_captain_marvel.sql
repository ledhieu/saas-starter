-- Enable PostGIS extension (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint

CREATE TABLE "staging_competitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"fresha_pid" varchar(50),
	"business_type" varchar(50),
	"address" text,
	"city" varchar(100),
	"latitude" text,
	"longitude" text,
	"location" geography(Point, 4326),
	"rating" text,
	"reviews_count" integer,
	"phone" varchar(50),
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staging_competitors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "staging_services" (
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
ALTER TABLE "competitors" ADD COLUMN "location" geography(Point, 4326);--> statement-breakpoint
CREATE INDEX "idx_competitors_location" ON "competitors" USING GIST("location");--> statement-breakpoint

-- Trigger: auto-populate location from latitude/longitude on insert/update
CREATE OR REPLACE FUNCTION sync_competitor_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude::float8, NEW.latitude::float8), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trigger_sync_competitor_location
BEFORE INSERT OR UPDATE ON "competitors"
FOR EACH ROW
EXECUTE FUNCTION sync_competitor_location();
--> statement-breakpoint

-- Trigger for staging_competitors
CREATE TRIGGER trigger_sync_staging_competitor_location
BEFORE INSERT OR UPDATE ON "staging_competitors"
FOR EACH ROW
EXECUTE FUNCTION sync_competitor_location();
--> statement-breakpoint

-- RPC: find competitors within radius (km)
CREATE OR REPLACE FUNCTION rpc_find_competitors_within_radius(
  center_lat double precision,
  center_lng double precision,
  radius_km double precision
)
RETURNS TABLE(id integer, name varchar, slug varchar, distance_meters double precision) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    ST_Distance(c.location, ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography) AS distance_meters
  FROM competitors c
  WHERE c.location IS NOT NULL
    AND ST_DWithin(
      c.location,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- RPC: distance between two points (km)
CREATE OR REPLACE FUNCTION rpc_distance_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision AS $$
BEGIN
  RETURN ST_Distance(
    ST_SetSRID(ST_MakePoint(lng1, lat1), 4326)::geography,
    ST_SetSRID(ST_MakePoint(lng2, lat2), 4326)::geography
  ) / 1000.0;
END;
$$ LANGUAGE plpgsql;
ALTER TABLE "staging_services" ADD CONSTRAINT "staging_services_competitor_id_staging_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."staging_competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_staging_services_competitor_fetched" ON "staging_services" USING btree ("competitor_id","fetched_at");