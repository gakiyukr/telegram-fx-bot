/**
 * 一次性診斷端點（驗證後即刪除）。
 *
 * 承接 Telegram 投遞，重現完整處理流程，
 * 並把每步結果轉發到 webhook.site 觀察站供外部檢視。
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMe, sendChatAction, sendMessage } from '../src/telegram.ts';
import { handleCommand } from '../src/rates/handler.ts';

const OBSERVER = 'https://webhook.site/7b3b29c6-5be8-4ffd-8a48-e7fbb32ee852';

async function logToObserver(tag: string, data: unknown): Promise<void> {
  try {
    await fetch(OBSERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, data, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // 觀察站失敗不影響主流程
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  response.status(200).json({ ok: true });

  if (!token) {
    await logToObserver('no-token', null);
    return;
  }

  const update = request.body as {
    message?: { chat?: { id?: number }; text?: string; message_id?: number };
  } | undefined;
  const chatId = update?.message?.chat?.id;
  const messageId = update?.message?.message_id;
  const text = update?.message?.text;

  await logToObserver('received', { chatId, messageId, text, method: request.method, hasSecretHeader: Boolean(request.headers['x-telegram-bot-api-secret-token']) });

  if (!chatId) {
    await logToObserver('no-chat-id', request.body);
    return;
  }

  try {
    await sendChatAction(token, chatId);
    await logToObserver('sendChatAction', { ok: true });
  } catch (error) {
    await logToObserver('sendChatAction-failed', { error: error instanceof Error ? error.message : String(error) });
  }

  let reply: string | null = null;
  try {
    const command = text?.trim().split(/\s+/)[0]?.slice(1).split('@')[0] ?? '';
    reply = await handleCommand(command, text ? text.trim().split(/\s+/).slice(1) : []);
    await logToObserver('handleCommand', { ok: Boolean(reply), length: reply?.length ?? 0, preview: reply?.slice(0, 80) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logToObserver('handleCommand-failed', { message });
    reply = `❌ <b>處理失敗</b>\n\n${message}`;
  }

  if (reply) {
    try {
      await sendMessage(token, {
        chatId,
        text: reply,
        replyToMessageId: messageId,
      });
      await logToObserver('sendMessage', { ok: true });
    } catch (error) {
      await logToObserver('sendMessage-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
