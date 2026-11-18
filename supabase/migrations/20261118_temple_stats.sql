-- 수월 · 순례 기록 순위 (절 횟수 · 방석에 앉아 있던 시간 · 화면을 켜고 머문 시간)
-- 기기마다 무작위 기록 번호(id)와 비밀 열쇠(해시만 저장)로 기록 → 남의 기록에 덧붙일 수 없음
-- 서버 함수(temple-admin)가 실제로 흐른 시간보다 많이 올리지 못하게 잘라서 더함 (켜 둔 만큼만 쌓임)
-- 오늘 기록(d_*)은 한국 날짜(day)가 바뀌면 0부터 다시 셈
-- 표는 서버 함수(service role)만 읽고 씀: 공개 키로는 직접 읽거나 쓸 수 없음
create table if not exists public.temple_stats (
  id uuid primary key,
  key_hash text not null,
  nick text not null default '' check (char_length(nick) <= 16),
  monk_id uuid references public.temple_monks(id) on delete set null, -- 서명으로 확인된 스님이면 금빛 표시
  bows integer not null default 0,
  sit_sec integer not null default 0,
  stay_sec integer not null default 0,
  day date,
  d_bows integer not null default 0,
  d_sit integer not null default 0,
  d_stay integer not null default 0,
  last_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.temple_stats enable row level security;
revoke all on public.temple_stats from anon, authenticated;
create index if not exists temple_stats_bows on public.temple_stats (bows desc);
create index if not exists temple_stats_sit on public.temple_stats (sit_sec desc);
create index if not exists temple_stats_stay on public.temple_stats (stay_sec desc);
create index if not exists temple_stats_day on public.temple_stats (day);
