// ============================================================
//  🌐  keepAlive.js — سيرفر ويب صغير جداً
//  الهدف الوحيد: يرد "OK" عشان UptimeRobot يعتبر البوت شغال
//  ويرسله بينق كل كم دقيقة فما ينام (خصوصاً لو مستضاف بمكان مجاني)
// ============================================================

const http = require('http');

function keepAlive() {
    const port = process.env.PORT || 3000;

    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Kt-Bot is alive ✅');
    });

    server.listen(port, () => {
        console.log(`🌐 سيرفر الـ Keep-Alive شغال على المنفذ ${port} (لـ UptimeRobot)`);
    });

    return server;
}

module.exports = keepAlive;
