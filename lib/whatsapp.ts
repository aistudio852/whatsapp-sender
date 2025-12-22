import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  ConnectionState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as qrcode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'ready';

interface WhatsAppState {
  socket: WASocket | null;
  status: ConnectionStatus;
  qrCode: string | null;
  qrDataUrl: string | null;
  error: string | null;
  lastActivity: number;
  saveCreds: (() => Promise<void>) | null;
  retryCount: number;
}

// 多租戶狀態管理 - 每個用戶有獨立的 WhatsApp 會話
const userSessions: Map<string, WhatsAppState> = new Map();

// Session 過期時間 (24 小時)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

// 最大重試次數
const MAX_RETRIES = 3;

// Logger - 設置為 warn 以便看到重要錯誤
const logger = pino({ level: 'warn' });

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
      socket: null,
      status: 'disconnected',
      qrCode: null,
      qrDataUrl: null,
      error: null,
      lastActivity: Date.now(),
      saveCreds: null,
      retryCount: 0,
    });
  }
  const state = userSessions.get(userId)!;
  state.lastActivity = Date.now();
  return state;
}

async function cleanupSession(userId: string): Promise<void> {
  const state = userSessions.get(userId);
  if (state?.socket) {
    try {
      state.socket.end(undefined);
    } catch (e) {
      console.log(`Error ending socket for user ${userId}:`, e);
    }
  }
  userSessions.delete(userId);

  // 清理用戶的 auth 數據
  const authPath = path.join(process.cwd(), '.baileys_auth', userId);
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

  // 如果已經有 socket 正在運行，先關閉
  if (state.socket) {
    try {
      state.socket.end(undefined);
    } catch (e) {
      console.log(`Error ending existing socket for user ${userId}:`, e);
    }
    state.socket = null;
  }

  state.qrCode = null;
  state.qrDataUrl = null;
  state.error = null;
  state.status = 'connecting';

  // 每個用戶有獨立的 session 目錄
  const authPath = path.join(process.cwd(), '.baileys_auth', userId);

  // 確保目錄存在
  if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
  }

  try {
    const { state: authState, saveCreds } = await useMultiFileAuthState(authPath);
    state.saveCreds = saveCreds;

    // 獲取最新版本信息
    const { version } = await fetchLatestBaileysVersion();
    console.log(`Using Baileys version ${version.join('.')} for user ${userId}`);

    const socket = makeWASocket({
      version,
      auth: authState,
      printQRInTerminal: false,
      logger,
      browser: ['DataPro', 'Chrome', '120.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    state.socket = socket;

    // 處理連接狀態更新
    socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      console.log(`Connection update for user ${userId}:`, { connection, qr: !!qr });

      if (qr) {
        console.log(`QR code received for user: ${userId}`);
        state.qrCode = qr;
        state.retryCount = 0; // 重置重試計數
        try {
          state.qrDataUrl = await qrcode.toDataURL(qr, { width: 256 });
        } catch (e) {
          console.error('Error generating QR data URL:', e);
        }
        state.status = 'qr_ready';
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error as Boom;
        const statusCode = error?.output?.statusCode;
        const errorMessage = error?.message || 'Unknown error';

        console.log(`Connection closed for user ${userId}:`, {
          statusCode,
          errorMessage,
          retryCount: state.retryCount,
        });

        // 判斷是否需要重連
        if (statusCode === DisconnectReason.loggedOut) {
          // 用戶登出，清理數據
          state.error = '已登出';
          state.status = 'disconnected';
          state.socket = null;
          state.retryCount = 0;
          try {
            if (fs.existsSync(authPath)) {
              fs.rmSync(authPath, { recursive: true, force: true });
            }
          } catch (e) {
            console.log(`Error clearing auth data for user ${userId}:`, e);
          }
        } else if (statusCode === DisconnectReason.restartRequired) {
          // 需要重啟，直接重連
          console.log(`Restart required for user ${userId}, reconnecting...`);
          state.retryCount = 0;
          setTimeout(() => {
            initializeClient(userId).catch(e => {
              console.error(`Failed to reconnect for user ${userId}:`, e);
              state.error = '重連失敗';
              state.status = 'disconnected';
            });
          }, 1000);
        } else if (state.retryCount < MAX_RETRIES) {
          // 嘗試重連
          state.retryCount++;
          const delay = Math.min(state.retryCount * 2000, 10000);
          console.log(`Reconnecting for user ${userId} (attempt ${state.retryCount}/${MAX_RETRIES}) in ${delay}ms...`);
          state.status = 'connecting';
          setTimeout(() => {
            initializeClient(userId).catch(e => {
              console.error(`Failed to reconnect for user ${userId}:`, e);
              state.error = '重連失敗';
              state.status = 'disconnected';
            });
          }, delay);
        } else {
          // 超過重試次數
          console.log(`Max retries reached for user ${userId}`);
          state.error = `連接失敗: ${errorMessage}`;
          state.status = 'disconnected';
          state.socket = null;
          state.retryCount = 0;
        }
      } else if (connection === 'open') {
        console.log(`WhatsApp connected for user: ${userId}`);
        state.qrCode = null;
        state.qrDataUrl = null;
        state.status = 'ready';
        state.error = null;
        state.retryCount = 0;
      }
    });

    // 處理憑證更新
    socket.ev.on('creds.update', async () => {
      if (state.saveCreds) {
        await state.saveCreds();
      }
    });
  } catch (error) {
    console.error(`Failed to initialize client for user ${userId}:`, error);
    state.error = `初始化失敗: ${error instanceof Error ? error.message : String(error)}`;
    state.status = 'disconnected';
    throw error;
  }
}

