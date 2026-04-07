'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* 로고 영역 */}
        <div className="text-center space-y-3">
          <div className="text-6xl">🐾</div>
          <h1 className="text-3xl font-bold text-gray-900">비스트리그</h1>
          <p className="text-gray-400 text-sm">
            실제 KBO 경기 결과로 동물 캐릭터를 육성하세요
          </p>
        </div>

        {/* 소셜 로그인 */}
        <div className="space-y-3">
          <button
            onClick={() => signIn('kakao', { callbackUrl: '/' })}
            className="w-full py-3.5 px-4 rounded-2xl font-bold text-gray-900 shadow-sm transition active:scale-[0.98]"
            style={{ backgroundColor: '#FEE500' }}
          >
            카카오로 시작하기
          </button>

          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full py-3.5 px-4 rounded-2xl font-bold bg-white text-gray-700 border border-gray-200 shadow-sm transition active:scale-[0.98]"
          >
            Google로 시작하기
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-300">
          로그인 시 서비스 이용약관에 동의합니다
        </p>
      </div>
    </div>
  );
}
