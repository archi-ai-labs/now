/**
 * Thị trấn — chỗ tiêu xu, và chỗ DUY NHẤT nói ra xu từ đâu mà có.
 *
 * ## Vì sao cái cửa hàng ở dashboard mà con thú ở popover
 *
 * Popover rộng 360pt và nó tồn tại để LIẾC. Nhét cả một lưới hàng chục món vào đấy là
 * đổi cái nó giỏi lấy một cái nó không cần giỏi. Còn nhân vật thì ngược lại: nó phải ở
 * chỗ mở ra chín lần một ngày, không phải ở màn thứ mười của một trang web.
 *
 * Nên chia đúng theo nhịp dùng: **cho ăn và mua sắm là việc thỉnh thoảng** (dashboard),
 * **nhìn con thú là việc thường xuyên** (popover).
 *
 * ## Vì sao một bản đồ chứ không phải một trang cuộn
 *
 * Bản trước là bốn khối xếp chồng — nghỉ ngắn, ăn uống, trang trí, cách tính — và ở cỡ
 * hiện tại (hàng chục món, bảy chỗ đứng, bảy khối chữ) nó dài ba màn hình. Cuộn thì không có lối
 * tắt: muốn đổi cái nón cũng phải đi hết đồ ăn.
 *
 * Bản đồ đổi cái danh sách ấy lấy một chỗ có VỊ TRÍ — xem khối đầu của `lib/town.js`. Mỗi
 * lần chỉ một việc hiện ra, và bốn việc kia thì không bao giờ cần đọc cùng lúc với nhau.
 *
 * ## Luật của màn này
 *
 * Không một con số THẬT nào được dán nhãn trò chơi. Ví xu là ví xu; muốn biết đã tiêu bao
 * nhiêu tiền thật thì màn Token ngay trên nav. Chỗ duy nhất hai thế giới chạm nhau là câu
 * giải thích tỉ giá ở đầu màn, và nó nói thẳng: 1 xu = $1 ước tính, kể từ ngày mở sổ.
 * Giấu chỗ ấy đi là biến một trò chơi lương thiện thành một thanh XP bịa.
 */

import { html } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { CHEER_MS, artFit, itemArt, lifeClock, moveArt, doingArt, dressArt, nudgeOf, satChip, stateTable, statCells, coinNum } from '../lib/pet.js';
import { LOTS, PLACES, PLACE_IDS, ROADS, SCENE_SPOTS, STROLL, TOWN_BOX, WALKERS, butlerArt, lotArt, placeArt, sceneArt, sizeOf, strollLag, strolling, walkerArt } from '../lib/town.js';
import { BREAK_MS, livePet, moveForHour, phaseOf, rampAt, stampPet, wakeOf } from '../lib/petmath.js';
import { loadPet as cachedPet, savePet } from '../lib/petcache.js';
// Lớp tiếng CHỈ được nhập ở đây, và đó là một hàng rào bằng kiến trúc chứ không phải một
// chỗ đặt cho gọn: `menubar.js` không có đường nào tới file này, nên popover thanh menu
// không thể kêu kể cả khi ai đó quên mất luật. Xem đầu `lib/sound.js`.
import { cue, setSound, soundOn } from '../lib/sound.js';
import { empty } from './shared.js';

/**
 * Sổ quản gia KHÔNG nằm trong `app.state`.
 *
 * `app.state` là kết quả một lượt quét — mọi thứ trong đó đều là thứ máy này QUAN SÁT
 * được. Ví xu thì không: nó là thứ dashboard tự ghi, và nó đổi lúc người ta bấm mua chứ
 * không đổi theo lượt quét 30 giây. Trộn hai loại vào một chỗ là bắt mọi người đọc state
 * — SSE, popover, test — mang theo một trường không dùng tới, và tệ hơn là bắt cú bấm mua
 * phải chờ hết một lượt quét mới thấy kết quả.
 */
let pet = cachedPet();
let err = null;
let busy = null;
let redraw = () => {};
let wired = false;
let askedAt = 0;
/**
 * Chỗ đang đứng trong thị trấn. Nhà là mặc định — nó ở tâm bản đồ và nó là chỗ duy nhất
 * không bán gì, nên mở màn ở đấy là mở màn ở một chỗ không đòi hỏi gì.
 *
 * Biến ở tầng module chứ không nhớ vào `localStorage`: đây là chỗ đứng của MỘT lượt xem,
 * không phải một tuỳ chọn. Nó sống qua nhịp vẽ lại 30 giây (đó mới là thứ cần) và về lại
 * Nhà sau một lượt tải trang — một hành vi đoán được, không cần học.
 */
let place = 'home';
/**
 * Món trang trí đang ĐƯỢC THỬ ở tiệm — chưa mua, chưa gửi gì lên server.
 *
 * Sống ở tầng module cùng `place` và cùng lý do: nó là trạng thái của một lượt xem, không
 * phải một tuỳ chọn. Rời tiệm là quên — bấm thử một cái vương miện rồi sang quán ăn, quay
 * lại thấy nó vẫn đội trên đầu là một bức tranh nói dối về thứ mình đang có.
 */
let tryOn = null;
/**
 * KHE đang mở ở tiệm trang trí — một cái ngăn kéo, không phải một bộ lọc.
 *
 * ## Vì sao lượt này phải có nó
 *
 * Người dùng hỏi thẳng: "nếu sau này tôi có 100 đồ thì kéo mệt nghỉ à". Đo bản trước thì câu
 * ấy đúng và nó đã đúng ở cỡ hiện tại: tiệm bày SÁU lưới chồng nhau, mỗi lưới một tiêu đề, và
 * tất cả cùng mở. Hai mươi hai món ở cỡ ô 112px là chừng bốn màn hình cuộn — mà cái người ta
 * muốn xem thì luôn chỉ là MỘT khe, vì một món chỉ tranh chỗ với mấy món cùng khe. Năm khe
 * còn lại là năm khối chữ nằm giữa câu hỏi và câu trả lời, đúng cái lỗi mà dải thông số đã bị
 * chỉ ra ở lượt trước.
 *
 * Một trăm món thì con số ấy thành mười bảy màn hình. Cái ngăn kéo cắt nó về gần một, và nó
 * cắt theo đúng đường mà chính bảng hàng hoá đã kẻ sẵn.
 *
 * ## Vì sao một cái NGĂN KÉO chứ không phải một ô tìm kiếm hay một bộ lọc
 *
 * Ô tìm kiếm đòi người ta biết mình đang tìm cái gì — mà ở đây họ đang *ngắm*. Bộ lọc kiểu
 * "chỉ hiện món mua nổi" thì giấu mất chính cái đích dài hạn mà cả bảng giá dựng lên. Sáu cái
 * thẻ thì không giấu gì cả: mỗi thẻ nói tên khe, nói món đang bày ở đó, và nói còn bao nhiêu
 * món chưa có. Cả sáu câu ấy đọc được mà không phải mở cái nào.
 *
 * Mặc định là khe ĐẦU, không phải "tất cả": một chỗ mở ra rồi bày sạch mọi thứ thì cái ngăn
 * kéo không làm gì cả ở đúng lượt đầu tiên người ta nhìn nó.
 *
 * Sống ở tầng module cùng `tryOn`, và cùng lý do. Rời tiệm là quên.
 */
let shelf = null;
/**
 * Món ăn đang được CHỌN ở quán — đã bấm một lần, chưa mua, chưa gửi gì lên server.
 *
 * Đây là chỗ sửa của lượt này, và nó là một chỗ sửa về TIỀN chứ không về bố cục: bản trước
 * ô hàng đồ ăn mang thẳng `data-buy`, nên một cú bấm lạc — cuộn bằng chuột cảm ứng, bấm
 * nhầm ô cạnh, bấm hai lần vì tưởng lần đầu trượt — là một lần trừ tiền không lấy lại
 * được. Bát phở 4,5 xu thì mất mát nhỏ, nhưng cái mất thật là NIỀM TIN vào cái lưới: một
 * cái lưới mà cú bấm nào cũng có thể tiêu tiền là một cái lưới không dám rê chuột lên.
 *
 * Tiệm trang trí đã chạy đúng hai thì từ lâu (xem `decorTile`), và lý lẽ ở đó dừng ở "món
 * trang trí đắt và không tiêu đi được". Lý lẽ ấy hụt một vế: cái quyết định phải có hai
 * thì không phải GIÁ, mà là có hoàn lại được hay không. Một bữa ăn cũng không hoàn lại —
 * xu đã trừ, `fedAt` đã dời, và con vật thì đang bận nguyên một phút.
 *
 * Sống ở tầng module cùng `tryOn` và cùng lý do. Rời quán là quên.
 */
let pick = null;
/**
 * Khối "mấy con số này tính từ đâu?" đang MỞ hay đang gập.
 *
 * Phải sống ở tầng module cùng `place`, và đây là một chỗ đã hỏng khi thử: `mount()` gán
 * lại trọn `innerHTML` mỗi lượt vẽ, mà thẻ `details` thì mặc định đóng — nên cái khối vừa
 * mở ra tự gập lại sau nhịp 30 giây tiếp theo, ngay giữa lúc người ta đang đọc. Trình duyệt
 * không giữ hộ trạng thái ấy qua một lượt dựng lại DOM.
 */
let whyOpen = false;
/**
 * Phần xu vừa vào ví kể từ lượt hỏi trước — số để NẢY, không phải số để bày.
 *
 * Ở đây nó có nhịp thật, khác popover: màn này tự hỏi lại sổ mỗi 30 giây (xem `STALE_MS`),
 * nên cái ví nhích lên ngay trước mắt trong lúc ngồi làm việc. Đó là toàn bộ lý do ví bày
 * ra hai chữ số lẻ — xem chú thích của `petView` bên server.
 */
let bump = 0;
/**
 * VỪA bấm sang một chỗ khác trong thị trấn — một cờ dùng đúng một lượt vẽ.
 *
 * Nó tồn tại vì lỗi người dùng chỉ ra ở lượt này: "bấm vào các nhà thì gần như mù, không
 * biết được phía dưới có thêm điều gì đó". Đo trên máy này thì đúng như thế theo nghĩa đen
 * — khung cuộn cao 708px, mà cái khối trả lời cho cú bấm bắt đầu ở 705px, tức đúng BA
 * pixel của nó nằm trong tầm mắt. Cả cú bấm và cả câu trả lời đều đúng; chỉ là chúng cách
 * nhau một màn hình.
 *
 * Cờ này chở phần "vẽ" của phép sửa: cái khối bên dưới ăn một hoạt hình hiện ra, nên ngay
 * cả khi nó đã nằm sẵn trong tầm mắt thì cú bấm vẫn có một hậu quả NHÌN THẤY ĐƯỢC. Phần
 * "cuộn" nằm ở `showPanel`.
 *
 * Phải là cờ một lượt, cùng lý do đã ghi cho `bump`: hoạt hình chạy trên một thẻ vừa dựng
 * nên nó tự diễn đúng một lần, mà `mount()` dựng lại cả cây DOM mỗi 30 giây — không tiêu
 * cái cờ đi thì cứ nửa phút cái khối lại nhấp nháy một lần cho một cú bấm từ lâu.
 */
let arriving = false;
/**
 * Mốc của cú MUA vừa xong — quản gia nhảy lên mừng trong `CHEER_MS` rồi thôi.
 *
 * Là một MỐC chứ không phải một cờ, và khác `arriving`/`bump` ở đúng chỗ đó. Hai cái kia
 * tiêu ngay sau một lượt vẽ vì thứ chúng bật là một hoạt hình CSS chạy một lần trên một thẻ
 * vừa dựng. Dáng mừng thì không: nó là một tư thế, tức là cái thẻ phải còn mang đúng tư thế
 * ấy suốt hai giây — mà giữa hai giây đó có thể có mấy lượt vẽ lại (nhịp một giây khi đang
 * ăn, hoặc một cú bấm sang chỗ khác). Một cờ dùng-một-lượt sẽ tắt ngay lượt thứ hai.
 *
 * Cái hẹn giờ đi kèm là để đánh thức lượt vẽ CUỐI, lượt trả anh ta về dáng thường. Không có
 * nó thì lúc mua đồ trang trí (không sinh ra `doing`, nên `beat` không chạy) quản gia đứng
 * nhảy cho tới lượt hỏi sổ 30 giây sau.
 */
let cheerAt = 0;
let cheerTimer = null;
/** Cái hẹn giờ 1 giây, chỉ sống khi có VIỆC đang chạy — ăn hoặc nghỉ. Xem `beat`. */
let tick = null;

/**
 * Sổ cũ hơn ngần này thì hỏi lại. Đúng nhịp quét của dashboard.
 *
 * Có mốc này vì nguồn tiền chảy theo LƯỢT QUÉT, không theo cú bấm: ngồi làm việc cả buổi
 * với tab mở sẵn thì tiền vào ví liên tục, mà bản đầu chỉ hỏi sổ đúng một lần lúc nạp
 * trang. Kết quả là ví đứng hình suốt buổi rồi nhảy một phát khi mua gì đó — và trong lúc
 * ấy mấy món "còn thiếu 11 xu" thật ra đã mua được từ lâu.
 */
