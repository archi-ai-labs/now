# NOW — now_dashboard

> Đọc từ trên xuống. Nói với Claude: `làm tiếp đi` · `chốt <id>: …` · `xong rồi` · `/now`.

*Cập nhật 2026-08-03 · commit 2a46a30 · `claude /now` (auto-update vì drift) · `inferred`*

## 🎯 Đang làm — đọc xong mục này là quay lại được việc

### App trên thanh menu macOS — badge liếc-là-thấy + popover dùng lại NGUYÊN quotaBar/CSS của dashboard

*`inferred` · refs: [app/NowMenuBar.swift](app/NowMenuBar.swift) · [bin/install-app](bin/install-app) · [public/lib/menubar-view.js](public/lib/menubar-view.js)*

- 📌 **Bối cảnh:** Focus trước (**B19** — màn "Nhìn lại", phím 8) đã khép **30/7 khuya**: xong cả server (`src/lib/cycles.js` + `src/collect/lookback.js`) lẫn client (`public/views/lookback.js`), nghiệm thu VI/EN × hai nền, `state.lookback` chỉ 1.193 byte; ba rủi ro phỏng vấn đóng bằng số đo. **Hôm nay 3/8** dựng một **SURFACE MỚI** — app trên thanh menu macOS, cả ngày tới tận khuya:
  - server thêm `/api/badge` (`badgeOf`, nhịp 30s);
  - app Swift native `app/NowMenuBar.swift` (404 dòng, AppKit+WebKit) dựng qua `bin/install-app` → **ĐÃ CÀI** `~/Applications/NOW Dashboard.app` (build 20:39);
  - popover là chính trang `menubar.html` — **KHÔNG** phải màn thứ 8, không nav/router/SSE — dùng lại nguyên `quotaBar` và CSS dashboard (`public/menubar.js` + `public/lib/menubar-view.js`, có linh vật `phaseOf`/`shadeOf` theo giờ);
  - `+489` dòng CSS `mb-*`, `+426` i18n VI/EN, README ghi trọn cách cài + canh chữ bằng mắt (`NOW_SNAP`/`NOW_PROBE`).

  Đã vá lỗi sống-từ-ngày-đầu (popover hỏi chiều cao trong `didFinish` lúc trang còn `await fetch` → nay trang tự đẩy size qua `webkit.messageHandlers`). `npm test` **337/337** (đã vá luôn flake 2 test butler đỏ sau 22h). **CHƯA commit dòng nào, CHƯA có mục nào trong BACKLOG cho surface này.**
- ▶ **Làm ngay:** Nghiệm thu app đã cài trên **dữ liệu thật** — mở popover từ `~/Applications/NOW Dashboard.app` xem badge 30s + `quotaBar`, VI/EN × sáng/tối, console 0 lỗi. `menubar-view.js` là `public/lib` nên **CLAUDE.md mục 4 BUỘC xem thật**, đừng dừng ở `npm test` 337 xanh.
- ⏭ **Còn lại:**
  - Ghi surface "App thanh menu" vào `BACKLOG.md` — grep `B2x`/`menu`/`badge` đang **RỖNG**, chưa có mục nào; viết một khối ✅ có số đo như cách B19 được ghi 30/7.
  - Commit khối việc lớn đang treo: repo mới đúng **1 commit** initial (`2a46a30`) mà cả **B19** (`cycles.js`/`lookback.js`/`views/lookback.js` + 2 test, untracked từ 30/7) **lẫn** toàn bộ app thanh menu hôm nay đều chưa vào commit nào.
  - Dọn nợ git hygiene từ 29/7: `NOW.json`/`NOW.md` vẫn hiện `M` (đang bị track) dù đã thêm `.gitignore` + `git rm --cached` — bản vá đó chưa commit, và chính `.gitignore` còn ở trạng thái untracked (`??`).
- 🗂 **Hiện trạng repo:** nhánh `main`, **đúng 1 commit** (`2a46a30` initial squash), **không worktree phụ**. Working tree phình lớn & chưa commit: ~13 file `M` + ~12 file untracked — gồm **trọn B19** (untracked từ 30/7) và **trọn app thanh menu** hôm nay. Server qua launchd (`dev.hoanluu.now-dash`, pid 37645) sống, `:4400` trả 200. App **đã cài** `~/Applications/NOW Dashboard.app` (build 20:39 hôm nay). `npm test` **337/337** (314 lúc mốc 29/7 → 334 sau B19 → 337).
- 💬 **Làm tiếp với Claude:** không có phiên nào đang cầm việc — mở phiên mới, nói: *"xem lại app thanh menu đã cài, chạy nghiệm thu popover VI/EN × sáng/tối trên dữ liệu thật, rồi bàn có commit khối B19+menubar và ghi BACKLOG không"*.

## 🤔 Chờ BẠN quyết — mỗi hàng là 1 câu hỏi; trả lời Claude là hàng biến mất

