/**
 * Hạt nhân tính toán của con thú — **thuần, không phụ thuộc gì**, và dùng chung giữa
 * server (`src/pet.js`) lẫn trình duyệt.
 *
 * ## Vì sao nó phải tách ra khỏi `src/pet.js`
 *
 * Từ lúc popover và cửa hàng nhớ sổ trong `localStorage` để vẽ ngay lúc mở (xem
 * `lib/petcache.js`), trình duyệt buộc phải TỰ TÍNH lại độ no và độ tập trung: hai con số
 * ấy tụt theo đồng hồ, nên một bản chép lại từ ba giờ trước là một con số sai chứ không
 * phải một con số cũ. Mà tính lại ở trình duyệt bằng mấy dòng viết tay là dựng **bản thứ
 * hai của cùng một công thức** — đúng loại nhân bản mà cả dự án này gọi tên và tránh (xem
 * `shadeOf`, xem chỗ `itemArt` khai kích thước từ chính lưới sprite).
 *
 * Nên công thức chỉ có MỘT bản, ở đây, và hai bên cùng nhập nó. File này cố ý không
 * `import` gì cả: server nạp nó bằng Node, trình duyệt nạp nó bằng thẻ module, và nó phải
 * chạy được ở cả hai chỗ mà không kéo theo ai.
 *
 * Cái gì được ở đây: hằng số của mô hình, mấy phép suy thuần, và bảng động tác nghỉ.
 * Cái gì KHÔNG: giá hàng hoá (phải ở server, xem `ITEMS`), đọc/ghi đĩa, và mọi thứ chạm
 * vào DOM.
 */

export const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * No căng → đói hẳn. **8 giờ**, neo vào một BUỔI LÀM VIỆC LIỀN của người.
 *
 * Lịch sử con số này đi xuống rồi quay lại, và mỗi bậc có lý do riêng. 20 giờ chọn theo
 * "mỗi ngày chỉ phải cho ăn một lần" — tiện, nhưng 5%/giờ thì hai lần mở popover liên
 * tiếp thanh nhúc nhích 6% và không ai thấy; một cái thanh không bao giờ động là một cái
 * thanh không ai đọc. 10 giờ neo vào một ngày làm việc, đúng hơn nhưng vẫn là nhịp của
 * cái MÁY, không phải nhịp của người ngồi trước nó. 5 giờ neo vào khoảng cách giữa hai
 * bữa, và nó chạy đúng suốt sáu lượt.
 *
 * ## Vì sao 5 → 8, lượt 21
 *
 * Người dùng: *"Thời gian no có thể kéo dài lên 8 tiếng"*. Chỗ 5 giờ hụt là một chuyện đo
 * được chứ không phải khẩu vị: cái thanh này đọc bằng ĐĨA, mỗi đĩa một giờ, và ở 5 giờ thì
 * một buổi làm liền tay từ 9h tới 17h ăn trọn cả khay — mở popover lúc tan việc là lúc nào
 * cũng thấy con vật đang đói lả. Một chỉ số chạm đáy MỖI NGÀY thì nó thôi không còn là chỉ
 * số, nó thành một cái đèn đỏ luôn sáng.
 *
 * 8 giờ là trọn một buổi làm: cho ăn lúc bắt đầu ngồi vào bàn thì con vật vừa hết no lúc
 * đứng dậy. Đó là một CÂU đọc được, khác hẳn "cứ 5 tiếng lại phải nhớ".
 *
 * Nó vẫn không phá cái trần dưới đã dựng ra bậc 5 giờ: 12,5%/giờ, tức hai lần mở popover
 * cách nhau nửa tiếng là thanh đã tụt 6% — vẫn thấy. Bậc 20 giờ hỏng ở 5%/giờ, còn bậc này
 * hơn gấp đôi mức ấy.
 *
 * Tiền có chịu nổi không — đây là ràng buộc thật, không phải chuyện thẩm mỹ, và bậc 5 giờ
 * từng phá nó: bảng giá đặt hồi còn 20 giờ đứng yên trong khi đồng hồ đói nhanh lên gấp
 * bốn, nên tiền ăn một ngày ngốn trọn thu nhập của một ngày nhẹ. Chỗ sửa không nằm ở đây
 * mà ở bảng giá — xem `COIN_PER_HOUR` trong `src/pet.js`, nơi giá đồ ăn SUY RA từ chính
 * con số này: một thanh no đầy giá 8 xu, tức **1 xu vẫn mua đúng 1 giờ no**.
 *
 * Vì cái tỉ giá ấy là một hằng số, bậc 8 giờ KHÔNG đụng tới ví một đồng nào — và đó là
 * điều đáng nói thẳng: tiền ăn của một ngày mười tiếng là 10 xu ở cả bậc 5 lẫn bậc 8, chỉ
 * khác số lần phải bấm. Đổi hằng số ở đây thì bảng giá, số đĩa trên khay và cả phép kiểm
 * ngân sách tự đi theo, không còn hai con số phải nhớ chỉnh cùng lúc.
 */
export const FULL_MS = 8 * 3600 * 1000;

