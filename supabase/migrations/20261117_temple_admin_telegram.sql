-- 사찰 제보 텔레그램 알림 · 관리자 로그인용 (Supabase SQL Editor에 붙여 넣고 Run)
-- 지우는 문장 없이 새 칸·새 표·알림 연결만 추가해요
create extension if not exists pg_net with schema extensions;

alter table public.temple_reports add column if not exists notified_at timestamptz;
alter table public.temple_reports add column if not exists updated_at timestamptz;

-- 운영자 설정(텔레그램 채팅 연결) · 로그인 코드 · 로그인 세션: 모두 비공개 (Edge Function만 씀)
create table if not exists public.admin_kv (key text primary key, value text, updated_at timestamptz not null default now());
create table if not exists public.admin_codes (id bigint generated always as identity primary key, code_hash text not null, created_at timestamptz not null default now(), expires_at timestamptz not null, tries int not null default 0, used boolean not null default false);
create table if not exists public.admin_sessions (token_hash text primary key, created_at timestamptz not null default now(), expires_at timestamptz not null);
alter table public.admin_kv enable row level security;
alter table public.admin_codes enable row level security;
alter table public.admin_sessions enable row level security;

-- 새 제보가 저장되면 Edge Function을 불러 텔레그램으로 알림 (함수는 아직 안 보낸 제보만 골라 보내므로 여러 번 불려도 안전)
create or replace function public.temple_report_notify() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://tozyoprymcvznkeqmrqp.supabase.co/functions/v1/temple-admin',
    body := jsonb_build_object('action', 'notify'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_7FGPTjvPHWj-oF_EiiSjcg_MI63-mqE'),
    timeout_milliseconds := 8000);
  return null;
exception when others then return null; -- 알림이 실패해도 제보 저장은 그대로
end $$;
create trigger temple_report_notify after insert on public.temple_reports for each statement execute function public.temple_report_notify();
