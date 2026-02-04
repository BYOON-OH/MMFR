const express = require('express');
const axios = require('axios');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// 서버 데이터 캐시 초기값
let serverCache = { 
    macro: {}, 
    fng: { value: "50", status: "NEUTRAL" } 
};

const MACRO_SYMBOLS = { 
    'nasdaq': '^IXIC', 'snp': '^GSPC', 'gold': 'GC=F', 
    'silver': 'SI=F', 'us10y': '^TNX', 'kospi': '^KS11', 
    'usdkrw': 'KRW=X', 'vix': '^VIX' 
};

// 데이터 수집 함수 (에러 핸들링 강화)
async function fetchAllData() {
    // 1. 야후 파이낸스 데이터
    for (const [id, sym] of Object.entries(MACRO_SYMBOLS)) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`;
            const res = await axios.get(url, { timeout: 5000 });
            if (res.data && res.data.chart && res.data.chart.result) {
                const m = res.data.chart.result[0].meta;
                serverCache.macro[id] = { 
                    price: m.regularMarketPrice, 
                    pct: ((m.regularMarketPrice - m.chartPreviousClose) / m.chartPreviousClose * 100).toFixed(2) 
                };
            }
        } catch (e) {
            console.error(`Macro fetch error (${id}):`, e.message);
        }
    }

    // 2. 공포 탐욕 지수
    try {
        const res = await axios.get('https://api.alternative.me/fng/?limit=1', { timeout: 5000 });
        if (res.data && res.data.data) {
            serverCache.fng = { 
                value: res.data.data[0].value, 
                status: res.data.data[0].value_classification.toUpperCase() 
            };
        }
    } catch (e) {
        console.error("FnG fetch error:", e.message);
    }

    io.emit('serverUpdate', serverCache);
}

// 10초마다 데이터 갱신
setInterval(fetchAllData, 10000);
fetchAllData();

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.emit('initData', serverCache);
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}).on('error', (err) => {
    console.error("Server Start Error:", err.message);
});
