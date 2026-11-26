# ------------------------------------------------------------------------------
# DOCKERFILE PROXY BRIDGE CHO RENDER.COM
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

# 3. Kích hoạt pnpm qua corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# 4. Tạo thư mục làm việc cho ứng dụng
WORKDIR /app

# 5. Copy dependencies và cài đặt bằng pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# 6. Copy mã nguồn ứng dụng
COPY server.js ./

# 7. Copy file kịch bản khởi động
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Render gán biến PORT (mặc định 10000)
EXPOSE 10000

# 8. Khởi động qua file start.sh
CMD ["/start.sh"]
