/**
 * 가계부 & 카드별 지출 대시보드 - Application Logic
 * 허계원 고객님 맞춤형 재무 분석 웹 대시보드
 */

(function () {
  'use strict';

  // --- Constants & Brand Configuration ---
  const STORAGE_KEY = 'gyewon_household_tx_sep27_v1';
  const THEME_KEY = 'gyewon_theme_mode';
  const RULES_STORAGE_KEY = 'gyewon_category_rules_v1';
  const MASTER_CAT_STORAGE_KEY = 'gyewon_master_categories_v1';
  const FIXED_CAT_STORAGE_KEY = 'gyewon_fixed_cats_v1';
  const CARD_STORAGE_KEY = 'gyewon_cards_v1';
  const DELETED_RECORDS_KEY = 'gyewon_deleted_records_v1';

  // --- Supabase Client ---
  const supabaseUrl = 'https://jkuuwmuniuvijvbtvwde.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE';
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  const DEFAULT_MASTER_CATEGORIES = {
    "식비": ["외식", "배달", "카페/간식", "식재료/마트"],
    "교통/차량": ["대중교통", "택시", "주유", "정비"],
    "주거/통신": ["월세/관리비", "통신비", "가스/전기/수도"],
    "쇼핑": ["온라인쇼핑", "의류/잡화", "가전/가구", "편의점"],
    "문화/여가": ["영화/공연", "게임", "여행", "도서"],
    "건강/의료": ["병원/약국", "운동", "영양제"],
    "미용/패션": ["헤어/뷰티", "화장품"],
    "경조사/회비": ["축의금", "조의금", "모임/회비"],
    "기타": ["미분류", "현금찾기", "기타지출"]
  };

  let CARD_CONFIG = {
    '신한카드_더모아': { color: '#3b82f6', chip: '#2563eb', target: 500000, type: 'physical' },
    '우리카드_KT Plus': { color: '#06b6d4', chip: '#0891b2', target: 400000, type: 'physical' },
    '하나카드_MG+ S': { color: '#ec4899', chip: '#db2777', target: 500000, type: 'physical' }, // Pink
    '국민카드_톡마포': { color: '#f59e0b', chip: '#d97706', target: 300000, type: 'physical' },
    '신한카드_다드림 LOVE': { color: '#ef4444', chip: '#dc2626', target: 300000, type: 'physical' },
    '신한 복지 다드림 LOVE': { color: '#ef4444', chip: '#dc2626', target: 300000, type: 'physical' }, // Keep for compatibility if needed
    '7230': { color: '#10b981', chip: '#059669', target: 500000, type: 'physical' }, // 7230 was on the right in the screenshot, but let's keep it here if it's a card. Wait, the user's screenshot had 7230 on the RIGHT side.
    '국민카드_KB국민플래티늄카드': { color: '#8b5cf6', chip: '#7c3aed', target: 1000000, type: 'physical' },

    '네이버페이 간편결제': { color: '#03c75a', dot: '#02b351', type: 'pay' }, // Naver Green
    '네이버페이 간편결제(포인트)': { color: '#4ade80', dot: '#22c55e', type: 'pay' },
    '카카오페이 간편결제': { color: '#eab308', dot: '#ca8a04', type: 'pay' },
    '카카오페이 머니': { color: '#facc15', dot: '#eab308', type: 'pay' },
    '페이코 간편결제': { color: '#f43f5e', dot: '#e11d48', type: 'pay' },
    '토스 간편결제': { color: '#3b82f6', dot: '#2563eb', type: 'pay' },
    '신한 SOL LINK (쏠편한 입출금)': { color: '#475569', dot: '#94a3b8', type: 'pay' },
    'Sh평생주거래우대통장(스페셜플러스예금-잔액구간별)': { color: '#475569', dot: '#94a3b8', type: 'pay' },
    '상상모바일통장': { color: '#475569', dot: '#94a3b8', type: 'pay' }
  };

  const CATEGORY_COLORS = [
    '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899',
    '#8b5cf6', '#3b82f6', '#14b8a6', '#f97316', '#a855f7',
    '#64748b', '#84cc16', '#eab308', '#0284c7', '#d946ef'
  ];

  // --- State ---
  let appState = {
    records: [],
    categoryRules: [],
    masterCategories: {},
    deletedSignatures: new Set(),
    notificationLogs: [], // newly added for logs
    activeManageMainCat: null,
    searchQuery: '',
    filterCard: 'ALL',
    filterCategory: 'ALL',
    filterExclude: 'ALL', // 'ALL' | 'N' | 'Y'
    filterInstallment: 'ALL',
     // 'ALL' | '일시불' | '할부'
    globalMonth: `${new Date().getMonth() + 1}월`,
    sortBy: 'id',
    sortOrder: 'asc',
    currentPage: 1,
    pageSize: 30,
    activeChartTab: 'cards'
  };

  // Chart instances
  let charts = {
    doughnut: null,
    categoryBar: null,
    trendLine: null,
    dailyBar: null
  };

  // --- Helper Functions ---
  function getSignature(r) {
    return `${r.date}|${r.time || ''}|${r.merchant}|${r.amount}`;
  }

  function identifyCanceledPairs(recordsList) {
    recordsList.forEach(r => r.isCanceled = false);
    const groups = {};
    recordsList.forEach(r => {
      const key = `${r.date}|${r.merchant}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    for (const key in groups) {
      const group = groups[key];
      const matched = new Set();
      for (let i = 0; i < group.length; i++) {
        if (matched.has(i)) continue;
        for (let j = i + 1; j < group.length; j++) {
          if (matched.has(j)) continue;
          if (group[i].amount === -group[j].amount && group[i].amount !== 0) {
            group[i].isCanceled = true;
            group[j].isCanceled = true;
            matched.add(i);
            matched.add(j);
            break;
          }
        }
      }
    }
  }

  function formatCurrency(val) {
    return (Number(val) || 0).toLocaleString('ko-KR');
  }

  let activeToastTimer = null;
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    if (activeToastTimer) clearTimeout(activeToastTimer);
    container.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'warn' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    activeToastTimer = setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2500);

    // 알림 기록(Log)에 저장
    const logEntry = {
      id: Date.now(),
      time: new Date().toLocaleString('ko-KR'),
      message: message,
      type: type
    };
    appState.notificationLogs.unshift(logEntry);
    if (appState.notificationLogs.length > 50) {
      appState.notificationLogs.pop();
    }
    saveData();
    if (document.getElementById('notificationLogModal')?.classList.contains('show')) {
      renderNotificationLogs();
    }
  }

  function renderNotificationLogs() {
    const list = document.getElementById('notificationLogList');
    if (!list) return;
    list.innerHTML = '';
    
    if (!appState.notificationLogs || appState.notificationLogs.length === 0) {
      list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">최근 알림 기록이 없습니다.</div>';
      return;
    }

    appState.notificationLogs.forEach(log => {
      const item = document.createElement('div');
      item.style.padding = '12px';
      item.style.border = '1px solid var(--border-color)';
      item.style.borderRadius = '6px';
      item.style.background = 'var(--bg-card)';
      
      const icon = log.type === 'success' ? '✅' : log.type === 'warn' ? '⚠️' : 'ℹ️';
      item.innerHTML = `
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">${log.time}</div>
        <div style="font-size: 0.95rem; font-weight: 500;"><span>${icon}</span> ${log.message.replace(/\\n/g, '<br>')}</div>
      `;
      list.appendChild(item);
    });
  }

  async function init() {
    await loadData();
    initTheme();
    populateFilterDropdowns();
    attachEventListeners();
    renderAll();
  }

  // --- Auth Management ---
  let currentSession = null;

  // Auth initialization logic moved to initAuthAndLockScreen

  async function handleGoogleLogin() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.href.split('#')[0]
        }
      });
      if (error) {
        alert('구글 로그인 실패: ' + error.message);
      }
    } catch (e) {
      alert('로그인 처리 중 오류가 발생했습니다: ' + e.message);
    }
  }

  async function handleGoogleLogout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        alert('로그아웃 실패: ' + error.message);
      }
    } catch (e) {
      alert('로그아웃 처리 중 오류가 발생했습니다: ' + e.message);
    }
  }

  function renderAuthUI(session) {
    const container = document.getElementById('authContainer');
    if (!container) return;

    if (session && session.user) {
      const user = session.user;
      const meta = user.user_metadata || {};
      const userName = meta.full_name || meta.name || user.email || '사용자';
      const avatarUrl = meta.avatar_url || meta.picture || '';

      const avatarHtml = avatarUrl
        ? `<img class="user-avatar-img" src="${avatarUrl}" alt="${userName}" />`
        : `<span class="user-avatar-placeholder">👤</span>`;

      container.innerHTML = `
        <div class="user-profile-badge">
          ${avatarHtml}
          <span class="user-name-text">${userName}</span>
          <button id="btnGoogleLogout" class="btn btn-logout-sm" title="로그아웃">로그아웃</button>
        </div>
      `;

      document.getElementById('btnGoogleLogout')?.addEventListener('click', handleGoogleLogout);
    } else {
      container.innerHTML = `
        <button id="btnGoogleLogin" class="btn btn-google-login" title="구글 계정으로 로그인">
          <svg class="google-svg-icon" width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>구글 로그인</span>
        </button>
      `;

      document.getElementById('btnGoogleLogin')?.addEventListener('click', handleGoogleLogin);
    }
  }

  async function loadData() {
    console.log("Loading data from Supabase...");
    try {
      const { data: settings, error: setErr } = await supabase.from('app_settings').select('*');
      if (settings) {
        settings.forEach(s => {
          if (s.key === 'rules') appState.categoryRules = s.value;
          if (s.key === 'master_categories') appState.masterCategories = s.value;
          
          if (s.key === 'deleted_signatures') appState.deletedSignatures = new Set(s.value);
          if (s.key === 'notification_logs') appState.notificationLogs = s.value;
          if (s.key === 'card_config') CARD_CONFIG = s.value;
        });
      }

      if (Object.keys(appState.masterCategories).length === 0) {
        appState.masterCategories = JSON.parse(JSON.stringify(DEFAULT_MASTER_CATEGORIES));
      }

      const { data: records, error: recErr } = await supabase.from('records').select('*').order('id', { ascending: true });
      if (records && records.length > 0) {
        appState.records = records;
        let changed = autoFlagInstallments();
        appState.records.forEach(r => {
          if (r.isFixed === undefined || r.isFixed === null) {
            checkFixedCategory(r);
            changed = true;
          }
        });
        if (changed) saveData();
      }
    } catch (err) {
      console.error("Supabase load error:", err);
    }
    
    if (!appState.records || appState.records.length === 0) {
      if (window.INITIAL_DATA && window.INITIAL_DATA.records && window.INITIAL_DATA.records.length > 0) {
        appState.records = JSON.parse(JSON.stringify(window.INITIAL_DATA.records));
        saveData();
      }
    }
  }

    async function saveDeletedSignatures() {
    await supabase.from('app_settings').upsert({ key: 'deleted_signatures', value: Array.from(appState.deletedSignatures) });
  }

  
  async function saveCardConfig() {
    await supabase.from('app_settings').upsert({ key: 'card_config', value: CARD_CONFIG });
  }

  async function saveData() {
    try {
      if (appState.records.length > 0) {
        // Bulk upsert records
        await supabase.from('records').upsert(appState.records);
      } else {
        // If empty, delete all existing records to reflect empty state
        await supabase.from('records').delete().neq('id', 0);
      }
      
      await supabase.from('app_settings').upsert([
        { key: 'deleted_signatures', value: Array.from(appState.deletedSignatures) },
        { key: 'notification_logs', value: appState.notificationLogs }
      ]);
    } catch (e) {
      console.error('Failed to save to Supabase:', e);
    }
  }

  async function saveRules() {
    try {
      await supabase.from('app_settings').upsert({ key: 'rules', value: appState.categoryRules });
    } catch (e) {
      console.error('Failed to save rules to Supabase:', e);
    }
  }

  

  async function saveMasterCategories() {
    await supabase.from('app_settings').upsert({ key: 'master_categories', value: appState.masterCategories });
  }

  
  
  function autoFlagInstallments() {
    let changed = false;
    // Group by time + merchant + card
    const groups = {};
    appState.records.forEach(r => {
      const key = `${r.time}|${r.merchant}|${r.actualCard}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
      // Also, if memo contains '할부', auto-flag
      if ((r.memo && r.memo.includes('할부')) || (r.installment && r.installment !== '일시불')) {
        if (r.isInstallment !== 'Y') {
          r.isInstallment = 'Y';
          changed = true;
        }
      }
    });
    
    // If multiple records share the exact same time, merchant, and card, but have different dates, they are installments.
    for (const key in groups) {
      if (groups[key].length > 1) {
        groups[key].forEach(r => {
          if (r.isInstallment !== 'Y') {
            r.isInstallment = 'Y';
            changed = true;
          }
        });
      }
    }
    return changed;
  }

  function checkFixedCategory(rec) {
    rec.isFixed = (rec.category === '고정비') ? 'Y' : 'N';
  }

  function saveCards() {
    try {
      saveCardConfig();
    } catch (e) {
      console.error('Failed to save cards to localStorage:', e);
    }
  }

  function applyCategoryRules(recordsList) {
    let result = { changed: false, count: 0, details: [] };
    if (appState.categoryRules.length === 0) return result;
    
    recordsList.forEach(rec => {
      const merchant = rec.merchant || '';
      const amount = Math.abs(Number(rec.amount) || 0); // Use absolute value for matching
      
      for (const rule of appState.categoryRules) {
        let match = merchant.includes(rule.keyword);
        
        // If rule has an amount condition, it must match
        if (match && rule.amount) {
          match = (amount === Math.abs(Number(rule.amount) || 0));
        }
        
        if (match) {
          if (rec.category !== rule.category || rec.subCategory !== rule.subCategory) {
            const oldCat = rec.category;
            rec.category = rule.category;
            if (rule.subCategory) {
              rec.subCategory = rule.subCategory;
            } else {
              rec.subCategory = '';
            }
            checkFixedCategory(rec);
            result.changed = true;
            result.count++;
            // Remove duplicates from details list for clean display
            const detailStr = `[${merchant}] ➔ ${rule.category}${rule.subCategory ? ' > '+rule.subCategory : ''}`;
            if (!result.details.includes(detailStr)) {
              result.details.push(detailStr);
            }
          }
          break;
        }
      }
    });
    return result;
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  }

  function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (icon) {
      icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeIcon(next);
    // Re-render charts with new theme font/grid colors
    updateCharts(getFilteredRecords(true));
  }

  // --- Filter Dropdowns Populate ---
  function populateFilterDropdowns() {
    const optgroupPhysical = document.getElementById('optgroupPhysical');
    const optgroupPay = document.getElementById('optgroupPay');
    const filterCategory = document.getElementById('filterCategory');
    const newActualCard = document.getElementById('newActualCard');
    const categoryDataList = document.getElementById('categoryDataList');

    // Extract cards dynamically from CARD_CONFIG
    const physicalCards = Object.keys(CARD_CONFIG).filter(c => CARD_CONFIG[c].type === 'physical');
    const payCards = Object.keys(CARD_CONFIG).filter(c => CARD_CONFIG[c].type === 'pay');
    const allCards = Object.keys(CARD_CONFIG);

    // Physical Cards
    if (optgroupPhysical) {
      optgroupPhysical.innerHTML = '';
      physicalCards.forEach(card => {
        const opt = document.createElement('option');
        opt.value = card;
        opt.textContent = card;
        optgroupPhysical.appendChild(opt);
      });
    }

    // Pay & Accounts
    if (optgroupPay) {
      optgroupPay.innerHTML = '';
      payCards.forEach(pay => {
        const opt = document.createElement('option');
        opt.value = pay;
        opt.textContent = pay;
        optgroupPay.appendChild(opt);
      });
    }

    // Modal Card options
    if (newActualCard) {
      newActualCard.innerHTML = '';
      allCards.forEach(card => {
        const opt = document.createElement('option');
        opt.value = card;
        opt.textContent = card;
        newActualCard.appendChild(opt);
      });
    }

    // Categories
    const categoriesSet = new Set();
    appState.records.forEach(r => {
      if (r.category) categoriesSet.add(r.category);
    });
    const sortedCats = Array.from(categoriesSet).sort();

    if (filterCategory) {
      filterCategory.innerHTML = '<option value="ALL">모든 카테고리</option>';
      sortedCats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filterCategory.appendChild(opt);
      });
    }

    populateCategorySelects();

    // Global Month Filter Population
    const globalMonthSelect = document.getElementById('globalMonthFilter');
    if (globalMonthSelect) {
      let currentMonth = appState.globalMonth;
      globalMonthSelect.innerHTML = '<option value="ALL">전체 월 보기</option>';
      const uniqueMonths = [...new Set(appState.records.map(r => r.month))].filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b));
      
      uniqueMonths.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === currentMonth) opt.selected = true;
        globalMonthSelect.appendChild(opt);
      });

      if (currentMonth !== 'ALL' && !uniqueMonths.includes(currentMonth)) {
        if (uniqueMonths.length > 0) {
          appState.globalMonth = uniqueMonths[uniqueMonths.length - 1];
          globalMonthSelect.value = appState.globalMonth;
        } else {
          appState.globalMonth = 'ALL';
          globalMonthSelect.value = 'ALL';
        }
      } else {
        globalMonthSelect.value = currentMonth;
      }
    }
  }

  function populateCategorySelects() {
    const mainCats = Object.keys(appState.masterCategories);
    
    // For Modals: newCategory, ruleCategory
    const newMain = document.getElementById('newCategory');
    const ruleMain = document.getElementById('ruleCategory');
    
    [newMain, ruleMain].forEach(selectEl => {
      if (!selectEl) return;
      const currentVal = selectEl.value;
      selectEl.innerHTML = '<option value="">대분류 선택</option>';
      mainCats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === currentVal) opt.selected = true;
        selectEl.appendChild(opt);
      });
      // trigger change to update subcategories
      selectEl.dispatchEvent(new Event('change'));
    });
  }

  function updateSubCategoryOptions(mainSelect, subSelectId) {
    const subSelect = document.getElementById(subSelectId);
    if (!subSelect) return;
    
    const mainCat = mainSelect.value;
    const currentVal = subSelect.value;
    
    subSelect.innerHTML = '<option value="">소분류 선택</option>';
    
    if (mainCat && appState.masterCategories[mainCat]) {
      appState.masterCategories[mainCat].forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        if (sub === currentVal) opt.selected = true;
        subSelect.appendChild(opt);
      });
    }
  }

  // --- Filtering Logic ---
  // forDashboard = true means period filter applies, but search/table-specific filters don't restrict dashboard totals
  function getFilteredRecords(forDashboard = false) {
    return appState.records.filter(r => {
      // Global Month Filter
      if (appState.globalMonth !== 'ALL' && r.month !== appState.globalMonth) {
        return false;
      }

      if (forDashboard) {
        return true;
      }

      // Card Filter
      if (appState.filterCard === 'UNMAPPED') {
        const isPhysical = CARD_CONFIG[r.actualCard] && CARD_CONFIG[r.actualCard].type === 'physical';
        if (isPhysical) return false;
      } else if (appState.filterCard !== 'ALL') {
        if (r.actualCard !== appState.filterCard) return false;
      }

      // Category Filter
      if (appState.filterCategory !== 'ALL') {
        if (r.category !== appState.filterCategory) return false;
      }

      // Exclude Filter
      if (appState.filterExclude !== 'ALL') {
        if (r.exclude !== appState.filterExclude) return false;
      }

      // Installment Filter
      if (appState.filterInstallment === 'N') {
        if (r.isInstallment === 'Y') return false;
      } else if (appState.filterInstallment === 'Y') {
        if (r.isInstallment !== 'Y') return false;
      }

      // Search Query (merchant, memo, origPay)
      if (appState.searchQuery.trim()) {
        const q = appState.searchQuery.trim().toLowerCase();
        const m = (r.merchant || '').toLowerCase();
        const memo = (r.memo || '').toLowerCase();
        const orig = (r.origPay || '').toLowerCase();
        const cat = (r.category || '').toLowerCase();
        const sub = (r.subCategory || '').toLowerCase();
        if (!m.includes(q) && !memo.includes(q) && !orig.includes(q) && !cat.includes(q) && !sub.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }

  // --- Render All Dashboard Elements ---
  function renderAll() {
    identifyCanceledPairs(appState.records);
    renderKPIs();
    renderCardsBreakdown();
    updateCharts(getFilteredRecords(true));
    renderTable();
  }

  // --- Render KPIs ---
  function renderKPIs() {
    const records = getFilteredRecords(true);

    let totalValidAmt = 0;
    let totalValidCount = 0;
    let cardAmt = 0;
    let payAmt = 0;
    let payCount = 0;
    let billingAmt = 0;
    let installmentCount = 0;
    let excludedAmt = 0;
    let excludedCount = 0;
    let fixedAmt = 0;

    records.forEach(r => {
      const amt = Number(r.amount) || 0;
      const bAmt = Number(r.billingAmount) || amt;
      const isExclude = r.exclude === 'Y';
      const isPhysical = CARD_CONFIG[r.actualCard] && CARD_CONFIG[r.actualCard].type === 'physical';
      const isPayOrAccount = !isPhysical;

      if (isExclude) {
        excludedAmt += amt;
        excludedCount++;
      } else {
        totalValidAmt += amt;
        totalValidCount++;

        if (r.isFixed === 'Y' || r.category === '고정비') {
          fixedAmt += amt;
        }

        if (isPhysical) {
          cardAmt += amt;
        } else {
          payAmt += amt;
          payCount++;
        }

        billingAmt += bAmt;

        if (r.installment && r.installment !== '일시불') {
          installmentCount++;
        }
      }
    });

    // Update KPI Elements
    const livingAmt = totalValidAmt - fixedAmt;
    const kpiLivingAmountEl = document.getElementById('kpiLivingAmount');
    if (kpiLivingAmountEl) kpiLivingAmountEl.textContent = formatCurrency(livingAmt);

    const kpiFixedAmountTextEl = document.getElementById('kpiFixedAmountText');
    if (kpiFixedAmountTextEl) kpiFixedAmountTextEl.textContent = `고정비: ${formatCurrency(fixedAmt)}원 (총 ${formatCurrency(totalValidAmt)}원)`;

    // Daily average based on period (10 days)
    const daysInPeriod = 10;
    const dailyAvg = Math.round(totalValidAmt / daysInPeriod);
    document.getElementById('kpiDailyAvg').textContent = `일평균 ${formatCurrency(dailyAvg)}원`;

    // Card Amount & Ratio
    document.getElementById('kpiCardAmount').textContent = formatCurrency(cardAmt);
    const cardRatio = totalValidAmt > 0 ? Math.round((cardAmt / totalValidAmt) * 100) : 0;
    document.getElementById('kpiCardRatioBar').style.width = `${cardRatio}%`;
    document.getElementById('kpiCardRatioText').textContent = `지출 비중 ${cardRatio}%`;

    // Pay Amount
    document.getElementById('kpiPayAmount').textContent = formatCurrency(payAmt);
    document.getElementById('kpiPayCount').textContent = `간편결제/계좌 ${payCount}건`;

    // Billing Amount
    document.getElementById('kpiBillingAmount').textContent = formatCurrency(billingAmt);
    document.getElementById('kpiInstallmentCount').textContent = `할부 설정 ${installmentCount}건`;

    // Excluded
    document.getElementById('kpiExcludedAmount').textContent = formatCurrency(excludedAmt);
    document.getElementById('kpiExcludedCount').textContent = `${excludedCount}건 완료`;

    // Subtotals in Panel
    document.getElementById('cardSubtotalBadge').textContent = `카드 합계: ${formatCurrency(cardAmt)}원`;
    document.getElementById('paySubtotalBadge').textContent = `소계: ${formatCurrency(payAmt)}원`;

    // Period info
    const countInfo = document.getElementById('periodTxCount');
    if (countInfo) {
      countInfo.textContent = `총 ${records.length}건의 지출 내역 (포함 ${totalValidCount}건)`;
    }

    // Mapping Notice Banner Update & UNMAPPED select option text
    const banner = document.getElementById('mappingNoticeBanner');
    const bannerText = document.getElementById('unmappedBannerText');
    const optUnmapped = document.getElementById('optUnmappedAll');
    if (optUnmapped) {
      optUnmapped.textContent = `⚡ 간편결제/계좌 전체 (미매핑 ${payCount}건)`;
    }

    if (payCount > 0) {
      banner.style.display = 'flex';
      bannerText.textContent = `아직 카드가 지정되지 않은 간편결제/계좌 내역이 ${payCount}건 (${formatCurrency(payAmt)}원) 남아있습니다. '매핑하기'를 누르면 해당 내역만 모아서 편리하게 카드를 지정하실 수 있습니다!`;
    } else {
      banner.style.display = 'none';
    }
  }

  // --- Render Card Performance Breakdown ---
  function renderCardsBreakdown() {
    const records = getFilteredRecords(true);
    const physicalCardsContainer = document.getElementById('physicalCardsContainer');
    const payAccountsContainer = document.getElementById('payAccountsContainer');

    if (!physicalCardsContainer || !payAccountsContainer) return;

    // Aggregate by card
    const cardSums = {};
    const cardCounts = {};
    let totalPhysicalAmt = 0;

    records.forEach(r => {
      const card = r.actualCard || '기타 카드';
      const amt = Number(r.amount) || 0;
      cardSums[card] = (cardSums[card] || 0) + amt;
      cardCounts[card] = (cardCounts[card] || 0) + 1;

      if (CARD_CONFIG[card] && CARD_CONFIG[card].type === 'physical') {
        totalPhysicalAmt += amt;
      }
    });

    // Render Physical Cards
    physicalCardsContainer.innerHTML = '';
    const physicalCardNames = Object.keys(CARD_CONFIG).filter(c => CARD_CONFIG[c].type === 'physical');

    physicalCardNames.forEach(cardName => {
      const conf = CARD_CONFIG[cardName] || { color: '#64748b', chip: '#475569', target: 300000 };
      const amt = cardSums[cardName] || 0;
      const cnt = cardCounts[cardName] || 0;
      const share = totalPhysicalAmt > 0 ? ((amt / totalPhysicalAmt) * 100).toFixed(1) : 0;
      const targetPercent = conf.target > 0 ? Math.min(100, Math.round((amt / conf.target) * 100)) : 100;
      const isTargetMet = conf.target > 0 && amt >= conf.target;

      const cardEl = document.createElement('div');
      cardEl.className = `card-item ${appState.filterCard === cardName ? 'active-filter' : ''}`;
      cardEl.title = `${cardName} 내역 필터링`;
      cardEl.innerHTML = `
        <div class="card-item-top">
          <div class="card-brand-name">
            <span class="card-brand-chip" style="background: ${conf.color};"></span>
            <span class="card-title">${cardName}</span>
          </div>
          <div class="card-amount-group">
            <span class="card-amount">${formatCurrency(amt)}원</span>
            <span class="card-share">(${share}%)</span>
          </div>
        </div>
        <div class="card-item-bottom">
          <div class="card-bar-bg">
            <div class="card-bar-fill" style="width: ${share}%; background: ${conf.color};"></div>
          </div>
          <span class="card-meta-text">
            ${cnt}건 ${conf.target > 0 ? `· 목표 ${formatCurrency(conf.target)}원 (${targetPercent}% ${isTargetMet ? '달성✨' : ''})` : ''}
          </span>
        </div>
      `;

      cardEl.addEventListener('click', () => {
        if (appState.filterCard === cardName) {
          appState.filterCard = 'ALL';
        } else {
          appState.filterCard = cardName;
        }
        document.getElementById('filterCard').value = appState.filterCard;
        appState.currentPage = 1;
        renderCardsBreakdown();
        renderTable();
        showToast(`'${cardName}' 내역 필터가 적용되었습니다.`);
      });

      physicalCardsContainer.appendChild(cardEl);
    });

    // Render Pay & Accounts mini-cards
    payAccountsContainer.innerHTML = '';
    const payNames = Object.keys(CARD_CONFIG).filter(c => CARD_CONFIG[c].type === 'pay');

    payNames.forEach(payName => {
      const conf = CARD_CONFIG[payName] || { color: '#64748b', dot: '#94a3b8' };
      const amt = cardSums[payName] || 0;
      const cnt = cardCounts[payName] || 0;

      const payEl = document.createElement('div');
      payEl.className = `pay-mini-card ${appState.filterCard === payName ? 'active-filter' : ''}`;
      payEl.innerHTML = `
        <div class="pay-mini-title">
          <span class="pay-mini-dot" style="background: ${conf.dot || conf.color};"></span>
          <span>${payName.replace('[간편결제] ', '')}</span>
        </div>
        <div class="pay-mini-amount">${formatCurrency(amt)}원 <small style="font-weight:400; font-size:0.75rem; color:var(--text-muted);">(${cnt}건)</small></div>
      `;

      payEl.addEventListener('click', () => {
        if (appState.filterCard === payName) {
          appState.filterCard = 'ALL';
        } else {
          appState.filterCard = payName;
        }
        document.getElementById('filterCard').value = appState.filterCard;
        appState.currentPage = 1;
        renderCardsBreakdown();
        renderTable();
      });

      payAccountsContainer.appendChild(payEl);
    });
  }

  // --- Charts Logic ---
  function updateCharts(records) {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    // 1. Doughnut: Card Breakdown
    renderCardDoughnut(records, textColor);

    // 2. Bar: Category Breakdown
    renderCategoryBar(records, textColor, gridColor);

    // 3. Line: Daily Spend Trend
    renderTrendLine(records, textColor, gridColor);

    // 4. Bar: Daily Spend Breakdown (Sep 1 to Sep 10)
    renderDailyBar(textColor, gridColor);
  }

  function renderCardDoughnut(records, textColor) {
    const canvas = document.getElementById('cardDoughnutChart');
    const legendBox = document.getElementById('cardCustomLegend');
    if (!canvas) return;

    const sums = {};
    records.forEach(r => {
      const card = r.actualCard || '기타 카드';
      sums[card] = (sums[card] || 0) + (Number(r.amount) || 0);
    });

    const sortedCards = Object.keys(sums).sort((a, b) => sums[b] - sums[a]);
    const labels = sortedCards;
    const data = sortedCards.map(c => sums[c]);
    const bgColors = sortedCards.map(c => (CARD_CONFIG[c] ? CARD_CONFIG[c].color : '#64748b'));

    if (charts.doughnut) {
      charts.doughnut.destroy();
    }

    charts.doughnut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#ffffff' : '#111827',
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const val = ctx.parsed;
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const percent = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${formatCurrency(val)}원 (${percent}%)`;
              }
            }
          }
        }
      }
    });

    // Custom Legend
    if (legendBox) {
      legendBox.innerHTML = '';
      labels.forEach((lbl, idx) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
          <span class="legend-color-dot" style="background: ${bgColors[idx]};"></span>
          <span>${lbl.replace('[간편결제] ', '')} (${formatCurrency(data[idx])}원)</span>
        `;
        legendBox.appendChild(item);
      });
    }
  }

  function renderCategoryBar(records, textColor, gridColor) {
    const canvas = document.getElementById('categoryBarChart');
    if (!canvas) return;

    const catSums = {};
    records.forEach(r => {
      const cat = r.category || '기타';
      catSums[cat] = (catSums[cat] || 0) + (Number(r.amount) || 0);
    });

    const sortedCats = Object.keys(catSums).sort((a, b) => catSums[b] - catSums[a]).slice(0, 10);
    const labels = sortedCats;
    const data = sortedCats.map(c => catSums[c]);

    if (charts.categoryBar) {
      charts.categoryBar.destroy();
    }

    charts.categoryBar = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '지출 금액',
          data: data,
          backgroundColor: CATEGORY_COLORS.slice(0, labels.length),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: val => formatCurrency(val) + '원'
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: textColor, font: { weight: '600' } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.x)}원`
            }
          }
        }
      }
    });
  }

  function renderTrendLine(records, textColor, gridColor) {
    const canvas = document.getElementById('trendLineChart');
    if (!canvas) return;

    // Daily cumulative spending
    const dailyMap = {};
    records.forEach(r => {
      if (!r.date) return;
      const d = r.date;
      dailyMap[d] = (dailyMap[d] || 0) + (Number(r.amount) || 0);
    });

    const sortedDates = Object.keys(dailyMap).sort();
    let cumulative = 0;
    const cumData = sortedDates.map(d => {
      cumulative += dailyMap[d];
      return cumulative;
    });

    if (charts.trendLine) {
      charts.trendLine.destroy();
    }

    charts.trendLine = new Chart(canvas, {
      type: 'line',
      data: {
        labels: sortedDates.map(d => d.slice(5)), // MM-DD
        datasets: [
          {
            label: '일별 지출액',
            type: 'bar',
            data: sortedDates.map(d => dailyMap[d]),
            backgroundColor: 'rgba(99, 102, 241, 0.35)',
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            label: '누적 지출액',
            type: 'line',
            data: cumData,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 3,
            pointRadius: 3,
            pointHoverRadius: 6,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, maxTicksLimit: 14 }
          },
          y: {
            position: 'left',
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: val => formatCurrency(val)
            }
          },
          y1: {
            position: 'right',
            grid: { display: false },
            ticks: {
              color: '#06b6d4',
              callback: val => formatCurrency(val)
            }
          }
        },
        plugins: {
          legend: { labels: { color: textColor } },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}원`
            }
          }
        }
      }
    });
  }

  function renderDailyBar(textColor, gridColor) {
    const canvas = document.getElementById('dailyBarChart');
    if (!canvas) return;

    const dates = [
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05',
      '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'
    ];
    const cardData = dates.map(() => 0);
    const payData = dates.map(() => 0);

    appState.records.forEach(r => {
      if (!r.date) return;
      const idx = dates.indexOf(r.date);
      if (idx !== -1) {
        const amt = Number(r.amount) || 0;
        const isPhysical = CARD_CONFIG[r.actualCard] && CARD_CONFIG[r.actualCard].type === 'physical';
        if (isPhysical) cardData[idx] += amt;
        else payData[idx] += amt;
      }
    });

    if (charts.dailyBar) {
      charts.dailyBar.destroy();
    }

    charts.dailyBar = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: dates.map(d => `${parseInt(d.slice(8), 10)}일`),
        datasets: [
          {
            label: '실물 카드 지출',
            data: cardData,
            backgroundColor: '#2563eb',
            borderRadius: 4
          },
          {
            label: '간편결제/계좌 지출',
            data: payData,
            backgroundColor: '#f59e0b',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: textColor }
          },
          y: {
            stacked: true,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: val => formatCurrency(val) + '원'
            }
          }
        },
        plugins: {
          legend: { labels: { color: textColor } },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}원`
            }
          }
        }
      }
    });
  }

  // --- Render Transactions Table ---
  function renderTable() {
    const tableBody = document.getElementById('txTableBody');
    if (!tableBody) return;

    const filtered = getFilteredRecords(false);

    // Sorting
    filtered.sort((a, b) => {
      let valA = a[appState.sortBy];
      let valB = b[appState.sortBy];

      if (appState.sortBy === 'amount' || appState.sortBy === 'id' || appState.sortBy === 'billingAmount') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = (valA || '').toString();
        valB = (valB || '').toString();
      }

      if (valA < valB) return appState.sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return appState.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Update stats summary in header
    const totalFilteredAmt = filtered.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    document.getElementById('filteredCountBadge').textContent = `검색/필터 결과: ${filtered.length}건`;
    document.getElementById('filteredSumBadge').textContent = `합계: ${formatCurrency(totalFilteredAmt)}원`;

    // Pagination
    const pageSize = appState.pageSize;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (appState.currentPage > totalPages) appState.currentPage = totalPages;

    const startIndex = (appState.currentPage - 1) * pageSize;
    const pageRecords = filtered.slice(startIndex, startIndex + pageSize);

    tableBody.innerHTML = '';

    if (pageRecords.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="12" style="text-align:center; padding: 48px 16px; color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
            <p>검색 및 필터 조건에 부합하는 지출 내역이 없습니다.</p>
          </td>
        </tr>
      `;
      renderPagination(totalPages);
      return;
    }

    // Build Table Rows
    const allCards = Object.keys(CARD_CONFIG);
    const installmentOptions = ['일시불', '2개월', '3개월', '4개월', '5개월', '6개월', '12개월'];

    pageRecords.forEach(rec => {
      const isExcluded = rec.exclude === 'Y';
      const isUnmapped = !CARD_CONFIG[rec.actualCard] || CARD_CONFIG[rec.actualCard].type !== 'physical';
      const isCanceledClass = rec.isCanceled ? 'is-canceled' : '';

      const tr = document.createElement('tr');
      tr.className = `${isExcluded ? 'tx-row-excluded' : ''} ${isCanceledClass}`.trim();
      tr.dataset.id = rec.id;

      // Card Select Options
      let cardOptionsHtml = '';
      allCards.forEach(card => {
        const isSelected = card === rec.actualCard;
        cardOptionsHtml += `<option value="${card}" ${isSelected ? 'selected' : ''}>${card}</option>`;
      });

      

      // Category Options for Table Select
      const mainCats = Object.keys(appState.masterCategories);
      let catOptionsHtml = '<option value="">대분류</option>';
      let isValidCat = false;
      mainCats.forEach(cat => {
        const isSelected = cat === rec.category;
        if (isSelected) isValidCat = true;
        catOptionsHtml += `<option value="${cat}" ${isSelected ? 'selected' : ''}>${cat}</option>`;
      });
      if (rec.category && !isValidCat) {
        catOptionsHtml += `<option value="${rec.category}" selected>${rec.category} (미등록)</option>`;
      }

      // SubCategory Options for Table Select
      let subOptionsHtml = '<option value="">소분류</option>';
      let isValidSub = false;
      const validSubCats = appState.masterCategories[rec.category] || [];
      validSubCats.forEach(sub => {
        const isSelected = sub === rec.subCategory;
        if (isSelected) isValidSub = true;
        subOptionsHtml += `<option value="${sub}" ${isSelected ? 'selected' : ''}>${sub}</option>`;
      });
      if (rec.subCategory && !isValidSub) {
        subOptionsHtml += `<option value="${rec.subCategory}" selected>${rec.subCategory} (미등록)</option>`;
      }

      tr.innerHTML = `
        <td class="col-id">${rec.id}</td>
        <td class="col-date">
          <div>${rec.date}</div>
          <small style="color:var(--text-muted); font-size:0.75rem;">${rec.time || ''}</small>
        </td>
        <td class="col-cat">
          <select class="input-table-category badge-cat-input" data-id="${rec.id}" title="대분류 선택">
            ${catOptionsHtml}
          </select>
          <select class="input-table-subcategory" data-id="${rec.id}" title="소분류 선택">
            ${subOptionsHtml}
          </select>
        </td>
        <td class="col-merchant" title="${rec.merchant}">
          ${rec.merchant}
        </td>
        <td class="col-amt">${formatCurrency(rec.amount)}</td>
        <td class="col-actual">
          <select class="select-table-card ${isUnmapped ? 'highlight-unmapped' : ''}" data-field="actualCard" data-id="${rec.id}">
            ${cardOptionsHtml}
          </select>
        </td>
        <td class="col-inst" style="text-align:center;">
          <button class="inst-toggle-btn ${rec.isInstallment === 'Y' ? 'active-y' : ''}" data-id="${rec.id}" title="할부 여부 토글" style="width: 40px; font-size:0.8rem; border-radius:12px; padding:4px; border:1px solid ${rec.isInstallment === 'Y' ? 'var(--primary-color)' : 'var(--border-color)'}; background:${rec.isInstallment === 'Y' ? 'var(--primary-color)' : 'transparent'}; color:${rec.isInstallment === 'Y' ? 'white' : 'var(--text-muted)'};">
            ${rec.isInstallment === 'Y' ? 'Y' : 'N'}
          </button>
        </td>
        <td class="col-bill" id="billCell_${rec.id}">
          ${formatCurrency(rec.amount)}
        </td>
        <td class="col-exclude">
          <button class="exclude-toggle-btn ${isExcluded ? 'active-y' : ''}" data-id="${rec.id}" title="결제 상태 토글" style="width: 50px; font-size:0.8rem; border-radius:12px; padding:4px;">
            ${isExcluded ? '완료' : '대기'}
          </button>
        </td>
          <td class="col-fixed" style="text-align:center;">
            <button class="fixed-toggle-btn ${rec.isFixed === 'Y' ? 'active-y' : ''}" data-id="${rec.id}" title="고정비/생활비 토글" style="width: 50px; font-size:0.8rem; border-radius:12px; padding:4px; border:1px solid ${rec.isFixed === 'Y' ? 'var(--primary-color)' : 'var(--border-color)'}; background:${rec.isFixed === 'Y' ? 'var(--primary-color)' : 'transparent'}; color:${rec.isFixed === 'Y' ? 'white' : 'var(--text-muted)'};">
              ${rec.isFixed === 'Y' ? '고정' : '변동'}
            </button>
          </td>
        <td class="col-memo">
          <input type="text" class="input-table-memo" data-id="${rec.id}" value="${rec.memo || ''}" placeholder="메모 입력...">
        </td>
        <td class="col-action">
          <button class="btn-delete-row" data-id="${rec.id}" title="내역 삭제">🗑️</button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    renderPagination(totalPages);
  }

  // --- Pagination Controls ---
  function renderPagination(totalPages) {
    const container = document.getElementById('paginationControls');
    if (!container) return;
    container.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '&lsaquo;';
    prevBtn.disabled = appState.currentPage === 1;
    prevBtn.addEventListener('click', () => {
      if (appState.currentPage > 1) {
        appState.currentPage--;
        renderTable();
      }
    });
    container.appendChild(prevBtn);

    // Page numbers (max 7 shown)
    let startPage = Math.max(1, appState.currentPage - 3);
    let endPage = Math.min(totalPages, startPage + 6);
    if (endPage - startPage < 6) {
      startPage = Math.max(1, endPage - 6);
    }

    for (let p = startPage; p <= endPage; p++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-btn ${p === appState.currentPage ? 'active' : ''}`;
      pageBtn.textContent = p;
      pageBtn.addEventListener('click', () => {
        appState.currentPage = p;
        renderTable();
      });
      container.appendChild(pageBtn);
    }

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '&rsaquo;';
    nextBtn.disabled = appState.currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
      if (appState.currentPage < totalPages) {
        appState.currentPage++;
        renderTable();
      }
    });
    container.appendChild(nextBtn);
  }

  // --- Table Event Delegation (Real-time updates) ---
  // --- Table Event Delegation (Real-time updates) ---
  function handleTableChange(e) {
    const target = e.target;

    // 1. Change Actual Card
    if (target.matches('.select-table-card')) {
      const id = Number(target.dataset.id);
      const newCard = target.value;
      const rec = appState.records.find(r => r.id === id);
      if (rec) {
        rec.actualCard = newCard;
        saveData();
        renderKPIs();
        renderCardsBreakdown();
        updateCharts(getFilteredRecords(true));
        renderTable(); // 실시간 필터 적용을 위해 테이블 다시 그리기

        showToast(`[#${id}] '${rec.merchant}' 카드가 '${newCard}'(으)로 변경되었습니다!`, 'success');
      }
    }

    
  }

  function handleTableClick(e) {
    const target = e.target;

    // 1. Toggle Exclude (Y / N)
    
    // Toggle Fixed/Variable
    
    if (target.closest('.inst-toggle-btn')) {
      const btn = target.closest('.inst-toggle-btn');
      const id = Number(btn.dataset.id);
      const rec = appState.records.find(r => r.id === id);
      if (rec) {
        rec.isInstallment = rec.isInstallment === 'Y' ? 'N' : 'Y';
        saveData();
        renderAll();
        showToast(`[#${id}] 할부 여부가 '${rec.isInstallment}'(으)로 변경되었습니다.`);
      }
      return;
    }

    if (target.closest('.fixed-toggle-btn')) {
      const btn = target.closest('.fixed-toggle-btn');
      const id = Number(btn.dataset.id);
      const rec = appState.records.find(r => r.id === id);
      if (rec) {
        rec.isFixed = rec.isFixed === 'Y' ? 'N' : 'Y';
        saveData();
        renderAll();
        showToast(`${rec.merchant} 내역이 ${rec.isFixed === 'Y' ? '고정비' : '생활비(변동비)'}로 설정되었습니다.`, 'success');
      }
      return;
    }

    if (target.closest('.exclude-toggle-btn')) {
      const btn = target.closest('.exclude-toggle-btn');
      const id = Number(btn.dataset.id);
      const rec = appState.records.find(r => r.id === id);
      if (rec) {
        rec.exclude = rec.exclude === 'Y' ? 'N' : 'Y';
        saveData();
        renderKPIs();
        renderCardsBreakdown();
        updateCharts(getFilteredRecords(true));
        renderTable();
        showToast(
          rec.exclude === 'Y'
            ? `[#${id}] 항목이 통계 및 지출에서 제외(Y) 처리되었습니다.`
            : `[#${id}] 항목이 다시 통계에 포함(N)되었습니다.`,
          rec.exclude === 'Y' ? 'warn' : 'info'
        );
      }
    }

    // 2. Delete Row
    if (target.closest('.btn-delete-row')) {
      const id = Number(target.closest('.btn-delete-row').dataset.id);
      if (confirm(`해당 지출 내역을 휴지통으로 이동하시겠습니까?`)) {
        const rec = appState.records.find(r => r.id === id);
        if (rec) {
          const sig = getSignature(rec);
          appState.deletedSignatures.add(sig);
          supabase.from('deleted_signatures').insert({ signature: sig }); // background
          
          if (rec.originalSignature && rec.originalSignature !== sig) {
            appState.deletedSignatures.add(rec.originalSignature);
            supabase.from('deleted_signatures').insert({ signature: rec.originalSignature });
          }
        }
        appState.records = appState.records.filter(r => r.id !== id);
      supabase.from('records').delete().eq('id', id).then();
        supabase.from('records').delete().eq('id', id); // background
        saveData(); // Save updated records and deleted signatures to localStorage
        renderAll();
        showToast(`내역이 휴지통으로 이동되었습니다.`);
      }
    }
  }

  // --- Attach Event Listeners ---
  function attachEventListeners() {
    // Theme Toggle
    document.getElementById('btnThemeToggle')?.addEventListener('click', toggleTheme);

    // Notification Log Modal
    const notificationLogModal = document.getElementById('notificationLogModal');
    document.getElementById('btnNotificationLog')?.addEventListener('click', () => {
      renderNotificationLogs();
      notificationLogModal.classList.add('show');
    });
    const closeNotificationLog = () => notificationLogModal.classList.remove('show');
    document.getElementById('btnCloseNotificationLog')?.addEventListener('click', closeNotificationLog);
    document.getElementById('btnDoneNotificationLog')?.addEventListener('click', closeNotificationLog);
    document.getElementById('btnClearNotificationLog')?.addEventListener('click', () => {
      if (confirm('모든 알림 기록을 삭제하시겠습니까?')) {
        appState.notificationLogs = [];
        saveData();
        renderNotificationLogs();
      }
    });


    // Chart Tabs
    document.querySelectorAll('.chart-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.chartTab;
        appState.activeChartTab = tab;

        document.querySelectorAll('.chart-view').forEach(v => v.classList.remove('active'));
        if (tab === 'cards') document.getElementById('chartViewCards')?.classList.add('active');
        else if (tab === 'categories') document.getElementById('chartViewCategories')?.classList.add('active');
        else if (tab === 'trends') document.getElementById('chartViewTrends')?.classList.add('active');
        else if (tab === 'daily') document.getElementById('chartViewDaily')?.classList.add('active');
      });
    });

    // Global Month Filter
    document.getElementById('globalMonthFilter')?.addEventListener('change', (e) => {
      appState.globalMonth = e.target.value;
      appState.currentPage = 1;
      renderAll();
      showToast(appState.globalMonth === 'ALL' ? '전체 월 지출을 표시합니다.' : `${appState.globalMonth} 지출을 표시합니다.`);
    });

    // Quick Banner / KPI Filter buttons
    document.getElementById('btnBannerFilter')?.addEventListener('click', () => {
      appState.filterCard = 'UNMAPPED';
      document.getElementById('filterCard').value = 'UNMAPPED';
      appState.currentPage = 1;
      renderCardsBreakdown();
      renderTable();
      const unmappedCount = appState.records.filter(r =>  (!CARD_CONFIG[r.actualCard] || CARD_CONFIG[r.actualCard].type !== 'physical')).length;
      showToast(`미매핑된 간편결제/계좌 내역 ${unmappedCount}건을 표시합니다.`, 'info');
    });

    document.getElementById('btnFilterUnmapped')?.addEventListener('click', () => {
      appState.filterCard = 'UNMAPPED';
      document.getElementById('filterCard').value = 'UNMAPPED';
      appState.currentPage = 1;
      renderCardsBreakdown();
      renderTable();
      const unmappedCount = appState.records.filter(r =>  (!CARD_CONFIG[r.actualCard] || CARD_CONFIG[r.actualCard].type !== 'physical')).length;
      showToast(`미매핑된 간편결제/계좌 내역 ${unmappedCount}건을 표시합니다.`, 'info');
    });

    document.getElementById('btnFilterExcluded')?.addEventListener('click', () => {
      appState.filterExclude = 'Y';
      document.getElementById('filterExclude').value = 'Y';
      appState.currentPage = 1;
      renderTable();
      showToast('제외(Y)된 항목만 표시합니다.');
    });

    // Search Input
    const searchInput = document.getElementById('searchInput');
    const btnClearSearch = document.getElementById('btnClearSearch');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', e => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          appState.searchQuery = e.target.value;
          appState.currentPage = 1;
          if (btnClearSearch) btnClearSearch.style.display = appState.searchQuery ? 'block' : 'none';
          renderTable();
        }, 200);
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        appState.searchQuery = '';
        btnClearSearch.style.display = 'none';
        appState.currentPage = 1;
        renderTable();
      });
    }

    // Dropdown Filters
    document.getElementById('filterCard')?.addEventListener('change', e => {
      appState.filterCard = e.target.value;
      appState.currentPage = 1;
      renderCardsBreakdown();
      renderTable();
    });

    document.getElementById('filterCategory')?.addEventListener('change', e => {
      appState.filterCategory = e.target.value;
      appState.currentPage = 1;
      renderTable();
    });

    document.getElementById('filterExclude')?.addEventListener('change', e => {
      appState.filterExclude = e.target.value;
      appState.currentPage = 1;
      renderTable();
    });

    document.getElementById('filterInstallment')?.addEventListener('change', e => {
      appState.filterInstallment = e.target.value;
      appState.currentPage = 1;
      renderTable();
    });

    // Reset Filters Button
    document.getElementById('btnResetFilters')?.addEventListener('click', () => {
      appState.searchQuery = '';
      appState.filterCard = 'ALL';
      appState.filterCategory = 'ALL';
      appState.filterExclude = 'ALL';
      appState.filterInstallment = 'ALL';
      if (searchInput) searchInput.value = '';
      if (btnClearSearch) btnClearSearch.style.display = 'none';
      document.getElementById('filterCard').value = 'ALL';
      document.getElementById('filterCategory').value = 'ALL';
      document.getElementById('filterExclude').value = 'ALL';
      document.getElementById('filterInstallment').value = 'ALL';
      appState.currentPage = 1;
      renderCardsBreakdown();
      renderTable();
      showToast('모든 필터가 초기화되었습니다.');
    });

    // Table Header Sorting
    document.querySelectorAll('.tx-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const sortField = th.dataset.sort;
        if (appState.sortBy === sortField) {
          appState.sortOrder = appState.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          appState.sortBy = sortField;
          appState.sortOrder = 'asc';
        }

        document.querySelectorAll('.tx-table th .sort-indicator').forEach(si => (si.textContent = '↕'));
        const indicator = th.querySelector('.sort-indicator');
        if (indicator) indicator.textContent = appState.sortOrder === 'asc' ? '↑' : '↓';

        renderTable();
      });
    });

    // Table Interactions (delegation)
    const tableBody = document.getElementById('txTableBody');
    tableBody?.addEventListener('change', handleTableChange);
    tableBody?.addEventListener('click', handleTableClick);

    // Table Inline Edit (Category, SubCategory)
    tableBody?.addEventListener('change', e => {
      if (e.target.matches('.input-table-category') || e.target.matches('.input-table-subcategory')) {
        const id = Number(e.target.dataset.id);
        const rec = appState.records.find(r => r.id === id);
        if (rec) {
          if (e.target.matches('.input-table-category')) {
            rec.category = e.target.value || '기타';
            // if main category changes, reset subcategory
            rec.subCategory = '';
            
            // update subcategory dropdown for this specific row
            const subSelect = e.target.closest('td').querySelector('.input-table-subcategory');
            if (subSelect) {
              subSelect.innerHTML = '<option value="">소분류 선택</option>';
              const subCats = appState.masterCategories[rec.category] || [];
              subCats.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub;
                opt.textContent = sub;
                subSelect.appendChild(opt);
              });
            }
          } else {
            rec.subCategory = e.target.value;
          }
          checkFixedCategory(rec);
          saveData();
          populateFilterDropdowns();
          renderKPIs();
          updateCharts(getFilteredRecords(true));
          renderTable(); // 필터 즉각 반영
          showToast(`[#${id}] 카테고리가 변경되었습니다.`);
        }
      }
    });

    // Table Memo Inline Edit
    tableBody?.addEventListener('blur', e => {
      if (e.target.matches('.input-table-memo')) {
        const id = Number(e.target.dataset.id);
        const val = e.target.value;
        const rec = appState.records.find(r => r.id === id);
        if (rec && rec.memo !== val) {
          rec.memo = val;
          saveData();
          showToast('메모가 저장되었습니다.');
        }
      }
    }, true);

    tableBody?.addEventListener('keydown', e => {
      if (e.target.matches('.input-table-memo') && e.key === 'Enter') {
        e.target.blur(); // Trigger blur to save
      }
    });

    // Page Size Select
    document.getElementById('pageSizeSelect')?.addEventListener('change', e => {
      appState.pageSize = Number(e.target.value);
      appState.currentPage = 1;
      renderTable();
    });

    // Modal: New Transaction
    const modal = document.getElementById('newTxModal');
    document.getElementById('btnNewTransaction')?.addEventListener('click', () => {
      const today = new Date().toISOString().slice(0, 10);
      document.getElementById('newDate').value = today;
      modal.classList.add('show');
    });

    document.getElementById('btnCloseModal')?.addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modal.classList.remove('show'));

    document.getElementById('newTxForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const date = document.getElementById('newDate').value;
      const time = document.getElementById('newTime').value;
      const category = document.getElementById('newCategory').value;
      const subCategory = document.getElementById('newSubCategory').value;
      const merchant = document.getElementById('newMerchant').value;
      const amount = Number(document.getElementById('newAmount').value) || 0;
      const origPay = document.getElementById('newOrigPay').value || '기타';
      const actualCard = document.getElementById('newActualCard').value;
      const isInstallment = document.getElementById('newInstallment').value === 'Y' ? 'Y' : 'N';
      const memo = document.getElementById('newMemo').value;

      const nextId = appState.records.length > 0 ? Math.max(...appState.records.map(r => r.id)) + 1 : 1;
      const monthNum = parseInt(date.split('-')[1], 10);
      const monthStr = `${monthNum}월`;

      

      const newRecord = {
        id: nextId,
        date: date,
        time: time,
        month: monthStr,
        category: category,
        subCategory: subCategory,
        merchant: merchant,
        amount: amount,
        origPay: origPay,
        actualCard: actualCard,
        isInstallment: isInstallment,
        
        exclude: 'N',
        memo: memo
      };

      applyCategoryRules([newRecord]);
      checkFixedCategory(newRecord);
      appState.records.unshift(newRecord);
      saveData();
      modal.classList.remove('show');
      e.target.reset();

      // Refresh filters if new category added
      populateFilterDropdowns();
      renderAll();

      if (typeof confetti === 'function') {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
      }

      showToast(`새 지출 [${merchant} - ${formatCurrency(amount)}원]이 성공적으로 등록되었습니다!`, 'success');
    });

    // Reset Data to Initial
    document.getElementById('btnResetData')?.addEventListener('click', async () => {
      if (confirm('모든 수정사항을 취소하고 원본 엑셀 데이터(261건)로 초기화하시겠습니까? (삭제된 내역 기록도 초기화됩니다)')) {
        await supabase.from('records').delete().neq('id', 0);
        await supabase.from('deleted_signatures').delete().neq('signature', '');
        appState.deletedSignatures.clear();
        if (window.INITIAL_DATA) {
          appState.records = JSON.parse(JSON.stringify(window.INITIAL_DATA.records));
          await supabase.from('records').insert(appState.records);
        }
        renderAll();
        showToast('원본 엑셀 데이터 및 삭제 기록이 초기화되었습니다.', 'info');
      }
    });

    // Export to Excel
    document.getElementById('btnExportExcel')?.addEventListener('click', exportToExcel);

    // Category Rules Modal
    const rulesModal = document.getElementById('categoryRulesModal');
    
    document.getElementById('btnCategoryRules')?.addEventListener('click', () => {
      renderRulesTable();
      rulesModal.classList.add('show');
    });

    document.getElementById('btnCloseRulesModal')?.addEventListener('click', () => rulesModal.classList.remove('show'));
    document.getElementById('btnDoneRulesModal')?.addEventListener('click', () => rulesModal.classList.remove('show'));

    document.getElementById('newRuleForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const keyword = document.getElementById('ruleKeyword').value.trim();
      const amountVal = document.getElementById('ruleAmount').value.trim();
      const amount = amountVal ? Number(amountVal) : null;
      const category = document.getElementById('ruleCategory').value.trim();
      const subCategory = document.getElementById('ruleSubCategory').value.trim();
      
      if (!keyword || !category) return;
      
      appState.categoryRules.push({ id: Date.now(), keyword, amount, category, subCategory });
      saveRules();
      renderRulesTable();
      e.target.reset();
      showToast(`'${keyword}' 규칙이 추가되었습니다.`, 'success');
    });

    document.getElementById('rulesTableBody')?.addEventListener('click', e => {
      if (e.target.closest('.btn-delete-rule')) {
        const id = Number(e.target.closest('.btn-delete-rule').dataset.id);
        appState.categoryRules = appState.categoryRules.filter(r => r.id !== id);
        supabase.from('category_rules').delete().eq('id', id); // background
        renderRulesTable();
        showToast('규칙이 삭제되었습니다.');
      }
    });

    document.getElementById('btnApplyRulesNow')?.addEventListener('click', () => {
      const result = applyCategoryRules(appState.records);
      if (result.changed) {
        saveData();
        populateFilterDropdowns();
        renderAll();
        
        let box = document.getElementById('ruleSummaryBox');
        if (!box) {
          box = document.createElement('div');
          box.id = 'ruleSummaryBox';
          box.style.position = 'fixed'; box.style.top = '50%'; box.style.left = '50%'; box.style.transform = 'translate(-50%, -50%)';
          box.style.backgroundColor = 'var(--bg-surface)'; box.style.padding = '24px'; box.style.borderRadius = '12px';
          box.style.boxShadow = '0 10px 40px rgba(0,0,0,0.8)'; box.style.zIndex = '999999';
          box.style.border = '1px solid var(--border-color)'; box.style.color = 'var(--text-main)';
          box.style.width = '90%'; box.style.maxWidth = '500px'; box.style.maxHeight = '80vh';
          box.style.display = 'flex'; box.style.flexDirection = 'column';
          document.body.appendChild(box);
        }
        
        const msg = result.details.map(d => `<li style='margin-bottom:6px; padding-bottom:6px; border-bottom: 1px solid var(--border-color); font-size:0.95rem;'>${d}</li>`).join('');

        box.innerHTML = `
          <h3 style='margin-top:0; color:var(--text-main); border-bottom:2px solid var(--primary-color); padding-bottom:12px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center;'>
            ✨ 총 ${result.count}건 적용 완료!
            <span style='font-size: 1rem; cursor: pointer;' onclick='document.getElementById("ruleSummaryBox").style.display="none"'>&times;</span>
          </h3>
          <p style='font-size:0.9rem; margin-bottom:12px; color:var(--text-muted);'>아래 가맹점들의 분류가 변경되었습니다.</p>
          <ul style='padding: 0; margin: 0; list-style: none; overflow-y: auto; flex: 1;'>${msg}</ul>
          <button onclick='document.getElementById("ruleSummaryBox").style.display="none"' class='btn btn-primary' style='margin-top: 20px; width: 100%; padding: 12px; font-size: 1.05rem;'>확인 완료</button>
        `;
        box.style.display = 'flex';
        
      } else {
        showToast('적용할 변경 사항이 없습니다.', 'info');
      }
    });

    function renderRulesTable() {
      const tbody = document.getElementById('rulesTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (appState.categoryRules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">등록된 규칙이 없습니다.</td></tr>';
        return;
      }
      appState.categoryRules.forEach(rule => {
        const tr = document.createElement('tr');
        const amountDisplay = rule.amount ? formatCurrency(rule.amount) + '원' : '<span style="color:var(--text-muted);font-size:0.8rem;">(금액무관)</span>';
        tr.innerHTML = `
          <td style="padding: 10px;">${rule.keyword}</td>
          <td style="padding: 10px; text-align: right;">${amountDisplay}</td>
          <td style="padding: 10px;"><span class="badge-cat">${rule.category}</span></td>
          <td style="padding: 10px;">${rule.subCategory || '-'}</td>
          <td style="padding: 10px; text-align: center;">
            <button type="button" class="btn-delete-rule" data-id="${rule.id}" title="삭제" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:var(--text-muted);">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Category cascading for Modals
    document.getElementById('newCategory')?.addEventListener('change', function() {
      updateSubCategoryOptions(this, 'newSubCategory');
    });
    
    document.getElementById('ruleCategory')?.addEventListener('change', function() {
      updateSubCategoryOptions(this, 'ruleSubCategory');
    });

    // Category Manage Modal
    const manageModal = document.getElementById('categoryManageModal');
    
    document.getElementById('btnManageCategories')?.addEventListener('click', () => {
      appState.activeManageMainCat = null;
      renderManageMainCategories();
      renderManageSubCategories();
      manageModal.classList.add('show');
    });

    document.getElementById('btnCloseCategoryManageModal')?.addEventListener('click', () => manageModal.classList.remove('show'));
    document.getElementById('btnDoneCategoryManageModal')?.addEventListener('click', () => manageModal.classList.remove('show'));

    
    document.getElementById('newMainCategoryForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const val = document.getElementById('newMainCategoryName').value.trim();
      const isFixed = document.getElementById('chkNewMainFixed')?.checked;
      if (!val || appState.masterCategories[val]) {
        showToast('이미 존재하거나 잘못된 대분류 이름입니다.', 'warn');
        return;
      }
      appState.masterCategories[val] = [];
      
      saveMasterCategories();
      populateFilterDropdowns(); // update dropdowns globally
      renderTable();
      renderManageMainCategories();
      e.target.reset();
      showToast(`대분류 '${val}'가 추가되었습니다.`, 'success');
    });

    document.getElementById('newSubCategoryForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const mainCat = appState.activeManageMainCat;
      const val = document.getElementById('newSubCategoryName').value.trim();
      const isFixed = document.getElementById('chkNewSubFixed')?.checked;
      if (!mainCat || !val || appState.masterCategories[mainCat].includes(val)) {
        showToast('이미 존재하거나 잘못된 소분류 이름입니다.', 'warn');
        return;
      }
      appState.masterCategories[mainCat].push(val);
      
      saveMasterCategories();
      populateFilterDropdowns();
      renderTable();
      renderManageSubCategories();
      e.target.reset();
      showToast(`'${mainCat}'에 소분류 '${val}'가 추가되었습니다.`, 'success');
    });

    document.getElementById('mainCategoryList')?.addEventListener('click', e => {
      // Select Main Category
      if (e.target.closest('.main-cat-item') && !e.target.closest('.btn-delete-main-cat') && !e.target.closest('.btn-edit-main-cat')) {
        const item = e.target.closest('.main-cat-item');
        appState.activeManageMainCat = item.dataset.cat;
        document.querySelectorAll('.main-cat-item').forEach(el => el.style.background = 'transparent');
        item.style.background = 'var(--bg-input)';
        renderManageSubCategories();
      }
      
      // Delete Main Category
      if (e.target.closest('.btn-delete-main-cat')) {
        const cat = e.target.closest('.btn-delete-main-cat').dataset.cat;
        
        const isUsed = appState.records.some(r => r.category === cat);
        let confirmMsg = `대분류 '${cat}'와 속한 모든 소분류를 삭제하시겠습니까?`;
        if (isUsed) {
          confirmMsg = `대분류 '${cat}'를 사용 중인 내역이 있습니다. 삭제 시 해당 내역들의 카테고리는 모두 '미분류'로 자동 변경됩니다. 계속하시겠습니까?`;
        }
        
        if (confirm(confirmMsg)) {
          delete appState.masterCategories[cat];
          if (appState.activeManageMainCat === cat) {
            appState.activeManageMainCat = null;
          }
          
          if (isUsed) {
            appState.records.forEach(r => {
              if (r.category === cat) {
                r.category = '미분류';
                r.subCategory = '미분류';
                checkFixedCategory(r); // 업데이트된 카테고리에 맞춰 고정비 여부 재확인
              }
            });
            saveData();
          }

          saveMasterCategories();
          populateFilterDropdowns();
          renderTable();
          renderManageMainCategories();
          renderManageSubCategories();
          renderKPIs();
          showToast(`대분류 '${cat}'가 삭제되었습니다.`);
        }
      }
      
      // Edit Main Category
      if (e.target.closest('.btn-edit-main-cat')) {
        e.stopPropagation();
        const oldCat = e.target.closest('.btn-edit-main-cat').dataset.cat;
        const newCat = prompt(`'${oldCat}' 대분류의 새 이름을 입력하세요:`, oldCat);
        if (newCat && newCat.trim() !== '' && newCat !== oldCat) {
          const trimmedCat = newCat.trim();
          if (appState.masterCategories[trimmedCat]) {
            alert('이미 존재하는 대분류 이름입니다.');
            return;
          }
          // Update masterCategories
          appState.masterCategories[trimmedCat] = appState.masterCategories[oldCat];
          delete appState.masterCategories[oldCat];
          
          if (appState.activeManageMainCat === oldCat) {
            appState.activeManageMainCat = trimmedCat;
          }
          
          // Update all records
          appState.records.forEach(r => {
            if (r.category === oldCat) {
              r.category = trimmedCat;
            }
          });
          
          // Update all rules
          appState.categoryRules.forEach(rule => {
            if (rule.category === oldCat) {
              rule.category = trimmedCat;
            }
          });
          
          saveMasterCategories();
          saveData();
          saveRules();
          populateFilterDropdowns();
          renderTable();
          renderManageMainCategories();
          renderManageSubCategories();
          showToast(`대분류가 '${oldCat}'에서 '${trimmedCat}'(으)로 변경되었습니다.`, 'success');
        }
      }
    });

    document.getElementById('subCategoryList')?.addEventListener('click', e => {
      // Delete Sub Category
      if (e.target.closest('.btn-delete-sub-cat')) {
        const sub = e.target.closest('.btn-delete-sub-cat').dataset.sub;
        const mainCat = appState.activeManageMainCat;
        
        const isUsed = appState.records.some(r => r.category === mainCat && r.subCategory === sub);
        let confirmMsg = `소분류 '${sub}'를 삭제하시겠습니까?`;
        if (isUsed) {
          confirmMsg = `소분류 '${sub}'를 사용 중인 내역이 있습니다. 삭제 시 해당 내역들의 소분류는 모두 '미분류'로 자동 변경됩니다. 계속하시겠습니까?`;
        }
        
        if (mainCat && appState.masterCategories[mainCat]) {
          if (!confirm(confirmMsg)) return;
          appState.masterCategories[mainCat] = appState.masterCategories[mainCat].filter(s => s !== sub);
          
          if (isUsed) {
            appState.records.forEach(r => {
              if (r.category === mainCat && r.subCategory === sub) {
                r.subCategory = '미분류';
              }
            });
            saveData();
          }

          saveMasterCategories();
          populateFilterDropdowns();
          renderTable();
          renderManageSubCategories();
          renderKPIs();
          showToast(`소분류 '${sub}'가 삭제되었습니다.`);
        }
      }
      
      // Edit Sub Category
      if (e.target.closest('.btn-edit-sub-cat')) {
        const oldSub = e.target.closest('.btn-edit-sub-cat').dataset.sub;
        const mainCat = appState.activeManageMainCat;
        if (!mainCat || !appState.masterCategories[mainCat]) return;
        
        const newSub = prompt(`'${oldSub}' 소분류의 새 이름을 입력하세요:`, oldSub);
        if (newSub && newSub.trim() !== '' && newSub !== oldSub) {
          const trimmedSub = newSub.trim();
          if (appState.masterCategories[mainCat].includes(trimmedSub)) {
            alert('이미 존재하는 소분류 이름입니다.');
            return;
          }
          
          // Update masterCategories array
          const idx = appState.masterCategories[mainCat].indexOf(oldSub);
          if (idx > -1) {
            appState.masterCategories[mainCat][idx] = trimmedSub;
          }
          
          // Update all records
          appState.records.forEach(r => {
            if (r.category === mainCat && r.subCategory === oldSub) {
              r.subCategory = trimmedSub;
            }
          });
          
          // Update all rules
          appState.categoryRules.forEach(rule => {
            if (rule.category === mainCat && rule.subCategory === oldSub) {
              rule.subCategory = trimmedSub;
            }
          });
          
          saveMasterCategories();
          saveData();
          saveRules();
          populateFilterDropdowns();
          renderTable();
          renderManageSubCategories();
          showToast(`소분류가 '${oldSub}'에서 '${trimmedSub}'(으)로 변경되었습니다.`, 'success');
        }
      }
    });

    function renderManageMainCategories() {
      const container = document.getElementById('mainCategoryList');
      if (!container) return;
      container.innerHTML = '';
      const mainCats = Object.keys(appState.masterCategories);
      if (mainCats.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; padding:10px;">대분류가 없습니다.</div>';
        return;
      }
      mainCats.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'main-cat-item';
        div.dataset.cat = cat;
        div.style.padding = '10px';
        div.style.borderRadius = '4px';
        div.style.cursor = 'pointer';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.border = '1px solid transparent';
        if (appState.activeManageMainCat === cat) {
          div.style.background = 'var(--bg-input)';
          div.style.border = '1px solid var(--border-focus)';
        } else {
          div.style.background = 'transparent';
          div.addEventListener('mouseenter', () => div.style.background = 'var(--bg-surface)');
          div.addEventListener('mouseleave', () => { if(appState.activeManageMainCat !== cat) div.style.background = 'transparent'; });
        }
        
        div.innerHTML = `
          <span style="font-weight: 600; font-size: 0.95rem;">
            ${cat} 
          </span>
          <div style="display:flex; gap: 8px;">
            <button type="button" class="btn-edit-main-cat" data-cat="${cat}" style="background:none; border:none; color:var(--text-muted); cursor:pointer;" title="이름 수정">✏️</button>
            <button type="button" class="btn-delete-main-cat" data-cat="${cat}" style="background:none; border:none; color:var(--text-muted); cursor:pointer;" title="삭제">&times;</button>
          </div>
        `;
        container.appendChild(div);
      });
    }

    function renderManageSubCategories() {
      const container = document.getElementById('subCategoryList');
      const textTitle = document.getElementById('selectedMainCategoryText');
      if (!container || !textTitle) return;
      
      container.innerHTML = '';
      const mainCat = appState.activeManageMainCat;
      
      if (!mainCat) {
        textTitle.textContent = '';
        container.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; text-align:center; margin-top:20px;">대분류를 먼저 선택해주세요.</div>';
        document.getElementById('newSubCategoryName').disabled = true;
        return;
      }
      
      textTitle.textContent = `(${mainCat})`;
      document.getElementById('newSubCategoryName').disabled = false;
      
      const subCats = appState.masterCategories[mainCat] || [];
      if (subCats.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; padding:10px;">등록된 소분류가 없습니다.</div>';
        return;
      }
      
      subCats.forEach(sub => {
        const div = document.createElement('div');
        div.style.padding = '8px 12px';
        div.style.borderRadius = '4px';
        div.style.background = 'var(--bg-surface)';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        
        div.innerHTML = `
          <span style="font-size: 0.9rem;">
            ${sub} 
          </span>
          <div style="display:flex; gap: 8px;">
            <button type="button" class="btn-edit-sub-cat" data-sub="${sub}" style="background:none; border:none; color:var(--text-muted); cursor:pointer;" title="이름 수정">✏️</button>
            <button type="button" class="btn-delete-sub-cat" data-sub="${sub}" style="background:none; border:none; color:var(--text-muted); cursor:pointer;" title="삭제">&times;</button>
          </div>
        `;
        container.appendChild(div);
      });
    }

    // --- Card Manage Modal ---
    document.getElementById('btnManageCards')?.addEventListener('click', () => {
      renderManageCards();
      document.getElementById('cardManageModal')?.classList.add('show');
    });

    document.getElementById('btnCloseCardManageModal')?.addEventListener('click', () => {
      document.getElementById('cardManageModal')?.classList.remove('show');
    });

    document.getElementById('btnCleanupCategories')?.addEventListener('click', () => {
      if (!confirm('현재 가계부 내역에 한 번도 쓰이지 않은 (미사용) 카테고리들을 모두 정리하시겠습니까?\n※ 기본 필수 카테고리는 삭제되지 않습니다.')) return;
      
      const usedMains = new Set();
      const usedSubs = new Set();
      
      appState.records.forEach(r => {
        if (r.category) usedMains.add(r.category);
        if (r.category && r.subCategory) {
          usedSubs.add(`${r.category}|${r.subCategory}`);
        }
      });
      
      let removedMainCount = 0;
      let removedSubCount = 0;
      
      Object.keys(appState.masterCategories).forEach(cat => {
        // 소분류 정리
        const originalSubs = [...appState.masterCategories[cat]];
        const newSubs = originalSubs.filter(sub => {
          const isUsed = usedSubs.has(`${cat}|${sub}`);
          const isDefault = DEFAULT_MASTER_CATEGORIES[cat] && DEFAULT_MASTER_CATEGORIES[cat].includes(sub);
          if (!isUsed && !isDefault) {
            removedSubCount++;
            return false; // 안 쓰고 기본도 아니면 삭제
          }
          return true;
        });
        
        appState.masterCategories[cat] = newSubs;
        
        // 대분류 정리
        const isUsedCat = usedMains.has(cat);
        const isDefaultCat = !!DEFAULT_MASTER_CATEGORIES[cat];
        
        if (!isUsedCat && !isDefaultCat && appState.masterCategories[cat].length === 0) {
          delete appState.masterCategories[cat];
          removedMainCount++;
        }
      });
      
      if (removedMainCount > 0 || removedSubCount > 0) {
        saveMasterCategories();
        renderManageMainCategories();
        renderManageSubCategories();
        populateFilterDropdowns();
        renderAll();
        alert(`청소 완료! 🧹\n대분류 ${removedMainCount}개, 소분류 ${removedSubCount}개가 삭제되었습니다.`);
      } else {
        alert('삭제할 미사용 카테고리가 없습니다. 모두 잘 사용 중이시네요! 👍');
      }
    });
    
    document.getElementById('btnDoneCardManageModal')?.addEventListener('click', () => {
      document.getElementById('cardManageModal')?.classList.remove('show');
    });

    document.getElementById('newCardForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const cardName = document.getElementById('newCardName').value.trim();
      const cardType = document.getElementById('newCardType').value;
      if (!cardName) return;

      if (CARD_CONFIG[cardName]) {
        alert('이미 존재하는 결제수단입니다.');
        return;
      }

      const color = CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)];
      CARD_CONFIG[cardName] = { 
        color: color, 
        chip: color, 
        dot: color,
        target: 300000, 
        type: cardType 
      };

      saveCards();
      document.getElementById('newCardName').value = '';
      renderManageCards();
      populateFilterDropdowns();
      renderAll();
      showToast(`'${cardName}' 결제수단이 추가되었습니다.`, 'success');
    });

    function renderManageCards() {
      const tbody = document.getElementById('cardsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      
      const cardNames = Object.keys(CARD_CONFIG);
      cardNames.forEach(card => {
        const tr = document.createElement('tr');
        const conf = CARD_CONFIG[card];
        const typeStr = conf.type === 'physical' ? '실물 카드' : '간편결제/기타';
        
        const targetVal = conf.target || 0;
        const displayVal = targetVal > 0 ? targetVal.toLocaleString('ko-KR') : '';
        tr.innerHTML = `
          <td style="padding: 12px; white-space: nowrap; font-size: 1.15rem;"><strong>${card}</strong></td>
          <td style="padding: 12px; text-align: center; white-space: nowrap;"><span class="kpi-badge ${conf.type === 'physical' ? 'positive' : 'neutral'}" style="white-space: nowrap; font-size: 1rem; padding: 6px 12px;">${typeStr}</span></td>
          <td style="padding: 12px; text-align: center; white-space: nowrap;">
            <input type="text" class="input-card-target" data-card="${card}" value="${displayVal}" placeholder="목표 없음" style="width: 140px; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); text-align: right; font-size: 1.05rem; font-weight: bold;">
          </td>
          <td style="padding: 12px; text-align: center; white-space: nowrap;">
            <button type="button" class="btn-delete-card" data-card="${card}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size: 1.3rem;" title="삭제">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('.input-card-target').forEach(input => {
        input.addEventListener('focus', (e) => {
          e.target.value = e.target.value.replace(/,/g, '');
        });
        
        input.addEventListener('blur', (e) => {
          const card = e.target.dataset.card;
          const rawVal = e.target.value.replace(/,/g, '');
          const val = Number(rawVal) || 0;
          
          if (val > 0) {
            e.target.value = val.toLocaleString('ko-KR');
          } else {
            e.target.value = '';
          }
          
          if (CARD_CONFIG[card] && CARD_CONFIG[card].target !== val) {
            CARD_CONFIG[card].target = val;
            saveCards();
            renderAll();
            showToast(`'${card}' 실적 목표가 ${formatCurrency(val)}원으로 설정되었습니다.`, 'success');
          }
        });
        
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.target.blur();
          }
        });
      });

      tbody.querySelectorAll('.btn-delete-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const card = e.target.closest('.btn-delete-card').dataset.card;
          
          const totalAmount = appState.records.filter(r => r.actualCard === card && r.exclude !== 'Y').reduce((sum, r) => sum + r.amount, 0);
          if (totalAmount > 0) {
            alert(`'${card}' 결제수단은 지출 내역(총 ${totalAmount.toLocaleString()}원)이 존재하여 삭제할 수 없습니다.\n(0원인 경우에만 삭제 가능)`);
            return;
          }
          
          if (confirm(`'${card}' 결제수단을 삭제하시겠습니까?`)) {
            delete CARD_CONFIG[card];
            saveCards();
            renderManageCards();
            populateFilterDropdowns();
            renderAll();
            showToast(`'${card}' 결제수단이 삭제되었습니다.`);
          }
        });
      });
    }

    // Excel File Upload
    document.getElementById('excelFileInput')?.addEventListener('change', handleExcelUpload);

    // Excel Upload Mode Modal Handlers
    document.getElementById('btnUploadAppend')?.addEventListener('click', () => applyExcelData(true));
    document.getElementById('btnUploadOverwrite')?.addEventListener('click', () => applyExcelData(false));
    document.getElementById('btnCloseUploadModal')?.addEventListener('click', () => {
      document.getElementById('excelModeModal')?.classList.remove('show');
      pendingUploadedRecords = [];
    });
    document.getElementById('btnCancelUploadModal')?.addEventListener('click', () => {
      document.getElementById('excelModeModal')?.classList.remove('show');
      pendingUploadedRecords = [];
    });
    
    // Recycle Bin Modal Handlers
    const recycleBinModal = document.getElementById('recycleBinModal');
    document.getElementById('btnRecycleBin')?.addEventListener('click', () => {
      renderRecycleBin();
      recycleBinModal.classList.add('show');
    });
    document.getElementById('btnCloseRecycleBin')?.addEventListener('click', () => recycleBinModal.classList.remove('show'));
    document.getElementById('btnDoneRecycleBin')?.addEventListener('click', () => recycleBinModal.classList.remove('show'));
    
    document.getElementById('btnEmptyRecycleBin')?.addEventListener('click', async () => {
      if (confirm('휴지통을 완전히 비우시겠습니까? (이후 엑셀 업로드 시 모든 내역이 다시 나타납니다)')) {
        await supabase.from('deleted_signatures').delete().neq('signature', '');
        appState.deletedSignatures.clear();
        localStorage.removeItem('daily_deleted_sigs_v1');
        renderRecycleBin();
        showToast('휴지통이 비워졌습니다.', 'info');
      }
    });

    function renderRecycleBin() {
      const tbody = document.getElementById('recycleBinTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      
      if (appState.deletedSignatures.size === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--text-muted);">휴지통이 비어있습니다.</td></tr>';
        return;
      }

      Array.from(appState.deletedSignatures).forEach(sig => {
        // signature format: date|time|merchant|amount
        const parts = sig.split('|');
        const dateStr = parts[0] || '-';
        const timeStr = parts[1] || '-';
        const merchant = parts[2] || '-';
        const amount = Number(parts[3]) || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="padding: 12px;">
            <div>${dateStr}</div>
            <small style="color:var(--text-muted); font-size:0.75rem;">${timeStr}</small>
          </td>
          <td style="padding: 12px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${merchant}">
            ${merchant}
          </td>
          <td style="padding: 12px; text-align: right;">${formatCurrency(amount)}원</td>
          <td style="padding: 12px; text-align: center;">
            <button type="button" class="btn-restore-sig" data-sig="${sig}" style="background:none; border:none; cursor:pointer; font-size: 1.2rem;" title="복구하기">♻️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('.btn-restore-sig').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const sig = e.target.closest('.btn-restore-sig').dataset.sig;
          appState.deletedSignatures.delete(sig);
          localStorage.setItem('daily_deleted_sigs_v1', JSON.stringify(Array.from(appState.deletedSignatures)));
          await supabase.from('deleted_signatures').delete().eq('signature', sig);
          
          renderRecycleBin();
          showToast('복구 대기 상태로 변경되었습니다. 엑셀을 누적 추가하면 다시 등록됩니다.');
        });
      });
    }
  }

  // --- Excel Export (SheetJS) ---
  function exportToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('엑셀 라이브러리가 로드되지 않았습니다.');
      return;
    }

    // 1. Transaction Sheet
    const txHeaders = [
      'No.', '날짜', '시간', '월', '대분류', '소분류', '내용(가맹점)',
      '지출금액', '원본 결제수단', '실제 결제카드 (수정 가능)',
      '할부 개월', '이번달 청구액', '제외 여부', '메모'
    ];

    const txRows = appState.records.map(r => [
      r.id, r.date, r.time, r.month, r.category, r.subCategory, r.merchant,
      r.amount, r.origPay, r.actualCard, r.installment, r.billingAmount, r.exclude, r.memo
    ]);

    const wsTx = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows]);

    // 2. Summary Sheet
    const summaryRows = [
      ['카드별 지출 현황 및 가계부 대시보드 요약'],
      ['기준일자', new Date().toLocaleDateString('ko-KR')],
      ['총 거래건수', appState.records.length],
      [''],
      ['카드명', '지출금액 (원)', '건수', '비중(%)']
    ];

    const cardSums = {};
    const cardCounts = {};
    let totalSpent = 0;
    appState.records.forEach(r => {
      cardSums[r.actualCard] = (cardSums[r.actualCard] || 0) + r.amount;
      cardCounts[r.actualCard] = (cardCounts[r.actualCard] || 0) + 1;
      totalSpent += r.amount;
    });

    Object.keys(cardSums).sort((a, b) => cardSums[b] - cardSums[a]).forEach(c => {
      const share = totalSpent > 0 ? ((cardSums[c] / totalSpent) * 100).toFixed(1) : 0;
      summaryRows.push([c, cardSums[c], cardCounts[c], Number(share)]);
    });

    summaryRows.push(['총계 (포함 항목)', totalSpent, '']);

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, '대시보드_요약');
    XLSX.utils.book_append_sheet(wb, wsTx, '지출_카드별정리');

    const todayStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `가계부_카드별_지출정리_${todayStr}.xlsx`);
    showToast('수정된 엑셀 파일이 성공적으로 다운로드되었습니다!', 'success');
  }

  // --- Excel File Upload ---
  let pendingUploadedRecords = [];

  function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        
        let sheetName = wb.SheetNames.find(s => 
          s.includes('가계부 내역') || 
          s.includes('지출_카드별정리') || 
          s.includes('가계부') || 
          s.includes('지출') || 
          s.includes('내역')
        ) || wb.SheetNames[0];

        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rows || rows.length < 2) {
          alert(`엑셀 파일 [${sheetName}] 시트에 데이터가 없습니다.`);
          return;
        }

        // Find header row in top 10 rows
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const rowStr = (rows[i] || []).join(' ');
          if (['날짜', '금액', '내용', '가맹점', '결제수단', '분류', '거래일시'].some(k => rowStr.includes(k))) {
            headerRowIdx = i;
            break;
          }
        }

        const headerRow = rows[headerRowIdx] || [];
        const findCol = (keywords, defaultIdx) => {
          for (let i = 0; i < headerRow.length; i++) {
            const h = String(headerRow[i] || '').replace(/\s+/g, '');
            if (keywords.some(k => h.includes(k))) return i;
          }
          return defaultIdx;
        };

        const col = {
          date: findCol(['날짜', '거래일시', '일시'], 0),
          time: findCol(['시간'], 1),
          type: findCol(['타입', '구분', '수입/지출'], 2),
          cat: findCol(['대분류', '분류', '카테고리'], 3),
          sub: findCol(['소분류', '하위카테고리'], 4),
          merchant: findCol(['내용', '가맹점', '거래처'], 5),
          amt: findCol(['금액', '지출금액', '원화금액'], 6),
          pay: findCol(['결제수단', '원본결제수단'], 8),
          memo: findCol(['메모', '비고'], 9)
        };

        const parsedList = [];
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;
          if (row[0] === '총 합 계' || row[0] === '합계') continue;

          // If type column exists, ignore '수입' (Income) but include '지출', '할부', '이체', '취소'
          let t = '';
          if (col.type !== -1) {
            t = String(row[col.type] || '').trim();
            if (t && t.includes('수입')) {
              continue;
            }
          }

          const rawAmt = row[col.amt];
          if (rawAmt === undefined || rawAmt === null || rawAmt === '') continue;
          const numStr = String(rawAmt).replace(/[^0-9.-]/g, '');
          // 엑셀에서는 마이너스(-)가 실제 지출, 플러스(+)가 취소이므로 부호를 반대로 뒤집어서 저장합니다.
          const amount = -(Number(numStr) || 0); 
          if (amount === 0) continue;

          let dateRaw = row[col.date];
          let timeRaw = row[col.time];
          let dateStr = "";
          let timeStr = "00:00:00";

          // Parse Date
          if (typeof dateRaw === "number") {
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const parsed = new Date(excelEpoch.getTime() + dateRaw * 86400000);
            dateStr = parsed.toISOString().split("T")[0];
          } else {
            dateStr = String(dateRaw || "").trim();
            if (dateStr.length > 10 && dateStr.includes(" ")) {
              const parts = dateStr.split(" ");
              dateStr = parts[0];
              if (!timeRaw) timeRaw = parts[1];
            }
            dateStr = dateStr.slice(0, 10).replace(/\./g, "-");
          }

          // Parse Time
          if (typeof timeRaw === "number") {
            const totalSeconds = Math.round(timeRaw * 86400);
            const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
            const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
            const s = String(totalSeconds % 60).padStart(2, "0");
            timeStr = `${h}:${m}:${s}`;
          } else {
            timeStr = String(timeRaw || "00:00:00").trim();
            if (timeStr.length === 5) timeStr += ":00";
          }

          const origPay = String(row[col.pay] || '기타 카드').trim();
          let actualCard = origPay;
          
          const rawMerchant = String(row[col.merchant] || '').trim();
          const memoRaw = String(row[col.memo] || '').trim();
          let instVal = '일시불';
          
          const combo = t + ' ' + rawMerchant + ' ' + memoRaw;
          if (combo.includes('할부')) {
            const m = combo.match(/(\d+)\s*개월/);
            if (m) {
              instVal = `${m[1]}개월`;
              if (!['2개월', '3개월', '4개월', '5개월', '6개월', '12개월'].includes(instVal)) {
                 instVal = '일시불'; // Fallback if unsupported option
              }
            } else {
              instVal = '3개월'; // Default fallback if just '할부' is found
            }
          }

          parsedList.push({
            id: Date.now() + r,
            origId: r,
            date: dateStr,
            time: timeStr,
            month: (dateStr.split('-')[1] ? parseInt(dateStr.split('-')[1]) + '월' : '9월'),
            category: String(row[col.cat] || '기타').trim(),
            subCategory: String(row[col.sub] || '').trim(),
            merchant: rawMerchant,
            amount: amount,
            origPay: origPay,
            actualCard: actualCard,
            installment: instVal,
            billingAmount: amount,
            exclude: 'N',
            memo: memoRaw,
            originalSignature: `${dateStr}|${timeStr}|${rawMerchant}|${amount}`
          });
        }

        if (parsedList.length === 0) {
          alert(`[${sheetName}] 시트에서 유효한 '지출' 내역을 찾을 수 없습니다.`);
          return;
        }

        applyCategoryRules(parsedList);
        pendingUploadedRecords = parsedList;

        const modal = document.getElementById('excelModeModal');
        if (modal) {
          // 결제수단 목록 동적 생성 (사용자 엑셀 원본 데이터 기준)
          const uniquePayments = [...new Set(parsedList.map(r => r.actualCard))].filter(Boolean);
          const container = document.getElementById('paymentCheckboxContainer');
          if (container) {
            const cards = uniquePayments.filter(p => p.includes('카드'));
            const others = uniquePayments.filter(p => !p.includes('카드'));

            // 저장된 체크 상태 불러오기
            const savedStr = localStorage.getItem('savedPaymentSelections');
            const savedSelections = savedStr ? JSON.parse(savedStr) : {};

            const isChecked = (pay) => {
              if (savedSelections[pay] !== undefined) return savedSelections[pay];
              return true; // 기본적으로 처음 등장한 수단은 체크됨
            };

            let html = `
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; width: 100%; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 8px;">
                <input type="checkbox" id="chkAllPayments" checked> <strong style="font-size: 0.95rem;">전체 선택</strong>
              </label>
              <div style="display: flex; width: 100%; margin-top: 8px;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; border-right: 2px solid #cbd5e1; padding-right: 16px;">
                  <strong style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">💳 카드 결제</strong>
                  ${cards.map(pay => `
                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 0.85rem;">
                      <input type="checkbox" class="chk-payment" value="${pay}" ${isChecked(pay) ? 'checked' : ''}> ${pay}
                    </label>
                  `).join('')}
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; padding-left: 16px;">
                  <strong style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">📱 간편결제 및 기타</strong>
                  ${others.map(pay => `
                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 0.85rem;">
                      <input type="checkbox" class="chk-payment" value="${pay}" ${isChecked(pay) ? 'checked' : ''}> ${pay}
                    </label>
                  `).join('')}
                </div>
              </div>
            `;
            container.innerHTML = html;

            // 전체 선택 이벤트 연결
            const chkAll = document.getElementById('chkAllPayments');

            const updateChkAllState = () => {
              const allChecked = Array.from(container.querySelectorAll('.chk-payment')).every(c => c.checked);
              chkAll.checked = allChecked;
            };
            updateChkAllState();

            chkAll.addEventListener('change', (e) => {
              const checkboxes = container.querySelectorAll('.chk-payment');
              checkboxes.forEach(cb => cb.checked = e.target.checked);
            });
            // 개별 선택 이벤트 연결 (하나라도 꺼지면 전체선택 해제)
            container.querySelectorAll('.chk-payment').forEach(cb => {
              cb.addEventListener('change', updateChkAllState);
            });
          }

          modal.classList.add('show');
        } else {
          if (confirm(`새로운 지출 ${parsedList.length}건을 기존 가계부에 [누적 추가]하시겠습니까?\n(취소 시 전체 새로고침)`)) {
            applyExcelData(true);
          } else {
            applyExcelData(false);
          }
        }

      } catch (err) {
        console.error(err);
        alert('엑셀 파일을 파싱하는 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }

  async function applyExcelData(isAppend) {
    try {
      if (!pendingUploadedRecords || pendingUploadedRecords.length === 0) return;

      // 결제수단 필터 적용 및 체크 상태 저장
    const container = document.getElementById('paymentCheckboxContainer');
    if (container) {
      const checkboxes = container.querySelectorAll('.chk-payment');
      const selectedMethods = [];
      const savedSelections = {};
      checkboxes.forEach(cb => {
        savedSelections[cb.value] = cb.checked;
        if (cb.checked) selectedMethods.push(cb.value);
      });
      localStorage.setItem('savedPaymentSelections', JSON.stringify(savedSelections));
      
      // 결제수단 필터 및 휴지통에 버린 내역 제외
      pendingUploadedRecords = pendingUploadedRecords.filter(r => 
        selectedMethods.includes(r.actualCard) && !appState.deletedSignatures.has(getSignature(r))
      );

      if (pendingUploadedRecords.length === 0) {
        alert("선택된 결제수단에 해당하거나 새로 추가할 지출 내역이 없습니다.");
        document.getElementById('excelModeModal')?.classList.remove('show');
        return;
      }
    }

    let addedCount = 0;
    let dupCount = 0;

    if (isAppend) {
      const existingSigs = new Set(appState.records.map(r => getSignature(r)));
      pendingUploadedRecords.forEach(newRec => {
        const sig = getSignature(newRec);
        if (!existingSigs.has(sig)) {
          existingSigs.add(sig);
          checkFixedCategory(newRec);
          appState.records.push(newRec);
          addedCount++;
        } else {
          dupCount++;
        }
      });
    } else {
      pendingUploadedRecords.forEach(r => checkFixedCategory(r));
      await supabase.from('records').delete().neq('id', 0);
      appState.records = [...pendingUploadedRecords];
      autoFlagInstallments();
      addedCount = pendingUploadedRecords.length;
    }

    // --- 마이너스 금액 헷징(상계) 처리 ---
    let toRemove = new Set();
    let negatives = appState.records.filter(r => r.amount < 0);
    let hedgeCount = 0;

    negatives.forEach(neg => {
      // 동일 가맹점, 동일 절대값 금액을 가진 양수 결제 내역 찾기 (이미 제거 대상이 아닌 것만)
      const posIndex = appState.records.findIndex(r => 
        !toRemove.has(r) && 
        r !== neg && 
        r.amount === Math.abs(neg.amount) && 
        r.merchant.trim() === neg.merchant.trim()
      );
      
      if (posIndex !== -1) {
        const posRec = appState.records[posIndex];
        toRemove.add(neg);
        toRemove.add(posRec);
        
        // 상계된 내역도 휴지통(블랙리스트)에 추가하여 이후 중복 업로드 방지 및 내역 투명성 제공
        const negSig = getSignature(neg);
        const posSig = getSignature(posRec);
        appState.deletedSignatures.add(negSig);
        appState.deletedSignatures.add(posSig);
        supabase.from('deleted_signatures').insert([{ signature: negSig }, { signature: posSig }]); // background

        hedgeCount++;
      }
    });
    
    if (toRemove.size > 0) {
      appState.records = appState.records.filter(r => !toRemove.has(r));
    }

    // 날짜/시간 정렬
    appState.records.sort((a, b) => {
      const dComp = a.date.localeCompare(b.date);
      if (dComp !== 0) return dComp;
      return (a.time || '').localeCompare(b.time || '');
    });

    // ID 재부여
    appState.records.forEach((r, idx) => {
      r.id = idx + 1;
      r.origId = idx + 1;
    });

    // --- 자동 카테고리 등록 ---
    let newCategoryAdded = false;
    appState.records.forEach(r => {
      const cat = r.category;
      const sub = r.subCategory;
      if (cat && cat !== '기타') {
        if (!appState.masterCategories[cat]) {
          appState.masterCategories[cat] = [];
          newCategoryAdded = true;
        }
        if (sub && !appState.masterCategories[cat].includes(sub)) {
          appState.masterCategories[cat].push(sub);
          newCategoryAdded = true;
        }
      }
    });
    if (newCategoryAdded) {
      saveMasterCategories();
    }

    saveData();
    populateFilterDropdowns();
    renderAll();
    
    if (isAppend) {
      let msg = `신규 지출 ${addedCount}건 추가! (중복 ${dupCount}건 제외)`;
      if (hedgeCount > 0) msg += `\n결제 취소 ${hedgeCount}쌍(마이너스/플러스) 상계(제거)됨`;
      showToast(msg, 'success');
      
      if (addedCount > 0) {
        showUploadSummaryModal(pendingUploadedRecords.filter(r => appState.records.includes(r)));
      }
    } else {
      let msg = `총 ${appState.records.length}건으로 전체 새로고침되었습니다!`;
      if (hedgeCount > 0) msg += `\n(결제 취소 ${hedgeCount}쌍 상계 처리됨)`;
      showToast(msg, 'success');
      
      showUploadSummaryModal(appState.records);
    }

      pendingUploadedRecords = [];
      const modal = document.getElementById('excelModeModal');
      if (modal) modal.classList.remove('show');
    } catch (err) {
      console.error(err);
      alert('엑셀 데이터 적용 중 오류가 발생했습니다: ' + (err.message || err));
    }
  }

  function showUploadSummaryModal(newRecords) {
    let box = document.getElementById('uploadSummaryBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'uploadSummaryBox';
      box.style.position = 'fixed';
      box.style.top = '50%'; box.style.left = '50%'; box.style.transform = 'translate(-50%, -50%)';
      box.style.backgroundColor = 'var(--bg-surface)'; box.style.padding = '24px'; box.style.borderRadius = '12px';
      box.style.boxShadow = '0 10px 40px rgba(0,0,0,0.8)'; box.style.zIndex = '999999';
      box.style.border = '1px solid var(--border-color)'; box.style.color = 'var(--text-main)';
      box.style.width = '90%'; box.style.maxWidth = '500px'; box.style.maxHeight = '80vh';
      box.style.display = 'flex'; box.style.flexDirection = 'column';
      document.body.appendChild(box);
    }
    
    // Sort newly added records chronologically for display
    const sortedNew = [...newRecords].sort((a,b) => {
      const dComp = a.date.localeCompare(b.date);
      if (dComp !== 0) return dComp;
      return (a.time || '').localeCompare(b.time || '');
    });

    const msg = sortedNew.map(r => `<li style='margin-bottom:8px; padding-bottom:8px; border-bottom: 1px solid var(--border-color);'>
      <div style='font-size:0.8rem; color:var(--text-muted);'>${r.date} ${r.time} | ${r.actualCard}</div>
      <div style='display:flex; justify-content:space-between; margin-top:4px;'>
        <b>${r.merchant}</b> 
        <span style='color:var(--danger); font-weight:bold;'>${formatCurrency(r.amount)}원</span>
      </div>
    </li>`).join('');

    box.innerHTML = `
      <h3 style='margin-top:0; color:var(--text-main); border-bottom:2px solid var(--primary-color); padding-bottom:12px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center;'>
        🎉 방금 추가된 내역 (${newRecords.length}건)
        <span style='font-size: 1rem; cursor: pointer;' onclick='document.getElementById("uploadSummaryBox").style.display="none"'>&times;</span>
      </h3>
      <ul style='padding: 0; margin: 0; list-style: none; overflow-y: auto; flex: 1;'>${msg}</ul>
      <button onclick='document.getElementById("uploadSummaryBox").style.display="none"' class='btn btn-primary' style='margin-top: 20px; width: 100%; padding: 12px; font-size: 1.05rem;'>확인 완료</button>
    `;
    box.style.display = 'flex';
  }

  let isAppInitialized = false;

  async function initAuthAndLockScreen() {
    const lockScreen = document.getElementById('lockScreen');
    const btnLockGoogleLogin = document.getElementById('btnLockGoogleLogin');
    const appLayout = document.querySelector('.app-layout');

    if (btnLockGoogleLogin) {
      btnLockGoogleLogin.addEventListener('click', handleGoogleLogin);
    }

    if (lockScreen) {
      lockScreen.classList.remove('active');
      lockScreen.style.display = 'none';
    }
    if (appLayout) {
      appLayout.style.display = 'flex';
    }

    if (!isAppInitialized) {
      isAppInitialized = true;
      init();
    }
  }

    initAuthAndLockScreen();

})();
