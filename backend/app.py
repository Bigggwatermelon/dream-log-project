import os
import datetime
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import google.generativeai as genai

app = Flask(__name__)
# 允許 Authorization header，這樣前端才能傳送登入 Token
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# --- 安全設定 ---
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'super-secret-key') # 在 Render 環境變數設定比較好
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# --- AI 設定 ---
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash-001') # 使用最強版號

# --- 資料庫連線 ---
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"DB Connection Error: {e}")
        return None

# --- 初始化資料庫 (含使用者與新欄位) ---
def init_db():
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            # 1. 建立使用者表
            cur.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL
                );
            ''')
            # 2. 建立夢境表 (新增 user_id, is_public, is_anonymous, reality_context)
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
            print("✅ 資料庫結構更新完成 (Users + Dreams)")
        except Exception as e:
            print(f"❌ 初始化失敗: {e}")

with app.app_context():
    init_db()

# ================= 使用者系統 =================

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"msg": "請輸入帳號密碼"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO users (username, password) VALUES (%s, %s) RETURNING id", (username, hashed_password))
        conn.commit()
        return jsonify({"msg": "註冊成功，請登入"}), 201
    except psycopg2.IntegrityError:
        conn.rollback()
        return jsonify({"msg": "帳號已被使用"}), 409
    finally:
        cur.close()
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username, password FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if user and bcrypt.check_password_hash(user[2], password):
        # 製作 Token
        access_token = create_access_token(identity=user[0]) # identity 存 user_id
        return jsonify(access_token=access_token, username=user[1]), 200
    else:
        return jsonify({"msg": "帳號或密碼錯誤"}), 401

# ================= 夢境功能 =================

# 1. 獲取夢境 (分兩種模式：個人日記 vs 圖書館)
@app.route('/api/dreams', methods=['GET'])
@jwt_required(optional=True) # 圖書館模式可能不用登入
def get_dreams():
    mode = request.args.get('mode', 'personal') # default: personal
    current_user_id = get_jwt_identity()

    conn = get_db_connection()
    cur = conn.cursor()

    if mode == 'library':
        # 撈取所有「公開」的夢
        query = """
            SELECT d.id, d.date, d.content, d.mood_level, d.analysis, d.keywords, d.reality_context, 
                   d.is_anonymous, u.username 
            FROM dreams d
            JOIN users u ON d.user_id = u.id
            WHERE d.is_public = TRUE
            ORDER BY d.id DESC LIMIT 50
        """
        cur.execute(query)
    else:
        # 撈取「我自己」的夢 (必須登入)
        if not current_user_id:
            return jsonify({"msg": "請先登入"}), 401
        query = "SELECT * FROM dreams WHERE user_id = %s ORDER BY id DESC"
        cur.execute(query, (current_user_id,))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    dreams_list = []
    for row in rows:
        if mode == 'library':
            # 圖書館回傳格式
            dreams_list.append({
                'id': row[0], 'date': row[1], 'content': row[2], 'mood_level': row[3],
                'analysis': row[4], 'keywords': row[5], 'reality_context': row[6],
                'author': "匿名夢遊者" if row[7] else row[8] # 處理匿名邏輯
            })
        else:
            # 個人回傳格式
            dreams_list.append({
                'id': row[0], 'user_id': row[1], 'date': row[2], 'content': row[3],
                'mood_level': row[4], 'analysis': row[5], 'keywords': row[6],
                'reality_context': row[7], 'is_public': row[8], 'is_anonymous': row[9]
            })
        
    return jsonify(dreams_list)

# 2. 新增夢境 (需要登入)
@app.route('/api/dreams', methods=['POST'])
@jwt_required()
def add_dream():
    user_id = get_jwt_identity()
    data = request.json
    content = data.get('content')
    mood_level = data.get('mood_level', 3)
    reality_context = data.get('reality_context', '') # 現實連結
    is_public = data.get('is_public', False)
    is_anonymous = data.get('is_anonymous', False)
    date_str = datetime.datetime.now().strftime("%Y-%m-%d")

    # AI 分析
    analysis_text = "AI 休息中..."
    keywords = ["未分析"]
    try:
        prompt = f"""
        分析夢境：『{content}』。
        現實背景：『{reality_context}』。
        任務：
        1. 結合現實背景給予心理建議(50字內)。
        2. 給出3個情緒關鍵字。
        格式：建議|關鍵字1,關鍵字2,關鍵字3
        """
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

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        '''INSERT INTO dreams 
           (user_id, date, content, mood_level, analysis, keywords, reality_context, is_public, is_anonymous) 
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
        (user_id, date_str, content, mood_level, analysis_text, keywords, reality_context, is_public, is_anonymous)
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"msg": "紀錄成功", "id": new_id}), 201

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)