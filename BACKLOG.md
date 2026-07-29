# BACKLOG — tối ưu now_dashboard

Lập ngày 2026-07-23 sau một lượt đọc hết 4.255 dòng (`server.js`, `src/`, `public/`) **và đo
trên máy này**, không phải đọc lướt rồi đoán. Mỗi mục dưới đây có bằng chứng kèm số hoặc
`file:dòng` — mục nào tôi chưa dựng lại được thì ghi rõ là *chưa gặp*.

Xếp theo **cái gì hỏng nếu để nguyên**, không theo loại kỹ thuật: sập → nói dối → chậm →
khó tin về lâu dài.

> **Trạng thái 2026-07-23, cuối ngày.** Vòng 1 và vòng 2 đã làm xong và kiểm trên app
> thật: `B1` `B2` `B3` `B4` `B5` `B7` `B8` `B9` `B11` `B12`. Còn lại: `B6` `B10` `B13`
> `B14`, cộng `B15` mới phát hiện trong lúc kiểm — xem "Còn lại làm gì" ở cuối file. Mỗi mục đã xong giữ nguyên phần bằng chứng
> gốc và thêm dòng **✅ Đã làm** kèm số đo SAU, để lần sau còn so được.

---

## Số đo nền (2026-07-23, Node v18.10.0)

Chốt lại đây để lần sau sửa xong còn so được.

| Đo cái gì | Trước | Sau (cùng máy, cùng ngày) |
|---|---|---|
| Một lượt `buildState()` | **4.084 ms** rồi **7.098 ms** | **400–769 ms** |
| ├ `scanRoots()` — đi đĩa `~/Projects` | 267 ms · 7 board / 17 repo | không đụng tới |
| ├ `collectSessions()` — ps + transcript + todo | 868 ms · 39 phiên | song song hoá (`B5`) |
| └ `collectGit()` cho 7 board | **2.984 ms** | gộp lệnh + 3 tầng (`B4`) |
| Số tiến trình `git` mỗi lượt quét | **63** (30 `rev-parse` · 17 `log` · 9 `status` · 4 `worktree` · 3 `rev-list`) | **37** |
| Giá một lần spawn `git` trên máy này | ~54 ms (`git --version` ×10 = 537 ms) | không đổi được |
| Payload SSE mỗi lượt phát | 116,3 KB | 119,5 KB — **chưa động tới**, xem `B14` |
| Lượt vẽ lại trang / 4 lượt quét | 4 | **1** (lượt đó dữ liệu đổi thật) |
| Lượt vẽ lại khi gõ 7 phím vào ô tìm | 7 | **1** |
| Bộ test | không có | **39 test**, `node --test`, zero-dep |
| Transcript của phiên sống | 41 MB / 39 phiên · 90 file todo trong 8 thư mục | — |
| Sự kiện `fs.watch` lúc máy rảnh | 1 sự kiện / 45 giây (**không** phải bão như tôi đã ngờ) | — |

Đọc bảng cũ ra một câu: *cứ 30 giây dashboard đốt 4–7 giây và 63 tiến trình con để dựng
lại một bức tranh gần như y hệt bức trước.* Giờ nó đốt dưới một giây, 37 tiến trình, và
phần lớn các lượt **không vẽ lại gì cả** vì không có gì đổi.

---

## Số đo nền (2026-07-28, audit lần hai — Node v24.14.1, đo trên server sống)

Audit độc lập lần hai: profiler nằm NGOÀI repo (shim đếm spawn trong `PATH`, y cách đo
23/7) + quan sát thẳng tiến trình đang chạy (pid sống 62 phút) và trang thật
(`PerformanceObserver` + `MutationObserver` cắm qua console). Chốt lại để lần sau còn so.

| Đo cái gì | 23/7 | 28/7 |
|---|---|---|
| `buildState()` nguội | 4.084 ms → 4,5 s (27/7) | **5.379 ms · 169 spawn** (9 board — thêm 2 board và các collector Cursor/AG so với hôm đặt mốc) |
| Lượt quét thật (`buildMs` đọc từ SSE) | 400–769 ms | **210–618 ms** — đáy là lượt trúng memo usage, đỉnh là lượt phải tính lại (xem `B17`) |
| Spawn mỗi lượt ấm | 37 | **56** = 45 git (9 board) + 10 `git log` orphan + 1 ps |
| Payload SSE | 119,5 → 318 KB (27/7) | **322,6 KB** · gzip còn 97,9 KB · client parse 2,4 ms (xem `B14`) |
| CPU cả tiến trình | — | **1,6% một core** trung bình (60,75 s CPU / 62 phút) · RSS 23,7 MB |
| Client mở trang (`no-store`, tải lại từ đầu) | — | DOMContentLoaded **153 ms** · load **239 ms** · 21 file JS / 516 KB |
| Vẽ lại khi nhận SSE (`B8` còn sống không) | 4 quét → 1 vẽ | **5 sự kiện → 0 lượt vẽ đắt** trong 78 s; longtask lớn nhất 384 ms là lần vẽ ĐẦU tiên |

Hai nghi vấn đã kiểm và **bác bỏ** — ghi để khỏi bàn lần nữa:

- *"522 KB JS tải một cục + `no-store` nên mở trang chậm"* — sai. 153/239 ms qua
  localhost. Không đáng một mục backlog.
- *"Payload 322 KB làm chậm phía nhận"* — sai. `JSON.parse` đo 2,4 ms. Cái đáng nhìn của
  payload là XU HƯỚNG tăng (2,7× trong 5 ngày) và hàng đúp — số nằm trong `B14`.

---

## Nhóm 0 · Đang sập hoặc đang nói dối

### `B1` — Một URL hỏng là giết cả dashboard ⛔ nghiêm trọng nhất

**Bằng chứng — dựng lại được 100%:** gửi `GET /%` vào server đang chạy:

