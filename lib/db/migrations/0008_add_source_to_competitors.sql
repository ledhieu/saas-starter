ALTER TABLE "competitors" ADD COLUMN "source" varchar(20);
ALTER TABLE "competitors" ADD COLUMN "google_place_id" varchar(100);
CREATE INDEX "idx_competitors_source" ON "competitors" USING btree ("source");