/**
 * Tập trung cạn hẳn sau **90 phút NGỒI LIỀN**.
 *
 * ## Con số này lấy từ đâu
 *
 * Chu kỳ nghỉ-hoạt động cơ bản (BRAC) mà Nathaniel Kleitman mô tả năm 1963: nhịp ~90
 * phút của giấc ngủ không tắt khi ta thức dậy, nó chạy tiếp cả ngày thành một sóng tỉnh
 * táo. Khoảng **60–70 phút đầu** mỗi chu kỳ là pha tỉnh — chú ý bền, điều hành tốt;
 * **~20 phút cuối** là pha trũng, sóng não đổi dạng và cơ thể đòi chuyển nhịp.
 *
 * Vì thế thanh này cạn tuyến tính trong 90 phút, và mốc nhắc rơi vào 0,22 — tức khoảng
 * phút thứ 70, đúng chỗ pha trũng bắt đầu. Yêu cầu gốc là "cạn dần trong 1 tiếng"; một
 * tiếng là đúng đoạn tỉnh táo, còn 90 phút là trọn chu kỳ, nên hai con số không mâu
 * thuẫn — lời nhắc vẫn xuất hiện ngay sau mốc một tiếng.
 *
 * ## Vì sao KHÔNG lấy 20-20-20
 *
 * Luật "20 phút nhìn xa 20 feet trong 20 giây" được AOA và AAO nhắc khắp nơi, nhưng tra
 * kỹ thì nó sinh ra như một câu nói cho dễ nhớ, và các thử nghiệm có đối chứng KHÔNG
 * thấy khác biệt. Dự án này không dán nhãn khoa học lên một con số không có nền — cùng
 * luật đã gỡ thanh XP cũ.
 */
export const FOCUS_MS = 90 * 60 * 1000;

/**
 * Vắng mặt ngần này thì tính là đã NGHỈ, và tập trung đầy lại.
 *
 * 10 phút, và nó là một PHÉP ƯỚC LƯỢNG chứ không phải một phép đo — chỗ mềm nhất của cả
 * mô hình này, nên nói thẳng ra đây.
 *
 * Thứ máy nhìn thấy là khoảng lặng giữa hai lượt Claude Code, không phải bạn có rời ghế
 * hay không. Nghiên cứu về ngồi lâu khuyên xen 2–5 phút vận động nhẹ mỗi 20–30 phút, nên
 * theo lý phải lấy 5 phút; nhưng 5 phút không có lượt nào là chuyện thường xuyên khi bạn
 * đang đọc diff hay tự viết code, và lấy mốc ấy thì thanh này reset suốt và lời nhắc
 * không bao giờ kịp hiện. 10 phút là chỗ mốc bắt đầu tách được "đang đọc" khỏi "đã đứng
 * dậy".
 *
 * Hai ca sai đã biết, và cả hai đều lệch về phía NHẮC HỤT chứ không nhắc oan:
 * - Cắm mặt vào editor một tiếng không gọi Claude → máy tưởng bạn nghỉ.
 * - Để một phiên chạy dài rồi bỏ đi → máy tưởng bạn vẫn ngồi.
 * Nhãn của thanh nói đúng nó đang đo gì, không nói nó biết bạn ở đâu.
 *
 * Quãng nghỉ KHAI TRƯỚC (`MOVES`) thoát được cả hai ca này, và đó là lý do nó tồn tại.
 */
export const BREAK_MS = 10 * 60 * 1000;

/**
 * Ăn một món mất **một phút**, và trong một phút ấy không làm được việc gì khác.
 *
 * ## Vì sao ăn phải TỐN THỜI GIAN
 *
 * Bản trước, mua là xong: ví tụt một cái, thanh no nhảy một bậc, và món ăn nằm cạnh nhân
 * vật 45 phút như một tấm huy chương. Ba chuyện sai với nó, và cả ba là cùng một chuyện:
 * **không có gì ĐANG diễn ra.** Cái thanh nhảy thì mắt không kịp thấy nó nhảy, nên phần
 * thưởng của cú bấm chỉ đọc được bằng cách so trí nhớ. Món ăn nằm 45 phút thì nó thôi
 * không nói "vừa ăn" nữa, nó nói "có một bát phở ở đây". Và vì mua là xong ngay, không có
 * lúc nào để hỏi "đang bận hay rảnh" — mà đó chính là câu hỏi mà `FULL_MS` sinh ra để
 * người ta phải hỏi.
 *
 * Một phút thì cả ba tự sửa: món ăn vơi dần rồi hết, thanh no bò lên trước mắt thay vì
 * nhảy, và trong lúc ấy quán ăn đóng cửa — mỗi lần chỉ một món, đúng như một cái bụng.
 *
 * Một phút chứ không phải mười giây hay năm phút: dưới nửa phút thì cái thanh mười ô nhích
 * quá nhanh để thấy là nó đang nhích (một món 0,5 no lấp 5 ô — 5 ô trong 10 giây là nhảy,
 * không phải bò). Trên hai phút thì nó thành một hàng đợi phải chờ, mà cho ăn không đáng
 * là một việc phải chờ.
 */
export const EAT_MS = 60 * 1000;

