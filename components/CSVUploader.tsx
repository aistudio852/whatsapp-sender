'use client';

import { useRef, useState } from 'react';
import { parseCSV, parseCSVString, ParsedCSVData } from '@/lib/csv-parser';

interface CSVUploaderProps {
  onDataParsed: (data: ParsedCSVData) => void;
}

export default function CSVUploader({ onDataParsed }: CSVUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'sheet'>('sheet');

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
        setIsLoading(false);
        return;
      }

      onDataParsed(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV 解析失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSheetLoad = async () => {
    if (!sheetUrl.trim()) {
      setError('請輸入 Google Sheet URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileName(null);

    try {
      const response = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetUrl }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.message);
        setIsLoading(false);
        return;
      }

      const data = parseCSVString(result.csvContent);

      if (data.rows.length === 0) {
        setError('Google Sheet 沒有數據');
        setIsLoading(false);
        return;
      }

      setFileName('Google Sheet');
      onDataParsed(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入 Google Sheet 失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
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
    if (file) handleFile(file);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">匯入收件人資料</h2>

      {/* 切換標籤 */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab('sheet')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'sheet'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Google Sheet
        </button>
        <button
          onClick={() => setActiveTab('file')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'file'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          上傳 CSV
        </button>
      </div>

      {/* Google Sheet 輸入 */}
      {activeTab === 'sheet' && (
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Sheet URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={handleSheetLoad}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? '載入中...' : '載入'}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800 mb-2">
              <strong>使用步驟：</strong>
            </p>
            <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
              <li>打開你的 Google Sheet</li>
              <li>點擊右上角「分享」按鈕</li>
              <li>設定為「知道連結的人都可以查看」</li>
              <li>複製連結並貼上</li>
            </ol>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <p className="text-sm text-gray-700 mb-2">
              <strong>Google Sheet 格式範例：</strong>
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-300 px-2 py-1">姓名</th>
                    <th className="border border-gray-300 px-2 py-1">電話</th>
                    <th className="border border-gray-300 px-2 py-1">公司</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-2 py-1">張三</td>
                    <td className="border border-gray-300 px-2 py-1">85261234567</td>
                    <td className="border border-gray-300 px-2 py-1">ABC公司</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-2 py-1">李四</td>
                    <td className="border border-gray-300 px-2 py-1">85298765432</td>
                    <td className="border border-gray-300 px-2 py-1">XYZ公司</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * 電話號碼需包含國際區號（如 852 香港、86 中國、1 美國）
            </p>
          </div>
        </div>
      )}

      {/* CSV 文件上傳 */}
      {activeTab === 'file' && (
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
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
                  支持從 Google Sheet 導出的 CSV 文件
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 成功/錯誤提示 */}
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
    </div>
  );
}
