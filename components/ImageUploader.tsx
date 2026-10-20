import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { UploadIcon, XIcon } from './icons';

interface ImageUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ files, onFilesChange }) => {
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (newFiles && newFiles.length > 0) {
      const newFileArray = Array.from(newFiles);
      onFilesChange([...files, ...newFileArray]);
    }
  }, [files, onFilesChange]);

  const removeFile = useCallback((index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  }, [files, onFilesChange]);

  useEffect(() => {
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPreviews(newPreviews);

    // Cleanup object URLs when files change or on unmount
    return () => {
      newPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const borderClasses = useMemo(() => {
    return isDragging
      ? 'border-cyan-400 ring-2 ring-cyan-400/50 bg-slate-800/80'
      : 'border-slate-700 hover:border-slate-500 bg-slate-900/60';
  }, [isDragging]);

  return (
    <div>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed ${borderClasses} rounded-xl cursor-pointer transition-all duration-200 group`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset input value so selecting the same file again triggers onChange
            if (e.target) e.target.value = '';
          }}
        />
        <div className="p-3 rounded-full bg-slate-800/80 group-hover:bg-slate-800 text-cyan-400 transition-colors">
          <UploadIcon />
        </div>
        <p className="mt-3 text-sm text-slate-300 font-medium">
          <span className="text-cyan-400 group-hover:underline">Click to upload</span> or drag and drop images
        </p>
        <p className="text-xs text-slate-500 mt-1">PNG, JPG, SVG, WebP, GIF (multiple images supported)</p>
      </div>

      {previews.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Uploaded Images ({previews.length})
            </span>
            <button
              type="button"
              onClick={() => onFilesChange([])}
              className="text-xs text-rose-400 hover:text-rose-300 hover:underline"
            >
              Clear all
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {previews.map((preview, index) => (
              <div key={index} className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-950/50">
                <img
                  src={preview}
                  alt={`uploaded reference ${index + 1}`}
                  className="w-full h-20 object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  title="Remove image"
                  className="absolute top-1 right-1 bg-black/70 hover:bg-rose-600 rounded-full p-1 text-white transition-colors"
                >
                  <XIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
