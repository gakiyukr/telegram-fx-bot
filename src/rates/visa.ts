/**
 * Visa 卡組織匯率查詢。
 *
 * 端點語意（已對官方前端 bundle 與實際回應驗證）：
 *   請求的 fromCurr 實際代表「兌換後」幣別、toCurr 代表「兌換前」幣別，與直覺相反；
 *   回應 originalValues.fromCurrency 才是「兌換前」幣別，其 fxRateVisa 表示
 *   1 單位 fromCurrency 可兌換的 toCurrency 數量。
 *   故查詢「1 <src> = ? <dst>」時須傳 fromCurr=<dst>、toCurr=<src>。
 *
 * 各地區站點共用同一組後端，匯率資料一致，但 Cloudflare 防護各自獨立，
 * 部分出口 IP（含 Vercel）會被特定域名攔截，因此依序嘗試多個域名。
 */

import { RateError, type RateQuote } from './types.ts';
import { toVisaApiDate } from './dates.ts';

/**
 * 依序嘗試的域名。
 * 實測 Vercel 與部分 VPS 出口 IP 下 .com.tw 會被攔，而 .cn / .com.br 可通過。
 */
const VISA_HOSTS = [
  'www.visa.com.tw',
  'www.visa.cn',
  'www.visa.com.br',
  'www.visa.co.jp',
  'www.visa.com.hk',
  'usa.visa.com',
];

const REQUEST_TIMEOUT_MS = 12_000;

type VisaRateResponse = {
  originalValues?: {
    fromCurrency?: string;
    toCurrency?: string;
    asOfDate?: number;
    fxRateVisa?: string;
  };
  status?: string;
};

function buildHeaders(host: string): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    Referer: `https://${host}/support/consumer/travel-support/exchange-rate-calculator.html`,
    Origin: `https://${host}`,
  };
}

/** 依序嘗試各域名，回傳第一個成功的回應 */
async function requestWithFailover(
  from: string,
  to: string,
  dateKey: string
): Promise<VisaRateResponse> {
  const apiDate = toVisaApiDate(dateKey);
  const query = new URLSearchParams({
    amount: '1',
    fee: '0',
    utcConvertedDate: apiDate,
    exchangedate: apiDate,
    // 端點的 from/to 與直覺相反，傳反向以取得「1 from = ? to」
    fromCurr: to,
    toCurr: from,
  });

  let lastStatus: number | undefined;

  for (const host of VISA_HOSTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `https://${host}/cmsapi/fx/rates?${query.toString()}`,
        { headers: buildHeaders(host), signal: controller.signal }
      );
      const text = await response.text();

      if (!response.ok) {
        lastStatus = response.status;
        // 403/429 是該域名的封鎖，換域名可能有效；其他狀態直接放棄
        if (response.status !== 403 && response.status !== 429) {
          throw new RateError(`Visa 端點回應 HTTP ${response.status}`);
        }
        continue;
      }

      let parsed: VisaRateResponse;
      try {
        parsed = JSON.parse(text) as VisaRateResponse;
      } catch {
        continue;
      }

      const values = parsed?.originalValues;
      const rate = Number(values?.fxRateVisa);
      if (values && Number.isFinite(rate) && rate > 0) return parsed;
    } catch (error) {
      if (error instanceof RateError) throw error;
      // 網路錯誤或逾時：換下一個域名
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastStatus === 403 || lastStatus === 429) {
    throw new RateError('Visa 端點暫時拒絕請求（Cloudflare 限制），請稍後再試');
  }
  throw new RateError('無法連線 Visa 端點，請稍後再試');
}

/** 查詢 Visa 卡組織匯率 */
export async function fetchVisaRate(params: {
  from: string;
  to: string;
  dateKey: string;
}): Promise<RateQuote> {
  const { from, to, dateKey } = params;

  if (from === to) {
    return { network: 'visa', from, to, rate: 1, fxDate: dateKey };
  }

  const data = await requestWithFailover(from, to, dateKey);
  const values = data.originalValues;
  const rate = Number(values?.fxRateVisa);

  if (!values || !Number.isFinite(rate) || rate <= 0) {
    throw new RateError('Visa 回應缺少有效匯率');
  }

  return {
    network: 'visa',
    from,
    to,
    rate,
    // 官方以 Unix 秒回傳匯率基準日
    fxDate: values.asOfDate
      ? new Date(values.asOfDate * 1000).toISOString().slice(0, 10)
      : dateKey,
  };
}
