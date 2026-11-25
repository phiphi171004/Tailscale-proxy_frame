# Tailscale-proxy_frame

Cấu hình mẫu Dockerfile tích hợp **Tailscale** trên **Render.com** để ứng dụng đám mây có thể kết nối trực tiếp, ổn định về dàn 54 proxy 4G tại máy tính cá nhân ở nhà mà không cần mở cổng modem mạng gia đình.

---

## 1. CÁC FILE TRONG REPO
* **`Dockerfile`**: Tải và cài đặt Tailscale chính thức trên nền Linux slim container.
* **`start.sh`**: Script khởi động `tailscaled` ở chế độ userspace (dành cho container Render), tự động xác thực Auth Key và chạy ứng dụng web.
* **`server.js`**: Web server HTTP tích hợp sẵn để Render pass Health Check (cổng 10000).
* **`package.json`**: Cấu hình khởi động Node.js.

---

## 2. HƯỚNG DẪN TRIỂN KHAI TRÊN RENDER.COM

### Bước 1: Lấy Auth Key từ Tailscale
1. Truy cập [login.tailscale.com/admin/settings/keys](https://login.tailscale.com/admin/settings/keys)
2. Bấm **Generate auth key...**
3. Tích chọn:
   * **Reusable** (để khi Render redeploy hoặc restart vẫn tự kết nối lại)
   * **Ephemeral** (để tự động xóa device khỏi danh sách khi container tắt)
4. Bấm **Generate key** và sao chép mã (dạng `tskey-auth-kxxxxxxxxxxxx`).

### Bước 2: Deploy lên Render
1. Mở [dashboard.render.com](https://dashboard.render.com), chọn **New +** -> **Web Service**.
2. Chọn kết nối với repository này: `phiphi171004/Tailscale-proxy_frame`.
3. Render sẽ tự động nhận diện `Dockerfile`.
4. Ở mục **Environment Variables**, bấm **Add Environment Variable**:
   * **Key**: `TAILSCALE_AUTHKEY`
   * **Value**: Dán mã Auth Key bạn vừa tạo ở Bước 1.
5. Bấm **Create Web Service**.

---

## 3. SỬ DỤNG PROXY TRÊN RENDER
Sau khi Render deploy thành công, container sẽ nằm cùng mạng nội bộ ảo với máy tính của bạn:
* IP Tailscale máy tính nhà bạn: `100.97.70.3`
* Danh sách proxy xuất từ Proxy Farm:
  ```text
  100.97.70.3:29001:proxy:8SJFhRS3gITP
  100.97.70.3:29002:proxy:8SJFhRS3gITP
  ...
  100.97.70.3:29054:proxy:8SJFhRS3gITP
  ```
* Kết nối P2P mã hóa WireGuard tốc độ cao, không gián đoạn, cố định cổng 100%.
