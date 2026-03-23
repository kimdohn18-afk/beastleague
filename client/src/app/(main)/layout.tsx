'use client';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/',           label: '홈',     emoji: '🏠' },
  { href: '/placement',  label: '배치',   emoji: '⚾' },
  { href: '/character',  label: '캐릭터', emoji: '🐾' },
  { href: '/battle',     label: '대결',   emoji: '⚔️' },
  { href: '/ranking',    label: '랭킹',   emoji: '🏆' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      {/* 하단 탭 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surfaceLight border-t border-white/10 z-50">
        <div className="flex">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors
                  ${isActive ? 'text-primary' : 'text-textSecondary'}`}
              >
                <span className="text-xl">{item.emoji}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
