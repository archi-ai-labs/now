# Kiến trúc — NOW dashboard

*🇻🇳 Tiếng Việt · 🇬🇧 [English](ARCHITECTURE.md)*

Bản đồ file, nguồn dữ liệu, và bốn cạm bẫy đã từng sập. Vì sao thiết kế trông thế này xem
[DESIGN.vi.md](DESIGN.vi.md); khối hạn mức xem riêng [QUOTA.vi.md](QUOTA.vi.md).

## Nó đọc gì

Tất cả đều là file có sẵn trên máy — dashboard **chỉ đọc, không bao giờ ghi**.

| Nguồn | Cho ra |
|---|---|
| `~/Projects/*/*/NOW.json` | focus, next action, quyết định, chờ ai, hàng đợi, vừa xong |
| `~/.claude/sessions/<pid>.json` | phiên đang sống: pid, cwd, tên, lúc mở |
| `~/.claude/projects/<cwd>/<uuid>.jsonl` | tên phiên (`customTitle`/`aiTitle`) + hoạt động cuối |
| `~/.claude/tasks/<sessionId>/*.json` | danh sách việc của từng phiên |
| `git` | nhánh, file chưa commit, số commit lệch khỏi mốc board, worktree phụ |
| `ps -eo pid,ppid,lstart,args` | app CHỦ của mỗi phiên — Cursor, VS Code, Antigravity, Terminal hay Claude Desktop |
| `~/Library/…/{Cursor,Code}/User/globalStorage/storage.json` | thư mục các editor đang mở (`backupWorkspaces`) |
| `~/.gemini/antigravity/agyhub_summaries_proto.pb` | hội thoại Antigravity: tiêu đề, workspace, số bước, mốc tạo/cập nhật |
| `~/.gemini/antigravity/conversations/<id>.db` | mtime = lần ghi cuối của hội thoại đó |

Nguồn sự thật vẫn là `/now update` chạy trong chính dự án. Dashboard là cái gương,
không phải cái bút.

### Bậc gói — ba nguồn, ba mức tin cậy

Hạn mức trả lời *"đã tiêu bao nhiêu phần"*; bậc gói trả lời *"bao nhiêu phần **của cái
gì**"*. Không nguồn nào gửi mẫu số kèm phần trăm, nên thiếu bậc gói thì 58% hôm nay và
58% tháng trước không so được — nâng gói xong là cả lịch sử lặng lẽ đổi nghĩa.

| Công cụ | Đọc ở đâu | Server tự khai tên gói? |
|---|---|---|
| Claude | `~/.claude.json` → `oauthAccount.organizationRateLimitTier` | có |
| Antigravity | RPC `GetUserStatus` ở localhost → `planInfo.planName` | có |
| Cursor | **suy ra** từ `planUsage.includedSpend` ($20 → Pro) | **không** |

Chip Cursor vì thế mang **viền chấm** thay vì viền liền, và tooltip nói thẳng nó là phép
tra ngược bảng giá. Nét chứ không phải màu — theme daltonized làm đỏ/lục hết phân biệt,
nên màu không bao giờ được là kênh duy nhất chở một khác biệt có thật.

**Chỗ sẽ hỏng trước, và hỏng im lặng:** bảng giá Cursor (`CURSOR_PLANS` trong
[`src/collect/plans.js`](../src/collect/plans.js)). Anysphere đổi giá hoặc thêm bậc là cái
tên sai mà không có gì báo. Đã chọn cách hỏng an toàn: giá không tra được thì in đúng số
đo được (`$25/tháng`) chứ không đoán tên — một con số không tên vẫn đúng, một cái tên
đoán sai thì người đọc mang đi đối chiếu hoá đơn rồi kết luận cả dashboard hỏng.

**Hai chỗ KHÔNG được đọc, dù chúng có vẻ đúng chỗ hơn:**

- `platform.claude.com/api/oauth/usage` — không có một trường nào về gói. Đo trên máy
  này: đủ `five_hour`, `seven_day`, `limits[]`, `extra_usage`, `spend`, không chữ tier nào.
- **Keychain** `claudeAiOauth.rateLimitTier` — CÓ trường, và nó **cũ**. Máy này đọc ra
  `default_claude_max_5x` trong khi tài khoản đang là Max 20x: giá trị ghi lúc đăng nhập
  rồi nằm im, nâng gói không viết lại nó. Sai kiểu tệ nhất — đúng định dạng, đúng kiểu,
  chỉ sai nội dung, nên không phép kiểm tra nào bắt được ngoài đối chiếu bằng mắt với app.

