/**
 * 命令處理核心。
 *
 * 平台無關：輸入命令與參數，輸出要回覆的訊息文字。
 * Vercel webhook 與本機 smoke test 共用此模組。
 */

import { parseArgs, type ParsedArgs } from './args.ts';
import { resolveDateKey } from './dates.ts';
import { fetchVisaRate } from './visa.ts';
import { fetchMastercardRate } from './mastercard.ts';
import {
  buildCommandLine,
  buildCurrencyList,
  buildHelp,
  buildOverviewReport,
  buildRateReport,
  buildFeeRateReport,
  escapeHtml,
  localCurrencyList,
} from './format.ts';
import type { RateQuote } from './types.ts';

/** 支援的命令 → 卡組織 */
const COMMANDS: Record<string, { network: 'visa' | 'mastercard'; label: string }> = {
  visa: { network: 'visa', label: 'Visa' },
  mc: { network: 'mastercard', label: 'Mastercard' },
  mastercard: { network: 'mastercard', label: 'Mastercard' },
};

/** 總覽查詢的幣別（皆以 TWD 為目標） */
const OVERVIEW_CURRENCIES = ['USD', 'JPY', 'EUR', 'CNY'];

/** 預設不套用銀行手續費；FTF 依發卡行而異，不代使用者假設 */
const DEFAULT_FEE_PERCENT = 0;

export function isSupportedCommand(command: string): boolean {
  return command in COMMANDS;
}

async function fetchRate(
  network: 'visa' | 'mastercard',
  params: { from: string; to: string; dateKey: string; fee: number }
): Promise<RateQuote> {
  if (network === 'visa') {
    // Visa 端點本身不計手續費，換算於本地完成
    return fetchVisaRate({ from: params.from, to: params.to, dateKey: params.dateKey });
  }
  return fetchMastercardRate(params);
}

// 計算有效 FTF（銀行手續費）%：已知消費金額、純匯率、實際扣款
async function handleFeeRateCalculation(
  command: string,
  network: 'visa' | 'mastercard',
  parsed: ParsedArgs
): Promise<string> {
  // 語法：/${command} 消費幣 扣費幣 --fee-rate 消費金額 實際扣款
  const from = parsed.from!;
  const to = parsed.to!;
  const spendAmount = parsed.amount!;
  // 反推模式下 fee 欄位承載「實際扣款金額」（parseArgs 已保證存在且 > 0）
  const actualCharged = parsed.fee!;

  const dateResult = resolveDateKey(parsed.dateKey, COMMANDS[command].label);
  if ('error' in dateResult) {
    return `❌ ${escapeHtml(dateResult.error)}`;
  }
  const { dateKey } = dateResult;

  // 反推必須以純匯率為基準：
  //   Visa 端點本身只回純匯率；Mastercard 則帶 bank_fee=0 查詢
  const pureQuote =
    network === 'visa'
      ? await fetchVisaRate({ from, to, dateKey })
      : await fetchMastercardRate({ from, to, dateKey, fee: 0 });

  const expectedWithoutFee = spendAmount * pureQuote.rate;
  if (expectedWithoutFee <= 0) {
    throw new Error('無法計算 FTF：匯率或金額異常');
  }

  // actual = expected * (1 + fee/100) → fee = (actual / expected - 1) * 100
  const effectiveFeePercent = (actualCharged / expectedWithoutFee - 1) * 100;

  // 浮點誤差可能讓等值輸入得到 -1e-15 這類極小負值，需視為 0 而非錯誤
  if (effectiveFeePercent < -1e-6) {
    throw new Error(
      `實際扣款 (${actualCharged.toFixed(2)} ${to}) 少於卡組織換算金額 ` +
      `(${expectedWithoutFee.toFixed(2)} ${to})，無法反推手續費`
    );
  }

  return buildFeeRateReport({
    from,
    to,
    spendAmount,
    expectedWithoutFee,
    actualCharged,
    effectiveFeePercent: Math.max(0, effectiveFeePercent),
    requestedDate: dateKey,
    command: buildCommandLine(command, {
      from,
      to,
      amount: spendAmount,
      fee: actualCharged,
      dateKey: parsed.dateKey ? dateKey : undefined,
    }),
  });
}

