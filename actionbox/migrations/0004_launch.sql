-- Agreement to the terms and privacy policy: one row per agreement, kept as
-- proof of which versions the user accepted and when. Deleted with the account.
create table if not exists consent_log (
  id text primary key,
  user_id text not null,
  terms_version text not null,
  privacy_version text not null,
  age_confirmed boolean not null,
  agreed_at timestamptz not null default now()
);

create index if not exists consent_log_user_idx on consent_log (user_id, agreed_at desc);

-- Automatic-analysis calls per user per day (Asia/Seoul) for the daily cap.
-- Rows older than 35 days are removed by housekeeping.
create table if not exists ai_usage (
  user_id text not null,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);
