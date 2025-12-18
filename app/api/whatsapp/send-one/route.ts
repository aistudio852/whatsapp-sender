import { NextRequest, NextResponse } from 'next/server';
import { sendMessage, isClientReady } from '@/lib/whatsapp';

interface SendOneRequest {
  phone: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!isClientReady()) {
      return NextResponse.json(
        {
          success: false,
          error: 'WhatsApp 未連接',
        },
        { status: 400 }
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
        { status: 400 }
      );
    }

    const result = await sendMessage(phone, message);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Send one error:', error);
    return NextResponse.json(
      {
        success: false,
        phone: '',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
