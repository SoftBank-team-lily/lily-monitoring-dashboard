import { LanguageProvider } from "@/lib/i18n/provider";
import { getLocale, getTranslator } from "@/lib/i18n/server";
import type { Metadata } from 'next';
import { IBM_Plex_Sans_KR } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const plex = IBM_Plex_Sans_KR({ weight: ['400', '600'], subsets: ['latin'], display: 'swap', variable: '--font-plex-sans-kr', adjustFontFallback: false });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("Lily 모니터링"), description: t("Team Lily 배포 플랫폼의 앱·서버 상태 대시보드") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={plex.variable}>
      <body>
        <LanguageProvider locale={locale}><Providers>{children}</Providers></LanguageProvider>
      </body>
    </html>
  );
}
