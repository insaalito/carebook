import { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Fixed output dimensions matching the cover photo preview (16:9-ish)
const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 400;

export default function ImageEditor({ imageUrl, onSave, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 1, h: 1 });
  const containerRef = useRef(null);

  // When image loads, auto-fit it to cover the container at zoom=1
  const handleImgLoad = (e) => {
    const { naturalWidth: nw, naturalHeight: nh } = e.target;
    setImgNaturalSize({ w: nw, h: nh });
    // Reset offset so image is centered
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  // Compute displayed image size: at zoom=1, image covers the container (object-cover logic)
  const getDisplaySize = () => {
    if (!containerRef.current) return { w: 0, h: 0 };
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const scaleX = cw / imgNaturalSize.w;
    const scaleY = ch / imgNaturalSize.h;
    const baseScale = Math.max(scaleX, scaleY); // cover
    return {
      w: imgNaturalSize.w * baseScale * zoom,
      h: imgNaturalSize.h * baseScale * zoom,
    };
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const clampOffset = (ox, oy, currentZoom) => {
    if (!containerRef.current) return { x: ox, y: oy };
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const scaleX = cw / imgNaturalSize.w;
    const scaleY = ch / imgNaturalSize.h;
    const base = Math.max(scaleX, scaleY);
    const dw = imgNaturalSize.w * base * currentZoom;
    const dh = imgNaturalSize.h * base * currentZoom;
    // Image is centered at offset=0; compute how far it can move before leaving a gap
    const maxX = (dw - cw) / 2;
    const maxY = (dh - ch) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, ox)),
      y: Math.min(maxY, Math.max(-maxY, oy)),
    };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setOffset(o => clampOffset(o.x, o.y, zoom));
  };

  // Touch support
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y });
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const t = e.touches[0];
    setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
  };

  const getCroppedImage = () => {
    const container = containerRef.current;
    if (!container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const scaleX = cw / imgNaturalSize.w;
    const scaleY = ch / imgNaturalSize.h;
    const baseScale = Math.max(scaleX, scaleY);
    const displayW = imgNaturalSize.w * baseScale * zoom;
    const displayH = imgNaturalSize.h * baseScale * zoom;

    // Center offset so image is centered when offset is 0
    const cx = (cw - displayW) / 2 + offset.x;
    const cy = (ch - displayH) / 2 + offset.y;

    // Map from container coords back to natural image coords
    const srcX = -cx / (displayW / imgNaturalSize.w);
    const srcY = -cy / (displayH / imgNaturalSize.h);
    const srcW = cw / (displayW / imgNaturalSize.w);
    const srcH = ch / (displayH / imgNaturalSize.h);

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      canvas.toBlob((blob) => {
        const file = new File([blob], 'cover-photo.jpg', { type: 'image/jpeg' });
        onSave(file);
      }, 'image/jpeg', 0.92);
    };
    img.src = imageUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Adjust Cover Photo</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Drag to reposition · This is exactly what clients will see</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* Preview container — same aspect ratio as cover photo on salon page */}
          <div
            ref={containerRef}
            className="w-full bg-secondary rounded-lg overflow-hidden border border-border relative cursor-grab active:cursor-grabbing select-none"
            style={{ height: '220px' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setIsDragging(false);
              setOffset(o => clampOffset(o.x, o.y, zoom));
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            <img
              src={imageUrl}
              alt="Preview"
              onLoad={handleImgLoad}
              draggable={false}
              className="absolute pointer-events-none"
              style={{
                width: (() => {
                  if (!containerRef.current) return '100%';
                  const cw = containerRef.current.clientWidth;
                  const ch = containerRef.current.clientHeight;
                  const scaleX = cw / imgNaturalSize.w;
                  const scaleY = ch / imgNaturalSize.h;
                  const base = Math.max(scaleX, scaleY);
                  return imgNaturalSize.w * base * zoom + 'px';
                })(),
                height: (() => {
                  if (!containerRef.current) return '100%';
                  const cw = containerRef.current.clientWidth;
                  const ch = containerRef.current.clientHeight;
                  const scaleX = cw / imgNaturalSize.w;
                  const scaleY = ch / imgNaturalSize.h;
                  const base = Math.max(scaleX, scaleY);
                  return imgNaturalSize.h * base * zoom + 'px';
                })(),
                top: '50%',
                left: '50%',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          </div>

          <div className="flex items-center gap-4 mt-5 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nz = Math.max(1, zoom - 0.1);
                setZoom(nz);
                setOffset(o => clampOffset(o.x, o.y, nz));
              }}
              className="border-border"
            >
              <ZoomOut className="w-4 h-4 mr-2" /> Zoom Out
            </Button>
            <span className="text-sm text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nz = Math.min(4, zoom + 0.1);
                setZoom(nz);
                setOffset(o => clampOffset(o.x, o.y, nz));
              }}
              className="border-border"
            >
              <ZoomIn className="w-4 h-4 mr-2" /> Zoom In
            </Button>
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1 border-border">
            Cancel
          </Button>
          <Button onClick={getCroppedImage} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
            Save Cover Photo
          </Button>
        </div>
      </div>
    </div>
  );
}