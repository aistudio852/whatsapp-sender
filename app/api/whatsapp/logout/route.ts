import { NextResponse } from 'next/server';
import { logout } from '@/lib/whatsapp';

export async function POST() {
  try {
    await logout();

    return NextResponse.json({
      success: true,
      message: '已登出 WhatsApp',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        message: '登出失敗',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
