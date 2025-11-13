import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Form, ValidationIssue, FormField, BoundingBox } from '../types';
import { EditableCell } from './EditableCell';
import { CheckmarkIcon } from './icons/CheckmarkIcon';
import { WarningIcon } from './icons/WarningIcon';

interface DataTableProps {
  data: Form[];
  issues: ValidationIssue[];
  onDataUpdate: (formIndex: number, field: keyof Form, value: string) => void;
  onCellHover: (box: BoundingBox | null) => void;
  onCellFocus: (cell: { formIndex: number; field: FormField } | null) => void;
  selectedIndices: Set<number>;
  onSelectionChange: (indices: Set<number>) => void;
}

export const DataTable: React.FC<DataTableProps> = React.memo(({ 
    data, 
    issues, 
    onDataUpdate, 
    onCellHover,
    onCellFocus,
    selectedIndices,
    onSelectionChange
}) => {
  const [sortConfig, setSortConfig] = useState<{ key: keyof Form | '_verified', direction: 'asc' | 'desc' } | null>(null);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [density, setDensity] = useState<'comfortable' | 'cozy' | 'compact'>('comfortable');
  // FIX: Create a ref for the select all checkbox to set its indeterminate property
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // FIX: Use useEffect to set the indeterminate property on the checkbox.
  // The 'indeterminate' property is not a standard HTML attribute and must be set via JavaScript.
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
        selectAllCheckboxRef.current.indeterminate = selectedIndices.size > 0 && selectedIndices.size < data.length;
    }
  }, [selectedIndices, data.length]);


  // FIX: Removed unused `isShiftClick` parameter which caused a type error. The parameter was not used in the function body.
  const handleSelectRow = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    onSelectionChange(newSelection);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onSelectionChange(new Set(data.map((_, i) => i)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const sortedData = useMemo(() => {
    let sortableData = [...data];
    
    // تصفية الأخطاء فقط إذا كان الوضع مفعّل
    if (showErrorsOnly) {
      const errorIndices = new Set(issues.map(i => i.formIndex));
      sortableData = sortableData.filter((_, index) => errorIndices.has(index));
    }
    
    if (sortConfig !== null) {
      sortableData.sort((a, b) => {
        const valA = a[sortConfig.key as keyof Form];
        const valB = b[sortConfig.key as keyof Form];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableData;
  }, [data, sortConfig, showErrorsOnly, issues]);

  const findIssue = useCallback((formIndex: number, field: string): ValidationIssue | undefined => {
    return issues.find(i => i.formIndex === formIndex && i.field === field);
  }, [issues]);

  const getUnverifiedCount = useMemo(() => data.filter(row => !row._verified).length, [data]);

  const headers: FormField[] = ["Printer Name", "Ink Type", "Ink Number", "Date", "Department", "Recipient Name", "Employee ID", "Deliverer Name"];
  
  return (
    <div className="h-full w-full flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-in">
      {/* شريط أدوات الجدول */}
      <div className="flex-shrink-0 px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {issues.length > 0 && (
            <button
              onClick={() => setShowErrorsOnly(!showErrorsOnly)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                showErrorsOnly 
                  ? 'bg-amber-500 text-white shadow-md' 
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {showErrorsOnly ? `عرض الكل (${data.length})` : `الأخطاء فقط (${issues.length})`}
            </button>
          )}
          {showErrorsOnly && (
            <span className="text-xs text-slate-500">
              عرض {sortedData.length} من {data.length} صف
            </span>
          )}
        </div>
        {/* كثافة الجدول */}
        <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md p-0.5">
          {(['comfortable','cozy','compact'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setDensity(mode)}
              className={`px-2.5 py-1 text-xs rounded ${density === mode ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              {mode === 'comfortable' ? 'مريح' : mode === 'cozy' ? 'متوسط' : 'مضغوط'}
            </button>
          ))}
        </div>
      </div>
      
      <div className="overflow-auto flex-1">
        <table className="w-full divide-y divide-slate-200">
          <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
          <tr>
            <th scope="col" className="w-12 px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {/* FIX: Removed `indeterminate` prop and added `ref` to manage the indeterminate state via useEffect. */}
              <input 
                ref={selectAllCheckboxRef}
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                checked={selectedIndices.size > 0 && selectedIndices.size === data.length}
                onChange={handleSelectAll}
              />
            </th>
            {headers.map(header => (
              <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {sortedData.map((form, formIndex) => {
             const originalIndex = data.findIndex(original => original._id === form._id);
             const isSelected = selectedIndices.has(originalIndex);
             
             return (
                <tr 
                  key={form._id} 
                  className={`transition-colors duration-150 odd:bg-slate-50 even:bg-white hover:bg-blue-50/60 ${isSelected ? 'bg-blue-100/80 ring-1 ring-inset ring-blue-200' : ''}`}
                >
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      {/* FIX: Updated onChange handler to match the updated `handleSelectRow` signature. */}
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                        checked={isSelected}
                        onChange={() => handleSelectRow(originalIndex)}
                      />
                       <span 
                         data-tooltip={form._verified ? "Verified" : `Unverified`}
                       >
                       {form._verified ? (
                          <CheckmarkIcon className="h-4 w-4 text-green-500" />
                       ) : (
                          <WarningIcon className="h-4 w-4 text-amber-500" />
                       )}
                       </span>
                    </div>
                  </td>
                  {headers.map(field => {
                    const issue = findIssue(originalIndex, field);
                    const value = form[field];
                    const boundingBox = form._boundingBoxes?.[field] ?? null;

                    return (
                      <EditableCell
                        key={field}
                        formIndex={originalIndex}
                        field={field}
                        value={String(value)}
                        issue={issue}
                        confidence={form._confidence?.[field]}
                        correctionDetails={form._correctionDetails}
                        onSave={(newValue) => onDataUpdate(originalIndex, field, newValue)}
                        onHover={(isHovering) => onCellHover(isHovering && boundingBox ? boundingBox : null)}
                        onFocus={() => onCellFocus({ formIndex: originalIndex, field })}
                        density={density}
                      />
                    );
                  })}
                </tr>
             );
          })}
        </tbody>
        </table>
      </div>
      {data.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
              <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-center">
                  <p className="font-semibold text-slate-600 mb-1">لا توجد بيانات</p>
                  <p className="text-sm text-slate-400">لم يتم استخراج أي بيانات بعد</p>
              </div>
          </div>
      )}
    </div>
  );
});