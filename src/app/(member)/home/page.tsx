'use client';

import { useState, useEffect, useCallback } from 'react';
import {
	format,
	addWeeks,
	subWeeks,
	addMonths,
	subMonths,
	isSameDay,
	isSameMonth,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { TopHeader } from '@/components/layout/TopHeader';
import {
	ResultModal,
	Badge,
	CapacityBadge,
	Spinner,
	EmptyState,
} from '@/components/ui';
import {
	getWeekDays,
	getCalendarDays,
	cn,
	canCancelBooking,
} from '@/lib/utils';
import type {
	ClassSession,
	Booking,
	MemberPass,
	BookSessionResult,
} from '@/types';

type ViewMode = 'week' | 'month';

// 요일 색상 (일=빨강, 토=파랑, 선택됨이면 on-primary로 덮어씀)
function getDayTextColor(dow: number, isSelected: boolean) {
	if (isSelected) return 'text-on-primary';
	if (dow === 0) return 'text-[#bb2118]';
	if (dow === 6) return 'text-[#1824bb]';
	return '';
}

export default function MemberHomePage() {
	const { profile } = useAuth();
	const supabase = createClient();

	const [viewMode, setViewMode] = useState<ViewMode>('week');
	const [baseDate, setBaseDate] = useState(new Date());
	const [selectedDate, setSelected] = useState(new Date());
	const [sessions, setSessions] = useState<ClassSession[]>([]);
	const [myBookings, setMyBookings] = useState<Booking[]>([]);
	const [myPass, setMyPass] = useState<MemberPass | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [sheetSession, setSheetSession] = useState<ClassSession | null>(null);
	const [resultModal, setResultModal] = useState<{
		open: boolean;
		type: 'success' | 'error';
		title: string;
		desc: string;
	} | null>(null);

	const weekDays = getWeekDays(baseDate);
	const calDays = getCalendarDays(
		baseDate.getFullYear(),
		baseDate.getMonth() + 1,
	);

	const fetchData = useCallback(
		async (from: string, to: string) => {
			if (!profile) return;
			setIsLoading(true);
			const [{ data: sessData }, { data: bookData }, { data: passData }] =
				await Promise.all([
					supabase
						.from('class_sessions')
						.select('*, instructor:profiles!instructor_id(id, name)')
						.gte('session_date', from)
						.lte('session_date', to)
						.eq('status', 'scheduled')
						.order('session_date')
						.order('start_time'),
					supabase
						.from('bookings')
						.select('*')
						.eq('member_id', profile.id)
						.in('status', ['confirmed', 'waitlisted']),
					supabase
						.from('member_passes')
						.select('*, pass_type:pass_types(name)')
						.eq('member_id', profile.id)
						.eq('is_active', true)
						.gte('expire_date', format(new Date(), 'yyyy-MM-dd'))
						.order('expire_date')
						.limit(1)
						.maybeSingle(),
				]);
			setSessions((sessData as ClassSession[]) ?? []);
			setMyBookings((bookData as Booking[]) ?? []);
			setMyPass(passData as MemberPass | null);
			setIsLoading(false);
		},
		[profile, supabase],
	);

	useEffect(() => {
		if (viewMode === 'week') {
			const days = getWeekDays(baseDate);
			fetchData(
				format(days[0], 'yyyy-MM-dd'),
				format(days[days.length - 1], 'yyyy-MM-dd'),
			);
		} else {
			const y = baseDate.getFullYear();
			const m = baseDate.getMonth() + 1;
			const last = new Date(y, m, 0).getDate();
			fetchData(
				`${y}-${String(m).padStart(2, '0')}-01`,
				`${y}-${String(m).padStart(2, '0')}-${last}`,
			);
		}
	}, [baseDate, viewMode, fetchData]);

	const goPrev = () =>
		viewMode === 'week'
			? setBaseDate((d) => subWeeks(d, 1))
			: setBaseDate((d) => subMonths(d, 1));
	const goNext = () =>
		viewMode === 'week'
			? setBaseDate((d) => addWeeks(d, 1))
			: setBaseDate((d) => addMonths(d, 1));

	const today = new Date();
	const selectedSessions = sessions.filter(
		(s) => s.session_date === format(selectedDate, 'yyyy-MM-dd'),
	);
	const sessionCountByDate = sessions.reduce<Record<string, number>>(
		(acc, s) => {
			acc[s.session_date] = (acc[s.session_date] ?? 0) + 1;
			return acc;
		},
		{},
	);
	const getMyBooking = (sid: string) =>
		myBookings.find((b) => b.session_id === sid);

	const handleBook = async (session: ClassSession) => {
		if (!profile || !myPass) return;
		setSheetSession(null);
		const result = (await supabase.rpc('book_session', {
			p_session_id: session.id,
			p_member_id: profile.id,
			p_pass_id: myPass.id,
		})) as { data: BookSessionResult };
		const res = result.data;
		if (res?.ok) {
			setResultModal({
				open: true,
				type: 'success',
				title: res.status === 'confirmed' ? '예약 완료!' : '대기 등록 완료',
				desc:
					res.status === 'confirmed'
						? '수업이 예약되었습니다.'
						: `대기 ${res.waitlist_order}번으로 등록되었습니다.`,
			});
			const days = getWeekDays(baseDate);
			fetchData(
				format(days[0], 'yyyy-MM-dd'),
				format(days[days.length - 1], 'yyyy-MM-dd'),
			);
		} else {
			const msgs: Record<string, string> = {
				PASS_INVALID: '유효한 수강권이 없습니다.',
				ALREADY_BOOKED: '이미 예약된 수업입니다.',
				FULLY_BOOKED: '대기 인원도 마감되었습니다.',
				SESSION_NOT_AVAILABLE: '수업이 취소되었습니다.',
			};
			setResultModal({
				open: true,
				type: 'error',
				title: '예약 실패',
				desc: msgs[res?.error ?? ''] ?? '오류가 발생했습니다.',
			});
		}
	};

	const handleCancel = async (booking: Booking, session: ClassSession) => {
		setSheetSession(null);
		if (!canCancelBooking(session.session_date, session.start_time, 'member')) {
			setResultModal({
				open: true,
				type: 'error',
				title: '취소 불가',
				desc: '수업 시작 2시간 전에는 취소할 수 없습니다.',
			});
			return;
		}
		const { data } = await supabase.rpc('cancel_booking', {
			p_booking_id: booking.id,
			p_cancelled_by_role: 'member',
		});
		const days = getWeekDays(baseDate);
		if (data?.ok) {
			setResultModal({
				open: true,
				type: 'success',
				title: '예약 취소 완료',
				desc: '예약이 취소되었습니다.',
			});
			fetchData(
				format(days[0], 'yyyy-MM-dd'),
				format(days[days.length - 1], 'yyyy-MM-dd'),
			);
		} else {
			setResultModal({
				open: true,
				type: 'error',
				title: '취소 실패',
				desc: '오류가 발생했습니다.',
			});
		}
	};

	return (
		<div className="flex flex-col min-h-dvh">
			{/* ── 헤더 ── */}
			<TopHeader
				showMenu
				rightSlot={
					<button
						onClick={() =>
							setViewMode((v) => (v === 'week' ? 'month' : 'week'))
						}
						className={cn(
							'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm font-semibold',
							'border border-outline-variant transition-colors hover:bg-surface-container',
						)}
					>
						{viewMode === 'week' ? (
							<CalendarDays size={14} />
						) : (
							<List size={14} />
						)}
						{viewMode === 'week' ? '월간' : '주간'}
					</button>
				}
			/>

			<div className="flex-1 overflow-y-auto pb-20">
				{/* ── 수강권 카드 (관리자 원본 디자인 동일) ── */}
				{myPass ? (
					<div className="mx-4 mt-3 card bg-primary p-4 text-on-primary">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-label-sm text-on-primary/70">내 수강권</p>
								<p className="text-body-md font-bold mt-0.5">
									{(myPass as any).pass_type?.name ?? '수강권'}
								</p>
							</div>
							<div className="text-right">
								<p className="text-label-sm text-on-primary/70">잔여</p>
								<p className="text-headline-md font-bold !text-accent">
									{myPass.remaining_count !== null
										? `${myPass.remaining_count}회`
										: '무제한'}
								</p>
							</div>
						</div>
						<p className="text-label-sm text-on-primary/60 mt-2">
							만료: {myPass.expire_date}
						</p>
					</div>
				) : (
					<div className="mx-4 mt-3 card p-4">
						<p className="text-body-sm text-on-surface-variant text-center">
							유효한 수강권이 없습니다. 원장님께 문의해주세요.
						</p>
					</div>
				)}

				{/* ── 네비게이션 (관리자 화면 동일 구조) ── */}
				<div className="px-4 pt-3 pb-3">
					<p className="text-label-sm text-on-surface-variant/80 tracking-wide">
						{viewMode === 'week' ? '주간 시간표' : '월간 시간표'}
					</p>
					<div className="flex items-center justify-between mt-0.5">
						<h2 className="text-headline-lg-mobile font-bold text-on-surface">
							{format(baseDate, 'yyyy년 M월', { locale: ko })}
						</h2>
						<div className="flex items-center gap-1">
							<button onClick={goPrev} className="btn-icon" aria-label="이전">
								<ChevronLeft size={20} />
							</button>
							<button
								onClick={() => {
									setBaseDate(today);
									setSelected(today);
								}}
								className="px-3 py-1.5 text-label-sm text-on-surface-variant border border-outline-variant rounded-full hover:bg-surface-container transition-colors"
							>
								오늘
							</button>
							<button onClick={goNext} className="btn-icon" aria-label="다음">
								<ChevronRight size={20} />
							</button>
						</div>
					</div>
				</div>

				{/* ── 주간 보기 ── */}
				{viewMode === 'week' && (
					<>
						<div className="px-4 pb-4">
							<div className="flex gap-1.5">
								{weekDays.map((day) => {
									const isSelected = isSameDay(day, selectedDate);
									const isToday = isSameDay(day, today);
									const dow = day.getDay();
									return (
										<button
											key={day.toISOString()}
											onClick={() => setSelected(day)}
											className={cn(
												'flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all duration-150',
												isSelected
													? 'bg-primary text-on-primary shadow-sm'
													: 'hover:bg-surface-container',
											)}
										>
											{/* 요일명 */}
											<span
												className={cn(
													'text-body-md font-medium',
													getDayTextColor(dow, isSelected),
												)}
											>
												{['일', '월', '화', '수', '목', '금', '토'][dow]}
											</span>
											{/* 날짜 숫자 */}
											<span
												className={cn(
													'text-body-md font-bold mt-0.5 tabular-nums',
													getDayTextColor(dow, isSelected),
													!isSelected &&
														isToday &&
														'underline underline-offset-2',
												)}
											>
												{format(day, 'd')}
											</span>
										</button>
									);
								})}
							</div>
						</div>

						{/* 선택 날짜 수업 목록 */}
						<div className="px-4">
							<p className="text-label-sm text-on-surface-variant/80 mb-3">
								{format(selectedDate, 'M월 d일 (E)', { locale: ko })} 수업 (
								{selectedSessions.length})
							</p>
							{isLoading ? (
								<div className="flex justify-center py-12">
									<Spinner size={32} />
								</div>
							) : selectedSessions.length === 0 ? (
								<EmptyState title="수업이 없습니다" />
							) : (
								<div className="flex flex-col gap-3">
									{selectedSessions.map((session) => (
										<SessionCard
											key={session.id}
											session={session}
											myBooking={getMyBooking(session.id)}
											onOpen={() => setSheetSession(session)}
										/>
									))}
								</div>
							)}
						</div>
					</>
				)}

				{/* ── 월간 보기 ── */}
				{viewMode === 'month' && (
					<>
						<div className="mx-4 card overflow-hidden">
							{/* 요일 헤더 */}
							<div className="grid grid-cols-7 border-b border-outline-variant">
								{['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
									<div
										key={d}
										className={cn(
											'text-center py-2 text-label-sm font-semibold',
											i === 0
												? 'text-[#bb2118]'
												: i === 6
													? 'text-[#1824bb]'
													: 'text-on-surface-variant',
										)}
									>
										{d}
									</div>
								))}
							</div>
							{/* 날짜 */}
							<div className="grid grid-cols-7 border-b border-outline-variant/50">
								{calDays.map((day, idx) => {
									const dateStr = format(day, 'yyyy-MM-dd');
									const inMonth = isSameMonth(day, baseDate);
									const isSelected = isSameDay(day, selectedDate);
									const isToday = isSameDay(day, today);
									const count = sessionCountByDate[dateStr] ?? 0;
									const dow = day.getDay();
									return (
										<button
											key={idx}
											onClick={() => setSelected(day)}
											className={cn(
												'aspect-square flex flex-col items-center justify-center relative transition-colors duration-100',
												idx % 7 !== 0 && 'border-l border-outline-variant/50',
												Math.floor(idx / 7) !== 0 &&
													'border-t border-outline-variant/50',
												!inMonth && 'opacity-30',
											)}
										>
											<div
												className={cn(
													'w-8 h-8 rounded-full flex items-center justify-center',
													isSelected && 'bg-primary',
													!isSelected && isToday && 'border-2 border-primary',
												)}
											>
												<span
													className={cn(
														'text-body-sm font-semibold tabular-nums',
														isSelected
															? 'text-on-primary'
															: getDayTextColor(dow, false),
														!isSelected &&
															!getDayTextColor(dow, false) &&
															'text-on-surface',
													)}
												>
													{format(day, 'd')}
												</span>
											</div>
											{count > 0 && (
												<span
													className={cn(
														'w-1 h-1 rounded-full mt-0.5',
														isSelected ? 'bg-on-primary/60' : 'bg-primary',
													)}
												/>
											)}
										</button>
									);
								})}
							</div>
						</div>

						{/* 선택 날짜 수업 목록 */}
						<div className="px-4 mt-4">
							<p className="text-label-sm text-on-surface-variant/80 mb-3">
								{format(selectedDate, 'M월 d일 (E)', { locale: ko })} 수업 (
								{selectedSessions.length})
							</p>
							{isLoading ? (
								<div className="flex justify-center py-12">
									<Spinner size={32} />
								</div>
							) : selectedSessions.length === 0 ? (
								<EmptyState title="수업이 없습니다" />
							) : (
								<div className="flex flex-col gap-3">
									{selectedSessions.map((session) => (
										<SessionCard
											key={session.id}
											session={session}
											myBooking={getMyBooking(session.id)}
											onOpen={() => setSheetSession(session)}
										/>
									))}
								</div>
							)}
						</div>
					</>
				)}
			</div>

			{/* ── 예약/취소 바텀시트 ── */}
			{sheetSession &&
				(() => {
					const myBooking = getMyBooking(sheetSession.id);
					const isBooked = !!myBooking;
					const isFull =
						sheetSession.current_count >= sheetSession.max_capacity;
					return (
						<>
							<div
								className="fixed inset-0 z-[90] bg-black/40"
								onClick={() => setSheetSession(null)}
							/>
							<div className="fixed inset-x-0 bottom-0 z-[100] bg-surface rounded-t-3xl shadow-xl px-5 pt-5 pb-24 max-w-md mx-auto">
								<div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-4" />
								<p className="text-headline-md font-bold text-on-surface mb-1">
									{sheetSession.name}
								</p>

								<p className="text-body-md text-on-surface-variant">
									{format(selectedDate, 'M월 d일 (E)', { locale: ko })}
									{' · '}
									{sheetSession.start_time?.slice(0, 5)}–
									{sheetSession.end_time?.slice(0, 5)}
								</p>
								{(sheetSession as any).instructor && (
									<p className="text-body-md text-on-surface-variant mt-0.5">
										{(sheetSession as any).instructor.name} 강사
									</p>
								)}
								<div className="flex items-center gap-3 mt-3 mb-5">
									<CapacityBadge
										current={sheetSession.current_count}
										max={sheetSession.max_capacity}
									/>
									{myPass?.remaining_count != null && !isBooked && (
										<span className="text-body-md text-on-surface-variant">
											예약 후 잔여{' '}
											<strong className="text-primary">
												{myPass.remaining_count - 1}회
											</strong>
										</span>
									)}
								</div>
								{isBooked ? (
									<button
										className="w-full py-4 rounded-lg bg-error text-white font-semibold text-body-md transition-opacity hover:opacity-90"
										onClick={() => handleCancel(myBooking!, sheetSession)}
									>
										예약 취소
									</button>
								) : (
									<button
										className="btn-primary w-full text-body-md"
										disabled={!myPass}
										onClick={() => handleBook(sheetSession)}
									>
										{isFull ? '대기 등록' : '예약하기'}
									</button>
								)}
								{!myPass && (
									<p className="text-body-md text-error text-center mt-2">
										유효한 수강권이 없습니다.
									</p>
								)}
							</div>
						</>
					);
				})()}

			{resultModal?.open && (
				<ResultModal
					type={resultModal.type}
					title={resultModal.title}
					description={resultModal.desc}
					onClose={() => setResultModal(null)}
				/>
			)}
		</div>
	);
}

