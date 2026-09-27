/**
 * 一次性診斷端點（驗證後即刪除）。
 *
 * 在 Vercel 執行環境重現完整 webhook 處理流程的每一步，
 * 回報各步結果與錯誤，定位「正在輸入但無回覆」的斷點。
 * 不回傳任何 token 內容。
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMe, sendChatAction, sendMessage } from '../src/telegram.ts';
import { handleCommand } from '../src/rates/handler.ts';

const CHAT_ID = 1111558803;

type StepResult = { ok: boolean; error?: string; detail?: string | number | null };

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const steps: Record<string, StepResult> = {};

  if (!token) {
    response.status(200).json({ tokenPresent: false });
    return;
  }

  // 步驟 1：getMe（token 有效性）
  try {
    const me = await getMe(token);
    steps.getMe = { ok: true, detail: me.username ?? null };
  } catch (error) {
    steps.getMe = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  // 步驟 2：handleCommand /visa help
  let reply: string | null = null;
  try {
    reply = await handleCommand('visa', ['help']);
    steps.handleCommand = { ok: Boolean(reply), detail: reply?.length ?? 0 };
  } catch (error) {
    steps.handleCommand = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  // 步驟 3：sendChatAction
  try {
    await sendChatAction(token, CHAT_ID);
    steps.sendChatAction = { ok: true };
  } catch (error) {
    steps.sendChatAction = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  // 步驟 4：sendMessage（與 webhook.ts 完全相同的呼叫方式）
  if (reply) {
    try {
      await sendMessage(token, {
        chatId: CHAT_ID,
        text: reply,
        replyToMessageId: 8,
      });
      steps.sendMessage = { ok: true };
    } catch (error) {
      steps.sendMessage = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  response.status(200).json(steps);
}
