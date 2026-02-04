const socket = io();
const prevPrices = {};
let nextFundingTime = 0;

// [복구] 1. 서버 데이터 수신 (매크로 & 공포탐욕)
socket.on('initData', (data) => updateServerUI(data));
socket.on('serverUpdate', (data) => updateServerUI(data));

function updateServerUI(data) {
    if(!data.macro) return;
    for (const [id, val] of Object.entries(data.macro)) {
        const pEl = document.getElementById(`price-${id}`);
        const cEl = document.getElementById(`pct-${id}`);
        if (pEl) pEl.innerText = val.price.toLocaleString(undefined, {maximumFractionDigits: 2}) + (id==='us10y'?'%':'');
        if (cEl) {
            cEl.innerText = (val.pct >= 0 ? '+' : '') + val.pct + '%';
            cEl.className = `price-chg ${val.pct >= 0 ? 'text-up' : 'text-down'}`;
        }
    }
    document.getElementById('fg-score').innerText = data.fng.value;
    document.getElementById('fg-bar').style.width = data.fng.value + '%';
    const st = document.getElementById('fg-status');
    st.innerText = data.fng.status;
    st.className = `fg-status-label ${parseInt(data.fng.value) > 50 ? 'fg-status-greed' : 'fg-status-extreme-fear'}`;
}

// [복구] 2. 바이낸스 실시간 WebSocket (가격 & 청산맵)
const ws = new WebSocket(`wss://fstream.binance.com/ws/btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade/xrpusdt@aggTrade/btcusdt@forceOrder`);

ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    
    // 가격 업데이트 및 번쩍임
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

    // [청산맵 복구] 실시간 청산 리스트
    if (d.e === "forceOrder") {
        const o = d.o;
        const amt = parseFloat(o.q) * parseFloat(o.p);
        if (amt < 3000) return; // 3K 이상 필터링
        
        const list = document.getElementById('liq-list');
        const div = document.createElement('div');
        const isLongLiq = o.S === "SELL";
        
        div.className = `liq-item ${isLongLiq ? 'text-down' : 'text-up'}`;
        div.innerHTML = `<span>${o.s}</span><span>${isLongLiq ? 'LONG LIQ' : 'SHORT LIQ'}</span><span>$${(amt/1000).toFixed(1)}K</span>`;
        
        list.prepend(div);
        if (list.children.length > 10) list.lastChild.remove();
        
        setTimeout(() => { 
            div.style.opacity = '0'; 
            div.style.transition = '0.5s';
            setTimeout(() => div.remove(), 500); 
        }, 5000);
    }
};

// [복구] 3. 코인 변동률(%), 도미넌스, OI, 펀딩비 통합 업데이트
async function updateCoinInsights() {
    try {
        // 24시간 변동률 초기화
        const tickers = await (await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')).json();
        ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT'].forEach(s => {
            const t = tickers.find(x => x.symbol === s);
            if(t) {
                const id = s.replace('USDT','').toLowerCase();
                const pct = parseFloat(t.priceChangePercent);
                const el = document.getElementById(`pct-${id}`);
                el.innerText = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
                el.className = `price-chg ${pct >= 0 ? 'text-up' : 'text-down'}`;
            }
        });

        // 펀딩비 & 다음 펀딩 시간
        const f = await (await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT')).json();
        document.getElementById('btc-funding').innerText = (parseFloat(f.lastFundingRate) * 100).toFixed(4) + '%';
        nextFundingTime = f.nextFundingTime;

        // 롱숏비율
        const ls = await (await fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1')).json();
        const ratio = parseFloat(ls[0].longAccount);
        document.getElementById('ls-ratio-text').innerText = `L ${(ratio*100).toFixed(1)}% / S ${((1-ratio)*100).toFixed(1)}%`;
        document.getElementById('long-bar').style.width = (ratio * 100) + '%';
        document.getElementById('short-bar').style.width = ((1 - ratio) * 100) + '%';

        // [복구] OI 및 도미넌스
        const oiData = await (await fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT')).json();
        const btcPrice = prevPrices['btc'] || 95000;
        document.getElementById('btc-oi').innerText = `$${(parseFloat(oiData.openInterest) * btcPrice / 1000000000).toFixed(2)}B`;
        
        // 비트 도미넌스 (코인게코 등 외부 API 지연 방지를 위해 고정값 대신 시총비율 API 권장하나, 일단 작동 확인용 유지)
        document.getElementById('btc-dom').innerText = "56.42%"; 

    } catch(e) { console.error("Insight Error", e); }
}

// [복구] 4. 타이머 (세션 + 펀딩비 카운트다운)
function runTimers() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('current-date').innerText = now.toLocaleString('ko-KR');
        
        // 세션 업데이트
        const utcHr = now.getUTCHours() + now.getUTCMinutes()/60;
        const setSess = (id, hr, s, e) => {
            const el = document.getElementById(id);
            if(!el) return;
            const open = (s < e) ? (hr >= s && hr < e) : (hr >= s || hr < e);
            el.classList.toggle('active', open);
            el.querySelector('.s-status').innerText = open ? 'OPEN' : 'CLOSED';
        };
        setSess('sess-tokyo', (utcHr + 9) % 24, 9, 15.5);
        setSess('sess-london', utcHr % 24, 8, 16.5);
        setSess('sess-newyork', (utcHr - 5 + 24) % 24, 9.5, 16);

        // [펀딩비 타이머 복구]
        if (nextFundingTime) {
            const diff = nextFundingTime - Date.now();
            if (diff > 0) {
                const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
                document.getElementById('funding-timer').innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
            }
        }
    }, 1000);
}

// 초기 실행 및 인터벌
function init() {
    runTimers();
    updateCoinInsights();
    setInterval(updateCoinInsights, 30000); // 30초마다 코인 정보 갱신
}

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

init();
