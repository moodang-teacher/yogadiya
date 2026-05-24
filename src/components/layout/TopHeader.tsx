'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Menu, LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/useAuth';

interface TopHeaderProps {
	title?: string;
	showBack?: boolean;
	showMenu?: boolean;
	showLogo?: boolean;
	rightSlot?: React.ReactNode;
	className?: string;
	onMenuClick?: () => void;
}

export function TopHeader({
	title,
	showBack = false,
	showMenu = false,
	showLogo = false,
	rightSlot,
	className,
	onMenuClick,
}: TopHeaderProps) {
	const router = useRouter();
	const { profile, signOut } = useAuth();
	const [profileOpen, setProfileOpen] = useState(false);

	const handleSignOut = async () => {
		await signOut();
		router.replace('/login');
	};

	return (
		<header
			className={cn(
				'flex items-center justify-between px-4 h-14 safe-top',
				'bg-background/90 backdrop-blur-sm sticky top-0 z-40',
				className,
			)}
		>
			{/* 왼쪽 */}
			<div className="w-10 flex items-center">
				{showBack && (
					<button
						onClick={() => router.back()}
						className="btn-icon"
						aria-label="뒤로가기"
					>
						<ArrowLeft size={22} strokeWidth={1.8} />
					</button>
				)}
				{showMenu && (
					<button onClick={onMenuClick} className="btn-icon" aria-label="메뉴">
						<Menu size={22} strokeWidth={1.8} />
					</button>
				)}
			</div>

			{/* 중앙 타이틀 */}
			{title && (
				<h1 className="text-body-md font-semibold text-on-surface">{title}</h1>
			)}

			{/* 오른쪽 */}
			<div className="w-10 flex items-center justify-end relative">
				{rightSlot ?? (
					<>
						<button
							onClick={() => setProfileOpen((v) => !v)}
							className="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center"
							aria-label="프로필"
						>
							<span className="text-body-sm font-bold text-primary">
								{profile?.name.slice(0, 1) ?? '?'}
							</span>
						</button>

						{/* 드롭다운 */}
						{profileOpen && (
							<>
								{/* 딤 배경 */}
								<div
									className="fixed inset-0 z-40"
									onClick={() => setProfileOpen(false)}
								/>
								<div className="absolute right-0 top-11 z-50 w-44 card shadow-lg overflow-hidden">
									{/* 사용자 정보 */}
									<div className="px-4 py-3 border-b border-outline-variant">
										<p className="text-body-sm font-semibold text-on-surface">
											{profile?.name}
										</p>
										<p className="text-label-sm text-on-surface-variant capitalize">
											{profile?.role}
										</p>
									</div>
									{/* 로그아웃 */}
									<button
										onClick={handleSignOut}
										className="w-full flex items-center gap-2 px-4 py-3 text-body-sm text-error hover:bg-surface-container transition-colors"
									>
										<LogOut size={15} />
										로그아웃
									</button>
								</div>
							</>
						)}
					</>
				)}
			</div>
		</header>
	);
}