async function handleQuery(
  command: string,
  network: 'visa' | 'mastercard',
  parsed: ParsedArgs
): Promise<string> {
  const from = parsed.from ?? 'USD';
  const to = parsed.to ?? 'TWD';
  const amountSpecified = parsed.amount !== undefined;
  const amount = parsed.amount ?? 1;

  const dateResult = resolveDateKey(parsed.dateKey, COMMANDS[command].label);
  if ('error' in dateResult) {
    return `❌ ${escapeHtml(dateResult.error)}`;
  }
  const { dateKey } = dateResult;

  const feePercent = amountSpecified
    ? parsed.fee === undefined
      ? DEFAULT_FEE_PERCENT
      : parsed.fee
    : 0;

  const quote = await fetchRate(network, { from, to, dateKey, fee: feePercent });

  return buildRateReport({
    quote,
    amount,
    feePercent,
    requestedDate: dateKey,
    amountSpecified,
    command: buildCommandLine(command, {
      from,
      to,
      amount: amountSpecified ? amount : undefined,
      fee: amountSpecified ? feePercent : undefined,
      dateKey: parsed.dateKey ? dateKey : undefined,
    }),
  });
}

async function handleOverview(
  command: string,
  network: 'visa' | 'mastercard',
  parsed: ParsedArgs
): Promise<string> {
  const dateResult = resolveDateKey(parsed.dateKey, COMMANDS[command].label);
  if ('error' in dateResult) {
    return `❌ ${escapeHtml(dateResult.error)}`;
  }
  const { dateKey } = dateResult;

  const feePercent = parsed.fee === undefined ? DEFAULT_FEE_PERCENT : parsed.fee;

  const quotes: RateQuote[] = [];
  const failures: string[] = [];

  for (const currency of OVERVIEW_CURRENCIES) {
    try {
      quotes.push(
        await fetchRate(network, { from: currency, to: 'TWD', dateKey, fee: feePercent })
      );
    } catch (error) {
      failures.push(`${currency}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (quotes.length === 0) {
    return `❌ <b>查詢失敗</b>\n\n${escapeHtml(failures[0] || '無法取得任何匯率')}`;
  }

  return buildOverviewReport({
    quotes,
    feePercent,
    failures,
    network,
    command: buildCommandLine(command, {
      fee: feePercent > 0 ? feePercent : undefined,
      dateKey: parsed.dateKey ? dateKey : undefined,
    }),
  });
}

/**
 * 處理單一命令，回傳要送出的訊息文字。
 * 任何錯誤都轉為可讀訊息，不讓例外逸出到 webhook。
 */
export async function handleCommand(command: string, tokens: string[]): Promise<string | null> {
  const entry = COMMANDS[command];
  if (!entry) return null;

  const parsed = parseArgs(tokens);

  if (parsed.help) return buildHelp(command);

  if (parsed.list) {
    return buildCurrencyList(localCurrencyList(), parsed.listQuery);
  }

  if (parsed.errors.length > 0) {
    return (
      `❌ ${parsed.errors.map(escapeHtml).join('\n❌ ')}\n\n` +
      `💡 使用 <code>/${command} help</code> 查看用法`
    );
  }

  const hasQuery = parsed.from !== undefined || parsed.amount !== undefined;

  try {
    // FTF 反推模式：需兩個幣別且帶 --fee-rate 選項
    if (parsed.feeRateCalculation && parsed.from && parsed.to) {
      return await handleFeeRateCalculation(command, entry.network, parsed);
    }
    
    return hasQuery
      ? await handleQuery(command, entry.network, parsed)
      : await handleOverview(command, entry.network, parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `❌ <b>查詢失敗</b>\n\n${escapeHtml(message)}`;
  }
}
