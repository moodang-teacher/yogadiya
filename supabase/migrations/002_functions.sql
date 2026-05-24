-- ============================================================
-- 요가디야 - Core Business Logic Functions
-- ============================================================

-- ============================================================
-- FUNCTION: book_session
-- 예약 요청을 원자적으로 처리 (동시성 제어)
-- ============================================================

create or replace function book_session(
  p_session_id  uuid,
  p_member_id   uuid,
  p_pass_id     uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_session     class_sessions%rowtype;
  v_pass        member_passes%rowtype;
  v_booking_id  uuid;
  v_waitlist_order int;
begin
  -- 1) 세션 row 잠금 (동시성 제어 핵심)
  select * into v_session
  from class_sessions
  where id = p_session_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'SESSION_NOT_FOUND');
  end if;

  if v_session.status != 'scheduled' then
    return jsonb_build_object('ok', false, 'error', 'SESSION_NOT_AVAILABLE');
  end if;

  -- 2) 중복 예약 확인 (취소된 건 제외)
  if exists (
    select 1 from bookings
    where session_id = p_session_id
      and member_id  = p_member_id
      and status not in ('cancelled')
  ) then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_BOOKED');
  end if;

  -- 3) 수강권 유효성 확인
  select * into v_pass
  from member_passes
  where id = p_pass_id
    and member_id = p_member_id
    and is_active = true
    and expire_date >= current_date
    and (remaining_count is null or remaining_count > 0)
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'PASS_INVALID');
  end if;

  -- 4) 정원 확인 → 대기열로 분기
  if v_session.current_count < v_session.max_capacity then
    -- 즉시 예약 확정
    insert into bookings (session_id, member_id, pass_id, status)
    values (p_session_id, p_member_id, p_pass_id, 'confirmed')
    returning id into v_booking_id;

    update class_sessions
    set current_count = current_count + 1
    where id = p_session_id;

    -- 수강권 횟수 차감
    if v_pass.remaining_count is not null then
      update member_passes
      set remaining_count = remaining_count - 1
      where id = p_pass_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'status', 'confirmed',
      'booking_id', v_booking_id
    );

  elsif v_session.waitlist_count < v_session.waitlist_max then
    -- 대기열 등록
    select coalesce(max(waitlist_order), 0) + 1 into v_waitlist_order
    from bookings
    where session_id = p_session_id and status = 'waitlisted';

    insert into bookings (session_id, member_id, pass_id, status, waitlist_order)
    values (p_session_id, p_member_id, p_pass_id, 'waitlisted', v_waitlist_order)
    returning id into v_booking_id;

    update class_sessions
    set waitlist_count = waitlist_count + 1
    where id = p_session_id;

    return jsonb_build_object(
      'ok', true,
      'status', 'waitlisted',
      'waitlist_order', v_waitlist_order,
      'booking_id', v_booking_id
    );

  else
    return jsonb_build_object('ok', false, 'error', 'FULLY_BOOKED');
  end if;
end;
$$;

-- ============================================================
-- FUNCTION: cancel_booking
-- 예약 취소 + 대기자 자동 승격
-- ============================================================

create or replace function cancel_booking(
  p_booking_id  uuid,
  p_cancelled_by_role user_role default 'member'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_booking     bookings%rowtype;
  v_session     class_sessions%rowtype;
  v_next_wait   bookings%rowtype;
  v_cutoff      timestamptz;
begin
  -- 1) 예약 row 잠금
  select * into v_booking
  from bookings
  where id = p_booking_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'BOOKING_NOT_FOUND');
  end if;

  if v_booking.status not in ('confirmed', 'waitlisted') then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_CANCELLED');
  end if;

  -- 2) 세션 잠금
  select * into v_session
  from class_sessions
  where id = v_booking.session_id
  for update;

  -- 3) 취소 가능 시간 확인 (회원: 수업 시작 2시간 전까지)
  if p_cancelled_by_role = 'member' then
    v_cutoff := (v_session.session_date + v_session.start_time)::timestamptz - interval '2 hours';
    if now() > v_cutoff then
      return jsonb_build_object('ok', false, 'error', 'CANCEL_DEADLINE_PASSED');
    end if;
  end if;

  -- 4) 예약 취소 처리
  update bookings
  set status = 'cancelled', cancelled_at = now()
  where id = p_booking_id;

  -- 5) 수강권 횟수 복구 (confirmed 상태였을 경우만)
  if v_booking.status = 'confirmed' and v_booking.pass_id is not null then
    update member_passes
    set remaining_count = remaining_count + 1
    where id = v_booking.pass_id
      and remaining_count is not null;

    update class_sessions
    set current_count = greatest(current_count - 1, 0)
    where id = v_booking.session_id;

    -- 6) 대기자 1번 자동 승격
    select * into v_next_wait
    from bookings
    where session_id = v_booking.session_id
      and status = 'waitlisted'
    order by waitlist_order asc
    limit 1
    for update;

    if found then
      -- 대기자 수강권 확인 후 승격
      if exists (
        select 1 from member_passes
        where id = v_next_wait.pass_id
          and is_active = true
          and expire_date >= current_date
          and (remaining_count is null or remaining_count > 0)
      ) then
        update bookings
        set status = 'confirmed', waitlist_order = null
        where id = v_next_wait.id;

        update class_sessions
        set current_count   = current_count + 1,
            waitlist_count  = greatest(waitlist_count - 1, 0)
        where id = v_booking.session_id;

        -- 승격된 대기자의 수강권 차감
        update member_passes
        set remaining_count = remaining_count - 1
        where id = v_next_wait.pass_id
          and remaining_count is not null;
      else
        -- 수강권 만료된 대기자는 건너뜀
        update bookings
        set status = 'cancelled', cancelled_at = now()
        where id = v_next_wait.id;

        update class_sessions
        set waitlist_count = greatest(waitlist_count - 1, 0)
        where id = v_booking.session_id;
      end if;
    end if;

  elsif v_booking.status = 'waitlisted' then
    update class_sessions
    set waitlist_count = greatest(waitlist_count - 1, 0)
    where id = v_booking.session_id;

    -- 대기 순번 재정렬
    update bookings
    set waitlist_order = waitlist_order - 1
    where session_id = v_booking.session_id
      and status = 'waitlisted'
      and waitlist_order > v_booking.waitlist_order;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- FUNCTION: close_attendance
