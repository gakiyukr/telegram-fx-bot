/**
 * Webhook 註冊 / 查詢 / 移除工具。
 *
 * 用法：
 *   node scripts/set-webhook.mjs set    https://your-app.vercel.app/api/webhook
 *   node scripts/set-webhook.mjs info
 *   node scripts/set-webhook.mjs delete
 *
 * 需要環境變數 TELEGRAM_BOT_TOKEN；設定 webhook 時另需 TELEGRAM_WEBHOOK_SECRET。
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env');

/** 讀取 .env（不依賴 dotenv，維持零依賴） */
function loadEnv() {
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('缺少 TELEGRAM_BOT_TOKEN，請在 .env 設定或匯出環境變數');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${token}`;
const action = process.argv[2] ?? 'info';

async function call(method, body) {
  const response = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return { status: response.status, body: await response.json() };
}

if (action === 'set') {
  const url = process.argv[3];
  if (!url) {
    console.error('用法：node scripts/set-webhook.mjs set <webhook-url>');
    process.exit(1);
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const payload = {
    url,
    allowed_updates: ['message'],
    drop_pending_updates: true,
    ...(secret ? { secret_token: secret } : {}),
  };
  const result = await call('setWebhook', payload);
  console.log('setWebhook:', result.status, JSON.stringify(result.body));
  if (!secret) {
    console.warn('⚠️ 未設定 TELEGRAM_WEBHOOK_SECRET，端點將不驗證來源');
  }
} else if (action === 'delete') {
  const result = await call('deleteWebhook', { drop_pending_updates: true });
  console.log('deleteWebhook:', result.status, JSON.stringify(result.body));
} else {
  const result = await call('getWebhookInfo');
  console.log('getWebhookInfo:', result.status);
  console.log(JSON.stringify(result.body, null, 2));
}
