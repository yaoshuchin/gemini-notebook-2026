/* 電子書閱讀器：翻頁 / 縮放 / 畫畫 / 打字
   註記依規格「不儲存」——換頁或重整即消失。 */

import * as pdfjsLib from './pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './assets/pdf.worker.min.mjs';

// 書檔路徑刻意混淆並改副檔名，避免有人直接猜網址抓走整本電子書。
// （提醒：純靜態網站無法真正防下載，這只是把門檻拉高。）
const BOOKS = {
  U00:{ t:"U00 開課導讀：三段式地圖與學員問答", f:'_bk/u00_cce62c4e49786ced.bin' },
  U01:{ t:"U01 建立規章知識庫：把資料交給 Gemini Notebook", f:'_bk/u01_2221319f6940eab6.bin' },
  U02:{ t:"U02 問出有出處的答案：逐筆檢查 10 月報帳", f:'_bk/u02_8b05c464e770a8cb.bin' },
  U03:{ t:"U03 工作室一鍵產出：簡報、測驗、資料表、報告", f:'_bk/u03_ce5e7d68ad9a761a.bin' },
  U04:{ t:"U04 AI 規格化：規章變規格書，再讓另一個 AI 挑錯", f:'_bk/u04_76c8f579572b519e.bin' },
  U05:{ t:"U05 Vibe Coding：照規格做出報帳檢查小幫手", f:'_bk/u05_1ecff1bb3404fe4c.bin' },
  U06:{ t:"U06 審查機制：AI 會錯在哪裡，怎麼抓出來", f:'_bk/u06_c16cd94d73f4b452.bin' },
  U07:{ t:"U07 亮點實作：把規章變成遊戲與 AI 陪練", f:'_bk/u07_0fdefa7f5e6e32d5.bin' },
  U08:{ t:"U08 LINE AI 客服：試算表 × GAS 生成器 × LINE × OpenAI", f:'_bk/u08_1d4a4a19ceb3781e.bin' },
  U09:{ t:"U09 AI創作生成器：一段提示詞做出你的生成器", f:'_bk/u09_cc88ffb899470de5.bin' },
  U10:{ t:"U10 REA 拆解與復刻：看懂 Excalidraw 的手繪線條，做出自己的版本", f:'_bk/u10_37570e858dd9bd18.bin' },
  UAI:{ t:"UAI AI 名詞大集合：一次看懂 Vibe Coding、Spec、Loop、MCP、Skill", f:'_bk/uai_e72eadaeadccaeeb.bin' },
};

const $ = id => document.getElementById(id);
const stage = $('stage'), book = $('book');
const page = $('page'), ink = $('ink'), prev = $('prev-layer');
const page2 = $('page2'), lens = $('lens');
const pctx = page.getContext('2d');
const p2ctx = page2.getContext('2d');
const lctx = lens.getContext('2d');
const ictx = ink.getContext('2d', { willReadFrequently: true });
const ctx2 = prev.getContext('2d');       // 形狀拖曳中的即時預覽層

let doc = null, cur = 1, total = 0, zoom = 1, base = 1;
let tool = null, drawing = false, rendering = false, pendingPage = null;
let spread = false;                     // 雙頁跨頁模式
let fitPage = false;                    // 整頁顯示（一頁完整放進畫面）
let lensOn = false, lensSize = 220, lensPow = 2.0;   // 區域放大鏡
let penW = 2.6;                         // 筆畫粗細，滑鼠滾輪可調

/* ── 提示泡泡 ───────────────────────── */
let hintTimer;
function hint(msg){
  const h = $('hint');
  h.innerHTML = '';                    // 清掉 showPen 可能留下的節點
  h.textContent = msg; h.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.remove('show'), 2100);
}

/* ── 載入 ───────────────────────────── */
const id = new URLSearchParams(location.search).get('u') || 'U01';
const info = BOOKS[id];

if (!info){
  $('loading').innerHTML = '找不到這個單元。<br><a href="index.html" style="color:#c0392b">回首頁</a>';
} else {
  document.title = info.t + ' · 行政通 AI 隨身碟';
  $('title').textContent = info.t;
  // 電子書僅供線上閱讀，不提供下載（著作權保護）
  load();
}

