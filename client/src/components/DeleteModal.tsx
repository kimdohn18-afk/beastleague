'use client';

interface DeleteModalProps {
  characterName: string;
  onConfirm: () => void;
  onClose: () => void;
  deleting: boolean;
}

export default function DeleteModal({ characterName, onConfirm, onClose, deleting }: DeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">캐릭터 삭제</h2>
        <p className="text-sm text-gray-500 mb-1">
          <strong>{characterName}</strong>을(를) 정말 삭제하시겠습니까?
        </p>
        <p className="text-xs text-red-400 mb-5">
          삭제하면 모든 XP, 업적, 기록이 사라집니다.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-500 font-medium"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 active:scale-95 transition-all"
          >
            {deleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
