/**
 * 命令參數解析。
 *
 * 與 TeleBox 的 visa / mc 插件共用同一套語法：
 *   <來源幣別> <目標幣別> [金額] [手續費%]
 * 幣別與數字各自依出現順序配對，與先後位置無關，
 * 因此 `<金額> <來源> <目標>` 亦可解析。
 */

import { normalizeCurrency } from './currencies.ts';

export type ParsedArgs = {
  from?: string;
  to?: string;
  amount?: number;
  fee?: number;
  dateKey?: string;
  list: boolean;
  listQuery?: string;
  help: boolean;
  feeRateCalculation: boolean; // 新增：FTF 反推模式 (--fee-rate 選項)
  errors: string[];
};

export function parseArgs(tokens: string[]): ParsedArgs {
  const parsed: ParsedArgs = { list: false, help: false, feeRateCalculation: false, errors: [] };
  const positional: string[] = [];
  const listTerms: string[] = [];
  const currencies: string[] = [];
  const numbers: number[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.startsWith('-')) {
      const raw = token.replace(/^--?/, '');
      const eqIndex = raw.indexOf('=');
      const key = (eqIndex >= 0 ? raw.slice(0, eqIndex) : raw).toLowerCase();
      const inlineValue = eqIndex >= 0 ? raw.slice(eqIndex + 1) : undefined;

      const takeValue = (): string | undefined => {
        if (inlineValue !== undefined) return inlineValue;
        const next = tokens[i + 1];
        if (next === undefined || next.startsWith('-')) return undefined;
        i += 1;
        return next;
      };

      if (key === 'fee' || key === 'f') {
        const value = takeValue();
        const num = value === undefined ? NaN : Number(value);
        if (!Number.isFinite(num) || num < 0 || num > 100) {
          parsed.errors.push('手續費需為 0 到 100 之間的數字');
        } else {
          parsed.fee = num;
        }
        continue;
      }

      if (key === 'date' || key === 'd') {
        const value = takeValue();
        if (!value) {
          parsed.errors.push('缺少日期值，格式為 YYYY-MM-DD');
        } else {
          parsed.dateKey = value;
        }
        continue;
      }

      if (key === 'list' || key === 'l') {
        parsed.list = true;
        continue;
      }

      if (key === 'help' || key === 'h') {
        parsed.help = true;
        continue;
      }

      if (key === 'fee-rate' || key === 'fr') {
        parsed.feeRateCalculation = true;
        continue;
      }

      parsed.errors.push(`未知選項 ${token}`);
      continue;
    }

    positional.push(token);
  }

  for (const token of positional) {
    const sub = token.toLowerCase();
    if (sub === 'list' || sub === 'ls') {
      parsed.list = true;
      continue;
    }
    if (sub === 'help' || sub === 'h') {
      parsed.help = true;
      continue;
    }

    if (parsed.list) {
      listTerms.push(token);
      continue;
    }

    // 純數字（可含小數與千分位逗號）依出現順序收集
    const numeric = token.replace(/,/g, '');
    if (/^\d+(\.\d+)?$/.test(numeric)) {
      numbers.push(Number(numeric));
      continue;
    }

    const currency = normalizeCurrency(token);
    if (!currency) {
      parsed.errors.push(`無法識別幣別「${token}」`);
      continue;
    }
    currencies.push(currency);
  }

  if (parsed.list) {
    parsed.listQuery = listTerms.join(' ') || undefined;
    parsed.errors = [];
    return parsed;
  }

  if (currencies.length > 0) parsed.from = currencies[0];
  if (currencies.length > 1) parsed.to = currencies[1];
  if (currencies.length > 2) {
    parsed.errors.push('最多只能指定兩個幣別');
  }

  // FTF 反推模式：參數順序為 [消費幣，扣費幣，消費金額，實際扣款]
  if (parsed.feeRateCalculation) {
    if (!parsed.from || !parsed.to) {
      parsed.errors.push('FTF 反推需指定消費幣別與扣費幣別');
    }
    if (numbers.length < 2) {
      parsed.errors.push('FTF 反推需指定消費金額與實際扣款金額');
    } else {
      parsed.amount = numbers[0];
      parsed.fee = numbers[1];
      
      if (numbers[0] <= 0) {
        parsed.errors.push('消費金額需大於 0');
      }
      if (numbers[1] <= 0) {
        parsed.errors.push('實際扣款金額需大於 0');
      }
    }
    
    if (numbers.length > 2) {
      parsed.errors.push('FTF 反推只需要兩個數字：消費金額與實際扣款');
    }
  } else {
    // 正常模式：參數順序為 [幣別 A, 幣別 B, [金額], [手續費%]]
    if (numbers.length > 0) {
      if (numbers[0] <= 0) {
        parsed.errors.push('金額需大於 0');
      } else {
        parsed.amount = numbers[0];
      }
    }
    if (numbers.length > 1) {
      const feeValue = numbers[1];
      if (parsed.fee !== undefined) {
        parsed.errors.push('手續費已由 --fee 指定，請勿重複設定');
      } else if (!Number.isFinite(feeValue) || feeValue < 0 || feeValue > 100) {
        parsed.errors.push('手續費需為 0 到 100 之間的數字');
      } else {
        parsed.fee = feeValue;
      }
    }
    if (numbers.length > 2) {
      parsed.errors.push('數字參數最多兩個：金額與手續費百分比');
    }
  }

  return parsed;
}

/** 拆出命令與參數：支援 "/visa CNY TWD 100 1" 與 "/visa@Bot CNY TWD" */
export function parseCommandLine(text: string, botUsername?: string): {
  command: string;
  tokens: string[];
} | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;

  const parts = trimmed.split(/\s+/);
  const head = parts[0].slice(1);
  const atIndex = head.indexOf('@');

  let command = head;
  if (atIndex >= 0) {
    const mentioned = head.slice(atIndex + 1);
    command = head.slice(0, atIndex);
    // 群組中可能有多個 bot，只回應指名自己的或未指名的
    if (botUsername && mentioned.toLowerCase() !== botUsername.toLowerCase()) {
      return null;
    }
  }

  return { command: command.toLowerCase(), tokens: parts.slice(1) };
}
