'use client';

import { signOut } from 'next-auth/react';

export default function LogoutButton({ className }: { className?: string }) {
  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      signOut({ callbackUrl: '/' });
    }
  };

  return (
    <button
      onClick={handleLogout}
      className={`text-sm text-gray-500 hover:text-red-500 transition-colors ${className ?? ''}`}
    >
      로그아웃
    </button>
  );
}
