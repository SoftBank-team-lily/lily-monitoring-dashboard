import type { Metadata } from 'next';
import { IBM_Plex_Sans_KR } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const plex = IBM_Plex_Sans_KR({ weight: ['400', '600'], subsets: ['latin'], display: 'swap', variable: '--font-plex-sans-kr', adjustFontFallback: false });

export const metadata: Metadata = {
  title: 'Lily 모니터링',
  description: 'Team Lily 배포 플랫폼의 앱·서버 상태 대시보드',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={plex.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
