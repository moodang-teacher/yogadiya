'use client';

import {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

interface AuthContextValue {
	profile: Profile | null;
	isLoading: boolean;
	signIn: (phone: string, pin: string) => Promise<{ error: string | null }>;
	signOut: () => Promise<void>;
	refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [profile, setProfile] = useState<Profile | null>(null);
	const [userId, setUserId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [sessionChecked, setSessionChecked] = useState(false);
	const supabase = createClient();

	// Step 1: 세션 확인
	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setUserId(session?.user?.id ?? null);
			setSessionChecked(true); // 세션 확인 완료
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, session) => {
			if (event === 'SIGNED_OUT') {
				setUserId(null);
				setProfile(null);
				setIsLoading(false);
			} else if (session?.user) {
				setUserId(session.user.id);
			}
		});
		return () => subscription.unsubscribe();
	}, []);

	// Step 2: 세션 확인 완료 후에만 실행
	useEffect(() => {
		if (!sessionChecked) return; // 세션 확인 전엔 아무것도 하지 않음

		if (!userId) {
			setIsLoading(false);
			return;
		}

		let cancelled = false;
		supabase
			.from('profiles')
			.select('*')
			.eq('id', userId)
			.single()
			.then(({ data, error }) => {
				if (cancelled) return;
				if (error || !data) {
					console.error('프로필 조회 실패:', error?.message);
					setProfile(null);
				} else {
					setProfile(data);
				}
				setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [userId, sessionChecked]);

	const refreshProfile = useCallback(async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (user) setUserId(user.id);
	}, []);

	const signIn = useCallback(async (phone: string, pin: string) => {
		const email = `${phone.replace(/\D/g, '')}@yogadiya.app`;
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password: pin,
		});
		if (error) return { error: '전화번호 또는 PIN이 올바르지 않습니다.' };
		return { error: null };
	}, []);

	const signOut = useCallback(async () => {
		await supabase.auth.signOut();
	}, []);

	return (
		<AuthContext.Provider
			value={{ profile, isLoading, signIn, signOut, refreshProfile }}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within AuthProvider');
	return ctx;
}