-- 수업 종료 후 출결 마감 (노쇼 자동 처리)
-- ============================================================

create or replace function close_attendance(p_session_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_no_show_count int;
begin
  -- confirmed 상태이나 attended_at이 없는 예약 → no_show
  update bookings
  set status = 'no_show'
  where session_id = p_session_id
    and status = 'confirmed'
    and attended_at is null;

  get diagnostics v_no_show_count = row_count;

  -- 세션 상태 완료로 변경
  update class_sessions
  set status = 'completed'
  where id = p_session_id;

  return jsonb_build_object(
    'ok', true,
    'no_show_count', v_no_show_count
  );
end;
$$;

-- ============================================================
-- FUNCTION: generate_sessions_from_template
-- 템플릿으로부터 특정 월의 수업 세션 일괄 생성
-- Preview 모드 지원 (실제 INSERT 없이 결과만 반환)
-- ============================================================

create or replace function generate_sessions_from_template(
  p_template_id  uuid,
  p_year         int,
  p_month        int,
  p_preview      boolean default true
)
returns table (
  session_date  date,
  start_time    time,
  end_time      time,
  name          text,
  instructor_id uuid,
  is_holiday    boolean
)
language plpgsql
security definer
as $$
declare
  v_template  class_templates%rowtype;
  v_date      date;
  v_start     date;
  v_end       date;
  v_dow       int;
begin
  select * into v_template from class_templates where id = p_template_id;

  if not found or not v_template.is_active then
    return;
  end if;

  v_start := make_date(p_year, p_month, 1);
  v_end   := (v_start + interval '1 month - 1 day')::date;
  v_date  := v_start;

  while v_date <= v_end loop
    -- 0=일, 1=월 ... 6=토 (PostgreSQL extract dow: 0=일)
    v_dow := extract(dow from v_date)::int;

    if v_dow = any(v_template.recurrence_days) then
      return query select
        v_date,
        v_template.start_time,
        (v_template.start_time + (v_template.duration_min || ' minutes')::interval)::time,
        v_template.name,
        v_template.instructor_id,
        false::boolean; -- 공휴일 여부는 앱에서 처리
    end if;

    v_date := v_date + 1;
  end loop;

  -- preview=false 이면 실제 insert
  if not p_preview then
    insert into class_sessions (
      template_id, name, category, level_label,
      instructor_id, session_date, start_time, end_time,
      max_capacity, min_capacity, waitlist_max, color, notes
    )
    select
      v_template.id, v_template.name, v_template.category, v_template.level_label,
      v_template.instructor_id,
      gs.session_date, gs.start_time, gs.end_time,
      v_template.max_capacity, v_template.min_capacity,
      v_template.waitlist_max, v_template.color, v_template.notes
    from generate_sessions_from_template(p_template_id, p_year, p_month, true) gs
    on conflict do nothing;
  end if;
end;
$$;

-- ============================================================
-- FUNCTION: calculate_payroll
-- 강사 월 급여 계산
-- ============================================================

create or replace function calculate_payroll(
  p_instructor_id  uuid,
  p_year           int,
  p_month          int
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_rate         int;
  v_sessions     int;
  v_total_min    int;
  v_total_hours  numeric(6,2);
  v_total_pay    int;
begin
  -- 해당 기간의 유효한 시급 조회
  select hourly_rate into v_rate
  from instructor_pay
  where instructor_id = p_instructor_id
    and effective_from <= make_date(p_year, p_month, 1)
  order by effective_from desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'NO_PAY_RATE');
  end if;

  -- 완료된 수업 집계
  select
    count(*)::int,
    coalesce(sum(extract(epoch from (cs.end_time - cs.start_time)) / 60), 0)::int
  into v_sessions, v_total_min
  from class_sessions cs
  where cs.instructor_id = p_instructor_id
    and cs.status = 'completed'
    and extract(year from cs.session_date) = p_year
    and extract(month from cs.session_date) = p_month;

  v_total_hours := round(v_total_min::numeric / 60, 2);
  v_total_pay   := (v_total_hours * v_rate)::int;

  -- upsert payroll record
  insert into payroll_records
    (instructor_id, year, month, total_sessions, total_hours, total_pay)
  values
    (p_instructor_id, p_year, p_month, v_sessions, v_total_hours, v_total_pay)
  on conflict (instructor_id, year, month)
  do update set
    total_sessions = excluded.total_sessions,
    total_hours    = excluded.total_hours,
    total_pay      = excluded.total_pay,
    calculated_at  = now();

  return jsonb_build_object(
    'ok',           true,
    'sessions',     v_sessions,
    'total_hours',  v_total_hours,
    'hourly_rate',  v_rate,
    'total_pay',    v_total_pay
  );
end;
$$;