Ngoại lệ duy nhất của "chỉ đọc": `~/.now-dashboard/` — sổ riêng của dashboard (tổng
token theo ngày, ảnh chụp hạn mức, và sổ app chủ của từng phiên). Không bao giờ ghi
vào `~/.claude` hay vào thư mục dự án.

## Ba bề mặt làm việc

![Ba bề mặt làm việc gộp vào một dashboard](assets/surfaces.vi.svg)

Máy này chạy ba thứ cùng lúc, và chúng **không cùng loại** — sở chỉ huy phải đo mỗi
thứ bằng đúng đơn vị của nó:

| Bề mặt | Đơn vị | Có tiêu token Claude không |
|---|---|---|
| Claude Desktop · Terminal | phiên Claude Code | có |
| Cursor · VS Code | thư mục đang mở, cộng phiên Claude Code chạy bên trong | có |
| Antigravity | hội thoại của agent riêng | **không** — nó không đụng gì tới Claude Code |

Từ thẻ dự án bấm được thẳng "mở trong Cursor / Antigravity"; danh sách app cho phép
khoá cứng ở `server.js`, không nhận tên tự do từ client.

## Ba chỗ dễ làm sai

Khối hạn mức có cạm bẫy riêng của nó (thang màu hai chiều, cách trừ "cạn trước reset") —
xem [QUOTA.vi.md](QUOTA.vi.md). Ba chỗ dưới đây là về phiên và host.

**1. Phiên sống hay đã chết.** `~/.claude/sessions/` không tự dọn. Kiểm tra bằng
`kill -0 <pid>` sẽ báo sống cho cả những file mà PID đã được hệ điều hành cấp lại cho
tiến trình khác. Phải đối chiếu thêm thời điểm khởi động tiến trình.

**2. `procStart` ghi theo UTC, `ps lstart` in theo giờ địa phương.** So chuỗi trực tiếp
thì **không phiên nào khớp** (lệch đúng 7 tiếng ở máy này). Phải quy về epoch rồi so,
cho phép sai lệch 2 giây — xem [`src/collect/sessions.js`](../src/collect/sessions.js).

**3. `claude-vscode` là MỘT cái tên cho BA cái editor.** VS Code, Cursor và mọi bản
fork khác đều dùng chung extension nên transcript ghi y hệt nhau — trên máy này đó là
29% lượng token đứng dưới một nhãn không phân biệt được gì. Thứ duy nhất tách được
chúng là cây tiến trình, mà cây tiến trình thì chết theo phiên; nên
[`src/collect/hosts.js`](../src/collect/hosts.js) chốt app chủ vào sổ ngay khi còn nhìn
thấy phiên sống. Phần lịch sử cũ vẫn nằm ở "Editor chưa rõ" và màn Token **nói ra tỉ lệ
đó** thay vì gộp bừa.

## Cấu trúc

