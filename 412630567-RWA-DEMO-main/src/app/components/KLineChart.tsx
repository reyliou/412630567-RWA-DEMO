import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';

interface KLineChartProps {
  currentPrice: number;
  dataLogs?: any[]; // Backend API [{ time, open, high, low, close, volume }]
}

export function KLineChart({ currentPrice, dataLogs }: KLineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 建立圖表 (初始給定 400 寬度防止報錯，稍後由 ResizeObserver 接手)
    const initialWidth = chartContainerRef.current.clientWidth || 400;
    const initialHeight = chartContainerRef.current.clientHeight || 300;
    // 1. 初始化圖表 (深色主題)
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8', // slate-400
      },
      grid: {
        vertLines: { color: 'rgba(51, 65, 85, 0.4)' }, // slate-700
        horzLines: { color: 'rgba(51, 65, 85, 0.4)' },
      },
      width: initialWidth,
      height: initialHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 12, // 固定 K 線寬度，避免只有兩三筆時被無限放大
        rightOffset: 5, // 右側留白
      },
    });

    chartRef.current = chart;

    let candlestickSeries: any;
    let volumeSeries: any;
    
    try {
      if ((chart as any).addCandlestickSeries) {
        candlestickSeries = (chart as any).addCandlestickSeries({
          upColor: '#26a69a', // 綠色上漲 (加密貨幣慣用)
          downColor: '#ef5350', // 紅色下跌
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });
        candlestickSeriesRef.current = candlestickSeries;

        volumeSeries = (chart as any).addHistogramSeries({
          color: '#26a69a',
          priceFormat: { type: 'volume' },
          priceScaleId: '', 
          // 修正 #8: 隱藏成交量的錯誤價格標籤
          lastValueVisible: false,
          priceLineVisible: false,
        });
        volumeSeriesRef.current = volumeSeries;

        // 修正 #6 (原先在外層): 將 scaleMargins 設定在 priceScale 並放進 try 區塊
        chart.priceScale('').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
      }
    } catch (err) {
      console.error('Failed to create series:', err);
    }

    if (!candlestickSeries) {
      chart.remove();
      return;
    }

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 300
        });
      }
    };
    
    // 修正: 解決分頁隱藏時 clientWidth = 0 導致的圖表永久空白問題
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }
    };
  }, []); // 修正 #5: 空的 dependency array，圖表只在 mount 時建立一次

  // 2. 資料更新邏輯 (只呼叫 setData，不重建圖表)
  useEffect(() => {
    if (!candlestickSeriesRef.current || !chartRef.current) return;

    const generateData = () => {
      let baseData = [];
      
      if (dataLogs && dataLogs.length > 0) {
        baseData = [...dataLogs];
      } else {
        // 修正 #9: fallback 日期也改用 UTC+8 台北時間
        const d = new Date();
        const taipeiDate = new Date(d.getTime() + 8 * 60 * 60 * 1000);
        const today = taipeiDate.toISOString().split('T')[0];
        baseData = [{
          time: today,
          open: currentPrice,
          high: currentPrice,
          low: currentPrice,
          close: currentPrice,
          volume: 0
        }];
      }

      // 修正 #2: 拔除 30 天平盤假資料，直接回傳真實數據
      return baseData;
    };

    try {
      const data = generateData();
      
      if (candlestickSeriesRef.current.setData) {
        candlestickSeriesRef.current.setData(data);
        
        if (volumeSeriesRef.current) {
          const volumeData = data.map((d: any) => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? '#26a69a80' : '#ef535080' 
          }));
          volumeSeriesRef.current.setData(volumeData);
        }
      }
      
      // 修正 #5: 移除 scrollToRealTime，避免每次有人交易使用者的視角就被強迫拉回最右邊
      // chartRef.current.timeScale().scrollToRealTime();
      
    } catch (err) {
      console.error('Failed to set data:', err);
    }
  }, [currentPrice, dataLogs]);

  return (
    <div className="w-full h-full" ref={chartContainerRef} />
  );
}
