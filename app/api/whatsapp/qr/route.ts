import { NextRequest, NextResponse } from 'next/server';
import { getQRCode, getStatus } from '@/lib/whatsapp';

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

// 改為 POST 方法，接受 userId
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
          error: 'userId is required',
          status: 'disconnected',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const { status } = getStatus(userId);
    const { qrCode, qrDataUrl } = getQRCode(userId);

    return NextResponse.json({
      success: true,
      status,
      qrCode,
      qrDataUrl,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('QR error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        status: 'disconnected',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// 保留 GET 方法用於向後兼容（但返回 disconnected）
export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  return NextResponse.json({
    success: false,
    status: 'disconnected',
    error: '請使用 POST 方法並提供 userId',
    qrCode: null,
    qrDataUrl: null,
  }, { headers: corsHeaders });
}
