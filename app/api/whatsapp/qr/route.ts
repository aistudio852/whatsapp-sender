import { NextResponse } from 'next/server';
import { getQRCode, getStatus } from '@/lib/whatsapp';

export async function GET() {
  try {
    const { status } = getStatus();
    const { qrCode, qrDataUrl } = getQRCode();

    return NextResponse.json({
      success: true,
      status,
      qrCode,
      qrDataUrl,
    });
  } catch (error) {
    console.error('QR error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
