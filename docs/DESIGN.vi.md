# Triết lý thiết kế — NOW dashboard

*🇻🇳 Tiếng Việt · 🇬🇧 [English](DESIGN.md)*

Vì sao dashboard trông và đọc như hiện tại. Bản đồ file + nguồn dữ liệu xem
[ARCHITECTURE.vi.md](ARCHITECTURE.vi.md); khối hạn mức xem riêng [QUOTA.vi.md](QUOTA.vi.md).

## Ngôn ngữ thiết kế

**Quản gia là khối chính.** To nhất, sáng nhất, đặt trên cùng: nói **hai** câu và đưa
luôn nút để làm điều mỗi câu vừa nói. Cả dashboard đọc trong 30 giây, nhưng khối này đọc
trong 3 giây — liếc một cái rồi đi thì đây là thứ bạn mang theo.

Hai ô **cố định**, mỗi ô một loại việc ([`public/lib/butler.js`](../public/lib/butler.js)):

1. **Việc đáng làm** — tối đa **ba** việc, **tự chuyển 8 giây một lần**. Thứ tự là *cái gì
   thực sự khoá tay bạn lại*, không phải thứ tự loại dữ liệu: quyết định nóng (`now`) →
   board hết hạn → worktree sắp mất → quyết định sắp phải quyết (`soon`) → chờ người khác
   → không gì cả thì chỉ thẳng việc kế tiếp.

   **Không hạng mục nào là cửa nhị phân nữa**, và đó là lần sửa lưng gần nhất: bản trước
   chỉ nhận `heat === 'now'` và chỉ nhận mục chờ quá 7 ngày, nên trên máy này — 24 quyết
   định treo mà không cái nào `now`, hai mục QA đứng đúng 6 ngày — quản gia im hoàn toàn
   về cả hai loại và cả ô chỉ nói được một câu. Giờ mọi mục đều lên trang, ngưỡng chỉ còn
   chọn *giọng*: quá 7 ngày mới được nói "nhắc được rồi", chưa thì chỉ thuật lại.

   Ba là **trần, không phải chỉ tiêu**: hết thứ đang chặn thì ô nói một việc rồi thôi.
   Kéo việc kế tiếp với hàng đợi vào cho đủ ba thì ngày nào ô cũng đầy, mà một ô ngày nào
   cũng đầy thì dòng thứ ba thành thứ mắt tự bỏ qua.

   Tự chuyển **dừng khi rê chuột hoặc focus vào khối** (đang đọc thì chữ không được nhảy),
   và bấm ‹ › thì **đếm lại từ đầu** chứ không tắt — bấm tay được trọn tám giây để đọc
   thứ vừa lật tới. Vạch chạy cạnh "2/3" là thứ duy nhất báo trước chữ sắp đổi; thiếu nó
   thì cái nhảy đọc ra thành trang bị lỗi. Nó cũng là thứ nói ra rằng ô đang dừng —
   rê chuột vào là vạch biến mất.

   Con trỏ đo bằng **vị trí thật ở mỗi cú di chuột**, không bằng cặp
   `pointerenter`/`pointerleave`. Hai sự kiện kia phải nổ đúng thành cặp mới cân, mà
   `pointerleave` nổ thiếu ở mấy ca có thật (con trỏ ra khỏi hẳn cửa sổ, `mount()` thay
   sạch DOM ngay dưới con trỏ) — thiếu một lần là ô kẹt vĩnh viễn ở trạng thái dừng, và
   trên màn thì kẹt ấy trông y hệt lúc hỏng.

   **Ô một là một cái thẻ có nền riêng, ô hai chỉ là chữ.** Hai ô cùng là chữ trên nền
   trắng thì ô cao hơn đọc ra thành ô quan trọng hơn — mà ô hạn mức lúc nào cũng cao gấp
   đôi vì nó có dòng lý do ba câu cộng mấy câu Cursor/AG. Đua cỡ chữ không gỡ được, chỉ
   làm cả hai cùng to; cắt chữ ô hai càng không, mấy câu nguồn ngoài kia mỗi tuần mới nói
   một lần. Nên ô một thắng ở một chiều mà ô hai không tham gia: nền lấy từ chính `--voice`
   nên đổi màu theo mức gấp, và vẫn chỉ là trang trí — mọi khác biệt có thật đều đã có chữ chở.

   Cả ba slide đều có nút chép. Mục **chờ người khác** không có lệnh nào trong skill `now`
   (khác `chốt <mã>` và `/now update`), nhưng "không có lệnh" không phải "không có gì để
   đưa": câu trên đã bị cắt cho vừa dòng, nên nút chép ra **bản đầy đủ** theo đúng định
   dạng `/now update` render trong NOW.md — `{who} — {what} · từ {since}`.
