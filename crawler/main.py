import asyncio
import json
import os
import re
import psycopg2
import requests
from playwright.async_api import async_playwright
from dotenv import load_dotenv

# 載入環境變數
load_dotenv(os.path.join(os.path.dirname(__dirname), 'server', '.env'))

# 資料庫連線設定 (改用環境變數，解決密碼明文問題)
DB_CONFIG = {
    "dbname": os.environ.get("DB_DATABASE", "postgres"),
    "user": os.environ.get("DB_USER", "postgres.uowremtggfpoxxruiccw"),
    "password": os.environ.get("DB_PASSWORD", ""),
    "host": os.environ.get("DB_HOST", "aws-1-ap-southeast-2.pooler.supabase.com"),
    "port": os.environ.get("DB_PORT", "6543")
}

# 這裡是本地開發用的，部署後會失效，所以我們優先用 SQL 寫入
REPORT_URL_LOCAL = "http://localhost:3001/api/system/crawler-report"

TAIWAN_CITIES = [
    "台北市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "宜蘭縣", "基隆市",
    "台中市", "臺中市", "彰化縣", "雲林縣", "苗栗縣", "南投縣",
    "高雄市", "台南市", "嘉義市", "嘉義縣", "屏東縣"
]

TARGET_URLS = [
    "https://newhouse.591.com.tw/140249", # 東騰元町
    "https://newhouse.591.com.tw/139920", # 中工雋詠
    "https://newhouse.591.com.tw/138981", # 潤泰之森
]

async def crawl_property(page, url):
    print(f"\n[CRAWL] 正在存取: {url}")
    url_id_match = re.search(r"/(\d+)", url)
    property_id = int(url_id_match.group(1)) if url_id_match else 999999

    has_title = False
    has_price = False
    has_size = False
    has_address = False
    has_city = False
    has_image = False
    
    await page.goto(url, timeout=60000)
    await page.wait_for_timeout(3000)

    title = ""
    try:
        title = await page.locator("h1.build-name").first.inner_text()
        if title: has_title = True
    except: pass
    
    price_text = "0"
    try:
        price_text = await page.locator(".price").first.inner_text()
        if price_text and "待定" not in price_text: has_price = True
    except: pass
    
    price_numbers = re.findall(r"\d+\.?\d*", price_text)
    extracted_price = sum(map(float, price_numbers)) / len(price_numbers) if price_numbers else 0

    size_ping = 35.0
    base_address = ""
    try:
        info_items = await page.locator(".info-item").all()
        for item in info_items:
            text = await item.inner_text()
            if "坪" in text:
                nums = re.findall(r"\d+\.?\d*", text)
                if nums: 
                    size_ping = float(nums[0])
                    has_size = True
            if "基地地址" in text:
                base_address = re.sub(r"(基地地址|查看地圖|：|:|\s)", "", text)
                if base_address: has_address = True
    except: pass

    city_tag = "未分類"
    for city in TAIWAN_CITIES:
        if city in base_address or city in title:
            city_tag = city.replace("臺", "台")
            has_city = True
            break

    thumbnail_url = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400"
    try:
        img_src = await page.locator('meta[property="og:image"]').get_attribute("content", timeout=2000)
        if img_src: 
            thumbnail_url = img_src
            has_image = True
    except: pass

    total_value = size_ping * extracted_price * 10000
    token_price = round(total_value / 100000, 2)
    score = sum([has_title, has_price, has_size, has_address, has_city, has_image])
    data_integrity = (score / 6) * 100

    return {
        "id": property_id,
        "title": title.strip(),
        "location": city_tag, # 修正：使用真實解析出的城市標籤
        "complete_address": base_address,
        "main_image": thumbnail_url,
        "token_symbol": "RWA",
        "total_supply_x": 100000,
        "current_price": token_price,
        "fundraising_goal": total_value,
        "status": "交易中",
        "expected_apy": 4.5,
        "integrity": data_integrity
    }

async def run_crawler():
    print(f"📡 正在連線至雲端資料庫: {DB_CONFIG['host']}...")
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    total_integrity = 0
    success_count = 0
    fail_count = 0

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        for url in TARGET_URLS:
            try:
                data = await crawl_property(page, url)
                query = """
                INSERT INTO properties (id, title, location, complete_address, main_image, token_symbol, total_supply_x, current_price, fundraising_goal, status, expected_apy)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET current_price = EXCLUDED.current_price, main_image = EXCLUDED.main_image;
                """
                cur.execute(query, (data["id"], data["title"], data["location"], data["complete_address"], data["main_image"], data["token_symbol"], data["total_supply_x"], data["current_price"], data["fundraising_goal"], data["status"], data["expected_apy"]))
                conn.commit()
                total_integrity += data["integrity"]
                success_count += 1
                print(f"✅ 雲端同步成功: {data['title']}")
            except Exception as e:
                fail_count += 1
                print(f"❌ 失敗: {e}")

        await browser.close()

        # 關鍵修正：直接使用 SQL 更新雲端指標，確保 Vercel 能讀到最新狀態
        avg_integrity = (total_integrity / success_count) if success_count > 0 else 0
        status_text = "HEALTHY" if fail_count == 0 else "WARNING"
        
        print(f"\n📊 正在同步指標至雲端表格...")
        cur.execute("""
            UPDATE crawler_metrics SET 
            last_run_at = CURRENT_TIMESTAMP + interval '8 hours', 
            consecutive_failures = %s, 
            average_integrity = %s, 
            status = %s 
            WHERE id = 1
        """, (fail_count, round(avg_integrity, 2), status_text))
        conn.commit()

        cur.close()
        conn.close()
        print(f"🎉 雲端數據與指標已完整同步!")

if __name__ == "__main__":
    asyncio.run(run_crawler())