/**
 * Nghỉ xong thì tập trung đầy lại trong **20 giây**, không phải trong một nhịp vẽ.
 *
 * Khác `EAT_MS` ở CHỖ BẮT ĐẦU, và chỗ ấy là toàn bộ lý do hai con số này không gộp được:
 * ăn thì phần thưởng chảy vào NGAY TỪ ĐẦU quãng (đang nhai là đang no thêm), còn quãng
 * nghỉ thì tới cuối server mới biết nó có tính hay không (xem `MOVES`). Cho thanh bò lên
 * trong lúc nghỉ rồi tụt về khi kiểm trượt là một cái thanh nói dối trong ba phút liền.
 *
 * Nên đoạn hồi của quãng nghỉ bắt đầu lúc CHỐT. 20 giây đủ để mắt bám theo được cái thanh
 * đi từ chỗ cũ lên đầy, mà vẫn ngắn hơn hẳn quãng nghỉ ngắn nhất — không bao giờ có hai
 * đoạn hồi chồng lên nhau.
 */
export const REST_RAMP_MS = 20 * 1000;

/**
 * Năm động tác nghỉ **miễn phí** — và cái làm chúng khác một nút "tôi đã nghỉ rồi" là
 * chúng được KIỂM.
 *
 * ## Vì sao không phải một nút bấm phát ăn ngay
 *
 * Cả lớp chỉ số này sống được là nhờ mọi con số trong nó đều đo được. Một cái nút "tôi
 * vừa uống nước" thì bấm lúc đang gõ code cũng ăn, và ngay giây đó thanh tập trung thôi
 * không còn là một phép đo — nó thành một cái ô tự khai, đúng loại thanh mà chốt `d-game`
 * đã gỡ khỏi dự án này một lần rồi.
 *
 * Nên nó chạy hai thì: bấm là KHAI (bắt đầu đếm ngược), hết giờ mới TÍNH — và lúc tính,
 * server so `idleMs` với đúng quãng vừa khai. Còn thấy Claude Code có lượt nào trong quãng
 * ấy thì không tính, và nói thẳng là không tính. Cái đổi lại cho hai thì phiền hơn một
 * thì: quãng nghỉ khai trước KHÔNG dính hai ca sai của `BREAK_MS` ở trên, vì ở đây ý định
 * là do bạn nói ra chứ không phải do máy đoán.
 *
 * `why` là khoá i18n của câu nói ra bằng chứng của động tác ấy. Mỗi động tác phải có một
 * câu như thế, và đó là điều kiện để nó được đứng trong bảng: một mẹo sức khoẻ không nói
 * được nó dựa vào đâu thì nó là một mẹo trên mạng, không phải một tính năng.
 *
 * ## Cả năm đều MỘT PHÚT — và đó là thứ phá luật cũ
 *
 * Bản trước chúng dài 3 tới 5 phút, và bằng nhau tất: `wake: 1`, ai cũng về đầy 100%. Lý lẽ
 * khi ấy đứng được, và nó ngắn gọn — thứ đang đo là "bạn đã dừng hay chưa", mà dừng thì nhị
 * phân, nên cho 5 phút hơn 3 phút là bịa ra một hệ số đổi phút lấy tập trung.
 *
 * Hạ cả năm về một phút thì chính lý lẽ ấy sập, và sập một cách thẳng thắn: **một phút
 * KHÔNG phải một quãng dừng.** Nghiên cứu ngồi lâu khuyên 2–5 phút vận động nhẹ mỗi 20–30
 * phút; một phút nằm dưới mọi mốc trong câu ấy. Không ai trong năm động tác này còn khai
 * được là mình vừa thực hiện đúng cái can thiệp mà bằng chứng đã đo. Cái còn phân biệt được
 * chúng vì thế không phải ĐỘ DÀI nữa, mà là **bạn vừa đi tới đâu** — và đó là thứ có bằng
 * chứng đứng sau, không phải một thang điểm.
 *
 * ## `back` — số phút NGỒI LIỀN mà động tác này gỡ ra khỏi đồng hồ
 *
 * Không phải "phần trăm hồi lại", dù cửa hàng hiện nó ra bằng phần trăm. Thanh tập trung đo
 * đúng một thứ: bạn đã ngồi liền bao lâu (xem `satMinAt`). Nên phần thưởng đúng đơn vị của
 * nó là PHÚT vặn ngược cái đồng hồ ấy — `resolveBreak` dời `restedAt` tới trước, không đặt
 * nó về hiện tại. Cộng thêm, có trần, và trần là đầy: một cốc nước lúc đang tỉnh không đẩy
 * bạn vượt quá 100%.
 *
 * Ba bậc, cắt theo chỗ bạn đứng lúc làm — và trong cùng một bậc thì bằng nhau, vì bằng
 * chứng không tách chúng ra:
 *
 * - **Ra khỏi phòng** (`walk`, `sun`) → trọn chu kỳ, **90 phút**. Đây là ca duy nhất bạn
 *   thật sự làm cái mà nghiên cứu ngồi lâu và nghiên cứu ánh sáng mạnh đã đo: rời ghế, đổi
 *   cả khung cảnh lẫn ánh sáng. Đồng hồ ngồi chạy lại từ đầu.
 * - **Rời ghế, vẫn trong phòng** (`stretch`) → **45 phút**, nửa chu kỳ. Nó làm được nửa
 *   đầu của can thiệp ấy — đổi tư thế — và không làm nửa sau — đổi chỗ. Một nửa là một lựa
 *   chọn, và nó được khai ra ở đây chứ không giấu trong một hệ số.
 * - **Vẫn ngồi nguyên** (`water`, `eyes`) → **20 phút**, đúng bằng pha trũng. Cả hai đều có
 *   bằng chứng RIÊNG (thiếu nước làm giảm chú ý; đổi tiêu cự làm dịu mỏi mắt) nhưng không
 *   cái nào cắt được mạch ngồi, mà mạch ngồi mới là cơ chế của mọi bậc trên. Hai mươi phút
 *   là độ dài pha trũng: đủ đưa bạn qua cái trũng, không đủ để mở một chu kỳ mới.
 *
 * `eyes` nằm ở bậc thấp nhất cùng `water` chứ không thấp hơn, dù luật 20-20-20 sinh ra nó
 * là một câu cho dễ nhớ mà thử nghiệm có đối chứng không đỡ nổi (xem `FOCUS_MS`). Hạ nó
 * xuống một bậc thứ tư là bịa thêm một con số để phạt một luật — mà thứ đáng nói về luật ấy
 * thì đã nói bằng chữ, ở đúng chỗ nó được nhắc tới.
 *
 * Hệ quả đáng để ý, và nó làm cửa hàng thành một phép chọn thật: cà phê `wake` 0,40 giờ
 * NẰM GIỮA — hơn cốc nước miễn phí, kém cái vươn vai miễn phí. Bản trước thì mọi món bán
 * đều thua mọi món miễn phí, tức là bảng giá không có việc gì để làm.
 *
 * `sun` thêm vào cùng lượt với mấy cái hình, và nó là động tác duy nhất được thêm vì
 * BẰNG CHỨNG ĐÒI, không phải vì bảng cần dài hơn: câu nhắc đầu giờ chiều đã đẩy người ta
 * ra chỗ có nắng từ lâu (xem `nudgeOf`), mà bảng động tác lại không có ô nào để bấm cho
 * đúng việc ấy — `walk` khi ấy phải gánh hai nghĩa "đi bộ" và "ra nắng" trong một cái tên.
 */
