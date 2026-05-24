'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { TopHeader } from '@/components/layout/TopHeader';
import { Badge, EmptyState, Spinner } from '@/components/ui';
import { formatPhone, cn } from '@/lib/utils';
import type { Booking, MemberPass, PassType } from '@/types';

interface BookingWithSession extends Booking {
	session: {
		name: string;
		session_date: string;
		start_time: string;
		end_time: string;
	};
}

interface MemberPassWithType extends MemberPass {
	pass_type: PassType;
}

export default function MyPage() {
	const { profile } = useAuth();
	const supabase = createClient();

	const [passes, setPasses] = useState<MemberPassWithType[]>([]);
	const [bookings, setBookings] = useState<BookingWithSession[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const fetchData = useCallback(async () => {
		if (!profile) return;
		setIsLoading(true);

		const [{ data: passData }, { data: bookingData }] = await Promise.all([
			supabase
				.from('member_passes')
				.select('*, pass_type:pass_types(*)')
				.eq('member_id', profile.id)
				.eq('is_active', true)
				.order('created_at', { ascending: false }),
			supabase
				.from('bookings')
				.select(
					'*, session:class_sessions(name, session_date, start_time, end_time)',
				)
				.eq('member_id', profile.id)
				.in('status', ['confirmed', 'waitlisted', 'attended', 'no_show'])
				.order('booked_at', { ascending: false })
				.limit(30),
		]);

		setPasses((passData as MemberPassWithType[]) ?? []);
		setBookings((bookingData as BookingWithSession[]) ?? []);
		setIsLoading(false);
	}, [profile, supabase]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const statusMap: Record<
		string,
		{ label: string; variant: 'secondary' | 'default' | 'error' | 'surface' }
	> = {
		confirmed: { label: '예약확정', variant: 'secondary' },
		waitlisted: { label: '대기중', variant: 'default' },
		attended: { label: '출석', variant: 'secondary' },
		no_show: { label: '노쇼', variant: 'error' },
	};

	if (isLoading) {
		return (
			<div className="min-h-dvh flex items-center justify-center">
				<Spinner size={36} />
			</div>
		);
	}

	return (
		<div className="min-h-dvh flex flex-col">
			<TopHeader title="내 정보" />

			<div className="flex-1 overflow-y-auto pb-6">
				{/* 프로필 */}
				<div className="mx-4 mt-4 card overflow-hidden">
					<div className="bg-primary p-5 flex items-center gap-4">
						<div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center shrink-0">
							<span className="text-xl font-bold text-primary">
								{profile?.name.slice(0, 1)}
							</span>
						</div>
						<div>
							<h2 className="text-body-lg font-bold text-on-primary">
								{profile?.name}
							</h2>
							<p className="text-body-sm text-on-primary/70">
								{formatPhone(profile?.phone ?? '')}
							</p>
						</div>
					</div>
				</div>

				{/* 수강권 현황 */}
				<div className="mx-4 mt-4">
					<h3 className="text-body-md font-bold text-on-surface mb-2">
						수강권
					</h3>
					{passes.length === 0 ? (
						<p className="text-body-sm text-on-surface-variant">
							보유한 수강권이 없습니다.
						</p>
					) : (
						<div className="space-y-2">
							{passes.map((pass) => {
								const daysLeft = differenceInDays(
									parseISO(pass.expire_date),
									new Date(),
								);
								const isExpired = daysLeft < 0;

								return (
									<div
										key={pass.id}
										className={cn('card p-4', isExpired && 'opacity-50')}
									>
										<div className="flex items-start justify-between">
											<div>
												<div className="flex items-center gap-2">
													<span className="text-body-md font-semibold text-on-surface">
														{pass.pass_type.name}
													</span>
													{isExpired ? (
														<Badge variant="error">만료</Badge>
													) : daysLeft <= 14 ? (
														<Badge variant="error">만료임박</Badge>
													) : (
														<Badge variant="secondary">이용중</Badge>
													)}
												</div>
												<p className="text-body-sm text-on-surface-variant mt-1">
													{pass.start_date} ~ {pass.expire_date}
													{!isExpired && (
														<span className="ml-2 font-medium">
															D-{daysLeft}
														</span>
													)}
												</p>
											</div>
											<div className="text-right">
												<p
													className={cn(
														'text-body-lg font-bold',
														daysLeft <= 14 && !isExpired
															? 'text-error'
															: 'text-on-surface',
													)}
												>
													{pass.remaining_count !== null
														? `${pass.remaining_count}회`
														: '무제한'}
												</p>
												<p className="text-label-sm text-on-surface-variant">
													잔여
												</p>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* 예약 이력 */}
				<div className="mx-4 mt-4">
					<h3 className="text-body-md font-bold text-on-surface mb-2">
						예약 내역
					</h3>
					<div className="card overflow-hidden">
						{bookings.length === 0 ? (
							<EmptyState title="예약 내역이 없습니다." />
						) : (
							<div className="divide-y divide-outline-variant">
								{bookings.map((booking) => {
									const badge = statusMap[booking.status];
									const isPast = booking.session?.session_date
										? new Date(booking.session.session_date) < new Date()
										: false;

									return (
										<div
											key={booking.id}
											className={cn(
												'flex items-center gap-3 px-4 py-3',
												isPast && 'opacity-60',
											)}
										>
											<div className="flex-1 min-w-0">
												<p className="text-body-sm font-semibold text-on-surface text-ellipsis-1">
													{booking.session?.name}
												</p>
												<p className="text-body-sm text-on-surface-variant">
													{booking.session?.session_date
														? format(
																parseISO(booking.session.session_date),
																'M월 d일 (E)',
																{ locale: ko },
															)
														: ''}
													{booking.session?.start_time &&
														` · ${booking.session.start_time.slice(0, 5)}`}
												</p>
											</div>
											<Badge variant={badge?.variant ?? 'default'}>
												{badge?.label ?? booking.status}
											</Badge>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
