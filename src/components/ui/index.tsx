'use client';

import { useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Modal ──────────────────────────────────────────────────

interface ModalProps {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	className?: string;
}

export function Modal({ open, onClose, children, className }: ModalProps) {
	useEffect(() => {
		if (open) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = '';
		return () => {
			document.body.style.overflow = '';
		};
	}, [open]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center"
			onClick={onClose}
		>
			{/* 딤 배경 */}
			<div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" />
			{/* 컨텐츠 */}
			<div
				className={cn(
					'relative z-10 w-full max-w-md bg-surface-container-lowest',
					'rounded-t-2xl sm:rounded-2xl shadow-xl',
					'animate-in slide-in-from-bottom-4 duration-200',
					className,
				)}
				onClick={(e) => e.stopPropagation()}
			>
				{children}
			</div>
		</div>
	);
}

// ── Confirm/Result Modal ───────────────────────────────────

interface ResultModalProps {
	open: boolean;
	type: 'success' | 'error' | 'info';
	title: string;
	description?: string;
	confirmLabel?: string;
	onConfirm: () => void;
}

export function ResultModal({
	open,
	type,
	title,
	description,
	confirmLabel = '확인',
	onConfirm,
}: ResultModalProps) {
	const icons = {
		success: (
			<CheckCircle
				className="text-secondary-container"
				size={48}
				strokeWidth={1.5}
			/>
		),
		error: <AlertCircle className="text-error" size={48} strokeWidth={1.5} />,
		info: (
			<Info className="text-primary-container" size={48} strokeWidth={1.5} />
		),
	};
	const bgColors = {
		success: 'bg-secondary-container',
		error: 'bg-error-container',
		info: 'bg-primary-fixed',
	};

	return (
		<Modal open={open} onClose={onConfirm}>
			<div className="p-8 flex flex-col items-center gap-4">
				<div
					className={cn(
						'w-16 h-16 rounded-full flex items-center justify-center',
						bgColors[type],
					)}
				>
					{icons[type]}
				</div>
				<div className="text-center space-y-2">
					<h2 className="text-headline-md font-semibold text-on-surface">
						{title}
					</h2>
					{description && (
						<p className="text-body-sm text-on-surface-variant">
							{description}
						</p>
					)}
				</div>
				<button onClick={onConfirm} className="btn-primary mt-2">
					{confirmLabel}
				</button>
			</div>
		</Modal>
	);
}

// ── Badge / Chip ───────────────────────────────────────────

interface BadgeProps {
	variant?: 'default' | 'primary' | 'secondary' | 'error' | 'surface';
	size?: 'sm' | 'md';
	children: React.ReactNode;
	className?: string;
}

export function Badge({
	variant = 'default',
	size = 'sm',
	children,
	className,
}: BadgeProps) {
	return (
		<span
			className={cn(
				'inline-flex items-center font-semibold rounded-full tracking-wide',
				size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-label-sm',
				variant === 'default' &&
					'bg-surface-container-high text-on-surface-variant',
				variant === 'primary' && 'bg-primary text-on-primary',
				variant === 'secondary' &&
					'bg-secondary-container text-on-secondary-container',
				variant === 'error' && 'bg-error-container text-on-error-container',
				variant === 'surface' && 'bg-surface-container text-on-surface-variant',
				className,
			)}
		>
			{children}
		</span>
	);
}

// ── Capacity Badge ─────────────────────────────────────────

interface CapacityBadgeProps {
	current: number;
	max: number;
	className?: string;
}

export function CapacityBadge({ current, max, className }: CapacityBadgeProps) {
	const isFull = current >= max;
	const isAlmost = current >= max * 0.8;

	return (
		<Badge
			variant={isFull ? 'primary' : isAlmost ? 'secondary' : 'secondary'}
			className={className}
		>
			{isFull ? `${current}/${max} 마감` : `${current}/${max} 예약`}
		</Badge>
	);
}

// ── Loading Spinner ────────────────────────────────────────

export function Spinner({
	size = 24,
	className,
}: {
	size?: number;
	className?: string;
}) {
	return (
		<div
			className={cn(
				'animate-spin rounded-full border-2 border-outline-variant border-t-primary',
				className,
			)}
			style={{ width: size, height: size }}
		/>
	);
}

// ── Empty State ────────────────────────────────────────────

export function EmptyState({
	icon,
	title,
	description,
}: {
	icon?: React.ReactNode;
	title: string;
	description?: string;
}) {
	return (
		<div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
			{icon && <div className="text-outline-variant mb-1">{icon}</div>}
			<p className="text-body-md font-semibold text-on-surface-variant">
				{title}
			</p>
			{description && (
				<p className="text-body-sm text-on-surface-variant/70 max-w-xs">
					{description}
				</p>
			)}
		</div>
	);
}