export const MOVES = {
  water: { ms: EAT_MS, back: 20 * 60 * 1000, where: 'home' },
  eyes: { ms: EAT_MS, back: 20 * 60 * 1000, where: 'home' },
  stretch: { ms: EAT_MS, back: 45 * 60 * 1000, where: 'home' },
  walk: { ms: EAT_MS, back: FOCUS_MS, where: 'park' },
  sun: { ms: EAT_MS, back: FOCUS_MS, where: 'park' },
};

/**
 * `back` đọc ra thành PHẦN TRĂM thanh tập trung — đơn vị mà ô hàng phải nói, vì ô cà phê
 * ngay cạnh đang nói bằng đơn vị ấy.
 *
 * Một hàm chứ không phải một trường thứ hai trong bảng trên: hai con số cho cùng một sự
 * thật là hai con số sẽ trôi khỏi nhau đúng lần đầu ai đó chỉnh một cái. Nó cũng là chỗ duy
 * nhất buộc phần trăm ấy vào trần 1 — `walk` gỡ trọn 90 phút khỏi một đồng hồ 90 phút, và
 * 90/90 phải ra đúng "về đầy", không ra "101% nếu làm tròn lệch".
 */
export const wakeOf = (move) =>
  // Nhánh `wake` là sổ ĐỜI CŨ, không phải một cách khai thứ hai: bản nhớ trong
  // `localStorage` có thể là ảnh chụp của server trước lượt này, và một ô hàng vẽ ra "+0%"
  // trong nửa giây đầu là một con số sai, không phải một con số đang chờ.
  clamp01(Number(move?.back) / FOCUS_MS || Number(move?.wake) || 0);

export const MOVE_IDS = Object.keys(MOVES);

/**
 * Chỗ làm việc này — và nó là một sự thật về ĐỘNG TÁC, không phải một cách sắp xếp menu.
 *
 * Uống nước, vươn vai, rời mắt khỏi màn hình: cả ba làm được ngay tại bàn. Đi bộ và ra
 * nắng thì phải bước ra khỏi cửa. Trước đây cả năm cùng nằm trong công viên, và chỗ ấy nói
 * sai đúng ba lần: nó bảo muốn uống một cốc nước thì phải đi ra công viên.
 *
 * Một trường chứ không phải hai bảng, vì cùng một mã còn quyết định hai chuyện nữa ngoài
 * việc ô hàng hiện ở khối nào: quản gia đứng ở đâu trên bản đồ trong lúc làm, và khung
 * cảnh popover có mọc cây ra hay không. Ba bề mặt đọc chung một trường thì chúng không
 * lệch nhau được.
 */
export const MOVE_HOME = MOVE_IDS.filter((k) => MOVES[k].where === 'home');
export const MOVE_PARK = MOVE_IDS.filter((k) => MOVES[k].where === 'park');

/**
 * Việc đang làm diễn ra ở đâu. Ăn thì luôn ở nhà — cái bàn ăn ở trong nhà, và một bát phở
 * mang ra công viên là một cảnh khác hẳn cảnh mà `EAT_MS` đang kể.
 *
 * `Object.hasOwn` chứ không `MOVES[id]` trơn: sổ chép tay có thể mang một mã lạ, và
 * `MOVES['constructor']` là một hàm — `.where` của nó là `undefined`, rơi đúng vào nhánh
 * mặc định, nhưng đường đi tới đó thì không ai đọc ra.
 */
export const whereOf = (doing) =>
  doing?.kind === 'move' && Object.hasOwn(MOVES, doing.id) ? MOVES[doing.id].where : 'home';

