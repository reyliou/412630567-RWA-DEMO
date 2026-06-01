import { Search, MapPin, TrendingUp, Filter, LayoutGrid, List, Check, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import { API_BASE_URL } from "../config";

interface Property {
  id: number;
  name: string;
  addr: string;
  price: number;
  change: string;
  img: string;
  city_tag: string;
  price_display?: string;
  total_value?: number;
}

interface InvestorMarketProps {
  onSelectProperty: (property: Property) => void;
}

export function InvestorMarket({ onSelectProperty }: InvestorMarketProps) {
  const [selectedCity, setSelectedCity] = useState("全部");
  const [searchQuery, setSearchQuery] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);

  const regions = [
    { label: "北部", cities: ["全部", "台北市", "新北市", "桃園市", "新竹市", "新竹縣", "宜蘭縣", "基隆市"] },
    { label: "中部", cities: ["台中市", "彰化縣", "雲林縣", "苗栗縣", "南投縣"] },
    { label: "南部", cities: ["高雄市", "台南市", "嘉義市", "嘉義縣", "屏東縣"] },
    { label: "東部", cities: ["台東縣", "花蓮縣", "澎湖縣", "金門縣", "連江縣"] },
  ];

  useEffect(() => {
    const loadMockData = async () => {
      try {
        // 從後端 API 獲取真實資料庫數據
        const response = await fetch(`${API_BASE_URL}/api/properties`);
        if (response.ok) {
          const data = await response.json();
          // 資料庫欄位對齊：將 title 映射到 name，complete_address 映射到 addr 等
          const mappedData = data.map((p: any) => ({
            id: p.id,
            name: p.title,
            addr: p.complete_address,
            price: parseFloat(p.current_price),
            change: p.status === '交易中' ? '+0.00' : '-0.00',
            img: p.main_image || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400",
            city_tag: p.location,
            total_supply: parseFloat(p.total_supply_x || "100000"), // 抓取資料庫中的總量
            total_value: parseFloat(p.current_price) * parseFloat(p.total_supply_x || "100000") // 動態計算總值
          }));
          setProperties(mappedData);
        }
      } catch (e) {
        console.error("連線 API 失敗，請確保後端伺服器已啟動");
      }
    };
    loadMockData();
  }, []);

  const filteredProperties = properties.filter((p) => {
    const matchesCity = selectedCity === "全部" || p.city_tag === selectedCity;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.city_tag.includes(searchQuery);
    return matchesCity && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="bg-white border border-border p-8 rounded-[3rem] shadow-xl space-y-8 ring-1 ring-slate-100">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-6 top-5.5 w-6 h-6 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋房產案名、關鍵字或縣市..." 
              className="w-full pl-16 pr-6 py-6 bg-slate-50 border-none rounded-3xl focus:ring-4 focus:ring-blue-600/10 outline-none text-xl font-bold text-slate-800 transition-all"
            />
          </div>
          <button className="px-12 py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center gap-3">
            <Search className="w-6 h-6" /> 立即搜尋
          </button>
        </div>

        <div className="space-y-6 pt-2">
          {regions.map((region) => (
            <div key={region.label} className="flex items-start gap-6 border-b border-slate-50 pb-4 last:border-0">
               <div className="w-16 pt-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">{region.label}</span>
               </div>
               <div className="flex-1 flex flex-wrap gap-2">
                  {region.cities.map((city) => (
                    <button
                      key={city}
                      onClick={() => setSelectedCity(city)}
                      className={`px-5 py-2 rounded-xl text-sm font-black transition-all border ${
                        selectedCity === city 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 scale-105' 
                          : 'bg-white text-slate-500 border-slate-100 hover:border-blue-200 hover:text-blue-600'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
               </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 flex items-center justify-between">
         <div className="text-sm font-bold text-slate-500">
            找到 <span className="text-blue-600 font-black text-lg">{filteredProperties.length}</span> 個符合條件的標的
         </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredProperties.map((prop) => {
          const isUp = prop.change.startsWith('+');
          return (
            <div 
              key={prop.id} 
              onClick={() => onSelectProperty(prop)}
              className="group bg-white border border-border rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer"
            >
              <div className="relative h-56 overflow-hidden">
                <img src={prop.img} alt={prop.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute top-4 left-4 flex gap-2">
                   <div className="px-3 py-1 bg-white/90 backdrop-blur shadow-sm rounded-xl text-primary text-[10px] font-black uppercase tracking-widest border border-primary/10">
                    {prop.city_tag}
                   </div>
                   <div className="px-3 py-1 bg-blue-600 text-white shadow-sm rounded-xl text-[10px] font-black uppercase tracking-widest">
                    Live
                   </div>
                </div>
              </div>
              <div className="p-7">
                <h4 className="font-black text-2xl mb-5 text-slate-800 group-hover:text-blue-600 transition-colors leading-tight min-h-[4rem]">{prop.name}</h4>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Price</span>
                    <span className="font-mono font-black text-blue-600 text-2xl">${prop.price}</span>
                  </div>
                  {/* 台灣股市：漲紅跌綠 */}
                  <div className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 ${isUp ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {prop.change}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
