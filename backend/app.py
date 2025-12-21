import os
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import psycopg2

app = Flask(__name__)
CORS(app)

# 設定 Google AI (使用環境變數)
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
if not GOOGLE_API_KEY:
    # 如果本地沒有環境變數，試著讀取 Render 設定的
    pass 
else:
    genai.configure(api_key=GOOGLE_API_KEY)

# 設定模型 (使用最穩定的 Flash-001)
model = genai.GenerativeModel('gemini-1.5-flash-001')

# 取得資料庫連線網址
DATABASE_URL = os.environ.get('DATABASE_URL')

# --- 資料庫連線小幫手 ---
def get_db_connection():
    if not DATABASE_URL:
        print("❌ 錯誤：找不到 DATABASE_URL，請確認 Render 環境變數設定正確")
        return None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"❌ 資料庫連線失敗: {e}")
        return None

# --- 初始化資料庫 (第一次跑的時候建立表格) ---
def init_db():
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            # 建立表格：如果不存在才建立
            cur.execute('''
                CREATE TABLE IF NOT EXISTS dreams (
                    id SERIAL PRIMARY KEY,
                    date TEXT,
                    content TEXT,
                    mood_level INTEGER,
                    analysis TEXT,
                    keywords TEXT[]
                );
            ''')
            conn.commit()
            cur.close()
            conn.close()
            print("✅ 資料庫表格初始化成功！")
        except Exception as e:
            print(f"❌ 初始化表格失敗: {e}")

# 程式啟動時，先檢查表格有沒有建好
with app.app_context():
    init_db()

@app.route('/api/dreams', methods=['GET'])
def get_dreams():
    conn = get_db_connection()
    if not conn:
        return jsonify([]), 500
    
    cur = conn.cursor()
    # 撈取所有資料，按照 ID 倒序排列 (最新的在上面)
    cur.execute('SELECT * FROM dreams ORDER BY id DESC;')
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # 把資料庫的格式 (Tuple) 轉成前端要的 (Dictionary)
    dreams_list = []
    for row in rows:
        dreams_list.append({
            'id': row[0],
            'date': row[1],
            'content': row[2],
            'mood_level': row[3],
            'analysis': row[4],
            'keywords': row[5]  # Postgres 陣列直接對應 Python List
        })
        
    return jsonify(dreams_list)

@app.route('/api/dreams', methods=['POST'])
def add_dream():
    data = request.json
    content = data.get('content')
    mood_level = data.get('mood_level', 3)
    date_str = datetime.datetime.now().strftime("%Y-%m-%d")

    # 1. 呼叫 AI 分析
    analysis_text = "AI 休息中..."
    keywords = ["未分析"]
    
    try:
        prompt = f"請分析這個夢境：『{content}』。1. 給予一段簡短的心理分析建議(50字內)。2. 給出3個情緒關鍵字。格式範例：分析建議|關鍵字1,關鍵字2,關鍵字3"
        response = model.generate_content(prompt)
        if response.text:
            parts = response.text.split('|')
            if len(parts) >= 2:
                analysis_text = parts[0].strip()
                keywords = [k.strip() for k in parts[1].split(',')]
            else:
                analysis_text = response.text
    except Exception as e:
        print(f"AI Error: {e}")

    # 2. 存入資料庫 (PostgreSQL)
    conn = get_db_connection()
    if conn:
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO dreams (date, content, mood_level, analysis, keywords) VALUES (%s, %s, %s, %s, %s) RETURNING id;',
            (date_str, content, mood_level, analysis_text, keywords)
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        # 回傳剛剛存好的那一筆
        new_dream = {
            'id': new_id,
            'date': date_str,
            'content': content,
            'mood_level': mood_level,
            'analysis': analysis_text,
            'keywords': keywords
        }
        return jsonify(new_dream), 201
    else:
        return jsonify({"error": "Database connection failed"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)