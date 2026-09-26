-- User-facing note from analysis: what the user should check before the item
-- leaves the inbox (uncertain date, unread link, example data, ...).
alter table items add column if not exists analysis_note text;
