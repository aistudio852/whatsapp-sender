import { NextRequest, NextResponse } from 'next/server';
import { sendMessage, isClientReady, SendResult } from '@/lib/whatsapp';

interface Recipient {
  phone: string;
  [key: string]: string;
}

interface SendRequest {
  recipients: Recipient[];
  messageTemplate: string;
  delay?: number; // 每條訊息之間的延遲（毫秒）
}

function replaceVariables(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    if (!isClientReady()) {
      return NextResponse.json(
        {
          success: false,
          message: 'WhatsApp 未連接，請先掃描 QR code 登入',
        },
        { status: 400 }
      );
    }

    const body: SendRequest = await request.json();
    const { recipients, messageTemplate, delay = 3000 } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '請提供收件人列表',
        },
        { status: 400 }
      );
    }

    if (!messageTemplate || messageTemplate.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          message: '請提供訊息模板',
        },
        { status: 400 }
      );
    }

    const results: SendResult[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const personalizedMessage = replaceVariables(messageTemplate, recipient);

      const result = await sendMessage(recipient.phone, personalizedMessage);
      results.push(result);

      // 在每條訊息之間添加延遲（除了最後一條）
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
    });
  } catch (error) {
    console.error('Send error:', error);
    return NextResponse.json(
      {
        success: false,
        message: '發送失敗',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
