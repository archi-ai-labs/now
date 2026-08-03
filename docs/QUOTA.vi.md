# Khối hạn mức — vì sao đọc ngược so với thanh tiến trình quen thuộc

*🇻🇳 Tiếng Việt · 🇬🇧 [English](QUOTA.md)*

Quyết định thiết kế đằng sau [`public/lib/quota.js`](../public/lib/quota.js) và các thẻ
hạn mức ở màn Token. Bản đồ file chung xem [ARCHITECTURE.vi.md](ARCHITECTURE.vi.md).

Thanh hạn mức KHÔNG đọc theo lối "đầy là nguy". Gói thuê bao đã trả tiền rồi, còn
hạn mức thì reset theo cửa sổ và **không cộng dồn** — phần chưa dùng lúc reset là mất
trắng. Nên "còn 57%" không phải tin tốt, và "đã tiêu 90%" không phải cảnh báo. Vì vậy cả
màn này đảo lại so với lối vẽ quen thuộc:

- Số dẫn là **đã tiêu**, không phải còn lại. Phần chưa dùng chỉ xuất hiện dưới đúng tên
  của nó — *bỏ phí* — và chỉ ở cột dự báo, nơi nó thật sự là một kết cục.
- Màu đo **đúng một đại lượng: bỏ phí** (`100 − dự phóng`), và đo nó theo **cả hai
  chiều** — trị âm nghĩa là nhịp này đòi nhiều hơn cả cửa sổ có:

  | bỏ phí | màu | nghĩa |
  |---|---|---|
  | ≥ 50% | đỏ | quá nửa hạn mức sẽ mất trắng |
  | 10 – 50% | vàng | còn một mảng đáng kể không kịp dùng |
  | −10% … 10% | xanh lá | hạ cánh quanh đúng 100% — đích |
  | < −10% | đỏ tía | dùng hết mức, nhịp đòi quá trần |
  | — | xám | chưa đọc được nhịp |

  Băng xanh rộng 20 điểm về cả hai phía vì dự phóng là một đường thẳng kẻ từ đầu cửa sổ
  còn nhịp thật thì giật cục: đòi nó hạ cánh đúng 100,0 thì mọi cửa sổ đều trượt vì một
  chỗ lệch mà chính phép đo không phân giải nổi.
- **Cạn trước reset không bao giờ là đỏ.** Việc cạn sớm có một cái giá riêng — ngồi không
  chờ reset — nhưng cái giá ấy trả bằng *thời gian*, còn kênh màu đã dành trọn cho *tiền*.
  Trộn hai thứ vào một kênh thì cùng một sắc đỏ vừa nghĩa "mất tiền" vừa nghĩa "mất buổi
  chiều", và không nghĩa nào còn đọc được. Khoảng ngồi không vì thế ra **chữ**, qua
  `idleMsOf`, với ngưỡng `max(6% chiều dài cửa sổ, 20 phút)` — phần trăm cầm trịch ở khung
  dài (6% của tuần ≈ 10 giờ, cả một ngày làm việc bị chặn), sàn cầm trịch ở khung ngắn.
- Câu của cửa sổ vượt trần **mở đầu bằng mốc cạn** — nó là phần đúng đích, và giờ màu đồng
  ý với nó. Cái giá đi sau như một mệnh đề nhượng bộ: *"cạn sau 3 ngày, rồi ngồi không 19
  giờ tới lúc reset."*
- Câu dự phóng **mở đầu bằng kỳ hạn**, không bằng "nhịp này": *"dự phóng tuần này 73% —
  bỏ phí 27%"*. Bản trước viết "nhịp này chỉ tới 73%", và câu đó thiếu đúng cái làm con số
  dùng được — 73% *lúc nào*. Nhãn bên cạnh có ghi "7 ngày", nhưng đó là tên của cửa sổ chứ
  không phải một mốc, nên phép ghép vẫn nằm ngoài câu. Kỳ hạn suy từ `windowMs`
  (`periodText`) nên cùng một câu dùng được cho cả ba nguồn: *phiên 5h này* · *tuần này* ·
  *tháng này* (chu kỳ Cursor).

Thanh chia **ba mảng**: mảng đặc = đã tiêu · mảng gạch chéo `→52%` nhịp này sẽ tiêu thêm
tới đâu · mảng nhạt cuối `bỏ phí 48%`. Đuôi thanh cố tình **không để trống** — rãnh trống
đọc thành "chỗ còn dư", đúng nghĩa ngược với thứ nó đang chỉ — và mang cả **chữ** chứ
không chỉ con số, vì "48%" đứng một mình cạnh một mảng nhạt lại đọc ra đúng cái nghĩa
ngược ấy. Vạch dọc là **mốc trung bình**, chỗ phải đứng nếu tiêu đều theo đồng hồ, có chú
thích `trung bình 52%` neo ngay dưới chân vạch.

Luật của thẻ là **mỗi con số xuất hiện đúng một lần**. Bản trước phạm ở cả bốn: `27%` to
ở trên rồi `27%` lần nữa trong mảng đặc, `→52%` trong mảng gạch rồi "chỉ tới 52%" ở câu
dưới, `48%` ở đuôi thanh rồi "bỏ phí 48%" cũng ở câu ấy. Từng chỗ đều có lý do riêng khi
thêm vào, mà cộng lại thì mỗi trị đọc hai lần ở hai kiểu chữ khác nhau — mắt phải đi kiểm
xem hai cái đó có phải cùng một con số không, và câu trả lời luôn là có. Nên:

