# AI 名詞速查表（15W383 UAI）

| 名詞 | 一句話白話 | 本課在哪裡 |
|---|---|---|
| Vibe Coding（氛圍式寫程式） | 用講的請 AI 寫程式，看結果再用講的改，自己幾乎不讀程式碼 | U05 |
| Spec-Driven Development（SDD，規格驅動開發） | 先寫規格與驗收答案，AI 照規格做，做完用規格驗收 | U04 |
| Prompt Engineering（提示詞工程） | 把這一次的指令問清楚（角色、目標、步驟、備註） | U02–U05 |
| Context Engineering（脈絡工程） | 讓 AI 開工前看到對的資料：規章、規格、範例、限制 | U01、U04 |
| CLAUDE.md／AGENTS.md | 寫給 AI 代理的專案說明書，每次開工自動讀 | 延伸 |
| Context Window | AI 一次記得住的份量（以 token 計） | 延伸 |
| AI Agent／CLI 代理 | 會自己讀檔、執行指令、改檔、看結果的 AI（Claude Code、Codex CLI） | U04–U05 |
| Subagent（子代理） | 主代理把一小塊工作分給另一個代理做 | 延伸 |
| 沙盒／權限模式 | 限制代理能動的資料夾與動作 | U04（codex -s workspace-write） |
| Loop（Agent Loop） | 做 → 測 → 修，直到停止條件（例：test.js 10/10） | U05 |
| MCP（Model Context Protocol） | 讓 AI 接外部工具與資料的共同插座 | 延伸 |
| Skill（技能包） | 一個資料夾＋SKILL.md：可重複使用的工作手冊 | 延伸 |
| Hook／Plugin | 特定時機自動執行的動作／打包好的擴充組合 | 延伸 |
| RAG／Grounding | 先找資料再回答，並附出處 | U02 |
| Hallucination（幻覺） | AI 很有把握地說錯或編造 | U06 |
| 交叉審查／Human-in-the-loop | 另一個 AI 挑錯／最後由人裁決 | U04、U06 |

## 三個一定要分清楚的
- Prompt＝交辦一句話；Skill＝給新人一本 SOP；MCP＝給新人一張門禁卡。
- Vibe Coding 適合原型與自用；要多人用、要長期維護，就先寫 Spec。
- 安裝 MCP 或 Skill 前：確認來源、看權限、不放金鑰；拆解別人的軟體只限學習與自用。
