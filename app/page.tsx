'use client';

import { useState, useCallback } from 'react';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import CSVUploader from '@/components/CSVUploader';
import MessageTemplate from '@/components/MessageTemplate';
import RecipientList from '@/components/RecipientList';
import SendProgress from '@/components/SendProgress';
import { ParsedCSVData } from '@/lib/csv-parser';

type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'ready';

interface SendResult {
  phone: string;
  success: boolean;
  error?: string;
  messageId?: string;
}

export default function Home() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [csvData, setCsvData] = useState<ParsedCSVData | null>(null);
  const [phoneColumn, setPhoneColumn] = useState<string>('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [validRecipients, setValidRecipients] = useState<Record<string, string>[]>([]);
  const [delay, setDelay] = useState(3000);

  // 發送狀態
  const [isSending, setIsSending] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);

  const handleCSVParsed = useCallback((data: ParsedCSVData) => {
    setCsvData(data);
    if (data.phoneColumn) {
      setPhoneColumn(data.phoneColumn);
    } else if (data.headers.length > 0) {
      setPhoneColumn(data.headers[0]);
    }
  }, []);

  const replaceVariables = (template: string, data: Record<string, string>): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSend = async () => {
    if (!validRecipients.length || !messageTemplate) {
      alert('請確保有有效收件人和訊息內容');
      return;
    }

    if (connectionStatus !== 'ready') {
      alert('請先連接 WhatsApp');
      return;
    }

    setIsSending(true);
    setShowProgress(true);
    setSendResults([]);

    // 逐條發送，實時更新進度
    for (let i = 0; i < validRecipients.length; i++) {
      const recipient = validRecipients[i];
      const personalizedMessage = replaceVariables(messageTemplate, recipient);

      try {
        const response = await fetch('/api/whatsapp/send-one', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: recipient.phone,
            message: personalizedMessage,
          }),
        });

        const result = await response.json();
        setSendResults(prev => [...prev, result]);
      } catch (error) {
        console.error('Send error:', error);
        setSendResults(prev => [...prev, {
          phone: recipient.phone,
          success: false,
          error: '發送失敗',
        }]);
      }

      // 延遲（除了最後一條）
      if (i < validRecipients.length - 1) {
        await sleep(delay);
      }
    }

    setIsSending(false);
  };

  const canSend = connectionStatus === 'ready' && validRecipients.length > 0 && messageTemplate.trim() !== '';

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 標題 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            WhatsApp 批量發送工具
          </h1>
          <p className="text-gray-600">
            上傳 CSV 文件，批量發送個人化 WhatsApp 訊息
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側：WhatsApp 連接 */}
          <div className="lg:col-span-1">
            <QRCodeDisplay onStatusChange={setConnectionStatus} />
          </div>

          {/* 右側：CSV 和訊息 */}
          <div className="lg:col-span-2 space-y-6">
            {/* CSV 上傳 */}
            <CSVUploader onDataParsed={handleCSVParsed} />

            {/* 選擇電話欄位 */}
            {csvData && csvData.headers.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">選擇電話欄位</h2>
                <select
                  value={phoneColumn}
                  onChange={(e) => setPhoneColumn(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {csvData.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                      {header === csvData.phoneColumn && ' (自動偵測)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 收件人列表 */}
            {csvData && phoneColumn && (
              <RecipientList
                data={csvData.rows}
                phoneColumn={phoneColumn}
                onValidRecipientsChange={setValidRecipients}
              />
            )}

            {/* 訊息模板 */}
            {csvData && (
              <MessageTemplate
                availableVariables={csvData.headers}
                onTemplateChange={setMessageTemplate}
                sampleData={csvData.rows[0]}
              />
            )}

            {/* 發送設定 */}
            {validRecipients.length > 0 && messageTemplate && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">發送設定</h2>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    每條訊息間隔（秒）
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={delay / 1000}
                    onChange={(e) => setDelay(Number(e.target.value) * 1000)}
                    className="w-32 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    建議設定 3-5 秒以避免被封號
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                  <p className="text-sm text-yellow-800">
                    <strong>注意：</strong>即將發送 {validRecipients.length} 條訊息，
                    預計耗時約 {Math.ceil((validRecipients.length * delay) / 1000 / 60)} 分鐘
                  </p>
                </div>

                <button
                  onClick={handleSend}
                  disabled={!canSend || isSending}
                  className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
                    canSend && !isSending
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {connectionStatus !== 'ready'
                    ? '請先連接 WhatsApp'
                    : isSending
                    ? '發送中...'
                    : `發送 ${validRecipients.length} 條訊息`}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 發送進度彈窗 */}
        {showProgress && (
          <SendProgress
            isLoading={isSending}
            results={sendResults}
            total={validRecipients.length}
            onClose={() => setShowProgress(false)}
          />
        )}

        {/* 頁腳 */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>
            使用 whatsapp-web.js 連接 WhatsApp Web
          </p>
          <p className="mt-1">
            請合理使用，避免發送垃圾訊息
          </p>
        </footer>
      </div>
    </main>
  );
}
