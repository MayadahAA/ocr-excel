import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedForm, ApiResponse, FormField, QualityReport, ExtractedDelivery, InkItem, DeliveryInfo } from "../types";
import { DateNormalizer } from './dateNormalizer';
import { ArabicCorrector } from './arabicCorrector';
import { NumberNormalizer } from './numberNormalizer';
import { EmployeeIdNormalizer } from './employeeIdNormalizer';
import { InkTypeNormalizer } from './inkTypeNormalizer';
import { db } from './mockDatabase';

const FORM_FIELDS: FormField[] = ["Printer Name", "Ink Type", "Ink Number", "Date", "Department", "Recipient Name", "Employee ID", "Deliverer Name"];
const ITEM_FIELDS = ["Printer Name", "Ink Type", "Ink Number"] as const;
const DELIVERY_FIELDS = ["Date", "Department", "Recipient Name", "Employee ID", "Deliverer Name"] as const;
const ARABIC_REGEX = /[\u0600-\u06FF]/;

// --- Image Processing & Quality Assessment ---

const getGrayscaleData = (ctx: CanvasRenderingContext2D, width: number, height: number): Uint8ClampedArray => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const grayData = new Uint8ClampedArray(width * height);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
        grayData[i / 4] = gray;
    }
    return grayData;
};

const calculateLaplacianVariance = (ctx: CanvasRenderingContext2D, width: number, height: number): number => {
    const grayData = getGrayscaleData(ctx, width, height);
    const laplacianKernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];
    let mean = 0;
    const laplacianValues = [];
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    sum += grayData[(y + ky) * width + (x + kx)] * laplacianKernel[(ky + 1) * 3 + (kx + 1)];
                }
            }
            laplacianValues.push(sum);
            mean += sum;
        }
    }
    if (laplacianValues.length === 0) return 0;
    mean /= laplacianValues.length;
    let variance = 0;
    for (const val of laplacianValues) {
        variance += Math.pow(val - mean, 2);
    }
    variance /= laplacianValues.length;
    return Math.min(variance / 10, 100);
};

const calculateHistogramStDev = (ctx: CanvasRenderingContext2D, width: number, height: number): number => {
    const grayData = getGrayscaleData(ctx, width, height);
    if(grayData.length === 0) return 0;
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < grayData.length; i++) {
        histogram[grayData[i]]++;
    }
    let mean = 0, stdev = 0;
    for (let i = 0; i < 256; i++) mean += i * histogram[i];
    mean /= grayData.length;
    for (let i = 0; i < 256; i++) stdev += Math.pow(i - mean, 2) * histogram[i];
    stdev = Math.sqrt(stdev / grayData.length);
    return Math.min(stdev * 2, 100);
};

const applyConvolution = (ctx: CanvasRenderingContext2D, width: number, height: number, kernel: number[][]) => {
    const srcImageData = ctx.getImageData(0, 0, width, height);
    const dstImageData = ctx.createImageData(width, height);
    const halfKernel = Math.floor(kernel.length / 2);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dstIndex = (y * width + x) * 4;
            let r = 0, g = 0, b = 0;
            for (let ky = 0; ky < kernel.length; ky++) {
                for (let kx = 0; kx < kernel[ky].length; kx++) {
                    const srcX = x + kx - halfKernel;
                    const srcY = y + ky - halfKernel;
                    if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                        const srcIndex = (srcY * width + srcX) * 4;
                        r += srcImageData.data[srcIndex] * kernel[ky][kx];
                        g += srcImageData.data[srcIndex + 1] * kernel[ky][kx];
                        b += srcImageData.data[srcIndex + 2] * kernel[ky][kx];
                    }
                }
            }
            dstImageData.data[dstIndex] = r;
            dstImageData.data[dstIndex + 1] = g;
            dstImageData.data[dstIndex + 2] = b;
            dstImageData.data[dstIndex + 3] = srcImageData.data[dstIndex + 3];
        }
    }
    ctx.putImageData(dstImageData, 0, 0);
};

