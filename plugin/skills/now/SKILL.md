---
name: now
description: In bảng NOW của repo hiện tại (đang làm gì + làm ngay / chờ bạn quyết / chờ người khác / hàng đợi) rồi đo độ lệch so với git. Thêm `update` để ghi lại NOW.json + render NOW.md; thêm `all` để quét mọi dự án trong ~/Projects và in bảng tổng. Mọi chế độ đều liệt kê worktree phụ đang mở.
disable-model-invocation: true
---

# NOW board

Chống "stun" khi context-switch giữa nhiều dự án. Repo nào có skill `now` riêng trong
`.claude/skills/` thì bản đó **thắng** (project override) — bản plugin này là fallback
cho repo chưa port harness, cộng thêm chế độ `all`.

## Mô hình dữ liệu (contract chung mọi dự án)

2 file ở repo root, **gitignored** (trạng thái local mỗi máy — không bao giờ `git add`).
**`NOW.json` = nguồn máy-đọc** — schema chính thức: [`now.schema.json`](./now.schema.json)
(draft-07, `schemaVersion: 1`), dashboard tổng validate file này. **`NOW.md` = view render
từ JSON** — cập nhật cùng lượt. NOW là digest một chiều có `ref` về nguồn, không phải nguồn
sự thật.

## Nguyên tắc nội dung (chốt với user 2026-07-21)

1. **Mỗi section = "ai cầm bóng"; một việc chỉ nằm ở đúng MỘT section:** 🎯 `focus` = user làm ngay · 🤔 `decisionsNeeded` = chờ não user (quyết định của user; nếu đã đẩy cho người khác → `waitingOn`, không bao giờ cả hai) · ⏳ `waitingOn` = chờ người khác · 📥 `upNext` = chưa ai cầm · ✅ `recentlyDone` = context, nằm **cuối** file.
2. **Mỗi dòng phải tự trả lời "đọc xong tôi làm gì với nó"**: decision có `question` cụ thể + handle `id` để user nói `chốt <id>: …`; waiting có ai + từ bao giờ; queue item nói bị khóa bởi gì. Không qua test này → bỏ (quality gate, không phải rút gọn máy móc).
3. **`focus` là section được đầu tư nhất** — người quên sạch context vẫn quay lại làm tiếp được chỉ nhờ đọc nó. Nhãn có icon, **không checkbox**, **không dòng "Đã xong"** (phần đã xong kể trong `context` — tránh nhầm với ✅ Vừa xong): 📌 `context` (việc là gì, vì sao, ĐÃ xong phần nào, đến đâu) · ▶ `nextAction` (động từ, <30 phút) · ⏭ `laterSteps` (+ hậu tố `⛔` từ `blockedBy[{id,note}]` — pointer decision gắn với bước nó chặn, không đứng dòng riêng; chặn cả bước kế tiếp → `nextAction` = `chốt <id>`) · 🗂 `resume.workingState` (nhánh/working tree thật) · 💬 `resume.howToContinue` (câu nói/lệnh tiếp tục) · `refs` link ở title · `confidence: confirmed|inferred`.
4. Decision có `heat`: `now` 🔥 (khóa focus/blocker) · `soon` ⏰ · `later` 🧊 — sort nóng → nguội, kèm "khóa X, treo N ngày".
5. **Định nghĩa `focus`**: chuỗi công việc hướng tới **MỘT kết quả bàn giao được** (PR merge / feature chạy / quyết định chốt), cỡ **0.5–3 ngày** — lớn hơn một next action, nhỏ hơn một phase; đúng cỡ khi mô tả được bằng một câu "**xong khi …**". Chưa xong + là thứ user nên cầm lên đầu tiên khi quay lại. **Chỉ một focus**: user chỉ định = `confirmed`; Claude suy = `inferred` (từ mạch hoạt động gần nhất + giá trị bàn giao lớn nhất; hai ứng viên ngang nhau → hỏi user, không tự quyết). Mạch dở khác → `sideTracks`; focus xong → `recentlyDone` + kéo mục 1 `upNext` lên; bỏ dở → xuống `upNext` kèm ghi chú dang dở.

## Không tham số — xem (repo hiện tại)

Read `NOW.json` (thiếu → chạy `update` tạo lần đầu) → đo drift (`git log <updatedAtCommit>..HEAD`, `git status`, docs/journal mới hơn stamp) → quét worktree (dưới) → in dashboard đúng thứ tự section → drift đáng kể (≥5 commit / >3 ngày) thì tự update rồi in bản mới.

**Quét worktree (luôn chạy, không lưu vào JSON — dữ liệu này stale rất nhanh):** `git worktree list --porcelain`. Có worktree phụ (ngoài cái đầu tiên = repo chính) → in ngay dưới `🗂 Hiện trạng repo` một dòng `🌳 Worktree phụ:` rồi mỗi cái một mục `<path> · <nhánh|detached> · N file chưa commit`, kèm cờ:
- ⚠️ path nằm trong `/tmp` hoặc `/private/tmp` — **mất khi reboot máy**; gợi ý `git worktree move <cũ> <mới>`.
- ⚠️ có file chưa commit — công đang treo ngoài repo chính, dễ quên.
- 🧹 sạch + nhánh đã merge → gợi ý `git worktree remove`.
Entry mồ côi (thư mục không còn) → gợi ý `git worktree prune`. Không có worktree phụ thì bỏ hẳn dòng này, đừng in "không có".

