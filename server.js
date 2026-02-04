const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// 서버 메모리에 저장될 데이터 (초기값)
let serverCache = {
    macro: {},
    fng: { value: "--", status: "LOADING" },
    lastUpdate: null
};

const MACRO_SYMBOLS = { 
    'nasdaq': '^IXIC', 'snp': '^GSPC', 'gold': 'GC=F', 'silver': 'SI=F', 
    'us10y': '^TNX', 'kospi': '^KS11', 'usdkrw': 'KRW=X', 'vix': '^VIX' 
};

// 1. 서버 전용 매크로 수집 함수 (24시간 작동)
async function fetchAllData() {
    console.log("Server fetching fresh data...");
    
    // 매크로 수집
    for (const [id, sym] of Object.entries(MACRO_SYMBOLS)) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`;
            const res = await axios.get(url);
            if (res.data.chart.result) {
                const m = res.data.chart.result[0].meta;
                serverCache.macro[id] = {
                    price: m.regularMarketPrice,
                    prev: m.chartPreviousClose,
                    pct: ((m.regularMarketPrice - m.chartPreviousClose) / m.chartPreviousClose * 100).toFixed(2)
                };
            }
        } catch (e) { console.log(`Error fetching ${id}`); }
    }

    // 공포탐욕지수 수집
    try {
        const res = await axios.get('https://api.alternative.me/fng/?limit=1');
        serverCache.fng = {
            value: res.data.data[0].value,
            status: res.data.data[0].value_classification.toUpperCase()
        };
    } catch (e) {}

    serverCache.lastUpdate = new Date().toLocaleString();
    
    // 접속한 모든 클라이언트에게 최신 데이터 전송
    io.emit('serverUpdate', serverCache);
}

// 2분마다 자동 업데이트 (서버가 스스로 수행)
setInterval(fetchAllData, 120000);
fetchAllData(); 

// 정적 파일 제공 (html, css, js)
app.use(express.static(__dirname));

io.on('connection', (socket) => {
    // 사용자가 접속하자마자 서버에 저장된 밥상을 즉시 차려줌
    socket.emit('initData', serverCache);
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));