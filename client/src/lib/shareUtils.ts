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
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], 'beastleague.png', { type: 'image/png' });
    const shareData = { files: [file] };
    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return true;
      } catch (e) {
        console.log('Share cancelled:', e);
        return false;
      }
    }
  }
  downloadBlob(blob, 'beastleague.png');
  return false;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
