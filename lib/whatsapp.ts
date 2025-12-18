import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'ready';

interface WhatsAppState {
  client: Client | null;
  status: ConnectionStatus;
  qrCode: string | null;
  qrDataUrl: string | null;
  error: string | null;
}

// 全局狀態 (單例模式)
const state: WhatsAppState = {
  client: null,
  status: 'disconnected',
  qrCode: null,
  qrDataUrl: null,
  error: null,
};

// 事件監聽器
type StatusListener = (status: ConnectionStatus) => void;
const statusListeners: StatusListener[] = [];

function notifyStatusChange(status: ConnectionStatus) {
  state.status = status;
  statusListeners.forEach(listener => listener(status));
}

export function addStatusListener(listener: StatusListener) {
  statusListeners.push(listener);
  return () => {
    const index = statusListeners.indexOf(listener);
    if (index > -1) statusListeners.splice(index, 1);
  };
}

export function getStatus(): { status: ConnectionStatus; error: string | null } {
  return { status: state.status, error: state.error };
}

export function getQRCode(): { qrCode: string | null; qrDataUrl: string | null } {
  return { qrCode: state.qrCode, qrDataUrl: state.qrDataUrl };
}

export async function initializeClient(): Promise<void> {
  // 如果已經有客戶端正在運行，先關閉
  if (state.client) {
    try {
      await state.client.destroy();
    } catch (e) {
      console.log('Error destroying existing client:', e);
    }
  }

  state.qrCode = null;
  state.qrDataUrl = null;
  state.error = null;
  notifyStatusChange('connecting');

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

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './.wwebjs_auth',
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
    console.log('QR code received');
    state.qrCode = qr;
    try {
      state.qrDataUrl = await qrcode.toDataURL(qr, { width: 256 });
    } catch (e) {
      console.error('Error generating QR data URL:', e);
    }
    notifyStatusChange('qr_ready');
  });

  client.on('authenticated', () => {
    console.log('WhatsApp authenticated');
    state.qrCode = null;
    state.qrDataUrl = null;
    notifyStatusChange('authenticated');
  });

  client.on('ready', () => {
    console.log('WhatsApp client ready');
    notifyStatusChange('ready');
  });

  client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
    state.error = `驗證失敗: ${msg}`;
    notifyStatusChange('disconnected');
  });

  client.on('disconnected', (reason) => {
    console.log('WhatsApp disconnected:', reason);
    state.error = `已斷開連接: ${reason}`;
    notifyStatusChange('disconnected');
  });

  state.client = client;

  try {
    await client.initialize();
  } catch (error) {
    console.error('Failed to initialize WhatsApp client:', error);
    state.error = `初始化失敗: ${error instanceof Error ? error.message : String(error)}`;
    notifyStatusChange('disconnected');
    throw error;
  }
}

export async function logout(): Promise<void> {
  if (state.client) {
    try {
      await state.client.logout();
      await state.client.destroy();
    } catch (e) {
      console.log('Error during logout:', e);
    }
    state.client = null;
    state.qrCode = null;
    state.qrDataUrl = null;
    state.error = null;
    notifyStatusChange('disconnected');
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

export async function sendMessage(phone: string, message: string): Promise<SendResult> {
  if (!state.client || state.status !== 'ready') {
    return {
      phone,
      success: false,
      error: 'WhatsApp 未連接',
    };
  }

  try {
    // 格式化電話號碼 (移除空格、橫線等，確保有國際區號)
    let formattedPhone = phone.replace(/[\s\-\(\)]/g, '');

    // 如果以 + 開頭，移除 +
    if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }

    // 構建 WhatsApp ID
    const chatId = `${formattedPhone}@c.us`;

    // 直接嘗試發送訊息 (30秒超時)，跳過號碼檢查以提升速度
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
    console.error(`Failed to send message to ${phone}:`, error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    // 如果是號碼無效的錯誤，返回友好的錯誤訊息
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

export function isClientReady(): boolean {
  return state.status === 'ready';
}
