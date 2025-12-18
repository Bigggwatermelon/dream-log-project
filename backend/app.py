# C:\DreamLog\backend\app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import random

app = Flask(__name__)
CORS(app) # 允許前端連線

# 模擬資料庫
mock_db = []

# 簡易關鍵字分析
def analyze_dream(text):
    keywords = ["墜落", "飛行", "考試", "海", "貓", "追逐", "火", "水", "迷路"]
    found = [k for k in keywords if k in text]
    return {
        "keywords": found if found else ["一般"],
        "sentiment": random.randint(1, 5) # 暫時隨機給分
    }

@app.route('/api/dreams', methods=['GET'])
def get_dreams():
    return jsonify(sorted(mock_db, key=lambda x: x['date'], reverse=True))

@app.route('/api/dreams', methods=['POST'])
def add_dream():
    data = request.json
    content = data.get('content', '')
    new_data = {
        "id": len(mock_db) + 1,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "content": content,
        "mood_level": data.get('mood_level', 3),
        "analysis": analyze_dream(content)
    }
    mock_db.append(new_data)
    return jsonify(new_data), 201

if __name__ == '__main__':
    app.run(debug=True, port=5000)