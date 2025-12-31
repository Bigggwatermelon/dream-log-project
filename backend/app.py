import os
import datetime
import psycopg2
import random
import re
from collections import Counter
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'my-fixed-secret-key-2025') 
bcrypt = Bcrypt(app)
jwt = JWTManager(app)
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    try: return psycopg2.connect(DATABASE_URL)
    except: return None

def init_db():
    conn = get_db_connection()
    if conn:
        cur = conn.cursor()
        cur.execute('''CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);''')
        cur.execute('''CREATE TABLE IF NOT EXISTS dreams (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, date TEXT, content TEXT, mood_level INTEGER, analysis TEXT, keywords TEXT[], reality_context TEXT, is_public BOOLEAN DEFAULT FALSE, is_anonymous BOOLEAN DEFAULT FALSE);''')
        cur.execute('''CREATE TABLE IF NOT EXISTS saved_dreams (user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, dream_id INTEGER REFERENCES dreams(id) ON DELETE CASCADE, PRIMARY KEY (user_id, dream_id));''')
        conn.commit(); cur.close(); conn.close()

with app.app_context(): init_db()

# ================= 🧠 超級心理學字典 (Rule-based Engine) =================
# 這裡擴充了關鍵字庫，讓它能捕捉更多情境
SYMBOL_DB = {
    "蛇": "性、恐懼、或潛意識的轉化力量。",
    "牙齒": "對外貌的焦慮，或擔心失去力量與控制權。",
    "掉牙": "象徵成長的陣痛，或對衰老的恐懼。",
    "飛": "渴望自由，超越現狀，或是想逃避壓力。",
    "墜落": "生活失控感，對失敗的恐懼，或缺乏安全感。",
    "被追": "在逃避某個責任、情感或過去的陰影。",
    "水": "情緒的象徵。清澈代表平靜，混濁代表混亂。",
    "火": "強烈的憤怒、熱情，或毀滅與重生的力量。",
    "死": "象徵結束與新的開始，不一定代表真正的死亡。",
    "考試": "自我懷疑，擔心被評價，或準備不足的焦慮。",
    "迷路": "人生方向的迷惘，失去了目標或依靠。",
    "貓": "直覺、陰柔面、獨立或神秘感。",
    "狗": "忠誠、友情，或對保護與被愛的渴望。",
    "車": "人生旅程的控制權。煞車失靈代表失控。",
    "前任": "未解的心結，或懷念過去的某個自己。",
    "遲到": "錯失良機的恐懼，或對時間管理的壓力。",
    "裸體": "脆弱、羞恥感，或渴望展現真實的自己。",
    "電梯": "情緒的升降，或社會地位的變化。",
    "廁所": "渴望釋放負面情緒，或尋求隱私。",
    "錢": "自我價值感，或對資源匱乏的恐懼。",
    "下雨": "憂鬱釋放，洗滌心靈，或情緒的宣洩。",
    "大海": "深層潛意識，未知與廣闊的可能性。",
    "殺人": "壓抑的憤怒，或想要強行切斷某種關係。"
}

def smart_analysis(content, mood_level):
    """
    不聯網，但看起來很聰明的分析邏輯
    """
    found_keywords = []
    found_meanings = []
    
    # 1. 掃描內容是否有字典裡的詞
    for symbol, meaning in SYMBOL_DB.items():
        if symbol in content:
            found_keywords.append(symbol)
            found_meanings.append(meaning)
    
    # 2. 如果真的什麼都沒抓到 (Fallback)
    if not found_keywords:
        generic_keywords = ["潛意識", "情緒", "自我"]
        if mood_level >= 4:
            analysis_text = "這是一個充滿正能量的夢，代表你近期心態積極，潛意識正在整合美好的經驗。"
            keywords = ["快樂", "正向", "能量"]
        elif mood_level <= 2:
            analysis_text = "夢境反映了內心的不安與壓力，建議多給自己一些喘息空間，照顧內在小孩。"
            keywords = ["壓力", "釋放", "療癒"]
        else:
            analysis_text = "這是一個平靜的整理型夢境，大腦正在消化白天的資訊，象徵著內心的平衡。"
            keywords = generic_keywords
    else:
        # 3. 組合分析文案
        # 取前3個關鍵字
        keywords = found_keywords[:3]
        main_symbol = found_keywords[0]
        main_meaning = found_meanings[0]
        
        intro = f"你在夢中遇見了「{main_symbol}」，這在心理學上通常象徵{main_meaning}"
        if len(found_keywords) > 1:
            intro += f" 此外，夢中還出現了{found_keywords[1]}，這暗示著情緒的多層次流動。"
        
        analysis_text = intro

    # 4. 計算雷達圖數值 (依據關鍵字屬性微調)
    # 預設值
    radar = {"joy": 50, "anxiety": 50, "stress": 50, "clarity": 50, "mystic": 50}
    
    # 根據 mood_level 調整
    radar["joy"] = mood_level * 20
    radar["anxiety"] = (6 - mood_level) * 15
    
    # 根據關鍵字調整
    bad_vibes = ["死", "墜落", "被追", "考試", "迷路", "遲到", "蛇", "火"]
    mystic_vibes = ["飛", "水", "大海", "貓", "死", "火"]
    
    hit_bad = sum(1 for k in keywords if k in bad_vibes)
    hit_mystic = sum(1 for k in keywords if k in mystic_vibes)
    
    radar["stress"] += hit_bad * 15
    radar["anxiety"] += hit_bad * 10
    radar["mystic"] += hit_mystic * 20
    radar["clarity"] = random.randint(30, 90) # 清晰度比較隨機

    # 限制在 0-100
    for k in radar: radar[k] = max(10, min(100, radar[k]))
    
    # 格式化輸出給前端
    radar_str = f"||RADAR:{int(radar['joy'])},{int(radar['anxiety'])},{int(radar['stress'])},{int(radar['clarity'])},{int(radar['mystic'])}"
    
    return analysis_text + radar_str, keywords

