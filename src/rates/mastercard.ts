/**
 * Mastercard 卡組織匯率查詢。
 *
 * 端點與參數取自官方前端 bundle（_currency-converter.js 的 displayConvertedAmount）：
 *   exchange_date, transaction_currency, cardholder_billing_currency,
 *   bank_fee, transaction_amount
 * 回應欄位：
 *   conversionRate, crdhldBillAmt, crdhldBillCurr, fxDate, transAmt, transCurr
 *
 * 重要：端點由 Akamai 防護，會以 TLS 指紋識別客戶端。實測 curl 與 axios 皆被
 *   403 拒絕，只有 Node 原生 fetch（undici）可通過。故本模組一律使用全域 fetch，
 *   不可改用 axios 或其他 HTTP 客戶端。
 *
 * 已驗證的兩項性質（用於與 Visa 採同一套換算策略）：
 *   1. conversionRate 與 transaction_amount 無關，故固定以 1 查詢單位匯率
 *   2. 帶入 bank_fee 後回傳的匯率恰為 baseRate * (1 + fee/100)
 */

import { RateError, type RateQuote } from './types.ts';

const MC_ORIGIN = 'https://www.mastercard.com';
const MC_API_BASE = `${MC_ORIGIN}/marketingservices/public/mccom-services/currency-conversions`;

const REQUEST_TIMEOUT_MS = 12_000;

type McConversionResponse = {
  data?: {
    conversionRate?: string;
    crdhldBillCurr?: string;
    fxDate?: string;
    transCurr?: string;
    errorMessage?: string;
  };
};

function buildHeaders(): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    Referer: `${MC_ORIGIN}/tw/zh/personal/get-support/currency-exchange-rate-converter.html`,
    Origin: MC_ORIGIN,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  };
}

/** 查詢 Mastercard 卡組織匯率 */
export async function fetchMastercardRate(params: {
  from: string;
  to: string;
  dateKey: string;
  fee: number;
}): Promise<RateQuote> {
  const { from, to, dateKey, fee } = params;

  if (from === to) {
    return { network: 'mastercard', from, to, rate: 1, fxDate: dateKey };
  }

  const query = new URLSearchParams({
    exchange_date: dateKey,
    transaction_currency: from,
    cardholder_billing_currency: to,
    bank_fee: String(fee),
    // 固定以 1 取單位匯率，金額換算於本地完成
    transaction_amount: '1',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let status: number;
  let body: McConversionResponse;
  try {
    const response = await fetch(`${MC_API_BASE}/conversion-rates?${query.toString()}`, {
      method: 'GET',
      headers: buildHeaders(),
      signal: controller.signal,
    });
    status = response.status;
    const text = await response.text();
    try {
      body = JSON.parse(text) as McConversionResponse;
    } catch {
      body = { data: { errorMessage: text.slice(0, 120) } };
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RateError('請求 Mastercard 端點逾時，請稍後再試');
    }
    throw new RateError('無法連線 Mastercard 端點，請稍後再試');
  } finally {
    clearTimeout(timer);
  }

  const values = body?.data;
  if (status !== 200 || !values || values.errorMessage) {
    if (status === 403) {
      throw new RateError('Mastercard 端點拒絕請求（Akamai 防護），請稍後再試');
    }
    throw new RateError(values?.errorMessage || `Mastercard 端點回應 HTTP ${status}`);
  }

  const rate = Number(values.conversionRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RateError('Mastercard 回應缺少有效匯率');
  }

  return {
    network: 'mastercard',
    from,
    to,
    rate,
    fxDate: values.fxDate || dateKey,
  };
}
