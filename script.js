/**
 * 見積金額・工数計算ツール
 * Backlog工数管理拡張機能のモーダルから計算ロジックを抽出したスタンドアロン版
 */

// ===== 定数 =====
const HOURS_PER_DAY = 8; // 1人日 = 8時間
const CONFIG_STORAGE_KEY   = 'estimate-config';
const INPUT_STORAGE_KEY    = 'estimate-input';
const HISTORY_STORAGE_KEY  = 'estimate-history';
const HISTORY_MAX_ITEMS    = 20;

// ===== 設定管理 =====

/**
 * 設定を localStorage から読み込む。
 * URL ハッシュに #config=BASE64 があればそれを優先して保存・適用する。
 * @returns {{ profitMargin: number, defaultHourlyRate: number, gradeRates: Object }}
 */
function loadConfig() {
  // 1. URLハッシュから設定を取得
  const hash = location.hash;
  if (hash.startsWith('#config=')) {
    try {
      const encoded = hash.slice('#config='.length);
      const parsed  = JSON.parse(atob(encoded));
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(parsed));
      // ハッシュをURLから除去（ブラウザ履歴を汚さない）
      history.replaceState(null, '', location.pathname + location.search);
      return parsed;
    } catch (e) {
      console.warn('設定URLの解析に失敗しました:', e);
    }
  }

  // 2. localStorage から取得
  const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch (e) { /* fall through */ }
  }

  // 3. 設定なし（null を返すと UI 側でバナーを表示）
  return null;
}

/**
 * 設定を localStorage に保存する。
 */
function saveConfig(config) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

/**
 * 現在の入力値を ?v=BASE64 としてURLに埋め込んで返す。
 * 設定がある場合は #config=BASE64 も付与する（受信者の画面で即座にアドレスバーから消える）。
 */
function buildInputUrl() {
  const d = {};
  const r  = parseFloat($hourlyRate.value);
  const a  = parseFloat($estimatedAmount.value);
  const h  = parseFloat($estimatedHours.value);
  const hd = parseFloat($estimatedMandays.value);
  const ah = parseFloat($actualHours.value);
  const ahd = parseFloat($actualMandays.value);
  const m  = $memo.value.trim();
  if (r)   d.r   = r;
  if (a)   d.a   = a;
  if (h)   d.h   = h;
  if (hd)  d.hd  = hd;
  if (ah)  d.ah  = ah;
  if (ahd) d.ahd = ahd;
  if (m)   d.m   = m;
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(d))));
  const base = `${location.origin}${location.pathname}?v=${encoded}`;
  // 設定がある場合は #config= を付与（受信者のページ読み込み時にアドレスバーから即除去される）
  if (appConfig) {
    const configEncoded = btoa(unescape(encodeURIComponent(JSON.stringify(appConfig))));
    return `${base}#config=${configEncoded}`;
  }
  return base;
}

/**
 * URL ?v=BASE64 から入力値を復元する。
 */
function loadInputFromUrl() {
  const params = new URLSearchParams(location.search);
  const v = params.get('v');
  if (!v) return;
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(v))));
    if (d.r   != null) $hourlyRate.value       = d.r;
    if (d.a   != null) $estimatedAmount.value  = d.a;
    if (d.h   != null) $estimatedHours.value   = d.h;
    if (d.hd  != null) $estimatedMandays.value = d.hd;
    if (d.ah  != null) $actualHours.value      = d.ah;
    if (d.ahd != null) $actualMandays.value    = d.ahd;
    if (d.m   != null) $memo.value             = d.m;
    // URLから ?v= を除去（アドレスバーをきれいに保つ）
    history.replaceState(null, '', location.pathname);
  } catch (e) {
    console.warn('入力URLの解析に失敗しました:', e);
  }
}

/**
 * 入力値を localStorage に保存する。
 */
