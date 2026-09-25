/**
 * 幣別中文名稱對照表。
 *
 * 與 TeleBox 的 visa / mc 插件共用同一組對照，確保三個平台的顯示一致。
 * 來源：Visa 台灣官方匯率計算器頁面的幣別清單。
 */
export const CURRENCY_NAMES: Record<string, string> = {
  AED: "阿聯酋迪拉姆", AFN: "阿富汗尼", ALL: "阿爾巴尼亞列克", AMD: "亞美尼亞德拉姆",
  AOA: "安哥拉寬扎", ARS: "阿根廷比索", AUD: "澳元", AWG: "阿魯巴盾",
  AZN: "阿塞拜疆馬納特", BAM: "波斯尼亞可兌換馬克", BBD: "巴巴多斯元", BDT: "孟加拉塔卡",
  BGN: "保加利亞列弗", BHD: "巴林第納爾", BIF: "布隆迪法郎", BMD: "百慕大元",
  BND: "文萊元", BOB: "玻利維亞諾", BRL: "巴西雷亞爾", BSD: "巴哈馬元",
  BTN: "不丹努爾特魯姆", BWP: "博茨瓦納普拉", BYN: "白俄羅斯盧布", BZD: "伯利茲元",
  CAD: "加元", CDF: "剛果法郎", CHF: "瑞士法郎", CLP: "智利比索",
  CNY: "中國人民幣", COP: "哥倫比亞比索", CRC: "哥斯達黎加科隆", CVE: "佛得角埃斯庫多",
  CYP: "塞浦路斯鎊", CZK: "捷克克朗", DJF: "吉布提法郎", DKK: "丹麥克朗",
  DOP: "多米尼加比索", DZD: "阿爾及利亞第納爾", EEK: "愛沙尼亞克朗", EGP: "埃及鎊",
  ERN: "厄立特里亞納夫卡", ETB: "埃塞俄比亞比爾", EUR: "歐元", FJD: "斐濟元",
  FKP: "福克蘭群島鎊", GBP: "英鎊", GEL: "格魯吉亞拉里", GHS: "加納塞地",
  GIP: "直布羅陀鎊", GMD: "岡比亞達拉西", GNF: "幾內亞法郎", GQE: "赤道幾內亞埃奎勒",
  GTQ: "危地馬拉格查爾", GWP: "幾內亞比索比索", GYD: "圭亞那元", HKD: "港元",
  HNL: "洪都拉斯倫皮拉", HRK: "克羅地亞庫納", HTG: "海地古德", HUF: "匈牙利福林",
  IDR: "印尼盾", ILS: "新以色列謝克爾", INR: "印度盧比", IQD: "伊拉克第納爾",
  IRR: "伊朗里亞爾", ISK: "冰島克朗", JMD: "牙買加元", JOD: "約旦第納爾",
  JPY: "日圓", KES: "肯尼亞先令", KGS: "吉爾吉斯斯坦索姆", KHR: "柬埔寨瑞爾",
  KMF: "科摩羅法郎", KRW: "韓元", KWD: "科威特第納爾", KYD: "開曼群島元",
  KZT: "哈薩克斯坦騰格", LAK: "老撾基普", LBP: "黎巴嫩鎊", LKR: "斯里蘭卡盧比",
  LRD: "利比里亞元", LSL: "萊索托洛蒂", LTL: "立陶宛立特", LVL: "拉脫維亞拉特",
  LYD: "利比亞第納爾", MAD: "摩洛哥迪拉姆", MDL: "摩爾多瓦列伊", MGA: "馬達加斯加阿里亞里",
  MKD: "馬其頓代納爾", MMK: "緬甸元", MNT: "蒙古圖格里克", MOP: "澳門元",
  MRO: "毛里塔尼亞烏吉亞", MRU: "毛里塔尼亞烏吉亞", MTL: "馬耳他里拉", MUR: "毛里求斯盧比",
  MVR: "馬爾代夫拉菲亞", MWK: "馬拉維克瓦查", MXN: "墨西哥比索", MYR: "馬來西亞令吉",
  MZN: "莫桑比克梅蒂卡爾", NAD: "納米比亞元", NGN: "尼日利亞奈拉", NIO: "尼加拉瓜科爾多瓦",
  NOK: "挪威克朗", NPR: "尼泊爾盧比", NZD: "新西蘭元", OMR: "阿曼里亞爾",
  PAB: "巴拿馬巴爾博亞", PEN: "秘魯新索爾", PGK: "巴布亞新幾內亞基那", PHP: "菲律賓比索",
  PKR: "巴基斯坦盧比", PLN: "波蘭茲羅提", PYG: "巴拉圭瓜拉尼", QAR: "卡塔爾里亞爾",
  RON: "羅馬尼亞列伊", RSD: "塞爾維亞第納爾", RUB: "俄羅斯盧布", RWF: "盧旺達法郎",
  SAR: "沙特里亞爾", SBD: "所羅門群島元", SCR: "塞舌爾盧比", SDG: "蘇丹鎊",
  SEK: "瑞典克朗", SGD: "新加坡元", SHP: "聖赫勒拿鎊", SIT: "斯洛文尼亞托拉爾",
  SKK: "斯洛伐克克朗", SLL: "塞拉利昂利昂", SOS: "索馬里先令", SRD: "蘇里南元",
  SSP: "南蘇丹鎊", STD: "聖多美多布拉", STN: "聖多美多布拉", SVC: "薩爾瓦多科隆",
  SYP: "敘利亞鎊", SZL: "斯威士蘭埃馬蘭吉尼", THB: "泰銖", TJS: "塔吉克斯坦索莫尼",
  TMT: "土庫曼斯坦馬納特", TND: "突尼斯第納爾", TOP: "湯加潘加", TRY: "土耳其里拉",
  TTD: "特立尼達和多巴哥元", TWD: "新台幣", TZS: "坦桑尼亞先令", UAH: "烏克蘭格里夫納",
  UGX: "烏干達先令", USD: "美國美元", UYU: "烏拉圭比索", UZS: "烏茲別克斯坦索姆",
  VEF: "委內瑞拉玻利瓦爾", VES: "玻利瓦爾索貝拉諾", VND: "越南盾", VUV: "瓦努阿圖瓦圖",
  WST: "薩摩亞塔拉", XAF: "中非金融共同體法郎", XCD: "東加勒比元", XCG: "加勒比海吉爾德",
  XOF: "西非金融共同體法郎", XPF: "太平洋法郎", YER: "也門里亞爾", ZAR: "南非蘭特",
  ZMW: "贊比亞克瓦查", ZWG: "辛巴威黃金", ZWL: "津巴布韋元",
};

