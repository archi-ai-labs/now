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
cp launchd/dev.hoanluu.now-dash.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.hoanluu.now-dash.plist
```

Sửa đường dẫn trong plist nếu repo không nằm ở `~/Projects/local/now_dashboard`.
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
