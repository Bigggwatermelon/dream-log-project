import os
import datetime
import psycopg2
import random  # 引入隨機模組來模擬 AI
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

# --- 初始化資料庫 ---
def init_db():
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL
                );
            ''')
            cur.execute('''
                CREATE TABLE IF NOT EXISTS dreams (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
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
            conn.commit()
            cur.close()
            conn.close()
            print("✅ 資料庫檢查完成")
        except Exception as e:
            print(f"❌ 初始化失敗: {e}")

with app.app_context():
    init_db()

# ================= 🎭 模擬 AI 分析 (偽裝術) =================

def mock_ai_analysis(content):
    """
    這不是真的 AI，而是隨機挑選心理學術語。
    但在 Demo 時看起來會很像真的有在分析。
    """
    
    # 1. 隨機關鍵字庫
    keyword_pool = [
        "潛意識焦慮", "自我成長", "童年陰影", "渴望自由", "人際壓力", 
        "內在小孩", "情緒釋放", "未知恐懼", "安全感缺失", "創傷修復",
        "生活變動", "過度壓抑", "情感投射", "自我探索", "靈性覺醒"
    ]
    
    # 2. 隨機分析建議庫
    advice_pool = [
        "這個夢境反映了你近期內心的波動，建議多給自己一些獨處的時間。",
        "夢中的場景象徵著你對現狀的不確定感，試著放下控制欲，順其自然。",
        "這是一個釋放壓力的夢，代表你的潛意識正在自我修復，請保持樂觀。",
        "夢境顯示你可能忽略了某些真實感受，建議找朋友聊聊，抒發情緒。",
        "或許你在逃避某個決定？這個夢在提醒你勇敢面對內心的聲音。",
        "非常有趣的夢！象徵著創造力與突破，近期可能會有新的靈感出現。",
        "這反映了你對未來的期待與擔憂，請相信自己的能力，一切會好轉的。"
    ]

    # 3. 隨機挑選 3 個關鍵字 + 1 句建議
    selected_keywords = random.sample(keyword_pool, 3)
    selected_advice = random.choice(advice_pool)
    
    # 為了讓它更像真的，如果內容很短，就加一句話
    if len(content) < 10:
        selected_advice = "夢境內容較短，可能象徵著直覺的閃現。" + selected_advice

    return selected_advice, selected_keywords

# ==============================================================

# --- JWT 錯誤處理 ---
@jwt.invalid_token_loader
def invalid_token_callback(error): return jsonify({"msg": f"無效的 Token: {error}"}), 422
@jwt.unauthorized_loader
def missing_token_callback(error): return jsonify({"msg": "缺少 Token"}), 401
@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload): return jsonify({"msg": "Token 已過期"}), 401

# --- API 路由 ---
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

@app.route('/api/dreams', methods=['GET'])
@jwt_required(optional=True)
def get_dreams():
    mode = request.args.get('mode', 'personal')
    uid = get_jwt_identity()
    conn = get_db_connection()
    cur = conn.cursor()
    if mode == 'library':
        cur.execute("SELECT d.id, d.date, d.content, d.mood_level, d.analysis, d.keywords, d.reality_context, d.is_anonymous, u.username FROM dreams d JOIN users u ON d.user_id = u.id WHERE d.is_public = TRUE ORDER BY d.id DESC LIMIT 50")
    else:
        if not uid: return jsonify({"msg": "請先登入"}), 401
        cur.execute("SELECT * FROM dreams WHERE user_id = %s ORDER BY id DESC", (uid,))
    rows = cur.fetchall()
    cur.close(); conn.close()
    
    dreams = []
    for r in rows:
        if mode == 'library':
            dreams.append({'id':r[0], 'date':r[1], 'content':r[2], 'mood_level':r[3], 'analysis':r[4], 'keywords':r[5], 'reality_context':r[6], 'author':"匿名" if r[7] else r[8]})
        else:
            dreams.append({'id':r[0], 'user_id':r[1], 'date':r[2], 'content':r[3], 'mood_level':r[4], 'analysis':r[5], 'keywords':r[6], 'reality_context':r[7], 'is_public':r[8], 'is_anonymous':r[9]})
    return jsonify(dreams)

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

        # --- ⚡️ 使用模擬 AI (秒回，不報錯) ---
        analysis_text, keywords = mock_ai_analysis(content)

        # --- 存檔 ---
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO dreams (user_id, date, content, mood_level, analysis, keywords, reality_context, is_public, is_anonymous) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id", 
                    (user_id, date_str, content, mood, analysis_text, keywords, reality, is_pub, is_anon))
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return jsonify({"msg": "儲存成功", "id": new_id}), 201

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({"msg": f"伺服器錯誤: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)