/**
 * Động tác hợp giờ nhất — để công viên gắn một cái nhãn "hợp lúc này".
 *
 * Chỉ có MỘT ca đặc biệt, và nó có nền: 13–16h là cú trũng đầu chiều, thứ có bằng chứng
 * chống lại nó là chợp mắt ngắn và ÁNH SÁNG MẠNH. Ngoài khung ấy thì trả về động tác rẻ
 * nhất về ý chí — đứng dậy đi lại — chứ không xoay vòng năm món cho có vẻ phong phú: một
 * gợi ý đổi mỗi lượt vẽ là một gợi ý không ai tin.
 *
 * Ca đầu chiều giờ trỏ vào `sun` chứ không `walk`, và đó là chỗ cái tên mới trả nợ: bằng
 * chứng nói về ÁNH SÁNG, không nói về việc đi bộ. Trước đây hai thứ ấy phải chung một ô.
 */
export function moveForHour(hour) {
  return hour >= 13 && hour < 16 ? 'sun' : 'stretch';
}

/**
 * Một chỉ số cạn tuyến tính từ một mốc đồng hồ. Cả độ no lẫn độ tập trung đều là hàm này
 * — chúng khác nhau ở mốc và ở khoảng, không khác nhau ở phép tính.
 *
 * `fallback` là giá trị khi mốc không đọc được (sổ đời cũ thiếu trường, hoặc chuỗi hỏng).
 * Nó KHÁC nhau giữa hai chỉ số nên phải là tham số chứ không phải một mặc định chung: độ
 * no thiếu mốc thì 0 (chưa từng cho ăn — đúng là đói), còn tập trung thiếu mốc thì 1
 * (chưa đo được thì im, đừng nhắc dựa trên một con số không có thật).
 */
export function decayFrom(stamp, spanMs, nowMs, fallback) {
  const at = Date.parse(stamp ?? '');
  if (Number.isNaN(at)) return fallback;
  return clamp01(1 - (nowMs - at) / spanMs);
}

/**
 * Phần đã đi được của một đoạn HỒI, 0..1. Không có đoạn nào thì trả 1 — tức "xong rồi",
 * đúng thứ làm mọi phép trộn bên dưới rơi thẳng về giá trị đích mà không cần một nhánh.
 */
export function rampAt(ramp, nowMs) {
  const at = Date.parse(ramp?.at ?? '');
  const ms = Number(ramp?.ms) || 0;
  if (Number.isNaN(at) || ms <= 0) return 1;
  return clamp01((nowMs - at) / ms);
}

/**
 * Một chỉ số ĐANG HỒI — trộn đường tụt cũ với đường tụt mới theo phần đã đi được.
 *
 * Đây là toàn bộ chỗ "thanh năng lượng hồi dần" sống, và nó cố ý KHÔNG phải một hiệu ứng
 * CSS. Một cái thanh chạy hoạt hình từ 20% lên 70% trong khi sổ đã ghi 70% ngay từ giây
 * đầu là một cái thanh nói dối trong 59 giây — mà popover thì có thể mở giữa quãng ấy và
 * đọc ra con số thật, thành hai màn hình nói hai điều khác nhau về cùng một con vật.
 *
 * Trộn ở đây thì con số THẬT chính là con số đang bò lên: giữa quãng ăn, độ no đúng bằng
 * chỗ nó đã bò tới. Cả hai đường đều tuyến tính theo thời gian nên đoạn trộn cũng tuyến
 * tính — nó chỉ là một đoạn dốc hơn nối hai đường song song, không phải một luật thứ hai.
 *
 * `from` là mốc TRƯỚC khi phần thưởng được ghi vào. Không có nó (không đang hồi, hoặc
 * đoạn hồi này không đụng tới chỉ số này) thì hàm rơi về đúng phép cũ.
 */
function ramped(stamp, from, spanMs, nowMs, fallback, ramp) {
  const to = decayFrom(stamp, spanMs, nowMs, fallback);
  if (!from) return to;
  const p = rampAt(ramp, nowMs);
  if (p >= 1) return to;
  return decayFrom(from, spanMs, nowMs, fallback) * (1 - p) + to * p;
}

/** Độ no, 0..1. Hiệu hai mốc đồng hồ chia cho `FULL_MS`, cộng đoạn hồi nếu đang ăn dở. */
export const fullnessAt = (fedAt, nowMs, spanMs = FULL_MS, ramp = null) =>
  ramped(fedAt, ramp?.fedFrom, spanMs, nowMs, 0, ramp);

/** Độ tập trung, 0..1 — cùng khuôn với độ no. Không có luật chơi nào ở đây cả. */
export const focusAt = (restedAt, nowMs, spanMs = FOCUS_MS, ramp = null) =>
  ramped(restedAt, ramp?.restedFrom, spanMs, nowMs, 1, ramp);