## `update` — cập nhật (repo hiện tại)

- Nguồn: việc user đang làm/vừa nói (không rõ → suy từ git, `confidence: "inferred"`); done từ `git log` sau mốc cũ; decisions/waiting/queue từ docs trạng thái repo (roadmap, open-items, TODO, issues) — không có thì hỏi user 1 lượt gọn.
- `waitingOn` giữ nguyên mục cũ trừ khi có bằng chứng xong. Đổi `focus.title` chỉ khi có bằng chứng rõ.
- `sideTracks[].owner` = `"<tên phiên>" · <uuid đầy đủ>` (cách lấy + lý do: mục "Định danh phiên" dưới); phiên đã chết + việc đã xong thì bỏ khỏi `sideTracks`.
- `resume.workingState` phải phản ánh **cả worktree phụ**, không chỉ nhánh repo chính — vd `dev-ready sạch · 2 worktree phụ: wt-b8 (detached, /tmp ⚠️), wt-b7split (sync/b7-crons, 3 file chưa commit)`. Đây là chỗ duy nhất worktree được ghi xuống file, để người đọc `NOW.md` mà không chạy Claude vẫn biết chúng tồn tại.
- Ghi `NOW.json` → validate theo schema (đường dẫn ở "Tìm file schema" dưới; dùng `jsonschema` nếu có, fallback: check required + không key lạ + focus đủ title/nextAction/confidence) → render `NOW.md` cùng lượt.
- Repo chưa có NOW: tạo 2 file + **append `NOW.json`/`NOW.md` vào `.gitignore`**; repo có `.agent-harness.json` thì thêm `"nowFile": "NOW.json"` + NOW vào `sharedStateFiles`.
- **Bẫy: repo deploy bằng Vercel CLI trên macOS.** Filesystem không phân biệt hoa/thường nên `NOW.json` ở gốc bị CLI đọc thành `now.json` — file cấu hình đã khai tử — và nó **dừng deploy**: ``Error: The `now.json` file is deprecated``. `.vercelignore` KHÔNG cứu được (CLI dò config trước khi lọc file). Cách đã kiểm chứng (2026-07-23, repo `mix-color-game-app`): script deploy tạm `mv NOW.json .now-board-hidden.json` quanh lệnh `npx vercel`, trả lại bằng `trap … EXIT` kể cả khi lỗi. Tạo NOW board ở repo có thư mục `.vercel/` thì **vá script deploy ngay trong cùng lượt**, đừng để user gặp lỗi lúc đang phát hành.
- User nói `chốt <id>: …` → ghi vào docs nguồn của repo trước, rồi bỏ mục khỏi `decisionsNeeded`.

## Tìm file schema

Plugin được **chép** vào `~/.claude/plugins/cache` chứ không chạy tại chỗ, nên đường dẫn
tới schema phải bám gốc plugin, không được đoán theo `~/.claude/skills/`:

1. `${CLAUDE_PLUGIN_ROOT}/skills/now/now.schema.json` nếu biến môi trường có mặt
   (`echo "$CLAUDE_PLUGIN_ROOT"`).
2. Không có thì lấy thư mục chứa chính `SKILL.md` này — `now.schema.json` nằm cạnh nó.

Không có file schema thì **dừng lại hỏi user**, đừng tự chế schema.

## Định danh phiên trong `sideTracks` — 2 cách quay lại

Id 8 ký tự (thứ SessionStart hook in ra) **không quay lại phiên được**: picker và panel search theo **tên phiên**, `--resume` đòi **UUID đủ 36 ký tự**. Nên `sideTracks[].owner` phải chứa **cả hai**: `"<tên phiên>" · <uuid đầy đủ>`.

Lấy hai thứ đó từ transcript — tên nằm ở `customTitle` (user đặt) hoặc `aiTitle` (Claude tự đặt), uuid là tên file:

```bash
cd ~/.claude/projects/$(pwd | sed 's|/|-|g') && python3 - <<'EOF'
import json,glob
for p in glob.glob("*.jsonl"):
    ai=cu=last=None
    for l in open(p):
        try: r=json.loads(l)
        except: continue
        ai=r.get("aiTitle") or ai; cu=r.get("customTitle") or cu; last=r.get("timestamp") or last
    print(f"{(last or '')[:16]}  {p[:-6]}  {(cu or ai or '(chưa có tên)')}")
EOF
```

Render dưới list `sideTracks` **đúng khối này** (đánh số, không gộp một dòng):