```
server.js              HTTP + SSE, zero-dep; theo dõi fs, gom sự kiện, quét lại mỗi 30s
src/config.js          ngưỡng sức khoẻ, đường dẫn, cổng
src/state.js           gộp mọi nguồn thành một snapshot; gắn phiên vào dự án; gửi mốc mở
                       của từng cửa sổ hạn mức sang lượt quét token rồi gắn tiền ngược lại
src/collect/now.js     quét NOW.json, validate schema v1, chấm sức khoẻ
src/collect/sessions.js  phát hiện phiên sống thật + tên phiên + hoạt động cuối
src/collect/procs.js   một lượt `ps` dùng chung: chống PID tái dùng + tìm app chủ
src/collect/hosts.js   sổ "phiên nào chạy trong app nào", để quy token về đúng editor
src/collect/antigravity.js  hội thoại Antigravity, đọc từ protobuf không có tài liệu
src/collect/agturns.js từng lượt gọi model của Antigravity — mốc thời gian, model, ngữ
                       cảnh; đọc bảng gen_metadata trong SQLite của từng hội thoại
src/collect/cursor.js  hạn mức gói Cursor + nhịp trong editor (dòng nhận, tỉ lệ Tab)
src/collect/cursorevents.js  sổ từng lượt gọi Cursor — trục thời gian; kéo ở NỀN, ghi đè
                       hai ngày cuối mỗi lượt, chốt vào ~/.now-dashboard/cursor-events.json
src/collect/editors.js thư mục Cursor/VS Code đang mở
src/collect/git.js     nhánh, độ lệch, file bẩn, worktree phụ
src/collect/tasks.js   todo của từng phiên
src/lib/pb.js          bộ đọc protobuf mức dây, không cần .proto
src/pet.js             sổ xu của quản gia nuôi được: 1 xu = $1 tiêu ước tính, cộng theo
                       NGÀY nên làm mới trang không đẻ xu; bảng giá hàng hoá; cơn đói
                       tính từ mốc cho ăn. Chốt vào ~/.now-dashboard/pet.json
public/app.js          khung: định tuyến, phím tắt, ngăn kéo, giữ cuộn qua mỗi lượt vẽ; bỏ
                       qua lượt vẽ #view trùng HTML, hoãn lượt vẽ khi tab khuất
public/lib/dom.js      template html/esc/raw; mount() là chỗ duy nhất ghi HTML, dời style
                       nội tuyến khai hay đọc biến CSS sang class dùng chung, và dùng lại
                       thẻ table; setVars(); phase(); định dạng giờ và clipboard. Xem mục
                       "Ghi vào DOM" bên dưới
public/lib/butler.js   giọng quản gia: HAI ô cố định — việc đáng làm + hạn mức token
public/lib/game.js     số đo được thẳng: streak, done7, tình trạng dự án bằng chữ
public/lib/chart.js    cột / vùng / kẹo mút / thanh / quạt tròn / treemap, HTML-CSS thuần
public/lib/skin.js     phong cách vẽ chart + hàng rào "hình nào hợp với kiểu dữ liệu nào"
public/lib/quota.js    hạn mức đọc thành câu: đã tiêu, bỏ phí, thang màu, mốc reset, tiền
                       ước tính của cửa sổ — đích là tiêu hết
public/lib/tip.js      định dạng tooltip nhãn ↔ trị, nhét vừa một thuộc tính HTML
public/lib/surface.js  tên và ký hiệu của từng bề mặt làm việc
public/lib/tabs.js     tab của màn Token: trạng thái sống ngoài DOM, nhớ qua localStorage
public/lib/pixel.js    phép vẽ pixel lưới 4px + chấm bóng theo hướng nắng, dùng chung cho
                       quản gia và đồ vật (tách riêng để hai bên khỏi nhập vòng)
public/lib/pet.js      hình đồ ăn / đồ trang trí + thanh đói. Mã món phải khớp bảng giá ở
                       src/pet.js — test/pet.test.js canh đúng chỗ khớp ấy
public/styles.css      hệ thiết kế HUD (tokens, khung góc, thanh đo)
public/views/          7 màn, mỗi màn một file — trừ views/tools.js là nửa Cursor +
                       Antigravity của màn Token, không phải một màn riêng
```

`/api/now-md?project=<id>` trả toàn văn `NOW.md`; bản dựng markdown tối thiểu nằm
ngay trong `app.js` — chỉ đủ tiêu đề, gạch đầu dòng, đậm/nghiêng, `code`, trích
dẫn, đúng những gì `/now update` sinh ra. Không kéo thư viện về chỉ để hiện một
file mình tự sinh; nội dung được escape trước rồi mới nhận diện cú pháp.

## Ghi vào DOM

Mọi file trong `public/` tuân theo ba luật, và `test/dom.test.js` quét mã nguồn để canh cả
ba:

1. **Mọi lần ghi HTML đi qua `mount()`** trong [`public/lib/dom.js`](../public/lib/dom.js).
   Không chỗ nào khác được dùng `innerHTML =`, `insertAdjacentHTML`, `DOMParser` hay
   `document.write`.
2. **Biến CSS (custom property) đặt từ JS đi qua `setVars()`**, không qua
   `style.setProperty('--x', …)` hay một thuộc tính `style` tự ghép. Chỉ vài chỗ đã xét tay, có
   tên trong test, được chạm `element.style`: đọc nó là WebKit đổi phần tử sang style nội tuyến
   sửa được, loại không bao giờ vào cache.
3. **Giá trị chỉ dùng để khoá pha hoạt hình vào đồng hồ tường được bọc bằng `phase()`**, ví dụ
   `--now` của `lifeClock` hay `animation-delay` âm của người qua đường. Mọi `Date.now()` đổ vào
   một thuộc tính `style` đều phải được bọc.

