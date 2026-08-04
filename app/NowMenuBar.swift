// App trên thanh menu. `bin/install-app` chép file này thành `main.swift` rồi biên
// dịch — Swift chỉ cho phép mã ở mức ngoài cùng trong đúng một file mang tên đó, và
// tên trong repo thì nên nói app này là gì.
//
// Ranh giới của file: nó KHÔNG biết luật hạn mức nào cả.
//
//   · Mục trên thanh menu → chữ, bậc màu, ký hiệu đều lấy nguyên từ `/api/badge`.
//   · Popover → là trang `menubar.html`, tức chính CSS và chính `quotaBar` của dashboard.
//
// Đây không phải lười. Thang bỏ phí bốn bậc mất ba phiên mới chốt được; một bản Swift
// của cùng cái thang ấy sẽ lệch, và lệch ở chỗ không ai mở ra đối chiếu. Thứ duy nhất
// bị nhân bản là năm mã màu — chúng được `bin/install-app` bóc thẳng từ `styles.css`
// lúc dựng, xem `Tones.swift`.
//
// __ROOT__, __WEBAPP__, __PORT__ được thay lúc dựng, như launchd/ và như launcher cũ.

import AppKit
import WebKit

let ROOT = "__ROOT__"
let WEBAPP = "__WEBAPP__"
let PORT = "__PORT__"
let BASE = "http://localhost:\(PORT)"

// Bốn số canh chữ trên thanh menu, để rời ra đây vì chúng là thứ phải chỉnh bằng mắt.
// Mỗi số đọc được từ biến môi trường cùng tên, nên dò một giá trị mới không phải dựng
// lại app: chạy thẳng binary với NOW_SNAP để chụp nút ra ảnh, xem, rồi mới chốt.
//
//   NOW_PAD_TOP=3 NOW_SNAP=/tmp/x.png "…/NOW Dashboard.app/Contents/MacOS/now-dash-menu"
//
func tune(_ key: String, _ fallback: CGFloat) -> CGFloat {
    guard let s = ProcessInfo.processInfo.environment[key], let v = Double(s) else { return fallback }
    return CGFloat(v)
}

let LABEL_SIZE = tune("NOW_LABEL_SIZE", 7)  // dòng "CLAUDE"
let VALUE_SIZE = tune("NOW_VALUE_SIZE", 10) // dòng số
let LABEL_Y = tune("NOW_LABEL_Y", 12)       // đáy dòng nhãn, đo từ ĐÁY nút
let VALUE_Y = tune("NOW_VALUE_Y", 1.5)      // đáy dòng số
let BTN_H = tune("NOW_BTN_H", 22)           // chiều cao nút trên thanh menu

/// Sàn chiều cao popover — cũng là cỡ lúc trang còn đang tải, trước khi nó khai số thật.
/// Đủ cho khối báo lỗi và màn chờ, không hơn: mọi cỡ lớn hơn phải do TRANG nói ra.
let POPOVER_MIN: CGFloat = 180

// ── Mô hình ──────────────────────────────────────────────────────────────────

struct Badge {
    var quotaText = "—"
    var mark = "·"
    var tone = "mute"
    var tip = "Chưa nối được tới server"
    var live = false
    /// Số trên thanh có thật sự là số của BÂY GIỜ không. Khác `live`: `live` nói server
    /// có trả lời hay không, `fresh` nói cái server trả lời có còn giá trị hay không —
    /// và hỏng kiểu thứ hai mới là kiểu nguy hiểm, vì màn hình vẫn đầy số trông như thật.
    var fresh = true
}

// ── App ──────────────────────────────────────────────────────────────────────

final class Delegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, NSPopoverDelegate, WKScriptMessageHandler {
    private var quotaItem: NSStatusItem!
    private let popover = NSPopover()
    private var web: WKWebView?
    private var timer: Timer?

