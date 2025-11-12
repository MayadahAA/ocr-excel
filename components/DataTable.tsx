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
  }, [data, sortConfig]);

  const findIssue = useCallback((formIndex: number, field: string): ValidationIssue | undefined => {
    return issues.find(i => i.formIndex === formIndex && i.field === field);
  }, [issues]);

  const getUnverifiedCount = useMemo(() => data.filter(row => !row._verified).length, [data]);

  const headers: FormField[] = ["Printer Name", "Ink Type", "Ink Number", "Date", "Department", "Recipient Name", "Employee ID", "Deliverer Name"];
  
  return (
    <div className="overflow-auto h-full rounded-lg border border-slate-700/50 bg-slate-900/50 relative glassmorphism">
      <table className="min-w-full divide-y divide-slate-800 table-fixed">
        <thead className="sticky top-0 bg-slate-900/70 backdrop-blur-sm z-10">
          <tr>
            <th scope="col" className="w-16 px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {/* FIX: Removed `indeterminate` prop and added `ref` to manage the indeterminate state via useEffect. */}
              <input 
                ref={selectAllCheckboxRef}
                type="checkbox"
                className="w-4 h-4 rounded bg-slate-700 border-slate-500 text-blue-500 focus:ring-blue-500"
                checked={selectedIndices.size > 0 && selectedIndices.size === data.length}
                onChange={handleSelectAll}
              />
            </th>
            {headers.map(header => (
              <th key={header} scope="col" className={`px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-48`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sortedData.map((form, formIndex) => {
             const originalIndex = data.findIndex(original => original._id === form._id);
             const isSelected = selectedIndices.has(originalIndex);
             
             return (
                <tr 
                  key={form._id} 
                  className={`transition-colors duration-200 hover:bg-slate-700/30 ${isSelected ? 'row-selected' : ''}`}
                >
                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex items-center space-x-3">
                      {/* FIX: Updated onChange handler to match the updated `handleSelectRow` signature. */}
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded bg-slate-700 border-slate-500 text-blue-500 focus:ring-blue-500"
                        checked={isSelected}
                        onChange={() => handleSelectRow(originalIndex)}
                      />
                       <span 
                         data-tooltip={form._verified ? "Verified" : `Unverified`}
                       >
                       {form._verified ? (
                          <CheckmarkIcon className="h-5 w-5 text-green-400" />
                       ) : (
                          <WarningIcon className="h-5 w-5 text-amber-500" />
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
                      />
                    );
                  })}
                </tr>
             );
          })}
        </tbody>
      </table>
      {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
              No data has been extracted yet.
          </div>
      )}
    </div>
  );
});