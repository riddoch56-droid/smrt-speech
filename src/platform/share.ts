export type ShareOutcome = 'shared' | 'cancelled' | 'opened' | 'downloaded';

export function safeFilePart(text: string): string {
  return text.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

/** SMRTSpeech_<patientID>_<activity>_<YYYY-MM-DD>.<ext> */
export function reportFileName(patientCode: string, activity: string, date: Date | string, ext: string): string {
  const d = typeof date === 'string' ? date.slice(0, 10) : localDate(date);
  return `SMRTSpeech_${safeFilePart(patientCode)}_${safeFilePart(activity)}_${d}.${ext}`;
}

export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function canShareFiles(file: File): boolean {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Shares a file through the system share sheet (Save to Files, Mail, AirDrop, Print).
 * Falls back to a download where file sharing is unavailable.
 */
export async function shareFile(blob: Blob, name: string, title = 'SMRT Speech'): Promise<ShareOutcome> {
  const file = new File([blob], name, { type: blob.type });
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
      // Fall through to download on any other failure.
    }
  }
  downloadBlob(blob, name);
  return 'downloaded';
}

export function openBlob(blob: Blob): boolean {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return !!win;
}
