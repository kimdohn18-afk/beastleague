import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: '비스트리그',
  description: 'KBO 경기 결과로 동물 캐릭터가 성장하는 육성형 웹앱',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body className="bg-surface text-textPrimary min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
