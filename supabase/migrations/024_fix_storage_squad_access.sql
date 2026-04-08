-- Migration 024: Fix Storage bucket policies to allow squad members
-- The attachments table RLS was already updated to squad-based access (migration 020),
-- but the Storage object policies still used the old account_id check.
-- This blocked any squad member who wasn't the original account_id from uploading files.

-- Drop old account_id-only policies for all buckets
DROP POLICY IF EXISTS "attachments account"  ON storage.objects;
DROP POLICY IF EXISTS "brand-logos account"  ON storage.objects;
DROP POLICY IF EXISTS "brand-media account"  ON storage.objects;
DROP POLICY IF EXISTS "project-docs account" ON storage.objects;

-- Recreate with squad-based access (mirrors the table RLS pattern from migration 020)
CREATE POLICY "attachments squad member" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM projects_v2
      WHERE squad IS NOT NULL AND is_squad_member(squad)
    )
  );

CREATE POLICY "brand-logos squad member" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'brand-logos'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM projects_v2
      WHERE squad IS NOT NULL AND is_squad_member(squad)
    )
  );

CREATE POLICY "brand-media squad member" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'brand-media'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM projects_v2
      WHERE squad IS NOT NULL AND is_squad_member(squad)
    )
  );

CREATE POLICY "project-docs squad member" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'project-docs'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM projects_v2
      WHERE squad IS NOT NULL AND is_squad_member(squad)
    )
  );
