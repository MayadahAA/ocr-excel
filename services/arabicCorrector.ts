import { FormField } from '../types';

export class ArabicCorrector {
    private static readonly DEPARTMENTS = new Set([
        // أقسام طبية
        'الطوارئ', 'العناية المركزة', 'الحضانة', 'العمليات', 'الولادة', 'الأطفال', 'الباطنية', 
        'الجراحة', 'العظام', 'القلب', 'الأشعة', 'المختبر', 'الصيدلية', 'العيادات الخارجية',
        // أقسام إدارية ودعم
        'الإدارة', 'الموارد البشرية', 'المالية', 'الصيانة', 'النظافة', 'الأمن', 'المخازن',
        'تقنية المعلومات', 'الجودة', 'السجلات الطبية', 'الاستقبال', 'خدمة العملاء'
    ]);
    
    private static readonly NAMES = new Set([
        'عبدالله', 'محمد', 'أحمد', 'علي', 'فهد', 'سارة', 'فاطمة', 'نورة', 'خالد', 'سلطان',
        'الحربي', 'العتيبي', 'الشمري', 'القحطاني', 'الغامدي', 'الدوسري', 'المطيري', 'العنزي',
        'عبدالعزيز', 'عبدالرحمن', 'إبراهيم', 'يوسف', 'عمر', 'حسن', 'حسين', 'منصور', 'سعد', 'سعود',
        'مشعل', 'بندر', 'تركي', 'ناصر', 'طلال', 'ريم', 'هند', 'منى', 'عائشة', 'مريم', 'لينا'
    ]);

    private distanceCache = new Map<string, number>();

    private levenshtein(a: string, b: string): number {
        const key = `${a}|${b}`;
        if (this.distanceCache.has(key)) return this.distanceCache.get(key)!;
        
        if (!a.length) return b.length;
        if (!b.length) return a.length;
        
        let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
        
        for (let j = 1; j <= b.length; j++) {
            let curr = [j];
            for (let i = 1; i <= a.length; i++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                curr[i] = Math.min(prev[i] + 1, curr[i - 1] + 1, prev[i - 1] + cost);
            }
            prev = curr;
        }
        
        const result = prev[a.length];
        if (this.distanceCache.size > 1000) this.distanceCache.clear();
        this.distanceCache.set(key, result);
        return result;
    }
    
    private fuzzyMatch(value: string, dictionary: Set<string>): string | null {
        const maxDistance = value.length > 5 ? 3 : 2;
        let bestMatch: string | null = null;
        let minDistance = maxDistance;

        for (const entry of dictionary) {
            if (Math.abs(entry.length - value.length) > maxDistance) continue;
            
            const distance = this.levenshtein(value, entry);
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = entry;
            }
        }
        return bestMatch;
    }
    
    private correctCommonErrors(value: string): string {
        return value.replace(/،/g, ',');
    }

    public postProcess(field: FormField, value: string): { correctedValue: string; correctionDetails?: { original: string; reason: string; } } {
        const originalValue = value;
        let correctedValue = this.correctCommonErrors(originalValue);
        let correctionReason = "Common correction";

        if (field === 'Department') {
            const match = this.fuzzyMatch(correctedValue, ArabicCorrector.DEPARTMENTS);
            if (match) {
                correctedValue = match;
                correctionReason = "Department DB match";
            }
        } else if (field === 'Recipient Name' || field === 'Deliverer Name' || field === 'Printer Name') {
            const nameParts = correctedValue.split(' ').filter(p => p);
            const correctedParts = nameParts.map(part => this.fuzzyMatch(part, ArabicCorrector.NAMES) || part);
            const newValue = correctedParts.join(' ');
            if (newValue !== correctedValue) {
                correctedValue = newValue;
                correctionReason = "Name DB match";
            }
        }
        
        return originalValue !== correctedValue 
            ? { correctedValue, correctionDetails: { original: originalValue, reason: correctionReason } }
            : { correctedValue };
    }
}