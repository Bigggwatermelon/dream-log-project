import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import google.generativeai as genai
import random

app = Flask(__name__)
CORS(app)

# --- 設定 AI 鑰匙 ---
# 我們從環境變數抓取鑰匙，這樣最安全，不會把密碼外洩到 GitHub
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# 模擬資料庫 (暫存用，重開機後會清空)
mock_db = []

# --- 核心：AI 解夢函式 ---
def analyze_dream_with_ai(text):
    # 如果沒有鑰匙，就回傳錯誤訊息
    if not GEMINI_API_KEY:
        return "系統未設定 AI Key，無法分析。", ["系統錯誤"], 3

    try:
        # 使用最新的 Gemini 1.5 Flash 模型 (速度快、免費)
        model = genai.GenerativeModel('gemini-1.5-flash-001')
        
        # 1. 產生分析 (給 AI 的指令)
        prompt = f"""
        你是一位溫暖且專業的心理諮商師。
        使用者輸入了夢境：『{text}』
        
        請完成以下任務：
        1. 用繁體中文給予 100 字以內的心理分析與建議，語氣要溫柔。
        2. 從夢境中提取 3 個關鍵詞。
        3. 評估這個夢的情緒指數 (1=非常負面, 5=非常正面)，只要給一個數字。
        
        請用以下格式回傳：
        分析內容|關鍵詞1,關鍵詞2,關鍵詞3|情緒分數
        """
        
        response = model.generate_content(prompt)
        result_text = response.text.strip()

        # 簡單處理 AI 回傳的格式 (用 | 切割)
        parts = result_text.split('|')
        
        if len(parts) >= 3:
            analysis = parts[0]
            keywords = parts[1].split(',')
            # 嘗試把分數轉成數字，失敗就預設 3
            try:
                sentiment = int(parts[2].strip())
            except:
                sentiment = 3
            return analysis, keywords, sentiment
        else:
            # 萬一 AI 格式亂掉，至少回傳文字
            return result_text, ["夢境", "潛意識"], 3

    except Exception as e:
        print(f"AI 發生錯誤: {e}")
        return "AI 目前有點累，請稍後再試。", ["連線忙碌"], 3

# --- 路由設定 ---

@app.route('/api/dreams', methods=['GET'])
def get_dreams():
    return jsonify(sorted(mock_db, key=lambda x: x['date'], reverse=True))

@app.route('/api/dreams', methods=['POST'])
def add_dream():
    data = request.json
    content = data.get('content', '')
    
    # 呼叫上面的 AI 函式
    analysis_result, keywords, sentiment = analyze_dream_with_ai(content)

    new_data = {
        "id": len(mock_db) + 1,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "content": content,
        # 如果使用者有手動拉拉桿，就用手動的，不然就用 AI 判斷的
        "mood_level": data.get('mood_level', sentiment), 
        "analysis": analysis_result,
        "keywords": keywords
    }
    
    mock_db.append(new_data)
    return jsonify(new_data), 201

if __name__ == '__main__':
    app.run(debug=True)