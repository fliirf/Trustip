-- =============================================================================
-- Trustip v1.1 — private Storage bucket for refund evidence (REFUND-EVIDENCE-1)
--
-- Dispute evidence (photos/videos/receipts a buyer attaches to a refund
-- request) is sensitive. The bucket is PRIVATE: storage.objects has RLS enabled
-- by default and we add NO anon/authenticated policies, so only the service_role
-- (which bypasses RLS) can read/write. Every upload and every admin view goes
-- through the service-role backend, exactly like the rest of the app — clients
-- never touch the bucket directly, and reads are served via short-lived signed
-- URLs the backend generates.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'refund-evidence',
  'refund-evidence',
  false,
  10485760, -- 10 MB per file (MVP cap)
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime',
    'application/pdf'
  ]
)
on conflict (id) do nothing;
