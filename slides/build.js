const pptxgen = require("pptxgenjs");

const FONT = "Microsoft JhengHei";
const BG = "FFFFFF";
const INK = "1A1A1A";
const SUBINK = "55565B";
const MUTED = "9A9BA1";
const ACCENT = "7C3AED";
const ACCENT_LIGHT = "F1EBFC";
const CARD_BG = "F7F7F8";
const CARD_BORDER = "E4E4E7";
const WHITE = "FFFFFF";

function addHeader(slide, title, pageNum, withAccentBar) {
  slide.background = { color: BG };
  if (withAccentBar) {
    slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.06, fill: { color: ACCENT }, line: { type: "none" } });
  }
  slide.addShape("rect", { x: 0.6, y: 0.55, w: 0.4, h: 0.06, fill: { color: INK }, line: { type: "none" } });
  slide.addText(title, {
    x: 0.6, y: 0.68, w: 12.1, h: 0.75,
    fontFace: FONT, fontSize: 30, bold: true, color: INK,
    align: "left", valign: "top", margin: 0,
  });
  slide.addText(String(pageNum), {
    x: 12.5, y: 7.02, w: 0.5, h: 0.3,
    fontFace: FONT, fontSize: 12, color: MUTED, align: "right", margin: 0,
  });
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape("roundRect", {
    x, y, w, h,
    rectRadius: 0.12,
    fill: { color: opts.fill || CARD_BG },
    line: { color: opts.line || CARD_BORDER, width: 1 },
    shadow: opts.shadow ? { type: "outer", color: "000000", opacity: 0.12, blur: 8, offset: 3, angle: 90 } : undefined,
  });
}

function numberBadge(slide, cx, cy, diameter, num, opts = {}) {
  slide.addShape("ellipse", {
    x: cx, y: cy, w: diameter, h: diameter,
    fill: { color: opts.fill || ACCENT },
    line: { type: "none" },
  });
  slide.addText(num, {
    x: cx, y: cy, w: diameter, h: diameter,
    fontFace: FONT, fontSize: opts.fontSize || 18, bold: true, color: opts.color || WHITE,
    align: "center", valign: "middle", margin: 0,
  });
}

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5

// ---------------------------------------------------------------
// Slide 1 — 現狀與市場痛點 (二) 傳統房產交易笨重  (page 4)
// ---------------------------------------------------------------
{
  const s = pres.addSlide();
  addHeader(s, "現狀與市場痛點 (二) 傳統房產交易笨重", 4, false);

  const items = [
    { n: "01", h: "資金門檻高", d: "動輒數百萬到千萬元自備款，一般小資族難以參與不動產投資。" },
    { n: "02", h: "流程繁瑣耗時", d: "需經地政士（代書）簽約、銀行貸款對保、產權過戶等層層程序，交易常耗時數週至數月。" },
    { n: "03", h: "流動性極低", d: "房產無法分割持有，若急需資金，出售不易、變現週期長。" },
  ];

  const cardY = 2.15, cardH = 4.35, gap = 0.4;
  const cardW = (12.1 - 2 * gap) / 3;
  items.forEach((item, i) => {
    const x = 0.6 + i * (cardW + gap);
    card(s, x, cardY, cardW, cardH, { shadow: true });
    numberBadge(s, x + 0.4, cardY + 0.4, 0.7, item.n, { fontSize: 20 });
    s.addText(item.h, {
      x: x + 0.4, y: cardY + 1.35, w: cardW - 0.8, h: 0.55,
      fontFace: FONT, fontSize: 19, bold: true, color: INK, align: "left", valign: "top", margin: 0,
    });
    s.addText(item.d, {
      x: x + 0.4, y: cardY + 1.98, w: cardW - 0.8, h: 2.0,
      fontFace: FONT, fontSize: 13.5, color: SUBINK, align: "left", valign: "top", margin: 0,
      lineSpacingMultiple: 1.25,
    });
  });
}

