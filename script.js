const socket = io(); // 서버 연결
const prevPrices = {};
let nextFundingTime = 0;

// 1. 서버로부터 데이터 수신 (접속 즉시 실행)
socket.on('initData', (data) => {
    updateUI(data);
});

socket.on('serverUpdate', (data) => {
    updateUI(data);
});

function updateUI(data) {
    // 매크로 지수 업데이트
    for (const [id, val] of Object.entries(data.macro)) {
        const pEl = document.getElementById(`price-${id}`);
        const cEl = document.getElementById(`pct-${id}`);
        if (pEl) pEl.innerText = val.price.toLocaleString(undefined, {maximumFractionDigits: 2}) + (id==='us10y'?'%':'');
        if (cEl) {
            cEl.innerText = (val.pct >= 0 ? '+' : '') + val.pct + '%';
            cEl.className = `price-chg ${val.pct >= 0 ? 'text-up' : 'text-down'}`;
        }
    }
    // 공포탐욕지수
    document.getElementById('fg-score').innerText = data.fng.value;
    document.getElementById('fg-bar').style.width = data.fng.value + '%';
    const st = document.getElementById('fg-status');
    st.innerText = data.fng.status;
    st.className = `fg-status-label ${parseInt(data.fng.value) > 50 ? 'fg-status-greed' : 'fg-status-extreme-fear'}`;
}

// 2. 바이낸스 실시간 (이건 클라이언트에서 직접 하는게 훨씬 빠름)
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
        if (amt < 5000) return;
        const list = document.getElementById('liq-list');
        const div = document.createElement('div');
        const isLong = o.S === "SELL";
        div.className = `liq-item ${isLong ? 'text-down' : 'text-up'}`;
        div.innerHTML = `<span>${o.s}</span><span>${isLong ? 'LONG' : 'SHORT'}</span><span>$${(amt/1000).toFixed(1)}K</span>`;
        list.prepend(div);
        if (list.children.length > 10) list.lastChild.remove();
        setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, 5000);
    }
};

// 펀딩비 & 롱숏비 (기존과 동일하게 유지하거나 서버로 옮길 수 있음)
async function updateInsights() {
    try {
        const f = await (await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT')).json();
        document.getElementById('btc-funding').innerText = (parseFloat(f.lastFundingRate) * 100).toFixed(4) + '%';
        nextFundingTime = f.nextFundingTime;
        const ls = await (await fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1')).json();
        const ratio = parseFloat(ls[0].longAccount);
        document.getElementById('ls-ratio-text').innerText = `L ${(ratio*100).toFixed(1)}% / S ${((1-ratio)*100).toFixed(1)}%`;
        document.getElementById('long-bar').style.width = (ratio * 100) + '%';
        document.getElementById('short-bar').style.width = ((1 - ratio) * 100) + '%';
    } catch(e){}
}

// 타이머 및 세션 (기존 script.js 내용 동일하게 붙여넣기)
function updateSessions() {
    const now = new Date();
    document.getElementById('current-date').innerText = now.toLocaleString('ko-KR');
    const utcHr = now.getUTCHours() + now.getUTCMinutes()/60;
    const setSess = (id, currentHr, start, end) => {
        const el = document.getElementById(id);
        const isOpen = (start < end) ? (currentHr >= start && currentHr < end) : (currentHr >= start || currentHr < end);
        el.classList.toggle('active', isOpen);
        el.querySelector('.s-status').innerText = isOpen ? 'OPEN' : 'CLOSED';
    };
    setSess('sess-tokyo', (utcHr + 9) % 24, 9, 15.5);
    setSess('sess-london', utcHr % 24, 8, 16.5);
    setSess('sess-newyork', (utcHr - 5 + 24) % 24, 9.5, 16);
}

setInterval(updateSessions, 1000);
setInterval(updateInsights, 30000);
updateInsights();

// 차트 모달 기능 유지
document.addEventListener('click', e => {
    const trigger = e.target.closest('.chart-trigger');
    if (trigger) {
        const symbol = trigger.id.split('-')[1].toUpperCase();
        document.getElementById('chart-modal').style.display = 'block';
        new TradingView.widget({
            "autosize": true, "symbol": `BINANCE:${symbol}USDT.P`,
            "interval": "15", "theme": "dark", "container_id": "tradingview_widget"
        });
    }
    if (e.target.classList.contains('close-modal')) document.getElementById('chart-modal').style.display = 'none';
});