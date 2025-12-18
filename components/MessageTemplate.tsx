'use client';

import { useState, useEffect } from 'react';

interface MessageTemplateProps {
  availableVariables: string[];
  onTemplateChange: (template: string) => void;
  sampleData?: Record<string, string>;
}

export default function MessageTemplate({
  availableVariables,
  onTemplateChange,
  sampleData,
}: MessageTemplateProps) {
  const [template, setTemplate] = useState('');
  const [preview, setPreview] = useState('');

  useEffect(() => {
    onTemplateChange(template);

    // 生成預覽
    if (sampleData) {
      let previewText = template;
      for (const key in sampleData) {
        previewText = previewText.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
          sampleData[key]
        );
      }
      setPreview(previewText);
    } else {
      setPreview(template);
    }
  }, [template, sampleData, onTemplateChange]);

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('message-template') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = template;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newTemplate = `${before}{{${variable}}}${after}`;
      setTemplate(newTemplate);

      // 重新設置光標位置
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + variable.length + 4;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">訊息模板</h2>

      {availableVariables.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">點擊插入變量：</p>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map((variable) => (
              <button
                key={variable}
                onClick={() => insertVariable(variable)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
              >
                {`{{${variable}}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <label
          htmlFor="message-template"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          訊息內容
        </label>
        <textarea
          id="message-template"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder="輸入訊息內容，可使用 {{變量名}} 插入個人化內容..."
          className="w-full h-40 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
        <p className="mt-1 text-sm text-gray-500">
          字數：{template.length}
        </p>
      </div>

      {template && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">訊息預覽：</p>
          <div className="bg-green-100 rounded-lg p-3 max-w-md">
            <p className="text-gray-800 whitespace-pre-wrap">{preview || '（空白訊息）'}</p>
          </div>
          {sampleData && Object.keys(sampleData).length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              * 使用第一筆資料作為預覽範例
            </p>
          )}
        </div>
      )}
    </div>
  );
}