**Lý do nằm ở một cache style không bao giờ co lại trong WebKit của Safari.** Mỗi resolver
giữ một `MatchedDeclarationsCache` có khoá gồm cả *địa chỉ* bộ biến CSS mà phần tử thừa kế từ
cha, và một mục chỉ bị dọn khi một khối khai báo của nó không còn ai giữ, điều không bao giờ
xảy ra với khai báo của `styles.css`. Phần tử tự khai biến trong thuộc tính `style` thì mỗi lần
dựng lại mang một bộ biến mới, nên mỗi con cháu của nó để lại một mục vĩnh viễn cỡ 1 KB sau mỗi
lượt vẽ. Tích đủ thì Safari tải lại web app trên Dock với câu "because it was using
significant memory".

WebKit ghi nhận lỗi này là bug 312236. Bản vá (commit `ebcf88c1bc`) chỉ đặt trần 16 nghìn mục
trên nhánh main, còn Safari 17.6 không có trần nào.

Vì vậy `mount()` dời trọn mỗi thuộc tính `style` có khai biến vào một luật sinh sẵn dùng chung
(`.nv-12 { --a: x !important; width: 3px !important }`) trong một stylesheet dựng sẵn
(constructed stylesheet) gắn vào document, rồi gắn class ấy cho phần tử. Thuộc tính giống hệt
nhau dùng chung một luật qua mọi lượt vẽ, nên phần tử dựng lại vẫn trỏ về cùng một khối khai báo
và cache thôi mọc. Sổ class có trần, và khi vượt trần thì luật của class không còn trong
document bị xoá.

`setVars()` áp đúng luật ấy cho giá trị đặt từ JS. `!important` đứng thay thứ bậc của style
nội tuyến nhưng không giữ được thứ bậc ấy trước hoạt hình CSS hay trước một luật `!important`
có sẵn, nên thuộc tính thường đi chung thuộc tính `style` với biến không được bị `@keyframes`
đổi hay bị CSS khai `!important`. Cùng file test canh điều này và ghi tên các ngoại lệ đã được
xét tay. Giá trị chứa `revert-layer` hay `revert-rule` không bao giờ được dời, vì trong một luật
`!important` hai từ khoá ấy lùi qua cả những luật thường mà style nội tuyến lùi về.

Hai hiệu ứng khác của WebKit cũng định hình `mount()`:

- **Thuộc tính `style` đọc biến cũng được dời.** WebKit gộp các khối style nội tuyến giống hệt
  nhau, trừ khối có giá trị `var()` hay `env()`, vì giá trị ấy không băm được. Phần tử như vậy
  sẽ mang khối mới, trượt cache và thêm một mục ở mọi lượt vẽ, tới một phút sau mới được dọn, nên
  `color:var(--dim)` được dời sang class như một biến tự khai.
- **Thẻ `<table>` được dùng lại.** Mỗi thẻ table của WebKit tạo một khối khai báo chung cho mọi
  ô của nó, nên thẻ table mới làm mọi ô trượt cache, và một bảng có cả ô `th` lẫn `td` để lại
  những mục lượt dọn không bao giờ bỏ được. `mount()` thay mỗi thẻ table vừa dựng bằng thẻ table
  nó đã tạo ở cùng thứ tự trong lần ghi trước, rồi chuyển thuộc tính và con của thẻ mới sang
  thẻ cũ. Mẫu HTML không được đặt `border`, `frame`, `rules` hay `cellpadding` cho thẻ table, vì
  đổi bốn thuộc tính ấy là thay khối chung.

Mỗi luật `mount()` chèn thêm làm WebKit dựng lại resolver và tính lại style cả trang, đo được
24 ms ở màn Dự án và 49 ms ở màn thị trấn. Vì vậy giá trị pha được bọc bằng `phase()`: chúng đổi
ở mọi lượt vẽ, nhưng lượt vẽ `#view` chỉ khác chúng được bỏ qua, vì DOM đang chạy đã ở đúng pha
ấy. Popover (`public/menubar.js`) không so nên dựng lại ở mọi lượt vẽ, và mỗi lần mở chỉ vẽ vài
lượt. `phase()` trả một giá trị `raw`, nên nó chỉ dùng được bên trong template `html`. `esc()`
viết hai ký tự dấu bọc (U+E000, U+E001) thành thực thể, nên chữ đọc từ đĩa đã qua `esc()` không
bao giờ bị hiểu nhầm là giá trị pha.

Hai hành vi trong `public/app.js` dựa trên nền ấy:

