const socket = io();
const prevPrices = {};
let nextFundingTime = 0;

// 서버 데이터 처리 (F&G, 매크로)
socket.on('initData', d => updateServerUI(d));
socket.on('serverUpdate', d => updateServerUI(d));

function updateServerUI(data) {
    if(!data) return;
    // 매크로 지수
    for (const [id, val] of Object.entries(data.macro || {})) {
        const pEl = document.getElementById(`price-${id}`);
        const cEl = document.getElementById(`pct-${id}`);
        if (pEl) pEl.innerText = val.price.toLocaleString(undefined, {maximumFractionDigits: 2}) + (id==='us10y'?'%':'');
        if (cEl) {
            cEl.innerText = (val.pct >= 0 ? '+' : '') + val.pct + '%';
            cEl.className = `price-chg ${val.pct >= 0 ? 'text-up' : 'text-down'}`;
        }
    }
    // F&G 인디케이터
    const score = parseInt(data.fng.value);
    document.getElementById('fg-score').innerText = score || '--';
    document.getElementById('fg-bar').style.width = score + '%';
    const statusEl = document.getElementById('fg-status');
    statusEl.innerText = data.fng.status;
    statusEl.className = `fg-status-label ${score >= 75 ? 'fg-extreme-greed' : score >= 55 ? 'fg-greed' : score <= 25 ? 'fg-extreme-fear' : score <= 45 ? 'fg-fear' : 'fg-neutral'}`;
}

// 바이낸스 실시간 데이터
const ws = new WebSocket(`wss://fstream.binance.com/ws/btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade/xrpusdt@aggTrade/btcusdt@forceOrder`);

ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    
    // 가격 업데이트
    if (d.e === "aggTrade") {
        const id = d.s.replace('USDT','').toLowerCase();
        const p = parseFloat(d.p);
        const el = document.getElementById(`price-${id}`);
        if (el) {
            el.innerText = p.toLocaleString(undefined, {minimumFractionDigits: id==='xrp'?4:2});
            const card = document.getElementById(`card-${id}`);
            if (prevPrices[id] && p !== prevPrices[id]) {
                card.classList.remove('flash-up', 'flash-down');
                void card.offsetWidth;
                card.classList.add(p > prevPrices[id] ? 'flash-up' : 'flash-down');
            }
        }
        prevPrices[id] = p;
    }

    // [수정] 청산맵(Force Order) 로직 개선
    if (d.e === "forceOrder") {
        const o = d.o;
        const amt = parseFloat(o.q) * parseFloat(o.p);
        if (amt < 1000) return; // 필터링

        const list = document.getElementById('liq-list-content');
        const row = document.createElement('div');
        const isLong = o.S === "SELL";
        row.className = `liq-row ${isLong ? 'text-down' : 'text-up'}`;
        row.innerHTML = `<span>${o.s.replace('USDT','')}</span><span>${isLong?'LONG':'SHORT'}</span><span>$${(amt/1000).toFixed(1)}K</span>`;
        
        list.prepend(row);
        if (list.children.length > 10) list.lastChild.remove();
    }
};

// [수정] 퀀트 인사이트 (도미넌스, OI, 펀딩비, 롱숏비)
async function updateMarketIntelligence() {
    try {
        // 1. 코인 변동률 및 펀딩비
        const [tickers, f] = await Promise.all([
            fetch('https://fapi.binance.com/fapi/v1/ticker/24hr').then(r => r.json()),
            fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT').then(r => r.json())
        ]);

        // 펀딩비 & 타이머 업데이트
        document.getElementById('btc-funding').innerText = (parseFloat(f.lastFundingRate) * 100).toFixed(4) + '%';
        nextFundingTime = f.nextFundingTime;

        // 2. 롱숏 비율 (BTC 5분봉 기준)
        const lsData = await fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1').then(r => r.json());
        const longRatio = parseFloat(lsData[0].longAccount);
        const shortRatio = 1 - longRatio;
        document.getElementById('long-pct').innerText = (longRatio * 100).toFixed(1) + '%';
        document.getElementById('short-pct').innerText = (shortRatio * 100).toFixed(1) + '%';
        document.getElementById('long-bar').style.width = (longRatio * 100) + '%';
        document.getElementById('short-bar').style.width = (shortRatio * 100) + '%';

        // 3. 미결제약정 (OI)
        const oiData = await fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT').then(r => r.json());
        const btcPrice = prevPrices['btc'] || 95000;
        document.getElementById('btc-oi').innerText = `$${(parseFloat(oiData.openInterest) * btcPrice / 1000000000).toFixed(2)}B`;

        // 4. 비트코인 도미넌스
        const globalData = await fetch('https://api.coingecko.com/api/v3/global').then(r => r.json());
        document.getElementById('btc-dom').innerText = globalData.data.market_cap_percentage.btc.toFixed(1) + "%";

    } catch(e) { console.error("Intel Load Fail", e); }
}

// 타이머 및 세션 (생략 없이 유지)
function runTimers() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('current-date').innerText = now.toLocaleString('ko-KR');
        
        // 펀딩비 카운트다운
        if (nextFundingTime) {
            const diff = nextFundingTime - Date.now();
            if (diff > 0) {
                const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
                document.getElementById('funding-timer').innerText = `${h}:${m}:${s}`.replace(/\b\d\b/g, "0$&");
            }
        }

        // 세션 체크 (UTC 기준)
        const utcHr = now.getUTCHours() + now.getUTCMinutes()/60;
        const check = (id, hr, s, e) => {
            const el = document.getElementById(id);
            const open = (s < e) ? (hr >= s && hr < e) : (hr >= s || hr < e);
            el.classList.toggle('active', open);
            el.querySelector('.s-status').innerText = open ? 'OPEN' : 'CLOSED';
        };
        check('sess-tokyo', (utcHr + 9) % 24, 9, 15.5);
        check('sess-london', utcHr % 24, 8, 16.5);
        check('sess-newyork', (utcHr - 5 + 24) % 24, 9.5, 16);
    }, 1000);
}

// 초기화
runTimers();
updateMarketIntelligence();
setInterval(updateMarketIntelligence, 30000);
