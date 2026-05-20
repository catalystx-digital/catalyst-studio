-- Add Kontent to IntegrationProvider enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'kontent'
      AND enumtypid = (
        SELECT t.oid
        FROM pg_type AS t
        JOIN pg_namespace AS n ON n.oid = t.typnamespace
        WHERE t.typname = 'IntegrationProvider'
          AND n.nspname = 'public'
      )
  ) THEN
    ALTER TYPE "public"."IntegrationProvider" ADD VALUE 'kontent';
  END IF;
END;
$$;