```
URIError: URI malformed
    at decodeURIComponent (<anonymous>)
    at serveStatic (server.js:99:48)
```

Tiến trình **chết hẳn**, không phải trả 400. Handler ở [server.js:149](server.js:149) là
`async` nhưng không ai bắt promise bị reject → Node thoát. Mọi đường lỗi khác trong handler
(`getState()` ném, `serveNowMd` ném) đều đi ra cùng một cửa này.

**Sửa:** bọc thân handler bằng `try/catch` trả 500, và `try/catch` riêng quanh
`decodeURIComponent`. Thêm `process.on('unhandledRejection')` ghi log thay vì chết.

**Ước lượng:** 15 phút. **Chặn bởi:** không gì. *Làm trước mọi thứ khác trong file này.*

**✅ Đã làm** — handler tách thành `handle()` + `.catch()` ở [server.js](server.js), thêm
`process.on('unhandledRejection')`. Bắn lại 5 URL độc: `/%`→400 · `/%zz`→400 ·
`/../../etc/passwd`→404 · `/%2e%2e%2f…`→403 · `/api/now-md?project=%`→404, **server vẫn sống**.

---

### `B2` — Một ngày gõ sai trong **bất kỳ** NOW.json nào là hỏng màn Thống kê

**Bằng chứng:** vòng lặp lấp ngày ở [public/views/stats.js:59](public/views/stats.js:59)
chạy từ ngày `recentlyDone` sớm nhất tới ngày mới nhất, **không có trần**. Chạy lại đúng
vòng đó:

| Dữ liệu | Số cột dựng ra |
|---|---|
| Board bình thường | 1 |
| Một board gõ `2016` thay vì `2026` | **3.653 cột** |
| Một board gõ `2062` | **13.150 cột** |

Mỗi cột là một `<div>` + tooltip + một hàng trong bảng số. Một ký tự gõ nhầm ở *một* dự án
là đủ treo màn Thống kê của *mọi* dự án. Mỉa mai: đây đúng là màn được viết cẩn thận nhất
để "chart không nói dối".

**Sửa:** kẹp cửa sổ (30 hoặc 60 ngày gần nhất), ngày nằm ngoài thì bỏ và **nói ra là đã bỏ**
— im lặng cắt cũng là một kiểu nói dối. Nhân tiện chặn luôn ngày ở tương lai.

**Ước lượng:** 30 phút. **Chặn bởi:** không gì.

**✅ Đã làm** — cửa sổ kẹp ở `MAX_DAYS = 45`, mốc cuối chốt ở hôm nay, và số ngày bị bỏ
được **nói ra** trong dòng phụ của chart. 8 test trong [test/stats.test.js](test/stats.test.js)
khoá lại, gồm cả ca `2016` và ca năm tương lai.

---

### `B3` — Board nằm trong repo cha sẽ khoe git của **người khác**

**Bằng chứng:** [src/collect/git.js:56](src/collect/git.js:56) hỏi
`git rev-parse --is-inside-work-tree` với `cwd` là thư mục board. Lệnh này trả `true` cho
**mọi thư mục con** của một repo, nên một board đặt trong `monorepo/packages/api/` sẽ hiện
nhánh, số file bẩn và độ lệch của **cả monorepo**. Không có chỗ nào so lại với
`git rev-parse --show-toplevel`.

*Chưa xảy ra trên máy này* — tôi đã quét cả 7 board và toàn bộ `~/Projects`: 0 trường hợp
lồng nhau. Nhưng `SCAN_DEPTH = 3` là được thiết kế để lặn vào đúng kiểu thư mục đó.

**Sửa:** so `--show-toplevel` với thư mục board; khác nhau thì gắn cờ `nestedIn` và hiện
"board nằm trong repo `<tên>`" thay vì im lặng mượn số.

**Ước lượng:** 20 phút. **Chặn bởi:** không gì.

**✅ Đã làm** — [src/collect/git.js](src/collect/git.js) so `--show-toplevel` (đã giải
symlink) với thư mục board; lồng thì trả `nestedIn` và **không** mượn số của repo mẹ, màn
Sức khoẻ hiện một dòng giải thích. Trong lúc viết test bắt được luôn một lỗi ở chính bản
sửa đầu: so chuỗi thô làm mọi repo dưới `/tmp` và `/var` (đều là symlink trên macOS) bị
gắn cờ lồng oan.

---

## Nhóm 1 · Chậm, và chậm một cách đo được

### `B4` — 63 tiến trình git mỗi lượt quét, xếp thành 4 tầng tuần tự 🎯 lãi lớn nhất

**Bằng chứng:** đếm bằng shim `git` trong `PATH` — 63 lần spawn, ~54 ms mỗi lần. Riêng
tiền spawn đã là ~3,4 giây. Tệ hơn số lượng là **hình dạng**: mỗi repo đi qua 4 tầng nối
đuôi nhau ở [src/collect/git.js:55](src/collect/git.js:55) — `is-inside-work-tree` → chờ
xong mới `Promise.all` 5 lệnh → chờ xong mới `drift()` (2 lệnh) → chờ xong mới `worktree
list` → rồi `status` từng worktree **trong vòng `for` tuần tự**.

**Sửa — gộp lệnh trước, rồi mới song song:**

1. `git status --porcelain=v2 --branch` trả **một lượt**: tên nhánh, `HEAD` oid, upstream,
   ahead/behind, và danh sách file bẩn. Thay được **5 lệnh** đang chạy riêng
   (`rev-parse --abbrev-ref`, `status --porcelain`, `rev-parse --short HEAD`,
   `rev-parse @{u}`, `rev-list --left-right --count`).
2. Đo lệch bằng `git rev-list --count <mốc>..HEAD`, phân biệt "mốc mất" bằng mã thoát —
   bỏ được lệnh `rev-parse --verify` đi trước.
