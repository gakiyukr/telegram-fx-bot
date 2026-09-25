/**
 * 訊息格式化。
 *
 * 輸出格式與 TeleBox 的 visa / mc 插件保持一致：頂部為可點擊複製的完整命令，
 * 接著是金額試算、匯率、日期與幣別名稱。
 *
 * 使用 Telegram HTML parse mode，所有動態文字皆經 escapeHtml 處理。
 */

import { currencyLabel, CURRENCY_NAMES } from './currencies.ts';
import type { RateQuote } from './types.ts';

/** 金額顯示為整數的幣別（ISO 4217 小數位為 0） */
const ZERO_DECIMAL_CURRENCIES: Record<string, true> = {
  BIF: true, CLP: true, DJF: true, GNF: true, ISK: true, JPY: true,
  KMF: true, KRW: true, PYG: true, RWF: true, UGX: true, VND: true,
  VUV: true, XAF: true, XOF: true, XPF: true,
};

/** Telegram HTML parse mode 的轉義；使用者輸入必須先過此函式 */
export function escapeHtml(text: string | number | unknown): string {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[&<>"']/g, (m) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
    };
    return map[m] || m;
  });
}

function formatAmount(value: number, currency: string): string {
  const digits = ZERO_DECIMAL_CURRENCIES[currency] ? 0 : 2;
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 依數量級選擇有效位數，避免小幣值匯率被截成 0 */
function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '-';
  if (rate >= 1000) return rate.toFixed(2);
  if (rate >= 1) return rate.toFixed(4);
  if (rate >= 0.01) return rate.toFixed(6);
  return rate.toPrecision(6);
}

/**
 * 產生可供複製的命令字串。
 * 一律輸出正規化後的完整形式（含前綴、補齊預設參數）。
 */
export function buildCommandLine(
  command: string,
  parts: { from?: string; to?: string; amount?: number; fee?: number; dateKey?: string }
): string {
  const tokens: string[] = [`/${command}`];
  if (parts.from) tokens.push(parts.from);
  if (parts.to) tokens.push(parts.to);
  if (parts.amount !== undefined) tokens.push(String(parts.amount));
  if (parts.fee !== undefined && parts.fee > 0) tokens.push(String(parts.fee));
  if (parts.dateKey) tokens.push('-d', parts.dateKey);
  return tokens.join(' ');
}

const NETWORK_LABEL: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
};

function networkName(network: string): string {
  return NETWORK_LABEL[network] || network;
}

export function buildRateReport(params: {
  quote: RateQuote;
  amount: number;
  feePercent: number;
  requestedDate: string;
  amountSpecified: boolean;
  command: string;
}): string {
  const { quote, amount, feePercent, requestedDate, amountSpecified, command } = params;
  const label = networkName(quote.network);

  const lines: string[] = [];
  lines.push(`💳 <b>${label} 卡組織匯率</b>`);
  lines.push(`<code>${escapeHtml(command)}</code>`);
  lines.push('');

  if (!amountSpecified) {
    lines.push(`<b>1 ${quote.from}</b> = <b>${formatRate(quote.rate)} ${quote.to}</b>`);
    lines.push(
      `反向 <code>1 ${quote.to} = ${formatRate(1 / quote.rate)} ${quote.from}</code>`
    );
  } else {
    const converted = amount * quote.rate;
    lines.push(`消費金額 <b>${formatAmount(amount, quote.from)} ${quote.from}</b>`);
    lines.push(`卡組織換算 <b>${formatAmount(converted, quote.to)} ${quote.to}</b>`);

    if (feePercent > 0) {
      // 銀行手續費以卡組織換算後的目標幣別金額為基準計算
      const feeAmount = (converted * feePercent) / 100;
      lines.push(
        `銀行手續費 ${feePercent}% <b>${formatAmount(feeAmount, quote.to)} ${quote.to}</b>`
      );
      lines.push('────────────────');
      lines.push(
        `實際扣款 <b>${formatAmount(converted + feeAmount, quote.to)} ${quote.to}</b>`
      );
    }

    lines.push('');
    lines.push(`匯率 <code>1 ${quote.from} = ${formatRate(quote.rate)} ${quote.to}</code>`);
    lines.push(
      `反向 <code>1 ${quote.to} = ${formatRate(1 / quote.rate)} ${quote.from}</code>`
    );
    if (feePercent > 0) {
      lines.push(
        `含手續費 <code>1 ${quote.from} = ${formatRate(
          quote.rate * (1 + feePercent / 100)
        )} ${quote.to}</code>`
      );
    }
  }

  lines.push('');
  lines.push(
    `📅 交易日期 <code>${escapeHtml(requestedDate)}</code> ｜ 匯率日期 <code>${escapeHtml(quote.fxDate)}</code>`
  );
  lines.push(`🏦 ${currencyLabel(quote.from)} → ${currencyLabel(quote.to)}`);
  lines.push('');
  lines.push(
    `<i>${label} 卡組織結算匯率，僅供參考；實際請款金額依發卡行作業與帳單為準。</i>`
  );

  return lines.join('\n');
}

