import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { BookOpen, PenTool, Globe, User, Trash2, Heart, Search, Calendar as CalIcon, Smile, Frown, Meh, RefreshCw } from 'lucide-react';
// ✨ 引入日曆套件與樣式
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);
const API_URL = 'https://dream-backend-dinx.onrender.com/api'; 

// ✨ 自定義日曆的 CSS (讓它變深色模式)
const calendarStyles = `
  .react-calendar { background: #1e293b; border: 1px solid #334155; color: #e2e8f0; border-radius: 1rem; width: 100%; font-family: sans-serif; }
  .react-calendar__tile { color: #e2e8f0; }
  .react-calendar__tile:enabled:hover, .react-calendar__tile:enabled:focus { background: #475569; border-radius: 0.5rem; }
  .react-calendar__tile--now { background: #9333ea; color: white; border-radius: 0.5rem; }
  .react-calendar__tile--active { background: #db2777 !important; color: white; border-radius: 0.5rem; }
  .react-calendar__navigation button { color: #e2e8f0; font-size: 1.2rem; }
  .react-calendar__navigation button:enabled:hover, .react-calendar__navigation button:enabled:focus { background: #334155; border-radius: 0.5rem; }
  .react-calendar__month-view__days__day--weekend { color: #f472b6; }
`;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(localStorage.getItem('username'));
  const [view, setView] = useState('home'); 
  
  const [dreams, setDreams] = useState([]);
  const [libraryDreams, setLibraryDreams] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  
  // ✨ 搜尋與篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [moodFilter, setMoodFilter] = useState(''); // '', 'happy', 'neutral', 'sad'
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  
  // ✨ 日曆狀態
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [form, setForm] = useState({ content: '', mood: 3, reality: '', isPublic: false, isAnon: false });
  const [authForm, setAuthForm] = useState({ username: '', password: '' });

  // 1. 登入/註冊
  const handleAuth = async (type) => {
    try {
      const res = await axios.post(`${API_URL}/${type}`, authForm);
      if (type === 'login') {
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('username', res.data.username);
        setToken(res.data.access_token); setUser(res.data.username);
        setView('dashboard');
        fetchDreams('personal', res.data.access_token);
      } else { alert("註冊成功"); setView('login'); }
    } catch (e) { alert("失敗：" + (e.response?.data?.msg || e.message)); }
  };

  const logout = () => { localStorage.clear(); setToken(null); setUser(null); setView('home'); };

  // 2. 抓取資料 (支援 搜尋 + 情緒 + 收藏)
  const fetchDreams = async (mode, currentToken = token) => {
    try {
      let actualMode = (mode === 'library' && showSavedOnly) ? 'saved' : mode;
      // 建構查詢參數
      let query = `?mode=${actualMode}`;
      if (mode === 'library' || mode === 'saved') {
        if (searchTerm) query += `&search=${searchTerm}`;
        if (moodFilter) query += `&mood=${moodFilter}`;
      }
      
      const config = currentToken ? { headers: { Authorization: `Bearer ${currentToken}` } } : {};
      const res = await axios.get(`${API_URL}/dreams${query}`, config);
      
      if (mode === 'personal') setDreams(res.data);
      else setLibraryDreams(res.data);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return alert("請先登入");
    try {
      await axios.post(`${API_URL}/dreams`, {
        content: form.content, mood_level: form.mood, reality_context: form.reality,
        is_public: form.isPublic, is_anonymous: form.isAnon
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      setForm({ content: '', mood: 3, reality: '', isPublic: false, isAnon: false });
      alert("✅ 存檔成功！"); fetchDreams('personal');
    } catch (e) { alert("失敗"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("確定刪除？")) return;
    await axios.delete(`${API_URL}/dreams/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    fetchDreams('personal');
  };

  const toggleSave = async (id) => {
    if (!token) return alert("請先登入");
    const res = await axios.post(`${API_URL}/dreams/${id}/save`, {}, { headers: { Authorization: `Bearer ${token}` } });
    setLibraryDreams(prev => prev.map(d => d.id === id ? { ...d, is_saved: res.data.is_saved } : d));
  };

  useEffect(() => { if (token) { fetchDreams('personal'); setView('dashboard'); } }, []);
  
  // 當搜尋條件改變時，自動重新抓取圖書館資料
  useEffect(() => { 
    if (view === 'library') fetchDreams('library'); 
  }, [view, showSavedOnly, moodFilter]); // 搜尋詞建議按Enter才觸發，先不放這裡避免太頻繁

  // ✨ 個人儀表板：根據日曆篩選夢境
  const filteredPersonalDreams = dreams.filter(d => {
    return d.date === format(selectedDate, 'yyyy-MM-dd');
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
      <style>{calendarStyles}</style>
      <div className="max-w-6xl mx-auto">
        <nav className="flex justify-between items-center mb-8 bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-2 cursor-pointer" onClick={()=>setView('home')}>
            <BookOpen className="text-purple-400"/> Dream Log
          </h1>
          <div className="flex gap-2">
            {token ? (
              <>
                <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg ${view==='dashboard'?'bg-purple-600':'hover:bg-slate-700'}`}>儀表板</button>
                <button onClick={() => setView('library')} className={`px-4 py-2 rounded-lg ${view==='library'?'bg-pink-600':'hover:bg-slate-700'}`}>圖書館</button>
                <button onClick={logout} className="px-4 py-2 rounded-lg hover:bg-red-900/50 text-red-300">登出</button>
              </>
            ) : (
              <>
                <button onClick={() => setView('library')} className="px-4 py-2 hover:bg-slate-700 rounded-lg flex gap-2"><Globe size={18}/> 逛逛圖書館</button>
                <button onClick={() => setView('login')} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg flex gap-2"><User size={18}/> 登入</button>
              </>
            )}
          </div>
        </nav>

        {/* 1. 登入/註冊/首頁 (省略，保持不變但為了完整性這裡包含基本邏輯) */}
        {['home', 'login', 'register'].includes(view) && !token && (
          <div className="max-w-md mx-auto mt-20 bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            {view === 'home' && (
              <div className="text-center">
                <h2 className="text-4xl font-bold mb-6">探索潛意識</h2>
                <button onClick={() => setView('register')} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3 rounded-xl font-bold text-lg mb-4">開始註冊</button>
                <button onClick={() => setView('library')} className="text-slate-400 hover:text-white underline">先看看別人的夢</button>
              </div>
            )}
            {(view === 'login' || view === 'register') && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">{view === 'login' ? '登入' : '註冊'}</h2>
                <input className="w-full bg-slate-900 p-3 rounded-lg mb-4 border border-slate-700" placeholder="帳號" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} />
                <input className="w-full bg-slate-900 p-3 rounded-lg mb-6 border border-slate-700" type="password" placeholder="密碼" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
                <button onClick={() => handleAuth(view)} className="w-full bg-purple-600 py-3 rounded-xl font-bold mb-4">{view === 'login' ? '登入' : '註冊'}</button>
                <p className="text-center text-sm cursor-pointer" onClick={() => setView(view==='login'?'register':'login')}>{view === 'login' ? '去註冊' : '去登入'}</p>
              </div>
            )}
          </div>
        )}

        {/* 2. 個人儀表板 (Dashboard) - 加入日曆 */}
        {view === 'dashboard' && token && (
          <div className="grid md:grid-cols-3 gap-8">
            {/* 左側：寫日記 */}
            <div className="md:col-span-1 bg-slate-800 p-6 rounded-3xl border border-slate-700 h-fit">
              <h3 className="text-xl font-bold mb-4 flex gap-2"><PenTool/> 新增紀錄</h3>
              <textarea className="w-full bg-slate-900 p-3 rounded-xl mb-3 h-32 text-white" placeholder="昨晚夢到了什麼..." value={form.content} onChange={e=>setForm({...form, content:e.target.value})} />
              <textarea className="w-full bg-slate-900 p-3 rounded-xl mb-4 h-20 text-sm text-slate-300" placeholder="現實連結..." value={form.reality} onChange={e=>setForm({...form, reality:e.target.value})} />
              <div className="mb-4"><label className="text-sm text-slate-400">情緒指數: {form.mood}</label><input type="range" min="1" max="5" className="w-full accent-purple-500" value={form.mood} onChange={e=>setForm({...form, mood:Number(e.target.value)})}/></div>
              <div className="flex gap-4 mb-6">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublic} onChange={e=>setForm({...form, isPublic:e.target.checked})} className="accent-pink-500"/> 公開</label>
                {form.isPublic && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isAnon} onChange={e=>setForm({...form, isAnon:e.target.checked})} className="accent-slate-500"/> 匿名</label>}
              </div>
              <button onClick={handleSubmit} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3 rounded-xl font-bold">✨ 存檔</button>
            </div>

            {/* 右側：日曆與列表 */}
            <div className="md:col-span-2 space-y-6">
              {/* ✨ 日曆元件 */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-800 p-4 rounded-3xl border border-slate-700 flex justify-center">
                    <Calendar onChange={setSelectedDate} value={selectedDate} className="text-sm" />
                </div>
                {/* 簡單圖表 */}
                <div className="bg-slate-800 p-4 rounded-3xl border border-slate-700 h-64">
                    <Line options={{maintainAspectRatio:false, scales:{y:{grid:{color:'#334155'}}, x:{grid:{color:'#334155'}}}}} data={{labels: dreams.map(d=>d.date).reverse(), datasets:[{label:'情緒', data:dreams.map(d=>d.mood_level).reverse(), borderColor:'#a855f7', tension:0.4}]}} />
                </div>
              </div>

              {/* 日記列表 (根據日曆篩選) */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                   <CalIcon size={20} className="text-purple-400"/> 
                   {format(selectedDate, 'yyyy-MM-dd')} 的日記
                   <span className="text-sm font-normal text-slate-400 ml-2">
                     (共有 {filteredPersonalDreams.length} 篇)
                   </span>
                </h3>
                
                {filteredPersonalDreams.length === 0 && <p className="text-slate-500 italic">這一天沒有紀錄夢境。</p>}
                
                {filteredPersonalDreams.map(d => (
                  <div key={d.id} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 relative group">
                    <div className="flex justify-between mb-2">
                       <span className="text-xs text-slate-400">{d.date}</span>
                       <div className="flex items-center gap-3">
                         <span className={`text-xs px-2 py-1 rounded ${d.mood_level>=3?'bg-green-900/50 text-green-300':'bg-red-900/50 text-red-300'}`}>Mood: {d.mood_level}</span>
                         <button onClick={() => handleDelete(d.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={16} /></button>
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

        {/* 3. 夢境圖書館 (Library) - 搜尋與篩選全開 */}
        {view === 'library' && (
          <div>
            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 mb-8 shadow-xl">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold mb-2 flex items-center justify-center gap-3"><Globe className="text-pink-500"/> 夢境圖書館</h2>
                <p className="text-slate-400">窺探他人的潛意識，發現你並不孤單。</p>
              </div>

              {/* ✨ 超強搜尋列 */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                 {/* 關鍵字搜尋 */}
                 <div className="relative w-full md:w-1/3">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="搜尋關鍵字 (例如：墜落、貓)..." 
                      className="w-full bg-slate-900 pl-10 pr-4 py-2 rounded-xl border border-slate-700 focus:border-pink-500 outline-none transition-colors"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchDreams('library')}
                    />
                 </div>

                 {/* 情緒篩選 */}
                 <div className="flex gap-2">
                    <button onClick={() => setMoodFilter('')} className={`p-2 rounded-lg flex items-center gap-1 ${moodFilter===''?'bg-slate-600 text-white':'bg-slate-900 text-slate-400'}`}>全部</button>
                    <button onClick={() => setMoodFilter('happy')} className={`p-2 rounded-lg flex items-center gap-1 ${moodFilter==='happy'?'bg-green-600 text-white':'bg-slate-900 text-green-400'}`}><Smile size={18}/> 快樂</button>
                    <button onClick={() => setMoodFilter('neutral')} className={`p-2 rounded-lg flex items-center gap-1 ${moodFilter==='neutral'?'bg-blue-600 text-white':'bg-slate-900 text-blue-400'}`}><Meh size={18}/> 平靜</button>
                    <button onClick={() => setMoodFilter('sad')} className={`p-2 rounded-lg flex items-center gap-1 ${moodFilter==='sad'?'bg-red-600 text-white':'bg-slate-900 text-red-400'}`}><Frown size={18}/> 焦慮</button>
                 </div>

                 {/* 收藏篩選 */}
                 {token && (
                    <button onClick={() => setShowSavedOnly(!showSavedOnly)} className={`px-3 py-2 rounded-xl flex items-center gap-2 border ${showSavedOnly ? 'bg-pink-600 border-pink-600' : 'bg-transparent border-slate-600 hover:border-pink-500'}`}>
                      <Heart size={18} fill={showSavedOnly ? "currentColor" : "none"}/> 只看收藏
                    </button>
                 )}
                 
                 {/* 搜尋按鈕 */}
                 <button onClick={() => fetchDreams('library')} className="bg-purple-600 p-2 rounded-xl hover:bg-purple-500 transition-colors" title="重新搜尋">
                    <RefreshCw size={20}/>
                 </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {libraryDreams.length === 0 && <div className="col-span-full text-center text-slate-500 py-10">找不到符合條件的夢境...</div>}
              {libraryDreams.map(d => (
                <div key={d.id} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col relative">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
                    <div className="bg-slate-700 p-2 rounded-full"><User size={16}/></div>
                    <span className="font-bold text-slate-300">{d.author}</span>
                    <span className="ml-auto text-xs text-slate-500">{d.date}</span>
                    {token && (
                      <button onClick={() => toggleSave(d.id)} className={`ml-2 p-1 rounded-full transition-all ${d.is_saved ? 'text-pink-500' : 'text-slate-600 hover:text-pink-400'}`}>
                        <Heart size={18} fill={d.is_saved ? "currentColor" : "none"} />
                      </button>
                    )}
                  </div>
                  <p className={`text-slate-200 mb-2 leading-relaxed ${expandedId === d.id ? '' : 'line-clamp-3'}`}>{d.content}</p>
                  {d.content.length > 50 && (
                    <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)} className="text-pink-400 hover:text-pink-300 text-sm font-medium mb-4 text-left">
                      {expandedId === d.id ? "收起全文 ↑" : "閱讀全文 ..."}
                    </button>
                  )}
                  <div className="mt-auto">
                    <div className="flex flex-wrap gap-2 mb-4">{(d.keywords || []).map((k,i) => <span key={i} className="text-xs bg-slate-900 text-pink-300 px-2 py-1 rounded-full">#{k}</span>)}</div>
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