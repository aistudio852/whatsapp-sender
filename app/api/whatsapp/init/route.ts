import { NextResponse } from 'next/server';
import { initializeClient, getStatus } from '@/lib/whatsapp';

export async function POST() {
  try {
    const currentStatus = getStatus();

    // 如果已經在連接中或已連接，返回當前狀態
    if (currentStatus.status === 'connecting' || currentStatus.status === 'ready') {
      return NextResponse.json({
        success: true,
        message: currentStatus.status === 'ready' ? '已連接' : '正在連接中...',
        status: currentStatus.status,
      });
    }

    // 開始初始化 (非阻塞)
    initializeClient().catch(console.error);

    return NextResponse.json({
      success: true,
      message: '正在初始化 WhatsApp 連接...',
      status: 'connecting',
    });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json(
      {
        success: false,
        message: '初始化失敗',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
