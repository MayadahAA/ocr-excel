import { Form, UploadedFile, ValidationIssue, ExtractedForm, FormField, QualityReport } from '../types';

const UNCERTAIN_KEYWORDS = new Set(['n/a', 'null', 'undefined', 'not found', 'missing', 'none', '?', 'illegible']);
const DATE_REGEX = /^\d{1,4}[-/.\s]\d{1,2}[-/.\s]\d{1,4}$/;
const EMP_ID_REGEX = /^[A-Z]{1,3}\d+$/i;
const ARABIC_REGEX = /[\u0600-\u06FF]/;
const INK_NUMBER_REGEX = /^[a-zA-Z0-9-]+$/;

const validationCache = new Map<string, ValidationIssue[]>();

// نظام تعلم من تصحيحات المستخدم
interface UserCorrection {
    field: FormField;
    original: string;
    corrected: string;
    timestamp: number;
}

const CORRECTIONS_STORAGE_KEY = 'ocr_user_corrections';
const MAX_CORRECTIONS = 100; // حفظ آخر 100 تصحيح

// تحميل التصحيحات من localStorage عند البداية
const loadCorrectionsFromStorage = (): UserCorrection[] => {
    try {
        const stored = localStorage.getItem(CORRECTIONS_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            console.log(`✅ Loaded ${parsed.length} user corrections from storage`);
            return parsed;
        }
    } catch (error) {
        console.error('Failed to load corrections from storage:', error);
    }
    return [];
};

// حفظ التصحيحات إلى localStorage
const saveCorrectionsToStorage = (corrections: UserCorrection[]): void => {
    try {
        localStorage.setItem(CORRECTIONS_STORAGE_KEY, JSON.stringify(corrections));
    } catch (error) {
        console.error('Failed to save corrections to storage:', error);
    }
};

const userCorrections: UserCorrection[] = loadCorrectionsFromStorage();

const validateField = (form: Form, field: FormField, formIndex: number): ValidationIssue | null => {
    const value = form[field];
    const stringValue = String(value ?? '').trim();
    const confidence = form._confidence?.[field];

    if (confidence !== undefined && confidence < 0.85) {
        return { formIndex, field, message: `Low confidence (${Math.round(confidence*100)}%)`, type: 'confidence' };
    }

    if (!stringValue) {
        return { formIndex, field, message: 'Empty field', type: 'missing' };
    }

    const lowerValue = stringValue.toLowerCase();
    for (const kw of UNCERTAIN_KEYWORDS) {
        if (lowerValue.includes(kw)) {
            return { formIndex, field, message: 'Placeholder detected', type: 'confidence' };
        }
    }

    switch (field) {
        case "Date":
            return DATE_REGEX.test(stringValue) ? null : { formIndex, field, message: 'Invalid date format', type: 'format' };
        case "Employee ID":
            return EMP_ID_REGEX.test(stringValue) ? null : { formIndex, field, message: 'Format: 1-3 letters + numbers', type: 'format' };
        case "Printer Name":
            if (stringValue.length < 5) return { formIndex, field, message: 'Name too short', type: 'confidence' };
            if (!ARABIC_REGEX.test(stringValue) && stringValue === stringValue.toLowerCase() && /[a-z]/.test(stringValue)) {
                return { formIndex, field, message: 'All lowercase', type: 'confidence' };
            }
            return null;
        case "Recipient Name":
        case "Deliverer Name":
            return /\d/.test(stringValue) ? { formIndex, field, message: 'Number in name', type: 'format' } : null;
        case "Ink Number":
            return stringValue && !INK_NUMBER_REGEX.test(stringValue) ? { formIndex, field, message: 'Invalid characters', type: 'format' } : null;
    }
    return null;
};

const validateData = (data: Form[]): ValidationIssue[] => {
    const cacheKey = data.map(f => f._id).join(',');
    if (validationCache.has(cacheKey)) return validationCache.get(cacheKey)!;

    const issues: ValidationIssue[] = [];
    const FIELDS: FormField[] = ["Printer Name", "Ink Type", "Ink Number", "Date", "Department", "Recipient Name", "Employee ID", "Deliverer Name"];

    data.forEach((form, formIndex) => {
        FIELDS.forEach(field => {
            const issue = validateField(form, field, formIndex);
            if (issue) issues.push(issue);
        });
    });

    validationCache.set(cacheKey, issues);
    if (validationCache.size > 50) validationCache.clear();
    
    return issues;
};

const filesMap = new Map<string, UploadedFile>();

