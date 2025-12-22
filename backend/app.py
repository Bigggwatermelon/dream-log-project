import os
import datetime
import psycopg2
import random
import re # 用來做關鍵字比對
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# --- 安全與資料庫設定 ---
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'my-fixed-secret-key-2025') 
bcrypt = Bcrypt(app)
jwt = JWTManager(app)
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"❌ DB Error: {e}")
        return None

def init_db():
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute('''CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);''')
            # 注意：這裡我們不需要改資料表結構，雷達圖的數據我們可以即時算出來，不用存
            cur.execute('''CREATE TABLE IF NOT EXISTS dreams (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, date TEXT, content TEXT, mood_level INTEGER, analysis TEXT, keywords TEXT[], reality_context TEXT, is_public BOOLEAN DEFAULT FALSE, is_anonymous BOOLEAN DEFAULT FALSE);''')
            cur.execute('''CREATE TABLE IF NOT EXISTS saved_dreams (user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, dream_id INTEGER REFERENCES dreams(id) ON DELETE CASCADE, PRIMARY KEY (user_id, dream_id));''')
            conn.commit(); cur.close(); conn.close()
            print("✅ 資料庫檢查完成")
        except Exception as e: print(f"❌ 初始化失敗: {e}")

with app.app_context(): init_db()

# ================= 🧠 心理學符號資料庫 (Symbol Matching) =================
# 這是簡單的規則式 NLP，比對常見意象
DREAM_SYMBOLS = {
    "蛇": "象徵著潛意識的恐懼、性慾或轉變。",
    "牙齒": "掉牙齒通常代表對外貌的焦慮，或擔心失去掌控權。",
    "飛": "飛翔象徵渴望自由，或想要逃離現實的壓力。",
    "墜落": "代表生活中的失控感，或對失敗的恐懼。",
    "被追": "象徵你在逃避某個責任、情感或過去的陰影。",
    "水": "水代表情緒。清澈的水象徵平靜，混濁的水代表混亂。",
    "火": "象徵強烈的情感、憤怒，或是毀滅與重生的力量。",
    "死": "死亡在夢中通常不代表真的死亡，而是象徵「結束」與「新開始」。",
    "考試": "代表對能力的自我懷疑，或是擔心被他人評價。",
    "迷路": "象徵在人生方向上的迷惘，或失去了目標。",
    "貓": "代表直覺、陰柔的力量，或獨立的性格。",
    "狗": "象徵忠誠、友情，或是對保護的渴望。",
    "車": "車子代表你的人生旅程。無法煞車代表失控。",
    "前任": "不一定代表還愛著，通常象徵未解的心結或懷念過去的自己。"
}

def advanced_dream_analysis(content, user_mood):
    """
    結合符號比對與情緒計算的進階分析
    """
    found_keywords = []
    found_meanings = []
    
    # 1. 符號比對 (Symbol Matching)
    for symbol, meaning in DREAM_SYMBOLS.items():
        if symbol in content:
            found_keywords.append(symbol)
            found_meanings.append(meaning)
    
    # 2. 生成分析建議 (基於是否有找到符號)
    if found_keywords:
        analysis_text = f"偵測到關鍵意象：{'、'.join(found_keywords)}。{found_meanings[0]}"
        keywords = found_keywords
    else:
        # 如果沒找到關鍵字，使用通用心理學建議
        generic_advice = [
            "這個夢境反映了潛意識的波動，建議記錄下來並觀察後續。",
            "夢中的情緒比情節更重要，試著回想醒來時的感覺。",
            "這可能是一種情緒釋放，代表大腦正在整理白天的資訊。"
        ]
        analysis_text = random.choice(generic_advice)
        # 隨機抓幾個通用的詞當關鍵字
        keywords = ["潛意識", "情緒整理", "自我探索"]

    # 3. 計算情緒雷達數值 (Emotion Map Data)
    # 我們根據使用者輸入的 mood_level (1-5) 和內容長度來推算五個維度
    # 這裡做一點隨機波動，讓圖表看起來比較有機
    base_score = user_mood * 20 # 把 1-5 轉成 20-100
    
    radar_data = {
        "joy": base_score if user_mood > 3 else base_score / 2,     # 快樂
        "anxiety": 100 - base_score if user_mood < 3 else 20,       # 焦慮
        "stress": min(100, len(content) / 2),                       # 壓力 (字越多通常越複雜)
        "clarity": random.randint(40, 90),                          # 清晰度 (隨機)
        "mystic": 80 if any(k in content for k in ["飛", "死", "火"]) else 40 # 奇幻度
    }
    
    return analysis_text, keywords, radar_data

# =======================================================================

@app.route('/')
def home(): return "✅ Dream Log 後端運作中！"

# --- API ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    try:
        conn = get_db_connection(); cur = conn.cursor()
        hashed = bcrypt.generate_password_hash(data['password']).decode('utf-8')
        cur.execute("INSERT INTO users (username, password) VALUES (%s, %s) RETURNING id", (data['username'], hashed))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"msg": "註冊成功"}), 201
    except: return jsonify({"msg": "帳號已存在"}), 409

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    conn = get_db_connection(); cur = conn.cursor()
    cur.execute("SELECT id, username, password FROM users WHERE username = %s", (data['username'],))
    user = cur.fetchone(); cur.close(); conn.close()
    if user and bcrypt.check_password_hash(user[2], data['password']):
        return jsonify(access_token=create_access_token(identity=str(user[0])), username=user[1]), 200
    return jsonify({"msg": "帳號或密碼錯誤"}), 401

