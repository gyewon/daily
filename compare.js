/**
 * 고정비 예정(monthly 카드 고정지출) vs 실제(daily 카테고리 '고정비') 월별 비교 탭
 * - monthly: https://gyewon.github.io/monthly/ 의 '고정지출 관리' 중 결제수단이 '카드'인 항목 합계 = 매월 나가야 할 돈
 * - daily  : 이 가계부의 대분류(카테고리)가 '고정비'인 내역 (사용 가능한 모든 월, 12월 데이터가 생기면 자동 추가)
 */
(function () {
  'use strict';

  var DAILY_URL = 'https://jkuuwmuniuvijvbtvwde.supabase.co';
  var DAILY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdXV3bXVuaXV2aWp2YnR2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjYzNzIsImV4cCI6MjEwNjI0MjM3Mn0.oo9L8jfEKj_ASOqqLCOQaT_8_obkv6OyJ4pGdJXTLuE';
  var MONTHLY_URL = 'https://bdnqlcrpytkwuaonhgmm.supabase.co';
  var MONTHLY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkbnFsY3JweXRrd3Vhb25oZ21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MjYyMDEsImV4cCI6MjEwNTUwMjIwMX0.QLt4HgVyCoAR2oy1R5O3SdNe7N3XtVxP7rjabS3j_ew';

  // monthly 항목명 -> daily 내역(가맹점+메모)에서 찾을 키워드. 필요하면 여기만 고치면 됩니다.
  var ALIASES = {
    '네이버멤버십': ['네이버플러스', '네이버 플러스', '네이버멤버십'],
    '쿠팡멤버십': ['쿠팡'],
    '원이보험비(DB)': ['DB손해', '디비손해'],
    '원이보험비(삼성화재)': ['삼성화재'],
    '관리비': ['관리비', '전기', '예스코', '한국전력', '도시가스'],
    '계원폰요금': ['계원폰', 'KT통신요금'],
    '동욱폰요금': ['동욱폰'],
    '하이패스': ['하이패스', '도로공사'],
    '베인': ['베인', '배민', '우아한형제들'],
    '배달의민족': ['배달의민족', '배민', '우아한형제들']
  };

  var won = function (n) { return (Math.round(n) || 0).toLocaleString('ko-KR'); };
  var signed = function (n) { n = Math.round(n) || 0; return (n > 0 ? '+' : n < 0 ? '-' : '') + Math.abs(n).toLocaleString('ko-KR'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };

  var css = [
    '#compareViewContainer .cmp-wrap{display:flex;flex-direction:column;gap:20px}',
    '#compareViewContainer .cmp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}',
    '#compareViewContainer .cmp-head h2{font-size:1.25rem;margin-bottom:4px}',
    '#compareViewContainer .cmp-sub{color:var(--text-secondary);font-size:.88rem;line-height:1.6}',
    '#compareViewContainer .cmp-btn{padding:8px 14px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;font-family:inherit;font-weight:600}',
    '#compareViewContainer .cmp-btn:hover{border-color:var(--primary)}',
    '#compareViewContainer .cmp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}',
    '#compareViewContainer .cmp-kpi{background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:14px;padding:14px 16px}',
    '#compareViewContainer .cmp-kpi .l{font-size:.8rem;color:var(--text-secondary)}',
    '#compareViewContainer .cmp-kpi .v{font-size:1.4rem;font-weight:800;margin-top:4px}',
    '#compareViewContainer .cmp-kpi .s{font-size:.75rem;color:var(--text-muted);margin-top:2px}',
    '#compareViewContainer .cmp-tablewrap{overflow-x:auto}',
    '#compareViewContainer table.cmp-table{width:100%;border-collapse:collapse;font-size:.9rem}',
    '#compareViewContainer .cmp-table th{padding:10px 12px;text-align:right;color:var(--text-secondary);font-weight:700;border-bottom:1px solid var(--border-color);white-space:nowrap}',
    '#compareViewContainer .cmp-table td{padding:10px 12px;text-align:right;border-bottom:1px solid var(--border-subtle);white-space:nowrap}',
    '#compareViewContainer .cmp-table th:first-child,#compareViewContainer .cmp-table td:first-child{text-align:left}',
    '#compareViewContainer .cmp-table td.t,#compareViewContainer .cmp-table th.t{text-align:left;white-space:normal}',
    '#compareViewContainer .cmp-table tfoot td{font-weight:800;border-top:2px solid var(--border-color)}',
    '#compareViewContainer .cmp-table tr.sub td{color:var(--text-secondary);font-size:.82rem;background:var(--bg-secondary)}',
    '#compareViewContainer .neg{color:var(--accent-rose)}',
    '#compareViewContainer .pos{color:var(--accent-amber)}',
    '#compareViewContainer .ok{color:var(--accent-green)}',
    '#compareViewContainer .mut{color:var(--text-muted)}',
    '#compareViewContainer .bdg{display:inline-block;white-space:nowrap;padding:2px 9px;border-radius:999px;font-size:.75rem;font-weight:700;border:1px solid transparent}',
    '#compareViewContainer .bdg.short{background:rgba(244,63,94,.14);color:var(--accent-rose);border-color:rgba(244,63,94,.35)}',
    '#compareViewContainer .bdg.over{background:rgba(245,158,11,.14);color:var(--accent-amber);border-color:rgba(245,158,11,.35)}',
    '#compareViewContainer .bdg.same{background:rgba(16,185,129,.14);color:var(--accent-green);border-color:rgba(16,185,129,.35)}',
    '#compareViewContainer .bdg.none{background:rgba(100,116,139,.18);color:var(--text-secondary);border-color:rgba(100,116,139,.35)}',
    '#compareViewContainer .bdg.extra{background:rgba(139,92,246,.14);color:var(--accent-purple);border-color:rgba(139,92,246,.35)}',
    '#compareViewContainer details.cmp-month{border:1px solid var(--border-color);border-radius:14px;background:var(--bg-secondary);overflow:hidden}',
    '#compareViewContainer details.cmp-month>summary{cursor:pointer;padding:14px 16px;font-weight:800;display:flex;gap:14px;align-items:center;flex-wrap:wrap}',
    '#compareViewContainer details.cmp-month>summary .m{font-size:1.05rem}',
    '#compareViewContainer details.cmp-month .cmp-body{padding:0 12px 14px}',
    '#compareViewContainer .cmp-note{font-size:.8rem;color:var(--text-muted);line-height:1.7}',
    '#compareViewContainer .cmp-msg{padding:30px;text-align:center;color:var(--text-secondary)}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('cmpStyle')) return;
    var st = document.createElement('style');
    st.id = 'cmpStyle';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---- 데이터 로딩 -------------------------------------------------------
  var clients = {};
  function client(url, key) {
    if (!clients[url]) clients[url] = window.supabase.createClient(url, key);
    return clients[url];
  }

  function pmType(method, types) {
    var m = String(method || '').trim();
    if (!m) return '미분류';
    var t = types && types[m];
    if (t) return t === 'card' ? '카드' : t === 'cash' ? '현금/이체' : t;
    return m.indexOf('카드') >= 0 ? '카드' : '현금/이체';
  }

  function extractLiteral(text, marker) {
    var i = text.indexOf(marker);
    if (i < 0) return null;
    var start = text.indexOf('{', i), depth = 0, q = null;
    for (var p = start; p < text.length; p++) {
      var c = text[p], n = text[p + 1];
      if (q) { if (c === '\\') p++; else if (c === q) q = null; continue; }
      if (c === '/' && n === '/') { p = text.indexOf('\n', p); if (p < 0) break; continue; }
      if (c === '/' && n === '*') { p = text.indexOf('*/', p) + 1; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return text.slice(start, p + 1); }
    }
    return null;
  }

  // ---- 설정/스냅샷 (daily Supabase app_settings 'compare_config' 에 저장 → 기기 간 공유) ----
  var cfg = { items: {}, snapshot: null };
  async function loadCfg() {
    var r = await client(DAILY_URL, DAILY_KEY).from('app_settings').select('value').eq('key', 'compare_config').maybeSingle();
    if (r.data && r.data.value) cfg = Object.assign({ items: {}, snapshot: null }, r.data.value);
    if (!cfg.items) cfg.items = {};
  }
  async function saveCfg() {
    var r = await client(DAILY_URL, DAILY_KEY).from('app_settings').upsert({ key: 'compare_config', value: cfg });
    return !r.error;
  }

  function localMonthly() {
    try {
      var raw = localStorage.getItem('dongwook_gyewon_budget_app_v2');
      var s = raw && JSON.parse(raw);
      return s && Array.isArray(s.fixedExpenses) && s.fixedExpenses.length ? s : null;
    } catch (e) { return null; }
  }
  async function defaultMonthly() {
    var js = await (await fetch('../monthly/app.js?_=' + Date.now())).text();
    var lit = extractLiteral(js, 'DEFAULT_EXCEL_DATA = ');
    if (!lit) throw new Error('monthly 고정지출 데이터를 찾지 못했습니다.');
    return (new Function('return (' + lit + ')'))();
  }
  function toSnap(state, source) {
    return {
      savedAt: Date.now(), source: source,
      types: (state.categories && state.categories.paymentMethodTypes) || {},
      items: state.fixedExpenses.filter(function (f) { return f.isPaid && f.method && pmType(f.method, (state.categories && state.categories.paymentMethodTypes) || {}) !== '현금/이체'; }).map(function (f) {
        return { name: f.name, amount: Number(f.amount) || 0, method: String(f.method || '').trim(), category: f.category, day: f.day };
      })
    };
  }
  var sig = function (s) { return JSON.stringify([s && s.types, s && s.items]); };

  // monthly 고정지출을 읽어 스냅샷으로 저장. force=true 면 monthly 화면 데이터가 없을 때 monthly 기본 데이터를 다시 읽음
  async function remoteMonthly() {
    try {
      var res = await Promise.race([
        client(MONTHLY_URL, MONTHLY_KEY).from('monthly_budget_data').select('data').eq('id', 'main').single(),
        new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 4000); })
      ]);
      var d = res && !res.error && res.data && res.data.data;
      return d && Array.isArray(d.fixedExpenses) && d.fixedExpenses.length ? d : null;
    } catch (e) { return null; }
  }

  // monthly 의 [표시] 체크된 고정지출만 스냅샷으로 저장.
  // 자동: 이 브라우저의 monthly 데이터 사용 / 버튼(force): monthly Supabase 와 비교해 최신 → 없으면 기본 데이터
  async function syncMonthly(force) {
    var local = localMonthly(), remote = null, snap = null;
    if (force || !local) remote = await remoteMonthly();
    var cands = [];
    if (local) cands.push({ s: local, src: 'monthly 화면 (이 브라우저)' });
    if (remote) cands.push({ s: remote, src: 'monthly 클라우드(Supabase)' });
    cands.sort(function (a, b) { return (b.s.lastUpdated || 0) - (a.s.lastUpdated || 0); });
    if (cands.length) snap = toSnap(cands[0].s, cands[0].src);
    else if (force || !cfg.snapshot) snap = toSnap(await defaultMonthly(), 'monthly 기본 데이터');
    if (snap && sig(snap) !== sig(cfg.snapshot)) {
      cfg.snapshot = snap;
      if (cands.length || force) await saveCfg();
      return true;
    }
    return false;
  }

  async function loadData() {
    await loadCfg();
    await syncMonthly(false);
    var snap = cfg.snapshot;
    var planned = snap.items.map(function (it) {
      var o = cfg.items[it.name] || {};
      var auto = pmType(it.method, snap.types) === '카드';
      var pay = o.pay === 'cash' ? 'cash' : 'card';
      return { name: it.name, method: it.method, category: it.category, amount: it.amount, day: it.day, pay: pay, aliases: o.aliases || '' };
    }).filter(function (p) { return p.pay !== 'other'; });

    var dc = client(DAILY_URL, DAILY_KEY);
    var rres = await dc.from('app_settings').select('*').in('key', ['records', 'custom_types']);
    if (rres.error) throw new Error('daily 내역을 불러오지 못했습니다: ' + rres.error.message);
    var records = [], customTypes = { '고정비': ['고정비'] };
    (rres.data || []).forEach(function (row) {
      if (row.key === 'records' && Array.isArray(row.value)) records = row.value;
      if (row.key === 'custom_types' && row.value) customTypes = row.value;
    });
    var fixedCats = (customTypes['고정비'] || ['고정비']).slice();
    if (fixedCats.indexOf('고정비') < 0) fixedCats.push('고정비');
    // daily 의 '고정비' 유형 판정과 동일: isFixed==='Y' 이거나 대분류가 고정비 유형 카테고리
    var fixed = records.filter(function (r) {
      if (!r.date || r.isCanceled) return false;
      return r.isFixed === 'Y' || fixedCats.indexOf(r.category) >= 0;
    });
    return { planned: planned, fixed: fixed, snap: snap };
  }

  // ---- 계산 ---------------------------------------------------------------
  function compute(data) {
    var cardPlan = data.planned.filter(function (p) { return p.pay === 'card'; });
    var cashPlan = data.planned.filter(function (p) { return p.pay === 'cash'; });
    var plannedTotal = cardPlan.reduce(function (s, p) { return s + p.amount; }, 0);
    var cashTotal = cashPlan.reduce(function (s, p) { return s + p.amount; }, 0);
    var byMonth = {};
    data.fixed.forEach(function (r) {
      var ym = String(r.date).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) return;
      (byMonth[ym] = byMonth[ym] || []).push(r);
    });
    var months = Object.keys(byMonth).sort();

    return months.map(function (ym) {
      var recs = byMonth[ym].slice().sort(function (a, b) { return (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')); });
      var used = new Array(recs.length).fill(false);
      var text = function (r) { return ((r.merchant || '') + ' ' + (r.memo || '')).toLowerCase(); };

      var items = cardPlan.map(function (p) { return { plan: p, matched: [] }; });
      // 1) 키워드 매칭
      items.forEach(function (it) {
        var custom = String(it.plan.aliases || '').split(',').map(function (k) { return k.trim(); }).filter(Boolean);
        var keys = (custom.length ? custom : (ALIASES[it.plan.name] || [])).map(function (k) { return k.toLowerCase(); });
        if (!keys.length) return;
        recs.forEach(function (r, i) {
          if (used[i]) return;
          var t = text(r);
          if (keys.some(function (k) { return t.indexOf(k) >= 0; })) { used[i] = true; it.matched.push(r); }
        });
      });
      // 2) 금액이 정확히 같은 내역
      items.forEach(function (it) {
        if (it.matched.length) return;
        for (var i = 0; i < recs.length; i++) {
          if (!used[i] && (Number(recs[i].amount) || 0) === it.plan.amount) { used[i] = true; it.matched.push(recs[i]); break; }
        }
      });
      items.forEach(function (it) {
        it.actual = it.matched.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
        it.diff = it.actual - it.plan.amount;
        it.status = !it.matched.length ? 'none' : it.diff === 0 ? 'same' : it.diff < 0 ? 'short' : 'over';
      });
      var extras = recs.filter(function (r, i) { return !used[i]; });
      var recTotal = recs.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
      var recPaid = recs.filter(function (r) { return r.exclude === 'Y'; }).reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
      // monthly 기준: 현금으로 지급한 항목도 예정에 포함하고, 실제에는 '현금 지급 완료'로 포함
      var actualTotal = recTotal + cashTotal, paid = recPaid + cashTotal, plannedAll = plannedTotal + cashTotal;
      return {
        ym: ym, items: items, cashPlan: cashPlan, cashTotal: cashTotal, extras: extras, recs: recs,
        planned: plannedAll, actual: actualTotal, diff: actualTotal - plannedAll,
        paid: paid, pending: recTotal - recPaid,
        extraTotal: extras.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0),
        shortItems: items.filter(function (i) { return i.status === 'short' || i.status === 'none'; })
      };
    });
  }

  // ---- 렌더 ---------------------------------------------------------------
  var BADGE = {
    same: ['same', '일치'], short: ['short', '부족'], over: ['over', '초과'], none: ['none', '내역 없음']
  };
  function totalBadge(diff) {
    if (diff === 0) return '<span class="bdg same">일치</span>';
    return diff < 0 ? '<span class="bdg short">예정보다 ' + won(-diff) + '원 덜 나감</span>' : '<span class="bdg over">예정보다 ' + won(diff) + '원 더 나감</span>';
  }
  var curYM = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  var mLabel = function (ym) { return ym.slice(0, 4) + '년 ' + parseInt(ym.slice(5), 10) + '월'; };
  var recDesc = function (r) {
    var card = r.actualCard ? ' · ' + r.actualCard : '';
    var st = r.exclude === 'Y' ? '완료' : '대기';
    return r.date.slice(5) + ' ' + esc(r.merchant) + ' ' + won(r.amount) + '원' + esc(card) + ' (' + st + ')';
  };

  function render(host, data, rows) {
    var cardPlan = data.planned.filter(function (p) { return p.pay === 'card'; });
    var cashPlan = data.planned.filter(function (p) { return p.pay === 'cash'; });
    var plannedTotal = cardPlan.reduce(function (s, p) { return s + p.amount; }, 0);
    var cashTotal = cashPlan.reduce(function (s, p) { return s + p.amount; }, 0);
    var h = '<div class="cmp-wrap">';
    h += '<section class="panel"><div class="cmp-head"><div><h2>⚖️ 고정비 비교: 나가야 할 돈(monthly) vs 실제 나간 돈(daily)</h2>' +
      '<p class="cmp-sub"><b>예정</b> = monthly 고정지출 관리에서 <b>[표시] 체크</b>되고 현금/이체가 아닌 결제수단 항목 합계 (' + (cardPlan.length + cashPlan.length) + '개 항목). 현금으로 준 항목은 예정에 포함하고, 실제에는 현금 지급 완료로 더합니다.<br>' +
      '<b>실제</b> = daily 에서 대분류가 <b>고정비</b>인 월별 내역 합계. 새 달(예: 12월) 내역이 생기면 자동으로 표가 추가됩니다.</p></div>' +
      '<div><button type="button" class="cmp-btn" id="cmpSync">🔗 monthly 동기화 (표시 체크·현금 제외)</button> <button type="button" class="cmp-btn" id="cmpRefresh">🔄 새로고침</button></div></div>';

    var latest = rows[rows.length - 1];
    h += '<div class="cmp-kpis">' +
      '<div class="cmp-kpi"><div class="l">매월 나가야 할 카드 고정지출 (예정)</div><div class="v">' + won(plannedTotal + cashTotal) + '원</div><div class="s">monthly 결제수단별 비중 ‘카드’ 합계 · ' + (cardPlan.length + cashPlan.length) + '개 (카드 결제 ' + won(plannedTotal) + ' + 현금 지급 ' + won(cashTotal) + ')</div></div>' +
      '<div class="cmp-kpi"><div class="l">그중 현금으로 지급 (실제에 포함)</div><div class="v">' + won(cashTotal) + '원</div><div class="s">' + (cashPlan.length ? cashPlan.map(function (p) { return esc(p.name); }).join(', ') : '없음') + '</div></div>';
    if (latest) {
      h += '<div class="cmp-kpi"><div class="l">' + mLabel(latest.ym) + ' 실제 고정비</div><div class="v">' + won(latest.actual) + '원</div><div class="s">결제완료 ' + won(latest.paid) + ' / 대기 ' + won(latest.pending) + '</div></div>' +
        '<div class="cmp-kpi"><div class="l">' + mLabel(latest.ym) + ' 예정 대비</div><div class="v ' + (latest.diff < 0 ? 'neg' : latest.diff > 0 ? 'pos' : 'ok') + '">' + signed(latest.diff) + '원</div><div class="s">실제 − 예정</div></div>';
    }
    h += '</div></section>';

    // 연결 설정 패널
    var snapInfo = data.snap ? (esc(data.snap.source) + ' · ' + new Date(data.snap.savedAt).toLocaleString('ko-KR')) : '-';
    h += '<section class="panel"><h3>⚙️ 항목 설정 (monthly 연동)</h3><p class="cmp-note">monthly 고정지출 중 <b>[표시] 체크되고 결제수단이 현금/이체가 아닌 항목만</b> 불러옵니다 (' + data.snap.items.length + '개) · 기준: ' + snapInfo + '<br>지급방식을 <b>현금 지급</b>으로 바꾸면 daily 내역과 연결하지 않고 현금 지급 완료로 처리됩니다 (예정·실제 양쪽에 같은 금액 포함). 연결 키워드는 daily 가맹점명·메모와 연결할 때 쓰며(쉼표로 구분, 비우면 기본값), 변경 즉시 저장됩니다.</p>' +
      '<div class="cmp-tablewrap"><table class="cmp-table"><thead><tr><th>항목</th><th>monthly 결제수단</th><th>예정 금액</th><th class="t">지급방식</th><th class="t">연결 키워드</th></tr></thead><tbody>';
    data.snap.items.forEach(function (it) {
      var o = cfg.items[it.name] || {};
      var autoCard = pmType(it.method, data.snap.types) === '카드';
      var cur = o.pay || 'auto';
      h += '<tr><td>' + esc(it.name) + '</td><td class="mut">' + esc(it.method) + '</td><td>' + won(it.amount) + '</td><td class="t"><select class="cmp-pay" data-name="' + esc(it.name) + '">' +
        '<option value="auto"' + (cur !== 'cash' ? ' selected' : '') + '>카드로 비교</option>' +
        '<option value="cash"' + (cur === 'cash' ? ' selected' : '') + '>현금 지급</option></select></td>' +
        '<td class="t"><input class="cmp-alias" data-name="' + esc(it.name) + '" value="' + esc(o.aliases || '') + '" placeholder="' + esc((ALIASES[it.name] || []).join(', ')) + '" style="width:100%;min-width:180px;padding:6px 8px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-input);color:var(--text-primary)"></td></tr>';
    });
    h += '</tbody></table></div></section>';

    // 월별 요약표
    h += '<section class="panel"><h3>📅 월별 비교표</h3><div class="cmp-tablewrap"><table class="cmp-table"><thead><tr>' +
      '<th>월</th><th>예정 (카드 고정지출)</th><th>실제 (daily 고정비)</th><th>차액 (실제−예정)</th><th>달성률</th><th>결제완료</th><th>결제대기</th><th class="t">판정</th><th class="t">부족/미확인 항목</th></tr></thead><tbody>';
    var sp = 0, sa = 0, spaid = 0, spend = 0;
    rows.forEach(function (r) {
      sp += r.planned; sa += r.actual; spaid += r.paid; spend += r.pending;
      var short = r.shortItems.map(function (i) {
        return esc(i.plan.name) + (i.status === 'none' ? '(내역없음 ' + won(i.plan.amount) + ')' : '(' + signed(i.diff) + ')');
      }).join(', ');
      h += '<tr><td><b>' + mLabel(r.ym) + '</b>' + (r.ym === curYM() ? ' <span class="mut">(진행 중)</span>' : '') + '</td><td>' + won(r.planned) + '</td><td>' + won(r.actual) + '</td>' +
        '<td class="' + (r.diff < 0 ? 'neg' : r.diff > 0 ? 'pos' : 'ok') + '"><b>' + signed(r.diff) + '</b></td>' +
        '<td>' + (r.planned ? Math.round(r.actual / r.planned * 100) : 0) + '%</td>' +
        '<td>' + won(r.paid) + '</td><td>' + won(r.pending) + '</td><td class="t">' + totalBadge(r.diff) + '</td>' +
        '<td class="t mut">' + (short || '-') + '</td></tr>';
    });
    h += '</tbody><tfoot><tr><td>합계</td><td>' + won(sp) + '</td><td>' + won(sa) + '</td><td class="' + (sa - sp < 0 ? 'neg' : 'pos') + '">' + signed(sa - sp) + '</td><td>' + (sp ? Math.round(sa / sp * 100) : 0) + '%</td><td>' + won(spaid) + '</td><td>' + won(spend) + '</td><td colspan="2"></td></tr></tfoot></table></div>' +
      '<p class="cmp-note">부족 = 그 달 daily 고정비에서 예정 금액만큼 잡히지 않은 항목 / 초과 = 예정보다 더 나간 항목. 항목별 연결은 가맹점명·메모 키워드와 금액으로 자동 판단하며, 맞지 않으면 compare.js 상단의 ALIASES 를 수정하면 됩니다.</p></section>';

    // 월별 상세
    rows.slice().reverse().forEach(function (r, idx) {
      h += '<details class="cmp-month"' + (idx === 0 ? ' open' : '') + '><summary><span class="m">' + mLabel(r.ym) + '</span>' +
        '<span>예정 ' + won(r.planned) + '원</span><span>실제 ' + won(r.actual) + '원</span>' + totalBadge(r.diff) + '</summary><div class="cmp-body"><div class="cmp-tablewrap">' +
        '<table class="cmp-table"><thead><tr><th>항목 (monthly)</th><th>결제수단</th><th>예정</th><th>실제 (daily)</th><th>차이</th><th class="t">상태</th><th class="t">연결된 daily 내역</th></tr></thead><tbody>';
      r.items.forEach(function (it) {
        var b = BADGE[it.status];
        h += '<tr><td>' + esc(it.plan.name) + '</td><td class="mut">' + esc(it.plan.method) + '</td><td>' + won(it.plan.amount) + '</td>' +
          '<td>' + (it.matched.length ? won(it.actual) : '-') + '</td>' +
          '<td class="' + (it.diff < 0 || it.status === 'none' ? 'neg' : it.diff > 0 ? 'pos' : 'ok') + '">' + (it.status === 'none' ? signed(-it.plan.amount) : signed(it.diff)) + '</td>' +
          '<td class="t"><span class="bdg ' + b[0] + '">' + b[1] + '</span></td><td class="t mut">' + (it.matched.map(recDesc).join('<br>') || '-') + '</td></tr>';
      });
      r.cashPlan.forEach(function (p) {
        h += '<tr><td>' + esc(p.name) + '</td><td class="mut">' + esc(p.method) + ' → 현금</td><td>' + won(p.amount) + '</td><td>현금 ' + won(p.amount) + '</td><td class="ok">0</td><td class="t"><span class="bdg same">현금 지급</span></td><td class="t mut">daily 내역과 연결 안 함</td></tr>';
      });
      if (r.extras.length) {
        h += '<tr class="sub"><td colspan="7">예정에 없는 daily 고정비 내역 (' + r.extras.length + '건, ' + won(r.extraTotal) + '원)</td></tr>';
        r.extras.forEach(function (e) {
          h += '<tr><td>' + esc(e.merchant) + '</td><td class="mut">' + esc(e.actualCard || '') + '</td><td>-</td><td>' + won(e.amount) + '</td><td class="pos">' + signed(e.amount) + '</td>' +
            '<td class="t"><span class="bdg extra">예정 외</span></td><td class="t mut">' + e.date.slice(5) + (e.memo ? ' · ' + esc(e.memo) : '') + ' (' + (e.exclude === 'Y' ? '완료' : '대기') + ')</td></tr>';
        });
      }
      h += '</tbody><tfoot><tr><td>합계</td><td></td><td>' + won(r.planned) + '</td><td>' + won(r.actual) + '</td><td class="' + (r.diff < 0 ? 'neg' : 'pos') + '">' + signed(r.diff) + '</td><td colspan="2"></td></tr></tfoot></table></div></div></details>';
    });
    if (!rows.length) h += '<section class="panel"><div class="cmp-msg">daily 에 고정비 내역이 아직 없습니다.</div></section>';
    h += '</div>';
    host.innerHTML = h;
    var btn = host.querySelector('#cmpRefresh');
    if (btn) btn.addEventListener('click', function () { refresh(host, true); });
    var sb = host.querySelector('#cmpSync');
    if (sb) sb.addEventListener('click', async function () {
      sb.disabled = true; sb.textContent = '동기화 중…';
      try { await syncMonthly(true); await saveCfg(); } catch (e) { alert(e.message || e); }
      loading = false; refresh(host, true);
    });
    var change = async function (el) {
      var n = el.dataset.name, o = cfg.items[n] || (cfg.items[n] = {});
      if (el.classList.contains('cmp-pay')) o.pay = el.value; else o.aliases = el.value.trim();
      if ((!o.pay || o.pay === 'auto') && !o.aliases) delete cfg.items[n];
      await saveCfg();
      render(host, data, compute(data = rebuild(data)));
    };
    host.querySelectorAll('.cmp-pay, .cmp-alias').forEach(function (el) { el.addEventListener('change', function () { change(el); }); });
  }

  function rebuild(data) {
    var snap = data.snap;
    data.planned = snap.items.map(function (it) {
      var o = cfg.items[it.name] || {};
      var auto = pmType(it.method, snap.types) === '카드';
      var pay = o.pay === 'cash' ? 'cash' : 'card';
      return { name: it.name, method: it.method, category: it.category, amount: it.amount, day: it.day, pay: pay, aliases: o.aliases || '' };
    }).filter(function (p) { return p.pay !== 'other'; });
    return data;
  }

  var loading = false;
  async function refresh(host, force) {
    if (loading) return;
    loading = true;
    host.innerHTML = '<div class="cmp-wrap"><section class="panel"><div class="cmp-msg">불러오는 중…</div></section></div>';
    try {
      var data = await loadData();
      render(host, data, compute(data));
    } catch (e) {
      host.innerHTML = '<div class="cmp-wrap"><section class="panel"><div class="cmp-msg">' + esc(e.message || e) + '</div></section></div>';
    } finally { loading = false; }
  }

  // ---- 탭 연결 --------------------------------------------------------------
  function init() {
    var tabsBox = document.querySelector('.view-tabs-container');
    var annual = document.getElementById('annualViewContainer');
    var monthly = document.getElementById('monthlyViewContainer');
    if (!tabsBox || !annual || !monthly || document.getElementById('tabCompareView')) return;
    injectCss();

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'view-tab-btn';
    btn.id = 'tabCompareView';
    btn.dataset.view = 'compare';
    btn.innerHTML = '<span class="tab-icon">⚖️</span><span class="tab-title">고정비 비교 (예정 vs 실제)</span><span class="tab-pill">월별 표</span>';
    tabsBox.appendChild(btn);

    var host = document.createElement('div');
    host.id = 'compareViewContainer';
    host.className = 'main-view-container';
    host.style.display = 'none';
    annual.parentNode.insertBefore(host, annual.nextSibling);

    var tabM = document.getElementById('tabMonthlyView');
    var tabA = document.getElementById('tabAnnualView');

    btn.addEventListener('click', function () {
      tabsBox.querySelectorAll('.view-tab-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
      monthly.style.display = 'none';
      annual.style.display = 'none';
      host.style.display = 'block';
      refresh(host);
    });
    // 다른 탭으로 돌아갈 때 이 화면을 숨김 (기존 탭 핸들러 이후에 실행되도록 setTimeout)
    [[tabM, monthly], [tabA, annual]].forEach(function (pair) {
      if (!pair[0]) return;
      pair[0].addEventListener('click', function () {
        host.style.display = 'none';
        btn.classList.remove('active');
        setTimeout(function () {
          pair[0].classList.add('active');
          pair[1].style.display = 'block';
          (pair[0] === tabM ? annual : monthly).style.display = 'none';
        }, 0);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
