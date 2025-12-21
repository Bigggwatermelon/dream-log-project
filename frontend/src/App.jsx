import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { BookOpen, PenTool, Activity } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function App() {
  const [view, setView] = useState('home');
  const [dreams, setDreams] = useState([]);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState(3);
  const [chartData, setChartData] = useState({labels:[], datasets:[]});

  // 抓取後端資料
  const fetchDreams = async () => {
    try {
      // 注意：這裡預設連線到 localhost:5000
      const res = await axios.get('https://dream-backend-dinx.onrender.com/api/dreams');
      setDreams(res.data);
      updateChart(res.data);
    } catch(e) {
      console.error("連線失敗，請確認後端視窗是否開著", e);
    }
  };

  useEffect(() => { fetchDreams(); }, []);

  const updateChart = (data) => {
    setChartData({
      labels: data.map(d => d.date).reverse(),
      datasets: [{
        label: '情緒指數',
        data: data.map(d => d.mood_level).reverse(),
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.5)',
        tension: 0.4
      }]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('https://dream-backend-dinx.onrender.com/api/dreams', { content, mood_level: mood });
      setContent('');
      setView('dashboard');
      fetchDreams();
    } catch(e) { alert("儲存失敗，後端沒開？"); }
  };

  return (
    <div className="min-h-screen p-6 font-sans text-slate-100 max-w-5xl mx-auto">
      {/* 導覽列 */}
      <nav className="flex justify-between items-center mb-10 bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 flex gap-3 items-center">
          <BookOpen className="text-purple-400"/> Dream Log
        </h1>
        <div className="space-x-3">
          {['home', 'log', 'dashboard'].map(v => (
            <button key={v} onClick={()=>setView(v)}
              className={`px-5 py-2 rounded-lg transition-all ${view===v ? 'bg-purple-600 text-white shadow-lg' : 'hover:bg-slate-700 text-slate-400'}`}>
              {v==='home'?'首頁':v==='log'?'紀錄':'儀表板'}
            </button>
          ))}
        </div>
      </nav>

      {/* 首頁 */}
      {view === 'home' && (
        <div className="text-center mt-24 animate-fade-in">
          <h2 className="text-7xl font-extrabold mb-8 text-white tracking-tight">
            探索你的<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">潛意識</span>
          </h2>
          <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Dream Log 是一個結合 AI 情緒分析的夢境日記。記錄你的夢，看見隱藏的情緒模式。
          </p>
          <button onClick={()=>setView('log')} className="bg-gradient-to-r from-purple-600 to-pink-600 px-10 py-4 rounded-full font-bold text-lg hover:opacity-90 transition-all shadow-xl hover:shadow-purple-500/20">
            開始第一筆紀錄
          </button>
        </div>
      )}

      {/* 紀錄頁 */}
      {view === 'log' && (
        <div className="max-w-3xl mx-auto">
          <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
            <h2 className="text-2xl font-bold mb-6 flex gap-2 items-center text-purple-300"><PenTool/> 記錄新的夢境</h2>
            <form onSubmit={handleSubmit}>
              <textarea
                value={content} onChange={e=>setContent(e.target.value)}
                className="w-full h-48 bg-slate-900 p-5 rounded-2xl mb-6 text-white text-lg border border-slate-600 focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="昨晚夢到了什麼？場景、人物、感覺..."
              />
              <div className="mb-8">
                <div className="flex justify-between mb-2">
                  <label className="text-slate-400">情緒指數</label>
                  <span className="text-purple-400 font-bold">{mood} / 5</span>
                </div>
                <input type="range" min="1" max="5" value={mood} onChange={e=>setMood(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>😰 焦慮</span>
                  <span>😊 平靜</span>
                </div>
              </div>
              <button className="w-full bg-purple-600 py-4 rounded-xl font-bold text-lg hover:bg-purple-500 transition-colors shadow-lg">
                ✨ 解析並儲存
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 儀表板 */}
      {view === 'dashboard' && (
        <div className="space-y-6">
          <div className="bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-700 h-80">
            <h3 className="text-lg font-bold mb-4 flex gap-2 text-slate-300"><Activity/> 情緒趨勢圖</h3>
            <div className="h-64">
               <Line options={{maintainAspectRatio:false, scales:{y:{grid:{color:'#334155'}}, x:{grid:{color:'#334155'}}}}} data={chartData} />
            </div>
          </div>
          <div className="grid gap-4">
            {dreams.map(d => (
              <div key={d.id} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 hover:border-purple-500 transition-colors group">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-slate-400 text-sm font-mono">{d.date}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${d.mood_level>=3?'bg-green-900/50 text-green-400':'bg-red-900/50 text-red-400'}`}>
                    情緒: {d.mood_level}
                  </span>
                </div>
                {/* 你的夢境 */}
                <p className="text-slate-200 text-lg mb-4">{d.content}</p>
                
                {/* 🌟 新增：顯示 AI 的分析建議 (原本沒顯示) */}
                <div className="bg-slate-700/50 p-4 rounded-xl mb-4 text-purple-200 text-sm italic border-l-4 border-purple-500">
                    🤖 AI 解析：{d.analysis}
                </div>

                <div className="flex gap-2 border-t border-slate-700 pt-4 flex-wrap">
                  <span className="text-xs text-slate-500 py-1">AI 關鍵字:</span>
                  {/* 🔧 修正點：直接讀取 d.keywords，並加上保護機制 (|| []) 避免當機 */}
                  {(d.keywords || []).map((k,i)=>(
                    <span key={i} className="text-xs bg-slate-700 text-purple-300 px-3 py-1 rounded-full border border-slate-600">
                      #{k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}