---
name: now-dash
description: Cài hoặc cập nhật NOW dashboard — trang gộp mọi NOW.json đã ghi, phiên Claude đang chạy, và mức tiêu của ba công cụ trả tiền hằng tháng, cộng một mục trên thanh menu macOS. Chỉ chạy trên macOS và cần bộ biên dịch Swift.
disable-model-invocation: true
---

# Cài NOW dashboard

Skill `now` ghi bảng cho **một** repo. Dashboard đọc bảng của **mọi** repo rồi dựng thành
một trang, kèm một mục trên thanh menu liếc được không cần mở cửa sổ. Nguồn nằm cùng repo
với plugin này: <https://github.com/archi-ai-labs/now>.

Skill này chỉ chạy khi user gọi thẳng — không tự nhảy vào giữa việc khác.

## Dừng ngay nếu không phải macOS

`uname -s` khác `Darwin` → **dừng, nói rõ, đừng thử tiếp**. Dashboard buộc dính macOS ở ba
chỗ: mục thanh menu viết bằng AppKit, server nền chạy bằng LaunchAgent, và bản dựng cần
`swiftc`. Không có đường lui từng phần — nói thẳng là chưa hỗ trợ, đừng cài nửa vời rồi để
user gỡ.

## 1. Tìm bản đã có — đọc, đừng đoán

```bash
plutil -extract WorkingDirectory raw ~/Library/LaunchAgents/io.github.archi-ai-labs.now-dash.plist 2>/dev/null
```

File này do `bin/install-app` sinh ra, và nó **giữ đường dẫn tuyệt đối của bản đang chạy**.
Đó là nguồn đáng tin duy nhất. Đừng đi tìm trong `~/Projects` theo tên — đoán trượt là dựng
ra một bản thứ hai nằm cạnh bản cũ, hai LaunchAgent tranh nhau một cổng, và cái hỏng chỉ lộ
ra sau lần đăng nhập kế tiếp.

Không có file → chưa cài, sang **2a**. Có → sang **2b**.

## 2a. Chưa cài — lấy nguồn về

Hỏi user chỗ đặt, mặc định `~/Projects/archi-ai-labs/now`:

```bash
git clone https://github.com/archi-ai-labs/now ~/Projects/archi-ai-labs/now
```

**Chỗ này về sau đổi rất đắt** (xem *Bẫy* bên dưới), nên hỏi một câu bây giờ rẻ hơn nhiều so
với dời về sau. Tuyệt đối không đặt trong `~/.claude/plugins/cache` — lý do ở *Bẫy*.

## 2b. Đã cài — cập nhật

```bash
git -C "$ROOT" status --porcelain
```

Còn thay đổi chưa commit → **DỪNG, không `git pull`**. In danh sách file ra và hỏi user. Một
cú pull vào cây bẩn là mất việc đang dở, và đây là skill người ta gọi lúc không để ý.

Cây sạch → `git -C "$ROOT" pull --ff-only`. Không fast-forward được thì cũng dừng và hỏi;
đừng merge hộ.

## 3. Dựng

```bash
cd "$ROOT" && ./bin/install-app
```

Chạy lại bao nhiêu lần cũng được: bundle dựng ở thư mục tạm rồi mới thay chỗ cũ, và script
tự ghi lại LaunchAgent theo `$ROOT` hiện tại rồi `bootout` bản cũ.

**Không có bộ biên dịch Swift** → script tự dò `xcode-select` hỏng và **in sẵn lệnh chữa**.
Chuyển nguyên văn mấy dòng ấy cho user. Đừng diễn giải lại thành lời của mình: thông báo
gốc có đường dẫn thật trên máy này, bản diễn giải thì không.

Server nền lên bằng:

```bash
./bin/now-dash
```

## 4. Xác minh — ba câu hỏi, ba lệnh

Đừng báo "đã cài xong" khi mới chỉ thấy script chạy hết. Ba thứ hỏng độc lập với nhau:

| Hỏi | Lệnh | Đạt là gì |
|---|---|---|
| Server sống chưa | `curl -sf http://localhost:4400/api/ping` | trả về, không lỗi |
| Nút trên thanh menu có vẽ không | `NOW_SNAP=/tmp/btn.png "$HOME/Applications/NOW Dashboard.app/Contents/MacOS/now-dash-menu"` | in ra cỡ nút và đường ảnh |
| Popover có bị cắt không | `NOW_PROBE=1 "$HOME/Applications/NOW Dashboard.app/Contents/MacOS/now-dash-menu"` | cỡ popover khớp cỡ trang |

Cổng mặc định 4400, đổi bằng `NOW_PORT`.

## Bẫy đã biết

- **`ROOT` nướng vào binary lúc dựng.** `bin/install-app` chốt đường dẫn tuyệt đối vào cả
  binary Swift lẫn plist LaunchAgent — không có biến nào giãn lúc chạy. Dời thư mục repo là
  **phải chạy lại `install-app` từ chỗ mới**, và phải thoát app menubar cũ trước, nếu không
  bản cũ vẫn ngồi trên thanh trỏ vào đường đã chết.

- **Không bao giờ chạy từ cache plugin.** Đường cache có số phiên bản nằm giữa
  (`~/.claude/plugins/cache/<marketplace>/now-board/<version>/`). Nâng plugin một nấc là
  `ROOT` cũ biến mất, còn LaunchAgent thì vẫn kiên trì gọi mãi một đường không còn tồn tại.
  Dashboard phải nằm ở một chỗ do user chọn và sống lâu hơn plugin.

- **Không thấy icon ≠ app hỏng.** Thanh menu đầy thì macOS lẳng lặng bỏ phần thừa, trên máy
  có notch thì nuốt vào notch. `NOW_SNAP` ở trên trả lời được đúng câu "nút có vẽ không" mà
  không cần nhìn thanh.

- **Đẩy code lên thì cần đúng danh tính.** Repo thuộc tổ chức `archi-ai-labs`. Máy nào có
  nhiều tài khoản GitHub thì clone bằng https vẫn đọc được, nhưng push phải đi qua remote
  trỏ đúng tài khoản có quyền — không thì 403 mà thông báo lại nói về một tài khoản khác.
