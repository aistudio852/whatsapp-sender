import { NextRequest, NextResponse } from 'next/server';
import { initializeClient, getStatus } from '@/lib/whatsapp';

const allowedOrigins = [
  'https://datapro.city',
  'https://www.datapro.city',
  'https://datapro-bf4b7.web.app',
  'https://datapro-bf4b7.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5000',
];

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: getCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body = await request.json();
    const { userId } = body;

    // 驗證 userId
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: '需要提供有效的用戶 ID',
          error: 'userId is required',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const currentStatus = getStatus(userId);

    // 如果已經在連接中或已連接，返回當前狀態
    if (currentStatus.status === 'connecting' || currentStatus.status === 'ready') {
      return NextResponse.json({
        success: true,
        message: currentStatus.status === 'ready' ? '已連接' : '正在連接中...',
        status: currentStatus.status,
      }, { headers: corsHeaders });
    }

    // 開始初始化 (非阻塞)
    initializeClient(userId).catch(console.error);

    return NextResponse.json({
      success: true,
      message: '正在初始化 WhatsApp 連接...',
      status: 'connecting',
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json(
      {
        success: false,
        message: '初始化失敗',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