3. Dồn tất cả còn lại vào **một** `Promise.all`, và `status` của các worktree chạy song song.

**Đích:** 63 → khoảng 25 spawn, và từ 4 tầng xuống 1 tầng. Ước còn **dưới 1 giây**.

**Ước lượng:** nửa ngày (phải viết bộ đọc `porcelain=v2` cho đúng). **Chặn bởi:** nên có
`B11` trước — đây là chỗ dễ sửa đúng cú pháp mà sai ý nghĩa nhất trong cả repo.

**✅ Đã làm** — `B11` xong trước, rồi viết lại `collectGit` thành 3 tầng. Kết quả đo:
**63 → 37 spawn**, `buildMs` **4.084 → 400–769 ms**.

Hai điều chỉnh so với kế hoạch, nói cho đúng:
- **Đích "~25 spawn" tôi hứa là sai** — không đạt được bằng riêng `collectGit`. Sau khi
  gộp, phần "repo chưa có board" chiếm tới 15/44 spawn còn lại, nên phải đọc thẳng tên
  nhánh từ `.git/HEAD` bằng `fs` ([src/state.js](src/state.js)) mới xuống được 37. Con số
  thật là **37**, không phải 25.
- **Bỏ hẳn `driftList`.** Nó tốn một lần `git log` cho mỗi repo mỗi 30 giây và nằm trong
  payload, mà `grep` cả `public/` thì **không màn nào vẽ nó**. `dirtyFiles` được giữ vì
  giờ nó đi kèm miễn phí trong `status --porcelain=v2`.

---

### `B5` — 39 phiên đọc tuần tự từng cái một

**Bằng chứng:** [src/collect/sessions.js:127](src/collect/sessions.js:127) là vòng
`for (const f of files)` với `await` bên trong: mỗi phiên lần lượt `stat` transcript → đọc
đuôi file lấy tiêu đề → `readdir` + đọc từng file todo. 39 phiên, 90 file todo, tổng
556–868 ms — gần như toàn bộ là ngồi chờ đĩa.

**Sửa:** thay bằng `mapLimit(files, 8, …)` — hàm này **đã có sẵn** trong
[src/lib/sh.js:27](src/lib/sh.js:27), chỉ là chưa dùng ở đây.

**Ước lượng:** 20 phút. **Chặn bởi:** không gì. Rẻ nhất trên mỗi mili-giây tiết kiệm được.

**✅ Đã làm** — `mapLimit(files, 8, …)`, và trong mỗi phiên thì đọc tiêu đề với đọc todo
chạy song song bằng `Promise.all`.

---

### `B6` — Một file đổi là dựng lại **toàn bộ** mọi dự án

**Bằng chứng:** mọi watcher ở [server.js:82](server.js:82) đều đổ vào cùng một
`scheduleRefresh()` → `buildState()` đầy đủ. Sửa một dòng trong `NOW.json` của *một* dự án
cũng khiến 7 dự án bị quét lại và 63 tiến trình git chạy lại.

Cần nói cho công bằng: lúc máy rảnh tôi chỉ đo được **1 sự kiện / 45 giây**, nên đây
**không** phải cơn bão sự kiện như tôi đã ngờ ban đầu. Nhưng mỗi sự kiện vẫn tốn nguyên
4–7 giây.

**Sửa:** dựng lại theo dự án — biết file đổi nằm ở thư mục nào thì chỉ chạy `readBoard` +
`collectGit` cho đúng dự án đó rồi vá vào state cũ.

**Ước lượng:** một ngày. **Chặn bởi:** làm **sau** `B4` — nếu một lượt quét đầy đủ đã
xuống dưới 1 giây thì mục này có thể không còn đáng làm nữa. Đừng làm ngược thứ tự.

---

### `B7` — Debounce không có trần chờ

**Bằng chứng:** [server.js:57](server.js:57) `clearTimeout` mỗi sự kiện. Một chuỗi sự kiện
cách nhau dưới 500 ms sẽ đẩy lùi lượt dựng **vô hạn** — `npm install` trong một repo đang
được theo dõi, hoặc một lượt `/now update` ghi cả `NOW.json` lẫn `NOW.md`, là dồn đúng
kiểu đó.

**Sửa:** thêm trần chờ 3 giây (nhớ mốc sự kiện đầu tiên, quá 3 giây thì dựng bất kể).

**Ước lượng:** 15 phút. **Chặn bởi:** không gì.

**✅ Đã làm** — `MAX_WAIT = 3000` trong [server.js](server.js).

---

### `B17` — `USAGE_TTL_MS = 15 s` ngắn hơn nhịp quét 30 s: memo đắt nhất không bao giờ trúng 🎯 lãi/công tốt nhất còn lại

**Bằng chứng — đo 28/7:** lối thoát sớm của `collectUsage`
([src/collect/usage.js:399](src/collect/usage.js:399)) so `Date.now() − scannedAt` với
`USAGE_TTL_MS = 15_000` ([src/config.js:280](src/config.js:280)), còn nhịp quét nền là 30
giây ([server.js:339](server.js:339)) — nên chỉ những lượt dựng dồn dập dưới 15 giây (sự
kiện fs, người bấm ép quét) mới trúng memo, còn nhịp nền thì trượt **mọi lượt**. Giá một
lần trượt, đo cô lập: **568 ms** — khử trùng lặp ~28 nghìn hàng rồi dựng lại bảng
ngày/model/dự án/entrypoint + `efficiencyOf` — **kể cả khi không transcript nào đổi một
byte**; gọi lại trong TTL với cùng đối số: **0 ms**. Đây chính là khoảng cách 210 ↔ 618 ms
giữa các lượt quét trên server sống. (`fileCache` đọc-nối-đuôi theo byte-offset vẫn rất
tốt — thứ bị phí là phần CỘNG LẠI, không phải phần đọc.)

