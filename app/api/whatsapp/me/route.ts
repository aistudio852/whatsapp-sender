import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppUserInfo, isClientReady } from '@/lib/whatsapp';

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

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'userId is required',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!isClientReady(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'WhatsApp 未連接',
          user: null,
        },
        { headers: corsHeaders }
      );
    }

    const userInfo = await getWhatsAppUserInfo(userId);

    if (!userInfo) {
      return NextResponse.json(
        {
          success: false,
          error: '無法獲取用戶資訊',
          user: null,
        },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json({
      success: true,
      user: userInfo,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Get user info error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        user: null,
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
