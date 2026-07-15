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

    // 2. 轉換資料庫的歷史估價 (valuation_logs) 為 K 線資料 (OHLC)
    const generateData = () => {
      if (dataLogs && dataLogs.length > 0) {
        // 使用真實資料庫的 valuation_logs 轉換
        // 將紀錄按日期分組以計算 OHLC (雖然房產通常一天只有一個估值)
        const dailyData = new Map<string, { open: number; high: number; low: number; close: number }>();
        
        dataLogs.forEach(log => {
          // 確保 date 格式是 YYYY-MM-DD
          const dateStr = new Date(log.recorded_at).toISOString().split('T')[0];
          const val = Number(log.value);
          
          if (!dailyData.has(dateStr)) {
            dailyData.set(dateStr, { open: val, high: val, low: val, close: val });
          } else {
            const current = dailyData.get(dateStr)!;
            current.high = Math.max(current.high, val);
            current.low = Math.min(current.low, val);
            current.close = val; // 最後一筆為收盤
          }
        });

        // 轉換 Map 為陣列並按日期排序
        const sortedData = Array.from(dailyData.entries())
          .map(([time, prices]) => ({ time, ...prices }))
          .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
          
        return sortedData;
      }

      // 如果資料庫真的完全沒有歷史紀錄，只顯示最新價格的單一蠟燭圖
      const today = new Date().toISOString().split('T')[0];
      return [{
        time: today,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice
      }];
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
