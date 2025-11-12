import React, { useState, useRef, WheelEvent, MouseEvent, useEffect, useCallback } from 'react';
import { BoundingBox, QualityReport } from '../types';
import { ZoomIcon } from './icons/ZoomIcon';
import { PlusIcon } from './icons/PlusIcon';
import { CloseIcon } from './icons/CloseIcon'; // Reusing for minus
import { InfoIcon } from './icons/InfoIcon';

interface DocumentViewerProps {
  src: string;
  alt: string;
  highlightBox: BoundingBox | null;
  imageDimensions?: { width: number; height: number };
  qualityReport?: QualityReport | null;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = React.memo(({ src, alt, highlightBox, imageDimensions, qualityReport }) => {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderedImageRect, setRenderedImageRect] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, [src]);

  const calculateRect = useCallback(() => {
    if (!containerRef.current || !imageDimensions) {
      setRenderedImageRect({ x: 0, y: 0, width: 0, height: 0 });
      return;
    };

    const container = containerRef.current;
    const { width: imageWidth, height: imageHeight } = imageDimensions;
    if (imageHeight === 0 || container.clientHeight === 0 || imageWidth === 0) return;

    const containerRatio = container.clientWidth / container.clientHeight;
    const imageRatio = imageWidth / imageHeight;
    
    let width, height, x, y;
    if (containerRatio > imageRatio) {
      height = container.clientHeight;
      width = height * imageRatio;
      x = (container.clientWidth - width) / 2;
      y = 0;
    } else {
      width = container.clientWidth;
      height = width / imageRatio;
      x = 0;
      y = (container.clientHeight - height) / 2;
    }
    setRenderedImageRect({ x, y, width, height });
  }, [imageDimensions]);

  useEffect(() => {
    calculateRect();
    const observer = new ResizeObserver(calculateRect);
    const containerEl = containerRef.current;
    if (containerEl) observer.observe(containerEl);
    return () => { if (containerEl) observer.unobserve(containerEl); };
  }, [src, calculateRect]);

  const zoom = (scaleDelta: number, clientX?: number, clientY?: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX ?? (rect.left + rect.width / 2)) - rect.left;
    const y = (clientY ?? (rect.top + rect.height / 2)) - rect.top;

    const newScale = Math.max(1, Math.min(transform.scale * scaleDelta, 10));
    const newX = x - (x - transform.x) * (newScale / transform.scale);
    const newY = y - (y - transform.y) * (newScale / transform.scale);
    setTransform({ scale: newScale, x: newX, y: newY });
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    zoom(e.deltaY > 0 ? 0.9 : 1.1, e.clientX, e.clientY);
  };
  
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (transform.scale <= 1) return;

    const startX = e.clientX - transform.x;
    const startY = e.clientY - transform.y;
    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
       setTransform(prev => ({ ...prev, x: moveEvent.clientX - startX, y: moveEvent.clientY - startY }));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleDoubleClick = () => setTransform({ scale: 1, x: 0, y: 0 });

  const renderBoundingBox = () => {
    if (!highlightBox || !imageDimensions || renderedImageRect.width === 0) return null;
    const [x_min, y_min, x_max, y_max] = highlightBox.box;
    return (
      <div
        className="absolute border-2 border-cyan-400 bg-cyan-400/30 transition-all duration-150 pointer-events-none rounded-sm"
        style={{
          left: `${renderedImageRect.x + x_min * renderedImageRect.width}px`,
          top: `${renderedImageRect.y + y_min * renderedImageRect.height}px`,
          width: `${(x_max - x_min) * renderedImageRect.width}px`,
          height: `${(y_max - y_min) * renderedImageRect.height}px`,
          boxShadow: '0 0 15px rgba(0, 255, 255, 0.7)',
        }}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative select-none bg-slate-900/50 rounded-lg group"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: transform.scale > 1 ? 'grab' : 'zoom-in' }}
    >
      <div
        className="w-full h-full relative transition-transform duration-100 ease-out"
        style={{ 
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          style={{ cursor: transform.scale > 1 ? 'grabbing' : 'zoom-in' }}
          draggable="false"
        />
        {renderBoundingBox()}
      </div>

       {qualityReport && (
        <div className="absolute top-3 left-3 flex items-center gap-2 glassmorphism p-2 rounded-lg text-xs text-slate-300 max-w-[95%]">
          <InfoIcon className="h-4 w-4 text-cyan-400 flex-shrink-0" />
          <div className="overflow-hidden">
             <p className="font-semibold truncate">
              Quality: {qualityReport.score}/100 
              <span className="font-normal text-slate-400 ml-2">(S: {qualityReport.sharpness}, C: {qualityReport.contrast})</span>
            </p>
            <p className="text-slate-400 truncate mt-0.5">Applied: {qualityReport.appliedOps.join(', ')}</p>
          </div>
        </div>
      )}

       <div className="absolute bottom-3 right-3 flex items-center gap-1 glassmorphism p-1 rounded-lg">
          <button onClick={() => zoom(0.8)} className="p-2 text-slate-300 hover:bg-slate-700 rounded-md transition-colors"><CloseIcon className="h-4 w-4 rotate-45"/></button>
          <button onClick={() => zoom(1.2)} className="p-2 text-slate-300 hover:bg-slate-700 rounded-md transition-colors"><PlusIcon className="h-4 w-4"/></button>
       </div>

      {transform.scale === 1 && !highlightBox && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="flex flex-col items-center text-white text-sm bg-black/50 p-4 rounded-lg">
                <ZoomIcon className="h-8 w-8 mb-2" />
                <p>Scroll to Zoom</p>
                <p className="text-xs text-slate-300">Double-click to reset</p>
            </div>
        </div>
      )}
    </div>
  );
});