function saveInputToStorage() {
  const d = {};
  const r   = $hourlyRate.value;
  const a   = $estimatedAmount.value;
  const h   = $estimatedHours.value;
  const hd  = $estimatedMandays.value;
  const ah  = $actualHours.value;
  const ahd = $actualMandays.value;
  const m   = $memo.value.trim();
  if (r)   d.r   = r;
  if (a)   d.a   = a;
  if (h)   d.h   = h;
  if (hd)  d.hd  = hd;
  if (ah)  d.ah  = ah;
  if (ahd) d.ahd = ahd;
  if (m)   d.m   = m;
  if (Object.keys(d).length) {
    localStorage.setItem(INPUT_STORAGE_KEY, JSON.stringify(d));
  } else {
    localStorage.removeItem(INPUT_STORAGE_KEY);
  }
}

/**
 * localStorage から入力値を復元する。
 * URL パラメータより優先度が低いため、loadInputFromUrl() より先に呼ぶこと。
 */
function loadInputFromStorage() {
  const stored = localStorage.getItem(INPUT_STORAGE_KEY);
  if (!stored) return;
  try {
    const d = JSON.parse(stored);
    if (d.r   != null) $hourlyRate.value       = d.r;
    if (d.a   != null) $estimatedAmount.value  = d.a;
    if (d.h   != null) $estimatedHours.value   = d.h;
    if (d.hd  != null) $estimatedMandays.value = d.hd;
    if (d.ah  != null) $actualHours.value      = d.ah;
    if (d.ahd != null) $actualMandays.value    = d.ahd;
    if (d.m   != null) $memo.value             = d.m;
  } catch (e) {
    console.warn('入力値の復元に失敗しました:', e);
  }
}

/**
 * 現在の設定から配布用 URL を生成する。
 */
function buildConfigUrl(config) {
  const encoded = btoa(JSON.stringify(config));
  return `${location.origin}${location.pathname}#config=${encoded}`;
}

// 設定を読み込んで動的定数として使用
let appConfig = loadConfig();

// 設定から定数を取得するヘルパー（設定なしの場合は undefined）
function PROFIT_MARGIN()      { return appConfig?.profitMargin; }
function GRADE_HOURLY_RATES() { return appConfig?.gradeRates   ? Object.fromEntries(
  Object.entries(appConfig.gradeRates).map(([k, v]) => [Number(k), v])
) : null; }

// ===== DOM 参照 =====
const $hourlyRate       = document.getElementById('hourly-rate');
const $estimatedAmount  = document.getElementById('estimated-amount');
const $estimatedHours   = document.getElementById('estimated-hours');
const $estimatedMandays = document.getElementById('estimated-mandays');
const $actualHours      = document.getElementById('actual-hours');
const $actualMandays    = document.getElementById('actual-mandays');

const $salesAmount      = document.getElementById('sales-amount');
const $actualCost       = document.getElementById('actual-cost');
const $profitAmount     = document.getElementById('profit-amount');
const $profitAlert      = document.getElementById('profit-alert');
const $profitAlertText  = document.getElementById('profit-alert-text');

const $gradeGrid        = document.getElementById('grade-grid');

const $gradeToggle      = document.getElementById('grade-toggle');
const $gradeBody        = document.getElementById('grade-body');
const $gradeArrow       = document.getElementById('grade-arrow');

const $profitGaugeWrap   = document.getElementById('profit-gauge-wrap');
const $profitGaugeFill   = document.getElementById('profit-gauge-fill');
const $profitGaugePct    = document.getElementById('profit-gauge-pct');
const $profitGaugeMarker = document.getElementById('profit-gauge-marker');

const $resetBtn         = document.getElementById('reset-btn');
const $memo             = document.getElementById('memo');
const $copyUrlBtn       = document.getElementById('copy-url-btn');
const $shareUrlRow      = document.getElementById('share-url-row');
const $shareUrlOut      = document.getElementById('share-url-out');
const $shareCopyUrl     = document.getElementById('share-copy-url');