// ── 수업 카드 (공통) ──────────────────────────────────────
function SessionCard({
	session,
	myBooking,
	onOpen,
}: {
	session: ClassSession;
	myBooking: Booking | undefined;
	onOpen: () => void;
}) {
	return (
		<div
			className={cn(
				'card p-4 cursor-pointer active:bg-surface-container transition-all',
				myBooking ? 'border-2 border-primary' : 'border border-outline-variant',
			)}
			onClick={onOpen}
		>
			<div className="flex items-center justify-between gap-3">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-0.5 flex-wrap">
						<span className="text-label-sm text-on-surface-variant">
							{session.start_time?.slice(0, 5)}–{session.end_time?.slice(0, 5)}
						</span>
						{myBooking?.status === 'waitlisted' && (
							<Badge variant="warning">대기</Badge>
						)}
						{myBooking?.status === 'confirmed' && (
							<Badge variant="success">예약완료</Badge>
						)}
					</div>
					<p className="text-body-md font-semibold text-on-surface truncate">
						{session.name}
					</p>
					{(session as any).instructor && (
						<p className="text-body-sm text-on-surface-variant">
							{(session as any).instructor.name} 강사
						</p>
					)}
				</div>
				<div className="shrink-0">
					<CapacityBadge
						current={session.current_count}
						max={session.max_capacity}
					/>
				</div>
			</div>
		</div>
	);
}