const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${['Bytes', 'KB', 'MB', 'GB'][i]}`;
};

export const db = {
    getAllFiles: (): UploadedFile[] => Array.from(filesMap.values()),

    addFiles: (newFiles: File[]): UploadedFile[] => {
        return newFiles.map((file, index) => {
            const newFile: UploadedFile = {
                id: `file_${Date.now()}_${Math.random()}_${index}`,
                file,
                name: file.name,
                size: formatFileSize(file.size),
                status: 'pending',
                extractedData: null,
                validationIssues: [],
                previewUrl: URL.createObjectURL(file),
            };
            filesMap.set(newFile.id, newFile);
            return newFile;
        });
    },

    removeFile: (id: string): void => {
        filesMap.delete(id);
    },

    clearAll: (): void => {
        filesMap.clear();
        validationCache.clear();
    },

    updateFileStatus: (id: string, status: UploadedFile['status']): void => {
        const file = filesMap.get(id);
        if (file) file.status = status;
    },

    updateFileWithExtractedData: (
        id: string,
        extractedForms: ExtractedForm[],
        processedPreviewUrl?: string | null,
        imageDimensions?: { width: number; height: number },
        qualityReport?: QualityReport | null
    ): void => {
        const file = filesMap.get(id);
        if (file) {
            file.extractedData = extractedForms.map((form, index) => ({
                ...form,
                _id: `${id}_row_${index}`,
                _verified: false,
                _confidence: form._confidence || {},
                _correctionDetails: form._correctionDetails || {},
            }));
            file.validationIssues = validateData(file.extractedData);
            file.status = 'processed';
            if (processedPreviewUrl) file.processedPreviewUrl = processedPreviewUrl;
            if (imageDimensions) file.imageDimensions = imageDimensions;
            if (qualityReport) file.qualityReport = qualityReport;
        }
    },

    updateRowData: (fileId: string, formIndex: number, field: keyof Form, value: string): void => {
        const file = filesMap.get(fileId);
        if (file?.extractedData?.[formIndex]) {
            const originalValue = String((file.extractedData[formIndex] as any)[field] ?? '').trim();
            const newValue = value.trim();
            
            // حفظ التصحيح للتعلم إذا كان مختلفاً
            if (originalValue && newValue && originalValue !== newValue && !field.startsWith('_')) {
                userCorrections.push({
                    field: field as FormField,
                    original: originalValue,
                    corrected: newValue,
                    timestamp: Date.now()
                });
                
                // حذف أقدم تصحيح إذا تجاوز الحد
                if (userCorrections.length > MAX_CORRECTIONS) {
                    userCorrections.shift();
                }
                
                // حفظ إلى localStorage
                saveCorrectionsToStorage(userCorrections);
                
                console.log(`📝 Feedback learned: "${originalValue}" → "${newValue}" for ${field}`);
            }
            
            (file.extractedData[formIndex] as any)[field] = value;
            delete file.extractedData[formIndex]._confidence?.[field as FormField];
            delete file.extractedData[formIndex]._correctionDetails?.[field as FormField];
            file.validationIssues = validateData(file.extractedData);
        }
    },
    
    // دالة للحصول على اقتراحات بناءً على التصحيحات السابقة
    getSuggestion: (field: FormField, value: string): string | null => {
        const normalizedValue = value.trim().toLowerCase();
        
        // البحث عن تصحيحات سابقة مشابهة
        for (let i = userCorrections.length - 1; i >= 0; i--) {
            const correction = userCorrections[i];
            if (correction.field === field && 
                correction.original.toLowerCase() === normalizedValue) {
                return correction.corrected;
            }
        }
        
        // البحث عن تصحيحات مشابهة جزئياً
        for (let i = userCorrections.length - 1; i >= 0; i--) {
            const correction = userCorrections[i];
            if (correction.field === field && 
                correction.original.toLowerCase().includes(normalizedValue)) {
                return correction.corrected;
            }
        }
        
        return null;
    },
    
    // الحصول على إحصائيات التصحيحات
    getCorrectionStats: () => {
        const stats: { [key: string]: { count: number; examples: string[] } } = {};
        
        userCorrections.forEach(correction => {
            const key = correction.field;
            if (!stats[key]) {
                stats[key] = { count: 0, examples: [] };
            }
            stats[key].count++;
            if (stats[key].examples.length < 3) {
                stats[key].examples.push(`"${correction.original}" → "${correction.corrected}"`);
            }
        });
        
        return stats;
    },
    
    // مسح جميع التصحيحات المحفوظة
    clearAllCorrections: () => {
        userCorrections.length = 0;
        saveCorrectionsToStorage([]);
        console.log('🗑️ All user corrections cleared');
    },
    
    // الحصول على جميع التصحيحات (للعرض أو التصدير)
    getAllCorrections: () => {
        return [...userCorrections];
    },

    updateRowsVerification: (fileId: string, indices: number[], verified: boolean): void => {
        const file = filesMap.get(fileId);
        if (file?.extractedData) {
            indices.forEach(index => {
                if (file.extractedData![index]) file.extractedData![index]._verified = verified;
            });
        }
    },
    
    batchUpdateRows: (fileId: string, indices: number[], field: FormField, find: string, replace: string): void => {
        const file = filesMap.get(fileId);
        if (file?.extractedData) {
            const regex = new RegExp(find, 'g');
            indices.forEach(index => {
                if (file.extractedData![index]) {
                    const originalValue = String(file.extractedData![index][field] ?? '');
                    (file.extractedData![index] as any)[field] = originalValue.replace(regex, replace);
                }
            });
            file.validationIssues = validateData(file.extractedData);
        }
    },

    deleteRows: (fileId: string, indices: number[]): void => {
        const file = filesMap.get(fileId);
        if (file?.extractedData) {
            [...indices].sort((a, b) => b - a).forEach(index => file.extractedData!.splice(index, 1));
            file.validationIssues = validateData(file.extractedData);
        }
    },
    
    commitChanges: (fileId: string): void => {
        console.log(`Changes committed for file ${fileId}`);
    }
};