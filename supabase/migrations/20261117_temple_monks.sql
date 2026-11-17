-- 절로 · 스님 인증
-- 관리자가 사찰별 초대 코드를 만들어 스님께 전함 → 스님이 앱에서 코드를 한 번 넣으면
-- 그 기기에서 만든 서명 열쇠(공개키)가 등록되고, 이후 그 기기만 "○○사 ○○ 스님"으로 보임
-- 표는 서버 함수(temple-admin, service role)만 읽고 씀: 공개 키로는 직접 읽거나 쓸 수 없음
create table if not exists public.temple_monks (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  temple text not null,
  name text not null check (char_length(name) between 1 and 12),
  code_hash text unique,              -- 초대 코드(해시), 인증되면 지움
  code_expires timestamptz,
  pubkey text,                        -- 스님 기기의 서명 공개키 (P-256, base64)
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  revoked_at timestamptz,
  last_seen timestamptz,
  last_t bigint,                      -- 마지막 접속 확인 시각(같은 서명 재사용 막기)
  cur_region text,
  cur_temple text
);
alter table public.temple_monks enable row level security;
revoke all on public.temple_monks from anon, authenticated;
