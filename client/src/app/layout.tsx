// client/src/app/layout.tsx — 루트 레이아웃

import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: '비스트리그',
  description: '실제 KBO 경기 결과로 동물 캐릭터를 육성하세요',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
