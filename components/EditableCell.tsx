import React, { useState, useEffect, useRef } from 'react';
import { ValidationIssue, Form, FormField } from '../types';
import { SparkleIcon } from './icons/SparkleIcon';

interface EditableCellProps {
  formIndex: number;
  field: FormField;
  value: string;
  issue?: ValidationIssue;
  confidence?: number;
  correctionDetails?: Form['_correctionDetails'];
  onSave: (newValue: string) => void;
  onHover: (isHovering: boolean) => void;
  onFocus: () => void;
}

type Density = 'comfortable' | 'cozy' | 'compact';

export const EditableCell: React.FC<EditableCellProps & { density?: Density }> = ({
  formIndex,
  field,
  value,
  issue,
  confidence,
  correctionDetails,
  onSave,
  onHover,
  onFocus,
  density = 'comfortable'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);
  
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (currentValue !== value) {
      onSave(currentValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  const handleClick = () => {
    setIsEditing(true);
    onFocus();
  };

  const getBorderClass = () => {
    if (!issue) return '';
    switch (issue.type) {
      case 'missing': return 'cell-border-missing';
      case 'confidence': return 'cell-border-confidence';
      case 'format': return 'cell-border-format';
      default: return '';
    }
  };

  const correctionInfo = correctionDetails?.[field];

  const getTooltip = () => {
      let tooltipText = issue?.message || '';
      if(confidence !== undefined) {
          tooltipText += `${tooltipText ? '\n' : ''}Confidence: ${Math.round(confidence * 100)}%`;
      }
      if (correctionInfo) {
          tooltipText += `${tooltipText ? '\n' : ''}Auto-corrected from "${correctionInfo.original}"\nReason: ${correctionInfo.reason}`;
      }
      return tooltipText;
  }

  const isArabic = /[\u0600-\u06FF]/.test(value);
  
  // تحديد لون المؤشر حسب الثقة
  const getConfidenceColor = () => {
    if (!confidence) return null;
    if (confidence >= 0.9) return 'bg-green-500';
    if (confidence >= 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  const confidenceColor = getConfidenceColor();

  const densityClass =
    density === 'compact'
      ? 'px-2 py-1.5 text-xs'
      : density === 'cozy'
      ? 'px-3 py-2 text-sm'
      : 'px-4 py-3 text-sm';

  return (
    <td
      id={`cell-${formIndex}-${field.replace(/\s/g, '-')}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={!isEditing ? handleClick : undefined}
      className={`${densityClass} text-slate-900 relative transition-colors duration-200 cursor-pointer ${isArabic ? 'text-right' : 'text-left'} ${getBorderClass()}`}
      data-tooltip={getTooltip()}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`w-full bg-white border border-slate-300 text-slate-900 px-3 py-2 rounded-lg shadow-sm outline-none focus:ring-2 focus:ring-blue-400 ${isArabic ? 'text-right' : 'text-left'}`}
          dir={isArabic ? 'rtl' : 'ltr'}
        />
      ) : (
        <div className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : 'flex-row'}`}>
            {confidenceColor && (
              <div 
                className={`w-2 h-2 rounded-full ${confidenceColor} flex-shrink-0`}
                data-tooltip={`Confidence: ${Math.round((confidence || 0) * 100)}%`}
              />
            )}
            <span className={`block truncate leading-relaxed ${isArabic ? 'text-right flex-grow font-medium' : 'text-left flex-grow font-medium'}`}>
              {value || <span className="text-slate-400 italic">empty</span>}
            </span>
            {correctionInfo && <SparkleIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />}
        </div>
      )}
    </td>
  );
};