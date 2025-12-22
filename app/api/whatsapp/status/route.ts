import { NextRequest, NextResponse } from 'next/server';
import { getStatus, getActiveSessionCount } from '@/lib/whatsapp';

const VERSION = '4.0.0'; // Baileys 版本 - 低內存

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

// POST 方法 - 獲取特定用戶的狀態
export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          status: 'disconnected',
          error: 'userId is required',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const { status, error } = getStatus(userId);

    return NextResponse.json({
      success: true,
      status,
      error,
      version: VERSION,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'disconnected',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET 方法 - 返回服務器狀態（不需要 userId）
export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    return NextResponse.json({
      success: true,
      version: VERSION,
      activeSessions: getActiveSessionCount(),
      message: '服務運行中。請使用 POST 方法並提供 userId 獲取個人狀態。',
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
