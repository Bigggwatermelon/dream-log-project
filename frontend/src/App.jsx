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
  ChevronRight
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

// 註冊 Chart.js 必要的模組
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
 * ✨ 自定義簡易文字雲元件 (替換 react-tagcloud)
 */
const SimpleTagCloud = ({ tags, minSize, maxSize }) => {
  const neonColors = ['#f472b6', '#c084fc', '#818cf8', '#e879f9', '#22d3ee'];
  
  if (!tags || tags.length === 0) return null;

  const maxCount = Math.max(...tags.map(t => t.count));
  const minCount = Math.min(...tags.map(t => t.count));

  return (
    <div className="flex flex-wrap justify-center items-center gap-4 p-4">
      {tags.map((tag, idx) => {
        // 根據次數計算大小
        const size = tags.length > 1 && maxCount !== minCount 
          ? minSize + ((tag.count - minCount) / (maxCount - minCount)) * (maxSize - minSize)
          : (minSize + maxSize) / 2;
        
        const color = neonColors[idx % neonColors.length];

        return (
          <span
            key={tag.value}
            style={{
              fontSize: `${size}px`,
              color: color,
              fontWeight: 'bold',
              transition: 'all 0.3s'
            }}
            className="hover:scale-110 hover:brightness-125 cursor-default select-none"
            title={`出現 ${tag.count} 次`}
          >
            #{tag.value}
          </span>
        );
      })}
    </div>
  );
};

/**
 * ✨ 自定義簡易日曆元件 (替換 react-calendar)
 */
const SimpleCalendar = ({ value, onChange }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(value));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="w-full bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <button onClick={prevMonth} className="p-1 hover:bg-slate-700 rounded"><ChevronLeft size={20}/></button>
        <span className="font-bold">{format(currentMonth, 'MMMM yyyy')}</span>
        <button onClick={nextMonth} className="p-1 hover:bg-slate-700 rounded"><ChevronRight size={20}/></button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-500 py-2 border-b border-slate-700">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => (
          <button
            key={i}
            onClick={() => onChange(day)}
            className={`
              p-2 text-sm h-10 flex items-center justify-center transition-all
              ${!isSameMonth(day, currentMonth) ? 'text-slate-600' : 'text-slate-200'}
              ${isSameDay(day, value) ? 'bg-purple-600 text-white rounded-lg scale-90' : 'hover:bg-slate-700 rounded-lg'}
              ${isSameDay(day, new Date()) && !isSameDay(day, value) ? 'text-pink-400 font-bold underline' : ''}
            `}
          >
            {format(day, 'd')}
          </button>
        ))}
      </div>
    </div>
  );
};

const parseDreamData = (analysisStr) => {
  if (!analysisStr) return { text: "分析中...", radarData: [50, 50, 50, 50, 50] };
  const parts = analysisStr.split('||RADAR:');
  return { text: parts[0], radarData: parts.length > 1 ? parts[1].split(',').map(Number) : [50, 50, 50, 50, 50] };
};

