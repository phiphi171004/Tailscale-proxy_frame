# RENDER PROXY BRIDGE FOR PROXY FARM

Cổng kết nối Proxy công khai trên **Render.com** kết nối trực tiếp với dàn proxy **Proxy Farm** trên máy tính của bạn.
Cho phép mang dàn proxy ra ngoài Internet để dùng cho Tool bot, web check proxy, hoặc bất kỳ máy nào khác mà **không cần mở port modem**.

---

## 1. CƠ CHẾ HOẠT ĐỘNG
* **Cổng công khai**: `https://ten-app-cua-ban.onrender.com:443`
* **Hỗ trợ định tuyến 50+ cổng**: Chỉ cần điền số cổng vào ô `Username` (vd: `port29001`, `port29002`...).
* **Hỗ trợ 2 chế độ kết nối về máy tính**:
  1. **Chế độ 1 (WebSocket Bridge - Khuyên dùng)**: Chạy file `bat-dau-bridge.bat` trên máy tính. Kết nối thẳng tới Render qua HTTPS WebSocket. **Không cần cài bất kỳ phần mềm nào vào Windows**.
  2. **Chế độ 2 (Tailscale)**: Nếu máy tính có cài Tailscale, Render tự động forward qua mạng ảo Tailscale (IP `100.97.70.3`).

---

## 2. TRIỂN KHAI LÊN RENDER.COM
1. Vào Dashboard Render.com, chọn Web Service của bạn (liên kết với repo này).
2. Render sẽ tự động build từ `Dockerfile`.
3. Cấu hình biến môi trường (Environment Variables) trên Render:
   * `PORT`: `10000` (mặc định của Render).
   * `BRIDGE_SECRET`: Mật khẩu bảo vệ kết nối giữa máy tính và Render (mặc định: `proxy-farm-secret`).
   * `LOCAL_PROXY_USER`: `proxy` (tên đăng nhập proxy trên máy bạn).
   * `LOCAL_PROXY_PASS`: (mật khẩu proxy trên máy bạn).
4. Bấm **Deploy**.

---

## 3. CẤU HÌNH UPTIMEROBOT (CHỐNG RENDER NGỦ ĐÔNG)
Render gói Free sẽ ngủ nếu không có request trong 15 phút. Cấu hình trên UptimeRobot:
* **URL:** `https://ten-app-cua-ban.onrender.com/health`
* **Monitoring Type:** `HTTP(s)`
* **HTTP Method:** `HEAD` (hoặc `GET`)
* **Interval:** `5 minutes`

---

## 4. CÁCH SỬ DỤNG TRÊN TOOL & WEB CHECK PROXY
Trong Tool bot hoặc các trang web check proxy:
* **Loại proxy:** `HTTP Proxy`
* **Host:** `ten-app-cua-ban.onrender.com`
* **Port:** `443`
* **User:** `port29001` (hoặc `port29002`, `port29003`... tùy luồng bạn muốn chọn)
* **Pass:** Mật khẩu proxy của bạn

Ví dụ danh sách xuất ra:
```text
ten-app-cua-ban.onrender.com:443:port29001:matkhau
ten-app-cua-ban.onrender.com:443:port29002:matkhau
ten-app-cua-ban.onrender.com:443:port29003:matkhau
...
```

Toàn bộ 50 luồng sẽ chạy song song đồng thời, được Render chuyển tiếp chuẩn xác về từng VPN trên máy của bạn.