/**
 * 常見中文別名與俗稱 → ISO 4217 幣別碼。
 * 讓使用者可以用「美金」「日幣」等習慣用法查詢。
 */
export const CURRENCY_ALIASES: Record<string, string> = {
  美金: 'USD', 美元: 'USD', 美刀: 'USD',
  日幣: 'JPY', 日圓: 'JPY', 日元: 'JPY', 円: 'JPY',
  歐元: 'EUR', 欧元: 'EUR',
  台幣: 'TWD', 新台幣: 'TWD', 新台币: 'TWD', 台币: 'TWD',
  人民幣: 'CNY', 人民币: 'CNY', rmb: 'CNY',
  港幣: 'HKD', 港币: 'HKD', 港元: 'HKD',
  英鎊: 'GBP', 英镑: 'GBP',
  韓元: 'KRW', 韩元: 'KRW', 韓幣: 'KRW',
  泰銖: 'THB', 泰铢: 'THB',
  新幣: 'SGD', 新加坡幣: 'SGD', 新加坡元: 'SGD',
  馬幣: 'MYR', 馬來西亞令吉: 'MYR',
  越南盾: 'VND', 印尼盾: 'IDR', 印尼盧比: 'IDR',
  澳幣: 'AUD', 澳元: 'AUD',
  加幣: 'CAD', 加拿大元: 'CAD',
  瑞士法郎: 'CHF', 瑞郎: 'CHF',
  披索: 'PHP', 菲律賓披索: 'PHP',
};

/** 金額顯示為整數的幣別（ISO 4217 小數位為 0） */
export const ZERO_DECIMAL_CURRENCIES: Record<string, true> = {
  BIF: true, CLP: true, DJF: true, GNF: true, ISK: true, JPY: true,
  KMF: true, KRW: true, PYG: true, RWF: true, UGX: true, VND: true,
  VUV: true, XAF: true, XOF: true, XPF: true,
};

/** 解析使用者輸入的幣別，支援 ISO 代碼與中文別名 */
export function normalizeCurrency(token: string): string | null {
  const raw = token.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (CURRENCY_NAMES[upper]) return upper;
  return CURRENCY_ALIASES[raw] || CURRENCY_ALIASES[raw.toLowerCase()] || null;
}

/** 顯示幣別碼與中文名稱；未收錄者僅顯示代碼 */
export function currencyLabel(code: string): string {
  const name = CURRENCY_NAMES[code];
  return name ? `${code} ${name}` : code;
}
