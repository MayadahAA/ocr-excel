import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedForm, ApiResponse, FormField, QualityReport } from "../types";
import { DateNormalizer } from './dateNormalizer';
import { ArabicCorrector } from './arabicCorrector';
import { db } from './mockDatabase';

const FORM_FIELDS: FormField[] = ["Printer Name", "Ink Type", "Ink Number", "Date", "Department", "Recipient Name", "Employee ID", "Deliverer Name"];
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

const systemInstruction = "OCR AI: Extract form data as JSON with confidence scores and bounding boxes.";
const userPrompt = `Extract all forms from this image (Arabic/English text).

Rules:
- Empty fields: "N/A"
- Confidence: 0-1 per field
- Bounding boxes: [x_min, y_min, x_max, y_max] normalized 0-1
- Arabic: precise dots (ب ت ث ن ي), watch ج/ح/خ س/ش ر/ز د/ذ

Output JSON only.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    forms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ...FORM_FIELDS.reduce((acc, field) => ({ ...acc, [field]: { type: Type.STRING } }), {}),
          "_boundingBoxes": {
            type: Type.OBJECT,
            properties: FORM_FIELDS.reduce((acc, field) => ({
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
            properties: FORM_FIELDS.reduce((acc, field) => ({
              ...acc,
              [field]: { type: Type.NUMBER }
            }), {})
          }
        },
        required: FORM_FIELDS,
      },
    },
  },
  required: ["forms"],
};

// --- Post-Processing & Error Correction ---
const dateNormalizer = new DateNormalizer();
const arabicCorrector = new ArabicCorrector();

const postProcessField = (field: FormField, value: string): { correctedValue: string, correctionDetails?: { original: string, reason: string } } => {
    let correctedValue = String(value ?? '').trim();
    const originalValue = correctedValue;

    if (ARABIC_REGEX.test(originalValue)) {
        return arabicCorrector.postProcess(field, originalValue);
    }
    
    // Non-Arabic corrections
    if (field === "Date") {
        correctedValue = dateNormalizer.normalize(correctedValue);
    } else if (field === "Ink Number" || field === "Employee ID") {
        correctedValue = correctedValue.replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5');
    }
    
    const wasCorrected = originalValue !== correctedValue;
    return { 
      correctedValue, 
      correctionDetails: wasCorrected ? { original: originalValue, reason: "Standard character replacement." } : undefined
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
    if (!parsedData?.forms || !Array.isArray(parsedData.forms)) {
        throw new Error("Invalid response structure from API");
    }
    
    return parsedData;
};

const processExtractedForms = (apiResponse: ApiResponse): ExtractedForm[] => {
    return apiResponse.forms.map(form => {
        const processedForm: ExtractedForm = { ...form };
        
        FORM_FIELDS.forEach(field => {
            const value = form[field] ?? '';
            let { correctedValue, correctionDetails } = postProcessField(field, value);
            
            // تطبيق تعلم من تصحيحات المستخدم السابقة
            const suggestion = db.getSuggestion(field, correctedValue);
            if (suggestion) {
                const originalBeforeSuggestion = correctedValue;
                correctedValue = suggestion;
                correctionDetails = {
                    original: originalBeforeSuggestion,
                    reason: "Applied from user feedback"
                };
                console.log(`✨ Auto-corrected "${originalBeforeSuggestion}" → "${suggestion}" based on feedback`);
            }
            
            processedForm[field] = correctedValue;
            
            if (correctionDetails) {
                const originalConfidence = form._confidence?.[field] ?? 0;
                if (!processedForm._confidence) processedForm._confidence = {};
                processedForm._confidence[field] = Math.min(0.99, originalConfidence + 0.15);
                
                if (!processedForm._correctionDetails) processedForm._correctionDetails = {};
                processedForm._correctionDetails[field] = correctionDetails;
            }
        });
        
        return processedForm;
    });
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