**Sửa:** thay điều kiện thời gian bằng **chữ ký stat**: tập `path:mtime:size` của mọi
transcript — có sẵn miễn phí vì lượt quét nào cũng `stat` từng file rồi. Chữ ký trùng
(kèm `winSig` + `hostCount` như đang so) → trả cache, không cộng lại.

Nói rõ ranh giới kẻo xếp nhầm vào mục *"cache git theo mtime"* đã từ chối ở cuối file:
ở đây `stat` vẫn chạy ĐỦ mỗi lượt, không thêm một giây "dữ liệu có thể cũ" nào — chỉ bỏ
phép cộng khi đầu vào y hệt lượt trước.

**Ước lượng:** nửa buổi (sửa + test chữ ký + đo lại trước/sau). **Chặn bởi:** không gì.

**✅ Đã làm (28/7)** — `inputSignature` trong
[src/collect/usage.js](src/collect/usage.js); `USAGE_TTL_MS` bị xoá khỏi
[src/config.js](src/config.js). Điều kiện dùng lại cache nay là
`ngày | số app chủ | chữ ký cửa sổ | (đường dẫn:offset) của 521 transcript`, sắp xếp
trước khi ghép vì `findTranscripts` đi theo thứ tự `readdir` — không hứa hẹn gì giữa hai
lượt. `offset` lấy thẳng từ `fileCache` mà `scanFile` vừa cập nhật, **không tốn thêm một
lượt `stat` nào**.

Đo A/B trên cùng đầu vào, trong cùng tiến trình, xen kẽ 5 lượt mỗi đường (`force:true` =
đường cũ, tức cộng lại; thường = đường mới, tức chỉ stat):

| | Trung vị | Từng lượt |
|---|---|---|
| Cũ — cộng lại | **241 ms** | 240 · 831 · 242 · 155 · 241 |
| Mới — chỉ stat | **11 ms** | 53 · 15 · 11 · 10 · 11 |

→ **bỏ được ~230 ms mỗi lượt quét không có gì đổi.** Chỗ này chỉnh lại con số ước lượng
"~½ giây" ghi ở trên: 568 ms là số đo hôm audit, đo lại kỹ hôm nay thì phần cộng-lại tốn
**~240 ms**, và đường mới không về 0 mà về ~11–140 ms (giá của lượt `stat` 521 file, tuỳ
cache đĩa còn ấm tới đâu). Vẫn là mục lãi/công tốt nhất, nhưng lãi thật là 230 ms chứ
không phải nửa giây.

Chứng cứ nó đã trúng ở nhịp mà trước đây **không thể** trúng: gọi cách nhau **20 giây**
(dài hơn trần TTL cũ 15 s), lượt cuối trả về `scannedAt` y nguyên — dùng lại cache thật.

Một cái bẫy suýt tự đào: bỏ đồng hồ đi thì phải nhớ **ngày hôm nay** vốn là đầu vào ẩn —
phần dựng chuỗi ngày của chart cắt theo `today`. Không đưa nó vào chữ ký thì đúng 00:00
chart treo lại ở hôm qua cho tới khi có ai đó gõ một câu vào Claude. Đã có test riêng cho
ca này, cùng bốn ca khác, trong [test/usage.test.js](test/usage.test.js).

---

### `B18` — Lượt quét khi không ai xem vẫn trả đủ giá đĩa + git

**Bằng chứng — đo 28/7:** cờ `watched` chỉ tắt hai lượt GỌI MẠNG (Claude/Cursor); phần
còn lại — 45 spawn git, usage, sqlite — chạy đủ mỗi 30 giây kể cả khi 0 tab mở. Giá hiện
trạng: **1,6% một core liên tục ≈ 23 phút CPU/ngày**, phần lớn chi cho những lượt không ai
nhìn. Giãn nhịp KHÔNG làm sổ chu kỳ hạn mức mất mảnh nào — đo rồi:
`collectQuota({watched:false})` trả 0 ms / 0 spawn, tức lúc vắng vốn không có dữ liệu mới
cho `trackQuota` ghi.

**Sửa:** 0 client SSE → giãn nhịp nền 30 giây → 5 phút (watcher fs giữ nguyên); tab đầu
quay lại đã có sẵn `scheduleRefresh(0)` ở [server.js:267](server.js:267) kéo số tươi ngay,
người dùng chờ nhiều nhất ~1–2 giây.

**Ước lượng:** 1–2 giờ. **Ưu tiên:** tuỳ khẩu vị — 1,6% không nóng máy được; chỉ đáng nếu
dashboard chạy 24/7 quanh năm. Ghi vào đây để khỏi phải đo lại.

---

## Nhóm 2 · Trang không được tự nhảy dưới tay người đang đọc

### `B8` — Cứ 30 giây vẽ lại toàn trang, kể cả khi không có gì đổi

**Bằng chứng:** `render()` ở [public/app.js:156](public/app.js:156) chạy mỗi lượt SSE, và
`mount()` thay sạch `innerHTML`. `keepUI()` giữ được vị trí cuộn và các `<details>` đang mở
— nhưng thay `innerHTML` thì **vệt bôi đen và focus bàn phím chắc chắn mất**, cả hai đều
không được chụp lại.

Hệ quả: đang bôi đen một đường dẫn để chép tay → 30 giây sau mất; đang `Tab` tới một cột
chart để đọc tooltip → focus văng về `body`. Trớ trêu là chart được làm rất kỹ cho bàn
phím (`tabindex`, `aria-label`, bảng số song sinh) rồi bị chính vòng vẽ lại phá.

**Sửa:** so `generatedAt` (hoặc băm payload) — không đổi thì bỏ qua hẳn lượt vẽ; có đổi thì
chụp `document.activeElement` + `getSelection()` và trả lại như `keepUI` đang làm với cuộn.

**Ước lượng:** 1 giờ. **Chặn bởi:** không gì.

