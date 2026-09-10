# Roadmap — NOW

*Tiếng Việt, giống [BACKLOG.md](../BACKLOG.md) và [NOW.md](../NOW.md): đây là tài liệu
sống, đổi theo từng lượt việc, nên nó không có bản song ngữ. Tài liệu ổn định thì có:
[ARCHITECTURE](ARCHITECTURE.md) · [DESIGN](DESIGN.md) · [QUOTA](QUOTA.md).*

Lập ngày **2026-09-10** sau một lượt khảo sát cả hai nửa của repo, đọc bằng nhiều agent
song song rồi kiểm chứng lại từng phát hiện bằng lệnh chỉ đọc trên server đang chạy.

**Phân vai với hai file cạnh nó.** `BACKLOG.md` giữ *việc kỹ thuật đã có bằng chứng đo
được*, `NOW.md` giữ *mạch việc đang chạy hôm nay*, còn file này giữ *thứ tự*. Một mục ở
đây không mô tả cách làm, nó chỉ nói vì sao mục này phải đứng trước mục kia. Chi tiết thi
công nằm ở `BACKLOG.md`.

---

## Nguyên tắc xếp thứ tự

1. **Cái gì đang nói dối thì sửa trước.** Một collector trả số 0 mà vẫn báo `ok: true`
   nguy hiểm hơn hẳn một collector chết hẳn, vì người đọc không có cách nào biết.
2. **Cái gì chặn người dùng thứ hai thì sửa sau đó.** Repo đã public; luật chỉ chạy được
   trên máy tác giả là luật không thi hành được.
3. **Cái gì chỉ đẹp hơn thì để cuối.** Nén payload, tách CSS, gộp file: có số đo nhưng
   không ai đang bị lừa vì chúng.

---

## Chân trời 1 — đến 10/10/2026 · Lõi sống lại, phát hành, bịt chỗ nói dối

**Xong khi:** board được cập nhật đều trở lại, v1.2.0 và plugin 0.2.1 đã lên marketplace,
Antigravity và sổ chu kỳ AG không còn trả số giả, và đổi tên một field trong `buildState`
làm CI đỏ.

| Việc | Vì sao đứng ở đây |
|---|---|
| Bật plugin `now-board`, bỏ bản skill cá nhân trùng | Plugin bị tắt trên chính máy tác giả nên mọi thứ nó hứa chưa từng chạy một lần |
| Chế độ xem của skill thôi tự ghi file, đo drift có kiểm mốc trước | Đây là điều kiện của mục "skill read-only" ở chân trời 2, không phải một cleanup riêng |
| Phát hành plugin 0.2.1 và dashboard v1.2.0 | Bản cache trên máy người cài lệch nguồn, và 14 commit đã treo một tháng |
| Antigravity: nói ra khi hình dạng dữ liệu đổi | Tab Token hiện 0 lượt suốt ba tuần mà không cảnh báo gì |
| Sổ chu kỳ AG tự lành ở mỗi lượt ghi | Sổ phình lại 187 KB và sẽ vẽ hàng trăm chu kỳ 0% giả sau mốc reset |
| Trạng thái đói rời kênh cảnh báo đỏ của icon | Icon ở mức đỏ nhất hai ngày liền vì một trạng thái trò chơi |
| Lưới test gọi hàm render của mọi màn | Lỗ `task_33a66d84`, đã có ca test xanh mà màn hình rỗng |

## Chân trời 2 — đến 10/12/2026 · Plugin ra được cho người lạ

**Xong khi:** một người không phải tác giả cài plugin, chạy `update` ở repo của họ, và
board họ viết validate được bằng một URL schema công khai.

| Việc | Vì sao đứng ở đây |
|---|---|
| Cắt luật chỉ đúng với harness riêng ra khỏi `SKILL.md` | Người cài đang nhận về luật không thi hành được, và model sẽ tự diễn giải mỗi lần một kiểu |
| Publish `now.schema.json`, đặt `$id` là URL đó | Ai muốn đọc board đều phải vendor một bản, đúng vấn đề mà việc tách plugin sinh ra để chấm dứt |
| Một validator zero-dep đóng gói trong plugin, dashboard dùng chung | Hiện hai bên chép tay hai bản luật và đã lệch nhau: 2/9 board thật fail schema mà dashboard vẫn xanh |
| Tách skill `now-status` chỉ đọc cho Claude tự gọi | Chỉ khả thi sau khi đường đọc thôi ghi file |
| Tách `src/http.js` không `listen` để test được tầng route | Mọi phép kiểm traversal, allowlist, trần body đang chỉ được kiểm bằng tay |
| Fixture chụp từ dữ liệu thật cho từng collector không có hợp đồng | Fixture dựng tay theo hình dạng tháng 7 là lý do bộ test xanh trong khi collector mù |
| Viết lại board bằng tiếng Anh | Là một bản viết lại chứ không phải bản dịch, nên phải đứng sau việc cắt luật harness |

## Chân trời 3 — đến 10/03/2027 · Ranh giới và bề mặt mới

**Xong khi:** lớp trò chơi có số phận rõ ràng bằng văn bản, Linux có bậc "chỉ server", và
board tự nhắc cập nhật mà không cần ai nhớ.

| Việc | Vì sao đứng ở đây |
|---|---|
| Chốt số phận lớp trò chơi rồi tách `public/game/` nạp lười | Lớp này là 43% khối lượng JS của frontend và mọi người mở dashboard đều tải nó |
| Bậc "chỉ server" cho Linux, kèm một unit systemd mẫu | Phần server đã chạy đủ bộ test trên ubuntu trong CI, chỉ thiếu tài liệu và một file mẫu |
| `bin/uninstall-app` | Gỡ cài đặt hiện là ba khối lệnh gõ tay có thứ tự bắt buộc |
| Hook `SessionEnd` ghi bản nháp board, và dòng "board lệch N commit" trên statusline | Đi ngược quyết định "đường ghi đứng sau một lệnh gõ tay", nên chỉ mở ra sau khi thấy skill read-only có được dùng đều không |
| Tách `projects[].now` khỏi payload SSE | Chỉ làm khi payload vượt 500 KB; hiện 369-436 KB |
| Kiểm `Host` cho server, đặt hạn chót cho `buildState` | Tác động thật với một người dùng trên máy cá nhân là thấp, nhưng khép kín threat model đã tự viết ra trong `server.js` |

---

## Quyết định đang chờ chủ dự án

Mỗi mục trả lời được trong một câu. Chốt xong thì chuyển sang `BACKLOG.md` kèm ngày.

| Mã | Câu hỏi | Đang khoá gì |
|---|---|---|
| `d-game` | Lớp trò chơi: đóng băng, cắt về badge cộng thang ngồi lâu, hay tách thành package riêng? | Mọi mục lớp trò chơi ở chân trời 3 |
| `d-readonly` | Có mở một skill chỉ đọc cho Claude tự gọi và trả always-on cost khoảng 700 byte mô tả không? | Mục `now-status` ở chân trời 2 |
| `d-maxitems` | Vượt `maxItems` trong schema là lỗi cứng hay cảnh báo? | Hình dạng của validator dùng chung |
| `d-push` | Còn cần đẩy `design/dist` lên project claude.ai không? Treo từ 26/7 | Vòng thiết kế; nếu 46 ngày qua không ai cần thì đóng luôn |
