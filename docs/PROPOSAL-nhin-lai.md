# Đề xuất — màn "Nhìn lại" (phím 8)

*Lập 2026-07-28, sau ba vòng phỏng vấn (12 câu đã chốt — bảng ở cuối). Trạng thái:
**đã duyệt cùng tối 28/7** — [design/mock-nhin-lai.html](../design/mock-nhin-lai.html) là
hợp đồng bố cục. Mục "Ngay" (tracker sổ chu kỳ) đã làm xong, khối ✅ ở mục 4.*

*Cập nhật 2026-07-30: **`B19` đã thi công xong và lên màn** — chi tiết + số đo trong
khối ✅ của [BACKLOG `B19`](../BACKLOG.md). Ba rủi ro ở mục 6 đều đã ngã ngũ, ghi ngay
dưới từng rủi ro.*

---

## 1 · Vì sao làm — nguyên nhân, hậu quả

**Nguyên nhân.** Ba gói trả trước cộng lại $240/tháng, reset theo chu kỳ, không cộng dồn —
tức giá trị của chúng chỉ đo được **theo từng chu kỳ đã qua**. Nhưng dashboard hiện chỉ nói
HÔM NAY: mọi màn đều là ảnh chụp hiện tại, không màn nào đọc lại quá khứ.

Trớ trêu là dữ liệu quá khứ **đã nằm trên đĩa**, đo 28/7 20:30:

| Sổ trong `~/.now-dashboard` | Có gì | Sâu tới đâu | Ai đọc |
|---|---|---|---|
| `quota-cycles.json` | đỉnh từng chu kỳ 5h/7d của Claude, cả theo model (`m:Fable`) | 26/7 → nay: **9 chu kỳ 5h đã đóng** + chu kỳ 7d đang chạy | **không ai** |
| `usage-rollup.json` | msgs/in/out/cache theo ngày × model | **17 ngày** (12/7 →) | chỉ màn Token (hôm nay) |
| `cursor-events.json` | events/cents/token theo ngày | **16 tháng** (1/2025 →) | chỉ màn Token (hôm nay) |
| `cursor-usage.json` | spend cents + mốc chu kỳ billing | snapshot cuối | màn Token |
| `ag-quota.json` | % còn lại 4 túi hạn mức AG | **chỉ snapshot cuối — ghi đè mỗi lượt** | màn Token |

**Hậu quả.** Hai hậu quả, một cái đang chảy máu:

1. Quyết định giữ/hạ gói ($200 Claude + $20 Cursor + $20 Google) đang dựa trên trí nhớ
   và cảm giác — đúng loại câu hỏi mà dashboard này sinh ra để trả lời bằng số.
2. **AG mất dữ liệu vĩnh viễn mỗi tuần**: snapshot bị ghi đè nên chu kỳ tuần này
   (Gemini đã tiêu 91%, túi Claude/GPT 87%) sẽ biến mất lúc reset **08:04 sáng 29/7**.
   Mỗi tuần chưa có tracker là mất trắng một điểm dữ liệu không dựng lại được.

## 2 · Màn "Nhìn lại" — ba khối, thứ tự có chủ ý

Một màn mới, `nav` thứ 8, phím `8`, tên **"Nhìn lại"**. Phỏng vấn chốt "cả 3 câu cùng có
mặt"; thứ tự đề xuất — khối gắn với quyết định tiền đứng đầu, khối quan sát đứng cuối:

### Khối A — "Gói có đáng tiền không" *(câu dẫn)*

Ba thẻ, **mỗi thẻ chạy trên trục chu kỳ của chính công cụ đó** (đã chốt: không ép trục
chung). Mỗi thẻ: dãy chu kỳ đã đóng (cột = % đã tiêu, tô theo thang bỏ phí sẵn có của
`public/lib/quota.js`), chu kỳ đang chạy kèm dự phóng mang chân trời, và **tiền**:

| | Chu kỳ mang tiền | Giá một chu kỳ | Bỏ phí quy đô |
|---|---|---|---|
| Claude Max 20x | cửa sổ **7 ngày** | $200/tháng → **$46,0**/cửa sổ | `bỏ phí % × $46` |
| Cursor Pro | **chu kỳ billing** (~tháng, mốc lấy từ `billingCycleStart/End` trong sổ) | **$20**/chu kỳ | đo trên **cents thật**: `max(0, $20 − totalSpend)` |
| Antigravity (Google AI Pro) | **túi Gemini weekly** | $20/tháng → **$4,60**/tuần | `bỏ phí % × $4,60` |