/**
 * Bản sổ server vừa gửi → bản ĐÚNG LÚC NÀY. Gọi ở MỖI lượt vẽ, không phải mỗi lượt hỏi.
 *
 * ## Chỗ hỏng mà nó sinh ra để sửa
 *
 * `ramped` ngay trên tính đúng cái đoạn thanh no bò lên trong một phút ăn — nhưng nó chỉ
 * chạy ở hai chỗ: server lúc trả lời một lượt hỏi, và `loadPet` lúc mở lại trang. Giữa hai
 * lượt hỏi thì `pet.full` là một CON SỐ CHẾT nằm trong bộ nhớ, và cửa hàng vẽ lại nó mỗi
 * giây y hệt nhau.
 *
 * Nên cái thanh không bò. Đo ra thì nó đi ba bước: đứng im từ giây 0, nhảy một bậc ở giây
 * ~30 khi `STALE_MS` tới hạn, nhảy bậc nữa ở giây ~61 khi nhịp `beat` hỏi lại sau lúc ăn
 * xong. Ba bước cho một đoạn đáng lẽ là một đường thẳng, và cái nhịp nhấp nháy `rising`
 * lại đang nói rằng có gì đó đang diễn ra — tức màn hình hứa một thứ mà con số không giữ.
 *
 * Sửa ở đây chứ không ở chỗ vẽ, và cũng không bằng cách hỏi server dày hơn. Công thức đã
 * có sẵn một bản duy nhất; thứ thiếu chỉ là GỌI nó bằng đồng hồ của chính lượt vẽ. Hỏi dày
 * hơn thì tốn mạng, vẫn giật theo độ trễ, và vẫn sai ngay khi máy ngủ dậy.
 *
 * Thuần và không nhớ gì: gọi hai lần liên tiếp trên cùng một bản cho cùng một kết quả, vì
 * mọi thứ nó tính đều suy từ ba mốc `fedAt` / `restedAt` / `ramp` — những thứ nó không
 * đụng vào.
 *
 * ## `doing` cũng phải TỤT THEO ĐỒNG HỒ — chỗ sửa của lượt 18
 *
 * Người dùng báo: *"khi ăn xong hay làm gì xong không tự back về trạng thái làm việc mà giữ
 * nguyên trạng thái đó"*. Đúng, và chỗ hỏng là ngay ở đây: hàm này vặn lại độ no, nhịp tập
 * trung và số phút đã ngồi, rồi **để nguyên `doing`**. Nên một bản sổ nhận về lúc đang ăn dở
 * là một quản gia cầm cái bát ấy tới hết phiên — tư thế `hold`, tay giơ, việc không bao giờ
 * xong. Cùng một lỗi ở cả hai bề mặt, vì cả hai đều đi qua hàm này.
 *
 * Cái làm nó thành lỗi khó thấy: `lib/petcache.js` ĐÃ tự vặn `doing` bằng đúng phép dưới
 * đây, nên bản nhớ lúc mở lại thì đúng — chỉ bản vừa lấy từ mạng là sai. Tức lỗi chỉ hiện ra
 * sau khi lượt hỏi thật về, đè lên một bản đang đúng. Phép ấy giờ dọn về đây, một chỗ.
 *
 * ## Vì sao phải có `pet.at`, và vì sao bản trả về mang `at` MỚI
 *
 * `petView` gửi `leftMs` — một HIỆU SỐ, không phải mốc kết thúc, và có lý do (xem chú thích
 * của nó: một cái đếm ngược có vách thì lệch đồng hồ giữa hai máy là một cú bấm bị từ chối
 * không giải thích được). Hiệu số thì phải trừ vào một cái gì, nên chỗ nhận phải đóng dấu
 * mốc của CHÍNH máy mình lúc nhận — `stampPet`. Trừ hai thứ cùng một đồng hồ thì lệch giờ
 * giữa hai máy không lọt vào được; đây đúng là lý lẽ mà `petcache.js` đã ghi từ đầu.
 *
 * Bản trả về mang `at: nowMs`, và dòng ấy là điều kiện để hàm này còn gọi được nhiều lần.
 * Màn Cửa hàng chạy `pet = livePet(pet)` mỗi giây; giữ nguyên `at` cũ thì lượt sau trừ lại
 * đúng quãng vừa trừ, và cái đếm ngược chạy nhanh gấp đôi rồi gấp ba.
 */
export function livePet(pet, nowMs = Date.now()) {
  if (!pet) return pet;
  const full = fullnessAt(pet.fedAt, nowMs, pet.fullMs, pet.ramp);
  const focus = focusAt(pet.restedAt, nowMs, pet.focusMs, pet.ramp);
  // Không có dấu mốc thì để nguyên `leftMs` — sổ của một bản cũ hơn phải rơi về đúng hành vi
  // cũ, không rơi vào một nhánh mới. Bản mới thì mọi chỗ nhận đều đóng dấu, xem `stampPet`.
  const left = pet.doing && typeof pet.at === 'number' ? pet.doing.leftMs - (nowMs - pet.at) : pet.doing?.leftMs;
  return {
    ...pet,
    at: nowMs,
    full,
    mood: moodOf(full),
    focus,
    focusMood: focusMoodOf(focus),
    satMin: satMinAt(pet.restedAt, nowMs),
    // Hết giờ thì bỏ, kể cả với quãng nghỉ — phía trình duyệt KHÔNG được kết luận nó đạt hay
    // trượt (phép kiểm cần `awayMs`, thứ chỉ server có). Nó chỉ dọn cái đang chạy khỏi bức
    // tranh và để lượt hỏi thật nói tiếp.
    doing: pet.doing && left > 0 ? { ...pet.doing, leftMs: left } : null,
  };
}

