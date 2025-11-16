export class NumberNormalizer {
    // خريطة الأرقام العربية إلى الإنجليزية
    private static readonly ARABIC_TO_ENGLISH = new Map([
        ['٠', '0'], ['١', '1'], ['٢', '2'], ['٣', '3'], ['٤', '4'],
        ['٥', '5'], ['٦', '6'], ['٧', '7'], ['٨', '8'], ['٩', '9']
    ]);

    // خريطة الأرقام الهندية/الفارسية إلى الإنجليزية
    private static readonly EASTERN_ARABIC_TO_ENGLISH = new Map([
        ['۰', '0'], ['۱', '1'], ['۲', '2'], ['۳', '3'], ['۴', '4'],
        ['۵', '5'], ['۶', '6'], ['۷', '7'], ['۸', '8'], ['۹', '9']
    ]);

    // إصلاح أخطاء OCR الشائعة للأرقام
    private static readonly OCR_FIXES = new Map([
        ['O', '0'], ['o', '0'], ['D', '0'], ['Q', '0'],
        ['I', '1'], ['l', '1'], ['|', '1'], ['i', '1'],
        ['Z', '2'], ['z', '2'],
        ['S', '5'], ['s', '5'],
        ['G', '6'], ['g', '6'],
        ['B', '8'], ['b', '8'],
        ['g', '9']
    ]);

    /**
     * تحويل الأرقام العربية إلى إنجليزية
     */
    private convertArabicNumerals(text: string): string {
        let result = text;
        
        // تحويل الأرقام العربية
        for (const [arabic, english] of NumberNormalizer.ARABIC_TO_ENGLISH) {
            result = result.replace(new RegExp(arabic, 'g'), english);
        }
        
        // تحويل الأرقام الهندية/الفارسية
        for (const [eastern, english] of NumberNormalizer.EASTERN_ARABIC_TO_ENGLISH) {
            result = result.replace(new RegExp(eastern, 'g'), english);
        }
        
        return result;
    }

    /**
     * إصلاح أخطاء OCR الشائعة في الأرقام
     */
    private fixOCRNumberErrors(text: string): string {
        let result = text;
        
        // إصلاح الأخطاء الشائعة فقط في سياق الأرقام
        // نستخدم regex للتأكد من أننا نستبدل الأحرف في سياق رقمي
        const numberPattern = /[0-9٠-٩۰-۹OoDdQqIiLl|ZzSsGgBb]+/g;
        
        result = result.replace(numberPattern, (match) => {
            let fixed = match;
            
            // إصلاح الأخطاء الشائعة
            for (const [wrong, correct] of NumberNormalizer.OCR_FIXES) {
                fixed = fixed.replace(new RegExp(wrong, 'gi'), correct);
            }
            
            return fixed;
        });
        
        return result;
    }

    /**
     * تنظيف وإزالة المسافات الزائدة من الأرقام
     */
    private cleanNumberSpaces(text: string): string {
        // إزالة المسافات داخل الأرقام
        return text.replace(/(\d)\s+(\d)/g, '$1$2');
    }

    /**
     * معالجة شاملة للأرقام في النص
     */
    public normalize(text: string, preserveArabic: boolean = false): string {
        if (!text?.trim()) return text;

        let result = text.trim();

        // إذا كان النص يحتوي على أرقام عربية فقط (مثل رقم الحبر أو المعرف)
        // نحولها إلى إنجليزية لسهولة المعالجة
        if (!preserveArabic) {
            result = this.convertArabicNumerals(result);
        }

        // إصلاح أخطاء OCR
        result = this.fixOCRNumberErrors(result);

        // تنظيف المسافات
        result = this.cleanNumberSpaces(result);

        return result;
    }

    /**
     * تحويل الأرقام العربية إلى إنجليزية في نص مختلط
     */
    public convertMixedNumerals(text: string): string {
        if (!text?.trim()) return text;

        let result = text;
        
        // تحويل الأرقام العربية
        for (const [arabic, english] of NumberNormalizer.ARABIC_TO_ENGLISH) {
            result = result.replace(new RegExp(arabic, 'g'), english);
        }
        
        // تحويل الأرقام الهندية/الفارسية
        for (const [eastern, english] of NumberNormalizer.EASTERN_ARABIC_TO_ENGLISH) {
            result = result.replace(new RegExp(eastern, 'g'), english);
        }
        
        return result;
    }

    /**
     * التحقق من أن النص يحتوي على أرقام فقط
     */
    public isNumeric(text: string): boolean {
        if (!text?.trim()) return false;
        const cleaned = this.normalize(text);
        return /^\d+$/.test(cleaned);
    }
}

