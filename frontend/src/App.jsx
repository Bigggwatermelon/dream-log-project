import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

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
const SLIDE_URL = "https://docs.google.com/presentation/d/1iNGPdZFNfCoRFoHKdkBHNxlMu-1y_0h57lr93nsgUY0/edit?usp=sharing";

// --- 自定義組件以替換缺失的外部套件 ---

/**
 * 自定義簡易日曆組件
 */
const CustomCalendar = ({ selectedDate, onChange }) => {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));

  const isSelected = (d) => d && d.toDateString() === selectedDate.toDateString();
  const isToday = (d) => d && d.toDateString() === new Date().toDateString();

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 w-full max-w-[300px]">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-slate-700 rounded"><ChevronLeft size={18}/></button>
        <span className="font-bold text-sm">{year}年 {month + 1}月</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-slate-700 rounded"><ChevronRight size={18}/></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="text-[10px] text-slate-500 font-bold">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, i) => (
          <button
            key={i}
            disabled={!date}
            onClick={() => onChange(date)}
            className={`h-8 w-full text-xs rounded-lg flex items-center justify-center transition-colors
              ${!date ? 'bg-transparent' : isSelected(date) ? 'bg-purple-600 text-white' : 'hover:bg-slate-700 text-slate-300'}
              ${isToday(date) && !isSelected(date) ? 'text-pink-400 font-bold' : ''}
            `}
          >
            {date ? date.getDate() : ''}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * 自定義簡易文字雲組件
 */
