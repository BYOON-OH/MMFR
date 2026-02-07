const prevPrices = {};
let nextFundingTime = 0;

const MACRO_SYMBOLS = { 
    'nasdaq': '^IXIC', 'snp': '^GSPC', 'gold': 'GC=F', 'silver': 'SI=F', 
    'us10y': '^TNX', 'kospi': '^KS11', 'usdkrw': 'KRW=X', 'vix': '^VIX' 
};


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
        div.innerHTML = `<span>${o.s}</span><span>${isLong ? 'LONG LIQ' : 'SHORT LIQ'}</span><span>$${(amt/1000).toFixed(1)}K</span>`;
        list.prepend(div);
        if (list.children.length > 10) list.lastChild.remove();
        setTimeout(() => { 
            div.style.opacity = '0'; 
            div.style.transition = '0.5s'; 
            setTimeout(() => div.remove(), 500); 
        }, 5000);
    }
};


async function updateMacro() {
    for (const [id, sym] of Object.entries(MACRO_SYMBOLS)) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`;
            const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&_=${Date.now()}`;
            const res = await (await fetch(proxy)).json();
            if (res.chart.result) {
                const m = res.chart.result[0].meta;
                const price = m.regularMarketPrice;
                const prev = m.chartPreviousClose;
                const pct = ((price - prev) / prev) * 100;
                document.getElementById(`price-${id}`).innerText = price.toLocaleString(undefined, {maximumFractionDigits: 2}) + (id==='us10y'?'%':'');
                const t = document.getElementById(`pct-${id}`);
                t.innerText = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
                t.className = `price-chg ${pct >= 0 ? 'text-up' : 'text-down'}`;
            }
        } catch(e){}
    }
}


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
        const oi = await (await fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT')).json();
        document.getElementById('btc-oi').innerText = `$${(parseFloat(oi.openInterest) * (prevPrices['btc']||95000) / 1000000000).toFixed(2)}B`;
        document.getElementById('btc-dom').innerText = "54.88%";
    } catch(e){}
}

async function updateFandG() {
    try {
        const r = await (await fetch('https://api.alternative.me/fng/?limit=1')).json();
        const v = parseInt(r.data[0].value);
        document.getElementById('fg-score').innerText = v;
        document.getElementById('fg-bar').style.width = v + '%';
        const st = document.getElementById('fg-status');
        st.innerText = r.data[0].value_classification.toUpperCase();
        st.className = `fg-status-label ${v > 50 ? 'fg-status-greed' : 'fg-status-extreme-fear'}`;
    } catch(e){}
}

async function fetchTickers() {
    const res = await (await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')).json();
    ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT'].forEach(s => {
        const t = res.find(x => x.symbol === s);
        if(t) {
            const id = s.replace('USDT','').toLowerCase();
            const pct = parseFloat(t.priceChangePercent);
            const el = document.getElementById(`pct-${id}`);
            el.innerText = (pct>=0?'+':'') + pct.toFixed(2) + '%';
            el.className = `price-chg ${pct>=0?'text-up':'text-down'}`;
        }
    });
}


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

    if (nextFundingTime) {
        const diff = nextFundingTime - Date.now();
        if (diff > 0) {
            const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
            document.getElementById('funding-timer').innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        }
    }
}

function init() {
    setInterval(updateSessions, 1000);
    updateMacro(); updateInsights(); updateFandG(); fetchTickers();
    setInterval(updateInsights, 30000);
    setInterval(updateMacro, 60000);
}

document.addEventListener('click', e => {
    const trigger = e.target.closest('.chart-trigger');
    if (trigger) {
        const symbol = trigger.id.split('-')[1].toUpperCase();
        document.getElementById('chart-modal').style.display = 'block';
        new TradingView.widget({
            "autosize": true, "symbol": `BINANCE:${symbol}USDT.P`,
            "interval": "15", "theme": "dark", "style": "1", "locale": "ko",
            "container_id": "tradingview_widget"
        });
    }
    if (e.target.classList.contains('close-modal')) document.getElementById('chart-modal').style.display = 'none';
});

init();
