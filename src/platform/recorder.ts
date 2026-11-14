// Microphone recording. Clips live in memory only and are never saved by the session screens.

const MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/aac'];

let denied = false;

export function recordingSupported(): boolean {
  return (
    !denied &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    'MediaRecorder' in window
  );
}

export function recordingDenied(): boolean {
  return denied;
}

export function pickMimeType(isSupported: (type: string) => boolean = (t) => MediaRecorder.isTypeSupported(t)): string {
  for (const type of MIME_CANDIDATES) {
    try {
      if (isSupported(type)) return type;
    } catch {
      /* try the next one */
    }
  }
  return '';
}

export interface ActiveRecording {
  stop(): Promise<Blob>;
  cancel(): void;
}

/** Starts recording. Throws if the microphone is refused; callers then hide the Record button. */
export async function startRecording(): Promise<ActiveRecording> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    denied = true;
    throw err;
  }
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/mp4' }));
        };
        if (recorder.state !== 'inactive') recorder.stop();
        else {
          release();
          resolve(new Blob(chunks, { type: mimeType || 'audio/mp4' }));
        }
      }),
    cancel: () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } finally {
        release();
      }
    },
  };
}
