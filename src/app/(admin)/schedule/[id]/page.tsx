'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { MoreVertical, UserCheck, UserX, Clock, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { TopHeader } from '@/components/layout/TopHeader';
import {
	Badge,
	ResultModal,
	Modal,
	Spinner,
	EmptyState,
} from '@/components/ui';
import { formatPhone, formatTime, cn } from '@/lib/utils';
import type { ClassSession, Booking } from '@/types';

interface BookingWithMember extends Booking {
	member: { id: string; name: string; phone: string };
	pass: { remaining_count: number | null } | null;
}

export default function SessionDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { profile } = useAuth();
	const supabase = createClient();

	const [session, setSession] = useState<ClassSession | null>(null);
	const [bookings, setBookings] = useState<BookingWithMember[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [actionMenu, setActionMenu] = useState<string | null>(null);
	const [confirmModal, setConfirmModal] = useState<{
		open: boolean;
		title: string;
		description: string;
		onConfirm: () => void;
	} | null>(null);
	const [resultModal, setResultModal] = useState<{
		open: boolean;
		type: 'success' | 'error';
		title: string;
		desc: string;
	} | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);

		const [{ data: sessionData }, { data: bookingData }] = await Promise.all([
			supabase
				.from('class_sessions')
				.select('*, instructor:profiles!instructor_id(id, name)')
				.eq('id', id)
				.single(),
			supabase
				.from('bookings')
				.select(
					'*, member:profiles!member_id(id, name, phone), pass:member_passes(remaining_count)',
				)
				.eq('session_id', id)
				.neq('status', 'cancelled')
				.order('booked_at'),
		]);

		setSession(sessionData as ClassSession);
		setBookings((bookingData as BookingWithMember[]) ?? []);
		setIsLoading(false);
	}, [id, supabase]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const isAdminOrManager =
		profile?.role === 'admin' || profile?.role === 'manager';

	// 출석 체크
	const handleAttend = async (bookingId: string) => {
		const { error } = await supabase
			.from('bookings')
			.update({ status: 'attended', attended_at: new Date().toISOString() })
			.eq('id', bookingId);

		if (!error) {
			fetchData();
		}
	};

	// 출석 취소
	const handleUnattend = async (bookingId: string) => {
		const { error } = await supabase
			.from('bookings')
			.update({ status: 'confirmed', attended_at: null })
			.eq('id', bookingId);

		if (!error) fetchData();
	};

	// 노쇼 처리
	const handleNoShow = async (bookingId: string) => {
		const { error } = await supabase
			.from('bookings')
			.update({ status: 'no_show' })
			.eq('id', bookingId);

		if (!error) {
			setResultModal({
				open: true,
				type: 'success',
				title: '노쇼 처리 완료',
				desc: '횟수가 차감되었습니다.',
			});
			fetchData();
		}
		setActionMenu(null);
	};

	// 예약 취소 (관리자)
	const handleCancel = async (bookingId: string) => {
		const { data } = await supabase.rpc('cancel_booking', {
			p_booking_id: bookingId,
			p_cancelled_by_role: 'admin',
		});
		if (data?.ok) {
			setResultModal({
				open: true,
				type: 'success',
				title: '예약 취소 완료',
				desc: '',
			});
			fetchData();
		}
		setActionMenu(null);
	};

	// 출결 마감
	const handleCloseAttendance = async () => {
		const { data } = await supabase.rpc('close_attendance', {
			p_session_id: id,
		});
		if (data?.ok) {
			setResultModal({
				open: true,
				type: 'success',
				title: '출결 마감 완료',
				desc: `노쇼 ${data.no_show_count}명 처리되었습니다.`,
			});
			fetchData();
		}
		setConfirmModal(null);
	};

	// 수업 취소
	const handleCancelSession = async () => {
		const { error } = await supabase
			.from('class_sessions')
			.update({ status: 'cancelled' })
			.eq('id', id);

		if (!error) {
			setResultModal({
				open: true,
				type: 'success',
				title: '수업이 취소되었습니다.',
				desc: '',
			});
			fetchData();
		}
		setConfirmModal(null);
	};

	if (isLoading) {
		return (
			<div className="min-h-dvh flex items-center justify-center">
				<Spinner size={36} />
			</div>
		);
	}

	if (!session) {
		return (
			<div className="min-h-dvh flex flex-col">
				<TopHeader title="수업 상세" showBack />
				<EmptyState title="수업을 찾을 수 없습니다." />
			</div>
		);
	}

	const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
	const attendedBookings = bookings.filter((b) => b.status === 'attended');
	const waitlistBookings = bookings.filter((b) => b.status === 'waitlisted');
	const noShowBookings = bookings.filter((b) => b.status === 'no_show');
	const isCancelled = session.status === 'cancelled';
	const isCompleted = session.status === 'completed';

	return (
		<div className="min-h-dvh flex flex-col">
			<TopHeader title="수업 상세" showBack />

			<div className="flex-1 overflow-y-auto">
				{/* 수업 정보 카드 */}
				<div className="mx-4 mt-4 card overflow-hidden">
					<div className="bg-primary p-4">
						<div className="flex items-start justify-between">
							<div>
								{session.level_label && (
									<Badge variant="secondary" className="mb-1.5">
										{session.level_label}
									</Badge>
								)}
								<h2 className="text-body-lg font-bold text-on-primary">
									{session.name}
								</h2>
							</div>
							{isCancelled && <Badge variant="error">수업취소</Badge>}
							{isCompleted && <Badge variant="surface">완료</Badge>}
						</div>
					</div>

					<div className="p-4 space-y-3">
						<div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
							<Clock size={16} />
							<span>
								{format(new Date(session.session_date), 'M월 d일 (E)', {
									locale: ko,
								})}
								{' · '}
								{formatTime(session.start_time)} ~{' '}
								{formatTime(session.end_time)}
							</span>
						</div>
						<div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
							<Users size={16} />
							<span>
								예약 {session.current_count}/{session.max_capacity}명
								{session.waitlist_count > 0 &&
									` · 대기 ${session.waitlist_count}명`}
							</span>
						</div>
						{session.instructor && (
							<div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
								<UserCheck size={16} />
								<span>{session.instructor.name} 강사</span>
							</div>
						)}
					</div>

					{/* 관리자 액션 버튼 */}
					{isAdminOrManager && !isCancelled && !isCompleted && (
						<div className="px-4 pb-4 flex gap-2">
							<button
								onClick={() =>
									setConfirmModal({
										open: true,
										title: '출결 마감',
										description:
											'미출석 예약자는 노쇼로 처리됩니다. 진행하시겠습니까?',
										onConfirm: handleCloseAttendance,
									})
								}
								className="flex-1 py-2.5 rounded-lg bg-secondary-container text-on-secondary-container text-label-lg font-semibold"
							>
								출결 마감
							</button>
							<button
								onClick={() =>
									setConfirmModal({
										open: true,
										title: '수업 취소',
										description:
											'수업을 취소하면 되돌릴 수 없습니다. 진행하시겠습니까?',
										onConfirm: handleCancelSession,
									})
								}
								className="flex-1 py-2.5 rounded-lg bg-error-container text-on-error-container text-label-lg font-semibold"
							>
								수업 취소
							</button>
						</div>
					)}
				</div>

				{/* 예약자 목록 */}
				<div className="mx-4 mt-4 space-y-3 pb-6">
					{/* 출석 */}
					{attendedBookings.length > 0 && (
						<BookingSection
							title={`출석 ${attendedBookings.length}명`}
							bookings={attendedBookings}
							variant="attended"
							actionMenu={actionMenu}
							setActionMenu={setActionMenu}
							onAttend={handleAttend}
							onUnattend={handleUnattend}
							onNoShow={handleNoShow}
							onCancel={handleCancel}
							isAdmin={isAdminOrManager}
							isCompleted={isCompleted}
						/>
					)}

					{/* 예약확정 */}
					{confirmedBookings.length > 0 && (
						<BookingSection
							title={`예약확정 ${confirmedBookings.length}명`}
							bookings={confirmedBookings}
							variant="confirmed"
							actionMenu={actionMenu}
							setActionMenu={setActionMenu}
							onAttend={handleAttend}
							onUnattend={handleUnattend}
							onNoShow={handleNoShow}
							onCancel={handleCancel}
							isAdmin={isAdminOrManager}
							isCompleted={isCompleted}
						/>
					)}

					{/* 대기 */}
					{waitlistBookings.length > 0 && (
						<BookingSection
							title={`대기 ${waitlistBookings.length}명`}
							bookings={waitlistBookings}
							variant="waitlisted"
							actionMenu={actionMenu}
							setActionMenu={setActionMenu}
							onAttend={handleAttend}
							onUnattend={handleUnattend}
							onNoShow={handleNoShow}
							onCancel={handleCancel}
							isAdmin={isAdminOrManager}
							isCompleted={isCompleted}
						/>
					)}

					{/* 노쇼 */}
					{noShowBookings.length > 0 && (
						<BookingSection
							title={`노쇼 ${noShowBookings.length}명`}
							bookings={noShowBookings}
							variant="no_show"
							actionMenu={actionMenu}
							setActionMenu={setActionMenu}
							onAttend={handleAttend}
							onUnattend={handleUnattend}
							onNoShow={handleNoShow}
							onCancel={handleCancel}
							isAdmin={isAdminOrManager}
							isCompleted={isCompleted}
						/>
					)}

					{bookings.length === 0 && <EmptyState title="예약자가 없습니다." />}
				</div>
			</div>

			{/* 확인 모달 */}
			{confirmModal && (
				<Modal open={confirmModal.open} onClose={() => setConfirmModal(null)}>
					<div className="p-6 space-y-4">
						<h3 className="text-headline-md font-bold">{confirmModal.title}</h3>
						<p className="text-body-sm text-on-surface-variant">
							{confirmModal.description}
						</p>
						<div className="space-y-2">
							<button onClick={confirmModal.onConfirm} className="btn-primary">
								확인
							</button>
							<button
								onClick={() => setConfirmModal(null)}
								className="btn-ghost"
							>
								취소
							</button>
						</div>
					</div>
				</Modal>
			)}

			<ResultModal
				open={!!resultModal?.open}
				type={resultModal?.type ?? 'success'}
				title={resultModal?.title ?? ''}
				description={resultModal?.desc}
				onConfirm={() => setResultModal(null)}
			/>
		</div>
	);
}

