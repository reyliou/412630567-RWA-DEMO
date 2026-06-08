import { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

interface KLineChartProps {
  currentPrice: number;
  dataLogs?: any[];
}

export function KLineChart({ currentPrice, dataLogs }: KLineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. 初始化圖表
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b', // slate-500
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.1)' }, // slate-800 with low opacity
        horzLines: { color: 'rgba(30, 41, 59, 0.1)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#ef4444', // 台灣股市：紅漲
      downColor: '#22c55e', // 台灣股市：綠跌
      borderVisible: false,
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    });

    // 2. 生成擬真的 K 線資料 (OHLC)
    // 實務上這裡應該由後端提供真實的 { time, open, high, low, close }
    const generateData = () => {
      const data = [];
      let basePrice = currentPrice * 0.9; // 從稍低的價格開始畫
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // 產生過去 60 天的數據
      for (let i = 60; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // 加入隨機波動
        const volatility = basePrice * 0.02; 
        const open = basePrice + (Math.random() - 0.5) * volatility;
        const close = open + (Math.random() - 0.5) * volatility;
        const high = Math.max(open, close) + Math.random() * volatility * 0.5;
        const low = Math.min(open, close) - Math.random() * volatility * 0.5;

        data.push({ time, open, high, low, close });
        
        // 趨勢稍微向上，最後一筆會接近 currentPrice
        basePrice = close + (currentPrice - close) * 0.1; 
      }
      
      // 強制最後一筆的收盤價等於 currentPrice
      if (data.length > 0) {
          data[data.length - 1].close = currentPrice;
          if(data[data.length - 1].close > data[data.length - 1].high) data[data.length - 1].high = currentPrice;
          if(data[data.length - 1].close < data[data.length - 1].low) data[data.length - 1].low = currentPrice;
      }

      return data;
    };

    candlestickSeries.setData(generateData());
    chart.timeScale().fitContent();

    // 處理 RWD 縮放
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [currentPrice]); // 當 currentPrice 改變時重新渲染

  return (
    <div className="w-full h-full" ref={chartContainerRef} />
  );
}
