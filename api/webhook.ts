/**
 * Telegram webhook 端點。
 *
 * Vercel Functions 為無狀態且無法維持長連線，故採 webhook 模式：
 * Telegram 收到訊息後 POST 到此端點，我們解析命令並以 sendMessage 回覆。
 *
 * 安全性：以 secret_token 驗證來源，並限制允許的群組。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCommand, isSupportedCommand } from '../src/rates/handler.ts';
import { parseCommandLine } from '../src/rates/args.ts';
import { getMe, sendChatAction, sendMessage, type TelegramUpdate } from '../src/telegram.ts';

/** 允許使用的群組白名單；未設定時不限制 */
function allowedChatIds(): Set<string> | null {
  const raw = process.env.ALLOWED_CHAT_IDS?.trim();
  if (!raw) return null;
  const ids = raw.split(/[\s,]+/).filter(Boolean);
  return ids.length > 0 ? new Set(ids) : null;
}

/**
 * bot username 快取。
 * 同一個 function instance 可重複處理多個請求，避免每次都呼叫 getMe。
 */
let cachedBotUsername: string | undefined;
let botUsernameFetchedAt = 0;
const BOT_USERNAME_TTL_MS = 10 * 60 * 1000;

async function resolveBotUsername(token: string): Promise<string | undefined> {
  const now = Date.now();
  if (cachedBotUsername && now - botUsernameFetchedAt < BOT_USERNAME_TTL_MS) {
    return cachedBotUsername;
  }
  try {
    const me = await getMe(token);
    cachedBotUsername = me.username;
    botUsernameFetchedAt = now;
    return cachedBotUsername;
  } catch {
    // 取不到時仍可運作，只是無法判斷 @提及
    return undefined;
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  // 僅接受 POST
  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[fx-bot] 缺少 TELEGRAM_BOT_TOKEN 環境變數');
    response.status(500).json({ ok: false, error: 'Server misconfigured' });
    return;
  }

  // 驗證 webhook 來源：Telegram 會帶上設定 webhook 時指定的 secret_token
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const provided = request.headers['x-telegram-bot-api-secret-token'];
    if (provided !== expectedSecret) {
      response.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }
  }

  const update = request.body as TelegramUpdate | undefined;
  const message = update?.message;

  // 無文字訊息（貼圖、圖片等）直接略過
  if (!message?.text) {
    response.status(200).json({ ok: true });
    return;
  }

  // 白名單檢查
  const allowed = allowedChatIds();
  if (allowed && !allowed.has(String(message.chat.id))) {
    response.status(200).json({ ok: true });
    return;
  }

  const botUsername = await resolveBotUsername(token);
  const parsed = parseCommandLine(message.text, botUsername);

  // 非命令或非本 bot 的命令
  if (!parsed || !isSupportedCommand(parsed.command)) {
    response.status(200).json({ ok: true });
    return;
  }

  // 先回應 Telegram 以免重送，實際處理在回應後繼續
  response.status(200).json({ ok: true });

  try {
    await sendChatAction(token, message.chat.id);

    const reply = await handleCommand(parsed.command, parsed.tokens);
    if (!reply) return;

    await sendMessage(token, {
      chatId: message.chat.id,
      text: reply,
      replyToMessageId: message.message_id,
    });
  } catch (error) {
    console.error('[fx-bot] 處理命令失敗:', error);
    try {
      await sendMessage(token, {
        chatId: message.chat.id,
        text: `❌ <b>處理失敗</b>\n\n${String(error).slice(0, 200)}`,
        replyToMessageId: message.message_id,
      });
    } catch {
      // 回報失敗也失敗時，僅記錄不拋出
    }
  }
}