const STALE_MS = 30_000;

/**
 * Sổ đang giữ trong tay, cho chỗ khác đọc nhờ.
 *
 * Chỗ khác ở đây là BÀN CHỈNH: nó vẽ popover bằng đúng `popoverView` mà app thanh menu
 * gọi, nên nếu nó không đưa `pet` vào thì cái nó bày ra thiếu mất nhân vật — và một bàn
 * chỉnh bày ra thứ khác với thứ sẽ chạy thì đúng bằng cái bẫy "trên demo thì đẹp, lên
 * thanh thì lệch" mà cả file `menubar-view.js` sinh ra để tránh.
 *
 * Trả `null` khi chưa hỏi xong hoặc trò chơi đang tắt — chỗ gọi không cần phân biệt hai
 * ca ấy, cả hai đều là "vẽ khung cảnh như trước khi có trò chơi".
 */
export const currentPet = () => pet;

async function call(body) {
  askedAt = Date.now();
  try {
    const res = await fetch('/api/pet', {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await res.json();
    // Server trả ví mới nhất KỂ CẢ khi việc bị từ chối ("không đủ xu"). Nhận nó vào luôn:
    // lúc bị từ chối là đúng lúc người ta cần thấy số dư thật.
    if (d.pet) {
      // Hiệu số tính TRƯỚC khi thay `pet`, và chỉ theo chiều LÊN: mua xong ví tụt xuống,
      // mà một dòng "−26" bay lên ngay chỗ vừa mọc lên "+0,42" thì hai chuyển động giống
      // nhau đang nói hai chuyện ngược nhau. Tiền ra khỏi ví đã có câu trả lời riêng —
      // món hàng hiện lên tay quản gia.
      //
      // `>= 0.005` chứ không `> 0`: hai số đã cắt hai chữ số lẻ ở server nên hiệu thật luôn
      // là bội của 0,01, thứ nhỏ hơn thế chỉ là rác dấu phẩy động.
      if (pet && d.pet.coins - pet.coins >= 0.005) bump = d.pet.coins - pet.coins;
      // Bản CŨ giữ lại để so, vì mấy tiếng dưới đây hỏi "cái gì vừa đổi" chứ không hỏi "sổ
      // đang nói gì". Phải chụp trước dòng gán ngay dưới.
      const prev = pet;
      // Đóng dấu mốc NHẬN ngay chỗ nhận — `leftMs` là một hiệu số và nó chỉ có nghĩa khi
      // biết trừ từ đâu, xem `stampPet`. Thiếu nó thì việc đang làm không bao giờ xong.
      pet = stampPet(d.pet);
      // Mua xong thì thôi thử: món ấy giờ là món ĐANG BÀY thật (server tự bày món vừa mua),
      // và giữ nó ở trạng thái "đang thử" là bức tranh vẫn đúng nhưng cái nút dưới nó vẫn
      // mời mua một thứ đã mua rồi.
      if (tryOn && pet.owned?.includes(tryOn)) tryOn = null;
      // Bỏ món đang chọn khi lượt MUA đã ăn. Điều kiện phải kẹp cả `body` lẫn `d.error`:
      // lượt hỏi lại 30 giây cũng đi qua đây, và dọn cái khay giữa lúc người ta đang cân
      // nhắc là tự tay bấm "Thôi" hộ họ. Còn lúc bị từ chối ("không đủ xu") thì khay ở
      // lại — chỗ ấy là chỗ câu từ chối có nghĩa.
      if (body?.action === 'buy' && !d.error) pick = null;
      // Mua ăn được thì mừng. Cửa `!d.error` là cả điều kiện: một cú mua bị từ chối vì
      // thiếu xu vẫn đi qua đây, và nhảy lên mừng vì vừa bị từ chối là màn hình nói dối.
      if (body?.action === 'buy') {
        if (d.error) cue('deny');
        else {
          cheer();
          cue('buy');
        }
      }
      // Chốt xong một quãng nghỉ — tiếng dài nhất và mềm nhất trong bộ, vì đứng dậy khỏi
      // ghế là thứ đắt nhất mà trò chơi này xin người dùng làm.
      //
      // Bám vào SỐ QUÃNG NGHỈ ĐÃ TÍNH, không bám vào cú bấm. `action: 'break'` chỉ KHAI một
      // quãng — nó bắt đầu đếm ngược, và phải tới lượt quét sau server mới so `idleMs` rồi
      // quyết có tính hay không (xem `resolveBreak`). Kêu ngay lúc bấm là kêu mừng cho một
      // việc chưa xảy ra, và nó sẽ kêu cả trong đúng cái ca mà quãng nghỉ bị từ chối vì bạn
      // vẫn đang gõ. `pet.breaks` nhích lên đúng một lần cho mỗi quãng ĐƯỢC tính, nên nó là
      // cái mốc trung thực duy nhất ở phía này.
      if (prev && Number(d.pet.breaks) > Number(prev.breaks)) cue('rest');
      // Cất bản MỚI NHẤT, không cất bản đã pha lỗi: `err` không nằm trong `pet` nên nó
      // không đi cùng, và đó là điều kiện để lần mở sau không bày lại một câu "không đủ
      // xu" của phiên trước.
      savePet(pet);
    }
    err = d.error ?? (res.ok ? null : d.error ?? `HTTP ${res.status}`);
  } catch (e) {
    err = e.message;
  } finally {
    busy = null;
    redraw();
  }
}

/** Bật dáng mừng và hẹn đúng MỘT lượt vẽ để tắt nó. Hẹn lại thì huỷ cái cũ: mua hai món
 *  liền tay thì cái hẹn thứ nhất sẽ tắt dáng mừng của cú thứ hai giữa chừng. */
function cheer() {
  cheerAt = Date.now();
  clearTimeout(cheerTimer);
  cheerTimer = setTimeout(() => {
    cheerAt = 0;
    redraw();
  }, CHEER_MS);
}

/** Còn đang mừng không — hỏi theo đồng hồ chứ không theo cái cờ, để một lượt vẽ bất kỳ
 *  giữa hai giây ấy vẫn ra đúng câu trả lời. */
const cheering = () => cheerAt > 0 && Date.now() - cheerAt < CHEER_MS;

/** Một cú bấm → một lượt gửi. Gom vào một chỗ vì cả bốn việc chung đúng một nhịp: khoá
 *  nút, xoá lỗi cũ, vẽ lại ngay để nút kịp mờ đi, rồi mới đi. */
function fire(mark, body) {
  if (busy) return;
  busy = mark;
  err = null;
  redraw();
  return call(body);
}

function onClick(e) {
  // Đi trong thị trấn KHÔNG gửi gì lên server — nó chỉ đổi khối đang hiện. Vì thế nó nằm
  // ngoài `fire` và không bị `busy` chặn: đang chờ một lượt mua mà không đi được sang chỗ
  // khác thì cái bản đồ đọc thành treo.
  const pl = e.target.closest('[data-place]');
  if (pl) {
    place = pl.dataset.place;
    tryOn = null;
    pick = null;
    // Ngăn kéo cũng quên theo, cùng luật với `tryOn` và `pick`: rời tiệm là quên. Quay lại
    // thấy khe thứ năm đang mở là một trạng thái không ai đặt ra và không ai nhớ mình đã đặt.
    shelf = null;
    err = null;
    // Cú bấm phải NHÌN THẤY ĐƯỢC hậu quả của nó. Xem `arrive` và `showPanel`.
    arriving = true;
    cue('tap');
    redraw();
    return showPanel();
  }

  // THỬ ĐỒ. Cũng không gửi gì lên server, và cũng vì thế nó nằm ngoài `fire`: mặc thử là
  // một việc của mắt, không phải một giao dịch, nên nó không được xếp hàng sau một lượt mua
  // đang chờ mạng. `data-try` vắng mặt nghĩa là CỞI RA — cùng quy ước với `data-wear`.
  const tr = e.target.closest('[data-try-slot]');
  if (tr) {
    tryOn = tr.dataset.try ?? null;
    err = null;
    return redraw();
  }

  // MỞ MỘT KHE ở tiệm trang trí. Cũng không gửi gì lên server, cùng lý do với hai việc trên:
  // mở một ngăn kéo là một việc của mắt.
  //
  // Bấm lại đúng khe đang mở thì KHÔNG gập nó lại, và đó là chủ ý: một cái ngăn kéo gập được
  // hết thì có một trạng thái mà cả tiệm trống trơn, và người rơi vào đấy không có gì để đọc
  // ngoài cái dải thẻ. Dải thẻ là đường ĐI, không phải đích đến.
  const sh = e.target.closest('[data-shelf]');
  if (sh) {
    shelf = sh.dataset.shelf;
    // Bỏ luôn món đang mặc thử: nó thuộc về khe vừa đóng lại, mà bức tranh thử đồ thì đứng
    // ngay trên đầu cái ngăn kéo. Giữ nó lại là một bức tranh nói về một món không còn nhìn
    // thấy ở đâu trên màn hình.
    tryOn = null;
    err = null;
    cue('tap');
    return redraw();
  }

  // CHỌN MÓN ĂN — thì thứ nhất của hai thì, và nó không tiêu một xu nào. Bấm lại đúng ô
  // đang chọn thì bỏ chọn, nên cái lưới tự nó đã là nút huỷ; nút "Thôi" dưới khay chỉ là
  // chỗ thứ hai nói cùng câu ấy, đặt ngay cạnh chỗ mắt đang nhìn.
  //
  // Nằm ngoài `fire` như mọi việc không gửi gì lên server, và đó là chỗ quan trọng: đang
  // ăn dở thì ô hàng khoá lại, nhưng ĐỌC bảng giá thì lúc nào cũng phải được.
  const pk = e.target.closest('[data-pick]');
  if (pk) {
    pick = pick === pk.dataset.pick ? null : pk.dataset.pick;
    err = null;
    return redraw();
  }
  if (e.target.closest('[data-pick-off]')) {
    pick = null;
    err = null;
    return redraw();
  }

  // Khối nguồn gốc. Bắt trên `summary` chứ không nghe sự kiện `toggle` của `details`: sự
  // kiện ấy cũng nổ khi chính ta gán lại `open` lúc dựng lại DOM, tức nó tự vọng lại. Ghi
  // trạng thái rồi để trình duyệt tự lật thẻ — không `redraw()`, vì lượt vẽ lại sẽ nuốt
  // mất hoạt hình mở ra và cũng chẳng có gì khác để vẽ.
  if (e.target.closest('.hud-why > summary')) {
    whyOpen = !whyOpen;
    return;
  }

  // Công tắc tiếng. Ngoài `fire` như mọi việc không gửi gì lên server — nó là thiết lập của
  // MÁY NÀY, không phải của sổ; sổ thì dùng chung giữa dashboard và app thanh menu, mà app
  // thanh menu thì không được kêu bao giờ.
  //
  // Kêu một tiếng NGAY sau khi bật, và đó là cả điểm: cú bấm này là cú bấm duy nhất trong
  // màn mà hậu quả của nó không nhìn thấy được, nên nó phải tự nghe thấy được. Bật xong mà
  // im lặng thì không có cách nào biết nó đã ăn — trừ khi đi bấm một thứ khác.
  const sw = e.target.closest('[data-sound]');
  if (sw) {
    setSound(sw.dataset.sound === 'on');
    cue('tap');
    return redraw();
  }

  const buy = e.target.closest('[data-buy]');
  if (buy) return fire(buy.dataset.buy, { action: 'buy', id: buy.dataset.buy });

  // Đổi món đang bày. `data-wear` vắng mặt nghĩa là DỌN TRỐNG chỗ đó — `dataset` trả
  // `undefined`, và `JSON.stringify` bỏ hẳn khoá ấy khỏi body, nên server nhận `id`
  // undefined chứ không phải null. Gửi `null` tường minh để cửa kiểm bên kia phân biệt
  // được "dọn trống" với "thiếu tham số"; xem nhánh `wear` trong `server.js`.
  const wr = e.target.closest('[data-wear-slot]');
  if (wr) {
    const id = wr.dataset.wear ?? null;
    // Bày một món ĐÃ CÓ thì bức tranh phải nói về bộ đồ thật ngay, nên bỏ luôn món đang thử.
    // Không bỏ thì trên đầu quản gia là cái nón đang thử còn dòng chữ dưới nói tên cái nón
    // vừa bày — hai câu trả lời cho một câu hỏi.
    tryOn = null;
    return fire(`wear:${wr.dataset.wearSlot}`, { action: 'wear', slot: wr.dataset.wearSlot, id });
  }

  const mv = e.target.closest('[data-move]');
  if (mv) return fire('break', { action: 'break', kind: mv.dataset.move });
  if (e.target.closest('[data-break-off]')) return fire('break', { action: 'breakOff' });

  const tg = e.target.closest('[data-pet-toggle]');
  if (tg) return fire('toggle', { action: 'toggle', on: tg.dataset.petToggle === 'on' });
}

/**
 * Bật màn: nhận cách vẽ lại của chỗ chủ rồi gắn một cái nghe.
 *
 * Là HÀM chứ không phải mấy dòng chạy lúc nạp module, cùng lý do đã ghi cho `initBench`:
 * `test/modules.test.js` nạp mọi file dưới `views/` trong Node, nơi không có `document`.
 */
export function initPet(onChange) {
  redraw = onChange;
  if (wired) return;
  wired = true;
  document.addEventListener('click', onClick);
  fitTown();
  call(null);
}

/**
 * Thu bản đồ vừa bề rộng khung — hệ số co, chứ không phải một thanh cuộn.
 *
 * ## Vì sao phải có
 *
 * Bản đồ là một bức tranh có bề rộng THẬT: mọi toà nhà đứng ở một toạ độ pixel tính từ tâm
 * (xem `TOWN_BOX`), nên nó không "chảy" như một khối chữ. Bản trước khai `min-width: 760px`
 * và cho khung `overflow: auto`, tức là khung hẹp lại thì bản đồ đứng nguyên và một phần
 * thị trấn đi ra ngoài mép — trên khung 700px là mất hẳn tiệm trang trí và một ô đất. Một
 * bản đồ mà phải cuộn ngang mới thấy hết thì nó thôi không còn là bản đồ.
 *
 * ## Vì sao là `ResizeObserver` chứ không phải CSS
 *
 * CSS không có sẵn "một số không đơn vị bằng bề rộng khung chia cho 680". Truy vấn khung
 * cho được `cqw`, nhưng `scale()` cần một SỐ, và phép chia hai độ dài trong `calc` thì
 * không hợp lệ. Có mẹo lượng giác đi vòng qua chỗ ấy (`tan(atan2(100cqw, 680px))`), nhưng
 * nó là một dòng không ai đọc ra ý định, cho một việc mà bốn dòng JS nói thẳng.
 *
 * Gắn vào `#view` chứ không vào `.town`: `mount()` thay sạch DOM bên trong `#view` mỗi lượt
 * vẽ, tức `.town` là một thẻ MỚI mỗi 30 giây (và mỗi giây khi có việc đang chạy). Một
 * observer bám vào nó thì chết ngay lượt vẽ sau, còn `--town-k` đặt trên `#view` thì sống
 * qua mọi lượt — nó nằm ở thuộc tính `style` của một thẻ không bị thay.
 *
 * Không phóng TO quá 1: bức tranh là lưới 4px, và phóng lên là mỗi ô thành 5 hay 6 pixel
 * lệch nhau — chỗ nào cũng có một hàng dày hơn hàng bên cạnh. Thu nhỏ thì mềm đi đều, chấp
 * nhận được; phóng to thì lộ hẳn ra là méo.
 */
function fitTown() {
  const host = document.getElementById('view');
  if (!host || typeof ResizeObserver !== 'function') return;
  const fit = () => {
    const w = host.clientWidth;
    if (w) host.style.setProperty('--town-k', String(Math.min(1, w / TOWN_BOX.w)));
  };
  new ResizeObserver(fit).observe(host);
  fit();
}

/**
 * Kéo cái khối vừa mở vào tầm mắt — phần thứ hai của phép sửa "bấm nhà mà không thấy gì".
 *
 * ## Vì sao phải cuộn, chứ không chỉ dọn bớt chữ
 *
 * Lượt này đã dồn dải thông số vào một dòng dán liền bản đồ (139px → 48px), và chừng ấy
 * vẫn KHÔNG đủ: chỉ riêng bức tranh đã cao 500px trong một khung cuộn 708px, nên cái khối
 * trả lời bắt đầu ở khoảng 590px và chỉ hở ra hơn trăm pixel — vừa đủ tấm biển tên. Số học
 * ấy không sửa được bằng cách dọn chữ; nó chỉ sửa được bằng cách DỜI TẦM MẮT.
 *
 * ## Ba luật của phép cuộn này
 *
 * 1. **Chừa lại một dải bản đồ.** Cuộn tới đúng mép khối (`block: 'start'`) thì thị trấn
 *    biến mất sạch, và lúc ấy màn hình không còn nói ra mình vừa bấm vào đâu — đổi một cái
 *    mù lấy một cái mù khác. `KEEP` đo từ mép trên cái khối, và nó chọn từ TOẠ ĐỘ THẬT
 *    trên bản đồ chứ không ướm mắt: biển của Công viên và Thư viện treo ở hàng 340 của một
 *    bức tranh cao 500, tức 160px tính từ đáy; cộng dải nhắc 39px và khoảng cách 12px ra
 *    211 — và đó mới là ngưỡng SÁT MÉP, ở đó hai tấm biển nằm đúng sáu pixel trong tầm
 *    nhìn. 248 để chúng lọt hẳn vào, cách mép trên gần 40px. Nên dải còn lại luôn chở đủ
 *    hai tấm biển ở mép trước cùng khúc đường — vẫn thấy mình đang đứng ở đâu trong thị
 *    trấn, chứ không phải vừa nhảy sang một trang khác.
 * 2. **Đã thấy đủ thì đứng yên.** Bấm từ Quán ăn sang Tiệm trang trí trong lúc khối hàng
 *    đang mở sẵn giữa màn hình thì không được giật đi đâu cả — một cú cuộn không cần thiết
 *    đọc thành lỗi. `ENOUGH` là ngưỡng "đủ để đọc được đây là khối gì và có gì trong đó".
 * 3. **Không cuộn NGƯỢC lên.** Nếu người ta đã tự cuộn xuống sâu hơn thì họ đang đọc; kéo
 *    họ lên lại là giành lấy quyền điều khiển của chính họ.
 *
 * Gọi NGAY SAU `redraw()`, không hẹn qua `requestAnimationFrame`. `redraw()` thay cây DOM
 * đồng bộ, và `getBoundingClientRect` thì tự ép trình duyệt tính lại bố cục trước khi trả
 * số — nên toạ độ đọc được ở đây đã là toạ độ của thẻ MỚI. Hẹn qua một khung hình chỉ thêm
 * một chỗ phụ thuộc vào thứ có thể bị bóp: `requestAnimationFrame` không chạy ở tab nền,
 * và một phép đo không bao giờ chạy thì im như không có lỗi.
 */
const KEEP = 248;
const ENOUGH = 300;
function showPanel() {
  const el = document.querySelector('.shop-panel');
  // Khung cuộn thật là `#scroll`, không phải cửa sổ: `body` và `main` đều `overflow:
  // hidden`, nên `window.scrollTo` ở đây không làm gì cả và cũng không báo lỗi gì cả.
  const sc = el?.closest('#scroll');
  if (!el || !sc) return;
  const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
  if (top <= sc.clientHeight - ENOUGH) return;
  glide(sc, sc.scrollTop + top - KEEP);
}

/**
 * Cuộn mượt TỰ VIẾT, và đây không phải chuyện thích tự làm lấy.
 *
 * `scrollTo({ behavior: 'smooth' })` là một dòng ngắn hơn hẳn, và nó đã được thử ở đúng
 * chỗ này. Nó KHÔNG chạy: trên bề mặt trình duyệt đang dùng để kiểm, lệnh ấy trả về bình
 * thường, không ném gì, và `scrollTop` đứng nguyên ở 0 — trong khi `scrollTop = n` và
 * `scrollTo(0, n)` ngay sau đó thì chạy đúng. Tức nó có một chế độ hỏng KHÔNG BÁO GÌ, và
 * cái nó nuốt mất lại đúng là phép sửa của lượt này: người dùng bấm vào một toà nhà và
 * không thấy gì xảy ra.
 *
 * Nó còn một chế độ hỏng thứ hai có thật ngoài đời và cũng im hệt thế: bật "giảm chuyển
 * động" ở cấp hệ điều hành thì nhiều trình duyệt cho `behavior: 'smooth'` thành KHÔNG cuộn
 * gì cả, chứ không phải cuộn ngay lập tức. Ở đây thì phải ngược lại — người bật giảm
 * chuyển động vẫn cần thấy cái khối, họ chỉ không cần thấy nó trôi.
 *
 * Nên phép cuộn tự viết: 260ms, giảm tốc bậc ba. Không có chỗ nào nó im lặng không làm gì.
 *
 * Không bắt sự kiện cuộn để nhường người dùng giữa chừng: 260ms là ngắn hơn một cú vuốt,
 * và cái nghe thêm ấy phải gỡ ra đúng lúc, tức là thêm một chỗ để rò.
 */
const GLIDE_MS = 260;
function glide(sc, to) {
  const from = sc.scrollTop;
  const d = to - from;
  if (!d) return;
  // Hai ca đi thẳng tới nơi, không trôi: người đã tắt hiệu ứng chuyển động, và bề mặt
  // không có `requestAnimationFrame`. Cả hai đều phải CUỘN — chỉ là không trôi.
  if (typeof requestAnimationFrame !== 'function' || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    sc.scrollTop = to;
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / GLIDE_MS);
    sc.scrollTop = from + d * (1 - (1 - p) ** 3);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const idsOf = (pick) => Object.keys(pet.items).filter((k) => pick(pet.items[k]));

/** Giá viết ra chữ. Qua `coinNum` chứ không in thẳng: từ lúc đồ ăn có phần lẻ, `1.85` với
 *  `60` phải hiện ra đúng như nhau ở mọi chỗ có chữ "xu". */
const price = (n) => t('pet.coins', { n: coinNum(n) });

/* ── Việc đang làm ────────────────────────────────────────────────────────────── */

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Việc đang làm, đã trừ phần đã trôi theo đồng hồ MÁY NÀY.
 *
 * Server gửi một HIỆU SỐ và nó đứng yên giữa hai lượt hỏi (xem `petView`), nên phía này
 * phải tự trừ. Mọi chỗ cần biết "đang bận không" đều đi qua đây — cái đồng hồ đếm ngược,
 * mấy cái nút bị khoá, tư thế quản gia, và cái hình đang vơi. Sáu chỗ tự trừ lấy là sáu
 * con số lệch nhau vài trăm mili giây, và trong đó có đúng một chỗ quyết định nút có bấm
 * được hay không.
 *
 * ## Trừ theo `pet.at`, KHÔNG theo một mốc riêng
 *
 * Chỗ này từng giữ mốc nhận trong biến `petAt` của riêng nó, và đó là đúng cho tới khi
 * `livePet` vào `renderPet`: từ lượt ấy `pet.doing.leftMs` đã là con số ĐÃ TRỪ, còn `petAt`
 * thì vẫn đứng ở mốc nhận, nên hàm này trừ chồng lên một phép trừ vừa xảy ra. Người dùng
 * đo được ngay: *"cooldown thời gian cho ăn vẫn đang chạy 2s 1 lần"* — một phút ăn cạn
 * trong ba mươi giây, và mọi nút mua mở khoá sớm gấp đôi trong khi server vẫn còn khoá.
 *
 * `pet.at` là mốc mà `leftMs` ĐANG ỨNG VÀO, và cả `stampPet` lẫn `livePet` đều duy trì
 * đúng bất biến ấy — nên trừ theo nó thì đúng ở cả hai phía của dòng `pet = livePet(pet)`:
 * `beat` gọi trước (mốc của lượt vẽ trước, trừ phần thật sự trôi), mọi chỗ vẽ gọi sau (mốc
 * của chính lượt này, trừ gần bằng không). Một mốc thứ hai đặt cạnh nó là một bất biến thứ
 * hai phải nhớ giữ đồng bộ bằng tay, và đây là lần nó đã trượt.
 */
function doingNow() {
  if (!pet?.doing) return null;
  const leftMs = pet.doing.leftMs - (Date.now() - pet.at);
  return leftMs > 0 ? { ...pet.doing, leftMs } : null;
}

/**
 * Dải "đang làm" — đứng NGOÀI mọi khối, ngay dưới hai cái thanh.
 *
 * Nó phải ở đây chứ không nằm trong công viên hay quán ăn, vì nó là thứ khoá mọi nút mua
 * trên cả màn hình: một cú bấm bị từ chối mà lời giải thích nằm ở một chỗ khác trong thị
 * trấn thì nó là một cú bấm hỏng. Đứng cạnh cái ví và hai cái thanh thì nó trả lời đúng
 * câu người ta vừa hỏi — "sao bấm không được".
 *
 * Món đồ ở đây là cùng một hình đang vơi trong tay quản gia ngoài bản đồ, và cùng một
 * `leftMs` — hai chỗ vơi lệch nhau thì cái nào đúng?
 */
function doingStrip() {
  const d = doingNow();
  if (!d) return '';
  const move = d.kind === 'move';
  return html`<div class="doing-now kind-${d.kind}">
    <span class="doing-art">${doingArt(d)}</span>
    <span class="doing-say">
      <b>${t(move ? `pet.move.${d.id}` : `pet.item.${d.id}`)}</b>
      <span>${t(move ? 'pet.breakWatch' : 'pet.eatingNote')}</span>
    </span>
    <span class="doing-clock">${mmss(d.leftMs)}</span>
    <!-- Chỉ quãng nghỉ mới bỏ dở được. Một bữa ăn thì không: nó đã trừ tiền và đã ghi vào
         hai cái mốc, nên "bỏ dở" ở đó phải là hoàn tiền hoặc là lấy lại phần no — mà cả
         hai đều là một cửa mới để lách. Một phút thì chờ được. -->
    ${move
      ? html`<button type="button" class="btn ghost" data-break-off ${busy === 'break' ? 'disabled' : ''}>${t('pet.breakStop')}</button>`
      : ''}
  </div>`;
}

/* ── Bản đồ ───────────────────────────────────────────────────────────────────── */

/**
 * Thị trấn nhìn từ trên cao. Toà nhà là NÚT, ô đất thì không.
 *
 * Chỗ đứng lấy thẳng từ `lib/town.js` — lưới đẳng cự sống ở đó cùng với mấy hình, vì hai
 * thứ ấy phải khớp nhau đến từng pixel: một toà nhà vẽ theo độ dốc 2:1 mà đặt lên một lưới
 * độ dốc khác thì nó đứng chênh vênh, và không có chỗ nào trên màn hình nói ra vì sao.
 *
 * Xếp theo `y` TĂNG DẦN, và thứ tự ấy là toàn bộ phép sắp lớp: trong phối cảnh này, càng
 * xuống dưới là càng gần người xem, nên vẽ sau là đè lên. Không có `z-index` nào phải nghĩ
 * — trừ đúng một cái, để cái biển tên của toà nhà gần không bị toà nhà xa che (thứ tự DOM
 * lo được lớp giữa các chỗ, nhưng biển tên thò xuống dưới chân nhà nên nó cần một bậc).
 *
 * Chỗ đang mở nhận hai kênh: một hình thoi sáng dưới chân công trình và tấm biển đảo
 * sáng-tối. Theme daltonized làm màu accent hết phân biệt, và lúc ấy tấm biển đen chữ trắng
 * vẫn đọc ra ngay.
 *
 * `w` là bề rộng sprite, gửi sang CSS làm `--bw`: cái hình thoi ấy phải nống ra quanh chân
 * ĐÚNG toà nhà nó đang chọn, mà năm toà nhà rộng từ 128 tới 240px. Đo bằng `sizeOf` chứ
 * không gõ tay — cùng lý lẽ đã ghi cho `TOWN_BOX`: một con số chép tay là một con số đúng
 * vào ngày viết.
 */
function townMap() {
  const spots = [
    ...PLACES.map((p) => ({ id: p.id, x: p.x, y: p.y, w: sizeOf(p.rows).w })),
    ...LOTS.map((l) => ({ ...l, lot: true })),
    ...SCENE_SPOTS.map((s) => ({ ...s, scene: true })),
  ].sort((a, b) => a.y - b.y);
  const doing = doingNow();
  return html`<div class="town sky-${phaseOf(new Date().getHours())}">
    <div class="town-map">
      <!-- Đường xá vẽ TRƯỚC mọi thứ và nằm dưới mọi thứ: chúng là mặt đất, và trên mặt đất
           thì cái gì cũng đè lên được. Bốn thẻ div lệch trục, không phải mười bốn nghìn ô
           pixel — xem khối chú thích của ROADS trong lib/town.js. -->
      ${ROADS.map(
        (r) => html`<i class="town-road dir-${r.dir}" style="--x:${r.x}px;--y:${r.y}px;width:${r.w}px;height:${r.h}px"></i>`,
      )}
      ${spots.map((s) => {
        // Cây cối quanh phố: thẻ TRƠ, không tên, không bấm được. Chúng xếp chung một danh
        // sách với mấy toà nhà để phép sắp lớp theo `y` vẫn là một phép duy nhất — một cái
        // cây đứng trước nhà phải che được góc nhà, và một cái cây đứng sau thì không.
        if (s.scene) {
          return html`<div class="place scene kind-${s.kind}" style="--x:${s.x}px;--y:${s.y}px;z-index:${Math.round(200 + s.y)}">
            <span class="place-art">${sceneArt(s.i)}</span>
          </div>`;
        }
        const at = `--x:${s.x}px;--y:${s.y}px;z-index:${Math.round(200 + s.y)}`;
        // Ô đất chưa mở: THẺ TRƠ, không phải nút mờ. Một cái nút disabled vẫn mời người ta
        // thử bấm rồi không trả lời gì; một hàng cọc rào thì đã tự nói xong. Cả câu giải
        // thích nằm trong thuộc tính title vì nó là câu trả lời cho một thắc mắc, không
        // phải một dòng chữ ai cũng phải đọc.
        // Chữ trần, không quote: backtick trong comment HTML nằm trong template literal
        // sẽ ĐÓNG LUÔN chuỗi — CLAUDE.md điều 3, lọt thêm một lần nữa ở đúng chỗ này.
        if (s.lot) {
          return html`<div class="place lot" style="${at}" title="${t('town.lotNote')}">
            <span class="place-art">${lotArt()}</span>
            <span class="place-sign">${t('town.lot')}</span>
          </div>`;
        }
        // Quản gia hỏi TỪNG chỗ xem anh ta có đang ở đấy không, thay vì chỗ này tự đoán.
        // Ở nhà khi rảnh và khi đang ăn hay đang vươn vai; ở công viên khi đang đi bộ hay
        // tắm nắng — xem `whereOf`. Bảng quyết định nằm ở `MOVES`, không ở đây.
        // `placeArt` nhận thêm việc đang làm từ lượt này, và CHỈ nhà mình đọc tới nó: căn
        // phòng đổi đồ đạc theo việc — bàn làm việc, bàn ăn, góc tập. Xem `homeSetOf`.
        return html`<button type="button" class="place ${place === s.id ? 'here' : ''}" style="${at};--bw:${s.w}px"
          data-place="${s.id}" aria-pressed="${place === s.id}">
          <span class="place-art">${placeArt(s.id, doing)}${butlerArt(doing, s.id, Date.now(), pet, cheering())}</span>
          <span class="place-sign">${t(`town.${s.id}`)}</span>
        </button>`;
      })}
      <!-- Người qua đường vẽ SAU cùng và nằm trên mọi thứ, khác hẳn luật sắp lớp theo y ở
           trên. Không phải bỏ sót: họ ĐI, nên cái y của họ đổi liên tục, mà z-index thì
           tính một lần lúc dựng — xếp họ vào danh sách kia là một người lúc thì đi trước
           nhà lúc thì chui vào trong tường, tuỳ lượt vẽ rơi vào đâu.
           Đường xuyên tâm nằm ở mép TRƯỚC của mấy toà nhà nên đè lên trên là đúng chỗ
           gần như suốt tuyến; chỗ sai duy nhất là hai đầu, và ở đó họ đã mờ hết. -->
      <!-- animation-delay ÂM trên CẢ HAI hoạt hình, và nó là một chỗ sửa chứ không phải một
           dòng cho đủ: lúc có việc đang chạy thì cả bản đồ dựng lại mỗi giây, mà một thẻ mới
           thì hoạt hình của nó bắt đầu lại từ 0. Tức suốt quãng ấy hai con vật đứng đơ ở đầu
           tuyến, mỗi giây nhích được một phần tư giây rồi giật về. Không ai báo vì nó chỉ xảy
           ra đúng lúc người ta đang nhìn chỗ khác — món đồ đang vơi.
           Chu kỳ là HAI lần dur vì alternate nối lượt đi với lượt về thành một vòng.
           Chữ trần, không quote: backtick trong comment HTML nằm trong template literal sẽ
           ĐÓNG LUÔN chuỗi — CLAUDE.md điều 3. -->
      ${WALKERS.map(
        (w) => html`<i class="town-walker" aria-hidden="true"
          style="--ax:${w.from.x}px;--ay:${w.from.y}px;--bx:${w.to.x}px;--by:${w.to.y}px;--dur:${w.dur}s;animation-delay:${-(Date.now() % (w.dur * 2000))}ms,${-(Date.now() % (w.dur * 1000))}ms"
          >${walkerArt(w.i)}</i
        >`,
      )}
      <!-- Quản gia RA PHỐ khi đang rời mắt khỏi màn hình. Thẻ này đứng ngoài danh sách mấy
           chỗ vì anh ta lúc ấy không thuộc chỗ nào cả — anh ta đang đi trên đường, và đường
           thì không phải một cái nút. Cùng cơ chế với người qua đường: bốn biến toạ độ và
           một độ trễ âm, xem STROLL trong lib/town.js. -->
      ${strolling(doing)
        ? html`<i class="town-stroll" aria-hidden="true"
            style="--ax:${STROLL.from.x}px;--ay:${STROLL.from.y}px;--bx:${STROLL.to.x}px;--by:${STROLL.to.y}px;--dur:${STROLL.ms}ms;animation-delay:${strollLag(Date.now())}ms"
            >${butlerArt(doing, 'street', Date.now(), pet, cheering())}</i
          >`
        : ''}
    </div>
  </div>`;
}

/**
 * Dải thông số — MỘT DÒNG, dán liền mép trên bản đồ.
 *
 * ## Vì sao nó đổi lần nữa
 *
 * Bản 5/8 đã gộp ba cái thẻ 110px thành một dải 80px và dời xuống dưới bản đồ. Lượt này
 * người dùng báo phần dưới bản đồ "hiển thị quá nhiều các thông số và chữ", và đo lại thì
 * con số nói đúng như vậy: giữa bức tranh và cái khối trả lời cho một cú bấm có 139px chen
 * vào — dải 80px, một dòng gập 17px, một khối nhắc 42px — trong một khung cuộn chỉ cao
 * 708px. Ba thứ ấy đều hợp lệ, nhưng cả ba đều đứng ĐÚNG chỗ mà mắt phải đi qua giữa câu
 * hỏi và câu trả lời.
 *
 * ## Ba chỗ đổi, và lý do của từng chỗ
 *
 * 1. **Nhãn, hình và chữ nằm trên MỘT hàng**, không còn nhãn ở trên hàng ở dưới. Bản trước
 *    xếp hai tầng nên mỗi ô cao bằng nhãn cộng cái cao nhất; một hàng thì cao bằng đúng cái
 *    cao nhất, tức đúng chiều cao cái đồng hồ cát. 80px → 48px, không bỏ chữ nào.
 * 2. **Dán liền bản đồ, không còn là một cái thẻ riêng.** Đây là chỗ đổi thật, và nó không
 *    phải chuyện tiết kiệm pixel: ba con số này là trạng thái của con vật ĐANG ĐỨNG trong
 *    bức tranh ngay dưới, nên chúng là thanh trạng thái của cái màn hình ấy chứ không phải
 *    một khối thứ hai đứng cạnh nó. Dán liền thì chúng thôi không chen giữa bản đồ và câu
 *    trả lời nữa — chúng ở PHÍA TRÊN cả hai.
 * 3. **Tên trạng thái ("Ổn", "Sắp hết nhịp") lên mặt trang.** Bản trước dọn nó vào `title`
 *    theo luật "tooltip chỉ được chở thứ suy ra được từ cái hình nó dán vào". Luật ấy còn
 *    đúng, nhưng nó có một tiền đề: cái hình phải ĐỌC ĐƯỢC. Người dùng vừa báo cái đồng hồ
 *    cát "khá khó nhìn để biết được tình trạng tập trung là thế nào" — tiền đề hỏng, nên
 *    kết luận cũng hỏng. Hình đã sửa (xem `dialRows`), và phần phán xét trả về mặt trang,
 *    vì nó mới là câu người ta hỏi khi liếc: không phải "bao nhiêu phần trăm", mà "thế có
 *    ổn không". Tooltip giữ nguyên — nó thành bản đầy đủ, không còn là bản duy nhất.
 */
function townHud(up) {
  // Cùng một dải với popover, cùng một hàm vẽ — xem `statCells` trong `lib/pet.js`. Hai bản
  // vẽ riêng là hai chỗ để lệch, và chúng ĐÃ lệch: bề mặt này mở bằng cái Ví còn popover
  // kết bằng nó, không vì lý lẽ nào cả. Khác nhau ở đây chỉ còn đúng một tham số.
  return html`<div class="town-hud">${statCells(pet, { bump: up })}</div>`;
}

/**
 * Câu nhắc sức khoẻ — một dải dán liền mép DƯỚI bản đồ, và nó BẤM ĐƯỢC.
 *
 * Trước lượt này nó là một khối chữ 42px đứng rời giữa dải thông số và cửa hàng, tức một
 * trong ba thứ chen vào giữa cú bấm và câu trả lời. Nhưng nó không được phép rơi xuống
 * chân trang: nó là thứ DUY NHẤT trên màn này chủ động ngắt lời người đọc, và một lời ngắt
 * đặt dưới đáy thì không ngắt được gì.
 *
 * Nên nó về đúng chỗ của nó — mép dưới cái màn hình, đúng nơi trò chơi nào cũng đặt một
 * dòng báo. Ở đấy nó không tính tiền bằng khoảng cách giữa hai thứ khác, vì nó là một phần
 * của chính cái khung.
 *
 * Và nó thành một cái NÚT sang Công viên, vì câu nó nói là "đứng dậy đi lại vài phút" mà
 * chỗ khai việc ấy lại nằm ở một khối người ta phải tự tìm. Một lời khuyên kèm sẵn cái cửa
 * dẫn tới chỗ làm được nó thì mới là một lời khuyên; không kèm thì nó là một câu trách.
 *
 * Dải này KHÔNG đè lên bức tranh dù mép dưới bản đồ có 44px cỏ trống: hệ số co `--town-k`
 * bóp bức tranh chứ không bóp cái dải, nên ở khung hẹp thì 44px kia co lại còn 20px và cái
 * dải bắt đầu ăn vào mấy tấm biển. Một thứ chỉ đúng ở một bề rộng thì nó chưa đúng.
 */
function townAlert() {
  // Cái CỬA nó dẫn tới là do lời nhắc quyết, không phải viết cứng ở đây. Đời trước dải này
  // luôn trỏ về Công viên, và điều đó đúng đúng chừng nào nó chỉ nói về nhịp ngồi. Từ lượt
  // này nó còn nói về cơn đói, mà một câu "đói lả rồi" kèm cái nút đi ra công viên là một
  // lời khuyên dẫn nhầm chỗ — tệ hơn hẳn không có nút nào.
  // BẬC to nhỏ cũng do lời nhắc quyết, cùng một cửa với cái đích. Người dùng xin "thông báo
  // nổi bật khi quá đói hoặc làm việc quá lâu... và hướng dẫn hành động luôn" — vế thứ hai
  // đã có sẵn (cái nút), vế thứ nhất là bậc này. Ranh giới của nó ở `URGENT`, `lib/pet.js`:
  // kêu to đúng ở hai trạng thái mà bức tranh đã vẽ ra một người ngừng làm việc.
  const nudge = nudgeOf(pet);
  if (!nudge) return '';
  return html`<button type="button" class="town-alert lv-${nudge.level}" data-place="${nudge.go}">
    <span class="town-alert-say">${nudge.say}</span>
    <span class="town-alert-go">${t(`town.${nudge.go}`)}</span>
  </button>`;
}

/**
 * Bản đồ, dải thông số và dải nhắc — MỘT cái khung, không phải ba khối xếp chồng.
 *
 * Bốn con số của khung đi kèm ngay đây, tính từ chính những thứ đang đứng trên bản đồ (xem
 * `TOWN_BOX`). Trước đây chúng nằm cứng trong `styles.css`, và lượt phóng to nhà cửa làm cả
 * bốn cùng sai một lúc mà không có gì đỏ lên báo.
 *
 * Chúng khai ở ĐÂY chứ không ở `.town` như trước, vì bề rộng của cả cái khung phải bằng bề
 * rộng bức tranh SAU KHI co — mà biến CSS thì chảy xuống, nên `.town` bên trong vẫn đọc
 * được đúng bốn con số ấy.
 */
function townShell(up) {
  return html`<div class="town-shell">
    ${townHud(up)}
    ${townMap()}
    ${townAlert()}
  </div>`;
}

/** Bốn con số của khung, gán lên CẢ CỘT chứ không lên riêng cái khung: từ lượt này bề rộng
 *  của cột cũng suy từ chúng, để mép cái ngăn bên dưới thẳng hàng với mép bản đồ — xem
 *  `.shop` trong `styles.css`. */
const TOWN_VARS = `--town-w:${TOWN_BOX.w}px;--town-h:${TOWN_BOX.h}px;--town-ox:${TOWN_BOX.ox}px;--town-oy:${TOWN_BOX.oy}px`;

/* ── Nhà ──────────────────────────────────────────────────────────────────────── */

/**
 * Nhà — chỗ xem lại thứ mình đã sắm và chỗ tắt trò chơi.
 *
 * Nó không bán gì, và đó là việc của nó: bốn chỗ kia đều đòi một quyết định (mua gì, đổi
 * gì, nghỉ động tác nào), còn chỗ này chỉ trả lời "tôi đang có gì". Nút tắt trò chơi cũng
 * dọn về đây — trước nó nằm ở chân trang, tức là nó theo chân người ta qua mọi khối hàng
 * hoá suốt cả màn, một cái nút phá đám đứng cạnh mọi thứ đang mời mua.
 */
function homeSec() {
  const worn = pet.worn ?? {};
  const on = (pet.slots ?? []).filter((s) => worn[s]);
  const sound = soundOn();
  return html`<section class="shop-sec">
    <p class="shop-hint">${t('pet.homeHint')}</p>
    <!-- Ba động tác LÀM ĐƯỢC NGAY TẠI BÀN đứng ở đây chứ không ở công viên, và đó là một
         chỗ sửa chứ không phải một cách bày lại menu: bản trước cả năm động tác cùng nằm
         trong công viên, tức là màn hình đang nói rằng muốn uống một cốc nước thì phải đi
         ra công viên. Bảng quyết định chỗ nào bày động tác nào là trường where trong MOVES,
         và cùng trường ấy quyết luôn chỗ quản gia đứng trên bản đồ.
         Chữ trần, không quote: backtick trong comment HTML nằm trong template literal sẽ
         ĐÓNG LUÔN chuỗi — CLAUDE.md điều 3, lọt thêm một lần nữa ở đúng chỗ này. -->
    ${moveSec('home')}
    ${on.length
      ? html`<div class="home-worn">
          ${on.map(
            (s) => html`<span class="home-piece">
              ${artOn('shop-art', worn[s], BOX_TALL)}
              <b>${t(`pet.item.${worn[s]}`)}</b>
              <em>${t(`pet.slot.${s}`)}</em>
            </span>`,
          )}
        </div>`
      : html`<p class="shop-mood">${t('pet.homeBare')}</p>`}
    <div class="home-foot">
      <span class="shop-tally">${t('pet.tally', { earned: coinNum(pet.earned), spent: coinNum(pet.spent), meals: pet.meals, breaks: pet.breaks ?? 0 })}</span>
      <!-- Công tắc tiếng đứng CẠNH công tắc tắt trò chơi, không đứng ở dải thông số hay ở
           thanh trên cùng. Cả hai là thiết lập của chính lớp trò chơi này, và cả hai đều là
           thứ người ta chỉnh đúng một lần rồi quên — chỗ của chúng là trong nhà, không phải
           trên đường đi của mắt.
           Nó nói ra trạng thái bằng CHỮ chứ không bằng một cái icon loa gạch chéo: một icon
           loa chỉ nói được bật hay tắt sau khi người ta học nó, mà cái công tắc này thì mỗi
           tháng bấm một lần. Mặc định là TẮT — xem lib/sound.js. -->
      <!-- aria-pressed phải là CHUỖI "true"/"false", không phải một trị boolean: hàm html
           nuốt mọi thứ falsy nên một trị false ra thuộc tính rỗng, mà thuộc tính rỗng thì
           trình đọc màn hình coi như không khai — tức cái công tắc mất luôn phần nói ra nó
           đang bật hay tắt. Đã kiểm trên DOM thật.
           Chữ trần, không quote: backtick trong comment HTML nằm trong template literal sẽ
           ĐÓNG LUÔN chuỗi — CLAUDE.md điều 3. Đã lọt lần thứ ba ở đúng dòng này. -->
      <button type="button" class="btn ghost" data-sound="${sound ? 'off' : 'on'}"
        aria-pressed="${sound ? 'true' : 'false'}">${t(sound ? 'pet.soundOn' : 'pet.soundOff')}</button>
      <button type="button" class="btn ghost" data-pet-toggle="off" ${busy === 'toggle' ? 'disabled' : ''}>${t('pet.turnOff')}</button>
    </div>
  </section>`;
}

/* ── Quán ăn và tiệm trang trí ────────────────────────────────────────────────── */

/**
 * BỆ ĐẶT MÓN, và nó tự co hình lại cho vừa.
 *
 * Cả lý lẽ nằm ở `artFit` bên `lib/pet.js`. Ở đây chỉ có mấy con số chỗ thật, và chúng là
 * chỗ thật ĐO ĐƯỢC chứ không ướm:
 *
 * - `BOX_TALL` 92×56 — lưới trang trí. Ô lưới hẹp nhất là 112px (`auto-fill minmax`), trừ
 *   18px đệm hai bên và 2px viền còn 92; chiều cao 62px trừ 4px đệm đáy trừ 2px viền còn 56.
 * - `BOX_FOOD` 92×40 — lưới đồ ăn, cùng bề rộng, bệ thấp hơn (46px).
 * - `BOX_PICK` 70×38 — cái khay chọn món, bệ khai cứng 72×42.
 * - `BOX_SHELF` 78×26 — dải thẻ chọn khe; bệ 28px cao, không viền.
 *
 * Bốn con số thay cho `scale(0.5)` cứng của cái thẻ khe: một hệ số cố định đúng cho đúng cái
 * sprite cao nhất tại lúc gõ nó, và sai ngay ở lần sprite ấy đổi — đã sai một lần ở lượt 20,
 * khi con hạc cao lên 52px và cái mào bị xén.
 */
const BOX_TALL = [92, 56];
const BOX_FOOD = [92, 40];
const BOX_PICK = [70, 38];
const BOX_SHELF = [78, 26];

/**
 * Một món trên bệ: hình cộng đúng một biến CSS nói nó phải co bao nhiêu.
 *
 * Mặt đồng hồ đi lối khác, và lối ấy phải nằm ở ĐÂY chứ không ở ba chỗ gọi: ô hàng, thẻ khe
 * và tủ đồ trong nhà đều bày món bằng hàm này, nên một câu if ở mỗi chỗ là ba chỗ để quên.
 * Mấy cái mặt ấy không có sprite và sẽ không bao giờ có — thứ chúng bán là vỏ của một con số
 * do CSS dựng — nên bản xem trước phải là CHÍNH cái huy hiệu, dựng bằng đúng hàm popover
 * dùng. Bịa một hình đồng hồ nhỏ cho ô hàng là bán một thứ người mua sẽ không nhận được.
 */
const artOn = (cls, id, [w, h], eat = null) =>
  id && pet.items?.[id]?.face
    ? html`<span class="${cls} face-demo">${satChip(pet, `sat-${id}`)}</span>`
    : html`<span class="${cls}" style="--fit:${artFit(id, w, h)}">${id ? itemArt(id, eat) : ''}</span>`;

/**
 * Một ô đồ ăn — CHỌN, không phải mua. Cú bấm thứ hai nằm dưới khay (xem `foodTray`).
 *
 * Thiếu tiền thì vẫn bấm được, chỉ nói rõ là thiếu — chặn cứng cú bấm thì người ta không
 * biết mình còn thiếu bao nhiêu. Đang bận thì NGƯỢC LẠI: khoá hẳn. Hai ca ấy khác nhau ở
 * chỗ câu trả lời nằm đâu — "còn thiếu 3 xu" là một con số chỉ cú bấm mới nói ra được, còn
 * "đang ăn dở" thì cái dải ngay trên đầu màn hình đã bày sẵn cả món lẫn đồng hồ đếm ngược.
 * Mời bấm để nghe lại một câu đang hiện là mời bấm cho vui.
 */
function foodTile(id, item, busyNow) {
  const poor = pet.coins < item.price;
  // `disabled` chứ không phải bỏ `data-pick` đi: nút đã disabled thì trình duyệt không
  // phát sự kiện click nào cả, nên cái nghe uỷ quyền ở trên không cần biết chuyện này.
  return html`<button type="button" class="shop-item ${poor ? 'poor' : ''} ${pick === id ? 'trying' : ''}"
    data-pick="${id}" ${busy === id || busyNow ? 'disabled' : ''}
    title="${busyNow ? t('pet.oneAtATime') : poor ? t('pet.tooPoor', { n: coinNum(item.price - pet.coins) }) : ''}">
    ${artOn('shop-art', id, BOX_FOOD)}
    <span class="shop-name">${t(`pet.item.${id}`)}</span>
    <span class="shop-price">${price(item.price)}</span>
    <span class="shop-fill">${t('pet.fills', { pct: Math.round(item.fill * 100) })}</span>
    <!-- Ba món có dòng này. Nó phải hiện ra ở đây chứ không giấu trong tooltip: cái trần
         0,5 của mọi món bán là một lời hứa của cửa hàng — không mua được sự tỉnh táo trọn
         vẹn — và một lời hứa không đọc được trên chính bảng giá thì không phải lời hứa. -->
    ${item.wake ? html`<span class="shop-fill wake">${t('pet.wakes', { pct: Math.round(item.wake * 100) })}</span>` : ''}
  </button>`;
}

/**
 * Một ô đồ trang trí — MỘT cái nút, bốn trạng thái.
 *
 * Chưa mua thì nó là nút MẶC THỬ; mua rồi mà chưa bày thì nó là nút đổi sang; đang bày thì
 * nó là nút cất đi; đang thử thì nó là ô đang được chỉ tới, và cú bấm gỡ nó ra. Dựng bốn
 * cái nút riêng cho bốn trạng thái loại trừ nhau là bày ra ba cái nút chết trong mỗi ô, mà
 * một ô hàng rộng 112px thì không có chỗ cho ba thứ không bấm được. Đổi lại, chỗ nghe cú
 * bấm phải đọc `data-*` chứ không đọc class — xem `onClick`.
 *
 * ## Vì sao cú bấm đầu KHÔNG mua
 *
 * Từ lượt này thì quán ăn cũng hai thì (xem `foodTray`), nên vế "vì nó đắt" ở dưới không
 * còn là lý do riêng của tiệm trang trí. Cái quyết định một việc phải có hai thì không
 * phải GIÁ mà là **có lấy lại được không** — và chỗ này vẫn giữ một lý do riêng mà quán ăn
 * không có: cú bấm đầu ở đây còn VẼ RA thứ sắp mua.
 *
 * Một món trang trí là quyết định đắt nhất trong cả trò chơi — 320 xu là hơn ba trăm giờ
 * no, và nó không tiêu đi được: mua rồi thì mua rồi. Mà thứ duy nhất nói được nó đáng hay
 * không là NHÌN THẤY nó trên người quản gia, giữa mấy món đang bày, trong đúng cái khung
 * mà nó sẽ sống. Bảng giá cũ bán chúng bằng một ô hình 40px trên nền trắng và một cú bấm
 * ăn ngay — tức là bán một thứ người mua chưa từng thấy.
 *
 * Cái giá của hai thì này là một cú bấm thừa cho ai đã biết mình muốn gì. Rẻ hơn hẳn chiều
 * kia: một cú bấm nhầm ở đây không hoàn lại được.
 */
function decorTile(id, item) {
  const owned = pet.owned.includes(id);
  const worn = pet.worn?.[item.slot] === id;
  const poor = !owned && pet.coins < item.price;
  const on = tryOn === id;
  return html`<button type="button"
    class="shop-item ${owned ? 'owned' : ''} ${worn ? 'worn' : ''} ${poor ? 'poor' : ''} ${on ? 'trying' : ''}"
    ${owned
      ? html`data-wear-slot="${item.slot}" ${worn ? '' : html`data-wear="${id}"`}`
      : html`data-try-slot="${item.slot}" ${on ? '' : html`data-try="${id}"`}`}
    ${busy === (owned ? `wear:${item.slot}` : id) ? 'disabled' : ''}
    title="${poor ? t('pet.tooPoor', { n: coinNum(item.price - pet.coins) }) : ''}">
    ${artOn('shop-art', id, BOX_TALL)}
    <span class="shop-name">${t(`pet.item.${id}`)}</span>
    <span class="shop-price">${owned ? t(worn ? 'pet.wearOff' : 'pet.wear') : price(item.price)}</span>
    ${on ? html`<span class="rest-best">${t('pet.trying')}</span>` : ''}
  </button>`;
}

/**
 * Bàn thử đồ — bức tranh thật, và cái nút mua đứng ngay dưới nó.
 *
 * Nút mua ở ĐÂY chứ không ở trong ô hàng, và đó là chỗ quan trọng nhất của cả khối: lúc
 * quyết thì mắt đang ở trên bức tranh, mà ô hàng thì có thể đang nằm cách đó nửa màn hình
 * (bảy khe, ngót bốn chục món). Bắt người ta nhìn ở một chỗ rồi bấm ở một chỗ khác là mời họ
 * cuộn lên cuộn xuống để kiểm lại xem mình đang chọn đúng cái nào.
 *
 * Chưa thử gì thì khung vẫn đứng đó với bộ đồ đang bày — không phải một ô trống chờ bấm.
 * Nó là cái duy nhất trên màn Cửa hàng trả lời được câu "tôi đang trông thế nào", và câu ấy
 * không cần ai bấm gì mới đáng trả lời.
 */
function tryDesk() {
  const worn = { ...(pet.worn ?? {}) };
  const item = tryOn ? pet.items[tryOn] : null;
  if (item) worn[item.slot] = tryOn;
  const poor = item && pet.coins < item.price;
  return html`<div class="shop-try">
    ${dressArt(worn, pet)}
    <div class="try-side">
      ${item
        ? html`<p class="try-on">${t('pet.tryOn', { name: t(`pet.item.${tryOn}`), slot: t(`pet.slot.${item.slot}`) })}</p>
            <div class="try-act">
              <button type="button" class="btn go" data-buy="${tryOn}" ${busy === tryOn || poor ? 'disabled' : ''}>
                ${t('pet.tryBuy', { n: coinNum(item.price) })}
              </button>
              <button type="button" class="btn ghost" data-try-slot="${item.slot}">${t('pet.tryOff')}</button>
            </div>
            ${poor ? html`<p class="try-poor">${t('pet.tooPoor', { n: coinNum(item.price - pet.coins) })}</p>` : ''}`
        : html`<p class="try-hint">${t('pet.tryHint')}</p>`}
    </div>
  </div>`;
}

/**
 * KHAY — thì thứ hai của việc mua đồ ăn, và là chỗ duy nhất trên màn này tiêu được tiền.
 *
 * ## Vì sao nó đứng TRÊN cái lưới chứ không dưới
 *
 * Lưới đồ ăn có chín ô và nó cao hơn một màn hình ở khung hẹp. Đặt khay ở dưới thì bấm một
 * món ở hàng đầu là câu xác nhận mọc ra ngoài tầm mắt — người ta bấm, không thấy gì đổi, và
 * bấm lại. Cú bấm thứ hai ấy rơi vào cùng cái ô, tức nó BỎ CHỌN, và màn hình vẫn không nói
 * gì. Đúng cái bẫy "bấm mãi không ăn" mà cả chỗ này sinh ra để tránh.
 *
 * Trên đầu thì nó ở đúng chỗ mắt vừa rời đi, ngay dưới tiêu đề, và nó KHÔNG BAO GIỜ biến
 * mất — chưa chọn gì thì nó là một dòng nhắc. Một khối chỉ hiện lúc có việc là một khối
 * đẩy cả cái lưới xuống 60px mỗi lần bấm, và cái lưới nhảy thì cú bấm tiếp theo rơi vào ô
 * khác với ô mắt đang nhắm.
 *
 * ## Nó phải nói ba con số, không phải một
 *
 * Giá thì ô hàng đã nói. Khay nói thêm hai thứ mà ô hàng không nói được: **ví còn lại bao
 * nhiêu sau khi trả**, và **thanh no sẽ lên tới đâu** — hai câu trả lời cho đúng câu hỏi
 * mà một người đang cân nhắc đang hỏi. Trần 100% là thật chứ không phải phép làm tròn cho
 * đẹp: `buy()` bên server kẹp `clamp01(full + fill)`, nên mua một bát phở lúc đang no 80%
 * là trả trọn tiền cho 20% — và chỗ duy nhất nói ra được điều đó trước khi trả tiền là ở
 * đây.
 */
function foodTray(busyNow) {
  const item = pick ? pet.items[pick] : null;
  if (!item || item.kind !== 'food') return html`<div class="shop-pick"><p class="try-hint">${t('pet.pickHint')}</p></div>`;
  const poor = pet.coins < item.price;
  const to = Math.round(Math.min(1, pet.full + item.fill) * 100);
  return html`<div class="shop-pick on">
    ${artOn('shop-art', pick, BOX_PICK)}
    <div class="pick-side">
      <p class="pick-on">${t('pet.pickOn', { name: t(`pet.item.${pick}`), pct: to })}</p>
      <div class="try-act">
        <button type="button" class="btn go" data-buy="${pick}" ${busy === pick || poor || busyNow ? 'disabled' : ''}>
          ${t('pet.pickBuy', { n: coinNum(item.price) })}
        </button>
        <button type="button" class="btn ghost" data-pick-off>${t('pet.pickOff')}</button>
      </div>
      ${poor
        ? html`<p class="try-poor">${t('pet.tooPoor', { n: coinNum(item.price - pet.coins) })}</p>`
        : html`<p class="pick-left">${t('pet.pickLeft', { n: coinNum(Math.max(0, pet.coins - item.price)) })}</p>`}
    </div>
  </div>`;
}

function foodSec() {
  const busyNow = Boolean(doingNow());
  return html`<section class="shop-sec">
    <p class="shop-hint">${t('pet.feedHint')}</p>
    ${foodTray(busyNow)}
    <div class="shop-grid">${idsOf((i) => i.kind === 'food').map((id) => foodTile(id, pet.items[id], busyNow))}</div>
  </section>`;
}

/**
 * Đồ trang trí, chia theo CHỖ ĐỨNG chứ không đổ chung một lưới.
 *
 * Từ lúc nhiều món chung một chỗ thì "mua thêm" và "đổi món" là hai việc khác nhau, và
 * một lưới phẳng hai mươi hai ô không nói được cái nào loại trừ cái nào — mua cái vương miện
 * xong thấy cái nón chóp lặng lẽ biến khỏi popover là một chuyện không giải thích được ở
 * bất kỳ chỗ nào trên màn hình. Gom theo khe thì luật ấy đọc ra từ chính bố cục: mấy món
 * đứng chung một tiêu đề, tiêu đề nói đang bày món nào.
 *
 * Thứ tự khe do SERVER định (`SLOTS`), không do file này — nó là thứ tự trong bức tranh
 * (trên đầu trước, nền trời sau), và bức tranh thì server cũng là chỗ giữ bảng chỗ đứng.
 *
 * ## Lượt này: sáu lưới cùng mở → MỘT lưới, và năm cái cửa
 *
 * Cả lý lẽ nằm ở `shelf`. Ba chỗ đáng ghi ở phần dựng:
 *
 * 1. **Dải thẻ đứng NGAY TRÊN cái lưới nó điều khiển**, không ở đầu khối và không dưới bức
 *    tranh thử đồ. Một cái điều khiển đặt xa thứ nó điều khiển thì cú bấm không có phản hồi
 *    trong tầm mắt — đúng cái bẫy mà cái khay đồ ăn đã phải dời lên trên để tránh.
 * 2. **Bức tranh thử đồ giữ nguyên chỗ cũ**, trên cùng. Nút MUA nằm trong nó (xem `tryDesk`),
 *    và dời chỗ một cái nút mua để lấy chỗ cho một cái điều khiển mới là đổi một thói quen
 *    đã có lấy một tính năng chưa ai dùng.
 * 3. **Mỗi thẻ chở BA tin, không phải một cái tên**: món đang bày ở khe ấy (bằng hình), tên
 *    khe, và số món đã có trên tổng số. Tin thứ ba là tin mà bản cũ không nói ở đâu cả — với
 *    sáu lưới cùng mở thì người ta tự đếm được, với một lưới thì không. Đóng bớt năm cái cửa
 *    mà không trả lại con số ấy là giấu thông tin, không phải dọn gọn.
 */
/** `open` truyền vào chứ không đọc thẳng `shelf`: `shelf` có thể là `null` (lượt đầu) hoặc là
 *  một khe server vừa bỏ đi, và trong cả hai ca ấy `decorSec` đã chọn một khe thay thế. Đọc
 *  lại `shelf` ở đây là dựng bản thứ hai của cùng một quyết định, và bản thứ hai sẽ ra một
 *  dải sáu thẻ không thẻ nào sáng lên trong khi lưới bên dưới đang mở một khe. */
function shelfTab(slot, open) {
  const ids = idsOf((i) => i.slot === slot);
  const own = ids.filter((id) => pet.owned.includes(id)).length;
  const on = pet.worn?.[slot];
  return html`<button type="button" class="shelf-tab ${slot === open ? 'on' : ''}"
    data-shelf="${slot}" aria-pressed="${slot === open}"
    title="${t('pet.shelfOwn', { own, all: ids.length })}">
    <!-- Ô hình giữ chỗ KỂ CẢ khi khe đang trống, và đó không phải chỗ quên: mấy cái thẻ cao
         bằng nhau thì cả dải là một hàng, còn cao thấp so le thì nó đọc thành một nắm nút
         rời. Chỗ trống ấy cũng chính là thứ nói khe này chưa có gì.
         Chữ trần, không quote: backtick trong comment HTML nằm trong template literal sẽ
         ĐÓNG LUÔN chuỗi — CLAUDE.md điều 3. -->
    ${artOn('shelf-art', on, BOX_SHELF)}
    <b>${t(`pet.slot.${slot}`)}</b>
    <i>${own}/${ids.length}</i>
  </button>`;
}

function decorSec() {
  const slots = (pet.slots ?? []).filter((s) => idsOf((i) => i.slot === s).length);
  // Khe đang mở phải LUÔN là một khe có thật: `shelf` sống qua nhịp vẽ lại 30 giây, mà bảng
  // hàng hoá đến từ server và có thể đổi giữa hai nhịp ấy. Rơi về khe đầu chứ không rơi về
  // một lưới rỗng — cùng luật "hỏng về phía im lặng" đã ghi cho mặt kính laptop.
  const open = slots.includes(shelf) ? shelf : slots[0];
  const ids = open ? idsOf((i) => i.slot === open) : [];
  const worn = open ? pet.worn?.[open] : null;
  return html`<section class="shop-sec">
    <p class="shop-hint">${t('pet.decorHint')}</p>
    ${tryDesk()}
    <!-- Số cột gửi sang bằng BIẾN, đếm từ bảng khe của server. Viết cứng 6 vào CSS thì ngày
         server thêm khe thứ bảy là ô ấy rơi xuống dòng hai, im lặng — cùng hạng lỗi đã bắt
         TOWN_BOX phải bỏ ba con số viết cứng.
         Chữ trần, không quote: backtick trong comment HTML nằm trong template literal sẽ
         ĐÓNG LUÔN chuỗi — CLAUDE.md điều 3. -->
    <div class="shop-shelves" style="--shelves:${slots.length}">${slots.map((s) => shelfTab(s, open))}</div>
    ${open
      ? html`<div class="shop-slot">
          <h3>${t(`pet.slot.${open}`)} <em>${worn ? t(`pet.item.${worn}`) : t('pet.slotEmpty')}</em></h3>
          <!-- tall chỉ ở lưới TRANG TRÍ, không ở lưới đồ ăn. Bệ đặt món cao 62px vì con hạc
               cao 52px (xem shop-art trong styles.css), mà món ăn cao nhất chỉ 28px — nới
               chung thì mỗi ô đồ ăn có 29px trời trống phía trên một cái cốc, và cả lưới đọc
               thành "hình chưa tải xong". Đã thấy trên màn hình một lần, ở đúng bản nới chung.
               Chữ trần, không quote: backtick trong comment HTML nằm trong template literal sẽ
               ĐÓNG LUÔN chuỗi — CLAUDE.md điều 3, và lượt 20 lọt lại đúng vào nó một lần nữa,
               cách dòng cảnh báo ngay trên đúng bốn mươi dòng. -->
          <div class="shop-grid tall">${ids.map((id) => decorTile(id, pet.items[id]))}</div>
        </div>`
      : ''}
  </section>`;
}

/* ── Công viên ────────────────────────────────────────────────────────────────── */

/**
 * Một động tác nghỉ, bày thành Ô HÀNG — cùng khuôn với một món ăn, và đó là điểm.
 *
 * Bản trước chúng là mấy tấm thẻ chữ ở một khối riêng, và cái chữ "miễn phí" nằm trên tiêu
 * đề khối. Nhìn thật thì hai bên không so được với nhau: một ly cà phê có hình, có giá, có
 * dòng "+40% tập trung", còn "đứng dậy đi lại" chỉ có chữ — nên cái rẻ hơn và tốt hơn lại
 * là cái trông sơ sài hơn. Cho chúng đúng cỡ ô, đúng chỗ đặt giá và đúng dòng "được bao
 * nhiêu" thì phép so mới thành thật, và lúc ấy nó tự nói: cùng một thanh tập trung, một bên
 * lấy 1,85 xu để kéo 40%, một bên lấy 0 xu để về đầy.
 *
 * Chỗ khác duy nhất còn lại là THỜI GIAN — và nó phải hiện ra to bằng giá, vì đó chính là
 * cái giá thật của mấy món này. Ba tới năm phút rời máy đắt hơn hai xu, và cửa hàng không
 * được giả vờ ngược lại.
 *
 * Câu bằng chứng vẫn nằm TRONG ô chứ không rút vào tooltip. Nó là điều kiện để một động
 * tác được đứng ở đây (xem `MOVES` trong `petmath.js`), và một điều kiện chỉ đọc được khi
 * rê chuột thì nó không có trên trang.
 */
function moveTile(id, mv, best, busyNow) {
  return html`<button type="button" class="shop-item free ${id === best ? 'best' : ''}"
    data-move="${id}" ${busy === 'break' || busyNow ? 'disabled' : ''}
    title="${busyNow ? t('pet.oneAtATime') : ''}">
    <span class="shop-art">${moveArt(id)}</span>
    <span class="shop-name">${t(`pet.move.${id}`)}</span>
    <span class="shop-price free">${t('pet.free')}</span>
    <!-- Ô hàng miễn phí và ô cà phê giờ nói CÙNG một câu, và đó là toàn bộ điểm của khối
         này: cùng đơn vị thì mới so được. Chỉ hai động tác ngoài trời còn nói "về đầy", vì
         chỉ hai cái ấy gỡ trọn chu kỳ — xem back trong MOVES.
         Chữ trần, không quote: backtick trong comment HTML nằm trong template literal sẽ
         ĐÓNG LUÔN chuỗi — CLAUDE.md điều 3. -->
    <span class="shop-fill wake">${wakeOf(mv) >= 1 ? t('pet.wakesFull') : t('pet.wakes', { pct: Math.round(wakeOf(mv) * 100) })}</span>
    <span class="shop-fill cost">${t('pet.moveMin', { n: Math.round(mv.ms / 60000) })}</span>
    <span class="shop-why">${t(`pet.move.${id}.why`)}</span>
    ${id === best ? html`<span class="rest-best">${t('pet.moveBest')}</span>` : ''}
  </button>`;
}

/**
 * Công viên — năm động tác nghỉ, và nó là chỗ DUY NHẤT trong thị trấn không phải cửa hàng.
 *
 * Bản trước khối này đứng trên đầu trang, trên cả hai khối hàng hoá, và lý do vẫn nguyên:
 * đường rẻ nhất về lại trạng thái tỉnh táo không đi qua cái ví. Trên bản đồ thì câu ấy nói
 * bằng chỗ đứng — một mảng cỏ có cây và ghế đá, không có mái, không có cửa, không có giá.
 *
 * Server bản cũ không gửi `moves` thì nói thẳng ra là chưa có, chứ không bày một khung
 * rỗng: đây là một khối được bấm vào để mở, nên nó không được mở ra rồi trống trơn.
 */
/** Chỗ nào bày động tác nào — đọc `where` từ bảng SERVER gửi sang, không từ hằng số nhập
 *  vào file này. Server bản cũ không có trường ấy thì cả năm động tác rơi về công viên,
 *  đúng chỗ chúng vẫn luôn ở, chứ không rơi mất khỏi màn hình. */
const movesAt = (where) => Object.keys(pet.moves ?? {}).filter((k) => (pet.moves[k].where ?? 'park') === where);

/**
 * Lưới động tác nghỉ của một chỗ, kèm kết quả quãng vừa chốt.
 *
 * Kết quả hiện ở đúng chỗ vừa bấm, không hiện ở cả hai: nó là câu trả lời cho một cú bấm,
 * và một câu trả lời lặp lại ở một khối người ta không bấm là một câu trả lời đi lạc. Server
 * tự cho nó hết hạn sau hai phút (xem `BREAK_RESULT_MS`) nên chỗ này không cần hẹn giờ nào.
 *
 * Danh sách lấy từ SERVER (`pet.moves`), y như bảng hàng hoá lấy `pet.items`. Hai bên hôm
 * nay chung một module nên chúng không lệch được, nhưng lấy bản của mình thì cái ngày server
 * đổi bảng, chỗ này đọc `ms` của một mã không tồn tại và ném giữa lượt vẽ.
 */
function moveSec(where) {
  const ids = movesAt(where);
  if (!ids.length) return '';
  const best = moveForHour(new Date().getHours());
  const busyNow = Boolean(doingNow());
  const lb = pet.lastBreak;
  const mine = lb && (pet.moves[lb.kind]?.where ?? 'park') === where;
  // Câu chốt phải nói ĐÚNG con số động tác ấy vừa gỡ ra, không nói một câu chung. Từ lúc ba
  // bậc tồn tại thì "tính rồi" mà không kèm số là câu duy nhất trên màn hình còn giả vờ cả
  // năm động tác như nhau — và nó lại đứng ở đúng chỗ người ta vừa bấm để biết mình được gì.
  const got = mine ? wakeOf(pet.moves[lb.kind]) : 0;
  return html`<div class="shop-moves">
    <h3>${t(`pet.secFree.${where}`)}</h3>
    <p class="shop-hint">${t(`pet.freeHint.${where}`)}</p>
    ${mine
      ? html`<p class="shop-verdict ${lb.ok ? 'ok' : 'no'}">
          ${lb.ok ? t(got >= 1 ? 'pet.breakOkFull' : 'pet.breakOk', { pct: Math.round(got * 100) }) : t('pet.breakBusy')}
        </p>`
      : ''}
    <div class="shop-grid wide">${ids.map((k) => moveTile(k, pet.moves[k], best, busyNow))}</div>
  </div>`;
}

function restSec() {
  if (!pet.moves) return empty('◇', t('pet.noMoves'));
  return html`<section class="shop-sec shop-rest">
    <p class="shop-hint">${t('pet.parkHint')}</p>
    ${moveSec('park')}
  </section>`;
}

/* ── Thư viện ─────────────────────────────────────────────────────────────────── */

/**
 * Mười khối. Khối nào có CÔNG THỨC là khối nói về một con số đang hiện trên màn hình; khối
 * không có công thức là một quyết định — nó không có phép tính, nó có lý do.
 *
 * Thứ tự đi theo THỨ TỰ NGƯỜI TA HỎI, không theo thứ tự viết ra. Hai khối cuối lượt 9/8
 * chen vào giữa vì chúng trả lời đúng hai câu hỏi mà người dùng phải đi hỏi người khác mới
 * có: *"ngồi lâu thế mà sao tập trung không tụt?"* (`rest`, đứng ngay dưới chính cái công
 * thức tập trung mà nó là ngoại lệ) và *"'Đang vào nhịp' với 'Ổn' là sao?"* (`state`, đứng
 * ngay sau đó, vì cái tên chỉ có nghĩa khi thấy được cả thang).
 *
 * `tbl` là một khối vẽ THÊM, chèn giữa công thức và đoạn văn — dành cho thứ mà một đoạn văn
 * không nói được: bốn cái tên với bốn khoảng số thì phải bày thành bảng, kể lại bằng câu
 * chữ là bắt người đọc tự dựng lại cái bảng ấy trong đầu.
 */
const HOW = [
  { k: 'coin', f: true },
  { k: 'full', f: true },
  { k: 'focus', f: true },
  { k: 'rest', f: true },
  { k: 'state', f: false, tbl: stateTable },
  { k: 'price', f: true },
  { k: 'dip', f: false },
  { k: 'wake', f: false },
  { k: 'eat', f: false },
  { k: 'no', f: false },
];

/**
 * Nguồn — tên và địa chỉ, KHÔNG dịch.
 *
 * Đây là tên riêng của mấy bài báo, và dịch tên một bài báo là làm nó khó tìm hơn chứ
 * không dễ đọc hơn. Cũng vì thế chúng không nằm trong bảng chuỗi: một khoá i18n có cùng
 * nội dung ở cả hai ngôn ngữ là một khoá chờ ai đó dịch nhầm.
 */
const SRC = [
  ['Kleitman 1963 · basic rest–activity cycle', 'https://en.wikipedia.org/wiki/Basic_rest%E2%80%93activity_cycle'],
  ['Ultradian rhythms in task performance · PubMed 7870505', 'https://pubmed.ncbi.nlm.nih.gov/7870505/'],
  ['20-20-20: are these numbers justified? · PubMed 36473088', 'https://pubmed.ncbi.nlm.nih.gov/36473088/'],
  ['Breaking up sitting & cognition · PMC7955618', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7955618/'],
  ['Bright light vs the post-lunch dip · PMC8215386', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8215386/'],
];

/**
 * Thư viện — chỗ DUY NHẤT nói ra mọi con số của trò chơi này đến từ đâu.
 *
 * Nó phải tồn tại vì lớp chỉ số sức khoẻ có một thứ mà ví xu và cơn đói không có: nó đưa
 * ra LỜI KHUYÊN. Một cái thanh nói "đứng dậy đi" mà không nói được vì sao 90 phút chứ
 * không phải 50, và vì sao không phải luật 20-20-20 mà ai cũng nhắc, thì nó là một mẹo sức
 * khoẻ trên mạng có thêm hoạt hình — đúng thứ mà chốt `d-game` đã gỡ một lần.
 *
 * Trước 5/8 nó là một khối `<details>` gập ở chân trang, gập lại vì bung sẵn thì bảy khối
 * chữ đẩy cửa hàng xuống dưới mép màn hình. Trên bản đồ thì không cần cái gập ấy nữa: nó
 * có nhà riêng, và người ta chỉ vào khi muốn đọc.
 */
function howSec() {
  // Tỉ giá đọc từ SỔ, không viết cứng trong bảng chữ: nó là con số đang thật sự tính tiền
  // trong `priceOf` bên server, và một bản chép ở đây là bản sẽ nói dối sau lần chỉnh giá
  // đầu tiên. Server bản cũ không gửi thì rơi về 1, đúng giá trị nó vẫn luôn là.
  // `m` đi cùng nó và cùng một luật: mốc "im bao lâu thì coi như đã nghỉ" là `BREAK_MS` bên
  // `petmath.js`, và một con số 10 gõ tay vào bảng chữ là con số sẽ ở lại sau lần nới mốc.
  const vars = { n: coinNum(pet.coinPerHour ?? 1), m: Math.round(BREAK_MS / 60000) };
  // Tiêu đề là TÊN CHỖ, không phải tên nội dung — cùng luật với bốn khối kia, và từ lượt
  // này nó là một luật có hình: tấm biển của khối mượn đúng cặp sắc của tấm biển đang sáng
  // trên bản đồ, nên nó chỉ nói đúng nếu hai chỗ cùng một chữ. Câu "cách tính mấy con số
  // này" xuống dòng dẫn ngay dưới, chỗ nó vẫn luôn thuộc về.
  return html`<section class="shop-sec shop-how">
    <p class="shop-hint"><b>${t('pet.how')}</b> — ${t('pet.howHint')}</p>
    ${HOW.map(
      (h) => html`<div class="how-row">
        <h3>${t(`pet.how.${h.k}.t`)}</h3>
        ${h.f ? html`<code>${t(`pet.how.${h.k}.f`, vars)}</code>` : ''}
        ${h.tbl ? h.tbl() : ''}
        <p>${t(`pet.how.${h.k}.p`, vars)}</p>
      </div>`,
    )}
    <p class="how-src">
      <b>${t('pet.howSrc')}</b>
      ${SRC.map(([name, url]) => html`<a href="${url}" target="_blank" rel="noreferrer noopener">${name}</a>`)}
    </p>
  </section>`;
}

/** Chỗ nào mở khối nào. Bảng chứ không phải một chuỗi `if`: `PLACES` bên `town.js` là nơi
 *  quyết định thị trấn có mấy chỗ, và một chỗ thêm vào đấy mà quên ở đây thì bảng này
 *  trống một khoá — thấy ngay, thay vì lặng lẽ rơi vào nhánh cuối. */
const PANEL = { home: homeSec, food: foodSec, decor: decorSec, park: restSec, library: howSec };

/**
 * Nhịp một giây — sống khi có VIỆC đang chạy, hoặc khi có ĐOẠN HỒI đang bò.
 *
 * Không phải `setInterval` ở tầng module: một cái nhịp chạy nền cho một màn không ai xem
 * là đúng thứ mà `STALE_MS` bên trên đã tránh. Hẹn từng nhịp một, và nhịp sau chỉ được
 * đặt bởi lượt vẽ kế tiếp — nên rời sang màn khác là nó tự tắt sau đúng một nhịp thừa.
 *
 * ## Vì sao ĐOẠN HỒI phải là một điều kiện riêng
 *
 * Bản trước chỉ nhìn `pet.doing`, và hai khung giờ ấy KHÔNG trùng nhau. Bữa ăn thì đoạn
 * hồi chạy đúng trong lúc ăn, nên `doing` che được cho nó. Quãng nghỉ thì ngược hẳn: đoạn
 * hồi 20 giây bắt đầu đúng lúc quãng nghỉ KẾT THÚC (xem `REST_RAMP_MS`), tức lúc `doing`
 * vừa tắt. Kết quả là cái đồng hồ cát đáng lẽ bò ngược lên trong 20 giây thì đứng im rồi
 * nhảy một phát ở lượt hỏi kế — đúng cái lỗi mà `livePet` sinh ra để sửa, chỉ khác chỗ
 * hỏng: một bên thiếu phép tính, một bên thiếu nhịp gọi nó.
 *
 * `over` vì thế chỉ đúng cho VIỆC, không đúng cho đoạn hồi: hết giờ một quãng nghỉ thì
 * phía này KHÔNG tự kết luận đạt hay trượt (phép so `idleMs` chỉ server làm được), nó đi
 * hỏi lại, chậm hơn (2 giây) vì lúc này đang chờ một câu trả lời chứ không đang đếm. Còn
 * một đoạn hồi đang bò thì chẳng phải chờ ai — nó tính được tại chỗ, nên nhịp một giây.
 *
 * Chạy kể cả khi đang đứng ở chỗ khác trong thị trấn: cả bữa ăn lẫn quãng nghỉ đều được
 * chốt ở SERVER, và bỏ nhịp đi khi rời công viên thì một quãng nghỉ vừa xong sẽ không ai
 * chốt cho tới lượt quét sau — mà lúc ấy mọi nút mua vẫn đang khoá.
 */
function beat() {
  if (tick) {
    clearTimeout(tick);
    tick = null;
  }
  const rising = Boolean(pet?.ramp) && rampAt(pet.ramp, Date.now()) < 1;
  if (!pet?.doing && !rising) return;
  const over = Boolean(pet?.doing) && !doingNow();
  if (over && !busy && Date.now() - askedAt > 1500) call(null);
  tick = setTimeout(() => {
    tick = null;
    redraw();
  }, over ? 2000 : 1000);
}

export function renderPet() {
  // Hỏi lại sổ NGAY TRONG lượt vẽ, và chỉ khi màn này đang mở — `renderPet` không được
  // gọi ở màn khác, nên đây là cái hẹn giờ rẻ nhất có thể: không có `setInterval` nào
  // chạy nền cho một màn không ai xem.
  //
  // Không thành vòng lặp: `call` cập nhật `askedAt` TRƯỚC khi đi, rồi `redraw` gọi lại
  // hàm này, và lúc đó phép so tuổi đã sai nên không có lượt hỏi thứ hai.
  if (!busy && Date.now() - askedAt > STALE_MS) call(null);
  beat();
  if (!pet) return empty('◈', t('pet.loading'));
  // Vặn sổ về ĐÚNG GIÂY NÀY trước khi vẽ bất cứ thứ gì. Không phải một phép làm mượt:
  // `pet.full` do server gửi là con số của lúc GỬI, và giữa hai lượt hỏi cách nhau 30 giây
  // thì suốt một phút ăn cái thanh chỉ nhích đúng hai lần. Xem `livePet`.
  //
  // Gán đè lên chính biến module chứ không dựng một bản cạnh nó: mười mấy hàm dưới đây đọc
  // `pet` trực tiếp, và một bản "đã vặn" chỉ vài chỗ dùng là mời hai con số khác nhau cùng
  // xuất hiện trên một màn hình. An toàn vì `livePet` thuần và chỉ suy từ ba cái mốc mà nó
  // không đụng vào — gọi lại lượt sau vẫn ra đúng con số của lượt sau.
  pet = livePet(pet);

  if (!pet.on) {
    return html`<div class="shop">
      ${empty('◇', t('pet.off'), t('pet.offNote'))}
      <div class="shop-foot">
        <button type="button" class="btn" data-pet-toggle="on" ${busy === 'toggle' ? 'disabled' : ''}>${t('pet.turnOn')}</button>
      </div>
    </div>`;
  }

  // Tiêu cái nảy ngay trong lượt vẽ. Hoạt hình chạy trên một thẻ vừa dựng nên nó tự diễn
  // đúng một lần; không xoá thì nhịp vẽ lại 30 giây kế tiếp diễn lại một khoản đã cũ.
  const up = bump;
  bump = 0;
  // Cùng luật, cùng lý do — xem `arriving`.
  const came = arriving;
  arriving = false;
  // Kẹp ở ĐÂY, trước cả `townShell`: chỗ đứng là một biến sống qua nhiều lượt vẽ, và một mã
  // lạ (bản cũ còn trong bộ nhớ sau một lượt sửa `PLACES`) phải rơi về Nhà ở cả bản đồ lẫn
  // khối bên dưới. Kẹp riêng ở chỗ chọn khối thì bản đồ không sáng chỗ nào cả.
  if (!PLACE_IDS.includes(place)) place = 'home';

  // `--now` khoá pha hoạt hình vào đồng hồ tường — cùng con số, cùng lý do như ở khung trời
  // popover (xem `lifeClock` bên `lib/pet.js`). Cửa hàng cần nó không kém: nó vẽ lại mỗi 30
  // giây theo nhịp SSE, và mỗi lượt là một lần `innerHTML` mới.
  return html`<div class="shop" style="${TOWN_VARS};${lifeClock()}">
    <!-- MỘT cái khung: dải thông số, bản đồ, dải nhắc. Xem townShell.
         Chữ trần, không quote: backtick trong comment HTML nằm trong template literal sẽ
         ĐÓNG LUÔN chuỗi — CLAUDE.md điều 3, lọt thêm một lần nữa ở đúng chỗ này.

         Thứ tự đọc giờ là đúng thứ tự dùng, và đó là chỗ đổi của lượt này: liếc ba con số,
         nhìn thị trấn, bấm vào một chỗ — rồi CÂU TRẢ LỜI nằm ngay dưới ngón tay vừa bấm.
         Bản 5/8 xếp đúng ba thứ đầu nhưng để 139px thông số và chữ chen vào giữa cú bấm và
         câu trả lời, trong một khung cuộn cao 708px. Hậu quả đo được: khối trả lời bắt đầu
         ở 705px, tức ba pixel của nó nằm trong tầm mắt. -->
    ${townShell(up)}

    ${err ? html`<p class="shop-err">${err}</p>` : ''}

    <!-- Dải "đang làm" ở LẠI đây, giữa khung và cửa hàng, và nó là thứ duy nhất còn được
         phép đứng ở chỗ này. Lý do ở doingStrip: nó khoá mọi nút mua trên cả màn hình,
         nên nó phải nằm trên đường mắt đi tới mấy cái nút ấy. Nó cũng chỉ tồn tại trong
         đúng một phút mỗi lần, khác hẳn ba thứ vừa dọn đi — chúng có mặt ở mọi lượt vẽ. -->
    ${doingStrip()}

    <!-- Cái khối trả lời, và từ lượt này nó là một VẬT có khung.
         Trước đây nó là chữ trần đặt thẳng lên nền trang, nên đổi từ Nhà sang Thư viện chỉ
         là chữ đổi thành chữ khác — không có gì nói rằng vừa có một thứ MỚI mở ra. Một cái
         thẻ có nền, có viền, có tấm biển cùng cặp sắc với biển trên bản đồ thì nó tự nói:
         đây là cái ngăn vừa kéo ra từ chỗ vừa bấm. -->
    <div class="shop-panel ${came ? 'came' : ''}">
      <!-- TẤM BIỂN vẽ ở ĐÂY, một chỗ duy nhất, và nó lấy tên bằng đúng cái khoá mà tấm
           biển ngoài bản đồ đang lấy. Trước lượt này mỗi khối tự vẽ tiêu đề của mình — năm
           chỗ cùng viết ra một cái tên, và một trong năm đã lệch thật: khối Thư viện đề
           "Cách tính mấy con số này", tức bấm vào tấm biển Thư viện thì mở ra một khối
           mang tên khác. Một cái tên khai ở năm chỗ là một cái tên sẽ lệch. -->
      <h2>${t(`town.${place}`)}</h2>
      ${(PANEL[place] ?? homeSec)()}
    </div>

    <!-- Hai câu NGUỒN GỐC, gập lại sau một dòng bấm ra, và giờ nằm ở CHÂN TRANG.

         Trước 5/8 chúng là hai dòng chữ thường trực cao 33px ngay dưới dải thông số — hai
         dòng người ta đọc đúng một lần rồi thôi, vì chúng nói con số này tính từ đâu, mà
         mỗi lượt liếc chỉ hỏi hôm nay nó là bao nhiêu. Lượt này chúng đi nốt quãng còn
         lại: xuống dưới cửa hàng. Một dòng đọc một lần trong đời không được đứng giữa một
         cú bấm và hậu quả của nó.

         Nhưng chúng vẫn KHÔNG được rút vào một thuộc tính title, và đây không phải sự
         thiếu nhất quán với hai cái tooltip ở dải trên — nó là cùng một luật cho ra đáp án
         ngược: câu tỉ giá là chỗ DUY NHẤT nối đồng xu với hoá đơn thật, câu tập trung là
         chỗ DUY NHẤT nói ra chỉ số ấy đo bằng cách nào. Không cái hình nào trên màn suy ra
         được chúng. Mà tooltip thì không bấm được trên cảm ứng, không dừng lại cho ai đọc
         chậm, và nhiều trình đọc màn hình bỏ qua — giấu một con số vào đó là biến nó thành
         thứ không kiểm lại được, đúng cái làm thanh XP ngày trước thành một lời nói dối.

         Thẻ details khác tooltip ở đúng chỗ ấy: chữ vẫn nằm trong DOM, vẫn mở được bằng
         bàn phím, vẫn ở nguyên trên trang khi in — chỉ là thôi không tính tiền bằng chiều
         cao khi chưa có ai hỏi tới. -->
    <details class="hud-why" ${whyOpen ? 'open' : ''}>
      <summary>${t('pet.whyOpen')}</summary>
      <p>
        ${t('pet.rateNote')}${pet.since ? html` ${t('pet.since', { day: pet.since })}` : ''}
        ${typeof pet.focus === 'number' ? html` · ${t('pet.focusNote')}` : ''}
      </p>
    </details>
  </div>`;
}