2. **Hạn mức token** — nói mọi lượt, kể cả ngày đẹp trời, và nhắc chăm hơn khi đang bỏ phí.
   Chi tiết cách tính/vẽ → [QUOTA.vi.md](QUOTA.vi.md).

Trước đây chỉ có một chỗ nói nên hai loại này phải tranh nhau. Chúng không so được với
nhau: một quyết định treo ba ngày và một cửa sổ sắp bỏ phí 82% không nằm trên cùng một
thang gấp, mà ép vào một thang thì thứ thua cuộc biến mất hẳn khỏi trang — trong khi nó
vẫn đang chờ nguyên ở đó. Riêng "bỏ phí" còn không có mốc nào tự kêu lên: nó chỉ lặng lẽ
xảy ra lúc reset.

Chữ trên màn hình luôn là **đúng thuật ngữ bạn sẽ nói lại với Claude**: dự án, phiên,
quyết định, worktree, `chốt <mã>`, `/now update`, `resume`. Từ vựng bám sát skill `now`:
🎯 Đang làm · ▶ Làm ngay · ⏭ Còn lại · Chờ bạn quyết · Chờ người khác · Hàng đợi · Vừa xong.

Hai nền, và **nền sáng là mặc định** (`app.js`) — phím `t` đổi qua lại.

### Điểm số lấy từ đâu

Mọi con số phải có thật — một thanh XP bịa ra thì tuần sau nhìn là biết vô nghĩa và cả
HUD mất tin cậy theo. Đây chính là lý do XP, hạng `D→S`, và dấu ưu tiên `!!` `!` `~` `✓`
đã bị **bỏ** ở quyết định `chốt d-game` (2026-07-23, lý do đầy đủ nằm ở cuối
[design/README.vi.md](../design/README.vi.md), mục `d-game`): XP cũ cộng ba trọng số bịa lên
một con số đã là sàn chứ không phải tổng (`recentlyDone` chỉ giữ 5 mục mỗi dự án), rồi
quy hết ra một hạng chữ cái.

Còn lại đúng phần **đo được thẳng, không quy đổi** —
[`public/lib/game.js`](../public/lib/game.js):

| Hàm | Trả về |
|---|---|
| `streak()` | số ngày liên tiếp có ít nhất một việc xong (cho phép bắt đầu từ hôm qua) |
| `score()` | `done7` (việc xong 7 ngày) · `streak` · `fresh` (số board còn tươi) |
| `projectState()` | tình trạng dự án bằng **chữ** ("Đang chặn" / "Cần cập nhật" / "Ổn"), không bằng hạng hay dấu |

Không có công thức cộng trọng số, không có ngưỡng hạng — ba con số trên hiện thẳng dạng số.

Dấu ưu tiên của dự án cố ý **không** dùng chữ S/A/B/C như hạng người chơi cũ — hai thang
nằm cạnh nhau mà nghĩa ngược nhau (S của bạn là giỏi, S của dự án là đang cháy) thì đọc
nhầm là chắc chắn.

## Bảy màn — chi tiết

Bảng nhanh 7 màn xem [README.vi.md](../README.vi.md). Chi tiết ba tab của màn Token:

