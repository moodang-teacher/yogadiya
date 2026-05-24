import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/hooks/useAuth';

export const metadata: Metadata = {
	title: '요가디야 | YOGADIYA',
	description: '플라잉요가 스튜디오 요가디야 예약 시스템',
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	themeColor: '#fff8f5',
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="ko">
			<head>
				<link
					href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
					rel="stylesheet"
				/>
			</head>
			<body>
				<AuthProvider>
					<div className="mobile-container min-h-dvh">{children}</div>
				</AuthProvider>
			</body>
		</html>
	);
}