- **mảng đặc bỏ nhãn** — trị của nó đã là con số to nhất thẻ, cách đó 8px;
- **câu kết luận bỏ hẳn với ca đang bỏ phí** — nó chỉ chép lại cái thanh thành văn xuôi.
  Chữ dưới thanh chỉ còn xuất hiện khi hình **không nói hết được**: sắp kẹt (kẹt bao lâu
  thì không có mảng nào vẽ ra được) hoặc chưa đoán nổi nhịp. Hạ cánh đúng đích thì im lặng.

Luật ấy có **đúng một ngoại lệ, do người dùng chọn**: `≈$248` — tiền của riêng cửa sổ này —
đứng cả trên thẻ lẫn trong tooltip. Nó đáng đúp vì hai con số trả lời hai câu khác nhau:
phần trăm nói *còn bao nhiêu phần hạn mức*, tiền nói *gói này đang moi ra được bao nhiêu* —
và câu thứ hai là câu duy nhất so được giữa hai cửa sổ dài ngắn khác nhau. Bắt rê chuột mới
thấy thì nó thành số của người đi soát, không phải số của người liếc một cái rồi quyết phiên
tới chạy ở đâu.

## `≈$` lấy ở đâu, và vì sao nó lệch được với phần trăm

Mốc mở cửa sổ = `resets_at − độ dài`, cả hai đã có sẵn trong phản hồi hạn mức. Transcript
ghi mốc thời gian **từng lượt gọi**, nên cắt theo giờ là chính xác — `collectUsage` nhận
danh sách cửa sổ từ [`src/state.js`](../src/state.js) và cộng ngay trong vòng lặp đã chạy trên
28 nghìn hàng, không thêm lượt đọc nào. Sổ theo ngày không làm nổi việc này: nó không phân
giải trong ngày.

Ba chỗ con số ấy **không** bằng phần trăm, và giao diện nói ra cả ba (chú thích gập
`qlg.money`):

| | |
|---|---|
| Không phải hoá đơn | bảng giá API × token, trong khi tài khoản trả theo gói |
| Phủ khác nhau | phần trăm là của **cả tài khoản**, số $ đọc từ transcript của **máy này** |
| `≥` thay `≈` | cửa sổ mở trước lượt gọi sớm nhất còn trên đĩa → transcript đã bị dọn, tổng thiếu |

Cửa sổ tuần theo model nối bằng **tên**: endpoint gửi `scope.model.display_name` = `Fable`
với `id` là `null`, nên `modelInScope` khớp từng từ với id thật (`claude-fable-5`). Đổi tên
hiển thị là hỏng âm thầm — hỏng thì cửa sổ đó về `$0`, tức là im lặng chứ không sai số.

## Còn bao lâu thì reset — ba chỗ, ba cách đặt

Câu "còn bao nhiêu thời gian để tiêu dần" phải trả lời được **mà không rê chuột**, nên mốc
reset ra chữ trên màn ở cả ba khối. Chỗ đặt thì theo số đồng hồ thật có trong khối:

- **Thẻ Claude** — góc phải dòng tiêu đề thẻ, mỗi cửa sổ một mốc.
- **Cursor** — **một dòng cho cả khối**, ngay dưới đầu khối: ba nhóm hạn mức nằm chung một
  chu kỳ tháng và reset cùng lúc, in ba lần là ba lần nói cùng một câu.
- **Antigravity** — trên **từng dòng**, mở đầu dòng phụ: bốn hồ × cửa sổ có bốn mốc thật
  khác nhau.
- **Dải quản gia** — một dòng riêng dưới thanh, trên câu dự báo.

Mọi bản đều mono, nhạt, và **không bao giờ mang màu của thang bỏ phí**: nó đo thời gian,
mà kênh màu đã dành trọn cho tiền — cùng lý do với `idleMsOf`.

Mảng đủ rộng để chứa chữ hay không do **container query** quyết, không phải một ngưỡng
phần trăm trong JS: ràng buộc thật là pixel, mà cùng một "20% bề rộng" ra 40px ở thẻ hẹp
và 90px ở màn rộng. Đuôi thanh mang sẵn hai bản — `bỏ phí 48%` và `48%` — CSS chọn bản
vừa chỗ; hai bản là hai chuỗi rời chứ không phải một chuỗi bị cắt, vì tiếng Việt đặt chữ
trước số còn tiếng Anh đặt sau. Nhãn nào rơi trúng vạch trung bình thì **nép sang nửa
rộng hơn** của mảng (`dodge()` trong `lib/quota.js`) — vạch không giấu đi được, vì đúng
lúc nó chồng lên nhãn cũng là lúc nó đang nói điều đáng chú ý nhất.

Dải quản gia hẹp 214px nên vẫn dùng bản thanh không nhãn — ở đó chữ sẽ chồng lên nhau — và
tooltip của cả hai chỗ trải thanh ra thành bảng nhãn ↔ trị, theo đúng thứ tự các mảng, kèm
hai thứ thanh không vẽ được: nhịp `%/giờ` và mốc reset tuyệt đối.

Chú thích cách đọc thanh thì **gập lại** — hướng dẫn học một lần rồi thôi, để nó mở sẵn
là mỗi lượt vào màn phải lướt qua sáu dòng chữ mới tới được mấy con số thật sự cần xem.