async function load(){
  try{
    doc = await pdfjsLib.getDocument({ url: info.f, disableRange: true, disableStream: true }).promise   // 2026-10-13：線上分段讀取很慢，改一次下載整本;
    total = doc.numPages;
    $('tot').textContent = total;
    $('num').max = total;
    // 橫式（16:9）的書：固定整頁顯示、一頁一頁翻，不需要「滿版寬」「雙頁」這兩種看法
    const v1 = (await doc.getPage(1)).getViewport({ scale: 1 });
    if (v1.width > v1.height){
      fitPage = true;
      stage.classList.add('fit');
      document.body.classList.add('landscape');
      // 預設整頁顯示；想看大一點可以按「滿版寬」拉到全寬（橫式書不需要雙頁）
      $('fitbtn').classList.add('on');
      $('fitbtn').querySelector('.lbl').textContent = '滿版寬';
      $('spreadbtn').hidden = true;
    }
    const last = loadLastPage();
    await render(last || 1);
    $('loading').remove();
    if (last) hint('已回到上次讀到的第 ' + last + ' 頁');
  }catch(e){
    $('loading').innerHTML = '電子書載入失敗。<br><span style="font-size:13px">' +
      String(e.message || e).replace(/</g,'&lt;') + '</span>';
  }
}

/* ── 算出剛好放得下的基準縮放 ─────────── */
// 頁寬＝整個閱讀區寬度（高度不夠就往下捲），不設上限。
function fitScale(vp1){
  const pad = window.innerWidth <= 700 ? 8 : 16;
  // 雙頁跨頁時兩張並排，單頁只能用一半的寬度
  const cols = spread ? 2 : 1;
  const byW = (stage.clientWidth - pad) / cols / vp1.width;
  if (!fitPage) return byW;
  // 整頁模式：寬與高都要放得進閱讀區，取比較小的那個
  const byH = (stage.clientHeight - pad - 14) / vp1.height;
  return Math.min(byW, byH);
}

/* ── 渲染單頁 ───────────────────────── */
/* ── 指令框旁的「📋 複製」按鈕（2026-10-03 老師要求）──────────
   位置來自 code/copy169.json（extract_copy169.py 從 16:9 書稿量出，座標以 1280×720 為準） */
let COPY = null;
fetch('code/copy169.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : {})
  .then(j => { COPY = j || {}; if (doc) placeCopyBtns(); }).catch(() => { COPY = {}; });

function placeCopyBtns(){
  book.querySelectorAll('.cp-btn').forEach(b => b.remove());
  if (!COPY || !COPY[id]) return;
  const w = parseFloat(page.style.width), k = w / 1280;
  const pages = spread ? [[cur, 0], [cur + 1, w]] : [[cur, 0]];
  for (const [pn, off] of pages){
    COPY[id].filter(it => it.p === pn).forEach(it => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cp-btn'; b.textContent = '📋 複製';
      b.title = '複製這段指令，直接貼上使用';
      b.style.left = (off + (it.x + it.w) * k - 6) + 'px';
      b.style.top = (it.y * k + 6) + 'px';
      b.onclick = async (e) => {
        e.stopPropagation();
        try { await navigator.clipboard.writeText(it.t); }
        catch (err) {
          const ta = document.createElement('textarea'); ta.value = it.t; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); ta.remove();
        }
        b.textContent = '✅ 已複製'; hint('已複製這段指令，可以直接貼上');
        setTimeout(() => { b.textContent = '📋 複製'; }, 1600);
      };
      book.appendChild(b);
    });
  }
}

