export class InkTypeNormalizer {
    // أنواع الحبر الشائعة
    private static readonly COMMON_INK_TYPES = new Map([
        // Original
        ['ORIGINAL', 'Original'],
        ['0RIGINAL', 'Original'],
        ['ORIG1NAL', 'Original'],
        ['OG', 'Original'],
        ['0G', 'Original'],

        // Compatible
        ['COMPATIBLE', 'Compatible'],
        ['C0MPATIBLE', 'Compatible'],
        ['COMPATIBL3', 'Compatible'],
        ['COMP', 'Compatible'],
        ['C0MP', 'Compatible'],

        // Refilled
        ['REFILLED', 'Refilled'],
        ['REFILL', 'Refilled'],
        ['REF1LLED', 'Refilled'],
        ['REF', 'Refilled'],

        // GIG might be misread "OIG" or "CIG" which could be abbreviations
        ['GIG', 'Original'],  // تخمين: GIG قد تكون OIG (Original)
        ['OIG', 'Original'],
        ['CIG', 'Compatible'], // CIG قد تكون Compatible
        ['G1G', 'Original'],
        ['010', 'Original'],  // 010 قد تكون OIO أو OIG
        ['C10', 'Compatible'],
    ]);

    /**
     * تطبيع نوع الحبر
     */
    public normalize(input: string): string {
        if (!input?.trim()) return input;

        let result = input.trim().toUpperCase();

        // إزالة المسافات الزائدة
        result = result.replace(/\s+/g, ' ');

        // إصلاح أخطاء OCR الشائعة
        result = result
            .replace(/0/g, 'O')  // صفر إلى O
            .replace(/1/g, 'I')  // واحد إلى I
            .replace(/5/g, 'S')  // خمسة إلى S
            .replace(/8/g, 'B')  // ثمانية إلى B
            .replace(/[|]/g, 'I'); // | إلى I

        // البحث عن مطابقة مباشرة
        if (InkTypeNormalizer.COMMON_INK_TYPES.has(result)) {
            return InkTypeNormalizer.COMMON_INK_TYPES.get(result)!;
        }

        // البحث عن مطابقة جزئية
        for (const [key, value] of InkTypeNormalizer.COMMON_INK_TYPES) {
            if (result.includes(key) || key.includes(result)) {
                return value;
            }
        }

        // إذا لم نجد مطابقة، نعيد القيمة الأصلية بشكل منسق
        // نحول الحرف الأول إلى uppercase والباقي lowercase
        return input.trim().charAt(0).toUpperCase() + input.trim().slice(1).toLowerCase();
    }

    /**
     * إضافة نوع حبر مخصص للخريطة (للتعلم من تصحيحات المستخدم)
     */
    public addCustomMapping(ocr: string, correct: string): void {
        InkTypeNormalizer.COMMON_INK_TYPES.set(ocr.toUpperCase(), correct);
    }
}