/**
 * Đóng dấu mốc NHẬN, bằng đồng hồ của chính máy này.
 *
 * Gọi ở mọi chỗ một bản sổ vừa từ server về — hai chỗ: `menubar.js` và `views/pet.js`. Một
 * hàm một dòng chứ không phải hai lần gõ `{ ...fresh, at: Date.now() }`, vì cái quên được ở
 * đây không kêu: bản không đóng dấu vẫn vẽ ra đúng mọi thứ, chỉ có việc đang làm là không
 * bao giờ xong — tức đúng cái lỗi mà lượt này đang sửa, mọc lại ở một bề mặt.
 */
export const stampPet = (pet, nowMs = Date.now()) => (pet ? { ...pet, at: nowMs } : pet);

/**
 * Việc quản gia ĐANG LÀM — ăn một món, hoặc một động tác nghỉ. Nhiều nhất một.
 *
 * ## Vì sao một hàm chứ không phải hai trường rời
 *
 * Ba bề mặt cần đúng câu trả lời này và cần nó giống hệt nhau: cửa hàng khoá mấy cái nút
 * lại, popover bày món đang vơi trên tay, và bức tranh trong nhà đổi tư thế nhân vật theo
 * việc. Trước đây "đang nghỉ" đọc từ `breakAt` còn "vừa ăn" đọc từ `lastMealAt`, và ba bề
 * mặt kia mỗi chỗ tự ghép hai điều kiện ấy một kiểu — ba bản của một luật.
 *
 * Thứ tự ưu tiên không bao giờ dùng tới trong thực tế (server chặn không cho hai việc
 * chồng nhau, xem `buy` và `startBreak`), nhưng nó phải có: một sổ chép tay có thể mang cả
 * hai, và lúc ấy quãng nghỉ thắng — nó là việc DÀI hơn và là việc có kiểm.
 *
 * Trả `leftMs` chứ không trả mốc kết thúc, cùng lý do đã ghi ở `petView`.
 */
export function doingOf(led, nowMs, eatMs = EAT_MS) {
  const bAt = Date.parse(led?.breakAt ?? '');
  const bMs = Number(led?.breakMs) || 0;
  // `> nowMs` chứ không `Math.max(0, …)` — chỗ sửa của lượt 18, và nó là chỗ hai nhánh của
  // hàm này từng nói hai câu khác nhau. Nhánh ĂN tự tắt sau `eatMs`; nhánh NGHỈ thì trả về
  // một việc "đang làm" với `leftMs: 0` cho tới khi server chốt quãng và xoá nó khỏi sổ. Tức
  // một quãng nghỉ đã hết giờ mà chưa ai hỏi tới — máy ngủ, popover không mở — là một quản
  // gia đứng vươn vai vô thời hạn. `resolveBreak` vẫn đọc thẳng sổ nên nó không mất gì: cái
  // ở lại trong sổ là cái CHƯA CHỐT, còn cái hàm này trả về là cái ĐANG DIỄN RA. Hai câu hỏi
  // khác nhau, và tới lượt này chúng mới có hai câu trả lời khác nhau.
  if (led?.breakKind && !Number.isNaN(bAt) && bMs > 0 && bAt + bMs > nowMs) {
    return { kind: 'move', id: led.breakKind, ms: bMs, leftMs: bAt + bMs - nowMs };
  }
  const mAt = Date.parse(led?.lastMealAt ?? '');
  if (led?.lastMeal && !Number.isNaN(mAt) && nowMs - mAt < eatMs) {
    return { kind: 'food', id: led.lastMeal, ms: eatMs, leftMs: Math.max(0, mAt + eatMs - nowMs) };
  }
  return null;
}

/**
 * Số PHÚT đã ngồi liền, tính từ mốc nghỉ gần nhất.
 *
 * Ở đây chứ không viết thẳng trong `petView`, vì bản nhớ trong `localStorage` phải dựng
 * lại đúng con số này lúc mở lại — mà câu nhắc đọc thẳng nó ("Đã 78 phút ngồi liền"), nên
 * hai bản làm tròn lệch nhau một phút là hai câu chữ khác nhau cho cùng một trạng thái.
 *
 * `|| 0` bắt cả `NaN` (sổ đời cũ không có mốc) lẫn `-0`.
 */
export function satMinAt(restedAt, nowMs) {
  return Math.max(0, Math.round((nowMs - Date.parse(restedAt ?? '')) / 60000)) || 0;
}

/**
 * Bốn buổi trong ngày, lấy theo GIỜ MÁY.
 *
 * Ranh giới cố ý thô — không buổi nào mang tin gì, chúng chỉ để màn hình giống chỗ người
 * dùng đang ngồi. Popover mở rồi đóng trong vài giây nên nó đọc đồng hồ đúng một lần mỗi
 * lần mở; bản đồ thị trấn thì vẽ lại theo nhịp của nó, và cả hai đọc CHUNG hàm này.
 *
 * Sống ở đây chứ không ở `menubar-view.js` như trước lượt này: một hàm năm dòng về cái đồng
 * hồ mà bắt màn Cửa hàng phải nhập trọn khung cảnh popover để lấy thì cái giá không nằm ở
 * chỗ nó nhìn xấu, nó nằm ở chỗ hai màn hình dính vào nhau qua một thứ không liên quan.
 */
