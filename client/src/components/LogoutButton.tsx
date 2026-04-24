'use client';

import { signOut, useSession } from 'next-auth/react';

export default function LogoutButton() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
    >
      로그아웃 (계정 전환)
    </button>
  );
}