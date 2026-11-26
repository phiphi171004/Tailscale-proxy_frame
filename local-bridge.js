#!/usr/bin/env node
/**
 * PROXY FARM - LOCAL BRIDGE CLIENT
 * Kết nối máy tính của bạn với Render.com để đưa 50+ proxy ra ngoài Internet
 * Hoàn toàn miễn phí, không cần mở port modem, không cần cài Tailscale.
 */

const WebSocket = require('ws');
const net = require('net');
const readline = require('readline');

// Lấy tham số từ dòng lệnh hoặc biến môi trường
let renderUrl = process.argv[2] || process.env.RENDER_URL;
const secret = process.env.BRIDGE_SECRET || 'proxy-farm-secret';

let activeStreams = 0;
let totalConnections = 0;

function formatWsUrl(inputUrl, path) {
  let clean = inputUrl.trim().replace(/\/+$/, '');
  if (!clean.startsWith('ws://') && !clean.startsWith('wss://')) {
    if (clean.startsWith('http://')) {
      clean = clean.replace('http://', 'ws://');
    } else if (clean.startsWith('https://')) {
      clean = clean.replace('https://', 'wss://');
    } else {
      clean = `wss://${clean}`;
    }
  }
  return `${clean}${path}`;
}

function startClient(targetUrl) {
  const controlUrl = `${formatWsUrl(targetUrl, '/tunnel')}?secret=${encodeURIComponent(secret)}`;
  console.log(`\n======================================================`);
  console.log(`[Bridge] Đang kết nối tới Render: ${targetUrl}...`);
  console.log(`======================================================`);

  const ws = new WebSocket(controlUrl);

  ws.on('open', () => {
    console.log(`\n✅ [Bridge] >>> ĐÃ THÔNG TUYẾN THÀNH CÔNG VỚI RENDER! <<<`);
    console.log(`🌐 Bạn có thể mang Proxy đi dùng ở mọi nơi trên Internet.`);
    console.log(`📌 Định dạng: ${targetUrl.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/.*$/, '')}:443:port29001:matkhau\n`);
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString('utf8'));
      if (msg.type === 'open') {
        const { streamId, targetPort } = msg;
        totalConnections++;
        activeStreams++;

        // 1. Kết nối tới cổng proxy local trên máy
        const localSocket = net.connect(targetPort, '127.0.0.1');

        localSocket.on('error', (err) => {
          console.error(`⚠️ [Cổng ${targetPort}] Không thể kết nối tới proxy local: ${err.message}`);
          activeStreams = Math.max(0, activeStreams - 1);
        });

        localSocket.on('connect', () => {
          // 2. Mở kênh data WebSocket riêng cho luồng này lên Render
          const dataUrl = `${formatWsUrl(targetUrl, '/data')}?streamId=${encodeURIComponent(streamId)}&secret=${encodeURIComponent(secret)}`;
          const dataWs = new WebSocket(dataUrl);

          dataWs.on('open', () => {
            console.log(`🚀 [Luồng #${totalConnections}] Đang chuyển tiếp dữ liệu qua cổng ${targetPort} (Đang chạy: ${activeStreams} luồng)`);
            const wsDuplex = WebSocket.createWebSocketStream(dataWs);
            localSocket.pipe(wsDuplex).pipe(localSocket);
          });

          dataWs.on('close', () => {
            localSocket.destroy();
            activeStreams = Math.max(0, activeStreams - 1);
          });

          dataWs.on('error', () => {
            localSocket.destroy();
            activeStreams = Math.max(0, activeStreams - 1);
          });

          localSocket.on('close', () => {
            dataWs.close();
            activeStreams = Math.max(0, activeStreams - 1);
          });
        });
      }
    } catch (e) {
      console.error('[Bridge] Lỗi gói tin:', e.message);
    }
  });

  ws.on('close', () => {
    console.warn('⚠️ [Bridge] Mất kết nối tới Render! Tự động thử lại sau 3 giây...');
    setTimeout(() => startClient(targetUrl), 3000);
  });

  ws.on('error', (err) => {
    console.error('❌ [Bridge] Lỗi kết nối:', err.message);
  });
}

// Nếu chưa truyền URL, hỏi người dùng
if (!renderUrl) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('👉 Nhập địa chỉ Render của bạn (vd: ten-app.onrender.com): ', (answer) => {
    rl.close();
    if (!answer || !answer.trim()) {
      console.error('Lỗi: Bạn chưa nhập địa chỉ Render!');
      process.exit(1);
    }
    renderUrl = answer.trim();
    startClient(renderUrl);
  });
} else {
  startClient(renderUrl);
}
