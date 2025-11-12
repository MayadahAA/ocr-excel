export class DateNormalizer {
    private static readonly ARABIC_NUMERALS = new Map([
        ['٠', '0'], ['١', '1'], ['٢', '2'], ['٣', '3'], ['٤', '4'],
        ['٥', '5'], ['٦', '6'], ['٧', '7'], ['٨', '8'], ['٩', '9']
    ]);

    private convertNumerals(input: string): string {
        return input.replace(/[٠-٩]/g, char => DateNormalizer.ARABIC_NUMERALS.get(char) || char);
    }

    private isValidDate(year: number, month: number, day: number): boolean {
        if (month < 1 || month > 12 || day < 1 || day > 31) return false;
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    }

    public normalize(dateString: string): string {
        if (!dateString?.trim()) return dateString;

        let str = dateString.trim();
        
        // تحويل الأرقام العربية إلى إنجليزية
        str = this.convertNumerals(str);
        
        // إصلاح أخطاء OCR الشائعة
        str = str.replace(/O/gi, '0').replace(/[lI|]/g, '1').replace(/S/gi, '5').replace(/Z/gi, '2');
        
        // توحيد الفواصل (استخدام - فقط)
        str = str.replace(/[/.\s]+/g, '-');

        const patterns = [
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/,   // YYYY-MM-DD أو YYYY-M-D
            /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/  // DD-MM-YYYY أو DD-MM-YY
        ];

        for (const regex of patterns) {
            const match = str.match(regex);
            if (!match) continue;

            let [, first, second, third] = match;
            let year: number, month: number, day: number;

            // تحديد التنسيق بناءً على طول الجزء الأول
            if (first.length === 4) {
                // YYYY-MM-DD
                year = parseInt(first, 10);
                month = parseInt(second, 10);
                day = parseInt(third, 10);
            } else {
                // DD-MM-YYYY أو DD-MM-YY
                day = parseInt(first, 10);
                month = parseInt(second, 10);
                year = parseInt(third, 10);
                
                // تحويل السنة المكونة من رقمين
                if (third.length === 2) {
                    year = year < 50 ? 2000 + year : 1900 + year;
                }
            }

            // معالجة حالة الخلط بين اليوم والشهر
            if (month > 12 && day <= 12) {
                [month, day] = [day, month];
            }

            // التحقق من صحة التاريخ
            if (this.isValidDate(year, month, day)) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }

        // إذا لم ينجح أي نمط، حاول استخراج الأرقام فقط
        const numbers = str.match(/\d+/g);
        if (numbers && numbers.length === 3) {
            const [n1, n2, n3] = numbers.map(n => parseInt(n, 10));
            
            // جرب أكثر من تركيبة
            const combinations = [
                { year: n1, month: n2, day: n3 },   // YYYY-MM-DD
                { year: n3, month: n2, day: n1 },   // DD-MM-YYYY
                { year: n3, month: n1, day: n2 }    // MM-DD-YYYY
            ];
            
            for (const { year: y, month: m, day: d } of combinations) {
                const finalYear = y < 100 ? (y < 50 ? 2000 + y : 1900 + y) : y;
                if (this.isValidDate(finalYear, m, d)) {
                    return `${finalYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                }
            }
        }

        return dateString;
    }
}
