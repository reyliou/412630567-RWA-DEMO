import asyncio
import json
import os
import re
from playwright.async_api import async_playwright

# 設定 JSON 儲存路徑
OUTPUT_PATH = os.path.join("..", "src", "mock_sql", "properties.json")

# 根據您提供的圖片，建立台灣縣市清單 (加入「臺」的容錯寫法)
TAIWAN_CITIES = [
    "台北市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "宜蘭縣", "基隆市",
    "台中市", "臺中市", "彰化縣", "雲林縣", "苗栗縣", "南投縣",
    "高雄市", "台南市", "臺南市", "嘉義市", "嘉義縣", "屏東縣",
    "台東縣", "臺東縣", "花蓮縣", "澎湖縣", "金門縣", "連江縣"
]

# --- DEMO 目標網址清單 ---
TARGET_URLS = [
    "https://newhouse.591.com.tw/140249", # 東騰元町
    "https://newhouse.591.com.tw/139920", # 中工雋詠
    "https://newhouse.591.com.tw/138981", # 潤泰之森
]

async def crawl_property(page, url):
    """
    爬取單一房產頁面並執行 RWA 計算
    """
    print(f"\n[CRAWL] 正在存取: {url}")
    
    # 提取 ID
    url_id_match = re.search(r"/(\d+)", url)
    property_id = int(url_id_match.group(1)) if url_id_match else 999999

    await page.goto(url, timeout=60000)
    await page.wait_for_timeout(5000)

    # 1. 抓取建案名稱
    title = await page.locator("h1.build-name").first.inner_text()
    
    # 2. 抓取價格字串
    price_text = ""
    try:
        price_text = await page.locator(".price").first.inner_text()
    except:
        price_text = "0"
    
    price_numbers = re.findall(r"\d+\.?\d*", price_text)
    extracted_price = sum(map(float, price_numbers)) / len(price_numbers) if price_numbers else 0

    # 3. 抓取坪數與基地地址 (整合在同一個迴圈以節省效能)
    size_ping = 0
    base_address = ""
    city_tag = "未分類"

    try:
        info_items = await page.locator(".info-item").all()
        for item in info_items:
            text = await item.inner_text()
            
            # 抓取坪數
            if "坪" in text and size_ping == 0:
                numbers = re.findall(r"\d+\.?\d*", text)
                if numbers:
                    size_ping = sum(map(float, numbers)) / len(numbers)
            
            # 抓取基地地址
            if "基地地址" in text:
                # 移除 "基地地址" 標題、"查看地圖" 按鈕文字及空白
                base_address = re.sub(r"(基地地址|查看地圖|：|:|\s)", "", text)
    except:
        pass

    if size_ping == 0: size_ping = 35.0 # 若抓不到則給予預設值

    # 4. 根據抓到的地址配對縣市標籤
    for city in TAIWAN_CITIES:
        if city in base_address:
            # 將 "臺" 統一轉換為 "台"，讓前端標籤格式一致
            city_tag = city.replace("臺", "台")
            break
            
    # 如果地址裡面沒寫(或沒抓到)，試著從建案名稱找找看有沒有縣市名
    if city_tag == "未分類":
        for city in TAIWAN_CITIES:
            if city in title:
                city_tag = city.replace("臺", "台")
                break

    # 5. 抓取建案縮圖 (OG Image > 輪播圖 > 預設圖)
    thumbnail_url = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&auto=format&fit=crop&q=60"
    try:
        meta_image = await page.locator('meta[property="og:image"]').get_attribute("content", timeout=3000)
        if meta_image:
            thumbnail_url = meta_image
            if thumbnail_url.startswith("//"):
                thumbnail_url = "https:" + thumbnail_url
    except Exception:
        try:
            img_src = await page.locator('.photo-wrap img, .slick-active img').first.get_attribute('src', timeout=3000)
            if img_src:
                thumbnail_url = img_src
        except:
            print(f"  [提示] {title} 無法抓取真實縮圖，將使用預設圖片。")

    # --- RWA 金融邏輯計算 ---
    # 統一將抓到的價格視為「單價」，並強制使用公式計算：坪數 * 單價(萬元) * 10000
    unit_price_wan = extracted_price
    total_value = size_ping * unit_price_wan * 10000
    
    total_supply = 100000
    token_price = round(total_value / total_supply, 2)

    return {
        "id": property_id,
        "name": title.strip(),
        "city_tag": city_tag,                  # <--- 新增欄位：縣市標籤
        "price_display": price_text.strip(),
        "price": token_price,
        "size": round(size_ping, 2),
        "unit_price": round(unit_price_wan, 2),
        "total_value": round(total_value, 2),
        "change": "+0.00",
        "addr": base_address if base_address else "591 實時同步標的", # <--- 寫入真實地址
        "img": thumbnail_url,
        "last_updated": str(asyncio.get_event_loop().time())
    }

async def run_crawler():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={'width': 1280, 'height': 800}
        )
        page = await context.new_page()

        # 讀取現有資料
        all_properties = []
        if os.path.exists(OUTPUT_PATH):
            with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
                try:
                    all_properties = json.load(f)
                except:
                    all_properties = []

        # 遍歷所有網址並抓取
        for url in TARGET_URLS:
            try:
                new_data = await crawl_property(page, url)
                
                # 執行去重邏輯：更新現有或加入新項
                found = False
                for i, p_data in enumerate(all_properties):
                    if p_data["id"] == new_data["id"]:
                        all_properties[i] = new_data
                        found = True
                        break
                if not found:
                    all_properties.append(new_data)

                # 每爬完一個就即時存入 JSON 檔案
                os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
                with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
                    json.dump(all_properties, f, ensure_ascii=False, indent=4)
                
                print(f"✅ 同步成功: [{new_data['city_tag']}] {new_data['name']} (總價: ${new_data['total_value']:,.0f})")
            except Exception as e:
                print(f"❌ 錯誤: 網址 {url} 抓取失敗 -> {e}")

        await browser.close()
        print("\n" + "="*40)
        print("🎉 所有房產數據已成功同步至系統資料庫!")
        print("="*40)

if __name__ == "__main__":
    asyncio.run(run_crawler())