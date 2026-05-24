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
	const [isLoading, setIsLoading] = useState(true);
	const supabase = createClient();

	const fetchProfile = useCallback(async (userId: string) => {
		console.log('fetchProfile 시작, userId:', userId);
		const { data, error } = await supabase
			.from('profiles')
			.select('*')
			.eq('id', userId)
			.single();
		console.log('fetchProfile 결과:', data, error);
		setProfile(data);
	}, []); // ← supabase 제거

	const refreshProfile = useCallback(async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (user) await fetchProfile(user.id);
	}, [fetchProfile]); // ← supabase 제거

	useEffect(() => {
		const timeout = setTimeout(() => setIsLoading(false), 5000);

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log('auth event:', event);
			if (session?.user) {
				await fetchProfile(session.user.id);
			} else {
				setProfile(null);
			}
			setIsLoading(false);
			clearTimeout(timeout);
		});
		return () => {
			subscription.unsubscribe();
			clearTimeout(timeout);
		};
	}, [fetchProfile]); // ← supabase 제거

	const signIn = useCallback(async (phone: string, pin: string) => {
		const email = `${phone.replace(/\D/g, '')}@yogadiya.app`;
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password: pin,
		});
		if (error) return { error: '전화번호 또는 PIN이 올바르지 않습니다.' };
		return { error: null };
	}, []); // ← supabase 제거

	const signOut = useCallback(async () => {
		await supabase.auth.signOut();
		setProfile(null);
	}, []); // ← supabase 제거

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