export function phaseOf(hour) {
  if (hour >= 5 && hour < 9) return 'dawn';
  if (hour >= 9 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'dusk';
  return 'night';
}

/**
 * Tâm trạng — suy từ độ no, và nó phải nói được bằng HÌNH chứ không chỉ bằng màu.
 *
 * Cùng lý do đã ghi cho cặp mắt mở/nhắm trong `lib/menubar-view.js`: theme daltonized
 * không được dựa vào mỗi một khác biệt màu.
 */
export function moodOf(full) {
  if (full <= 0.12) return 'starving';
  if (full <= 0.35) return 'hungry';
  if (full >= 0.85) return 'stuffed';
  return 'fine';
}

/**
 * Mốc vào PHA TRŨNG, đọc trên thanh tập trung — 20 phút cuối của một chu kỳ 90 phút.
 *
 * Xuất ra chứ không nằm trơn trong `focusMoodOf`, vì từ lúc thanh tập trung tự chia ô theo
 * cấu trúc của chu kỳ (xem `focusBar`) thì cái vạch ngăn trên thanh và cái ngưỡng bật lời
 * nhắc phải là MỘT con số. Hai bản của nó là một cái thanh có vạch ở chỗ này còn lời nhắc
 * nổ ở chỗ kia — và người đọc sẽ tin cái vạch.
 */
export const FOCUS_DIP = 20 / 90;

/**
 * Ba bậc tập trung, cắt theo đúng hình dạng của BRAC chứ không chia đều.
 *
 * `sharp` là pha tỉnh (60–70 phút đầu), `dip` là pha trũng ~20 phút cuối — chỗ lời nhắc
 * xuất hiện — và `spent` là đã quá một chu kỳ trọn vẹn. Không có bậc thứ tư: ba bậc là
 * số bậc ít nhất còn phân biệt được "đang ổn", "sắp đến lúc" và "quá rồi".
 */
export function focusMoodOf(focus) {
  if (focus <= 0) return 'spent';
  if (focus <= FOCUS_DIP) return 'dip';
  return 'sharp';
}

/**
 * TRẠNG THÁI của quản gia — một cái tên, và một THỨ HẠNG viết ra.
 *
 * ## Vì sao phải có hàm này
 *
 * Ba nguồn nuôi nhân vật này — `mood` (đói), `focusMood` (tập trung), `doing` (việc đang
 * làm) — sinh ra rời nhau và **không nguồn nào biết hai nguồn kia**. Cho tới lượt này, thứ
 * hạng giữa chúng chỉ tồn tại ngầm trong thứ tự mấy dòng `if` của `moodOfScene` bên
 * `menubar-view.js`, mà bản đồ thị trấn thì lại đọc ba nguồn ấy theo một cách khác. Hai bề
 * mặt, hai luật, không ai viết ra luật nào — đúng cái hình dạng của lỗi "hai bản của một
 * nhân vật" mà lượt trước vừa gỡ ở phần SPRITE.
 *
 * ## Thứ hạng, và lý do của từng bậc
 *
 * 1. **`busy`** — có việc đang chạy thì thắng tất. Đó là thứ NGƯỜI DÙNG vừa bấm, nó kết
 *    thúc trong một phút, và trong một phút ấy màn hình phải kể lại đúng việc vừa nhận. Một
 *    quản gia đang uống nước mà vẽ dáng đói lả là màn hình cãi lại chính cú bấm vừa xong.
 * 2. **`starving`** — đói lả đứng TRÊN kiệt tập trung, và đây là bậc đáng cãi nhất. Lý do là
 *    TẦN SUẤT: `focus` quay hết một vòng sau 90 phút nên `spent` nổ vài lần mỗi ngày, còn
 *    `full` là chu kỳ 5 giờ nên `starving` hoạ hoằn mới tới. Xếp cái hay nổ lên trên là chôn
 *    luôn cái hiếm — mà cái hiếm mới là cái đáng nhìn. Nó cũng là bậc duy nhất mà chính CON
 *    VẬT đang hỏng, không phải người ngồi trước máy.
 * 3. **`spent`** — quá một chu kỳ trọn vẹn. Vẫn giữ dáng ngủ gật như trước lượt này; cái đổi
 *    là nó thôi phải gánh luôn phần của `starving`.
 * 4. **`hungry`** · 5. **`dip`** — hai bậc CẢNH BÁO, cùng một luật thứ tự với hai bậc nặng
 *    ngay trên: đói trước, hết nhịp sau.
 * 6. **`well`** — không có gì để nói. Gộp `fine` với `stuffed` làm một: no quá không phải
 *    một trạng thái đáng vẽ riêng, nó chỉ là "vừa ăn xong", mà việc ấy đã có `busy` kể.
 *
 * Trả về một CÁI TÊN chứ không trả tư thế: chỗ này không được biết sprite nào tồn tại (nó
 * chạy cả trên server qua `src/pet.js`), và bảng tên→tư thế thì nằm cạnh chính mấy hàng
 * pixel ở `lib/pet.js`. Tách vậy để thứ hạng kiểm được bằng test mà không phải dựng DOM.
 */
export const PET_STATES = ['busy', 'starving', 'spent', 'hungry', 'dip', 'well'];

export function stateOf(pet) {
  if (!pet || pet.on === false) return 'well';
  if (pet.doing) return 'busy';
  if (pet.mood === 'starving') return 'starving';
  if (pet.focusMood === 'spent') return 'spent';
  if (pet.mood === 'hungry') return 'hungry';
  if (pet.focusMood === 'dip') return 'dip';
  return 'well';
}