const applyContrastStretch = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    for (let i = 0; i < data.length; i += 4) {
        if(data[i] < minR) minR = data[i]; if(data[i] > maxR) maxR = data[i];
        if(data[i+1] < minG) minG = data[i+1]; if(data[i+1] > maxG) maxG = data[i+1];
        if(data[i+2] < minB) minB = data[i+2]; if(data[i+2] > maxB) maxB = data[i+2];
    }
    const rangeR = maxR - minR, rangeG = maxG - minG, rangeB = maxB - minB;
    for (let i = 0; i < data.length; i += 4) {
        if (rangeR > 0) data[i] = ((data[i] - minR) / rangeR) * 255;
        if (rangeG > 0) data[i+1] = ((data[i+1] - minG) / rangeG) * 255;
        if (rangeB > 0) data[i+2] = ((data[i+2] - minB) / rangeB) * 255;
    }
    ctx.putImageData(imageData, 0, 0);
};

const applySharpening = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    applyConvolution(ctx, width, height, [[0, -1, 0], [-1, 5, -1], [0, -1, 0]]);
};

const applyBinarization = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const color = avg > 128 ? 255 : 0;
        data[i] = data[i+1] = data[i+2] = color;
    }
    ctx.putImageData(imageData, 0, 0);
};


const preprocessImage = (file: File): Promise<{ processedFile: File; processedPreviewUrl: string | null; imageDimensions: { width: number; height: number }; qualityReport: QualityReport; }> => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error("File must be an image")); return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const MAX_DIMENSION = 1280; // تقليل الحجم لسرعة أكبر
                let { width, height } = img;
                const needsResize = width > MAX_DIMENSION || height > MAX_DIMENSION;
                
                if (needsResize) {
                    const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }

                // إذا لم يحتاج تصغير، استخدم الملف الأصلي مباشرة
                if (!needsResize) {
                    const imageDimensions = { width: img.width, height: img.height };
                    const qualityReport: QualityReport = { score: 85, sharpness: 85, contrast: 85, appliedOps: ["Original"] };
                    resolve({ 
                        processedFile: file, 
                        processedPreviewUrl: event.target?.result as string, 
                        imageDimensions, 
                        qualityReport 
                    });
                    return;
                }

                // تصغير فقط بدون معالجة إضافية
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { alpha: false });
                if (!ctx) return reject(new Error("Could not get canvas context"));

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                const imageDimensions = { width, height };
                const qualityReport: QualityReport = { score: 80, sharpness: 80, contrast: 80, appliedOps: ["Resized"] };

                canvas.toBlob((blob) => {
                    if (!blob) return reject(new Error("Canvas toBlob failed"));
                    const processedFile = new File([blob], file.name, { type: 'image/jpeg' });
                    const processedPreviewUrl = canvas.toDataURL('image/jpeg', 0.85);
                    resolve({ processedFile, processedPreviewUrl, imageDimensions, qualityReport });
                }, 'image/jpeg', 0.85);
            };
            img.onerror = (err) => reject(err);
            img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error("FileReader failed"));
        reader.readAsDataURL(file);
    });
};

const fileToGenerativePart = async (file: File) => {
  const base64EncodedData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
  return { inlineData: { data: base64EncodedData, mimeType: file.type } };
};

