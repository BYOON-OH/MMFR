const socket = io();
const prevPrices = {};
let nextFundingTime = 0;

// 서버 데이터 처리
socket.on('serverUpdate', updateServerUI);
socket.on('initData', updateServerUI);

function updateServerUI(data) {
    if (!data) return;
    
    // 매크로 지수
    if (data.macro) {
        Object.entries(data.macro).forEach(([id, val]) => {
            const pEl = document.getElementById(`price-${id}`);
            const cEl = document.getElementById(`pct-${id}`);
            if (pEl) pEl.innerText = val.price.toLocaleString();
            if (cEl) {
                cEl.innerText = (val.pct >= 0 ? '+' : '') + val.pct + '%';
                cEl.className = `price-chg ${val.pct >= 0 ? 'text-up' : 'text-down'}`;
            }
        });
    }

    // F&G
    if (data.fng) {
        const score = parseInt(data.fng.value);
        const scoreEl = document.getElementById('fg-score');
        const barEl = document.getElementById('fg-bar');
        if (scoreEl) scoreEl.innerText = score;
        if (barEl) barEl.style.width = score + '%';
        
        const statusEl = document.getElementById('fg-status');
        if (statusEl) {
            statusEl.innerText = data.fng.status;
            statusEl.className = `fg-status-label ${score >= 70 ? 'fg-extreme-greed' : score <= 30 ? 'fg-extreme-fear' : 'fg-neutral'}`;
        }
    }
}

// 바이낸스 웹소켓
const binanceWS = new WebSocket('wss://fstream.binance.com/ws/btcusdt@aggTrade/ethusdt@aggTrade/btcusdt@forceOrder');

binanceWS.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.e === "aggTrade") {
        const id = d.s.replace('USDT','').toLowerCase();
        const p = parseFloat(d.p);
        const el = document.getElementById(`price-${id}`);
        if (el) {
            el.innerText = p.toLocaleString();
            prevPrices[id] = p;
        }
    }
    if (d.e === "forceOrder") {
        const o = d.o;
        const amt = parseFloat(o.q) * parseFloat(o.p);
        if (amt < 1000) return;
        const list = document.getElementById('liq-list-content');
        if (!list) return;
        const row = document.createElement('div');
        row.className = `liq-row ${o.S === 'SELL' ? 'text-down' : 'text-up'}`;
        row.innerHTML = `<span>${o.s}</span><span>${o.S === 'SELL' ? 'LONG' : 'SHORT'}</span><span>$${(amt/1000).toFixed(1)}K</span>`;
        list.prepend(row);
        if (list.children.length > 15) list.lastChild.remove();
    }
};

// 마켓 인텔리전스 (도미넌스 등)
async function updateIntel() {
    try {
        const f = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT').then(r => r.json());
        document.getElementById('btc-funding').innerText = (parseFloat(f.lastFundingRate) * 100).toFixed(4) + '%';
        nextFundingTime = f.nextFundingTime;

        const ls = await fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1').then(r => r.json());
        const long = parseFloat(ls[0].longAccount);
        document.getElementById('long-pct').innerText = (long * 100).toFixed(1) + '%';
        document.getElementById('short-pct').innerText = ((1-long) * 100).toFixed(1) + '%';
        document.getElementById('long-bar').style.width = (long * 100) + '%';
        document.getElementById('short-bar').style.width = ((1-long) * 100) + '%';
    } catch (e) {}
}

setInterval(updateIntel, 30000);
updateIntel();

// 타이머 및 세션
setInterval(() => {
    const now = new Date();
    document.getElementById('current-date').innerText = now.toLocaleString();
    
    // 세션 로직 (생략 없이 작동 보장)
    const utc = now.getUTCHours() + now.getUTCMinutes()/60;
    const setS = (id, hr, s, e) => {
        const el = document.getElementById(id);
        const open = (s < e) ? (hr >= s && hr < e) : (hr >= s || hr < e);
        if(el) {
            el.classList.toggle('active', open);
            el.querySelector('.s-status').innerText = open ? 'OPEN' : 'CLOSED';
        }
    };
    setS('sess-tokyo', (utc + 9) % 24, 9, 15.5);
    setS('sess-london', utc % 24, 8, 16.5);
    setS('sess-newyork', (utc - 5 + 24) % 24, 9.5, 16);
}, 1000);
