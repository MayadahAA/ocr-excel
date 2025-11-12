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

export const EditableCell: React.FC<EditableCellProps> = ({
  formIndex,
  field,
  value,
  issue,
  confidence,
  correctionDetails,
  onSave,
  onHover,
  onFocus,
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

  return (
    <td
      id={`cell-${formIndex}-${field.replace(/\s/g, '-')}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={!isEditing ? handleClick : undefined}
      className={`px-4 py-2.5 text-sm text-slate-300 relative transition-colors duration-200 cursor-pointer w-48 ${getBorderClass()}`}
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
          className={`w-full bg-slate-700/80 text-white p-1.5 rounded-md outline-none focus:ring-2 focus:ring-blue-500 ${isArabic ? 'text-right' : 'text-left'}`}
          dir={isArabic ? 'rtl' : 'ltr'}
        />
      ) : (
        <div className="flex items-center gap-2">
            <span className={`block truncate ${isArabic ? 'text-right flex-grow' : 'text-left'}`}>
              {value || <span className="text-slate-500 italic">empty</span>}
            </span>
            {correctionInfo && <SparkleIcon className="h-4 w-4 text-cyan-400 flex-shrink-0" />}
        </div>
      )}
    </td>
  );
};