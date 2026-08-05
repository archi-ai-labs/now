/**
 * Trang lẻ của bàn chỉnh — vỏ mỏng, ruột nằm ở `views/bench.js`.
 *
 * Bàn chỉnh giờ là một màn trong dashboard (`#bench`). Trang này vẫn còn vì nó khác đúng
 * một chuyện: không thanh rail, không ô tìm kiếm, không quản gia ở cạnh — tức là chỗ duy
 * nhất nhìn popover mà trong tầm mắt không có gì khác. Với một cửa sổ 360pt sống hay chết
 * bằng tương phản và khoảng thở thì cái nền trống ấy có giá.
 *
 * Nó gọi ĐÚNG `renderBench` mà màn trong dashboard gọi, nên không có bản thứ hai để lệch.
 */
import { mount } from './lib/dom.js';
import { renderBench, initBench } from './views/bench.js';
import { initPet } from './views/pet.js';

const root = document.getElementById('bench');
let state = null;

const draw = () => mount(root, renderBench(state));
initBench(draw);
// Bàn chỉnh vẽ cả nhân vật, mà sổ của nó không nằm trong `/api/state`. Không gọi lượt hỏi
// ấy ở đây thì trang lẻ bày ra một popover THIẾU đúng phần vừa thêm — mà hai chỗ mở bàn
// chỉnh phải cho ra cùng một hình, nếu không thì lại có bản thứ hai để lệch.
initPet(draw);

const res = await fetch('/api/state');
state = await res.json();
draw();