// 예약자 섹션 컴포넌트
function BookingSection({
	title,
	bookings,
	variant,
	actionMenu,
	setActionMenu,
	onAttend,
	onUnattend,
	onNoShow,
	onCancel,
	isAdmin,
	isCompleted,
}: {
	title: string;
	bookings: BookingWithMember[];
	variant: 'confirmed' | 'waitlisted' | 'attended' | 'no_show';
	actionMenu: string | null;
	setActionMenu: (id: string | null) => void;
	onAttend: (id: string) => void;
	onUnattend: (id: string) => void;
	onNoShow: (id: string) => void;
	onCancel: (id: string) => void;
	isAdmin: boolean;
	isCompleted: boolean;
}) {
	const variantColors = {
		confirmed: 'text-on-secondary-container',
		attended: 'text-teal-700',
		waitlisted: 'text-on-surface-variant',
		no_show: 'text-error',
	};

	return (
		<div className="card">
			<div className="px-4 py-2.5 border-b border-outline-variant bg-surface-container-low rounded-t-lg">
				<p
					className={cn('text-label-lg font-semibold', variantColors[variant])}
				>
					{title}
				</p>
			</div>
			<div className="divide-y divide-outline-variant">
				{bookings.map((booking) => (
					<div key={booking.id} className="flex items-center gap-3 px-4 py-3">
						{/* 순번 or 대기번호 */}
						<div className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center shrink-0">
							<span className="text-label-sm font-bold text-on-surface-variant">
								{variant === 'waitlisted' ? booking.waitlist_order : ''}
							</span>
						</div>

						{/* 이름 + 잔여횟수 */}
						<div className="flex-1 min-w-0">
							<p className="text-body-md font-semibold text-on-surface">
								{booking.member.name}
							</p>
							<p className="text-body-sm text-on-surface-variant">
								{formatPhone(booking.member.phone)}
								{booking.pass?.remaining_count !== null &&
									booking.pass?.remaining_count !== undefined && (
										<span className="ml-2">
											잔여 {booking.pass.remaining_count}회
										</span>
									)}
							</p>
						</div>

						{/* 액션 */}
						{!isCompleted && variant === 'confirmed' && (
							<button
								onClick={() => onAttend(booking.id)}
								className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-label-sm font-semibold"
							>
								<UserCheck size={14} />
								출석
							</button>
						)}

						{!isCompleted && variant === 'attended' && (
							<button
								onClick={() => onUnattend(booking.id)}
								className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-label-sm"
							>
								취소
							</button>
						)}

						{/* 더보기 메뉴 (관리자) */}
						{isAdmin &&
							(variant === 'confirmed' || variant === 'waitlisted') && (
								<div className="relative">
									<button
										onClick={() =>
											setActionMenu(
												actionMenu === booking.id ? null : booking.id,
											)
										}
										className="btn-icon"
									>
										<MoreVertical size={18} />
									</button>
									{actionMenu === booking.id && (
										<div className="absolute right-0 bottom-full mb-1 z-50 w-36 bg-surface rounded-lg shadow-lg border border-outline-variant overflow-hidden">
											{variant === 'confirmed' && (
												<button
													onClick={() => onNoShow(booking.id)}
													className="w-full px-4 py-3 text-left text-body-sm text-error hover:bg-surface-container"
												>
													노쇼 처리
												</button>
											)}
											<button
												onClick={() => onCancel(booking.id)}
												className="w-full px-4 py-3 text-left text-body-sm text-on-surface hover:bg-surface-container"
											>
												예약 취소
											</button>
										</div>
									)}
								</div>
							)}
					</div>
				))}
			</div>
		</div>
	);
}