**✅ Đã làm** — và trong lúc làm mới lộ ra vì sao nó chưa từng hoạt động được nếu chỉ so
payload: giữa hai lượt quét liền nhau, thứ duy nhất lệch là `generatedAt`, `buildMs` và
**`idleMs` của cả 24 phiên**. `idleMs` là `now - lastActivityAt` — một cái *đồng hồ*, không
phải trạng thái — nên bị loại khỏi dấu vân; kèm trần cũ 5 phút để nhãn thời gian không
đứng hình. Đo trên app thật: **4 lượt ép quét → 1 lượt vẽ** (lượt đó dữ liệu đổi thật), và
vệt bôi đen sống sót qua lượt vẽ.

---

### `B9` — Gõ một phím trong ô tìm là vẽ lại cả trang

**Bằng chứng:** [public/app.js:379](public/app.js:379) — `input` gọi thẳng `render()`, kéo
theo cả `renderNav()` và khối quản gia, dù chúng không phụ thuộc ô tìm.

**Sửa:** debounce 120 ms; hoặc chỉ vẽ lại `#view`.

**Ước lượng:** 15 phút. **Chặn bởi:** không gì.

**✅ Đã làm** — debounce 120 ms, và huỷ hẹn giờ đang chờ khi bấm `Esc` hoặc đổi màn (nếu
không nó nổ sau đó và dựng lại đúng bộ lọc vừa bị xoá). Đo trên app thật: **gõ 7 phím →
1 lượt vẽ**.

---

### `B10` — Mọi thứ bấm được đều là `div`/`span`

**Bằng chứng:** nav item ([app.js:98](public/app.js:98)), thẻ dự án, `.qa`, `.orphan`,
`.sst` — tất cả bắt click bằng uỷ quyền trên `document`, không cái nào là `<button>`, không
`role`, không `tabindex`. Bàn phím chỉ tới được qua phím tắt số; trình đọc màn hình không
thấy chúng là thứ bấm được.

**Sửa:** đổi sang `<button type="button">` cho những gì thật sự là hành động, giữ nguyên
uỷ quyền click.

**Ước lượng:** nửa ngày. **Chặn bởi:** ⚠️ **phải chờ áp xong bản redesign** — mục này sửa
markup trong `public/views/**`, đúng chỗ bước 7 của [design/README.md](design/README.md)
sắp viết lại. Làm trước là sửa hai lần.

**✅ Đã làm — và hoá ra bản redesign đã làm gần hết.** Đi kiểm ngày 28/7 để bắt tay vào
sửa thì thấy nav, `.qa`, `.orphan`, `.sst`, nút chép, nút phong cách đều đã là
`<button type="button">` có `aria-label`; tab đã theo đúng khuôn ARIA với roving
`tabindex` ([lib/tabs.js](public/lib/tabs.js)); mọi cột chart và ô có tooltip đều
`tabindex="0"` kèm `aria-label`. Phần còn thiếu thật chỉ là hai nút trong ngăn kéo
([views/overview.js:268](public/views/overview.js:268) và
[:392](public/views/overview.js:392)) chưa ghi `type="button"` — đã thêm.

Đo trên trang thật, quét cả bảy màn bằng script trong trình duyệt: **316 thứ bấm được /
647 chỗ Tab dừng · 0 thứ bấm được mà bàn phím không tới · 0 chỗ Tab dừng mà không có
tên.** Ngoại lệ DUY NHẤT là `article.quest` — bấm cả thẻ để mở board, cố ý không phải
`role=button` vì trong thẻ đã có ba nút, mà nút lồng nút thì trình đọc màn hình đọc ra
một mớ vô nghĩa; lối vào cho bàn phím là nút "xem board đầy đủ" ở cuối thẻ. Lý do đầy đủ
nằm ngay trên chỗ dựng thẻ, [views/overview.js:97](public/views/overview.js:97).

---

## Nhóm 3 · Để lâu thì hết tin được

### `B11` — Không có một dòng test nào

**Bằng chứng:** không có `test/`, không `.github/`, `package.json` không có script `test`.
Với một dự án lấy **"mọi con số phải có thật"** làm tuyên ngôn thì đây là lỗ hổng lớn nhất
về lâu dài — không có gì chặn một lượt refactor làm lệch âm thầm mấy con số đó.

Node có sẵn `node:test`, giữ nguyên được lời hứa zero-dep. Thứ tự đáng test:

1. `doneByDay()` / `coverage()` — chính là `B2`, và là chỗ dễ nói dối nhất.
2. Phát hiện phiên sống — `procStart` (UTC) đối `ps lstart` (giờ máy), cái bẫy **đã sập một
   lần rồi** ([src/collect/sessions.js:31](src/collect/sessions.js:31)).
3. `validateNow()` — đang chép tay luật của `now.schema.json`; hai bên lệch nhau lúc nào
   không ai biết.
4. `scaleFor()`, `integrity()`, `streak()` — thuần hàm, test rẻ.

**Ước lượng:** một ngày cho bộ đầu tiên. **Chặn bởi:** không gì, và nên đi **trước `B4`**.

**✅ Đã làm** — **39 test**, `npm test`, không thêm một gói nào:
[stats](test/stats.test.js) 8 · [git](test/git.test.js) 9 · [now](test/now.test.js) 6 ·
[sessions](test/sessions.test.js) 5 · [chart+shared+game](test/chart.test.js) 11.

Hai chỗ đáng nói:
- **`git.test.js` chạy trên repo git THẬT** dựng trong thư mục tạm (commit, worktree, thư
  mục con lồng). Mock `git` đi thì test chỉ khẳng định mock khớp mock — mà cái cần giữ ở
  đây chính là "đọc đúng output của git".
- **Đã kiểm đột biến**: cố tình bỏ trần `MAX_DAYS` và cố tình quay lại so chuỗi thô trong
  `repoRootOf` → 1 và 6 test đỏ đúng chỗ, trả lại thì xanh. Một bộ test chưa bao giờ đỏ là
  một bộ test chưa biết có bắt được gì không.

