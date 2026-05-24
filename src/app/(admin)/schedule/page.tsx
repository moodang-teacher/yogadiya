'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
	ChevronLeft,
	ChevronRight,
	CalendarDays,
	List,
	Plus,
} from 'lucide-react';
import {
	format,
	addDays,
	addWeeks,
	subWeeks,
	addMonths,
	subMonths,
	isSameDay,
	isSameMonth,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import {
	getWeekDays,
	getCalendarDays,
	formatDateShort,
	isKoreanHoliday,
	cn,
} from '@/lib/utils';
import { ClassCard } from '@/components/schedule/ClassCard';
import { TopHeader } from '@/components/layout/TopHeader';
import { EmptyState, Spinner } from '@/components/ui';
import type { ClassSession } from '@/types';

type ViewMode = 'week' | 'month';

export default function SchedulePage() {
	const [viewMode, setViewMode] = useState<ViewMode>('week');
	const [baseDate, setBaseDate] = useState(new Date());
	const [selectedDate, setSelected] = useState(new Date());
	const [sessions, setSessions] = useState<ClassSession[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const { profile } = useAuth();
	const supabase = createClient();

	// 날짜 범위에 맞는 수업 조회
	const fetchSessions = useCallback(
		async (from: string, to: string) => {
			setIsLoading(true);
			const { data } = await supabase
				.from('class_sessions')
				.select('*, instructor:profiles!instructor_id(id, name)')
				.gte('session_date', from)
				.lte('session_date', to)
				.order('session_date')
				.order('start_time');
			setSessions((data as ClassSession[]) ?? []);
			setIsLoading(false);
		},
		[supabase],
	);

	useEffect(() => {
		if (viewMode === 'week') {
			const days = getWeekDays(baseDate);
			fetchSessions(
				format(days[0], 'yyyy-MM-dd'),
				format(days[days.length - 1], 'yyyy-MM-dd'),
			);
		} else {
			const y = baseDate.getFullYear();
			const m = baseDate.getMonth() + 1;
			const from = `${y}-${String(m).padStart(2, '0')}-01`;
			const lastDay = new Date(y, m, 0).getDate();
			const to = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
			fetchSessions(from, to);
		}
	}, [baseDate, viewMode, fetchSessions]);

	const weekDays = getWeekDays(baseDate);
	const calDays = getCalendarDays(
		baseDate.getFullYear(),
		baseDate.getMonth() + 1,
	);

	const selectedDateSessions = sessions.filter(
		(s) => s.session_date === format(selectedDate, 'yyyy-MM-dd'),
	);

	const sessionCountByDate = sessions.reduce<Record<string, number>>(
		(acc, s) => {
			acc[s.session_date] = (acc[s.session_date] ?? 0) + 1;
			return acc;
		},
		{},
	);

	return (
		<div className="flex flex-col min-h-dvh">
			{/* 헤더 */}
			<TopHeader
				showMenu
				rightSlot={
					<div className="flex items-center gap-1">
						<button
							onClick={() =>
								setViewMode((v) => (v === 'week' ? 'month' : 'week'))
							}
							className={cn(
								'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm font-semibold',
								'border border-outline-variant transition-colors',
								'hover:bg-surface-container',
							)}
						>
							{viewMode === 'week' ? (
								<CalendarDays size={14} />
							) : (
								<List size={14} />
							)}
							{viewMode === 'week' ? '월간' : '주간'}
						</button>
					</div>
				}
			/>

			<div className="flex-1 overflow-y-auto">
				{/* 월 네비게이션 */}
				<div className="px-4 pt-2 pb-3">
					<p className="text-label-sm text-on-surface-variant/80 tracking-wide">
						{viewMode === 'week' ? '주간 시간표' : '월간 시간표'}
					</p>
					<div className="flex items-center justify-between mt-0.5">
						<h2 className="text-headline-lg-mobile font-bold text-on-surface">
							{format(baseDate, 'yyyy년 M월', { locale: ko })}
						</h2>
						<div className="flex items-center gap-1">
							<button
								onClick={() => {
									const prev =
										viewMode === 'week'
											? subWeeks(baseDate, 1)
											: subMonths(baseDate, 1);
									setBaseDate(prev);
									setSelected(prev);
								}}
								className="btn-icon"
								aria-label="이전"
							>
								<ChevronLeft size={20} />
							</button>
							<button
								onClick={() => {
									setBaseDate(new Date());
									setSelected(new Date());
								}}
								className="px-3 py-1.5 text-label-sm text-on-surface-variant border border-outline-variant rounded-full hover:bg-surface-container transition-colors"
							>
								오늘
							</button>
							<button
								onClick={() => {
									const next =
										viewMode === 'week'
											? addWeeks(baseDate, 1)
											: addMonths(baseDate, 1);
									setBaseDate(next);
									setSelected(next);
								}}
								className="btn-icon"
								aria-label="다음"
							>
								<ChevronRight size={20} />
							</button>
						</div>
					</div>
				</div>

				{/* ── 주간 보기 ─────────────────────────────── */}
				{viewMode === 'week' && (
					<>
						{/* 요일 선택 바 */}
						<div className="px-4 pb-4">
							<div className="flex gap-1.5">
								{weekDays.map((day) => {
									const isSelected = isSameDay(day, selectedDate);
									const isToday = isSameDay(day, new Date());
									const isHoliday = isKoreanHoliday(day);
									const dow = day.getDay(); // 0=일, 6=토

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
											<span
												className={cn(
													'text-body-md font-medium',
													isSelected
														? 'text-on-primary/80'
														: 'text-on-surface-variant',
													!isSelected && dow === 0 && 'text-[#bb2118]',
													!isSelected && dow === 6 && 'text-[#1824bb]',
												)}
											>
												{['일', '월', '화', '수', '목', '금', '토'][dow]}
											</span>
											<span
												className={cn(
													'text-body-md font-bold mt-0.5 tabular-nums',
													isSelected ? 'text-on-primary' : 'text-on-surface',
													!isSelected && isToday && 'text-secondary-DEFAULT',
													!isSelected && dow === 0 && 'text-[#bb2118]',
													!isSelected && dow === 6 && 'text-[#1824bb]',
												)}
											>
												{day.getDate()}
											</span>
											{/* 수업 있는 날 도트 */}
											{sessionCountByDate[format(day, 'yyyy-MM-dd')] &&
												!isSelected && (
													<div className="w-1 h-1 rounded-full bg-secondary-DEFAULT mt-1" />
												)}
										</button>
									);
								})}
							</div>
						</div>

						{/* 선택일 수업 목록 */}
						<div className="px-4 space-y-3">
							<div className="flex items-center justify-between">
								<h3 className="text-headline-md font-bold text-on-surface">
									오늘의 수업
									<span className="text-body-md font-normal text-on-surface-variant ml-2">
										({selectedDateSessions.length})
									</span>
								</h3>
							</div>

							{isLoading ? (
								<div className="flex justify-center py-12">
									<Spinner size={32} />
								</div>
							) : selectedDateSessions.length === 0 ? (
								<EmptyState
									title="등록된 수업이 없습니다"
									description={
										isKoreanHoliday(selectedDate)
											? '공휴일입니다'
											: '+ 버튼으로 수업을 추가하세요'
									}
								/>
							) : (
								selectedDateSessions.map((session) => (
									<ClassCard
										key={session.id}
										session={session}
										href={`/schedule/${session.id}`}
									/>
								))
							)}
						</div>
					</>
				)}

				{/* ── 월간 보기 ─────────────────────────────── */}
				{viewMode === 'month' && (
					<>
						{/* 달력 */}
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
									const isToday = isSameDay(day, new Date());
									const count = sessionCountByDate[dateStr] ?? 0;
									const dow = day.getDay();

									return (
										<button
											key={idx}
											onClick={() => setSelected(day)}
											className={cn(
												'aspect-square flex flex-col items-center justify-center relative',
												'transition-colors duration-100',
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
													!isSelected &&
														isToday &&
														'border-2 border-secondary-DEFAULT',
												)}
											>
												<span
													className={cn(
														'text-body-sm font-semibold tabular-nums',
														isSelected ? 'text-on-primary' : 'text-on-surface',
														!isSelected && dow === 0 && 'text-error',
														!isSelected && dow === 6 && 'text-blue-500',
													)}
												>
													{day.getDate()}
												</span>
											</div>
											{/* 수업 도트 (최대 3개) */}
											{count > 0 && inMonth && (
												<div className="flex gap-0.5 mt-0.5">
													{Array.from({ length: Math.min(count, 3) }).map(
														(_, i) => (
															<div
																key={i}
																className={cn(
																	'w-1 h-1 rounded-full',
																	isSelected
																		? 'bg-on-primary/60'
																		: 'bg-secondary-DEFAULT',
																)}
															/>
														),
													)}
												</div>
											)}
										</button>
									);
								})}
							</div>
						</div>

						{/* 선택일 수업 목록 */}
						<div className="px-4 mt-4 space-y-3 pb-4">
							<div className="flex items-center justify-between">
								<h3 className="text-body-lg font-bold text-on-surface">
									{format(selectedDate, 'M월 d일 (E)', { locale: ko })} 수업
									<span className="text-body-md font-normal text-on-surface-variant ml-2">
										총 {selectedDateSessions.length}건
									</span>
								</h3>
							</div>
							{isLoading ? (
								<div className="flex justify-center py-8">
									<Spinner size={32} />
								</div>
							) : selectedDateSessions.length === 0 ? (
								<EmptyState title="이 날은 수업이 없습니다" />
							) : (
								selectedDateSessions.map((session) => (
									<ClassCard
										key={session.id}
										session={session}
										href={`/schedule/${session.id}`}
									/>
								))
							)}
						</div>
					</>
				)}
			</div>

			{/* FAB */}
			{(profile?.role === 'admin' || profile?.role === 'manager') && (
				<Link
					href="/schedule/new"
					className={cn(
						'fixed bottom-28 right-4 z-40',
						'w-14 h-14 rounded-full bg-primary text-on-primary',
						'flex items-center justify-center shadow-xl',
						'transition-all duration-150 active:scale-90 hover:bg-primary-container',
					)}
					aria-label="수업 추가"
				>
					<Plus size={26} strokeWidth={2} />
				</Link>
			)}
		</div>
	);
}