async function render(n){
  if (!doc) return;
  if (rendering){ pendingPage = n; return; }
  rendering = true;
  cur = Math.min(Math.max(1, n), total);

  const p = await doc.getPage(cur);
  const vp1 = p.getViewport({ scale: 1 });
  base = fitScale(vp1);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vp = p.getViewport({ scale: base * zoom });

  page.width  = Math.floor(vp.width  * dpr);
  page.height = Math.floor(vp.height * dpr);
  page.style.width  = Math.floor(vp.width)  + 'px';
  page.style.height = Math.floor(vp.height) + 'px';

  // 註記層跟著頁面尺寸走（換頁即清空，符合「不儲存」規格）
  for (const c of [ink, prev]){
    c.width  = page.width;
    c.height = page.height;
    c.style.width  = page.style.width;
    c.style.height = page.style.height;
  }
  book.style.width = page.style.width;
  clearNotes();

  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  pctx.clearRect(0, 0, vp.width, vp.height);
  await p.render({ canvasContext: pctx, viewport: vp }).promise;

  // 雙頁跨頁：右邊再畫下一頁（最後一頁沒有下一頁就留白）
  if (spread){
    const rightNo = cur + 1;
    page2.width  = page.width;
    page2.height = page.height;
    page2.style.width  = page.style.width;
    page2.style.height = page.style.height;
    p2ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    p2ctx.clearRect(0, 0, vp.width, vp.height);
    if (rightNo <= total){
      const pr = await doc.getPage(rightNo);
      await pr.render({ canvasContext: p2ctx,
                        viewport: pr.getViewport({ scale: base * zoom }) }).promise;
    } else {
      p2ctx.fillStyle = '#fff';
      p2ctx.fillRect(0, 0, vp.width, vp.height);
    }
    // 註記層要蓋住兩頁的寬度
    for (const c of [ink, prev]){
      c.width = page.width * 2;
      c.style.width = (parseFloat(page.style.width) * 2) + 'px';
    }
    book.style.width = (parseFloat(page.style.width) * 2) + 'px';
    for (const c of [ictx, ctx2]) c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  for (const c of [ictx, ctx2]){
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = '#c0392b';
    c.lineWidth = penW;
  }

  placeCopyBtns();
  saveLastPage();
  undoStack.length = 0;
  refreshUndo();

  $('num').value = cur;
  $('prev').disabled = cur <= 1;
  $('next').disabled = cur >= total;
  $('zv').textContent = Math.round(zoom * 100) + '%';

  rendering = false;
  if (pendingPage !== null){ const q = pendingPage; pendingPage = null; render(q); return; }
  if (lensOn) ensureHiRes();
}

/* ── 放大鏡用的高清頁面 ───────────────
   以前放大鏡是把螢幕上那張（已經縮小的）畫面再拉大，等於放大低解析度的圖，所以糊。
   現在另外用 PDF 原檔、以「顯示倍率 × 放大倍率 × 螢幕像素比」重畫一張高清版，鏡片從這張取樣。
   像素總數上限約 2,400 萬，避免舊電腦記憶體不夠。 */
const hiRes = { key: '', left: null, right: null, busy: false };
async function renderHi(pageNo, scale){
  const pg = await doc.getPage(pageNo);
  const vp = pg.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
  await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  return c;
}
async function ensureHiRes(){
  if (!doc || !lensOn || hiRes.busy) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = parseFloat(page.style.width) || 1, cssH = parseFloat(page.style.height) || 1;
  let f = Math.max(2, Math.ceil(lensPow)) * dpr;               // 相對於「CSS 顯示尺寸」的倍率
  const cap = 24e6;
  if (cssW * cssH * f * f > cap) f = Math.sqrt(cap / (cssW * cssH));
  const key = [cur, spread, cssW, f.toFixed(2)].join('|');
  if (hiRes.key === key) return;
  hiRes.busy = true;
  try{
    const vp1 = (await doc.getPage(cur)).getViewport({ scale: 1 });
    const scale = cssW / vp1.width * f;
    hiRes.left = await renderHi(cur, scale);
    hiRes.right = spread && cur + 1 <= total ? await renderHi(cur + 1, scale) : null;
    hiRes.key = key;
  }catch(err){ hiRes.key = ''; }
  hiRes.busy = false;
}

/* ── 翻頁 ───────────────────────────── */
// 翻書效果：整本以書脊為軸輕輕翻一下（雙頁模式最明顯）
function flipAnim(dir){
  const cls = dir > 0 ? 'flip-next' : 'flip-prev';
  book.classList.remove('flip-next', 'flip-prev');
  void book.offsetWidth;               // 強制重排，動畫才會重播
  book.classList.add(cls);
  setTimeout(() => book.classList.remove(cls), 460);
}
const go = n => {
  if (n >= 1 && n <= total && n !== cur){
    flipAnim(n > cur ? 1 : -1);
    render(n); stage.scrollTop = 0;
  }
};
// 雙頁模式一次翻兩頁（左右各一頁）
const step = () => spread ? 2 : 1;
$('prev').onclick = () => go(cur - step());
$('next').onclick = () => go(cur + step());
$('num').onchange = e => {
  const v = parseInt(e.target.value, 10);
  if (v >= 1 && v <= total) go(v); else e.target.value = cur;
};

/* ── 縮放 ───────────────────────────── */
const setZoom = z => {
  const nz = Math.min(Math.max(0.5, +z.toFixed(2)), 3);
  if (nz === zoom) return;
  zoom = nz; render(cur);
};
$('zin').onclick  = () => setZoom(zoom + 0.2);
$('zout').onclick = () => setZoom(zoom - 0.2);
$('zv').onclick   = () => setZoom(1);

/* ── 工具切換 ───────────────────────── */
const TOOLS = {
  draw:    { btn: 'draw',  msg: '畫畫模式：在書頁上按住拖曳就能畫線' },
  arrow:   { btn: 'arrow', msg: '箭頭模式：從起點按住拖到終點，放開就出現箭頭' },
  rect:    { btn: 'rect',  msg: '方框模式：按住拖曳拉出一個框' },
  ellipse: { btn: 'oval',  msg: '圓圈模式：按住拖曳拉出一個圈' },
  text:    { btn: 'text',  msg: '打字模式：在書頁上點一下，就能開始打字' },
};

function setTool(t){
  tool = (tool === t) ? null : t;
  // 游標樣式：畫線用十字、打字用 I 形、形狀用十字
  document.body.classList.toggle('tool-draw', !!tool && tool !== 'text');
  document.body.classList.toggle('tool-text', tool === 'text');
  // 粗細指示只在「會畫線的工具」啟用時顯示
  document.body.classList.toggle('has-tool', !!tool && tool !== 'text');
  for (const [k, v] of Object.entries(TOOLS)){
    $(v.btn).classList.toggle('on', tool === k);
  }
  hint(tool ? TOOLS[tool].msg : '已回到閱讀模式');
}
for (const [k, v] of Object.entries(TOOLS)){
  $(v.btn).onclick = () => setTool(k);
}

/* ── 畫畫 ───────────────────────────── */
const pos = e => {
  const r = ink.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (ink.width / r.width)  / (window.devicePixelRatio > 1 ? Math.min(window.devicePixelRatio,2) : 1),
    y: (e.clientY - r.top)  * (ink.height / r.height) / (window.devicePixelRatio > 1 ? Math.min(window.devicePixelRatio,2) : 1),
  };
};

