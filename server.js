const express = require('express');
const axios = require('axios');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

let serverCache = { macro: {}, fng: { value: "--", status: "LOADING" } };
const MACRO_SYMBOLS = { 'nasdaq': '^IXIC', 'snp': '^GSPC', 'gold': 'GC=F', 'silver': 'SI=F', 'us10y': '^TNX', 'kospi': '^KS11', 'usdkrw': 'KRW=X', 'vix': '^VIX' };

async function fetchAllData() {
    for (const [id, sym] of Object.entries(MACRO_SYMBOLS)) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`;
            const res = await axios.get(url);
            if (res.data.chart.result) {
                const m = res.data.chart.result[0].meta;
                serverCache.macro[id] = { 
                    price: m.regularMarketPrice, 
                    pct: ((m.regularMarketPrice - m.chartPreviousClose) / m.chartPreviousClose * 100).toFixed(2) 
                };
            }
        } catch (e) {}
    }
    try {
        const res = await axios.get('https://api.alternative.me/fng/?limit=1');
        serverCache.fng = { value: res.data.data[0].value, status: res.data.data[0].value_classification.toUpperCase() };
    } catch (e) {}
    io.emit('serverUpdate', serverCache);
}


setInterval(fetchAllData, 10000); 
fetchAllData();

app.use(express.static(__dirname));
io.on('connection', (socket) => { socket.emit('initData', serverCache); });
http.listen(process.env.PORT || 3000);