// ===== ユーティリティ =====

/** 数値を日本円でフォーマット（小数点なし） */
const formatYen = (n) => `${Math.round(n).toLocaleString('ja-JP')}円`;

/** 差分を符号付きで表示 */
const formatDiff = (diff, unit = '') => {
  if (Math.abs(diff) < 0.01) return '';
  const sign = diff > 0 ? '+' : '';
  return `<span class="grade-diff">（標準より${sign}${diff.toFixed(1)}${unit}）</span>`;
};

const formatProfitDiff = (diff) => {
  if (Math.abs(diff) < 1) return '';
  const sign = diff > 0 ? '+' : '';
  return `<span class="grade-diff">（標準より${sign}${Math.round(diff).toLocaleString('ja-JP')}円）</span>`;
};

// ===== 計算ロジック =====

/**
 * 販売見積・利益セクションを計算して表示する
 */
function calcProfitInfo() {
  if (!PROFIT_MARGIN()) {
    [$salesAmount, $actualCost, $profitAmount].forEach((el) => { el.textContent = '-'; });
    $profitAlert.style.display = 'none';
    $profitGaugeWrap.style.display = 'none';
    return;
  }

  const estimatedAmount = parseFloat($estimatedAmount.value) || 0;
  const estimatedHours  = parseFloat($estimatedHours.value)  || 0;
  const actualHours     = parseFloat($actualHours.value)     || 0;
  const hourlyRate      = parseFloat($hourlyRate.value)      || 0;

  // 販売見積金額 = 見積金額 × 利益係数
  const salesAmount = estimatedAmount * PROFIT_MARGIN();
  // 制作費 = 実績時間 × 工数単価（実績時間未入力の場合は予定時間で代替）
  const costHours   = actualHours > 0 ? actualHours : estimatedHours;
  const actualCost  = costHours * hourlyRate;
  // 見込利益 = 販売見積金額 - 制作費
  const profit      = salesAmount - actualCost;
  // 利益率 = 見込利益 ÷ 見積金額
  const profitRateOnEstimate = estimatedAmount > 0 ? (profit / estimatedAmount) * 100 : 0;

  // 目標利益率 = (係数 - 1) × 100
  const targetRate = (PROFIT_MARGIN() - 1) * 100;
  // 警告判定（黒字 かつ 目標利益率未満）
  const isWarning = profit > 0 && profitRateOnEstimate < targetRate - 0.05;

  // ──── 販売見積金額（フォーカス中でなければ自動計算値を反映） ────
  if (!salesAmountFocused) {
    $salesAmount.value = salesAmount > 0 ? Math.round(salesAmount) : '';
  }

  // ──── 制作費 ────
  $actualCost.textContent = actualCost > 0 ? formatYen(actualCost) : '-';

  // ──── 見込利益 ────
  if (estimatedAmount > 0 && salesAmount > 0) {
    if (profit > 0) {
      $profitAmount.textContent = `+${formatYen(profit)}`;
      $profitAmount.className = `result-value highlight ${isWarning ? 'warning' : 'positive'}`;
    } else if (profit < 0) {
      $profitAmount.textContent = formatYen(profit);
      $profitAmount.className = 'result-value highlight negative';
    } else {
      $profitAmount.textContent = '±0円';
      $profitAmount.className = 'result-value highlight';
    }
  } else {
    $profitAmount.textContent = '-';
    $profitAmount.className = 'result-value highlight';
  }

  // ──── 利益率ゲージ ────
  if (estimatedAmount > 0 && salesAmount > 0) {
    $profitGaugeWrap.style.display = 'block';
    const maxRate  = Math.max(targetRate * 2, 10);
    const fillPct  = Math.min(100, Math.max(0, (profitRateOnEstimate / maxRate) * 100));
    const markPct  = Math.min(100, (targetRate / maxRate) * 100);
    $profitGaugeFill.style.width             = `${fillPct}%`;
    $profitGaugeMarker.style.left            = `${markPct}%`;
    $profitGaugeFill.style.backgroundColor   =
      profit < 0    ? 'var(--color-negative)' :
      isWarning     ? 'var(--color-warning)'  : 'var(--color-positive)';
    const pctClass = profit < 0 ? 'negative' : isWarning ? 'warning' : 'positive';
    $profitGaugePct.className   = pctClass;
    $profitGaugePct.textContent = `${profitRateOnEstimate.toFixed(1)}%　目標 ${targetRate.toFixed(0)}%`;
  } else {
    $profitGaugeWrap.style.display = 'none';
  }

  // ──── アラート ────
  if (isWarning) {
    $profitAlert.style.display = 'flex';
    $profitAlertText.textContent = `警告: 利益率が目標の${targetRate.toFixed(0)}%を下回っています（現在: ${profitRateOnEstimate.toFixed(1)}%）`;
  } else {
    $profitAlert.style.display = 'none';
  }
}