/* 形狀工具（箭頭／方框／圓圈）都是「按住拖曳」畫出來的。
   拖曳過程中畫在預覽層 prev 上即時預覽，放開才蓋印到 ink 正式層，
   這樣拖到一半改變大小不會在畫面上留下一堆殘影。 */
let sx = 0, sy = 0;                     // 起點

function drawShape(ctx, kind, x0, y0, x1, y1){
  ctx.save();
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = penW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  if (kind === 'rect'){
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.stroke();

  } else if (kind === 'ellipse'){
    ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2,
                Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();

  } else if (kind === 'arrow'){
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    // 箭頭頭部：依線段角度畫兩撇，長度隨線長縮放但有上下限
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const h = Math.max(9, Math.min(20, len * 0.24));
    const spread = Math.PI / 7;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(ang - spread), y1 - h * Math.sin(ang - spread));
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(ang + spread), y1 - h * Math.sin(ang + spread));
    ctx.stroke();
  }
  ctx.restore();
}

const clearPreview = () => {
  ctx2.save();
  ctx2.setTransform(1, 0, 0, 1, 0, 0);
  ctx2.clearRect(0, 0, prev.width, prev.height);
  ctx2.restore();
};

ink.addEventListener('pointerdown', e => {
  if (tool === 'text'){ addNote(e); return; }
  if (!tool) return;

  drawing = true;
  pushUndo();                     // 下筆前先記一個還原點
  ink.setPointerCapture(e.pointerId);
  const p = pos(e);
  sx = p.x; sy = p.y;
  if (tool === 'draw'){
    ictx.lineWidth = penW;        // 清除鈕重設過 context，起筆時要再套一次
    ictx.strokeStyle = '#c0392b';
    ictx.beginPath();
    ictx.moveTo(p.x, p.y);
  }
  e.preventDefault();
});

ink.addEventListener('pointermove', e => {
  if (!drawing) return;
  const p = pos(e);
  if (tool === 'draw'){
    ictx.lineTo(p.x, p.y);
    ictx.stroke();
  } else {
    clearPreview();                       // 形狀：即時預覽
    drawShape(ctx2, tool, sx, sy, p.x, p.y);
  }
  e.preventDefault();
});