---

### `B12` — `engines` hứa Node ≥ 20, máy đang chạy 18.10.0

**Bằng chứng:** `node -v` → `v18.10.0`; `package.json:12` → `">=20"`; README dòng 58 cũng
ghi "chỉ Node ≥ 20". Hiện chưa gãy gì — nghĩa là con số 20 chưa từng được kiểm.

**Sửa:** chạy thử trên 18, được thì hạ `engines` xuống `>=18` và sửa README; không được thì
ghi rõ chỗ nào cần 20. Một lời hứa chưa kiểm là một lời hứa sai.

**Ước lượng:** 15 phút.

**✅ Đã làm** — `engines` xuống `>=18.10`, README sửa theo. `grep` toàn repo: không dùng
API nào của Node 20 (`Object.groupBy`, `toSorted`, `fs.glob`…), nên con số 20 chỉ là một
lời hứa chưa ai kiểm.

---

### `B16` — Dashboard ký sinh phiên Claude, chết theo khi phiên đó chết

**Bằng chứng — xảy ra thật hôm nay (2026-07-27), không phải giả định:** pid server cũ
**22352** chết → dashboard chết theo; pid mới **30572** lên thay nhưng vẫn là tiến trình
con của helper Claude.app, tức vẫn ký sinh y hệt. `autoPort` cấp cổng **3000**, trong khi
app trên Dock cố định trỏ **4400** — cổng đó chưa từng sống, icon Dock hỏng từ đầu chứ
không phải mới hỏng hôm nay.

**Sửa:** chạy [bin/now-dash](bin/now-dash) như service độc lập qua `launchd` (tự lên khi
đăng nhập, không làm con của bất kỳ phiên Claude nào) và ghim cổng cố định (4400) thay vì
`autoPort`.

**Ước lượng:** nửa ngày (viết `plist`, kiểm tự khởi động lại sau khi máy khởi động lại,
xác nhận cổng cố định sống). **Chặn bởi:** không gì.

**✅ Đã làm (28/7)** — [launchd/dev.hoanluu.now-dash.plist](launchd/dev.hoanluu.now-dash.plist)
(bản gốc trong repo, chép sang `~/Library/LaunchAgents/`) + [bin/now-dash-service](bin/now-dash-service).

Trước: `ppid` của server là helper của Claude.app — kiểm lại trước khi sửa thì đúng y
nguyên chuỗi cũ, `95475 ← disclaimer ← Claude.app`. Sau: **`ppid = 1`**, treo thẳng dưới
launchd, `RunAtLoad` + `KeepAlive`. Cổng ghim `NOW_PORT=4400` ngay trong plist.

Nửa mục về cổng thì hoá ra đã tự xong từ trước: `autoPort` không còn trong code,
[src/config.js](src/config.js) đã ghim 4400 — phần ghi trong mục này đã cũ.

Ba thứ chỉ lộ ra lúc làm, đều là loại hỏng-im-lặng:

- **launchd không nạp shell profile.** PATH mặc định chỉ có bốn thư mục hệ thống; thiếu
  nó thì `git`/`ps`/`sqlite3`/`security` trả rỗng và mọi repo trên trang thành "chưa phải
  repo git". Đã khai PATH trong plist. Kiểm sau khi lên: **9/9 repo đọc được nhánh**, và
  hạn mức vẫn `source:"api"` — tức Keychain vẫn mở được từ phiên launchd.
- **`command -v node` trỏ nhầm bản.** PATH của launchd có `/usr/local/bin`, ở đó là node
  **v18.10.0** đời cũ, trong khi terminal chạy **v24.14.1** của nvm. Lần bootstrap đầu
  service chạy đúng bản cũ ấy mà không báo gì. `find_node` nay để **nvm đứng trước PATH**.
- **`bin/now-dash` chính là chỗ đẻ ra ký sinh.** Nó `nohup node server.js &` từ terminal
  (hoặc từ phiên Claude) gọi nó. Đã đổi: chỉ còn MỘT nơi được dựng server là launchd.

Chưa kiểm được: tự lên sau khi khởi động lại máy (`RunAtLoad` có trong plist, nhưng chưa
reboot). Việc "sống sót khi Claude.app thoát" thì `ppid = 1` đã là chứng cứ đủ — nó không
còn nằm trong cây tiến trình của Claude.app nữa.

---

### `B13` — `run()` nuốt mọi lỗi, nên "không phải repo" và "git hỏng" trông y hệt nhau

**Bằng chứng:** [src/lib/sh.js:7](src/lib/sh.js:7) trả chuỗi rỗng cho **mọi** thất bại —
timeout 4 giây, không có `git`, không đủ quyền, repo hỏng. Lên tới giao diện tất cả thành
một dòng "chưa phải repo git". Đúng tinh thần "một repo hỏng không được làm sập cả trang",
nhưng khi thật sự có gì đó hỏng thì không có đường nào lần ra.

**Sửa:** trả kèm lý do (`{ out, failed, reason }`), gom vào state, hiện ở màn Sức khoẻ.
Không đổi hành vi chịu lỗi.

**Ước lượng:** 1 giờ.

### `B14` — 116 KB SSE mỗi 30 giây mỗi tab

**Bằng chứng:** payload chứa cả `dirtyFiles`, `driftList` và **toàn bộ** `now` board của
mọi dự án, dù màn Dự án chỉ dùng tới `focus` và mấy con số đếm — phần còn lại chỉ ngăn kéo
mới cần.

**Sửa:** đẩy phần nặng sang `/api/project/<id>` nạp khi mở ngăn kéo.

**Ước lượng:** 2 giờ. **Ưu tiên thấp** — 116 KB qua localhost là rẻ; chỉ đáng làm nếu sau
`B8` vẫn thấy giật.

