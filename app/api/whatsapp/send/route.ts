import { NextRequest, NextResponse } from 'next/server';
import { sendMessage, isClientReady, SendResult } from '@/lib/whatsapp';

interface Recipient {
  phone: string;
  [key: string]: string;
}

interface SendRequest {
  userId: string;
  recipients: Recipient[];
  messageTemplate: string;
  delay?: number;
}

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

function replaceVariables(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: getCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const body: SendRequest = await request.json();
    const { userId, recipients, messageTemplate, delay = 3000 } = body;

    // 驗證 userId
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: '需要提供有效的用戶 ID',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!isClientReady(userId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'WhatsApp 未連接，請先掃描 QR Code 登入你的 WhatsApp',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '請提供收件人列表',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!messageTemplate || messageTemplate.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          message: '請提供訊息模板',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const results: SendResult[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const personalizedMessage = replaceVariables(messageTemplate, recipient);

      const result = await sendMessage(userId, recipient.phone, personalizedMessage);
      results.push(result);

      if (i < recipients.length - 1 && delay > 0) {
        await sleep(delay);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `發送完成: ${successCount} 成功, ${failCount} 失敗`,
      results,
      summary: {
        total: recipients.length,
        success: successCount,
        failed: failCount,
      },
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Send error:', error);
    return NextResponse.json(
      {
        success: false,
        message: '發送失敗',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