const systemInstruction = "OCR AI: Extract delivery forms with multiple printer/ink items per delivery. Support Arabic, English, and numbers in both Arabic and English formats.";
const userPrompt = `Extract all deliveries from this image. Each delivery has:
- Multiple printer/ink items (each printer+ink is a separate row)
- Shared info: Date, Department, Recipient Name, Employee ID, Deliverer Name

Extraction Rules:
- Extract each printer/ink combination as separate item
- Group items that share the same delivery info
- Empty fields: "N/A"
- Confidence: 0-1 per field
- Bounding boxes: [x_min, y_min, x_max, y_max] normalized 0-1

Field-Specific Rules:
- Employee ID: Format is 1-3 LETTERS followed by NUMBERS (e.g., "AB12345", "KR147378"). Do NOT extract all-numeric values. If you see only numbers, check for letters nearby.
- Ink Type: Common values include "Original", "Compatible", "Refilled" or similar variants
- Ink Number: Alphanumeric identifier for the ink cartridge
- Date: Extract in any format, will be normalized later

Character Recognition:
- Arabic text: Extract precisely with correct dots and diacritics (ب ت ث ن ي)
- English text: Extract all letters (A-Z, a-z) accurately
- Numbers: Extract both Arabic numerals (٠١٢٣٤٥٦٧٨٩) and English numerals (0-9)
- Mixed content: Preserve the original format (Arabic/English numbers as they appear)
- Special characters: Preserve hyphens, slashes, and common punctuation

Quality Requirements:
- Read numbers carefully: distinguish 0/O, 1/I/l, 5/S, 8/B
- Read Arabic carefully: distinguish similar letters (ب ت ث, ج ح خ, د ذ, ر ز, س ش, ص ض, ط ظ, ع غ, ف ق)
- For Employee ID: Look carefully for letter prefixes (commonly 2-3 letters)
- Maintain original text direction (RTL for Arabic, LTR for English)

Output JSON only.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    deliveries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          deliveryInfo: {
            type: Type.OBJECT,
            properties: {
              ...DELIVERY_FIELDS.reduce((acc, field) => ({ ...acc, [field]: { type: Type.STRING } }), {}),
              "_boundingBoxes": {
                type: Type.OBJECT,
                properties: DELIVERY_FIELDS.reduce((acc, field) => ({
                  ...acc,
                  [field]: {
                    type: Type.OBJECT,
                    properties: {
                      box: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                      page: { type: Type.INTEGER }
                    }
                  }
                }), {})
              },
              "_confidence": {
                type: Type.OBJECT,
                properties: DELIVERY_FIELDS.reduce((acc, field) => ({
                  ...acc,
                  [field]: { type: Type.NUMBER }
                }), {})
              }
            },
            required: [...DELIVERY_FIELDS],
          },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ...ITEM_FIELDS.reduce((acc, field) => ({ ...acc, [field]: { type: Type.STRING } }), {}),
                "_boundingBoxes": {
                  type: Type.OBJECT,
                  properties: ITEM_FIELDS.reduce((acc, field) => ({
                    ...acc,
                    [field]: {
                      type: Type.OBJECT,
                      properties: {
                        box: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                        page: { type: Type.INTEGER }
                      }
                    }
                  }), {})
                },
                "_confidence": {
                  type: Type.OBJECT,
                  properties: ITEM_FIELDS.reduce((acc, field) => ({
                    ...acc,
                    [field]: { type: Type.NUMBER }
                  }), {})
                }
              },
              required: [...ITEM_FIELDS],
            },
          },
        },
        required: ["deliveryInfo", "items"],
      },
    },
  },
  required: ["deliveries"],
};

// --- Post-Processing & Error Correction ---
const dateNormalizer = new DateNormalizer();
const arabicCorrector = new ArabicCorrector();
const numberNormalizer = new NumberNormalizer();
const employeeIdNormalizer = new EmployeeIdNormalizer();
const inkTypeNormalizer = new InkTypeNormalizer();

const postProcessField = (field: FormField, value: string): { correctedValue: string, correctionDetails?: { original: string, reason: string } } => {
    let correctedValue = String(value ?? '').trim();
    const originalValue = correctedValue;
    let correctionReason = "";

    // معالجة حقول محددة بمعالجات متخصصة
    if (field === "Employee ID") {
        // معالجة رقم الموظف بمعالج متخصص
        correctedValue = employeeIdNormalizer.normalize(correctedValue);
        if (correctedValue !== originalValue) {
            correctionReason = "Employee ID format correction (OCR fixes)";
        }
    } else if (field === "Ink Number") {
        // تحويل الأرقام العربية إلى إنجليزية وإصلاح أخطاء OCR
        correctedValue = numberNormalizer.normalize(correctedValue, false);
        if (correctedValue !== originalValue) {
            correctionReason = "Number normalization (Arabic to English + OCR fixes)";
        }
    } else if (field === "Ink Type") {
        // معالجة نوع الحبر بمعالج متخصص
        correctedValue = inkTypeNormalizer.normalize(correctedValue);
        if (correctedValue !== originalValue) {
            correctionReason = "Ink type normalization (OCR fixes + standardization)";
        }
    } else if (field === "Date") {
        // معالجة التاريخ (يتضمن تحويل الأرقام العربية)
        correctedValue = dateNormalizer.normalize(correctedValue);
        if (correctedValue !== originalValue) {
            correctionReason = "Date normalization";
        }
    } else {
        // معالجة الحقول النصية الأخرى
        if (ARABIC_REGEX.test(originalValue)) {
            // نص عربي: استخدام المصحح العربي
            const arabicResult = arabicCorrector.postProcess(field, originalValue);
            correctedValue = arabicResult.correctedValue;
            if (arabicResult.correctionDetails) {
                correctionReason = arabicResult.correctionDetails.reason;
            }
        } else {
            // نص إنجليزي: تحويل أي أرقام عربية مختلطة إلى إنجليزية
            const hasArabicNumbers = /[٠-٩]/.test(originalValue);
            if (hasArabicNumbers) {
                correctedValue = numberNormalizer.convertMixedNumerals(originalValue);
                if (correctedValue !== originalValue) {
                    correctionReason = "Converted Arabic numerals to English";
                }
            }
        }
    }

    const wasCorrected = originalValue !== correctedValue;
    return {
      correctedValue,
      correctionDetails: wasCorrected ? { original: originalValue, reason: correctionReason || "Standard character replacement." } : undefined
    };
};

const runExtraction = async (imageFile: File, ai: GoogleGenAI): Promise<ApiResponse> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ parts: [imagePart, { text: userPrompt }] }],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });
    
    if (!response?.text) throw new Error("Empty response from API");
    
    const parsedData: ApiResponse = JSON.parse(response.text.trim());
    if (!parsedData?.deliveries || !Array.isArray(parsedData.deliveries)) {
        throw new Error("Invalid response structure from API");
    }
    
    return parsedData;
};

const processExtractedForms = (apiResponse: ApiResponse): ExtractedForm[] => {
    const flattenedForms: ExtractedForm[] = [];
    
    // تسطيح البنية: كل delivery يحتوي على عدة items
    apiResponse.deliveries.forEach((delivery) => {
        const deliveryInfo = delivery.deliveryInfo;
        
        // معالجة حقول التسليم المشتركة
        const processedDeliveryInfo: any = {};
        DELIVERY_FIELDS.forEach(field => {
            const value = deliveryInfo[field] ?? '';
            let { correctedValue, correctionDetails } = postProcessField(field, value);
            
            const suggestion = db.getSuggestion(field, correctedValue);
            if (suggestion) {
                correctedValue = suggestion;
                correctionDetails = { original: value, reason: "Applied from user feedback" };
                console.log(`✨ Auto-corrected "${value}" → "${suggestion}" based on feedback`);
            }
            
            processedDeliveryInfo[field] = correctedValue;
            
            if (correctionDetails) {
                if (!processedDeliveryInfo._correctionDetails) processedDeliveryInfo._correctionDetails = {};
                processedDeliveryInfo._correctionDetails[field] = correctionDetails;
            }
            
            // Confidence and bounding boxes
            if (deliveryInfo._confidence?.[field]) {
                if (!processedDeliveryInfo._confidence) processedDeliveryInfo._confidence = {};
                processedDeliveryInfo._confidence[field] = deliveryInfo._confidence[field];
            }
            if (deliveryInfo._boundingBoxes?.[field]) {
                if (!processedDeliveryInfo._boundingBoxes) processedDeliveryInfo._boundingBoxes = {};
                processedDeliveryInfo._boundingBoxes[field] = deliveryInfo._boundingBoxes[field];
            }
        });
        
        // معالجة كل item (طابعة/حبر) ودمجها مع معلومات التسليم
        delivery.items.forEach((item) => {
            const flattenedForm: ExtractedForm = {
                "Printer Name": "",
                "Ink Type": "",
                "Ink Number": "",
                "Date": processedDeliveryInfo["Date"],
                "Department": processedDeliveryInfo["Department"],
                "Recipient Name": processedDeliveryInfo["Recipient Name"],
                "Employee ID": processedDeliveryInfo["Employee ID"],
                "Deliverer Name": processedDeliveryInfo["Deliverer Name"],
                _boundingBoxes: { ...processedDeliveryInfo._boundingBoxes },
                _confidence: { ...processedDeliveryInfo._confidence },
                _correctionDetails: { ...processedDeliveryInfo._correctionDetails },
            };
            
            // معالجة حقول ال item
            ITEM_FIELDS.forEach(field => {
                const value = item[field] ?? '';
                let { correctedValue, correctionDetails } = postProcessField(field, value);
                
                const suggestion = db.getSuggestion(field, correctedValue);
                if (suggestion) {
                    correctedValue = suggestion;
                    correctionDetails = { original: value, reason: "Applied from user feedback" };
                    console.log(`✨ Auto-corrected "${value}" → "${suggestion}" based on feedback`);
                }
                
                flattenedForm[field] = correctedValue;
                
                if (correctionDetails) {
                    if (!flattenedForm._correctionDetails) flattenedForm._correctionDetails = {};
                    flattenedForm._correctionDetails[field] = correctionDetails;
                }
                
                if (item._confidence?.[field]) {
                    if (!flattenedForm._confidence) flattenedForm._confidence = {};
                    flattenedForm._confidence[field] = item._confidence[field];
                }
                if (item._boundingBoxes?.[field]) {
                    if (!flattenedForm._boundingBoxes) flattenedForm._boundingBoxes = {};
                    flattenedForm._boundingBoxes[field] = item._boundingBoxes[field];
                }
            });
            
            flattenedForms.push(flattenedForm);
        });
    });
    
    return flattenedForms;
};

export const extractFormData = async (imageFile: File): Promise<{ forms: ExtractedForm[]; processedPreviewUrl: string | null; imageDimensions: { width: number, height: number }; qualityReport: QualityReport; }> => {
  if (!process.env.API_KEY) throw new Error("API key not configured. Please set GEMINI_API_KEY.");
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const { processedFile, processedPreviewUrl, imageDimensions, qualityReport } = await preprocessImage(imageFile);
    const apiResponse = await runExtraction(processedFile, ai);
    const forms = processExtractedForms(apiResponse);

    return { forms, processedPreviewUrl, imageDimensions, qualityReport };
  } catch (e) {
    console.error("Extraction error:", e);
    
    if (e instanceof Error) {
        if (e.message.includes('API key')) {
            throw new Error("API key error. Please check your GEMINI_API_KEY configuration.");
        }
        if (e.message.includes('Rpc failed') || e.message.includes('xhr error') || e.message.includes('network')) {
            throw new Error("Network error. Please check your internet connection and try again.");
        }
        if (e.message.includes('quota') || e.message.includes('rate limit')) {
            throw new Error("API quota exceeded. Please wait a moment and try again.");
        }
        if (e.message.includes('File must be an image')) {
            throw new Error("Invalid file type. Please upload an image file (PNG, JPEG, WEBP).");
        }
        throw new Error(`Extraction failed: ${e.message}`);
    }
    
    throw new Error("An unexpected error occurred during extraction. Please try again.");
  }
};