# =======================================================================

@app.route('/')
def home(): return "Dream Log Smart Backend Running"

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
    return jsonify({"msg": "錯誤"}), 401

@app.route('/api/dreams', methods=['GET'])
@jwt_required(optional=True)
def get_dreams():
    mode = request.args.get('mode', 'personal')
    search = request.args.get('search', '').strip()
    mood_filter = request.args.get('mood', '')
    uid = get_jwt_identity()
    conn = get_db_connection(); cur = conn.cursor()

    # ✨ 這裡確保了 personal 模式只看 user_id，不管 is_public
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
        conditions.append("d.user_id = %s") # 只要是我寫的，全部抓出來
        params.append(uid)
    elif mode == 'saved':
        if not uid: return jsonify({"msg": "請先登入"}), 401
        base_query = base_query.replace("LEFT JOIN", "JOIN")
        conditions.append("s.user_id = %s")
        params.append(uid)
    else: # library
        conditions.append("d.is_public = TRUE") # 圖書館只看公開的

    if search:
        conditions.append("(d.content ILIKE %s OR %s = ANY(d.keywords))")
        params.extend([f"%{search}%", search])

    if mood_filter == 'happy': conditions.append("d.mood_level >= 4")
    elif mood_filter == 'sad': conditions.append("d.mood_level <= 2")
    elif mood_filter == 'neutral': conditions.append("d.mood_level = 3")

    if conditions: base_query += " WHERE " + " AND ".join(conditions)
    base_query += " ORDER BY d.id DESC LIMIT 50"

    try:
        cur.execute(base_query, tuple(params))
        rows = cur.fetchall()
        dreams = []
        for r in rows:
            dreams.append({
                'id':r[0], 'date':r[1], 'content':r[2], 'mood_level':r[3], 
                'analysis':r[4], 'keywords':r[5], 'reality_context':r[6], 
                'is_anonymous':r[7], 'author':"匿名" if r[7] else r[8], 'is_saved':r[9]
            })
        return jsonify(dreams)
    except Exception as e:
        print(e)
        return jsonify([])
    finally:
        cur.close(); conn.close()

@app.route('/api/dreams', methods=['POST'])
@jwt_required()
def add_dream():
    try:
        user_id = get_jwt_identity(); data = request.json
        mood = data.get('mood_level', 3)
        
        # 🔥 使用新的聰明分析
        analysis_str, keywords = smart_analysis(data['content'], mood)
        
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("INSERT INTO dreams (user_id, date, content, mood_level, analysis, keywords, reality_context, is_public, is_anonymous) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id", 
                    (user_id, datetime.datetime.now().strftime("%Y-%m-%d"), data['content'], mood, analysis_str, keywords, data.get('reality_context',''), data.get('is_public',False), data.get('is_anonymous',False)))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"msg": "儲存成功"}), 201
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

@app.route('/api/users/clear_data', methods=['DELETE'])
@jwt_required()
def clear_user_data():
    uid = get_jwt_identity(); conn = get_db_connection(); cur = conn.cursor()
    cur.execute("DELETE FROM dreams WHERE user_id = %s", (uid,))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"msg": "已清除"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