const stop = e => {
  if (!drawing) return;
  drawing = false;
  try{ ink.releasePointerCapture(e.pointerId); }catch(_){}
  if (tool && tool !== 'draw' && tool !== 'text'){
    const p = pos(e);
    clearPreview();
    // 只是點一下沒有拖曳，不留下形狀
    if (Math.hypot(p.x - sx, p.y - sy) > 4) drawShape(ictx, tool, sx, sy, p.x, p.y);
  }
};
ink.addEventListener('pointerup', stop);
ink.addEventListener('pointercancel', stop);

/* ── 打字註記 ───────────────────────── */
function addNote(e){
  const r = book.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = 'note';
  d.contentEditable = 'true';
  d.style.left = (e.clientX - r.left) + 'px';
  d.style.top  = (e.clientY - r.top)  + 'px';
  // 只有「使用者確實編輯過又留空」才刪掉；剛建立就失焦（例如點擊當下的
  // focus 轉移）不能刪，否則框會一出現就消失。
  let touched = false;
  d.addEventListener('input', () => { touched = true; });
  d.addEventListener('blur', () => { if (touched && !d.textContent.trim()) d.remove(); });
  d.addEventListener('keydown', ev => {
    ev.stopPropagation();                       // 打字時不要觸發翻頁快捷鍵
    if (ev.key === 'Escape'){                   // Esc＝放棄這個註記
      d.remove();
      hint('已取消這個註記');
    }
  });
  book.appendChild(d);
  d.focus();
}
const clearNotes = () => book.querySelectorAll('.note').forEach(n => n.remove());

/* ── 清除註記 ───────────────────────── */
$('clr').onclick = () => {
  pushUndo();                     // 清除也可以復原
  ictx.save();
  ictx.setTransform(1, 0, 0, 1, 0, 0);
  ictx.clearRect(0, 0, ink.width, ink.height);
  ictx.restore();
  ictx.lineWidth = penW;          // restore 會把線寬還原成預設，補回目前設定
  clearPreview();
  clearNotes();
  hint('這一頁的筆跡與註記已清除');
};

/* ── 鍵盤 ───────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
  if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   { go(cur - step()); e.preventDefault(); }
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { go(cur + step()); e.preventDefault(); }
  if (e.key === 'Home') go(1);
  if (e.key === 'End')  go(total);
  if (e.key === '+' || e.key === '=') setZoom(zoom + 0.2);
  if (e.key === '-') setZoom(zoom - 0.2);
  if (e.key === '0') setZoom(1);
  if (e.key === 'Escape'){
    if (!$('tocwrap').hidden){ closeToc(); return; }
    if (!$('sheet').hidden){ closeSheet(); return; }
    if (lensOn){ setLens(false); return; }
    if (tool) setTool(tool);
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){
    e.preventDefault(); undo();
  }
});

/* ── 整頁顯示 ─────────────────────────
   預設是「填滿寬度」（高度不夠往下捲）；
   切成整頁後，一整頁（或跨頁）會完整縮進畫面裡，不用捲。 */
$('fitbtn').onclick = () => {
  fitPage = !fitPage;
  $('fitbtn').classList.toggle('on', fitPage);
  $('fitbtn').querySelector('.lbl').textContent = fitPage ? '滿版寬' : '整頁';
  stage.classList.toggle('fit', fitPage);
  zoom = 1;
  render(cur);
  stage.scrollTop = 0;
  hint(fitPage ? '整頁顯示：一整頁完整放進畫面' : '滿版寬度：頁面填滿寬度，可往下捲');
};

/* ── 單頁 / 雙頁跨頁切換 ─────────────── */
$('spreadbtn').onclick = () => {
  spread = !spread;
  book.classList.toggle('spread', spread);
  $('spreadbtn').classList.toggle('on', spread);
  $('spreadbtn').querySelector('.lbl').textContent = spread ? '單頁' : '雙頁';
  if (spread && cur % 2 === 0 && cur > 1) cur -= 1;   // 讓左頁固定是奇數頁
  if (!spread){
    page2.width = 0; page2.height = 0;
    page2.style.width = '0px'; page2.style.height = '0px';
  }
  render(cur);
  hint(spread ? '雙頁跨頁：一次看兩頁，翻頁一次跳兩頁' : '單頁模式：一次看一頁');
};

/* ── 區域放大鏡 ───────────────────────
   鏡片跟著滑鼠走，只放大鏡片底下那一塊，不改變版面。
   滾輪調鏡片大小、Shift+滾輪調倍率。 */
