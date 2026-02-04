const socket = io();
const prevPrices = {};
let nextFundingTime = 0;

socket.on('initData', data => updateServerUI(data));
socket.on('serverUpdate', data => updateServerUI(data));

function updateServerUI(data) {
    if(!data || !data.macro) return;
    for (const [id, val] of Object.entries(data.macro)) {
        const pEl = document.getElementById(`price-${id}`);
        const cEl = document.getElementById(`pct-${id}`);
        if (pEl) pEl.innerText = val.price.toLocaleString(undefined, {maximumFractionDigits: 2}) + (id==='us10y'?'%':'');
        if (cEl) {
            cEl.innerText = (val.pct >= 0 ? '+' : '') + val.pct + '%';
            cEl.className = `price-chg ${val.pct >= 0 ? 'text-up' : 'text-down'}`;
        }
    }
    const score = parseInt(data.fng.value);
    const scoreEl = document.getElementById('fg-score');
    const statusEl = document.getElementById('fg-status');
    const barEl = document.getElementById('fg-bar');
    if(scoreEl) scoreEl.innerText = score || '--';
    if(barEl) barEl.style.width = score + '%';
    if(statusEl) {
        statusEl.innerText = data.fng.status;
        let colorClass = 'fg-neutral';
        if(score <= 25) colorClass = 'fg-extreme-fear';
        else if(score <= 45) colorClass = 'fg-fear';
        else if(score >= 75) colorClass = 'fg-extreme-greed';
        else if(score >= 55) colorClass = 'fg-greed';
        statusEl.className = `fg-status-label ${colorClass}`;
        if(scoreEl) scoreEl.className = `fg-score ${colorClass}`;
    }
}

const ws = new WebSocket(`wss://fstream.binance.com/ws/btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade/xrpusdt@aggTrade/btcusdt@forceOrder`);
ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.e === "aggTrade") {
        const id = d.s.replace('USDT','').toLowerCase();
        const p = parseFloat(d.p);
        const el = document.getElementById(`price-${id}`);
        const card = document.getElementById(`card-${id}`);
        if (el) {
            el.innerText = p.toLocaleString(undefined, {minimumFractionDigits: id==='xrp'?4:2});
            if (prevPrices[id] && p !== prevPrices[id]) {
                card.classList.remove('flash-up', 'flash-down');
                void card.offsetWidth; 
                card.classList.add(p > prevPrices[id] ? 'flash-up' : 'flash-down');
            }
        }
        prevPrices[id] = p;
    }
    if (d.e === "forceOrder") {
        const o = d.o;
        const amt = parseFloat(o.q) * parseFloat(o.p);
        if (amt < 2000) return;
        const list = document.getElementById('liq-list');
        const div = document.createElement('div');
        const isLongLiq = o.S === "SELL";
        div.className = `liq-item ${isLongLiq ? 'text-down' : 'text-up'}`;
        div.innerHTML = `<span>${o.s}</span><span>${isLongLiq ? 'LONG' : 'SHORT'}</span><span>$${(amt/1000).toFixed(1)}K</span>`;
        list.prepend(div);
        if (list.children.length > 12) list.lastChild.remove();
        setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, 5000);
    }
};

async function updateCoinInsights() {
    try {
        const tickers = await (await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')).json();
        ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT'].forEach(s => {
            const t = tickers.find(x => x.symbol === s);
            if(t) {
                const id = s.replace('USDT','').toLowerCase();
                const pct = parseFloat(t.priceChangePercent);
                const el = document.getElementById(`pct-${id}`);
                if(el) {
                    el.innerText = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
                    el.className = `price-chg ${pct >= 0 ? 'text-up' : 'text-down'}`;
                }
            }
        });
        const f = await (await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT')).json();
        document.getElementById('btc-funding').innerText = (parseFloat(f.lastFundingRate) * 100).toFixed(4) + '%';
        nextFundingTime = f.nextFundingTime;
        const ls = await (await fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1')).json();
        const ratio = parseFloat(ls[0].longAccount);
        document.getElementById('ls-ratio-text').innerText = `L ${(ratio*100).toFixed(1)}% / S ${((1-ratio)*100).toFixed(1)}%`;
        document.getElementById('long-bar').style.width = (ratio * 100) + '%';
        document.getElementById('short-bar').style.width = ((1 - ratio) * 100) + '%';
        const oiRes = await (await fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT')).json();
        document.getElementById('btc-oi').innerText = `$${(parseFloat(oiRes.openInterest) * (prevPrices['btc']||95000) / 1000000000).toFixed(2)}B`;
        const domRes = await (await fetch('https://api.coingecko.com/api/v3/global')).json();
        document.getElementById('btc-dom').innerText = domRes.data.market_cap_percentage.btc.toFixed(2) + "%";
    } catch(e) {}
}

function runTimers() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('current-date').innerText = now.toLocaleString('ko-KR');
        const utcHr = now.getUTCHours() + now.getUTCMinutes()/60;
        const setSess = (id, hr, s, e) => {
            const el = document.getElementById(id); if(!el) return;
            const open = (s < e) ? (hr >= s && hr < e) : (hr >= s || hr < e);
            el.classList.toggle('active', open);
            el.querySelector('.s-status').innerText = open ? 'OPEN' : 'CLOSED';
        };
        setSess('sess-tokyo', (utcHr + 9) % 24, 9, 15.5);
        setSess('sess-london', utcHr % 24, 8, 16.5);
        setSess('sess-newyork', (utcHr - 5 + 24) % 24, 9.5, 16);
        if (nextFundingTime) {
            const diff = nextFundingTime - Date.now();
            if (diff > 0) {
                const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
                document.getElementById('funding-timer').innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
            }
        }
    }, 1000);
}

// [차트 복구] TradingView 위젯 크기 강제 설정
document.addEventListener('click', e => {
    const trigger = e.target.closest('.chart-trigger');
    if (trigger) {
        const symbol = trigger.id.split('-')[1].toUpperCase();
        document.getElementById('chart-modal').style.display = 'block';
        
        // 위젯 영역을 비우고 새로 생성
        document.getElementById('tradingview_widget').innerHTML = '';
        new TradingView.widget({
            "width": "100%",
            "height": "100%",
            "symbol": `BINANCE:${symbol}USDT.P`,
            "interval": "15",
            "timezone": "Asia/Seoul",
            "theme": "dark",
            "style": "1",
            "locale": "ko",
            "toolbar_bg": "#f1f3f6",
            "enable_publishing": false,
            "hide_side_toolbar": false,
            "allow_symbol_change": true,
            "container_id": "tradingview_widget"
        });
    }
    if (e.target.classList.contains('close-modal')) {
        document.getElementById('chart-modal').style.display = 'none';
        document.getElementById('tradingview_widget').innerHTML = ''; // 메모리 관리
    }
});

runTimers(); updateCoinInsights(); setInterval(updateCoinInsights, 30000);