/**
 * 等級別工数分析を全等級比較テーブルで表示する
 */
function calcGradeAnalysis() {
  if (!GRADE_HOURLY_RATES() || !PROFIT_MARGIN()) {
    $gradeGrid.innerHTML = '<div class="result-placeholder">設定が必要です。右上の設定ボタンから設定してください</div>';
    return;
  }

  const estimatedAmount = parseFloat($estimatedAmount.value) || 0;
  const estimatedHours  = parseFloat($estimatedHours.value)  || 0;
  const actualHours     = parseFloat($actualHours.value)     || 0;
  const hourlyRate      = parseFloat($hourlyRate.value)      || 0;

  // 制作費・見込利益の計算に使う時間（実績時間優先、未入力なら予定時間）
  const costHours = actualHours > 0 ? actualHours : estimatedHours;

  if (estimatedAmount === 0) {
    $gradeGrid.innerHTML = '<div class="result-placeholder">見積金額を入力すると等級別比較が表示されます</div>';
    return;
  }

  const gradeRates  = GRADE_HOURLY_RATES();
  const salesAmount = estimatedAmount * PROFIT_MARGIN();
  const targetRate  = (PROFIT_MARGIN() - 1) * 100;
  const grades      = Object.keys(gradeRates).map(Number).sort((a, b) => a - b);

  const headerCells = grades.map(g =>
    `<th>等級 ${g}<br><span class="grade-th-rate">${gradeRates[g].toLocaleString('ja-JP')}円</span></th>`
  ).join('');

  // 予算内工数（見積金額 ÷ 各等級時給）
  const budgetRow = grades.map(g => {
    const budgetHours = estimatedAmount / gradeRates[g];
    return `<td>${budgetHours.toFixed(1)}h</td>`;
  }).join('');

  // 制作費・見込利益（実績時間 or 予定時間がある場合のみ）
  const hasCostRows = costHours > 0;
  const costRow = !hasCostRows ? '' : `
    <tr>
      <th class="grade-row-label">制作費</th>
      ${grades.map(g => {
        const cost = costHours * gradeRates[g];
        return `<td>${formatYen(cost)}</td>`;
      }).join('')}
    </tr>`;

  const profitRow = !hasCostRows ? '' : `
    <tr>
      <th class="grade-row-label">見込利益</th>
      ${grades.map(g => {
        const cost    = costHours * gradeRates[g];
        const profit  = salesAmount - cost;
        const isWarn  = profit > 0 && (profit / estimatedAmount) * 100 < targetRate - 0.05;
        const cls     = profit < 0 ? 'negative' : isWarn ? 'warning' : 'positive';
        return `<td class="${cls}">${profit >= 0 ? '+' : ''}${formatYen(profit)}</td>`;
      }).join('')}
    </tr>`;

  $gradeGrid.innerHTML = `
    <table class="grade-compare-table">
      <thead>
        <tr><th class="grade-row-label"></th>${headerCells}</tr>
      </thead>
      <tbody>
        <tr>
          <th class="grade-row-label">予算内工数</th>
          ${budgetRow}
        </tr>
        ${costRow}
        ${profitRow}
      </tbody>
    </table>
  `;
}

