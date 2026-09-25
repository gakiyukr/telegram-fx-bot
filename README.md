# telegram-fx-bot

Visa / Mastercard 卡組織匯率查詢 Telegram Bot，部署於 Vercel Serverless。

在群組中發送命令即可查詢匯率、試算海外消費實際扣款。

## 相關專案

同一個匯率邏輯有兩種部署形態，各自獨立：

| 專案 | 形態 | 觸發方式 |
|---|---|---|
| **本專案** `telegram-fx-bot` | Vercel Serverless | 斜線命令 `/visa` `/mc` |
| `telebox-fx-plugins` | TeleBox 插件 | 訊息前綴 `.visa` `.mc` |

兩者共用同一套參數解析、換算策略與輸出格式，差異僅在執行平台與觸發方式。

## 命令

```
/visa <來源幣別> <目標幣別> <金額> [手續費%]
/mc   <來源幣別> <目標幣別> <金額> [手續費%]
```

| 指令 | 說明 |
|---|---|
| `/visa CNY TWD 100 1` | 消費 100 人民幣、FTF 1%，會扣多少台幣 |
| `/visa CNY TWD 100` | 不計手續費 |
| `/visa CNY TWD` | 純匯率查詢 |
| `/visa` | 常用幣別對 TWD 匯率總覽 |
| `/visa list 元` | 搜尋支援幣別（167 種） |
| `/visa help` | 用法說明 |
| `/visa CNY TWD --fee-rate 100 479.44` | 已知消費 100 人民幣、實際扣款 479.44 台幣，反推銀行手續費 |

`/mc` 用法完全相同。幣別與金額順序可互換，支援中文別名（`美金`、`日幣`、`台幣`…）。

選項：

- `-f, --fee <百分比>` — 銀行手續費 FTF（預設不計）
- `-d, --date <YYYY-MM-DD>` — 指定交易日期（限過去 12 個月，亦接受 `MM/DD/YYYY`）
- `--fee-rate, -fr` — FTF 反推模式

### FTF 反推

卡組織端點只提供結算匯率，不含發卡行的海外交易手續費（FTF）。
若已知消費金額與帳單實際扣款，可用 `--fee-rate` 反推該筆交易的有效手續費：

```
/visa CNY TWD --fee-rate <消費金額> <實際扣款>
```

計算方式為 `(實際扣款 ÷ 卡組織換算金額 − 1) × 100%`，
其中卡組織換算金額以純匯率（不帶手續費）求得。
反推結果包含銀行手續費、現金預借費等所有匯率附加成本。

## 部署

### 1. 建立 Bot

向 [@BotFather](https://t.me/BotFather) 發送 `/newbot`，取得 token。

### 2. 部署到 Vercel

```bash
npm install
npx vercel --prod
```

或連接 Git 倉庫由 Vercel 自動部署。

> **`tsconfig.json` 的 `rewriteRelativeImportExtensions` 不可移除。**
> 原始碼以 `.ts` 副檔名互相匯入，而 Vercel 建置時會把檔案改名為 `.js`。
> 該選項讓建置產物同步把匯入改寫為 `.js`；移除後部署會成功，但執行時
> 拋出 `ERR_MODULE_NOT_FOUND`（找不到 `handler.ts`）。

### 3. 設定環境變數

在 Vercel 專案設定 → Environment Variables 加入：

| 變數 | 必填 | 說明 |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ✅ | BotFather 給的 token |
| `TELEGRAM_WEBHOOK_SECRET` | 建議 | 隨機字串，用於驗證 webhook 來源 |
| `ALLOWED_CHAT_IDS` | 選填 | 群組白名單，逗號分隔；留空則不限 |

### 4. 註冊 Webhook

```bash
cp .env.example .env   # 填入 token 與 secret
node scripts/set-webhook.mjs set https://your-app.vercel.app/api/webhook
node scripts/set-webhook.mjs info    # 確認狀態
```

### 5. 使用

在群組中：

```
/visa CNY TWD 100 1
```

或在群組中需指名 bot（多 bot 並存時）：

```
/visa@YourBotName CNY TWD 100 1
```

## 隱私設定

Bot 預設只能收到提及它的訊息。若要接收群組中所有命令，
需向 @BotFather 關閉 privacy mode：

```
/setprivacy → 選擇 bot → Disable
```

## 輸出範例

```
💳 Visa 卡組織匯率
/visa CNY TWD 100 1

消費金額 100.00 CNY
卡組織換算 474.69 TWD
銀行手續費 1% 4.75 TWD
────────────────
實際扣款 479.44 TWD

匯率 1 CNY = 4.7469 TWD
反向 1 TWD = 0.210663 CNY
含手續費 1 CNY = 4.7944 TWD

📅 交易日期 2026-09-21 ｜ 匯率日期 2026-09-21
🏦 CNY 中國人民幣 → TWD 新台幣

Visa 卡組織結算匯率，僅供參考；實際請款金額依發卡行作業與帳單為準。
```

頂部的 `/visa CNY TWD 100 1` 可點擊複製，方便改參數重查。

## 技術要點

**Mastercard 端點必須用 Node 原生 `fetch`。** 該端點由 Akamai 防護，以 TLS 指紋識別客戶端——
實測 `curl` 與 `axios` 皆被 403 拒絕，只有 undici 可通過。改用其他 HTTP 客戶端會全部失敗。

**Visa 需多域名容錯。** 各地區站點共用同一後端，但 Cloudflare 防護各自獨立。
Vercel 出口 IP 會被部分域名攔截，因此依序嘗試 6 個域名直到成功。

**Mastercard 的手續費由端點計算。** 帶入 `bank_fee` 後回傳的 `conversionRate` 已含手續費。
Visa 則回傳純匯率，手續費於本地計算。兩者最終顯示一致。

**無狀態設計。** Vercel Function 每次請求獨立，不做跨請求快取。
匯率本身按日更新，且 Telegram 訊息頻率低，實務上不構成負擔。

## 開發

```bash
npm run smoke              # 核心邏輯測試（17 項，不需網路）
npm run smoke -- --live    # 含真實端點查詢（20 項）

node --experimental-strip-types scripts/webhook-test.ts   # webhook 邏輯（13 項）
node --experimental-strip-types scripts/local-server.ts   # 本地 HTTP 伺服器
```

## 授權

MIT
