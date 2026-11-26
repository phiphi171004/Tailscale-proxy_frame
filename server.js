const http = require('http');
const net = require('net');
const url = require('url');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = process.env.PORT || 10000;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || 'proxy-farm-secret';
const TARGET_TAILSCALE_IP = process.env.TARGET_TAILSCALE_IP || '100.97.70.3';
const LOCAL_PROXY_USER = process.env.LOCAL_PROXY_USER || 'proxy';
const LOCAL_PROXY_PASS = process.env.LOCAL_PROXY_PASS || '';

// Trạng thái hệ thống
let wsControlClient = null;
const pendingStreams = new Map(); // streamId -> { onReady, onError, timer }
let totalHandledRequests = 0;
let activeConnectionsCount = 0;

// Khởi tạo HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method ? req.method.toUpperCase() : 'GET';

  // 1. Phục vụ UptimeRobot & Health Check (GET/HEAD /health, /healthz, /ping)
  if (pathname === '/health' || pathname === '/healthz' || pathname === '/ping' || (method === 'HEAD' && pathname === '/')) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
    });
    if (method === 'HEAD') {
      res.end();
    } else {
      res.end(JSON.stringify({
        status: 'ok',
        uptimeRobot: 'alive',
        wsBridgeConnected: wsControlClient !== null && wsControlClient.readyState === WebSocket.OPEN,
        activeConnections: activeConnectionsCount,
        totalRequests: totalHandledRequests,
        timestamp: new Date().toISOString(),
      }));
    }
    return;
  }

  // 2. Endpoint kiểm tra trạng thái JSON
  if (pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      wsBridgeConnected: wsControlClient !== null && wsControlClient.readyState === WebSocket.OPEN,
      tailscaleTarget: TARGET_TAILSCALE_IP,
      activeConnections: activeConnectionsCount,
      totalRequests: totalHandledRequests,
      uptimeSeconds: Math.floor(process.uptime()),
    }));
    return;
  }

  // 3. Xử lý Plain HTTP Proxy (vd: GET http://icanhazip.com/)
  if (req.url.startsWith('http://')) {
    handlePlainHttpProxy(req, res);
    return;
  }

  // 4. Trang chủ giao diện quản lý trực quan
  const isWsConnected = wsControlClient !== null && wsControlClient.readyState === WebSocket.OPEN;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html lang="vi">
      <head>
        <title>Proxy Farm - Render Proxy Bridge</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; line-height: 1.6; margin: 0; }
          .container { max-width: 720px; margin: 0 auto; background: #1e293b; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4); border: 1px solid #334155; }
          h1 { color: #38bdf8; margin-top: 0; font-size: 24px; display: flex; align-items: center; gap: 10px; }
          .badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; }
          .badge.online { background: #065f46; color: #6ee7b7; border: 1px solid #059669; }
          .badge.standby { background: #854d0e; color: #fde047; border: 1px solid #ca8a04; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
          .stat-card { background: #0f172a; padding: 16px; border-radius: 10px; border: 1px solid #334155; }
          .stat-title { font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
          .stat-value { font-size: 22px; font-weight: bold; color: #f1f5f9; margin-top: 4px; }
          .code-block { background: #0f172a; padding: 14px 16px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #38bdf8; border: 1px solid #334155; word-break: break-all; margin: 10px 0; }
          .section-title { font-size: 15px; font-weight: 600; color: #e2e8f0; margin-top: 24px; }
          ul { margin: 8px 0; padding-left: 20px; color: #cbd5e1; }
          li { margin-bottom: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>
            <span>🌐 Proxy Farm Gateway</span>
            <span class="badge ${isWsConnected ? 'online' : 'standby'}">
              ${isWsConnected ? '● WebSocket Bridge Online' : '● Tailscale Fallback Mode'}
            </span>
          </h1>
          <p style="color: #94a3b8;">Hệ thống cầu nối proxy công khai giữa Internet và dàn proxy local của bạn.</p>
          
          <div class="grid">
            <div class="stat-card">
              <div class="stat-title">Kết nối đang hoạt động</div>
              <div class="stat-value">${activeConnectionsCount}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Tổng số yêu cầu đã phục vụ</div>
              <div class="stat-value">${totalHandledRequests}</div>
            </div>
          </div>

          <div class="section-title">📌 Định dạng Proxy dùng cho Tool / Web Check:</div>
          <div class="code-block">${req.headers.host || 'ten-app.onrender.com'}:443:port29001:matkhau</div>
          <div class="code-block">${req.headers.host || 'ten-app.onrender.com'}:443:port29002:matkhau</div>
          
          <div class="section-title">💡 Lưu ý quan trọng:</div>
          <ul>
            <li>Giao thức kết nối: Chọn <strong>HTTP Proxy</strong> trong tool của bạn.</li>
            <li>Định tuyến cổng: Điền <code>port29001</code>, <code>port29002</code>... vào ô <strong>Username</strong>. Cổng sẽ tự động forward tương ứng.</li>
            <li>UptimeRobot: Đặt giám sát URL <code>https://${req.headers.host || 'ten-app.onrender.com'}/health</code> (Method HEAD hoặc GET, 5 phút/lần).</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

// WebSocket Server để đón kết nối Bridge từ PC (đường dẫn /tunnel và /data)
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const secret = parsed.query.secret;

  // Xác thực Secret Key
  if (secret !== BRIDGE_SECRET) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  // 1. Kênh điều khiển WebSocket Control (/tunnel)
  if (pathname === '/tunnel') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      console.log('[WS-Control] PC Local Bridge vừa kết nối thành công!');
      if (wsControlClient && wsControlClient.readyState === WebSocket.OPEN) {
        wsControlClient.close();
      }
      wsControlClient = ws;

      // Heartbeat giữ kết nối luôn sống
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 15000);

      ws.on('close', () => {
        console.warn('[WS-Control] PC Local Bridge đã ngắt kết nối.');
        clearInterval(pingInterval);
        if (wsControlClient === ws) {
          wsControlClient = null;
        }
      });

      ws.on('error', (err) => {
        console.error('[WS-Control] Lỗi:', err.message);
      });
    });
    return;
  }

  // 2. Kênh truyền dữ liệu cho từng luồng (/data?streamId=...)
  if (pathname === '/data') {
    const streamId = parsed.query.streamId;
    if (!streamId || !pendingStreams.has(streamId)) {
      socket.write('HTTP/1.1 404 Stream Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (dataWs) => {
      const pending = pendingStreams.get(streamId);
      pendingStreams.delete(streamId);
      if (pending && pending.onReady) {
        pending.onReady(dataWs);
      }
    });
    return;
  }

  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
});

// Xử lý HTTPS CONNECT Proxy (Tool gọi CONNECT domain:port)
server.on('connect', (req, clientSocket, head) => {
  totalHandledRequests++;
  activeConnectionsCount++;

  clientSocket.on('close', () => { activeConnectionsCount = Math.max(0, activeConnectionsCount - 1); });
  clientSocket.on('error', () => { activeConnectionsCount = Math.max(0, activeConnectionsCount - 1); });

  // 1. Bóc tách Proxy Authentication
  const authHeader = req.headers['proxy-authorization'];
  let clientUser = '';
  let clientPass = '';

  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      if (idx !== -1) {
        clientUser = decoded.slice(0, idx);
        clientPass = decoded.slice(idx + 1);
      }
    } catch (e) {}
  }

  // Trích xuất số cổng đích từ username (vd: "port29002" -> 29002)
  const portMatch = clientUser.match(/(\d{4,5})/);
  const targetPort = portMatch ? parseInt(portMatch[1], 10) : null;

  if (!targetPort) {
    clientSocket.write('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="Proxy Farm Gateway"\r\n\r\n');
    clientSocket.destroy();
    return;
  }

  // Mật khẩu gửi xuống proxy sing-box local
  const downstreamPass = LOCAL_PROXY_PASS || clientPass;
  const downstreamAuth = Buffer.from(`${LOCAL_PROXY_USER}:${downstreamPass}`).toString('base64');

  // 2. Kết nối tới PC: Ưu tiên qua WebSocket Bridge, nếu không có thì qua Tailscale
  if (wsControlClient && wsControlClient.readyState === WebSocket.OPEN) {
    connectViaWebSocketTunnel(targetPort, req, clientSocket, head, downstreamAuth);
  } else {
    connectViaTailscaleSocks5(targetPort, req, clientSocket, head, downstreamAuth);
  }
});

// Kết nối thông qua WebSocket Bridge
function connectViaWebSocketTunnel(targetPort, req, clientSocket, head, downstreamAuth) {
  const streamId = crypto.randomUUID();

  const timeoutTimer = setTimeout(() => {
    pendingStreams.delete(streamId);
    if (!clientSocket.destroyed) {
      clientSocket.write('HTTP/1.1 504 Gateway Timeout\r\n\r\n');
      clientSocket.destroy();
    }
  }, 10000);

  pendingStreams.set(streamId, {
    onReady: (dataWs) => {
      clearTimeout(timeoutTimer);
      const wsDuplex = WebSocket.createWebSocketStream(dataWs);

      // Gửi lệnh CONNECT tới sing-box local
      const connectReq = `CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\nProxy-Authorization: Basic ${downstreamAuth}\r\n\r\n`;
      wsDuplex.write(connectReq);

      // Đọc phản hồi của sing-box (chờ 200 Connection Established)
      let buffer = '';
      function onData(chunk) {
        buffer += chunk.toString('utf8');
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          wsDuplex.removeListener('data', onData);
          const firstLine = buffer.slice(0, buffer.indexOf('\r\n'));
          if (firstLine.includes('200')) {
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            if (head && head.length > 0) wsDuplex.write(head);
            const remaining = Buffer.from(buffer.slice(headerEnd + 4), 'utf8');
            if (remaining.length > 0) clientSocket.write(remaining);

            // Bắt đầu truyền dữ liệu song phương
            clientSocket.pipe(wsDuplex).pipe(clientSocket);
          } else {
            clientSocket.write(buffer);
            clientSocket.destroy();
            wsDuplex.destroy();
          }
        }
      }

      wsDuplex.on('data', onData);
      wsDuplex.on('error', () => clientSocket.destroy());
      clientSocket.on('error', () => wsDuplex.destroy());
    }
  });

  // Báo cho PC mở kết nối tới cổng targetPort
  wsControlClient.send(JSON.stringify({
    type: 'open',
    streamId: streamId,
    targetPort: targetPort
  }));
}

// Kết nối thông qua Tailscale SOCKS5 Gateway (localhost:1055 của container)
function connectViaTailscaleSocks5(targetPort, req, clientSocket, head, downstreamAuth) {
  // Kết nối tới daemon socks5 của Tailscale
  const socksSocket = net.connect(1055, '127.0.0.1');

  socksSocket.setTimeout(10000, () => {
    socksSocket.destroy();
    if (!clientSocket.destroyed) {
      clientSocket.write('HTTP/1.1 504 Gateway Timeout\r\n\r\n');
      clientSocket.destroy();
    }
  });

  socksSocket.once('connect', () => {
    // SOCKS5 Handshake
    socksSocket.write(Buffer.from([0x05, 0x01, 0x00]));
  });

  socksSocket.once('data', (data) => {
    if (data[0] !== 0x05 || data[1] !== 0x00) {
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.destroy();
      socksSocket.destroy();
      return;
    }

    // Kết nối tới TARGET_TAILSCALE_IP:targetPort
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(TARGET_TAILSCALE_IP);
    let connectReq;
    if (isIPv4) {
      const parts = TARGET_TAILSCALE_IP.split('.').map(Number);
      connectReq = Buffer.from([0x05, 0x01, 0x00, 0x01, parts[0], parts[1], parts[2], parts[3], (targetPort >> 8) & 0xff, targetPort & 0xff]);
    } else {
      const hostBuf = Buffer.from(TARGET_TAILSCALE_IP);
      connectReq = Buffer.concat([
        Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]),
        hostBuf,
        Buffer.from([(targetPort >> 8) & 0xff, targetPort & 0xff])
      ]);
    }

    socksSocket.once('data', (resp) => {
      if (resp[0] !== 0x05 || resp[1] !== 0x00) {
        clientSocket.write('HTTP/1.1 502 Bad Gateway (Tailscale Target Unreachable)\r\n\r\n');
        clientSocket.destroy();
        socksSocket.destroy();
        return;
      }

      // Đã thông tuyến tới sing-box local, gửi CONNECT handshake
      socksSocket.setTimeout(0);
      const reqPayload = `CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\nProxy-Authorization: Basic ${downstreamAuth}\r\n\r\n`;
      socksSocket.write(reqPayload);

      let buffer = '';
      function onData(chunk) {
        buffer += chunk.toString('utf8');
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          socksSocket.removeListener('data', onData);
          const firstLine = buffer.slice(0, buffer.indexOf('\r\n'));
          if (firstLine.includes('200')) {
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            if (head && head.length > 0) socksSocket.write(head);
            const remaining = Buffer.from(buffer.slice(headerEnd + 4), 'utf8');
            if (remaining.length > 0) clientSocket.write(remaining);

            clientSocket.pipe(socksSocket).pipe(clientSocket);
          } else {
            clientSocket.write(buffer);
            clientSocket.destroy();
            socksSocket.destroy();
          }
        }
      }

      socksSocket.on('data', onData);
      socksSocket.on('error', () => clientSocket.destroy());
      clientSocket.on('error', () => socksSocket.destroy());
    });

    socksSocket.write(connectReq);
  });

  socksSocket.on('error', (err) => {
    if (!clientSocket.destroyed) {
      clientSocket.write('HTTP/1.1 502 Bad Gateway (No Bridge/Tailscale Connection)\r\n\r\n');
      clientSocket.destroy();
    }
  });
}

// Xử lý plain HTTP
function handlePlainHttpProxy(req, res) {
  // Đơn giản hóa: Phản hồi hướng dẫn dùng CONNECT
  res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Vui lòng sử dụng HTTPS/CONNECT Proxy hoặc kiểm tra cấu hình Tool.');
}

server.listen(PORT, () => {
  console.log(`[Bridge Server] Đang lắng nghe trên cổng ${PORT}`);
  console.log(`[Bridge Server] Sẵn sàng phục vụ kết nối đa luồng song song.`);
});