export async function logout(userId: string): Promise<void> {
  const state = userSessions.get(userId);
  const socket = state?.socket;

  if (state) {
    // 立即重置狀態
    state.socket = null;
    state.qrCode = null;
    state.qrDataUrl = null;
    state.error = null;
    state.status = 'disconnected';
    state.saveCreds = null;
    state.retryCount = 0;
  }

  // 刪除用戶的 session 數據
  const authPath = path.join(process.cwd(), '.baileys_auth', userId);
  try {
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log(`Auth data cleared for user: ${userId}`);
    }
  } catch (e) {
    console.log(`Error clearing auth data for user ${userId}:`, e);
  }

  // 背景執行 socket 清理
  if (socket) {
    setImmediate(async () => {
      try {
        await socket.logout();
      } catch (e) {
        console.log(`Error during logout for user ${userId}:`, e);
      }
      try {
        socket.end(undefined);
      } catch (e) {
        console.log(`Error during end for user ${userId}:`, e);
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

export async function sendMessage(userId: string, phone: string, message: string): Promise<SendResult> {
  const state = userSessions.get(userId);

  if (!state?.socket || state.status !== 'ready') {
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

    // Baileys 使用 @s.whatsapp.net 格式
    const jid = `${formattedPhone}@s.whatsapp.net`;

    const result = await state.socket.sendMessage(jid, { text: message });

    return {
      phone,
      success: true,
      messageId: result?.key?.id || undefined,
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

// WhatsApp 用戶資訊
export interface WhatsAppUserInfo {
  phone: string | null;
  name: string | null;
  profilePicUrl: string | null;
}

// 獲取已登入的 WhatsApp 用戶資訊
export async function getWhatsAppUserInfo(userId: string): Promise<WhatsAppUserInfo | null> {
  const state = userSessions.get(userId);

  if (!state?.socket || state.status !== 'ready') {
    return null;
  }

  try {
    const user = state.socket.user;
    if (!user) {
      return null;
    }

    let profilePicUrl: string | null = null;

    // 嘗試獲取頭像
    try {
      const picUrl = await state.socket.profilePictureUrl(user.id, 'image');
      profilePicUrl = picUrl || null;
    } catch (e) {
      console.log('Could not get profile picture:', e);
    }

    return {
      phone: user.id?.split('@')[0] || null,
      name: user.name || null,
      profilePicUrl: profilePicUrl || null,
    };
  } catch (error) {
    console.error(`Failed to get WhatsApp user info for ${userId}:`, error);
    return null;
  }
}
