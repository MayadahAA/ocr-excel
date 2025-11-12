import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultsPanel } from './components/ResultsPanel';
import { DocumentViewer } from './components/DocumentViewer';
import { extractFormData } from './services/geminiService';
import { Form, UploadedFile, ToastMessage, FormField, BoundingBox } from './types';
import { db } from './services/mockDatabase';

import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { Toast } from './components/Toast';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { SplitViewIcon } from './components/icons/SplitViewIcon';
import { ImageIcon } from './components/icons/ImageIcon';

const useMediaQuery = (query: string) => {
    const [matches, setMatches] = useState(window.matchMedia(query).matches);

    useEffect(() => {
        const mediaQueryList = window.matchMedia(query);
        const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
        mediaQueryList.addEventListener('change', handleChange);
        return () => mediaQueryList.removeEventListener('change', handleChange);
    }, [query]);

    return matches;
};

const App: React.FC = () => {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [focusedCell, setFocusedCell] = useState<{ formIndex: number; field: FormField } | null>(null);
    const [hoveredBox, setHoveredBox] = useState<BoundingBox | null>(null);

    const [leftPanelWidth, setLeftPanelWidth] = useState(35); // Initial width in percentage
    const isResizing = useRef(false);
    const isDesktop = useMediaQuery('(min-width: 768px)');
    
    const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    useEffect(() => {
        const initialFiles = db.getAllFiles();
        setUploadedFiles(initialFiles);
        if (initialFiles.length > 0 && !selectedFileId) {
            setSelectedFileId(initialFiles[0].id);
        }
    }, [selectedFileId]);
    
    useEffect(() => {
        if(focusedCell) {
            setTimeout(() => {
                const cellId = `cell-${focusedCell.formIndex}-${focusedCell.field.replace(/\s/g, '-')}`;
                const element = document.getElementById(cellId);
                element?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }, 100);
        }
    }, [focusedCell]);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 's') {
                event.preventDefault();
                const saveButton = document.getElementById('validate-and-save-button');
                saveButton?.click();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        e.currentTarget.classList.add('resizing');
    };

    const handleMouseUp = useCallback(() => {
        isResizing.current = false;
        document.body.style.cursor = 'default';
        const handle = document.querySelector('.resize-handle');
        handle?.classList.remove('resizing');
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing.current) return;
        const newLeftWidth = (e.clientX / window.innerWidth) * 100;
        if (newLeftWidth > 20 && newLeftWidth < 80) {
            setLeftPanelWidth(newLeftWidth);
        }
    }, []);
    
    useEffect(() => {
        if (isDesktop) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDesktop, handleMouseMove, handleMouseUp]);


    const selectedFile = useMemo(() => uploadedFiles.find(f => f.id === selectedFileId), [uploadedFiles, selectedFileId]);

    const refreshFilesFromDb = useCallback(() => {
        setUploadedFiles(db.getAllFiles());
    }, []);

    const handleAddFiles = useCallback((newFiles: File[]) => {
        const addedFiles = db.addFiles(newFiles);
        refreshFilesFromDb();
        if (!selectedFileId && addedFiles.length > 0) {
            setSelectedFileId(addedFiles[0].id);
        }
        addToast(`${addedFiles.length} file(s) added.`, 'info');
    }, [selectedFileId, refreshFilesFromDb, addToast]);

    const handleRemoveFile = useCallback((idToRemove: string) => {
        db.removeFile(idToRemove);
        const newFiles = db.getAllFiles();
        setUploadedFiles(newFiles);
        if (selectedFileId === idToRemove) {
            setSelectedFileId(newFiles.length > 0 ? newFiles[0].id : null);
        }
    }, [selectedFileId]);

    const handleClearAll = useCallback(() => {
        db.clearAll();
        refreshFilesFromDb();
        setSelectedFileId(null);
    }, [refreshFilesFromDb]);

    const handleExtractAll = useCallback(async () => {
        const filesToProcess = db.getAllFiles().filter(f => f.status === 'pending');
        if (!filesToProcess.length) {
             addToast(`No pending files to process.`, 'info');
             return;
        }

        setIsExtracting(true);
        filesToProcess.forEach(f => db.updateFileStatus(f.id, 'processing'));
        refreshFilesFromDb();

        const MAX_CONCURRENT = 3; // معالجة 3 ملفات بالتوازي
        const results = { success: 0, failed: 0 };

        for (let i = 0; i < filesToProcess.length; i += MAX_CONCURRENT) {
            const batch = filesToProcess.slice(i, i + MAX_CONCURRENT);
            await Promise.all(
                batch.map(async (fileToProcess) => {
                    try {
                        const { forms, processedPreviewUrl, imageDimensions, qualityReport } = await extractFormData(fileToProcess.file);
                        db.updateFileWithExtractedData(fileToProcess.id, forms, processedPreviewUrl, imageDimensions, qualityReport);
                        results.success++;
                    } catch (err) {
                        console.error(err);
                        addToast(`Extraction failed for ${fileToProcess.name}.`, 'error');
                        db.updateFileStatus(fileToProcess.id, 'error');
                        results.failed++;
                    }
                })
            );
            refreshFilesFromDb();
        }
        
        setIsExtracting(false);
        addToast(`Processed: ${results.success} success, ${results.failed} failed`, results.failed ? 'info' : 'success');
    }, [refreshFilesFromDb, addToast]);
    
    const handleDataUpdate = useCallback((formIndex: number, field: keyof Form, value: string) => {
        if (!selectedFileId) return;
        db.updateRowData(selectedFileId, formIndex, field, value);
        refreshFilesFromDb();
    }, [selectedFileId, refreshFilesFromDb]);

    const handleRowVerificationUpdate = useCallback((indices: number[], verified: boolean) => {
        if (!selectedFileId) return;
        db.updateRowsVerification(selectedFileId, indices, verified);
        refreshFilesFromDb();
    }, [selectedFileId, refreshFilesFromDb]);

    const handleBatchUpdate = useCallback((indices: number[], field: FormField, find: string, replace: string) => {
        if (!selectedFileId) return;
        db.batchUpdateRows(selectedFileId, indices, field, find, replace);
        refreshFilesFromDb();
        addToast(`Updated ${indices.length} rows.`, 'success');
    }, [selectedFileId, refreshFilesFromDb, addToast]);

    const handleDeleteRows = useCallback((indices: number[]) => {
        if (!selectedFileId) return;
        db.deleteRows(selectedFileId, indices);
        refreshFilesFromDb();
        addToast(`Deleted ${indices.length} rows.`, 'success');
    }, [selectedFileId, refreshFilesFromDb, addToast]);
    
    const handleExport = useCallback(() => {
        const filesToExport = uploadedFiles.filter(f => f.status === 'processed' && f.extractedData && f.extractedData.length > 0);
    
        if (filesToExport.length === 0) {
            addToast("No processed data available to export.", "error");
            return;
        }
    
        let allExtractedData: (Form & { "Source File": string })[] = [];
        filesToExport.forEach(file => {
            if (file.extractedData) {
                const dataWithSource = file.extractedData.map(row => ({
                    ...row,
                    "Source File": file.name
                }));
                allExtractedData = allExtractedData.concat(dataWithSource);
            }
        });
    
        if (allExtractedData.length === 0) {
            addToast("No data to export.", "error");
            return;
        }
    
        const baseHeaders = Object.keys(allExtractedData[0]).filter(h => !h.startsWith('_') && h !== "Source File") as FormField[];
        const headers: string[] = ["Source File", ...baseHeaders];
    
        const csvRows = [
            headers.join(','),
            ...allExtractedData.map(row => 
                headers.map(header => 
                    `"${String((row as any)[header] ?? '').replace(/"/g, '""')}"`
                ).join(',')
            )
        ];
    
        const csvString = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `all_documents_extracted.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        a.remove();
        addToast(`Data from ${filesToExport.length} file(s) exported successfully!`, "success");
    }, [uploadedFiles, addToast]);

    const handleSave = useCallback(() => {
        if (!selectedFile) return;
        db.commitChanges(selectedFile.id);
        refreshFilesFromDb();
        addToast("All changes have been saved!", 'success');
    }, [selectedFile, addToast, refreshFilesFromDb]);
    
    return (
        <div className="h-full w-full p-2 sm:p-4 flex flex-col gap-4">
            <header className="flex-shrink-0 w-full flex flex-wrap justify-between items-center gap-4 py-3 px-6 border-b border-slate-700/50 glassmorphism rounded-xl">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">Form Extractor Pro</h1>
                    <p className="text-xs sm:text-sm text-slate-400">Advanced Multi-Document OCR System</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-center">
                    <button onClick={handleExport} className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold glassmorphism rounded-lg hover:border-slate-500 transition-colors border-slate-700/80">
                       <DownloadIcon className="h-4 w-4" /> <span className="hidden sm:inline">Export All (CSV)</span>
                    </button>
                    <button onClick={handleExtractAll} disabled={isExtracting} className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20">
                        {isExtracting ? <SpinnerIcon /> : <SplitViewIcon className="h-4 w-4" />}
                        <span>{isExtracting ? 'Extracting...' : `Extract All (${uploadedFiles.filter(f => f.status === 'pending').length})`}</span>
                    </button>
                </div>
            </header>

            <main className={`flex-grow flex min-h-0 gap-4 ${isDesktop ? 'flex-row' : 'flex-col'}`}>
                <div 
                    className="flex flex-col p-4 glassmorphism rounded-xl min-h-0"
                    style={isDesktop ? { width: `${leftPanelWidth}%` } : { height: '50%' }}
                >
                    <div className="flex-shrink-0" style={{ height: '40%'}}>
                        <ImageUploader 
                            files={uploadedFiles}
                            selectedFileId={selectedFileId}
                            onAddFiles={handleAddFiles}
                            onRemoveFile={handleRemoveFile}
                            onSelectFile={setSelectedFileId}
                            onClear={handleClearAll}
                        />
                    </div>
                    <div className="flex-grow pt-4 mt-4 border-t border-slate-700/50 min-h-0">
                         {selectedFile ? (
                            <DocumentViewer
                                key={selectedFile.id}
                                src={selectedFile.processedPreviewUrl || selectedFile.previewUrl}
                                alt={`Preview of ${selectedFile.name}`}
                                highlightBox={hoveredBox}
                                imageDimensions={selectedFile.imageDimensions}
                                qualityReport={selectedFile.qualityReport}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 rounded-lg bg-slate-800/20">
                                <ImageIcon className="h-12 w-12 mb-4"/>
                                <p className="font-semibold">No Document Selected</p>
                                <p className="text-sm">Select a file to see its preview here.</p>
                            </div>
                        )}
                    </div>
                </div>

                {isDesktop && <div className="resize-handle" onMouseDown={handleMouseDown} />}

                <div className="flex-grow min-h-0">
                    <ResultsPanel
                        selectedFile={selectedFile}
                        onDataUpdate={handleDataUpdate}
                        onSave={handleSave}
                        onDeleteRows={handleDeleteRows}
                        onBatchUpdate={handleBatchUpdate}
                        onRowVerificationUpdate={handleRowVerificationUpdate}
                        onCellFocus={setFocusedCell}
                        onCellHover={setHoveredBox}
                    />
                </div>
            </main>
            
             <div className="fixed bottom-5 right-5 z-50 space-y-3">
                {toasts.map(toast => (
                    <Toast key={toast.id} message={toast.message} type={toast.type} onDismiss={() => removeToast(toast.id)} />
                ))}
            </div>
        </div>
    );
};

export default App;
