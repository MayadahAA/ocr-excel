import React, { useState, useMemo, useCallback } from 'react';
import { UploadedFile, FormField, Form, BoundingBox } from '../types';
import { CheckmarkIcon } from './icons/CheckmarkIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { DataTable } from './DataTable';
import { SaveIcon } from './icons/SaveIcon';
import { ValidationPanel } from './ValidationPanel';
import { TrashIcon } from './icons/TrashIcon';

interface ResultsPanelProps {
    selectedFile: UploadedFile | undefined;
    onDataUpdate: (formIndex: number, field: keyof Form, value: string) => void;
    onSave: () => void;
    onDeleteRows: (indices: number[]) => void;
    onBatchUpdate: (indices: number[], field: FormField, find: string, replace: string) => void;
    onRowVerificationUpdate: (indices: number[], verified: boolean) => void;
    onCellFocus: (cell: { formIndex: number; field: FormField } | null) => void;
    onCellHover: (box: BoundingBox | null) => void;
}

const BatchActionsToolbar: React.FC<{
  selectedCount: number;
  onDelete: () => void;
  onVerify: () => void;
  onUnverify: () => void;
  onClear: () => void;
}> = ({ selectedCount, onDelete, onVerify, onUnverify, onClear }) => (
    <div className="flex items-center gap-2 p-2 rounded-lg glassmorphism border border-slate-700">
        <span className="text-sm font-semibold text-slate-300 px-2">{selectedCount} selected</span>
        <div className="w-px h-6 bg-slate-700 mx-1"></div>
        <button onClick={onVerify} data-tooltip="Mark as Verified" className="p-2 rounded-md hover:bg-slate-700 transition-colors text-green-400"><CheckmarkIcon className="h-5 w-5"/></button>
        <button onClick={onDelete} data-tooltip="Delete Rows" className="p-2 rounded-md hover:bg-slate-700 transition-colors text-red-400"><TrashIcon className="h-5 w-5"/></button>
        <button onClick={onClear} className="text-sm text-slate-400 hover:text-white ml-auto px-3">Clear</button>
    </div>
);

export const ResultsPanel: React.FC<ResultsPanelProps> = React.memo(({
    selectedFile,
    onDataUpdate,
    onSave,
    onDeleteRows,
    onBatchUpdate,
    onRowVerificationUpdate,
    onCellFocus,
    onCellHover,
}) => {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    
    const verificationProgress = useMemo(() => {
        if (!selectedFile?.extractedData) return 0;
        const verifiedCount = selectedFile.extractedData.filter(d => d._verified).length;
        return selectedFile.extractedData.length > 0
            ? (verifiedCount / selectedFile.extractedData.length) * 100
            : 100;
    }, [selectedFile]);

    const handleSelectionChange = useCallback((indices: Set<number>) => {
        setSelectedIndices(indices);
    }, []);

    const handleDeleteSelected = () => {
        onDeleteRows(Array.from(selectedIndices));
        setSelectedIndices(new Set());
    };
    const handleVerifySelected = () => {
        onRowVerificationUpdate(Array.from(selectedIndices), true);
        setSelectedIndices(new Set());
    };
    
    // Clear selection when file changes
    React.useEffect(() => {
        setSelectedIndices(new Set());
    }, [selectedFile?.id]);

    return (
        <div className="w-full h-full flex flex-col space-y-4 glassmorphism rounded-xl p-4 min-h-0">
            <header className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-white flex items-center">
                        <span className="flex items-center justify-center h-8 w-8 mr-3 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500"><CheckmarkIcon className="h-5 w-5"/></span>
                        Extracted Data
                    </h2>
                    <p className="text-sm text-slate-400 ml-11 truncate">{selectedFile ? `from ${selectedFile.name}` : 'No file selected'}</p>
                </div>
                {selectedFile?.extractedData && selectedIndices.size === 0 && (
                    <div className="w-full sm:w-56">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Verification Progress</span>
                            <span>{Math.round(verificationProgress)}%</span>
                        </div>
                        <div className="w-full bg-slate-700/50 rounded-full h-2">
                           <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500" style={{width: `${verificationProgress}%`}}></div>
                        </div>
                    </div>
                )}
                {selectedFile?.extractedData && selectedIndices.size > 0 && (
                     <BatchActionsToolbar 
                         selectedCount={selectedIndices.size}
                         onDelete={handleDeleteSelected}
                         onVerify={handleVerifySelected}
                         onUnverify={() => {}}
                         onClear={() => setSelectedIndices(new Set())}
                     />
                )}
            </header>
            
            {!selectedFile && <div className="flex-grow flex items-center justify-center glassmorphism rounded-xl text-slate-400">Select a document to view data.</div>}
            
            {selectedFile && (
                <>
                    <div className="flex-grow min-h-0">
                        {selectedFile.status === 'processing' && <div className="flex h-full items-center justify-center"><SpinnerIcon /> <span className="ml-2">Processing document...</span></div>}
                        {selectedFile.status === 'error' && <div className="flex h-full items-center justify-center text-red-400">Extraction failed for this document.</div>}
                        {selectedFile.status === 'pending' && <div className="flex h-full items-center justify-center text-slate-400">Ready for extraction.</div>}
                        
                        {selectedFile.extractedData && (
                           <DataTable 
                                data={selectedFile.extractedData} 
                                issues={selectedFile.validationIssues || []}
                                onDataUpdate={onDataUpdate}
                                onCellHover={onCellHover}
                                onCellFocus={onCellFocus}
                                selectedIndices={selectedIndices}
                                onSelectionChange={handleSelectionChange}
                            />
                        )}
                    </div>
                    
                    {selectedFile.validationIssues && selectedFile.validationIssues.length > 0 && (
                        <ValidationPanel
                            issues={selectedFile.validationIssues}
                            onIssueClick={(issue) => onCellFocus({ formIndex: issue.formIndex, field: issue.field })}
                        />
                    )}

                    <footer className="flex-shrink-0 flex justify-end items-center gap-3 pt-4 border-t border-slate-700/50">
                        <button
                            id="validate-and-save-button"
                            onClick={onSave}
                            disabled={!selectedFile?.extractedData}
                            className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-2.5 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20"
                        >
                            <SaveIcon className="h-5 w-5"/>
                            <span>Save Changes</span>
                        </button>
                    </footer>
                </>
            )}
        </div>
    );
});