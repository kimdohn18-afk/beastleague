'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-primary">🐾 비스트리그</h1>
          <p className="text-textSecondary text-sm">
            실제 KBO 경기 결과로 동물 캐릭터를 육성하세요
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signIn('kakao', { callbackUrl: '/' })}
            className="w-full py-3 px-4 rounded-lg font-medium text-black"
            style={{ backgroundColor: '#FEE500' }}
          >
            카카오로 시작하기
          </button>

          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full py-3 px-4 rounded-lg font-medium bg-white text-gray-700 border border-gray-300"
          >
            Google로 시작하기
          </button>
        </div>

        <div className="border-t border-surfaceLight pt-4">
          <p className="text-textSecondary text-xs text-center mb-3">개발 테스트용</p>
          <div className="flex gap-2 justify-center">
            {[
              { emoji: '🐻', name: '번개곰', id: 'test1' },
              { emoji: '🐯', name: '질풍호', id: 'test2' },
              { emoji: '🦅', name: '하늘매', id: 'test3' },
            ].map((char) => (
              <button
                key={char.id}
                onClick={() =>
                  signIn('dev-login', {
                    userId: char.id,
                    email: `${char.id}@beast.league`,
                    name: char.name,
                    callbackUrl: '/',
                  })
                }
                className="flex flex-col items-center p-3 rounded-lg bg-surfaceLight hover:bg-primary/20 transition"
              >
                <span className="text-2xl">{char.emoji}</span>
                <span className="text-xs text-textSecondary mt-1">{char.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