const DEMO_DATA = [
  { content: "我夢到我在考試，可是試卷上的字我都看不懂，時間快到了，我非常焦慮，一直在流汗。", mood: 1, reality: "最近期末考壓力大" },
  { content: "我夢見我變成了一隻鳥，在天空飛翔，下面的大海非常藍，感覺超級自由，完全沒有煩惱。", mood: 5, reality: "剛看完一部旅遊電影" },
  { content: "夢到被一隻巨大的黑狗追，我一直跑一直跑，最後躲進一個洞穴裡，裡面有一條蛇。", mood: 2, reality: "昨天被老闆罵" },
  { content: "夢到過世的奶奶煮飯給我吃，味道很懷念，醒來時眼角有淚。", mood: 3, reality: "中秋節快到了" },
  { content: "夢到我在海邊撿貝殼，突然海水漲潮，我差點被淹沒，這時候有一隻貓把我叫醒了。", mood: 4, reality: "想去海邊玩" }
];

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
    } catch (e) { alert("失敗：" + (e.response?.data?.msg || e.message)); }
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
    if (!token) return alert("請先登入");
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
    if (!window.confirm("確定要刪除這篇日記嗎？")) return;
    await axios.delete(`${API_URL}/dreams/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    fetchDreams('personal');
  };

  const handleClearAll = async () => {
    if (!window.confirm("⚠️ 這將刪除你所有的日記！確定嗎？")) return;
    try { await axios.delete(`${API_URL}/users/clear_data`, { headers: { Authorization: `Bearer ${token}` } }); alert("已清除"); fetchDreams('personal'); } catch (e) { alert("失敗"); }
  };

  const handleGenerateDemoData = async () => {
    if (!window.confirm("這將會自動新增 5 篇測試用的夢境日記，確定嗎？")) return;
    try {
      for (const demo of DEMO_DATA) {
        await axios.post(`${API_URL}/dreams`, {
          content: demo.content, mood_level: demo.mood, reality_context: demo.reality,
          is_public: true, is_anonymous: false
        }, { headers: { 'Authorization': `Bearer ${token}` } });
      }
      alert("✅ 成功生成 5 篇日記！");
      fetchDreams('personal');
      setView('dashboard');
      setShowAllDates(true);
    } catch (e) { alert("生成失敗"); }
  };

  const toggleSave = async (id) => {
    if (!token) return alert("請先登入");
    const res = await axios.post(`${API_URL}/dreams/${id}/save`, {}, { headers: { Authorization: `Bearer ${token}` } });
    setLibraryDreams(prev => prev.map(d => d.id === id ? { ...d, is_saved: res.data.is_saved } : d));
  };

  useEffect(() => {
    if (token) { fetchDreams('personal'); setView('dashboard'); }
  }, []);

  useEffect(() => {
    if (view === 'library') fetchDreams('library');
  }, [view, showSavedOnly, moodFilter]);

  const filteredPersonalDreams = showAllDates
    ? dreams
    : dreams.filter(d => d.date === format(selectedDate, 'yyyy-MM-dd'));

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
                <p className="text-slate-400 mb-8">結合心理學分析與數據可視化的夢境日記。</p>
                
                {/* ✨ 顯眼的簡報連結按鈕 */}
                <a 
                  href="./dream_log_final_presentation.html" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 w-full bg-slate-700 hover:bg-slate-600 text-purple-300 py-3 rounded-xl font-bold text-lg mb-4 transition-all border border-purple-500/30 justify-center group"
                >
                  <Presentation className="group-hover:scale-110 transition-transform" /> 專案展示簡報 (期末報告)
                </a>

                <button onClick={() => setView('register')} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3 rounded-xl font-bold text-lg mb-4 shadow-lg">開始註冊</button>
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
              <button onClick={handleSubmit} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3 rounded-xl font-bold">✨ AI 分析並存檔</button>
            </div>

            <div className="md:col-span-2 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex flex-col items-center gap-2">
                  <SimpleCalendar value={selectedDate} onChange={(date) => { setSelectedDate(date); setShowAllDates(false); }} />
                  <button onClick={() => setShowAllDates(true)} className={`text-sm px-4 py-1 rounded-full transition-all ${showAllDates ? 'bg-purple-600' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>顯示全部日期</button>
                </div>
                <div className="bg-slate-800 p-4 rounded-3xl border border-slate-700 h-64 relative flex flex-col items-center justify-center">
                  <h4 className="text-slate-400 text-sm absolute top-4 left-4">最新情緒地圖</h4>
                  <div className="w-full h-full p-2">
                    <Radar data={{
                      labels: ['快樂', '焦慮', '壓力', '清晰度', '奇幻度'],
                      datasets: [{ label: '數值', data: latestRadarData, backgroundColor: 'rgba(219, 39, 119, 0.2)', borderColor: 'rgba(219, 39, 119, 1)', borderWidth: 2, pointBackgroundColor: 'white' }]
                    }} options={{ maintainAspectRatio: false, scales: { r: { suggestedMin: 0, suggestedMax: 100, grid: { color: '#334155' }, pointLabels: { color: '#e2e8f0' }, ticks: { display: false } } }, plugins: { legend: { display: false } } }} />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 min-h-[150px] flex flex-col justify-center items-center relative overflow-hidden">
                <h4 className="text-slate-400 text-sm mb-2 absolute top-4 left-4 flex items-center gap-2"><Tag size={14} /> 你的夢境關鍵字雲</h4>
                {wordCloudData.length > 0 ? (
                  <SimpleTagCloud tags={wordCloudData} minSize={16} maxSize={40} />
                ) : (
                  <div className="text-center py-4 text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-xl w-full">☁️ 目前還沒有數據，請去「設定」生成資料或撰寫新日記！</div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold flex items-center gap-2"><CalIcon size={20} className="text-purple-400" /> {showAllDates ? "所有夢境紀錄" : `${format(selectedDate, 'yyyy-MM-dd')} 的日記`}</h3>
                  <span className="text-slate-500 text-sm">{filteredPersonalDreams.length} 篇</span>
                </div>
                {filteredPersonalDreams.length === 0 && <p className="text-slate-500 italic text-center py-4 bg-slate-800 rounded-xl">此日期沒有紀錄。</p>}
                {filteredPersonalDreams.map(d => {
                  const { text } = parseDreamData(d.analysis);
                  return (
                    <div key={d.id} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 relative group">
                      <div className="flex justify-between mb-2">
                        <span className="text-xs text-slate-400">{d.date}</span>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-1 rounded ${d.mood_level >= 3 ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>Mood: {d.mood_level}</span>
                          {!d.is_public && <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-400 flex gap-1 items-center"><Eye size={10} /> 私密</span>}
                          <button onClick={() => handleDelete(d.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={16} /></button>
                        </div>
                      </div>
                      <p className="mb-3 text-lg">{d.content}</p>
                      <div className="bg-slate-700/30 p-3 rounded-lg text-sm text-purple-200 border-l-4 border-purple-500">🤖 {text}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === 'settings' && token && (
          <div className="max-w-2xl mx-auto bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3"><Settings className="text-purple-400" /> 個人設定</h2>
            <div className="flex items-center gap-4 mb-8 p-4 bg-slate-900 rounded-xl">
              <div className="bg-purple-600 p-3 rounded-full"><UserCircle size={32} /></div>
              <div><p className="text-sm text-slate-400">目前登入帳號</p><p className="text-xl font-bold">{user}</p></div>
            </div>
            <div className="space-y-4">
              <button onClick={handleGenerateDemoData} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 py-3 rounded-xl text-white font-bold"><Zap size={18} fill="currentColor" /> ⚡ 一鍵生成 5 篇測試資料 (Demo 用)</button>
              <button onClick={handleClearAll} className="w-full flex items-center justify-center gap-2 border border-red-500/50 text-red-400 py-3 rounded-xl hover:bg-red-900/20 transition-all"><Trash2 size={18} /> 清除所有日記</button>
            </div>
            <div className="mt-8 pt-8 border-t border-slate-700">
              <button onClick={logout} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl transition-all"><LogOut size={18} /> 登出</button>
            </div>
          </div>
        )}

        {view === 'library' && (
          <div>
            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 mb-8 shadow-xl">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold mb-2 flex items-center justify-center gap-3"><Globe className="text-pink-500" /> 夢境圖書館</h2>
                <p className="text-slate-400">窺探他人的潛意識，發現你並不孤單。</p>
              </div>
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-1/3">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="text" placeholder="搜尋..." className="w-full bg-slate-900 pl-10 pr-4 py-2 rounded-xl border border-slate-700 outline-none focus:border-purple-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchDreams('library')} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setMoodFilter('')} className={`p-2 rounded-lg ${moodFilter === '' ? 'bg-slate-600' : 'bg-slate-900 text-slate-400'}`}>全部</button>
                  <button onClick={() => setMoodFilter('happy')} className={`p-2 rounded-lg flex gap-1 ${moodFilter === 'happy' ? 'bg-green-600' : 'bg-slate-900 text-green-400'}`}><Smile size={18} /></button>
                  <button onClick={() => setMoodFilter('neutral')} className={`p-2 rounded-lg flex gap-1 ${moodFilter === 'neutral' ? 'bg-blue-600' : 'bg-slate-900 text-blue-400'}`}><Meh size={18} /></button>
                  <button onClick={() => setMoodFilter('sad')} className={`p-2 rounded-lg flex gap-1 ${moodFilter === 'sad' ? 'bg-red-600' : 'bg-slate-900 text-red-400'}`}><Frown size={18} /></button>
                </div>
                {token && <button onClick={() => setShowSavedOnly(!showSavedOnly)} className={`px-3 py-2 rounded-xl flex items-center gap-2 border ${showSavedOnly ? 'bg-pink-600 border-pink-600' : 'bg-transparent border-slate-600'}`}><Heart size={18} fill={showSavedOnly ? "currentColor" : "none"} /> 只看收藏</button>}
                <button onClick={() => fetchDreams('library')} className="bg-purple-600 p-2 rounded-xl hover:bg-purple-500"><RefreshCw size={20} /></button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {libraryDreams.length === 0 && <div className="col-span-full text-center text-slate-500 py-10">找不到符合條件的夢境...</div>}
              {libraryDreams.map(d => {
                const { text } = parseDreamData(d.analysis);
                return (
                  <div key={d.id} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col relative">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
                      <div className="bg-slate-700 p-2 rounded-full"><User size={16} /></div>
                      <span className="font-bold text-slate-300">{d.author}</span>
                      <span className="ml-auto text-xs text-slate-500">{d.date}</span>
                      {token && <button onClick={() => toggleSave(d.id)} className={`ml-2 p-1 rounded-full transition-all ${d.is_saved ? 'text-pink-500' : 'text-slate-600 hover:text-pink-400'}`}><Heart size={18} fill={d.is_saved ? "currentColor" : "none"} /></button>}
                    </div>
                    <p className={`text-slate-200 mb-2 leading-relaxed ${expandedId === d.id ? '' : 'line-clamp-3'}`}>{d.content}</p>
                    {d.content.length > 50 && <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)} className="text-pink-400 hover:text-pink-300 text-sm font-medium mb-4 text-left">{expandedId === d.id ? "收起全文 ↑" : "閱讀全文 ..."}</button>}
                    <div className="mt-auto">
                      <div className="flex flex-wrap gap-2 mb-4">{(d.keywords || []).map((k, i) => <span key={i} className="text-xs bg-slate-900 text-pink-300 px-2 py-1 rounded-full">#{k}</span>)}</div>
                      <div className="text-xs text-purple-300 bg-slate-700/30 p-3 rounded-lg">🤖 {text}</div>
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