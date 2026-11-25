# ------------------------------------------------------------------------------
# DOCKERFILE MẪU TÍCH HỢP TAILSCALE CHO RENDER.COM
# ------------------------------------------------------------------------------

FROM node:20-bookworm-slim

# 1. Cài đặt các gói hệ thống cần thiết cho Tailscale
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    iptables \
    && rm -rf /var/lib/apt/lists/*

# 2. Cài đặt Tailscale chính thức phiên bản mới nhất
RUN curl -fsSL https://tailscale.com/install.sh | sh \
    && rm -rf /var/lib/apt/lists/*

# 3. Tạo thư mục làm việc cho ứng dụng
WORKDIR /app

# 4. Copy mã nguồn ứng dụng
COPY package.json ./
COPY server.js ./

# 5. Copy file kịch bản khởi động
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Render gán biến PORT (mặc định 10000)
EXPOSE 10000

# 6. Khởi động qua file start.sh
CMD ["/start.sh"]
