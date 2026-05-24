'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Plus, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TopHeader } from '@/components/layout/TopHeader';
import { Badge, EmptyState, Spinner } from '@/components/ui';
import { formatPhone, cn } from '@/lib/utils';
import type { Profile, MemberPass } from '@/types';
import { differenceInDays, parseISO } from 'date-fns';

interface MemberWithPass extends Profile {
	active_pass?: MemberPass & { pass_type: { name: string } };
}

export default function MembersPage() {
	const [members, setMembers] = useState<MemberWithPass[]>([]);
	const [filtered, setFiltered] = useState<MemberWithPass[]>([]);
	const [search, setSearch] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [showExpiring, setShowExpiring] = useState(false);
	const [stats, setStats] = useState({ total: 0, active: 0 });
	const supabase = createClient();

	const fetchMembers = useCallback(async () => {
		setIsLoading(true);
		const { data: profiles } = await supabase
			.from('profiles')
			.select('*')
			.eq('role', 'member')
			.eq('is_active', true)
			.order('name');

		if (!profiles) {
			setIsLoading(false);
			return;
		}

		const { data: passes } = await supabase
			.from('member_passes')
			.select('*, pass_type:pass_types(name)')
			.eq('is_active', true)
			.gte('expire_date', new Date().toISOString().split('T')[0])
			.in(
				'member_id',
				profiles.map((p) => p.id),
			);

		const passMap = (passes ?? []).reduce<
			Record<string, MemberPass & { pass_type: { name: string } }>
		>((acc, p) => {
			acc[p.member_id] = p as any;
			return acc;
		}, {});

		const result = profiles.map((p) => ({
			...p,
			active_pass: passMap[p.id],
		})) as MemberWithPass[];

		setMembers(result);
		setFiltered(result);
		setStats({
			total: result.length,
			active: result.filter(
				(m) =>
					m.active_pass &&
					(m.active_pass.remaining_count === null ||
						m.active_pass.remaining_count > 0),
			).length,
		});
		setIsLoading(false);
	}, [supabase]);

	useEffect(() => {
		fetchMembers();
	}, [fetchMembers]);

	useEffect(() => {
		let list = members;
		if (showExpiring) {
			list = list.filter((m) => {
				if (!m.active_pass) return true;
				const days = differenceInDays(
					parseISO(m.active_pass.expire_date),
					new Date(),
				);
				const remaining = m.active_pass.remaining_count;
				return days <= 14 || (remaining !== null && remaining <= 3);
			});
		}
		if (search.trim()) {
			const q = search.replace(/\D/g, '') || search.trim().toLowerCase();
			list = list.filter(
				(m) =>
					m.name.toLowerCase().includes(q) ||
					m.phone.replace(/\D/g, '').includes(q),
			);
		}
		setFiltered(list);
	}, [search, members, showExpiring]);

	const expiringCount = members.filter((m) => {
		if (!m.active_pass) return true;
		const days = differenceInDays(
			parseISO(m.active_pass.expire_date),
			new Date(),
		);
		const remaining = m.active_pass.remaining_count;
		return days <= 14 || (remaining !== null && remaining <= 3);
	}).length;

	return (
		<div className="flex flex-col min-h-dvh">
			<TopHeader title="회원 관리" />

			{/* 통계 카드 */}
			<div className="px-4 pt-4 pb-1 grid grid-cols-2 gap-3">
				<div className="card p-4 text-center">
					<p className="text-label-sm text-on-surface-variant">전체 회원</p>
					<p className="text-headline-md font-bold text-on-surface mt-1">
						{stats.total}명
					</p>
				</div>
				<div className="card p-4 text-center">
					<p className="text-label-sm text-on-surface-variant">활성 회원</p>
					<p className="text-headline-md font-bold text-secondary-DEFAULT mt-1">
						{stats.active}명
					</p>
				</div>
			</div>

			{/* 검색 + 필터 */}
			<div className="px-4 py-3 space-y-3">
				<div className="relative">
					<Search
						size={18}
						className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
					/>
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="이름 또는 전화번호 검색"
						className="input-field pl-10"
					/>
				</div>

				<button
					onClick={() => setShowExpiring((v) => !v)}
					className={cn(
						'flex items-center gap-2 px-3.5 py-2 rounded-full text-label-sm font-semibold border transition-colors',
						showExpiring
							? 'bg-error-container text-on-error-container border-transparent'
							: 'border-outline-variant text-on-surface-variant hover:bg-surface-container',
					)}
				>
					<AlertCircle size={14} />
					재등록 필요 {expiringCount > 0 && `(${expiringCount}명)`}
				</button>
			</div>

			{/* 회원 목록 */}
			<div className="flex-1 overflow-y-auto px-4 space-y-2.5 pb-4">
				{isLoading ? (
					<div className="flex justify-center py-16">
						<Spinner size={32} />
					</div>
				) : filtered.length === 0 ? (
					<EmptyState
						title="회원이 없습니다"
						description={
							search ? '검색 결과가 없습니다' : '+ 버튼으로 회원을 등록하세요'
						}
					/>
				) : (
					filtered.map((member) => (
						<MemberListItem key={member.id} member={member} />
					))
				)}
			</div>

			{/* FAB */}
			<Link
				href="/members/new"
				className="fixed bottom-28 right-4 z-40 w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-xl transition-all active:scale-90"
				aria-label="회원 등록"
			>
				<Plus size={26} strokeWidth={2} />
			</Link>
		</div>
	);
}

function MemberListItem({ member }: { member: MemberWithPass }) {
	const pass = member.active_pass;
	const daysLeft = pass
		? differenceInDays(parseISO(pass.expire_date), new Date())
		: null;
	const isExpiringSoon = daysLeft !== null && daysLeft <= 14;
	const isLowCount =
		pass?.remaining_count !== null && (pass?.remaining_count ?? 0) <= 3;

	return (
		<Link href={`/members/${member.id}`}>
			<div className="card-hover p-4 flex items-center gap-3">
				<div className="w-11 h-11 rounded-full bg-primary-fixed flex items-center justify-center shrink-0">
					<span className="text-body-md font-bold text-primary">
						{member.name.slice(0, 1)}
					</span>
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="text-body-md font-semibold text-on-surface">
							{member.name}
						</span>
						{(isExpiringSoon || isLowCount) && (
							<AlertCircle size={14} className="text-error shrink-0" />
						)}
					</div>
					<p className="text-body-sm text-on-surface-variant">
						{formatPhone(member.phone)}
					</p>
				</div>

				<div className="text-right shrink-0">
					{pass ? (
						<>
							<p className="text-label-sm font-semibold text-on-surface">
								{pass.pass_type.name}
							</p>
							<p
								className={cn(
									'text-body-sm',
									isExpiringSoon || isLowCount
										? 'text-error font-semibold'
										: 'text-on-surface-variant',
								)}
							>
								{pass.remaining_count !== null
									? `잔여 ${pass.remaining_count}회`
									: `D-${daysLeft}`}
							</p>
						</>
					) : (
						<Badge variant="error">수강권 없음</Badge>
					)}
				</div>
			</div>
		</Link>
	);
}