Tab Cursor có ba mục. **Theo thời gian** dựng từ `GetFilteredUsageEvents` — 5.279 lượt gọi
trải 148 ngày, mỗi lượt có mốc thời gian, tiền đã tính và `kind` (nên đếm được cả lượt lỗi
không bị tính tiền). Kéo trọn mất ~10 giây nên nó chạy **ở nền** và chốt vào
`~/.now-dashboard/cursor-events.json`; mỗi 15 phút kéo lại trọn hai ngày cuối rồi ghi đè —
không cộng dồn nên không có gì để đếm hai lần. **Chu kỳ đang chạy** là hai chart cũ, do
chính Cursor cộng. **Nhịp trong editor** dựng từ `GetUserAnalytics` (80 ngày): dòng code
*được nhận vào file*, tỉ lệ gợi ý Tab được nhận, và loại file đang làm — trục duy nhất
trong cả màn nói về chất chứ không về khối lượng.

⚠️ Tiền của Cursor là **tiền thật Cursor đã tính**; tiền của Claude là **ước lượng** do
dashboard tự nhân từ bảng giá API. Hai cột đô đó không cộng hay trừ cho nhau được.

Tab Antigravity đọc **từng lượt gọi model** từ bảng `gen_metadata` trong SQLite của mỗi
hội thoại (`src/collect/agturns.js`) — mốc thời gian, tên model và ngữ cảnh là trị ghi
thẳng trong bản ghi. Cột *token viết ra* là **suy ra**: bản ghi không đặt tên trường, con
số ấy được chọn vì độ lớn và vì tỉ số so với ngữ cảnh (82×) khớp dải của Claude Code — nên
nó chỉ nằm trong bảng số, không bao giờ lên cột. Không có chart theo **hồ hạn mức**: nhãn
`used_claude` trong bản ghi đếm ra 200 lượt ngoài-Gemini trong khi đếm theo tên model chỉ
ra 161, lệch 20% nên chưa chốt được nghĩa.

Màn Token mang cả ba công cụ. **Khối hạn mức của cả ba đứng đầu màn, luôn hiện** —
Claude (5 giờ / 7 ngày / tuần theo model), Cursor (chu kỳ tháng), Antigravity (hai hồ
× hai cửa sổ) — vì "chỗ nào sắp chặn tôi trước" là câu duy nhất ở đây thật sự gấp.
Phần chi tiết nằm trong **ba tab theo công cụ** (`←` `→` đi giữa các tab): ba nguồn
này đo bằng ba đơn vị không quy đổi cho nhau được, nên mỗi lần trên màn chỉ có một
đơn vị đo. Trước đây Cursor và Antigravity có màn riêng (⬡ Công cụ); `#tools` giờ tự
chuyển hướng sang màn Token.

"Luôn hiện" có **đúng một ngoại lệ: máy chưa cài công cụ đó.** Cursor chưa từng chạy
(`…/Cursor/User/globalStorage/state.vscdb` không có) hoặc Antigravity chưa từng chạy
(`~/.gemini/antigravity` không có) thì cả khối lẫn tab của nó biến mất — `hasCursor` /
`hasAg` trong [`public/views/usage.js`](../public/views/usage.js). Đây KHÔNG phải cách xử
lý chung cho "không đọc được số": đang đóng, chưa đăng nhập, endpoint chết đều giữ khối
lại và nói ra mắt xích nào đứt, vì cả ba đều là việc người dùng làm được. Chỉ "chưa cài"
mới là ca không có gì để nói và không bao giờ đổi. Hai ca này trước đây cùng ra một
reason, nên máy không có Antigravity vẫn đọc được câu *"Antigravity đang đóng"* — một
câu bảo người ta đi mở ứng dụng không tồn tại.

Phím khác: `c` chép việc quản gia đang đề xuất · `o` mở board dự án đầu danh sách ·
`/` tìm · `r` quét lại · `←` `→` lật dự án khi bảng chi tiết đang mở · `esc` đóng ·
`?` xem tất cả.

