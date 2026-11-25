# Changelog

## 1.1.1

- Thêm **kiểm tra cập nhật**: tự động so với GitHub Releases của `mquand/health-guard` (tối đa
  một lần mỗi 24 giờ, tắt được qua `eyeGuard.checkUpdates`), nút **Cập nhật ngay** tải và cài
  file `.vsix` mới trực tiếp trong VS Code. Lệnh thủ công: `Eye Guard: Kiểm tra cập nhật`.
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
