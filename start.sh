#!/bin/sh
set -e

echo "===================================================="
echo "[Tailscale] Đang khởi động daemon tailscaled..."
echo "===================================================="

# Chạy tailscaled ở chế độ userspace networking (dành riêng cho container Render)
tailscaled --tun=userspace-networking --socks5-server=localhost:1055 --outbound-http-proxy-listen=localhost:1055 &
TAILSCALED_PID=$!

# Đợi daemon socket khởi tạo
sleep 2

# Đăng nhập vào Tailnet nếu đã có Auth Key
if [ -n "$TAILSCALE_AUTHKEY" ]; then
  echo "[Tailscale] Đang kết nối bằng TAILSCALE_AUTHKEY..."
  tailscale up --authkey="${TAILSCALE_AUTHKEY}" --hostname="${TAILSCALE_HOSTNAME:-render-worker}" --accept-dns=false
  echo "[Tailscale] >>> ĐÃ KẾT NỐI THÀNH CÔNG VỚI MÁY Ở NHÀ <<<"
else
  echo "[Tailscale] CẢNH BÁO: Chưa cấu hình biến TAILSCALE_AUTHKEY trên Render Dashboard!"
fi

echo "===================================================="
echo "[App] Đang khởi chạy ứng dụng chính của bạn..."
echo "===================================================="

# Đổi lệnh bên dưới theo đúng lệnh chạy web/tool của bạn:
if [ -f "package.json" ]; then
  exec npm start
elif [ -f "main.py" ]; then
  exec python main.py
elif [ -f "app.py" ]; then
  exec python app.py
else
  echo "[App] Không tìm thấy file chạy mặc định. Giữ container hoạt động..."
  wait $TAILSCALED_PID
fi