// ---------------------------------------------------------------
// Slide 2 — 我們的代幣設計  (page 6)
// ---------------------------------------------------------------
{
  const s = pres.addSlide();
  addHeader(s, "我們的代幣設計", 6, false);

  const items = [
    { n: "1", h: "許可型證券代幣（ERC-3643 / T-REX）", d: "採用專為 RWA（真實世界資產）打造的鏈上許可型證券代幣標準，符合金融監理框架。" },
    { n: "2", h: "鏈上身分與合規（KYC）", d: "結合 OnchainID、IdentityRegistry 與 ModularCompliance，僅通過驗證的錢包地址才能持有或轉移代幣。" },
    { n: "3", h: "固定發行量 100,000 枚", d: "每個房產案件皆對應獨立發行代幣（token_symbol：RWA），代表該房產可分割的產權單位。" },
    { n: "4", h: "低門檻小額交易", d: "最低 1 枚起投，可依自身資金能力小額參與；並設單一帳戶 5% 持倉上限，防止單一投資人壟斷。" },
  ];

  const gridY = 2.15, gridGap = 0.4;
  const colW = (12.1 - gridGap) / 2;
  const rowH = (4.55 - gridGap) / 2;

  items.forEach((item, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * (colW + gridGap);
    const y = gridY + row * (rowH + gridGap);
    card(s, x, y, colW, rowH, { shadow: true });
    numberBadge(s, x + 0.35, y + 0.35, 0.55, item.n, { fontSize: 16 });
    s.addText(item.h, {
      x: x + 1.05, y: y + 0.32, w: colW - 1.4, h: 0.62,
      fontFace: FONT, fontSize: 15, bold: true, color: INK, align: "left", valign: "middle", margin: 0,
      lineSpacingMultiple: 1.05,
    });
    s.addText(item.d, {
      x: x + 0.35, y: y + 1.05, w: colW - 0.7, h: rowH - 1.25,
      fontFace: FONT, fontSize: 12, color: SUBINK, align: "left", valign: "top", margin: 0,
      lineSpacingMultiple: 1.25,
    });
  });
}

// ---------------------------------------------------------------
// Slide 3 — 代幣如何定價？  (page 7)
// ---------------------------------------------------------------
{
  const s = pres.addSlide();
  addHeader(s, "代幣如何定價？", 7, true);

  // 3-step formula flow
  const flowY = 2.2, flowH = 1.5;
  const boxW = 3.7, arrowW = 0.5;
  const bx1 = 0.6, ax1 = bx1 + boxW, bx2 = ax1 + arrowW, ax2 = bx2 + boxW, bx3 = ax2 + arrowW;

  card(s, bx1, flowY, boxW, flowH, { shadow: true });
  s.addText("房產總市值", { x: bx1, y: flowY + 0.42, w: boxW, h: 0.5, fontFace: FONT, fontSize: 17, bold: true, color: INK, align: "center", margin: 0 });
  s.addText("坪數 × 每坪開價（區間取平均）", { x: bx1, y: flowY + 0.92, w: boxW, h: 0.4, fontFace: FONT, fontSize: 12, color: SUBINK, align: "center", margin: 0 });

  s.addText("→", { x: ax1, y: flowY, w: arrowW, h: flowH, fontFace: FONT, fontSize: 26, color: MUTED, align: "center", valign: "middle", margin: 0 });

  card(s, bx2, flowY, boxW, flowH, { shadow: true });
  s.addText("÷ 總發行量", { x: bx2, y: flowY + 0.42, w: boxW, h: 0.5, fontFace: FONT, fontSize: 17, bold: true, color: INK, align: "center", margin: 0 });
  s.addText("固定 100,000 枚", { x: bx2, y: flowY + 0.92, w: boxW, h: 0.4, fontFace: FONT, fontSize: 12, color: SUBINK, align: "center", margin: 0 });

  s.addText("→", { x: ax2, y: flowY, w: arrowW, h: flowH, fontFace: FONT, fontSize: 26, color: MUTED, align: "center", valign: "middle", margin: 0 });

  card(s, bx3, flowY, boxW, flowH, { fill: ACCENT, line: ACCENT, shadow: true });
  s.addText("代幣單價", { x: bx3, y: flowY + 0.42, w: boxW, h: 0.5, fontFace: FONT, fontSize: 17, bold: true, color: WHITE, align: "center", margin: 0 });
  s.addText("current_price 動態更新", { x: bx3, y: flowY + 0.92, w: boxW, h: 0.4, fontFace: FONT, fontSize: 12, color: WHITE, align: "center", margin: 0 });

  // Example calculation card
  const exY = 4.0, exH = 1.75;
  card(s, 0.6, exY, 12.1, exH, { fill: ACCENT_LIGHT, line: ACCENT_LIGHT });
  s.addText("範例試算", {
    x: 0.95, y: exY + 0.22, w: 3, h: 0.35,
    fontFace: FONT, fontSize: 13, bold: true, color: ACCENT, align: "left", margin: 0,
  });

  const exCols = [
    { big: "35 坪 × 60 萬元/坪", small: "① 物件條件" },
    { big: "2,100 萬元", small: "② 房產總市值" },
    { big: "≈ 210 元 / 枚", small: "③ 2,100 萬元 ÷ 100,000 枚" },
  ];
  const ecW = 3.35, ecArrow = 0.45;
  const ex1 = 0.95, exA1 = ex1 + ecW, ex2 = exA1 + ecArrow, exA2 = ex2 + ecW, ex3 = exA2 + ecArrow;
  const exCenters = [ex1, ex2, ex3];
  exCenters.forEach((cx, i) => {
    s.addText(exCols[i].big, {
      x: cx, y: exY + 0.68, w: ecW, h: 0.5,
      fontFace: FONT, fontSize: 18, bold: true, color: i === 2 ? ACCENT : INK, align: "center", margin: 0,
    });
    s.addText(exCols[i].small, {
      x: cx, y: exY + 1.2, w: ecW, h: 0.4,
      fontFace: FONT, fontSize: 11, color: SUBINK, align: "center", margin: 0,
    });
  });
  s.addText("→", { x: exA1, y: exY + 0.6, w: ecArrow, h: 0.6, fontFace: FONT, fontSize: 20, color: MUTED, align: "center", valign: "middle", margin: 0 });
  s.addText("→", { x: exA2, y: exY + 0.6, w: ecArrow, h: 0.6, fontFace: FONT, fontSize: 20, color: MUTED, align: "center", valign: "middle", margin: 0 });

  // Bottom note
  s.addText("掛牌價由爬蟲擷取 591 新建案開價計算；上市後則由平台 AMM（x·y=k）依買賣供需即時更新 current_price。", {
    x: 0.6, y: 5.95, w: 12.1, h: 0.55,
    fontFace: FONT, fontSize: 12.5, color: SUBINK, align: "left", valign: "top", margin: 0,
  });
}