**Cập nhật 28/7 — số tiếp tục trôi, và tìm ra hàng đúp:** 119,5 → 318 (27/7) →
**322,6 KB**. Mổ theo khoá: `projects` 76,5 · `usage` 56,2 · `antigravity` 42,5 ·
`unassignedConvos` 35,8 KB. Phát hiện mới: phiên và hội thoại bị serialize **hai lần** —
cùng object nằm ở `state.sessions` *và* `projects[].sessions`
([src/state.js:249](src/state.js:249)), hội thoại nằm ở `antigravity.convos` *và*
`projects[].convos`/`unassignedConvos` ([src/state.js:264](src/state.js:264)) — cỡ ~11%
payload là hàng đúp. Phía nhận vẫn khoẻ (parse 2,4 ms) nên giữ nguyên ưu tiên thấp; nhưng
nếu đụng tới thì bước một rẻ nhất là bỏ hàng đúp bằng tham chiếu id (ước −15% payload),
TRƯỚC khi nghĩ tới `/api/project/<id>` như đặc tả gốc.

---

### `B15` — Lần nạp đầu: trang trống mấy giây mà không nói gì đang xảy ra

**Bằng chứng — bắt được trong lúc kiểm bản redesign, chụp màn hình hai lần cách nhau vài
giây:** mở `localhost:4400` ngay sau khi khởi động server thì thấy khung, thanh bên, và
một khối tóm tắt **rỗng** chỉ có nhãn; dòng phụ đứng ở chữ `đang nói...` viết cứng trong
[public/index.html](public/index.html). Kéo dài đúng bằng lượt quét đầu — đo được **4,1
giây** ở lần nạp vừa rồi (và tới **5,5 giây** khi vừa sửa file xong nên cache đĩa nguội).

Server đã cố ý mở cổng trước khi quét xong (đúng, xem chú thích ở cuối `server.js`) — nên
trình duyệt vào được ngay và thấy một trang trông như đã hỏng. Đây chính là biến thể lần-
đầu của nguyên tắc *"dữ liệu chết phải trông khác dữ liệu sống"*: lúc mất kết nối thì đã
có dải cảnh báo kèm giờ chụp, còn lúc **chưa từng có dữ liệu** thì không có gì cả.

**Sửa:** `/api/ping` đã trả sẵn `ready: false` — dùng đúng cờ đó để hiện một dòng "đang
quét lần đầu…" ở chỗ khối tóm tắt, và bỏ chữ `đang nói...` viết cứng.

**Ước lượng:** 30 phút. **Ưu tiên:** làm cùng `B10` — cùng đụng markup, và cùng là chuyện
"trang nói cho người dùng biết nó đang ở trạng thái nào".

**✅ Đã làm (28/7)** — `startBoot` / `probeBoot` / `renderBoot` trong
[public/app.js](public/app.js), chuỗi ở khoá `boot.*` của
[public/lib/i18n.js](public/lib/i18n.js). Chữ `đang nói...` thì bản redesign đã bỏ từ trước;
thứ còn lại đúng là khung rỗng.

Làm rồi mới lộ ra ca nặng hơn cả cái đã ghi: `setPulse` **giấu dải cảnh báo mất kết nối
khi chưa có `app.state`** ([app.js:132](public/app.js:132) — `hidden = ok || !app.state`).
Nghĩa là server không chạy thì trang đứng **trắng vĩnh viễn**, không một chữ nào, không
phải chỉ trống 4 giây. Nên có ba câu chứ không phải một, phân biệt bằng `/api/ping`:

| Tình trạng | Câu | Việc người dùng phải làm |
|---|---|---|
| `ready:false` | "Đang quét lần đầu" | ngồi chờ 4–6 giây |
| `ready:true` mà tab chưa nhận được gì | "Đang chờ số từ server" | tải lại trang |
| ping chết | "Chưa nối được tới server" | gõ `./bin/now-dash` |

Hai chi tiết đáng giữ: khối quản gia bị **ẩn hẳn** chứ không để khung rỗng — cái khung
mang nhãn "Các việc đáng làm lúc này" với chỗ trống bên dưới đọc ra thành *"không có việc
nào đáng làm"*, tức một câu trả lời sai chứ không phải một chỗ chưa có câu trả lời. Và
lượt vẽ bị hoãn **300 ms**: server ấm thì SSE về sau vài chục mili-giây, một câu "đang
quét" loé lên rồi tắt còn khó chịu hơn khoảng trống nó định lấp.

Kiểm bằng bệ thử giữ `/api/stream` im lặng vĩnh viễn (server thật quét xong trong 2–3
giây, không chụp kịp): cả ba pha ra đúng câu của nó.

---

## Nhóm 4 · Việc đã duyệt, chờ thi công

### `B19` — Màn "Nhìn lại" (phím 8): hai vòng thi công còn lại 🎯 việc kế tiếp

**Bối cảnh — không phải tối ưu mà là tính năng, vào backlog theo yêu cầu 28/7 (tối):**
đề xuất phỏng vấn-trước-viết-sau đã duyệt cùng tối, spec ở
[docs/PROPOSAL-nhin-lai.md](docs/PROPOSAL-nhin-lai.md) (12 quyết định phỏng vấn nằm trong
đó), bố cục và chữ theo [design/mock-nhin-lai.html](design/mock-nhin-lai.html) — **mock là
hợp đồng**, làm khác phải quay lại hỏi. Mục gấp nhất của đề xuất (tracker sổ chu kỳ) đã
làm xong ngay tối duyệt: hai sổ mới `ag-cycles.json` / `cursor-cycles.json` đang tự dày
mỗi lượt quét ([src/collect/cycletrack.js](src/collect/cycletrack.js), test 314/314), chu
kỳ AG tuần 29/7 cứu kịp trước reset (Gemini đỉnh 94,3%). Sổ đang ghi mà chưa màn nào đọc
— để nguyên thì mọi quyết định giữ/hạ ba gói $240/tháng vẫn dựa trên trí nhớ.