Ba luật tiền phải giữ đúng:

- **Claude: 5h không mang tiền.** Một tuần có ~34 chu kỳ 5h, phần lớn rơi vào lúc ngủ —
  tô màu bỏ-phí lên chúng là đỏ rực vô nghĩa. Dãy 5h vẫn hiện (đỉnh từng chu kỳ, số đo
  thật hiện tại: 21·11·32·38·10·1·15·24%) nhưng **trung tính, không màu, không đô** — nó
  trả lời "trần 5h có bao giờ là ràng buộc không" (tới nay: chưa, đỉnh cao nhất 38%).
- **Cursor: dùng cents, không dùng %.** Payload Cursor có ba con số % mâu thuẫn
  (`auto 19,9` / `api 5,7` / `total 18,0` — mẫu số khác nhau), trong khi cents thì thẳng:
  chu kỳ này `totalSpend $62,17` trên `included $20` nhờ bonus $42,17 nhà cung cấp bù.
  Nghĩa là included đã tiêu hết → bỏ phí $0, và phần vượt 3,1× giá gói ăn màu `--cheer`
  đúng thang (vượt mức = tốt hơn cả đạt).
- **AG: tiền neo vào túi Gemini, túi Claude/GPT là chú thích văn xuôi.** Một gói $20 mua
  HAI túi song song — tách giá cho từng túi là bịa một phép chia không tồn tại. Túi
  Gemini là lý do mua gói (và là túi đang tiêu 91%), nên nó mang tiền; túi Claude/GPT
  hiện bằng một câu (`87% tuần này, túi 5h chạm trần hôm nay`) không quy đô. Giả định
  này in thẳng lên màn, không giấu trong code.

Cuối khối A có đúng **một** dòng cộng ngang — chỗ duy nhất được phép quy về trục chung,
và phải mang nhãn quy đổi: *"quy cùng về tuần để cộng được: ba gói ≈ $55/tuần — tuần này
bỏ phí ≈ $0"*.

### Khối B — "Nhịp 14 ngày"

Mỗi công cụ **một dải riêng, đơn vị riêng** (out-token/ngày cho Claude, events/ngày cho
Cursor) — không stack, không hai trục chồng: hai đại lượng này lệch nhau bốn bậc, mọi
phép ghép đều nói dối. Dữ liệu đã có sẵn: `usage-rollup` 17 ngày, `cursor-events` 16
tháng. **AG vắng mặt ở khối này** và nói ra bằng câu văn xuôi: sổ AG chỉ giữ hạn mức,
không có sự kiện theo ngày; nếu lúc làm kiểm được `gen_metadata` mang timestamp thì bổ
sung, không thì thôi — không hứa trước.

### Khối C — "Xu hướng tuần"

Cột theo tuần (out-token Claude, cents Cursor, % đỉnh AG) — **chỉ mở khi sổ chu kỳ đủ 3
tuần**, trước đó là một câu nói rõ nó đang chờ gì và mở lúc nào: *"sổ chu kỳ mở 26–28/7,
khối này tự mở ~17/8 — trong lúc chờ, khối B đã nhìn lại được 14 ngày"*. Đây là cổng
theo-dữ-liệu-có-thật, không phải cổng theo-ngưỡng-quan-trọng: trạng thái non nói rõ nó
thiếu gì, đúng bài học B15.

## 3 · Kiến trúc — read-only giữ nguyên tuyệt đối

Không đường ghi nào mới ra ngoài `~/.now-dashboard` (chỗ đó vốn là sổ của chính app):