| Độ nóng | Quyết gì | Câu hỏi cần bạn trả lời | Đang khóa gì | Chốt bằng cách nói |
|---|---|---|---|---|
| ⏰ Sắp chặn | **[d-push](design/README.md)** — đẩy dist/ lên project claude.ai mà không mất thẻ prototype | `dist/screens/overview.html` là mock tĩnh; thẻ cùng tên trên project là prototype tương tác 56KB. Đẩy dist/ nhưng bỏ qua đúng file đó, hay đẩy cả và chấp nhận prototype bị thay bằng mock? | project claude.ai càng lệch xa (overview.html đứng mốc 26/7, cũ hơn mọi việc từ 27/7), treo 11 ngày | `` `chốt d-push: bỏ qua overview.html` `` |
| 🧊 Không gấp | **[d-backlog-now](BACKLOG.md)** — BACKLOG.md vs NOW.json: giữ tách vai hay liên kết chặt hơn | Giữ tách vai (BACKLOG = nguồn sự thật, NOW = digest) và chỉ nâng liên kết, hay muốn một trong ba nâng cấp (đọc BACKLOG.md tự động / trang backlog riêng / chuẩn format cho `/now all`)? | mỗi `/now update` phải tự đoán ranh giới upNext ↔ BACKLOG; lượt này surface thanh menu rơi khỏi cả hai tới khi đo drift, treo 5 ngày | `` `chốt d-backlog-now: giữ tách vai` `` |

- ⏰ **sắp chặn** — sẽ chặn bước kế tiếp (ở đây: **d-push**, vòng thiết kế đã dịch tiếp mà project claude.ai kẹt ở bản 26/7).
- 🧊 **không gấp** — chốt trước một mốc còn xa (ở đây: **d-backlog-now**, chưa chặn gì nhưng mỗi lượt update lại đoán lại ranh giới).
- 🎯 = dính trực tiếp việc đang làm · bấm mã xem chi tiết.

## 📥 Hàng đợi — ĐỪNG đọc lúc này; xong việc đang làm thì lấy mục 1

1. **task_33a66d84** (từ /reflect): `modules.test.js` vẫn chỉ `import`, chưa gọi hàm render thật của từng view — lỗ "288 test xanh mà `#view` rỗng" (CLAUDE.md mục 4) nay càng đáng vì có **thêm hai surface render-lúc-chạy** chưa ai bắt bằng test: `views/lookback.js` và `menubar-view.js`. — [test/modules.test.js](test/modules.test.js)
2. **B13** — `run()` trong `src/lib/sh.js` vẫn nuốt lý do lỗi (không đổi từ 23/7); xếp đầu hàng vì là điều kiện chẩn đoán mọi lỗi khác — vừa dựng service/app native lại thấy cái giá của hỏng-im-lặng. — [BACKLOG.md](BACKLOG.md)
3. **B14** — payload `/api/state` 322,6KB (mốc hạ ưu tiên 119,5KB, gấp 2,7 lần); ~11% là phiên/hội thoại serialize hai lần, bỏ hàng đúp bằng id là bước rẻ nhất. Đã kiểm: `state.lookback` của B19 chỉ 1.193 byte nên **không** nuôi thêm B14. — [BACKLOG.md](BACKLOG.md)
4. **B18** — giãn nhịp quét khi vắng người xem: 1,6% một core, chỉ đáng nếu chạy 24/7 quanh năm; B17 đã cắt ~230ms mỗi lượt nên bớt cấp bách. B6 (dựng lại theo dự án) vẫn hoãn vô thời hạn. — [BACKLOG.md](BACKLOG.md)

## ✅ Vừa xong — chỉ để nhớ hôm qua mình dừng ở đâu

**2026-08-03**
- Dựng **SURFACE MỚI** — app trên thanh menu macOS: `/api/badge` (server, `badgeOf` 30s) + app Swift native `app/NowMenuBar.swift` dựng qua `bin/install-app` → **đã cài** `~/Applications/NOW Dashboard.app` (20:39) + popover `menubar.html` dùng lại nguyên `quotaBar`/CSS dashboard (linh vật `phaseOf`/`shadeOf`); `+489` CSS `mb-*`, `+426` i18n VI/EN. Vá lỗi sống-từ-ngày-đầu (popover hỏi chiều cao lúc trang chưa fetch → đẩy size qua `webkit.messageHandlers`) + vá flake 2 test butler sau 22h. Test 334→337. **Chưa commit, chưa vào BACKLOG.** — [app/NowMenuBar.swift](app/NowMenuBar.swift)

**2026-07-30**
- **B19** (màn "Nhìn lại", phím 8) **xong trong một phiên**, nghiệm thu trên app thật VI/EN × hai nền — cả server (`cycles.js` + `lookback.js`, `state.lookback` 1.193 byte) lẫn client. Ba rủi ro phỏng vấn đóng bằng số đo: tiền Cursor khớp planUsage 0,0%, AG có dải ngày thật (đỉnh 28/7: 1.631 lượt), sổ AG 5h là rác trượt chỉ nhận `-weekly`. Test 314→334. — [BACKLOG.md](BACKLOG.md)

**2026-07-29**
- git init + push lên GitHub (`archimonde12/now_dashboard`, 116 file, 1 commit) — chốt d-git. Lỡ cuốn `NOW.json`/`NOW.md` vào commit (thiếu `.gitignore`); vá `.gitignore` + `git rm --cached` nhưng bản vá tới nay **vẫn chưa commit**. — [.gitignore](.gitignore)

**2026-07-28**
- Đề xuất màn "Nhìn lại" duyệt tối 28/7 kèm 12 quyết định phỏng vấn + mock hợp đồng; tracker ag-cycles/cursor-cycles dựng ngay đêm đó, kịp trước reset AG 08:04 sáng 29/7. **B16** (hết ký sinh phiên Claude — launchd + ghim cổng 4400) + **B17** (memo TTL) + **B10/B15** (câu "đang quét lần đầu" phân 3 pha) xong và kiểm sống. — [docs/PROPOSAL-nhin-lai.md](docs/PROPOSAL-nhin-lai.md)
