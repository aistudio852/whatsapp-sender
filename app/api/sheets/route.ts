import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, message: '請提供 Google Sheet URL' },
        { status: 400 }
      );
    }

    // 從 URL 提取 Sheet ID
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

    if (!match) {
      return NextResponse.json(
        { success: false, message: '無效的 Google Sheet URL，請確保使用正確的分享連結' },
        { status: 400 }
      );
    }

    const sheetId = match[1];

    // 檢查是否有指定的 gid (工作表 ID)
    const gidMatch = url.match(/gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : '0';

    // 構建導出 URL
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    // 下載 CSV
    const response = await fetch(exportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { success: false, message: 'Google Sheet 不存在或無法訪問' },
          { status: 404 }
        );
      }
      if (response.status === 403) {
        return NextResponse.json(
          { success: false, message: 'Google Sheet 沒有公開分享，請先設定「知道連結的人都可以查看」' },
          { status: 403 }
        );
      }
      throw new Error(`下載失敗: ${response.status}`);
    }

    const csvContent = await response.text();

    // 檢查是否真的是 CSV（而不是 HTML 錯誤頁面）
    if (csvContent.includes('<!DOCTYPE html>') || csvContent.includes('<html')) {
      return NextResponse.json(
        { success: false, message: 'Google Sheet 沒有公開分享，請先設定「知道連結的人都可以查看」' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      csvContent,
    });
  } catch (error) {
    console.error('Google Sheet download error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '下載 Google Sheet 失敗',
      },
      { status: 500 }
    );
  }
}
