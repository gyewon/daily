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
    '우리카드_코웨이': { color: '#0284c7', chip: '#0369a1', dot: '#0284c7', target: 300000, type: 'physical' },
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
    '상상모바일통장': { color: '#475569', dot: '#94a3b8', type: 'pay' },
    '현금': { color: '#10b981', dot: '#059669', type: 'cash' }
  };

  // 순수 간편결제(카카오페이, 네이버페이, 페이코, 토스 등) 판별 함수 (현금, 실물카드, 통장/계좌 지출 제외)
  function isSimplePay(cardName) {
    if (!cardName) return false;
    if (cardName === '현금') return false;
    const conf = CARD_CONFIG[cardName];
    if (conf) {
      if (conf.type === 'physical' || conf.type === 'cash') return false;
      // 통장, 계좌, 입출금, SOL LINK 등은 카드 매핑 대상이 아닌 계좌 지출
      if (/통장|계좌|입출금|예금|SOL\s*LINK/i.test(cardName)) return false;
      if (conf.type === 'pay') return true;
    }
    if (/통장|계좌|입출금|예금|SOL\s*LINK/i.test(cardName)) return false;
    if (/페이|pay|토스|머니|간편결제/i.test(cardName)) return true;
    return false;
  }

  const CATEGORY_COLORS = [
    '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899',
    '#8b5cf6', '#3b82f6', '#14b8a6', '#f97316', '#a855f7',
    '#64748b', '#84cc16', '#eab308', '#0284c7', '#d946ef'
  ];

  // --- State ---
  let appState = {
    chartExcludedCategories: new Set(),
    records: [],
    categoryRules: [],
    masterCategories: {},
    deletedSignatures: new Set(),
    notificationLogs: [], // newly added for logs
    customTypes: { "고정비": ["고정비"] },
    activeManageMainCat: null,
    searchQuery: '',
    filterCard: 'ALL',
    filterCategory: 'ALL',
    filterType: 'ALL',
    filterExclude: 'ALL', // 'ALL' | 'N' | 'Y'
    filterInstallment: 'ALL',
     // 'ALL' | '일시불' | '할부'
    globalMonth: `${new Date().getMonth() + 1}월`,
    sortBy: 'id',
    sortOrder: 'asc',
    currentPage: 1,
    pageSize: 30,
    activeChartTab: 'categories',
    chartSettleMode: 'net'
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
    saveNotificationLogs();
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

  function saveUIState() {
    try {
      localStorage.setItem('gyewon_ui_state_v1', JSON.stringify({
        filterCard: appState.filterCard,
        filterCategory: appState.filterCategory,
        filterType: appState.filterType,
        filterExclude: appState.filterExclude,
        filterInstallment: appState.filterInstallment,
        globalMonth: appState.globalMonth,
        sortBy: appState.sortBy,
        sortOrder: appState.sortOrder,
        currentPage: appState.currentPage,
        pageSize: appState.pageSize,
        activeChartTab: appState.activeChartTab,
        chartSettleMode: appState.chartSettleMode,
        installmentSort: appState.installmentSort
      }));
    } catch(e) {}
  }

  function loadUIState() {
    try {
      const state = localStorage.getItem('gyewon_ui_state_v1');
      if (state) {
        const parsed = JSON.parse(state);
        Object.assign(appState, parsed);
        if (parsed.chartSettleMode) appState.chartSettleMode = parsed.chartSettleMode;
        if (parsed.activeChartTab) appState.activeChartTab = parsed.activeChartTab;
        if (parsed.installmentSort) appState.installmentSort = parsed.installmentSort;
        
        // 새로고침 시 페이지네이션은 유지하되 필터는 모두 해제
        appState.filterCard = 'ALL';
        appState.filterCategory = 'ALL';
        appState.filterType = 'ALL';
        appState.filterExclude = 'ALL';
        appState.filterInstallment = 'ALL';
      }
    } catch(e) {}
  }

  function syncDOMFilters() {
    const ids = ['filterCard', 'filterCategory', 'filterType', 'filterExclude', 'filterInstallment'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const targetVal = appState[id] || 'ALL';
        if (targetVal !== 'ALL' && !Array.from(el.options).some(o => o.value === targetVal)) {
          const opt = document.createElement('option');
          opt.value = targetVal;
          opt.textContent = targetVal;
          el.appendChild(opt);
        }
        el.value = targetVal;
        Array.from(el.options).forEach(opt => {
          opt.selected = (opt.value === targetVal);
        });
      }
    });
    const pSize = document.getElementById('pageSizeSelect');
    if (pSize) pSize.value = appState.pageSize;

    // Chart tab DOM sync
    const activeTab = appState.activeChartTab || 'categories';
    document.querySelectorAll('.chart-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.chartTab === activeTab);
    });
    document.querySelectorAll('.chart-view').forEach(v => v.classList.remove('active'));
    if (activeTab === 'cards') document.getElementById('chartViewCards')?.classList.add('active');
    else if (activeTab === 'categories') document.getElementById('chartViewCategories')?.classList.add('active');
    else if (activeTab === 'trends') document.getElementById('chartViewTrends')?.classList.add('active');
    else if (activeTab === 'daily') document.getElementById('chartViewDaily')?.classList.add('active');
    else if (activeTab === 'settlements') document.getElementById('chartViewSettlements')?.classList.add('active');
  }

  function loadLocalCache() {
    try {
      const cache = localStorage.getItem('gyewon_appState_cache');
      if (cache) {
        const parsed = JSON.parse(cache);
        // 캐시는 화면 즉시 표시(0ms) 및 오프라인 보호용으로 안전하게 로드 (임의 폐기 금지)
        // 이후 loadData()가 Supabase에서 최신 데이터를 가져와 안전하게 화면과 캐시를 갱신함
        if (parsed.records && Array.isArray(parsed.records) && parsed.records.length > 0) {
          appState.records = parsed.records;
        }
        if (parsed.categoryRules) appState.categoryRules = parsed.categoryRules;
        if (parsed.customTypes) appState.customTypes = parsed.customTypes;
        if (parsed.masterCategories) appState.masterCategories = parsed.masterCategories;
        if (parsed.deletedSignatures) appState.deletedSignatures = new Set(parsed.deletedSignatures);
        if (parsed.notificationLogs) appState.notificationLogs = parsed.notificationLogs;
        if (parsed.cardConfig) CARD_CONFIG = parsed.cardConfig;
        if (parsed.chartExcludedCategories) appState.chartExcludedCategories = new Set(parsed.chartExcludedCategories);
        return true;
      }
    } catch (e) { console.error('Local cache load failed', e); }
    return false;
  }

  function saveLocalCache() {
    try {
      localStorage.setItem('gyewon_appState_cache', JSON.stringify({
        records: appState.records,
        categoryRules: appState.categoryRules,
        customTypes: appState.customTypes,
        masterCategories: appState.masterCategories,
        deletedSignatures: Array.from(appState.deletedSignatures),
        notificationLogs: appState.notificationLogs,
        cardConfig: CARD_CONFIG,
        chartExcludedCategories: Array.from(appState.chartExcludedCategories)
      }));
    } catch (e) { console.error('Local cache save failed', e); }
  }

  async function init() {
    initTheme();
    loadUIState();
    const hasCache = loadLocalCache();
    
    if (hasCache) {
      populateFilterDropdowns();
      syncDOMFilters();
      if (typeof renderTypeFilter === 'function') renderTypeFilter();
      attachEventListeners();
      renderAll();
      
      // Background sync
      loadData().then(() => {
        saveLocalCache();
        populateFilterDropdowns();
        syncDOMFilters();
        if (typeof renderTypeFilter === 'function') renderTypeFilter();
        renderAll();
      });
    } else {
      await loadData();
      saveLocalCache();
      populateFilterDropdowns();
      syncDOMFilters();
      if (typeof renderTypeFilter === 'function') renderTypeFilter();
      attachEventListeners();
      renderAll();
    }
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
          if (s.key === 'custom_types') {
            appState.customTypes = s.value || { "고정비": [], "리뷰비": [] };
            if (!appState.customTypes['리뷰비']) appState.customTypes['리뷰비'] = [];
          }
          if (s.key === 'master_categories') appState.masterCategories = s.value;
          
          if (s.key === 'deleted_signatures') appState.deletedSignatures = new Set(s.value);
          if (s.key === 'notification_logs') appState.notificationLogs = s.value;
          if (s.key === 'card_config') CARD_CONFIG = s.value;
          if (s.key === 'records') {
            if (Array.isArray(s.value) && s.value.length > 0) {
              appState.records = s.value;
            }
          }
        });
      }

      // Ensure "현금" is always in CARD_CONFIG with 'cash' type
      if (!CARD_CONFIG['현금']) {
        CARD_CONFIG['현금'] = { color: '#10b981', dot: '#059669', type: 'cash' };
      } else {
        CARD_CONFIG['현금'].type = 'cash';
      }

      if (Object.keys(appState.masterCategories).length === 0) {
        appState.masterCategories = JSON.parse(JSON.stringify(DEFAULT_MASTER_CATEGORIES));
      }

      if (!appState.records || appState.records.length === 0) {
        const { data: records, error: recErr } = await supabase.from('records').select('*').order('id', { ascending: true });
        if (records && records.length > 0) {
          appState.records = records;
        }
      }
      
      if (appState.records && appState.records.length > 0) {
        let changed = autoFlagInstallments();
        appState.records.forEach(r => {
          if (r.date && r.date.includes('-')) {
            const mNum = parseInt(r.date.split('-')[1], 10);
            if (!isNaN(mNum)) {
              r.month = `${mNum}월`;
            }
          }
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
        console.warn("Using fallback INITIAL_DATA without overwriting Supabase");
        appState.records = JSON.parse(JSON.stringify(window.INITIAL_DATA.records));
      }
    }
  }

    async function saveDeletedSignatures() {
    await supabase.from('app_settings').upsert({ key: 'deleted_signatures', value: Array.from(appState.deletedSignatures) });
  }

  
  async function saveNotificationLogs() {
    saveLocalCache();
    try {
      await supabase.from('app_settings').upsert({ key: 'notification_logs', value: appState.notificationLogs });
    } catch (e) {
      console.error('Failed to save notification logs:', e);
    }
  }

  async function saveCardConfig() {
    await supabase.from('app_settings').upsert({ key: 'card_config', value: CARD_CONFIG });
  }

  async function saveData() {
    saveLocalCache();
    try {
      await supabase.from('app_settings').upsert([
        { key: 'records', value: appState.records },
        { key: 'deleted_signatures', value: Array.from(appState.deletedSignatures) },
        { key: 'notification_logs', value: appState.notificationLogs }
      ]);
    } catch (e) {
      console.error('Failed to save to Supabase:', e);
    }
  }

  async function saveRules() {
    saveLocalCache();
    try {
      await supabase.from('app_settings').upsert({ key: 'rules', value: appState.categoryRules });
    } catch (e) {
      console.error('Failed to save rules to Supabase:', e);
    }
  }

  async function saveCustomTypes() {
    saveLocalCache();
    try {
      await supabase.from('app_settings').upsert({ key: 'custom_types', value: appState.customTypes });
    } catch (e) {
      console.error('Failed to save custom types to Supabase:', e);
    }
  }

  

  async function saveMasterCategories() {
    saveLocalCache();
    await supabase.from('app_settings').upsert({ key: 'master_categories', value: appState.masterCategories });
  }

  
  
  function autoFlagInstallments() {
    let changed = false;
    
    // 1. 메모에 할부 키워드, 회차 형식(\d+/\d+), 개월 수, 또는 installment 필드가 일시불이 아닌 경우 플래그 활성화 (정산 메모 제외)
    appState.records.forEach(r => {
      if (r.manualInst === 'N') return; // 사용자가 직접 일시불(N)로 설정한 내역은 자동 플래그 제외
      const memo = r.memo || '';
      if (memo.includes('정산') || memo.includes('더치페이')) return;
      const hasInstPattern = memo.includes('할부') || /\d+\s*\/\s*\d+/.test(memo) || /\d+\s*개월/.test(memo) || (r.installment && r.installment !== '일시불');
      if (hasInstPattern) {
        if (r.isInstallment !== 'Y') {
          r.isInstallment = 'Y';
          changed = true;
        }
        if (!r.installment || r.installment === '일시불') {
          const m = memo.match(/\d+\s*\/\s*(\d+)/) || memo.match(/(\d+)\s*개월/);
          if (m) {
            r.installment = `${m[1]}개월`;
            changed = true;
          }
        }
      }
    });

    // 2. 가맹점 및 금액이 동일한 다회차 할부 자동 연계 (이전 달에 할부 회차 메모가 있으면 다음 달 결제 건에 자동 승계)
    const sorted = [...appState.records].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const chainMap = {}; // key: merchant + amount
    sorted.forEach(r => {
      const amt = Number(r.amount) || 0;
      if (amt <= 0 || !r.merchant) return;
      const key = `${r.merchant.trim()}_${amt}`;
      
      const memo = r.memo || '';
      const match = memo.match(/(.*?)(\d+)\s*\/\s*(\d+)(.*)/);
      if (match) {
        const curr = parseInt(match[2], 10);
        const total = parseInt(match[3], 10);
        chainMap[key] = {
          prefix: match[1],
          currentIdx: curr,
          totalIdx: total,
          suffix: match[4],
          card: r.actualCard,
          lastDate: r.date
        };
      } else if (chainMap[key] && chainMap[key].currentIdx < chainMap[key].totalIdx) {
        if (r.manualInst === 'N') return; // 사용자가 직접 일시불(N)로 설정한 내역은 자동 연계 제외
        // 이전 달에 할부 진행 중이던 내역과 가맹점/금액이 일치하고 현재 메모가 비어있거나 할부 메모이면 다음 회차 자동 부여
        const prev = chainMap[key];
        const nextIdx = prev.currentIdx + 1;
        if (r.isInstallment !== 'Y') {
          r.isInstallment = 'Y';
          changed = true;
        }
        r.installment = `${prev.totalIdx}개월`;
        const prefix = prev.prefix || '할부 (';
        const suffix = prev.suffix || ')';
        const nextMemo = `${prefix}${nextIdx}/${prev.totalIdx}${suffix}`.trim();
        if (r.memo !== nextMemo) {
          r.memo = nextMemo;
          changed = true;
        }
        // 간편결제로 매핑되어 있고 이전 할부 카드가 있으면 실물 카드도 자동 승계
        if ((!r.actualCard || r.actualCard.includes('간편결제') || r.actualCard === '미등록') && prev.card) {
          r.actualCard = prev.card;
          changed = true;
        }
        chainMap[key] = {
          ...prev,
          currentIdx: nextIdx,
          lastDate: r.date
        };
        changed = true;
      }
    });

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
        
        // If rule has a date condition, it must match the day of the month
        if (match && rule.ruleDate && rec.date) {
          // Extracts "DD" from "YYYY-MM-DD" or handles Date objects
          let recDay = 0;
          if (typeof rec.date === 'string' && rec.date.length >= 10) {
            recDay = parseInt(rec.date.substring(8, 10), 10);
          } else {
            recDay = new Date(rec.date).getDate();
          }
          match = (recDay === Number(rule.ruleDate));
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
    const payCards = Object.keys(CARD_CONFIG).filter(c => CARD_CONFIG[c].type === 'pay' && c !== '현금' && CARD_CONFIG[c].type !== 'cash');
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

    // Pay & Accounts (현금 제외)
    if (optgroupPay) {
      optgroupPay.innerHTML = '';
      payCards.forEach(pay => {
        const opt = document.createElement('option');
        opt.value = pay;
        opt.textContent = pay;
        optgroupPay.appendChild(opt);
      });
    }

    // Cash (현금 전용 독립 옵션)
    const optgroupCash = document.getElementById('optgroupCash');
    if (optgroupCash) {
      optgroupCash.innerHTML = '<option value="현금">💵 현금</option>';
    }

    // Modal Card options
    if (newActualCard) {
      newActualCard.innerHTML = '';
      const modalCards = [...allCards];
      if (!modalCards.includes('현금')) modalCards.push('현금');
      modalCards.forEach(card => {
        const opt = document.createElement('option');
        opt.value = card;
        opt.textContent = card;
        newActualCard.appendChild(opt);
      });
    }

    // Categories: merge masterCategories, records, and '미분류'
    const masterCats = Object.keys(appState.masterCategories || {});
    const recordCats = (appState.records || []).map(r => r.category).filter(Boolean);
    const categoriesSet = new Set([...masterCats, ...recordCats, '미분류']);
    const sortedCats = Array.from(categoriesSet).sort();

    if (filterCategory) {
      const currentSelected = appState.filterCategory || 'ALL';
      filterCategory.innerHTML = '<option value="ALL">모든 카테고리</option>';
      sortedCats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === currentSelected) {
          opt.selected = true;
        }
        filterCategory.appendChild(opt);
      });
      if (currentSelected !== 'ALL' && !categoriesSet.has(currentSelected)) {
        const opt = document.createElement('option');
        opt.value = currentSelected;
        opt.textContent = currentSelected;
        opt.selected = true;
        filterCategory.appendChild(opt);
      }
      filterCategory.value = currentSelected;
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
    const mainCats = Object.keys(appState.masterCategories).sort();
    
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
      [...appState.masterCategories[mainCat]].sort().forEach(sub => {
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
        // 현금, 실물 카드, 은행 계좌를 제외한 순수 간편결제만 필터링
        if (!isSimplePay(r.actualCard)) return false;
      } else if (appState.filterCard !== 'ALL') {
        if (r.actualCard !== appState.filterCard) return false;
      }

      // Category Filter (지출 상세 테이블은 차트 시각화 제외와 무관하게 항상 표시)
      if (appState.filterCategory !== 'ALL') {
        if (r.category !== appState.filterCategory) return false;
      }

      // Type Filter
      if (appState.filterType && appState.filterType !== 'ALL') {
        const typeCats = appState.customTypes[appState.filterType] || [];
        if (appState.filterType === '변동비') {
          let isCustom = r.isFixed === 'Y';
          for (const t in appState.customTypes) {
            if (appState.customTypes[t].includes(r.category) || r.category === t) isCustom = true;
          }
          if (isCustom) return false;
        } else {
          if (!typeCats.includes(r.category) && r.category !== appState.filterType && !(appState.filterType === '고정비' && r.isFixed === 'Y')) return false;
        }
      }

      // Exclude Filter
      if (appState.filterExclude !== 'ALL') {
        if (r.exclude !== appState.filterExclude) return false;
      }

      // Installment Filter
      if (appState.filterInstallment === 'N' || appState.filterInstallment === '일시불') {
        if (r.isInstallment === 'Y') return false;
      } else if (appState.filterInstallment === 'Y' || appState.filterInstallment === '할부') {
        if (r.isInstallment !== 'Y') return false;
      }

      // Search Query (merchant, memo, settleNote, settleAmount)
      if (appState.searchQuery.trim()) {
        const q = appState.searchQuery.trim().toLowerCase();
        const m = (r.merchant || '').toLowerCase();
        const memo = (r.memo || '').toLowerCase();
        const settleNote = (r.settleNote || '').toLowerCase();
        const cat = (r.category || '').toLowerCase();
        const sub = (r.subCategory || '').toLowerCase();
        const amtStr = (r.amount || '').toString();
        const settleAmtStr = (r.settleAmount || '').toString();
        if (!m.includes(q) && !memo.includes(q) && !settleNote.includes(q) && !cat.includes(q) && !sub.includes(q) && !amtStr.includes(q) && !settleAmtStr.includes(q)) {
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
    renderInstallmentTracking();
    updateCharts(getFilteredRecords(true));
    renderTable();
    if (typeof currentMainView !== 'undefined' && currentMainView === 'annual' && typeof renderAnnualTaxView === 'function') {
      renderAnnualTaxView();
    }
  }

  function renderInstallmentTracking() {
    const panel = document.getElementById('installmentTrackerPanel');
    if (!panel) return;
    
    // 할부(isInstallment === 'Y')이며 취소되지 않은 유효 지출 내역 전체 조회
    // (당월 청구분 결제 완료 여부(exclude === 'Y')와 상관없이 앞으로 갚아야 할 남은 회차가 있는 한 추적)
    const installmentRecords = appState.records.filter(r => r.isInstallment === 'Y' && !r.isCanceled && (Number(r.amount) || 0) > 0);
    
    const trackingMap = {};

    // 날짜 오름차순으로 정렬하여 회차 순서 파악
    const sortedInstRecords = [...installmentRecords].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    sortedInstRecords.forEach(r => {
      const memo = r.memo || '';
      if (memo.includes('정산') || memo.includes('더치페이')) return; // 정산 및 더치페이 메모 제외
      
      let currentIdx = 1;
      let totalIdx = 3; // 기본 3개월
      let memoMatched = false;

      const match = memo.match(/(.*?)(\d+)\s*\/\s*(\d+)(.*)/);
      if (match) {
        currentIdx = parseInt(match[2], 10);
        totalIdx = parseInt(match[3], 10);
        memoMatched = true;
      } else {
        const monMatch = memo.match(/(\d+)\s*개월/) || (r.installment && r.installment.match(/(\d+)\s*개월/));
        if (monMatch) {
          totalIdx = parseInt(monMatch[1], 10);
        }
      }
      
      // 가맹점, 총 할부개월수, 월 청구금액 기준으로 할부 건 그룹화 (결제수단 표기 차이에도 안전하게 연계)
      const key = `${r.merchant.trim()}_${totalIdx}_${r.amount}`;
      
      // 만약 메모에 회차 표기(X/Y)가 없지만 동일 가맹점+금액의 이전 건이 있다면 currentIdx 누적 계산
      if (!memoMatched && trackingMap[key]) {
        currentIdx = Math.min(totalIdx, trackingMap[key].currentIdx + 1);
      }
      
      // 더 최신 회차이거나, 동일 회차라도 더 최근 날짜인 경우 갱신 & 최초 결제일(firstDate) 추적
      if (!trackingMap[key]) {
        const preferredCard = (!r.actualCard || r.actualCard.includes('간편결제')) ? r.actualCard : r.actualCard;
        trackingMap[key] = {
          merchant: r.merchant,
          card: preferredCard,
          amount: Number(r.amount) || 0,
          currentIdx: currentIdx,
          totalIdx: totalIdx,
          firstDate: r.date,
          lastDate: r.date,
          memo: memo || (r.installment ? `${r.installment} 할부` : '할부')
        };
      } else {
        if (r.date && (!trackingMap[key].firstDate || new Date(r.date) < new Date(trackingMap[key].firstDate))) {
          trackingMap[key].firstDate = r.date;
        }
        if (currentIdx > trackingMap[key].currentIdx || (currentIdx === trackingMap[key].currentIdx && new Date(r.date) > new Date(trackingMap[key].lastDate))) {
          const preferredCard = (!r.actualCard || r.actualCard.includes('간편결제')) && trackingMap[key]?.card && !trackingMap[key].card.includes('간편결제') ? trackingMap[key].card : r.actualCard;
          trackingMap[key].merchant = r.merchant;
          trackingMap[key].card = preferredCard;
          trackingMap[key].amount = Number(r.amount) || trackingMap[key].amount;
          trackingMap[key].currentIdx = currentIdx;
          trackingMap[key].totalIdx = totalIdx;
          trackingMap[key].lastDate = r.date;
          trackingMap[key].memo = memo || trackingMap[key].memo;
        }
      }
    });
    
    let totalLeft = 0;
    let activeCount = 0;
    let html = '';
    
    // 할부 정렬 기준: 'payoff' (완납/종료 임박순 - 제일 먼저 청구가 끊기는 순), 'firstDate' (최초 결제일순 - 제일 먼저 끊은 순), 'amount' (잔액 큰순)
    const sortMode = appState.installmentSort || 'payoff';

    const sortedItems = Object.values(trackingMap).sort((a, b) => {
      const leftMonthsA = a.totalIdx - a.currentIdx;
      const leftMonthsB = b.totalIdx - b.currentIdx;
      const leftAmtA = leftMonthsA * a.amount;
      const leftAmtB = leftMonthsB * b.amount;

      if (sortMode === 'payoff') {
        // 1. 완납(종료) 임박순: 남은 개월수가 적은 건이 제일 먼저 청구가 끊김
        if (leftMonthsA !== leftMonthsB) return leftMonthsA - leftMonthsB;
        return (a.firstDate || '').localeCompare(b.firstDate || '');
      } else if (sortMode === 'firstDate') {
        // 2. 최초 결제일순: 카드로 가장 먼저 할부를 끊은(결제한) 날짜순
        if (a.firstDate !== b.firstDate) return (a.firstDate || '').localeCompare(b.firstDate || '');
        return leftMonthsA - leftMonthsB;
      } else {
        // 3. 잔액 큰순
        return leftAmtB - leftAmtA;
      }
    });

    sortedItems.forEach(item => {
      if (item.currentIdx < item.totalIdx) {
        const monthsLeft = item.totalIdx - item.currentIdx;
        const leftAmt = monthsLeft * item.amount;
        totalLeft += leftAmt;
        activeCount++;
        
        const dateStr = item.lastDate ? item.lastDate.substring(5).replace('-', '/') : '';
        const firstDateStr = item.firstDate ? item.firstDate.substring(5).replace('-', '/') : '';
        const memoLabel = item.memo ? item.memo.replace(/\(\d+\s*\/\s*\d+\)/, '').replace(/할부\s*\d+\/\d+/, '').trim() : '';
        const percent = Math.min(100, Math.round((item.currentIdx / item.totalIdx) * 100));

        html += `
          <div class="inst-card">
            <div class="inst-card-top">
              <div class="inst-merchant-title-wrap">
                <div class="inst-merchant-title">${item.merchant}</div>
                ${memoLabel ? `<span class="inst-memo-badge">${memoLabel}</span>` : ''}
              </div>
              <div class="inst-amount-highlight">
                <div class="inst-left-amt">${formatCurrency(leftAmt)}원 남음</div>
                <div class="inst-left-months-pill">${monthsLeft}개월 남음</div>
              </div>
            </div>
            
            <div class="inst-progress-container">
              <div class="inst-progress-bar-bg">
                <div class="inst-progress-bar-fill" style="width: ${percent}%;"></div>
              </div>
              <div class="inst-progress-meta">
                <span class="inst-progress-round">진행 <strong>${item.currentIdx}/${item.totalIdx}회</strong> (${percent}%)</span>
                <span class="inst-monthly-charge">월 ${formatCurrency(item.amount)}원</span>
              </div>
            </div>

            <div class="inst-card-bottom">
              <span class="inst-card-pill">[${item.card}]</span>
              <span class="inst-last-date">${firstDateStr ? `시작: ${firstDateStr} · ` : ''}최근: ${dateStr}</span>
            </div>
          </div>
        `;
      }
    });
    
    if (activeCount > 0) {
      panel.style.display = 'block';
      const elLeft = document.getElementById('kpiTotalInstallmentLeft');
      if (elLeft) elLeft.textContent = formatCurrency(totalLeft);
      const elCount = document.getElementById('kpiInstallmentCount');
      if (elCount) elCount.textContent = `진행 중인 할부 ${activeCount}건`;
      const elBadge = document.getElementById('kpiInstallmentCountBadge');
      if (elBadge) elBadge.textContent = `${activeCount}건 진행 중`;
      const elList = document.getElementById('installmentTrackingList');
      if (elList) elList.innerHTML = html;

      // 정렬 버튼 활성화 상태 및 클릭 이벤트 등록
      document.querySelectorAll('.btn-inst-sort').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === sortMode);
        if (!btn.dataset.bound) {
          btn.dataset.bound = 'true';
          btn.addEventListener('click', () => {
            appState.installmentSort = btn.dataset.sort;
            try { localStorage.setItem('gyewon_inst_sort', btn.dataset.sort); } catch(e){}
            renderInstallmentTracking();
          });
        }
      });
    } else {
      panel.style.display = 'none';
    }
  }

  // --- Render KPIs ---
  function renderKPIs() {
    const records = getFilteredRecords(true);

    let totalValidAmt = 0;
    let totalValidCount = 0;
    let totalSettleAmt = 0;
    let totalPhysicalSettleAmt = 0;
    let totalPaySettleAmt = 0;
    let cardAmt = 0;
    let payAmt = 0;
    let payCount = 0;
    let billingAmt = 0;
    let installmentCount = 0;
    let excludedAmt = 0;
    let excludedCount = 0;
    let validCustomTypeAmt = 0;
    let cashAmt = 0;
    let cashCount = 0;
    let totalCashSettleAmt = 0;
    const customTypeGrossSums = {};
    const customTypeSettleSums = {};
    const customTypeCounts = {};
    for (const t in appState.customTypes) {
      customTypeGrossSums[t] = 0;
      customTypeSettleSums[t] = 0;
      customTypeCounts[t] = 0;
    }

    let livingGrossAmt = 0;
    let livingSettleAmt = 0;
    let livingCount = 0;

    records.forEach(r => {
      const amt = Number(r.amount) || 0;
      const bAmt = Number(r.billingAmount) || amt;
      const settle = Number(r.settleAmount) || 0;
      const isExclude = r.exclude === 'Y';
      const isPhysical = CARD_CONFIG[r.actualCard] && CARD_CONFIG[r.actualCard].type === 'physical';
      const isCash = r.actualCard === '현금' || (CARD_CONFIG[r.actualCard] && CARD_CONFIG[r.actualCard].type === 'cash');
      const isPayOrAccount = !isPhysical && !isCash;

      totalValidAmt += amt;
      totalValidCount++;
      totalSettleAmt += settle;

      if (isCash) {
        cashAmt += amt;
        cashCount++;
        totalCashSettleAmt += settle;
      } else if (isPhysical) {
        cardAmt += amt;
        totalPhysicalSettleAmt += settle;
      } else if (isPayOrAccount) {
        payAmt += amt;
        payCount++;
        totalPaySettleAmt += settle;
      }

      billingAmt += bAmt;

      if (r.installment && r.installment !== '일시불') {
        installmentCount++;
      }

      if (isExclude) {
        excludedAmt += amt;
        excludedCount++;
      }

      let matchedType = null;
      for (const t in appState.customTypes) {
        const cats = appState.customTypes[t] || [];
        if (t === '고정비') {
          if (r.isFixed === 'Y' || cats.includes(r.category) || r.category === t) {
            matchedType = t;
            break;
          }
        } else {
          if (cats.includes(r.category) || r.category === t) {
            matchedType = t;
            break;
          }
        }
      }
      
      if (matchedType) {
        customTypeGrossSums[matchedType] += amt;
        customTypeSettleSums[matchedType] += settle;
        customTypeCounts[matchedType]++;
        validCustomTypeAmt += amt;
      } else {
        livingGrossAmt += amt;
        livingSettleAmt += settle;
        livingCount++;
      }
    });

    // Update KPI Elements
    const livingNetAmt = Math.max(0, livingGrossAmt - livingSettleAmt);
    
    // KPI 1: 총 지출 (정산 회수액이 있는 경우 실부담금을 주 표시)
    const totalNetAmt = Math.max(0, totalValidAmt - totalSettleAmt);
    const kpiTotalAmountEl = document.getElementById('kpiTotalAmount');
    if (kpiTotalAmountEl) {
      // 실부담금을 메인 숫자로 표시
      kpiTotalAmountEl.textContent = formatCurrency(totalNetAmt);
    }
    const kpiTotalCountHeaderEl = document.getElementById('kpiTotalCountHeader');
    if (kpiTotalCountHeaderEl) {
      kpiTotalCountHeaderEl.textContent = `(총 ${totalValidCount}건)`;
    }
    const kpiTotalTopRightEl = document.getElementById('kpiTotalTopRight');
    if (kpiTotalTopRightEl) {
      kpiTotalTopRightEl.innerHTML = '';
    }
    const kpiTotalSettleDetailEl = document.getElementById('kpiTotalSettleDetail');
    if (kpiTotalSettleDetailEl) {
      if (totalSettleAmt > 0) {
        kpiTotalSettleDetailEl.style.display = 'block';
        kpiTotalSettleDetailEl.innerHTML = `원금 ${formatCurrency(totalValidAmt)}원 - 정산 ${formatCurrency(totalSettleAmt)}원`;
        kpiTotalSettleDetailEl.title = `총 결제 원금 ${formatCurrency(totalValidAmt)}원에서 정산 회수액 ${formatCurrency(totalSettleAmt)}원을 뺀 실부담액입니다.`;
      } else {
        kpiTotalSettleDetailEl.style.display = 'none';
        kpiTotalSettleDetailEl.innerHTML = '';
      }
    }

    // Dynamic Custom Types KPIs
    const dynamicKpiContainer = document.getElementById('dynamicKpiContainer');
    if (dynamicKpiContainer) {
      dynamicKpiContainer.innerHTML = '';
      const colors = ['card-accent-orange', 'card-accent-green', 'card-accent-purple', 'card-accent-blue'];
      let colorIdx = 0;
      
      for (const t in appState.customTypes) {
        const tGross = customTypeGrossSums[t] || 0;
        const tSettle = customTypeSettleSums[t] || 0;
        const tNet = Math.max(0, tGross - tSettle);
        const tCnt = customTypeCounts[t] || 0;
        const color = colors[colorIdx % colors.length];
        
        let settleSubHtml = '';
        if (tSettle > 0) {
          settleSubHtml = `<div class="kpi-settle-detail">원금 ${formatCurrency(tGross)}원 - 정산 ${formatCurrency(tSettle)}원</div>`;
        }

        const cardEl = document.createElement('div');
        cardEl.className = `kpi-card ${color}`;
        cardEl.innerHTML = `
          <div class="kpi-header">
            <div class="kpi-title-col">
              <div class="kpi-title-row">
                <span class="kpi-label">${t}</span>
                <span class="kpi-header-count">(총 ${tCnt}건)</span>
              </div>
            </div>
            <div class="kpi-header-action">
              <button class="kpi-mini-btn" title="${t} 항목 목록 보기">
                목록 &rarr;
              </button>
            </div>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-value">${formatCurrency(tNet)}</span>
            <span class="kpi-unit">원</span>
          </div>
          ${settleSubHtml}
        `;
        const btn = cardEl.querySelector('.kpi-mini-btn');
        btn.onclick = () => {
          appState.filterType = t;
          document.getElementById('filterType').value = t;
          appState.currentPage = 1;
          renderTable();
          showToast(`'${t}' 내역 ${tCnt}건을 표시합니다.`, 'info');
        };
        dynamicKpiContainer.appendChild(cardEl);
        colorIdx++;
      }
    }

    // KPI 3: 순 생활비 (정산 회수액 차감)
    const kpiLivingAmountEl = document.getElementById('kpiLivingAmount');
    if (kpiLivingAmountEl) kpiLivingAmountEl.textContent = formatCurrency(livingNetAmt);
    const livingRatio = totalValidAmt > 0 ? Math.round((livingNetAmt / totalValidAmt) * 100) : 0;
    const kpiLivingRatioHeaderEl = document.getElementById('kpiLivingRatioHeader');
    if (kpiLivingRatioHeaderEl) {
      kpiLivingRatioHeaderEl.textContent = `(총 지출의 ${livingRatio}%)`;
      kpiLivingRatioHeaderEl.title = `이번 달 총 지출(${formatCurrency(totalValidAmt)}원) 중 순수 생활비 실부담액(${formatCurrency(livingNetAmt)}원)이 차지하는 비율입니다.`;
    }
    const kpiLivingLabelEl = document.getElementById('kpiLivingLabel');
    if (kpiLivingLabelEl) {
      kpiLivingLabelEl.textContent = '순 생활비*';
    }
    const kpiLivingTopRightEl = document.getElementById('kpiLivingTopRight');
    if (kpiLivingTopRightEl) {
      kpiLivingTopRightEl.innerHTML = '';
    }
    const kpiLivingSettleDetailEl = document.getElementById('kpiLivingSettleDetail');
    if (kpiLivingSettleDetailEl) {
      if (livingSettleAmt > 0) {
        kpiLivingSettleDetailEl.style.display = 'block';
        kpiLivingSettleDetailEl.innerHTML = `원금 ${formatCurrency(livingGrossAmt)}원 - 정산 ${formatCurrency(livingSettleAmt)}원`;
      } else {
        kpiLivingSettleDetailEl.style.display = 'none';
        kpiLivingSettleDetailEl.innerHTML = '';
      }
    }

    // 1-line Living notice text below grid
    const typeNames = Object.keys(appState.customTypes);
    const extraList = [...typeNames];
    if (livingSettleAmt > 0) extraList.push('생활비 정산');
    const excludeNotice = extraList.length > 0 
      ? `순 생활비: 총 지출에서 ${extraList.join(', ')}을 차감한 실제 생활비 실부담액입니다.`
      : `순 생활비: 총 지출에서 비생활비 분류(고정비 등)를 차감한 실제 생활비 실부담액입니다.`;
    const noticeDescEl = document.getElementById('kpiLivingNoticeDesc');
    if (noticeDescEl) {
      noticeDescEl.textContent = excludeNotice;
    }

    // KPI 4: 남은 결제 금액 (총 지출 - 결제 완료)
    const remainingAmt = totalValidAmt - excludedAmt;
    const remainingCount = totalValidCount - excludedCount;
    document.getElementById('kpiExcludedAmount').textContent = formatCurrency(remainingAmt);
    const kpiExcludedCountHeaderEl = document.getElementById('kpiExcludedCountHeader');
    if (kpiExcludedCountHeaderEl) {
      kpiExcludedCountHeaderEl.textContent = `(총 ${remainingCount}건)`;
    }

    // Subtotals in Panel (카드 청구액 원금과 실부담액 병기)
    const cardBadgeEl = document.getElementById('cardSubtotalBadge');
    if (cardBadgeEl) {
      if (totalPhysicalSettleAmt > 0) {
        cardBadgeEl.innerHTML = `카드 청구 합계: ${formatCurrency(cardAmt)}원 <span style="font-size:0.8rem; color:#10b981; font-weight:600;">(👥 정산 -${formatCurrency(totalPhysicalSettleAmt)}원 → 실부담 ${formatCurrency(cardAmt - totalPhysicalSettleAmt)}원)</span>`;
        cardBadgeEl.title = `카드 청구 합계: ${formatCurrency(cardAmt)}원 (👥 정산 -${formatCurrency(totalPhysicalSettleAmt)}원 → 실부담 ${formatCurrency(cardAmt - totalPhysicalSettleAmt)}원)`;
      } else {
        cardBadgeEl.textContent = `카드 합계: ${formatCurrency(cardAmt)}원`;
      }
    }

    // 간편결제 & 계좌 지출 소계 (현금 완전 제외!)
    if (totalPaySettleAmt > 0) {
      document.getElementById('paySubtotalBadge').innerHTML = `소계: ${formatCurrency(payAmt)}원 <span style="font-size:0.8rem; color:#10b981; font-weight:600;">(👥 정산 -${formatCurrency(totalPaySettleAmt)}원 → 실부담 ${formatCurrency(payAmt - totalPaySettleAmt)}원)</span>`;
    } else {
      document.getElementById('paySubtotalBadge').textContent = `소계: ${formatCurrency(payAmt)}원`;
    }

    // 현금 지출 소계 (신설)
    const cashBadge = document.getElementById('cashSubtotalBadge');
    if (cashBadge) {
      if (totalCashSettleAmt > 0) {
        cashBadge.innerHTML = `합계: ${formatCurrency(cashAmt)}원 <span style="font-size:0.8rem; color:#10b981; font-weight:600;">(👥 정산 -${formatCurrency(totalCashSettleAmt)}원 → 실부담 ${formatCurrency(cashAmt - totalCashSettleAmt)}원)</span>`;
      } else {
        cashBadge.textContent = `합계: ${formatCurrency(cashAmt)}원 (${cashCount}건)`;
      }
    }

    // Period info
    const countInfo = document.getElementById('periodTxCount');
    if (countInfo) {
      countInfo.textContent = `총 ${records.length}건의 지출 내역 (포함 ${totalValidCount}건)`;
    }

    // 간편결제 카드 매핑 안내 배너용 집계 (현금, 실물카드, 은행 계좌 제외 오직 순수 간편결제만!)
    let unmappedPayCount = 0;
    let unmappedPayAmt = 0;
    records.forEach(r => {
      if (isSimplePay(r.actualCard)) {
        unmappedPayCount++;
        unmappedPayAmt += (Number(r.amount) || 0);
      }
    });

    // Mapping Notice Banner Update & UNMAPPED select option text
    const banner = document.getElementById('mappingNoticeBanner');
    const bannerText = document.getElementById('unmappedBannerText');
    const optUnmapped = document.getElementById('optUnmappedAll');
    if (optUnmapped) {
      optUnmapped.textContent = `⚡ 미매핑 간편결제 (${unmappedPayCount}건 - 현금/계좌 제외)`;
    }

    if (unmappedPayCount > 0) {
      banner.style.display = 'flex';
      bannerText.textContent = `실물 카드가 미지정된 간편결제(네이버페이, 카카오페이 등) 내역이 ${unmappedPayCount}건 (${formatCurrency(unmappedPayAmt)}원) 남아있습니다. '내역 모아보기'를 눌러 실물 카드를 지정하면 카드별 실적이 실시간 갱신됩니다. (현금/계좌 제외)`;
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
    const cardCompletedSums = {};
    const cardCompletedCounts = {};
    const cardSettleSums = {};
    const cardInstallmentSums = {};
    let totalPhysicalAmt = 0;

    records.forEach(r => {
      const card = r.actualCard || '기타 카드';
      const amt = Number(r.amount) || 0;
      const settle = Number(r.settleAmount) || 0;
      const isInst = r.isInstallment === 'Y' || (r.installment && r.installment !== '일시불') || (r.memo && r.memo.includes('할부'));

      cardSums[card] = (cardSums[card] || 0) + amt;
      cardCounts[card] = (cardCounts[card] || 0) + 1;
      cardSettleSums[card] = (cardSettleSums[card] || 0) + settle;

      if (isInst) {
        cardInstallmentSums[card] = (cardInstallmentSums[card] || 0) + amt;
      }

      if (r.exclude === 'Y') {
        cardCompletedSums[card] = (cardCompletedSums[card] || 0) + amt;
        cardCompletedCounts[card] = (cardCompletedCounts[card] || 0) + 1;
      }

      if (CARD_CONFIG[card] && CARD_CONFIG[card].type === 'physical') {
        totalPhysicalAmt += amt;
      }
    });

    // Render Physical Cards (지출 있는 카드 우선, 지출 0원이지만 목표 실적이 있는 카드만 표시, 목표 없는 0원 카드는 숨김)
    physicalCardsContainer.innerHTML = '';
    const physicalCardNames = Object.keys(CARD_CONFIG)
      .filter(c => {
        if (CARD_CONFIG[c].type !== 'physical') return false;
        const amt = cardSums[c] || 0;
        const target = CARD_CONFIG[c].target || 0;
        // 지출이 있거나(amt > 0), 목표 실적이 설정된 카드(target > 0)만 표시
        return amt > 0 || target > 0;
      })
      .sort((a, b) => {
        const diff = (cardSums[b] || 0) - (cardSums[a] || 0);
        if (diff !== 0) return diff;
        return a.localeCompare(b, 'ko');
      });

    physicalCardNames.forEach(cardName => {
      const conf = CARD_CONFIG[cardName] || { color: '#64748b', chip: '#475569', target: 300000 };
      const amt = cardSums[cardName] || 0;
      const instAmt = cardInstallmentSums[cardName] || 0;
      const settleAmt = cardSettleSums[cardName] || 0;
      const cnt = cardCounts[cardName] || 0;
      const completedAmt = cardCompletedSums[cardName] || 0;
      const completedCnt = cardCompletedCounts[cardName] || 0;
      const isComplete = cnt > 0 && completedCnt === cnt;
      const pendingCnt = cnt - completedCnt;
      const completionRate = amt > 0 ? Math.min(100, Math.round((completedAmt / amt) * 100)) : (cnt > 0 && isComplete ? 100 : 0);

      // 카드 실적 인정 기준: 카드사 혜택 규정에 따라 할부 이용금액은 전월 실적 산정에서 제외
      const performanceAmt = Math.max(0, amt - instAmt);
      const targetPercent = conf.target > 0 ? Math.min(100, Math.round((performanceAmt / conf.target) * 100)) : 100;
      const isTargetMet = conf.target > 0 && performanceAmt >= conf.target;

      // 완료된 카드는 회색(#64748b)으로 표시하여 완료 상태임을 시각적으로 명확화
      const displayColor = isComplete ? '#64748b' : conf.color;

      const cardEl = document.createElement('div');
      cardEl.className = `card-item ${appState.filterCard === cardName ? 'active-filter' : ''} ${isComplete ? 'card-completed-gray' : ''}`;
      cardEl.title = `${cardName} 내역 필터링`;

      const showInstPerf = conf.target > 0 && instAmt > 0;
      const hasExtraSubline = showInstPerf || settleAmt > 0;
      const statusPillHtml = isComplete 
        ? '<span class="card-status-pill completed" title="클릭 시 결제대기로 되돌리기 가능">✅ 완료</span>' 
        : (cnt > 0 && pendingCnt > 0 ? `<span class="card-status-pill pending" title="클릭 시 '${cardName}' 미완료 ${pendingCnt}건 일괄 결제완료">대기 ${pendingCnt}</span>` : '');

      cardEl.innerHTML = `
        <div class="card-item-top">
          <div class="card-brand-name">
            <span class="card-brand-chip" style="background: ${displayColor};"></span>
            <span class="card-title" title="${cardName}">${cardName}</span>
          </div>
          <div class="card-amount-val">
            <span class="card-amount">${formatCurrency(amt)}원</span>
          </div>
        </div>
        <div class="card-item-sub">
          <div class="card-pill-wrap">
            ${statusPillHtml}
          </div>
          <div class="card-extra-subline ${hasExtraSubline ? '' : 'is-empty'}" title="${hasExtraSubline ? `실제 지출: ${formatCurrency(amt)}원 / ${showInstPerf ? `실적인정(할부 제외): ${formatCurrency(performanceAmt)}원 / ` : ''}${settleAmt > 0 ? `정산 차감: -${formatCurrency(settleAmt)}원 (실부담 ${formatCurrency(amt - settleAmt)}원)` : ''}` : ''}">
            ${showInstPerf ? `<span class="card-inst-note">실적 ${formatCurrency(performanceAmt)}원</span>` : ''}
            ${(showInstPerf && settleAmt > 0) ? `<span class="card-sub-sep">·</span>` : ''}
            ${settleAmt > 0 ? `<span class="card-settle-note">👥 -${formatCurrency(settleAmt)}원</span>` : ''}
          </div>
        </div>
        <div class="card-item-bottom">
          <div class="card-meta-row">
            <div class="card-complete-info">
              <span class="card-complete-label">완료 금액:</span>
              <strong class="card-complete-amt">${formatCurrency(completedAmt)}원</strong>
            </div>
            ${conf.target > 0 ? `
            <div class="card-target-badge" title="목표 실적은 할부(-${formatCurrency(instAmt)}원)를 제외한 실적인정액(${formatCurrency(performanceAmt)}원) 기준으로 산정됩니다">
              목표 ${formatCurrency(conf.target)}원 <strong class="${isTargetMet ? 'target-met' : ''}">(${targetPercent}%) ${isTargetMet ? '👑' : ''}</strong>
            </div>
            ` : `
            <div class="card-target-badge card-target-none" style="opacity: 0.45; border-style: dashed;">
              목표 미설정
            </div>
            `}
          </div>
          <div class="card-bar-bg" title="결제 완료 진행률: ${completionRate}% (${formatCurrency(completedAmt)}원 / ${formatCurrency(amt)}원)">
            <div class="card-bar-fill" style="width: ${completionRate}%; background: ${displayColor};"></div>
          </div>
        </div>
      `;

      cardEl.addEventListener('click', (e) => {
        if (e.target.closest('.card-status-pill')) return;
        toggleCardFilter(cardName);
      });

      const statusPill = cardEl.querySelector('.card-status-pill');
      if (statusPill && cnt > 0) {
        statusPill.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!isComplete) {
            if (confirm(`'${cardName}'의 결제대기 내역 ${pendingCnt}건을 모두 '결제완료'로 변경하시겠습니까?`)) {
              let updated = 0;
              appState.records.forEach(r => {
                if (r.actualCard === cardName && r.exclude !== 'Y') {
                  r.exclude = 'Y';
                  updated++;
                }
              });
              if (updated > 0) {
                await saveData();
                renderKPIs();
                renderCardsBreakdown();
                renderTable();
                showToast(`'${cardName}' ${updated}건이 결제완료 처리되었습니다.`, 'info');
              }
            }
          } else {
            if (confirm(`'${cardName}'의 결제완료 내역 ${completedCnt}건을 다시 '대기' 상태로 되돌리시겠습니까?`)) {
              let updated = 0;
              appState.records.forEach(r => {
                if (r.actualCard === cardName && r.exclude === 'Y') {
                  r.exclude = 'N';
                  updated++;
                }
              });
              if (updated > 0) {
                await saveData();
                renderKPIs();
                renderCardsBreakdown();
                renderTable();
                showToast(`'${cardName}' ${updated}건이 결제대기로 변경되었습니다.`, 'info');
              }
            }
          }
        });
      }

      physicalCardsContainer.appendChild(cardEl);
    });

    // Render Pay & Accounts mini-cards (사용금액 높은 순 정렬, 현금 완전 제외)
    payAccountsContainer.innerHTML = '';
    const payNames = Object.keys(CARD_CONFIG)
      .filter(c => CARD_CONFIG[c].type === 'pay' && c !== '현금' && CARD_CONFIG[c].type !== 'cash')
      .sort((a, b) => {
        const diff = (cardSums[b] || 0) - (cardSums[a] || 0);
        if (diff !== 0) return diff;
        return a.localeCompare(b, 'ko');
      });

    payNames.forEach(payName => {
      const conf = CARD_CONFIG[payName] || { color: '#64748b', dot: '#94a3b8' };
      const amt = cardSums[payName] || 0;
      const settleAmt = cardSettleSums[payName] || 0;
      const cnt = cardCounts[payName] || 0;
      const completedAmt = cardCompletedSums[payName] || 0;
      const completedCnt = cardCompletedCounts[payName] || 0;

      const payEl = document.createElement('div');
      payEl.className = `pay-mini-card ${appState.filterCard === payName ? 'active-filter' : ''}`;
      payEl.innerHTML = `
        <div class="pay-mini-title">
          <span class="pay-mini-dot" style="background: ${conf.dot || conf.color};"></span>
          <span>${payName.replace('[간편결제] ', '')}</span>
        </div>
        <div class="pay-mini-amount">
          <div class="pay-mini-val">${formatCurrency(amt)}원</div>
          ${settleAmt > 0 ? `
          <div class="pay-mini-settle">
            👥 정산 -${formatCurrency(settleAmt)}원
          </div>
          ` : ''}
          <div class="pay-mini-meta">
            ${cnt > 0 ? `완료: <strong>${formatCurrency(completedAmt)}원</strong>` : '<span style="color:var(--text-muted); font-size:0.75rem;">지출 없음</span>'}
          </div>
        </div>
      `;

      payEl.addEventListener('click', () => {
        toggleCardFilter(payName);
      });

      payAccountsContainer.appendChild(payEl);
    });

    // Render Cash Spend Card (독립 현금 영역)
    const cashStatusContainer = document.getElementById('cashStatusContainer');
    if (cashStatusContainer) {
      cashStatusContainer.innerHTML = '';
      const cashAmt = cardSums['현금'] || 0;
      const cashSettleAmt = cardSettleSums['현금'] || 0;
      const cashCnt = cardCounts['현금'] || 0;
      const cashCompletedAmt = cardCompletedSums['현금'] || 0;
      const cashCompletedCnt = cardCompletedCounts['현금'] || 0;
      const cashPendingCnt = cashCnt - cashCompletedCnt;

      const cashEl = document.createElement('div');
      cashEl.className = `cash-card-item ${appState.filterCard === '현금' ? 'active-filter' : ''}`;
      cashEl.title = '현금 지출 내역 모아보기 (클릭 시 토글)';
      cashEl.innerHTML = `
        <div class="cash-card-left">
          <span class="cash-card-icon">💵</span>
          <span class="cash-card-label">현금</span>
        </div>
        <div class="cash-card-right">
          <div class="cash-card-amount">${formatCurrency(cashAmt)}원</div>
          ${cashSettleAmt > 0 ? `
          <div class="cash-card-settle">
            👥 정산 -${formatCurrency(cashSettleAmt)}원 (실부담 ${formatCurrency(cashAmt - cashSettleAmt)}원)
          </div>
          ` : ''}
          <div class="cash-card-meta">
            완료 금액: <strong style="color:var(--primary-color);">${formatCurrency(cashCompletedAmt)}원</strong>
          </div>
        </div>
      `;

      cashEl.addEventListener('click', () => {
        toggleCardFilter('현금');
      });

      cashStatusContainer.appendChild(cashEl);
    }
  }

  // --- Toggle Filter Functions ---
  function toggleCardFilter(cardName) {
    if (appState.filterCard === cardName) {
      appState.filterCard = 'ALL';
      showToast('전체 결제수단 내역을 표시합니다.', 'info');
    } else {
      appState.filterCard = cardName;
      showToast(`'${cardName}' 내역 필터가 적용되었습니다.`, 'info');
    }
    syncDOMFilters();
    appState.currentPage = 1;
    renderCardsBreakdown();
    renderTable();
  }
  window.toggleCardFilter = toggleCardFilter;

  function toggleCategoryFilter(categoryName) {
    if (appState.filterCategory === categoryName || categoryName === 'ALL') {
      appState.filterCategory = 'ALL';
      showToast('전체 카테고리 내역을 표시합니다.', 'info');
    } else {
      appState.filterCategory = categoryName;
      // If this category was excluded, re-include it
      if (appState.chartExcludedCategories && appState.chartExcludedCategories.has(categoryName)) {
        appState.chartExcludedCategories.delete(categoryName);
        saveLocalCache();
      }
      showToast(`'${categoryName}' 카테고리 내역 필터가 적용되었습니다.`, 'info');
    }
    syncDOMFilters();
    appState.currentPage = 1;
    updateCharts(getFilteredRecords(true));
    renderTable();
  }
  window.toggleCategoryFilter = toggleCategoryFilter;

  function toggleCategoryExclude(categoryName, e) {
    if (e) e.stopPropagation();
    if (!appState.chartExcludedCategories) {
      appState.chartExcludedCategories = new Set();
    }
    if (appState.chartExcludedCategories.has(categoryName)) {
      appState.chartExcludedCategories.delete(categoryName);
      showToast(`'${categoryName}' 카테고리가 다시 포함되었습니다.`, 'info');
    } else {
      appState.chartExcludedCategories.add(categoryName);
      // If currently filtered to this category, reset filter to ALL
      if (appState.filterCategory === categoryName) {
        appState.filterCategory = 'ALL';
        syncDOMFilters();
      }
      showToast(`'${categoryName}' 카테고리가 제외되었습니다.`, 'info');
    }
    saveLocalCache();
    appState.currentPage = 1;
    updateCharts(getFilteredRecords(true));
    renderTable();
  }
  window.toggleCategoryExclude = toggleCategoryExclude;

  function restoreAllExcludedCategories() {
    if (appState.chartExcludedCategories) {
      appState.chartExcludedCategories.clear();
      saveLocalCache();
    }
    appState.currentPage = 1;
    updateCharts(getFilteredRecords(true));
    renderTable();
    showToast('제외된 카테고리가 모두 다시 포함되었습니다.', 'info');
  }
  window.restoreAllExcludedCategories = restoreAllExcludedCategories;

  // --- Charts Logic ---
  function updateCharts(records) {
    const isNetMode = appState.chartSettleMode === 'net';

    // Synchronize Settle Mode Toggle UI
    const btnNet = document.getElementById('btnChartSettleNet');
    const btnGross = document.getElementById('btnChartSettleGross');
    if (btnNet && btnGross) {
      if (isNetMode) {
        btnNet.classList.add('active');
        btnGross.classList.remove('active');
      } else {
        btnNet.classList.remove('active');
        btnGross.classList.add('active');
      }
    }

    // 1. 카테고리별 지출 금액 및 건수 집계 (전체 레코드 기준)
    const activeCategories = records.map(r => r.category).filter(Boolean);
    const masterCats = Object.keys(appState.masterCategories || {});
    const allCatNames = [...new Set([...masterCats, ...activeCategories])];

    const catGrossSums = {};
    const catSettleSums = {};
    const catNetSums = {};
    const catCounts = {};
    let totalAllGrossAmt = 0;
    let totalAllSettleAmt = 0;

    records.forEach(r => {
      const cat = r.category || '기타';
      const gross = Number(r.amount) || 0;
      const settle = Number(r.settleAmount) || 0;
      const net = Math.max(0, gross - settle);

      catGrossSums[cat] = (catGrossSums[cat] || 0) + gross;
      catSettleSums[cat] = (catSettleSums[cat] || 0) + settle;
      catNetSums[cat] = (catNetSums[cat] || 0) + net;
      catCounts[cat] = (catCounts[cat] || 0) + 1;

      totalAllGrossAmt += gross;
      totalAllSettleAmt += settle;
    });

    const totalAllNetAmt = Math.max(0, totalAllGrossAmt - totalAllSettleAmt);
    const totalAllDisplayAmt = isNetMode ? totalAllNetAmt : totalAllGrossAmt;

    // 제외된 카테고리 집합 및 제외되지 않은 레코드 계산
    const excludedSet = appState.chartExcludedCategories || new Set();
    const includedRecords = records.filter(r => !excludedSet.has(r.category));

    let totalIncludedGrossAmt = 0;
    let totalIncludedSettleAmt = 0;
    includedRecords.forEach(r => {
      totalIncludedGrossAmt += (Number(r.amount) || 0);
      totalIncludedSettleAmt += (Number(r.settleAmount) || 0);
    });
    const totalIncludedNetAmt = Math.max(0, totalIncludedGrossAmt - totalIncludedSettleAmt);
    const totalDisplayAmt = isNetMode ? totalIncludedNetAmt : totalIncludedGrossAmt;

    // 지출 금액 순으로 정렬 (금액 있는 카테고리 우선)
    const sortedCategories = allCatNames.sort((a, b) => {
      const valA = isNetMode ? (catNetSums[a] || 0) : (catGrossSums[a] || 0);
      const valB = isNetMode ? (catNetSums[b] || 0) : (catGrossSums[b] || 0);
      return valB - valA;
    });

    // 2. 카테고리 인터랙티브 칩 생성 ([모아보기] + [제외] 기능 모두 지원)
    const filterContainer = document.getElementById('chartCategoryFilters');
    if (filterContainer) {
      filterContainer.innerHTML = '';

      // [전체 보기] 버튼
      const allChip = document.createElement('div');
      allChip.className = `cat-filter-chip ${appState.filterCategory === 'ALL' && excludedSet.size === 0 ? 'active' : ''}`;
      allChip.title = '전체 카테고리 보기';
      allChip.innerHTML = `
        <button type="button" class="cat-chip-main">
          <span>전체</span>
          <span class="cat-chip-amount">(${records.length}건)</span>
        </button>
      `;
      allChip.querySelector('.cat-chip-main').addEventListener('click', () => {
        toggleCategoryFilter('ALL');
      });
      filterContainer.appendChild(allChip);

      // 개별 카테고리 버튼들
      sortedCategories.forEach((cat, idx) => {
        const gross = catGrossSums[cat] || 0;
        const settle = catSettleSums[cat] || 0;
        const net = catNetSums[cat] || 0;
        const amt = isNetMode ? net : gross;
        const cnt = catCounts[cat] || 0;
        if (amt === 0 && cnt === 0 && appState.filterCategory !== cat && !excludedSet.has(cat)) return;

        const isExcluded = excludedSet.has(cat);
        const isSelected = (appState.filterCategory === cat);
        const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

        const chip = document.createElement('div');
        chip.className = `cat-filter-chip ${isExcluded ? 'is-excluded' : ''} ${isSelected ? 'active' : ''}`;
        chip.dataset.cat = cat;

        const settleBadge = settle > 0 
          ? (isNetMode 
              ? ` <small style="color:#10b981; font-weight:700;">(-${formatCurrency(settle)})</small>`
              : ` <small style="color:#10b981; font-weight:700;">(실부담 ${formatCurrency(net)})</small>`)
          : '';

        chip.innerHTML = `
          <button type="button" class="cat-chip-main" title="${isExcluded ? `'${cat}' 다시 포함하고 모아보기` : `'${cat}' 내역만 모아보기 (클릭)`}">
            <span class="cat-chip-dot" style="background: ${isExcluded ? '#64748b' : color};"></span>
            <span class="cat-chip-name">${cat}</span>
            <span class="cat-chip-amount">${formatCurrency(amt)}원${settleBadge}</span>
          </button>
          <button type="button" class="cat-chip-del-btn" title="${isExcluded ? `'${cat}' 차트 분석에 다시 포함하기` : `'${cat}' 차트 분석에서 제외하기`}">
            ${isExcluded ? '+ 포함' : '✕'}
          </button>
        `;

        // 메인 영역 클릭 -> 모아보기 (카드 클릭과 동일)
        chip.querySelector('.cat-chip-main').addEventListener('click', () => {
          toggleCategoryFilter(cat);
        });

        // ✕ 또는 +포함 버튼 클릭 -> 제외/포함 토글
        chip.querySelector('.cat-chip-del-btn').addEventListener('click', (e) => {
          toggleCategoryExclude(cat, e);
        });

        filterContainer.appendChild(chip);
      });
    }

    // 3. 차트 요약 총합계 헤더 업데이트
    const summaryRow = document.getElementById('chartTotalSummaryRow');
    if (summaryRow) {
      if (appState.filterCategory !== 'ALL') {
        const catGross = catGrossSums[appState.filterCategory] || 0;
        const catSettle = catSettleSums[appState.filterCategory] || 0;
        const catNet = catNetSums[appState.filterCategory] || 0;
        const selectedCnt = catCounts[appState.filterCategory] || 0;

        summaryRow.innerHTML = `
          <div class="chart-summary-header-box">
            <div class="chart-summary-left">
              <div class="chart-summary-main-line">
                <span class="chart-summary-title">📈 [${appState.filterCategory}] 합계:</span>
                <span class="chart-summary-amount">${formatCurrency(catNet)}원</span>
                <span class="chart-summary-count-badge">${selectedCnt}건</span>
              </div>
              <div class="chart-summary-sub-line">
                ${catSettle > 0 ? `
                  <span class="chart-badge-settle">👥 정산 회수 -${formatCurrency(catSettle)}원</span>
                  <span class="chart-badge-gross">결제 원금 ${formatCurrency(catGross)}원</span>
                  <span class="chart-summary-guide">💡 표시된 금액은 실부담금(결제 원금에서 정산 회수액을 차감한 실제 지출액)입니다.</span>
                ` : ''}
                <span class="chart-badge-info">전체 중 ${formatCurrency(totalAllNetAmt)}원</span>
              </div>
            </div>
            <button id="btnResetCatFilter" class="btn btn-secondary btn-sm chart-summary-action-btn">
              전체 카테고리 보기 ✕
            </button>
          </div>
        `;
        document.getElementById('btnResetCatFilter')?.addEventListener('click', () => {
          toggleCategoryFilter('ALL');
        });
      } else if (excludedSet.size > 0) {
        summaryRow.innerHTML = `
          <div class="chart-summary-header-box">
            <div class="chart-summary-left">
              <div class="chart-summary-main-line">
                <span class="chart-summary-title">📈 차트 총합계:</span>
                <span class="chart-summary-amount">${formatCurrency(totalIncludedNetAmt)}원</span>
                <span class="chart-badge-excluded">⚠️ ${excludedSet.size}개 제외됨</span>
                <button id="btnRestoreExcludesHeader" class="btn btn-secondary btn-sm chart-summary-action-btn" title="제외된 카테고리를 모두 다시 차트에 포함합니다">
                  제외 모두 해제 ↺
                </button>
              </div>
              ${totalIncludedSettleAmt > 0 ? `
              <div class="chart-summary-sub-line">
                <span class="chart-badge-settle">👥 정산 회수 -${formatCurrency(totalIncludedSettleAmt)}원</span>
                <span class="chart-badge-gross">결제 원금 ${formatCurrency(totalIncludedGrossAmt)}원</span>
                <span class="chart-summary-guide">💡 표시된 금액은 실부담금(카드 청구 원금에서 정산 회수액을 뺀 실제 부담액)입니다.</span>
              </div>
              ` : ''}
            </div>
          </div>
        `;
        document.getElementById('btnRestoreExcludesHeader')?.addEventListener('click', () => {
          restoreAllExcludedCategories();
        });
      } else {
        summaryRow.innerHTML = `
          <div class="chart-summary-header-box">
            <div class="chart-summary-left">
              <div class="chart-summary-main-line">
                <span class="chart-summary-title">📈 차트 총합계:</span>
                <span class="chart-summary-amount">${formatCurrency(totalIncludedNetAmt)}원</span>
              </div>
              ${totalIncludedSettleAmt > 0 ? `
              <div class="chart-summary-sub-line">
                <span class="chart-badge-settle">👥 정산 회수 -${formatCurrency(totalIncludedSettleAmt)}원</span>
                <span class="chart-badge-gross">결제 원금 ${formatCurrency(totalIncludedGrossAmt)}원</span>
                <span class="chart-summary-guide">💡 표시된 금액은 실부담금(카드 청구 원금에서 정산 회수액을 뺀 실제 부담액)입니다.</span>
              </div>
              ` : ''}
            </div>
          </div>
        `;
      }
    } else {
      const sumEl = document.getElementById('chartTotalSum');
      if (sumEl) sumEl.textContent = formatCurrency(totalDisplayAmt);
    }

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    // 1. Doughnut: Card Breakdown
    renderCardDoughnut(includedRecords, textColor);

    // 2. Bar: Category Breakdown
    renderCategoryBar(includedRecords, textColor, gridColor);

    // 3. Line: Daily Spend Trend
    renderTrendLine(includedRecords, textColor, gridColor);

    // 4. Bar: Daily Spend Breakdown
    renderDailyBar(includedRecords, textColor, gridColor);

    // 5. Settlement Visual Analytics
    renderSettlementsVisual(records);
  }

  function renderCardDoughnut(records, textColor) {
    const canvas = document.getElementById('cardDoughnutChart');
    const legendBox = document.getElementById('cardCustomLegend');
    if (!canvas) return;

    const isNetMode = appState.chartSettleMode === 'net';
    const sums = {};
    const grossSums = {};
    const settleSums = {};

    records.forEach(r => {
      const card = r.actualCard || '기타 카드';
      const gross = Number(r.amount) || 0;
      const settle = Number(r.settleAmount) || 0;
      const net = Math.max(0, gross - settle);
      const val = isNetMode ? net : gross;

      sums[card] = (sums[card] || 0) + val;
      grossSums[card] = (grossSums[card] || 0) + gross;
      settleSums[card] = (settleSums[card] || 0) + settle;
    });

    const sortedCards = Object.keys(sums).filter(c => sums[c] > 0).sort((a, b) => sums[b] - sums[a]);
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
        onClick: (evt, activeElements) => {
          if (activeElements && activeElements.length > 0) {
            const index = activeElements[0].index;
            const clickedCard = labels[index];
            if (clickedCard) {
              toggleCardFilter(clickedCard);
            }
          }
        },
        onHover: (evt, activeElements) => {
          const target = evt.native ? evt.native.target : (evt.chart ? evt.chart.canvas : null);
          if (target) {
            target.style.cursor = (activeElements && activeElements.length > 0) ? 'pointer' : 'default';
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const cardName = ctx.label;
                const val = ctx.parsed;
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const percent = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                const cardGross = grossSums[cardName] || 0;
                const cardSettle = settleSums[cardName] || 0;
                let extra = '';
                if (cardSettle > 0) {
                  extra = isNetMode 
                    ? ` (원금 ${formatCurrency(cardGross)}원, 정산 -${formatCurrency(cardSettle)}원)` 
                    : ` (정산 -${formatCurrency(cardSettle)}원, 실부담 ${formatCurrency(cardGross - cardSettle)}원)`;
                }
                return ` ${cardName}: ${formatCurrency(val)}원 (${percent}%)${extra} - 클릭 시 필터링`;
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
        item.className = `legend-item ${appState.filterCard === lbl ? 'active-legend-filter' : ''}`;
        item.style.cursor = 'pointer';
        item.title = `${lbl} 내역 필터링`;
        const settleAmt = settleSums[lbl] || 0;
        const settleBadge = settleAmt > 0 ? ` <small style="color:#10b981; font-weight:700;">(-${formatCurrency(settleAmt)})</small>` : '';
        item.innerHTML = `
          <span class="legend-color-dot" style="background: ${bgColors[idx]};"></span>
          <span>${lbl.replace('[간편결제] ', '')} (${formatCurrency(data[idx])}원${settleBadge})</span>
        `;
        item.addEventListener('click', () => {
          toggleCardFilter(lbl);
        });
        legendBox.appendChild(item);
      });
    }
  }

  function renderCategoryBar(records, textColor, gridColor) {
    const canvas = document.getElementById('categoryBarChart');
    if (!canvas) return;

    const isNetMode = appState.chartSettleMode === 'net';
    const catSums = {};
    const catGrossSums = {};
    const catSettleSums = {};

    records.forEach(r => {
      const cat = r.category || '기타';
      const gross = Number(r.amount) || 0;
      const settle = Number(r.settleAmount) || 0;
      const net = Math.max(0, gross - settle);
      const val = isNetMode ? net : gross;

      catSums[cat] = (catSums[cat] || 0) + val;
      catGrossSums[cat] = (catGrossSums[cat] || 0) + gross;
      catSettleSums[cat] = (catSettleSums[cat] || 0) + settle;
    });

    const sortedCats = Object.keys(catSums).filter(c => catSums[c] > 0).sort((a, b) => catSums[b] - catSums[a]);
    const labels = sortedCats;
    const data = sortedCats.map(c => catSums[c]);

    // 카테고리 수에 따라 차트 컨테이너 높이를 동적으로 조정하여 간격 확보
    const container = canvas.parentElement;
    if (container) {
      container.style.height = Math.max(320, labels.length * 40) + 'px';
    }

    if (charts.categoryBar) {
      charts.categoryBar.destroy();
    }

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const activeCat = appState.filterCategory;

    // 카테고리 선택 시 활성 카테고리 강조, 나머지 반투명 처리
    const bgColors = labels.map((c, i) => {
      const baseColor = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
      if (activeCat === 'ALL') return baseColor;
      return c === activeCat ? baseColor : (isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.35)');
    });
    const borderColors = labels.map((c) => {
      if (activeCat === 'ALL') return 'transparent';
      return c === activeCat ? (isDark ? '#ffffff' : '#1e293b') : 'transparent';
    });
    const borderWidths = labels.map(c => (c === activeCat ? 2 : 0));

    charts.categoryBar = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: isNetMode ? '실부담 지출액' : '결제 원금',
          data: data,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: borderWidths,
          borderRadius: 6,
          barPercentage: 0.6,
          categoryPercentage: 0.8
        }]
      },
      options: {
        onClick: (evt, activeElements) => {
          if (activeElements && activeElements.length > 0) {
            const index = activeElements[0].index;
            const clickedCat = labels[index];
            if (clickedCat) {
              toggleCategoryFilter(clickedCat);
            }
            return;
          }
          if (charts.categoryBar) {
            const points = charts.categoryBar.getElementsAtEventForMode(evt.native || evt, 'nearest', { intersect: false }, true);
            if (points && points.length > 0) {
              const clickedCat = labels[points[0].index];
              if (clickedCat) {
                toggleCategoryFilter(clickedCat);
              }
            }
          }
        },
        onHover: (evt, activeElements) => {
          const target = evt.native ? evt.native.target : (evt.chart ? evt.chart.canvas : null);
          if (target) {
            target.style.cursor = (activeElements && activeElements.length > 0) ? 'pointer' : 'default';
          }
        },
        layout: {
          padding: { right: 140 }
        },
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 12 },
              callback: val => formatCurrency(val) + '원'
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              color: (ctx) => {
                const catName = labels[ctx.index];
                if (activeCat !== 'ALL' && catName === activeCat) {
                  return 'var(--primary)';
                }
                return textColor;
              },
              font: (ctx) => {
                const catName = labels[ctx.index];
                const isSelected = (activeCat !== 'ALL' && catName === activeCat);
                return { weight: isSelected ? '800' : '600', size: isSelected ? 14 : 13 };
              }
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const catName = ctx.label;
                const isSelected = activeCat === catName;
                const cGross = catGrossSums[catName] || 0;
                const cSettle = catSettleSums[catName] || 0;
                let settleInfo = '';
                if (cSettle > 0) {
                  settleInfo = isNetMode 
                    ? ` (원금 ${formatCurrency(cGross)}원 - 정산 ${formatCurrency(cSettle)}원)` 
                    : ` (정산 -${formatCurrency(cSettle)}원 → 실부담 ${formatCurrency(cGross - cSettle)}원)`;
                }
                return ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.x)}원${settleInfo} (${isSelected ? '클릭 시 필터 해제' : '클릭 시 이 카테고리만 보기'})`;
              }
            }
          }
        }
      },
      plugins: [{
        id: 'categoryDataLabels',
        afterDatasetsDraw(chart) {
          const { ctx, data } = chart;
          ctx.save();
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const meta = chart.getDatasetMeta(0);
          meta.data.forEach((bar, index) => {
            const value = data.datasets[0].data[index];
            const catName = labels[index];
            const isSelected = (activeCat !== 'ALL' && catName === activeCat);
            if (isSelected) {
              ctx.font = 'bold 13px Outfit';
              ctx.fillStyle = isDark ? '#818cf8' : '#4f46e5';
              ctx.fillText(`${formatCurrency(value)}원 👑 [선택됨]`, bar.x + 6, bar.y);
            } else {
              ctx.font = 'bold 13px Outfit';
              ctx.fillStyle = textColor;
              ctx.fillText(`${formatCurrency(value)}원`, bar.x + 6, bar.y);
            }
          });
          ctx.restore();
        }
      }]
    });
  }

  function renderTrendLine(records, textColor, gridColor) {
    const canvas = document.getElementById('trendLineChart');
    if (!canvas) return;

    const isNetMode = appState.chartSettleMode === 'net';

    // Daily cumulative spending
    const dailyMap = {};
    records.forEach(r => {
      if (!r.date) return;
      const d = r.date;
      const gross = Number(r.amount) || 0;
      const settle = Number(r.settleAmount) || 0;
      const net = Math.max(0, gross - settle);
      const val = isNetMode ? net : gross;
      dailyMap[d] = (dailyMap[d] || 0) + val;
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
            label: isNetMode ? '일별 실부담 지출액' : '일별 결제 원금',
            type: 'bar',
            data: sortedDates.map(d => dailyMap[d]),
            backgroundColor: 'rgba(99, 102, 241, 0.35)',
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            label: isNetMode ? '누적 실부담 지출액' : '누적 결제 원금',
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

  function renderDailyBar(records, textColor, gridColor) {
    const canvas = document.getElementById('dailyBarChart');
    if (!canvas) return;

    const isNetMode = appState.chartSettleMode === 'net';

    // Unique dates from active records
    const uniqueDates = [...new Set(records.map(r => r.date).filter(Boolean))].sort();
    const dates = uniqueDates.length > 0 ? uniqueDates : [
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'
    ];

    const cardData = dates.map(() => 0);
    const payData = dates.map(() => 0);

    records.forEach(r => {
      if (!r.date) return;
      const idx = dates.indexOf(r.date);
      if (idx !== -1) {
        const gross = Number(r.amount) || 0;
        const settle = Number(r.settleAmount) || 0;
        const net = Math.max(0, gross - settle);
        const amt = isNetMode ? net : gross;

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
            label: isNetMode ? '실물 카드 (실부담)' : '실물 카드 지출',
            data: cardData,
            backgroundColor: '#2563eb',
            borderRadius: 4,
            barPercentage: 0.6,
            categoryPercentage: 0.8
          },
          {
            label: isNetMode ? '간편결제/계좌 (실부담)' : '간편결제/계좌 지출',
            data: payData,
            backgroundColor: '#f59e0b',
            borderRadius: 4,
            barPercentage: 0.6,
            categoryPercentage: 0.8
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

  // --- Render Dutch Pay / Settlement Visual Analytics ---
  function renderSettlementsVisual(records) {
    const container = document.getElementById('settlementsVisualContainer');
    if (!container) return;

    // Filter records that have settleAmount > 0
    const settledRecords = records.filter(r => (Number(r.settleAmount) > 0));

    if (settledRecords.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">👥</div>
          <h4 style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 8px;">이번 기간에 등록된 모임 정산 / 더치페이 내역이 없습니다</h4>
          <p style="font-size: 0.88rem; max-width: 420px; margin: 0 auto; line-height: 1.5;">
            모임이나 친구들과 결제한 건이 있다면, 아래 <strong>지출 상세 표에서 '➗' 버튼</strong>을 눌러 정산을 등록해보세요!
            <br>정산받은 금액을 입력하면 카드 청구액과 내 순수 지출이 자동으로 분리 분석됩니다.
          </p>
        </div>
      `;
      return;
    }

    let totalCharged = 0;
    let totalRecovered = 0;
    let totalMyShare = 0;

    settledRecords.forEach(r => {
      const amt = Number(r.amount) || 0;
      const settle = Number(r.settleAmount) || 0;
      totalCharged += amt;
      totalRecovered += settle;
      totalMyShare += Math.max(0, amt - settle);
    });

    const recoverRate = totalCharged > 0 ? Math.round((totalRecovered / totalCharged) * 100) : 0;
    const myShareRate = 100 - recoverRate;

    let itemsHtml = '';
    settledRecords.sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(r => {
      const amt = Number(r.amount) || 0;
      const settle = Number(r.settleAmount) || 0;
      const myShare = Math.max(0, amt - settle);
      const note = r.settleNote || '정산 완료';
      const dateStr = r.date ? r.date.substring(5) : '';

      itemsHtml += `
        <div class="settle-list-item" data-id="${r.id}" title="클릭하여 정산 수정/확인">
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="color: var(--text-main); font-size: 0.95rem;">${r.merchant}</strong>
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${note}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              ${dateStr} ${r.time || ''} · ${r.actualCard || ''} · ${r.category || ''}
            </div>
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; gap: 2px;">
            <div style="font-size: 0.95rem; font-weight: 800; color: #10b981;">
              내 실부담: ${formatCurrency(myShare)}원
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              원금 ${formatCurrency(amt)}원 - 회수 ${formatCurrency(settle)}원
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <!-- KPI Stats -->
      <div class="settle-summary-grid">
        <div class="settle-stat-card">
          <span class="label">💳 모임 결제 원금 (카드 청구)</span>
          <span class="val" style="color: var(--text-main);">${formatCurrency(totalCharged)}<small style="font-size: 0.8rem; font-weight: normal;">원</small></span>
        </div>
        <div class="settle-stat-card" style="border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.06);">
          <span class="label" style="color: #10b981; font-weight: 600;">💰 다른 사람에게 회수한 금액</span>
          <span class="val" style="color: #10b981;">${formatCurrency(totalRecovered)}<small style="font-size: 0.8rem; font-weight: normal;">원</small></span>
        </div>
        <div class="settle-stat-card">
          <span class="label">👉 내가 실제 부담한 지출</span>
          <span class="val" style="color: var(--primary);">${formatCurrency(totalMyShare)}<small style="font-size: 0.8rem; font-weight: normal;">원</small></span>
        </div>
        <div class="settle-stat-card">
          <span class="label">📈 정산 회수율</span>
          <span class="val" style="color: #06b6d4;">${recoverRate}<small style="font-size: 0.8rem; font-weight: normal;">%</small></span>
        </div>
      </div>

      <!-- Ratio Bar -->
      <div class="settle-progress-wrap">
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-main); font-weight: 600;">
          <span>내 실부담: ${formatCurrency(totalMyShare)}원 (${myShareRate}%)</span>
          <span style="color: #10b981;">타인 회수액: ${formatCurrency(totalRecovered)}원 (${recoverRate}%)</span>
        </div>
        <div class="settle-progress-bar">
          <div style="width: ${myShareRate}%; background: var(--primary); height: 100%; transition: width 0.4s ease;" title="내 실부담 ${myShareRate}%"></div>
          <div style="width: ${recoverRate}%; background: #10b981; height: 100%; transition: width 0.4s ease;" title="정산 회수 ${recoverRate}%"></div>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted); text-align: right;">
          총 ${settledRecords.length}건의 모임/더치페이 정산 거래
        </div>
      </div>

      <!-- Detailed List -->
      <div>
        <div style="font-size: 0.9rem; font-weight: 700; margin-bottom: 8px; color: var(--text-main);">
          📋 모임 정산 거래 목록 (${settledRecords.length}건)
        </div>
        <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
          ${itemsHtml}
        </div>
      </div>
    `;

    // Clicking any item in the list opens the split modal for that item!
    container.querySelectorAll('.settle-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = Number(item.dataset.id);
        if (id) openSplitModal(id);
      });
    });
  }

  // --- Bulk Action Logic ---
  function updateBulkActionUI() {
    const checkedBoxes = document.querySelectorAll('.row-check:checked');
    const bulkBar = document.getElementById('bulkActionBar');
    const bulkCount = document.getElementById('bulkCount');
    const bulkSum = document.getElementById('bulkSum');
    const bulkSettleBadge = document.getElementById('bulkSettleBadge');
    const selectAllCheckbox = document.getElementById('selectAllRows');

    const totalRows = document.querySelectorAll('.row-check').length;
    if (selectAllCheckbox) {
      if (totalRows > 0) {
        selectAllCheckbox.checked = (checkedBoxes.length === totalRows);
      } else {
        selectAllCheckbox.checked = false;
      }
    }

    if (bulkBar) {
      if (checkedBoxes.length > 0) {
        bulkBar.style.display = 'flex';
        if (bulkCount) bulkCount.textContent = checkedBoxes.length;

        let grossSum = 0;
        let settleSum = 0;
        let settledCount = 0;

        checkedBoxes.forEach(cb => {
          const id = Number(cb.dataset.id);
          const rec = appState.records.find(r => r.id === id);
          const amt = Number(cb.dataset.amount) || (rec ? Number(rec.amount) || 0 : 0);
          const settle = rec ? Number(rec.settleAmount) || 0 : (Number(cb.dataset.settle) || 0);
          grossSum += amt;
          if (settle > 0) {
            settleSum += settle;
            settledCount++;
          }
        });

        const netSum = Math.max(0, grossSum - settleSum);

        if (bulkSum) bulkSum.textContent = formatCurrency(grossSum);

        if (bulkSettleBadge) {
          if (settleSum > 0) {
            bulkSettleBadge.style.display = 'inline-flex';
            bulkSettleBadge.innerHTML = `
              <span class="bulk-settle-pill" style="display: inline-flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #10b981; padding: 2px 8px; border-radius: 6px; font-size: 0.82rem; font-weight: 600;">
                👥 정산 회수 -${formatCurrency(settleSum)}원 <small style="font-size: 0.75rem; opacity: 0.85;">(${settledCount}건)</small>
              </span>
              <span style="color: #10b981; font-weight: 700; font-size: 0.95rem; margin-left: 2px;">
                👉 실부담 ${formatCurrency(netSum)}원
              </span>
            `;
          } else {
            bulkSettleBadge.style.display = 'none';
            bulkSettleBadge.innerHTML = '';
          }
        }
      } else {
        bulkBar.style.display = 'none';
      }
    }
  }

  // --- Render Transactions Table ---
  function renderTable() {
    saveUIState();
    syncDOMFilters();
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
    const totalFilteredSettle = filtered.reduce((sum, r) => sum + (Number(r.settleAmount) || 0), 0);
    document.getElementById('filteredCountBadge').textContent = `검색/필터 결과: ${filtered.length}건`;
    if (totalFilteredSettle > 0) {
      document.getElementById('filteredSumBadge').innerHTML = `합계: ${formatCurrency(totalFilteredAmt)}원 <span style="font-size:0.85em; color:#10b981; font-weight:600;">(👥 정산 -${formatCurrency(totalFilteredSettle)}원 → 실부담 ${formatCurrency(totalFilteredAmt - totalFilteredSettle)}원)</span>`;
    } else {
      document.getElementById('filteredSumBadge').textContent = `합계: ${formatCurrency(totalFilteredAmt)}원`;
    }

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
      updateBulkActionUI();
      return;
    }

    // Build Table Rows
    const allCards = Object.keys(CARD_CONFIG);
    const installmentOptions = ['일시불', '2개월', '3개월', '4개월', '5개월', '6개월', '12개월'];

    pageRecords.forEach(rec => {
      // Compute Record Type
      let recordType = '변동비';
      let matchedCustom = false;
      for (const t in appState.customTypes) {
        if (appState.customTypes[t].includes(rec.category) || rec.category === t) {
          recordType = t;
          matchedCustom = true;
          break;
        }
      }
      if (!matchedCustom && rec.isFixed === 'Y') {
        recordType = '고정비';
      }

      const isExcluded = rec.exclude === 'Y';
      const isUnmapped = !CARD_CONFIG[rec.actualCard];
      const isCanceledClass = rec.isCanceled ? 'is-canceled' : '';

      const tr = document.createElement('tr');
      tr.className = `${isExcluded ? 'tx-row-excluded' : ''} ${isCanceledClass}`.trim();
      tr.dataset.id = rec.id;

      // Card Select Options
      let cardOptionsHtml = '';
      let isValidCard = false;
      allCards.forEach(card => {
        const isSelected = card === rec.actualCard;
        if (isSelected) isValidCard = true;
        cardOptionsHtml += `<option value="${card}" ${isSelected ? 'selected' : ''}>${card}</option>`;
      });
      if (rec.actualCard && !isValidCard) {
        cardOptionsHtml += `<option value="${rec.actualCard}" selected>${rec.actualCard} (미등록)</option>`;
      }

      tr.innerHTML = `
        <td class="col-check" style="text-align: center;">
          <input type="checkbox" class="row-check" data-id="${rec.id}" data-amount="${rec.amount}" data-settle="${rec.settleAmount || 0}">
        </td>
        <td class="col-id">${rec.id}</td>
        <td class="col-date">
          <div>${rec.date ? rec.date.substring(5) : ''}</div>
          <small style="color:var(--text-muted); font-size:0.75rem;">${rec.time || ''}</small>
        </td>
        <td class="col-cat">
          <button type="button" class="btn-table-category" data-id="${rec.id}" title="클릭하여 분류(카테고리) 변경 (스크롤 없는 원터치 선택)">
            <span class="cat-pill">${rec.category || '미분류'}</span>
            ${rec.subCategory && rec.subCategory !== rec.category ? `<span class="cat-sub-pill">${rec.subCategory}</span>` : ''}
            <span class="cat-edit-pencil">✏️</span>
          </button>
        </td>
        <td class="col-merchant" title="${rec.merchant}">
          ${rec.merchant}
        </td>
        <td class="col-amt">
          <div class="amt-gross">${formatCurrency(rec.amount)}</div>
          ${(() => {
            const settle = Number(rec.settleAmount) || 0;
            if (settle <= 0) return '';
            const gross = Number(rec.amount) || 0;
            const net = Math.max(0, gross - settle);
            const isFull = settle >= gross && gross > 0;
            const labelText = isFull ? '⚡ 실부담 0원' : `👥 실부담 ${formatCurrency(net)}원`;
            const tooltip = `👥 정산 상세 (클릭하여 수정)&#10;• 결제원금: ${formatCurrency(gross)}원&#10;• 정산회수: -${formatCurrency(settle)}원&#10;👉 실부담액: ${formatCurrency(net)}원${rec.settleNote ? `&#10;• 메모: ${rec.settleNote}` : ''}`;
            return `
              <div class="badge-settle ${isFull ? 'badge-settle-zero' : ''}" data-id="${rec.id}" title="${tooltip}">
                <span class="badge-settle-text">${labelText}</span>
              </div>
            `;
          })()}
        </td>
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
        <td class="col-exclude">
          <button class="exclude-toggle-btn ${isExcluded ? 'active-y' : ''}" data-id="${rec.id}" title="결제 상태 토글" style="width: 50px; font-size:0.8rem; border-radius:12px; padding:4px;">
            ${isExcluded ? '완료' : '대기'}
          </button>
        </td>
          <td class="col-fixed" style="text-align:center;">
            <span class="badge" style="background:var(--bg-surface); padding:4px 8px; border-radius:12px; font-size:0.8rem; border:1px solid var(--border-color); color:var(--text-muted);">
              ${recordType}
            </span>
          </td>
        <td class="col-memo">
          <input type="text" class="input-table-memo" data-id="${rec.id}" value="${rec.memo || ''}" placeholder="메모 입력...">
        </td>
        <td class="col-action" style="white-space: nowrap;">
          <button type="button" class="btn-split-row ${Number(rec.settleAmount) > 0 ? 'active' : ''}" data-id="${rec.id}" title="${Number(rec.settleAmount) > 0 ? '정산 수정/확인' : '더치페이/모임 정산 입력'}">
            ${Number(rec.settleAmount) > 0 ? '👥' : '➗'}
          </button>
          <button class="btn-delete-row" data-id="${rec.id}" title="내역 삭제">🗑️</button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    renderPagination(totalPages);
    updateBulkActionUI();
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

        const dateStr = rec.date ? rec.date.substring(5) : '';
        showToast(`[${dateStr} ${rec.merchant}] 카드가 '${newCard}'(으)로 변경되었습니다!`, 'success');
      }
    }

    
  }

  function handleTableClick(e) {
    const target = e.target;

    // 0. Dutch pay / Split payment modal trigger
    const splitBtn = target.closest('.btn-split-row') || target.closest('.badge-settle');
    if (splitBtn) {
      const id = Number(splitBtn.dataset.id);
      openSplitModal(id);
      return;
    }

    // 0-1. Quick Category selector modal trigger
    const catBtn = target.closest('.btn-table-category');
    if (catBtn) {
      const id = Number(catBtn.dataset.id);
      if (id) {
        openQuickCategoryModal(id);
        return;
      }
    }

    // 1. Toggle Exclude (Y / N)
    
    // Toggle Fixed/Variable
    
    if (target.closest('.inst-toggle-btn')) {
      const btn = target.closest('.inst-toggle-btn');
      const id = Number(btn.dataset.id);
      const rec = appState.records.find(r => r.id === id);
      if (rec) {
        if (rec.isInstallment === 'Y') {
          // 할부(Y) -> 일시불(N)로 변경
          rec.isInstallment = 'N';
          rec.installment = '일시불';
          rec.manualInst = 'N'; // 사용자가 직접 일시불로 변경했음을 기록
          if (rec.memo) {
            rec.memo = rec.memo.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)/g, '').replace(/할부/g, '').trim();
          }
          saveData();
          renderAll();
          showToast(`[${rec.merchant}] 일시불(N)로 변경되었습니다.`, 'info');
        } else {
          // 일시불(N) -> 할부(Y)로 변경
          let defaultMonths = 3;
          if (rec.installment && rec.installment.match(/(\d+)\s*개월/)) {
            defaultMonths = parseInt(rec.installment.match(/(\d+)\s*개월/)[1], 10);
          } else if (rec.memo && rec.memo.match(/(\d+)\s*개월/)) {
            defaultMonths = parseInt(rec.memo.match(/(\d+)\s*개월/)[1], 10);
          } else if (rec.memo && rec.memo.match(/\d+\s*\/\s*(\d+)/)) {
            defaultMonths = parseInt(rec.memo.match(/\d+\s*\/\s*(\d+)/)[1], 10);
          }

          const input = prompt(
            `[${rec.merchant}] 할부 개월 수를 입력해 주세요 (예: 2, 3, 5, 6, 12 등):`,
            String(defaultMonths)
          );

          if (input === null) {
            return; // 사용자가 취소한 경우 변경 취소
          }

          const months = parseInt(input, 10) || defaultMonths || 3;
          rec.isInstallment = 'Y';
          rec.installment = `${months}개월`;
          delete rec.manualInst;

          // 메모에 회차 표기 자동 부여 (1/N)
          if (!rec.memo) {
            rec.memo = `할부 (1/${months})`;
          } else if (!rec.memo.match(/\d+\s*\/\s*\d+/)) {
            rec.memo = `${rec.memo.trim()} (1/${months})`;
          }

          showToast(`[${rec.merchant}] ${months}개월 할부(1/${months})로 변경되어 할부 잔액 추적에 즉시 등록되었습니다!`, 'success');
          autoFlagInstallments();
          saveData();
          renderAll();
        }
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
        renderInstallmentTracking();
        updateCharts(getFilteredRecords(true));
        renderTable();
        const logPrefix = `[${rec.date ? rec.date.substring(5) : ''} ${rec.merchant}]`;
        showToast(
          rec.exclude === 'Y'
            ? `${logPrefix} 항목이 통계 및 지출에서 제외(Y) 처리되었습니다.`
            : `${logPrefix} 항목이 다시 통계에 포함(N)되었습니다.`,
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

  // --- Dutch Pay / Split Payment Modal Logic ---
  let currentSplitTxId = null;

  function openSplitModal(id) {
    const rec = appState.records.find(r => r.id === id);
    if (!rec) return;
    currentSplitTxId = id;

    const modal = document.getElementById('modalSplitPayment');
    if (!modal) return;

    const metaEl = document.getElementById('splitTxMeta');
    const merchantEl = document.getElementById('splitTxMerchant');
    const origAmountEl = document.getElementById('splitTxOrigAmount');
    const countInput = document.getElementById('splitCountInput');
    const settleInput = document.getElementById('splitSettleInput');
    const noteInput = document.getElementById('splitNoteInput');
    const previewEl = document.getElementById('splitMySharePreview');
    const btnRemove = document.getElementById('btnRemoveSplit');

    const origAmt = Number(rec.amount) || 0;
    if (metaEl) metaEl.textContent = `${rec.date || ''} ${rec.time || ''} | ${rec.actualCard || '결제수단 미지정'}`;
    if (merchantEl) merchantEl.textContent = rec.merchant || '상호명 없음';
    if (origAmountEl) origAmountEl.textContent = `${formatCurrency(origAmt)}원`;

    if (countInput) countInput.value = '';
    
    // Check existing settle amount or pre-fill from memo
    let existingSettle = Number(rec.settleAmount) || 0;
    let existingNote = rec.settleNote || '';

    if (existingSettle <= 0 && rec.memo) {
      // Auto-detect pattern in memo like '69,454원정산' or '69454원 정산' or '정산 69,454'
      const match = rec.memo.match(/([0-9,]+)\s*원?\s*정산/) || rec.memo.match(/정산\s*([0-9,]+)\s*원?/);
      if (match && match[1]) {
        const parsed = parseInt(match[1].replace(/,/g, ''), 10);
        if (parsed > 0 && parsed < origAmt) {
          existingSettle = parsed;
          if (!existingNote) {
            existingNote = rec.memo.trim();
          }
        }
      }
    }

    if (settleInput) settleInput.value = existingSettle > 0 ? existingSettle : '';
    if (noteInput) noteInput.value = existingNote;

    const myShare = Math.max(0, origAmt - existingSettle);
    if (previewEl) previewEl.textContent = `${formatCurrency(myShare)}원`;

    if (btnRemove) {
      btnRemove.style.display = Number(rec.settleAmount) > 0 ? 'inline-block' : 'none';
    }

    modal.classList.add('show');
    if (settleInput) {
      setTimeout(() => settleInput.focus(), 60);
    }
  }

  function closeSplitModal() {
    const modal = document.getElementById('modalSplitPayment');
    if (modal) modal.classList.remove('show');
    currentSplitTxId = null;
  }

  function handleCalcSplit() {
    if (!currentSplitTxId) return;
    const rec = appState.records.find(r => r.id === currentSplitTxId);
    if (!rec) return;

    const countInput = document.getElementById('splitCountInput');
    const count = parseInt(countInput?.value, 10);
    if (!count || count < 2) {
      showToast('인원수를 2명 이상 입력해주세요.', 'warn');
      countInput?.focus();
      return;
    }

    const origAmt = Number(rec.amount) || 0;
    // 1인당 금액 (내가 낼 몫)
    const myShare = Math.round(origAmt / count);
    // 다른 사람들에게 회수할 총 정산 금액 = 전체 - 내 몫
    const settleAmt = Math.max(0, origAmt - myShare);

    const settleInput = document.getElementById('splitSettleInput');
    const noteInput = document.getElementById('splitNoteInput');
    const previewEl = document.getElementById('splitMySharePreview');

    if (settleInput) settleInput.value = settleAmt;
    if (noteInput && !noteInput.value.trim()) {
      noteInput.value = `${count}명 더치페이 (1인당 ${formatCurrency(myShare)}원)`;
    }
    if (previewEl) previewEl.textContent = `${formatCurrency(myShare)}원`;
    showToast(`총 ${count}명 기준: 1인당 ${formatCurrency(myShare)}원 (정산받을 금액: ${formatCurrency(settleAmt)}원)으로 계산되었습니다.`, 'info');
  }

  function handleSettleInputChange() {
    if (!currentSplitTxId) return;
    const rec = appState.records.find(r => r.id === currentSplitTxId);
    if (!rec) return;

    const origAmt = Number(rec.amount) || 0;
    const settleInput = document.getElementById('splitSettleInput');
    const previewEl = document.getElementById('splitMySharePreview');

    const settleAmt = Math.max(0, Number(settleInput?.value) || 0);
    const myShare = Math.max(0, origAmt - settleAmt);
    if (previewEl) previewEl.textContent = `${formatCurrency(myShare)}원`;
  }

  function handleSaveSplit() {
    if (!currentSplitTxId) return;
    const rec = appState.records.find(r => r.id === currentSplitTxId);
    if (!rec) return;

    const settleInput = document.getElementById('splitSettleInput');
    const noteInput = document.getElementById('splitNoteInput');

    const settleAmt = Math.max(0, Number(settleInput?.value) || 0);
    const note = noteInput ? noteInput.value.trim() : '';
    const origAmt = Number(rec.amount) || 0;

    if (settleAmt >= origAmt && origAmt > 0) {
      if (!confirm(`정산받은 금액(${formatCurrency(settleAmt)}원)이 결제 원금(${formatCurrency(origAmt)}원) 이상입니다. 내가 부담한 금액이 0원이 됩니다. 그대로 저장하시겠습니까?`)) {
        return;
      }
    }

    rec.settleAmount = settleAmt;
    rec.settleNote = note;

    saveData();
    closeSplitModal();
    renderAll();

    if (settleAmt > 0) {
      showToast(`[${rec.merchant}] 정산 내역이 저장되었습니다! (정산: ${formatCurrency(settleAmt)}원 / 실부담: ${formatCurrency(origAmt - settleAmt)}원)`, 'success');
    } else {
      showToast(`[${rec.merchant}] 정산 금액이 0원으로 설정되었습니다.`, 'info');
    }
  }

  function handleRemoveSplit() {
    if (!currentSplitTxId) return;
    const rec = appState.records.find(r => r.id === currentSplitTxId);
    if (!rec) return;

    if (confirm('이 거래의 정산 설정을 해제(초기화)하시겠습니까?')) {
      rec.settleAmount = 0;
      rec.settleNote = '';
      saveData();
      closeSplitModal();
      renderAll();
      showToast(`[${rec.merchant}] 정산 설정이 초기화되었습니다.`, 'info');
    }
  }

  // --- Quick Category Selector Logic (스크롤 없는 원터치 분류 선택기) ---
  const CATEGORY_ICONS = {
    '식비': '🍚',
    '카페/간식': '☕',
    '생활용품': '🛒',
    '쇼핑': '🛍️',
    '온라인쇼핑': '📦',
    '패션/쇼핑': '👗',
    '패션/쇼핑/미용': '👗',
    '미용/패션': '💄',
    '교통/차량': '🚌',
    '주거/통신': '🏠',
    '고정비': '🔒',
    '리뷰비': '📝',
    '계원': '🤝',
    '건강/의료': '💊',
    '의료/건강': '🏥',
    '문화/여가': '🎬',
    '술/유흥': '🍺',
    '교육': '📚',
    '경조사/회비': '💌',
    '금융/보험': '🏦',
    '기타': '✨',
    '미분류': '❓'
  };

  let currentQuickCatTargetIds = [];
  let quickCatSelectedMain = '';

  function openQuickCategoryModal(txIds) {
    if (!Array.isArray(txIds)) txIds = [txIds];
    currentQuickCatTargetIds = txIds;
    if (currentQuickCatTargetIds.length === 0) return;

    const modal = document.getElementById('modalQuickCategory');
    const targetInfo = document.getElementById('quickCatTargetInfo');
    const grid = document.getElementById('quickMainCategoryGrid');
    const subSection = document.getElementById('quickSubCategorySection');

    if (!modal || !grid) return;

    let initialMain = '';
    let initialSub = '';

    if (currentQuickCatTargetIds.length === 1) {
      const rec = appState.records.find(r => r.id === currentQuickCatTargetIds[0]);
      if (rec) {
        initialMain = rec.category || '';
        initialSub = rec.subCategory || '';
        const amtStr = formatCurrency(Number(rec.amount) || 0);
        targetInfo.innerHTML = `<strong>${rec.merchant || '상호명 없음'}</strong> · ${amtStr}원 <span style="color:var(--text-muted); margin-left:6px;">(현재: <span style="color:var(--primary); font-weight:600;">${rec.category || '미분류'}${rec.subCategory ? ` > ${rec.subCategory}` : ''}</span>)</span>`;
      }
    } else {
      targetInfo.innerHTML = `<strong style="color:var(--primary); font-size: 0.95rem;">${currentQuickCatTargetIds.length}개</strong>의 선택된 항목 분류를 일괄 변경합니다.`;
    }

    quickCatSelectedMain = initialMain;
    renderQuickMainCategories(initialMain);

    if (initialMain && appState.masterCategories[initialMain] && appState.masterCategories[initialMain].length > 0) {
      renderQuickSubCategories(initialMain, initialSub);
      if (subSection) subSection.style.display = 'block';
    } else {
      if (subSection) subSection.style.display = 'none';
    }

    modal.classList.add('show');
  }

  function closeQuickCategoryModal() {
    const modal = document.getElementById('modalQuickCategory');
    if (modal) modal.classList.remove('show');
    currentQuickCatTargetIds = [];
    quickCatSelectedMain = '';
  }

  function renderQuickMainCategories(activeCat) {
    const grid = document.getElementById('quickMainCategoryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const allCats = Object.keys(appState.masterCategories || {}).sort((a, b) => a.localeCompare(b, 'ko'));
    allCats.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `quick-cat-btn ${cat === activeCat ? 'active' : ''}`;
      const icon = CATEGORY_ICONS[cat] || '🏷️';
      btn.innerHTML = `<span class="icon">${icon}</span><span>${cat}</span>`;
      btn.addEventListener('click', () => {
        quickCatSelectedMain = cat;
        grid.querySelectorAll('.quick-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const subCats = appState.masterCategories[cat] || [];
        if (subCats.length > 0) {
          renderQuickSubCategories(cat, '');
          const subSection = document.getElementById('quickSubCategorySection');
          if (subSection) subSection.style.display = 'block';
        } else {
          // If no subcategories, apply immediately!
          applyCategorySelection(cat, '');
        }
      });
      grid.appendChild(btn);
    });

    // '+ 대분류 추가' 버튼
    const addMainBtn = document.createElement('button');
    addMainBtn.type = 'button';
    addMainBtn.className = 'quick-cat-btn';
    addMainBtn.style.borderStyle = 'dashed';
    addMainBtn.style.color = 'var(--text-muted)';
    addMainBtn.innerHTML = `<span class="icon">➕</span><span>대분류 추가</span>`;
    addMainBtn.addEventListener('click', () => {
      const newCat = prompt('추가할 새 대분류 이름을 입력하세요:');
      if (newCat && newCat.trim()) {
        const val = newCat.trim();
        const existingKey = Object.keys(appState.masterCategories || {}).find(
          k => k.trim().toLowerCase() === val.toLowerCase()
        );
        if (existingKey) {
          showToast(`'${existingKey}'은(는) 이미 등록되어 있는 대분류입니다.`, 'warn');
          quickCatSelectedMain = existingKey;
          renderQuickMainCategories(existingKey);
          return;
        }
        if (!appState.masterCategories) appState.masterCategories = {};
        appState.masterCategories[val] = [];
        appState.activeManageMainCat = val;
        saveMasterCategories();
        populateFilterDropdowns();
        renderAll();
        renderQuickMainCategories(val);
        applyCategorySelection(val, '');
        showToast(`새 대분류 '${val}'가 추가 및 적용되었습니다.`, 'success');
      }
    });
    grid.appendChild(addMainBtn);
  }

  function renderQuickSubCategories(mainCat, activeSub) {
    const subNameEl = document.getElementById('quickSelectedMainName');
    const chipsContainer = document.getElementById('quickSubCategoryChips');
    if (subNameEl) subNameEl.textContent = mainCat;
    if (!chipsContainer) return;
    chipsContainer.innerHTML = '';

    const subCats = [...(appState.masterCategories[mainCat] || [])].sort((a, b) => a.localeCompare(b, 'ko'));

    // 1. "대분류만 (소분류 없음)" Chip
    const noneChip = document.createElement('button');
    noneChip.type = 'button';
    noneChip.className = `quick-sub-chip ${!activeSub ? 'active' : ''}`;
    noneChip.innerHTML = `✓ ${mainCat} (전체)`;
    noneChip.addEventListener('click', () => {
      applyCategorySelection(mainCat, '');
    });
    chipsContainer.appendChild(noneChip);

    // 2. Subcategory chips
    subCats.forEach(sub => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `quick-sub-chip ${sub === activeSub ? 'active' : ''}`;
      chip.textContent = sub;
      chip.addEventListener('click', () => {
        applyCategorySelection(mainCat, sub);
      });
      chipsContainer.appendChild(chip);
    });

    // 3. "+ 직접 입력" Chip
    const addChip = document.createElement('button');
    addChip.type = 'button';
    addChip.className = 'quick-sub-chip';
    addChip.style.borderStyle = 'dashed';
    addChip.style.color = 'var(--text-muted)';
    addChip.textContent = '+ 직접 입력';
    addChip.addEventListener('click', () => {
      const newSub = prompt(`'${mainCat}' 대분류에 추가할 새 소분류 이름을 입력하세요:`);
      if (newSub && newSub.trim()) {
        const trimmed = newSub.trim();
        if (!appState.masterCategories[mainCat].includes(trimmed)) {
          appState.masterCategories[mainCat].push(trimmed);
          saveMasterCategories();
          populateFilterDropdowns();
        }
        applyCategorySelection(mainCat, trimmed);
      }
    });
    chipsContainer.appendChild(addChip);
  }

  function applyCategorySelection(mainCat, subCat) {
    if (!currentQuickCatTargetIds || currentQuickCatTargetIds.length === 0) return;

    let updatedCount = 0;
    currentQuickCatTargetIds.forEach(id => {
      const rec = appState.records.find(r => r.id === id);
      if (rec) {
        rec.category = mainCat;
        rec.subCategory = subCat || '';
        checkFixedCategory(rec);
        updatedCount++;
      }
    });

    saveData();
    renderAll();
    closeQuickCategoryModal();

    if (updatedCount === 1) {
      const subText = subCat ? ` > ${subCat}` : '';
      showToast(`분류가 '${mainCat}${subText}'(으)로 변경되었습니다.`, 'success');
    } else {
      const subText = subCat ? ` > ${subCat}` : '';
      showToast(`${updatedCount}건의 분류가 '${mainCat}${subText}'(으)로 일괄 변경되었습니다.`, 'success');
    }
  }

  // --- Attach Event Listeners ---
  function attachEventListeners() {
    initMainViewTabs();
    initAnnualTaxViewControls();

    // Theme Toggle
    document.getElementById('btnThemeToggle')?.addEventListener('click', toggleTheme);

    // Modal: Dutch Pay / Split Payment
    document.getElementById('btnCloseSplitModal')?.addEventListener('click', closeSplitModal);
    document.getElementById('btnCancelSplit')?.addEventListener('click', closeSplitModal);
    document.getElementById('modalSplitPayment')?.addEventListener('click', e => {
      if (e.target.id === 'modalSplitPayment') closeSplitModal();
    });
    document.getElementById('splitSettleInput')?.addEventListener('input', handleSettleInputChange);
    document.getElementById('btnCalcSplit')?.addEventListener('click', handleCalcSplit);
    document.getElementById('splitCountInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCalcSplit();
      }
    });
    document.getElementById('btnSaveSplit')?.addEventListener('click', handleSaveSplit);
    document.getElementById('btnRemoveSplit')?.addEventListener('click', handleRemoveSplit);

    // Modal: Quick Category Selector (스크롤 없는 원터치 분류 선택기)
    document.getElementById('btnCloseQuickCatModal')?.addEventListener('click', closeQuickCategoryModal);
    document.getElementById('btnCancelQuickCat')?.addEventListener('click', closeQuickCategoryModal);
    document.getElementById('modalQuickCategory')?.addEventListener('click', e => {
      if (e.target.id === 'modalQuickCategory') closeQuickCategoryModal();
    });
    document.getElementById('btnApplyMainOnly')?.addEventListener('click', () => {
      if (quickCatSelectedMain) {
        applyCategorySelection(quickCatSelectedMain, '');
      }
    });
    document.getElementById('btnBulkChangeCategory')?.addEventListener('click', () => {
      const checkedBoxes = document.querySelectorAll('.row-check:checked');
      if (checkedBoxes.length === 0) {
        showToast('분류를 일괄 변경할 항목을 체크박스로 먼저 선택해주세요.', 'warn');
        return;
      }
      const ids = Array.from(checkedBoxes).map(cb => Number(cb.dataset.id)).filter(Boolean);
      openQuickCategoryModal(ids);
    });

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
        else if (tab === 'settlements') {
          document.getElementById('chartViewSettlements')?.classList.add('active');
          renderSettlementsVisual(getFilteredRecords(true));
        }
        saveUIState();
      });
    });

    // Chart Settle Mode Toggle (👥 실부담 기준 vs 💳 결제 원금 기준)
    document.getElementById('btnChartSettleNet')?.addEventListener('click', () => {
      if (appState.chartSettleMode !== 'net') {
        appState.chartSettleMode = 'net';
        updateCharts(getFilteredRecords(true));
        saveUIState();
        showToast('차트가 [실부담액(정산 차감) 기준]으로 전환되었습니다.', 'info');
      }
    });

    document.getElementById('btnChartSettleGross')?.addEventListener('click', () => {
      if (appState.chartSettleMode !== 'gross') {
        appState.chartSettleMode = 'gross';
        updateCharts(getFilteredRecords(true));
        saveUIState();
        showToast('차트가 [결제 원금 기준]으로 전환되었습니다.', 'info');
      }
    });

    // Global Month Filter
    document.getElementById('globalMonthFilter')?.addEventListener('change', (e) => {
      appState.globalMonth = e.target.value;
      appState.currentPage = 1;
      renderAll();
      showToast(appState.globalMonth === 'ALL' ? '전체 월 지출을 표시합니다.' : `${appState.globalMonth} 지출을 표시합니다.`);
    });

    // Quick Banner / KPI Filter buttons
    function executeAutoMapPayments() {
      const merchantCardFreq = {};
      appState.records.forEach(r => {
        const isPhysical = CARD_CONFIG[r.actualCard] && CARD_CONFIG[r.actualCard].type === 'physical';
        if (isPhysical && r.merchant) {
          const m = r.merchant.trim();
          if (!merchantCardFreq[m]) merchantCardFreq[m] = {};
          merchantCardFreq[m][r.actualCard] = (merchantCardFreq[m][r.actualCard] || 0) + 1;
        }
      });

      const currentMonthRecs = appState.globalMonth === 'ALL' 
        ? appState.records 
        : appState.records.filter(r => r.month === appState.globalMonth);

      const candidates = [];
      currentMonthRecs.forEach(r => {
        // 현금, 실물 카드, 은행 계좌를 제외한 오직 순수 간편결제만 자동 매핑 후보 대상!
        if (isSimplePay(r.actualCard) && r.merchant) {
          const m = r.merchant.trim();
          const freq = merchantCardFreq[m];
          if (freq) {
            let bestCard = null;
            let maxCount = 0;
            for (const c in freq) {
              if (freq[c] > maxCount) {
                maxCount = freq[c];
                bestCard = c;
              }
            }
            if (bestCard) {
              candidates.push({
                record: r,
                suggestedCard: bestCard,
                prevCard: r.actualCard || '간편결제'
              });
            }
          }
        }
      });

      if (candidates.length === 0) {
        alert('이전 결제 이력과 매칭되는 동일 가맹점 간편결제 내역이 없습니다.\n\n[내역 모아보기 & 이동] 버튼을 눌러 테이블에서 직접 실물 카드를 선택해주세요. 한 번만 카드를 지정해 두시면 다음부터는 해당 패턴으로 자동 연결됩니다! 👍');
        return;
      }

      let confirmMsg = `⚡ 총 ${candidates.length}건의 간편결제를 이전 결제 카드와 자동으로 연결할 수 있습니다!\n\n[자동 연결 예정 항목]\n`;
      const showLimit = 8;
      candidates.slice(0, showLimit).forEach(c => {
        const d = c.record.date ? c.record.date.substring(5) : '';
        confirmMsg += `• [${d} ${c.record.merchant}] ${c.prevCard} ➔ ${c.suggestedCard}\n`;
      });
      if (candidates.length > showLimit) {
        confirmMsg += `... 외 ${candidates.length - showLimit}건\n`;
      }
      confirmMsg += `\n위 항목들을 지금 실물 카드로 자동 연결하시겠습니까?`;

      if (confirm(confirmMsg)) {
        candidates.forEach(c => {
          c.record.actualCard = c.suggestedCard;
        });
        saveData();
        renderKPIs();
        renderCardsBreakdown();
        updateCharts(getFilteredRecords(true));
        renderTable();
        showToast(`총 ${candidates.length}건의 간편결제가 실물 카드로 자동 연결되었습니다! 🎉`, 'success');
      }
    }

    document.getElementById('btnBannerAutoMap')?.addEventListener('click', () => {
      executeAutoMapPayments();
    });

    document.getElementById('btnBannerFilter')?.addEventListener('click', () => {
      appState.filterCard = 'UNMAPPED';
      const sel = document.getElementById('filterCard');
      if (sel) sel.value = 'UNMAPPED';
      appState.currentPage = 1;
      renderCardsBreakdown();
      renderTable();
      const filtered = getFilteredRecords(false);
      showToast(`⚡ 실물 카드가 미지정된 간편결제 내역 ${filtered.length}건으로 이동했습니다. (현금/계좌 제외)`, 'info');

      // 지출 상세 테이블로 부드럽게 자동 스크롤
      const txTableSec = document.querySelector('.table-section') || document.getElementById('txTableContainer');
      txTableSec?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('btnFilterFixed')?.addEventListener('click', () => {
      appState.filterType = 'Y';
      document.getElementById('filterType').value = 'Y';
      appState.currentPage = 1;
      renderTable();
      const fixedCount = appState.records.filter(r => r.exclude !== 'Y' && (r.isFixed === 'Y' || r.category === '고정비')).length;
      showToast(`고정비 내역 ${fixedCount}건을 표시합니다.`, 'info');
    });

    document.getElementById('btnFilterReview')?.addEventListener('click', () => {
      appState.filterType = '리뷰비';
      document.getElementById('filterType').value = '리뷰비';
      appState.currentPage = 1;
      renderTable();
      const reviewCats = appState.customTypes['리뷰비'] || [];
      const reviewCount = appState.records.filter(r => r.exclude !== 'Y' && reviewCats.includes(r.category)).length;
      showToast(`리뷰비 내역 ${reviewCount}건을 표시합니다.`, 'info');
    });

    document.getElementById('btnFilterExcluded')?.addEventListener('click', () => {
      appState.filterExclude = 'N';
      document.getElementById('filterExclude').value = 'N';
      appState.currentPage = 1;
      renderTable();
      showToast('미완료(N)된 항목만 표시합니다.');
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
      updateCharts(getFilteredRecords(true));
      renderTable();
      if (appState.filterCategory === 'ALL') {
        showToast('전체 카테고리 내역을 표시합니다.', 'info');
      } else {
        showToast(`'${appState.filterCategory}' 카테고리 내역 필터가 적용되었습니다.`, 'info');
      }
    });

    document.getElementById('filterType')?.addEventListener('change', e => {
      appState.filterType = e.target.value;
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
      appState.filterType = 'ALL';
      appState.filterExclude = 'ALL';
      appState.filterInstallment = 'ALL';
      if (appState.chartExcludedCategories) {
        appState.chartExcludedCategories.clear();
        saveLocalCache();
      }
      if (searchInput) searchInput.value = '';
      if (btnClearSearch) btnClearSearch.style.display = 'none';
      document.getElementById('filterCard').value = 'ALL';
      document.getElementById('filterCategory').value = 'ALL';
      document.getElementById('filterType').value = 'ALL';
      document.getElementById('filterExclude').value = 'ALL';
      document.getElementById('filterInstallment').value = 'ALL';
      appState.currentPage = 1;
      renderCardsBreakdown();
      updateCharts(getFilteredRecords(true));
      renderTable();
      showToast('모든 필터 및 제외 설정이 초기화되었습니다.');
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

    document.getElementById('txTable')?.addEventListener('change', e => {
      if (e.target.id === 'selectAllRows') {
        const isChecked = e.target.checked;
        document.querySelectorAll('.row-check').forEach(cb => {
          cb.checked = isChecked;
        });
        updateBulkActionUI();
      } else if (e.target.classList.contains('row-check')) {
        updateBulkActionUI();
      }
    });

    document.getElementById('btnBulkComplete')?.addEventListener('click', () => {
      const checkedBoxes = document.querySelectorAll('.row-check:checked');
      if (checkedBoxes.length === 0) return;

      let updatedCount = 0;
      checkedBoxes.forEach(cb => {
        const id = Number(cb.dataset.id);
        const rec = appState.records.find(r => r.id === id);
        if (rec && rec.exclude !== 'Y') {
          rec.exclude = 'Y';
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        saveData();
        renderAll();
        showToast(`${updatedCount}건의 내역이 결제 완료로 변경되었습니다.`, 'success');
        const selectAll = document.getElementById('selectAllRows');
        if (selectAll) selectAll.checked = false;
        updateBulkActionUI();
      } else {
        showToast('이미 결제 완료 상태인 항목만 선택되었습니다.', 'info');
      }
    });

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
              const subCats = [...(appState.masterCategories[rec.category] || [])].sort();
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
          const dateStr = rec.date ? rec.date.substring(5) : '';
          showToast(`[${dateStr} ${rec.merchant}] 카테고리가 변경되었습니다.`);
        }
      }
    });

    // Table Memo Inline Edit
    tableBody?.addEventListener('blur', e => {
      if (e.target.matches('.input-table-memo')) {
        const id = Number(e.target.dataset.id);
        const val = e.target.value.trim();
        const rec = appState.records.find(r => r.id === id);
        if (rec && rec.memo !== val) {
          rec.memo = val;

          // 메모에 할부 또는 회차(N/M), 개월 수가 포함되어 있으면 즉시 할부(Y) 플래그 활성화
          const isInstMemo = val.includes('할부') || /\d+\s*\/\s*\d+/.test(val) || /\d+\s*개월/.test(val);
          if (isInstMemo && rec.isInstallment !== 'Y') {
            rec.isInstallment = 'Y';
            const monMatch = val.match(/\d+\s*\/\s*(\d+)/) || val.match(/(\d+)\s*개월/);
            if (monMatch) {
              rec.installment = `${monMatch[1]}개월`;
            }
          }

          autoFlagInstallments();
          saveData();
          renderAll();
          showToast('메모가 저장되었으며 대시보드 및 할부 현황에 즉시 반영되었습니다.', 'success');
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
      const time = "12:00:00";
      const category = document.getElementById('newCategory').value;
      const subCategory = document.getElementById('newSubCategory').value;
      const merchant = document.getElementById('newMerchant').value;
      const amount = Number(document.getElementById('newAmount').value) || 0;
      const origPay = '수동입력';
      const actualCard = document.getElementById('newActualCard').value;
      const isInstallment = document.getElementById('newInstallment').value === 'Y' ? 'Y' : 'N';
      let memo = document.getElementById('newMemo').value.trim();
      let installmentVal = isInstallment === 'Y' ? '3개월' : '일시불';

      if (isInstallment === 'Y') {
        const m = memo.match(/\d+\s*\/\s*(\d+)/) || memo.match(/(\d+)\s*개월/);
        if (m) {
          installmentVal = `${m[1]}개월`;
        } else {
          memo = memo ? `${memo} (1/3)` : '할부 (1/3)';
        }
      }

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
        installment: installmentVal,
        exclude: 'N',
        memo: memo
      };

      applyCategoryRules([newRecord]);
      checkFixedCategory(newRecord);
      appState.records.unshift(newRecord);
      autoFlagInstallments();
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

    // Auto Match Installments Guide & Sync Modal Flow
    const autoInstModal = document.getElementById('autoInstallmentModal');
    const btnAutoInstallment = document.getElementById('btnAutoInstallment');
    const btnCloseAutoInstModal = document.getElementById('btnCloseAutoInstModal');
    const btnCloseAutoInstModalBottom = document.getElementById('btnCloseAutoInstModalBottom');
    const btnDetectInstallments = document.getElementById('btnDetectInstallments');
    const instSyncPreviewArea = document.getElementById('instSyncPreviewArea');

    function openAutoInstallmentModal() {
      if (instSyncPreviewArea) {
        instSyncPreviewArea.innerHTML = `
          <div style="text-align: center; padding: 22px 14px; background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-sm); color: var(--text-muted); font-size: 0.88rem; line-height: 1.6;">
            🔍 아래 <strong>[할부 동기화 대상 감지 및 미리보기]</strong> 버튼을 누르면,<br>
            현재 내역 중 조건에 맞는 할부 내역을 분석하여 <strong>어떤 내역이 어떻게 변경되는지</strong> 사전에 확인하고 동기화할 수 있습니다.
          </div>
        `;
      }
      autoInstModal?.classList.add('show');
    }

    btnAutoInstallment?.addEventListener('click', openAutoInstallmentModal);
    btnCloseAutoInstModal?.addEventListener('click', () => autoInstModal?.classList.remove('show'));
    btnCloseAutoInstModalBottom?.addEventListener('click', () => autoInstModal?.classList.remove('show'));

    btnDetectInstallments?.addEventListener('click', () => {
      const sortedRecords = [...appState.records].sort((a, b) => new Date(a.date) - new Date(b.date));
      let pendingChanges = [];

      appState.records.forEach(current => {
        if (current.amount > 0) {
          const prev = sortedRecords.filter(r => 
            r.merchant === current.merchant && 
            r.amount === current.amount && 
            r.isInstallment === 'Y' && 
            new Date(r.date) < new Date(current.date)
          ).pop();

          if (prev && (current.isInstallment !== 'Y' || current.memo === prev.memo || !current.memo || !current.memo.includes('/'))) {
            let nextMemo = current.memo;
            if (prev.memo) {
              const fractionMatch = prev.memo.match(/(.*?)(\d+)(\s*\/\s*\d+)(.*)/);
              if (fractionMatch) {
                nextMemo = `${fractionMatch[1]}${parseInt(fractionMatch[2], 10) + 1}${fractionMatch[3]}${fractionMatch[4]}`;
              } else {
                const match = prev.memo.match(/(.*?)(\d+)([^\d]*)$/);
                if (match) {
                  nextMemo = `${match[1]}${parseInt(match[2], 10) + 1}${match[3]}`;
                } else {
                  nextMemo = prev.memo;
                }
              }
            }
            
            // Only push if there's actually a change to be made
            if (current.isInstallment !== 'Y' || current.memo !== nextMemo || current.category !== prev.category || current.actualCard !== prev.actualCard) {
              pendingChanges.push({
                record: current,
                prev: prev,
                newMemo: nextMemo
              });
            }
          }
        }
      });

      if (!instSyncPreviewArea) return;

      if (pendingChanges.length === 0) {
        instSyncPreviewArea.innerHTML = `
          <div style="background: rgba(148, 163, 184, 0.08); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: var(--radius-sm); padding: 18px; text-align: center;">
            <div style="font-size: 1.2rem; margin-bottom: 6px;">ℹ️</div>
            <strong style="color: var(--text-primary); font-size: 0.95rem;">현재 동기화할 수 있는 새로운 할부 매칭 항목이 없습니다.</strong>
            <p style="color: var(--text-muted); font-size: 0.82rem; margin: 8px 0 0 0; line-height: 1.5;">
              모든 할부 결제가 이미 동기화되었거나, 이전 달에 '할부(Y)'로 등록된 건과 가맹점명 및 결제금액이 동일한 내역이 없습니다.<br>
              이전 달의 시작 내역에 <strong>'할부(Y)'</strong>와 <strong>'1/N회'</strong> 메모가 적혀있는지 확인해주세요.
            </p>
          </div>
        `;
        return;
      }

      let html = `
        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
          <strong style="color: var(--primary-color); font-size: 0.95rem;">
            📋 총 ${pendingChanges.length}건의 할부 동기화 대상이 감지되었습니다.
          </strong>
          <span style="font-size: 0.78rem; color: var(--text-muted);">변경 내용을 확인 후 아래 적용 버튼을 눌러주세요.</span>
        </div>
        <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
      `;

      pendingChanges.forEach((c, idx) => {
        const d = c.record.date ? c.record.date.substring(5) : '';
        const prevMemoStr = c.record.memo || '(메모 없음)';
        const oldCatStr = c.record.category ? `${c.record.category}${c.record.subCategory ? ` > ${c.record.subCategory}` : ''}` : '(미분류)';
        const newCatStr = c.prev.category ? `${c.prev.category}${c.prev.subCategory ? ` > ${c.prev.subCategory}` : ''}` : '(미분류)';

        html += `
          <div class="inst-preview-card">
            <div class="inst-preview-header">
              <span style="font-weight: 600; color: var(--text-primary);">
                ${idx + 1}. [${d}] ${c.record.merchant}
              </span>
              <span style="font-weight: 700; color: var(--danger-color, #ef4444); font-family: 'Outfit', sans-serif;">
                ${formatCurrency(c.record.amount)}원
              </span>
            </div>
            <div class="inst-preview-diff">
              <div>
                <span style="color: var(--text-muted);">할부 상태:</span>
                <span>${c.record.isInstallment === 'Y' ? '할부(Y)' : '일시불(N)'}</span>
                <span class="diff-arrow">➔</span>
                <strong style="color: #10b981;">할부(Y)</strong>
              </div>
              <div>
                <span style="color: var(--text-muted);">회차 메모:</span>
                <span>'${prevMemoStr}'</span>
                <span class="diff-arrow">➔</span>
                <strong style="color: var(--primary-color);">'${c.newMemo}'</strong>
              </div>
              <div style="grid-column: 1 / -1;">
                <span style="color: var(--text-muted);">카테고리:</span>
                <span>${oldCatStr}</span>
                <span class="diff-arrow">➔</span>
                <strong style="color: var(--text-primary);">${newCatStr}</strong>
                ${c.record.actualCard !== c.prev.actualCard ? `
                  <span style="margin-left: 10px; color: var(--text-muted);">카드:</span>
                  <span>${c.record.actualCard || '-'}</span>
                  <span class="diff-arrow">➔</span>
                  <strong style="color: var(--text-primary);">${c.prev.actualCard}</strong>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      });

      html += `
        </div>
        <button type="button" id="btnApplyInstSync" class="btn btn-primary" style="width: 100%; padding: 12px; margin-top: 14px; font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>✅</span> 위 ${pendingChanges.length}건의 내역을 할부로 동기화 적용하기
        </button>
      `;

      instSyncPreviewArea.innerHTML = html;

      document.getElementById('btnApplyInstSync')?.addEventListener('click', async () => {
        if (!confirm(`총 ${pendingChanges.length}건의 지출 내역을 할부로 동기화하시겠습니까?\n(동기화 시 할부 여부, 회차 메모, 카테고리가 일괄 갱신됩니다.)`)) {
          return;
        }

        pendingChanges.forEach(c => {
          c.record.isInstallment = 'Y';
          c.record.installment = c.prev.installment || '3개월';
          c.record.category = c.prev.category;
          c.record.subCategory = c.prev.subCategory;
          c.record.actualCard = c.prev.actualCard;
          c.record.memo = c.newMemo;
          delete c.record.manualInst;
        });

        await saveData();
        renderAll();
        autoInstModal?.classList.remove('show');
        showToast(`🎉 총 ${pendingChanges.length}건의 할부 결제가 성공적으로 동기화되었습니다!`, 'success');
      });
    });

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
      const dateVal = document.getElementById('ruleDate').value.trim();
      const ruleDate = dateVal ? Number(dateVal) : null;
      const category = document.getElementById('ruleCategory').value.trim();
      const subCategory = document.getElementById('ruleSubCategory').value.trim();
      
      if (!keyword || !category) return;
      
      const editId = e.target.dataset.editId;
      if (editId) {
        const id = Number(editId);
        const ruleIdx = appState.categoryRules.findIndex(r => r.id === id);
        if (ruleIdx > -1) {
          appState.categoryRules[ruleIdx] = { id, keyword, amount, ruleDate, category, subCategory };
        }
        delete e.target.dataset.editId;
        const btn = document.getElementById('ruleSubmitBtn');
        if (btn) btn.textContent = '추가';
        showToast(`'${keyword}' 규칙이 수정되었습니다.`, 'success');
      } else {
        appState.categoryRules.push({ id: Date.now(), keyword, amount, ruleDate, category, subCategory });
        showToast(`'${keyword}' 규칙이 추가되었습니다.`, 'success');
      }
      
      saveRules();
      renderRulesTable();
      e.target.reset();
    });

    document.getElementById('rulesTableBody')?.addEventListener('click', e => {
      if (e.target.closest('.btn-delete-rule')) {
        const id = Number(e.target.closest('.btn-delete-rule').dataset.id);
        appState.categoryRules = appState.categoryRules.filter(r => r.id !== id);
        supabase.from('category_rules').delete().eq('id', id); // background
        renderRulesTable();
        showToast('규칙이 삭제되었습니다.');
      }
      if (e.target.closest('.btn-edit-rule')) {
        const id = Number(e.target.closest('.btn-edit-rule').dataset.id);
        const rule = appState.categoryRules.find(r => r.id === id);
        if (rule) {
          document.getElementById('ruleKeyword').value = rule.keyword;
          document.getElementById('ruleAmount').value = rule.amount || '';
          document.getElementById('ruleDate').value = rule.ruleDate || '';
          document.getElementById('ruleCategory').value = rule.category;
          updateSubCategoryOptions(document.getElementById('ruleCategory'), 'ruleSubCategory');
          document.getElementById('ruleSubCategory').value = rule.subCategory || '';
          
          document.getElementById('newRuleForm').dataset.editId = rule.id;
          const btn = document.getElementById('ruleSubmitBtn');
          if (btn) btn.textContent = '수정';
          document.getElementById('ruleKeyword').focus();
        }
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

    let ruleSortConfig = { key: 'id', dir: 'desc' };

    function renderRulesTable() {
      const tbody = document.getElementById('rulesTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (appState.categoryRules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">등록된 규칙이 없습니다.</td></tr>';
        return;
      }

      // Update header indicators
      document.querySelectorAll('.rule-sort-header').forEach(th => {
        const span = th.querySelector('span');
        if (span) {
          if (th.dataset.sort === ruleSortConfig.key) {
            span.textContent = ruleSortConfig.dir === 'asc' ? '↑' : '↓';
            span.style.color = 'var(--primary-color)';
          } else {
            span.textContent = '↕';
            span.style.color = 'var(--text-muted)';
          }
        }
      });

      const sortedRules = [...appState.categoryRules].sort((a, b) => {
        let valA = a[ruleSortConfig.key] || '';
        let valB = b[ruleSortConfig.key] || '';
        if (ruleSortConfig.key === 'keyword' || ruleSortConfig.key === 'category' || ruleSortConfig.key === 'subCategory') {
          valA = valA.toString().toLowerCase();
          valB = valB.toString().toLowerCase();
          if (valA < valB) return ruleSortConfig.dir === 'asc' ? -1 : 1;
          if (valA > valB) return ruleSortConfig.dir === 'asc' ? 1 : -1;
          return 0;
        }
        return ruleSortConfig.dir === 'asc' ? valA - valB : valB - valA;
      });

      sortedRules.forEach(rule => {
        const tr = document.createElement('tr');
        const amountDisplay = rule.amount ? formatCurrency(rule.amount) + '원' : '<span style="color:var(--text-muted);font-size:0.8rem;">(무관)</span>';
        const dateDisplay = rule.ruleDate ? rule.ruleDate + '일' : '<span style="color:var(--text-muted);font-size:0.8rem;">(무관)</span>';
        tr.innerHTML = `
          <td style="padding: 10px;">${rule.keyword}</td>
          <td style="padding: 10px; text-align: right;">${amountDisplay}</td>
          <td style="padding: 10px; text-align: center;">${dateDisplay}</td>
          <td style="padding: 10px;"><span class="badge-cat">${rule.category}</span></td>
          <td style="padding: 10px;">${rule.subCategory || '-'}</td>
          <td style="padding: 10px; text-align: center;">
            <button type="button" class="btn-edit-rule" data-id="${rule.id}" title="수정" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:var(--text-muted); margin-right:6px;">✏️</button>
            <button type="button" class="btn-delete-rule" data-id="${rule.id}" title="삭제" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:var(--text-muted);">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    document.querySelectorAll('.rule-sort-header').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (ruleSortConfig.key === key) {
          ruleSortConfig.dir = ruleSortConfig.dir === 'asc' ? 'desc' : 'asc';
        } else {
          ruleSortConfig.key = key;
          ruleSortConfig.dir = 'asc';
        }
        renderRulesTable();
      });
    });

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
      const mainCats = Object.keys(appState.masterCategories).sort();
      if (!appState.activeManageMainCat || !appState.masterCategories[appState.activeManageMainCat]) {
        appState.activeManageMainCat = mainCats.length > 0 ? mainCats[0] : null;
      }
      renderManageMainCategories();
      renderManageSubCategories();
      manageModal.classList.add('show');
    });

    const closeCategoryModal = () => {
      manageModal.classList.remove('show');
      populateFilterDropdowns();
      renderAll();
    };

    document.getElementById('btnCloseCategoryManageModal')?.addEventListener('click', closeCategoryModal);
    document.getElementById('btnDoneCategoryManageModal')?.addEventListener('click', closeCategoryModal);

    document.getElementById('newMainCategoryForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const inputEl = document.getElementById('newMainCategoryName');
      const val = inputEl ? inputEl.value.trim() : '';
      if (!val) {
        showToast('대분류 이름을 입력해주세요.', 'warn');
        return;
      }
      
      // 기존 대분류와 공백/대소문자 무시 비교
      const existingKey = Object.keys(appState.masterCategories || {}).find(
        k => k.trim().toLowerCase() === val.toLowerCase()
      );

      if (existingKey) {
        showToast(`'${existingKey}'은(는) 이미 등록되어 있는 대분류입니다.`, 'warn');
        appState.activeManageMainCat = existingKey;
        renderManageMainCategories();
        renderManageSubCategories();
        return;
      }

      if (!appState.masterCategories) appState.masterCategories = {};
      appState.masterCategories[val] = [];
      appState.activeManageMainCat = val;
      
      saveMasterCategories();
      populateFilterDropdowns();
      renderAll();
      renderManageMainCategories();
      renderManageSubCategories();
      e.target.reset();
      showToast(`대분류 '${val}'가 추가되었습니다.`, 'success');
    });

    document.getElementById('newSubCategoryForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const mainCat = appState.activeManageMainCat;
      const inputEl = document.getElementById('newSubCategoryName');
      const val = inputEl ? inputEl.value.trim() : '';
      
      if (!mainCat) {
        showToast('소분류를 추가할 대분류를 먼저 선택해주세요.', 'warn');
        return;
      }
      if (!val) {
        showToast('소분류 이름을 입력해주세요.', 'warn');
        return;
      }

      const currentSubList = appState.masterCategories[mainCat] || [];
      const existingSub = currentSubList.find(
        s => s.trim().toLowerCase() === val.toLowerCase()
      );

      if (existingSub) {
        showToast(`'${mainCat}'에 이미 '${existingSub}' 소분류가 존재합니다.`, 'warn');
        return;
      }

      currentSubList.push(val);
      appState.masterCategories[mainCat] = currentSubList;
      
      saveMasterCategories();
      populateFilterDropdowns();
      renderAll();
      renderManageMainCategories();
      renderManageSubCategories();
      e.target.reset();
      showToast(`'${mainCat}'에 소분류 '${val}'가 추가되었습니다.`, 'success');
    });

    document.getElementById('mainCategoryList')?.addEventListener('click', e => {
      // Select Main Category
      if (e.target.closest('.main-cat-item') && !e.target.closest('.btn-delete-main-cat') && !e.target.closest('.btn-edit-main-cat')) {
        const item = e.target.closest('.main-cat-item');
        appState.activeManageMainCat = item.dataset.cat;
        renderManageMainCategories();
        renderManageSubCategories();
      }
      
      // Delete Main Category
      if (e.target.closest('.btn-delete-main-cat')) {
        e.stopPropagation();
        const cat = e.target.closest('.btn-delete-main-cat').dataset.cat?.trim();
        if (!cat) return;
        
        const usedRecs = appState.records.filter(r => r.category && r.category.trim() === cat);
        const usedCount = usedRecs.length;

        if (usedCount > 0) {
          const sampleLimit = 4;
          const samples = usedRecs.slice(0, sampleLimit).map(r => {
            const d = r.date ? r.date.substring(5) : '';
            const m = r.merchant ? r.merchant.trim() : '미입력';
            const a = formatCurrency(r.amount);
            const sub = r.subCategory ? ` > ${r.subCategory}` : '';
            return `  • [${d} ${m}] ${a}원 (${cat}${sub})`;
          }).join('\n');
          const moreText = usedCount > sampleLimit ? `\n  ... 외 ${usedCount - sampleLimit}건` : '';

          const msg = `⚠️ [사용 중인 대분류 삭제 확인]\n\n'${cat}' 대분류를 사용 중인 지출 내역이 총 ${usedCount}건 있습니다.\n\n[등록된 내역 예시]\n${samples}${moreText}\n\n정말로 이 대분류와 속한 모든 소분류를 삭제하시겠습니까?\n\n※ '확인'을 누르면 해당 지출 내역(${usedCount}건)은 모두 '미분류'로 자동 이동되고 대분류가 삭제됩니다.`;
          
          if (!confirm(msg)) return;

          // 지출 내역을 '미분류'로 이동
          usedRecs.forEach(r => {
            r.category = '미분류';
            r.subCategory = '';
          });
          saveData();
        } else {
          if (!confirm(`'${cat}' 대분류와 속한 모든 소분류를 삭제하시겠습니까?\n(현재 이 대분류를 사용하는 지출 내역이 없습니다.)`)) return;
        }

        delete appState.masterCategories[cat];
        if (appState.activeManageMainCat === cat) {
          const remainingCats = Object.keys(appState.masterCategories).sort();
          appState.activeManageMainCat = remainingCats.length > 0 ? remainingCats[0] : null;
        }

        // 만약 삭제된 대분류로 필터링되어 있었다면 전체로 리셋
        if (appState.filterCategory === cat) {
          appState.filterCategory = 'ALL';
          const sel = document.getElementById('filterCategory');
          if (sel) sel.value = 'ALL';
        }

        saveMasterCategories();
        renderManageMainCategories();
        renderManageSubCategories();
        populateFilterDropdowns();
        renderAll();
        if (usedCount > 0) {
          showToast(`대분류 '${cat}'가 삭제되었으며, 기존 내역 ${usedCount}건이 '미분류'로 이동되었습니다.`, 'success');
        } else {
          showToast(`대분류 '${cat}'가 삭제되었습니다.`, 'info');
        }
      }
      
      // Edit Main Category
      if (e.target.closest('.btn-edit-main-cat')) {
        e.stopPropagation();
        const oldCat = e.target.closest('.btn-edit-main-cat').dataset.cat?.trim();
        if (!oldCat) return;

        const newCat = prompt(`'${oldCat}' 대분류의 새 이름을 입력하세요:`, oldCat);
        if (newCat !== null) {
          const trimmedCat = newCat.trim();
          if (!trimmedCat) {
            showToast('대분류 이름을 입력해주세요.', 'warn');
            return;
          }
          if (trimmedCat === oldCat) {
            return;
          }
          if (appState.masterCategories[trimmedCat]) {
            alert(`'${trimmedCat}'은(는) 이미 존재하는 대분류 이름입니다.`);
            return;
          }

          // 1. masterCategories 갱신
          appState.masterCategories[trimmedCat] = appState.masterCategories[oldCat] || [];
          delete appState.masterCategories[oldCat];

          // 2. 현재 선택된 활성 대분류 갱신
          if (appState.activeManageMainCat === oldCat) {
            appState.activeManageMainCat = trimmedCat;
          }

          // 3. 지출 내역 전체의 category 변경
          let changedCount = 0;
          appState.records.forEach(r => {
            if (r.category && r.category.trim() === oldCat) {
              r.category = trimmedCat;
              changedCount++;
            }
          });

          // 4. 자동분류 규칙(rules) 갱신
          appState.categoryRules.forEach(rule => {
            if (rule.category && rule.category.trim() === oldCat) {
              rule.category = trimmedCat;
            }
          });

          // 5. customTypes(고정비, 리뷰비 등) 내 포함 목록 갱신
          for (const t in appState.customTypes) {
            const arr = appState.customTypes[t];
            if (Array.isArray(arr)) {
              const idx = arr.indexOf(oldCat);
              if (idx > -1) arr[idx] = trimmedCat;
            }
          }

          // 6. 차트 제외 카테고리 갱신
          if (appState.chartExcludedCategories && appState.chartExcludedCategories.has(oldCat)) {
            appState.chartExcludedCategories.delete(oldCat);
            appState.chartExcludedCategories.add(trimmedCat);
          }

          // 7. 대시보드 필터가 수정 전 대분류였다면 새 대분류로 유지
          if (appState.filterCategory === oldCat) {
            appState.filterCategory = trimmedCat;
          }

          // 8. 저장 및 실시간 전체 렌더링
          saveMasterCategories();
          saveData();
          saveRules();
          saveCustomTypes();
          renderManageMainCategories();
          renderManageSubCategories();
          populateFilterDropdowns();
          renderAll();
          showToast(`대분류가 '${oldCat}' ➔ '${trimmedCat}'(으)로 즉시 변경되었습니다. (${changedCount}건 반영)`, 'success');
        }
      }
    });

    document.getElementById('subCategoryList')?.addEventListener('click', e => {
      // Delete Sub Category
      if (e.target.closest('.btn-delete-sub-cat')) {
        e.stopPropagation();
        const btn = e.target.closest('.btn-delete-sub-cat');
        const sub = btn.dataset.sub?.trim();
        const mainCat = (btn.dataset.cat || appState.activeManageMainCat)?.trim();
        
        if (!mainCat || !appState.masterCategories[mainCat]) {
          alert('대분류를 먼저 선택해주세요.');
          return;
        }

        const usedRecs = appState.records.filter(r => 
          (r.category === mainCat || !r.category) && r.subCategory && r.subCategory.trim() === sub
        );
        const usedCount = usedRecs.length;

        if (usedCount > 0) {
          const sampleLimit = 4;
          const samples = usedRecs.slice(0, sampleLimit).map(r => {
            const d = r.date ? r.date.substring(5) : '';
            const m = r.merchant ? r.merchant.trim() : '미입력';
            const a = formatCurrency(r.amount);
            return `  • [${d} ${m}] ${a}원`;
          }).join('\n');
          const moreText = usedCount > sampleLimit ? `\n  ... 외 ${usedCount - sampleLimit}건` : '';

          const msg = `⚠️ [사용 중인 소분류 삭제 확인]\n\n'${mainCat} > ${sub}' 소분류를 사용 중인 지출 내역이 총 ${usedCount}건 있습니다.\n\n[등록된 내역 예시]\n${samples}${moreText}\n\n정말로 이 소분류를 삭제하시겠습니까?\n\n※ '확인'을 누르면 해당 지출 내역(${usedCount}건)의 소분류가 초기화(미분류)됩니다. (대분류 '${mainCat}'는 유지됩니다.)`;

          if (!confirm(msg)) return;

          // 지출 내역의 소분류 초기화
          usedRecs.forEach(r => {
            r.subCategory = '';
          });
          saveData();
        } else {
          if (!confirm(`소분류 '${mainCat} > ${sub}'를 삭제하시겠습니까?\n(현재 이 소분류를 사용하는 지출 내역이 없습니다.)`)) return;
        }

        appState.masterCategories[mainCat] = (appState.masterCategories[mainCat] || []).filter(s => s.trim() !== sub);
        saveMasterCategories();
        renderManageSubCategories();
        renderManageMainCategories();
        populateFilterDropdowns();
        renderAll();
        if (usedCount > 0) {
          showToast(`소분류 '${sub}'가 삭제되었으며, 기존 내역 ${usedCount}건의 소분류가 초기화되었습니다.`, 'success');
        } else {
          showToast(`소분류 '${sub}'가 삭제되었습니다.`, 'info');
        }
      }
      
      // Edit Sub Category
      if (e.target.closest('.btn-edit-sub-cat')) {
        e.stopPropagation();
        const oldSub = e.target.closest('.btn-edit-sub-cat').dataset.sub?.trim();
        const mainCat = (e.target.closest('.btn-edit-sub-cat').dataset.cat || appState.activeManageMainCat)?.trim();
        if (!mainCat || !appState.masterCategories[mainCat]) return;
        if (!oldSub) return;

        const newSub = prompt(`'${oldSub}' 소분류의 새 이름을 입력하세요:`, oldSub);
        if (newSub !== null) {
          const trimmedSub = newSub.trim();
          if (!trimmedSub) {
            showToast('소분류 이름을 입력해주세요.', 'warn');
            return;
          }
          if (trimmedSub === oldSub) {
            return;
          }
          if (appState.masterCategories[mainCat].includes(trimmedSub)) {
            alert(`'${mainCat}' 대분류에 '${trimmedSub}' 소분류가 이미 존재합니다.`);
            return;
          }

          // 1. masterCategories 배열 내 이름 변경
          const subList = appState.masterCategories[mainCat] || [];
          const idx = subList.findIndex(s => s.trim() === oldSub);
          if (idx > -1) {
            subList[idx] = trimmedSub;
          } else {
            subList.push(trimmedSub);
          }
          appState.masterCategories[mainCat] = subList;

          // 2. 지출 내역 전체의 subCategory 변경
          let changedCount = 0;
          appState.records.forEach(r => {
            const isTargetMain = !r.category || r.category.trim() === mainCat;
            if (isTargetMain && r.subCategory && r.subCategory.trim() === oldSub) {
              r.subCategory = trimmedSub;
              changedCount++;
            }
          });

          // 3. 자동분류 규칙(rules) 갱신
          appState.categoryRules.forEach(rule => {
            if ((!rule.category || rule.category.trim() === mainCat) && rule.subCategory && rule.subCategory.trim() === oldSub) {
              rule.subCategory = trimmedSub;
            }
          });

          // 4. 저장 및 실시간 전체 렌더링
          saveMasterCategories();
          saveData();
          saveRules();
          renderManageSubCategories();
          renderManageMainCategories();
          populateFilterDropdowns();
          renderAll();
          showToast(`소분류가 '${oldSub}' ➔ '${trimmedSub}'(으)로 즉시 변경되었습니다. (${changedCount}건 반영)`, 'success');
        }
      }
    });

    function renderManageMainCategories() {
      const container = document.getElementById('mainCategoryList');
      if (!container) return;
      container.innerHTML = '';
      const mainCats = Object.keys(appState.masterCategories || {}).sort((a, b) => a.localeCompare(b, 'ko'));
      if (mainCats.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; padding:10px;">대분류가 없습니다.</div>';
        return;
      }
      let activeItemEl = null;
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
          activeItemEl = div;
        } else {
          div.style.background = 'transparent';
          div.addEventListener('mouseenter', () => div.style.background = 'var(--bg-surface)');
          div.addEventListener('mouseleave', () => { if(appState.activeManageMainCat !== cat) div.style.background = 'transparent'; });
        }
        
        let currentType = '변동비';
        div.innerHTML = `
          <span style="font-weight: 600; font-size: 0.95rem;">
            ${cat} 
          </span>
          <div style="display:flex; gap: 8px; align-items:center;">
            <button type="button" class="btn-edit-main-cat" data-cat="${cat}" style="background:none; border:none; color:var(--text-muted); cursor:pointer;" title="이름 수정">✏️</button>
            <button type="button" class="btn-delete-main-cat" data-cat="${cat}" style="background:none; border:none; color:var(--text-muted); cursor:pointer;" title="삭제">&times;</button>
          </div>
        `;
        container.appendChild(div);
      });

      if (activeItemEl) {
        setTimeout(() => {
          activeItemEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 50);
      }
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
      
      const subCats = [...(appState.masterCategories[mainCat] || [])].sort();
      if (subCats.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; padding:10px;">등록된 소분류가 없습니다.</div>';
        return;
      }
      
      subCats.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'sub-cat-item';
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
            <button type="button" class="btn-edit-sub-cat" data-cat="${mainCat}" data-sub="${sub}" style="background:none; border:none; color:var(--text-muted); cursor:pointer;" title="이름 수정">✏️</button>
            <button type="button" class="btn-delete-sub-cat" data-cat="${mainCat}" data-sub="${sub}" style="background:none; border:none; color:var(--text-muted); cursor:pointer;" title="삭제">&times;</button>
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
      const usedMains = new Set();
      const usedSubs = new Set();
      
      appState.records.forEach(r => {
        if (r.category) usedMains.add(r.category);
        if (r.category && r.subCategory) {
          usedSubs.add(`${r.category}|${r.subCategory}`);
        }
      });
      
      const toRemoveSubs = [];
      const toRemoveMains = [];

      Object.keys(appState.masterCategories).sort().forEach(cat => {
        const originalSubs = [...(appState.masterCategories[cat] || [])];
        const survivingSubs = [];

        originalSubs.forEach(sub => {
          const isUsed = usedSubs.has(`${cat}|${sub}`);
          if (!isUsed) {
            toRemoveSubs.push({ cat, sub });
          } else {
            survivingSubs.push(sub);
          }
        });

        const isUsedCat = usedMains.has(cat);
        if (!isUsedCat && cat !== '미분류' && survivingSubs.length === 0) {
          toRemoveMains.push(cat);
        }
      });

      if (toRemoveMains.length === 0 && toRemoveSubs.length === 0) {
        alert('정리할 미사용 카테고리가 없습니다.\n현재 등록된 모든 카테고리가 가계부 지출 내역에서 사용 중입니다! 👍');
        return;
      }

      let preview = `🧹 [미사용 카테고리 일괄 정리 대상 미리보기]\n`;
      preview += `※ 가계부 지출 내역에 1번도 쓰이지 않은 카테고리들만 선별되었습니다.\n\n`;

      preview += `📁 삭제될 미사용 대분류 (${toRemoveMains.length}개):\n`;
      if (toRemoveMains.length > 0) {
        preview += toRemoveMains.map(m => `  • ${m}`).join('\n') + '\n\n';
      } else {
        preview += `  (삭제 대상 없음)\n\n`;
      }

      preview += `📄 삭제될 미사용 소분류 (${toRemoveSubs.length}개):\n`;
      if (toRemoveSubs.length > 0) {
        const maxShow = 20;
        const showList = toRemoveSubs.slice(0, maxShow);
        preview += showList.map(s => `  • ${s.cat} > ${s.sub}`).join('\n');
        if (toRemoveSubs.length > maxShow) {
          preview += `\n  ... 외 ${toRemoveSubs.length - maxShow}개 항목`;
        }
        preview += '\n\n';
      } else {
        preview += `  (삭제 대상 없음)\n\n`;
      }

      preview += `※ 지출 내역이 있는 카테고리는 안전하게 보존됩니다.\n정말 위 미사용 카테고리들을 일괄 정리(삭제)하시겠습니까?`;

      if (!confirm(preview)) return;

      let removedMainCount = 0;
      let removedSubCount = 0;

      Object.keys(appState.masterCategories).sort().forEach(cat => {
        const originalSubs = [...(appState.masterCategories[cat] || [])];
        const newSubs = originalSubs.filter(sub => {
          const isUsed = usedSubs.has(`${cat}|${sub}`);
          if (!isUsed) {
            removedSubCount++;
            return false;
          }
          return true;
        });

        appState.masterCategories[cat] = newSubs;

        const isUsedCat = usedMains.has(cat);
        if (!isUsedCat && cat !== '미분류' && appState.masterCategories[cat].length === 0) {
          delete appState.masterCategories[cat];
          removedMainCount++;
        }
      });

      if (appState.activeManageMainCat && !appState.masterCategories[appState.activeManageMainCat]) {
        const remainingCats = Object.keys(appState.masterCategories).sort();
        appState.activeManageMainCat = remainingCats.length > 0 ? remainingCats[0] : null;
      }

      // 만약 현재 필터링 중인 대분류가 삭제되었다면 필터 리셋
      if (appState.filterCategory && !appState.masterCategories[appState.filterCategory]) {
        appState.filterCategory = 'ALL';
        const sel = document.getElementById('filterCategory');
        if (sel) sel.value = 'ALL';
      }

      saveMasterCategories();
      renderManageMainCategories();
      renderManageSubCategories();
      populateFilterDropdowns();
      renderAll();
      showToast(`카테고리 정리 완료! 🧹 미사용 대분류 ${removedMainCount}개, 미사용 소분류 ${removedSubCount}개가 깔끔하게 정리되었습니다.`, 'success');
    });
    
    document.getElementById('btnDoneCardManageModal')?.addEventListener('click', () => {
      document.getElementById('cardManageModal')?.classList.remove('show');
    });

    document.getElementById('newCardForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const cardTypeSelect = document.getElementById('newCardType');
      const cardType = cardTypeSelect ? cardTypeSelect.value : 'physical';
      const cardName = document.getElementById('newCardName').value.trim();
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

    let cardManageSortDesc = false;
    let cardManageFilter = 'all';
    const cardManageSelected = new Set();

    document.getElementById('sortCardTypeHeader')?.addEventListener('click', () => {
      cardManageSortDesc = !cardManageSortDesc;
      renderManageCards();
    });

    // Filter tabs for target selection
    document.querySelectorAll('.card-filter-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        cardManageFilter = e.currentTarget.dataset.filter || 'all';
        document.querySelectorAll('.card-filter-tab').forEach(t => t.classList.toggle('active', t === e.currentTarget));
        renderManageCards();
      });
    });

    // Header checkbox for select all visible
    document.getElementById('chkAllManageCards')?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const visibleCheckboxes = document.querySelectorAll('#cardsTableBody .chk-manage-card');
      visibleCheckboxes.forEach(chk => {
        if (!chk.disabled) {
          chk.checked = isChecked;
          const card = chk.dataset.card;
          if (isChecked) cardManageSelected.add(card);
          else cardManageSelected.delete(card);
        }
      });
      updateCardManageBatchUI();
    });

    // Batch card type change
    document.getElementById('batchCardTypeSelect')?.addEventListener('change', (e) => {
      const newType = e.target.value;
      if (!newType) return;
      if (cardManageSelected.size === 0) {
        alert('선택된 결제수단 대상이 없습니다.');
        e.target.value = '';
        return;
      }
      const count = cardManageSelected.size;
      const typeLabel = (newType === 'physical') ? '실물 카드' : '간편결제 / 계좌';
      if (!confirm(`선택한 ${count}개 결제수단의 배치 유형을 '${typeLabel}'(으)로 일괄 변경하시겠습니까?`)) {
        e.target.value = '';
        return;
      }
      cardManageSelected.forEach(card => {
        if (CARD_CONFIG[card] && card !== '현금') {
          CARD_CONFIG[card].type = newType;
        }
      });
      saveCards();
      e.target.value = '';
      renderManageCards();
      populateFilterDropdowns();
      renderAll();
      showToast(`${count}개 결제수단이 '${typeLabel}'(으)로 일괄 변경되었습니다.`, 'success');
    });

    // Batch card delete
    document.getElementById('btnBatchDeleteCards')?.addEventListener('click', () => {
      if (cardManageSelected.size === 0) {
        alert('선택된 결제수단 대상이 없습니다.');
        return;
      }
      const selectedCards = Array.from(cardManageSelected).filter(c => c !== '현금' && CARD_CONFIG[c]);
      if (selectedCards.length === 0) {
        alert('삭제할 수 있는 결제수단 대상이 없습니다. (현금은 고정 기본 수단)');
        return;
      }

      const blocked = [];
      const deletable = [];
      selectedCards.forEach(c => {
        const totalAmount = appState.records
          .filter(r => r.actualCard === c && r.exclude !== 'Y')
          .reduce((sum, r) => sum + r.amount, 0);
        if (totalAmount > 0) {
          blocked.push({ card: c, amount: totalAmount });
        } else {
          deletable.push(c);
        }
      });

      if (blocked.length > 0 && deletable.length === 0) {
        const listStr = blocked.map(b => `  • ${b.card}: ${b.amount.toLocaleString()}원`).join('\n');
        alert(`선택된 결제수단에 지출 내역이 있어 삭제할 수 없습니다:\n${listStr}\n\n(지출 금액이 0원인 결제수단만 삭제할 수 있습니다)`);
        return;
      }

      let msg = '';
      if (blocked.length > 0) {
        const listStr = blocked.map(b => b.card).join(', ');
        msg = `⚠️ 지출 내역이 있는 다음 수단(${blocked.length}개)은 제외됩니다:\n[${listStr}]\n\n지출이 없는 나머지 ${deletable.length}개 결제수단을 일괄 삭제하시겠습니까?`;
      } else {
        msg = `선택한 ${deletable.length}개 결제수단을 일괄 삭제하시겠습니까?`;
      }

      if (!confirm(msg)) return;

      deletable.forEach(c => {
        delete CARD_CONFIG[c];
        cardManageSelected.delete(c);
      });

      saveCards();
      renderManageCards();
      populateFilterDropdowns();
      renderAll();
      showToast(`${deletable.length}개 결제수단이 일괄 삭제되었습니다.`, 'success');
    });

    function updateCardManageBatchUI(currentVisibleCards = []) {
      const batchBar = document.getElementById('cardManageBatchBar');
      const countText = document.getElementById('cardManageSelectedCount');
      const chkAll = document.getElementById('chkAllManageCards');

      // Filter out cards that no longer exist
      Array.from(cardManageSelected).forEach(c => {
        if (!CARD_CONFIG[c]) cardManageSelected.delete(c);
      });

      const selCount = cardManageSelected.size;
      if (batchBar) {
        batchBar.style.display = selCount > 0 ? 'flex' : 'none';
      }
      if (countText) {
        countText.textContent = `${selCount}개 선택됨`;
      }

      if (chkAll) {
        const selectable = currentVisibleCards.filter(c => c !== '현금');
        if (selectable.length > 0 && selectable.every(c => cardManageSelected.has(c))) {
          chkAll.checked = true;
          chkAll.indeterminate = false;
        } else if (selectable.some(c => cardManageSelected.has(c))) {
          chkAll.checked = false;
          chkAll.indeterminate = true;
        } else {
          chkAll.checked = false;
          chkAll.indeterminate = false;
        }
      }
    }

    function renderManageCards() {
      const tbody = document.getElementById('cardsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';

      const allCards = Object.keys(CARD_CONFIG);

      // Update Tab Count Badges
      const cntAll = allCards.length;
      const cntPhysical = allCards.filter(c => CARD_CONFIG[c]?.type === 'physical').length;
      const cntPay = allCards.filter(c => CARD_CONFIG[c]?.type === 'pay').length;
      const cntCash = allCards.filter(c => CARD_CONFIG[c]?.type === 'cash' || c === '현금').length;

      const elAll = document.getElementById('cntAllCards');
      const elPhys = document.getElementById('cntPhysicalCards');
      const elPay = document.getElementById('cntPayCards');
      const elCash = document.getElementById('cntCashCards');

      if (elAll) elAll.textContent = cntAll;
      if (elPhys) elPhys.textContent = cntPhysical;
      if (elPay) elPay.textContent = cntPay;
      if (elCash) elCash.textContent = cntCash;

      // Filter by active target tab
      let cardNames = allCards.filter(card => {
        const conf = CARD_CONFIG[card];
        if (!conf) return false;
        if (cardManageFilter === 'physical') return conf.type === 'physical';
        if (cardManageFilter === 'pay') return conf.type === 'pay';
        if (cardManageFilter === 'cash') return conf.type === 'cash' || card === '현금';
        return true;
      });

      cardNames.sort((a, b) => {
        const typeA = CARD_CONFIG[a]?.type === 'physical' ? 0 : 1;
        const typeB = CARD_CONFIG[b]?.type === 'physical' ? 0 : 1;
        if (typeA !== typeB) return cardManageSortDesc ? typeB - typeA : typeA - typeB;
        return a.localeCompare(b);
      });

      if (cardNames.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 36px 16px; color: var(--text-muted); font-size: 0.95rem;">선택한 대상 유형의 결제수단이 없습니다.</td></tr>`;
        updateCardManageBatchUI([]);
        return;
      }

      cardNames.forEach(card => {
        const tr = document.createElement('tr');
        tr.className = 'card-manage-row';
        const conf = CARD_CONFIG[card] || { type: 'physical' };
        
        const targetVal = conf.target || 0;
        const displayVal = targetVal > 0 ? targetVal.toLocaleString('ko-KR') : '';
        const isCash = (card === '현금');
        const isChecked = cardManageSelected.has(card);

        tr.innerHTML = `
          <td class="col-card-chk" style="text-align: center;">
            <input type="checkbox" class="chk-manage-card" data-card="${card}" ${isCash ? 'disabled title="현금은 고정 기본 수단으로 대상 선택에서 제외됩니다."' : ''} ${isChecked ? 'checked' : ''}>
          </td>
          <td class="col-card-name">
            <input type="text" class="input-card-name" data-old-card="${card}" value="${card}" placeholder="수단 이름" ${isCash ? 'readonly style="opacity:0.85;" title="기본 현금 수단은 이름을 변경할 수 없습니다."' : ''}>
          </td>
          <td class="col-card-type">
            <span class="card-field-label">배치 유형</span>
            <select class="select-card-type" data-card="${card}" ${isCash ? 'disabled title="현금은 고정 유형입니다."' : ''}>
              <option value="physical" ${conf.type === 'physical' ? 'selected' : ''}>실물 카드</option>
              <option value="pay" ${conf.type === 'pay' ? 'selected' : ''}>간편결제 / 계좌</option>
              <option value="cash" ${(conf.type === 'cash' || isCash) ? 'selected' : ''}>현금</option>
            </select>
          </td>
          <td class="col-card-target">
            <span class="card-field-label">실적 목표</span>
            <input type="text" class="input-card-target" data-card="${card}" value="${displayVal}" placeholder="목표 없음">
          </td>
          <td class="col-card-del">
            ${isCash 
              ? `<span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;" title="기본 수단">고정</span>` 
              : `<button type="button" class="btn-delete-card" data-card="${card}" title="삭제">🗑️</button>`
            }
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Checkbox event listeners
      tbody.querySelectorAll('.chk-manage-card').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const card = e.target.dataset.card;
          if (e.target.checked) {
            cardManageSelected.add(card);
          } else {
            cardManageSelected.delete(card);
          }
          updateCardManageBatchUI(cardNames);
        });
      });

      updateCardManageBatchUI(cardNames);
      
      tbody.querySelectorAll('.input-card-name').forEach(input => {
        input.addEventListener('blur', (e) => {
          const oldCard = e.target.dataset.oldCard;
          const newCard = e.target.value.trim();
          if (!newCard) {
            e.target.value = oldCard;
            return;
          }
          if (newCard !== oldCard) {
            if (CARD_CONFIG[newCard]) {
              alert('이미 존재하는 결제수단입니다.');
              e.target.value = oldCard;
              return;
            }
            CARD_CONFIG[newCard] = CARD_CONFIG[oldCard];
            delete CARD_CONFIG[oldCard];
            if (cardManageSelected.has(oldCard)) {
              cardManageSelected.delete(oldCard);
              cardManageSelected.add(newCard);
            }
            appState.records.forEach(r => {
              if (r.actualCard === oldCard) r.actualCard = newCard;
            });
            saveCards();
            saveData();
            renderManageCards();
            populateFilterDropdowns();
            renderAll();
            showToast(`'${oldCard}' 이름이 변경되었습니다.`, 'success');
          }
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') e.target.blur();
        });
      });

      tbody.querySelectorAll('.select-card-type').forEach(select => {
        select.addEventListener('change', (e) => {
          const card = e.target.dataset.card;
          const newType = e.target.value;
          if (CARD_CONFIG[card] && CARD_CONFIG[card].type !== newType) {
            CARD_CONFIG[card].type = newType;
            saveCards();
            renderManageCards();
            renderAll();
            showToast(`'${card}' 배치 유형이 변경되었습니다.`, 'success');
          }
        });
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
            cardManageSelected.delete(card);
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
    document.getElementById('excelFileInput')?.addEventListener('change', e => handleExcelUpload(e, 'bank'));
  document.getElementById('backupFileInput')?.addEventListener('change', e => handleExcelUpload(e, 'backup'));

    // Excel Upload Mode Modal Handlers
    document.getElementById('btnUploadAppend')?.addEventListener('click', () => applyExcelData(true));
    document.getElementById('btnUploadOverwrite')?.addEventListener('click', () => {
      if (confirm('⚠️ [경고] 기존 데이터를 덮어쓰시겠습니까?\n\n- 이전에 수동으로 작성하신 메모, 결제상태, 변경한 카테고리 내역이 모두 초기화(삭제)됩니다.\n- [기존 데이터에 추가하기]를 권장합니다.\n\n정말 덮어쓰시겠습니까?')) {
        applyExcelData(false);
      }
    });
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

      const sigsArray = Array.from(appState.deletedSignatures).map(sig => {
        const parts = sig.split('|');
        return {
          sig: sig,
          dateStr: parts[0] || '-',
          timeStr: parts[1] || '-',
          merchant: parts[2] || '-',
          amount: Number(parts[3]) || 0
        };
      });

      sigsArray.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

      let currentMonth = null;

      sigsArray.forEach(item => {
        const monthMatch = item.dateStr.match(/^(\d{4})-(\d{2})/);
        const itemMonth = monthMatch ? `${monthMatch[1]}년 ${parseInt(monthMatch[2], 10)}월` : '알 수 없음';

        if (currentMonth !== itemMonth) {
          currentMonth = itemMonth;
          const trGroup = document.createElement('tr');
          trGroup.innerHTML = `<td colspan="4" style="background-color: var(--bg-hover); padding: 8px 16px; font-weight: bold; font-size: 0.95rem; color: var(--accent); border-bottom: 1px solid var(--border-color); text-align: left;">${currentMonth}</td>`;
          tbody.appendChild(trGroup);
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="padding: 12px; border-bottom: 1px solid var(--border-color);">
            <div>${item.dateStr}</div>
            <small style="color:var(--text-muted); font-size:0.75rem;">${item.timeStr}</small>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid var(--border-color); max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.merchant}">
            ${item.merchant}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid var(--border-color); text-align: right;">${formatCurrency(item.amount)}원</td>
          <td style="padding: 12px; border-bottom: 1px solid var(--border-color); text-align: center;">
            <button type="button" class="btn-restore-sig" data-sig="${item.sig}" style="background:none; border:none; cursor:pointer; font-size: 1.2rem;" title="복구하기">♻️</button>
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

  function getRecordTypeLabel(rec) {
    for (const t in appState.customTypes) {
      if (appState.customTypes[t].includes(rec.category) || rec.category === t) return t;
    }
    return rec.isFixed === 'Y' ? '고정비' : '변동비';
  }

  // --- Excel Export (SheetJS) ---
  function exportToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('엑셀 라이브러리가 로드되지 않았습니다.');
      return;
    }

    // 1. Transaction Sheet
    // 뱅크샐러드와 동일하게 지출은 음수(-), 취소는 양수(+)로 내보냄 (업로드 시 부호를 다시 뒤집어 읽으므로 왕복 일치)
    const txHeaders = [
      'No.', '날짜', '시간', '대분류', '소분류', '내용(가맹점)',
      '금액', '실제 결제카드 (수정 가능)',
      '할부 유무', '결제 (완료/대기)', '유형', '메모', '할부 개월',
      '정산금액', '실부담액', '정산메모'
    ];

    const txRows = appState.records.map(r => {
      const amt = Number(r.amount) || 0;
      const settle = Number(r.settleAmount) || 0;
      const net = amt - settle;
      return [
        r.id, r.date, r.time, r.category, r.subCategory, r.merchant,
        -amt, r.actualCard, (r.isInstallment === 'Y' ? 'Y' : 'N'),
        (r.exclude === 'Y' ? '완료' : '대기'), getRecordTypeLabel(r), r.memo, r.installment,
        settle > 0 ? settle : '', settle > 0 ? net : '', r.settleNote || ''
      ];
    });

    const wsTx = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows]);

    // 2. Summary Sheet
    const summaryRows = [
      ['카드별 지출 현황 및 가계부 대시보드 요약'],
      ['기준일시', new Date().toLocaleString('ko-KR', { hour12: false })],
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
  let pendingUploadMode = 'bank'; // 'bank'(뱅크샐러드 양식) | 'backup'(백업 복원 양식)

  function handleExcelUpload(e, mode = 'bank') {
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

        // Find header row in top 100 rows
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(100, rows.length); i++) {
          const rowStr = (rows[i] || []).join(' ');
          if (['날짜', '금액', '내용', '가맹점', '결제수단', '분류', '거래일시'].some(k => rowStr.includes(k))) {
            headerRowIdx = i;
            break;
          }
        }

        const headerRow = rows[headerRowIdx] || [];
        const headerFlat = headerRow.map(h => String(h || '').replace(/\s+/g, '')).join('|');
        const isBackupFormat = headerFlat.includes('결제(완료') && headerFlat.includes('실제결제카드');
        if (mode === 'backup' && !isBackupFormat) {
          alert('백업 복원 양식이 아닙니다.\n앱의 [엑셀 내보내기]로 받은 파일을 선택해 주세요.\n(뱅크샐러드 파일은 [뱅크샐러드 업로드]를 이용하세요)');
          return;
        }
        if (mode === 'bank' && isBackupFormat) {
          alert('앱에서 내보낸 백업 파일입니다.\n[백업 복원] 버튼으로 올려주세요.');
          return;
        }
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
          pay: findCol(['실제결제카드', '결제수단', '원본결제수단'], 8),
          memo: findCol(['메모', '비고'], 9),
          status: mode === 'backup' ? findCol(['결제(완료'], -1) : -1,
          instYn: mode === 'backup' ? findCol(['할부유무'], -1) : -1,
          instMon: mode === 'backup' ? findCol(['할부개월'], -1) : -1,
          settleAmt: mode === 'backup' ? findCol(['정산금액', '정산회수'], -1) : -1,
          settleNote: mode === 'backup' ? findCol(['정산메모', '모임명'], -1) : -1
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
          // 뱅크샐러드 기준: 엑셀의 마이너스(-)가 실제 지출, 플러스(+)가 취소이므로 부호를 뒤집어 저장합니다.
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

          // 내보내기 파일의 '할부 개월' / '할부 유무' 열이 있으면 그대로 복원
          if (col.instMon !== -1) {
            const mv = String(row[col.instMon] || '').trim();
            if (['일시불', '2개월', '3개월', '4개월', '5개월', '6개월', '12개월'].includes(mv)) instVal = mv;
          }
          const instFlag = (col.instYn !== -1) ? (String(row[col.instYn] || '').trim().toUpperCase() === 'Y' ? 'Y' : 'N') : undefined;

          let excludeVal = 'N';
          if (col.status !== -1) {
            const rawEx = String(row[col.status] || '').trim();
            if (rawEx.includes('제외') || rawEx === '완료' || rawEx === 'Y') {
              excludeVal = 'Y';
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
            ...(instFlag !== undefined ? { isInstallment: instFlag } : {}),
            billingAmount: amount,
            status: '결제완료',
            exclude: excludeVal,
            memo: memoRaw,
            settleAmount: (col.settleAmt !== -1 && row[col.settleAmt]) ? (Number(String(row[col.settleAmt]).replace(/[^0-9.-]/g, '')) || 0) : 0,
            settleNote: (col.settleNote !== -1 && row[col.settleNote]) ? String(row[col.settleNote]).trim() : '',
            originalSignature: `${dateStr}|${timeStr}|${rawMerchant}|${amount}`
          });
        }

        if (parsedList.length === 0) {
          alert(`[${sheetName}] 시트에서 유효한 '지출' 내역을 찾을 수 없습니다.`);
          return;
        }

        applyCategoryRules(parsedList);
        pendingUploadedRecords = parsedList;
        pendingUploadMode = mode;

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
      
      const previousRecordsSnapshot = [...appState.records];

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
        selectedMethods.includes(r.actualCard) && (pendingUploadMode === 'backup' || !appState.deletedSignatures.has(getSignature(r)))
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
    // 상계처리는 뱅크샐러드 업로드에만 적용 (백업 복원은 저장된 그대로 복원)
    let negatives = pendingUploadMode === 'bank' ? appState.records.filter(r => r.amount < 0) : [];
    let hedgeCount = 0;

    negatives.forEach(neg => {
      // 동일 가맹점, 동일 절대값 금액을 가진 양수 결제 내역 찾기 (이미 제거 대상이 아닌 것만)
      const posRec = appState.records.find(r =>
        !toRemove.has(r) &&
        r !== neg &&
        r.amount === Math.abs(neg.amount) &&
        r.merchant.trim() === neg.merchant.trim()
      );

      if (posRec) {
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

      // 스마트 자동 분류 팝업 로직 실행
      if (addedCount > 0) {
        processSmartAutoClassification(
          isAppend ? pendingUploadedRecords.filter(r => appState.records.includes(r)) : appState.records, 
          previousRecordsSnapshot
        );
      }

      pendingUploadedRecords = [];
      const modal = document.getElementById('excelModeModal');
      if (modal) modal.classList.remove('show');
    } catch (err) {
      console.error(err);
      alert('엑셀 데이터 적용 중 오류가 발생했습니다: ' + (err.message || err));
    }
  }

  function processSmartAutoClassification(newRecords, previousRecords) {
    const suggestions = [];
    
    // Sort previous records to prefer the most recent classification
    const sortedPrev = [...previousRecords].sort((a, b) => b.id - a.id);
    
    newRecords.forEach(newRec => {
      // Find the most recent matching record from history
      const oldRec = sortedPrev.find(r => 
        r !== newRec &&
        r.merchant && typeof r.merchant === 'string' &&
        newRec.merchant && typeof newRec.merchant === 'string' &&
        r.merchant.trim() === newRec.merchant.trim() &&
        r.amount === newRec.amount &&
        r.actualCard === newRec.actualCard &&
        r.category && r.category !== '기타' && r.category !== '미분류'
      );
      
      if (oldRec && (newRec.category !== oldRec.category || newRec.subCategory !== oldRec.subCategory)) {
        suggestions.push({ newRec, oldRec });
      }
    });

    if (suggestions.length === 0) return;

    // Remove duplicates from suggestions (multiple new records matching the same pattern)
    // Actually, we want to suggest for all matching new records.
    
    const modal = document.getElementById('smartClassificationModal');
    const listDiv = document.getElementById('smartSuggestionsList');
    if (!modal || !listDiv) return;

    listDiv.innerHTML = '';
    suggestions.forEach((s, idx) => {
      const item = document.createElement('div');
      item.style.padding = '10px';
      item.style.background = 'var(--bg-card)';
      item.style.border = '1px solid var(--border-color)';
      item.style.borderRadius = '6px';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      
      item.innerHTML = `
        <div style="flex: 1;">
          <div style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">${s.newRec.merchant}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
            ${s.newRec.date} · ${formatCurrency(s.newRec.amount)}원 · ${s.newRec.actualCard}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">자동 지정 카테고리</div>
          <div style="color: var(--primary-color); font-weight: 600; font-size: 0.95rem;">
            ${s.oldRec.category} > ${s.oldRec.subCategory || '없음'}
          </div>
        </div>
      `;
      listDiv.appendChild(item);
    });

    // Event Handlers for modal
    const btnSkip = document.getElementById('btnSkipSmartModal');
    const btnApply = document.getElementById('btnApplySmartModal');
    const btnClose = document.getElementById('btnCloseSmartModal');

    const closeModal = () => {
      modal.classList.remove('show');
      btnSkip.removeEventListener('click', skipHandler);
      btnApply.removeEventListener('click', applyHandler);
      btnClose.removeEventListener('click', skipHandler);
    };

    const skipHandler = () => closeModal();

    const applyHandler = () => {
      let applied = 0;
      suggestions.forEach(s => {
        const targetRec = appState.records.find(r => r.id === s.newRec.id);
        if (targetRec) {
          targetRec.category = s.oldRec.category;
          targetRec.subCategory = s.oldRec.subCategory;
          targetRec.isFixed = s.oldRec.isFixed;
          targetRec.type = s.oldRec.type;
          applied++;
        }
      });
      if (applied > 0) {
        saveData();
        renderTable();
        renderCardsBreakdown();
        updateCharts(getFilteredRecords(true));
        showToast(`${applied}건의 내역이 과거 이력을 바탕으로 자동 분류되었습니다!`, 'success');
      }
      closeModal();
    };

    btnSkip.addEventListener('click', skipHandler);
    btnApply.addEventListener('click', applyHandler);
    btnClose.addEventListener('click', skipHandler);

    modal.classList.add('show');
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


  const modalManageTypes = document.getElementById('modalManageTypes');
  const btnManageTypes = document.getElementById('btnManageTypes');
  const btnCloseManageTypes = document.getElementById('btnCloseManageTypes');
  const btnAddType = document.getElementById('btnAddType');
  const selectMainCatForType = document.getElementById('selectMainCatForType');
  const typeListContainer = document.getElementById('typeListContainer');

  function populateSelectMainCatForType() {
    if (!selectMainCatForType) return;
    const allMainCats = Object.keys(appState.masterCategories || {}).sort();
    
    // 이미 등록되어 있는 유형 이름들 (고정비 제외 또는 포함)
    const existingTypes = Object.keys(appState.customTypes);

    // 아직 유형으로 등록되지 않은 대분류 목록
    const availableCats = allMainCats.filter(cat => !existingTypes.includes(cat) && cat !== '변동비' && cat !== 'ALL');

    if (availableCats.length === 0) {
      selectMainCatForType.innerHTML = '<option value="">선택 가능한 대분류 없음</option>';
      selectMainCatForType.disabled = true;
      if (btnAddType) btnAddType.disabled = true;
    } else {
      selectMainCatForType.disabled = false;
      if (btnAddType) btnAddType.disabled = false;
      selectMainCatForType.innerHTML = '<option value="">대분류를 선택하세요 (스크롤 선택)</option>' +
        availableCats.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  }

  function renderManageTypes() {
    if (!typeListContainer) return;
    typeListContainer.innerHTML = '';
    populateSelectMainCatForType();
    
    const typeEntries = Object.entries(appState.customTypes);

    if (typeEntries.length === 0) {
      typeListContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px;">등록된 사용자 지정 유형이 없습니다.</div>';
      return;
    }

    typeEntries.forEach(([t, cats]) => {
      // Screenshot 2 Style: Clean dark card with Type Name on left and '유형 삭제' button in bordered box on right
      const typeCard = document.createElement('div');
      typeCard.style.cssText = 'background: rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 14px 16px; border: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;';
      
      const titleSpan = document.createElement('span');
      titleSpan.style.cssText = 'font-weight: 700; font-size: 1.05rem; color: #ffffff; letter-spacing: -0.02em;';
      titleSpan.textContent = t;
      typeCard.appendChild(titleSpan);
      
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '유형 삭제';
      // Screenshot 2 style: rounded outline border button
      delBtn.style.cssText = 'background: transparent; color: #ffffff; border: 1.5px solid rgba(255, 255, 255, 0.7); border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 0.88rem; font-weight: 600; transition: all 0.2s;';
      delBtn.onmouseenter = () => {
        delBtn.style.borderColor = '#ef4444';
        delBtn.style.color = '#ef4444';
        delBtn.style.background = 'rgba(239, 68, 68, 0.1)';
      };
      delBtn.onmouseleave = () => {
        delBtn.style.borderColor = 'rgba(255, 255, 255, 0.7)';
        delBtn.style.color = '#ffffff';
        delBtn.style.background = 'transparent';
      };

      delBtn.onclick = () => {
        if (confirm(`'${t}' 유형을 삭제하시겠습니까?\n삭제 즉시 상단 KPI 카드 및 순 생활비에서 빠져 일반 생활비(변동비)로 실시간 복귀합니다.`)) {
          delete appState.customTypes[t];
          saveCustomTypes();
          renderManageTypes();
          renderTypeFilter();
          renderManageMainCategories();
          renderAll(); // 새로고침 없이 상단 KPI, 순생활비, 테이블 즉시 실시간 갱신!
          showToast(`'${t}' 유형이 삭제되어 상단 지표에 실시간 반영되었습니다.`, 'success');
        }
      };
      typeCard.appendChild(delBtn);

      typeListContainer.appendChild(typeCard);
    });
  }

  if (btnManageTypes) {
    btnManageTypes.addEventListener('click', () => {
      renderManageTypes();
      modalManageTypes.style.display = 'flex';
    });
  }
  if (btnCloseManageTypes) {
    btnCloseManageTypes.addEventListener('click', () => {
      modalManageTypes.style.display = 'none';
    });
  }
  if (btnAddType) {
    btnAddType.addEventListener('click', () => {
      const selectedCat = selectMainCatForType ? selectMainCatForType.value.trim() : '';
      if (!selectedCat) {
        showToast('추가할 대분류를 선택해주세요.', 'warn');
        return;
      }
      if (appState.customTypes[selectedCat]) {
        showToast('이미 등록된 유형입니다.', 'warn');
        return;
      }
      if (selectedCat === '변동비' || selectedCat === 'ALL') {
        showToast('선택할 수 없는 분류입니다.', 'warn');
        return;
      }

      // 대분류 자체를 유형으로 등록하고, 해당 대분류를 카테고리 목록에 매핑
      appState.customTypes[selectedCat] = [selectedCat];
      
      // Save & Live Update without page refresh!
      saveCustomTypes();
      renderManageTypes();
      renderTypeFilter();
      renderManageMainCategories();
      renderAll(); // 새로고침 없이 상단 총 지출, 순 생활비, 계원, 고정비 등 즉시 갱신!
      showToast(`'${selectedCat}' 대분류가 유형으로 추가되어 상단 지표에 즉시 반영되었습니다!`, 'success');
    });
  }

  // --- Custom Types Management ---
  function renderTypeFilter() {
    const sel = document.getElementById('filterType');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="ALL">전체 유형</option>';
    for (const t in appState.customTypes) {
      sel.innerHTML += `<option value="${t}">${t}</option>`;
    }
    sel.innerHTML += '<option value="변동비">변동비 (나머지 전체)</option>';
    
    if (Object.keys(appState.customTypes).includes(currentVal) || currentVal === 'ALL' || currentVal === '변동비') {
      sel.value = currentVal;
    } else {
      sel.value = 'ALL';
      appState.filterType = 'ALL';
    }
  }

  // ==========================================================================
  // Annual Tax & Monthly Card Aggregation (연말정산 / 월별 카드 소비 취합)
  // ==========================================================================
  let currentMainView = 'monthly'; // 'monthly' | 'annual'
  let annualSelectedYear = null;
  let annualSettleMode = 'net'; // 'net' | 'gross'
  let annualCardFilter = 'all'; // 'all' | 'physical' | 'pay' | 'cash'
  let annualStackedChartInstance = null;

  function initMainViewTabs() {
    const tabMonthly = document.getElementById('tabMonthlyView');
    const tabAnnual = document.getElementById('tabAnnualView');
    const monthlyContainer = document.getElementById('monthlyViewContainer');
    const annualContainer = document.getElementById('annualViewContainer');

    tabMonthly?.addEventListener('click', () => {
      if (currentMainView === 'monthly') return;
      currentMainView = 'monthly';
      tabMonthly.classList.add('active');
      tabAnnual?.classList.remove('active');
      if (monthlyContainer) monthlyContainer.style.display = 'block';
      if (annualContainer) annualContainer.style.display = 'none';
      renderAll();
    });

    tabAnnual?.addEventListener('click', () => {
      if (currentMainView === 'annual') return;
      currentMainView = 'annual';
      tabAnnual.classList.add('active');
      tabMonthly?.classList.remove('active');
      if (monthlyContainer) monthlyContainer.style.display = 'none';
      if (annualContainer) annualContainer.style.display = 'block';
      renderAnnualTaxView();
    });
  }

  function initAnnualTaxViewControls() {
    // Year Select
    document.getElementById('annualYearSelect')?.addEventListener('change', (e) => {
      annualSelectedYear = parseInt(e.target.value, 10);
      renderAnnualTaxView();
    });

    // Settle Mode Toggle
    document.getElementById('btnAnnualNet')?.addEventListener('click', () => {
      if (annualSettleMode === 'net') return;
      annualSettleMode = 'net';
      document.getElementById('btnAnnualNet')?.classList.add('active');
      document.getElementById('btnAnnualGross')?.classList.remove('active');
      renderAnnualTaxView();
    });

    document.getElementById('btnAnnualGross')?.addEventListener('click', () => {
      if (annualSettleMode === 'gross') return;
      annualSettleMode = 'gross';
      document.getElementById('btnAnnualGross')?.classList.add('active');
      document.getElementById('btnAnnualNet')?.classList.remove('active');
      renderAnnualTaxView();
    });

    // Card Type Filter Tabs
    document.querySelectorAll('.annual-type-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.type || 'all';
        annualCardFilter = type;
        document.querySelectorAll('.annual-type-tab').forEach(t => t.classList.toggle('active', t === e.currentTarget));
        renderAnnualTaxView();
      });
    });

    // Export CSV
    document.getElementById('btnExportAnnualExcel')?.addEventListener('click', exportAnnualMatrixToCSV);
  }

  function renderAnnualTaxView() {
    const annualContainer = document.getElementById('annualViewContainer');
    if (!annualContainer) return;

    // 1. Determine available years from appState.records
    const allYears = Array.from(new Set(
      appState.records
        .map(r => r.date ? r.date.substring(0, 4) : null)
        .filter(y => y && /^\d{4}$/.test(y))
    )).sort().reverse();

    if (allYears.length === 0) {
      allYears.push(String(new Date().getFullYear()));
    }

    if (!annualSelectedYear || !allYears.includes(String(annualSelectedYear))) {
      if (appState.currentMonth && appState.currentMonth !== 'ALL') {
        const mYear = appState.currentMonth.split('-')[0];
        if (allYears.includes(mYear)) {
          annualSelectedYear = parseInt(mYear, 10);
        } else {
          annualSelectedYear = parseInt(allYears[0], 10);
        }
      } else {
        annualSelectedYear = parseInt(allYears[0], 10);
      }
    }

    // Populate year select
    const yearSelect = document.getElementById('annualYearSelect');
    if (yearSelect) {
      yearSelect.innerHTML = allYears.map(y => `<option value="${y}" ${parseInt(y, 10) === annualSelectedYear ? 'selected' : ''}>${y}년</option>`).join('');
    }

    // 2. Filter records for selected year
    const yearPrefix = String(annualSelectedYear);
    const yearRecords = appState.records.filter(r => r.date && r.date.startsWith(yearPrefix));

    // 3. Collect all cards (configured + existing in year records)
    const cardSet = new Set(Object.keys(CARD_CONFIG));
    yearRecords.forEach(r => {
      if (r.actualCard) cardSet.add(r.actualCard);
    });
    cardSet.add('현금');

    // Build card data map
    const cardMap = {};
    cardSet.forEach(card => {
      const conf = CARD_CONFIG[card] || { type: card === '현금' ? 'cash' : 'pay', color: '#6366f1' };
      // 엄격한 수단 유형 판별 (현금은 무조건 'cash')
      let rawType = card === '현금' ? 'cash' : (conf.type || 'pay');
      if (rawType !== 'physical' && rawType !== 'cash') rawType = 'pay';

      cardMap[card] = {
        name: card,
        type: rawType,
        color: conf.color || '#6366f1',
        monthlyAmounts: Array(12).fill(0),
        monthlyGross: Array(12).fill(0),
        monthlySettle: Array(12).fill(0),
        monthlyCounts: Array(12).fill(0),
        yearTotal: 0,
        yearGross: 0,
        yearSettle: 0,
        yearCount: 0
      };
    });

    // Populate amounts
    yearRecords.forEach(r => {
      const card = r.actualCard || '기타';
      if (!cardMap[card]) {
        const isCashCard = card === '현금';
        cardMap[card] = {
          name: card,
          type: isCashCard ? 'cash' : 'pay',
          color: '#6366f1',
          monthlyAmounts: Array(12).fill(0),
          monthlyGross: Array(12).fill(0),
          monthlySettle: Array(12).fill(0),
          monthlyCounts: Array(12).fill(0),
          yearTotal: 0,
          yearGross: 0,
          yearSettle: 0,
          yearCount: 0
        };
      }

      const mIdx = parseInt(r.date.split('-')[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        const gross = Number(r.amount) || 0;
        const settle = Number(r.settleAmount) || 0;
        const net = Math.max(0, gross - settle);
        const amt = (annualSettleMode === 'gross') ? gross : net;

        cardMap[card].monthlyAmounts[mIdx] += amt;
        cardMap[card].monthlyGross[mIdx] += gross;
        cardMap[card].monthlySettle[mIdx] += settle;
        cardMap[card].monthlyCounts[mIdx]++;

        cardMap[card].yearTotal += amt;
        cardMap[card].yearGross += gross;
        cardMap[card].yearSettle += settle;
        cardMap[card].yearCount++;
      }
    });

    // Totals across all cards (unfiltered by card type tab)
    let grandTotalAllCards = 0;
    let grandGrossAllCards = 0;
    let grandSettleAllCards = 0;
    let grandCountAllCards = yearRecords.length;

    let typeSums = { physical: 0, pay: 0, cash: 0 };
    let monthlyTotalsAll = Array(12).fill(0);

    Object.values(cardMap).forEach(c => {
      grandTotalAllCards += c.yearTotal;
      grandGrossAllCards += c.yearGross;
      grandSettleAllCards += c.yearSettle;
      const t = c.type === 'physical' ? 'physical' : (c.type === 'cash' || c.name === '현금' ? 'cash' : 'pay');
      typeSums[t] = (typeSums[t] || 0) + c.yearTotal;
      for (let i = 0; i < 12; i++) {
        monthlyTotalsAll[i] += c.monthlyAmounts[i];
      }
    });

    // Update Filter Tab Count Badges (현금은 pay에서 완전 제외)
    const allCardsList = Object.values(cardMap);
    const cntAll = allCardsList.length;
    const cntPhysical = allCardsList.filter(c => c.type === 'physical' && c.name !== '현금').length;
    const cntPay = allCardsList.filter(c => c.type === 'pay' && c.name !== '현금' && c.type !== 'cash').length;
    const cntCash = allCardsList.filter(c => c.type === 'cash' || c.name === '현금').length;

    if (document.getElementById('annualCntAll')) document.getElementById('annualCntAll').textContent = cntAll;
    if (document.getElementById('annualCntPhysical')) document.getElementById('annualCntPhysical').textContent = cntPhysical;
    if (document.getElementById('annualCntPay')) document.getElementById('annualCntPay').textContent = cntPay;
    if (document.getElementById('annualCntCash')) document.getElementById('annualCntCash').textContent = cntCash;

    // 4. Update KPI Summary Cards
    const elTotalAmt = document.getElementById('annualTotalAmount');
    if (elTotalAmt) elTotalAmt.textContent = formatCurrency(grandTotalAllCards);

    const elTotalCount = document.getElementById('annualTotalCountHeader');
    if (elTotalCount) elTotalCount.textContent = `(총 ${grandCountAllCards}건)`;

    const elSettleBadge = document.getElementById('annualTotalSettleBadge');
    if (elSettleBadge) {
      if (grandSettleAllCards > 0 && annualSettleMode === 'net') {
        elSettleBadge.innerHTML = `<span class="kpi-tx-settle-badge" title="연간 정산 회수액">👥 정산 -${formatCurrency(grandSettleAllCards)}원 반영</span>`;
      } else if (annualSettleMode === 'gross') {
        elSettleBadge.innerHTML = `<span class="kpi-tx-settle-badge" style="background:rgba(99,102,241,0.15); color:#818cf8; border-color:rgba(99,102,241,0.3);">💳 결제원금 기준</span>`;
      } else {
        elSettleBadge.innerHTML = '';
      }
    }

    // Monthly Average
    const activeMonths = monthlyTotalsAll.filter(t => t > 0).length || 1;
    const monthlyAvg = Math.round(grandTotalAllCards / activeMonths);
    const elMonthlyAvg = document.getElementById('annualMonthlyAvg');
    if (elMonthlyAvg) elMonthlyAvg.textContent = formatCurrency(monthlyAvg);
    const elActiveMonths = document.getElementById('annualActiveMonthsHeader');
    if (elActiveMonths) elActiveMonths.textContent = `(활동 ${activeMonths}개월 기준)`;

    // Top Card
    const sortedAllCards = [...allCardsList].sort((a, b) => b.yearTotal - a.yearTotal);
    const topCard = sortedAllCards[0];
    const elTopCardName = document.getElementById('annualTopCardName');
    const elTopCardAmt = document.getElementById('annualTopCardAmount');
    const elTopCardShare = document.getElementById('annualTopCardShare');

    if (topCard && topCard.yearTotal > 0) {
      if (elTopCardName) elTopCardName.textContent = topCard.name;
      if (elTopCardAmt) elTopCardAmt.textContent = `(${formatCurrency(topCard.yearTotal)}원)`;
      const share = grandTotalAllCards > 0 ? ((topCard.yearTotal / grandTotalAllCards) * 100).toFixed(1) : 0;
      if (elTopCardShare) elTopCardShare.textContent = `(비중 ${share}%)`;
    } else {
      if (elTopCardName) elTopCardName.textContent = '-';
      if (elTopCardAmt) elTopCardAmt.textContent = '';
      if (elTopCardShare) elTopCardShare.textContent = '';
    }

    // Type Breakdown
    const elBreakdown = document.getElementById('annualTypeBreakdown');
    if (elBreakdown) {
      const pAmt = typeSums.physical || 0;
      const payAmt = typeSums.pay || 0;
      const cAmt = typeSums.cash || 0;
      const pShare = grandTotalAllCards > 0 ? ((pAmt / grandTotalAllCards) * 100).toFixed(1) : 0;
      const payShare = grandTotalAllCards > 0 ? ((payAmt / grandTotalAllCards) * 100).toFixed(1) : 0;
      const cShare = grandTotalAllCards > 0 ? ((cAmt / grandTotalAllCards) * 100).toFixed(1) : 0;

      elBreakdown.innerHTML = `
        <div class="annual-type-badge-item">
          <span class="annual-type-badge-name"><span class="matrix-badge-type physical">💳 실물</span> 카드</span>
          <span class="annual-type-badge-val">${formatCurrency(pAmt)}원 (${pShare}%)</span>
        </div>
        <div class="annual-type-badge-item">
          <span class="annual-type-badge-name"><span class="matrix-badge-type pay">📱 간편</span> 결제/계좌</span>
          <span class="annual-type-badge-val">${formatCurrency(payAmt)}원 (${payShare}%)</span>
        </div>
        <div class="annual-type-badge-item">
          <span class="annual-type-badge-name"><span class="matrix-badge-type cash">💵 현금</span> 지출</span>
          <span class="annual-type-badge-val">${formatCurrency(cAmt)}원 (${cShare}%)</span>
        </div>
      `;
    }

    // 5. Render Matrix Table
    const matrixTitle = document.getElementById('annualMatrixTitle');
    if (matrixTitle) {
      matrixTitle.textContent = `📋 [${annualSelectedYear}년] 월별 카드 소비 취합표 (${annualSettleMode === 'net' ? '실부담액 기준' : '결제 원금 기준'})`;
    }
    const matrixBadge = document.getElementById('annualMatrixTotalBadge');
    if (matrixBadge) {
      matrixBadge.textContent = `연간 합계: ${formatCurrency(grandTotalAllCards)}원`;
    }

    const tbody = document.getElementById('annualMatrixBody');
    const tfoot = document.getElementById('annualMatrixFoot');
    if (!tbody || !tfoot) return;
    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    // Group cards according to filter - 카드 결제 수단 이름(가나다 순)으로 고정 정렬하여 월/조건 변경 시 카드가 흔들리지 않도록 유지
    const physicalList = allCardsList
      .filter(c => c.type === 'physical' && c.name !== '현금')
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    const payList = allCardsList
      .filter(c => c.type === 'pay' && c.name !== '현금' && c.type !== 'cash')
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    const cashList = allCardsList
      .filter(c => c.type === 'cash' || c.name === '현금')
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    const groupsToRender = [];
    if (annualCardFilter === 'all' || annualCardFilter === 'physical') {
      groupsToRender.push({ title: '💳 실물 카드', type: 'physical', list: physicalList });
    }
    if (annualCardFilter === 'all' || annualCardFilter === 'pay') {
      groupsToRender.push({ title: '📱 간편결제 / 계좌', type: 'pay', list: payList });
    }
    if (annualCardFilter === 'all' || annualCardFilter === 'cash') {
      groupsToRender.push({ title: '💵 현금', type: 'cash', list: cashList });
    }

    const currentTableMonthlyTotals = Array(12).fill(0);
    let currentTableGrandTotal = 0;

    groupsToRender.forEach(g => {
      if (g.list.length === 0) return;

      let groupMonthlySums = Array(12).fill(0);
      let groupYearTotal = 0;

      g.list.forEach(c => {
        const tr = document.createElement('tr');
        const conf = CARD_CONFIG[c.name] || { color: '#6366f1' };
        const share = grandTotalAllCards > 0 ? ((c.yearTotal / grandTotalAllCards) * 100).toFixed(1) : 0;
        const avg = Math.round(c.yearTotal / 12);

        let monthsHtml = '';
        for (let m = 0; m < 12; m++) {
          const val = c.monthlyAmounts[m];
          groupMonthlySums[m] += val;
          currentTableMonthlyTotals[m] += val;

          if (val > 0) {
            monthsHtml += `<td class="cell-has-amt" data-year="${annualSelectedYear}" data-month="${m+1}" data-card="${c.name}" title="${annualSelectedYear}년 ${m+1}월 '${c.name}' 내역으로 이동">${formatCurrency(val)}</td>`;
          } else {
            monthsHtml += `<td class="cell-zero-amt">-</td>`;
          }
        }

        groupYearTotal += c.yearTotal;
        currentTableGrandTotal += c.yearTotal;

        const typeBadge = g.type === 'physical' 
          ? `<span class="matrix-badge-type physical">실물</span>`
          : (g.type === 'cash' ? `<span class="matrix-badge-type cash">현금</span>` : `<span class="matrix-badge-type pay">간편</span>`);

        tr.innerHTML = `
          <td class="sticky-col">
            <span class="card-chip-dot" style="background:${conf.color || '#6366f1'};"></span>
            <strong>${c.name}</strong>
          </td>
          <td style="text-align: center;">${typeBadge}</td>
          ${monthsHtml}
          <td class="cell-annual-total">${formatCurrency(c.yearTotal)}</td>
          <td>${formatCurrency(avg)}</td>
          <td>${share}%</td>
        `;
        tbody.appendChild(tr);
      });

      // Group Subtotal Row
      if (g.list.length > 0) {
        const subTr = document.createElement('tr');
        subTr.className = 'row-subtotal';
        const groupShare = grandTotalAllCards > 0 ? ((groupYearTotal / grandTotalAllCards) * 100).toFixed(1) : 0;
        const groupAvg = Math.round(groupYearTotal / 12);

        let subMonthsHtml = '';
        for (let m = 0; m < 12; m++) {
          const v = groupMonthlySums[m];
          subMonthsHtml += `<td>${v > 0 ? formatCurrency(v) : '-'}</td>`;
        }

        subTr.innerHTML = `
          <td class="sticky-col">${g.title} 소계 (${g.list.length}개)</td>
          <td style="text-align: center;">-</td>
          ${subMonthsHtml}
          <td class="cell-annual-total">${formatCurrency(groupYearTotal)}</td>
          <td>${formatCurrency(groupAvg)}</td>
          <td>${groupShare}%</td>
        `;
        tbody.appendChild(subTr);
      }
    });

    // Footer: Grand Total Row
    const grandTr = document.createElement('tr');
    grandTr.className = 'row-grand-total';
    let footMonthsHtml = '';
    for (let m = 0; m < 12; m++) {
      const v = currentTableMonthlyTotals[m];
      footMonthsHtml += `<td>${v > 0 ? formatCurrency(v) : '-'}</td>`;
    }
    const grandAvg = Math.round(currentTableGrandTotal / 12);
    const grandShare = grandTotalAllCards > 0 ? ((currentTableGrandTotal / grandTotalAllCards) * 100).toFixed(1) : 0;

    grandTr.innerHTML = `
      <td class="sticky-col">월별 총 지출액 합계</td>
      <td style="text-align: center;">-</td>
      ${footMonthsHtml}
      <td class="cell-annual-total" style="color: #ffffff; background: rgba(99, 102, 241, 0.4);">${formatCurrency(currentTableGrandTotal)}</td>
      <td>${formatCurrency(grandAvg)}</td>
      <td>${grandShare}%</td>
    `;
    tfoot.appendChild(grandTr);

    // Attach Cell Click Event (jump to monthly view with card & month filtered)
    tbody.querySelectorAll('.cell-has-amt').forEach(cell => {
      cell.addEventListener('click', () => {
        const y = cell.dataset.year;
        const m = String(cell.dataset.month).padStart(2, '0');
        const card = cell.dataset.card;
        const targetMonth = `${y}-${m}`;

        // Switch to monthly view
        currentMainView = 'monthly';
        document.getElementById('tabMonthlyView')?.classList.add('active');
        document.getElementById('tabAnnualView')?.classList.remove('active');
        const mCont = document.getElementById('monthlyViewContainer');
        const aCont = document.getElementById('annualViewContainer');
        if (mCont) mCont.style.display = 'block';
        if (aCont) aCont.style.display = 'none';

        // Set month filter
        const monthSelect = document.getElementById('globalMonthFilter');
        if (monthSelect) {
          monthSelect.value = targetMonth;
          appState.currentMonth = targetMonth;
        }

        // Set card filter
        appState.filterCard = card;
        const filterCardEl = document.getElementById('filterCard');
        if (filterCardEl) filterCardEl.value = card;

        renderAll();

        // Scroll to transaction table
        document.getElementById('txTable')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast(`${y}년 ${parseInt(m, 10)}월 '${card}' 지출 내역으로 이동했습니다.`, 'info');
      });
    });

    // 6. Render Stacked Bar Chart
    renderAnnualStackedChart(allCardsList);
  }

  function renderAnnualStackedChart(allCardsList) {
    const canvas = document.getElementById('annualStackedBarChart');
    if (!canvas) return;

    if (annualStackedChartInstance) {
      annualStackedChartInstance.destroy();
      annualStackedChartInstance = null;
    }

    const labels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

    let cardsForChart = allCardsList.filter(c => c.yearTotal > 0);
    if (annualCardFilter === 'physical') {
      cardsForChart = cardsForChart.filter(c => c.type === 'physical' && c.name !== '현금');
    } else if (annualCardFilter === 'pay') {
      cardsForChart = cardsForChart.filter(c => c.type === 'pay' && c.name !== '현금' && c.type !== 'cash');
    } else if (annualCardFilter === 'cash') {
      cardsForChart = cardsForChart.filter(c => c.type === 'cash' || c.name === '현금');
    }

    cardsForChart.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    const datasets = cardsForChart.map(c => {
      const conf = CARD_CONFIG[c.name] || { color: '#6366f1' };
      return {
        label: c.name,
        data: c.monthlyAmounts,
        backgroundColor: conf.color || '#6366f1',
        borderRadius: 3,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
      };
    });

    const ctx = canvas.getContext('2d');
    annualStackedChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: 'rgba(255, 255, 255, 0.7)', font: { weight: '600' } }
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              callback: v => formatCurrency(v) + '원'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              padding: 12,
              color: 'rgba(255, 255, 255, 0.85)',
              font: { family: 'Pretendard', size: 12, weight: '600' }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(99, 102, 241, 0.4)',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (item) => {
                const val = item.raw || 0;
                if (val === 0) return null;
                return ` ${item.dataset.label}: ${formatCurrency(val)}원`;
              },
              footer: (items) => {
                const total = items.reduce((sum, item) => sum + (item.raw || 0), 0);
                return `총 월 지출: ${formatCurrency(total)}원`;
              }
            }
          }
        }
      }
    });
  }

  function exportAnnualMatrixToCSV() {
    const year = annualSelectedYear || new Date().getFullYear();
    const modeLabel = annualSettleMode === 'net' ? '실부담액기준' : '결제원금기준';

    const table = document.getElementById('annualMatrixTable');
    if (!table) return;

    let csv = '\uFEFF'; // UTF-8 BOM
    csv += `연말정산 및 월별 카드 소비 취합표 (${year}년, ${annualSettleMode === 'net' ? '실부담 기준' : '결제 원금 기준'})\r\n\r\n`;

    const headers = ['결제수단', '구분', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', '연간합계', '월평균', '비중'];
    csv += headers.map(h => `"${h}"`).join(',') + '\r\n';

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(tr => {
      const cells = Array.from(tr.querySelectorAll('td')).map(td => {
        let text = td.textContent.trim().replace(/\s+/g, ' ');
        return `"${text.replace(/"/g, '""')}"`;
      });
      csv += cells.join(',') + '\r\n';
    });

    const footRows = table.querySelectorAll('tfoot tr');
    footRows.forEach(tr => {
      const cells = Array.from(tr.querySelectorAll('td')).map(td => {
        let text = td.textContent.trim().replace(/\s+/g, ' ');
        return `"${text.replace(/"/g, '""')}"`;
      });
      csv += cells.join(',') + '\r\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `연말정산_카드별_월별소비취합_${year}년_${modeLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`${year}년 연말정산 취합표가 CSV로 다운로드되었습니다.`, 'success');
  }

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
