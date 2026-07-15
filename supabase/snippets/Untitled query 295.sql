INSERT INTO public.users (
  id,
  email,
  display_name,
  role,
  auth_provider,
  status
)
SELECT
  id,
  email,
  'Admin',
  'admin',
  'email',
  'active'
FROM auth.users
WHERE email = 'admin@gmail.com'
ON CONFLICT (id)
DO UPDATE SET
  role = 'admin',
  status = 'active',
  updated_at = now();