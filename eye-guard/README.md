# Eye Guard — Bảo vệ mắt cho VS Code 👁

Một extension nhỏ gọn, nhắc bạn:

- **20-20-20** — cứ mỗi 20 phút, nhìn ra xa khoảng 6 m (20 feet) trong 20 giây, kèm **đếm ngược từng giây**.
- **Uống nước** — nhắc bạn uống nước sau mỗi khoảng thời gian (mặc định 45 phút).
- **Đi bộ / đi vệ sinh** — nhắc đứng dậy vận động (mặc định 90 phút).

Bảng nhắc nhở mặc định **tối giản và theo màu giao diện VS Code** (sáng/tối đều hợp). Nếu muốn,
bạn có thể đổi `eyeGuard.appearance` sang `pixel` để xem cảnh pixel art động vẽ bằng
[pixelfx](https://github.com/patch-gg/pixelfx) (MIT).

Mọi thứ đều chỉnh được trong **Settings** và **bật/tắt riêng từng chức năng**.

---

## Cài đặt

### Cách 1: cài từ file `.vsix` (nhanh nhất)

```bash
code --install-extension eye-guard-1.1.0.vsix
```

Hoặc mở VS Code → **Extensions** → dấu `…` → **Install from VSIX…** → chọn file.

### Cách 2: chạy từ mã nguồn

```bash
cd eye-guard
npm install
npm run build
```

Mở thư mục này trong VS Code rồi bấm **F5** (Run Extension) để mở một cửa sổ thử nghiệm.

---

## Dùng hằng ngày

Sau khi cài, extension tự chạy khi mở VS Code. Ở **thanh trạng thái** (góc dưới bên trái) bạn sẽ thấy
lời nhắc kế tiếp, ví dụ:

```
👁 Nghỉ mắt · 12:34
```

Bấm vào đó để mở menu nhanh:

| Mục | Việc |
| --- | --- |
| Nghỉ mắt ngay | Mở bảng 20-20-20 và đếm ngược |
| Nhắc uống nước ngay | Mở bảng uống nước |
| Nhắc đi bộ / đi vệ sinh | Mở bảng vận động |
| Tạm dừng 30 phút / đến khi bật lại | Nghỉ nhắc nhở khi họp, thuyết trình… |
| Cài đặt Eye Guard | Mở Settings đã lọc sẵn |
| Xem thử hiệu ứng pixel art | Xem trước 9 hiệu ứng (luôn mở ở giao diện pixel) |

Trên bảng nhắc nhở bạn có thể:

- **Đã nghỉ xong / Đã uống nước / Đã đi bộ** — xác nhận và đóng.
- **Nhắc lại sau N phút** — hoãn lần này (N chỉnh trong Settings, mặc định 5).
- **Tạm dừng** — nút hình hai vạch ở góc phải, dừng nhắc nhở 30 phút.
- **Cài đặt** — nút hình thanh trượt, mở Settings.
- **Esc** — đóng bảng.

---

## Giao diện

- **`clean` (mặc định)** — thẻ nhắc nhở nhỏ, nền và chữ lấy từ theme VS Code, icon mắt / giọt nước /
  người đi bộ vẽ bằng nét SVG. Bảng nghỉ mắt có số giây lớn và thanh tiến trình mảnh.
- **`pixel`** — cảnh pixel art 160×120 với 9 hiệu ứng pixelfx, nền gradient + sao + bụi sáng.
  Chọn trong Settings tại `eyeGuard.appearance`; lệnh **Xem thử hiệu ứng** luôn mở ở chế độ này.

---

## Cài đặt (Settings → tìm `eyeGuard`)

| Khoá | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `eyeGuard.enabled` | `true` | Bật/tắt toàn bộ extension |
| `eyeGuard.startPaused` | `false` | Mỗi lần mở VS Code thì bắt đầu ở trạng thái tạm dừng |
| `eyeGuard.onlyWhenFocused` | `true` | Chỉ nhắc khi cửa sổ VS Code đang được chọn |
| `eyeGuard.sound` | `true` | Chuông nhẹ khi mở/hoàn tất (tổng hợp bằng WebAudio) |
| `eyeGuard.focusOnReminder` | `true` | Tự chuyển focus sang bảng nhắc nhở |
| `eyeGuard.appearance` | `clean` | `clean` (tối giản, theo theme VS Code) hoặc `pixel` (pixel art pixelfx) |
| `eyeGuard.popupStyle` | `panel` | `panel` (bảng nhắc nhở) hoặc `notification` (thông báo nhỏ) cho nước/đi bộ |
| `eyeGuard.snoozeMinutes` | `5` | Số phút khi bấm “Nhắc lại sau …” |
| `eyeGuard.eyeBreak.enabled` | `true` | Bật nhắc 20-20-20 |
| `eyeGuard.eyeBreak.intervalMinutes` | `20` | Số phút giữa hai lần nghỉ mắt |
| `eyeGuard.eyeBreak.durationSeconds` | `20` | Số giây đếm ngược mỗi lần nghỉ |
| `eyeGuard.eyeBreak.effect` | `eyeball` | `eyeball` / `halo` / `heal` (chỉ khi appearance = `pixel`) |
| `eyeGuard.eyeBreak.message` | … | Lời nhắc hiển thị |
| `eyeGuard.water.enabled` | `true` | Bật nhắc uống nước |
| `eyeGuard.water.intervalMinutes` | `45` | Số phút giữa hai lần nhắc |
| `eyeGuard.water.effect` | `water-orb` | `fountain` / `potion` / `water-orb` (chỉ khi appearance = `pixel`) |
| `eyeGuard.water.message` | … | Lời nhắc uống nước |
| `eyeGuard.walk.enabled` | `true` | Bật nhắc đi bộ |
| `eyeGuard.walk.intervalMinutes` | `90` | Số phút giữa hai lần nhắc |
| `eyeGuard.walk.effect` | `bird` | `frog` / `bird` / `butterfly` (chỉ khi appearance = `pixel`) |
| `eyeGuard.walk.message` | … | Lời nhắc đi bộ |

Thay đổi có hiệu lực ngay, không cần khởi động lại VS Code.

---

## Lệnh (Command Palette — `Ctrl/Cmd+Shift+P`)

Tìm “Eye Guard”:

- `Eye Guard: Menu`
- `Eye Guard: Bắt đầu nghỉ mắt 20-20-20`
- `Eye Guard: Nhắc uống nước ngay`
- `Eye Guard: Nhắc đi bộ / đi vệ sinh`
- `Eye Guard: Tạm dừng nhắc nhở` / `Tiếp tục nhắc nhở`
- `Eye Guard: Bật / tắt Eye Guard`
- `Eye Guard: Mở cài đặt`
- `Eye Guard: Xem thử hiệu ứng`

---

## Cách hoạt động

```
src/extension.ts     vòng đời, lệnh, thanh trạng thái, điều phối
src/scheduler.ts     bộ hẹn giờ 1 giây, tạm dừng/hoãn, chỉ bắn khi cửa sổ đang focus
src/panel.ts         webview panel + HTML/CSP, handshake ready → init
src/webview/main.js  DOM, đếm ngược, nút bấm, chuông WebAudio
src/webview/renderer.js  cảnh pixel 160×120 (chỉ tải khi appearance = pixel), gọi pixelfx
vendor/pixelfx/      bản rút gọn của pixelfx (core + 9 hiệu ứng), giấy phép MIT
```

- Bộ đếm giờ chạy trên `setInterval`, không phụ thuộc animation, nên lần nghỉ vẫn kết thúc đúng giờ
  kể cả khi tab bị ẩn.
- Nếu bạn rời máy (cửa sổ VS Code mất focus) và bật `onlyWhenFocused`, lời nhắc được dời lại 30 giây
  thay vì bắn dồn.
- Không có dữ liệu nào rời khỏi máy bạn. Không có tài khoản, không telemetry.

## Phát triển

```bash
npm install
npm run build      # dist/extension.js + media/webview.js
npm run watch      # build lại khi sửa
npm run typecheck  # tsc --noEmit
npm run smoke      # render thử mọi hiệu ứng trong Node (không cần VS Code)
npm run preview    # xuất ảnh PNG vào preview/ để xem hiệu ứng
npm run package    # đóng gói .vsix
```

## Giấy phép & ghi công

- Mã extension: MIT (xem `LICENSE`).
- Hiệu ứng pixel art: [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx), MIT.
  Bản sao rút gọn nằm trong `vendor/pixelfx` kèm `LICENSE` và `NOTICE.md` gốc.
  Một số hiệu ứng của pixelfx được chuyển thể từ các hiệu ứng MIT của Hugo Duprez và Hollow Crown —
  xem `vendor/pixelfx/NOTICE.md`.