const CustomTagCloud = ({ tags, minSize, maxSize, renderer }) => {
  if (!tags || tags.length === 0) return null;
  const counts = tags.map(t => t.count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  return (
    <div className="flex flex-wrap justify-center items-center gap-2 p-4">
      {tags.map((tag, idx) => {
        const size = tags.length > 1 && maxCount !== minCount
          ? minSize + ((tag.count - minCount) / (maxCount - minCount)) * (maxSize - minSize)
          : (minSize + maxSize) / 2;
        return renderer(tag, size);
      })}
    </div>
  );
};

// --- 主應用程式 ---

const parseDreamData = (analysisStr) => {
    if (!analysisStr) return { text: "分析中...", radarData: [50, 50, 50, 50, 50] };
    const parts = analysisStr.split('||RADAR:');
    return { text: parts[0], radarData: parts.length > 1 ? parts[1].split(',').map(Number) : [50, 50, 50, 50, 50] };
};

const DEMO_DATA = [
    { content: "我夢到我在考試，可是試卷上的字我都看不懂，時間快到了，我非常焦慮，一直在流汗。", mood: 1, reality: "最近期末考壓力大" },
    { content: "我夢見我變成了一隻鳥，在天空飛翔，下面的大海非常藍，感覺超級自由，完全沒有煩惱。", mood: 5, reality: "剛看完一部旅遊電影" },
    { content: "夢到被一隻巨大的黑狗追，我一直跑一直跑，最後躲進一個洞穴裡，裡面有一條蛇。", mood: 2, reality: "昨天被老闆罵" },
    { content: "夢到過世的奶奶煮飯給我吃，味道很懷念，我們聊了很多小時候的事情，醒來時眼角有淚。", mood: 3, reality: "中秋節快到了" },
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
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('username', res.data.username);
        setToken(res.data.access_token); setUser(res.data.username);
        setView('dashboard');
        fetchDreams('personal', res.data.access_token);
      } else { alert("註冊成功"); setView('login'); }
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
      alert("✅ 分析完成！"); fetchDreams('personal');
      setShowAllDates(true);
    } catch (e) { alert("失敗"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("確定刪除？")) return;
    await axios.delete(`${API_URL}/dreams/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    fetchDreams('personal');
  };

  const handleClearAll = async () => {
    if (!window.confirm("⚠️ 警告：這將刪除你所有的日記！")) return;
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
          alert("✅ 成功生成！"); fetchDreams('personal'); setView('dashboard'); setShowAllDates(true);
      } catch (e) { alert("生成失敗"); }
  };

  const toggleSave = async (id) => {
    if (!token) return alert("請先登入");
    const res = await axios.post(`${API_URL}/dreams/${id}/save`, {}, { headers: { Authorization: `Bearer ${token}` } });
    setLibraryDreams(prev => prev.map(d => d.id === id ? { ...d, is_saved: res.data.is_saved } : d));
  };

  useEffect(() => { if (token) { fetchDreams('personal'); setView('dashboard'); } }, []);
  useEffect(() => { if (view === 'library') fetchDreams('library'); }, [view, showSavedOnly, moodFilter]);

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const filteredPersonalDreams = showAllDates ? dreams : dreams.filter(d => d.date === formatDate(selectedDate));
  const latestDream = dreams.length > 0 ? dreams[0] : null;
  const latestRadarData = latestDream ? parseDreamData(latestDream.analysis).radarData : [50, 50, 50, 50, 50];

  const allKeywords = dreams.flatMap(d => d.keywords || []);
  const keywordCounts = allKeywords.reduce((acc, curr) => { acc[curr] = (acc[curr] || 0) + 1; return acc; }, {});
  const wordCloudData = Object.entries(keywordCounts).map(([value, count]) => ({ value, count }));

  const customRenderer = (tag, size) => {
    const neonColors = ['#f472b6', '#c084fc', '#818cf8', '#e879f9', '#22d3ee']; 
    const randomColor = neonColors[Math.floor(Math.random() * neonColors.length)];
    return <span key={tag.value} style={{ fontSize: `${size}px`, color: randomColor, margin: '0px 8px', fontWeight: 'bold' }}>{tag.value}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
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
                <button onClick={() => setView('settings')} className={`p-2 rounded-lg ${view==='settings'?'bg-slate-600':'hover:bg-slate-700'}`}><Settings size={20}/></button>
              </>
            ) : (
              <>
                <button onClick={() => setView('library')} className="px-4 py-2 hover:bg-slate-700 rounded-lg flex gap-2 font-bold"><Globe size={18}/> 圖書館</button>
                <button onClick={() => setView('login')} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg flex gap-2 font-bold">登入</button>
              </>
            )}
          </div>
        </nav>

        {['home', 'login', 'register'].includes(view) && !token && (
          <div className="max-w-md mx-auto mt-20 bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            {view === 'home' && (
              <div className="text-center">
                <h2 className="text-4xl font-bold mb-4">探索潛意識</h2>
                <p className="text-slate-400 mb-8">視覺化你的夢境，分析潛在的情緒符號。</p>
                
                {/* ✨ 新增：顯眼的簡報連結按鈕 */}
                <a 
                  href={SLIDE_URL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 w-full bg-slate-700 hover:bg-slate-600 text-purple-300 py-3 rounded-xl font-bold text-lg mb-4 transition-all border border-purple-500/30 justify-center group shadow-lg"
                >
                  <Presentation className="group-hover:rotate-12 transition-transform"/> 專案展示簡報 (期末報告) <ExternalLink size={16} className="opacity-50"/>
                </a>

                <button onClick={() => setView('register')} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3 rounded-xl font-bold text-lg mb-4 shadow-lg">開始註冊</button>
                <button onClick={() => setView('library')} className="text-slate-400 hover:text-white underline">先逛逛圖書館</button>
              </div>
            )}
            {['login', 'register'].includes(view) && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">{view === 'login' ? '登入帳號' : '註冊帳號'}</h2>
                <input className="w-full bg-slate-900 p-3 rounded-lg mb-4 border border-slate-700" placeholder="帳號" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} />
                <input className="w-full bg-slate-900 p-3 rounded-lg mb-6 border border-slate-700" type="password" placeholder="密碼" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
                <button onClick={() => handleAuth(view)} className="w-full bg-purple-600 py-3 rounded-xl font-bold mb-4">{view === 'login' ? '登入' : '註冊'}</button>
                <p className="text-center text-sm cursor-pointer" onClick={() => setView(view==='login'?'register':'login')}>{view === 'login' ? '註冊新帳號' : '已有帳號？登入'}</p>
              </div>
            )}
          </div>
        )}

        {view === 'dashboard' && token && (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1 bg-slate-800 p-6 rounded-3xl border border-slate-700 h-fit">
              <h3 className="text-xl font-bold mb-4 flex gap-2"><PenTool/> 新增紀錄</h3>
              <textarea className="w-full bg-slate-900 p-3 rounded-xl mb-3 h-32 text-white" placeholder="我夢到..." value={form.content} onChange={e=>setForm({...form, content:e.target.value})} />
              <textarea className="w-full bg-slate-900 p-3 rounded-xl mb-4 h-20 text-sm text-slate-300" placeholder="現實連結..." value={form.reality} onChange={e=>setForm({...form, reality:e.target.value})} />
              <div className="mb-4"><label className="text-sm text-slate-400">情緒指數: {form.mood}</label><input type="range" min="1" max="5" className="w-full accent-purple-500" value={form.mood} onChange={e=>setForm({...form, mood:Number(e.target.value)})}/></div>
              <div className="flex gap-4 mb-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.isPublic} onChange={e=>setForm({...form, isPublic:e.target.checked})} className="accent-pink-500"/> 公開</label>
                {form.isPublic && <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.isAnon} onChange={e=>setForm({...form, isAnon:e.target.checked})} className="accent-slate-500"/> 匿名</label>}
              </div>
              <button onClick={handleSubmit} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3 rounded-xl font-bold">✨ 分析並存檔</button>
            </div>

            <div className="md:col-span-2 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex flex-col items-center">
                    <CustomCalendar onChange={(date) => { setSelectedDate(date); setShowAllDates(false); }} selectedDate={selectedDate} />
                    <button onClick={() => setShowAllDates(true)} className={`mt-2 text-xs px-4 py-1 rounded-full ${showAllDates ? 'bg-purple-600' : 'bg-slate-700 text-slate-400'}`}>顯示全部日期</button>
                </div>
                <div className="bg-slate-800 p-4 rounded-3xl border border-slate-700 h-64 flex flex-col items-center justify-center relative">
                    <h4 className="text-slate-500 text-[10px] absolute top-4 left-4 uppercase font-bold tracking-widest">情緒地圖</h4>
                    <Radar data={{labels:['快樂','焦慮','壓力','清晰','奇幻'], datasets:[{data:latestRadarData, backgroundColor:'rgba(168,85,247,0.2)', borderColor:'#a855f7', borderWidth:2, pointBackgroundColor:'white'}]}} options={{maintainAspectRatio:false, scales:{r:{suggestedMin:0, suggestedMax:100, grid:{color:'#334155'}, pointLabels:{color:'#94a3b8'}, ticks:{display:false}}}, plugins:{legend:{display:false}}}} />
                </div>
              </div>
              
              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-lg min-h-[150px] flex flex-col justify-center">
                  <h4 className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-4">關鍵字雲</h4>
                  {wordCloudData.length > 0 ? <CustomTagCloud minSize={16} maxSize={35} tags={wordCloudData} renderer={customRenderer} /> : <div className="text-center text-slate-600 text-sm italic">尚無數據</div>}
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-purple-300">{showAllDates ? "全歷史紀錄" : `${formatDate(selectedDate)} 的日記`}</h3>
                {filteredPersonalDreams.length === 0 && <p className="text-slate-500 italic text-center py-10 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">此日期無紀錄。</p>}
                {filteredPersonalDreams.map(d => {
                  const { text } = parseDreamData(d.analysis);
                  return (
                    <div key={d.id} className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-md">
                        <div className="flex justify-between mb-4">
                        <span className="text-[10px] font-mono text-slate-500">{d.date}</span>
                        <div className="flex items-center gap-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded ${d.mood_level>=3?'bg-green-900/30 text-green-400':'bg-red-900/30 text-red-400'}`}>Mood: {d.mood_level}</span>
                            <button onClick={() => handleDelete(d.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={16}/></button>
                        </div>
                        </div>
                        <p className="mb-4 text-lg text-slate-100">{d.content}</p>
                        <div className="bg-slate-900/50 p-4 rounded-2xl text-xs text-purple-200 border-l-4 border-purple-500">🤖 {text}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === 'settings' && token && (
            <div className="max-w-xl mx-auto bg-slate-800 p-10 rounded-[40px] border border-slate-700 shadow-2xl">
                <h2 className="text-2xl font-bold mb-10 flex items-center gap-3 text-purple-400"><Settings/> 帳戶設定</h2>
                <div className="flex items-center gap-4 mb-10 p-6 bg-slate-900/50 rounded-3xl border border-slate-700">
                    <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-full shadow-lg"><UserCircle size={40}/></div>
                    <div><p className="text-xs text-slate-500 tracking-widest uppercase">Current User</p><p className="text-xl font-bold">{user}</p></div>
                </div>
                <div className="space-y-4">
                    <button onClick={handleGenerateDemoData} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 py-4 rounded-2xl text-white font-bold shadow-lg shadow-blue-500/20"><Zap size={18} fill="currentColor"/> ⚡ 一鍵生成 5 篇 Demo 資料</button>
                    <button onClick={async () => { if(window.confirm("警告：這會清除所有個人紀錄且無法復原！")) { await axios.delete(`${API_URL}/users/clear_data`, { headers: { 'Authorization': `Bearer ${token}` } }); fetchDreams('personal'); } }} className="w-full py-4 rounded-2xl border border-red-500/30 text-red-400 hover:bg-red-900/20 transition-all font-bold">清除所有日記</button>
                </div>
                <div className="mt-12 pt-8 border-t border-slate-700">
                    <button onClick={logout} className="w-full py-4 rounded-2xl bg-slate-700 hover:bg-red-900 text-white transition-all font-bold shadow-xl">退出登錄系統</button>
                </div>
            </div>
        )}

        {view === 'library' && (
          <div>
            <div className="bg-slate-800 p-8 rounded-[40px] border border-slate-700 mb-8 shadow-2xl text-center">
              <h2 className="text-3xl font-black mb-2 text-pink-400 uppercase tracking-tighter">Dream Library</h2>
              <p className="text-slate-400 text-sm mb-8">窺探意識的海洋，尋找迷失的共鳴。</p>
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                 <input type="text" placeholder="搜尋關鍵字..." className="w-full md:w-1/3 bg-slate-900 px-6 py-3 rounded-2xl border border-slate-700 outline-none focus:border-purple-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchDreams('library')}/>
                 <div className="flex gap-2 p-1 bg-slate-900 rounded-2xl border border-slate-700">
                    <button onClick={() => setMoodFilter('')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${moodFilter === '' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>全部</button>
                    {['happy', 'neutral', 'sad'].map(m => <button key={m} onClick={() => setMoodFilter(m)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${moodFilter === m ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>{m === 'happy' ? '快樂' : m === 'sad' ? '焦慮' : '平靜'}</button>)}
                 </div>
                 {token && <button onClick={() => setShowSavedOnly(!showSavedOnly)} className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all ${showSavedOnly ? 'bg-pink-600 border-pink-600' : 'bg-transparent border-slate-600 hover:border-pink-500'}`}><Heart size={16} fill={showSavedOnly ? "white" : "none"}/> 只看收藏</button>}
                 <button onClick={() => fetchDreams('library')} className="bg-purple-600 p-3 rounded-2xl hover:bg-purple-500 active:scale-95 transition-all"><RefreshCw size={24}/></button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {libraryDreams.length === 0 && <div className="col-span-full text-center text-slate-500 py-20 border-2 border-dashed border-slate-800 rounded-3xl">未找到符合條件的公開夢境。</div>}
              {libraryDreams.map(d => {
                const { text } = parseDreamData(d.analysis);
                return (
                <div key={d.id} className="bg-slate-800 p-8 rounded-[32px] border border-slate-700 shadow-xl flex flex-col relative hover:-translate-y-2 transition-all">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                    <div className="bg-slate-700 p-2 rounded-xl text-pink-400"><User size={20}/></div>
                    <div><span className="font-bold text-slate-200 text-sm block">{d.author}</span><span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{d.date}</span></div>
                    {token && <button onClick={() => toggleSave(d.id)} className={`ml-auto p-2 rounded-full transition-all ${d.is_saved ? 'text-pink-500 bg-pink-500/10' : 'text-slate-600 hover:text-pink-400'}`}><Heart size={20} fill={d.is_saved ? "currentColor" : "none"} /></button>}
                  </div>
                  <p className={`text-slate-200 mb-4 leading-relaxed text-lg ${expandedId === d.id ? '' : 'line-clamp-3'}`}>{d.content}</p>
                  {d.content.length > 50 && <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)} className="text-purple-400 text-xs font-black mb-6 text-left">{expandedId === d.id ? "↑ 收起全文" : "... 閱讀全文"}</button>}
                  <div className="mt-auto">
                    <div className="flex flex-wrap gap-2 mb-4">{(d.keywords || []).map((k,i) => <span key={i} className="text-[10px] bg-slate-900 text-pink-300 px-3 py-1 rounded-full font-bold border border-pink-500/20">#{k}</span>)}</div>
                    <div className="text-[11px] text-purple-300 bg-purple-900/20 p-4 rounded-2xl border border-purple-500/30">🤖 {text}</div>
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
