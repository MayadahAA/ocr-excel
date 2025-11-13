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
  focusedCell?: { formIndex: number; field: string } | null;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = React.memo(({ src, alt, highlightBox, imageDimensions, qualityReport, focusedCell }) => {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderedImageRect, setRenderedImageRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, [src]);
  
  // إغلاق Lightbox بـ ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLightboxOpen) {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isLightboxOpen]);
  
  // تكبير تلقائي عند النقر على خلية
  useEffect(() => {
    if (!highlightBox || !containerRef.current || renderedImageRect.width === 0) return;
    
    const [x_min, y_min, x_max, y_max] = highlightBox.box;
    const boxCenterX = (x_min + x_max) / 2;
    const boxCenterY = (y_min + y_max) / 2;
    
    // تكبير إلى 200%
    const targetScale = 2;
    const container = containerRef.current;
    const containerCenterX = container.clientWidth / 2;
    const containerCenterY = container.clientHeight / 2;
    
    // حساب الموقع لوضع المنطقة في المنتصف
    const imageCenterX = renderedImageRect.x + boxCenterX * renderedImageRect.width;
    const imageCenterY = renderedImageRect.y + boxCenterY * renderedImageRect.height;
    
    const newX = containerCenterX - imageCenterX * targetScale;
    const newY = containerCenterY - imageCenterY * targetScale;
    
    setTransform({ scale: targetScale, x: newX, y: newY });
  }, [highlightBox, renderedImageRect]);

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
        className="absolute border-4 border-red-500 bg-yellow-400/20 transition-all duration-300 pointer-events-none rounded-sm animate-pulse"
        style={{
          left: `${renderedImageRect.x + x_min * renderedImageRect.width}px`,
          top: `${renderedImageRect.y + y_min * renderedImageRect.height}px`,
          width: `${(x_max - x_min) * renderedImageRect.width}px`,
          height: `${(y_max - y_min) * renderedImageRect.height}px`,
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.8), inset 0 0 20px rgba(250, 204, 21, 0.3)',
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
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex items-center gap-1.5 sm:gap-2 glassmorphism p-1.5 sm:p-2 rounded-lg text-xs text-slate-300 max-w-[95%]">
          <InfoIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-400 flex-shrink-0" />
          <div className="overflow-hidden">
             <p className="font-semibold truncate text-[10px] sm:text-xs">
              Quality: {qualityReport.score}/100
              <span className="font-normal text-slate-400 ml-1 sm:ml-2">(S: {qualityReport.sharpness}, C: {qualityReport.contrast})</span>
            </p>
            <p className="text-slate-400 truncate mt-0.5 text-[10px] sm:text-xs hidden sm:block">Applied: {qualityReport.appliedOps.join(', ')}</p>
          </div>
        </div>
      )}

       <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 flex items-center gap-0.5 sm:gap-1 glassmorphism p-0.5 sm:p-1 rounded-lg">
          <button
            onClick={() => zoom(0.8)}
            className="p-1.5 sm:p-2 text-slate-300 hover:bg-slate-700 rounded-md transition-colors"
            data-tooltip="تصغير (Zoom Out)"
          >
            <CloseIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 rotate-45"/>
          </button>
          <button
            onClick={() => zoom(1.2)}
            className="p-1.5 sm:p-2 text-slate-300 hover:bg-slate-700 rounded-md transition-colors"
            data-tooltip="تكبير (Zoom In)"
          >
            <PlusIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>
          </button>
          <button
            onClick={() => setTransform({ scale: 1, x: 0, y: 0 })}
            className="p-1.5 sm:p-2 text-slate-300 hover:bg-slate-700 rounded-md transition-colors"
            data-tooltip="إعادة ضبط (Reset)"
          >
            <ZoomIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>
          </button>
          <button
            onClick={() => setIsLightboxOpen(true)}
            className="p-1.5 sm:p-2 text-slate-300 hover:bg-slate-700 rounded-md transition-colors border-r border-slate-600"
            data-tooltip="عرض كامل (Fullscreen)"
          >
            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          <div className="px-1.5 sm:px-2 text-[10px] sm:text-xs text-slate-400">
            {Math.round(transform.scale * 100)}%
          </div>
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
      
      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button 
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            data-tooltip="إغلاق (ESC)"
          >
            <CloseIcon className="h-6 w-6 text-white" />
          </button>
          <img 
            src={src} 
            alt={alt}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
});