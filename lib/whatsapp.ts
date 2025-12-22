import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'ready';

interface WhatsAppState {
  client: Client | null;
  status: ConnectionStatus;
  qrCode: string | null;
  qrDataUrl: string | null;
  error: string | null;
  lastActivity: number;
}

// 多租戶狀態管理 - 每個用戶有獨立的 WhatsApp 會話
const userSessions: Map<string, WhatsAppState> = new Map();

// Session 過期時間 (24 小時)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

// 清理過期 sessions (每小時執行一次)
setInterval(() => {
  const now = Date.now();
  for (const [userId, state] of userSessions.entries()) {
    if (now - state.lastActivity > SESSION_TIMEOUT) {
      console.log(`Cleaning up expired session for user: ${userId}`);
      cleanupSession(userId);
    }
  }
}, 60 * 60 * 1000);

function getOrCreateState(userId: string): WhatsAppState {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      client: null,
      status: 'disconnected',
      qrCode: null,
      qrDataUrl: null,
      error: null,
      lastActivity: Date.now(),
    });
  }
  const state = userSessions.get(userId)!;
  state.lastActivity = Date.now();
  return state;
}

async function cleanupSession(userId: string): Promise<void> {
  const state = userSessions.get(userId);
  if (state?.client) {
    try {
      await state.client.destroy();
    } catch (e) {
      console.log(`Error destroying client for user ${userId}:`, e);
    }
  }
  userSessions.delete(userId);

  // 清理用戶的 auth 數據
  const authPath = path.join(process.cwd(), '.wwebjs_auth', `session-${userId}`);
  try {
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }
  } catch (e) {
    console.log(`Error clearing auth data for user ${userId}:`, e);
  }
}

export function getStatus(userId: string): { status: ConnectionStatus; error: string | null } {
  const state = getOrCreateState(userId);
  return { status: state.status, error: state.error };
}

export function getQRCode(userId: string): { qrCode: string | null; qrDataUrl: string | null } {
  const state = getOrCreateState(userId);
  return { qrCode: state.qrCode, qrDataUrl: state.qrDataUrl };
}

export async function initializeClient(userId: string): Promise<void> {
  if (!userId) {
    throw new Error('userId is required');
  }

  const state = getOrCreateState(userId);

  // 如果已經有客戶端正在運行，先關閉
  if (state.client) {
    try {
      await state.client.destroy();
    } catch (e) {
      console.log(`Error destroying existing client for user ${userId}:`, e);
    }
  }

  state.qrCode = null;
  state.qrDataUrl = null;
  state.error = null;
  state.status = 'connecting';

  // 獲取 Chromium 路徑
  const getChromiumPath = () => {
    // Docker/Railway 環境
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    // 本地 macOS
    if (process.platform === 'darwin') {
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    }
    // 其他情況讓 puppeteer 自動偵測
    return undefined;
  };

  // 每個用戶有獨立的 session 目錄
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './.wwebjs_auth',
      clientId: userId, // 使用 userId 作為 clientId，實現用戶隔離
    }),
    puppeteer: {
      headless: true,
      executablePath: getChromiumPath(),
      timeout: 120000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
      ],
    },
    qrMaxRetries: 5,
  });

  client.on('qr', async (qr) => {
    console.log(`QR code received for user: ${userId}`);
    state.qrCode = qr;
    try {
      state.qrDataUrl = await qrcode.toDataURL(qr, { width: 256 });
    } catch (e) {
      console.error('Error generating QR data URL:', e);
    }
    state.status = 'qr_ready';
  });

  client.on('authenticated', () => {
    console.log(`WhatsApp authenticated for user: ${userId}`);
    state.qrCode = null;
    state.qrDataUrl = null;
    state.status = 'authenticated';
  });

  client.on('ready', () => {
    console.log(`WhatsApp client ready for user: ${userId}`);
    state.status = 'ready';
  });

  client.on('auth_failure', (msg) => {
    console.error(`Authentication failed for user ${userId}:`, msg);
    state.error = `驗證失敗: ${msg}`;
    state.status = 'disconnected';
  });

  client.on('disconnected', (reason) => {
    console.log(`WhatsApp disconnected for user ${userId}:`, reason);
    state.error = `已斷開連接: ${reason}`;
    state.status = 'disconnected';
  });

  state.client = client;

  try {
    await client.initialize();
  } catch (error) {
    console.error(`Failed to initialize WhatsApp client for user ${userId}:`, error);
    state.error = `初始化失敗: ${error instanceof Error ? error.message : String(error)}`;
    state.status = 'disconnected';
    throw error;
  }
}

export async function logout(userId: string): Promise<void> {
  const state = userSessions.get(userId);
  const client = state?.client;

  if (state) {
    // 立即重置狀態
    state.client = null;
    state.qrCode = null;
    state.qrDataUrl = null;
    state.error = null;
    state.status = 'disconnected';
  }

  // 刪除用戶的 session 數據
  const authPath = path.join(process.cwd(), '.wwebjs_auth', `session-${userId}`);
  try {
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log(`Auth data cleared for user: ${userId}`);
    }
  } catch (e) {
    console.log(`Error clearing auth data for user ${userId}:`, e);
  }

  // 背景執行 client 清理
  if (client) {
    setImmediate(async () => {
      try {
        await withTimeout(client.logout(), 10000, 'Logout timeout');
      } catch (e) {
        console.log(`Error during logout for user ${userId}:`, e);
      }
      try {
        await withTimeout(client.destroy(), 10000, 'Destroy timeout');
      } catch (e) {
        console.log(`Error during destroy for user ${userId}:`, e);
      }
    });
  }
}

export interface SendResult {
  phone: string;
  success: boolean;
  error?: string;
  messageId?: string;
}

// 超時包裝函數
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    ),
  ]);
}

export async function sendMessage(userId: string, phone: string, message: string): Promise<SendResult> {
  const state = userSessions.get(userId);

  if (!state?.client || state.status !== 'ready') {
    return {
      phone,
      success: false,
      error: 'WhatsApp 未連接，請先掃描 QR Code 登入你的 WhatsApp',
    };
  }

  // 更新活動時間
  state.lastActivity = Date.now();

  try {
    // 格式化電話號碼
    let formattedPhone = phone.replace(/[\s\-\(\)]/g, '');

    if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }

    const chatId = `${formattedPhone}@c.us`;

    const result = await withTimeout(
      state.client.sendMessage(chatId, message),
      30000,
      '發送訊息超時'
    );

    return {
      phone,
      success: true,
      messageId: result.id._serialized,
    };
  } catch (error) {
    console.error(`Failed to send message to ${phone} for user ${userId}:`, error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('invalid') || errorMsg.includes('not registered')) {
      return {
        phone,
        success: false,
        error: '此號碼未註冊 WhatsApp',
      };
    }
    return {
      phone,
      success: false,
      error: errorMsg,
    };
  }
}

export function isClientReady(userId: string): boolean {
  const state = userSessions.get(userId);
  return state?.status === 'ready';
}

// 獲取當前活躍的 session 數量（用於監控）
export function getActiveSessionCount(): number {
  return userSessions.size;
}

// 獲取所有活躍用戶 ID（用於管理）
export function getActiveUserIds(): string[] {
  return Array.from(userSessions.keys());
}
