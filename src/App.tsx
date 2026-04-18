import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, 
  Search, 
  RotateCw, 
  Download, 
  Upload, 
  FileJson, 
  FileSpreadsheet, 
  Trash2, 
  ChevronRight, 
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Info,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  RefreshCw,
  FileUp,
  FileDown,
  Users,
  UserCheck,
  Banknote,
  MapPin,
  TrendingUp,
  Activity,
  Phone,
  MessageSquare,
  MoreHorizontal,
  Filter,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { cn, SALES, CHANNELS, PRIVATE_OPTS, FOLLOW_OPTS, PRIVATE_STYLE, FOLLOW_STYLE, NEEDS_TREE, PROVINCES, InquiryRecord, NeedsNode } from './lib/constants';

const STORAGE_KEY = 'douyin_inquiry_logic_v5';

export default function App() {
  const [records, setRecords] = useState<InquiryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof InquiryRecord; direction: 1 | -1 }>({
    key: 'id',
    direction: -1
  });
  const [isSaved, setIsSaved] = useState(true);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [sopOpen, setSopOpen] = useState(false);

  // Modals state
  const [idEditTarget, setIdEditTarget] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'accumulate' | 'overwrite' | 'restore'>('accumulate');
  const [remarkModalId, setRemarkModalId] = useState<string | null>(null);
  const [textEditCtx, setTextEditCtx] = useState<{ id: string; field: keyof InquiryRecord; title: string } | null>(null);
  const [hideContact, setHideContact] = useState(true);
  const [hideTikTok, setHideTikTok] = useState(true);
  const [dismissedReminders, setDismissedReminders] = useState<string[]>([]);

  // Load data
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setRecords(parsed.data || []);
        setLastSaved(parsed.savedAt || null);
      } catch (e) {
        toast.error('读取存储数据失败');
      }
    }
  }, []);

  // Auto save
  useEffect(() => {
    if (records.length === 0 && !localStorage.getItem(STORAGE_KEY)) return;
    setIsSaved(false);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: records, savedAt: Date.now() }));
        setLastSaved(Date.now());
        setIsSaved(true);
      } catch (e) {
        toast.error('本地存储空间不足！');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [records]);

  // ID Utility
  const generateId = useCallback(() => {
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}`;
  }, []);

  const addRecord = () => {
    const newId = generateId();
    if (records.some(r => r.id === newId)) {
      toast.error('该时段已有记录，请稍后或修改编号');
    }
    const newRecord: InquiryRecord = {
      id: newId,
      sales: '',
      channel: '抖音私信',
      tiktok: '',
      contact: '',
      region: '',
      inquiry: '',
      needs: [],
      privateStatus: '已添加',
      followStatus: '新询盘',
      dealAmount: '',
      updatedAt: Date.now()
    };
    setRecords([newRecord, ...records]);
    toast.success('新建询盘成功');
  };

  const updateRecord = (id: string, field: keyof InquiryRecord, value: any) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value, updatedAt: Date.now() } : r));
  };

  const deleteRecord = (id: string) => {
    if (window.confirm('确定要删除这条询盘记录？')) {
      setRecords(prev => prev.filter(r => r.id !== id));
      toast.success('已删除');
    }
  };

  const changeId = (oldId: string, newId: string) => {
    if (records.some(r => r.id === newId && r.id !== oldId)) {
      toast.error('该编号已存在，请调整分钟');
      return false;
    }
    setRecords(prev => prev.map(r => r.id === oldId ? { ...r, id: newId, updatedAt: Date.now() } : r));
    setIdEditTarget(null);
    setRemarkModalId(newId);
    toast.success('编号已修改');
    return true;
  };

  // Filter and Sort
  const filteredRecords = useMemo(() => {
    let result = [...records];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => Object.values(r).join(' ').toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      const direction = sortConfig.direction;
      if (sortConfig.key === 'dealAmount') {
        const aVal = parseFloat(a.dealAmount) || 0;
        const bVal = parseFloat(b.dealAmount) || 0;
        return (aVal - bVal) * direction;
      }
      return String(a[sortConfig.key]).localeCompare(String(b[sortConfig.key]), 'zh') * direction;
    });
    return result;
  }, [records, searchQuery, sortConfig]);

  const stats = useMemo(() => {
    const total = records.length;
    const added = records.filter(r => r.privateStatus === '已添加').length;
    const dealAmount = records.reduce((acc, r) => acc + (parseFloat(r.dealAmount) || 0), 0);
    const provinces = new Set(records.map(r => {
      const region = r.region || '';
      return PROVINCES.find(p => region.includes(p)) || region.slice(0, 2);
    }).filter(Boolean)).size;
    return { total, added, dealAmount, provinces };
  }, [records]);

  // Reminders Logic
  const activeReminders = useMemo(() => {
    const now = Date.now();
    const ms48h = 48 * 60 * 60 * 1000;
    const ms15d = 15 * 24 * 60 * 60 * 1000;

    return records.filter(r => {
      if (dismissedReminders.includes(r.id)) return false;
      const lastAction = r.updatedAt || parseIdToMs(r.id);
      const elapsed = now - lastAction;

      if (r.followStatus === '跟进中' && elapsed > ms48h) return true;
      if (r.followStatus === '待联系' && elapsed > ms15d) return true;
      return false;
    }).map(r => {
      const lastAction = r.updatedAt || parseIdToMs(r.id);
      const elapsed = now - lastAction;
      const is48h = r.followStatus === '跟进中';
      return {
        id: r.id,
        name: r.tiktok || r.contact || '新客户',
        status: r.followStatus,
        elapsedDays: Math.floor(elapsed / (24 * 60 * 60 * 1000)),
        type: is48h ? 'follow' : 'dormant'
      };
    });
  }, [records, dismissedReminders]);

  const dismissReminder = (id: string) => {
    setDismissedReminders(prev => [...prev, id]);
  };

  const exportExcel = () => {
    if (filteredRecords.length === 0) return toast.error('没有可导出的数据');
    const headers = ['编号', '销售', '渠道', '抖音名', '联系方式', '地区', '原话', '需求', '私域状态', '跟进状态', '金额'];
    const data = filteredRecords.map(r => [
      r.id, r.sales, r.channel, r.tiktok, r.contact, r.region, r.inquiry, r.needs.join(','), r.privateStatus, r.followStatus, r.dealAmount
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '询盘明细');
    XLSX.writeFile(wb, `抖音询盘_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success('导出成功');
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!parsed.data || !Array.isArray(parsed.data)) throw new Error('无效数据');
        let nextRecords = [...records];
        if (importMode === 'restore') {
          nextRecords = parsed.data;
        } else {
          const map = new Map(nextRecords.map(r => [r.id, r]));
          parsed.data.forEach((r: any) => {
            if (importMode === 'overwrite' || !map.has(r.id)) map.set(r.id, r);
          });
          nextRecords = Array.from(map.values());
        }
        setRecords(nextRecords);
        setImportOpen(false);
        toast.success('导入完成');
      } catch (err) {
        toast.error('导入失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col min-h-screen font-sans bg-natural-bg text-natural-text">
      <Toaster position="bottom-right" />
      
      <header className="sticky top-0 z-50 flex items-center h-14 px-4 md:px-6 bg-white border-b border-natural-border shadow-sm">
        <div className="flex items-center gap-2 font-mono text-sm font-bold text-natural-primary">
          <div className="w-2.5 h-2.5 bg-natural-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(109,140,125,0.4)]" />
          <span className="hidden sm:inline">社媒渠道询盘数据系统-销售端</span>
          <span className="sm:hidden font-sans">社媒询盘系统</span>
        </div>
        <div className="w-px h-5 mx-3 md:mx-4 bg-natural-border" />
        <div className="hidden text-xs font-mono text-natural-muted md:block truncate">
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' })}
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono border rounded-full border-natural-border bg-natural-input text-natural-muted">
            <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px]", isSaved ? "bg-natural-success shadow-natural-success/40" : "bg-yellow-500 animate-pulse")} />
            {isSaved ? (lastSaved ? `同步于 ${new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '系统就绪') : '正在同步...'}
          </div>
          <button onClick={() => setImportOpen(true)} className="p-2 text-natural-muted hover:text-natural-primary transition-colors">
            <Upload size={18} />
          </button>
          <button onClick={() => setSopOpen(true)} className="md:hidden p-2 text-natural-muted">
            <Info size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-56 p-4 border-r border-natural-border bg-white hidden lg:flex flex-col sticky top-14 h-[calc(100vh-56px)]">
          <section className="mb-6">
            <h3 className="mb-4 px-1 font-mono text-[10px] font-bold tracking-[0.2em] text-natural-muted uppercase flex items-center gap-2">
              <Activity size={12} className="text-natural-primary" /> 数据概览
            </h3>
            <div className="grid gap-3">
              <StatCard 
                label="总询盘量" 
                value={stats.total} 
                icon={<Users size={14} />} 
                bg="bg-blue-50/50"
                borderColor="border-blue-100"
                textColor="text-blue-700"
              />
              <StatCard 
                label="私域已加" 
                value={stats.added} 
                icon={<UserCheck size={14} />} 
                bg="bg-natural-primary/5"
                borderColor="border-natural-primary/10"
                textColor="text-natural-primary"
              />
              <StatCard 
                label="累积成交" 
                value={`¥${stats.dealAmount.toLocaleString()}`} 
                icon={<Banknote size={14} />} 
                bg="bg-natural-success/5"
                borderColor="border-natural-success/10"
                textColor="text-natural-success"
              />
              <StatCard 
                label="覆盖地区" 
                value={`${stats.provinces}省`} 
                icon={<MapPin size={14} />} 
                bg="bg-orange-50/50"
                borderColor="border-orange-100"
                textColor="text-orange-700"
              />
            </div>
          </section>

          <div className="h-px mb-6 bg-natural-border opacity-50" />

          <section>
            <h3 className="mb-3 px-1 font-mono text-[10px] font-bold tracking-[0.15em] text-natural-muted uppercase">快捷操作</h3>
            <button onClick={addRecord} className="flex items-center justify-center w-full gap-2 px-3 py-2.5 text-sm font-bold text-white transition-all bg-natural-primary rounded-xl hover:bg-[#5a7667] shadow-lg shadow-natural-primary/20">
              <Plus size={18} /> 新增询盘
            </button>
          </section>

          <div className="mt-auto pt-6">
            <h3 className="mb-3 px-1 font-mono text-[10px] font-bold tracking-[0.15em] text-natural-muted uppercase">功能工具</h3>
            <div className="grid gap-2">
              <ActionBtn icon={<FileSpreadsheet size={14} />} label="导出 Excel" onClick={exportExcel} />
              <ActionBtn icon={<FileJson size={14} />} label="数据备份" onClick={() => {
                const blob = new Blob([JSON.stringify({ data: records, exportedAt: Date.now() }, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `询盘备份_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                toast.success('备份已下载');
              }} />
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-6 bg-natural-bg overflow-y-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-4 md:py-8">
            <div className="px-1">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-natural-text leading-tight">社媒渠道询盘数据系统-销售端</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-50 text-orange-600 rounded border border-orange-100 italic">测试版本</span>
                <span className="text-[10px] text-natural-muted font-medium">可能存在bug，发现问题及时与开发者姚兵联系，调整稳定性，记住：勤备份</span>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative group flex-1 md:flex-none">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-natural-muted group-focus-within:text-natural-primary" size={14} />
                <input 
                  type="text" 
                  placeholder="搜索客户..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:w-64 pl-9 pr-4 py-2 text-sm bg-white border border-natural-border rounded-xl outline-none focus:border-natural-primary transition-all shadow-sm"
                />
              </div>
              <button onClick={addRecord} className="md:hidden p-2 bg-natural-primary text-white rounded-xl shadow-lg">
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Statistics Grid for Mobile - Shows briefly at top */}
          <div className="lg:hidden grid grid-cols-2 gap-3 mb-6">
            <div className="p-3 bg-white border border-natural-border rounded-xl shadow-sm">
              <div className="text-[10px] text-natural-muted font-bold uppercase tracking-wider mb-1">总询盘</div>
              <div className="text-lg font-bold font-mono text-blue-600">{stats.total}</div>
            </div>
            <div className="p-3 bg-white border border-natural-border rounded-xl shadow-sm">
               <div className="text-[10px] text-natural-muted font-bold uppercase tracking-wider mb-1">成交额</div>
               <div className="text-lg font-bold font-mono text-natural-success">¥{stats.dealAmount.toLocaleString()}</div>
            </div>
          </div>

          <div className="mb-20">
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white border border-natural-border rounded-[24px] shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse min-w-[1240px]">
                <thead>
                  <tr className="bg-natural-input/50 border-b border-natural-border">
                    <SortableHeader label="编号" field="id" config={sortConfig} onSort={setSortConfig} width="140px" />
                    <SortableHeader label="销售" field="sales" config={sortConfig} onSort={setSortConfig} width="100px" />
                    <SortableHeader label="渠道" field="channel" config={sortConfig} onSort={setSortConfig} width="120px" />
                    <th style={{ width: '140px' }} className="px-4 py-4 text-[10px] font-bold tracking-[0.1em] text-natural-muted uppercase">
                      <div className="flex items-center justify-between">
                        <span>抖音名</span>
                        <button 
                          onClick={() => setHideTikTok(!hideTikTok)}
                          className="p-1 hover:bg-natural-input rounded-md transition-all text-natural-primary"
                          title={hideTikTok ? "显示详情" : "隐藏信息"}
                        >
                          {hideTikTok ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </th>
                    <th style={{ width: '140px' }} className="px-4 py-4 text-[10px] font-bold tracking-[0.1em] text-natural-muted uppercase">
                      <div className="flex items-center justify-between">
                        <span>联系方式</span>
                        <button 
                          onClick={() => setHideContact(!hideContact)}
                          className="p-1 hover:bg-natural-input rounded-md transition-all text-natural-primary"
                          title={hideContact ? "显示详情" : "隐藏号码"}
                        >
                          {hideContact ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </th>
                    <SortableHeader label="地区" field="region" config={sortConfig} onSort={setSortConfig} width="90px" />
                    <th className="px-4 py-4 text-[10px] font-bold tracking-[0.1em] text-natural-muted uppercase">客户原话</th>
                    <th style={{ width: '200px' }} className="px-4 py-4 text-[10px] font-bold tracking-[0.1em] text-natural-muted uppercase">客户真实需求</th>
                    <SortableHeader label="私域添加状态" field="privateStatus" config={sortConfig} onSort={setSortConfig} width="120px" />
                    <SortableHeader label="跟进" field="followStatus" config={sortConfig} onSort={setSortConfig} width="100px" />
                    <SortableHeader label="成交" field="dealAmount" config={sortConfig} onSort={setSortConfig} width="100px" />
                    <th className="w-10 px-4"></th>
                  </tr>
                </thead>
                <AnimatePresence initial={false}>
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((r) => (
                      <RecordRow 
                        key={r.id} 
                        record={r} 
                        hideContact={hideContact}
                        hideTikTok={hideTikTok}
                        onUpdate={updateRecord} 
                        onDelete={deleteRecord} 
                        onEditId={setIdEditTarget} 
                        onEditText={(id: string, field: any, title: string) => setTextEditCtx({ id, field, title })}
                      />
                    ))
                  ) : (
                    <tbody className="divide-y divide-natural-border/40">
                      <tr>
                        <td colSpan={12} className="py-24 text-center">
                          <div className="flex flex-col items-center gap-3 opacity-20">
                            <Info size={48} />
                            <p className="text-sm font-bold tracking-widest uppercase">No Records Found</p>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  )}
                </AnimatePresence>
              </table>
            </div>

            {/* Mobile Card-Based View */}
            <div className="lg:hidden space-y-4 pb-20 mt-4 px-1">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-bold text-natural-muted uppercase tracking-widest">询盘列表 ({filteredRecords.length})</span>
                <div className="flex gap-2">
                   <button className="p-1.5 text-natural-muted border rounded-lg bg-white"><Filter size={14}/></button>
                   <button className="p-1.5 text-natural-muted border rounded-lg bg-white"><ArrowRightLeft size={14}/></button>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((r) => (
                    <MobileRecordCard
                      key={r.id}
                      record={r}
                      hideContact={hideContact}
                      hideTikTok={hideTikTok}
                      onUpdate={updateRecord}
                      onDelete={deleteRecord}
                      onEditId={setIdEditTarget}
                      onEditText={(id: string, field: any, title: string) => setTextEditCtx({ id, field, title })}
                    />
                  ))
                ) : (
                  <div className="py-20 text-center bg-white border border-natural-border rounded-xl opacity-40">
                    <Info size={40} className="mx-auto mb-2" />
                    <p className="text-xs uppercase font-bold tracking-widest">暂无数据</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <section className="mt-8 overflow-hidden bg-white border border-natural-border rounded-2xl shadow-sm">
            <button onClick={() => setSopOpen(!sopOpen)} className="flex items-center justify-between w-full px-6 py-4 hover:bg-natural-input/30 transition-colors">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-natural-primary" />
                <span className="font-bold text-natural-text">填写规范 & 销售须知 SOP</span>
              </div>
              <ChevronDown size={20} className={cn("text-natural-muted transition-transform", sopOpen && "rotate-180")} />
            </button>
             <AnimatePresence>
              {sopOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-6 pb-8 overflow-hidden">
                  <div className="grid gap-10 pt-6 lg:grid-cols-2">
                    {/* Section 1: Field Description */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-natural-border">
                        <span className="text-lg">📋</span>
                        <h4 className="font-bold text-natural-text uppercase tracking-widest text-sm">字段说明</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <SopItem title="编号 (必填)" desc="年/月/日/时分自动生成，如 202604171430。以添加微信时间为准，可点击修改。" />
                        <SopItem title="销售姓名 (必填)" desc="选择录入人自己的名字。" />
                        <SopItem title="来源渠道 (必填)" desc="这条询盘怎么来的。灰色选项为运营专用，销售无法选择。" />
                        <SopItem title="抖音名称 (选填)" desc="从抖音后台来的必填，是唯一能找到客户的方式。" />
                        <SopItem title="联系方式 (必填)" desc="客户电话/微信号，用于多方核对客户信息。" />
                        <SopItem title="地区 (选填)" desc="客户所在省市，如：广东广州。" />
                        <SopItem title="客户原话 (必填)" desc="直接复制粘贴聊天记录，一定是客户原话，不要修改。" />
                        <SopItem title="客户真实需求 (必填)" desc="打对应标签，可多选，父选项可选子选项，点击单元格原地展开。" />
                        <SopItem title="私域添加状态 (必填)" desc="已添加：成功加微信 · 添加未通过：加了未通过 · 对方拒加抖私续聊：继续私信 · 电话中断：通话中断。" />
                        <SopItem title="跟进状态 (必填)" desc="新询盘 · 跟进中 · 已报价 · 待联系 · 已成交 · 无效。" />
                        <SopItem title="成交金额 (有成交才填)" desc="确认下单后填写（元），用于核算产出比。" />
                      </div>
                    </div>

                    {/* Section 2: Instruction SOP */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-natural-border">
                        <span className="text-lg">📌</span>
                        <h4 className="font-bold text-natural-text uppercase tracking-widest text-sm">销售须知 SOP</h4>
                      </div>

                      <div className="space-y-6">
                        <section>
                          <h5 className="text-[11px] font-bold text-natural-primary px-2 mb-2 bg-natural-primary/5 inline-block rounded">一、微信分组管理</h5>
                          <p className="text-xs text-natural-muted pl-2">所有抖音渠道添加的客户，须在微信建立「抖音来客」分组并归入，不得遗漏。</p>
                        </section>

                        <section>
                          <h5 className="text-[11px] font-bold text-natural-primary px-2 mb-2 bg-natural-primary/5 inline-block rounded">二、跟进时限要求</h5>
                          <p className="text-xs text-natural-muted pl-2 leading-relaxed">留下联系方式后 <b className="text-natural-text">7个自然日内</b> 须完成：通过私信建立有效沟通，或成功添加微信。逾期判定无效，主管重新分配。</p>
                        </section>

                        <section>
                          <h5 className="text-[11px] font-bold text-red-600 px-2 mb-2 bg-red-50 inline-block rounded">三、禁止行为</h5>
                          <ul className="text-xs text-red-700/80 pl-4 list-disc space-y-1">
                            <li>虚报添加记录</li>
                            <li>擅自删除客户</li>
                            <li>放弃私信追踪</li>
                            <li>删除聊天记录</li>
                          </ul>
                        </section>

                        <section>
                          <h5 className="text-[11px] font-bold text-natural-primary px-2 mb-2 bg-natural-primary/5 inline-block rounded">四、特殊客户处理</h5>
                          <p className="text-xs text-natural-muted pl-2 leading-relaxed">非目标或骚扰客户：开启免打扰折叠，不得自行删除。需删除须告知运营确认后操作，并更新询盘为无效。</p>
                        </section>

                        <section>
                          <h5 className="text-[11px] font-bold text-natural-primary px-2 mb-2 bg-natural-primary/5 inline-block rounded">五、业务协作（新销售）</h5>
                          <p className="text-xs text-natural-muted pl-2 leading-relaxed">不熟悉报价时：找姚总或李健拉三方群，问好客户后将后台截图发群 @ 相关人，禁止说不确定的话，禁止搁置客户过久。</p>
                        </section>

                        <section>
                          <h5 className="text-[11px] font-bold text-natural-primary px-2 mb-2 bg-natural-primary/5 inline-block rounded">六、不定期抽查</h5>
                          <ul className="text-xs text-natural-muted pl-4 list-disc space-y-1">
                            <li>「抖音来客」分组是否完整</li>
                            <li>已添加客户是否实际存在</li>
                            <li>聊天记录是否完整保留</li>
                            <li>私信跟进是否符合时限</li>
                            <li>周月例会总结成功/失败案例</li>
                          </ul>
                        </section>

                        <div className="pt-6 border-t border-natural-border flex flex-wrap gap-2 items-center justify-center">
                          {['客户不能丢', '记录不能删', '不懂要问人', '删除要报备'].map(t => (
                            <span key={t} className="px-3 py-1 bg-natural-text text-white text-[10px] font-bold rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </main>
      </div>


      <AnimatePresence>
        {idEditTarget && <IdEditModal targetId={idEditTarget} currentRecords={records} onClose={() => setIdEditTarget(null)} onConfirm={newId => changeId(idEditTarget, newId)} />}
        {importOpen && <ImportModal mode={importMode} onModeChange={setImportMode} onImport={handleImport} onClose={() => setImportOpen(false)} />}
        {textEditCtx && <TextEditModal ctx={textEditCtx} currentRecords={records} onSave={(id: string, field: any, val: string) => { updateRecord(id, field, val); setTextEditCtx(null); }} onClose={() => setTextEditCtx(null)} />}
        {remarkModalId && <RemarkReminder id={remarkModalId} onClose={() => setRemarkModalId(null)} />}
      </AnimatePresence>

      {/* Floating Action Button for Mobile */}
      <button 
        onClick={addRecord}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-natural-primary text-white rounded-full shadow-2xl flex items-center justify-center bounce-in z-[60]"
      >
        <Plus size={28} />
      </button>

      <ReminderOverlay reminders={activeReminders} onDismiss={dismissReminder} />
    </div>
  );
}

// Reminder Helper
const parseIdToMs = (id: string) => {
  if (id.length !== 12) return Date.now();
  const year = parseInt(id.slice(0, 4));
  const month = parseInt(id.slice(4, 6)) - 1;
  const day = parseInt(id.slice(6, 8));
  const hour = parseInt(id.slice(8, 10));
  const min = parseInt(id.slice(10, 12));
  return new Date(year, month, day, hour, min).getTime();
};

function ReminderOverlay({ reminders, onDismiss }: { reminders: any[], onDismiss: (id: string) => void }) {
  if (reminders.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[80] flex flex-col gap-3 pointer-events-none w-80">
      <AnimatePresence>
        {reminders.slice(0, 3).map((rem, idx) => (
          <motion.div
            key={rem.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="pointer-events-auto bg-white border border-natural-border p-4 rounded-2xl shadow-xl ring-1 ring-black/[0.05]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    rem.type === 'follow' ? "bg-orange-500" : "bg-blue-500"
                  )} />
                  <span className="text-[10px] font-bold text-natural-muted uppercase tracking-wider">跟进提醒</span>
                </div>
                <h4 className="text-xs font-bold text-natural-text mb-1 truncate max-w-[180px]">客户: {rem.name}</h4>
                <p className="text-[11px] text-natural-muted leading-relaxed">
                  {rem.type === 'follow' ? (
                    <>该客户已处于 <b className="text-orange-600">跟进中</b> 超过 48 小时没有新进展记录，请及时回复。</>
                  ) : (
                    <>处于 <b className="text-blue-600">待联系</b> 的休眠客户已满 15 天，该重新激活了。</>
                  )}
                </p>
              </div>
              <button 
                onClick={() => onDismiss(rem.id)}
                className="p-1 hover:bg-natural-input rounded-md transition-colors text-natural-muted"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {reminders.length > 3 && (
        <div className="text-[10px] text-center text-natural-muted font-bold tracking-widest uppercase">
          还有 {reminders.length - 3} 条待处理提醒
        </div>
      )}
    </div>
  );
}

// Components
function StatCard({ 
  label, 
  value, 
  icon, 
  bg = "bg-white", 
  borderColor = "border-natural-border",
  textColor = "text-natural-text"
}: { 
  label: string; 
  value: string | number; 
  icon?: React.ReactNode;
  bg?: string;
  borderColor?: string;
  textColor?: string;
}) {
  return (
    <div className={cn(
      "relative overflow-hidden p-3.5 border rounded-2xl transition-all shadow-sm group hover:shadow-md",
      bg,
      borderColor
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-natural-muted font-bold tracking-widest uppercase">{label}</div>
        {icon && <div className={cn("opacity-40 group-hover:opacity-100 transition-opacity", textColor)}>{icon}</div>}
      </div>
      <div className={cn("text-xl font-bold font-mono tracking-tighter", textColor)}>{value}</div>
      <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rotate-12 scale-150">
        {icon}
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-3 py-2 text-xs text-natural-muted border border-natural-border rounded-xl hover:bg-natural-input hover:text-natural-text transition-all font-medium">
      {icon} {label}
    </button>
  );
}

function SortableHeader({ label, field, config, onSort, width }: any) {
  const isActive = config.key === field;
  return (
    <th style={{ width }} className="px-4 py-4 text-[10px] font-bold tracking-[0.1em] text-natural-muted uppercase cursor-pointer hover:text-natural-primary transition-colors group" onClick={() => onSort({ key: field, direction: (isActive && config.direction === 1) ? -1 : 1 })}>
      <div className="flex items-center gap-1">
        {label}
        <span className={cn("transition-opacity", isActive ? "opacity-100 text-natural-primary" : "opacity-0 group-hover:opacity-40")}>
          {isActive ? (config.direction === 1 ? '↑' : '↓') : '↑'}
        </span>
      </div>
    </th>
  );
}

function SopItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-4 bg-natural-input/50 rounded-xl border border-natural-border/40">
      <div className="mb-2 text-xs font-bold text-natural-primary uppercase tracking-wide flex items-center gap-2">
        <span className="w-1 h-3 bg-natural-primary rounded-full" />
        {title}
      </div>
      <div className="text-sm leading-relaxed text-natural-muted">{desc}</div>
    </div>
  );
}

function useClickAway(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

function MobileRecordCard({ record, hideContact, hideTikTok, onUpdate, onDelete, onEditId, onEditText }: any) {
  const [needsOpen, setNeedsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useClickAway(containerRef, () => {
    if (needsOpen) setNeedsOpen(false);
  });

  const displayContact = useMemo(() => {
    if (!record.contact) return '未填写';
    if (!hideContact) return record.contact;
    return '***' + record.contact.slice(-4);
  }, [record.contact, hideContact]);

  const displayTikTok = useMemo(() => {
    if (!record.tiktok) return '未名';
    if (!hideTikTok) return record.tiktok;
    return '***' + record.tiktok.slice(-4);
  }, [record.tiktok, hideTikTok]);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      ref={containerRef}
      className={cn(
        "bg-white border border-natural-border rounded-[20px] p-4 shadow-sm transition-all relative overflow-hidden",
        needsOpen && "ring-2 ring-natural-primary/10 shadow-lg"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-natural-muted font-bold tracking-wider">{record.id}</span>
            <span className="px-1.5 py-0.5 bg-natural-input text-natural-muted text-[9px] rounded font-bold uppercase">{record.channel}</span>
          </div>
          <h3 className="text-base font-bold text-natural-text flex items-center gap-1.5">
            {displayTikTok}
            {!record.tiktok && <span className="text-[10px] text-red-400 italic">必填</span>}
          </h3>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => onDelete(record.id)} className="p-2 text-natural-muted border rounded-full hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
           <button onClick={() => onEditId(record.id)} className="p-2 bg-natural-primary text-white rounded-full shadow-md"><Plus size={14} className="rotate-45" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-4 gap-x-2 mb-4">
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-natural-muted uppercase tracking-widest pl-0.5">联系方式</label>
          <div className="flex items-center gap-2 px-3 py-2 bg-natural-input/50 rounded-xl">
            <span className="text-xs font-mono font-bold truncate">{displayContact}</span>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-natural-muted uppercase tracking-widest pl-0.5">负责销售</label>
          <select 
            value={record.sales} 
            onChange={(e) => onUpdate(record.id, 'sales', e.target.value)}
            className="w-full text-xs font-bold px-3 py-2 bg-natural-input/50 rounded-xl outline-none appearance-none"
          >
            {SA_OPTS}
          </select>
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-[9px] font-bold text-natural-muted uppercase tracking-widest pl-0.5">客户原话</label>
          <div 
            onClick={() => onEditText(record.id, 'inquiry', '客户原话')} 
            className={cn(
              "px-3 py-2 text-xs bg-natural-input/50 rounded-xl transition-all cursor-pointer",
              record.inquiry ? "text-natural-text" : "text-natural-muted/40 italic"
            )}
          >
            {record.inquiry || '点击录入记录...'}
          </div>
        </div>
        <div className="col-span-2 space-y-1 relative">
          <label className="text-[9px] font-bold text-natural-muted uppercase tracking-widest pl-0.5">客户真实需求</label>
          <div 
            onClick={() => setNeedsOpen(!needsOpen)}
            className={cn(
              "p-2.5 min-h-[48px] bg-natural-input/50 rounded-[16px] flex flex-wrap gap-1 items-center transition-all border border-transparent",
              needsOpen && "bg-white border-natural-primary shadow-sm"
            )}
          >
             {record.needs.length > 0 ? (
                record.needs.map(n => (
                  <span key={n} className="inline-flex items-center gap-1 px-1.5 py-1 bg-orange-50 text-orange-600 rounded text-[9px] font-bold border border-orange-100">
                    {flattenNeedLabel(n)}
                    <X size={10} onClick={(e) => { e.stopPropagation(); onUpdate(record.id, 'needs', record.needs.filter((k: string) => k !== n)); }} />
                  </span>
                ))
             ) : (
                <span className="text-[10px] text-natural-muted border-dashed border border-natural-border/40 px-2 py-1 rounded">点击配置需求</span>
             )}
          </div>
          
          <AnimatePresence>
            {needsOpen && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-natural-border p-3 rounded-2xl shadow-2xl max-h-[300px] overflow-y-auto"
              >
                <div className="flex flex-col gap-4">
                  {[
                    { title: "收缩膜/亮白膜", keys: ['pvc', 'pet_shrink', 'pet_bright'] },
                    { title: "热熔胶系列", keys: ['hotmelt_daily', 'hotmelt_drink', 'hotmelt_other'] },
                    { title: "桶装水/包装", keys: ['barrel_shrink', 'barrel_body', 'adhesive_other', 'plastic_bag'] }
                  ].map(group => (
                    <div key={group.title} className="space-y-1">
                      <div className="text-[9px] font-bold text-natural-muted/60 uppercase border-b border-natural-border pb-0.5 mb-1">{group.title}</div>
                      {group.keys.map(k => {
                        const node = findNode(NEEDS_TREE, k);
                        if (!node) return null;
                        return (
                          <NeedNode 
                            key={node.key} 
                            node={node} 
                            selected={record.needs} 
                            onToggle={(key: string) => {
                              let next;
                              const target = findNode(NEEDS_TREE, key);
                              if (target && target.children) {
                                const allKeys = gatherAllKeys(target);
                                next = allKeys.every(k => record.needs.includes(k)) ? record.needs.filter(k => !allKeys.includes(k)) : Array.from(new Set([...record.needs, ...allKeys]));
                              } else { 
                                next = record.needs.includes(key) ? record.needs.filter(k => k !== key) : [...record.needs, key]; 
                              }
                              onUpdate(record.id, 'needs', next);
                            }} 
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-natural-border/30">
        <div className="flex-1">
          <StatusSelect value={record.privateStatus} options={PRIVATE_OPTS} styleMap={PRIVATE_STYLE} onChange={(v: any) => onUpdate(record.id, 'privateStatus', v)} />
        </div>
        <div className="flex-1">
          <StatusSelect value={record.followStatus} options={FOLLOW_OPTS} styleMap={FOLLOW_STYLE} onChange={(v: any) => onUpdate(record.id, 'followStatus', v)} />
        </div>
      </div>
    </motion.div>
  );
}

function RecordRow({ record, hideContact, hideTikTok, onUpdate, onDelete, onEditId, onEditText }: any) {
  const [needsOpen, setNeedsOpen] = useState(false);
  const containerRef = useRef<HTMLTableSectionElement>(null);
  
  useClickAway(containerRef, () => {
    if (needsOpen) setNeedsOpen(false);
  });
  
  const displayContact = useMemo(() => {
    if (!record.contact) return '';
    if (!hideContact) return record.contact;
    return '***' + record.contact.slice(-4);
  }, [record.contact, hideContact]);

  const displayTikTok = useMemo(() => {
    if (!record.tiktok) return '';
    if (!hideTikTok) return record.tiktok;
    return '***' + record.tiktok.slice(-4);
  }, [record.tiktok, hideTikTok]);

  return (
    <tbody ref={containerRef} className="border-none contents">
      <motion.tr 
        layout="position"
        className="group hover:bg-natural-input/30 transition-colors border-b border-natural-border/40 last:border-0"
      >
        <td className="px-4 py-3">
          <div onClick={() => onEditId(record.id)} className="flex items-center gap-1 font-mono text-xs text-natural-muted group-hover:text-natural-primary cursor-pointer transition-colors relative">
            {record.id}
            <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-[10px] bg-natural-primary text-white p-0.5 rounded shadow-sm">✎</span>
          </div>
        </td>
        <td className="px-1 py-1"><select value={record.sales} onChange={(e) => onUpdate(record.id, 'sales', e.target.value)} className="w-full px-2 py-2 text-sm bg-transparent outline-none focus:bg-white rounded-lg transition-all appearance-none">{SA_OPTS}</select></td>
        <td className="px-1 py-1"><select value={record.channel} onChange={(e) => onUpdate(record.id, 'channel', e.target.value)} className="w-full px-2 py-2 text-sm bg-transparent outline-none focus:bg-white rounded-lg transition-all">{CH_OPTS}</select></td>
        <td className="px-1 py-1 w-[140px]">
          {hideTikTok ? (
            <div className="w-full px-2 py-2 text-sm text-natural-muted cursor-default select-none truncate">
              {displayTikTok}
            </div>
          ) : (
            <input 
              type="text" 
              value={record.tiktok} 
              placeholder={record.channel === '运营指定' ? '无需填写' : '抖音号(必填)'}
              disabled={record.channel === '运营指定'}
              onChange={(e) => onUpdate(record.id, 'tiktok', e.target.value)}
              className={cn(
                "w-full px-2 py-2 text-sm bg-transparent outline-none rounded-lg transition-all placeholder:text-natural-muted/30",
                record.channel === '运营指定' ? "bg-natural-bg/50 text-natural-muted/50 cursor-not-allowed border-transparent" : "focus:bg-white"
              )}
            />
          )}
        </td>
        <td className="px-1 py-1 w-[140px]">
          {hideContact ? (
            <div className="w-full px-2 py-2 font-mono text-sm text-natural-muted cursor-default select-none">
              {displayContact}
            </div>
          ) : (
            <input 
              type="text" 
              value={record.contact} 
              placeholder="电话/微信/WA..." 
              onChange={(e) => onUpdate(record.id, 'contact', e.target.value)} 
              className="w-full px-2 py-2 font-mono text-sm bg-transparent outline-none focus:bg-white rounded-lg uppercase placeholder:text-natural-muted/30" 
            />
          )}
        </td>
        <td className="px-1 py-1"><input type="text" value={record.region} placeholder="广东广州" onChange={(e) => onUpdate(record.id, 'region', e.target.value)} className="w-full px-2 py-2 text-sm bg-transparent outline-none focus:bg-white rounded-lg placeholder:text-natural-muted/30" /></td>
        <td className="px-1 py-1 max-w-[140px] truncate">
          <div 
            onClick={() => onEditText(record.id, 'inquiry', '客户原话')} 
            className={cn(
              "px-2 py-2 text-xs truncate cursor-pointer hover:bg-white rounded-lg transition-colors",
              record.inquiry ? "text-natural-text" : "text-natural-muted/50 italic"
            )}
          >
            {record.inquiry || '复制粘贴聊天记录...'}
          </div>
        </td>
        <td className="px-1 py-1 relative">
          <div onClick={() => setNeedsOpen(!needsOpen)} className={cn("flex flex-wrap gap-1 min-h-[44px] items-center p-2 text-[10px] border border-transparent rounded-lg cursor-pointer transition-all", needsOpen ? "bg-white border-natural-border shadow-sm ring-2 ring-natural-primary/5" : "hover:bg-white border-dashed hover:border-natural-border")}>
            {record.needs.length > 0 ? (
              record.needs.map(n => (
                <span key={n} className="group/tag inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded border border-orange-100 hover:border-orange-300 transition-colors">
                  {flattenNeedLabel(n)}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate(record.id, 'needs', record.needs.filter((k: string) => k !== n));
                    }}
                    className="opacity-40 hover:opacity-100 hover:bg-orange-200 rounded p-0.5 transition-all"
                  >
                    <X size={8} />
                  </button>
                </span>
              ))
            ) : (
              <span className="opacity-30 italic">点击选择标签...</span>
            )}
          </div>
        </td>
        <td className="px-1 py-1"><StatusSelect value={record.privateStatus} options={PRIVATE_OPTS} styleMap={PRIVATE_STYLE} onChange={(v: any) => onUpdate(record.id, 'privateStatus', v)} /></td>
        <td className="px-1 py-1"><StatusSelect value={record.followStatus} options={FOLLOW_OPTS} styleMap={FOLLOW_STYLE} onChange={(v: any) => onUpdate(record.id, 'followStatus', v)} /></td>
        <td className="px-1 py-1"><div className="flex items-center gap-0.5"><span className="text-natural-muted font-mono text-[10px]">¥</span><input type="text" value={record.dealAmount} placeholder="成交填" onChange={(e) => onUpdate(record.id, 'dealAmount', e.target.value)} className="w-full px-1 py-2 font-mono text-sm bg-transparent outline-none focus:bg-white rounded-lg text-right placeholder:text-natural-muted/30" /></div></td>
        <td className="px-4 text-right"><button onClick={() => onDelete(record.id)} className="p-1.5 text-natural-muted hover:text-red-500 rounded-full hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button></td>
      </motion.tr>
      <AnimatePresence>
        {needsOpen && (
          <motion.tr 
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-none grow-row"
          >
            <td colSpan={12} className="p-0 border-none">
              <motion.div 
                layout
                initial={{ height: 0 }} 
                animate={{ height: 'auto' }} 
                exit={{ height: 0 }} 
                className="overflow-hidden bg-natural-bg/20 px-4 pb-4"
              >
                <div className="p-2 bg-white border border-natural-border rounded-xl shadow-sm">
                  <div className="flex items-center justify-between border-b pb-1.5 border-natural-border/50 mb-1.5">
                    <h4 className="text-[10px] font-bold text-natural-primary flex items-center gap-1.5 cursor-default uppercase tracking-wider">
                      <CheckCircle2 size={12} /> 选择需求（多选/子母联动）
                    </h4>
                    <button onClick={() => setNeedsOpen(false)} className="p-1 hover:bg-natural-input rounded-md transition-colors text-natural-muted">
                      <X size={12}/>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1 pt-1">
                    {[
                      { title: "收缩膜/亮白膜", keys: ['pvc', 'pet_shrink', 'pet_bright'] },
                      { title: "热熔胶系列", keys: ['hotmelt_daily', 'hotmelt_drink', 'hotmelt_other'] },
                      { title: "桶装水系列", keys: ['barrel_shrink', 'barrel_body', 'barrel_dust'] },
                      { title: "袋装/复合/不干胶", keys: ['adhesive_other', 'plastic_bag', 'composite_roll', 'composite_bag'] },
                      { title: "其它", keys: ['other'] }
                    ].map(group => (
                      <div key={group.title} className="flex-1 min-w-[160px] space-y-0">
                        <div className="px-2 mb-1.5 pt-1">
                          <span className="text-[9px] font-bold text-natural-muted/60 uppercase tracking-tighter border-b border-natural-border/30 pb-0.5 block">{group.title}</span>
                        </div>
                        {group.keys.map(k => {
                          const node = findNode(NEEDS_TREE, k);
                          if (!node) return null;
                          return (
                            <NeedNode 
                              key={node.key} 
                              node={node} 
                              selected={record.needs} 
                              onToggle={(key: string) => {
                                let next;
                                const target = findNode(NEEDS_TREE, key);
                                if (target && target.children) {
                                  const allKeys = gatherAllKeys(target);
                                  const allIn = allKeys.every(k => record.needs.includes(k));
                                  next = allIn ? record.needs.filter(k => !allKeys.includes(k)) : Array.from(new Set([...record.needs, ...allKeys]));
                                } else { 
                                  next = record.needs.includes(key) ? record.needs.filter(k => k !== key) : [...record.needs, key]; 
                                }
                                onUpdate(record.id, 'needs', next);
                              }} 
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </tbody>
  );
}

const SA_OPTS = [<option key="0" value="">未选</option>, ...SALES.map(s => <option key={s} value={s}>{s}</option>)];
const CH_OPTS = CHANNELS.map(c => <option key={c.v} value={c.v} disabled={c.lk}>{c.v}</option>);

function StatusSelect({ value, options, styleMap, onChange }: any) {
  return (
    <div className={cn("inline-flex items-center px-2.5 py-1.5 text-[10px] font-bold border rounded-full transition-all cursor-pointer group/sel shadow-sm", styleMap[value])}>
      <select value={value} onChange={(e) => onChange(e.target.value as any)} className="bg-transparent outline-none appearance-none cursor-pointer">{options.map((o: any) => <option key={o} value={o} className="bg-white text-natural-text">{o}</option>)}</select>
      <ChevronDown size={8} className="ml-1 opacity-40 group-hover/sel:opacity-100" />
    </div>
  );
}

function NeedNode({ node, selected, onToggle }: any) {
  const [open, setOpen] = useState(false);
  const isSelected = selected.includes(node.key);
  const childKeys = gatherAllKeys(node).filter(k => k !== node.key);
  const allChildrenSelected = childKeys.length > 0 && childKeys.every(k => selected.includes(k));
  const isPartial = childKeys.length > 0 && !allChildrenSelected && childKeys.some(k => selected.includes(k));

  return (
    <div className="select-none py-[1px]">
      <div 
        onClick={() => { if (node.children) setOpen(!open); else onToggle(node.key); }}
        className={cn(
          "flex items-center gap-1.5 px-2 py-0 border border-transparent rounded-lg transition-all text-[11px] group/item cursor-pointer w-fit min-w-[140px]", 
          (isSelected || allChildrenSelected) ? "bg-natural-primary/5 text-natural-primary font-bold" : "hover:bg-natural-input text-natural-muted"
        )}
      >
        <div className="relative flex items-center justify-center shrink-0" onClick={(e) => { e.stopPropagation(); onToggle(node.key); }}>
          <input 
            type="checkbox" 
            checked={isSelected || allChildrenSelected} 
            readOnly
            className={cn("w-3.5 h-3.5 rounded border border-natural-border appearance-none checked:bg-natural-primary transition-all cursor-pointer", isPartial && "bg-natural-primary/30 border-natural-primary")} 
          />
          {(isSelected || allChildrenSelected) && !isPartial && <CheckCircle2 size={9} className="absolute text-white pointer-events-none" />}
          {isPartial && <div className="absolute w-1.5 h-0.5 bg-white rounded-full pointer-events-none" />}
        </div>
        <span className="cursor-pointer truncate leading-none py-1.5">{node.label}</span>
        {node.children && (
          <div 
            className={cn("p-0.5 opacity-40 group-hover/item:opacity-100 transition-all ml-0.5", open && "rotate-90 opacity-100")}
          >
            <ChevronRight size={10} />
          </div>
        )}
      </div>
      <AnimatePresence>{open && node.children && (
        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="ml-2.5 mt-0 space-y-0 border-l border-natural-border/60 overflow-hidden pl-1.5 pb-0.5">
          {node.children.map(c => (
            <div 
              key={c.key} 
              onClick={() => onToggle(c.key)} 
              className={cn(
                "flex items-center gap-1.5 px-1.5 py-0.5 rounded-md transition-all text-[10px] cursor-pointer w-fit", 
                selected.includes(c.key) ? "bg-orange-50 text-orange-600 font-medium" : "text-natural-muted/60 hover:text-natural-text"
              )}
            >
              <div className="w-0.5 h-0.5 rounded-full bg-current opacity-30" />
              {c.label}
            </div>
          ))}
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

function IdEditModal({ targetId, currentRecords, onClose, onConfirm }: any) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (targetId?.length === 12) {
      setDate(`${targetId.slice(0,4)}-${targetId.slice(4,6)}-${targetId.slice(6,8)}`);
      setTime(`${targetId.slice(8,10)}:${targetId.slice(10,12)}`);
    } else {
      const n = new Date();
      setDate(n.toISOString().slice(0,10));
      setTime(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`);
    }
  }, [targetId]);

  const pId = `${date.replace(/-/g,'')}${time.replace(':','')}`;
  useEffect(() => {
    if (currentRecords.some(r => r.id === pId && r.id !== targetId)) return setWarning('⚠ 此编号已存在');
    setWarning(null);
  }, [pId, targetId, currentRecords]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-bold mb-2">修改询盘编号</h3>
        <p className="text-xs text-natural-muted mb-6 leading-relaxed">
          编号是你添加来客进入私域社交软件的时间，默认为当下时间，请核准修改。
        </p>
        <div className="space-y-4 mb-6">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-natural-input p-3 rounded-xl border border-natural-border outline-none" />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-natural-input p-3 rounded-xl border border-natural-border outline-none" />
        </div>
        <div className="p-4 bg-natural-primary/5 rounded-2xl mb-6 text-center">
          <div className="text-[10px] text-natural-muted font-bold uppercase mb-1">预览</div>
          <div className="text-2xl font-mono font-bold text-natural-primary">{pId}</div>
        </div>
        {warning && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl mb-6">{warning}</div>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-medium text-natural-muted">取消</button>
          <button disabled={!!warning} onClick={() => onConfirm(pId)} className="flex-[2] bg-natural-primary text-white rounded-xl font-bold hover:bg-[#5a7667] transition-all disabled:opacity-50">确认修改</button>
        </div>
      </motion.div>
    </div>
  );
}

function ImportModal({ mode, onModeChange, onImport, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <h3 className="text-xl font-bold mb-6">导入数据</h3>
        <div className="flex gap-2 mb-8">
          {['accumulate', 'restore'].map(m => (
            <button key={m} onClick={() => onModeChange(m)} className={cn("flex-1 p-3 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-widest", mode === m ? "border-natural-primary bg-natural-primary/5 text-natural-primary" : "border-natural-border text-natural-muted opacity-40")}>{m === 'accumulate' ? '累加' : '覆盖'}</button>
          ))}
        </div>
        <label className="flex flex-col items-center justify-center w-full min-h-[140px] border-2 border-dashed border-natural-border rounded-2xl cursor-pointer hover:border-natural-primary hover:bg-natural-primary/5 transition-all">
          <input type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && onImport(e.target.files[0])} />
          <Upload size={24} className="mb-2 opacity-40" />
          <span className="text-sm font-bold opacity-60">选择备份 JSON 文件</span>
        </label>
        <button onClick={onClose} className="w-full mt-6 py-2 text-sm text-natural-muted">取消</button>
      </div>
    </div>
  );
}

function TextEditModal({ ctx, currentRecords, onSave, onClose }: any) {
  const [v, setV] = useState('');
  useEffect(() => { const r = currentRecords.find((x:any) => x.id === ctx.id); if (r) setV(r[ctx.field] || ''); }, [ctx, currentRecords]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 text-natural-text">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl">
        <h3 className="font-bold mb-4">{ctx.title}</h3>
        <textarea autoFocus value={v} onChange={e => setV(e.target.value)} className="w-full min-h-[200px] bg-natural-input border border-natural-border rounded-xl p-4 text-sm outline-none resize-none" />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm">取消</button>
          <button onClick={() => onSave(ctx.id, ctx.field, v)} className="bg-natural-primary text-white font-bold px-6 py-2 rounded-xl">确认保存</button>
        </div>
      </div>
    </div>
  );
}

function RemarkReminder({ id, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-natural-primary/20 backdrop-blur-md p-4">
      <div className="bg-white rounded-[40px] p-10 max-w-sm w-full text-center shadow-2xl">
        <div className="w-16 h-16 bg-natural-success/10 text-natural-success rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={32} /></div>
        <h3 className="text-xl font-bold mb-3">编号已修改！</h3>
        <p className="text-sm text-natural-muted mb-8 leading-relaxed">请前往微信，同步修改客户描述中的编号，确保资料一致：</p>
        <div className="bg-natural-input p-5 rounded-2xl text-2xl font-mono font-bold text-natural-primary mb-8 select-all ring-1 ring-natural-primary/10">{id}</div>
        <button onClick={onClose} className="w-full bg-natural-primary text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-[#5a7667] transition-all">✓ 我已修改微信备注</button>
      </div>
    </div>
  );
}

const flattenNeedLabel = (k: string) => {
  for (const n of NEEDS_TREE) { 
    if (n.key === k) return n.label; 
    const c = n.children?.find(x => x.key === k); 
    if (c) return `${n.label.slice(0,3)}·${c.label}`; 
  }
  return k;
};

const findNode = (nodes: NeedsNode[], k: string): NeedsNode | null => {
  for (const n of nodes) { 
    if (n.key === k) return n; 
    if (n.children) { 
      const res = findNode(n.children, k); 
      if (res) return res; 
    } 
  }
  return null;
};

const gatherAllKeys = (n: NeedsNode): string[] => {
  let res = [n.key]; 
  if (n.children) n.children.forEach(c => res = [...res, ...gatherAllKeys(c)]); 
  return res;
};
