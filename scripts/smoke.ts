/**
 * 核心邏輯 smoke test。
 *
 * 直接呼叫命令處理器並驗證輸出，涵蓋參數解析、格式化與錯誤路徑。
 * 加上 --live 參數時會對真實端點發出請求。
 *
 * 執行：node --experimental-strip-types scripts/smoke.ts [--live]
 */

import { handleCommand, isSupportedCommand } from '../src/rates/handler.ts';
import { parseCommandLine } from '../src/rates/args.ts';
import { parseArgs } from '../src/rates/args.ts';
import { resolveDateKey, parseFlexibleDate, toVisaApiDate } from '../src/rates/dates.ts';
import { normalizeCurrency, currencyLabel } from '../src/rates/currencies.ts';
import { escapeHtml } from '../src/rates/format.ts';

const results: string[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`${label}：預期包含「${needle}」，實際：\n${haystack.slice(0, 400)}`);
  }
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '');
}

async function check(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    results.push(`✅ ${name}`);
  } catch (error) {
    results.push(`❌ ${name}\n   ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const live = process.argv.includes('--live');

  // ── 純函式測試（不需網路）──
  await check('parseCommandLine 解析基本命令', () => {
    const r = parseCommandLine('/visa CNY TWD 100 1');
    assert(r !== null, '應解析成功');
    assert(r.command === 'visa', `command 應為 visa，實際 ${r.command}`);
    assert(r.tokens.length === 4, `應有 4 個參數，實際 ${r.tokens.length}`);
  });

  await check('parseArgs 幣別與金額順序無關', () => {
    const a = parseArgs(['CNY', 'TWD', '100', '1']);
    const b = parseArgs(['100', 'CNY', 'TWD', '1']);
    assert(a.from === 'CNY' && a.to === 'TWD' && a.amount === 100 && a.fee === 1, 'A 解析錯誤');
    assert(b.from === 'CNY' && b.to === 'TWD' && b.amount === 100 && b.fee === 1, 'B 解析錯誤');
  });

  await check('parseArgs 支援中文別名', () => {
    const r = parseArgs(['美金', '日幣', '100']);
    assert(r.from === 'USD', `美金應為 USD，實際 ${r.from}`);
    assert(r.to === 'JPY', `日幣應為 JPY，實際 ${r.to}`);
  });

  await check('parseArgs 支援 --fee 與 -d', () => {
    const r = parseArgs(['CNY', 'TWD', '100', '--fee=2', '-d', '2026-09-15']);
    assert(r.fee === 2, `fee 應為 2，實際 ${r.fee}`);
    assert(r.dateKey === '2026-09-15', `dateKey 錯誤：${r.dateKey}`);
  });

  await check('parseArgs 回報錯誤', () => {
    assert(parseArgs(['XYZ1', 'TWD']).errors.length > 0, '未知幣別應報錯');
    assert(parseArgs(['CNY', 'TWD', '0']).errors.length > 0, '金額 0 應報錯');
    assert(parseArgs(['CNY', 'TWD', '1', '999']).errors.length > 0, '手續費超範圍應報錯');
    assert(parseArgs(['CNY', 'TWD', '1', '2', '3']).errors.length > 0, '過多數字應報錯');
  });

  await check('日期解析接受兩種格式', () => {
    const iso = parseFlexibleDate('2026-09-15');
    const slash = parseFlexibleDate('09/15/2026');
    assert(iso !== null && slash !== null, '兩種格式皆應解析');
    assert(iso.getTime() === slash.getTime(), '兩者應為同一天');
    assert(parseFlexibleDate('2026-02-31') === null, '不存在的日期應回 null');
    assert(toVisaApiDate('2026-09-15') === '09/15/2026', 'Visa 日期轉換錯誤');
  });

  await check('日期範圍驗證', () => {
    const today = resolveDateKey(undefined, 'Visa');
    assert('dateKey' in today, '未指定時應回今日');

    const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    assert('error' in resolveDateKey(future, 'Visa'), '未來日期應報錯');
    assert('error' in resolveDateKey('2020-01-01', 'Visa'), '超過一年應報錯');
  });

  await check('幣別工具', () => {
    assert(normalizeCurrency('usd') === 'USD', '應轉大寫');
    assert(normalizeCurrency('美金') === 'USD', '中文別名應解析');
    assert(normalizeCurrency('XYZ1') === null, '非法輸入應回 null');
    assertIncludes(currencyLabel('TWD'), '新台幣', '應含中文名');
  });

  await check('HTML 轉義', () => {
    assert(escapeHtml('<b>test</b>') === '&lt;b&gt;test&lt;/b&gt;', '應轉義標籤');
    assert(escapeHtml(null) === '', 'null 應回空字串');
  });

  await check('isSupportedCommand 判斷', () => {
    assert(isSupportedCommand('visa'), 'visa 應支援');
    assert(isSupportedCommand('mc'), 'mc 應支援');
    assert(!isSupportedCommand('unknown'), 'unknown 不應支援');
  });

  await check('help 輸出用法', async () => {
    const out = await handleCommand('visa', ['help']);
    assert(out !== null, '應有輸出');
    const plain = stripHtml(out);
    assertIncludes(plain, 'Visa 卡組織匯率', 'help 標題');
    assertIncludes(plain, '/visa list', '應提及 list');
    assertIncludes(plain, '--fee-rate', 'help 應說明 FTF 反推');
  });

  await check('list 輸出幣別清單', async () => {
    const out = await handleCommand('mc', ['list']);
    assert(out !== null, '應有輸出');
    const plain = stripHtml(out);
    assertIncludes(plain, '支援幣別', 'list 標題');
    assertIncludes(plain, 'TWD', '應含 TWD');
    assertIncludes(plain, '新台幣', '應含中文名');
  });

  await check('list 支援關鍵字過濾', async () => {
    const out = await handleCommand('visa', ['list', '新台幣']);
    assert(out !== null, '應有輸出');
    const plain = stripHtml(out);
    assertIncludes(plain, 'TWD', '應命中 TWD');
    assert(!plain.includes('AED'), '不應含無關幣別');
  });

  await check('錯誤路徑回報訊息', async () => {
    const out = await handleCommand('visa', ['XYZ1', 'TWD']);
    assert(out !== null, '應有輸出');
    assertIncludes(stripHtml(out), '無法識別幣別', '應提示無法識別');
  });

  await check('未知命令回傳 null', async () => {
    assert((await handleCommand('unknown', [])) === null, '未知命令應回 null');
  });

  // ── FTF 反推功能測試（離線，驗證解析與錯誤路徑）──
  await check('parseArgs --fee-rate 模式解析正確', () => {
    const r = parseArgs(['CNY', 'TWD', '--fee-rate', '100', '479.44']);
    assert(r.feeRateCalculation === true, `應啟用 FTF 反推，實際 ${r.feeRateCalculation}`);
    assert(r.from === 'CNY', 'from 錯誤');
    assert(r.to === 'TWD', 'to 錯誤');
    assert(r.amount === 100, `amount 錯誤：${r.amount}`);
    assert(r.fee === 479.44, `fee（實際扣款）錯誤：${r.fee}`);
    assert(r.errors.length === 0, `不應有錯誤：${r.errors.join(', ')}`);
  });

  await check('parseArgs --fee-rate 支援 -fr 簡寫', () => {
    const r = parseArgs(['CNY', 'TWD', '-fr', '100', '479.44']);
    assert(r.feeRateCalculation === true, '簡寫應同樣啟用 FTF 反推');
  });

  await check('parseArgs --fee-rate 缺少數字回報錯誤', () => {
    const r = parseArgs(['CNY', 'TWD', '--fee-rate', '100']);
    assert(r.errors.length > 0, '應回報需兩個數字');
    assertIncludes(r.errors[0], '消費金額與實際扣款金額', '應提示缺少的參數');
  });

  await check('parseArgs --fee-rate 過多數字回報錯誤', () => {
    const r = parseArgs(['CNY', 'TWD', '--fee-rate', '100', '479.44', '9']);
    assert(r.errors.length > 0, '應回報數字過多');
    assertIncludes(r.errors[0], '只需要兩個數字', '應提示數字上限');
  });

  await check('parseArgs --fee-rate 不接受 0 金額', () => {
    const r = parseArgs(['CNY', 'TWD', '--fee-rate', '0', '479.44']);
    assert(r.errors.length > 0, '消費金額 0 應報錯');
  });

  await check('parseArgs --fee-rate 不套用手續費範圍限制', () => {
    // 正常模式下 999 會因超出 0-100 而報錯；反推模式下它是實際扣款，應被接受
    const normal = parseArgs(['CNY', 'TWD', '100', '999']);
    assert(normal.errors.length > 0, '正常模式手續費超範圍應報錯');
    const reverse = parseArgs(['CNY', 'TWD', '--fee-rate', '100', '999']);
    assert(reverse.errors.length === 0, `反推模式不應報錯，實際：${reverse.errors.join(', ')}`);
    assert(reverse.fee === 999, '實際扣款應被保留');
  });

  await check('FTF 反推命令缺少幣別時回報錯誤', async () => {
    const out = await handleCommand('visa', ['--fee-rate', '100', '479.44']);
    assert(out !== null, '應有輸出');
    const plain = stripHtml(out);
    assertIncludes(plain, '消費幣別與扣費幣別', '應提示需指定兩個幣別');
    assert(!plain.includes('實際扣款'), '不應落入正常試算路徑');
  });

  await check('FTF 反推命令缺少數字時回報錯誤', async () => {
    const out = await handleCommand('visa', ['CNY', 'TWD', '--fee-rate']);
    assert(out !== null, '應有輸出');
    assertIncludes(stripHtml(out), '消費金額與實際扣款金額', '應提示缺少參數');
  });

  // ── 真實端點 ──
  if (live) {
    await check('[live] Visa FTF 反推', async () => {
      // 以純匯率推出一個含 2% 手續費的扣款，再讓命令反推，應還原約 2%
      const plainRate = stripHtml(
        (await handleCommand('visa', ['CNY', 'TWD'])) ?? ''
      );
      const match = /1 CNY = ([\d.]+) TWD/.exec(plainRate);
      assert(match !== null, `應取得純匯率，實際輸出：${plainRate.slice(0, 200)}`);
      const rate = Number(match[1]);
      const charged = (100 * rate * 1.02).toFixed(2);

      const out = await handleCommand('visa', ['CNY', 'TWD', '--fee-rate', '100', charged]);
      assert(out !== null, '應有輸出');
      const plain = stripHtml(out);
      assertIncludes(plain, 'FTF 手續費反推', '標題');
      assertIncludes(plain, '2.00%', `應反推回約 2%，實際：${plain.split('\n').find((l) => l.includes('反推 FTF'))}`);
      console.log(`   ${plain.split('\n').find((l) => l.includes('反推 FTF'))?.trim()}`);
    });

    await check('[live] Visa 匯率查詢', async () => {
      const out = await handleCommand('visa', ['CNY', 'TWD', '100', '1']);
      assert(out !== null, '應有輸出');
      const plain = stripHtml(out);
      assertIncludes(plain, 'Visa 卡組織匯率', '標題');
      assertIncludes(plain, '實際扣款', '應有扣款');
      assertIncludes(plain, '/visa CNY TWD 100 1', '應顯示命令列');
      console.log(`   ${plain.split('\n').find((l) => l.includes('實際扣款'))?.trim()}`);
    });

    await check('[live] Mastercard 匯率查詢', async () => {
      const out = await handleCommand('mc', ['CNY', 'TWD', '100', '1']);
      assert(out !== null, '應有輸出');
      const plain = stripHtml(out);
      assertIncludes(plain, 'Mastercard 卡組織匯率', '標題');
      assertIncludes(plain, '實際扣款', '應有扣款');
      assertIncludes(plain, '/mc CNY TWD 100 1', '應顯示命令列');
      console.log(`   ${plain.split('\n').find((l) => l.includes('實際扣款'))?.trim()}`);
    });

    await check('[live] 純匯率查詢不顯示扣款', async () => {
      const out = await handleCommand('visa', ['CNY', 'TWD']);
      assert(out !== null, '應有輸出');
      const plain = stripHtml(out);
      assertIncludes(plain, '1 CNY', '應顯示單位匯率');
      assert(!plain.includes('實際扣款'), '不應顯示扣款');
    });
  }

  console.log('\n=== telegram-fx-bot smoke test ===\n');
  for (const line of results) console.log(line);
  const passed = results.filter((r) => r.startsWith('✅')).length;
  console.log(`\n通過 ${passed}/${results.length}`);
}

main().catch((error) => {
  console.error('smoke test 執行失敗:', error);
  process.exitCode = 1;
});
