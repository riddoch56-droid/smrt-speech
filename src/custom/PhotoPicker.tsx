import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { binaryToBlob, type Binary } from '../platform/db';
import { Button } from '../ui/kit';
import { centredSquare, clampCrop, decodeImage, squareImage, type Crop } from './imageTools';
import './custom.css';

interface Pending {
  file: File;
  url: string;
  width: number;
  height: number;
}

export function PhotoPicker({ value, onChange }: { value: Binary | null; onChange(b: Binary | null): void }) {
  const takeRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, size: 1 });
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setCurrentUrl(null);
      return;
    }
    const url = URL.createObjectURL(binaryToBlob(value));
    setCurrentUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  useEffect(() => {
    const url = pending?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [pending]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      const img = await decodeImage(file);
      const { width, height } = img;
      img.release();
      setPending({ file, url: URL.createObjectURL(file), width, height });
      setCrop(centredSquare(width, height));
      setZoom(1);
    } catch {
      setError('That file could not be opened as a picture. Please try another.');
    }
  }

  function onZoom(z: number) {
    if (!pending) return;
    const min = Math.min(pending.width, pending.height);
    const size = min / z;
    const cx = crop.x + crop.size / 2;
    const cy = crop.y + crop.size / 2;
    setZoom(z);
    setCrop(clampCrop({ x: cx - size / 2, y: cy - size / 2, size }, pending.width, pending.height));
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, crop };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const frame = frameRef.current;
    if (!d || !frame || !pending) return;
    const scale = d.crop.size / frame.clientWidth;
    setCrop(
      clampCrop(
        { x: d.crop.x - (e.clientX - d.x) * scale, y: d.crop.y - (e.clientY - d.y) * scale, size: d.crop.size },
        pending.width,
        pending.height,
      ),
    );
  }

  function endDrag() {
    drag.current = null;
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError('');
    try {
      const bin = await squareImage(pending.file, crop);
      setPending(null);
      onChange(bin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The picture could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  const inputs = (
    <>
      <input
        ref={takeRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        data-testid="photo-camera-input"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={chooseRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        data-testid="photo-file-input"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );

  if (pending) {
    const { width } = pending;
    return (
      <div className="stack">
        <p className="muted">Drag the picture to move it. Use the slider to zoom in or out.</p>
        <div
          ref={frameRef}
          className="crop-frame"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          data-testid="photo-crop-frame"
        >
          <img
            src={pending.url}
            alt="Photo being cropped"
            draggable={false}
            style={{
              width: `${(width / crop.size) * 100}%`,
              left: `${-(crop.x / crop.size) * 100}%`,
              top: `${-(crop.y / crop.size) * 100}%`,
            }}
          />
        </div>
        <label className="field">
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
            style={{ minHeight: 60 }}
            data-testid="photo-crop-zoom"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <Button variant="primary" icon="tick" disabled={busy} onClick={() => void confirm()} data-testid="photo-crop-confirm">
            Use this picture
          </Button>
          <Button icon="cross" onClick={() => setPending(null)} data-testid="photo-crop-cancel">
            Cancel
          </Button>
        </div>
        {inputs}
      </div>
    );
  }

  return (
    <div className="stack">
      {currentUrl ? (
        <div className="row">
          <img className="thumb large" src={currentUrl} alt="Chosen picture" />
        </div>
      ) : (
        <p className="muted">No picture yet.</p>
      )}
      <div className="row">
        <Button icon="camera" onClick={() => takeRef.current?.click()} data-testid="photo-take">
          Take photo
        </Button>
        <Button icon="image" onClick={() => chooseRef.current?.click()} data-testid="photo-choose">
          Choose photo
        </Button>
        {value && (
          <Button icon="trash" variant="danger" onClick={() => onChange(null)} data-testid="photo-remove">
            Remove
          </Button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {inputs}
    </div>
  );
}
