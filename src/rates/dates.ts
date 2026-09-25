/**
 * 日期解析與格式化。
 *
 * 內部一律以 YYYY-MM-DD 表示；各端點所需格式由各自的請求模組轉換。
 * 同時接受 YYYY-MM-DD 與 MM/DD/YYYY 輸入，與 TeleBox 插件行為一致。
 */

/** 產生 YYYY-MM-DD（本地時區） */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Visa 端點要求 MM/DD/YYYY */
export function toVisaApiDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

/** 解析 YYYY-MM-DD 或 MM/DD/YYYY，回傳當地時間零點的 Date */
export function parseFlexibleDate(value: string): Date | null {
  const trimmed = value.trim();
  let year: number;
  let month: number;
  let day: number;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (!slash) return null;
    month = Number(slash[1]);
    day = Number(slash[2]);
    year = Number(slash[3]);
  }

  const date = new Date(year, month - 1, day);
  // 擋掉 02/31 這類會被 Date 自動進位的日期
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** 官方僅提供過去 12 個月的歷史匯率 */
export const MAX_HISTORY_DAYS = 365;

/**
 * 驗證並正規化使用者指定的交易日期。
 * 未指定時回傳今日；超出允許範圍時回傳錯誤訊息。
 */
export function resolveDateKey(
  raw: string | undefined,
  networkLabel: string
): { dateKey: string } | { error: string } {
  if (!raw) return { dateKey: toIsoDate(new Date()) };

  const parsed = parseFlexibleDate(raw);
  if (!parsed) {
    return { error: '日期格式需為 YYYY-MM-DD，例如 2026-09-15' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - parsed.getTime()) / 86400000);
  if (diff < 0) return { error: '查詢日期不可晚於今天' };
  if (diff > MAX_HISTORY_DAYS) {
    return { error: `${networkLabel} 僅提供過去 12 個月內的匯率` };
  }

  return { dateKey: toIsoDate(parsed) };
}
