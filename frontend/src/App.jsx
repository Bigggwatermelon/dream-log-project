import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
// ✨ 引入垃圾桶 (Trash2) 和 愛心 (Heart) 圖示
import { BookOpen, PenTool, Activity, Users, LogIn, Lock, Globe, User, Trash2, Heart } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const API_URL = 'https://dream-backend-dinx.onrender.com/api'; 

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(localStorage.getItem('username'));
  const [view, setView] = useState('home'); 
  
  const [dreams, setDreams] = useState([]);
  const [libraryDreams, setLibraryDreams] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  
  // ✨ 新增：圖書館是否只顯示收藏
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  const [form, setForm] = useState({ content: '', mood: 3, reality: '', isPublic: false, isAnon: false });
  const [authForm, setAuthForm] = useState({ username: '', password: '' });

  // 1. 登入/註冊
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

  // 2. 抓取資料 (支援 saved 模式)
  const fetchDreams = async (mode, currentToken = token) => {
    try {
      // 如果要看收藏，mode 就傳 'saved'，否則傳 'library' 或 'personal'
      const actualMode = (mode === 'library' && showSavedOnly) ? 'saved' : mode;
      
      const config = currentToken ? { headers: { Authorization: `Bearer ${currentToken}` } } : {};
      const res = await axios.get(`${API_URL}/dreams?mode=${actualMode}`, config);
      
      if (mode === 'personal') setDreams(res.data);
      else setLibraryDreams(res.data);
    } catch (e) { console.error(e); }
  };

  // 3. 新增夢境
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return alert("請先登入");
    try {
      await axios.post(`${API_URL}/dreams`, {
        content: form.content, mood_level: form.mood, reality_context: form.reality,
        is_public: form.isPublic, is_anonymous: form.isAnon
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      
      setForm({ content: '', mood: 3, reality: '', isPublic: false, isAnon: false });
      alert("✅ 存檔成功！");
      fetchDreams('personal');
    } catch (e) { alert("❌ 失敗：" + (e.response?.data?.msg || e.message)); }
  };

  // 4. ✨ 新增：刪除夢境
  const handleDelete = async (id) => {
    if (!window.confirm("確定要刪除這篇日記嗎？(刪除後無法復原)")) return;
    try {
      await axios.delete(`${API_URL}/dreams/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      alert("已刪除");
      fetchDreams('personal'); // 重新整理列表
    } catch (e) { alert("刪除失敗"); }
  };

  // 5. ✨ 新增：收藏/取消收藏
  const toggleSave = async (id) => {
    if (!token) return alert("請先登入才能收藏！");
    try {
      const res = await axios.post(`${API_URL}/dreams/${id}/save`, {}, { headers: { Authorization: `Bearer ${token}` } });
      // 直接在前端更新按鈕狀態，不用重新整理整個頁面 (UX 比較好)
      setLibraryDreams(prev => prev.map(d => d.id === id ? { ...d, is_saved: res.data.is_saved } : d));
    } catch (e) { alert("操作失敗"); }
  };

  useEffect(() => {
    if (token) { fetchDreams('personal'); setView('dashboard'); }
  }, []);

  // 當切換到圖書館，或切換「只看收藏」時，重新抓資料
  useEffect(() => {
    if (view === 'library') fetchDreams('library');
  }, [view, showSavedOnly]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
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
              <div>
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

        {/* 個人儀表板 */}
        {view === 'dashboard' && token && (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1 bg-slate-800 p-6 rounded-3xl border border-slate-700 h-fit">
              <h3 className="text-xl font-bold mb-4 flex gap-2"><PenTool/> 新增紀錄</h3>
              <textarea className="w-full bg-slate-900 p-3 rounded-xl mb-3 h-32 text-white" placeholder="昨晚夢到了什麼..." value={form.content} onChange={e=>setForm({...form, content:e.target.value})} />
              <textarea className="w-full bg-slate-900 p-3 rounded-xl mb-4 h-20 text-sm text-slate-300" placeholder="現實連結..." value={form.reality} onChange={e=>setForm({...form, reality:e.target.value})} />
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

            <div className="md:col-span-2 space-y-6">
              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 h-64">
                <Line options={{maintainAspectRatio:false, scales:{y:{grid:{color:'#334155'}}, x:{grid:{color:'#334155'}}}}} 
                  data={{
                    labels: dreams.map(d => d.date).reverse(),
                    datasets: [{ label: '情緒趨勢', data: dreams.map(d => d.mood_level).reverse(), borderColor: '#a855f7', tension: 0.4 }]
                  }} />
              </div>
              <div className="space-y-4">
                {dreams.map(d => (
                  <div key={d.id} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 relative group">
                    <div className="flex justify-between mb-2">
                       <span className="text-xs text-slate-400">{d.date}</span>
                       <div className="flex items-center gap-3">
                         <span className={`text-xs px-2 py-1 rounded ${d.mood_level>=3?'bg-green-900/50 text-green-300':'bg-red-900/50 text-red-300'}`}>Mood: {d.mood_level}</span>
                         {/* ✨ 垃圾桶按鈕 (點擊刪除) */}
                         <button onClick={() => handleDelete(d.id)} className="text-slate-500 hover:text-red-400 transition-colors" title="刪除日記">
                           <Trash2 size={16} />
                         </button>
                       </div>
                    </div>
                    <p className="mb-3 text-lg">{d.content}</p>
                    <div className="bg-slate-700/30 p-3 rounded-lg text-sm text-purple-200 border-l-4 border-purple-500">🤖 {d.analysis}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 夢境圖書館 */}
        {view === 'library' && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2 flex items-center justify-center gap-3"><Globe className="text-pink-500"/> 夢境圖書館</h2>
              <p className="text-slate-400 mb-4">窺探他人的潛意識，發現你並不孤單。</p>
              
              {/* ✨ 收藏篩選開關 */}
              {token && (
                <div className="flex justify-center gap-2">
                  <button 
                    onClick={() => setShowSavedOnly(false)} 
                    className={`px-3 py-1 rounded-full text-sm ${!showSavedOnly ? 'bg-pink-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                    全部
                  </button>
                  <button 
                    onClick={() => setShowSavedOnly(true)} 
                    className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${showSavedOnly ? 'bg-pink-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                    <Heart size={12} fill="currentColor"/> 只看收藏
                  </button>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {libraryDreams.length === 0 && (
                <div className="col-span-full text-center text-slate-500 py-10">
                  {showSavedOnly ? "你還沒有收藏任何夢境喔！" : "目前圖書館空空如也..."}
                </div>
              )}
              {libraryDreams.map(d => (
                <div key={d.id} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col relative group">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
                    <div className="bg-slate-700 p-2 rounded-full"><User size={16}/></div>
                    <span className="font-bold text-slate-300">{d.author}</span>
                    <span className="ml-auto text-xs text-slate-500">{d.date}</span>
                    
                    {/* ✨ 收藏按鈕 (愛心) */}
                    {token && (
                      <button 
                        onClick={() => toggleSave(d.id)}
                        className={`ml-2 p-1 rounded-full transition-all ${d.is_saved ? 'text-pink-500 hover:bg-pink-900/20' : 'text-slate-600 hover:text-pink-400 hover:bg-slate-700'}`}
                        title={d.is_saved ? "取消收藏" : "加入收藏"}
                      >
                        <Heart size={18} fill={d.is_saved ? "currentColor" : "none"} />
                      </button>
                    )}
                  </div>
                  
                  <p className={`text-slate-200 mb-2 leading-relaxed ${expandedId === d.id ? '' : 'line-clamp-3'}`}>
                    {d.content}
                  </p>

                  {d.content.length > 50 && (
                    <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)} className="text-pink-400 hover:text-pink-300 text-sm font-medium mb-4 text-left">
                      {expandedId === d.id ? "收起全文 ↑" : "閱讀全文 ..."}
                    </button>
                  )}

                  <div className="mt-auto">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(d.keywords || []).map((k,i) => <span key={i} className="text-xs bg-slate-900 text-pink-300 px-2 py-1 rounded-full">#{k}</span>)}
                    </div>
                    <div className="text-xs text-purple-300 bg-slate-700/30 p-3 rounded-lg">🤖 {d.analysis}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}