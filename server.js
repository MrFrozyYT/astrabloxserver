const http = require('http');
const https = require('https');

const sessions = {};
const chatMessages = {};
const MAX_CHAT_AGE = 300;
const SESSION_TIMEOUT = 30;

// Self-ping every 5 minutes to keep render.com free tier alive
setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL;
    if (url) {
        https.get(url).on('error', () => {});
    }
}, 5 * 60 * 1000);

http.createServer((req, res) => {
    // Health check
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', players: Object.keys(sessions).length }));
        return;
    }

    const qs = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    const gameId = qs.game_id;
    if (!gameId) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid game_id' }));
        return;
    }

    const now = Date.now() / 1000;
    const username = qs.username;
    const exclude = qs.exclude || '';
    const game = sessions[gameId] = sessions[gameId] || {};

    if (username && qs.pos_x) {
        game[username] = {
            pos_x: parseFloat(qs.pos_x) || 0,
            pos_y: parseFloat(qs.pos_y) || 0,
            pos_z: parseFloat(qs.pos_z) || 0,
            rotation: parseFloat(qs.rotation) || 0,
            head_r: parseInt(qs.head_r) || 243,
            head_g: parseInt(qs.head_g) || 201,
            head_b: parseInt(qs.head_b) || 74,
            torso_r: parseInt(qs.torso_r) || 163,
            torso_g: parseInt(qs.torso_g) || 162,
            torso_b: parseInt(qs.torso_b) || 165,
            leg_r: parseInt(qs.leg_r) || 162,
            leg_g: parseInt(qs.leg_g) || 205,
            leg_b: parseInt(qs.leg_b) || 53,
            wearing_hat: parseInt(qs.wearing_hat) || 0,
            is_admin: parseInt(qs.is_admin) || 0,
            hat_color: qs.hat_color || '',
            wearing_hair: parseInt(qs.wearing_hair) || 0,
            time: now
        };
    }

    if (username && qs.chat_msg) {
        const chat = chatMessages[gameId] = chatMessages[gameId] || [];
        chat.push({ id: chat.length + 1, username, message: String(qs.chat_msg).substring(0, 200), time: now });
    }

    for (const u of Object.keys(game)) {
        if (now - game[u].time > SESSION_TIMEOUT) delete game[u];
    }
    if (chatMessages[gameId]) {
        chatMessages[gameId] = chatMessages[gameId].filter(m => now - m.time < MAX_CHAT_AGE);
    }

    const players = [];
    for (const [k, v] of Object.entries(game)) {
        if (k !== exclude && now - v.time < 15) {
            const p = { ...v, username: k };
            delete p.time;
            players.push(p);
        }
    }

    const lastChatId = parseInt(qs.last_chat_id) || 0;
    const chat = (chatMessages[gameId] || []).filter(m => m.id > lastChatId);

    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ players, chat }));
}).listen(process.env.PORT || 9090, '0.0.0.0', () => {
    const addr = process.env.RENDER_EXTERNAL_URL || `http://0.0.0.0:${process.env.PORT || 9090}`;
    console.log(`MP server running at ${addr}`);
});
