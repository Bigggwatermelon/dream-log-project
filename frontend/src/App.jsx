import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Line, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  Filler
} from 'chart.js';
import {
  BookOpen,
  PenTool,
  Globe,
  User,
  Trash2,
  Heart,
  Search,
  Calendar as CalIcon,
  Smile,
  Frown,
  Meh,
  RefreshCw,
  Settings,
  LogOut,
  Database,
  UserCircle,
  Tag,
  Eye,
  Zap,
  Presentation,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

// 註冊 Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  Filler
);

const API_URL = 'https://dream-backend-dinx.onrender.com/api';

/**
 * ✨ 自定義原生文字雲 (無需套件)
 */
const SimpleTagCloud = ({ tags, minSize, maxSize }) => {
  const neonColors = ['#f472b6', '#c084fc', '#818cf8', '#e879f9', '#22d3ee'];
  if (!tags || tags.length === 0) return null;

  const counts = tags.map(t => t.count);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);

  return (
    <div className="flex flex-wrap justify-center items-center gap-4 p-4">
      {tags.map((tag, idx) => {
        const size = tags.length > 1 && maxCount !== minCount 
          ? minSize + ((tag.count - minCount) / (maxCount - minCount)) * (maxSize - minSize)
          : (minSize + maxSize) / 2;
        const color = neonColors[idx % neonColors.length];
        return (
          <span
            key={tag.value}
            style={{ fontSize: `${size}px`, color: color, fontWeight: 'bold' }}
            className="hover:scale-110 hover:brightness-125 transition-all cursor-default select-none"
          >
            #{tag.value}
          </span>
        );
      })}
    </div>
  );
};

/**
 * ✨ 自定義原生日曆 (無需 date-fns 或 react-calendar)
 */
