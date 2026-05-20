-- Convert Website.icon from text to jsonb to support media references
ALTER TABLE "Website"
  ALTER COLUMN "icon" TYPE jsonb USING CASE
    WHEN "icon" IS NULL THEN NULL
    ELSE to_jsonb("icon")
  END;
