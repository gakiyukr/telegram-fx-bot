/**
 * 一次性診斷端點（驗證後即刪除）。
 *
 * 回聲模式：把 Telegram 投遞的 update 原樣回發到原對話，
 * 用來驗證 webhook 投遞是否真的發生。
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendMessage } from '../src/telegram.ts';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, error: 'POST only' });
    return;
  }
  if (!token) {
    response.status(500).json({ ok: false, error: 'no token' });
    return;
  }

  const update = request.body as { message?: { chat?: { id?: number }; text?: string; message_id?: number } } | undefined;
  const chatId = update?.message?.chat?.id;
  const text = update?.message?.text;

  // 回應 Telegram（先回 200 避免重試轟炸）
  response.status(200).json({ ok: true });

  if (!chatId) return;

  try {
    await sendMessage(token, {
      chatId,
      text:
        `📡 <b>ECHO 診斷</b>\n` +
        `Vercel 於 <code>${new Date().toISOString()}</code> 收到投遞\n` +
        `訊息內容：<code>${text ?? '(non-text)'}</code>\n` +
        `chat_id：<code>${chatId}</code>`,
    });
  } catch (error) {
    // 回聲失敗僅記錄（Telegram 端無法觀察）
    console.error('[diag-echo] sendMessage failed:', error);
  }
}
