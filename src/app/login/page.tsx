'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn, normalizePhone } from '@/lib/utils';
import { Spinner } from '@/components/ui';

type Step = 'phone' | 'pin';

export default function LoginPage() {
	const [step, setStep] = useState<Step>('phone');
	const [phone, setPhone] = useState('');
	const [pin, setPin] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
	const { signIn, profile } = useAuth();
	const router = useRouter();

	// profile이 채워지면 역할에 따라 이동
	useEffect(() => {
		if (!profile) return;
		if (profile.role === 'member') {
			router.replace('/home');
		} else {
			router.replace('/schedule');
		}
	}, [profile, router]);

	const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
		let formatted = digits;
		if (digits.length > 7) {
			formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
		} else if (digits.length > 3) {
			formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
		}
		setPhone(formatted);
		setError(null);
	};

	const handlePhoneNext = () => {
		const digits = normalizePhone(phone);
		if (digits.length < 10) {
			setError('올바른 전화번호를 입력해주세요.');
			return;
		}
		setStep('pin');
		setError(null);
		setTimeout(() => pinRefs.current[0]?.focus(), 100);
	};

	const handlePinChange = async (index: number, value: string) => {
		if (!/^\d*$/.test(value)) return;

		const newPin = pin.split('');
		newPin[index] = value.slice(-1);
		const nextPin = newPin.join('');
		setPin(nextPin);
		setError(null);

		if (value && index < 3) {
			pinRefs.current[index + 1]?.focus();
		}

		if (nextPin.length === 4 && index === 3) {
			await handleSubmit(nextPin);
		}
	};

	const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
		if (e.key === 'Backspace' && !pin[index] && index > 0) {
			const newPin = pin.slice(0, index - 1) + pin.slice(index);
			setPin(newPin);
			pinRefs.current[index - 1]?.focus();
		}
	};

	const handleSubmit = async (pinValue = pin) => {
		if (pinValue.length !== 4) return;
		setIsLoading(true);
		setError(null);

		const { error: authError } = await signIn(normalizePhone(phone), pinValue);
		if (authError) {
			setError(authError);
			setPin('');
			setTimeout(() => pinRefs.current[0]?.focus(), 100);
			setIsLoading(false);
			return;
		}
		// 이동은 위의 useEffect(profile)에서 처리
	};

	return (
		<div className="min-h-dvh bg-background flex flex-col">
			<div className="flex-1 flex flex-col items-center justify-center px-6 pt-safe-top">
				<div className="w-full max-w-sm space-y-10">
					{/* 로고 */}
					<div className="text-center space-y-2">
						<div className="text-center">
							<p className="text-label-sm text-on-surface-variant tracking-widest uppercase">
								Flying Yoga Studio
							</p>
							<h1 className="text-[42px] font-bold tracking-tight text-primary leading-none mt-1">
								요가디야
							</h1>
						</div>
					</div>

					{/* Step 1: 전화번호 */}
					{step === 'phone' && (
						<div className="space-y-6 animate-in fade-in duration-200">
							<div className="space-y-2">
								<label className="text-label-lg text-on-surface">
									전화번호
								</label>
								<input
									type="tel"
									value={phone}
									onChange={handlePhoneChange}
									onKeyDown={(e) => e.key === 'Enter' && handlePhoneNext()}
									placeholder="010-0000-0000"
									className="input-field text-center text-xl font-semibold tracking-widest"
									autoFocus
									inputMode="numeric"
								/>
								{error && (
									<p className="text-body-sm text-error text-center">{error}</p>
								)}
							</div>
							<button
								onClick={handlePhoneNext}
								disabled={normalizePhone(phone).length < 10}
								className="btn-primary"
							>
								다음
							</button>
						</div>
					)}

					{/* Step 2: PIN */}
					{step === 'pin' && (
						<div className="space-y-6 animate-in fade-in duration-200">
							<div className="space-y-4">
								<div className="text-center space-y-1">
									<p className="text-body-md text-on-surface-variant">
										{phone}
									</p>
									<label className="text-label-lg text-on-surface block">
										PIN 4자리를 입력해주세요
									</label>
								</div>

								<div className="flex justify-center gap-4">
									{Array.from({ length: 4 }).map((_, i) => (
										<input
											key={i}
											ref={(el) => {
												pinRefs.current[i] = el;
											}}
											type="password"
											inputMode="numeric"
											maxLength={1}
											value={pin[i] || ''}
											onChange={(e) => handlePinChange(i, e.target.value)}
											onKeyDown={(e) => handlePinKeyDown(i, e)}
											className={cn(
												'w-14 h-14 text-center text-xl font-bold rounded-lg',
												'border-2 bg-surface-container-low',
												'focus:outline-none focus:border-primary transition-colors',
												pin[i]
													? 'border-primary text-on-surface'
													: 'border-outline-variant text-transparent',
											)}
										/>
									))}
								</div>

								{error && (
									<p className="text-body-sm text-error text-center">{error}</p>
								)}
							</div>

							<div className="space-y-3">
								{isLoading ? (
									<div className="flex justify-center py-4">
										<Spinner size={32} />
									</div>
								) : (
									<button
										onClick={() => handleSubmit()}
										disabled={pin.length !== 4}
										className="btn-primary"
									>
										로그인
									</button>
								)}
								<button
									onClick={() => {
										setStep('phone');
										setPin('');
										setError(null);
									}}
									className="btn-ghost"
								>
									전화번호 변경
								</button>
							</div>
						</div>
					)}
				</div>
			</div>

			<div className="p-6 text-center">
				<p className="text-body-sm text-on-surface-variant/60">
					초기 PIN은 전화번호 뒷 4자리입니다
				</p>
			</div>
		</div>
	);
}