/** すべての表示を一括更新する */
function recalculateAll() {
  calcProfitInfo();
  calcGradeAnalysis();
  saveInputToStorage();
  // 入力が変わったら生成済みURLをリセット（古いURLの誤コピー防止）
  if ($shareUrlRow) {
    $shareUrlRow.style.display = 'none';
    $shareUrlOut.value = '';
  }
}

// ===== イベントリスナー =====

// ── 工数単価が変わったら見積金額を再計算 ──
$hourlyRate.addEventListener('input', () => {
  const hourlyRate      = parseFloat($hourlyRate.value) || 0;
  const estimatedHours  = parseFloat($estimatedHours.value) || 0;
  if (estimatedHours > 0 && hourlyRate > 0) {
    $estimatedAmount.value = Math.round(estimatedHours * hourlyRate);
  }
  recalculateAll();
});

// ── 予定時間（時間）が変わったら人日・見積金額を再計算 ──
$estimatedHours.addEventListener('input', () => {
  const hours      = parseFloat($estimatedHours.value) || 0;
  const hourlyRate = parseFloat($hourlyRate.value)     || 0;
  $estimatedMandays.value = hours > 0 ? (hours / HOURS_PER_DAY).toFixed(2) : '';
  if (hourlyRate > 0) {
    $estimatedAmount.value = hours > 0 ? Math.round(hours * hourlyRate) : '';
  }
  recalculateAll();
});

// ── 予定時間（人日）が変わったら時間・見積金額を再計算 ──
$estimatedMandays.addEventListener('input', () => {
  const mandays    = parseFloat($estimatedMandays.value) || 0;
  const hours      = mandays * HOURS_PER_DAY;
  const hourlyRate = parseFloat($hourlyRate.value)       || 0;
  $estimatedHours.value = hours > 0 ? hours.toFixed(1) : '';
  if (hourlyRate > 0) {
    $estimatedAmount.value = hours > 0 ? Math.round(hours * hourlyRate) : '';
  }
  recalculateAll();
});

// ── 見積金額が直接変更されたら時間を逆算 ──
$estimatedAmount.addEventListener('input', () => {
  const amount     = parseFloat($estimatedAmount.value) || 0;
  const hourlyRate = parseFloat($hourlyRate.value)      || 0;
  if (hourlyRate > 0 && amount > 0) {
    const hours = amount / hourlyRate;
    $estimatedHours.value  = hours.toFixed(1);
    $estimatedMandays.value = (hours / HOURS_PER_DAY).toFixed(2);
  }
  recalculateAll();
});

// ── 販売見積金額の直接入力で逆算 ──
let salesAmountFocused = false;

$salesAmount.addEventListener('focus', () => { salesAmountFocused = true; });

$salesAmount.addEventListener('blur', () => {
  salesAmountFocused = false;
  // フォーカスを外れたタイミングで自動計算値へ補正（入力が空なら再計算結果を表示）
  recalculateAll();
});

$salesAmount.addEventListener('input', () => {
  const salesAmountVal = parseFloat($salesAmount.value) || 0;
  const hourlyRate     = parseFloat($hourlyRate.value) || 0;

  if (salesAmountVal > 0 && PROFIT_MARGIN()) {
    // 販売見積金額 → 見積金額 = 販売見積 ÷ 利益係数
    const standardAmount = salesAmountVal / PROFIT_MARGIN();
    $estimatedAmount.value = Math.round(standardAmount);
    if (hourlyRate > 0) {
      const hours = standardAmount / hourlyRate;
      $estimatedHours.value   = hours.toFixed(1);
      $estimatedMandays.value = (hours / HOURS_PER_DAY).toFixed(2);
    }
  }
  // $salesAmount.value はフォーカス中なので calcProfitInfo が上書きしない
  recalculateAll();
});

