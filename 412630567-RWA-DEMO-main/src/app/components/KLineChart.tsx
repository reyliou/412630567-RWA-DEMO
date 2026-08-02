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
    if (chartContainerRef.current.clientWidth === 0) return; 

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
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 12, // 固定 K 線寬度，避免只有兩三筆時被無限放大
        rightOffset: 5, // 右側留白
      },
    });

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

        volumeSeries = (chart as any).addHistogramSeries({
          color: '#26a69a',
          priceFormat: { type: 'volume' },
          priceScaleId: '', 
          scaleMargins: {
            top: 0.8, 
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

    // 2. 準備資料 (如果資料太少，自動產生過去 30 天的平盤紀錄讓圖表看起來正常)
    const generateData = () => {
      let baseData = [];
      
      if (dataLogs && dataLogs.length > 0) {
        baseData = [...dataLogs];
      } else {
        const today = new Date().toISOString().split('T')[0];
        baseData = [{
          time: today,
          open: currentPrice,
          high: currentPrice,
          low: currentPrice,
          close: currentPrice,
          volume: 0
        }];
      }

      // 如果資料筆數小於 30，我們自動往回推算歷史平盤假資料，避免圖表太空
      if (baseData.length > 0 && baseData.length < 30) {
        const firstPoint = baseData[0];
        const firstDate = new Date(firstPoint.time);
        const paddingData = [];
        
        for (let i = 30 - baseData.length; i > 0; i--) {
          const d = new Date(firstDate);
          d.setDate(d.getDate() - i);
          paddingData.push({
            time: d.toISOString().split('T')[0],
            open: firstPoint.open,
            high: firstPoint.open,
            low: firstPoint.open,
            close: firstPoint.open,
            volume: 0
          });
        }
        baseData = [...paddingData, ...baseData];
      }
      
      return baseData;
    };

    try {
      const data = generateData();
      
      if (candlestickSeries.setData) {
        candlestickSeries.setData(data);
        
        if (volumeSeries) {
          const volumeData = data.map((d: any) => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? '#26a69a80' : '#ef535080' 
          }));
          volumeSeries.setData(volumeData);
        }
      }
      
      // 改用 scrollToRealTime，而不是 fitContent (fitContent 會把少數 K 線強制拉長填滿螢幕)
      chart.timeScale().scrollToRealTime();
      
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
  }, [currentPrice, dataLogs]);

  return (
    <div className="w-full h-full" ref={chartContainerRef} />
  );
}
