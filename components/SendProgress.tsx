'use client';

interface SendResult {
  phone: string;
  success: boolean;
  error?: string;
  messageId?: string;
}

interface SendProgressProps {
  isLoading: boolean;
  results: SendResult[];
  total: number;
  onClose: () => void;
}

export default function SendProgress({
  isLoading,
  results,
  total,
  onClose,
}: SendProgressProps) {
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const progress = total > 0 ? (results.length / total) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            {isLoading ? '正在發送...' : '發送完成'}
          </h2>
          {!isLoading && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 進度條 */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>進度：{results.length} / {total}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 統計 */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{successCount}</p>
            <p className="text-sm text-green-700">成功</p>
          </div>
          <div className="flex-1 bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{failCount}</p>
            <p className="text-sm text-red-700">失敗</p>
          </div>
        </div>

        {/* 結果列表 */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-md text-sm ${
                  result.success
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{result.phone}</span>
                  <span>
                    {result.success ? (
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                </div>
                {result.error && (
                  <p className="text-xs mt-1 text-red-600">{result.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 載入動畫 */}
        {isLoading && (
          <div className="mt-4 flex items-center justify-center text-gray-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600 mr-2"></div>
            <span className="text-sm">請稍候，正在發送中...</span>
          </div>
        )}

        {/* 完成按鈕 */}
        {!isLoading && (
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            完成
          </button>
        )}
      </div>
    </div>
  );
}
