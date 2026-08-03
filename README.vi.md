# NOW dashboard — sở chỉ huy

*🇻🇳 Tiếng Việt · 🇬🇧 [English](README.en.md)*

[![License: MIT](https://img.shields.io/badge/license-MIT-4f46e5)](LICENSE)
[![Node](https://img.shields.io/badge/node-18.10%2B-4f46e5)](package.json)
[![Dependencies](https://img.shields.io/badge/dependencies-zero-4f46e5)](package.json)
[![Docs](https://img.shields.io/badge/docs-VI%20%7C%20EN-4f46e5)](docs/README.md)

![NOW dashboard](docs/assets/banner.svg)

Một trang duy nhất trả lời: **mọi dự án của tôi đang ở đâu, và trong hai chục phiên Claude
đang mở, phiên nào đang cầm việc gì.**

`/now` cho bạn một dự án. `/now all` cho bạn một bảng tĩnh. Cái này cho bạn toàn cảnh
**sống**, tự cập nhật khi board hoặc phiên thay đổi.

## Bắt đầu

Cài một lần, để nó tự lên cùng máy:

```bash
./bin/install-app
```

Dựng luôn app trên thanh menu (xem [§Trên thanh menu](#trên-thanh-menu)) **và** đặt
LaunchAgent vào `~/Library/LaunchAgents/`, đường dẫn đã tự khớp với chỗ bạn `git clone`
về — không cần sửa tay. Chạy lại bao nhiêu lần cũng được, kể cả sau khi dời repo.

Không muốn icon trên thanh menu, chỉ cần server nền (đòi hỏi ít hơn: không cần Xcode
Command Line Tools), thì tự cài LaunchAgent bằng tay:

```bash
sed -e "s|__ROOT__|$(pwd)|g" -e "s|__HOME__|$HOME|g" \
  launchd/dev.hoanluu.now-dash.plist > ~/Library/LaunchAgents/dev.hoanluu.now-dash.plist
```

Từ đó trở đi chỉ cần:

```bash
./bin/now-dash
```

→ http://localhost:4400 · mở tab, và dựng server qua launchd nếu nó chưa chạy.

| Việc | Lệnh |
|---|---|
| Dừng | `launchctl bootout gui/$(id -u)/dev.hoanluu.now-dash` |
| Chạy lại | `launchctl kickstart -k gui/$(id -u)/dev.hoanluu.now-dash` |
| Xem log | `tail -f ~/.now-dashboard/service.err.log` |

Server treo dưới **launchd**, không dưới terminal hay phiên Claude đã gọi nó — đóng cửa
sổ nào cũng không giết nó, và đăng nhập lại là nó tự lên. (Bản trước `nohup` từ chính
terminal gọi lệnh, nên nó chết theo phiên Claude đang chạy — hỏng thật ngày 27/7.)

Không cần `npm install`. Không phụ thuộc gói nào — chỉ Node ≥ 18.10 (mức đã chạy thật;
trước đây `engines` ghi ≥ 20 mà chưa ai kiểm).

```bash
npm test
```

Bộ test chạy bằng `node:test` có sẵn, không kéo thêm gói nào — xem [test/](test/).

### Chạy như app riêng trên Dock

Mở `http://localhost:4400` bằng **Safari** → menu **File → Add to Dock…** → **Add**.

Được một app riêng chạy trên WebKit: icon riêng trên Dock, ⌘Tab được, không thanh địa
chỉ, không tab, và **không cần mở Safari**. Cố tình là Safari chứ không phải "Install as
app" của Chrome — cùng một trang mà Chrome kéo theo browser process + GPU process, đắt
hơn hẳn cho một thứ định để mở suốt ngày.

Ba thứ khiến nó trông ra app thay vì trông ra một trang web bị đóng khung, đều nằm
trong `<head>` của [`public/index.html`](public/index.html):

| | |
|---|---|
| [`public/manifest.webmanifest`](public/manifest.webmanifest) | `short_name` = nhãn dưới icon Dock. Thiếu thì macOS lấy `<title>` và nhãn thành "NOW — sở chỉ huy" |
| `icon-1024.png` · `icon-180.png` | icon Dock. Nguồn là [`design/icon.svg`](design/icon.svg), dựng lại bằng `node design/icon.mjs` |
| `<meta name="theme-color">` | màu thanh tiêu đề cửa sổ. `applyTheme()` sửa nó theo phím `t` — để cố định thì nửa số lần dùng có một dải sáng nằm trên HUD tối |

Server phải đang chạy, nếu không app mở ra chỉ thấy dòng "chưa nối được tới server" —
LaunchAgent ở phần [Bắt đầu](#bắt-đầu) lo đúng việc đó, kể cả sau khi khởi động lại máy.

### Trên thanh menu

Web app ở trên chỉ biết **mở** `localhost:4400`, nó không biết **dựng** server, và phải
mở ra mới biết có gì. Cái dưới đây ở thanh menu suốt ngày, liếc là thấy.

```bash
./bin/install-app
```

→ `~/Applications/NOW Dashboard.app`. Chạy nó, được **một mục** trên thanh menu, xếp
hai dòng trong 63pt bề ngang:

```
CLAUDE
6%·37%
```

| Kênh | Chở gì |
|---|---|
| dòng dưới | **đã tiêu** khung 5 giờ · khung 7 ngày (luật 1 — số dẫn không bao giờ là phần còn lại). Cửa sổ nào đã qua mốc reset thì chỗ của nó là `—`, không phải số cuối của chu kỳ cũ |
| tooltip | cửa sổ nào đang ràng buộc, bỏ phí dự phóng bao nhiêu |
| popover | hai việc đáng làm (có tên việc, bấm được), ba cửa sổ hạn mức có thang màu, và câu của Cursor/Antigravity khi chúng có chuyện |

Popover xếp theo đúng hai ô của quản gia — việc đáng làm trước, hạn mức sau — vì hai
loại đó không so được với nhau. Nó **không lặp lại thanh bằng chữ**: thanh đã có nhãn
thì câu dưới nó chỉ được nói phần nhãn không vẽ nổi (`cardText`, không phải
`forecastText` — luật nằm ngay trong `lib/quota.js`). Bản trước phạm đúng chỗ này và
mất một phần tư chiều cao cho ba câu in lại số của chính cái thanh ngay trên chúng;
cửa sổ vừa sang chu kỳ mới còn nói ba lần cùng một câu.

Xếp dọc vì thanh menu tính tiền bằng **chiều ngang**; hai dòng dùng lại khoảng cao vốn
đã bỏ ra. Phiên đang thức và quyết định nóng nằm trong popover, không lên thanh — bản
trước có mục thứ hai cho chúng, nhưng hai mục cùng mở một popover thì chỉ là hai cái
nút giống hệt nhau chiếm hai chỗ.

Bậc bỏ phí **không lên thanh**: ký hiệu bốn bậc rồi màu nhãn đều đã thử và đều bỏ —
một nhãn tô màu giữa một hàng nhãn xám đọc thành lỗi giao diện chứ không thành cảnh
báo. Nó ở lại tooltip và popover.

Chữ trên thanh là **ảnh vẽ tay**, không phải `attributedTitle`. Với `attributedTitle`
thì NSStatusBarButton dồn khối chữ lên sát mép trên — đo trên ảnh chụp chính cái nút:
trống 1px ở trên, 6px ở dưới. Cả `baselineOffset` lẫn `paragraphSpacingBefore` đều
không dịch được nó (dòng bị `min/maxLineHeight` ghim, còn spacing thì AppKit bỏ qua ở
đoạn đầu). Vẽ ảnh thì toạ độ là của mình: hiện tại 3px trên, 3px dưới.

Canh lại bằng mắt mà không phải dựng lại app — app tự chụp nút của nó ra PNG:

```bash
NOW_LABEL_Y=13 NOW_SNAP=/tmp/btn.png "$HOME/Applications/NOW Dashboard.app/Contents/MacOS/now-dash-menu"
```

`NOW_LABEL_SIZE` · `NOW_VALUE_SIZE` · `NOW_LABEL_Y` · `NOW_VALUE_Y` · `NOW_BTN_H` —
mặc định nằm ở đầu [`app/NowMenuBar.swift`](app/NowMenuBar.swift). Có chế độ này vì
thanh menu **không chụp được từ terminal** (thiếu quyền Screen Recording), nên canh chữ
ở đây là canh mù.

Popover cũng vậy — `NOW_PROBE=1` mở nó ra, đo, in cỡ thật rồi thoát:

```bash
NOW_PROBE=1 "$HOME/Applications/NOW Dashboard.app/Contents/MacOS/now-dash-menu"
```

→ `popover: 360×477pt · trang: 477pt · vừa khít`. Hai số lệch nhau nghĩa là bị cắt.
Chế độ này ra đời sau một lỗi sống suốt từ ngày đầu: app hỏi chiều cao trong
`didFinish`, mà lúc ấy `menubar.js` còn đang `await fetch` nên `.mb-wrap` chưa tồn tại
— câu truy vấn rơi vào nhánh mặc định `?? 320` và popover **cao đúng 320pt bất kể
trong nó có gì**. Mọi thứ dưới mốc đó bị cắt cụt, kể cả hàng nút ở đáy — nên câu hỏi
"không có nút bấm nhảy ra app được à" là đúng: hàng nút ấy chưa bao giờ hiện ra. Giờ
trang tự đẩy số sang app qua `webkit.messageHandlers.size`, và đẩy lại qua
`ResizeObserver` mỗi khi nội dung đổi.

Bấm → popover, hai tab: **Việc** (việc đáng làm + hạn mức Claude) và **Token** (cả ba
công cụ, mỗi cái một khối). Tab đang mở được nhớ lại — kho riêng của WKWebView ở đây là
thứ có lợi. Chuột phải → mở dashboard, dựng lại server, bật mở-lúc-đăng-nhập. Bấm icon
trong Spotlight/Finder lúc app đã chạy → mở thẳng dashboard đầy đủ.

Cửa ra dashboard là cái nút **`◈ NOW`** ở góc trái, không phải một hàng nút ở đáy: hàng
nút cũ tốn 48px để nói một việc mà cái tên đã nói được. Nó mang nền và viền sẵn, không
đợi rê chuột mới hiện — popover mở rồi đóng trong vài giây, một cái nút chỉ lộ diện lúc
rê là một cái nút không tồn tại. Cặp mark-và-tên lấy nguyên của `.brand-mark` ở thanh
rail dashboard: hai chỗ này là cùng một cửa nên mang cùng một mặt. Đích đi theo tab đang
mở — đang xem Token thì nó mở thẳng màn Token, và tooltip gọi tên đích vì nhãn "NOW"
không tự nói mình đi đâu.

Cursor và Antigravity vẫn để lại **câu văn xuôi** ở tab Việc khi chúng có chuyện: một
cảnh báo chỉ đọc được sau khi đổi tab là một cảnh báo không có trên trang.

### Quản gia pixel

Đầu nhân vật ở đầu popover **chính là cái mark `◈`** — một viên kim cương, và chỗ icon
app đặt một viên nhỏ bên trong thì ở đây là hai con mắt. Nó không phải linh vật dán thêm
cho vui. Viên **đặc** chứ không phải viền rỗng: ở 64px thì lòng viên rỗng chỉ còn 4–6 ô,
không đủ chỗ cho hai con mắt ra hồn, mà nền trời lọt qua thì cái đầu tan vào khung.

Điều kiện để nó được chiếm ~93px của một cửa sổ đang bị ép cho gọn: **nó chở tin**. Băng
bỏ phí lớn (`crit`, `warn`) → mắt nhắm, có chữ "z" bay lên. Nhịp đã bám đích trở lên
(`ok`, `cheer`, `over`) → mắt mở, có đốm nắng trong mắt. Tiền nằm không thì quản gia ngủ
gật — đúng nghĩa đen của mục 1. Mắt mở cao HAI ô, mắt nhắm là gạch cao MỘT ô: hình dáng
là kênh thứ hai bên cạnh sắc, vì theme daltonized không được dựa vào mỗi khác biệt màu.

Không thích thì tắt: `hero: false` trong `DEFAULTS`, popover tụt từ 598 xuống 505pt.

#### Một nguồn sáng cho cả popover

Mặt trời nằm **trên-trái** trong khung, và mọi thứ còn lại quay về đúng phía ấy: vệt nắng
hắt vào nền popover, cạnh sáng của quản gia, gờ sáng trên mỗi cái thanh hạn mức, bóng đổ
cứng lệch xuống dưới-phải. Hai nguồn sáng thì mỗi component tự bịa một hướng và cả trang
trông như dán.

Hướng ấy **không đổi qua bốn buổi** — cho mặt trời chạy vòng cung thì phải xoay lại toàn
bộ phép chấm sắc độ trong `shadeOf`, và một nhân vật đổi hướng đổ bóng bốn lần một ngày
là bốn lần người xem phải nhận lại cái hình.

#### Bốn buổi, lấy theo giờ máy

`phaseOf(hour)` trong `lib/menubar-view.js`: `dawn` 5–9h · `day` 9–16h · `dusk` 16–19h ·
`night` 19–5h. Đêm thì mặt trời đổi thành **trăng khuyết** (khuyết chứ không phải đĩa
tròn: ở 28px một cái đĩa trông y hệt mặt trời, mà đúng cái phải nhận ra ngay là "giờ đang
là đêm"). Sao mờ dần theo buổi thay vì bật/tắt — một bầu sao biến mất đột ngột lúc 9h đọc
thành trang bị hỏng.

Popover mở rồi đóng trong vài giây nên không có hẹn giờ vẽ lại: mỗi lần mở là một lần đọc
đồng hồ. Bàn chỉnh có công tắc ép buổi để xem cả bốn mà không phải đợi.

Ranh giới quan trọng: buổi chỉ đổi `--lux` / `--lux-hi` / `--sky-*` / `--halo` — token của
riêng khung trời và vệt nắng nền. **`--sun-hi` (ánh sáng của mấy cái thanh) đứng yên cả
bốn buổi**: khung trời là tranh nên đổi được, còn cái thanh là dữ liệu, mà một mảng đổi
sắc theo giờ là một mảng người đọc phải hỏi "sáng nay nó có màu này không".

Sắc độ thân nhân vật **suy ra từ chính hình** (`shadeOf` trong `lib/menubar-view.js`):
khuyết ô chéo phía mặt trời → cạnh hứng nắng, khuyết ô chéo phía đối diện → cạnh khuất.
Sửa một dòng trong sprite là bóng tự đi theo; bản đồ bóng chép tay thì lần sửa thứ hai đã
lệch.

Ba con số cần nhớ khi đụng vào bảng màu:

| Token | Là gì | Ràng buộc |
|---|---|---|
| `--skin` | tím thân quản gia | **cố định**, không đổi theo băng — nhân vật đổi màu áo theo số liệu thì mỗi lần mở popover lại là một con khác |
| `--sun` | cam san hô | không được là hổ phách: hổ phách là `--warn`, mà nắng thì phủ khắp trang |
| `--sun-hi` | đỉnh nắng | dùng cho gờ trên thanh hạn mức — pha với `--c`, **không** thay `--c` |

#### Thanh hạn mức trong popover khác web ba chỗ

Cùng một `quotaBar`, khác ba tuỳ chọn — không có bản vẽ lại nào:

| | Web | Popover | Vì sao |
|---|---|---|---|
| vạch mốc đều | có | `pace: false` | vạch muốn có nghĩa thì phải kéo theo dòng "mốc đều 55%" ở dưới — 15px mỗi cửa sổ cho một mốc tham chiếu, trong khi thứ nó dùng để so đều đã có nhãn nằm trong thân thanh. Bỏ đi: popover 600 → 573pt |
| vân mảng dự phóng | đứng yên | bò dần sang phải, 1,7s một bước vân | mảng này là thứ duy nhất trên thanh **chưa xảy ra**, mà mọi thứ khác trong popover thì đứng yên — chuyển động chính là kênh nói "đang chạy tới, chưa chốt". Tắt theo `prefers-reduced-motion` |
| nhãn dự phóng | giữa mảng gạch | `est` — bốn chỗ đứng, đang bày ở bàn chỉnh | chỉ `mid`/`end` giữ được luật "số nằm trong đúng mảng nó nói về"; `below` tốn lại 15px, `tail` phải cướp chỗ của nhãn bỏ phí |

Ba thứ **không** bê từ mấy app cùng loại:

| Của họ | Ở đây | Vì sao |
|---|---|---|
| dải 30 ngày tô xanh–vàng–đỏ theo lượng token | **không có dải nào** | thử rồi bỏ 31/7: bản ở đây là 12 cửa sổ 5 giờ một sắc câm — màu đã có nghĩa cố định là **bỏ phí**, mà ngày tiêu mạnh là ngày *tốt*. Nhưng ngay cả bản đã sửa nghĩa ấy vẫn tính 34px lên **mọi** lần mở popover để trả lời một câu mỗi tuần mới hỏi một lần, mà màn **Nhìn lại** đã trả lời nó bằng cả một chart có trục và tooltip từng cửa sổ |
| gradient chạy dọc chiều dài thanh | **có làm**, nhưng neo vào chính mảng đặc chứ không vào rãnh | lý do cấm cũ vẫn đúng — một dải màu chạy dọc chiều dài mời người đọc hiểu chiều ấy thành thang thứ hai. Neo vào mảng thì mảng 6% và mảng 94% đều chạy trọn nhạt→đậm trên bề dài của mình, nên ở mọi trị nó cho ra đúng một hình: không chở tin thì không cãi được với con số. Neo vào rãnh (`background-attachment`) thì ngược hẳn — **đừng đổi** |
| mắt sáng phát quang | mắt **tối** trên mặt tím sáng, đốm nắng nhỏ ở góc trên-trái | hai ô sáng cách nhau hai ô thì quầng nối vào nhau, cả cái mặt đọc thành một tấm kính lặn |

Cả gradient lẫn vệt nắng đều khoanh trong `.mb-wrap`, nên 15 cái thanh ở màn Token trên
web vẫn phẳng như cũ.

### Bàn chỉnh popover

**Màn cuối trên thanh rail — phím `9`.** Cũng mở được thành trang lẻ, không có gì khác
trong tầm mắt:

```
http://localhost:4400/menubar-demo.html
```

Hai lối vào, **một ruột** ([`public/views/bench.js`](public/views/bench.js)) — không có
bản thứ hai để lệch. Nó vào nav vì trước 3/8 nó chỉ có URL kia, và **không một đường nào
trên dashboard trỏ tới**: một công cụ phải nhớ URL mới mở được thì lần sau cần đến sẽ tìm
không ra.

Popover bên trái do **chính `popoverView` mà app đang gọi** vẽ ra, không phải một bản dựng
lại — cùng lý do với `NOW_SNAP`: một bản "gần giống" để ngắm là bản sẽ lệch khỏi bản chạy
thật.

Công tắc chia **hai loại, chốt vào hai file khác nhau** — trang in sẵn cả hai khối cần chép:

| Loại | Công tắc | Chép vào |
|---|---|---|
| **Bố cục** | tab · độ dày thanh · nhãn gộp hàng · khung cảnh · nhãn dự phóng · bề rộng | `DEFAULTS` ở đầu [`public/lib/menubar-view.js`](public/lib/menubar-view.js) |
| **Ánh sáng** | vệt nắng nền (kích thước, độ đậm) · loá dọc bề dày thanh (độ mạnh, mép cắt) | khối `.mb-wrap` trong [`public/styles.css`](public/styles.css) |

Loại thứ hai có vì ánh sáng là thứ chỉnh bằng **mắt**, không bằng lý lẽ: một vệt nắng đậm
20% hay 30% thì không suy ra được, phải vặn thử rồi nhìn — mà trước đây mỗi lần vặn là
một lần sửa `styles.css` rồi tải lại trang. Bàn chỉnh chèn một khối `<style>` nhắm thẳng
`.mbd-stage .mb-wrap`, nên cái thấy và cái in ra không bao giờ lệch nhau — và nó sống sót
qua lượt vẽ lại 30 giây một lần của dashboard, thứ mà `style.setProperty` sau khi vẽ thì
không.

Hai công tắc **buổi** và **nền sáng/tối** không thuộc loại nào: bản thật lấy buổi theo giờ
máy và lấy nền theo appearance của macOS, không có công tắc nào cả; chúng chỉ là kính lúp
của bàn chỉnh. Nền lật bằng `.theme-light` / `.theme-dark` đặt lên **khung xem**, không
lên thẻ `html` — đổi nền để so bảng màu thì cái bảng công tắc đang đọc dở không có lý do
gì phải nhảy theo.

Dưới khung xem là dòng số đo, có cả trần chiều cao của màn hình này. Khung xem **ghim lại
khi cuộn** — bảng công tắc dài hơn màn hình, mà cuộn tới cái cần vặn rồi mà thứ nó thay
đổi đã trôi khỏi màn thì bàn chỉnh không chỉnh được gì. Núm nào có nhãn là một **mức**
("rộng", "đậm", "1.4") thì xếp thành một hàng ngang thay vì mấy hàng dọc — mười một núm
xếp dọc hết thì thứ đang vặn và thứ nó làm đổi không còn cùng nằm trong một màn hình.

Chốt bố cục không phải dựng lại app, kể cả khi đổi bề rộng: trang khai cả rộng lẫn cao
cho Swift.

| | |
|---|---|
| [`app/NowMenuBar.swift`](app/NowMenuBar.swift) | ~290 dòng, và **không biết luật hạn mức nào**: chữ lấy từ `/api/badge`, popover là trang web bên dưới |
| [`public/menubar.html`](public/menubar.html) · [`menubar.js`](public/menubar.js) | ruột popover. Gọi thẳng `lib/quota.js` — cùng `quotaBar`, cùng câu chữ với màn Token, nên không thể nói khác dashboard |
| `/api/badge` trong [`server.js`](server.js) | chốt chữ và bậc màu ở một chỗ. Server import `public/lib/quota.js` (module của trình duyệt) cố ý: thang bỏ phí chỉ được có một bản |
| [`app/make-tones.py`](app/make-tones.py) | bóc năm mã màu thẳng từ `styles.css` lúc dựng, sinh `Tones.swift`. **Hiện không dùng** — chữ trên thanh vẽ dưới dạng ảnh `isTemplate` nên chỉ giữ được alpha, không giữ màu. Vẫn dựng cùng app để bật lại màu chỉ tốn một dòng |
| [`bin/install-app`](bin/install-app) | sinh `Tones.swift`, biên dịch bằng `swiftc`, cắt `.icns` từ `public/icon-1024.png`. Chạy lại bao nhiêu lần cũng được; từ chối đè nếu chỗ đó đang là app khác |

Cần Xcode Command Line Tools (`swiftc`) và macOS 13+. Đường dẫn repo ghim tuyệt đối vào
bundle lúc dựng, và vào LaunchAgent luôn trong cùng lượt chạy (xem
[§Bắt đầu](#bắt-đầu)) — cùng lý do: launchd/LaunchServices không giãn `~`/`$HOME`.
**Dời repo thì chạy lại `./bin/install-app`.**

### Cài, gỡ, và sự cố thường gặp

Sổ tay ngắn — đủ để tự xử lý không phải lục code.

**Cài / cài lại:**

```bash
./bin/install-app
```

Idempotent, chạy lại bao nhiêu lần cũng an toàn (kể cả sau khi dời repo, đổi máy, hay
đổi `NOW_PORT`) — ghi đè sạch cả app **và** LaunchAgent mỗi lần.

⚠️ **Nếu service đang chạy sống, lệnh trên sẽ `bootout` nó** để buộc nạp lại đường dẫn
mới — dashboard tắt vài giây, tự lên lại vào lần kế tiếp bạn mở app hoặc gọi
`./bin/now-dash`. Không mất dữ liệu: mọi sổ ghi ở `~/.now-dashboard/`, cài lại không đụng
tới. Muốn nó sống lại **ngay** thay vì chờ:

```bash
launchctl kickstart -k gui/$(id -u)/dev.hoanluu.now-dash
```

**Yêu cầu:** macOS 13+, Xcode Command Line Tools (`xcode-select --install` nếu chưa có
`swiftc`), Node ≥ 18.10. Thiếu `swiftc` → script dừng ngay ở bước biên dịch, **chưa kịp
cài LaunchAgent**. Chỉ cần server nền, không cần icon thanh menu → dùng lệnh `sed` tay ở
[§Bắt đầu](#bắt-đầu), không cần `swiftc`.

| Triệu chứng | Nguyên nhân | Sửa |
|---|---|---|
| App/web app mở ra chỉ thấy "chưa nối được tới server" | LaunchAgent chưa cài, hoặc service đang down | `./bin/now-dash` — tự `bootstrap`/`kickstart` nếu thấy plist. Chưa có plist → `./bin/install-app` trước |
| `install-app` báo *"Đã có app khác ở … — không đè"* | Trùng tên với app KHÁC ở `~/Applications` (vd. web app Safari cũng có thể tên "NOW") — script cố tình không đè app lạ, xem [bin/install-app](bin/install-app) | Đổi tên: `APP_NAME="NOW Dashboard 2" ./bin/install-app`, hoặc tự xoá app cũ nếu chắc chắn là bản rác |
| Dời repo sang chỗ khác, app/service vẫn gọi đường cũ | `__ROOT__` ghim tuyệt đối lúc cài, không tự giãn lại khi repo di chuyển | Chạy lại `./bin/install-app` **ở vị trí mới** của repo |
| Đổi `NOW_PORT` nhưng service vẫn dùng cổng cũ | Cổng ghim trong plist lúc render, không đọc lại lúc chạy | `NOW_PORT=xxxx ./bin/install-app` rồi `launchctl kickstart -k gui/$(id -u)/dev.hoanluu.now-dash` |
| Không thấy log gì dù chắc chắn có lỗi | Log của service nằm ở `~/.now-dashboard/`, không phải terminal (launchd không có stdout) | `tail -f ~/.now-dashboard/service.err.log` |

**Gỡ cài đặt — theo đúng thứ tự này:**

```bash
# 1. Dừng và bỏ đăng ký khỏi launchd TRƯỚC — làm sau bước 3 thì service còn sống sẽ
#    lặp lại tìm bin/now-dash-service ở đường dẫn vừa bị xoá, spam service.err.log.
launchctl bootout gui/$(id -u)/dev.hoanluu.now-dash 2>/dev/null || true

# 2. Xoá định nghĩa LaunchAgent và app (đổi tên nếu bạn từng cài với APP_NAME khác)
rm -f ~/Library/LaunchAgents/dev.hoanluu.now-dash.plist
rm -rf ~/Applications/"NOW Dashboard.app"

# 3. (tuỳ chọn) Xoá dữ liệu/log — sổ chu kỳ hạn mức, cache Cursor/Antigravity.
#    KHÔNG PHỤC HỒI ĐƯỢC sau bước này — chỉ chạy nếu chắc chắn không cần tra lại lịch sử.
rm -rf ~/.now-dashboard
```

Gỡ chính repo (`rm -rf` thư mục `git clone`) thì làm **sau cùng**, sau bước 1 — cùng lý
do trong bước 1. Web app thêm qua Safari (§[Chạy như app riêng trên Dock](#chạy-như-app-riêng-trên-dock),
thường tên `NOW.app`) là bundle khác, ba bước trên không đụng tới — gỡ nó thì kéo icon
ra khỏi Dock rồi xoá tay ở `~/Applications`.

## Bảy màn

| Phím | Màn | Trả lời câu hỏi |
|---|---|---|
| `1` | ▦ **Dự án** | Mỗi dự án đang làm gì, next action là gì, board còn tin được không |
| `2` | ◍ **Phiên** | 20 phiên trong cùng một repo — phiên nào cầm mạch nào, resume bằng lệnh gì |
| `3` | ◆ **Quyết định** | Xuyên dự án, trả lời cái nào trước (xếp theo độ gấp) |
| `4` | ✓ **Đã xong** | Mấy hôm nay thực sự làm xong được gì |
| `5` | ◔ **Thống kê** | Công sức đổ vào đâu, tồn đọng ở đâu, mình làm việc mấy giờ |
| `6` | ◈ **Token** | Ba công cụ trả tiền hằng tháng: sắp bị chặn ở đâu, token đi đâu, tiền đi đâu |
| `7` | ⌬ **Sức khoẻ** | Chỗ nào đang khiến dashboard nói dối |

Chi tiết từng tab (Cursor/Antigravity), phím tắt, và cách dùng hàng ngày →
[docs/DESIGN.md](docs/DESIGN.md).

## Tài liệu

| Câu hỏi | Xem |
|---|---|
| Vì sao thiết kế/chart trông thế này | [docs/DESIGN.md](docs/DESIGN.md) |
| Kiến trúc, nguồn dữ liệu, bản đồ file, cạm bẫy | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Khối hạn mức tính/vẽ thế nào | [docs/QUOTA.md](docs/QUOTA.md) |
| Đổi giao diện qua Claude Design | [design/README.md](design/README.md) |
| Việc đang làm / quyết định đang treo | [NOW.md](NOW.md) |
| Việc kỹ thuật còn tồn (backlog) | [BACKLOG.md](BACKLOG.md) |

Chỉnh cổng/đường quét (`NOW_PORT`, `NOW_ROOTS`) và ngưỡng sức khoẻ →
[docs/ARCHITECTURE.md#chỉnh](docs/ARCHITECTURE.md).
