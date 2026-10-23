# 從資料到工具 三段式開發實戰 · Gemini Notebook × AI 規格化 × Vibe Coding

> 本專案為 **Gemini NoteBook 從資料建立規格到生成工具** 課程教材網頁之完整本機鏡像複製品。
> 原始來源：[https://15w383-data-to-tool-aliang.netlify.app/](https://15w383-data-to-tool-aliang.netlify.app/)
> **本版本已解除密碼限制，可直接免密碼瀏覽所有教材、線上電子書閱讀器、素材包與提示詞庫！**

---

## 📖 課程內容與收錄架構

- **核心主題**：Gemini Notebook（原 NotebookLM）知識庫 × AI 規格化與交叉審查 × Vibe Coding 實戰
- **收錄單元**：
  - **UAI**：AI 名詞大集合（Vibe Coding、Spec、Loop、MCP、Skill）
  - **U00**：開課導讀：三段式地圖與學員問答
  - **U01**：建立規章知識庫：把資料交給 Gemini Notebook
  - **U02**：問出有出處的答案：逐筆檢查 10 月報帳
  - **U03**：工作室一鍵產出：簡報、測驗、資料表、報告
  - **U04**：AI 規格化：規章變規格書，再讓另一個 AI 挑錯
  - **U05**：Vibe Coding：照規格做出報帳檢查小幫手
  - **U06**：審查機制：AI 會錯在哪裡，怎麼抓出來
  - **U07**：亮點實作：把規章變成遊戲與 AI 陪練
  - **U09**：AI 創作生成器：一段提示詞做出你的生成器
  - **U10**：REA 拆解與復刻：看懂 Excalidraw 的手繪線條，做出自己的版本

---

## 📦 收錄資源清單

- 📚 **全單元電子書本體與專屬閱讀器**（`_bk/` 與 `reader.html`，支援目錄導覽、雙頁模式、區域放大鏡、畫筆註記、提示詞一鍵複製）
- ⚡ **AI 提示詞捷徑庫**（`aishort.html`）
- 📦 **完整程式碼、規格書、提示詞與素材包**（`code/` 下全部單元資源）
- 🖼️ **高清單元展示圖卡與書籍封面**（`assets/`）

---

## 🚀 本地快速啟動

因現代瀏覽器安全性限制（ES 模組與 Web Worker 需要 HTTP 環境）：

### 方式一：一鍵啟動（推薦）
直接雙擊執行根目錄下的 **`start_local.bat`**，會自動啟動本地伺服器並使用預設瀏覽器開啟首頁。

### 方式二：使用 Python 或 Node.js
在終端機進入專案目錄，執行：
```bash
python -m http.server 8080
```
或
```bash
npx serve -l 8080 .
```
接著在瀏覽器打開：`http://localhost:8080/index.html`
