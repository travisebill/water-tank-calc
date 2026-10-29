import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Minus, 
  TrendingUp, 
  Home, 
  CreditCard, 
  PieChart, 
  Sliders, 
  BarChart3, 
  Download, 
  Printer, 
  X, 
  Presentation, 
  ChevronRight, 
  ChevronLeft, 
  ShieldAlert, 
  Sparkles, 
  Lock, 
  ShieldCheck, 
  Droplets, 
  Globe, 
  Loader2, 
  RefreshCw, 
  Table
} from 'lucide-react';

// Firebase SDK 導入
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';

let app, auth, db, appId;

try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : { apiKey: "mock-key", authDomain: "mock.firebaseapp.com" };
    
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  appId = typeof __app_id !== 'undefined' ? __app_id : 'financial-calc-v14';
} catch (e) {
  console.error("Firebase Configuration Error:", e);
}

const DEFAULT_FUNDS = [
  { name: '施羅德全週期成長多重資產基金-B月配型(美元)', yield: 9.57, category: '多重資產 / 動態配置' },
  { name: '摩根投資基金-多重收益基金A股(美元對沖)(穩定月配)', yield: 11.06, category: '多重資產 / 全球收益' },
  { name: '安聯收益成長基金-AM穩定月收類股(美元)', yield: 8.65, category: '多重資產 / 美國核心' },
  { name: '安聯美國短年期非投資等級債券基金-AM穩定月收(美元)', yield: 7.42, category: '非投資等級債 / 低波動' },
  { name: '聯博-全球非投資等級債券基金AA(穩定月配)級別美元', yield: 9.15, category: '非投資等級債 / 全球' },
  { name: '富蘭克林坦伯頓穩定月收益基金(美元)', yield: 8.48, category: '股債平衡 / 美國價值' }
];

// ============================================================
// 本機持久化 (localStorage)
// 原始碼把計算條件放在 useState，只存在記憶體 —— 重新整理就全部歸零。
// 這裡把「要記錄的資料」欄位改成 usePersistentState，寫進 localStorage，
// 重新整理 / 關掉再開 / 離線都會保留。
// ============================================================
const PERSIST_PREFIX = 'jam_water_tank_v1:';

function readPersisted(key, fallback) {
  try {
    const raw = localStorage.getItem(PERSIST_PREFIX + key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed === null || parsed === undefined) ? fallback : parsed;
  } catch (e) {
    return fallback;
  }
}

function writePersisted(key, value) {
  try {
    localStorage.setItem(PERSIST_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('[persist] write failed:', key, e);
  }
}

function clearPersisted() {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(PERSIST_PREFIX) === 0) doomed.push(k);
    }
    doomed.forEach(k => localStorage.removeItem(k));
    return doomed.length;
  } catch (e) {
    return 0;
  }
}

function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => readPersisted(key, initialValue));
  useEffect(() => {
    writePersisted(key, state);
  }, [key, state]);
  return [state, setState];
}