// ── 実績時間（時間）が変わったら人日を再計算 ──
$actualHours.addEventListener('input', () => {
  const hours = parseFloat($actualHours.value) || 0;
  $actualMandays.value = hours > 0 ? (hours / HOURS_PER_DAY).toFixed(2) : '';
  recalculateAll();
});

// ── 実績時間（人日）が変わったら時間を再計算 ──
$actualMandays.addEventListener('input', () => {
  const mandays = parseFloat($actualMandays.value) || 0;
  const hours   = mandays * HOURS_PER_DAY;
  $actualHours.value = hours > 0 ? hours.toFixed(1) : '';
  recalculateAll();
});

// ── 折りたたみトグル ──
function setupToggle(toggleBtn, body, arrow) {
  toggleBtn.addEventListener('click', () => {
    const isExpanded = body.classList.toggle('expanded');
    arrow.style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });
}

setupToggle($gradeToggle, $gradeBody, $gradeArrow);

// ── 共有URLを生成 ──
$copyUrlBtn.addEventListener('click', () => {
  $shareUrlOut.value = buildInputUrl();
  $shareUrlRow.style.display = 'flex';
  $shareUrlOut.select();
});

// ── URLをコピー ──
$shareCopyUrl.addEventListener('click', () => {
  if (!$shareUrlOut.value) return;
  navigator.clipboard.writeText($shareUrlOut.value).then(() => {
    $shareCopyUrl.textContent = 'コピーしました！';
    setTimeout(() => { $shareCopyUrl.textContent = 'URLをコピー'; }, 2000);
  });
});

// ── リセット ──
$resetBtn.addEventListener('click', () => {
  [$hourlyRate, $estimatedAmount, $estimatedHours, $estimatedMandays, $actualHours, $actualMandays]
    .forEach((el) => { el.value = ''; });
  $memo.value = '';
  localStorage.removeItem(INPUT_STORAGE_KEY);
  recalculateAll();
});

// ===== 設定モーダル =====
const $settingsBtn   = document.getElementById('settings-btn');
const $settingsModal = document.getElementById('settings-modal');
const $settingsClose = document.getElementById('settings-close');
const $configApply   = document.getElementById('config-apply');
const $configGenUrl  = document.getElementById('config-gen-url');
const $configUrlOut  = document.getElementById('config-url-out');
const $configCopyUrl = document.getElementById('config-copy-url');
const $configBanner  = document.getElementById('config-banner');

// フォーム入力欄
const $cfgProfitMargin  = document.getElementById('cfg-profit-margin');
const $cfgDefaultRate   = document.getElementById('cfg-default-rate');
const $cfgGradeInputs   = [1, 2, 3, 4, 5].map((g) => document.getElementById(`cfg-grade-${g}`));

/** 現在の設定をフォームに反映する */
function populateConfigForm() {
  const c = appConfig ?? {
    profitMargin: 1.5,
    defaultHourlyRate: null,
    gradeRates: { 1: null, 2: null, 3: null, 4: null, 5: null },
  };
  // 利益率: 1.5 → 50
  $cfgProfitMargin.value  = c.profitMargin != null ? Math.round((c.profitMargin - 1) * 100) : '';
  $cfgDefaultRate.value   = c.defaultHourlyRate ?? '';
  $cfgGradeInputs.forEach((el, i) => {
    el.value = c.gradeRates?.[i + 1] ?? '';
  });
}

