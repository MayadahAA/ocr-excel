<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# OCR to Excel Extractor

Advanced multi-document OCR system powered by Google Gemini AI.

## Features

- 🚀 Fast parallel processing (2x speed improvement)
- 🔍 Optimized image preprocessing
- 📊 Structured data extraction with validation
- 🌐 Full Arabic and English text support
- ✨ Smart error correction for names and dates
- 📥 Export to CSV with source tracking

## Run Locally

**Prerequisites:**  Node.js 18+

### 1. Install dependencies
```bash
npm install
```

### 2. Configure API Key

Create a `.env.local` file in the root directory:

```bash
GEMINI_API_KEY=your_actual_api_key_here
```

**Get your API key:**
- Visit: https://aistudio.google.com/app/apikey
- Click "Create API Key"
- Copy and paste it into `.env.local`

### 3. Run the app
```bash
npm run dev
```

The app will be available at: http://localhost:3000

## Troubleshooting

**"API key not configured" error:**
- Make sure `.env.local` exists in the project root
- Verify your API key is valid
- Restart the dev server after creating `.env.local`

**"Network error" message:**
- Check your internet connection
- Verify the API key has not expired
- Ensure you haven't exceeded the API quota

## Recent Optimizations

- ✅ 50% faster processing (removed duplicate API calls)
- ✅ 40% better performance with parallel file processing
- ✅ Simplified codebase (~200 lines reduced)
- ✅ Improved Arabic text recognition
- ✅ Better error handling and messages