const App = () => {
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(() => !readPersisted('splashSeen', false));
  const [splashProgress, setSplashProgress] = useState(0);
  const [activeTab, setActiveTab] = usePersistentState('activeTab', 'loan');

  // 計算機數值狀態
  const [currentAge, setCurrentAge] = usePersistentState('currentAge', 40);
  const [downPayment, setDownPayment] = usePersistentState('downPayment', 600);
  const [mortgageAmount, setMortgageAmount] = usePersistentState('mortgageAmount', 600);
  const [loanYears, setLoanYears] = usePersistentState('loanYears', 20);
  const [gracePeriod, setGracePeriod] = usePersistentState('gracePeriod', 0);
  const [interestRate, setInterestRate] = usePersistentState('interestRate', 2.185);

  // 小水庫與模擬情境 (中分紅模型)
  const [reinvestRatio, setReinvestRatio] = usePersistentState('reinvestRatio', 40);
  const [navChangePercent, setNavChangePercent] = usePersistentState('navChangePercent', 0);
  const [chartMetric, setChartMetric] = usePersistentState('chartMetric', 'wealth');
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  // 獨立分表檢視 Modal 狀態
  const [selectedTableView, setSelectedTableView] = useState('all');

  // 宣傳簡報 Modal 狀態 (7 頁)
  const [showPromoSlides, setShowPromoSlides] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedSimAge, setSelectedSimAge] = useState(null);

  const [availableFunds] = useState(DEFAULT_FUNDS);
  const [isSyncingFunds, setIsSyncingFunds] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  const [funds, setFunds] = usePersistentState('funds', [
    { id: 1, name: '施羅德全週期成長多重資產基金-B月配型(美元)', yield: 9.57, weight: 46 },
    { id: 2, name: '摩根投資基金-多重收益基金A股(美元對沖)(穩定月配)', yield: 11.06, weight: 54 },
    { id: 3, name: '安聯收益成長基金-AM穩定月收類股(美元)', yield: 8.65, weight: 0 },
  ]);

  useEffect(() => {
    try {
      if (!auth) {
        setLoading(false);
        return;
      }
      const initAuth = async () => {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (err) {
          console.warn("Auth fallback:", err);
        } finally {
          setLoading(false);
        }
      };
      initAuth();
      const unsubscribe = onAuthStateChanged(auth, () => {
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      setLoading(false);
    }
  }, []);

  // 開頭注水動畫 (4.2 秒)
  useEffect(() => {
    if (!showSplash) {
      writePersisted('splashSeen', true);
      return;
    }
    setSplashProgress(0);
    const duration = 4200;
    const intervalTime = 40;
    const startTime = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setSplashProgress(pct);
      if (elapsed >= duration) {
        clearInterval(timer);
        setTimeout(() => setShowSplash(false), 350);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [showSplash]);

  const syncLatestFunds = async () => {
    setIsSyncingFunds(true);
    setSyncMessage("正在載入精選 >5% 基金項目庫...");
    setTimeout(() => {
      setIsSyncingFunds(false);
      setSyncMessage("已成功載入最新熱門基金清單！");
      setTimeout(() => setSyncMessage(null), 3000);
    }, 800);
  };

    // 清除本機儲存的試算條件並還原預設值
  const handleReset = () => {
    const ok = typeof window === 'undefined' ? true : window.confirm('確定要清除此裝置上儲存的試算條件並還原為預設值嗎？（年齡、自備款、房貸、基金配置都會重設）');
    if (!ok) return;
    const n = clearPersisted();
    console.log('[persist] cleared', n, 'keys');
    writePersisted('splashSeen', true);
    window.location.reload();
  };


  // 核心計算
  const totalInvestment = (Number(downPayment) + Number(mortgageAmount)) * 10000;
  const initialDownPaymentVal = Number(downPayment) * 10000;
  const initialMortgageVal = Number(mortgageAmount) * 10000;

  const weightedYield = useMemo(() => {
    return funds.reduce((acc, f) => acc + (Number(f.yield) * (Number(f.weight) / 100)), 0);
  }, [funds]);

  const monthlyDividends = useMemo(() => {
    return funds.map(f => {
      const fundAmount = totalInvestment * (Number(f.weight) / 100);
      const monthly = (fundAmount * (Number(f.yield) / 100)) / 12;
      return { ...f, fundAmount, monthly };
    });
  }, [funds, totalInvestment]);

  const totalMonthlyDiv = monthlyDividends.reduce((a, b) => a + b.monthly, 0);
  const monthlyPF65InvestAmount = Math.round(totalMonthlyDiv * (Number(reinvestRatio) / 100));

  const mortgageCosts = useMemo(() => {
    if (Number(mortgageAmount) <= 0) return { interestOnly: 0, fullPay: 0 };
    const principal = Number(mortgageAmount) * 10000;
    const monthlyRate = (Number(interestRate) / 100) / 12;
    const interestOnly = principal * monthlyRate;
    const months = Math.max(1, (Number(loanYears) - Number(gracePeriod)) * 12);
    let fullPay = 0;
    if (monthlyRate > 0) {
      fullPay = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    } else {
      fullPay = principal / months;
    }
    return { interestOnly, fullPay };
  }, [mortgageAmount, interestRate, loanYears, gracePeriod]);

  const cashFlowGrace = totalMonthlyDiv - mortgageCosts.interestOnly;
  const cashFlowFull = totalMonthlyDiv - mortgageCosts.fullPay;
  
  const targetNavRatio = Math.max(1, 100 + Number(navChangePercent));

  // 模擬引擎 (目前年齡 ～ 90 歲) - 總資產定義修正：當下所有產品的現金價值（大水庫基金現值 + 六年期分紅保單現金價值）
  const ageSimulationData = useMemo(() => {
    const startAge = Math.min(Math.max(20, Number(currentAge) || 40), 85);
    const endAge = 90;
    const data = [];

    const baseAnnualPremium = (totalMonthlyDiv * 12) * (Number(reinvestRatio) / 100);
    const total6YrPremium = baseAnnualPremium * 6;

    const pf65RollupRate = 0.038; 
    const pf65MediumSurvivalRate = 0.085;

    let pf65CashValue = 0;
    let remainingMortgageBalance = initialMortgageVal;
    const monthlyMortgageRate = (Number(interestRate) / 100) / 12;

    for (let age = startAge; age <= endAge; age++) {
      const yearIndex = age - startAge;

      let currentNavRatio = 100;
      if (age < 65) {
        const yearsTo65 = Math.max(1, 65 - startAge);
        const progress = Math.min(1, yearIndex / yearsTo65);
        currentNavRatio = 100 + ((targetNavRatio - 100) * progress);
      } else {
        currentNavRatio = targetNavRatio;
      }
      currentNavRatio = Math.max(1, currentNavRatio);

      const bigReservoirValue = totalInvestment * (currentNavRatio / 100);
      const annualFundDividend = bigReservoirValue * (weightedYield / 100);
      const monthlyFundDividendAtAge = annualFundDividend / 12;

      let monthlyMortgageAtAge = 0;
      let annualMortgagePrincipalPaid = 0;
      let annualMortgageInterestPaid = 0;

      if (Number(mortgageAmount) > 0 && yearIndex < Number(loanYears)) {
        const isGrace = yearIndex < Number(gracePeriod);
        monthlyMortgageAtAge = isGrace ? mortgageCosts.interestOnly : mortgageCosts.fullPay;
        
        for (let m = 0; m < 12; m++) {
          if (remainingMortgageBalance <= 0) break;
          const interestPayment = remainingMortgageBalance * monthlyMortgageRate;
          const principalPayment = isGrace ? 0 : Math.max(0, mortgageCosts.fullPay - interestPayment);
          remainingMortgageBalance = Math.max(0, remainingMortgageBalance - principalPayment);
          annualMortgagePrincipalPaid += principalPayment;
          annualMortgageInterestPaid += interestPayment;
        }
      } else {
        remainingMortgageBalance = 0;
      }

      const isPayingPF65 = yearIndex < 6;
      const annualPF65Premium = isPayingPF65 ? baseAnnualPremium : 0;
      const monthlyPF65Premium = annualPF65Premium / 12;

      const survivalStartAge = Math.max(65, startAge + 6);
      let annualPF65SurvivalBenefit = 0;
      let monthlyPF65SurvivalBenefit = 0;

      if (age >= survivalStartAge && total6YrPremium > 0) {
        const accumulationYears = Math.max(0, survivalStartAge - startAge - 6);
        const accumulationFactor = Math.max(0.85, 1 + accumulationYears * (pf65RollupRate * 0.35));
        const postStartGrowth = Math.pow(1.012, age - survivalStartAge);
        annualPF65SurvivalBenefit = total6YrPremium * pf65MediumSurvivalRate * accumulationFactor * postStartGrowth;
        monthlyPF65SurvivalBenefit = annualPF65SurvivalBenefit / 12;
      }

      if (isPayingPF65) {
        const surrenderFactor = 0.70 + (yearIndex * 0.045);
        pf65CashValue = (pf65CashValue + annualPF65Premium) * (1 + pf65RollupRate * 0.55) * Math.min(1, surrenderFactor);
      } else if (age < survivalStartAge) {
        pf65CashValue = pf65CashValue * (1 + pf65RollupRate);
      } else {
        pf65CashValue = Math.max(total6YrPremium, pf65CashValue * (1 + pf65RollupRate) - annualPF65SurvivalBenefit * 0.7);
      }

      const pf65MonthlyCashFlow = monthlyPF65SurvivalBenefit;
      const monthlyNetCashFlow = monthlyFundDividendAtAge - monthlyMortgageAtAge;
      const monthlyDisposableCashFlow = monthlyNetCashFlow - monthlyPF65Premium + pf65MonthlyCashFlow;

      // 總資產定義修正：當下所有產品的現金價值（大水庫基金現值 + 六年期分紅保單現金價值）
      const totalWealth = bigReservoirValue + pf65CashValue;

      data.push({
        age,
        yearIndex: yearIndex + 1,
        navRatio: Number(currentNavRatio.toFixed(1)),
        downPaymentValue: Math.round(initialDownPaymentVal * (currentNavRatio / 100)),
        bigReservoirValue: Math.round(bigReservoirValue),
        mortgageBalance: Math.round(remainingMortgageBalance),
        annualMortgagePayment: Math.round(monthlyMortgageAtAge * 12),
        annualMortgagePrincipal: Math.round(annualMortgagePrincipalPaid),
        annualMortgageInterest: Math.round(annualMortgageInterestPaid),
        monthlyNetCashFlow: Math.round(monthlyNetCashFlow),
        monthlyDisposableCashFlow: Math.round(monthlyDisposableCashFlow),
        annualDisposableCashFlow: Math.round(monthlyDisposableCashFlow * 12),
        monthlyPF65Premium: Math.round(monthlyPF65Premium),
        pf65CashValue: Math.round(pf65CashValue),
        annualPF65Benefit: Math.round(annualPF65SurvivalBenefit),
        pf65MonthlyCashFlow: Math.round(pf65MonthlyCashFlow),
        totalWealth: Math.round(totalWealth)
      });
    }

    return {
      rows: data,
      startAge,
      endAge,
      survivalStartAge: Math.max(65, startAge + 6),
      total6YrPremium: Math.round(total6YrPremium)
    };
  }, [currentAge, totalInvestment, initialDownPaymentVal, initialMortgageVal, weightedYield, totalMonthlyDiv, reinvestRatio, targetNavRatio, mortgageAmount, loanYears, gracePeriod, mortgageCosts, interestRate]);

  useEffect(() => {
    if (ageSimulationData && (selectedSimAge === null || selectedSimAge < ageSimulationData.startAge || selectedSimAge > ageSimulationData.endAge)) {
      setSelectedSimAge(ageSimulationData.startAge);
    }
  }, [ageSimulationData]);

  const updateWeight = (id, val) => {
    const clampedVal = Math.max(0, Math.min(100, Number(val) || 0));
    setFunds(prev => {
      const next = prev.map(f => ({ ...f }));
      const idx = next.findIndex(f => f.id === id);
      if (idx === -1) return prev;
      next[idx].weight = clampedVal;

      const otherIndices = [0, 1, 2].filter(i => i !== idx);
      const remainingTarget = Math.max(0, Number((100 - clampedVal).toFixed(1)));
      const currentOthersSum = next[otherIndices[0]].weight + next[otherIndices[1]].weight;

      if (currentOthersSum === 0) {
        next[otherIndices[0]].weight = remainingTarget;
        next[otherIndices[1]].weight = 0;
      } else {
        const ratio0 = next[otherIndices[0]].weight / currentOthersSum;
        next[otherIndices[0]].weight = Number((remainingTarget * ratio0).toFixed(1));
        next[otherIndices[1]].weight = Number((remainingTarget - next[otherIndices[0]].weight).toFixed(1));
      }
      return next;
    });
  };

  const handleSelectPresetFund = (slotId, selectedName) => {
    const found = availableFunds.find(af => af.name === selectedName);
    if (!found) return;
    setFunds(prev => prev.map(f => f.id === slotId ? { ...f, name: found.name, yield: found.yield } : f));
  };

  const formatCurrency = (num) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(num || 0);

  const formatAxisMoney = (val) => {
    const abs = Math.abs(val || 0);
    const sign = val < 0 ? '-' : '';
    if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(1)}億`;
    if (abs >= 10000) {
      const wan = abs / 10000;
      return `${sign}${wan >= 100 ? Math.round(wan).toLocaleString() : wan.toFixed(1)}萬`;
    }
    return `${sign}$${Math.round(abs).toLocaleString()}`;
  };

  const getCashFlowStatusText = (cf) => {
    if (cf > 15000) return { text: '✓ 現金流充足 (> $15,000)', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
    if (cf >= 0) return { text: '✓ 正現金流 ($0 ~ $15,000)', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
    return { text: '✗ 現金流不夠充足 (< $0)', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
  };

  const handleExportPDF = () => setShowPrintModal(true);
  const triggerBrowserPrint = () => window.print();

  const NAV_TABS = [
    { id: 'loan', label: '貸款設定', shortLabel: '貸款設定', icon: Sliders },
    { id: 'funds', label: '基金項目', shortLabel: '基金項目', icon: PieChart },
    { id: 'results', label: '試算結果', shortLabel: '試算結果', icon: TrendingUp },
    { id: 'chart', label: '圖表分析', shortLabel: '圖表分析', icon: BarChart3 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="animate-spin text-blue-900 mb-4" size={48} />
        <p className="text-gray-500 font-medium">載入中...</p>
      </div>
    );
  }

  if (showSplash) {
    const bigWaterLevel = Math.min(88, Math.max(8, splashProgress * 0.88));
    const smallWaterLevel = Math.min(86, Math.max(5, (splashProgress - 10) * 0.95));
    const isFlowing = splashProgress > 5 && splashProgress < 98;

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-900 text-white flex flex-col items-center justify-between p-6 relative overflow-hidden select-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#C5A358]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center z-10 mt-2 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C5A358]/20 border border-[#C5A358]/40 text-[#C5A358] text-xs font-black tracking-wider">
            <Droplets size={14} /> 財富現金流永續工程（中分紅模型）
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wide text-white leading-snug px-2">
            風雨無阻的創造<br className="sm:hidden" />
            <span className="text-[#C5A358]">大小水庫計劃</span>
          </h1>
          <p className="text-xs text-blue-200/80 font-medium">
            活水配息分流 · 大水庫創流 × 小水庫中分紅鎖利終身俸
          </p>
        </div>

        <div className="w-full max-w-sm my-auto z-10 flex flex-col items-center">
          <svg viewBox="0 0 360 330" className="w-full h-auto drop-shadow-2xl overflow-visible">
            <defs>
              <linearGradient id="waterStreamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="bigWaterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#2563eb" stopOpacity="0.92" />
                <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.98" />
              </linearGradient>
              <linearGradient id="smallWaterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fde047" stopOpacity="0.9" />
                <stop offset="40%" stopColor="#eab308" stopOpacity="0.92" />
                <stop offset="100%" stopColor="#a16207" stopOpacity="0.98" />
              </linearGradient>
              <linearGradient id="goldPipeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f3e5ab" />
                <stop offset="50%" stopColor="#C5A358" />
                <stop offset="100%" stopColor="#8a6d2b" />
              </linearGradient>
              <clipPath id="bigTankClip"><rect x="24" y="145" width="166" height="150" rx="18" /></clipPath>
              <clipPath id="smallTankClip"><rect x="220" y="185" width="116" height="110" rx="16" /></clipPath>
            </defs>

            <g>
              <rect x="130" y="18" width="54" height="16" rx="4" fill="url(#goldPipeGrad)" />
              <rect x="166" y="12" width="28" height="28" rx="6" fill="url(#goldPipeGrad)" stroke="#fef08a" strokeWidth="1" />
              <g transform={`translate(180, 6) rotate(${Math.min(45, splashProgress * 1.2)})`}>
                <rect x="-20" y="-4" width="40" height="6" rx="3" fill="#e2e8f0" />
                <circle cx="0" cy="-1" r="5" fill="#C5A358" />
              </g>
              <path d="M 180 40 L 180 62" stroke="url(#goldPipeGrad)" strokeWidth="18" strokeLinecap="round" />
              <rect x="168" y="56" width="24" height="8" rx="3" fill="#8a6d2b" />
            </g>

            {isFlowing && (
              <g>
                <path d="M 180 64 L 180 96" stroke="url(#waterStreamGrad)" strokeWidth="12" strokeLinecap="round" />
                <path d="M 180 94 Q 107 98 107 140" fill="none" stroke="url(#waterStreamGrad)" strokeWidth="9" strokeLinecap="round" />
                <path d="M 107 135 L 107 290" stroke="#60a5fa" strokeWidth="7" strokeDasharray="10 6" opacity="0.75" />
                <path d="M 180 94 Q 278 98 278 180" fill="none" stroke="#facc15" strokeWidth="6" strokeLinecap="round" />
                <path d="M 278 175 L 278 290" stroke="#fde047" strokeWidth="5" strokeDasharray="8 6" opacity="0.8" />
                <circle cx="180" cy="94" r="7" fill="#93c5fd" />
              </g>
            )}

            <g>
              <rect x="24" y="145" width="166" height="150" rx="18" fill="#0f172a" opacity="0.75" />
              <g clipPath="url(#bigTankClip)">
                {(() => {
                  const tankH = 150;
                  const waterH = (bigWaterLevel / 100) * tankH;
                  const waterY = 145 + tankH - waterH;
                  return <path d={`M 10 ${waterY} Q 60 ${waterY - 7} 110 ${waterY} T 210 ${waterY} L 210 310 L 10 310 Z`} fill="url(#bigWaterGrad)" />;
                })()}
              </g>
              <rect x="24" y="145" width="166" height="150" rx="18" fill="none" stroke="#60a5fa" strokeWidth="3.5" />
              <text x="107" y="212" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="900">大水庫</text>
              <text x="107" y="230" textAnchor="middle" fill="#bfdbfe" fontSize="10" fontWeight="700">月配息基金資產池</text>
              <text x="107" y="254" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="900">{Math.min(100, Math.round(splashProgress))}%</text>
            </g>

            <g>
              <rect x="220" y="185" width="116" height="110" rx="16" fill="#0f172a" opacity="0.75" />
              <g clipPath="url(#smallTankClip)">
                {(() => {
                  const tankH = 110;
                  const waterH = (smallWaterLevel / 100) * tankH;
                  const waterY = 185 + tankH - waterH;
                  return <path d={`M 205 ${waterY} Q 245 ${waterY + 6} 285 ${waterY} T 355 ${waterY} L 355 310 L 205 310 Z`} fill="url(#smallWaterGrad)" />;
                })()}
              </g>
              <rect x="220" y="185" width="116" height="110" rx="16" fill="none" stroke="#C5A358" strokeWidth="3.5" />
              <text x="278" y="232" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="900">小水庫</text>
              <text x="278" y="248" textAnchor="middle" fill="#fef08a" fontSize="9.5" fontWeight="700">六年期分紅保單(中分紅)</text>
              <text x="278" y="270" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="900">{Math.min(100, Math.round(splashProgress))}%</text>
            </g>
            <line x1="16" y1="304" x2="344" y2="304" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          </svg>

          <div className="w-full max-w-xs space-y-2 mt-1">
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div className="h-full bg-gradient-to-r from-blue-500 via-[#C5A358] to-emerald-400 rounded-full transition-all duration-75" style={{ width: `${splashProgress}%` }} />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-300 font-bold">
              <span>{splashProgress < 35 ? '開啟財富水龍頭...' : splashProgress < 80 ? '活水注入大水庫與小水庫...' : '大小水庫滿載啟動！'}</span>
              <span className="text-[#C5A358]">{splashProgress}%</span>
            </div>
          </div>
        </div>

        <div className="z-10 mb-2">
          <button onClick={() => setShowSplash(false)} className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-slate-200 transition-all">
            略過動畫，立即進入系統 →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28 font-sans text-slate-900 flex flex-col">
      <header className="bg-black text-white px-4 py-3.5 sticky top-0 z-40 shadow-lg print:hidden">
        <div className="max-w-md mx-auto flex justify-between items-center mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Droplets className="text-[#C5A358] shrink-0" size={20} />
            <h1 className="text-xs sm:text-sm font-black tracking-wide truncate">
              風雨無阻的創造大小水庫計劃 (中分紅模型)
            </h1>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => { setCurrentSlide(0); setShowPromoSlides(true); }} className="p-1.5 px-2.5 bg-gradient-to-r from-amber-500 to-[#C5A358] text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 shadow">
              <Presentation size={13} /> 簡報
            </button>
            <button onClick={() => setShowSplash(true)} className="p-1.5 px-2 bg-white/10 text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1">
              <RefreshCw size={12} /> 動畫
            </button>
            <button onClick={handleExportPDF} className="p-1.5 px-2.5 bg-[#C5A358] text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow">
              <Download size={13} /> 匯出
            </button>
          </div>
        </div>

        <div className="max-w-md mx-auto grid grid-cols-4 gap-1.5 bg-white/10 p-1 rounded-xl">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 rounded-lg font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                  isActive ? 'bg-[#C5A358] text-white shadow' : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <Icon size={16} />
                <span>{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-3 py-2 z-40 shadow-lg print:hidden">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-2">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 px-2 rounded-xl font-black text-xs flex flex-col items-center gap-1 transition-all ${
                  isActive ? 'bg-blue-900 text-white' : 'bg-slate-50 text-slate-500'
                }`}
              >
                <Icon size={16} />
                <span>{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-md w-full mx-auto p-4 flex-1 space-y-4 print:hidden">
        {activeTab === 'loan' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 rounded-3xl p-5 text-white shadow-xl border border-[#C5A358]/40 relative overflow-hidden">
              <div className="flex items-start justify-between gap-3 relative z-10">
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#C5A358]/25 border border-[#C5A358]/50 text-[#fde047] text-[11px] font-black">
                    <Sparkles size={12} /> 30 秒看懂大小水庫
                  </span>
                  <h3 className="text-lg font-black leading-snug text-white">想投資怕虧損？保單效率低？還要繳重稅？</h3>
                  <p className="text-xs text-blue-200/90 font-medium leading-relaxed">點擊開啟「7 頁互動簡報」，帶您看懂大小水庫與預留稅源的奧秘！</p>
                </div>
              </div>
              <button onClick={() => { setCurrentSlide(0); setShowPromoSlides(true); }} className="mt-4 w-full py-3.5 px-4 bg-gradient-to-r from-[#C5A358] via-amber-500 to-[#C5A358] text-slate-950 rounded-2xl font-black text-base shadow-lg flex items-center justify-center gap-2">
                <Presentation size={20} />
                <span>點此觀看：大小水庫核心概念視覺簡報 (7頁)</span>
                <ChevronRight size={18} />
              </button>
            </div>

            <h2 className="text-xl font-black text-blue-900 flex items-center gap-2">
              <Sliders size={20} className="text-[#C5A358]" /> 步驟 1：年齡、自備款與房貸
            </h2>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <span className="font-black text-slate-800 text-lg">目前年齡</span>
                <span className="text-2xl font-black text-[#C5A358]">{currentAge} 歲</span>
              </div>
              <input type="range" min={20} max={75} value={currentAge} onChange={(e) => setCurrentAge(parseInt(e.target.value) || 40)} className="w-full h-2.5 bg-slate-200 rounded-lg accent-blue-900 mb-3 cursor-pointer" />
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>範圍：20 - 75 歲（模擬至 90 歲）</span>
                <div className="flex gap-1.5">
                  <button onClick={() => setCurrentAge(a => Math.max(20, a - 1))} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold">-1歲</button>
                  <button onClick={() => setCurrentAge(a => Math.min(75, a + 1))} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold">+1歲</button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard size={20} className="text-blue-900" />
                  <span className="font-black text-slate-800 text-lg">自備款</span>
                </div>
                <span className="text-2xl font-black text-[#C5A358]">{downPayment} 萬</span>
              </div>
              <input type="range" min={0} max={5000} step={100} value={downPayment} onChange={(e) => setDownPayment(parseFloat(e.target.value) || 0)} className="w-full h-2.5 bg-slate-200 rounded-lg accent-blue-900 mb-2 cursor-pointer" />
              <div className="text-xs text-slate-400 mb-4">範圍：0 - 5000 萬（以 100 萬為單位）</div>
              <div className="flex gap-3">
                <button onClick={() => setDownPayment(p => Math.max(p - 100, 0))} className="flex-1 py-3 bg-white border-2 border-blue-900 text-blue-900 rounded-2xl font-bold">-100萬</button>
                <button onClick={() => setDownPayment(p => Math.min(p + 100, 5000))} className="flex-1 py-3 bg-[#C5A358] text-white rounded-2xl font-bold shadow">+100萬</button>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <Home size={20} className="text-blue-900" />
                  <span className="font-black text-slate-800 text-lg">房貸金額</span>
                </div>
                <span className="text-2xl font-black text-[#C5A358]">{mortgageAmount} 萬</span>
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setMortgageAmount(0)} className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${mortgageAmount === 0 ? 'bg-emerald-600 text-white border-emerald-600 shadow' : 'bg-slate-50 text-slate-600'}`}>✓ 免房貸 (0萬)</button>
                <button onClick={() => { if(mortgageAmount === 0) setMortgageAmount(600); }} className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${mortgageAmount > 0 ? 'bg-blue-900 text-white border-blue-900 shadow' : 'bg-slate-50 text-slate-600'}`}>搭配房貸投資</button>
              </div>
              <input type="range" min={0} max={5000} step={100} value={mortgageAmount} onChange={(e) => setMortgageAmount(parseFloat(e.target.value) || 0)} className="w-full h-2.5 bg-slate-200 rounded-lg accent-blue-900 mb-2 cursor-pointer" />
              <div className="text-xs text-slate-400 mb-4">範圍：0 - 5000 萬（以 100 萬為單位）</div>
              <div className="flex gap-3">
                <button onClick={() => setMortgageAmount(p => Math.max(p - 100, 0))} className="flex-1 py-3 bg-white border-2 border-blue-900 text-blue-900 rounded-2xl font-bold">-100萬</button>
                <button onClick={() => setMortgageAmount(p => Math.min(p + 100, 5000))} className="flex-1 py-3 bg-[#C5A358] text-white rounded-2xl font-bold shadow">+100萬</button>
              </div>
            </div>

            {mortgageAmount > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-black text-slate-800">房貸年期 (年)</span>
                    <span className="text-xl font-black text-[#C5A358]">{loanYears} 年</span>
                  </div>
                  <input type="range" min={10} max={40} value={loanYears} onChange={(e) => setLoanYears(parseInt(e.target.value) || 20)} className="w-full h-2 bg-slate-200 rounded-lg accent-blue-900 mb-2 cursor-pointer" />
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-black text-slate-800">寬限期年數 (只繳利息)</span>
                    <span className="text-xl font-black text-[#C5A358]">{gracePeriod} 年</span>
                  </div>
                  <input type="range" min={0} max={5} value={gracePeriod} onChange={(e) => setGracePeriod(parseInt(e.target.value) || 0)} className="w-full h-2 bg-slate-200 rounded-lg accent-blue-900 cursor-pointer" />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-black text-slate-800">房貸年利率 (%)</span>
                    <span className="text-xl font-black text-[#C5A358]">{interestRate}%</span>
                  </div>
                  <input type="number" step="0.001" value={interestRate} onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-blue-900 text-base" />
                </div>
              </div>
            )}

            <button onClick={() => setActiveTab('funds')} className="w-full py-4 bg-blue-900 text-white rounded-2xl font-black text-base shadow-lg">下一步：設定基金項目 →</button>

  <div className='bg-white rounded-3xl p-4 border border-slate-100 shadow-sm'>
    <div className='flex items-center justify-between gap-3'>
      <div className='min-w-0'>
        <p className='text-xs font-black text-slate-700 flex items-center gap-1.5'>
          <span className='inline-block w-2 h-2 rounded-full bg-emerald-500'></span>
          本機記憶已開啟
        </p>
        <p className='text-[11px] text-slate-400 mt-1 leading-relaxed'>
          試算條件已存於此裝置的 localStorage，重新整理或關閉再開都不會遺失。
        </p>
      </div>
      <button
        onClick={handleReset}
        className='shrink-0 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black border border-slate-200'
      >
        重設
      </button>
    </div>
  </div>          </div>
        )}

        {activeTab === 'funds' && (
          <div className="space-y-4">
            <div className="bg-blue-950 text-white rounded-3xl p-5 shadow">
              <h2 className="text-xl font-black mb-1">基金項目配置</h2>
              <p className="text-xs text-blue-200 mb-3">提供三個基金欄位設定月配息金額、基金內容與投資比例（加總鎖定 100%）。</p>
              <button onClick={syncLatestFunds} disabled={isSyncingFunds} className="w-full py-2.5 bg-white/15 hover:bg-white/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                {isSyncingFunds ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />} 聯網更新 &gt;5% 熱門月配息基金
              </button>
              {syncMessage && <div className="mt-2 text-xs text-emerald-300 font-bold">{syncMessage}</div>}
            </div>

            {funds.map((f, i) => {
              const allocatedAmount = totalInvestment * (Number(f.weight) / 100);
              const estimatedMonthly = Math.round((allocatedAmount * (Number(f.yield) / 100)) / 12);

              return (
                <div key={f.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700 font-black">第 {i + 1} 檔基金</span>
                    <span className="text-xl font-black text-[#C5A358]">{Number(f.weight).toFixed(1)}%</span>
                  </div>

                  <select 
                    value={availableFunds.some(af => af.name === f.name) ? f.name : ''}
                    onChange={(e) => handleSelectPresetFund(f.id, e.target.value)}
                    className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="" disabled>-- 選擇基金項目 --</option>
                    {availableFunds.map((af, idx) => (
                      <option key={idx} value={af.name}>{af.name} (年化 {af.yield}%)</option>
                    ))}
                  </select>

                  <div className="bg-slate-50 p-3.5 rounded-2xl space-y-2 border border-slate-100">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block">基金名稱</label>
                      <input type="text" value={f.name} onChange={(e) => {
                        const val = e.target.value;
                        setFunds(prev => prev.map(item => item.id === f.id ? { ...item, name: val } : item));
                      }} className="w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#C5A358] mt-0.5" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block">年化配息率 (%)</label>
                        <input type="number" step="0.01" value={f.yield} onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setFunds(prev => prev.map(item => item.id === f.id ? { ...item, yield: val } : item));
                        }} className="w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs font-black text-blue-900 mt-0.5" />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block">預估月配息 ($)</label>
                        <input type="number" value={estimatedMonthly} readOnly className="w-full bg-slate-100 border rounded-lg px-2.5 py-1.5 text-xs font-black text-emerald-600 mt-0.5" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 font-bold mb-1">
                      <span>配置金額：{formatCurrency(allocatedAmount)}</span>
                      <span>投資比例：{Number(f.weight).toFixed(1)}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="1" value={f.weight} onChange={(e) => updateWeight(f.id, parseFloat(e.target.value))} className="w-full h-2.5 bg-slate-200 rounded-lg accent-blue-900 cursor-pointer" />
                  </div>
                </div>
              );
            })}

            <button onClick={() => setActiveTab('results')} className="w-full py-4 bg-blue-900 text-white rounded-2xl font-black text-base shadow-lg">查看試算結果 →</button>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-blue-900 border-l-4 border-[#C5A358] pl-3">試算結果</h2>
            
            <div className="bg-white rounded-3xl p-6 shadow-sm border text-center">
              <div className="text-slate-400 text-xs font-bold">總投入金額 (自備 {downPayment} 萬 + 房貸 {mortgageAmount} 萬)</div>
              <div className="text-3xl font-black text-blue-900 mt-1">{formatCurrency(totalInvestment)}</div>
            </div>

            {monthlyDividends.map((f, idx) => f.weight > 0 && (
              <div key={f.id} className="bg-white rounded-3xl p-5 shadow-sm border flex justify-between items-center">
                <div className="max-w-[65%]">
                  <div className="text-xs text-slate-400 font-bold">第 {idx + 1} 檔 ({f.weight.toFixed(1)}% · 配息率 {f.yield}%)</div>
                  <div className="text-sm font-black text-slate-800 truncate mt-0.5">{f.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-bold">每月配息</div>
                  <div className="text-lg font-black text-emerald-600">+{formatCurrency(f.monthly)}</div>
                </div>
              </div>
            ))}

            <div className="bg-white rounded-3xl p-6 shadow-md border-2 border-[#C5A358] flex justify-between items-center">
              <div>
                <span className="font-black text-blue-900 block">每月配息合計</span>
                <span className="text-xs text-slate-400 font-bold">每年配息合計：+{formatCurrency(totalMonthlyDiv * 12)}</span>
              </div>
              <span className="text-2xl font-black text-[#C5A358]">+{formatCurrency(totalMonthlyDiv)}</span>
            </div>

            {mortgageAmount > 0 && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border space-y-3">
                <h3 className="text-sm font-black text-blue-900">房貸月付金支出</h3>
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-500">寬限期內月付金 (只繳利息)</span>
                  <span className="text-red-500 font-black">-{formatCurrency(mortgageCosts.interestOnly)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold pt-2 border-t">
                  <span className="text-slate-500">寬限期後月付金 (本利攤還)</span>
                  <span className="text-red-500 font-black">-{formatCurrency(mortgageCosts.fullPay)}</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-base font-black text-blue-900">每月現金流 (每月配息 - 每月房貸)</h3>
              {[
                { title: '寬限期內每月現金流', val: cashFlowGrace },
                { title: '寬限期後每月現金流', val: cashFlowFull }
              ].map((item, idx) => {
                const st = getCashFlowStatusText(item.val);
                return (
                  <div key={idx} className={`rounded-3xl p-5 shadow-sm border ${st.bg}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-600">{item.title}</span>
                      <span className={`text-2xl font-black ${item.val >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {item.val >= 0 ? '+' : ''}{formatCurrency(item.val)}
                      </span>
                    </div>
                    <div className={`text-xs font-black ${st.color}`}>{st.text}</div>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-900 text-white rounded-3xl p-5 shadow space-y-3">
              <h3 className="text-sm font-black text-[#fde047] flex items-center gap-1.5">
                <Table size={16} /> 獨立年齡試算表與小水庫明細 (中分紅)
              </h3>
              <p className="text-xs text-slate-300">點擊下方按鈕，可獨立查看或匯出特定項目的逐年演變明細表：</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={() => { setSelectedTableView('downPayment'); setShowPrintModal(true); }} className="py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-blue-200">
                  <Table size={13} /> 自備款大水庫表
                </button>
                <button onClick={() => { setSelectedTableView('mortgage'); setShowPrintModal(true); }} className="py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-amber-200">
                  <Table size={13} /> 房貸還款變化表
                </button>
                <button onClick={() => { setSelectedTableView('pf65Cashflow'); setShowPrintModal(true); }} className="py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-yellow-300">
                  <Table size={13} /> 小水庫現金流分佈表
                </button>
                <button onClick={() => { setSelectedTableView('pf65Wealth'); setShowPrintModal(true); }} className="py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-emerald-300">
                  <Table size={13} /> 小水庫資產變化表
                </button>
              </div>
            </div>

            <button onClick={() => setActiveTab('chart')} className="w-full py-4 bg-blue-900 text-white rounded-2xl font-black text-base shadow-lg">查看圖表分析 (中分紅模型) →</button>
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-950 to-slate-900 rounded-3xl p-5 text-white shadow">
              <div className="flex justify-between items-start">
                <div>
                  <span className="bg-[#C5A358] text-[10px] font-black px-2.5 py-0.5 rounded-full">小水庫串接：六年期分紅保單 (中分紅模型)</span>
                  <h3 className="text-base font-black mt-2">外幣分紅終身保險 (中分紅基準)</h3>
                  <p className="text-xs text-blue-200 mt-1">前 6 年將配息撥入保費，65歲起領中分紅生存金。</p>
                </div>
                <button onClick={handleExportPDF} className="bg-[#C5A358] text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow shrink-0">
                  <Download size={14} /> 匯出 PDF
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-sm border space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <h4 className="text-sm font-black text-blue-900">撥入小水庫 (六年期保單) 配息比例</h4>
                <div className="text-right">
                  <span className="text-lg font-black text-[#C5A358]">{reinvestRatio}%</span>
                  <span className="text-xs font-bold text-slate-600 ml-1.5">({formatCurrency(monthlyPF65InvestAmount)}/月 · 年繳 {formatCurrency(monthlyPF65InvestAmount * 12)})</span>
                </div>
              </div>
              <input type="range" min={0} max={100} step={5} value={reinvestRatio} onChange={(e) => setReinvestRatio(parseInt(e.target.value) || 0)} className="w-full h-2.5 bg-slate-200 rounded-lg accent-blue-900 cursor-pointer" />
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-sm border space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-black text-blue-900">到期/65歲基金淨值漲跌調整 (-99% ~ +100%)</h4>
                <div className="text-right">
                  <span className="text-lg font-black text-blue-900">{navChangePercent >= 0 ? `+${navChangePercent}%` : `${navChangePercent}%`}</span>
                </div>
              </div>
              <input type="range" min={-99} max={100} step={1} value={navChangePercent} onChange={(e) => setNavChangePercent(parseInt(e.target.value) || 0)} className="w-full h-2.5 bg-slate-200 rounded-lg accent-blue-900 cursor-pointer" />
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-sm border space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-black text-blue-900">{ageSimulationData.startAge} 歲 ～ 90 歲長遠走勢與互動拉桿</h4>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button onClick={() => setChartMetric('wealth')} className={`px-2.5 py-1 rounded-lg ${chartMetric==='wealth'?'bg-blue-900 text-white':''}`}>總資產</button>
                  <button onClick={() => setChartMetric('cashflow')} className={`px-2.5 py-1 rounded-lg ${chartMetric==='cashflow'?'bg-blue-900 text-white':''}`}>月現金流</button>
                </div>
              </div>

              {(() => {
                const rows = ageSimulationData.rows;
                const activeAge = selectedSimAge !== null && selectedSimAge >= ageSimulationData.startAge && selectedSimAge <= ageSimulationData.endAge 
                  ? selectedSimAge 
                  : ageSimulationData.startAge;
                const activeRow = rows.find(r => r.age === activeAge) || rows[0];
                const activeIdx = rows.findIndex(r => r.age === activeAge);

                const vals = rows.map(r => chartMetric === 'cashflow' ? r.monthlyDisposableCashFlow : r.totalWealth);
                const maxV = Math.max(chartMetric === 'wealth' ? totalInvestment * 1.1 : 50000, ...vals);
                const minV = chartMetric === 'cashflow' ? Math.min(0, ...vals) : 0;
                const range = Math.max(1, maxV - minV);
                const yTicks = [maxV, minV + range * 0.75, minV + range * 0.5, minV + range * 0.25, minV];

                const svgW = 340;
                const svgH = 190;
                const padLeft = 58;
                const padRight = 12;
                const padTop = 14;
                const padBottom = 26;
                const plotW = svgW - padLeft - padRight;
                const plotH = svgH - padTop - padBottom;

                const getX = (i) => padLeft + (i / Math.max(1, rows.length - 1)) * plotW;
                const getY = (v) => padTop + plotH - ((v - minV) / range) * plotH;

                const pts = rows.map((r, i) => `${getX(i)},${getY(chartMetric === 'cashflow' ? r.monthlyDisposableCashFlow : r.totalWealth)}`).join(' ');
                const activeVal = chartMetric === 'cashflow' ? activeRow.monthlyDisposableCashFlow : activeRow.totalWealth;
                const activeX = getX(activeIdx !== -1 ? activeIdx : 0);
                const activeY = getY(activeVal);
                const baseInvestmentY = getY(totalInvestment);

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-12 gap-2.5 items-stretch">
                      <div className="col-span-8 bg-slate-50 rounded-2xl p-2 border border-slate-200 flex flex-col justify-between">
                        <div className="flex justify-between items-center px-1 mb-1">
                          <span className="text-[10px] font-bold text-slate-400">Y軸：{chartMetric === 'wealth' ? '總資產現金價值' : '每月現金流'}</span>
                          <span className="text-[10px] font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded-full">{activeRow.age}歲</span>
                        </div>
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-44 overflow-visible select-none" onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const xPos = e.clientX - rect.left;
                          const ratio = Math.max(0, Math.min(1, (xPos - padLeft) / plotW));
                          const idx = Math.round(ratio * (rows.length - 1));
                          if (rows[idx]) setSelectedSimAge(rows[idx].age);
                        }}>
                          {yTicks.map((tickVal, tIdx) => {
                            const yPos = padTop + (tIdx / (yTicks.length - 1)) * plotH;
                            return (
                              <g key={tIdx}>
                                <line x1={padLeft} y1={yPos} x2={svgW - padRight} y2={yPos} stroke={tIdx === yTicks.length - 1 ? "#94a3b8" : "#e2e8f0"} strokeWidth="1" />
                                <text x={padLeft - 5} y={yPos + 3.5} textAnchor="end" fontSize="9.5" fontWeight="700" fill="#475569">{formatAxisMoney(tickVal)}</text>
                              </g>
                            );
                          })}
                          <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#94a3b8" strokeWidth="1.2" />
                          {chartMetric === 'wealth' && totalInvestment > 0 && baseInvestmentY >= padTop && baseInvestmentY <= padTop + plotH && (
                            <line x1={padLeft} y1={baseInvestmentY} x2={svgW - padRight} y2={baseInvestmentY} stroke="#1e3a8a" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.6" />
                          )}
                          <polyline fill="none" stroke="#C5A358" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                          <circle cx={activeX} cy={activeY} r="5.5" fill="#1e3a8a" stroke="#fde047" strokeWidth="2" />
                        </svg>
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1 mt-1">
                          <span>{rows[0].age}歲</span>
                          <span>65歲(中分紅領息)</span>
                          <span>{rows[rows.length - 1].age}歲</span>
                        </div>
                      </div>

                      <div className="col-span-4 bg-blue-950 text-white rounded-2xl p-3 flex flex-col justify-between shadow-sm">
                        <div>
                          <span className="text-[10px] font-bold text-blue-200 block">總投入本金基準</span>
                          <span className="text-xs font-black text-amber-300">{formatCurrency(totalInvestment)}</span>
                        </div>
                        <div className="border-t border-blue-900 pt-2">
                          <span className="text-[10px] font-bold text-blue-200 block">{activeRow.age}歲 預估{chartMetric === 'wealth' ? '總資產(現值)' : '現金流'}</span>
                          <span className={`text-sm font-black ${activeVal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(activeVal)}</span>
                        </div>
                        {chartMetric === 'wealth' && totalInvestment > 0 && (
                          <div className="border-t border-blue-900 pt-1 text-[10px] text-blue-200">
                            成長倍數：<strong className="text-white">{(activeRow.totalWealth / totalInvestment).toFixed(2)} 倍</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-xs font-bold text-slate-700">滑動下方拉桿檢視各年齡金額：<strong className="text-blue-900 text-sm">{activeRow.age} 歲</strong></span>
                        <span className="text-xs font-black text-[#C5A358]">{chartMetric === 'wealth' ? '總資產現金價值' : '月現金流'}：{formatCurrency(activeVal)}</span>
                      </div>
                      <input 
                        type="range" 
                        min={ageSimulationData.startAge} 
                        max={ageSimulationData.endAge} 
                        step={1} 
                        value={activeRow.age} 
                        onChange={(e) => setSelectedSimAge(parseInt(e.target.value))} 
                        className="w-full h-2.5 bg-slate-200 rounded-lg accent-blue-900 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1">
                        <span>{ageSimulationData.startAge}歲</span>
                        <span>65歲(中分紅保單)</span>
                        <span>90歲</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      {/* 7 頁宣傳簡報 Modal */}
      {showPromoSlides && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md">
          <div className="relative w-full max-w-[380px] aspect-[9/16] max-h-[92vh] rounded-[2rem] overflow-hidden shadow-2xl border-2 border-[#C5A358]/50 flex flex-col justify-between bg-slate-950 text-white">
            <div className="p-4 pt-5 z-20 space-y-3 bg-gradient-to-b from-black/80 to-transparent">
              <div className="grid grid-cols-7 gap-1">
                {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
                  <button key={idx} onClick={() => setCurrentSlide(idx)} className="h-1.5 rounded-full overflow-hidden bg-white/25 transition-all">
                    <div className={`h-full rounded-full transition-all duration-300 ${idx <= currentSlide ? 'bg-[#fde047] w-full' : 'w-0'}`} />
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-black tracking-widest text-[#C5A358] bg-white/10 px-3 py-1 rounded-full">PAGE {currentSlide + 1} / 7</span>
                <button onClick={() => setShowPromoSlides(false)} className="p-2 rounded-full bg-white/15 text-white"><X size={20} /></button>
              </div>
            </div>

            <div className="flex-1 px-6 py-2 flex flex-col justify-center relative z-10 overflow-y-auto">
              {currentSlide === 0 && (
                <div className="space-y-4 my-auto text-center">
                  <div className="w-20 h-20 rounded-3xl bg-red-500/20 border-2 border-red-400/50 flex items-center justify-center mx-auto shadow-lg"><ShieldAlert size={44} className="text-red-400" /></div>
                  <div className="inline-block px-3.5 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-black">痛點一：市場波動與風險</div>
                  <h2 className="text-2xl font-black leading-tight text-white">你是想投資、現在想投資，<br /><span className="text-amber-400 underline">但卻又害怕損失？</span></h2>
                  <p className="text-xs font-bold text-slate-200 bg-white/5 p-3.5 rounded-2xl border border-white/10">看著別人領高配息很心動，但又擔心市場大跌、本金腰斬，辛苦存下的錢承受不起風險...</p>
                </div>
              )}
              {currentSlide === 1 && (
                <div className="space-y-4 my-auto text-center">
                  <div className="w-20 h-20 rounded-3xl bg-blue-500/20 border-2 border-blue-400/50 flex items-center justify-center mx-auto shadow-lg"><Lock size={44} className="text-blue-300" /></div>
                  <div className="inline-block px-3.5 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs font-black">痛點二：傳統保單效率</div>
                  <h2 className="text-2xl font-black leading-tight text-white">傳統保單雖然安全，<br /><span className="text-[#fde047]">但是資金效率太低！</span></h2>
                  <p className="text-xs font-bold text-slate-200 bg-white/5 p-3.5 rounded-2xl border border-white/10">把大筆資金全部鎖進保單，前幾年沒有現金流可用，資產長大的速度遠遠追不上通膨！</p>
                </div>
              )}
              {currentSlide === 2 && (
                <div className="space-y-4 my-auto text-center">
                  <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border-2 border-amber-400/50 flex items-center justify-center mx-auto shadow-lg"><Sparkles size={44} className="text-amber-300" /></div>
                  <div className="inline-block px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-200 text-xs font-black">適合所有投資風格</div>
                  <h2 className="text-xl font-black leading-tight text-white">不管你是積極投資者、風險趨避者，還是超級積極的，<br /><span className="text-[#fde047]">都有適合你的方式。</span></h2>
                  <p className="text-xs font-bold text-slate-200 bg-white/5 p-3 rounded-2xl border border-white/10">透過大小水庫的靈活配置，自由掌控現金流與風險承擔。</p>
                </div>
              )}
              {currentSlide === 3 && (
                <div className="space-y-4 my-auto text-center">
                  <div className="w-20 h-20 rounded-3xl bg-purple-500/20 border-2 border-purple-400/50 flex items-center justify-center mx-auto shadow-lg"><TrendingUp size={44} className="text-purple-300" /></div>
                  <div className="inline-block px-3.5 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs font-black">房貸槓桿加速</div>
                  <h2 className="text-xl font-black leading-tight text-white">再搭配上房貸現金流，<br /><span className="text-purple-400">可以讓你加速、高倍數地加速！</span></h2>
                  <p className="text-xs font-bold text-slate-200 bg-white/5 p-3 rounded-2xl border border-white/10">利用房貸低利資金活化資產，以息養貸創造高倍數複利成長。</p>
                </div>
              )}
              {currentSlide === 4 && (
                <div className="space-y-4 my-auto">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-blue-900/40 border border-blue-400/40 p-3 rounded-2xl text-center space-y-1">
                      <div className="text-xs font-black text-blue-200">大水庫</div>
                      <div className="text-[10px] text-slate-300">月配息基金高效率創流</div>
                    </div>
                    <div className="bg-amber-900/40 border border-[#C5A358]/60 p-3 rounded-2xl text-center space-y-1">
                      <div className="text-xs font-black text-[#fde047]">小水庫</div>
                      <div className="text-[10px] text-slate-300">六年期分紅保單(中分紅)鎖利</div>
                    </div>
                  </div>
                  <h2 className="text-xl font-black text-center leading-tight text-white">透過<span className="text-[#fde047]">大小水庫</span>讓你<span className="text-emerald-400">一舉兩得、一石二鳥！</span></h2>
                </div>
              )}
              {currentSlide === 5 && (
                <div className="space-y-4 my-auto text-center">
                  <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400/50 flex items-center justify-center mx-auto shadow-lg"><ShieldCheck size={44} className="text-emerald-400" /></div>
                  <div className="inline-block px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black">預留稅源與節稅</div>
                  <h2 className="text-2xl font-black leading-tight text-white">預留大筆稅源，<br /><span className="text-emerald-400">讓你少繳很多稅！</span></h2>
                  <p className="text-xs font-bold text-slate-200 bg-white/5 p-3 rounded-2xl border border-white/10">透過合法保險規劃指定受益人，資產傳承時能有效預留稅源，留愛不留稅！</p>
                </div>
              )}
              {currentSlide === 6 && (
                <div className="space-y-4 my-auto text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#fde047] to-[#C5A358] text-slate-950 flex items-center justify-center mx-auto shadow-2xl"><TrendingUp size={40} /></div>
                  <h2 className="text-2xl font-black leading-tight text-white">風雨無阻的創造<br /><span className="text-[#fde047]">大小水庫計劃</span></h2>
                  <p className="text-xs font-bold text-slate-200 bg-white/10 p-3 rounded-2xl">馬上開始試算，打造永續現金流與完美傳承藍圖！</p>
                </div>
              )}

              <div className="pt-3 pb-1 border-t border-white/10 text-center space-y-0.5 mt-4">
                <p className="text-[10px] text-slate-400 font-medium">本試算結果與數據僅供參考與輔助規劃之用，不代表最終實際獲利或保證收益。</p>
                <p className="text-[10px] text-slate-400 font-medium">實際財務狀況仍應以個人資產現況與各金融機構公告為準。</p>
              </div>
            </div>

            <div className="p-4 pb-5 z-20 bg-gradient-to-t from-black via-black/90 to-transparent">
              <div className="flex gap-2">
                {currentSlide > 0 && (
                  <button onClick={() => setCurrentSlide((s) => s - 1)} className="px-4 py-3.5 rounded-2xl bg-white/10 text-white font-black text-sm flex items-center gap-1"><ChevronLeft size={18} /> 上一頁</button>
                )}
                {currentSlide < 6 ? (
                  <button onClick={() => setCurrentSlide((s) => s + 1)} className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-[#fde047] to-[#C5A358] text-slate-950 font-black text-sm shadow-xl flex items-center justify-center gap-1"><span>下一頁</span><ChevronRight size={18} /></button>
                ) : (
                  <button onClick={() => setShowPromoSlides(false)} className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-950 font-black text-sm shadow-xl flex items-center justify-center gap-1"><span>立即開始試算我的大小水庫 →</span></button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrintModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 overflow-y-auto print:static print:bg-white print:p-0">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4 print:max-w-none print:shadow-none print:rounded-none">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-blue-900">
                  {selectedTableView === 'downPayment' && '【自備款與大水庫基金資產變化表】'}
                  {selectedTableView === 'mortgage' && '【房貸還款與本息攤還明細表】'}
                  {selectedTableView === 'pf65Cashflow' && '【小水庫現金流分佈表 (中分紅·含65歲生存金)】'}
                  {selectedTableView === 'pf65Wealth' && '【小水庫保單資產變化表 (中分紅)】'}
                  {selectedTableView === 'all' && '風雨無阻的創造大小水庫計劃 - 完整試算報告 (中分紅)'}
                </h3>
                <p className="text-xs text-slate-400">試算日期：{new Date().toLocaleDateString()} · 目前年齡：{currentAge} 歲</p>
              </div>
              <div className="flex gap-2 print:hidden">
                <button onClick={triggerBrowserPrint} className="bg-[#C5A358] text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1 shadow"><Printer size={14} /> 列印 / 存為 PDF</button>
                <button onClick={() => setShowPrintModal(false)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold"><X size={14} /></button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pb-2 border-b print:hidden">
              <button onClick={() => setSelectedTableView('all')} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${selectedTableView==='all'?'bg-blue-900 text-white':'bg-slate-100 text-slate-700'}`}>總覽總表</button>
              <button onClick={() => setSelectedTableView('pf65Cashflow')} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${selectedTableView==='pf65Cashflow'?'bg-blue-900 text-white':'bg-slate-100 text-slate-700'}`}>小水庫現金流分佈</button>
              <button onClick={() => setSelectedTableView('pf65Wealth')} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${selectedTableView==='pf65Wealth'?'bg-blue-900 text-white':'bg-slate-100 text-slate-700'}`}>小水庫資產變化</button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs print:grid-cols-2">
              <div className="bg-slate-50 p-3 rounded-xl border">
                <div className="text-slate-400 font-bold">總投入金額</div>
                <div className="text-base font-black text-blue-900 mt-0.5">{formatCurrency(totalInvestment)}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border">
                <div className="text-slate-400 font-bold">每月基金配息合計</div>
                <div className="text-base font-black text-emerald-600 mt-0.5">+{formatCurrency(totalMonthlyDiv)}</div>
              </div>
            </div>

            <div className="border rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-blue-900 text-white">
                    <th className="py-2.5 px-1">年齡</th>
                    {selectedTableView === 'all' && (
                      <>
                        <th className="py-2.5 px-1">大水庫現值</th>
                        <th className="py-2.5 px-1">小水庫現金流</th>
                        <th className="py-2.5 px-1">月可支配現金流</th>
                        <th className="py-2.5 px-1">總資產 (現值)</th>
                      </>
                    )}
                    {selectedTableView === 'pf65Cashflow' && (
                      <>
                        <th className="py-2.5 px-1">小水庫每月保費支出</th>
                        <th className="py-2.5 px-1">小水庫每月生存金(中分紅)</th>
                        <th className="py-2.5 px-1">小水庫淨每月現金流</th>
                        <th className="py-2.5 px-1">階段說明</th>
                      </>
                    )}
                    {selectedTableView === 'pf65Wealth' && (
                      <>
                        <th className="py-2.5 px-1">小水庫(分紅保單)現金價值</th>
                        <th className="py-2.5 px-1">累積總投入保費</th>
                        <th className="py-2.5 px-1">大水庫基金現值</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {ageSimulationData.rows.map((r) => {
                    const isPF65Active = r.age >= ageSimulationData.survivalStartAge;
                    const isPaying = r.monthlyPF65Premium > 0;
                    return (
                      <tr key={r.age} className="border-b odd:bg-white even:bg-slate-50">
                        <td className="py-2 font-bold text-blue-900">{r.age} 歲</td>
                        {selectedTableView === 'all' && (
                          <>
                            <td className="py-2 font-bold">{formatCurrency(r.bigReservoirValue)}</td>
                            <td className="py-2 font-bold text-amber-600">+{formatCurrency(r.pf65MonthlyCashFlow)}</td>
                            <td className="py-2 font-bold text-emerald-600">{formatCurrency(r.monthlyDisposableCashFlow)}</td>
                            <td className="py-2 font-black text-slate-800">{formatCurrency(r.totalWealth)}</td>
                          </>
                        )}
                        {selectedTableView === 'pf65Cashflow' && (
                          <>
                            <td className="py-2 text-red-500 font-bold">{isPaying ? `-${formatCurrency(r.monthlyPF65Premium)}` : '$0 (繳費期滿)'}</td>
                            <td className="py-2 text-emerald-600 font-bold">{isPF65Active ? `+${formatCurrency(r.pf65MonthlyCashFlow)}` : '$0 (尚未65歲)'}</td>
                            <td className="py-2 font-black text-blue-900">{formatCurrency(r.pf65MonthlyCashFlow - r.monthlyPF65Premium)}</td>
                            <td className="py-2 text-[11px] text-slate-500">
                              {isPaying ? '前6年：配息養保單(滾存)' : isPF65Active ? '65歲起：中分紅生存金' : '累積期：保單複利增值中'}
                            </td>
                          </>
                        )}
                        {selectedTableView === 'pf65Wealth' && (
                          <>
                            <td className="py-2 font-black text-[#C5A358]">{formatCurrency(r.pf65CashValue)}</td>
                            <td className="py-2 text-slate-600">{formatCurrency(Math.min(ageSimulationData.total6YrPremium, (r.yearIndex <= 6 ? r.yearIndex : 6) * (monthlyPF65InvestAmount * 12)))}</td>
                            <td className="py-2 font-bold text-blue-900">{formatCurrency(r.bigReservoirValue)}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t text-center text-[10px] text-slate-400 space-y-0.5">
              <p>本試算結果與數據僅供參考與輔助規劃之用，不代表最終實際獲利或保證收益。</p>
              <p>實際財務狀況仍應以個人資產現況與各金融機構公告為準。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
