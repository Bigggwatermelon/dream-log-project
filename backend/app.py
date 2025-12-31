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
import torch

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'dream-ai-deep-thought-2025') 
bcrypt = Bcrypt(app)
jwt = JWTManager(app)
DATABASE_URL = os.environ.get('DATABASE_URL')

# ================= 🤖 極簡量化 AI 引擎載入 =================
# 選用支援多語言的情緒語意模型 (約 80MB)
MODEL_NAME = "lxyuan/distilbert-base-multilingual-cased-sentiments-student"

try:
    # 這裡我們使用 pipeline 的 sentiment-analysis，但我們會提取它的分數來做更細膩的生成
    analyzer = pipeline("sentiment-analysis", model=MODEL_NAME, top_k=None, device=-1)
    print(f"✅ AI 思考引擎已就緒")
except Exception as e:
    print(f"❌ 引擎啟動失敗: {e}")
    analyzer = None

def get_db_connection():
    try: return psycopg2.connect(DATABASE_URL)
    except: return None

# ================= 🧠 AI 深度思考與動態生成演算法 =================
def ai_deep_thought_engine(content, mood_level):
    """
    完全由 AI 邏輯驅動的分析與分數計算
    """
    # 1. 取得 AI 原始情緒機率分布 (AI 的「思考」數據)
    ai_raw = {"positive": 0.33, "neutral": 0.33, "negative": 0.33}
    if analyzer and content.strip():
        try:
            with torch.no_grad():
                results = analyzer(content[:512])[0]
                for r in results:
                    ai_raw[r['label']] = r['score']
        except: pass

    # 2. 自動關鍵字提取
    words = re.findall(r'[\u4e00-\u9fa5]{2,4}', content)
    keyword_counts = Counter(words).most_common(3)
    keywords = [k[0] for k in keyword_counts] if keyword_counts else ["潛意識", "幻象"]

    # 3. 雷達圖演算法：基於 AI 機率分布的加權計算
    # Joy: 正向機率 * 100
    # Anxiety: 負向機率 * 100 (並受 mood_level 修正)
    # Stress: 負向機率加重與關鍵字判定
    # Clarity: 中性機率表現穩定度
    # Mystic: 隨機性與特定詞彙組合
    
    joy = (ai_raw['positive'] * 70) + (mood_level * 6)
    anxiety = (ai_raw['negative'] * 80) + (6 - mood_level) * 4
    stress = (ai_raw['negative'] * 60) + (random.randint(10, 30))
    clarity = (ai_raw['neutral'] * 50) + (mood_level * 10)
    mystic = random.randint(20, 90) if len(content) > 20 else 40

    # 針對特定詞彙的 AI 修正
    if "飛" in content or "神" in content: mystic += 20
    if "死" in content or "追" in content: stress += 15

    radar_scores = [
        max(10, min(100, int(joy))),
        max(10, min(100, int(anxiety))),
        max(10, min(100, int(stress))),
        max(10, min(100, int(clarity))),
        max(10, min(100, int(mystic)))
    ]

    # 4. AI 評論動態生成 (思考邏輯)
    # 我們不給死板的句子，而是根據 AI 的機率最高項來組裝語意
    primary_sentiment = max(ai_raw, key=ai_raw.get)
    
    opening = ["你的夢境呈現出一種", "潛意識中隱約浮現", "這段記憶碎片暗示著"]
    
    sentiment_desc = {
        "positive": f"極具擴張性的能量，其中「{keywords[0]}」的存在象徵著你內在對當前生活的正向導向與接納。",
        "negative": f"深層的防禦與焦慮感，透過「{keywords[0]}」的隱喻，大腦正試圖排解現實中難以消化壓抑。",
        "neutral": f"冷靜的認知整理過程，夢中的「{keywords[0]}」更多反映了你對近期資訊的邏輯化編碼。"
    }

    ai_conclusion = f"{random.choice(opening)}{sentiment_desc[primary_sentiment]}"
    
    # 格式化輸出
    full_analysis = f"{ai_conclusion}||RADAR:{','.join(map(str, radar_scores))}"
    return full_analysis, keywords

# ================= 路由與資料庫邏輯 =================

@app.route('/api/dreams', methods=['POST'])
@jwt_required()
def add_dream():
    try:
        user_id = get_jwt_identity()
        data = request.json
        content = data.get('content', '')
        mood = data.get('mood_level', 3)
        
        # 啟動 AI 思考
        analysis_str, keywords = ai_deep_thought_engine(content, mood)
        
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO dreams (user_id, date, content, mood_level, analysis, keywords, reality_context, is_public, is_anonymous)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (user_id, datetime.datetime.now().strftime("%Y-%m-%d"), content, mood, 
              analysis_str, keywords, data.get('reality_context',''), 
              data.get('is_public', False), data.get('is_anonymous', False)))
        
        conn.commit(); cur.close(); conn.close()
        return jsonify({"msg": "AI 分析已完成並儲存"}), 201
    except Exception as e:
        return jsonify({"msg": str(e)}), 500

# (其他註冊、登入、獲取列表的路由保持不變)
# ... [省略重複部分] ...

if __name__ == '__main__':
    # 啟動 Flask
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
