import os
import datetime
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity

app = Flask(__name__)
# 允許跨域請求，並允許 Authorization Header
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# --- 安全設定 (關鍵) ---
# 強制設定一個固定的密鑰，避免 Gunicorn 多工時金鑰不一致
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'my-fixed-secret-key-2025') 
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# --- 錯誤處理 (告訴我們為什麼 422) ---
@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({"msg": f"無效的 Token: {error}", "error_code": "INVALID_TOKEN"}), 422

@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({"msg": "缺少 Token，請重新登入", "error_code": "MISSING_TOKEN"}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({"msg": "Token 已過期，請重新登入", "error_code": "EXPIRED_TOKEN"}), 401

# --- Google AI 設定 ---
import google.generativeai as genai
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

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

# --- API 路由 ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"msg": "帳號密碼不能為空"}), 400
    
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO users (username, password) VALUES (%s, %s) RETURNING id", (username, hashed_password))
        conn.commit()
        return jsonify({"msg": "註冊成功"}), 201
    except psycopg2.IntegrityError:
        conn.rollback()
        return jsonify({"msg": "帳號已存在"}), 409
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
        # 產生新的 Token
        access_token = create_access_token(identity=str(user[0])) # 確保轉成字串
        return jsonify(access_token=access_token, username=user[1]), 200
    else:
        return jsonify({"msg": "帳號或密碼錯誤"}), 401

@app.route('/api/dreams', methods=['GET'])
@jwt_required(optional=True)
def get_dreams():
    mode = request.args.get('mode', 'personal')
    current_user_id = get_jwt_identity()
    conn = get_db_connection()
    cur = conn.cursor()

    if mode == 'library':
        cur.execute("""
            SELECT d.id, d.date, d.content, d.mood_level, d.analysis, d.keywords, d.reality_context, 
                   d.is_anonymous, u.username 
            FROM dreams d JOIN users u ON d.user_id = u.id
            WHERE d.is_public = TRUE ORDER BY d.id DESC LIMIT 50
        """)
    else:
        if not current_user_id:
            return jsonify({"msg": "請先登入才能查看日記"}), 401
        cur.execute("SELECT * FROM dreams WHERE user_id = %s ORDER BY id DESC", (current_user_id,))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    dreams_list = []
    for row in rows:
        if mode == 'library':
            dreams_list.append({
                'id': row[0], 'date': row[1], 'content': row[2], 'mood_level': row[3],
                'analysis': row[4], 'keywords': row[5], 'reality_context': row[6],
                'author': "匿名" if row[7] else row[8]
            })
        else:
            dreams_list.append({
                'id': row[0], 'user_id': row[1], 'date': row[2], 'content': row[3],
                'mood_level': row[4], 'analysis': row[5], 'keywords': row[6],
                'reality_context': row[7], 'is_public': row[8], 'is_anonymous': row[9]
            })
    return jsonify(dreams_list)

@app.route('/api/dreams', methods=['POST'])
@jwt_required()
def add_dream():
    try:
        user_id = get_jwt_identity()
        data = request.json
        if not data:
             return jsonify({"msg": "沒有收到資料 (Body is empty)"}), 400

        content = data.get('content')
        mood_level = data.get('mood_level', 3)
        reality_context = data.get('reality_context', '')
        is_public = data.get('is_public', False)
        is_anonymous = data.get('is_anonymous', False)
        date_str = datetime.datetime.now().strftime("%Y-%m-%d")

        # AI 分析
        analysis_text = "AI 休息中..."
        keywords = ["未分析"]
        try:
            prompt = f"分析夢境：{content}。給予簡短心理建議(50字內)與3個關鍵字。格式：建議|關鍵字1,關鍵字2"
            response = model.generate_content(prompt)
            if response.text:
                parts = response.text.split('|')
                analysis_text = parts[0].strip()
                if len(parts) > 1: keywords = parts[1].split(',')
        except Exception as e:
            print(f"AI Error: {e}")

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            '''INSERT INTO dreams (user_id, date, content, mood_level, analysis, keywords, reality_context, is_public, is_anonymous) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
            (user_id, date_str, content, mood_level, analysis_text, keywords, reality_context, is_public, is_anonymous)
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"msg": "儲存成功", "id": new_id}), 201
    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({"msg": f"伺服器內部錯誤: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)