export function buildFeeRateReport(params: {
  from: string;
  to: string;
  spendAmount: number;
  expectedWithoutFee: number;
  actualCharged: number;
  effectiveFeePercent: number;
  requestedDate: string;
  command: string;
}): string {
  const { from, to, spendAmount, expectedWithoutFee, actualCharged, effectiveFeePercent, requestedDate, command } = params;

  const lines: string[] = [];
  lines.push(`🔍 <b>FTF 手續費反推</b>`);
  lines.push(`<code>${escapeHtml(command)}</code>`);
  lines.push('');
  lines.push(`消費金額 <b>${formatAmount(spendAmount, from)} ${from}</b>`);
  lines.push(`卡組織純匯率 1 ${from} = ${formatRate(expectedWithoutFee / spendAmount)} ${to}`);
  lines.push(`不含 FTF 應得 <b>${formatAmount(expectedWithoutFee, to)} ${to}</b>`);
  lines.push(`實際扣款 <b>${formatAmount(actualCharged, to)} ${to}</b>`);
  lines.push('');
  lines.push('────────────────');
  lines.push(`<b>反推 FTF 手续费 ${effectiveFeePercent.toFixed(2)}%</b>`);
  lines.push('');
  lines.push(`📅 交易日期 <code>${escapeHtml(requestedDate)}</code>`);
  lines.push(`🏦 ${currencyLabel(from)} → ${currencyLabel(to)}`);
  lines.push('');
  lines.push(`<i>註：此 FTF 為透過實際扣款反推之「有效匯率附加費用」，含銀行手續費、現金預借費等所有附加成本。</i>`);

  return lines.join('\n');
}

export function buildOverviewReport(params: {
  quotes: RateQuote[];
  feePercent: number;
  failures: string[];
  command: string;
  network: string;
}): string {
  const { quotes, feePercent, failures, command, network } = params;
  const label = networkName(network);

  const lines: string[] = [];
  lines.push(`💳 <b>${label} 卡組織匯率總覽</b>`);
  lines.push(`<code>${escapeHtml(command)}</code>`);
  lines.push('');

  for (const quote of quotes) {
    const base = `• <b>1 ${quote.from}</b> = <b>${formatRate(quote.rate)} ${quote.to}</b>`;
    lines.push(feePercent > 0 ? `${base} <i>(含 ${feePercent}% 手續費)</i>` : base);
  }

  if (failures.length > 0) {
    lines.push('');
    lines.push(`⚠️ ${failures.map(escapeHtml).join('；')}`);
  }

  lines.push('');
  lines.push(`<i>資料來源：${label} 官方。</i>`);

  return lines.join('\n');
}

export function buildCurrencyList(
  all: Array<{ code: string; name: string }>,
  query?: string
): string {
  const keyword = query?.trim();
  const matched = keyword
    ? all.filter(
        (c) =>
          c.code.includes(keyword.toUpperCase()) ||
          c.name.toUpperCase().includes(keyword.toUpperCase())
      )
    : all;

  if (matched.length === 0) {
    return `❌ 找不到符合「${escapeHtml(query)}」的幣別`;
  }

  const lines: string[] = [];
  lines.push(`💱 <b>支援幣別</b>（${matched.length}/${all.length}）`);
  lines.push('');
  lines.push(
    matched.map((c) => `<code>${c.code}</code> ${escapeHtml(c.name)}`).join(' ｜ ')
  );

  return lines.join('\n');
}

/** 本地幣別表轉為清單格式（供 /list 使用，不耗用端點請求） */
export function localCurrencyList(): Array<{ code: string; name: string }> {
  return Object.keys(CURRENCY_NAMES)
    .sort()
    .map((code) => ({ code, name: CURRENCY_NAMES[code] }));
}

export function buildHelp(command: string): string {
  const network = command === 'mc' ? 'Mastercard' : 'Visa';
  return `💳 <b>${network} 卡組織匯率</b>

<b>📝 功能描述:</b>
• 查詢 ${network} 官方卡組織結算匯率
• 試算海外消費的實際扣款金額（可加計銀行手續費 FTF）
• <b>反推銀行手續費</b>：已知消費金額與實際扣款，計算有效 FTF

<b>🔧 使用方法:</b>
• <code>/${command} &lt;來源幣別&gt; &lt;目標幣別&gt; &lt;金額&gt; [手續費%]</code> - 消費試算
• <code>/${command} &lt;來源幣別&gt; &lt;目標幣別&gt;</code> - 查詢單位匯率
• <code>/${command}</code> - 常用幣別對 TWD 匯率總覽
• <code>/${command} list [關鍵字]</code> - 查詢支援幣別
• <code>/${command} &lt;消費幣&gt; &lt;扣費幣&gt; --fee-rate &lt;消費金額&gt; &lt;實際扣款&gt;</code> - FTF 反推

<b>⚙️ 可選參數:</b>
• <code>-f, --fee &lt;百分比&gt;</code> - 銀行手續費 FTF（預設不計；常見 1.5%）
• <code>-d, --date &lt;YYYY-MM-DD&gt;</code> - 指定交易日期（限過去 12 個月）
• <code>--fee-rate, -fr</code> - FTF 反推模式標記

<b>💡 示例:</b>
• <code>/${command} CNY TWD 100 1</code> - 消費 100 人民幣、FTF 1%，會扣多少台幣
• <code>/${command} JPY TWD 5000 1.5</code> - 消費 5000 日圓、FTF 1.5%
• <code>/${command} CNY TWD 100</code> - 消費 100 人民幣，不計手續費
• <code>/${command} CNY TWD</code> - 人民幣兌台幣匯率
• <code>/${command} CNY TWD --fee-rate 100 479.44</code> - 消費 100 人民幣，實際扣 479.44 台幣，反推 FTF
• <code>/${command} list 元</code> - 搜尋含「元」的幣別

<b>📊 資料來源:</b>
• ${network} 官方貨幣轉換器（卡組織結算匯率）`;
}