const CustomCalendar = ({ selectedDate, onSelect }) => {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  
  const prevMonthDays = new Date(year, month, 0).getDate();
  const days = [];

  // 上個月的剩餘天數
  for (let i = firstDayIndex; i > 0; i--) {
    days.push({ day: prevMonthDays - i + 1, currentMonth: false, date: new Date(year, month - 1, prevMonthDays - i + 1) });
  }
  // 這個月的天數
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
  }
  // 下個月的開始天數
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
  }

  const isToday = (d) => {
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const isSelected = (d) => {
    return d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
  };

  return (
    <div className="w-full bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
      <div className="flex justify-between items-center p-4 bg-slate-700/50">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-slate-600 rounded"><ChevronLeft size={20}/></button>
        <span className="font-bold">{year}年 {month + 1}月</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-slate-600 rounded"><ChevronRight size={20}/></button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-500 py-2">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-700">
        {days.map((item, i) => (
          <button
            key={i}
            onClick={() => onSelect(item.date)}
            className={`
              h-10 text-sm flex items-center justify-center bg-slate-800 transition-colors
              ${!item.currentMonth ? 'text-slate-600' : 'text-slate-200'}
              ${isSelected(item.date) ? 'bg-purple-600 text-white !rounded-full scale-75' : 'hover:bg-slate-700'}
              ${isToday(item.date) && !isSelected(item.date) ? 'text-pink-400 font-bold border-b-2 border-pink-400' : ''}
            `}
          >
            {item.day}
          </button>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(localStorage.getItem('username'));
  const [view, setView] = useState('home');
  const [dreams, setDreams] = useState([]);
  const [libraryDreams, setLibraryDreams] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [moodFilter, setMoodFilter] = useState('');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAllDates, setShowAllDates] = useState(true);
  const [form, setForm] = useState({ content: '', mood: 3, reality: '', isPublic: false, isAnon: false });
  const [authForm, setAuthForm] = useState({ username: '', password: '' });

  const handleAuth = async (type) => {
    try {
      const res = await axios.post(`${API_URL}/${type}`, authForm);
      if (type === 'login') {
        const { access_token, username } = res.data;
        localStorage.setItem('token', access_token);
        localStorage.setItem('username', username);
        setToken(access_token); setUser(username);
        setView('dashboard');
        fetchDreams('personal', access_token);
      } else {
        alert("註冊成功！請登入");
        setView('login');
      }
    } catch (e) { alert("操作失敗"); }
  };

  const logout = () => { localStorage.clear(); setToken(null); setUser(null); setView('home'); };

  const fetchDreams = async (mode, currentToken = token) => {
    try {
      let actualMode = (mode === 'library' && showSavedOnly) ? 'saved' : mode;
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
    if (!token) return;
    try {
      await axios.post(`${API_URL}/dreams`, {
        content: form.content, mood_level: form.mood, reality_context: form.reality,
        is_public: form.isPublic, is_anonymous: form.isAnon
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      setForm({ content: '', mood: 3, reality: '', isPublic: false, isAnon: false });
      alert("✅ 儲存成功！");
      fetchDreams('personal');
      setShowAllDates(true);
    } catch (e) { alert("失敗"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("確定要刪除嗎？")) return;
    await axios.delete(`${API_URL}/dreams/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    fetchDreams('personal');
  };

  const toggleSave = async (id) => {
    if (!token) return;
    const res = await axios.post(`${API_URL}/dreams/${id}/save`, {}, { headers: { Authorization: `Bearer ${token}` } });
    setLibraryDreams(prev => prev.map(d => d.id === id ? { ...d, is_saved: res.data.is_saved } : d));
  };

  useEffect(() => {
    if (token) { fetchDreams('personal'); setView('dashboard'); }
  }, []);

  useEffect(() => {
    if (view === 'library') fetchDreams('library');
  }, [view, showSavedOnly, moodFilter]);

  // 格式化日期為 yyyy-MM-dd
  const formatDate = (date) => {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1), day = '' + d.getDate(), year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
  };

  const filteredPersonalDreams = showAllDates
    ? dreams
    : dreams.filter(d => d.date === formatDate(selectedDate));

  const latestDream = dreams.length > 0 ? dreams[0] : null;
  const latestRadarData = latestDream ? parseDreamData(latestDream.analysis).radarData : [50, 50, 50, 50, 50];

  const allKeywords = dreams.flatMap(d => d.keywords || []);
  const keywordCounts = allKeywords.reduce((acc, curr) => { acc[curr] = (acc[curr] || 0) + 1; return acc; }, {});
  const wordCloudData = Object.entries(keywordCounts).map(([value, count]) => ({ value, count }));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <nav className="flex justify-between items-center mb-8 bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <BookOpen className="text-purple-400" /> Dream Log
          </h1>
          <div className="flex gap-2">
            {token ? (
              <>
                <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg ${view === 'dashboard' ? 'bg-purple-600' : 'hover:bg-slate-700'}`}>儀表板</button>
                <button onClick={() => setView('library')} className={`px-4 py-2 rounded-lg ${view === 'library' ? 'bg-pink-600' : 'hover:bg-slate-700'}`}>圖書館</button>
                <button onClick={() => setView('settings')} className={`p-2 rounded-lg ${view === 'settings' ? 'bg-slate-600' : 'hover:bg-slate-700'}`}><Settings size={20} /></button>
              </>
            ) : (
              <>
                <button onClick={() => setView('library')} className="px-4 py-2 hover:bg-slate-700 rounded-lg flex gap-2"><Globe size={18} /> 逛逛圖書館</button>
                <button onClick={() => setView('login')} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg flex gap-2"><LogIn size={18} /> 登入</button>
              </>
            )}
          </div>
        </nav>

        {['home', 'login', 'register'].includes(view) && !token && (
          <div className="max-w-md mx-auto mt-20 bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            {view === 'home' && (
              <div className="text-center">
                <h2 className="text-4xl font-bold mb-4">探索潛意識</h2>
                <p className="text-slate-400 mb-8">分析夢境，追蹤你的情緒地圖。</p>
                
                {/* ✨ 重要：Google 簡報連結 */}
                <a 
                  href="https://docs.google.com/presentation/d/1iNGPdZFNfCoRFoHKdkBHNxlMu-1y_0h57lr93nsgUY0/edit?usp=sharing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 w-full bg-slate-700 hover:bg-slate-600 text-purple-300 py-3 rounded-xl font-bold text-lg mb-4 transition-all border border-purple-500/30 justify-center group shadow-lg"
                >
                  <Presentation className="group-hover:rotate-12 transition-transform" /> 專案展示簡報 <ExternalLink size={16} className="opacity-50" />
                </a>

                <button onClick={() => setView('register')} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3 rounded-xl font-bold text-lg mb-4 shadow-lg shadow-purple-500/20">開始註冊</button>
                <button onClick={() => setView('library')} className="text-slate-400 hover:text-white underline">先看看別人的夢</button>
              </div>
            )}
            {(view === 'login' || view === 'register') && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">{view === 'login' ? '登入帳號' : '註冊新帳號'}</h2>
                <input className="w-full bg-slate-900 p-3 rounded-lg mb-4 border border-slate-700" placeholder="帳號" value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} />
                <input className="w-full bg-slate-900 p-3 rounded-lg mb-6 border border-slate-700" type="password" placeholder="密碼" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
                <button onClick={() => handleAuth(view)} className="w-full bg-purple-600 py-3 rounded-xl font-bold mb-4">{view === 'login' ? '登入' : '註冊'}</button>
                <p className="text-center text-sm cursor-pointer" onClick={() => setView(view === 'login' ? 'register' : 'login')}>{view === 'login' ? '去註冊' : '去登入'}</p>
              </div>
            )}
          </div>
        )}

        {view === 'dashboard' && token && (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1 bg-slate-800 p-6 rounded-3xl border border-slate-700 h-fit">
              <h3 className="text-xl font-bold mb-4 flex gap-2"><PenTool /> 新增紀錄</h3>
              <textarea className="w-full bg-slate-900 p-3 rounded-xl mb-3 h-32 text-white" placeholder="我夢到..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
              <textarea className="w-full bg-slate-900 p-3 rounded-xl mb-4 h-20 text-sm text-slate-300" placeholder="現實連結..." value={form.reality} onChange={e => setForm({ ...form, reality: e.target.value })} />
              <div className="mb-4"><label className="text-sm text-slate-400">情緒指數: {form.mood}</label><input type="range" min="1" max="5" className="w-full accent-purple-500" value={form.mood} onChange={e => setForm({ ...form, mood: Number(e.target.value) })} /></div>
              <div className="flex gap-4 mb-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.isPublic} onChange={e => setForm({ ...form, isPublic: e.target.checked })} className="accent-pink-500" /> 公開</label>
                {form.isPublic && <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.isAnon} onChange={e => setForm({ ...form, isAnon: e.target.checked })} className="accent-slate-500" /> 匿名</label>}
              </div>
              <button onClick={handleSubmit} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3 rounded-xl font-bold transition-all hover:scale-[1.02] shadow-lg shadow-purple-500/20">✨ AI 分析並存檔</button>
            </div>

            <div className="md:col-span-2 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex flex-col items-center gap-2">
                  <CustomCalendar selectedDate={selectedDate} onSelect={(date) => { setSelectedDate(date); setShowAllDates(false); }} />
                  <button onClick={() => setShowAllDates(true)} className={`text-sm px-4 py-1 rounded-full transition-all ${showAllDates ? 'bg-purple-600 shadow-lg' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>顯示全部日期</button>
                </div>
                <div className="bg-slate-800 p-4 rounded-3xl border border-slate-700 h-64 relative flex flex-col items-center justify-center shadow-inner">
                  <h4 className="text-slate-400 text-sm absolute top-4 left-4">最新情緒地圖</h4>
                  <div className="w-full h-full p-2">
                    <Radar data={{
                      labels: ['快樂', '焦慮', '壓力', '清晰', '奇幻'],
                      datasets: [{ label: '數值', data: latestRadarData, backgroundColor: 'rgba(168, 85, 247, 0.2)', borderColor: 'rgba(168, 85, 247, 1)', borderWidth: 2, pointBackgroundColor: 'white' }]
                    }} options={{ maintainAspectRatio: false, scales: { r: { suggestedMin: 0, suggestedMax: 100, grid: { color: '#334155' }, pointLabels: { color: '#94a3b8', font: { size: 10 } }, ticks: { display: false } } }, plugins: { legend: { display: false } } }} />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 min-h-[120px] flex flex-col justify-center items-center relative overflow-hidden">
                <h4 className="text-slate-400 text-sm mb-2 absolute top-4 left-4 flex items-center gap-2"><Tag size={14} /> 你的夢境關鍵字雲</h4>
                {wordCloudData.length > 0 ? (
                  <SimpleTagCloud tags={wordCloudData} minSize={16} maxSize={32} />
                ) : (
                  <div className="text-center py-4 text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-xl w-full">目前尚無數據</div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold flex items-center gap-2 text-purple-300"><CalIcon size={20}/> {showAllDates ? "所有夢境紀錄" : `${formatDate(selectedDate)} 的日記`}</h3>
                  <span className="bg-slate-800 px-3 py-1 rounded-full text-slate-400 text-sm">{filteredPersonalDreams.length} 篇</span>
                </div>
                {filteredPersonalDreams.length === 0 && <p className="text-slate-500 italic text-center py-8 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">尚未有夢境紀錄。</p>}
                {filteredPersonalDreams.map(d => {
                  const { text } = parseDreamData(d.analysis);
                  return (
                    <div key={d.id} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 relative group hover:border-purple-500/50 transition-all shadow-lg">
                      <div className="flex justify-between mb-2">
                        <span className="text-xs text-slate-500 font-mono">{d.date}</span>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-1 rounded-lg ${d.mood_level >= 3 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>Mood: {d.mood_level}</span>
                          <button onClick={() => handleDelete(d.id)} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </div>
                      <p className="mb-4 text-lg text-slate-100 leading-relaxed">{d.content}</p>
                      <div className="bg-slate-900/50 p-4 rounded-xl text-sm text-purple-200 border-l-4 border-purple-500">
                        <div className="flex items-center gap-2 mb-1 text-xs text-purple-400 font-bold uppercase tracking-wider">Analysis Result</div>
                        {text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === 'settings' && token && (
          <div className="max-w-2xl mx-auto bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-purple-300"><Settings size={24} /> 個人設定</h2>
            <div className="flex items-center gap-4 mb-8 p-6 bg-slate-900/50 rounded-2xl border border-slate-700">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-full shadow-lg"><UserCircle size={40} /></div>
              <div><p className="text-xs text-slate-500 uppercase tracking-widest">Logged In As</p><p className="text-2xl font-bold">{user}</p></div>
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">數據工具</h3>
              <button onClick={() => { if(window.confirm("這會產生測試數據，確定嗎？")) axios.post(`${API_URL}/dreams`, { content: "夢到貓在飛", mood_level: 5, is_public: true }, { headers: { 'Authorization': `Bearer ${token}` } }).then(()=>fetchDreams('personal')); }} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl transition-all border border-slate-600"><Zap size={18} className="text-yellow-400" /> 快速生成一筆測試資料</button>
              <button onClick={handleClearAll} className="w-full flex items-center justify-center gap-2 border border-red-500/30 text-red-400 py-3 rounded-xl hover:bg-red-900/20 transition-all font-bold">清除所有日記</button>
            </div>
            <div className="mt-12 pt-8 border-t border-slate-700">
              <button onClick={logout} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-red-900 text-white py-3 rounded-xl transition-all font-bold"><LogOut size={18} /> 登出系統</button>
            </div>
          </div>
        )}

        {view === 'library' && (
          <div className="animate-in fade-in duration-500">
            <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 mb-8 shadow-2xl relative overflow-hidden">
              <div className="text-center mb-8 relative z-10">
                <h2 className="text-4xl font-black mb-3 flex items-center justify-center gap-4 text-pink-400 uppercase tracking-tighter"><Globe size={32}/> Dream Library</h2>
                <p className="text-slate-400">潛入他人的意識海，尋找靈魂的共鳴。</p>
              </div>
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center relative z-10">
                <div className="relative w-full md:w-1/3">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input type="text" placeholder="搜尋意象..." className="w-full bg-slate-900 pl-12 pr-4 py-3 rounded-2xl border border-slate-700 outline-none focus:border-purple-500 shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchDreams('library')} />
                </div>
                <div className="flex gap-2 p-1 bg-slate-900 rounded-2xl border border-slate-700">
                  <button onClick={() => setMoodFilter('')} className={`px-4 py-2 rounded-xl transition-all ${moodFilter === '' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>全部</button>
                  <button onClick={() => setMoodFilter('happy')} className={`px-3 py-2 rounded-xl transition-all ${moodFilter === 'happy' ? 'bg-green-600 text-white shadow-md' : 'text-slate-500 hover:text-green-400'}`}><Smile size={20} /></button>
                  <button onClick={() => setMoodFilter('neutral')} className={`px-3 py-2 rounded-xl transition-all ${moodFilter === 'neutral' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-blue-400'}`}><Meh size={20} /></button>
                  <button onClick={() => setMoodFilter('sad')} className={`px-3 py-2 rounded-xl transition-all ${moodFilter === 'sad' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:text-red-400'}`}><Frown size={20} /></button>
                </div>
                <button onClick={() => fetchDreams('library')} className="bg-purple-600 p-3 rounded-2xl hover:bg-purple-500 transition-all shadow-lg active:scale-95"><RefreshCw size={24} /></button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {libraryDreams.length === 0 && <div className="col-span-full text-center text-slate-500 py-20 border-2 border-dashed border-slate-800 rounded-3xl">未找到符合條件的公開夢境。</div>}
              {libraryDreams.map(d => {
                const { text } = parseDreamData(d.analysis);
                return (
                  <div key={d.id} className="bg-slate-800 p-7 rounded-3xl border border-slate-700 shadow-xl flex flex-col relative hover:translate-y-[-4px] transition-all group">
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-700/50">
                      <div className="bg-slate-700 p-2 rounded-xl text-pink-400"><User size={20} /></div>
                      <div>
                        <span className="font-bold text-slate-200 block">{d.author}</span>
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{d.date}</span>
                      </div>
                      {token && <button onClick={() => toggleSave(d.id)} className={`ml-auto p-2 rounded-full transition-all ${d.is_saved ? 'text-pink-500 bg-pink-500/10' : 'text-slate-600 hover:bg-slate-700'}`}><Heart size={20} fill={d.is_saved ? "currentColor" : "none"} /></button>}
                    </div>
                    <p className={`text-slate-200 mb-4 leading-relaxed text-lg ${expandedId === d.id ? '' : 'line-clamp-3'}`}>{d.content}</p>
                    {d.content.length > 50 && <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)} className="text-purple-400 hover:text-purple-300 text-sm font-bold mb-6 text-left flex items-center gap-1">{expandedId === d.id ? "收起全文 ↑" : "閱讀全文 ..."}</button>}
                    <div className="mt-auto space-y-4">
                      <div className="flex flex-wrap gap-2">{(d.keywords || []).map((k, i) => <span key={i} className="text-xs bg-slate-900 text-pink-300 px-3 py-1 rounded-full font-bold border border-pink-500/20">#{k}</span>)}</div>
                      <div className="text-xs text-purple-300 bg-purple-900/20 p-4 rounded-2xl border border-purple-500/30 italic">"{text}"</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}