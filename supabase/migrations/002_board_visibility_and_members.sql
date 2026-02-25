-- 보드 공개/비공개 및 멤버/가입요청

-- 1) visibility 컬럼 추가 (기본값 비공개)
alter table public.boards
  add column if not exists visibility text not null default 'private'
  check (visibility in ('public', 'private'));

-- 2) board_members: 비공개 보드에 초대된 사용자 (소유자 제외)
create table if not exists public.board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor')),
  created_at timestamptz not null default now(),
  unique (board_id, user_id)
);

create index if not exists idx_board_members_board_id on public.board_members(board_id);
create index if not exists idx_board_members_user_id on public.board_members(user_id);

alter table public.board_members enable row level security;

-- 본인이 멤버인 행만 조회
create policy "Users can read own member rows"
  on public.board_members for select
  using (auth.uid() = user_id);

-- 보드 소유자만 멤버 추가/삭제
create policy "Board owners can insert members"
  on public.board_members for insert
  with check (
    exists (
      select 1 from public.boards b
      where b.id = board_id and b.user_id = auth.uid()
    )
  );

create policy "Board owners can delete members"
  on public.board_members for delete
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_id and b.user_id = auth.uid()
    )
  );

-- 3) board_join_requests: 비공개 보드 가입 요청
create table if not exists public.board_join_requests (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (board_id, user_id)
);

create index if not exists idx_board_join_requests_board_id on public.board_join_requests(board_id);
create index if not exists idx_board_join_requests_user_id on public.board_join_requests(user_id);

alter table public.board_join_requests enable row level security;

-- 본인 요청만 조회, 보드 소유자는 해당 보드 요청 목록 조회 가능
create policy "Users can read own join requests"
  on public.board_join_requests for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.boards b
      where b.id = board_id and b.user_id = auth.uid()
    )
  );

-- 본인만 가입 요청 생성 (pending)
create policy "Users can insert own join request"
  on public.board_join_requests for insert
  with check (auth.uid() = user_id and status = 'pending');

-- 보드 소유자만 status 업데이트 (accept/reject)
create policy "Board owners can update join requests"
  on public.board_join_requests for update
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_id and b.user_id = auth.uid()
    )
  );

-- 4) boards RLS 정책 수정: 기존 정책 삭제 후 재정의
drop policy if exists "Users can read own boards" on public.boards;

-- 조회: 소유자 OR 공개 OR 멤버
create policy "Users can read accessible boards"
  on public.boards for select
  using (
    auth.uid() = user_id
    or visibility = 'public'
    or exists (
      select 1 from public.board_members m
      where m.board_id = id and m.user_id = auth.uid()
    )
  );

-- 수정: 소유자 OR 멤버 (공개 보드도 타인은 수정 불가, 멤버만)
drop policy if exists "Users can update own boards" on public.boards;
create policy "Owners and members can update board"
  on public.boards for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.board_members m
      where m.board_id = id and m.user_id = auth.uid()
    )
  );

-- 삭제는 소유자만 (기존 유지)
-- insert는 기존 정책 유지 (본인 user_id로만 생성)