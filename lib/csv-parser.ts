import Papa from 'papaparse';

export interface ParsedCSVData {
  headers: string[];
  rows: Record<string, string>[];
  phoneColumn: string | null;
  errors: string[];
}

// 常見的電話號碼欄位名稱
const PHONE_COLUMN_PATTERNS = [
  /^phone$/i,
  /^tel$/i,
  /^telephone$/i,
  /^mobile$/i,
  /^cell$/i,
  /^whatsapp$/i,
  /^電話$/i,
  /^手機$/i,
  /^聯絡電話$/i,
  /phone/i,
  /tel/i,
  /mobile/i,
];

export function detectPhoneColumn(headers: string[]): string | null {
  for (const pattern of PHONE_COLUMN_PATTERNS) {
    for (const header of headers) {
      if (pattern.test(header)) {
        return header;
      }
    }
  }
  return null;
}

export function parseCSV(file: File): Promise<ParsedCSVData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as Record<string, string>[];
        const errors: string[] = [];

        // 收集解析錯誤
        if (results.errors.length > 0) {
          results.errors.forEach((error) => {
            errors.push(`第 ${error.row} 行: ${error.message}`);
          });
        }

        // 自動偵測電話欄位
        const phoneColumn = detectPhoneColumn(headers);

        // 清理數據 - 移除空白
        const cleanedRows = rows.map((row) => {
          const cleanedRow: Record<string, string> = {};
          for (const key in row) {
            cleanedRow[key] = typeof row[key] === 'string' ? row[key].trim() : String(row[key] || '');
          }
          return cleanedRow;
        }).filter(row => {
          // 過濾掉完全空白的行
          return Object.values(row).some(value => value !== '');
        });

        resolve({
          headers,
          rows: cleanedRows,
          phoneColumn,
          errors,
        });
      },
      error: (error) => {
        reject(new Error(`CSV 解析失敗: ${error.message}`));
      },
    });
  });
}

export function validatePhoneNumber(phone: string): { valid: boolean; formatted: string; error?: string } {
  if (!phone) {
    return { valid: false, formatted: '', error: '電話號碼為空' };
  }

  // 移除所有非數字和 + 號的字符
  let cleaned = phone.replace(/[^\d+]/g, '');

  // 確保以 + 開頭或全部是數字
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // 檢查是否全部為數字
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, formatted: phone, error: '電話號碼格式無效' };
  }

  // 檢查長度（國際電話通常 7-15 位數字）
  if (cleaned.length < 7 || cleaned.length > 15) {
    return { valid: false, formatted: phone, error: '電話號碼長度無效' };
  }

  return { valid: true, formatted: cleaned };
}

export function validateRecipients(
  rows: Record<string, string>[],
  phoneColumn: string
): { valid: Record<string, string>[]; invalid: { row: Record<string, string>; error: string }[] } {
  const valid: Record<string, string>[] = [];
  const invalid: { row: Record<string, string>; error: string }[] = [];

  for (const row of rows) {
    const phone = row[phoneColumn];
    const validation = validatePhoneNumber(phone);

    if (validation.valid) {
      valid.push({
        ...row,
        phone: validation.formatted,
      });
    } else {
      invalid.push({
        row,
        error: validation.error || '未知錯誤',
      });
    }
  }

  return { valid, invalid };
}
