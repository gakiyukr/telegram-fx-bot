/**
 * 匯率查詢的共用型別。
 *
 * 三個平台（TeleBox visa 插件、mc 插件、本 Bot）共用同一組語意，
 * 差異僅在底層端點。
 */

/** 卡組織種類 */
export type CardNetwork = 'visa' | 'mastercard';

/**
 * 一次成功查詢的正規化結果。
 *
 * rate 表示 1 單位 from 可兌換的 to 數量。
 * 手續費已包含在 rate 內（由各卡組織端點計算）。
 */
export type RateQuote = {
  network: CardNetwork;
  from: string;
  to: string;
  rate: number;
  /** 匯率生效日期（YYYY-MM-DD） */
  fxDate: string;
};

/** 查詢參數 */
export type RateQuery = {
  from: string;
  to: string;
  /** 交易日期（YYYY-MM-DD），未指定時由呼叫端帶入今日 */
  dateKey: string;
  /** 銀行手續費百分比（FTF） */
  fee: number;
};

/** 查詢失敗時拋出的錯誤，帶有可讀訊息 */
export class RateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateError';
  }
}
