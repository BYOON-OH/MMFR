# 🚀 Real-time Quant Terminal (실시간 퀀트 터미널)

바이낸스(Binance)의 선물 데이터와 글로벌 거시 경제 지표를 결합하여 실시간으로 시장을 분석할 수 있는 웹 기반 퀀트 대시보드입니다.

## ✨ Key Features (주요 기능)

### 📊 Crypto Market Data (실시간 코인 데이터)
- **Live Price & 24h Change**: WebSocket을 이용한 실시간 가격 변동 및 24시간 변동률 모니터링.
- **Real-time Liquidation Map**: 시장의 급격한 청산 물량을 실시간으로 갱신 및 표시.
- **BTC Dominance & OI**: 비트코인 도미넌스 및 미결제약정(Open Interest) 데이터 제공.
- **Funding Rate & Countdown**: 실시간 펀딩비 확인 및 다음 결제 시간 카운트다운.
- **Long/Short Ratio**: 5분 단위의 실시간 롱/숏 포지션 비율 시각화.

### 🌎 Global Macro Indicator (거시 경제 지표)
- **Market Indexes**: 나스닥, S&P500, 코스피 지수 실시간 추적.
- **Asset Classes**: 금, 은, 달러 환율(USDKRW), 10년물 국채 금리 데이터 제공.
- **Fear & Greedy Index**: 시장 심리를 한눈에 파악하는 그라데이션 게이지 인디케이터.
- **Global Market Sessions**: 도쿄, 런던, 뉴욕 세션의 개장 상태를 실시간 라이트(Dot)로 표시.

### 💻 Technical Highlights (기술적 특징)
- **Full Responsive Design**: 데스크탑부터 모바일까지 기기 크기에 맞춰 최적화된 레이아웃 제공.
- **Server-Side Integration**: Node.js 서버를 통한 효율적인 API 캐싱 및 관리.
- **Interactive Charts**: TradingView 위젯 연동으로 즉각적인 기술적 분석 가능.
- **Visual Feedback**: 가격 변동 시 색상 번쩍임(Flash) 효과로 직관적인 인식 지원.

## 🛠 Tech Stack (기술 스택)

- **Frontend**: HTML5, CSS3 (Flexbox/Grid), JavaScript (ES6+), Socket.io Client
- **Backend**: Node.js, Express, Socket.io, Axios
- **API/Data**: Binance Futures API, Yahoo Finance, Alternative.me (F&G), CoinGecko

## 🚀 How to Run (실행 방법)

1. 저장소를 클론합니다.
2. 필요한 패키지를 설치합니다.
3. 서버를 구동합니다.

This project is open-sourced under the MIT License.
