export type FormField = "Printer Name" | "Ink Type" | "Ink Number" | "Date" | "Department" | "Recipient Name" | "Employee ID" | "Deliverer Name";

export interface BoundingBox {
    // [x_min, y_min, x_max, y_max] in relative (0-1) coordinates
    box: [number, number, number, number]; 
    page: number;
}

// Shape used in the application state
export interface Form {
  _id: string; // Unique ID for the row, added client-side
  _verified: boolean; // Verification status, added client-side
  _notes?: string; // User notes for the row
  "Printer Name": string;
  "Ink Type": string;
  "Ink Number": string;
  "Date": string;
  "Department": string;
  "Recipient Name": string;
  "Employee ID": string;
  "Deliverer Name": string;
  _boundingBoxes?: { [key in FormField]?: BoundingBox };
  _confidence?: { [key in FormField]?: number }; // Confidence score 0-1, added client-side
  _correctionDetails?: { [key in FormField]?: { original: string; reason: string; } };
}

// Gemini response will have this shape
export interface ExtractedForm {
  "Printer Name": string;
  "Ink Type": string;
  "Ink Number": string;
  "Date": string;
  "Department": string;
  "Recipient Name": string;
  "Employee ID": string;
  "Deliverer Name": string;
  _boundingBoxes?: { [key in FormField]?: BoundingBox };
  _confidence?: { [key in FormField]?: number };
  _correctionDetails?: { [key in FormField]?: { original: string; reason: string; } };
}


export interface ApiResponse {
  forms: ExtractedForm[];
}

export interface ValidationIssue {
  formIndex: number; // Corresponds to index in the data array
  field: FormField;
  message: string;
  type: 'missing' | 'format' | 'confidence';
}

export interface QualityReport {
  score: number; // Overall composite score
  sharpness: number;
  contrast: number;
  appliedOps: string[];
}

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: string;
  status: 'processing' | 'processed' | 'error' | 'pending';
  extractedData: Form[] | null;
  validationIssues: ValidationIssue[];
  previewUrl: string;
  processedPreviewUrl?: string | null;
  imageDimensions?: { width: number; height: number }; // To calculate bounding box pixels
  qualityReport?: QualityReport | null;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}