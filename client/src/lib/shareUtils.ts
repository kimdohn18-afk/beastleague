import html2canvas from 'html2canvas';

export async function captureCardAsBlob(element: HTMLElement): Promise<Blob | null> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: null,
      useCORS: true,
      logging: false,
    });
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
    });
  } catch (e) {
    console.error('Card capture failed:', e);
    return null;
  }
}

export async function shareToInstagramStory(blob: Blob): Promise<boolean> {
  // Web Share API로 공유 시트 열기 (인스타 스토리 선택 가능)
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], 'beastleague.png', { type: 'image/png' });
    const shareData = { files: [file] };

    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return true;
      } catch (e) {
        // 사용자가 취소한 경우
        console.log('Share cancelled:', e);
        return false;
      }
    }
  }
  // Web Share 미지원 → 이미지 다운로드 대체
  downloadBlob(blob, 'beastleague.png');
  return false;
}

export async function shareToKakao(
  blob: Blob,
  params: {
    characterName: string;
    animalName: string;
    animalEmoji: string;
    xp: number;
    characterSize: number;
    traitName?: string;
  }
) {
  const { Kakao } = window as any;
  if (!Kakao?.isInitialized()) {
    console.error('Kakao SDK not initialized');
    return;
  }

  // 이미지를 카카오에 업로드
  const file = new File([blob], 'beastleague.png', { type: 'image/png' });

  try {
    const uploadRes = await Kakao.Share.uploadImage({ file: [file] });
    const imageUrl = uploadRes.infos.original.url;

    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${params.animalEmoji} ${params.characterName} (${params.xp.toLocaleString()} XP)`,
        description: params.traitName
          ? `${params.animalName} · 크기 ${params.characterSize}px · ${params.traitName}`
          : `${params.animalName} · 크기 ${params.characterSize}px · 비스트리그에서 캐릭터를 키워보세요!`,
        imageUrl,
        link: {
          mobileWebUrl: 'https://beastleague-client.vercel.app',
          webUrl: 'https://beastleague-client.vercel.app',
        },
      },
      buttons: [
        {
          title: '나도 키우기',
          link: {
            mobileWebUrl: 'https://beastleague-client.vercel.app',
            webUrl: 'https://beastleague-client.vercel.app',
          },
        },
      ],
    });
  } catch (e) {
    console.error('Kakao share failed:', e);
    // 업로드 실패 시 기존 텍스트 공유로 폴백
    Kakao.Share.sendDefault({
      objectType: 'text',
      text: `🐾 비스트리그 | ${params.animalEmoji} ${params.characterName} (${params.xp.toLocaleString()} XP)\n캐릭터 크기: ${params.characterSize}px\n나도 키워보기 👇`,
      link: {
        mobileWebUrl: 'https://beastleague-client.vercel.app',
        webUrl: 'https://beastleague-client.vercel.app',
      },
    });
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