    func applicationDidFinishLaunching(_: Notification) {
        NSApp.setActivationPolicy(.accessory)
        loginModeIfAsked() // một nhát rồi thoát, không dựng mục nào lên thanh

        // ĐÚNG MỘT mục. Bản trước có hai — hạn mức và việc-đang-chờ — với lý do là hai
        // đại lượng ấy không so được với nhau. Lý do đúng, kết luận sai: cả hai đều mở
        // cùng một popover, nên người dùng nhận được hai cái nút hành vi y hệt nhau,
        // chiếm hai chỗ trên một thanh menu vốn đã chật. Chỗ để tách chúng ra là bên
        // trong popover, nơi có đủ khoảng trống, chứ không phải trên thanh.
        quotaItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        quotaItem.button?.target = self
        quotaItem.button?.action = #selector(clicked(_:))
        quotaItem.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])
        quotaItem.button?.title = "…"

        popover.behavior = .transient
        popover.delegate = self

        ensureServer()
        refresh()
        snapshotIfAsked()
        probeIfAsked()
        // 30 giây: đúng nhịp quét nền của server, hỏi dày hơn cũng chỉ nhận lại số cũ.
        let t = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in self?.refresh() }
        t.tolerance = 5
        timer = t
    }

    /// Bấm icon lúc app đã chạy (Dock, Spotlight, Launchpad) — mở dashboard đầy đủ.
    /// Không có nhánh này thì cú bấm thứ hai không ra gì cả và app trông như đã chết.
    func applicationShouldHandleReopen(_: NSApplication, hasVisibleWindows _: Bool) -> Bool {
        openDashboard()
        return true
    }

    // ── Server ───────────────────────────────────────────────────────────────

    /// Dựng server qua đúng một đường: `bin/now-dash --no-open` (ping → launchd →
    /// chờ). Không gọi thẳng launchctl ở đây — hai bản của cùng một logic khởi động
    /// là hai bản sẽ trôi khỏi nhau.
    private func ensureServer(then done: (() -> Void)? = nil) {
        DispatchQueue.global(qos: .utility).async {
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "\(ROOT)/bin/now-dash")
            p.arguments = ["--no-open"]
            p.standardOutput = FileHandle.nullDevice
            p.standardError = FileHandle.nullDevice
            try? p.run()
            p.waitUntilExit()
            DispatchQueue.main.async { done?() }
        }
    }

    private func refresh() {
        var req = URLRequest(url: URL(string: "\(BASE)/api/badge")!)
        req.timeoutInterval = 4
        URLSession.shared.dataTask(with: req) { [weak self] data, _, _ in
            var b = Badge()
            if let data,
               let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
               let q = root["quota"] as? [String: Any] {
                b.live = true
                b.quotaText = q["text"] as? String ?? "—"
                b.mark = q["mark"] as? String ?? "·"
                b.tone = q["tone"] as? String ?? "mute"
                let waste = q["waste"] as? Int
                let binding = q["binding"] as? String
                if let waste, let binding {
                    // Tooltip nói ra đại lượng mà màu đang chở. Màu một mình thì phải
                    // học mới đọc được; câu này là chỗ học nó.
                    b.tip = "\(binding): bỏ phí dự phóng \(waste)%"
                } else {
                    b.tip = "Chưa đọc được nhịp tiêu"
                }
                if (q["stale"] as? Bool) == true {
                    b.fresh = false
                    b.tip += " · số đã cũ"
                }
                // Vì sao hỏng và làm gì để chữa — nguyên văn từ server, xem `/api/badge`.
                // Xuống dòng chứ không nối tiếp: câu này là việc phải làm, không phải
                // phần đuôi của câu tả con số.
                if let note = q["note"] as? String, !note.isEmpty { b.tip += "\n\(note)" }
            }
            DispatchQueue.main.async { self?.paint(b) }
        }.resume()
    }

    /// Hai dòng trong 22pt: nhãn nhỏ ở trên, hai con số ở dưới — vẽ thành ẢNH, không
    /// phải đặt `attributedTitle`.
    ///
    /// Xếp dọc chứ không nối ngang vì thanh menu tính tiền bằng CHIỀU NGANG — trên máy
    /// này đã có mười mấy icon tranh chỗ. Hai dòng lấy cùng khoảng cao vốn đã bỏ ra rồi.
    ///
    /// Vì sao vẽ ảnh: với `attributedTitle` thì chỗ đứng của khối chữ là do
    /// NSStatusBarButton quyết, và nó dồn khối lên sát mép trên — khoảng trống rơi hết
    /// xuống đáy, đúng cái "sao cứ bị padding ở bottom". Cả hai đòn chỉnh văn bản đều
    /// trượt, và cùng đo bằng ảnh chụp chính cái nút:
    ///
    ///   · `baselineOffset` −1,5 và −4,5 → hai tấm ảnh giống hệt nhau (min/maxLineHeight
    ///     ghim glyph trong hộp cứng của từng dòng)
    ///   · `paragraphSpacingBefore` 0 và 6 → cũng giống hệt (AppKit bỏ qua nó ở đoạn đầu)
    ///
    /// Vẽ ảnh thì toạ độ mỗi dòng là do mình đặt, và `NOW_LABEL_Y` / `NOW_VALUE_Y` dò
    /// được bằng mắt qua `NOW_SNAP` mà không phải dựng lại app.
    ///
    /// Ảnh là `isTemplate` nên macOS tự đảo màu theo nền thanh menu — sáng hay tối đều
    /// đọc được, không cần theo dõi thay đổi giao diện. Phân biệt hai dòng bằng ALPHA
    /// chứ không bằng màu, vì template chỉ giữ lại alpha.
    private func paint(_ b: Badge) {
        // Mờ đi khi số không còn là số của bây giờ — dù vì server im (`live`) hay vì
        // bản đọc đã quá cũ (`fresh`). Đây là kênh DUY NHẤT nói điều đó mà không đòi
        // người dùng rê chuột lên hỏi tooltip, và nó phải nằm ngoài màu: màu trên thanh
        // đã dành trọn cho phần bỏ phí (luật 1 của public/lib/quota.js), còn ảnh thì
        // `isTemplate` nên chỉ giữ được alpha.
        //
        // Chỗ nguy hiểm không phải lúc mất hẳn số — "—" thì ai cũng thấy là hỏng. Nguy
        // hiểm là lúc endpoint chết mà ảnh chụp cũ vẫn còn: thanh menu bày "11%·41%"
        // trông y hệt số thật, và người đọc tin nó cả buổi.
        let dim = !(b.live && b.fresh)
        let label = NSAttributedString(string: "CLAUDE", attributes: [
            .font: NSFont.systemFont(ofSize: LABEL_SIZE, weight: .medium),
            .kern: 0.8,
            .foregroundColor: NSColor.black.withAlphaComponent(dim ? 0.3 : 0.55),
        ])
        let value = NSAttributedString(string: b.quotaText, attributes: [
            .font: NSFont.monospacedDigitSystemFont(ofSize: VALUE_SIZE, weight: .medium),
            .foregroundColor: NSColor.black.withAlphaComponent(dim ? 0.4 : 1),
        ])

        let lw = label.size(), vw = value.size()
        let w = ceil(max(lw.width, vw.width)) + 2
        let img = NSImage(size: NSSize(width: w, height: BTN_H))
        img.lockFocus()
        value.draw(at: NSPoint(x: (w - vw.width) / 2, y: VALUE_Y))
        label.draw(at: NSPoint(x: (w - lw.width) / 2, y: LABEL_Y))
        img.unlockFocus()
        img.isTemplate = true

        quotaItem.button?.image = img
        quotaItem.button?.imagePosition = .imageOnly
        quotaItem.button?.toolTip = b.tip
    }

    /// Hỏi hoặc đặt mục "Mở lúc đăng nhập" rồi thoát — bật bằng `NOW_LOGIN=status|on|off`.
    /// In ra `on` hoặc `off`.
    ///
    /// Có mặt để `bin/install-app` và mắt người kiểm được cùng một đường đi mà nút trên
    /// menu chuột phải dùng — nút ấy không bấm được từ terminal, và một nhánh không ai
    /// chạy được là nhánh sẽ hỏng lặng lẽ.
    private func loginModeIfAsked() {
        guard let raw = ProcessInfo.processInfo.environment["NOW_LOGIN"] else { return }
        var code: Int32 = 0
        do {
            switch raw.lowercased() {
            case "status": break
            case "on": try setLogin(true)
            case "off": try setLogin(false)
            default:
                FileHandle.standardError.write(Data("NOW_LOGIN nhận status|on|off, không phải \(raw)\n".utf8))
                code = 2
            }
        } catch {
            FileHandle.standardError.write(Data("\(error.localizedDescription)\n".utf8))
            code = 1
        }
        print(loginOn ? "on" : "off")
        exit(code)
    }

    /// Chụp CHÍNH cái nút trên thanh menu ra PNG rồi thoát — bật bằng `NOW_SNAP=<file>`.
    ///
    /// Có mặt vì thanh menu không chụp được từ terminal (thiếu quyền Screen Recording),
    /// nên canh chữ ở đây là canh mù: sửa → dựng → hỏi người dùng → nghe tả lại. Nút tự
    /// vẽ mình vào bitmap thì cái ra được là cách NSStatusBarButton CĂN THẬT, chứ không
    /// phải một bản dựng lại tự căn giữa — mà chênh lệch giữa hai thứ đó chính là chỗ
    /// "trên demo thì đẹp, lên thanh thì dư khoảng dưới".
    private func snapshotIfAsked() {
        guard let path = ProcessInfo.processInfo.environment["NOW_SNAP"],
              let btn = quotaItem.button else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            let box = btn.bounds
            guard let rep = btn.bitmapImageRepForCachingDisplay(in: box) else { return }
            btn.cacheDisplay(in: box, to: rep)

            // Nút vẽ trên nền trong suốt; dán nó lên một dải tối cỡ thanh menu để chữ
            // sáng hiện ra, và để thấy luôn khoảng trống trên/dưới.
            let img = NSImage(size: box.size)
            img.lockFocus()
            NSColor(srgbRed: 0.13, green: 0.13, blue: 0.14, alpha: 1).setFill()
            NSRect(origin: .zero, size: box.size).fill()
            rep.draw(in: NSRect(origin: .zero, size: box.size))
            img.unlockFocus()

            if let tiff = img.tiffRepresentation,
               let out = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) {
                try? out.write(to: URL(fileURLWithPath: path))
            }
            // In cả tooltip: nó cũng là thứ không soi được từ terminal, và nó chở phần
            // NÓI RA — vì sao hỏng, phải làm gì. Ảnh chụp một mình chỉ trả lời được câu
            // "nút có mờ đi không", không trả lời được "nó có nói cho người ta biết
            // không".
            print("nút: \(box.width)×\(box.height)pt → \(path)")
            print("tooltip: \(btn.toolTip ?? "(không có)")")
            NSApp.terminate(nil)
        }
    }

    /// Mở popover rồi in ra cỡ THẬT của nó — bật bằng `NOW_PROBE=1`.
    ///
    /// Cùng lý do tồn tại với `NOW_SNAP`: popover không chụp được từ terminal, nên câu
    /// "nội dung bị cắt" chỉ kiểm được bằng cách hỏi chính cái popover. Nó in cả cỡ
    /// popover lẫn cỡ trang, và hai số ấy lệch nhau chính là dấu hiệu bị cắt — bản trước
    /// đứng im ở 320 trong khi trang cao 446, mà không có gì kêu lên.
    private func probeIfAsked() {
        guard ProcessInfo.processInfo.environment["NOW_PROBE"] != nil,
              let btn = quotaItem.button else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            self.showPopover(btn)
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.5) {
                let box = self.popover.contentSize
                self.web?.evaluateJavaScript("document.querySelector('.mb-wrap')?.getBoundingClientRect().height ?? -1") { v, _ in
                    let page = (v as? NSNumber)?.doubleValue ?? -1
                    let cut = page > 0 ? page - Double(box.height) : 0
                    print("popover: \(Int(box.width))×\(Int(box.height))pt · trang: \(Int(page))pt · "
                        + (cut > 0.5 ? "CẮT MẤT \(Int(cut))pt" : "vừa khít"))
                    NSApp.terminate(nil)
                }
            }
        }
    }

    // ── Bấm ──────────────────────────────────────────────────────────────────

    @objc private func clicked(_ sender: NSStatusBarButton) {
        if NSApp.currentEvent?.type == .rightMouseUp {
            showMenu(sender)
        } else if popover.isShown {
            popover.performClose(nil)
        } else {
            showPopover(sender)
        }
    }

    private func showPopover(_ anchor: NSStatusBarButton) {
        let w = web ?? makeWeb()
        web = w
        // Tải lại mỗi lần mở: cửa sổ này để liếc số ngay lúc này, mà số cũ trông y hệt
        // số mới. Trang nhẹ và ở localhost nên lượt tải là vài chục mili giây.
        w.load(URLRequest(url: URL(string: "\(BASE)/menubar.html")!))
        popover.show(relativeTo: anchor.bounds, of: anchor, preferredEdge: .minY)
    }

    private func makeWeb() -> WKWebView {
        let conf = WKWebViewConfiguration()
        // Trang tự khai chiều cao của nó qua đây — xem `sizeReport()` trong menubar.js.
        conf.userContentController.add(self, name: "size")
        let w = WKWebView(frame: NSRect(x: 0, y: 0, width: 360, height: POPOVER_MIN), configuration: conf)
        w.navigationDelegate = self
        w.setValue(false, forKey: "drawsBackground") // để nền của trang lộ ra, không có lớp trắng chèn giữa
        let vc = NSViewController()
        vc.view = w
        popover.contentViewController = vc
        popover.contentSize = NSSize(width: 360, height: POPOVER_MIN)
        return w
    }

    /// Chiều cao đo TỪ trang, không đặt cứng. Số cửa sổ hạn mức thay đổi theo ngày
    /// (khung theo model chỉ hiện khi có chuyện để nói), và câu quản gia dài ngắn tuỳ
    /// việc đang treo — một chiều cao cố định thì hôm thừa một dải trống, hôm cắt mất
    /// mấy dòng cuối.
    ///
    /// Trang ĐẨY số sang đây, app không HỎI. Bản trước hỏi trong `didFinish` và luôn
    /// nhận về đúng một con số: 320.
    ///
    ///   `didFinish` báo document đã tải xong, nhưng `menubar.js` là module và nó còn
    ///   đang `await fetch('/api/state')` — lúc ấy trong `#mb` mới chỉ có màn chờ "đang
    ///   đọc…", `.mb-wrap` chưa tồn tại, nên câu truy vấn rơi thẳng vào nhánh `?? 320`.
    ///
    /// Cái giá của nó không phải "popover hơi ngắn": mọi thứ dưới mốc 320pt bị cắt cụt
    /// suốt từ ngày đầu — kể cả hai cái nút ở đáy, và đó chính là "không có nút bấm nhảy
    /// ra app được à".
    func userContentController(_: WKUserContentController, didReceive m: WKScriptMessage) {
        guard m.name == "size", let d = m.body as? [String: Any],
              let h = (d["h"] as? NSNumber)?.doubleValue, h > 0 else { return }
        // Bề rộng cũng do trang quyết. Nó là một quyết định bố cục, mà bố cục thì sống ở
        // CSS — để nó ở đây thì mỗi lần thử một bề rộng khác là một lần dựng lại app.
        let w = (d["w"] as? NSNumber)?.doubleValue ?? Double(popover.contentSize.width)
        let hh = min(max(CGFloat(h), POPOVER_MIN), maxPopoverHeight())
        popover.contentSize = NSSize(width: ceil(CGFloat(w)), height: ceil(hh))
    }

    /// Trần chiều cao: màn hình đang chứa thanh menu, trừ thanh và một khoảng thở ở đáy.
    /// Đặt cứng 560 như bản trước thì màn 13" nằm ngang vẫn ổn, còn máy cắm màn phụ thấp
    /// hơn thì popover chạm mép dưới — mà chạm mép thì macOS tự cắt, không cuộn.
    private func maxPopoverHeight() -> CGFloat {
        guard let f = NSScreen.main?.visibleFrame else { return 560 }
        return max(POPOVER_MIN, f.height - 24)
    }

    /// Đường lui: trang hỏng trước khi kịp khai chiều cao (server chết, JS ném) thì vẫn
    /// phải vừa cái khối báo lỗi, chứ không giữ nguyên cỡ của lần mở trước.
    func webView(_ w: WKWebView, didFinish _: WKNavigation!) {
        w.evaluateJavaScript("document.documentElement.scrollHeight") { v, _ in
            guard let h = (v as? NSNumber)?.doubleValue, h > 0 else { return }
            let clamped = min(max(CGFloat(h), POPOVER_MIN), self.maxPopoverHeight())
            self.popover.contentSize = NSSize(width: self.popover.contentSize.width, height: ceil(clamped))
        }
    }

    /// Hai nút trong popover đi qua scheme `now:` — chặn ở đây, không cho WKWebView
    /// điều hướng thật. Popover rộng 360pt mà nạp dashboard đầy đủ vào thì không đọc
    /// được gì.
    func webView(_: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, url.scheme == "now" else {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        popover.performClose(nil)
        let view = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "view" })?.value
        openDashboard(view: view)
    }

    // ── Menu chuột phải ──────────────────────────────────────────────────────

    private func showMenu(_ anchor: NSStatusBarButton) {
        let m = NSMenu()
        m.addItem(withTitle: "Mở dashboard", action: #selector(openFull), keyEquivalent: "")
        m.addItem(withTitle: "Làm mới ngay", action: #selector(refreshNow), keyEquivalent: "")
        m.addItem(.separator())
        m.addItem(withTitle: "Dựng lại server", action: #selector(restartServer), keyEquivalent: "")
        let login = NSMenuItem(title: "Mở lúc đăng nhập", action: #selector(toggleLogin), keyEquivalent: "")
        login.state = loginOn ? .on : .off
        m.addItem(login)
        m.addItem(.separator())
        m.addItem(withTitle: "Thoát", action: #selector(quit), keyEquivalent: "q")
        for it in m.items where it.action != nil { it.target = self }
        // Nút sáng lên suốt lúc menu mở, giống mọi app khác trên thanh — nhưng bật thẳng
        // cờ highlight của cell, KHÔNG mượn `performClick`.
        //
        // `performClick(nil)` bắn lại action gắn ở nút, mà action ấy chính là `clicked`.
        // Lúc đó `NSApp.currentEvent?.type` vẫn còn là `.rightMouseUp`, nên `clicked` lại
        // rẽ vào `showMenu` → `performClick` → `clicked` → … Đệ quy không có đáy: bản
        // báo lỗi 04/8 đếm được depth 11598 rồi SIGSEGV, tức bấm chuột phải một cái là
        // app chết ngay. Xem issue #1.
        //
        // `popUp` chặn cho tới khi menu đóng, nên dòng tắt highlight ở dưới chạy đúng lúc.
        let cell = anchor.cell as? NSButtonCell
        cell?.isHighlighted = true
        m.popUp(positioning: nil, at: NSPoint(x: 0, y: anchor.bounds.height + 4), in: anchor)
        cell?.isHighlighted = false
    }

    private func openDashboard(view: String? = nil) {
        let url = URL(string: view == nil ? BASE : "\(BASE)/#\(view!)")!
        let bundle = URL(fileURLWithPath: WEBAPP)
        if FileManager.default.fileExists(atPath: WEBAPP) {
            let cfg = NSWorkspace.OpenConfiguration()
            NSWorkspace.shared.open([url], withApplicationAt: bundle, configuration: cfg)
        } else {
            NSWorkspace.shared.open(url)
        }
    }

    @objc private func openFull() { openDashboard() }
    @objc private func refreshNow() { refresh() }
    @objc private func quit() { NSApp.terminate(nil) }

    @objc private func restartServer() {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/launchctl")
        p.arguments = ["kickstart", "-k", "gui/\(getuid())/dev.hoanluu.now-dash"]
        try? p.run()
        // Lượt quét đầu mất 4–6 giây, hỏi sớm hơn thì chỉ nhận lại "chưa nối được".
        DispatchQueue.main.asyncAfter(deadline: .now() + 7) { [weak self] in self?.refresh() }
    }

    @objc private func toggleLogin() {
        do {
            try setLogin(!loginOn)
        } catch {
            let a = NSAlert()
            a.messageText = "Không đổi được mục đăng nhập"
            a.informativeText = error.localizedDescription
            a.runModal()
        }
    }

    // ── Mở lúc đăng nhập ─────────────────────────────────────────────────────
    //
    // Một file plist trong ~/Library/LaunchAgents/, cùng khuôn với service — xem
    // launchd/dev.hoanluu.now-dash.menu.plist để biết vì sao không dùng SMAppService.
    //
    // Ở đây KHÔNG gọi launchctl, cả lúc bật lẫn lúc tắt, và cả hai đều có lý do:
    //
    //   · bật  — `bootstrap` sẽ dựng ngay một bản THỨ HAI của chính app đang chạy, hai
    //            icon giống hệt nhau trên thanh. Cái người dùng vừa bấm là "lần đăng
    //            nhập SAU thì mở", không phải "mở thêm một cái bây giờ".
    //   · tắt  — `bootout` giết đúng tiến trình đang chạy dòng lệnh này, nếu nó do
    //            launchd dựng lên. Tắt mục đăng nhập mà app tự thoát là hỏng.
    //
    // Miền gui của launchd chết theo phiên đăng nhập, nên xoá file là đủ: đăng nhập lần
    // sau launchd đọc lại thư mục ấy, không thấy thì không dựng.

    private var loginPlist: URL {
        URL(fileURLWithPath: NSHomeDirectory())
            .appendingPathComponent("Library/LaunchAgents/dev.hoanluu.now-dash.menu.plist")
    }

    private var loginOn: Bool { FileManager.default.fileExists(atPath: loginPlist.path) }

    private func setLogin(_ on: Bool) throws {
        guard on else {
            try? FileManager.default.removeItem(at: loginPlist)
            return
        }
        let tpl = try String(contentsOfFile: "\(ROOT)/launchd/dev.hoanluu.now-dash.menu.plist",
                             encoding: .utf8)
        let bin = Bundle.main.bundleURL.appendingPathComponent("Contents/MacOS/now-dash-menu").path
        try FileManager.default.createDirectory(at: loginPlist.deletingLastPathComponent(),
                                                withIntermediateDirectories: true)
        try tpl.replacingOccurrences(of: "__MENU_BIN__", with: bin)
            .write(to: loginPlist, atomically: true, encoding: .utf8)
    }
}

let app = NSApplication.shared
let delegate = Delegate()
app.delegate = delegate
app.run()