/** フォームから設定オブジェクトを作る */
function readConfigFromForm() {
  const marginPct = parseFloat($cfgProfitMargin.value);
  if (!marginPct || marginPct <= 0) {
    alert('目標利益率を入力してください（例: 40）');
    return null;
  }

  const gradeRates = {};
  for (let i = 0; i < 5; i++) {
    const rate = parseFloat($cfgGradeInputs[i].value);
    if (!rate || rate <= 0) {
      alert(`等級 ${i + 1} の時給を入力してください`);
      return null;
    }
    gradeRates[i + 1] = rate;
  }

  const config = {
    profitMargin: 1 + marginPct / 100,
    gradeRates,
  };
  const defaultRate = parseFloat($cfgDefaultRate.value);
  if (defaultRate > 0) config.defaultHourlyRate = defaultRate;

  return config;
}

function openSettingsModal() {
  $settingsModal.classList.add('open');
  populateConfigForm();
  $configUrlOut.value = '';
}

function closeSettingsModal() {
  $settingsModal.classList.remove('open');
}

$settingsBtn.addEventListener('click', openSettingsModal);
$settingsClose.addEventListener('click', closeSettingsModal);
$settingsModal.addEventListener('click', (e) => {
  if (e.target === $settingsModal) closeSettingsModal();
});
document.getElementById('banner-settings-btn').addEventListener('click', openSettingsModal);

// 設定を適用
$configApply.addEventListener('click', () => {
  const parsed = readConfigFromForm();
  if (!parsed) return;
  appConfig = parsed;
  saveConfig(appConfig);
  if (appConfig.defaultHourlyRate && !$hourlyRate.value) {
    $hourlyRate.value = appConfig.defaultHourlyRate;
  }
  updateConfigBanner();
  recalculateAll();
  closeSettingsModal();
});

// 配布用URLを生成
$configGenUrl.addEventListener('click', () => {
  const parsed = readConfigFromForm();
  if (!parsed) return;
  $configUrlOut.value = buildConfigUrl(parsed);
});

// URL をクリップボードにコピー
$configCopyUrl.addEventListener('click', () => {
  if (!$configUrlOut.value) return;
  navigator.clipboard.writeText($configUrlOut.value).then(() => {
    $configCopyUrl.textContent = 'コピーしました！';
    setTimeout(() => { $configCopyUrl.textContent = 'URLをコピー'; }, 2000);
  });
});

// 設定なしバナーの表示管理
function updateConfigBanner() {
  $configBanner.style.display = appConfig ? 'none' : 'flex';
}

// ===== 履歴機能 =====
const $historyCard      = document.getElementById('history-card');
const $historyList      = document.getElementById('history-list');
const $historyCount     = document.getElementById('history-count');
const $saveHistoryBtn   = document.getElementById('save-history-btn');
const $clearHistoryBtn  = document.getElementById('clear-history-btn');

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
  } catch { return []; }
}

function persistHistory(list) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
}

/** 現在の入力を履歴に追加する（最大 HISTORY_MAX_ITEMS 件） */
function addToHistory() {
  const r   = parseFloat($hourlyRate.value)      || null;
  const a   = parseFloat($estimatedAmount.value) || null;
  const h   = parseFloat($estimatedHours.value)  || null;
  const ah  = parseFloat($actualHours.value)     || null;
  const m   = $memo.value.trim() || null;

  if (!a && !h && !r) {
    alert('保存する入力がありません。');
    return;
  }

  const entry = {
    id: Date.now(),
    savedAt: new Date().toISOString(),
    m, r,
    a:   parseFloat($estimatedAmount.value)  || null,
    h:   parseFloat($estimatedHours.value)   || null,
    hd:  parseFloat($estimatedMandays.value) || null,
    ah:  parseFloat($actualHours.value)      || null,
    ahd: parseFloat($actualMandays.value)    || null,
    sa:  parseFloat($salesAmount.value)      || null,
  };

  const list = loadHistory();
  list.unshift(entry);
  if (list.length > HISTORY_MAX_ITEMS) list.splice(HISTORY_MAX_ITEMS);
  persistHistory(list);
  renderHistory();

  $saveHistoryBtn.textContent = '保存しました！';
  setTimeout(() => { $saveHistoryBtn.textContent = '履歴に保存'; }, 2000);
}

