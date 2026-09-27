/**
 * 一次性診斷端點（驗證後即刪除）。
 *
 * 回報 Vercel 端環境變數的狀態與 Telegram API 可達性，
 * 不回傳任何 token 內容，避免洩漏。
 */
import { getMe } from '../src/telegram.ts';

export default async function handler(request, response) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  const result = {
    tokenPresent: Boolean(token),
    tokenLength: token ? token.length : 0,
    tokenPrefixMatchesBotId: token ? token.startsWith('8971930089:') : false,
    secretPresent: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    getMeOk: false,
    botUsername: null,
    getMeError: null,
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

  response.status(200).json(result);
}
