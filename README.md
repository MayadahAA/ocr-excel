# OCR to Excel Extractor

Advanced multi-document OCR system powered by Google Gemini AI.

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://mayadahaa.github.io/ocr-excel/)
[![GitHub Pages](https://github.com/MayadahAA/ocr-excel/actions/workflows/deploy.yml/badge.svg)](https://github.com/MayadahAA/ocr-excel/actions/workflows/deploy.yml)

## Live Demo

Try it now: **[https://mayadahaa.github.io/ocr-excel/](https://mayadahaa.github.io/ocr-excel/)**

No installation required - just open the link and enter your Gemini API key to start extracting data from documents.

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

**Get your free API key:**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy and paste it into `.env.local`

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

## Technology Stack

- **Frontend:** React 19, TypeScript
- **Build Tool:** Vite
- **AI Engine:** Google Gemini AI
- **Deployment:** GitHub Pages with automated CI/CD

## Recent Optimizations

- ✅ 50% faster processing (removed duplicate API calls)
- ✅ 40% better performance with parallel file processing
- ✅ Simplified codebase (~200 lines reduced)
- ✅ Improved Arabic text recognition
- ✅ Better error handling and messages

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

This project is open source and available under the MIT License.