function drawLens(clientX, clientY){
  const r = book.getBoundingClientRect();
  const x = clientX - r.left, y = clientY - r.top;      // book 內的 CSS 座標
  if (x < 0 || y < 0 || x > r.width || y > r.height){ lens.hidden = true; return; }

  const half = lensSize / 2;
  lens.hidden = false;
  lens.style.width  = lensSize + 'px';
  lens.style.height = lensSize + 'px';
  lens.style.left   = (x - half) + 'px';
  lens.style.top    = (y - half) + 'px';
  const ldpr = Math.min(window.devicePixelRatio || 1, 2);
  const lpx = Math.round(lensSize * ldpr);
  if (lens.width !== lpx){ lens.width = lpx; lens.height = lpx; }
  lens.style.right = 'auto'; lens.style.bottom = 'auto';

  lctx.save();
  lctx.setTransform(ldpr, 0, 0, ldpr, 0, 0);
  lctx.clearRect(0, 0, lensSize, lensSize);
  // 圓形裁切，鏡片才是圓的
  lctx.beginPath();
  lctx.arc(half, half, half - 2, 0, Math.PI * 2);
  lctx.clip();
  lctx.fillStyle = '#fff';
  lctx.fillRect(0, 0, lensSize, lensSize);

  // 決定取樣哪一張畫布（雙頁時右半邊取 page2）
  const pw = parseFloat(page.style.width) || r.width;
  const onRight = spread && x > pw;
  const shown = onRight ? page2 : page;
  // 高清版必須是「這一頁、這個尺寸」畫的；翻頁或縮放後舊的不能用
  const hiOk = hiRes.key.split('|').slice(0, 3).join('|') === [cur, spread, parseFloat(page.style.width) || 1].join('|');
  const hi = hiOk ? (onRight ? hiRes.right : hiRes.left) : null;
  const src = hi || shown;                               // 高清版還沒好就先用畫面上那張
  const sx = onRight ? x - pw : x;
  // CSS 座標 → 取樣畫布的實際像素
  const kx = src.width  / (parseFloat(shown.style.width)  || 1);
  const ky = src.height / (parseFloat(shown.style.height) || 1);
  const sw = lensSize / lensPow, sh = lensSize / lensPow;

  lctx.imageSmoothingEnabled = true;
  lctx.imageSmoothingQuality = 'high';
  try{
    lctx.drawImage(src,
      (sx - sw / 2) * kx, (y - sh / 2) * ky, sw * kx, sh * ky,
      0, 0, lensSize, lensSize);
    // 把筆跡層也疊上去，畫過的線在放大鏡裡也看得到
    const ikx = ink.width / (parseFloat(ink.style.width) || 1);
    const iky = ink.height / (parseFloat(ink.style.height) || 1);
    lctx.drawImage(ink,
      (x - sw / 2) * ikx, (y - sh / 2) * iky, sw * ikx, sh * iky,
      0, 0, lensSize, lensSize);
  }catch(err){ /* 畫布還沒準備好就跳過這一幀 */ }
  lctx.restore();
  if (!hi) ensureHiRes();
}

function lensMove(e){ if (lensOn) drawLens(e.clientX, e.clientY); }

function setLens(on){
  lensOn = on;
  $('lensbtn').classList.toggle('on', on);
  $('lenschip').hidden = !on;
  book.classList.toggle('lensing', on);
  lens.hidden = !on;
  if (on){
    $('lens-size').textContent = lensSize;
    $('lens-pow').textContent  = lensPow.toFixed(1);
    ensureHiRes();
    hint('放大鏡：移到哪裡就放大哪裡 · 滾輪調大小 · Shift+滾輪調倍率 · Esc 關閉');
  }
}
$('lensbtn').onclick = () => setLens(!lensOn);
// 事件掛在 stage：#ink 蓋在 #book 上面會吃掉 book 的滑鼠事件
stage.addEventListener('mousemove', lensMove);
stage.addEventListener('mouseleave', () => { if (lensOn) lens.hidden = true; });

