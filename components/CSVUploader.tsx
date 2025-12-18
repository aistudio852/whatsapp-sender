'use client';

import { useRef, useState } from 'react';
import { parseCSV, ParsedCSVData } from '@/lib/csv-parser';

interface CSVUploaderProps {
  onDataParsed: (data: ParsedCSVData) => void;
}

export default function CSVUploader({ onDataParsed }: CSVUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('請上傳 CSV 文件');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const data = await parseCSV(file);

      if (data.rows.length === 0) {
        setError('CSV 文件沒有數據');
        return;
      }

      onDataParsed(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV 解析失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">上傳 CSV 文件</h2>

      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'}
          ${isLoading ? 'opacity-50 cursor-wait' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {isLoading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
            <p className="mt-3 text-gray-600">正在解析...</p>
          </div>
        ) : (
          <>
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mt-3 text-gray-600">
              拖放 CSV 文件到這裡，或點擊選擇文件
            </p>
            <p className="mt-1 text-sm text-gray-500">
              CSV 文件需包含電話號碼欄位
            </p>
          </>
        )}
      </div>

      {fileName && !error && (
        <div className="mt-3 flex items-center text-sm text-green-600">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          已載入: {fileName}
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        <p className="font-medium mb-1">CSV 格式說明：</p>
        <ul className="list-disc list-inside space-y-1">
          <li>第一行為標題列（如：name, phone, message）</li>
          <li>電話號碼需包含國際區號（如：85261234567）</li>
          <li>支持自動偵測電話欄位（phone, tel, mobile, 電話等）</li>
        </ul>
      </div>
    </div>
  );
}