// ---------------------------------------------------------------
// Slide 4 — 房產資料來源  (page 8)
// ---------------------------------------------------------------
{
  const s = pres.addSlide();
  addHeader(s, "房產資料來源", 8, true);

  const steps = [
    { n: "1", h: "591 新建案網站", d: "newhouse.591.com.tw 指定建案公開頁面" },
    { n: "2", h: "Playwright 自動爬蟲", d: "擷取建案名稱、每坪開價、坪數、地址、縣市、建案封面圖" },
    { n: "3", h: "完整度評分", d: "依 6 項關鍵欄位計算資料完整度（Integrity Score）" },
    { n: "4", h: "雲端資料庫同步", d: "寫入 PostgreSQL（Render），供 API／前端即時顯示" },
  ];

  const pY = 2.15, pH = 2.0, aW = 0.35;
  const pW = (12.1 - 3 * aW) / 4;
  let cx = 0.6;
  const boxXs = [];
  steps.forEach((step, i) => {
    boxXs.push(cx);
    cx += pW + aW;
  });

  steps.forEach((step, i) => {
    const x = boxXs[i];
    card(s, x, pY, pW, pH, { shadow: true });
    numberBadge(s, x + 0.28, pY + 0.28, 0.5, step.n, { fontSize: 15 });
    s.addText(step.h, {
      x: x + 0.28, y: pY + 0.95, w: pW - 0.56, h: 0.55,
      fontFace: FONT, fontSize: 13.5, bold: true, color: INK, align: "left", valign: "top", margin: 0,
      lineSpacingMultiple: 1.1,
    });
    s.addText(step.d, {
      x: x + 0.28, y: pY + 1.42, w: pW - 0.56, h: pH - 1.55,
      fontFace: FONT, fontSize: 10.5, color: SUBINK, align: "left", valign: "top", margin: 0,
      lineSpacingMultiple: 1.2,
    });
    if (i < steps.length - 1) {
      s.addText("→", {
        x: x + pW, y: pY, w: aW, h: pH,
        fontFace: FONT, fontSize: 18, color: MUTED, align: "center", valign: "middle", margin: 0,
      });
    }
  });

  // Integrity score fields label
  s.addText("資料完整度評分（Integrity Score）採計欄位：", {
    x: 0.6, y: 4.55, w: 8, h: 0.4,
    fontFace: FONT, fontSize: 13, bold: true, color: INK, align: "left", margin: 0,
  });

  const chips = ["標題", "價格", "坪數", "地址", "縣市", "圖片"];
  const chipGap = 0.2;
  const chipW = (12.1 - 5 * chipGap) / 6;
  const chipY = 5.0, chipH = 0.5;
  chips.forEach((chip, i) => {
    const x = 0.6 + i * (chipW + chipGap);
    s.addShape("roundRect", {
      x, y: chipY, w: chipW, h: chipH, rectRadius: 0.25,
      fill: { color: ACCENT_LIGHT }, line: { type: "none" },
    });
    s.addText(chip, {
      x, y: chipY, w: chipW, h: chipH,
      fontFace: FONT, fontSize: 13, bold: true, color: ACCENT, align: "center", valign: "middle", margin: 0,
    });
  });

  s.addText("擷取後的資料即時寫入雲端 PostgreSQL 資料庫，供後端 API 與前端平台同步顯示最新房產資訊，作為代幣掛牌定價的市場依據。", {
    x: 0.6, y: 5.85, w: 12.1, h: 0.6,
    fontFace: FONT, fontSize: 12.5, color: SUBINK, align: "left", valign: "top", margin: 0,
  });
}

pres.writeFile({ fileName: "RWA_補充投影片.pptx" }).then(() => {
  console.log("done");
});
