import { useCallback, useRef, useState } from 'react';
import styles from './review.module.css';

export interface ImageViewerProps {
  src: string;
  alt?: string;
}

/** Page image with wheel zoom, drag pan, and fit/100% controls. */
export function ImageViewer({ src, alt = 'Invoice page' }: ImageViewerProps): React.JSX.Element {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number } | null>(null);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(8, Math.max(0.1, s * (e.deltaY < 0 ? 1.1 : 0.9))));
  }, []);

  const onPointerDown = (e: React.PointerEvent): void => {
    dragging.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent): void => {
    if (!dragging.current) return;
    setOffset({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y });
  };
  const onPointerUp = (): void => {
    dragging.current = null;
  };

  const fit = (): void => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className={styles.imagePane}>
      <div className={styles.imageControls}>
        <button type="button" className={styles.iconButton} onClick={fit}>
          Fit
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => {
            setScale(1);
          }}
        >
          100%
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => {
            setScale((s) => Math.min(8, s * 1.2));
          }}
          aria-label="zoom in"
        >
          +
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => {
            setScale((s) => Math.max(0.1, s / 1.2));
          }}
          aria-label="zoom out"
        >
          −
        </button>
      </div>
      <div
        className={styles.imageViewport}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${String(offset.x)}px, ${String(offset.y)}px) scale(${String(scale)})`,
          }}
        />
      </div>
    </div>
  );
}
