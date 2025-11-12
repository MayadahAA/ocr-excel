import React, { useState, useRef, WheelEvent, MouseEvent, useEffect } from 'react';
import { ZoomIcon } from './icons/ZoomIcon';
import { BoundingBox } from '../types';

interface ImageViewerProps {
  src: string;
  alt: string;
  highlightBox: BoundingBox | null;
  imageDimensions?: { width: number; height: number };
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, highlightBox, imageDimensions }) => {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderedImageRect, setRenderedImageRect] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, [src]);

  useEffect(() => {
    const calculateRect = () => {
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
    };

    calculateRect();
    
    const observer = new ResizeObserver(calculateRect);
    const containerEl = containerRef.current;
    if (containerEl) {
      observer.observe(containerEl);
    }
    
    return () => {
      if (containerEl) {
        observer.unobserve(containerEl);
      }
    };
  }, [src, imageDimensions]);

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleDelta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(1, Math.min(transform.scale * scaleDelta, 10));

    const newX = x - (x - transform.x) * (newScale / transform.scale);
    const newY = y - (y - transform.y) * (newScale / transform.scale);
    
    setTransform({ scale: newScale, x: newX, y: newY });
  };
  
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (transform.scale <= 1) return;

    const startX = e.clientX - transform.x;
    const startY = e.clientY - transform.y;
    
    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
       moveEvent.preventDefault();
       const newX = moveEvent.clientX - startX;
       const newY = moveEvent.clientY - startY;
       setTransform(prev => ({ ...prev, x: newX, y: newY }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleDoubleClick = () => {
    setTransform({ scale: 1, x: 0, y: 0 });
  };

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
      className="w-full h-full overflow-hidden relative select-none"
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

      {transform.scale === 1 && (
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
};