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

const root = document.getElementById('bench');
let state = null;

const draw = () => mount(root, renderBench(state));
initBench(draw);

const res = await fetch('/api/state');
state = await res.json();
draw();
