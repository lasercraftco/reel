-- Increase default daily_request_quota from 5 to 10 for all users.
-- Friends now get auto-approved adds instead of manual approval gate.

ALTER TABLE users ALTER COLUMN daily_request_quota SET DEFAULT 10;
UPDATE users SET daily_request_quota = 10 WHERE daily_request_quota = 5;
