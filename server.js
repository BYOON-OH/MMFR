const express = require('express');
const axios = require('axios');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

let serverCache = { macro: {}, fng: { value: "--", status: "LOADING" } };
const MACRO_SYMBOLS = { 
    'nasdaq': '^IXIC', 'snp': '^GSPC', 'gold': 'GC=F', 
    'silver': 'SI=F', 'us10y': '^TNX', 'kospi': '^KS11', 
    'usdkrw': 'KRW=X', 'vix': '^VIX' 
};

async function fetchAllData() {
    for (const [id, sym] of Object.entries(MACRO_SYMBOLS)) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`;
            const res = await axios.get(url, { timeout: 8000 });
            if (res.data && res.data.chart && res.data.chart.result) {
                const m = res.data.chart.result[0].meta;
                serverCache.macro[id] = { 
                    price: m.regularMarketPrice, 
                    pct: ((m.regularMarketPrice - m.chartPreviousClose) / m.chartPreviousClose * 100).toFixed(2) 
                };
            }
        } catch (e) { console.log(`[Error] ${id} fetch fail`); }
    }
    try {
        const res = await axios.get('https://api.alternative.me/fng/?limit=1');
        serverCache.fng = { value: res.data.data[0].value, status: res.data.data[0].value_classification.toUpperCase() };
    } catch (e) { console.log(`[Error] FnG fetch fail`); }
    io.emit('serverUpdate', serverCache);
}

setInterval(fetchAllData, 10000); // 10초 동기화
fetchAllData();

app.use(express.static(__dirname));
io.on('connection', (socket) => { socket.emit('initData', serverCache); });

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Quant Terminal Online: Port ${PORT}`));