- **Bỏ qua lượt vẽ trùng HTML.** `render()` vẫn gọi hàm vẽ của màn ở mọi lượt, nhưng khi chuỗi
  `#view` trùng từng byte với lần `mount()` ghi trước, không kể giá trị `phase()` (`unchanged()`),
  thì DOM được giữ nguyên.
  Cache không nhận phần tử mới nào, focus, vệt bôi đen và khối `<details>` đang mở còn nguyên,
  hoạt hình CSS chỉ chạy một lần trong `#view` không diễn lại, còn hoạt hình lặp thì giữ pha
  của lần dựng ra nó chứ không chạy lại từ đầu. Thanh điều hướng, khối quản gia và ngăn kéo vẫn
  dựng lại ở mọi lượt.
- **Chặn vẽ khi tab khuất.** Lúc `document.visibilityState` là `hidden`, SSE vẫn cập nhật
  `app.state` nhưng `render()` chỉ ghi nhận rằng còn nợ một lượt vẽ. Lượt nợ chạy đúng một lần
  với state mới nhất khi tab hiện lại. Đồng hồ lật của quản gia, vòng hỏi `/api/ping` lúc mở
  trang và nhịp đập của chấm kết nối cũng dừng theo.

Đo trên Safari 17.6, số MB bộ nhớ tiến trình tăng thêm mỗi 100 lượt vẽ, trước bản chữa so với
sau: màn Dự án 64,5 xuống 0,1; Quyết định 32,9 xuống 0,4; Token 83,8 xuống 1,2; màn thị trấn từ
dao động 127–829 MB xuống 0,5 mỗi 100 lượt đẩy. Tắt phép bỏ qua lượt vẽ trùng HTML để lượt đẩy
nào cũng thật sự vẽ lại thì 1.398 lượt vẽ liên tiếp màn Quyết định chỉ đưa bộ nhớ từ 70 lên
71 MB. Bảng đủ mười màn, kèm những chỗ chưa phẳng hẳn, nằm trong CHANGELOG.

Có một mối nguy bản chữa không gỡ: bản đồ thị trấn vẫn ghi 6.757 style nội tuyến với 2.216 chuỗi
khác nhau, vượt bảng 1.024 mục mà WebKit dùng để gộp các khối nội tuyến giống hệt nhau. Nó không
với tới được chỉ vì màn thị trấn gần như không vẽ lại, và lượt vẽ lại nào cũng chèn một luật
`--now` để dựng lại resolver. Đổi cách vẽ sao cho bản đồ dựng lại mà không chèn luật thì bộ nhớ
dao động 148–819 MB trở lại. Vậy nên giữ số chuỗi `style` khác nhau trên một trang dưới 1.000
khá xa, và nếu dựng lại thị trấn thì đặt vị trí hình bằng class hay ô lưới thay vì pixel.

## Chỉnh

Đặt biến môi trường trước khi chạy:

```bash
NOW_PORT=5000 NOW_ROOTS=~/Projects,~/work ./bin/now-dash
```

| Biến | Mặc định | Làm gì |
|---|---|---|
| `NOW_PORT` | `4400` | Cổng server lắng nghe, chỉ trên loopback |
| `NOW_ROOTS` | `~/Projects` | Danh sách gốc quét `NOW.json`, ngăn bằng dấu phẩy. Chế độ `all` của plugin `now` đọc đúng biến này, nên board nằm ngoài các gốc ấy là vô hình với cả hai nửa chứ không phải chỉ một |
| `NOW_DATA_DIR` | `~/.now-dashboard` | Nơi dashboard giữ sổ riêng của nó: sổ chu kỳ hạn mức, sổ token gộp, sổ app chủ, sổ quản gia |

**Chạy bản thứ hai thì phải đặt `NOW_DATA_DIR` trước.** Hai dashboard dùng chung một thư
mục dữ liệu sẽ ghi đè sổ của nhau: mỗi tiến trình giữ memo riêng trong bộ nhớ rồi ghi trọn
file, nên bản ghi sau thắng bản ghi trước và chu kỳ nào chỉ một bên nhìn thấy thì mất hẳn.
`quota-cycles.json` là file duy nhất trong đó mà chính codebase này khai là không dựng lại
được, và đó là lý do va chạm này đáng một dòng cấu hình. Chạy bản thứ hai là việc hợp lệ,
ví dụ một bản preview chạy cạnh LaunchAgent, miễn là nó có thư mục riêng và cổng riêng.

Ngưỡng "board còn tin được không" nằm ở `HEALTH` trong
[`src/config.js`](../src/config.js) — mặc định: lệch từ 3 ngày / 5 commit, hết hạn từ
7 ngày / 15 commit.
