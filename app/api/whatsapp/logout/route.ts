import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logout } from '@/lib/whatsapp';

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
    await logout();

    return NextResponse.json({
      success: true,
      message: '已登出 WhatsApp',
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        message: '登出失敗',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
