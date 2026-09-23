"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Button } from "@koryo/ui/components/ui/button";

export interface SignaturePadHandle {
  /** PNG data URL, or null when nothing has been drawn. */
  toDataUrl: () => string | null;
  clear: () => void;
}

/** A finger/stylus/mouse signature pad (pointer events). Draws in the current text colour on a white card. */
export function SignaturePad({ ref, label, onChange }: { ref?: Ref<SignaturePadHandle>; label: string; onChange?: (signed: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(ratio, ratio);
    g.lineWidth = 2.5;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#111827";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const clear = () => {
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setSigned(false);
    onChange?.(false);
  };
  useImperativeHandle(ref, () => ({
    toDataUrl: () => {
      const c = canvas.current;
      if (!c || !signed) return null;
      // Flatten onto white so the stored PNG reads in any viewer.
      const out = document.createElement("canvas");
      out.width = c.width;
      out.height = c.height;
      const g = out.getContext("2d");
      if (!g) return null;
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, out.width, out.height);
      g.drawImage(c, 0, 0);
      return out.toDataURL("image/png");
    },
    clear,
  }));

  return (
    <div className="space-y-1">
      <canvas ref={canvas} role="img" aria-label={label} className="h-36 w-full touch-none rounded-lg border border-strong bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const g = e.currentTarget.getContext("2d");
          const p = point(e);
          g?.beginPath();
          g?.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const g = e.currentTarget.getContext("2d");
          const p = point(e);
          g?.lineTo(p.x, p.y);
          g?.stroke();
          if (!signed) {
            setSigned(true);
            onChange?.(true);
          }
        }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerCancel={() => { drawing.current = false; }} />
      <div className="flex items-center justify-between text-xs text-fg-muted">
        <span>{signed ? "Signed" : "Sign above"}</span>
        <Button type="button" size="sm" variant="ghost" onClick={clear}>Clear</Button>
      </div>
    </div>
  );
}
