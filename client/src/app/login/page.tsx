'use client';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
      {/* 로고 */}
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-black tracking-tight">
          <span className="text-primary">Beast</span>
          <span className="text-accent">League</span>
        </h1>
        <p className="text-textSecondary mt-3 text-sm">
          KBO 경기 결과로 내 동물 캐릭터가 성장한다
        </p>
      </div>

      {/* 로그인 버튼 */}
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={() => signIn('kakao', { callbackUrl: '/' })}
          className="w-full py-3.5 rounded-xl font-semibold text-black text-sm
            bg-[#FEE500] hover:bg-[#f0d800] active:scale-95 transition-all"
        >
          카카오로 시작하기
        </button>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full py-3.5 rounded-xl font-semibold text-gray-800 text-sm
            bg-white hover:bg-gray-100 active:scale-95 transition-all"
        >
          Google로 시작하기
        </button>
      </div>

      <p className="text-textSecondary text-xs mt-10 text-center">
        로그인하면 서비스 이용약관 및 개인정보처리방침에 동의하게 됩니다
      </p>
    </div>
  );
}
