import React from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { CloseIcon } from './icons/CloseIcon';
import { FileIcon } from './icons/FileIcon';
import { PlusIcon } from './icons/PlusIcon';
import { UploadedFile } from '../types';

interface DocumentManagerProps {
  files: UploadedFile[];
  selectedFileId: string | null;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  onSelectFile: (id: string) => void;
  onClear: () => void;
}

export const ImageUploader: React.FC<DocumentManagerProps> = React.memo(({ files, selectedFileId, onAddFiles, onRemoveFile, onSelectFile }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(Array.from(e.target.files));
      e.target.value = ''; // Reset input to allow re-uploading the same file
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const getStatusBadge = (status: UploadedFile['status']) => {
    switch (status) {
      case 'processed':
        return <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-300 rounded-full">Processed</span>;
      case 'processing':
        return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-300 rounded-full">Processing</span>;
      case 'error':
        return <span className="px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-300 rounded-full">Error</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium bg-slate-600 text-slate-300 rounded-full">Pending</span>;
    }
  };

  return (
    <div className="w-full flex flex-col h-full space-y-4">
      <div className="flex-shrink-0 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white flex items-center">
            <span className="flex items-center justify-center h-8 w-8 mr-3 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                <UploadIcon className="h-5 w-5"/>
            </span>
            Documents
        </h2>
        <span className="text-sm text-slate-400">{files.length} files</span>
      </div>

      <label
        htmlFor="file-upload"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="flex-shrink-0 relative block w-full h-20 rounded-lg border-2 border-dashed border-slate-700 p-3 text-center hover:border-blue-500 transition-colors cursor-pointer bg-slate-800/20 hover:bg-slate-800/40"
      >
        <div className="flex items-center justify-center h-full gap-3 text-center">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <PlusIcon className="h-5 w-5 text-white"/>
            </div>
            <div>
                <p className="text-sm font-semibold text-slate-300">Add Documents</p>
                <p className="text-xs text-slate-500">Drop files here or click to browse</p>
            </div>
        </div>
        <input id="file-upload" name="file-upload" type="file" multiple className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp, application/pdf" />
      </label>

      <div className="flex-grow overflow-y-auto space-y-2 pr-2 -mr-2 min-h-0">
        {files.map((file) => (
            <div 
              key={file.id} 
              onClick={() => onSelectFile(file.id)}
              className={`w-full p-3 rounded-lg flex items-center space-x-3 cursor-pointer transition-all duration-200 glassmorphism hover:border-blue-500/80 ${selectedFileId === file.id ? 'ring-2 ring-blue-500 bg-slate-700/50' : 'border-transparent'}`}
            >
                <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md overflow-hidden bg-slate-800">
                  {file.previewUrl.startsWith('blob:') ? (
                    <img src={file.previewUrl} alt="Preview" className="h-full w-full object-cover"/>
                  ) : file.previewUrl.startsWith('https://placehold.co') ? (
                     <img src={file.previewUrl} alt="Placeholder" className="h-full w-full object-cover"/>
                  ) : (
                    <FileIcon className="h-5 w-5 text-cyan-400"/>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{file.size}</p>
                </div>
                <div className="flex items-center space-x-3">
                  {getStatusBadge(file.status)}
                  <button 
                      onClick={(e) => { e.stopPropagation(); onRemoveFile(file.id); }} 
                      title="Remove file"
                      className="p-1 rounded-full text-slate-500 hover:bg-red-500/20 hover:text-red-400 focus:outline-none transition-colors"
                  >
                      <CloseIcon className="h-4 w-4" />
                  </button>
                </div>
            </div>
        ))}
         {files.length === 0 && (
             <div className="h-full flex items-center justify-center text-center text-slate-500">
                <p>No documents uploaded.</p>
             </div>
         )}
      </div>
    </div>
  );
});