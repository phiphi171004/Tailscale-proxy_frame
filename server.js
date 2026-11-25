const http = require('http');

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  const url = req.url ? req.url.split('?')[0] : '/';
  const method = req.method ? req.method.toUpperCase() : 'GET';

  // 1. Phục vụ UptimeRobot (HEAD hoặc GET trên /health, /healthz, /ping, hoặc HEAD trên /)
  const isHealthCheck = url === '/health' || url === '/healthz' || url === '/ping';
  const isHeadRoot = method === 'HEAD' && url === '/';

  if (isHealthCheck || isHeadRoot) {
    console.log(`[Keep-Alive] Nhận yêu cầu ${method} ${url} lúc ${new Date().toISOString()}`);
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
        timestamp: new Date().toISOString(),
      }));
    }
    return;
  }

  // 2. Trang chủ hiển thị thông tin trực quan khi truy cập bằng trình duyệt (GET /)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Tailscale Proxy Bridge on Render</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; background: #0f172a; color: #f8fafc; line-height: 1.6; }
          .card { background: #1e293b; padding: 28px; border-radius: 12px; max-width: 650px; margin: 0 auto; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.3); border: 1px solid #334155; }
          h1 { color: #38bdf8; margin-top: 0; font-size: 22px; }
          .badge { display: inline-block; background: #059669; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
          .endpoint { background: #0f172a; border: 1px solid #334155; padding: 12px 16px; border-radius: 8px; font-family: monospace; font-size: 14px; margin: 12px 0; color: #a5f3fc; }
          .note { font-size: 14px; color: #94a3b8; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">● Online 24/7</span>
          <h1>Tailscale Proxy Bridge is Running</h1>
          <p>Dịch vụ container trên Render đã khởi động thành công và đang kết nối ngầm với mạng riêng ảo Tailscale.</p>
          
          <p><strong>UptimeRobot Keep-Alive Endpoint (Hỗ trợ HEAD & GET):</strong></p>
          <div class="endpoint">HEAD /health  hoặc  GET /health</div>
          
          <p class="note">💡 Dùng URL này gắn vào UptimeRobot (chu kỳ 5 hoặc 10 phút) để Render không bị rơi vào trạng thái ngủ (Sleep).</p>
        </div>
      </body>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Health check endpoint ready: GET/HEAD /health`);
});