```
agquota.js ──┐  gấp thêm chu kỳ   ┌─ ag-cycles.json      (sổ MỚI, shape v2 y quota-cycles)
cursor.js  ──┘  theo pattern      └─ cursor-cycles.json  (sổ MỚI)
                trackQuota sẵn có
                                       │
src/lib/cycles.js (MỚI) ── hàm thuần: gấp chu kỳ, tiền, dự phóng, cổng-3-tuần
                                       │
src/collect/lookback.js (MỚI) ── đọc 5 sổ → state.lookback (chỉ mảng đã gấp, ~vài KB —
                                       │      không chở raw, không nuôi thêm B14)
public/views/lookback.js (MỚI) + nav thứ 8 + khoá i18n lookback.* VI+EN (parity test tự gác)
src/config.js: PLANS = { claude: 200, cursor: 20, antigravity: 20 }  // USD/tháng, sửa tay khi đổi gói
```

Giá gói là config tay — cái giá của nó: đổi gói mà quên sửa thì tiền trên màn sai. Chốt
chặn: **màn in giá đang khai ngay cạnh số** ("Max 20x · $200/tháng đang khai trong
config") để mắt bắt được, không cần nhớ.

Test (`test/cycles.test.js`): gấp chu kỳ qua ranh reset, chu kỳ vắt đêm, tiền ($46,0 /
$4,60 / cents Cursor), cổng 3 tuần, và ca "ngày hôm nay là đầu vào ẩn" đã từng cắn ở B17.

## 4 · Phạm vi 2 ngày — và một việc 30 phút nên làm TRƯỚC khi duyệt

- **Ngay (30–60′, độc lập với đề xuất):** chỉ hai tracker `ag-cycles` + `cursor-cycles`.
  Lý do gấp: chu kỳ AG 91%/87% tuần này **chết lúc 08:04 sáng 29/7**. Tracker lên trước
  mốc đó thì tuần này thành điểm dữ liệu đầu tiên thay vì tuần bị mất. Kể cả sau đó bạn
  bác toàn bộ màn Nhìn lại, hai sổ này vẫn vô hại (app chưa đọc chúng).

  **✅ Đã làm (28/7 ~21:30, ngay tối duyệt đề xuất)** — `bumpCycles` tách lõi thành
  `bumpWindows` dùng chung ([src/collect/quotalog.js](../src/collect/quotalog.js)), sổ
  mới gấp trong [src/collect/cycletrack.js](../src/collect/cycletrack.js), nối vào đường
  quét ở [src/state.js](../src/state.js). Test 314/314 xanh (7 test mới trong
  [test/cycletrack.test.js](../test/cycletrack.test.js), gồm ca trường-ngoài-lõi rụng khi
  khởi động lại — lỗi suýt xảy ra thật khi viết). Chu kỳ tuần này đã nằm trên đĩa TRƯỚC
  mốc reset: `gemini-weekly` đỉnh **94,3%** (ảnh 21:18 còn cao hơn số 91% lúc soạn đề
  xuất), `3p-weekly` 87,1%, `3p-5h` 99,0%, Cursor `billing` **6217 cents** kèm
  `planCents`/`bonusCents`. Service khởi động lại (pid 91339), trang sống, không lỗi
  cycletrack trong `service.err.log`.
- **Ngày 1:** `src/lib/cycles.js` + `collect/lookback.js` + bộ test — thuần server, chưa
  đụng UI.
- **Ngày 2:** `views/lookback.js` + i18n + đối chiếu với mock đã duyệt + nghiệm thu
  **EN × hai nền** trên dữ liệu thật (đúng lệ đã thành nếp từ màn Token).

Ước chi phí phiên implement: ~120–180k token output (3 file mới + sửa 4 file + test +
i18n hai bên). Mock và spec này không tính — đã trả rồi.

## 5 · Tradeoff đã cân — và cái cố ý KHÔNG làm

- **Không backfill** (đã chốt). Thiệt hại thật chỉ rơi vào AG (nguồn khác vốn đã sâu:
  Cursor 16 tháng, Claude-ngày 17 ngày, Claude-chu-kỳ 3 ngày). Cửa mở lại: nếu sau 2
  tuần vẫn đói dữ liệu, transcripts và SQLite `gen_metadata` vẫn nằm đó — mất thời gian
  chờ, không mất dữ liệu.
- **Không quy "giá trị API tương đương"** ("lượng token này mua lẻ giá API = $X").
  Quyến rũ nhưng hai lỗi: bảng giá API trôi theo thời gian (thêm một thứ phải nuôi), và
  số dễ thổi — cents của `cursor-events` tháng 6 cộng ra ≈ $236/tháng trên gói $20, cho
  thấy "API-equiv" tạo cảm giác lãi 10× không giúp quyết định gì. Hoãn, ghi lại để khỏi
  bàn lại.
- **Không mô phỏng hạ bậc** ("nếu xuống Max 5x thì tuần nào chạm trần") — cần dữ liệu
  nhiều tuần mới đáng tin, để dành khi khối C đã mở.
- **Trục chu kỳ riêng từng công cụ** (đã chốt): ba thẻ khối A không so ngang được nhau —
  đổi lại không thẻ nào nói dối về ranh reset. Dòng quy-về-tuần duy nhất ở cuối khối A
  là chỗ nhượng bộ có dán nhãn.

## 6 · Rủi ro thật, nói trước

1. **Đơn vị cents của `cursor-events` chưa chắc là tiền bị tính** (June ≈ $236 > giá gói
   — nhiều khả năng là giá-trị-API-quy-đổi của usage). Trước khi vẽ tiền QUÁ KHỨ của
   Cursor phải đối chiếu với `planUsage`; nếu không khớp thì chu kỳ cũ của Cursor chỉ
   hiện events, không hiện đô.
   *→ Ngã ngũ 30/7: **khớp 0,0%** — cents sự kiện cộng trong đúng chu kỳ billing =
   `planUsage.totalSpend` ($68,07 = $68,07). June $236 là tháng `bonusSpend` nhà cung
   cấp bù lớn, không phải API-quy-đổi. Tiền quá khứ Cursor được vẽ.*
2. **Ranh gấp chu kỳ 7d của Claude chưa kiểm được** — sổ mới có một chu kỳ, chưa thấy nó
   lăn qua reset lần nào. Test phải dựng ca này bằng dữ liệu giả.
   *→ Test dựng ca lăn-qua-reset bằng chính `bumpWindows` trong
   [test/cycles.test.js](../test/cycles.test.js); ranh thật đầu tiên tự kiểm lúc cửa sổ
   7d đóng 31/7 01:00.*
3. **AG theo ngày** phụ thuộc `gen_metadata` có timestamp hay không — kiểm 15 phút lúc
   làm, hai nhánh đều đã có chỗ đứng trong thiết kế (có → thêm dải; không → câu văn xuôi).
   *→ Ngã ngũ 30/7: **CÓ** — `agTurns.series` đã gấp sẵn theo ngày từ timestamp của
   từng lượt; khối B mang dải AG thật (đỉnh đo được 28/7: 1.631 lượt/ngày).*

Một rủi ro mục 6 KHÔNG lường trước, phát hiện lúc làm: **hai túi 5 giờ của AG có mốc
reset TRƯỢT theo lượt đọc** — sổ `ag-cycles` đầy bản ghi giả một-mẫu (328 sau hai ngày).
Vô hại (trim có trần) nhưng mọi phép gấp của màn chỉ nhận kind `-weekly`; ghi lại ở đầu
[src/lib/cycles.js](../src/lib/cycles.js) để người đọc sổ sau khỏi cộng nhầm rác.

## 7 · Hồ sơ phỏng vấn — 12 câu đã chốt (28/7)

| # | Câu hỏi | Chốt |
|---|---|---|
| 1 | Hướng tính năng | **Nhìn lại theo thời gian** |
| 2 | Ranh giới ghi | **Chỉ-đọc tuyệt đối** |
| 3 | Cỡ đầu tư | **1–2 ngày** |
| 4 | Sản phẩm đề xuất | **Đặc tả + mockup HTML** |
| 5 | Câu dẫn của màn | **Cả 3** (đáng tiền / nhịp / xu hướng) — thứ tự do mock đề xuất, tiền đứng đầu |
| 6 | Trục so sánh | **Chu kỳ của từng công cụ**, không ép trục chung |
| 7 | Backfill lịch sử | **Không** — chỉ từ ngày sổ ghi |
| 8 | Quy ra tiền | **Có** — giá gói khai trong config |
| 9 | Giá Claude | **$200/tháng** (Max 20x) |
| 10 | Giá Cursor | **$20/tháng** (Pro) |
| 11 | Giá AG | **Google AI Pro ~$20/tháng** — AG tham gia đủ câu "đáng tiền" |
| 12 | Đơn vị tiền | **USD** |
