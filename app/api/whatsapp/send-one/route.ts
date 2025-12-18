import { NextRequest, NextResponse } from 'next/server';
import { sendMessage, isClientReady } from '@/lib/whatsapp';

interface SendOneRequest {
  phone: string;
  message: string;
}

const allowedOrigins = [
  'https://datapro.city',
  'https://www.datapro.city',
  'https://datapro-bf4b7.web.app',
  'https://datapro-bf4b7.firebaseapp.com',
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
    if (!isClientReady()) {
      return NextResponse.json(
        {
          success: false,
          error: 'WhatsApp 未連接',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const body: SendOneRequest = await request.json();
    const { phone, message } = body;

    if (!phone || !message) {
      return NextResponse.json(
        {
          success: false,
          error: '請提供電話號碼和訊息',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await sendMessage(phone, message);

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error('Send one error:', error);
    return NextResponse.json(
      {
        success: false,
        phone: '',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
