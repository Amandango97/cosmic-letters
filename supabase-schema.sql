-- ─────────────────────────────────────────────────────────────
-- cosmic-letters: Supabase schema
-- Paste this into the Supabase SQL Editor and click Run
-- ─────────────────────────────────────────────────────────────

-- Letters table
create table if not exists letters (
  id          uuid primary key default gen_random_uuid(),
  from_user   uuid references auth.users(id) not null,
  to_user     uuid references auth.users(id) not null,
  from_label  text not null,           -- 'A' or 'B'
  title       text,
  body        text,
  status      text not null default 'open',  -- 'open' | 'locked'
  read_at     timestamptz,
  created_at  timestamptz default now()
);

-- Comments table
create table if not exists comments (
  id           uuid primary key default gen_random_uuid(),
  letter_id    uuid references letters(id) on delete cascade not null,
  author_id    uuid references auth.users(id) not null,
  author_label text not null,          -- 'A' or 'B'
  span_text    text not null,          -- the highlighted passage
  body         text not null,
  created_at   timestamptz default now()
);

-- ── Row Level Security ───────────────────────────────────────
alter table letters  enable row level security;
alter table comments enable row level security;

-- Users can see letters they sent or received
create policy "letters: read own"
  on letters for select
  using (auth.uid() = from_user or auth.uid() = to_user);

-- Users can insert letters they are sending
create policy "letters: insert own"
  on letters for insert
  with check (auth.uid() = from_user);

-- Only the author can update (seal/unseal) their letter
create policy "letters: update own"
  on letters for update
  using (auth.uid() = from_user or auth.uid() = to_user);

-- Users can see comments on letters they can see
create policy "comments: read own"
  on comments for select
  using (
    exists (
      select 1 from letters
      where letters.id = comments.letter_id
        and (letters.from_user = auth.uid() or letters.to_user = auth.uid())
    )
  );

-- Users can insert comments on letters they can see
create policy "comments: insert own"
  on comments for insert
  with check (
    auth.uid() = author_id and
    exists (
      select 1 from letters
      where letters.id = comments.letter_id
        and (letters.from_user = auth.uid() or letters.to_user = auth.uid())
    )
  );
