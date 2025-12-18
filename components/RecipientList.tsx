'use client';

import { useState, useMemo } from 'react';
import { validateRecipients } from '@/lib/csv-parser';

interface RecipientListProps {
  data: Record<string, string>[];
  phoneColumn: string;
  onValidRecipientsChange: (recipients: Record<string, string>[]) => void;
}

export default function RecipientList({
  data,
  phoneColumn,
  onValidRecipientsChange,
}: RecipientListProps) {
  const [showInvalid, setShowInvalid] = useState(false);

  const { valid, invalid } = useMemo(() => {
    const result = validateRecipients(data, phoneColumn);
    onValidRecipientsChange(result.valid);
    return result;
  }, [data, phoneColumn, onValidRecipientsChange]);

  const displayHeaders = useMemo(() => {
    if (data.length === 0) return [];
    const headers = Object.keys(data[0]);
    // 顯示最多 4 個欄位
    return headers.slice(0, 4);
  }, [data]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">收件人列表</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-green-600">
            有效: {valid.length}
          </span>
          {invalid.length > 0 && (
            <span className="text-sm text-red-600">
              無效: {invalid.length}
            </span>
          )}
        </div>
      </div>

      {invalid.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center justify-between">
            <p className="text-sm text-yellow-800">
              發現 {invalid.length} 筆無效電話號碼
            </p>
            <button
              onClick={() => setShowInvalid(!showInvalid)}
              className="text-sm text-yellow-700 hover:text-yellow-900 underline"
            >
              {showInvalid ? '隱藏' : '查看'}
            </button>
          </div>
          {showInvalid && (
            <ul className="mt-2 text-sm text-yellow-700 space-y-1">
              {invalid.slice(0, 10).map((item, index) => (
                <li key={index}>
                  {item.row[phoneColumn]} - {item.error}
                </li>
              ))}
              {invalid.length > 10 && (
                <li>...還有 {invalid.length - 10} 筆</li>
              )}
            </ul>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-gray-600 font-medium w-12">#</th>
              {displayHeaders.map((header) => (
                <th
                  key={header}
                  className={`px-3 py-2 text-left font-medium ${
                    header === phoneColumn ? 'text-green-600' : 'text-gray-600'
                  }`}
                >
                  {header}
                  {header === phoneColumn && ' (電話)'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {valid.slice(0, 50).map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-400">{index + 1}</td>
                {displayHeaders.map((header) => (
                  <td key={header} className="px-3 py-2 text-gray-800">
                    {header === phoneColumn ? row.phone : row[header]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {valid.length > 50 && (
          <p className="mt-2 text-center text-sm text-gray-500">
            ...還有 {valid.length - 50} 筆收件人
          </p>
        )}
      </div>

      {valid.length === 0 && (
        <div className="py-8 text-center text-gray-500">
          沒有有效的收件人
        </div>
      )}
    </div>
  );
}
