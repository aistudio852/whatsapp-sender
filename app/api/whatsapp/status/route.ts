import { NextResponse } from 'next/server';
import { getStatus } from '@/lib/whatsapp';

const VERSION = '2.0.1';

export async function GET() {
  try {
    const { status, error } = getStatus();

    return NextResponse.json({
      success: true,
      status,
      error,
      version: VERSION,
    });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'disconnected',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
