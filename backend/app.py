import os
import datetime
import psycopg2
import requests
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

# ================= 🚀 強制指定模型 (不自動偵測) =================

GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')

# 直接寫死目前最穩定、額度最高的模型
# 備選名單：如果 Flash 還是不行，可以換成 'gemini-1.5-flash-8b'
TARGET_MODEL = "models/gemini-1.5-flash"

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

        # --- AI 分析 (REST API 直連) ---
        analysis_text = "AI 忙線中 (額度已滿或連線錯誤)"
        keywords = ["未分析"]

        if GOOGLE_API_KEY:
            try:
                # 這裡直接使用 gemini-1.5-flash，不使用 auto-detect
                api_url = f"https://generativelanguage.googleapis.com/v1beta/{TARGET_MODEL}:generateContent?key={GOOGLE_API_KEY}"
                
                payload = {"contents": [{"parts": [{"text": f"分析夢境：{content}。給予簡短心理建議(50字內)與3個關鍵字。格式：建議|關鍵字1,關鍵字2"}]}]}
                
                resp = requests.post(api_url, json=payload, headers={'Content-Type': 'application/json'})
                
                if resp.status_code == 200:
                    result = resp.json()
                    text = result.get('candidates', [])[0].get('content', {}).get('parts', [])[0].get('text', '')
                    if text:
                        parts = text.split('|')
                        analysis_text = parts[0].strip()
                        if len(parts) > 1: keywords = [k.strip() for k in parts[1].split(',')]
                elif resp.status_code == 429:
                     analysis_text = "AI 額度用盡 (請換 API Key 或等待)"
                     print("❌ 429 Too Many Requests: 今天的額度用完了")
                elif resp.status_code == 404:
                     analysis_text = "AI 模型未找到 (404)"
                     print(f"❌ 404 Not Found: 無法找到模型 {TARGET_MODEL}")
                else:
                    print(f"⚠️ API Error {resp.status_code}: {resp.text}")
                    analysis_text = f"AI 連線錯誤 ({resp.status_code})"

            except Exception as e:
                print(f"AI Critical Error: {e}")
                analysis_text = "AI 系統錯誤"
        else:
            analysis_text = "AI 未設定 (無 API Key)"

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