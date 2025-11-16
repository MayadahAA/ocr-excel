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

    const totalRows = selectedFile?.extractedData?.length || 0;
    const verifiedRows = selectedFile?.extractedData?.filter(d => d._verified).length || 0;
    const errorCount = selectedFile?.validationIssues?.length || 0;
    
    return (
        <div className="w-full h-full flex flex-col gap-3 sm:gap-4 glassmorphism rounded-xl p-3 sm:p-4 overflow-hidden">
            <header className="flex-shrink-0 flex flex-col gap-2 sm:gap-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base sm:text-lg font-semibold text-white flex items-center">
                            <span className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 mr-2 sm:mr-3 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0"><CheckmarkIcon className="h-4 w-4 sm:h-5 sm:w-5"/></span>
                            <span className="truncate">Extracted Data</span>
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-400 ml-9 sm:ml-11 truncate">{selectedFile ? `from ${selectedFile.name}` : 'No file selected'}</p>
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
                </div>
                
                {/* شريط الإحصائيات */}
                {selectedFile?.extractedData && (
                    <div className="flex flex-wrap gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-400 flex-shrink-0"></div>
                            <span className="text-xs text-slate-300 whitespace-nowrap">
                                <span className="font-semibold text-white">{totalRows}</span> صف كلي
                            </span>
                        </div>
                        <div className="w-px h-3 sm:h-4 bg-slate-600"></div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-400 flex-shrink-0"></div>
                            <span className="text-xs text-slate-300 whitespace-nowrap">
                                <span className="font-semibold text-green-400">{verifiedRows}</span> تم المراجعة
                            </span>
                        </div>
                        <div className="w-px h-3 sm:h-4 bg-slate-600"></div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 flex-shrink-0"></div>
                            <span className="text-xs text-slate-300 whitespace-nowrap">
                                <span className="font-semibold text-amber-400">{totalRows - verifiedRows}</span> متبقي
                            </span>
                        </div>
                        <div className="w-px h-3 sm:h-4 bg-slate-600"></div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-400 flex-shrink-0"></div>
                            <span className="text-xs text-slate-300 whitespace-nowrap">
                                <span className="font-semibold text-red-400">{errorCount}</span> خطأ
                            </span>
                        </div>
                    </div>
                )}
            </header>
            
            {!selectedFile && (
                <div className="flex-grow flex flex-col items-center justify-center glassmorphism rounded-xl text-slate-400 gap-4">
                    <svg className="w-24 h-24 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="text-center">
                        <p className="text-lg font-semibold text-slate-300 mb-2">لا يوجد مستند محدد</p>
                        <p className="text-sm text-slate-500">اختر مستنداً من القائمة لعرض البيانات المستخرجة</p>
                    </div>
                </div>
            )}
            
            {selectedFile && (
                <>
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                        {selectedFile.status === 'processing' && (
                            <div className="flex h-full flex-col items-center justify-center gap-4">
                                <SpinnerIcon className="w-12 h-12 text-blue-500" />
                                <div className="text-center">
                                    <p className="text-lg font-semibold text-slate-300 mb-1">جاري المعالجة...</p>
                                    <p className="text-sm text-slate-500">يتم استخراج البيانات من المستند</p>
                                </div>
                            </div>
                        )}
                        {selectedFile.status === 'error' && (
                            <div className="flex h-full flex-col items-center justify-center gap-4">
                                <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="text-center">
                                    <p className="text-lg font-semibold text-red-400 mb-1">فشل الاستخراج</p>
                                    <p className="text-sm text-slate-500">حدث خطأ أثناء معالجة هذا المستند</p>
                                </div>
                            </div>
                        )}
                        {selectedFile.status === 'pending' && (
                            <div className="flex h-full flex-col items-center justify-center gap-4">
                                <svg className="w-20 h-20 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <div className="text-center">
                                    <p className="text-lg font-semibold text-slate-300 mb-1">جاهز للاستخراج</p>
                                    <p className="text-sm text-slate-500">انقر على "Extract All" لبدء معالجة المستند</p>
                                </div>
                            </div>
                        )}
                        
                        {selectedFile.extractedData && (
                           <div className="flex-1 min-h-0 overflow-hidden">
                               <DataTable
                                    data={selectedFile.extractedData}
                                    issues={selectedFile.validationIssues || []}
                                    onDataUpdate={onDataUpdate}
                                    onCellHover={onCellHover}
                                    onCellFocus={onCellFocus}
                                    selectedIndices={selectedIndices}
                                    onSelectionChange={handleSelectionChange}
                                />
                           </div>
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