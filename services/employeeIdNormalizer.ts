export class EmployeeIdNormalizer {
    /**
     * تطبيع رقم الموظف
     * التنسيق المتوقع: 1-3 أحرف + أرقام (مثل: AB12345، KR147378)
     */
    public normalize(input: string): string {
        if (!input?.trim()) return input;

        let result = input.trim();

        // إزالة المسافات
        result = result.replace(/\s+/g, '');

        // إصلاح أخطاء OCR الشائعة في الأحرف
        const letterFixes = new Map([
            ['0', 'O'],  // صفر يقرأ كحرف O في بداية الرقم
            ['1', 'I'],  // واحد يقرأ كحرف I في بداية الرقم
            ['5', 'S'],  // خمسة تقرأ كحرف S في بداية الرقم
            ['8', 'B'],  // ثمانية تقرأ كحرف B في بداية الرقم
        ]);

        // إصلاح أخطاء OCR الشائعة في الأرقام
        const numberFixes = new Map([
            ['O', '0'],  // O تقرأ كصفر
            ['o', '0'],  // o تقرأ كصفر
            ['I', '1'],  // I تقرأ كواحد
            ['l', '1'],  // l تقرأ كواحد
            ['|', '1'],  // | تقرأ كواحد
            ['S', '5'],  // S تقرأ كخمسة
            ['s', '5'],  // s تقرأ كخمسة
            ['B', '8'],  // B تقرأ كثمانية
            ['Z', '2'],  // Z تقرأ كاثنين
        ]);

        // محاولة تحديد الأحرف من الأرقام
        // إذا كان النص يبدأ برقم، قد يكون حرف تم قراءته بشكل خاطئ
        const firstChars = result.substring(0, 3);
        const restChars = result.substring(3);

        // التحقق من النمط: إذا كان كله أرقام، نحاول إصلاح الأحرف الأولى
        if (/^\d+$/.test(result)) {
            // محاولة إصلاح أول 1-3 أحرف
            let fixed = '';
            let letterCount = 0;
            let i = 0;

            // البحث عن أرقام يمكن أن تكون أحرف (في البداية فقط)
            while (i < result.length && letterCount < 3) {
                const char = result[i];
                if (letterFixes.has(char) && letterCount < 2) {
                    // إذا كان من الممكن أن يكون حرف
                    fixed += letterFixes.get(char);
                    letterCount++;
                } else if (char >= '0' && char <= '9') {
                    // بمجرد أن نصل لرقم عادي، نتوقف عن تحويل الأحرف
                    break;
                } else {
                    break;
                }
                i++;
            }

            // إذا وجدنا أحرف محتملة، نطبق التصحيح
            if (letterCount > 0 && i < result.length) {
                result = fixed + result.substring(i);
            }
        } else {
            // إصلاح الأرقام في الجزء الرقمي
            const match = result.match(/^([A-Za-z]{1,3})(.+)$/);
            if (match) {
                const letters = match[1].toUpperCase();
                let numbers = match[2];

                // إصلاح الأحرف الخاطئة في الجزء الرقمي
                for (const [wrong, correct] of numberFixes) {
                    numbers = numbers.replace(new RegExp(wrong, 'g'), correct);
                }

                result = letters + numbers;
            }
        }

        // التحقق النهائي: يجب أن يكون 1-3 أحرف متبوعة بأرقام
        if (!/^[A-Z]{1,3}\d+$/i.test(result)) {
            // إذا فشل التنسيق، نحاول نمط آخر
            // ربما يكون الرقم بالكامل أرقام بدون أحرف
            // في هذه الحالة، نحتفظ بالقيمة الأصلية ونتركها للمستخدم
            return input.trim();
        }

        return result;
    }
}
