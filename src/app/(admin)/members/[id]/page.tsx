'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Phone, Calendar, MapPin, Edit2, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { TopHeader } from '@/components/layout/TopHeader';
import {
	Badge,
	Modal,
	ResultModal,
	Spinner,
	EmptyState,
} from '@/components/ui';
import { formatPhone, formatDate, cn } from '@/lib/utils';
import type { Profile, MemberPass, Booking, PassType } from '@/types';

interface MemberPassWithType extends MemberPass {
	pass_type: PassType;
}

interface BookingWithSession {
	id: string;
	status: string;
	pass_id: string | null;
	session: {
		name: string;
		session_date: string;
		start_time: string;
	};
}

export default function MemberDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { profile: myProfile } = useAuth();
	const supabase = createClient();
	const router = useRouter();

	const [member, setMember] = useState<Profile | null>(null);
	const [passes, setPasses] = useState<MemberPassWithType[]>([]);
	const [bookings, setBookings] = useState<BookingWithSession[]>([]);
	const [passTypes, setPassTypes] = useState<PassType[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [addPassModal, setAddPassModal] = useState(false);
	const [editPassModal, setEditPassModal] = useState<MemberPassWithType | null>(
		null,
	);
	const [resultModal, setResultModal] = useState<{
		open: boolean;
		type: 'success' | 'error';
		title: string;
		desc: string;
	} | null>(null);

	// 수강권 추가 폼
	const [newPassTypeId, setNewPassTypeId] = useState('');
	const [newStartDate, setNewStartDate] = useState(
		format(new Date(), 'yyyy-MM-dd'),
	);
	const [newExpireDate, setNewExpireDate] = useState('');

	const isAdmin = myProfile?.role === 'admin' || myProfile?.role === 'manager';

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		const [
			{ data: memberData },
			{ data: passData },
			{ data: bookingData },
			{ data: passTypeData },
		] = await Promise.all([
			supabase.from('profiles').select('*').eq('id', id).single(),
			supabase
				.from('member_passes')
				.select('*, pass_type:pass_types(*)')
				.eq('member_id', id)
				.order('created_at', { ascending: false }),
			supabase
				.from('bookings')
				.select('*, session:class_sessions(name, session_date, start_time)')
				.eq('member_id', id)
				.in('status', ['confirmed', 'attended', 'no_show', 'waitlisted'])
				.order('booked_at', { ascending: false })
				.limit(20),
			supabase.from('pass_types').select('*').eq('is_active', true),
		]);

		setMember(memberData as Profile);
		setPasses((passData as MemberPassWithType[]) ?? []);
		setBookings((bookingData as BookingWithSession[]) ?? []);
		setPassTypes((passTypeData as PassType[]) ?? []);
		setIsLoading(false);
	}, [id, supabase]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// 수강권 만료일 자동 계산
	useEffect(() => {
		const selected = passTypes.find((p) => p.id === newPassTypeId);
		if (selected && newStartDate) {
			const start = new Date(newStartDate);
			const expire = new Date(start);
			expire.setDate(expire.getDate() + selected.validity_days - 1);
			setNewExpireDate(format(expire, 'yyyy-MM-dd'));
		}
	}, [newPassTypeId, newStartDate, passTypes]);

	// 수강권 추가
	const handleAddPass = async () => {
		const selected = passTypes.find((p) => p.id === newPassTypeId);
		if (!selected) return;

		const { error } = await supabase.from('member_passes').insert({
			member_id: id,
			pass_type_id: newPassTypeId,
			remaining_count: selected.total_count,
			start_date: newStartDate,
			expire_date: newExpireDate,
			is_active: true,
			created_by: myProfile?.id,
		});

		if (!error) {
			setAddPassModal(false);
			setResultModal({
				open: true,
				type: 'success',
				title: '수강권이 추가되었습니다.',
				desc: '',
			});
			fetchData();
		} else {
			setResultModal({
				open: true,
				type: 'error',
				title: '추가 실패',
				desc: '다시 시도해주세요.',
			});
		}
	};

	// 수강권 만료일/횟수 수정
	const handleEditPass = async () => {
		if (!editPassModal) return;
		const { error } = await supabase
			.from('member_passes')
			.update({
				expire_date: editPassModal.expire_date,
				remaining_count: editPassModal.remaining_count,
			})
			.eq('id', editPassModal.id);

		if (!error) {
			setEditPassModal(null);
			setResultModal({
				open: true,
				type: 'success',
				title: '수강권이 수정되었습니다.',
				desc: '',
			});
			fetchData();
		}
	};

	// 노쇼 횟수 복구
	const handleRestoreNoShow = async (bookingId: string) => {
		const booking = bookings.find((b) => b.id === bookingId);
		if (!booking?.pass_id) return;

		await supabase
			.from('bookings')
			.update({ status: 'cancelled', note: '관리자 노쇼 취소' })
			.eq('id', bookingId);

		await supabase
			.from('member_passes')
			.update({ remaining_count: supabase.rpc as any });

		// 간단하게: 해당 pass의 remaining_count +1
		const { data: passData } = await supabase
			.from('member_passes')
			.select('remaining_count')
			.eq('id', booking.pass_id)
			.single();

		if (passData && passData.remaining_count !== null) {
			await supabase
				.from('member_passes')
				.update({ remaining_count: passData.remaining_count + 1 })
				.eq('id', booking.pass_id);
		}

		await supabase
			.from('bookings')
			.update({ status: 'cancelled', note: '관리자 노쇼 취소' })
			.eq('id', bookingId);

		setResultModal({
			open: true,
			type: 'success',
			title: '노쇼 취소 완료',
			desc: '횟수가 복구되었습니다.',
		});
		fetchData();
	};

	if (isLoading) {
		return (
			<div className="min-h-dvh flex items-center justify-center">
				<Spinner size={36} />
			</div>
		);
	}

	if (!member) {
		return (
			<div className="min-h-dvh flex flex-col">
				<TopHeader title="회원 상세" showBack />
				<EmptyState title="회원을 찾을 수 없습니다." />
			</div>
		);
	}

	const activePass = passes.find(
		(p) =>
			p.is_active && differenceInDays(parseISO(p.expire_date), new Date()) >= 0,
	);

	const statusBadgeMap: Record<
		string,
		{ label: string; variant: 'secondary' | 'default' | 'error' | 'surface' }
	> = {
		confirmed: { label: '예약', variant: 'secondary' },
		waitlisted: { label: '대기', variant: 'default' },
		attended: { label: '출석', variant: 'secondary' },
		no_show: { label: '노쇼', variant: 'error' },
	};

	return (
		<div className="min-h-dvh flex flex-col">
			<TopHeader title="회원 상세" showBack />

			<div className="flex-1 overflow-y-auto pb-6">
				{/* 프로필 카드 */}
				<div className="mx-4 mt-4 card overflow-hidden">
					<div className="bg-primary p-5 flex items-center gap-4">
						<div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center shrink-0">
							<span className="text-xl font-bold text-primary">
								{member.name.slice(0, 1)}
							</span>
						</div>
						<div className="flex-1">
							<h2 className="text-body-lg font-bold text-on-primary">
								{member.name}
							</h2>
							<p className="text-body-sm text-on-primary/70">
								{formatPhone(member.phone)}
							</p>
						</div>
					</div>

					<div className="p-4 space-y-2.5">
						{member.birthday && (
							<div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
								<Calendar size={15} />
								<span>
									{format(parseISO(member.birthday), 'yyyy년 M월 d일생', {
										locale: ko,
									})}
								</span>
							</div>
						)}
						{member.address && (
							<div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
								<MapPin size={15} />
								<span>{member.address}</span>
							</div>
						)}
						<div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
							<Phone size={15} />
							<span>{formatPhone(member.phone)}</span>
						</div>
					</div>
				</div>

				{/* 수강권 섹션 */}
				<div className="mx-4 mt-4">
					<div className="flex items-center justify-between mb-2">
						<h3 className="text-body-md font-bold text-on-surface">수강권</h3>
						{isAdmin && (
							<button
								onClick={() => setAddPassModal(true)}
								className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-label-sm font-semibold"
							>
								<Plus size={13} /> 추가
							</button>
						)}
					</div>

					<div className="space-y-2">
						{passes.length === 0 && (
							<p className="text-body-sm text-on-surface-variant py-2">
								수강권이 없습니다.
							</p>
						)}
						{passes.map((pass) => {
							const daysLeft = differenceInDays(
								parseISO(pass.expire_date),
								new Date(),
							);
							const isExpired = daysLeft < 0;
							const isExpiring = daysLeft <= 14 && !isExpired;
							const isActive = pass.is_active && !isExpired;

							return (
								<div
									key={pass.id}
									className={cn('card p-4', !isActive && 'opacity-50')}
								>
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2">
												<span className="text-body-md font-semibold text-on-surface">
													{pass.pass_type.name}
												</span>
												{isExpired && <Badge variant="error">만료</Badge>}
												{isExpiring && <Badge variant="error">만료임박</Badge>}
												{isActive && !isExpiring && (
													<Badge variant="secondary">이용중</Badge>
												)}
											</div>
											<div className="mt-1.5 space-y-0.5">
												<p className="text-body-sm text-on-surface-variant">
													{pass.start_date} ~ {pass.expire_date}
													{!isExpired && (
														<span className="ml-2 font-medium">
															D-{daysLeft}
														</span>
													)}
												</p>
												<p
													className={cn(
														'text-body-sm font-semibold',
														isExpiring ? 'text-error' : 'text-on-surface',
													)}
												>
													잔여{' '}
													{pass.remaining_count !== null
														? `${pass.remaining_count}회`
														: '무제한'}
												</p>
											</div>
										</div>
										{isAdmin && (
											<button
												onClick={() => setEditPassModal(pass)}
												className="btn-icon shrink-0"
											>
												<Edit2 size={15} />
											</button>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* 예약 이력 */}
				<div className="mx-4 mt-4">
					<h3 className="text-body-md font-bold text-on-surface mb-2">
						예약 이력
					</h3>
					<div className="card overflow-hidden">
						{bookings.length === 0 ? (
							<EmptyState title="예약 이력이 없습니다." />
						) : (
							<div className="divide-y divide-outline-variant">
								{bookings.map((booking) => {
									const badge = statusBadgeMap[booking.status];
									return (
										<div
											key={booking.id}
											className="flex items-center gap-3 px-4 py-3"
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
											<div className="flex items-center gap-2 shrink-0">
												<Badge variant={badge?.variant ?? 'default'}>
													{badge?.label ?? booking.status}
												</Badge>
												{booking.status === 'no_show' && isAdmin && (
													<button
														onClick={() => handleRestoreNoShow(booking.id)}
														className="text-label-sm text-on-surface-variant underline"
													>
														취소
													</button>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* 수강권 추가 모달 */}
			<Modal open={addPassModal} onClose={() => setAddPassModal(false)}>
				<div className="p-6 space-y-4">
					<h3 className="text-headline-md font-bold">수강권 추가</h3>
					<div className="space-y-3">
						<div className="space-y-1.5">
							<label className="text-label-lg text-on-surface">
								수강권 종류
							</label>
							<select
								value={newPassTypeId}
								onChange={(e) => setNewPassTypeId(e.target.value)}
								className="input-field"
							>
								<option value="">선택해주세요</option>
								{passTypes.map((p) => (
									<option key={p.id} value={p.id}>
										{p.name} (
										{p.total_count !== null ? `${p.total_count}회` : '무제한'} /{' '}
										{p.validity_days}일)
									</option>
								))}
							</select>
						</div>
						<div className="space-y-1.5">
							<label className="text-label-lg text-on-surface">시작일</label>
							<input
								type="date"
								value={newStartDate}
								onChange={(e) => setNewStartDate(e.target.value)}
								className="input-field"
							/>
						</div>
						{newExpireDate && (
							<div className="card bg-surface-container-low p-3 text-body-sm">
								<div className="flex justify-between">
									<span className="text-on-surface-variant">만료일</span>
									<span className="font-semibold">{newExpireDate}</span>
								</div>
							</div>
						)}
					</div>
					<div className="space-y-2 pt-2">
						<button
							onClick={handleAddPass}
							disabled={!newPassTypeId}
							className="btn-primary"
						>
							추가하기
						</button>
						<button
							onClick={() => setAddPassModal(false)}
							className="btn-ghost"
						>
							취소
						</button>
					</div>
				</div>
			</Modal>

			{/* 수강권 수정 모달 */}
			{editPassModal && (
				<Modal open onClose={() => setEditPassModal(null)}>
					<div className="p-6 space-y-4">
						<h3 className="text-headline-md font-bold">수강권 수정</h3>
						<div className="space-y-3">
							<div className="space-y-1.5">
								<label className="text-label-lg text-on-surface">
									만료일 조정
								</label>
								<input
									type="date"
									value={editPassModal.expire_date}
									onChange={(e) =>
										setEditPassModal({
											...editPassModal,
											expire_date: e.target.value,
										})
									}
									className="input-field"
								/>
							</div>
							{editPassModal.remaining_count !== null && (
								<div className="space-y-1.5">
									<label className="text-label-lg text-on-surface">
										잔여 횟수 조정
									</label>
									<div className="flex items-center input-field py-2.5 px-2 gap-2">
										<button
											type="button"
											onClick={() =>
												setEditPassModal({
													...editPassModal,
													remaining_count: Math.max(
														0,
														(editPassModal.remaining_count ?? 0) - 1,
													),
												})
											}
											className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-lg font-bold"
										>
											−
										</button>
										<span className="flex-1 text-center font-bold text-body-md">
											{editPassModal.remaining_count}회
										</span>
										<button
											type="button"
											onClick={() =>
												setEditPassModal({
													...editPassModal,
													remaining_count:
														(editPassModal.remaining_count ?? 0) + 1,
												})
											}
											className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-lg font-bold"
										>
											+
										</button>
									</div>
								</div>
							)}
						</div>
						<div className="space-y-2 pt-2">
							<button onClick={handleEditPass} className="btn-primary">
								저장하기
							</button>
							<button
								onClick={() => setEditPassModal(null)}
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
