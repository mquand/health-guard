# Changelog

## 1.2.0

- **Đổi tên extension: Eye Guard → Health Guard** — tên package, command (`healthGuard.*`),
  cấu hình (`healthGuard.*`), status bar và toàn bộ text hiển thị. Lưu ý: cài đặt cũ dùng khoá
  `eyeGuard.*` sẽ không được mang sang — cần đặt lại trong Settings.
- **Thêm 12 hiệu ứng pixel art mới** (tổng 21): nghỉ mắt có đàn cá, sứa, ngủ say; uống nước có
  bọt khí, thác nước, giọt nước, mưa rơi; đi bộ có rắn, slime, đom lửa, lá rơi, hoa nở.
- **Cài đặt nhanh ngay trong bảng nhắc nhở**: nút bánh răng mở khung cài đặt đầy đủ (bật/tắt từng
  loại nhắc, khoảng thời gian, hiệu ứng, giao diện, âm thanh…) mà không cần mở tab Settings.
- Workflow release xuất file `health-guard-<version>.vsix`.

## 1.1.1

- Thêm **kiểm tra cập nhật**: tự động so với GitHub Releases của `mquand/health-guard` (tối đa
  một lần mỗi 24 giờ, tắt được qua `healthGuard.checkUpdates`), nút **Cập nhật ngay** tải và cài
  file `.vsix` mới trực tiếp trong VS Code. Lệnh thủ công: `Health Guard: Kiểm tra cập nhật`.
- Nút tạm dừng trên bảng nhắc nhở giờ hiển thị đúng trạng thái pause toàn cục ngay khi mở panel.
- `package.json` bổ sung `repository` / `bugs` / `homepage` trỏ về GitHub.

## 1.1.0

- **Giao diện mới, mặc định tối giản**: bảng nhắc nhở nhỏ gọn theo màu theme VS Code, icon nét mảnh,
  đồng hồ đếm ngược lớn và thanh tiến trình mảnh. Không còn cảnh pixel art mặc định.
- Thêm `eyeGuard.appearance`: `clean` (mặc định) hoặc `pixel` để dùng lại cảnh pixel art pixelfx.
- Hiệu ứng mặc định dễ nhìn hơn khi chọn giao diện pixel: nước dùng `water-orb`, đi bộ dùng `bird`.
- Nút tạm dừng/cài đặt dùng icon SVG thay cho ký tự, hiển thị rõ ở cả theme sáng và tối.

## 1.0.0

- Bản đầu tiên.
- Nhắc **20-20-20** với bảng pixel art và đếm ngược từng giây (20 giây mặc định).
- Nhắc **uống nước** và **đi bộ / đi vệ sinh** theo khoảng thời gian riêng.
- Bật/tắt từng chức năng, đổi thời gian, lời nhắc và hiệu ứng trong Settings.
- 9 hiệu ứng pixel art từ [pixelfx](https://github.com/patch-gg/pixelfx): eyeball, halo, heal,
  fountain, potion, water-orb, frog, bird, butterfly.
- Thanh trạng thái hiển thị lời nhắc kế tiếp, menu nhanh, tạm dừng/hoãn, chuông nhẹ.
