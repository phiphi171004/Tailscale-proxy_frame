const http = require('http');

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  if (req.url === '/healthz' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Tailscale Proxy Bridge on Render</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; background: #0f172a; color: #f8fafc; line-height: 1.6; }
          .card { background: #1e293b; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #334155; }
          h1 { color: #38bdf8; margin-top: 0; font-size: 22px; }
          .badge { display: inline-block; background: #059669; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
          code { background: #334155; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">Online</span>
          <h1>Tailscale Proxy Bridge is Running</h1>
          <p>Dịch vụ container trên Render đã khởi động thành công và đang kết nối ngầm với mạng riêng ảo Tailscale.</p>
          <p>Ứng dụng của bạn có thể gọi thẳng tới máy tính ở nhà qua dải IP Tailscale của máy bạn.</p>
        </div>
      </body>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});
