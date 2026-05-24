-- ============================================================
-- 요가디야 (Yogadiya) - Initial Schema
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('admin', 'manager', 'instructor', 'member');
create type session_status as enum ('scheduled', 'cancelled', 'completed');
create type booking_status as enum ('confirmed', 'waitlisted', 'cancelled', 'attended', 'no_show');
create type class_category as enum ('flying', 'low_flying', 'kids_flying', 'mat_yoga');

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  phone       text not null unique,
  birthday    date,
  address     text,
  role        user_role not null default 'member',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- CLASS TEMPLATES (반복 수업 패턴 정의)
-- ============================================================

create table class_templates (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,          -- e.g. "레벨0 플라잉요가 입문"
  category         class_category not null default 'flying',
  level_label      text,                   -- e.g. "LEVEL 0", "ADVANCED"
  max_capacity     int not null default 8, -- 해먹 수
  min_capacity     int not null default 2, -- 이하이면 수업 취소
  waitlist_max     int not null default 5,
  duration_min     int not null default 60,
  instructor_id    uuid references profiles(id) on delete set null,
  recurrence_days  int[] not null default '{}', -- 0=일,1=월,...,6=토
  start_time       time not null,
  color            text default '#5d4037', -- 캘린더 표시용 색상
  is_active        boolean not null default true,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- CLASS SESSIONS (실제 수업 인스턴스)
-- ============================================================

create table class_sessions (
  id              uuid primary key default uuid_generate_v4(),
  template_id     uuid references class_templates(id) on delete set null,
  name            text not null,           -- 템플릿에서 복사 (수정 가능)
  category        class_category not null default 'flying',
  level_label     text,
  instructor_id   uuid references profiles(id) on delete set null,
  session_date    date not null,
  start_time      time not null,
  end_time        time not null,
  max_capacity    int not null,
  min_capacity    int not null default 2,
  waitlist_max    int not null default 5,
  current_count   int not null default 0,  -- 확정된 예약 수
  waitlist_count  int not null default 0,  -- 대기 중 인원 수
  status          session_status not null default 'scheduled',
  color           text default '#5d4037',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint sessions_capacity_check check (current_count <= max_capacity),
  constraint sessions_time_check check (end_time > start_time)
);

create index idx_sessions_date on class_sessions(session_date);
create index idx_sessions_instructor on class_sessions(instructor_id);
create index idx_sessions_status on class_sessions(status);

-- ============================================================
-- PASS TYPES (수강권 종류)
-- ============================================================

create table pass_types (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,           -- "10회권", "24회권", "무제한"
  total_count    int,                     -- null = 무제한
  validity_days  int not null,            -- 유효 기간 (일)
  price          int not null default 0, -- 원
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- 기본 수강권 데이터
insert into pass_types (name, total_count, validity_days, price) values
  ('10회권',  10,   60,  0),
  ('24회권',  24,   90,  0),
  ('36회권',  36,  120,  0),
  ('72회권',  72,  240,  0),
  ('무제한권', null, 365, 0);

-- ============================================================
-- MEMBER PASSES (회원이 보유한 수강권)
-- ============================================================

create table member_passes (
  id               uuid primary key default uuid_generate_v4(),
  member_id        uuid not null references profiles(id) on delete cascade,
  pass_type_id     uuid not null references pass_types(id),
  remaining_count  int,                   -- null = 무제한
  start_date       date not null,
  expire_date      date not null,
  is_active        boolean not null default true,
  note             text,                  -- 관리자 메모
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_passes_member on member_passes(member_id);
create index idx_passes_active on member_passes(is_active, expire_date);

-- ============================================================
-- BOOKINGS (예약)
-- ============================================================

create table bookings (
  id              uuid primary key default uuid_generate_v4(),
  session_id      uuid not null references class_sessions(id) on delete cascade,
  member_id       uuid not null references profiles(id) on delete cascade,
  pass_id         uuid references member_passes(id) on delete set null,
  status          booking_status not null default 'confirmed',
  waitlist_order  int,                    -- 대기 순번 (null이면 대기 아님)
  booked_at       timestamptz not null default now(),
  cancelled_at    timestamptz,
  attended_at     timestamptz,
  note            text,                   -- 관리자 메모 (노쇼 취소 사유 등)

  constraint bookings_unique_active unique (session_id, member_id, status)
    deferrable initially deferred
);

create index idx_bookings_session on bookings(session_id);
create index idx_bookings_member on bookings(member_id);
create index idx_bookings_status on bookings(status);
create index idx_bookings_pass on bookings(pass_id);

-- ============================================================
-- INSTRUCTOR PAY (강사 시급)
-- ============================================================

create table instructor_pay (
  id              uuid primary key default uuid_generate_v4(),
  instructor_id   uuid not null references profiles(id) on delete cascade,
  hourly_rate     int not null,           -- 원/시간
  effective_from  date not null default current_date,
  created_at      timestamptz not null default now()
);

create index idx_instructor_pay on instructor_pay(instructor_id, effective_from desc);

-- ============================================================
-- PAYROLL RECORDS (급여 정산 기록)
-- ============================================================

create table payroll_records (
  id              uuid primary key default uuid_generate_v4(),
  instructor_id   uuid not null references profiles(id),
  year            int not null,
  month           int not null,
  total_sessions  int not null default 0,
  total_hours     numeric(6,2) not null default 0,
  total_pay       int not null default 0,
  calculated_at   timestamptz not null default now(),
  calculated_by   uuid references profiles(id),

  constraint payroll_unique unique (instructor_id, year, month)
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger trg_templates_updated_at
  before update on class_templates
  for each row execute function update_updated_at();

create trigger trg_sessions_updated_at
  before update on class_sessions
  for each row execute function update_updated_at();

create trigger trg_passes_updated_at
  before update on member_passes
  for each row execute function update_updated_at();
