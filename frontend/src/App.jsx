import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { BookOpen, PenTool, Activity, Users, LogIn, Lock, Globe, User } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// 設定 API 網址 (自動切換本地或雲端)
const API_URL = 'https://dream-backend-dinx.onrender.com/api'; 

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(localStorage.getItem('username'));
  const [view, setView] = useState('home'); // home, login, register, dashboard, library
  
  // 資料狀態
  const [dreams, setDreams] = useState([]);
  const [libraryDreams, setLibraryDreams] = useState([]);
  
  // 表單狀態
  const [form, setForm] = useState({ content: '', mood: 3, reality: '', isPublic: false, isAnon: false });
  const [authForm, setAuthForm] = useState({ username: '', password: '' });

  // 1. 登入/註冊處理
  const handleAuth = async (type) => {
    try {
      const res = await axios.post(`${API_URL}/${type}`, authForm);
      if (type === 'login') {
        const { access_token, username } = res.data;
        localStorage.setItem('token', access_token);
        localStorage.setItem('username', username);
        setToken(access_token);
        setUser(username);
        setView('dashboard');
        fetchDreams('personal', access_token);
      } else {
        alert("註冊成功！請登入");
        setView('login');
      }
    } catch (e) { alert("操作失敗：" + (e.response?.data?.msg || e.message)); }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUser(null);
    setView('home');
  };

  // 2. 抓取夢境 (個人或圖書館)
  const fetchDreams = async (mode, currentToken = token) => {
    try {
      const config = mode === 'personal' ? { headers: { Authorization: `Bearer ${currentToken}` } } : {};
      const res = await axios.get(`${API_URL}/dreams?mode=${mode}`, config);
      if (mode === 'personal') setDreams(res.data);
      else setLibraryDreams(res.data);
    } catch (e) { console.error(e); }
  };

  // 3. 新增夢境
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/dreams`, {
        content: form.content,
        mood_level: form.mood,
        reality_context: form.reality,
        is_public: form.isPublic,
        is_anonymous: form.isAnon
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setForm({ content: '', mood: 3, reality: '', isPublic: false, isAnon: false });
      alert("AI 解析完成並存檔！");
      fetchDreams('personal');
    } catch (e) { alert("儲存失敗"); }
  };

  // 初始載入
  useEffect(() => {
    if (token) {
      fetchDreams('personal');
      setView('dashboard');
    }
  }, []);

  useEffect(() => {
    if (view === 'library') fetchDreams('library');
  }, [view]);

  // --- 畫面渲染 ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* 導覽列 */}
        <nav className="flex justify-between items-center mb-8 bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-2">
            <BookOpen className="text-purple-400"/> Dream Log
          </h1>
          <div className="flex gap-2">
            {token ? (
              <>
                <span className="hidden md:flex items-center px-3 text-slate-400">Hi, {user}</span>
                <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg ${view==='dashboard'?'bg-purple-600':'hover:bg-slate-700'}`}>個人儀表板</button>
                <button onClick={() => setView('library')} className={`px-4 py-2 rounded-lg ${view==='library'?'bg-pink-600':'hover:bg-slate-700'}`}>夢境圖書館</button>
                <button onClick={logout} className="px-4 py-2 rounded-lg hover:bg-red-900/50 text-red-300">登出</button>
              </>
            ) : (
              <>
                <button onClick={() => setView('library')} className="px-4 py-2 hover:bg-slate-700 rounded-lg flex gap-2"><Globe size={18}/> 逛逛圖書館</button>
                <button onClick={() => setView('login')} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg flex gap-2"><LogIn size={18}/> 登入</button>
              </>
            )}
          </div>
        </nav>

        {/* 1. 首頁 / 登入 / 註冊 */}
        {['home', 'login', 'register'].includes(view) && !token && (
          <div className="max-w-md mx-auto mt-20 bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            {view === 'home' && (
              <div className="text-center">
                <h2 className="text-4xl font-bold mb-6">探索潛意識</h2>
                <p className="text-slate-400 mb-8">結合 AI 分析與社群分享的夢境日記。</p>
                <button onClick={() => setView('register')} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3 rounded-xl font-bold text-lg mb-4">開始註冊</button>
                <button onClick={() => setView('library')} className="text-slate-400 hover:text-white underline">先看看別人的夢</button>
              </div>
            )}
            {(view === 'login' || view === 'register') && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-bold mb-6 text-center">{view === 'login' ? '登入帳號' : '註冊新帳號'}</h2>
                <input className="w-full bg-slate-900 p-3 rounded-lg mb-4 border border-slate-700" placeholder="帳號" 
                  value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} />
                <input className="w-full bg-slate-900 p-3 rounded-lg mb-6 border border-slate-700" type="password" placeholder="密碼" 
                  value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
                <button onClick={() => handleAuth(view)} className="w-full bg-purple-600 py-3 rounded-xl font-bold mb-4">
                  {view === 'login' ? '登入' : '註冊'}
                </button>
                <p className="text-center text-sm text-slate-400 cursor-pointer hover:text-white" onClick={() => setView(view==='login'?'register':'login')}>
                  {view === 'login' ? '還沒有帳號？去註冊' : '已有帳號？去登入'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 2. 個人儀表板 (Dashboard) */}
        {view === 'dashboard' && token && (
          <div className="grid md:grid-cols-3 gap-8">
            {/* 左側：寫日記 */}
            <div className="md:col-span-1 bg-slate-800 p-6 rounded-3xl border border-slate-700 h-fit">
              <h3 className="text-xl font-bold mb-4 flex gap-2"><PenTool/> 新增紀錄</h3>
              <textarea className="w-full bg-slate-900 p-3 rounded-xl mb-3 h-32 text-white" placeholder="昨晚夢到了什麼..." value={form.content} onChange={e=>setForm({...form, content:e.target.value})} />
              <textarea className="w-full bg-slate-900 p-3 rounded-xl mb-4 h-20 text-sm text-slate-300" placeholder="現實連結：昨天發生了什麼特別的事？(壓力源、電影...)" value={form.reality} onChange={e=>setForm({...form, reality:e.target.value})} />
              
              <div className="mb-4">
                <label className="text-sm text-slate-400">情緒指數: {form.mood}</label>
                <input type="range" min="1" max="5" className="w-full accent-purple-500" value={form.mood} onChange={e=>setForm({...form, mood:Number(e.target.value)})}/>
              </div>
              
              <div className="flex gap-4 mb-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isPublic} onChange={e=>setForm({...form, isPublic:e.target.checked})} className="accent-pink-500"/> 公開分享
                </label>
                {form.isPublic && (
                   <label className="flex items-center gap-2 text-sm cursor-pointer">
                     <input type="checkbox" checked={form.isAnon} onChange={e=>setForm({...form, isAnon:e.target.checked})} className="accent-slate-500"/> 匿名
                   </label>
                )}
              </div>
              <button onClick={handleSubmit} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3 rounded-xl font-bold">✨ AI 解析並儲存</button>
            </div>

            {/* 右側：圖表與列表 */}
            <div className="md:col-span-2 space-y-6">
              {/* 圖表 */}
              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 h-64">
                <Line options={{maintainAspectRatio:false, scales:{y:{grid:{color:'#334155'}}, x:{grid:{color:'#334155'}}}}} 
                  data={{
                    labels: dreams.map(d => d.date).reverse(),
                    datasets: [{ label: '情緒趨勢', data: dreams.map(d => d.mood_level).reverse(), borderColor: '#a855f7', tension: 0.4 }]
                  }} />
              </div>
              {/* 列表 */}
              <div className="space-y-4">
                {dreams.map(d => (
                  <div key={d.id} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 relative overflow-hidden group">
                    <div className="flex justify-between mb-2">
                       <span className="text-xs text-slate-400">{d.date}</span>
                       <div className="flex gap-2">
                         {d.is_public && <span className="bg-pink-900/50 text-pink-300 text-xs px-2 py-1 rounded">公開</span>}
                         <span className={`text-xs px-2 py-1 rounded ${d.mood_level>=3?'bg-green-900/50 text-green-300':'bg-red-900/50 text-red-300'}`}>Mood: {d.mood_level}</span>
                       </div>
                    </div>
                    <p className="mb-3 text-lg">{d.content}</p>
                    {d.reality_context && <p className="text-xs text-slate-500 mb-2 border-l-2 border-slate-600 pl-2">🔗 現實：{d.reality_context}</p>}
                    <div className="bg-slate-700/30 p-3 rounded-lg text-sm text-purple-200 border-l-4 border-purple-500">🤖 {d.analysis}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. 夢境圖書館 (Library) */}
        {view === 'library' && (
          <div>
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-2 flex items-center justify-center gap-3"><Globe className="text-pink-500"/> 夢境圖書館</h2>
              <p className="text-slate-400">窺探他人的潛意識，發現你並不孤單。</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {libraryDreams.map(d => (
                <div key={d.id} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 hover:border-pink-500/50 transition-all hover:-translate-y-1 shadow-lg">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
                    <div className="bg-slate-700 p-2 rounded-full"><User size={16}/></div>
                    <span className="font-bold text-slate-300">{d.author}</span>
                    <span className="ml-auto text-xs text-slate-500">{d.date}</span>
                  </div>
                  <p className="text-slate-200 mb-4 line-clamp-3">{d.content}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(d.keywords || []).map((k,i) => <span key={i} className="text-xs bg-slate-900 text-pink-300 px-2 py-1 rounded-full">#{k}</span>)}
                  </div>
                  <div className="text-xs text-purple-300 bg-slate-700/30 p-3 rounded-lg">🤖 {d.analysis}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}