-- 보드 저장용 테이블 (Supabase SQL Editor에서 실행)
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null default '제목 없음',
  content jsonb not null default '{"lines":[],"textNodes":[]}'::jsonb,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS 활성화
alter table public.boards enable row level security;

-- 본인 보드만 조회/수정/삭제
create policy "Users can read own boards"
  on public.boards for select
  using (auth.uid() = user_id);

create policy "Users can insert own boards"
  on public.boards for insert
  with check (auth.uid() = user_id);

create policy "Users can update own boards"
  on public.boards for update
  using (auth.uid() = user_id);

create policy "Users can delete own boards"
  on public.boards for delete
  using (auth.uid() = user_id);

-- updated_at 자동 갱신 (선택)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger boards_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();
