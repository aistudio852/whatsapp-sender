'use client';

import { useState, useEffect, useCallback } from 'react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'ready';

interface QRCodeDisplayProps {
  onStatusChange?: (status: ConnectionStatus) => void;
}

export default function QRCodeDisplay({ onStatusChange }: QRCodeDisplayProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/whatsapp/qr');
      const data = await response.json();

      if (data.success) {
        updateStatus(data.status);
        setQrDataUrl(data.qrDataUrl);

        if (data.status === 'ready') {
          setQrDataUrl(null);
        }
      }
    } catch (err) {
      console.error('Failed to check status:', err);
    }
  }, [updateStatus]);

  useEffect(() => {
    // 定期檢查狀態
    const interval = setInterval(checkStatus, 2000);
    checkStatus();

    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleConnect = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      const response = await fetch('/api/whatsapp/init', {
        method: 'POST',
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.message || '連接失敗');
      }
    } catch (err) {
      setError('無法連接伺服器');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/whatsapp/logout', {
        method: 'POST',
      });
      updateStatus('disconnected');
      setQrDataUrl(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'disconnected':
        return '未連接';
      case 'connecting':
        return '正在連接...';
      case 'qr_ready':
        return '請掃描 QR Code';
      case 'authenticated':
        return '驗證中...';
      case 'ready':
        return '已連接';
      default:
        return '未知狀態';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'ready':
        return 'bg-green-500';
      case 'connecting':
      case 'qr_ready':
      case 'authenticated':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">WhatsApp 連接</h2>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${getStatusColor()}`}></span>
          <span className="text-sm text-gray-600">{getStatusText()}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {status === 'disconnected' && (
        <button
          onClick={handleConnect}
          disabled={isInitializing}
          className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isInitializing ? '正在初始化...' : '連接 WhatsApp'}
        </button>
      )}

      {status === 'connecting' && (
        <div className="flex flex-col items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">正在啟動 WhatsApp...</p>
        </div>
      )}

      {status === 'qr_ready' && qrDataUrl && (
        <div className="flex flex-col items-center">
          <p className="mb-4 text-gray-600 text-center">
            請使用手機 WhatsApp 掃描以下 QR Code
          </p>
          <div className="p-4 bg-white border rounded-lg">
            <img
              src={qrDataUrl}
              alt="WhatsApp QR Code"
              className="w-64 h-64"
            />
          </div>
          <p className="mt-4 text-sm text-gray-500">
            打開 WhatsApp {'>'} 連結裝置 {'>'} 連結裝置
          </p>
        </div>
      )}

      {status === 'authenticated' && (
        <div className="flex flex-col items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">正在驗證...</p>
        </div>
      )}

      {status === 'ready' && (
        <div className="flex flex-col items-center">
          <div className="text-green-600 mb-4">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-green-600 font-medium mb-4">WhatsApp 已連接</p>
          <button
            onClick={handleDisconnect}
            className="py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            登出
          </button>
        </div>
      )}
    </div>
  );
}
