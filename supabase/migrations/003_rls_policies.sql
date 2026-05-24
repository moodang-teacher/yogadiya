-- ============================================================
-- 요가디야 - Row Level Security Policies
-- ============================================================

alter table profiles          enable row level security;
alter table class_templates   enable row level security;
alter table class_sessions    enable row level security;
alter table pass_types        enable row level security;
alter table member_passes     enable row level security;
alter table bookings          enable row level security;
alter table instructor_pay    enable row level security;
alter table payroll_records   enable row level security;

-- ============================================================
-- Helper: 현재 사용자 역할 조회
-- ============================================================

create or replace function get_my_role()
returns user_role
language sql
stable
security definer
as $$
  select role from profiles where id = auth.uid();
$$;

-- ============================================================
-- PROFILES
-- ============================================================

-- 본인 프로필은 항상 조회 가능
create policy "profiles_select_own"
  on profiles for select
  using (id = auth.uid());

-- 관리자/매니저는 전체 조회
create policy "profiles_select_admin"
  on profiles for select
  using (get_my_role() in ('admin', 'manager'));

-- 강사는 회원 목록 조회 가능 (이름, 전화번호 정도)
create policy "profiles_select_instructor"
  on profiles for select
  using (get_my_role() = 'instructor');

-- 관리자/매니저만 생성, 수정
create policy "profiles_insert_admin"
  on profiles for insert
  with check (get_my_role() in ('admin', 'manager'));

create policy "profiles_update_admin"
  on profiles for update
  using (get_my_role() in ('admin', 'manager') or id = auth.uid());

-- 관리자만 삭제 (논리 삭제 권장)
create policy "profiles_delete_admin"
  on profiles for delete
  using (get_my_role() = 'admin');

-- ============================================================
-- CLASS TEMPLATES
-- ============================================================

create policy "templates_select_all"
  on class_templates for select
  using (auth.uid() is not null);

create policy "templates_write_admin"
  on class_templates for all
  using (get_my_role() in ('admin', 'manager'));

-- ============================================================
-- CLASS SESSIONS
-- ============================================================

create policy "sessions_select_all"
  on class_sessions for select
  using (auth.uid() is not null);

create policy "sessions_write_admin"
  on class_sessions for all
  using (get_my_role() in ('admin', 'manager'));

-- 강사는 본인 수업 상태 수정 가능 (출결 처리)
create policy "sessions_update_instructor"
  on class_sessions for update
  using (
    get_my_role() = 'instructor'
    and instructor_id = auth.uid()
  );

-- ============================================================
-- PASS TYPES
-- ============================================================

create policy "pass_types_select_all"
  on pass_types for select
  using (auth.uid() is not null);

create policy "pass_types_write_admin"
  on pass_types for all
  using (get_my_role() in ('admin', 'manager'));

-- ============================================================
-- MEMBER PASSES
-- ============================================================

-- 본인 수강권 조회
create policy "member_passes_select_own"
  on member_passes for select
  using (member_id = auth.uid());

-- 관리자/매니저 전체 조회 및 수정
create policy "member_passes_all_admin"
  on member_passes for all
  using (get_my_role() in ('admin', 'manager'));

-- ============================================================
-- BOOKINGS
-- ============================================================

-- 본인 예약 조회
create policy "bookings_select_own"
  on bookings for select
  using (member_id = auth.uid());

-- 관리자/매니저/강사 전체 조회 (강사는 본인 수업만)
create policy "bookings_select_admin"
  on bookings for select
  using (get_my_role() in ('admin', 'manager'));

create policy "bookings_select_instructor"
  on bookings for select
  using (
    get_my_role() = 'instructor'
    and exists (
      select 1 from class_sessions
      where id = session_id and instructor_id = auth.uid()
    )
  );

-- 회원은 본인 예약 생성 가능 (RPC 함수 통해서만)
create policy "bookings_insert_own"
  on bookings for insert
  with check (member_id = auth.uid() or get_my_role() in ('admin', 'manager'));

-- 출석 체크: 강사, 관리자
create policy "bookings_update_admin"
  on bookings for update
  using (get_my_role() in ('admin', 'manager', 'instructor'));

-- 회원 본인 취소 (RPC 함수 통해서만)
create policy "bookings_update_own"
  on bookings for update
  using (member_id = auth.uid());

-- ============================================================
-- INSTRUCTOR PAY
-- ============================================================

-- 관리자만 조회/수정
create policy "instructor_pay_admin"
  on instructor_pay for all
  using (get_my_role() = 'admin');

-- 본인 시급 조회
create policy "instructor_pay_self"
  on instructor_pay for select
  using (instructor_id = auth.uid() and get_my_role() = 'instructor');

-- ============================================================
-- PAYROLL RECORDS
-- ============================================================

create policy "payroll_admin"
  on payroll_records for all
  using (get_my_role() = 'admin');

create policy "payroll_self"
  on payroll_records for select
  using (instructor_id = auth.uid() and get_my_role() = 'instructor');
