const socket = io();
const prevPrices = {};
let nextFundingTime = 0;

socket.on('initData', d => updateServerUI(d));
socket.on('serverUpdate', d => updateServerUI(d));

function updateServerUI(data) {
    if(!data || !data.macro) return;
    for (const [id, val] of Object.entries(data.macro)) {
        const pEl = document.getElementById(`price-${id}`);
        const cEl = document.getElementById(`pct-${id}`);
        if (pEl) pEl.innerText = parseFloat(val.price).toLocaleString(undefined, {maximumFractionDigits: 2});
        if (cEl) {
            cEl.innerText = (val.pct >= 0 ? '+' : '') + val.pct + '%';
            cEl.className = `price-chg ${val.pct >= 0 ? 'text-up' : 'text-down'}`;
        }
    }
    const score = parseInt(data.fng.value);
    document.getElementById('fg-score').innerText = score || '--';
    document.getElementById('fg-bar').style.width = score + '%';
    const statusEl = document.getElementById('fg-status');
    if(statusEl) {
        statusEl.innerText = data.fng.status;
        const colorClass = score <= 30 ? 'text-down' : (score >= 70 ? 'text-up' : 'text-neutral');
        statusEl.style.color = `var(--${score <= 30 ? 'down' : (score >= 70 ? 'up' : 'accent')})`;
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
        if (amt < 1000) return;
        const list = document.getElementById('liq-list');
        const div = document.createElement('div');
        const isLongLiq = o.S === "SELL";
        div.className = `liq-item ${isLongLiq ? 'text-down' : 'text-up'}`;
        div.innerHTML = `<span>${o.s.replace('USDT','')}</span><span>${isLongLiq ? 'LONG' : 'SHORT'}</span><span>$${(amt/1000).toFixed(1)}K</span>`;
        list.prepend(div);
        if (list.children.length > 10) list.lastChild.remove();
    }
};

async function updateCoinInsights() {
    try {
        const f = await (await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT')).json();
        document.getElementById('btc-funding').innerText = (parseFloat(f.lastFundingRate) * 100).toFixed(4) + '%';
        nextFundingTime = f.nextFundingTime;

        const ls = await (await fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1')).json();
        const ratio = parseFloat(ls[0].longAccount);
        document.getElementById('ls-ratio-text').innerText = `${(ratio*100).toFixed(1)}% / ${((1-ratio)*100).toFixed(1)}%`;
        document.getElementById('long-bar').style.width = (ratio * 100) + '%';
        document.getElementById('short-bar').style.width = ((1 - ratio) * 100) + '%';

        const oiRes = await (await fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT')).json();
        document.getElementById('btc-oi').innerText = `$${(parseFloat(oiRes.openInterest) * (prevPrices['btc']||95000) / 1000000000).toFixed(2)}B`;

        const domRes = await (await fetch('https://api.coingecko.com/api/v3/global')).json();
        document.getElementById('btc-dom').innerText = domRes.data.market_cap_percentage.btc.toFixed(1) + "%";
        
        generateAIInsight(ratio, parseFloat(f.lastFundingRate), parseInt(document.getElementById('fg-score').innerText));
    } catch(e) {}
}

function generateAIInsight(lsRatio, funding, fng) {
    const aiEl = document.getElementById('ai-briefing');
    let text = "현재 ";
    if (fng > 70) text += "탐욕 지수가 높아 고점 경계가 필요합니다. ";
    else if (fng < 30) text += "과매도 구간으로 분할 매수 기회를 탐색하세요. ";
    
    if (funding > 0.02) text += "펀딩비가 가열되어 롱 스퀴즈 위험이 감지됩니다. ";
    else if (funding < 0) text += "숏 포지션이 우세하여 반등 시 숏 스퀴즈가 가능합니다. ";
    
    text += lsRatio > 0.5 ? "개인 투자자들은 롱 포지션을 선호하고 있습니다." : "현재 시장은 신중한 숏 포지션이 우세합니다.";
    aiEl.innerHTML = text + ' <span class="ai-typing"></span>';
}

function runTimers() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('current-date').innerText = now.toLocaleTimeString();
        const utcHr = now.getUTCHours() + now.getUTCMinutes()/60;
        const setS = (id, hr, s, e) => {
            const el = document.getElementById(id); if(!el) return;
            const open = (s < e) ? (hr >= s && hr < e) : (hr >= s || hr < e);
            el.classList.toggle('active', open);
            el.querySelector('.s-status').innerText = open ? 'OPEN' : 'CLOSED';
        };
        setS('sess-tokyo', (utcHr + 9) % 24, 9, 15.5);
        setS('sess-london', utcHr % 24, 8, 16.5);
        setS('sess-newyork', (utcHr - 5 + 24) % 24, 9.5, 16);

        if (nextFundingTime) {
            const diff = nextFundingTime - Date.now();
            if (diff > 0) {
                const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
                document.getElementById('funding-timer').innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
            }
        }
    }, 1000);
}

document.addEventListener('click', e => {
    const trigger = e.target.closest('.chart-trigger');
    if (trigger) {
        const symbol = trigger.id.split('-')[1].toUpperCase();
        document.getElementById('chart-modal').style.display = 'block';
        document.getElementById('tradingview_widget').innerHTML = '';
        new TradingView.widget({
            "width": "100%", "height": "100%", "symbol": `BINANCE:${symbol}USDT.P`,
            "interval": "15", "theme": "dark", "style": "1", "locale": "ko", "container_id": "tradingview_widget"
        });
    }
    if (e.target.classList.contains('close-modal')) document.getElementById('chart-modal').style.display = 'none';
});

runTimers(); updateCoinInsights(); setInterval(updateCoinInsights, 30000);
