import os
import datetime
import psycopg2
import random
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# --- 安全與連線設定 ---
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
            cur.execute('''CREATE TABLE IF NOT EXISTS dreams (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, date TEXT, content TEXT, mood_level INTEGER, analysis TEXT, keywords TEXT[], reality_context TEXT, is_public BOOLEAN DEFAULT FALSE, is_anonymous BOOLEAN DEFAULT FALSE);''')
            cur.execute('''CREATE TABLE IF NOT EXISTS saved_dreams (user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, dream_id INTEGER REFERENCES dreams(id) ON DELETE CASCADE, PRIMARY KEY (user_id, dream_id));''')
            conn.commit(); cur.close(); conn.close()
            print("✅ 資料庫檢查完成")
        except Exception as e: print(f"❌ 初始化失敗: {e}")

with app.app_context(): init_db()

@app.route('/')
def home(): return "✅ Dream Log 後端運作中！"

# --- 模擬 AI ---
def mock_ai_analysis(content):
    pool = ["潛意識焦慮", "自我成長", "童年陰影", "渴望自由", "人際壓力", "內在小孩", "情緒釋放", "未知恐懼", "安全感缺失", "創傷修復"]
    advice = ["這個夢境反映了你近期內心的波動，建議多給自己一些獨處的時間。", "夢中的場景象徵著你對現狀的不確定感，試著放下控制欲。", "這是一個釋放壓力的夢，代表你的潛意識正在自我修復。", "夢境顯示你可能忽略了某些真實感受，建議找朋友聊聊。"]
    return random.choice(advice), random.sample(pool, 3)

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

# --- 🔥 超級進化版搜尋 API ---
@app.route('/api/dreams', methods=['GET'])
@jwt_required(optional=True)
def get_dreams():
    mode = request.args.get('mode', 'personal')
    search = request.args.get('search', '').strip() # 🔍 搜尋關鍵字
    mood_filter = request.args.get('mood', '')      # 🎭 情緒濾鏡 (happy, sad, neutral)
    uid = get_jwt_identity()
    conn = get_db_connection(); cur = conn.cursor()

    # 基礎 SQL 建構
    base_query = """
        SELECT d.id, d.date, d.content, d.mood_level, d.analysis, d.keywords, d.reality_context, d.is_anonymous, u.username,
        CASE WHEN s.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_saved
        FROM dreams d 
        JOIN users u ON d.user_id = u.id
        LEFT JOIN saved_dreams s ON d.id = s.dream_id AND s.user_id = %s
    """
    params = [uid if uid else -1]
    conditions = []

    # 依模式篩選
    if mode == 'personal':
        if not uid: return jsonify({"msg": "請先登入"}), 401
        conditions.append("d.user_id = %s")
        params.append(uid)
    elif mode == 'saved':
        if not uid: return jsonify({"msg": "請先登入"}), 401
        base_query = base_query.replace("LEFT JOIN", "JOIN") # 只抓有收藏的
        conditions.append("s.user_id = %s")
        params.append(uid)
    else: # library
        conditions.append("d.is_public = TRUE")

    # 🔍 搜尋邏輯 (同時搜尋內容與關鍵字)
    if search:
        conditions.append("(d.content ILIKE %s OR %s = ANY(d.keywords))")
        search_term = f"%{search}%"
        params.extend([search_term, search])

    # 🎭 情緒篩選邏輯
    if mood_filter == 'happy':
        conditions.append("d.mood_level >= 4")
    elif mood_filter == 'sad':
        conditions.append("d.mood_level <= 2")
    elif mood_filter == 'neutral':
        conditions.append("d.mood_level = 3")

    # 組合 SQL
    if conditions:
        base_query += " WHERE " + " AND ".join(conditions)
    
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
        print(f"Query Error: {e}")
        return jsonify([])
    finally:
        cur.close(); conn.close()

@app.route('/api/dreams', methods=['POST'])
@jwt_required()
def add_dream():
    try:
        user_id = get_jwt_identity(); data = request.json
        analysis, keywords = mock_ai_analysis(data['content'])
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("INSERT INTO dreams (user_id, date, content, mood_level, analysis, keywords, reality_context, is_public, is_anonymous) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id", 
                    (user_id, datetime.datetime.now().strftime("%Y-%m-%d"), data['content'], data.get('mood_level',3), analysis, keywords, data.get('reality_context',''), data.get('is_public',False), data.get('is_anonymous',False)))
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)