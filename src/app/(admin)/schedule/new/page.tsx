'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addMonths } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { TopHeader } from '@/components/layout/TopHeader';
import { ResultModal } from '@/components/ui';
import { cn, isKoreanHoliday, getHolidayName, DAY_LABELS } from '@/lib/utils';
import { CLASS_TEMPLATE_NAMES } from '@/types';
import type { Profile, GenerateSessionPreview } from '@/types';

const schema = z.object({
	name: z.string().min(1, '수업명을 선택해주세요'),
	instructor_id: z.string().min(1, '강사를 선택해주세요'),
	start_date: z.string().min(1, '시작일을 입력해주세요'),
	end_date: z.string().min(1, '종료일을 입력해주세요'),
	is_recurring: z.boolean(),
	recurrence_days: z.array(z.number()),
	start_time: z.string().min(1, '시작 시간을 입력해주세요'),
	duration_min: z.number().min(30).max(180),
	max_capacity: z.number().min(1).max(50),
	waitlist_max: z.number().min(0).max(20),
	level_label: z.string().optional(),
	notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// 미리보기 아이템
interface PreviewItem extends GenerateSessionPreview {
	excluded: boolean;
}

export default function NewSessionPage() {
	const router = useRouter();
	const supabase = createClient();
	const [instructors, setInstructors] = useState<Profile[]>([]);
	const [preview, setPreview] = useState<PreviewItem[]>([]);
	const [step, setStep] = useState<'form' | 'preview'>('form');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [resultModal, setResultModal] = useState<{
		open: boolean;
		success: boolean;
	}>({
		open: false,
		success: false,
	});

	const {
		register,
		control,
		handleSubmit,
		watch,
		setValue,
		formState: { errors },
	} = useForm<FormData>({
		resolver: zodResolver(schema),
		defaultValues: {
			is_recurring: true,
			recurrence_days: [1, 3, 5], // 월수금
			duration_min: 60,
			max_capacity: 8,
			waitlist_max: 5,
			start_date: format(new Date(), 'yyyy-MM-dd'),
			end_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
		},
	});

	const isRecurring = watch('is_recurring');
	const recurrenceDays = watch('recurrence_days');

	// 강사 목록 로드
	useEffect(() => {
		supabase
			.from('profiles')
			.select('id, name')
			.in('role', ['instructor', 'admin', 'manager'])
			.eq('is_active', true)
			.order('name')
			.then(({ data }) => setInstructors((data as Profile[]) ?? []));
	}, [supabase]);

	// 요일 토글
	const toggleDay = (day: number) => {
		const curr = recurrenceDays;
		if (curr.includes(day))
			setValue(
				'recurrence_days',
				curr.filter((d) => d !== day),
			);
		else setValue('recurrence_days', [...curr, day].sort());
	};

	// 미리보기 생성 (클라이언트에서 직접 계산)
	const generatePreview = (data: FormData) => {
		const items: PreviewItem[] = [];
		const start = new Date(data.start_date);
		const end = new Date(data.end_date);
		const [h, m] = data.start_time.split(':').map(Number);

		const endTime = new Date(0, 0, 0, h, m + data.duration_min);
		const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}:00`;

		let cur = new Date(start);
		while (cur <= end) {
			const dow = cur.getDay(); // 0=일

			if (!data.is_recurring || data.recurrence_days.includes(dow)) {
				const isHoliday = isKoreanHoliday(cur);
				items.push({
					session_date: format(cur, 'yyyy-MM-dd'),
					start_time: `${data.start_time}:00`,
					end_time: endTimeStr,
					name: data.name,
					instructor_id: data.instructor_id,
					is_holiday: isHoliday,
					excluded: isHoliday, // 공휴일은 기본 제외
				});
			}
			cur = new Date(cur.getTime() + 86400000);
		}
		setPreview(items);
		setStep('preview');
	};

	// 확정 INSERT
	const confirmCreate = async () => {
		setIsSubmitting(true);
		const toCreate = preview.filter((p) => !p.excluded);
		const formData = watch();

		const rows = toCreate.map((p) => ({
			name: p.name,
			category: 'flying' as const,
			level_label: formData.level_label || null,
			instructor_id: p.instructor_id,
			session_date: p.session_date,
			start_time: p.start_time,
			end_time: p.end_time,
			max_capacity: formData.max_capacity,
			min_capacity: 2,
			waitlist_max: formData.waitlist_max,
			notes: formData.notes || null,
		}));

		const { error } = await supabase.from('class_sessions').insert(rows);
		setIsSubmitting(false);
		setResultModal({ open: true, success: !error });
	};

	const togglePreviewExclude = (idx: number) => {
		setPreview((prev) =>
			prev.map((p, i) => (i === idx ? { ...p, excluded: !p.excluded } : p)),
		);
	};

	const includedCount = preview.filter((p) => !p.excluded).length;

	return (
		<div className="min-h-dvh flex flex-col">
			<TopHeader
				title={step === 'form' ? '수업 등록' : '수업 일정 확인'}
				showBack
			/>

			{/* ── Step 1: 폼 ─────────────────────────────── */}
			{step === 'form' && (
				<form
					onSubmit={handleSubmit(generatePreview)}
					className="flex-1 overflow-y-auto px-4 py-4 space-y-5"
				>
					{/* 수업명 */}
					<div className="space-y-1.5">
						<label className="text-label-lg text-on-surface">수업명</label>
						<select {...register('name')} className="input-field">
							<option value="">수업을 선택해주세요</option>
							{CLASS_TEMPLATE_NAMES.map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</select>
						{errors.name && (
							<p className="text-body-sm text-error">{errors.name.message}</p>
						)}
					</div>

					{/* 레벨 라벨 */}
					<div className="space-y-1.5">
						<label className="text-label-lg text-on-surface">
							레벨 뱃지 (선택)
						</label>
						<input
							{...register('level_label')}
							placeholder="LEVEL 0, ADVANCED, PRIVATE …"
							className="input-field"
						/>
					</div>

					{/* 강사 선택 */}
					<div className="space-y-1.5">
						<label className="text-label-lg text-on-surface">강사 선택</label>
						<select {...register('instructor_id')} className="input-field">
							<option value="">강사를 선택해주세요</option>
							{instructors.map((i) => (
								<option key={i.id} value={i.id}>
									{i.name}
								</option>
							))}
						</select>
						{errors.instructor_id && (
							<p className="text-body-sm text-error">
								{errors.instructor_id.message}
							</p>
						)}
					</div>

					{/* 시작일 / 종료일 */}
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<label className="text-label-lg text-on-surface">시작일</label>
							<input
								type="date"
								{...register('start_date')}
								className="input-field"
							/>
						</div>
						<div className="space-y-1.5">
							<label className="text-label-lg text-on-surface">종료일</label>
							<input
								type="date"
								{...register('end_date')}
								className="input-field"
							/>
						</div>
					</div>

					{/* 주간 반복 */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<label className="text-label-lg text-on-surface">
								주간 반복 등록
							</label>
							<Controller
								name="is_recurring"
								control={control}
								render={({ field }) => (
									<button
										type="button"
										onClick={() => field.onChange(!field.value)}
										className={cn(
											'relative w-12 h-6 rounded-full transition-colors duration-200',
											field.value ? 'bg-primary' : 'bg-outline-variant',
										)}
									>
										<span
											className={cn(
												'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200',
												field.value ? 'left-7' : 'left-1',
											)}
										/>
									</button>
								)}
							/>
						</div>

						{isRecurring && (
							<div className="flex gap-2">
								{([0, 1, 2, 3, 4, 5, 6] as const).map((d) => (
									<button
										key={d}
										type="button"
										onClick={() => toggleDay(d)}
										className={cn(
											'flex-1 py-2.5 rounded-full text-label-sm font-semibold transition-colors',
											recurrenceDays.includes(d)
												? 'bg-primary text-on-primary'
												: 'bg-surface-container text-on-surface-variant',
											d === 0 && !recurrenceDays.includes(d) && 'text-error',
											d === 6 && !recurrenceDays.includes(d) && 'text-blue-500',
										)}
									>
										{DAY_LABELS[d]}
									</button>
								))}
							</div>
						)}
					</div>

					{/* 시작 시간 / 소요 시간 */}
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<label className="text-label-lg text-on-surface">시작 시간</label>
							<input
								type="time"
								{...register('start_time')}
								className="input-field"
							/>
							{errors.start_time && (
								<p className="text-body-sm text-error">
									{errors.start_time.message}
								</p>
							)}
						</div>
						<div className="space-y-1.5">
							<label className="text-label-lg text-on-surface">
								소요 시간 (분)
							</label>
							<Controller
								name="duration_min"
								control={control}
								render={({ field }) => (
									<input
										type="number"
										value={field.value}
										onChange={(e) => field.onChange(Number(e.target.value))}
										className="input-field"
										min={30}
										max={180}
										step={15}
									/>
								)}
							/>
						</div>
					</div>

					{/* 정원 / 대기 */}
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<label className="text-label-lg text-on-surface">정원 설정</label>
							<Controller
								name="max_capacity"
								control={control}
								render={({ field }) => (
									<div className="flex items-center input-field py-2.5 px-2 gap-2">
										<button
											type="button"
											onClick={() =>
												field.onChange(Math.max(1, field.value - 1))
											}
											className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-lg font-bold"
										>
											−
										</button>
										<span className="flex-1 text-center font-bold text-body-md">
											{field.value} 명
										</span>
										<button
											type="button"
											onClick={() =>
												field.onChange(Math.min(50, field.value + 1))
											}
											className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-lg font-bold"
										>
											+
										</button>
									</div>
								)}
							/>
						</div>
						<div className="space-y-1.5">
							<label className="text-label-lg text-on-surface">
								대기 인원 설정
							</label>
							<Controller
								name="waitlist_max"
								control={control}
								render={({ field }) => (
									<div className="flex items-center input-field py-2.5 px-2 gap-2">
										<button
											type="button"
											onClick={() =>
												field.onChange(Math.max(0, field.value - 1))
											}
											className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-lg font-bold"
										>
											−
										</button>
										<span className="flex-1 text-center font-bold text-body-md">
											{field.value} 명
										</span>
										<button
											type="button"
											onClick={() =>
												field.onChange(Math.min(20, field.value + 1))
											}
											className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-lg font-bold"
										>
											+
										</button>
									</div>
								)}
							/>
						</div>
					</div>

					{/* 메모 */}
					<div className="space-y-1.5">
						<label className="text-label-lg text-on-surface">
							메모 (선택사항)
						</label>
						<textarea
							{...register('notes')}
							rows={3}
							placeholder="수업 관련 주의사항이나 안내 내용을 입력하세요"
							className="input-field resize-none"
						/>
					</div>

					<div className="pb-6">
						<button type="submit" className="btn-primary">
							일정 미리보기
						</button>
					</div>
				</form>
			)}

			{/* ── Step 2: 미리보기 ────────────────────────── */}
			{step === 'preview' && (
				<div className="flex-1 flex flex-col">
					<div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant">
						<p className="text-body-sm text-on-surface-variant">
							수업 일정을 확인하고 제외할 날짜를 탭하여 선택 해제하세요
						</p>
						<p className="text-label-lg font-semibold text-on-surface mt-1">
							총 {includedCount}개 수업이 등록됩니다
						</p>
					</div>

					<div className="flex-1 overflow-y-auto">
						<div className="divide-y divide-outline-variant">
							{preview.map((item, idx) => {
								const date = new Date(item.session_date);
								const dow = date.getDay();
								const hName = getHolidayName(date);

								return (
									<button
										key={idx}
										onClick={() => togglePreviewExclude(idx)}
										className={cn(
											'w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors',
											item.excluded
												? 'bg-surface-container opacity-50 line-through'
												: 'bg-surface-container-lowest hover:bg-surface-container-low',
										)}
									>
										{/* 체크박스 */}
										<div
											className={cn(
												'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
												item.excluded
													? 'border-outline-variant bg-transparent'
													: 'border-primary bg-primary',
											)}
										>
											{!item.excluded && (
												<span className="text-on-primary text-xs">✓</span>
											)}
										</div>

										{/* 날짜 */}
										<div className="flex-1">
											<span
												className={cn(
													'text-body-md font-semibold',
													dow === 0
														? 'text-error'
														: dow === 6
															? 'text-blue-500'
															: 'text-on-surface',
												)}
											>
												{format(date, 'M월 d일')} ({DAY_LABELS[dow]})
											</span>
											<span className="text-body-sm text-on-surface-variant ml-2">
												{item.start_time.slice(0, 5)}
											</span>
											{hName && (
												<span className="ml-2 text-label-sm text-error">
													{hName}
												</span>
											)}
										</div>
									</button>
								);
							})}
						</div>
					</div>

					<div className="px-4 py-4 border-t border-outline-variant space-y-3">
						<button
							onClick={confirmCreate}
							disabled={isSubmitting || includedCount === 0}
							className="btn-primary"
						>
							{isSubmitting ? '등록 중...' : `${includedCount}개 수업 등록하기`}
						</button>
						<button onClick={() => setStep('form')} className="btn-ghost">
							이전으로
						</button>
					</div>
				</div>
			)}

			<ResultModal
				open={resultModal.open}
				type={resultModal.success ? 'success' : 'error'}
				title={resultModal.success ? '수업 등록 완료' : '등록 실패'}
				description={
					resultModal.success
						? '새로운 수업이 시간표에 정상적으로 등록되었습니다.'
						: '오류가 발생했습니다. 다시 시도해주세요.'
				}
				onConfirm={() => setResultModal({ ...resultModal, open: false })}
			/>
		</div>
	);
}
