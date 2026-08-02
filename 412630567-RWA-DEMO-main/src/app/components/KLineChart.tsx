import { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

interface KLineChartProps {
  currentPrice: number;
  dataLogs?: any[]; // Backend API [{ time, open, high, low, close, volume }]
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

    let candlestickSeries: any;
    let volumeSeries: any;
    
    try {
      if ((chart as any).addCandlestickSeries) {
        candlestickSeries = (chart as any).addCandlestickSeries({
          upColor: '#ef4444', // 台股紅漲
          downColor: '#22c55e', // 台股綠跌
          borderVisible: false,
          wickUpColor: '#ef4444',
          wickDownColor: '#22c55e',
        });

        // 買賣力道 (成交量) 柱狀圖
        volumeSeries = (chart as any).addHistogramSeries({
          color: '#26a69a',
          priceFormat: { type: 'volume' },
          priceScaleId: '', // 將 volume 和 K線分離比例尺
          scaleMargins: {
            top: 0.8, // 柱狀圖佔圖表下方 20%
            bottom: 0,
          },
        });
      }
    } catch (err) {
      console.error('Failed to create series:', err);
    }

    if (!candlestickSeries) {
      chart.remove();
      return;
    }

    // 2. 匯入資料
    const generateData = () => {
      if (dataLogs && dataLogs.length > 0) {
        // dataLogs 現在已經是後端算好的真實市場交易資料 [{time, open, high, low, close, volume}]
        return dataLogs;
      }

      // 沒資料時的預設值
      const today = new Date().toISOString().split('T')[0];
      return [{
        time: today,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        volume: 0
      }];
    };

    try {
      const data = generateData();
      
      if (candlestickSeries.setData) {
        candlestickSeries.setData(data);
        
        if (volumeSeries) {
          // 轉換 volume 資料格式，並根據該根 K 線漲跌設定紅色/綠色 (紅漲綠跌)
          const volumeData = data.map((d: any) => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? '#ef444480' : '#22c55e80' 
          }));
          volumeSeries.setData(volumeData);
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
  }, [currentPrice, dataLogs]); // 當資料改變時重新渲染

  return (
    <div className="w-full h-full" ref={chartContainerRef} />
  );
}