// 滾輪：調鏡片大小；Shift+滾輪：調倍率（放大鏡開著時才攔截）
stage.addEventListener('wheel', e => {
  if (!lensOn) return;
  e.preventDefault();
  if (e.shiftKey){
    lensPow = Math.min(6, Math.max(1.2, +(lensPow + (e.deltaY < 0 ? .2 : -.2)).toFixed(1)));
    ensureHiRes();
    $('lens-pow').textContent = lensPow.toFixed(1);
  } else {
    lensSize = Math.min(520, Math.max(90, lensSize + (e.deltaY < 0 ? 20 : -20)));
    $('lens-size').textContent = lensSize;
  }
  drawLens(e.clientX, e.clientY);
}, { passive: false });

/* ── 視窗縮放時重新排版 ─────────────── */
let rt;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => { if (doc) render(cur); }, 220);
});

/* ── 著作權保護：提高「順手存檔」的門檻 ─────────────
   注意：純靜態網站無法真正防下載（懂技術的人用開發者工具仍可取得，
   截圖更是永遠擋不掉）。以下只是擋掉一般學員的隨手操作。 */

// 書頁上停用右鍵（避免「另存圖片」）
book.addEventListener('contextmenu', e => {
  e.preventDefault();
  hint('本電子書僅供線上閱讀');
});

// 停用書頁拖曳
book.addEventListener('dragstart', e => e.preventDefault());

// 攔 Ctrl+S（存檔）與 Ctrl+P（列印成 PDF）
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['s', 'p'].includes(e.key.toLowerCase())){
    e.preventDefault();
    hint('本電子書僅供線上閱讀，未開放下載或列印');
  }
}, true);

/* ── 指令面板 ─────────────────────────
   電子書鎖住，但指令刻意開放：學員本來就要整段複製去用。 */
let codeIdx = null, codeFiles = [], curFile = 0;

async function openSheet(){
  $('sheet').hidden = false;
  if (!codeIdx){
    try{
      codeIdx = await (await fetch('code/index.json')).json();
    }catch(_){
      $('codetext').textContent = '練習檔載入失敗，請重新整理再試一次。';
      return;
    }
  }
  codeFiles = codeIdx[id] || [];
  if (!codeFiles.length){
    $('tabs').innerHTML = '';
    $('codetext').textContent = '這個單元沒有文字練習檔。';
    return;
  }
  // 多檔案的單元（U06／U07）才顯示分頁
  $('tabs').innerHTML = codeFiles.length > 1
    ? codeFiles.map((f, i) =>
        `<button class="tab${i === 0 ? ' on' : ''}" data-i="${i}">${f.label}（${f.lines} 行）</button>`
      ).join('')
    : `<span class="tab on" style="cursor:default">${codeFiles[0].label}（${codeFiles[0].lines} 行）</span>`;
  $('tabs').querySelectorAll('button.tab').forEach(t => {
    t.onclick = () => showFile(+t.dataset.i);
  });
  showFile(0);
}

async function showFile(i){
  curFile = i;
  const f = codeFiles[i];
  $('tabs').querySelectorAll('.tab').forEach((t, n) => t.classList.toggle('on', n === i));
  $('codetext').textContent = '載入中…';
  try{
    const r = await fetch(f.file);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    f.text = await r.text();
    $('codetext').textContent = f.text;
    $('sheet').querySelector('.codebox').scrollTop = 0;
  }catch(e){
    $('codetext').textContent = '這個檔案載入失敗：' + e.message;
  }
}

const closeSheet = () => { $('sheet').hidden = true; };

$('codebtn').onclick = openSheet;
$('sheet-x').onclick = closeSheet;
$('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); });

$('copybtn').onclick = async () => {
  const f = codeFiles[curFile];
  if (!f || !f.text) return;
  try{
    await navigator.clipboard.writeText(f.text);
    hint('已複製 ' + f.label + '，可以直接貼上使用了');
  }catch(_){
    // 不支援 clipboard API（或未授權）時，退而求其次幫使用者選起來
    const r = document.createRange();
    r.selectNodeContents($('codetext'));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    hint('請按 Ctrl+C 複製（瀏覽器未允許自動複製）');
  }
};

$('dlbtn').onclick = () => {
  const f = codeFiles[curFile];
  if (!f || !f.text) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([f.text], { type: 'text/plain;charset=utf-8' }));
  a.download = f.dl;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  hint('已下載 ' + f.dl);
};

/* ── 滑鼠滾輪調線寬 ─────────────────────
   只有在選了畫圖工具時才攔滾輪，否則維持正常捲動頁面。 */
const PEN_MIN = 1, PEN_MAX = 24;