## Dùng hàng ngày

Ba thứ quyết định việc mở dashboard này mỗi sáng có tiện hay không.

**Hành động không phải đi tìm.** Việc làm nhiều nhất là chép một câu rồi dán vào
Claude — nên nó phải ở ngay chỗ vừa đọc thấy: nút trong khối quản gia (`c`), và
hàng nút hiện lên khi rê chuột vào thẻ dự án (chép câu làm tiếp · mở thư mục ·
xem board đầy đủ). Bảng chi tiết đọc được luôn toàn văn `NOW.md` và lật qua dự án
kế bằng `←` `→`, không phải đóng ra mở lại từng cái.

**Trang không được tự nhảy.** Cứ 30 giây trang vẽ lại; nếu vị trí cuộn và các
khối vừa mở bị đặt lại thì đang đọc dở sẽ mất chỗ. Cả hai đều được chụp lại
trước khi vẽ và trả về ngay sau — xem `keepUI` trong [`public/app.js`](../public/app.js).

**Dữ liệu chết phải trông khác dữ liệu sống.** Mất kết nối thì bảng cũ vẫn nằm
nguyên trên màn hình và trông y hệt bảng mới, nên mất kết nối là một dải cảnh báo
kèm giờ của ảnh chụp, không phải một chấm đỏ 6px. Giờ cập nhật cũng đứng đầu dòng
phụ ở thanh trên, trước mọi con số khác.

## Chart không được nói dối

Màn Thống kê là chỗ nguyên tắc "mọi con số phải có thật" khó giữ nhất, vì một cột
thấp trông y hệt "hôm đó làm ít" kể cả khi sự thật là "hôm đó board đã quên mất".

`recentlyDone` trong `NOW.json` bị cắt còn vài mục gần nhất **mỗi dự án**. Dự án
nào chạm trần thì việc cũ hơn biến mất, nên vẽ thô lên là ngày càng lùi về trước
càng trông ít việc — một xu hướng hoàn toàn do trần lưu sinh ra. `coverage()`
trong [`public/views/stats.js`](../public/views/stats.js) đo đúng chuyện đó: với mỗi
ngày, đếm xem bao nhiêu board còn lưu lùi tới ngày ấy. Ngày nào không đủ thì cột
mờ đi và tooltip nói rõ "số thật cao hơn". Ba chart còn lại (quyết định, hàng đợi,
giờ mở phiên) là ảnh chụp hiện tại, đếm đủ — đó mới là phần đáng tin nhất.

Quy ước vẽ, giữ nguyên ở mọi chart:

- **Một chart một màu**, trừ khi màu *mang nghĩa* (độ nóng quyết định — kèm chú
  giải có ký hiệu và chữ, không bao giờ chỉ có màu). Tô mỗi cột một màu theo giá
  trị là đốt kênh màu để lặp lại đúng cái mà chiều dài cột đã nói.
  **Quạt tròn là ngoại lệ duy nhất**: một cung tròn không mang chữ nào, cây cầu duy nhất
  nối nó với tên là ô màu bên chú giải — ở đó màu chính là danh tính. Thang màu xoay
  *sắc* (200° chia đều) chứ không đổi *độ sáng*: giữ nguyên độ sáng thì mọi mảnh có cùng
  một mức tương phản với nền (đo được 4,0–4,8:1 nền sáng, 4,6–7,7:1 nền tối), mà vẫn
  cách nhau xa hơn thang độ sáng cũ khoảng 2,6 lần. Mảnh "còn lại" luôn xám — nó là phần
  đuôi bị gộp, không phải một hạng mục, nên không được có sắc riêng.
  Mỗi mảnh có một lớp phủ trong suốt cắt bằng `clip-path` để bắt chuột (cả vành chỉ là
  một `conic-gradient`, không có phần tử nào ứng với một mảnh). Rê vào thì **những mảnh
  khác xám đi** — làm sáng mảnh đang trỏ là thứ phải so mới thấy, còn cả vành xám trừ
  một mảnh thì thấy ngay — và dòng chú giải tương ứng sáng theo, hai chiều. Tooltip của
  mảnh neo theo **con trỏ** chứ không theo khung phần tử: khung của nó là cả hình tròn,
  neo theo khung là đặt tooltip đè lên đúng thứ vừa rê vào.
