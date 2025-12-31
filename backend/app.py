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
from transformers import pipeline

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'my-fixed-secret-key-2025') 
bcrypt = Bcrypt(app)
jwt = JWTManager(app)
DATABASE_URL = os.environ.get('DATABASE_URL')

# ================= 🤖 AI 語言模型初始化 =================
# 使用多語言情緒分析模型 (支援中文語意理解)
try:
    # 第一次執行會自動下載模型，約需數百 MB 空間
    model_name = "lxyuan/distilbert-base-multilingual-cased-sentiments-student"
    analyzer = pipeline("sentiment-analysis", model=model_name)
    print("✅ AI 語言模型已載入")
except Exception as e:
    print(f"❌ 模型載入失敗: {e}")
    analyzer = None

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

# ================= 🧠 AI 深度分析邏輯 =================
def ai_analysis_engine(content, mood_level):
    """
    透過 NLP 模型取代硬編碼字典
    """
    # 1. AI 情感分析
    detected_label = "neutral"
    if analyzer and content.strip():
        try:
            # 截斷過長文本以防報錯
            result = analyzer(content[:512])[0]
            detected_label = result['label'] # positive, neutral, negative
        except:
            pass

    # 2. 自動關鍵字提取 (利用詞頻抓取重點)
    # 抓取 2-4 字的中文詞彙
    words = re.findall(r'[\u4e00-\u9fa5]{2,4}', content)
    keyword_counts = Counter(words).most_common(3)
    keywords = [k[0] for k in keyword_counts] if keyword_counts else ["潛意識", "情緒"]

    # 3. 模擬心理學文案生成
    # 根據 AI 偵測到的情緒標籤，生成對應的心理學觀點
    analysis_templates = {
        "positive": f"這個夢境展現了積極的心理補償機制。夢中的「{keywords[0]}」象徵著你內在資源的整合，這代表你目前具備強大的情緒調節能力，正處於一個向上的心理成長期。",
        "negative": f"夢境中強烈的負面信號可能源自現實生活的壓抑。透過「{keywords[0]}」的隱喻，潛意識正在提醒你注意那些被忽略的壓力點，這是一個心靈自我修復的求救信號。",
        "neutral": f"這是一個典型的資訊處理型夢境。大腦正在對「{keywords[0]}」相關的記憶進行歸檔與重組，這反映了你內心正在尋求一種理性的平衡與秩序。"
    }
    
    base_text = analysis_templates.get(detected_label, "這是一個充滿象徵意義的夢境，反映了潛意識與現實世界的交互作用。")
    
    # 4. 雷達圖數值計算 (基於 AI 情緒標籤動態生成)
    radar = {"joy": 50, "anxiety": 50, "stress": 50, "clarity": 50, "mystic": 50}
    
    # 根據心情滑桿與 AI 結果調整
    radar["joy"] = max(10, min(100, mood_level * 20))
    
    if detected_label == "negative":
        radar["anxiety"] += 25
        radar["stress"] += 20
    elif detected_label == "positive":
        radar["clarity"] += 20
        radar["joy"] += 15

    # 加入隨機擾動增加擬真感
    radar["mystic"] = random.randint(30, 85)
    radar["clarity"] = max(20, min(100, radar["clarity"] + random.randint(-10, 10)))

    radar_str = f"||RADAR:{int(radar['joy'])},{int(radar['anxiety'])},{int(radar['stress'])},{int(radar['clarity'])},{int(radar['mystic'])}"
    
    return base_text + radar_str, keywords

# ================= 路由處理 =================

@app.route('/')
def home(): return "Dream Log AI Backend Running"

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
        conditions.append("d.user_id = %s")
        params.append(uid)
    elif mode == 'saved':
        if not uid: return jsonify({"msg": "請先登入"}), 401
        base_query = base_query.replace("LEFT JOIN", "JOIN")
        conditions.append("s.user_id = %s")
        params.append(uid)
    else: # library
        conditions.append("d.is_public = TRUE")

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
        
        # 使用 AI 引擎生成分析
        analysis_str, keywords = ai_analysis_engine(data['content'], mood)
        
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
    # 這裡可以根據環境調整，本地開發建議用 5000 端口
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