/** 履歴エントリ1件をUIに描画するHTML文字列を返す */
function buildHistoryItemHTML(entry) {
  const date = new Date(entry.savedAt);
  const dateStr = `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  const title = entry.m || '（メモなし）';
  const chips = [];
  if (entry.r)  chips.push(`単価 ${entry.r.toLocaleString('ja-JP')}円`);
  if (entry.a)  chips.push(`見積 ${Math.round(entry.a).toLocaleString('ja-JP')}円`);
  if (entry.h)  chips.push(`予定 ${entry.h}h`);
  if (entry.ah) chips.push(`実績 ${entry.ah}h`);
  const chipsHTML = chips.map(c => `<span class="history-chip">${c}</span>`).join('');
  return `
    <div class="history-item" data-id="${entry.id}">
      <div class="history-item-body">
        <div class="history-item-title">${title}</div>
        <div class="history-item-meta">${dateStr}</div>
        <div class="history-item-chips">${chipsHTML}</div>
      </div>
      <div class="history-item-actions">
        <button type="button" class="history-btn-restore" data-id="${entry.id}">復元</button>
        <button type="button" class="history-btn-delete" data-id="${entry.id}" title="削除">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`;
}

/** 履歴カードを再描画する */
function renderHistory() {
  const list = loadHistory();
  if (list.length === 0) {
    $historyCard.style.display = 'none';
    $historyCount.textContent = '';
    return;
  }
  $historyCard.style.display = 'block';
  $historyCount.textContent = `${list.length} / ${HISTORY_MAX_ITEMS}件`;
  $historyList.innerHTML = list.map(buildHistoryItemHTML).join('');
}

/** 指定 id の履歴を削除する */
function deleteHistoryEntry(id) {
  const list = loadHistory().filter(e => e.id !== id);
  persistHistory(list);
  renderHistory();
}

/** 履歴エントリをフォームに復元する */
function restoreFromHistory(entry) {
  $hourlyRate.value       = entry.r   ?? '';
  $estimatedAmount.value  = entry.a   ?? '';
  $estimatedHours.value   = entry.h   ?? '';
  $estimatedMandays.value = entry.hd  ?? '';
  $actualHours.value      = entry.ah  ?? '';
  $actualMandays.value    = entry.ahd ?? '';
  $memo.value             = entry.m   ?? '';
  recalculateAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 履歴に保存ボタン
$saveHistoryBtn.addEventListener('click', addToHistory);

// 履歴カードのクリックを委譲
$historyList.addEventListener('click', (e) => {
  const restoreBtn = e.target.closest('.history-btn-restore');
  const deleteBtn  = e.target.closest('.history-btn-delete');
  if (restoreBtn) {
    const id = Number(restoreBtn.dataset.id);
    const entry = loadHistory().find(e => e.id === id);
    if (entry) restoreFromHistory(entry);
  }
  if (deleteBtn) {
    const id = Number(deleteBtn.dataset.id);
    deleteHistoryEntry(id);
  }
});

// すべて削除
$clearHistoryBtn.addEventListener('click', () => {
  if (!confirm(`保存済みの履歴をすべて削除しますか？`)) return;
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  renderHistory();
});

// ===== 初期表示 =====
$gradeBody.classList.add('expanded');
$gradeArrow.style.transform = 'rotate(90deg)';

updateConfigBanner();
loadInputFromStorage(); // localStorageから復元（URLパラメータで上書きされる）
loadInputFromUrl();
recalculateAll();
renderHistory();

if (appConfig?.defaultHourlyRate && !$hourlyRate.value) {
  $hourlyRate.value = appConfig.defaultHourlyRate;
  recalculateAll();
}

