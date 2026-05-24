import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// service_role 키 사용 (Auth Admin API 접근)
const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!,
	{ auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(request: Request) {
	// ── 관리자 인증 체크 ──
	const cookieStore = cookies();
	const supabaseAuth = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return cookieStore.getAll();
				},
			},
		},
	);

	const {
		data: { user },
	} = await supabaseAuth.auth.getUser();
	if (!user) {
		return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
	}

	const { data: caller } = await supabaseAuth
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.single();

	if (!caller || !['admin', 'manager'].includes(caller.role)) {
		return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
	}

	// ── 기존 로직 ──
	const {
		email,
		password,
		name,
		phone,
		birthday,
		address,
		pass_type_id,
		start_date,
		expire_date,
	} = await request.json();

	// 1) 전화번호 중복 확인
	const { data: existing } = await supabaseAdmin
		.from('profiles')
		.select('id')
		.eq('phone', phone)
		.single();

	if (existing) {
		return NextResponse.json({ error: 'USER_EXISTS' }, { status: 409 });
	}

	// 2) Auth 사용자 생성
	const { data: authData, error: authError } =
		await supabaseAdmin.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
		});

	if (authError || !authData.user) {
		return NextResponse.json(
			{ error: authError?.message ?? 'AUTH_ERROR' },
			{ status: 500 },
		);
	}

	const userId = authData.user.id;

	// 3) 프로필 생성
	const { error: profileError } = await supabaseAdmin.from('profiles').insert({
		id: userId,
		name,
		phone,
		birthday: birthday || null,
		address: address || null,
		role: 'member',
	});

	if (profileError) {
		await supabaseAdmin.auth.admin.deleteUser(userId);
		return NextResponse.json({ error: 'PROFILE_ERROR' }, { status: 500 });
	}

	// 4) 수강권 생성
	const { data: passType } = await supabaseAdmin
		.from('pass_types')
		.select('total_count')
		.eq('id', pass_type_id)
		.single();

	const { error: passError } = await supabaseAdmin
		.from('member_passes')
		.insert({
			member_id: userId,
			pass_type_id,
			remaining_count: passType?.total_count ?? null,
			start_date,
			expire_date,
			is_active: true,
		});

	if (passError) {
		await supabaseAdmin.from('profiles').delete().eq('id', userId);
		await supabaseAdmin.auth.admin.deleteUser(userId);
		return NextResponse.json({ error: 'PASS_ERROR' }, { status: 500 });
	}

	return NextResponse.json({ ok: true, user_id: userId });
}