**Việc, đúng hai vòng của đề xuất:**

1. **Ngày 1 — server:** `src/lib/cycles.js` (hàm thuần: tiền $46,0/cửa sổ 7 ngày Claude ·
   $4,60/tuần túi Gemini · cents thật cho Cursor; dự phóng; cổng-3-tuần cho khối xu
   hướng) + `src/collect/lookback.js` đọc 5 sổ → `state.lookback` (chỉ mảng đã gấp, vài
   KB — không nuôi `B14`) + `PLANS` trong config + test.
2. **Ngày 2 — client:** `public/views/lookback.js` + nav thứ 8 + khoá i18n `lookback.*`
   đủ hai bên (parity test tự gác) + đối chiếu mock + nghiệm thu **EN × hai nền** trên
   dữ liệu thật.

**Rủi ro đã ghi trước** (mục 6 của đề xuất, nhớ nhất một cái): cents của `cursor-events`
chưa chắc là tiền BỊ TÍNH — June cộng ra ≈ $236 trên gói $20 — phải đối chiếu với
`planUsage` trước khi vẽ tiền quá khứ Cursor; không khớp thì chu kỳ cũ chỉ hiện events.

**Ước lượng:** 2 ngày (~120–180k token output cho phiên làm). **Chặn bởi:** không gì —
tracker đã chạy trước; khối C tự mở ~17/8 theo tuổi sổ, không chặn việc dựng màn.

---

## Còn lại làm gì

**Cập nhật 2026-07-28 (chiều)** — làm xong ba mục đầu của danh sách sáng nay: `B16`,
`B17`, `B10`+`B15`. Số trước/sau nằm trong khối ✅ của từng mục. Hai chỗ trong file này đã
**cũ so với code** và đã được ghi lại ngay trong mục: `autoPort` (đã hết từ trước) và
phần lớn `B10` (bản redesign đã làm rồi).

**Cập nhật 2026-07-28 (tối)** — thêm **`B19`** (Nhóm 4): phần thi công màn "Nhìn lại" sau
khi đề xuất được duyệt và tracker sổ chu kỳ đã lên ngay trong tối. Nó đứng TRƯỚC bốn mục
dưới: việc duy nhất trong hàng đã có spec + mock làm hợp đồng, và sổ nó cần thì đang dày
lên mỗi lượt quét. Bốn mục cũ giữ nguyên thứ tự:

1. **`B13` — `run()` trả kèm lý do.** Rẻ, và nó là điều kiện để chẩn đoán mọi thứ khác.
   Lên đầu bảng sau khi `B16` xong — chính lúc dựng service mới thấy rõ cái giá của nó:
   chạy nhầm node v18.10.0 và thiếu PATH đều là hỏng-im-lặng, `run()` nuốt sạch, phải
   đi dò tay từng cái mới ra.
2. **`B14` — cắt payload.** Số 28/7: **322,6 KB**, trong đó ~11% là hàng đúp
   phiên/hội thoại (xem cập nhật trong mục). Phía nhận vẫn khoẻ (parse 2,4 ms) nên chưa
   bức bách; nếu làm, bước một là bỏ hàng đúp, chưa cần `/api/project/<id>`.
3. **`B18` — giãn nhịp quét khi vắng người xem.** Tuỳ khẩu vị: 1,6% một core không nóng
   máy được; chỉ đáng nếu dashboard chạy 24/7 quanh năm. `B17` vừa cắt bớt một phần cái
   giá đó — nhịp quét lúc vắng người nay rẻ hơn ~230 ms mỗi lượt, nên mục này còn ít
   đáng làm hơn trước.
4. **`B6` — dựng lại theo từng dự án.** Vẫn **hoãn vô thời hạn** như chốt 27/7 — chi phí
   nặng là quét NGUỘI, trả một lần, không phải cái tốn mỗi-30-giây từng sinh ra `B6`.
   Số 28/7 chỉnh lại một ý của 27/7: nguội đo 5,4 s với `watched:false`, tức KHÔNG cần
   hai collector mạng cũng đã 5,4 s — thủ phạm nguội là 3,4 s parse JSONL usage + 113
   lượt `sqlite3`, không phải mạng. `B17` không đổi được phần nguội (lần đầu thì phải đọc
   thật), nên mục này vẫn chỉ mở lại nếu quét nguội vượt hẳn khỏi vùng chấp nhận được.

## Cố ý **không** đưa vào backlog

Ghi lại để lần sau khỏi bàn lại:

- **Kéo thư viện chart / framework UI về.** Zero-dep là quyết định có chủ ý và đang trả
  công tốt (`npm install` = 0 giây, không có gì để mà lỗi thời). Không có mục nào ở trên
  cần tới thư viện.
- **Cache git theo mtime của `.git`.** Đúng là nhanh hơn, nhưng thêm một tầng "dữ liệu có
  thể cũ" vào đúng cái dashboard tồn tại để nói cho bạn biết dữ liệu nào đã cũ. `B4` đạt
  cùng mức lãi mà không phải nói dối. Chỉ quay lại mục này nếu `B4` chưa đủ.
- **Viết lại phần vẽ bằng DOM diff.** `B8` (bỏ qua lượt vẽ khi không có gì đổi) lấy được
  hầu hết cái lợi với 1/20 công. Diff chỉ đáng bàn khi state đã đổi thật mà vẫn giật.
- **Ghi vào `NOW.json` từ dashboard** (kiểu bấm nút là chốt quyết định). "Chỉ đọc, không
  bao giờ ghi" là ranh giới giữ cho `/now update` là nguồn sự thật duy nhất. Đây là thay
  đổi kiến trúc, không phải tối ưu — muốn làm thì mở một quyết định riêng trên NOW board.