@app.route('/api/dreams', methods=['GET'])
@jwt_required(optional=True)
def get_dreams():
    mode = request.args.get('mode', 'personal')
    search = request.args.get('search', '').strip()
    mood_filter = request.args.get('mood', '')
    uid = get_jwt_identity()
    conn = get_db_connection(); cur = conn.cursor()

    base_query = """
        SELECT d.id, d.date, d.content, d.mood_level, d.analysis, d.keywords, d.reality_context, d.is_anonymous, u.username,
        CASE WHEN s.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_saved
        FROM dreams d 
        JOIN users u ON d.user_id = u.id
        LEFT JOIN saved_dreams s ON d.id = s.dream_id AND s.user_id = %s
    """
    params = [uid if uid else -1]
    conditions = []

    if mode == 'personal':
        if not uid: return jsonify({"msg": "請先登入"}), 401
        conditions.append("d.user_id = %s"); params.append(uid)
    elif mode == 'saved':
        if not uid: return jsonify({"msg": "請先登入"}), 401
        base_query = base_query.replace("LEFT JOIN", "JOIN")
        conditions.append("s.user_id = %s"); params.append(uid)
    else: conditions.append("d.is_public = TRUE")

    if search:
        conditions.append("(d.content ILIKE %s OR %s = ANY(d.keywords))")
        params.extend([f"%{search}%", search])

    if mood_filter == 'happy': conditions.append("d.mood_level >= 4")
    elif mood_filter == 'sad': conditions.append("d.mood_level <= 2")
    elif mood_filter == 'neutral': conditions.append("d.mood_level = 3")

    if conditions: base_query += " WHERE " + " AND ".join(conditions)
    base_query += " ORDER BY d.id DESC LIMIT 50"

    cur.execute(base_query, tuple(params))
    rows = cur.fetchall()
    dreams = []
    
    # 這裡我們不需要每次都算雷達圖，只在寫入時算好，或者前端即時算
    # 為了簡化，GET 還是回傳基本資料
    for r in rows:
        dreams.append({
            'id':r[0], 'date':r[1], 'content':r[2], 'mood_level':r[3], 
            'analysis':r[4], 'keywords':r[5], 'reality_context':r[6], 
            'is_anonymous':r[7], 'author':"匿名" if r[7] else r[8], 'is_saved':r[9]
        })
    cur.close(); conn.close()
    return jsonify(dreams)

@app.route('/api/dreams', methods=['POST'])
@jwt_required()
def add_dream():
    try:
        user_id = get_jwt_identity(); data = request.json
        mood = data.get('mood_level', 3)
        
        # 🔥 使用新的進階分析函式
        analysis, keywords, radar_stats = advanced_dream_analysis(data['content'], mood)
        
        # 這裡我們把雷達圖的數據直接附加在 analysis 文字後面，用一個特殊的符號分隔，讓前端解析
        # 這樣就不用改資料庫結構了！這是一個聰明的 Hack
        radar_str = f"||RADAR:{radar_stats['joy']},{radar_stats['anxiety']},{radar_stats['stress']},{radar_stats['clarity']},{radar_stats['mystic']}"
        final_analysis = analysis + radar_str

        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("INSERT INTO dreams (user_id, date, content, mood_level, analysis, keywords, reality_context, is_public, is_anonymous) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id", 
                    (user_id, datetime.datetime.now().strftime("%Y-%m-%d"), data['content'], mood, final_analysis, keywords, data.get('reality_context',''), data.get('is_public',False), data.get('is_anonymous',False)))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"msg": "分析完成！", "radar": radar_stats}), 201
    except Exception as e: return jsonify({"msg": str(e)}), 500

@app.route('/api/dreams/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_dream(id):
    conn = get_db_connection(); cur = conn.cursor()
    cur.execute("DELETE FROM dreams WHERE id = %s AND user_id = %s", (id, get_jwt_identity()))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"msg": "已刪除"}), 200

@app.route('/api/dreams/<int:id>/save', methods=['POST'])
@jwt_required()
def toggle_save(id):
    uid = get_jwt_identity(); conn = get_db_connection(); cur = conn.cursor()
    cur.execute("SELECT * FROM saved_dreams WHERE user_id=%s AND dream_id=%s", (uid, id))
    if cur.fetchone():
        cur.execute("DELETE FROM saved_dreams WHERE user_id=%s AND dream_id=%s", (uid, id)); saved=False
    else:
        cur.execute("INSERT INTO saved_dreams (user_id, dream_id) VALUES (%s, %s)", (uid, id)); saved=True
    conn.commit(); cur.close(); conn.close()
    return jsonify({"is_saved": saved}), 200

# ✨ 新增：清除所有資料 (Settings 功能)
@app.route('/api/users/clear_data', methods=['DELETE'])
@jwt_required()
def clear_user_data():
    uid = get_jwt_identity()
    conn = get_db_connection(); cur = conn.cursor()
    cur.execute("DELETE FROM dreams WHERE user_id = %s", (uid,))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"msg": "所有日記已清除"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)