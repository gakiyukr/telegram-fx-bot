/**
 * Telegram Bot API 客戶端。
 *
 * 僅使用 fetch，維持零執行期依賴，避免 serverless bundle 膨脹。
 */

const API_BASE = 'https://api.telegram.org';

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string; title?: string };
    from?: { id: number; is_bot: boolean; username?: string; first_name?: string };
    text?: string;
    reply_to_message?: { message_id: number };
  };
};

export type SendMessageOptions = {
  chatId: number;
  text: string;
  replyToMessageId?: number;
};

/** 送出訊息（HTML parse mode） */
export async function sendMessage(
  token: string,
  options: SendMessageOptions
): Promise<void> {
  const response = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: options.chatId,
      text: options.text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(options.replyToMessageId
        ? { reply_parameters: { message_id: options.replyToMessageId } }
        : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram sendMessage 失敗 (HTTP ${response.status}): ${body.slice(0, 200)}`);
  }
}

/** 送出「正在輸入」狀態；失敗不影響主要流程 */
export async function sendChatAction(token: string, chatId: number): Promise<void> {
  try {
    await fetch(`${API_BASE}/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
  } catch {
    // 狀態提示非必要，忽略失敗
  }
}

/** 取得 bot 自身資訊，用於判斷群組中的 @提及 */
export async function getMe(token: string): Promise<{ username?: string }> {
  const response = await fetch(`${API_BASE}/bot${token}/getMe`);
  if (!response.ok) {
    throw new Error(`Telegram getMe 失敗 (HTTP ${response.status})`);
  }
  const body = (await response.json()) as { result?: { username?: string } };
  return body.result ?? {};
}
