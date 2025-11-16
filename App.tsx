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
    const [reviewMode, setReviewMode] = useState(false);

    // تخطيط ثلاثي الأعمدة: يسار (وثائق) / وسط (صورة) / يمين (نتائج)
    const [leftPct, setLeftPct] = useState<number>(() => {
        const saved = localStorage.getItem('layout:leftPct');
        return saved ? Number(saved) : 20; // 20% افتراضي
    });
    const [centerPct, setCenterPct] = useState<number>(() => {
        const saved = localStorage.getItem('layout:centerPct');
        return saved ? Number(saved) : 40; // 40% افتراضي
    });
    // حساب العمود الأيمن ديناميكياً
    const rightPct = useMemo(() => {
        if (reviewMode) {
            // في وضع المراجعة: العمود الأيمن = 100 - العمود الأوسط - هامش
            const resizersWidth = 0.5;
            return Math.max(20, 100 - centerPct - resizersWidth);
        }
        const resizersWidth = 1; // هامش للـ resizers (0.5% لكل واحد)
        return Math.max(20, 100 - leftPct - centerPct - resizersWidth);
    }, [leftPct, centerPct, reviewMode]);

    const activeResizer = useRef<'left' | 'right' | null>(null);
    const isResizing = useRef(false);
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const isXL = useMediaQuery('(min-width: 1280px)');
    const [mobilePane, setMobilePane] = useState<'image' | 'data'>('image');
    
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

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        isResizing.current = true;
        const side = (e.currentTarget.dataset.side as 'left' | 'right') || 'left';
        activeResizer.current = side;
        document.body.style.cursor = 'col-resize';
        e.currentTarget.classList.add('resizing');
    };

    const handleMouseUp = useCallback(() => {
        isResizing.current = false;
        activeResizer.current = null;
        document.body.style.cursor = 'default';
        document.querySelectorAll('.resize-handle').forEach(h => h.classList.remove('resizing'));
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing.current) return;
        const pointerPct = (e.clientX / window.innerWidth) * 100;
        if (activeResizer.current === 'left') {
            // يحرك الحد بين العمود الأيسر والوسط (فقط في الوضع العادي)
            const newLeft = Math.max(15, Math.min(pointerPct, 35)); // 15%-35%
            // تأكد أن المجموع لا يتجاوز 100% وأن كل عمود له حد أدنى
            const maxLeft = 100 - 30 - 20 - 1; // اترك 30% للوسط و 20% لليمين و 1% للـ resizers
            const boundedLeft = Math.min(newLeft, maxLeft);
            setLeftPct(boundedLeft);
        } else if (activeResizer.current === 'right') {
            // يحرك الحد بين الوسط واليمين
            if (reviewMode) {
                // في وضع المراجعة: نحرك العمود الأوسط فقط
                const newCenter = Math.max(20, Math.min(pointerPct, 80)); // 20%-80%
                setCenterPct(newCenter);
            } else {
                // في الوضع العادي: نحرك بناءً على موقع العمود الأيسر
                const newCenter = pointerPct - leftPct;
                const minCenter = 30;
                const maxCenter = 100 - leftPct - 20 - 1; // اترك 20% لليمين و 1% للـ resizers
                const boundedCenter = Math.max(minCenter, Math.min(newCenter, maxCenter));
                setCenterPct(boundedCenter);
            }
        }
    }, [leftPct, centerPct, reviewMode]);
    
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

    // حفظ المقاسات محلياً
    useEffect(() => {
        localStorage.setItem('layout:leftPct', String(leftPct));
    }, [leftPct]);
    useEffect(() => {
        localStorage.setItem('layout:centerPct', String(centerPct));
    }, [centerPct]);

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

    const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const handleSave = useCallback(() => {
        if (!selectedFile) return;
        db.commitChanges(selectedFile.id);
        setLastSaved(new Date());
        refreshFilesFromDb();
        addToast("All changes have been saved!", 'success');
    }, [selectedFile, addToast, refreshFilesFromDb]);
    
    // حفظ تلقائي كل 30 ثانية
    useEffect(() => {
        if (!autoSaveEnabled || !selectedFile) return;
        
        const autoSaveInterval = setInterval(() => {
            if (selectedFile?.extractedData) {
                db.commitChanges(selectedFile.id);
                setLastSaved(new Date());
                console.log('💾 Auto-saved at', new Date().toLocaleTimeString());
            }
        }, 30000); // 30 ثانية
        
        return () => clearInterval(autoSaveInterval);
    }, [autoSaveEnabled, selectedFile]);
    
    // اختصار لوحة المفاتيح Ctrl+R لوضع المراجعة
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                setReviewMode(prev => !prev);
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    
    return (
        <div className="h-full w-full p-3 sm:p-4 md:p-6 flex flex-col gap-3 sm:gap-4">
            <header className="flex-shrink-0 w-full flex flex-wrap justify-between items-center gap-3 sm:gap-4 py-2 sm:py-3 px-4 sm:px-6 border-b border-slate-700/50 glassmorphism rounded-xl">
                <div>
                    <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">Form Extractor Pro</h1>
                    <p className="text-xs sm:text-sm text-slate-400">Advanced Multi-Document OCR System</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-center">
                    {lastSaved && (
                        <div className="text-xs text-slate-400 px-3 py-1 bg-slate-800/50 rounded-md">
                            💾 حُفظ: {lastSaved.toLocaleTimeString('ar')}
                        </div>
                    )}
                    <button
                        onClick={() => setReviewMode(!reviewMode)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all transform hover:scale-105 ${reviewMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'glassmorphism hover:border-slate-500 border-slate-700/80'}`}
                        data-tooltip="وضع المراجعة (Ctrl+R)"
                    >
                        <SplitViewIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">{reviewMode ? 'وضع عادي' : 'وضع مراجعة'}</span>
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold glassmorphism rounded-lg hover:border-slate-500 transition-all transform hover:scale-105 border-slate-700/80"
                    >
                       <DownloadIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                       <span className="hidden sm:inline">Export All (CSV)</span>
                    </button>
                    <button
                        onClick={handleExtractAll}
                        disabled={isExtracting}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30 transform hover:scale-105 disabled:hover:scale-100"
                    >
                        {isExtracting ? <SpinnerIcon className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <SplitViewIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                        <span className="truncate max-w-[150px] sm:max-w-none">{isExtracting ? 'جاري الاستخراج...' : `استخراج الكل (${uploadedFiles.filter(f => f.status === 'pending').length})`}</span>
                    </button>
                </div>
            </header>

            {/* تبويب للهاتف/الشاشات الصغيرة */}
            {!isXL && (
                <div className="flex items-center gap-2 px-2">
                    <button
                        onClick={() => setMobilePane('image')}
                        className={`px-3 py-1.5 text-xs rounded-md ${mobilePane === 'image' ? 'bg-blue-600 text-white' : 'bg-slate-800/50 text-slate-300'}`}
                    >
                        الصورة
                    </button>
                    <button
                        onClick={() => setMobilePane('data')}
                        className={`px-3 py-1.5 text-xs rounded-md ${mobilePane === 'data' ? 'bg-blue-600 text-white' : 'bg-slate-800/50 text-slate-300'}`}
                    >
                        البيانات
                    </button>
                </div>
            )}
            <main className={`flex-grow flex min-h-0 gap-0 ${isXL ? 'flex-row' : 'flex-col'}`}>
                {/* العمود الأيسر: الوثائق - يطوى في وضع المراجعة */}
                {isXL && (!reviewMode) && (
                    <div
                        className="flex flex-col p-4 glassmorphism rounded-xl min-h-0"
                        style={isDesktop ? { width: `${leftPct}%` } : { height: '33%' }}
                    >
                        <ImageUploader
                            files={uploadedFiles}
                            selectedFileId={selectedFileId}
                            onAddFiles={handleAddFiles}
                            onRemoveFile={handleRemoveFile}
                            onSelectFile={setSelectedFileId}
                            onClear={handleClearAll}
                        />
                    </div>
                )}

                {/* مقبض يسار/وسط */}
                {isXL && !reviewMode && <div className="resize-handle" data-side="left" onMouseDown={handleMouseDown} />}

                {/* العمود الأوسط: عارض المستند */}
                {(isXL || mobilePane === 'image') && (
                    <div
                        className="flex flex-col p-4 glassmorphism rounded-xl min-h-0"
                        style={isXL ? { width: `${centerPct}%` } : undefined}
                    >
                        <div className="flex-grow min-h-0">
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
                )}

                {/* مقبض وسط/يمين - يظهر دائماً في XL */}
                {isXL && <div className="resize-handle" data-side="right" onMouseDown={handleMouseDown} />}

                {/* العمود الأيمن: النتائج */}
                {(isXL || mobilePane === 'data') && (
                    <div
                        className="flex flex-col min-h-0 p-0"
                        style={isXL ? { width: `${rightPct}%` } : undefined}
                    >
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
                )}
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
