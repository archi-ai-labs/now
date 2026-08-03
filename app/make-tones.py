#!/usr/bin/env python3
"""Bóc năm màu trạng thái từ styles.css và sinh Tones.swift.

Thanh menu không phải trang web nên năm mã màu buộc phải có mặt hai lần. Chỗ này là
để lần thứ hai ấy không bao giờ do người gõ tay: nó đọc thẳng `public/styles.css` mỗi
lần dựng, và nếu bóc trượt thì DỪNG BUILD thay vì lặng lẽ dùng màu mặc định — một app
thanh menu tô sai bậc còn tệ hơn một app không tô màu, vì nó vẫn trông như đang biết.

Mỗi biến xuất hiện đúng hai lần trong file, theo thứ tự: `:root` (nền sáng) rồi
`[data-theme=dark]` (nền tối).
"""
import re
import sys

TONES = ["crit", "warn", "ok", "cheer", "later"]

css = open(sys.argv[1], encoding="utf-8").read()
out = {}
for name in TONES:
    hits = re.findall(rf"^\s*--{name}:\s*(#[0-9a-fA-F]{{6}})\s*;", css, re.M)
    if len(hits) != 2:
        sys.exit(f"make-tones: --{name} tìm thấy {len(hits)} lần, cần đúng 2 (sáng rồi tối)")
    out[name] = hits


def rgb(h):
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (1, 3, 5))
    return f"NSColor(srgbRed: {r:.4f}, green: {g:.4f}, blue: {b:.4f}, alpha: 1)"


lines = [
    "// SINH TỰ ĐỘNG bởi app/make-tones.py — đừng sửa tay, sửa public/styles.css.",
    "import AppKit",
    "",
    "enum Tones {",
    "    /// Một màu, hai bản: menu bar sáng hay tối là do appearance của hệ thống,",
    "    /// và NSColor tự chọn lại mỗi khi người dùng đổi — không cần vẽ lại chuỗi.",
    "    private static func dyn(_ l: NSColor, _ d: NSColor) -> NSColor {",
    "        NSColor(name: nil) { ap in ap.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? d : l }",
    "    }",
    "",
]
for name in TONES:
    light, dark = out[name]
    lines.append(f"    // --{name}: {light} / {dark}")
    lines.append(f"    static let {name} = dyn({rgb(light)}, {rgb(dark)})")
lines += [
    "",
    "    /// Tên bậc do /api/badge trả về. Bậc lạ → màu chữ mờ, không đoán bừa.",
    "    static func color(_ tone: String) -> NSColor {",
    "        switch tone {",
    '        case "crit": return crit',
    '        case "warn": return warn',
    '        case "ok": return ok',
    '        case "cheer": return cheer',
    "        default: return later",
    "        }",
    "    }",
    "}",
    "",
]
print("\n".join(lines))
