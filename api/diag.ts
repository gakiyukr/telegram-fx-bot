/**
 * 一次性診斷端點（驗證後即刪除）。
 *
 * 在 Vercel 執行環境中直接呼叫 handleCommand，
 * 驗證環境變數與命令處理是否正常。不回傳任何 token 內容。
 */
import { getMe } from '../src/telegram.ts';
import { handleCommand } from '../src/rates/handler.ts';

function allowedChatIds(): Set<string> | null {
  const raw = process.env.ALLOWED_CHAT_IDS?.trim();
  if (!raw) return null;
  const ids = raw.split(/[\s,]+/).filter(Boolean);
  return ids.length > 0 ? new Set(ids) : null;
}

export default async function handler(request, response) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  const result = {
    tokenPresent: Boolean(token),
    tokenLength: token ? token.length : 0,
    tokenPrefixMatchesBotId: token ? token.startsWith('8971930089:') : false,
    secretPresent: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    allowedChatIdsRaw: process.env.ALLOWED_CHAT_IDS ?? '(unset)',
    allowedChatIdsParsed: allowedChatIds() ? [...allowedChatIds()!] : null,
    getMeOk: false,
    botUsername: null,
    handleCommandHelp: null,
    handleCommandError: null,
  };

  if (token) {
    try {
      const me = await getMe(token);
      result.getMeOk = true;
      result.botUsername = me.username ?? null;
    } catch (error) {
      result.getMeError = error instanceof Error ? error.message : String(error);
    }
  }

  try {
    result.handleCommandHelp = (await handleCommand('visa', ['help']))?.slice(0, 120) ?? null;
  } catch (error) {
    result.handleCommandError = error instanceof Error ? error.message : String(error);
  }

  response.status(200).json(result);
}
