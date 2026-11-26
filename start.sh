#!/bin/sh
set -e

echo "===================================================="
echo "[Tailscale] Đang khởi động daemon tailscaled..."
echo "===================================================="

# Chạy tailscaled ở chế độ userspace networking (dành riêng cho container Render)
tailscaled --tun=userspace-networking --socks5-server=localhost:1055 --outbound-http-proxy-listen=localhost:1055 &
TAILSCALED_PID=$!

sleep 2

# Đăng nhập vào Tailnet nếu có Auth Key
if [ -n "$TAILSCALE_AUTHKEY" ]; then
  echo "[Tailscale] Đang kết nối bằng TAILSCALE_AUTHKEY..."
  tailscale up --authkey="${TAILSCALE_AUTHKEY}" --hostname="${TAILSCALE_HOSTNAME:-render-proxy-bridge}" --accept-dns=false &
else
  echo "[Tailscale] Không cấu hình TAILSCALE_AUTHKEY -> Sẵn sàng cho chế độ WebSocket Bridge."
fi

echo "===================================================="
echo "[Bridge] Khởi động Proxy Bridge Server trên cổng ${PORT:-10000}..."
echo "===================================================="

exec node server.js
