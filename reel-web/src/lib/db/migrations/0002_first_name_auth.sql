-- 2026-04-26: switch from email/magic-link to first-name SSO.
-- Backward-compat: keep email column nullable; backfill username from
-- email local-part for any existing rows. Drop magic_links table.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username      varchar(50),
  ADD COLUMN IF NOT EXISTS display_name  varchar(200),
  ADD COLUMN IF NOT EXISTS is_owner      boolean NOT NULL DEFAULT false;

UPDATE users
   SET username = lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9]', '', 'g'))
 WHERE username IS NULL
   AND email IS NOT NULL;

UPDATE users
   SET username = 'user_' || substr(replace(id::text, '-', ''), 1, 12)
 WHERE username IS NULL OR username = '';

UPDATE users
   SET display_name = COALESCE(name, split_part(email, '@', 1), username)
 WHERE display_name IS NULL;

UPDATE users
   SET is_owner = true, role = 'owner'
 WHERE lower(coalesce(email,'')) = 'tylerheon@gmail.com'
    OR lower(coalesce(username,'')) = 'tyler';

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users(username);
DROP INDEX IF EXISTS uq_users_email;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

DROP TABLE IF EXISTS magic_links;
