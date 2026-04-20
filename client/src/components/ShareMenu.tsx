'use client';

interface ShareMenuProps {
  onShare: (target: 'kakao' | 'instagram' | 'download') => void;
  onClose: () => void;
  shareLoading: boolean;
}

export default function ShareMenu({ onShare, onClose, shareLoading }: ShareMenuProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl w-full max-w-md p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-800 text-center mb-4">공유하기</h3>

        <div className="flex justify-center gap-6">
          <button
            onClick={() => onShare('kakao')}
            disabled={shareLoading}
            className="flex flex-col items-center gap-1.5"
          >
            <div className="w-14 h-14 rounded-full bg-yellow-300 flex items-center justify-center text-2xl shadow-md">
              💬
            </div>
            <span className="text-xs text-gray-600">카카오톡</span>
          </button>

          <button
            onClick={() => onShare('instagram')}
            disabled={shareLoading}
            className="flex flex-col items-center gap-1.5"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl shadow-md">
              📸
            </div>
            <span className="text-xs text-gray-600">인스타그램</span>
          </button>

          <button
            onClick={() => onShare('download')}
            disabled={shareLoading}
            className="flex flex-col items-center gap-1.5"
          >
            <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-2xl shadow-md">
              💾
            </div>
            <span className="text-xs text-gray-600">저장</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-500 font-medium"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
