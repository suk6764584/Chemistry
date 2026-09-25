create table if not exists items (
  id text primary key,
  user_id text not null,
  original_type text not null,
  original_content text,
  image_data text,
  image_mime text,
  source_url text,
  title text,
  summary text,
  category text not null default 'other',
  extracted_date date,
  extracted_time text,
  expiration_date date,
  location text,
  address text,
  amount text,
  phone text,
  reservation_number text,
  coupon_brand text,
  coupon_product text,
  action_type text,
  recommended_actions jsonb not null default '[]'::jsonb,
  confidence jsonb not null default '{}'::jsonb,
  analysis_status text not null default 'pending',
  analysis_error text,
  status text not null default 'inbox',
  reminder_date date,
  reminder_enabled boolean not null default false,
  do_today boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_user_id_idx on items (user_id);
create index if not exists items_user_status_idx on items (user_id, status);
create index if not exists items_user_created_idx on items (user_id, created_at desc);
