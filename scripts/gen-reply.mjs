/**
 * 重現 Vercel function 的 sendMessage 呼叫：
 * 1. 用 handleCommand 生成回覆內容（與 Vercel 端完全相同的代碼路徑）
 * 2. 以 telegram.ts 的 sendMessage 格式組裝請求
 * 3. 存檔供 curl 重現，檢查 Telegram 是否回 HTML parse 錯誤
 */
import { handleCommand } from '../src/rates/handler.ts';
import { writeFileSync } from 'node:fs';

const chatId = 1111558803;
const cases = [
  { name: 'help', tokens: ['help'] },
  { name: 'query', tokens: ['CNY', 'TWD', '100', '1'] },
  { name: 'feerate', tokens: ['CNY', 'TWD', '--fee-rate', '100', '456.15'] },
];

for (const c of cases) {
  const reply = await handleCommand('visa', c.tokens);
  const body = {
    chat_id: chatId,
    text: reply,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_parameters: { message_id: 8 },
  };
  writeFileSync(`C:/vtest/body-${c.name}.json`, JSON.stringify(body));
  console.log(`${c.name}: reply ${reply?.length ?? 0} chars → C:/vtest/body-${c.name}.json`);
}
