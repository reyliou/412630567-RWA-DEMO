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
    if (chartContainerRef.current.clientWidth === 0) return; // Wait for layout

    // 1. 初始化圖表
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.1)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.1)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // 兼容處理：有些版本的 lightweight-charts API 不同
    let candlestickSeries: any;
    try {
      if ((chart as any).addCandlestickSeries) {
        candlestickSeries = (chart as any).addCandlestickSeries({
          upColor: '#ef4444',
          downColor: '#22c55e',
          borderVisible: false,
          wickUpColor: '#ef4444',
          wickDownColor: '#22c55e',
        });
      } else {
        console.warn('addCandlestickSeries not found, trying fallback');
        // 如果是 v5+ 版本，API 改為 addSeries
        // 這裡我們嘗試動態獲取系列類型，或者使用 addLineSeries 作為保底
        if ((chart as any).addLineSeries) {
           candlestickSeries = (chart as any).addLineSeries({ color: '#ef4444' });
        }
      }
    } catch (err) {
      console.error('Failed to create series:', err);
    }

    if (!candlestickSeries) {
      chart.remove();
      return;
    }

    // 2. 生成擬真的 K 線資料 (OHLC)
    const generateData = () => {
      const data = [];
      let basePrice = currentPrice * 0.9;
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      for (let i = 60; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const volatility = basePrice * 0.02; 
        const open = basePrice + (Math.random() - 0.5) * volatility;
        const close = open + (Math.random() - 0.5) * volatility;
        const high = Math.max(open, close) + Math.random() * volatility * 0.5;
        const low = Math.min(open, close) - Math.random() * volatility * 0.5;

        data.push({ time, open, high, low, close });
        basePrice = close + (currentPrice - close) * 0.1; 
      }
      
      if (data.length > 0) {
          const last = data[data.length - 1];
          last.close = currentPrice;
          if(last.close > last.high) last.high = currentPrice;
          if(last.close < last.low) last.low = currentPrice;
      }
      return data;
    };

    try {
      const data = generateData();
      // 如果是 LineSeries (保底方案)，資料格式不同
      if (candlestickSeries.setData) {
        if ((chart as any).addCandlestickSeries) {
          candlestickSeries.setData(data);
        } else {
          candlestickSeries.setData(data.map(d => ({ time: d.time, value: d.close })));
        }
      }
      chart.timeScale().fitContent();
    } catch (err) {
      console.error('Failed to set data:', err);
    }

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
