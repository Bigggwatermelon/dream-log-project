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

# --- 安全設定 ---
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'my-fixed-secret-key-2025') 
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# --- 資料庫連線 ---
DATABASE_URL = os.environ.get('DATABASE_URL')
def get_db_connection():
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"❌ DB Error: {e}")
        return None

# --- 初始化資料庫 (升級版：新增收藏表) ---
def init_db():
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            # 1. 使用者表
            cur.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL
                );
            ''')
            # 2. 夢境表
            cur.execute('''
                CREATE TABLE IF NOT EXISTS dreams (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    date TEXT,
                    content TEXT,
                    mood_level INTEGER,
                    analysis TEXT,
                    keywords TEXT[],
                    reality_context TEXT,
                    is_public BOOLEAN DEFAULT FALSE,
                    is_anonymous BOOLEAN DEFAULT FALSE
                );
            ''')
            # 3. ✨ 新增：收藏表 (多對多關係)
            cur.execute('''
                CREATE TABLE IF NOT EXISTS saved_dreams (
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    dream_id INTEGER REFERENCES dreams(id) ON DELETE CASCADE,
                    PRIMARY KEY (user_id, dream_id)
                );
            ''')
            conn.commit()
            cur.close()
            conn.close()
            print("✅ 資料庫檢查完成")
        except Exception as e:
            print(f"❌ 初始化失敗: {e}")

with app.app_context():
    init_db()

# --- 首頁 ---
@app.route('/')
def home():
    return "✅ Dream Log 後端運作中！(Backend is running)"

# --- 模擬 AI 分析 ---
def mock_ai_analysis(content):
    keyword_pool = ["潛意識焦慮", "自我成長", "童年陰影", "渴望自由", "人際壓力", "內在小孩", "情緒釋放", "未知恐懼", "安全感缺失", "創傷修復"]
    advice_pool = [
        "這個夢境反映了你近期內心的波動，建議多給自己一些獨處的時間。",
        "夢中的場景象徵著你對現狀的不確定感，試著放下控制欲，順其自然。",
        "這是一個釋放壓力的夢，代表你的潛意識正在自我修復，請保持樂觀。",
        "夢境顯示你可能忽略了某些真實感受，建議找朋友聊聊，抒發情緒。"
    ]
    selected_keywords = random.sample(keyword_pool, 3)
    selected_advice = random.choice(advice_pool)
    if len(content) < 10: selected_advice = "夢境內容較短，可能象徵著直覺的閃現。" + selected_advice
    return selected_advice, selected_keywords

# --- API 路由 ---

# 1. 註冊
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username, password = data.get('username'), data.get('password')
    if not username or not password: return jsonify({"msg": "欄位不全"}), 400
    hashed = bcrypt.generate_password_hash(password).decode('utf-8')
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO users (username, password) VALUES (%s, %s) RETURNING id", (username, hashed))
        conn.commit()
        return jsonify({"msg": "註冊成功"}), 201
    except psycopg2.IntegrityError:
        conn.rollback()
        return jsonify({"msg": "帳號已存在"}), 409
    finally:
        cur.close(); conn.close()

# 2. 登入
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username, password = data.get('username'), data.get('password')
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username, password FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    cur.close(); conn.close()
    if user and bcrypt.check_password_hash(user[2], password):
        return jsonify(access_token=create_access_token(identity=str(user[0])), username=user[1]), 200
    return jsonify({"msg": "帳號或密碼錯誤"}), 401

# 3. 獲取夢境 (更新版：包含收藏狀態)
@app.route('/api/dreams', methods=['GET'])
@jwt_required(optional=True)
def get_dreams():
    mode = request.args.get('mode', 'personal')
    uid = get_jwt_identity() # 當前登入的使用者 ID
    conn = get_db_connection()
    cur = conn.cursor()

    if mode == 'library':
        # ✨ 複雜查詢：同時檢查這篇夢境有沒有被「這個人(uid)」收藏
        query = """
            SELECT d.id, d.date, d.content, d.mood_level, d.analysis, d.keywords, d.reality_context, d.is_anonymous, u.username,
            CASE WHEN s.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_saved
            FROM dreams d 
            JOIN users u ON d.user_id = u.id
            LEFT JOIN saved_dreams s ON d.id = s.dream_id AND s.user_id = %s
            WHERE d.is_public = TRUE 
            ORDER BY d.id DESC LIMIT 50
        """
        # 如果使用者沒登入，uid 會是 None，SQL 也能正常運作 (is_saved 會是 False)
        cur.execute(query, (uid if uid else -1,))
        
    elif mode == 'saved':
        # ✨ 新模式：只抓取我收藏的夢
        if not uid: return jsonify({"msg": "請先登入"}), 401
        query = """
            SELECT d.id, d.date, d.content, d.mood_level, d.analysis, d.keywords, d.reality_context, d.is_anonymous, u.username,
            TRUE as is_saved
            FROM dreams d 
            JOIN users u ON d.user_id = u.id
            JOIN saved_dreams s ON d.id = s.dream_id
            WHERE s.user_id = %s
            ORDER BY s.dream_id DESC
        """
        cur.execute(query, (uid,))

    else: # personal
        if not uid: return jsonify({"msg": "請先登入"}), 401
        cur.execute("SELECT * FROM dreams WHERE user_id = %s ORDER BY id DESC", (uid,))

    rows = cur.fetchall()
    cur.close(); conn.close()
    
    dreams = []
    for r in rows:
        if mode == 'library' or mode == 'saved':
            dreams.append({
                'id':r[0], 'date':r[1], 'content':r[2], 'mood_level':r[3], 
                'analysis':r[4], 'keywords':r[5], 'reality_context':r[6], 
                'author':"匿名" if r[7] else r[8],
                'is_saved': r[9] # ✨ 回傳有沒有收藏
            })
        else:
            dreams.append({
                'id':r[0], 'user_id':r[1], 'date':r[2], 'content':r[3], 
                'mood_level':r[4], 'analysis':r[5], 'keywords':r[6], 
                'reality_context':r[7], 'is_public':r[8], 'is_anonymous':r[9]
            })
    return jsonify(dreams)

# 4. 新增夢境
@app.route('/api/dreams', methods=['POST'])
@jwt_required()
def add_dream():
    try:
        user_id = get_jwt_identity()
        data = request.json
        content = data.get('content')
        mood = data.get('mood_level', 3)
        reality = data.get('reality_context', '')
        is_pub = data.get('is_public', False)
        is_anon = data.get('is_anonymous', False)
        date_str = datetime.datetime.now().strftime("%Y-%m-%d")
        analysis_text, keywords = mock_ai_analysis(content)
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO dreams (user_id, date, content, mood_level, analysis, keywords, reality_context, is_public, is_anonymous) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id", 
                    (user_id, date_str, content, mood, analysis_text, keywords, reality, is_pub, is_anon))
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return jsonify({"msg": "儲存成功", "id": new_id}), 201
    except Exception as e:
        return jsonify({"msg": f"伺服器錯誤: {str(e)}"}), 500

# 5. ✨ 新增：刪除夢境
@app.route('/api/dreams/<int:dream_id>', methods=['DELETE'])
@jwt_required()
def delete_dream(dream_id):
    user_id = get_jwt_identity()
    conn = get_db_connection()
    cur = conn.cursor()
    # 先檢查是不是這個人寫的
    cur.execute("SELECT user_id FROM dreams WHERE id = %s", (dream_id,))
    dream = cur.fetchone()
    if not dream:
        return jsonify({"msg": "找不到該紀錄"}), 404
    if str(dream[0]) != str(user_id):
        return jsonify({"msg": "你沒有權限刪除這篇日記"}), 403
    
    cur.execute("DELETE FROM dreams WHERE id = %s", (dream_id,))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"msg": "刪除成功"}), 200

# 6. ✨ 新增：切換收藏 (按愛心)
@app.route('/api/dreams/<int:dream_id>/save', methods=['POST'])
@jwt_required()
def toggle_save_dream(dream_id):
    user_id = get_jwt_identity()
    conn = get_db_connection()
    cur = conn.cursor()
    
    # 檢查是否已經收藏
    cur.execute("SELECT * FROM saved_dreams WHERE user_id = %s AND dream_id = %s", (user_id, dream_id))
    existing = cur.fetchone()
    
    if existing:
        # 已收藏 -> 取消收藏
        cur.execute("DELETE FROM saved_dreams WHERE user_id = %s AND dream_id = %s", (user_id, dream_id))
        msg = "已取消收藏"
        is_saved = False
    else:
        # 未收藏 -> 新增收藏
        cur.execute("INSERT INTO saved_dreams (user_id, dream_id) VALUES (%s, %s)", (user_id, dream_id))
        msg = "已加入收藏"
        is_saved = True
        
    conn.commit(); cur.close(); conn.close()
    return jsonify({"msg": msg, "is_saved": is_saved}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)