```
*Quay lại phiên — 2 cách:*
1. ***Trong extension (Cursor/VS Code)**: mở lịch sử phiên rồi search theo **tên trong ngoặc kép** ở trên (vài từ là đủ). Panel chỉ search theo **tên phiên**, không search theo id.*
2. ***Trong terminal**: `claude --resume <uuid đầy đủ>` — id 8 ký tự cụt không tra được.*

*Tên phiên do Claude tự đặt nếu bạn không đặt — muốn dễ tìm thì mở phiên bằng `claude -n "tên bạn muốn"`, hoặc rename trong panel.*
```

Phiên không còn heartbeat (`.claude/sessions/<id>/heartbeat` cũ hơn ~15 phút) và việc của nó đã xong → **bỏ khỏi `sideTracks`**, cho kết quả xuống `recentlyDone`; để lại là board trỏ vào phiên chết, user đi tìm mất công.

## Render `NOW.md` — thứ tự + header cố định

Header: `# NOW — <project>` → blockquote cách dùng (đọc từ trên xuống; nói với Claude: `làm tiếp đi` · `chốt <id>: …` · `xong rồi` · `/now-board:now`) → stamp nghiêng. Sections:

1. `## 🎯 Đang làm — đọc xong mục này là quay lại được việc` — **title nổi bật** thành heading con `### {title}` (dòng dưới: tag `inferred` + refs); các nhãn **lùi vào dạng list item**: `- 📌 **Bối cảnh:**` → `- ▶ **Làm ngay:**` → `- ⏭ **Còn lại:**` (+ hậu tố `⛔` từ `blockedBy`) → `- 🗂 **Hiện trạng repo:**` (kèm `🌳 Worktree phụ:` như mô tả ở chế độ xem nếu có) → `- 💬 **Làm tiếp với Claude:**`.
2. `## 🧵 Ngoài lề — các phiên Claude khác đang chạy song song (không phải việc chính)` — **section riêng ngay sau 🎯**, list `- **{title}** · phiên **“{tên phiên}”** · \`{uuid đầy đủ}\`` (xem "Định danh phiên" trên) + **khối 2 cách quay lại**; bỏ section nếu `sideTracks` rỗng.
3. `## 🤔 Chờ BẠN quyết — mỗi hàng là 1 câu hỏi; trả lời Claude là hàng biến mất` — **BẢNG** sort heat now→later: `| Độ nóng | Quyết gì | Câu hỏi cần bạn trả lời | Đang khóa gì | Chốt bằng cách nói |` (mọi cột phải có tên, không để header trống) — `Độ nóng` = emoji + nhãn chữ (`🔥 Quyết ngay` / `⏰ Sắp chặn` / `🧊 Không gấp`), không để emoji trần; `Quyết gì` = `**[{id}]({ref})** — {title}`; `Đang khóa gì` = {blocks} + `, treo {N} ngày` + tiền tố 🎯 nếu id thuộc `focus.blockedBy`; cột cuối = `` `chốt {id}: …` `` kèm gợi ý đáp án. Dưới bảng: **legend dạng list có ví dụ thật từ data**: `- 🔥 **quyết ngay** — đang khóa blocker hoặc chính việc đang làm (ở đây: {vd})` / `- ⏰ **sắp chặn** — sẽ chặn bước kế tiếp (ở đây: {vd})` / `- 🧊 **không gấp** — chốt trước một mốc còn xa (ở đây: {vd})` / `- 🎯 = dính trực tiếp việc đang làm · bấm mã xem chi tiết`.
4. `## ⏳ Chờ NGƯỜI KHÁC — không phải việc của bạn; chỉ nhắc khi có ⚠️` — `- **{who}** — {what} · từ {since}` + `⚠️ quá {N} ngày — nhắc được rồi` nếu >7 ngày.
5. `## 📥 Hàng đợi — ĐỪNG đọc lúc này; xong việc đang làm thì lấy mục 1` — numbered.
6. `## ✅ Vừa xong — chỉ để nhớ hôm qua mình dừng ở đâu` — gộp theo ngày.

## `all` — toàn cảnh mọi dự án

1. `find ~/Projects -maxdepth 3 -name NOW.json -not -path "*/node_modules/*" 2>/dev/null`.
2. Mỗi file: đọc JSON; staleness = `git -C <dir> log --oneline <updatedAtCommit>..HEAD | wc -l` (repo lỗi git → chỉ dùng `updatedAt`).
3. Bảng tổng, sort stale/nóng nhất lên đầu: | Dự án | Đang làm | → Next action | 🤔 | ⏳ | Cập nhật | — cột `Dự án` thêm hậu tố `+N wt` nếu `git -C <dir> worktree list` trả về worktree phụ (`+N wt ⚠️` khi có cái nằm trong `/tmp` hoặc còn file chưa commit).
4. Dưới bảng: gom mọi `decisionsNeeded` các dự án (heat 🔥 trước) thành "Cần quyết xuyên dự án" — title + project + blocks.
5. Repo trong `~/Projects` có commit 14 ngày gần đây mà không có `NOW.json` → liệt kê "(chưa có NOW board)" để user biết mà seed.