- **Không ghi số lên mọi cột** — chỉ cột đỉnh; phần còn lại để trục, tooltip và
  bảng số gánh. Giá trị của thanh ngang ghi ở *đầu* thanh, không phải trong lòng.
- **Tooltip không bao giờ là lối duy nhất đọc được giá trị**: mỗi chart kèm một
  bảng số mở ra được, mọi mốc đều tới được bằng `Tab`, cả ô cột là vùng trỏ chứ
  không riêng phần đã tô.
- **Tooltip là bảng số thu nhỏ, không phải một câu.** `data-tip` mang một định dạng
  `nhãn \t trị` (xem [`public/lib/tip.js`](../public/lib/tip.js)); `app.js` dựng nó thành
  lưới hai cột — nhãn trái, trị phải bằng mono canh số, luôn cùng một chỗ ở mọi tooltip.
  Một dòng văn xuôi thì đọc tuần tự và hai tooltip cạnh nhau không so được với nhau, vì
  mỗi con số rơi vào một vị trí khác nhau trên dòng. Chuỗi cũ (không có tab) vẫn hiện
  nguyên như trước, nên chuyển đổi được từng chỗ một. Nội dung dựng bằng `createElement`
  + `textContent`, **không** `innerHTML`: đây là chỗ duy nhất chuỗi từ đĩa (tên dự án,
  tên skill) ra thẳng DOM mà không đi qua `html` — hàm đó tự escape, chỗ này thì không.
- Cột/thanh dày tối đa 24px, bo 4px ở đầu dữ liệu và vuông ở chân; lưới là nét
  tóc 1px liền, lùi hẳn về sau; hai mảnh chạm nhau tách bằng **khe nền 2px** chứ
  không viền — và bề rộng mảnh trừ lại đúng 2px đó để thanh vẫn khớp con số.

Nút **phong cách chart** đổi *hình* mà không đổi số: cùng dữ liệu, cột đọc ra xu hướng,
quạt tròn đọc ra tỉ lệ, treemap đọc ra cái nào chiếm chỗ. Chế độ ngẫu nhiên bốc **trong
danh sách hợp lệ của từng kiểu dữ liệu** — chuỗi theo ngày không bao giờ thành quạt tròn,
bảng xếp hạng không bao giờ thành đường ([`public/lib/skin.js`](../public/lib/skin.js)) — và
chỉ gieo lại lúc bấm nút, vì trang tự vẽ lại 30 giây một lần. Nút đứng ở tiêu đề khối
chart chứ **không** ở thanh công cụ trên cùng: thanh trên cùng dành cho thứ đổi cả trang
(nền, ngôn ngữ, quét lại), còn cái này chỉ đổi được hình của mấy cái chart ngay dưới nó.

Thang màu độ nóng đã chạy qua bộ kiểm mù màu (`now/soon/later`, nền `#0b0f15`):
cặp sát nhau tệ nhất ΔE 12.5 dưới deuteranopia, trên ngưỡng 8. Bốn màu sức khoẻ
thì chỉ đạt 7.2 — nằm trong dải chỉ hợp lệ khi có kênh phụ, nên chúng không được
dùng làm màu chart ở đây.

Nguyên tắc chung cho mật độ: **cái gì lặp lại thì không phải thông tin.** Bảng
quyết định bỏ cột độ nóng vì cả khối đã nằm dưới tiêu đề "SẮP CHẶN · 6"; màn phiên
chỉ ghi trạng thái cho phiên *đang thức* vì ngủ đã là mặc định; bảy repo chưa có
board gom thành một khối chip thay vì bảy dòng nói cùng một câu.