function setPen(w){
  penW = Math.min(PEN_MAX, Math.max(PEN_MIN, Math.round(w * 10) / 10));
  ictx.lineWidth = penW;
  ctx2.lineWidth = penW;
  paintPenChip();
  showPen();
}

// 工具列上的粗細指示：一顆依比例放大的圓點 + 數字
function paintPenChip(){
  const dot = $('pen-dot'), num = $('pen-num');
  if (!dot) return;
  const d = Math.max(3, Math.min(20, penW));
  dot.style.width = d + 'px';
  dot.style.height = d + 'px';
  num.textContent = penW.toFixed(1);
}

// 用一顆圓點直接把粗細畫給使用者看，比只顯示數字直覺
function showPen(){
  const h = $('hint');
  h.innerHTML = '筆畫粗細 <b style="display:inline-block;vertical-align:middle;' +
    'width:' + penW + 'px;height:' + penW + 'px;background:#f2a08f;' +
    'border-radius:50%;margin:0 8px"></b> ' + penW.toFixed(1) + ' px';
  h.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.remove('show'), 1400);
}

// 綁在整個閱讀區，不只書頁本身——否則滑鼠稍微移出書頁滾輪就沒反應。
stage.addEventListener('wheel', e => {
  if (!tool || tool === 'text') return;      // 沒選畫圖工具就讓頁面正常捲動
  e.preventDefault();
  setPen(penW + (e.deltaY < 0 ? 1 : -1) * (penW < 6 ? 0.5 : 1));
}, { passive: false });

// 點粗細指示 → 回到預設 2.6
$('penchip').onclick = () => setPen(2.6);
paintPenChip();

/* ── 記住上次讀到哪一頁 ─────────────────
   只存頁碼，不存書的內容，符合「註記不儲存」的規格。 */
const LAST_KEY = 'gas-reader-last';

function saveLastPage(){
  try{
    const m = JSON.parse(localStorage.getItem(LAST_KEY) || '{}');
    m[id] = cur;
    localStorage.setItem(LAST_KEY, JSON.stringify(m));
  }catch(_){}                       // 無痕模式等情況會丟例外，忽略即可
}

function loadLastPage(){
  try{
    const m = JSON.parse(localStorage.getItem(LAST_KEY) || '{}');
    const p = parseInt(m[id], 10);
    return (p > 1 && p <= total) ? p : null;
  }catch(_){ return null; }
}

/* ── 復原上一步 ─────────────────────────
   每畫完一筆就把整張註記層存成影像，最多留 20 步。 */
const undoStack = [];
const UNDO_MAX = 20;

function pushUndo(){
  try{
    undoStack.push(ictx.getImageData(0, 0, ink.width, ink.height));
    if (undoStack.length > UNDO_MAX) undoStack.shift();
  }catch(_){}
  refreshUndo();
}

function refreshUndo(){
  $('undo').disabled = undoStack.length === 0;
}

function undo(){
  if (!undoStack.length) return;
  const img = undoStack.pop();
  ictx.save();
  ictx.setTransform(1, 0, 0, 1, 0, 0);
  ictx.putImageData(img, 0, 0);
  ictx.restore();
  ictx.lineWidth = penW;
  refreshUndo();
  hint('已復原一步');
}

$('undo').onclick = undo;

/* ── 章節目錄 ───────────────────────── */
let toc = null;

async function openToc(){
  $('tocwrap').hidden = false;
  if (!toc){
    try{
      toc = (await (await fetch('code/toc.json')).json())[id] || [];
    }catch(_){ toc = []; }
  }
  $('toclist').innerHTML = toc.length
    ? toc.map(c =>
        `<li><button data-p="${c.p}" class="${c.p === cur ? 'on' : ''}">` +
        `<span class="tt">${c.t}</span><span class="tp">第 ${c.p} 頁</span></button></li>`
      ).join('')
    : '<li style="padding:20px;color:#7a6f60">這本書尚未建立目錄。</li>';
  $('toclist').querySelectorAll('button').forEach(btn => {
    btn.onclick = () => { go(+btn.dataset.p); closeToc(); };
  });
}
const closeToc = () => { $('tocwrap').hidden = true; };

$('tocbtn').onclick = openToc;
$('toc-x').onclick = closeToc;
$('tocwrap').addEventListener('click', e => {
  if (e.target === $('tocwrap')) closeToc();
});
