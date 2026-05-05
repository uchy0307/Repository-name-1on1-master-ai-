import React, { useState, useRef, useEffect, useCallback } from "react";

// ── グローバル音声管理 ──────────────────────────────────────
window._tapOn = typeof window._tapOn !== "undefined" ? window._tapOn : true;
window._speaking = false;

function T(type="tap") {
  if (!window._tapOn) return;
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    if (type==="tap") {
      o.frequency.setValueAtTime(880,ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(440,ctx.currentTime+0.06);
      g.gain.setValueAtTime(0.12,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.08);
      o.start(); o.stop(ctx.currentTime+0.08);
    } else if (type==="success") {
      [523,659,784].forEach((f,i)=>{
        const o2=ctx.createOscillator(),g2=ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.frequency.value=f;
        g2.gain.setValueAtTime(0.1,ctx.currentTime+i*0.1);
        g2.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.1+0.2);
        o2.start(ctx.currentTime+i*0.1); o2.stop(ctx.currentTime+i*0.1+0.25);
      });
    } else if (type==="send") {
      o.frequency.setValueAtTime(660,ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(880,ctx.currentTime+0.06);
      g.gain.setValueAtTime(0.1,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.1);
      o.start(); o.stop(ctx.currentTime+0.1);
    }
  } catch(e) {}
}
function doSpeak(text) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang="ja-JP"; u.rate=0.95;
    u.onend = () => { window._speaking=false; };
    const v = window.speechSynthesis.getVoices().find(v=>v.lang.includes("ja"));
    if (v) u.voice=v;
    window.speechSynthesis.speak(u);
    window._speaking = true;
  } catch(e) {}
}
function doStopSpeak() { try { window.speechSynthesis.cancel(); window._speaking=false; } catch(e) {} }



const stopSpeak = () => { try { window.speechSynthesis.cancel(); } catch {} };

const C = {
  bg: "#f0ede8", surface: "#ffffff", surface2: "#e8e4de", border: "#c8c0b4",
  borderActive: "#8a6030", gold: "#8a6030", goldLight: "#f5e8d0", goldDark: "#5a3a10",
  text: "#1a1210", textSub: "#3a3028", textMuted: "#6a5e50",
  green: "#1a4a30", greenLight: "#d0eedd", blue: "#1040a0", blueLight: "#d0e0f8",
  red: "#a02018", purple: "#4a1890",
  userBubble: "#1a3828", userText: "#d8f0e0",
};

// ============================================================
// 役職階層定義
// ============================================================
const ROLE_HIERARCHY = {
  exec: {
    label: "役員", icon: "👑",
    desc: "取締役・執行役員・C suite",
    subordinateLabel: "直属部下のポジション",
    subordinateOpts: ["シニアマネージャー・部長クラス", "マネージャー・課長クラス", "専門職・エキスパート"],
  },
  senior: {
    label: "シニアマネージャー", icon: "🏛",
    desc: "部長・シニアマネージャー・グループ長",
    subordinateLabel: "直属部下のポジション",
    subordinateOpts: ["マネージャー・課長クラス", "リーダー・主任クラス", "ベテラン・中堅社員"],
  },
  manager: {
    label: "マネージャー", icon: "🎯",
    desc: "課長・マネージャー・チームリーダー",
    subordinateLabel: "部下のポジション",
    subordinateOpts: ["新入社員（1年目）", "若手（2〜4年目）", "中堅（5〜9年目）", "シニア・主任クラス", "もうすぐ管理職", "牽引層・リーダー候補", "ベテラン・専門職（非管理）"],
  },
};

// ============================================================
// ペルソナ定義
// ============================================================
const PERSONA = {
  industry: {
    label: "業種", icon: "🏢", multi: false,
    opts: [
      "自動車・輸送機器", "電機・精密機器", "化学・素材", "食品・飲料", "建設・ゼネコン",
      "不動産・デベロッパー", "プラント・設備", "印刷・出版",
      "ITシステム・SIer", "Web・アプリ開発", "AI・データサイエンス", "半導体・ハードウェア",
      "通信・キャリア", "ゲーム・エンタメIT",
      "総合商社", "専門商社", "百貨店・量販店", "EC・通販", "コンビニ・チェーン", "アパレル・ファッション",
      "総合病院・クリニック", "調剤薬局", "介護・福祉施設", "医療機器メーカー",
      "銀行・信託", "証券・投資", "生損保", "ベンチャーキャピタル", "会計・税務事務所",
      "居酒屋・レストラン", "ホテル・旅館", "航空・旅行", "ブライダル",
      "小学・中学・高校", "大学・研究機関", "学習塾・予備校",
      "国家公務員", "地方公務員", "独立行政法人", "NPO・社会福祉法人",
      "物流・運送", "倉庫・3PL", "広告・PR", "コンサルティング", "法律・特許事務所", "人材・派遣",
    ],
  },
  job: {
    label: "職種", icon: "💼", multi: true,
    opts: [
      "法人営業（大手向け）", "法人営業（中小向け）", "ルート営業", "代理店営業", "海外営業",
      "インサイドセールス", "カウンターセールス",
      "フロントエンドエンジニア", "バックエンドエンジニア", "インフラ・SRE", "データエンジニア",
      "AIエンジニア・ML", "QA・テスト", "PMエンジニア", "組み込みエンジニア",
      "プロダクトマネージャー", "プロジェクトマネージャー", "ITコンサルタント",
      "Webデザイナー", "UXデザイナー", "グラフィックデザイナー",
      "総務・庶務", "経理・会計", "人事・採用", "法務・コンプライアンス", "広報・IR",
      "マーケター・デジタルマーケ", "商品企画", "事業企画",
      "生産管理", "品質管理・QC", "購買・調達", "物流管理", "施工管理", "現場監督",
      "医師・研修医", "看護師", "薬剤師", "理学・作業療法士", "介護士・ケアマネ",
      "小売販売員", "店長", "飲食ホール・調理", "カスタマーサポート",
      "研究員・研究開発", "教師・講師", "コンサルタント", "税理士・会計士補",
    ],
  },
  family: {
    label: "家族構成", icon: "🏠", multi: false,
    opts: [
      "独身・一人暮らし", "独身・実家",
      "既婚・子なし", "既婚・子育て中（乳幼児）", "既婚・子育て中（小中高）",
      "既婚・子供は大学生", "既婚・子供は独立済み",
      "シングルペアレント", "介護中", "育休・産休復帰直後",
    ],
  },
  personality: {
    label: "性格・タイプ", icon: "🧠", multi: true,
    // カテゴリ分け済み（表示はフラットだが意味的に整理）
    opts: [
      // ── 仕事への向き合い方 ──
      "真面目・完璧主義", "完璧にできるまで報告しない", "受け身・指示待ち",
      "仕事に意味・意義を求める", "変化を嫌い現状維持志向",
      // ── 対人関係 ──
      "内向的・慎重派", "空気を読みすぎて本音を言えない", "優秀だが孤立しがち",
      "チームより個人プレー優先", "コミュ力は高いが継続力が弱い",
      // ── 感情・自己認知 ──
      "感情的になりやすい", "批判に過剰に傷つく", "承認欲求がとても強い",
      "素直だが自信がない", "表面上は元気だが無理している",
      // ── 主張・摩擦 ──
      "反発しやすい・自己主張強め", "プライドが高い・負けず嫌い",
      "明るいが詰めが甘い", "自己犠牲型・断れない",
      // ── モチベーション ──
      "やる気が見えない",
    ],
    categories: [
      { label: "仕事への向き合い方", items: ["真面目・完璧主義", "完璧にできるまで報告しない", "受け身・指示待ち", "仕事に意味・意義を求める", "変化を嫌い現状維持志向"] },
      { label: "対人関係", items: ["内向的・慎重派", "空気を読みすぎて本音を言えない", "優秀だが孤立しがち", "チームより個人プレー優先", "コミュ力は高いが継続力が弱い"] },
      { label: "感情・自己認知", items: ["感情的になりやすい", "批判に過剰に傷つく", "承認欲求がとても強い", "素直だが自信がない", "表面上は元気だが無理している"] },
      { label: "主張・摩擦", items: ["反発しやすい・自己主張強め", "プライドが高い・負けず嫌い", "明るいが詰めが甘い", "自己犠牲型・断れない"] },
      { label: "モチベーション", items: ["やる気が見えない"] },
    ],
  },
  issue: {
    label: "最近の状況・悩み", icon: "⚡", multi: true,
    opts: [
      // ── メンタル・体調 ──
      "メンタル不調の兆候がある", "残業・疲弊が続いている", "業務量過多で品質が落ちている",
      // ── キャリア・評価 ──
      "転職を考えていそう", "昇進・キャリアで悩んでいる", "スキルアップへの焦り",
      "同期との差に焦りを感じている", "評価制度への不満・不信感",
      // ── 職場環境 ──
      "人間関係でトラブル", "チームの雰囲気が悪化している", "上司との関係に距離感",
      "会社の方針・文化への不満", "急な異動・配置転換で戸惑い",
      // ── モチベ・方向性 ──
      "モチベが急落している", "目標が見えず停滞", "ミスが増えている",
      // ── 環境・ライフ ──
      "リモートで孤立しがち", "プライベートで問題がある", "育休・産休復帰後で不安定",
      // ── 問題なし ──
      "特に問題はなさそう",
    ],
    categories: [
      { label: "メンタル・体調", items: ["メンタル不調の兆候がある", "残業・疲弊が続いている", "業務量過多で品質が落ちている"] },
      { label: "キャリア・評価", items: ["転職を考えていそう", "昇進・キャリアで悩んでいる", "スキルアップへの焦り", "同期との差に焦りを感じている", "評価制度への不満・不信感"] },
      { label: "職場環境", items: ["人間関係でトラブル", "チームの雰囲気が悪化している", "上司との関係に距離感", "会社の方針・文化への不満", "急な異動・配置転換で戸惑い"] },
      { label: "モチベ・方向性", items: ["モチベが急落している", "目標が見えず停滞", "ミスが増えている"] },
      { label: "環境・ライフ", items: ["リモートで孤立しがち", "プライベートで問題がある", "育休・産休復帰後で不安定"] },
      { label: "問題なし", items: ["特に問題はなさそう"] },
    ],
  },
};

const PERSONA_KEYS = Object.keys(PERSONA);

// ============================================================
// 年齢関係ラベル生成
// ============================================================
const getAgeRelation = (userAge, subAge) => {
  const diff = subAge - userAge;
  if (diff >= 5) return { label: "年上（5歳以上）", tag: "年上" };
  if (diff >= 1) return { label: "年上（1〜4歳）", tag: "少し年上" };
  if (diff === 0) return { label: "同学年・同年代", tag: "同年代" };
  if (diff >= -4) return { label: "年下（1〜4歳）", tag: "少し年下" };
  return { label: "年下（5歳以上）", tag: "年下" };
};

const AGE_RANGES = [
  { label: "20〜24歳", mid: 22 }, { label: "25〜29歳", mid: 27 },
  { label: "30〜34歳", mid: 32 }, { label: "35〜39歳", mid: 37 },
  { label: "40〜44歳", mid: 42 }, { label: "45〜49歳", mid: 47 },
  { label: "50〜54歳", mid: 52 }, { label: "55歳以上", mid: 57 },
];

// ============================================================
// 成功循環 & マズロー
// ============================================================
const SUCCESS_CYCLE = {
  diagnose: (issues, personality) => {
    const s = [...issues, ...personality].join(" ");
    if (/人間関係|ハラスメント|距離感|雰囲気/.test(s))
      return { label: "関係の質", color: C.red, desc: "信頼関係が損なわれています。まず「関係の質」の回復が最優先。", action: "評価・批判ゼロで話を聞く場を週1回作る" };
    if (/モチベ|意義|方針|評価制度|停滞|やる気/.test(s))
      return { label: "思考の質", color: C.blue, desc: "仕事の意味・方向性が見えなくなっています。「なぜ」を一緒に言語化することが鍵。", action: "「なぜこの仕事が大切か」を一緒に言語化する" };
    if (/ミス|疲弊|残業|品質|スキル|完璧|断れない/.test(s))
      return { label: "行動の質", color: C.gold, desc: "行動量は十分でも質や方向性がずれています。「やめること」を決めるのが先。", action: "「やることリスト」から「やめることリスト」を作る" };
    if (/転職|キャリア|昇進|差に焦り/.test(s))
      return { label: "結果の質", color: C.green, desc: "結果への焦りが思考・行動に影響しています。良い循環の入口は「関係の質」。", action: "小さな成功体験を作り、承認して伝える" };
    return { label: "バランス良好", color: C.green, desc: "現時点では大きな問題はなさそうです。さらに「関係の質」を深めましょう。", action: "今日の話題を翌日フォローする一言を添える" };
  },
};

const MASLOW = {
  diagnose: (issues, personality, family) => {
    const s = [...issues, ...personality, family].join(" ");
    if (/メンタル|疲弊|残業|プライベート|介護|育休/.test(s))
      return { level: 2, name: "安全欲求", desc: "心身の安全が脅かされています。「無理しなくていい」を先に伝えて。" };
    if (/人間関係|孤立|ハラスメント|雰囲気|距離感/.test(s))
      return { level: 3, name: "所属・愛情欲求", desc: "チームへの帰属感が低下。「ここに居ていい」という安心感を作ることが最優先。" };
    if (/承認欲求|評価|差に焦り|プライド|モチベ/.test(s))
      return { level: 4, name: "承認欲求", desc: "認められたい欲求が満たされていません。「見ている・評価している」を具体的な言葉で。" };
    if (/意義|キャリア|昇進|スキル|転職/.test(s))
      return { level: 5, name: "自己実現欲求", desc: "成長・実現への欲求が高まっています。キャリアビジョンを一緒に描きましょう。" };
    return { level: 3, name: "所属・愛情欲求", desc: "基本欲求は満たされています。所属感をさらに高めると自己実現への扉が開きます。" };
  },
};

// ============================================================
// 発言プール生成
// ============================================================
const buildVoicePool = (p, userRole) => {
  const pool = new Set();
  const add = (...items) => items.forEach(i => pool.add(i));

  // 年齢関係による発言トーン
  const ageRel = p.ageRelation;
  if (ageRel === "年上") {
    add(
      "（少し距離を置いた口調で）…まあ、そうですね。",
      "（敬語だが壁がある感じで）ありがとうございます。でも、自分のことは自分でわかってますので。",
      "（少し間があって）正直、年下の方に言われると、ちょっと複雑で。",
      "経験上、こういう状況は何度かあって。ただ今回は少し違う感じがして。",
      "言いにくいんですけど、こういうやり方には慣れてなくて。",
    );
  } else if (ageRel === "少し年上") {
    add(
      "そうですよね…（少し柔らかい口調で）実は最近気になってることがあって。",
      "（フラットに）正直に言っていいですか。少し気になってることがあって。",
      "同年代に近い感じがして、少し話しやすくて。実はですね…",
    );
  } else if (ageRel === "同年代") {
    add(
      "（比較的フラットに）正直に言いますけど、最近ちょっとしんどくて。",
      "同じくらいの年齢だから言いやすいんですけど、実はずっと悩んでて。",
      "タメ口でもいいですか？（笑）…実はですね。",
    );
  } else {
    add(
      "（少しリラックスした口調で）正直に言うと、最近こんなことがあって。",
      "ちょっと相談していいですか。実は…",
      "（元気よく）わかりました！…あ、でも一個だけ聞いてもいいですか。",
    );
  }

  // 役職による部下の発言トーン
  if (userRole === "exec") {
    add(
      "（かしこまった口調で）はい、承知しました。ご指摘の点、肝に銘じます。",
      "（少し緊張した声で）率直にお伝えしていいですか。現場では少し違う状況で。",
      "役員の方にこんなことを言うのは…と思っていたんですが、実は。",
    );
  } else if (userRole === "senior") {
    add(
      "部長に直接言うのは勇気いりますけど、正直に言うと。",
      "（少し遠慮がちに）こういうことって相談していいんですかね…実は。",
    );
  }

  // 業種別
  const iv = {
    "ITシステム・SIer": ["客先常駐が続いてて、所属感が全然なくて。どこが自分の職場かわからなくて。", "技術負債の山を前に、新しいことを学ぶ時間が全然取れなくて。"],
    "Web・アプリ開発": ["スプリントが詰まりすぎてて、技術的負債を返す時間が全然取れなくて。", "リリース後にバグが出るたびに自分を責めてしまって。"],
    "総合病院・クリニック": ["患者さんのためと思ってるのに、書類仕事で本来の仕事できてなくて。", "夜勤明けにそのまま日勤が入ることがって、体がもう限界で。"],
    "建設・ゼネコン": ["残業規制されたけど工期は変わらないから。現場がパンクしそうで。", "職人さんと施主の間に挟まれて、板挟みが毎日続いてて。"],
    "銀行・信託": ["ノルマの達成と顧客利益の間で板挟みになることが多くて、しんどくて。", "フィンテックの台頭で、銀行員というキャリア自体が不安になってきて。"],
    "自動車・輸送機器": ["電動化の波で、自分のスキルが将来使えなくなるのか不安で。", "部品の内製化が進んで、うちのチームの役割が縮小しそうで正直焦ってて。"],
    "介護・福祉施設": ["利用者さんへの愛情はあるんですけど、給料と責任が全然合ってなくて。", "人手不足で休憩もまともに取れない日が続いてて。"],
    "コンビニ・チェーン": ["本部の施策がどんどん変わって、現場が追いつけなくて。", "フランチャイズオーナーと本部の板挟みで、正直どちらの味方でいればいいか。"],
  };
  if (iv[p.industry]) add(...iv[p.industry]);

  // ポジション別
  const pv = {
    "新入社員（1年目）": ["正直、毎日が必死で。覚えることが多すぎて消化できてる気がしなくて。", "先輩に聞いていいのかも迷って。忙しそうだし、迷惑かなって。", "入社前のイメージと全然違くて。どう折り合いをつければいいかわからなくて。"],
    "若手（2〜4年目）": ["3年目になって、急に「もう自分でやれ」ってなって。", "同期がどんどん転職していくのを見て、自分もそろそろかなって。", "評価に納得できなくて。何をすれば評価されるのか基準が見えなくて。"],
    "中堅（5〜9年目）": ["指導もして、自分の業務もして、管理職の補佐もして。一番割を食ってる気がして。", "給料が上がらなくて。転職した方がいいんじゃないかってリアルに考えてて。", "この会社でのキャリアの天井が見えてきた気がして。"],
    "シニア・主任クラス": ["中間管理職の手前で、上からも下からも求められて自分の時間が全然なくて。", "管理職になるべきか、スペシャリストを極めるべきか、ずっと迷ってて。"],
    "もうすぐ管理職": ["管理職になったら今以上に忙しくなるのに、なり手がいないから押しつけられてる感じで。", "プレイヤーとして動く方が好きなのに、マネジメントに移るのが怖くて。"],
    "ベテラン・専門職（非管理）": ["若い上司に指示されるのが、正直慣れなくて。経験値は自分の方があるのに。", "長年やってきたやり方を急に変えろって言われて。なぜ変えるのか説明もなくて。"],
  };
  if (pv[p.position]) add(...pv[p.position]);

  // 性格別
  const perV = {
    "反発しやすい・自己主張強め": ["それって本当に必要な作業ですか？無駄な工程が多すぎると思って。", "会議で決めたことを現場に説明せずに変えるの、おかしくないですか？", "上の言うことだから従えって言われても、理由が納得できないと動けなくて。", "他の会社ではこういうやり方してないと思うんですよね。なんでうちだけ。"],
    "やる気が見えない": ["…なんか最近、仕事しても手応えがなくて。やっても意味あるのかなって。", "（少し間があって）毎日こなしてる感じで、それ以上でも以下でもないというか。", "以前はもっとやる気あったんですけど、何かがすり減ってきてる感じで。"],
    "表面上は元気だが無理している": ["（明るく）大丈夫です！…（少し間があって）でも最近、ちょっと寝れてなくて。", "全然平気っす！（笑）…でも正直言うと、ちょっとしんどいかもです。", "みんなに心配かけたくないから言ってなかったんですけど、実は少し。"],
    "承認欲求がとても強い": ["先週のプレゼン、自分ではうまくいったと思うんですけど、誰も何も言ってくれなくて。", "頑張ってるのに評価されてる気がしなくて。誰かに見てもらいたいって。"],
    "完璧にできるまで報告しない": ["完璧にしてから報告しようと思ってて、それで遅くなってしまって。", "中途半端な状態で見せるのが恥ずかしくて、ついギリギリまで抱えてしまって。"],
    "批判に過剰に傷つく": ["（少し震えた声で）先日のフィードバック、すごく気になって。私がダメってことですか？", "少し指摘されただけで、その後ずっと引きずってしまって。"],
    "自己犠牲型・断れない": ["頼まれると断れなくて、気づいたらタスクが溢れてて。でも断り方がわからなくて。", "NOって言うと申し訳ない気持ちになって。それがずっと続いてて。"],
    "空気を読みすぎて本音を言えない": ["…（少し間があって）こんなこと言っていいか迷ったんですけど。", "みんなの前では言えなかったんですけど、実はちょっと気になってて。"],
    "変化を嫌い現状維持志向": ["急に新しいシステムに変わるって言われて。覚え直すのが正直しんどくて。", "今のやり方で問題ないと思うのに、なぜ変えるのか腑に落ちてなくて。"],
    "プライドが高い・負けず嫌い": ["自分でできると思ってたんですけど、うまくいかなくて。それが悔しくて。", "同期に先に昇進されるって、やっぱり悔しいですよ。実力はこっちの方があると思ってるんで。"],
  };
  p.personality.forEach(pt => { if (perV[pt]) add(...perV[pt]); });

  // 状況別
  const issV = {
    "メンタル不調の兆候がある": ["…すみません、最近集中が続かなくて。頭に入らなくて。", "朝、会社に来るのがすごく重くて。来てはいるんですけど。", "食欲があんまりなくて、睡眠も全然取れてなくて。でも大丈夫です。"],
    "転職を考えていそう": ["同期がもう転職してる子が多くて、自分もそろそろかなって。", "転職エージェントに登録してみたんですけど、それが正解かわからなくて。", "ここにいる理由を最近うまく言語化できなくて。"],
    "評価制度への不満・不信感": ["頑張っても評価が変わらなくて。何を基準に評価されてるのかが不透明で。", "フィードバックが抽象的すぎて、何を改善すればいいかわからなくて。"],
    "リモートで孤立しがち": ["リモートになってから、誰かと話す機会が極端に減って。1on1が唯一の会話で。", "チームにいる感覚がだんだん薄れてきて、自分が必要なのかなって。"],
    "上司との関係に距離感": ["…（少し間があって）正直に言っていいですか。前から少し言いたいことがあって。", "なんか、壁を感じてしまってて。どう接したらいいかわからなくて。"],
  };
  p.issue.forEach(iss => { if (issV[iss]) add(...issV[iss]); });

  // 家族別
  const famV = {
    "既婚・子育て中（乳幼児）": "（少し疲れた声で）子供がまだ小さくて夜中に起きることも多くて、睡眠が全然足りてなくて。",
    "シングルペアレント": "一人で子育てしながらだと、残業もなかなかできなくて。それが引け目になって。",
    "介護中": "親の介護があって、急に休まないといけないこともあって。申し訳ないとは思ってるんですけど。",
    "育休・産休復帰直後": "復帰してからチームの雰囲気が変わってて、自分の居場所があるのかなって。",
  };
  if (famV[p.family]) add(famV[p.family]);

  // デフォルト
  add(
    "…そうですね。正直、どこから話せばいいかわからなくて。",
    "うーん…（少し考えて）まあ、なんとかやってます。",
    "（少し沈黙）…ありがとうございます、話聞いてもらえて。",
    "自分でもどうしたらいいかわからなくて、それがまた辛くて。",
    "…（間があって）こんなこと言っていいかわかりませんけど。",
    "最近ちょっと、仕事に対して気持ちが追いつかなくて。",
    "言葉にするのが難しいんですけど、なんか違うって感じが続いてて。",
    "（少し考えてから）そうですね…正直言うと、少しだけ。",
    "なかなか言い出せなかったんですけど、実は気になってることがあって。",
    "（ゆっくりと）…はい。少し整理しながら話させてください。",
  );

  return [...pool];
};

// ============================================================
// 評価エンジン
// ============================================================
const calcScore = (userMsgs) => {
  const all = userMsgs.join(" ");
  let s = 55;

  // プラス要素
  if (/どう|感じ|思って|ある\?|ない\?|どんな|いつ|なぜ|教えて|聞かせて/.test(all)) s += 12;
  if (/ありがとう|一緒に|サポート|支援|任せて|応援/.test(all)) s += 10;
  if (/なるほど|そうか|そうなんだ|わかった|そうだよね|うん|そっか/.test(all)) s += 8;
  if (/大変だったね|しんどかったね|頑張ってるね|すごいね|よくやってる/.test(all)) s += 12;
  if (userMsgs.length >= 8) s += 5;

  // マイナス要素（NG発言）
  if (/頑張れ|しっかり|なんで|どうして|ちゃんと|できてない|ダメ|普通/.test(all)) s -= 15;
  if (/指示|命令|やれ|やってください|当然|当たり前/.test(all)) s -= 10;

  // 短すぎる・適当な回答のペナルティ
  const tooShortCount = userMsgs.filter(m => m.trim().length <= 5).length;
  const veryShortCount = userMsgs.filter(m => m.trim().length <= 2).length;
  if (tooShortCount >= 3) s -= 20;       // 5文字以下が3回以上
  else if (tooShortCount >= 1) s -= 10;  // 5文字以下が1〜2回
  if (veryShortCount >= 1) s -= 20;      // 2文字以下（「はい」「うん」「ok」等）が1回でもあれば大幅減点
  const avgLen = userMsgs.reduce((sum, m) => sum + m.trim().length, 0) / Math.max(userMsgs.length, 1);
  if (avgLen < 10) s -= 15;             // 平均10文字未満は全体的に手抜き

  s = Math.max(15, Math.min(100, s));

  const grades = [
    { min: 90, grade: "S",  label: "卓越した1on1力",    color: C.red,     comments: ["🏆 S評価達成！あなたは部下が自然に話せる最高の聴き手です！今日の1on1、部下の心に確実に届きました。", "✨ 完璧です！この傾聴力と問いかけ、チームの未来を変えます。あなたのチームは最高の関係の質を持っています！", "🔥 素晴らしい！成功循環モデルの「関係の質」を完璧に実践できています。"] },
    { min: 80, grade: "A+", label: "非常に優秀",         color: "#8a6a2e", comments: ["🎯 A+評価！あなたの1on1は部下の本音を引き出す力があります。この調子でS評価を目指して！", "💪 素晴らしい！問いかけの質が高く、関係の質が確実に向上しています。あなたは「聴ける管理職」です。", "⭐ あと一歩でS！深掘りの質問をもう一つ増やすだけで、完璧な1on1になります。"] },
    { min: 68, grade: "A",  label: "良好・確かな実力",   color: C.green,   comments: ["👍 A評価！傾聴の姿勢はできています。この調子で続けると半年後のチームが変わります。", "💡 いい1on1でした。あなたは部下が「話しやすい上司」です。それだけで信頼の土台ができています。", "📈 着実に力がついています！次はリフレクション（「それはどういうこと？」）を意識してみて。"] },
    { min: 55, grade: "A-", label: "まずまず・伸びしろ大", color: C.blue,    comments: ["📊 A-評価。基礎はできています。評価・アドバイスを減らして「聴く」に集中するだけで大きく変わります！", "💬 あと少し！「なるほど」「そうなんだ」の受け取りを増やすだけで、部下の言葉がどんどん出てきます。", "🎯 あなたには素質があります。今日の気づきを明日の1on1に一つだけ活かしてみて！"] },
    { min: 30, grade: "B",  label: "要改善・大きな伸びしろ", color: C.textSub, comments: ["📚 B評価ですが、練習しているあなた自身が素晴らしい！多くの管理職は練習すらしません。", "💪 最初から上手い人はいません。ここで練習できているあなたは、すでに一歩前に進んでいます！", "🌟 「部下の話を聴こう」と思ってここにいる。その姿勢だけで、チームが変わっていきます！"] },
    { min: 0,  grade: "B",  label: "要改善・大きな伸びしろ", color: C.textSub, comments: ["📚 B評価ですが、練習しているあなた自身が素晴らしい！多くの管理職は練習すらしません。", "💪 最初から上手い人はいません。ここで練習できているあなたは、すでに一歩前に進んでいます！", "🌟 「部下の話を聴こう」と思ってここにいる。その姿勢だけで、チームが変わっていきます！"] },
  ];
  const g = grades.find(g => s >= g.min);
  return { ...g, score: s, comment: g.comments[Math.floor(Math.random() * g.comments.length)] };
};

// ============================================================
// トーク設計生成
// ============================================================
const buildDesign = (p, userRole, userAge) => {
  const cycle = SUCCESS_CYCLE.diagnose(p.issue, p.personality);
  const maslow = MASLOW.diagnose(p.issue, p.personality, p.family);
  const ageRel = p.ageRelation;

  const ageNote = ageRel === "年上"
    ? `⚠️ 年上の部下：「教えてもらう」姿勢で入ること。こちらの経験を押しつけない。`
    : ageRel === "同年代"
    ? `💡 同年代：フラットに話せる関係性が作りやすい。タメ口に近い自然な口調も効果的。`
    : ``;

  const roleNote = userRole === "exec"
    ? `⚠️ 役員として接する場合：圧力をかけないよう意識的に「聴く側」に徹する。`
    : userRole === "senior"
    ? `⚠️ 部長として接する場合：部下が「本音を言える場」かどうかを常に意識する。`
    : ``;

  const openMap = {
    "新入社員（1年目）": `「最近どう？仕事、少し慣れてきた？正直なところ聞かせて」`,
    "若手（2〜4年目）": `「最近どう？ぶっちゃけ気になってることある？」`,
    "中堅（5〜9年目）": `「最近どう？仕事に限らず、何か感じてることある？」`,
    "シニア・主任クラス": `「最近チームどう見てる？正直な感想聞かせて」`,
    "もうすぐ管理職": `「最近、仕事全体を見てどう感じてる？率直に」`,
    "牽引層・リーダー候補": `「チームのこと、最近どう見てる？正直なところ」`,
    "ベテラン・専門職（非管理）": `「最近、仕事で気になってることある？何でも」`,
  };
  const subPosition = p.position;
  const opening = openMap[subPosition] || `「最近どう？何か気になってることある？」`;

  const questions = [];
  if (p.issue.includes("モチベが急落している")) questions.push(`「最近、仕事で"これは意味があるな"と思えた瞬間、あった？」`);
  if (p.issue.includes("転職を考えていそう")) questions.push(`「将来のこと、最近どんなふうに考えてる？」`);
  if (p.issue.includes("残業・疲弊が続いている")) questions.push(`「最近、仕事量きつくない？正直に教えて」`);
  if (p.issue.includes("人間関係でトラブル")) questions.push(`「チームの雰囲気、最近どう感じてる？」`);
  if (p.issue.includes("メンタル不調の兆候がある")) questions.push(`「最近、体と気持ちの調子はどう？無理してない？」`);
  if (p.issue.includes("評価制度への不満・不信感")) questions.push(`「評価について、正直に思うことを聞かせてもらえる？」`);
  questions.push(`「もし一つだけ今の仕事で変えられるとしたら、何を変えたい？」`);
  questions.push(`「私にもっとこうしてほしいって、何かある？」`);

  const ngList = [];
  if (p.personality.includes("反発しやすい・自己主張強め")) ngList.push("「言い訳しないで」→ 関係の質が一気に崩壊");
  if (p.personality.includes("やる気が見えない")) ngList.push("「なんでやる気ないの？」→ 詰問で関係が悪化");
  if (p.personality.includes("表面上は元気だが無理している")) ngList.push("「元気そうだね」で終わる→ 無理を見抜けず機会損失");
  if (p.issue.includes("メンタル不調の兆候がある")) ngList.push("「気合いで乗り越えろ」→ 最悪の一言");
  if (p.personality.includes("批判に過剰に傷つく")) ngList.push("「それは違う」と即否定→ 心を閉ざすトリガー");
  if (ngList.length < 2) ngList.push("評価・批判から入る→ 部下が防御的になり本音が出なくなる");
  if (ngList.length < 3) ngList.push("アドバイスを先に言う→「聴いてもらえてない」と感じさせる");

  return `【ペルソナ】
あなた: ${userRole === "exec" ? "役員" : userRole === "senior" ? "シニアマネージャー" : "マネージャー"}（${userAge}歳）
部下: ${p.ageLabel} / ${p.industry} / ${p.job} / ${p.position}（${p.ageRelation}）
家族: ${p.family}
性格: ${p.personality.join("・")}
状況: ${p.issue.join("・")}
${ageNote ? `\n${ageNote}` : ""}${roleNote ? `\n${roleNote}` : ""}

━━━ 成功循環モデル診断 ━━━
課題ステージ：【${cycle.label}】
${cycle.desc}
①関係の質 → ②思考の質 → ③行動の質 → ④結果の質
今は「${cycle.label}」を高めることが全ての起点。
今週の一手：${cycle.action}

━━━ マズロー欲求段階診断 ━━━
優先欲求：【${maslow.name}（第${maslow.level}段階）】
${maslow.desc}

━━━ 今日の1on1 トーク設計 ━━━

▶ Opening
${opening}
→ 評価せず、まず「聴く」姿勢を先に見せる

▶ Main（核心の問いかけ）
${questions.slice(0, 5).map((q, i) => `${["①","②","③","④","⑤"][i]} ${q}`).join("\n")}

▶ Closing
「話してくれてありがとう。来週また聞かせて」
→ 約束が「関係の質」を積み上げる

━━━ 絶対やってはいけないこと ━━━
${ngList.slice(0, 4).map(n => `❌ ${n}`).join("\n")}

━━━ 今週の一手 ━━━
${cycle.action}`;
};

// ============================================================
// ストレージ
// ============================================================
const STORAGE_KEY = "1on1_history_v2";
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } };
const saveHistory = (h) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(-50))); } catch {} };

const PROFILE_KEY = "1on1_profile_v1";
const loadProfile = () => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch { return null; } };
const saveProfile = (p) => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {} };

// ============================================================
// UIパーツ
// ============================================================
const Chip = ({ label, selected, onClick, multi, small }) => (
  <button onClick={onClick} style={{
    padding: small ? "5px 10px" : "6px 12px",
    borderRadius: 20, fontSize: small ? 11 : 11.5, cursor: "pointer",
    background: selected ? C.goldLight : C.surface2,
    border: `1.5px solid ${selected ? C.borderActive : C.border}`,
    color: selected ? C.goldDark : C.textSub,
    fontWeight: selected ? 700 : 400, transition: "all 0.15s", whiteSpace: "nowrap",
  }}>
    {selected && multi ? "✓ " : ""}{label}
  </button>
);

const Bubble = ({ text, isUser, icon = "🧭", iconBg = C.gold, onSpeak }) => (
  <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12, animation: "fadeUp 0.25s ease" }}>
    {!isUser && (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginRight: 8, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginTop: 2 }}>{icon}</div>
        {onSpeak && <button onClick={onSpeak} style={{ marginTop: 3, fontSize: 10, background: "none", border: "none", color: C.textMuted, cursor: "pointer" }}>🔊</button>}
      </div>
    )}
    <div style={{
      maxWidth: "82%", padding: "10px 14px", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap",
      background: isUser ? C.userBubble : C.surface, color: isUser ? C.userText : C.text,
      border: `1px solid ${isUser ? "transparent" : C.border}`,
      borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>{text}</div>
  </div>
);

const Dots = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 5, paddingLeft: 38, paddingBottom: 10 }}>
    {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: C.gold, animation: "pulse 1.2s ease infinite", animationDelay: `${i*0.2}s` }} />)}
  </div>
);

// ============================================================
// 共通ユーティリティ（タップ音・BGM・音声）
// ============================================================
const playTap = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 520; o.type = "sine";
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    o.start(); o.stop(ctx.currentTime + 0.07);
  } catch {}
};

let _bgmCtx = null; let _bgmNodes = [];
const bgmStart = () => {
  try {
    if (_bgmCtx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    _bgmCtx = ctx;
    const master = ctx.createGain(); master.gain.value = 0.05; master.connect(ctx.destination);
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 600; filter.Q.value = 0.4;
    noise.connect(filter); filter.connect(master); noise.start();
    const oscL = ctx.createOscillator(); const oscR = ctx.createOscillator();
    const panL = ctx.createStereoPanner(); const panR = ctx.createStereoPanner();
    const glr = ctx.createGain(); glr.gain.value = 0.03;
    oscL.frequency.value = 200; panL.pan.value = -1; oscR.frequency.value = 210; panR.pan.value = 1;
    oscL.connect(panL); panL.connect(glr); oscR.connect(panR); panR.connect(glr); glr.connect(ctx.destination);
    oscL.start(); oscR.start();
    _bgmNodes = [noise, oscL, oscR];
  } catch {}
};
const bgmStop = () => { try { _bgmNodes.forEach(n => n.stop()); _bgmCtx?.close(); } catch {} _bgmCtx = null; _bgmNodes = []; };


const stopSpeaking = () => { try { window.speechSynthesis.cancel(); } catch {}};

// ============================================================
// メインアプリ
// ============================================================
export default function App() {
  const savedProfile = loadProfile();
  const [screen, setScreen] = useState("home");
  const [tab, setTab] = useState(0);
  const [tapOn, setTapOn] = useState(true);
  const tapOnRef = useRef(true);
  const toggleTap = () => {
    const next = !tapOnRef.current;
    tapOnRef.current = next;
    window._tapOn = next;
    setTapOn(next);
  };
  const [bgmOn, setBgmOn] = useState(false);
  const toggleBGM = () => { T("tap"); setBgmOn(b => !b); };

  // ユーザープロフィール
  const [userAge, setUserAge] = useState(savedProfile?.age || 40);
  const [userRole, setUserRole] = useState(savedProfile?.role || "manager");

  // ペルソナ
  const [persona, setPersona] = useState({});
  const [subAgeLabel, setSubAgeLabel] = useState("");

  // チャット
  const [designMsgs, setDesignMsgs] = useState([]);
  const [designInput, setDesignInput] = useState("");
  const [designLoading, setDesignLoading] = useState(false);
  const [voicePool, setVoicePool] = useState([]);
  const [usedVoices, setUsedVoices] = useState([]);
  const [roleMsgs, setRoleMsgs] = useState([]);
  const [roleInput, setRoleInput] = useState("");
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleCount, setRoleCount] = useState(0);
  const [roleDone, setRoleDone] = useState(false);
  const [roleResult, setRoleResult] = useState("");
  const [history, setHistory] = useState(loadHistory());
  const isSpeakingRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const toggleSpeak = (text) => {
    if (window._speaking) { doStopSpeak(); setIsSpeaking(false); }
    else if (text) { doSpeak(text); setIsSpeaking(true); }
  };
  const [copied, setCopied] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [designMsgs, roleMsgs, designLoading, roleLoading]);

  const toggleVoice = () => { T("tap"); setVoiceOn(v => !v); };

  const handleVoiceInput = (setter) => {
    playTap();
    if (listening) { setListening(false); return; }
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { alert("音声認識はChromeでご利用ください"); return; }
      const r = new SR(); r.lang = "ja-JP"; r.interimResults = false;
      r.onresult = e => { setter(e.results[0][0].transcript); setListening(false); };
      r.onend = () => setListening(false);
      r.start(); setListening(true);
    } catch {}
  };

  const generateSummary = async () => {
    if (history.length === 0) return;
    setSummaryLoading(true);
    const recent = [...history].slice(0, 10);
    const userContent = `【1on1マスターAI 実施履歴サマリー】\n実施回数: ${history.length}回\n\n${recent.map((h, i) => `▼ ${h.date}（${h.persona}）\n評価: ${h.grade}（${h.score}点）\n${h.feedback?.slice(0, 150) || ""}`).join("\n\n")}`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 800,
          system: "あなたは1on1コーチングの専門家です。複数回の1on1ロールプレイ履歴を分析し、①成長の軌跡 ②繰り返し現れるパターン ③次に意識すべき改善点 の3点でサマリーを生成してください。300〜500字。",
          messages: [{ role: "user", content: userContent }] }),
      });
      const data = await res.json();
      setSummaryText(data.content?.[0]?.text || "");
    } catch {} finally { setSummaryLoading(false); }
  };

  const togglePersona = (key, val, multi) => {
    setPersona(prev => {
      if (multi) { const c = prev[key] || []; return { ...prev, [key]: c.includes(val) ? c.filter(v => v !== val) : [...c, val] }; }
      return { ...prev, [key]: prev[key] === val ? undefined : val };
    });
  };

  // 部下の年齢選択肢（年上・同学年・年下のグループ）
  const getSubAgeGroups = () => {
    const above = AGE_RANGES.filter(r => r.mid > userAge + 2);
    const same = AGE_RANGES.filter(r => Math.abs(r.mid - userAge) <= 4);
    const below = AGE_RANGES.filter(r => r.mid < userAge - 2);
    return { above, same, below };
  };

  const subAgeGroups = getSubAgeGroups();
  const selectedAgeRange = AGE_RANGES.find(r => r.label === subAgeLabel);
  const ageRelation = selectedAgeRange ? getAgeRelation(userAge, selectedAgeRange.mid) : null;

  // ポジション選択肢（役割による）
  const positionOpts = ROLE_HIERARCHY[userRole]?.subordinateOpts || PERSONA_KEYS;

  const isReady = PERSONA_KEYS.every(k => {
    const d = PERSONA[k]; const v = persona[k];
    return d.multi ? v && v.length > 0 : !!v;
  }) && subAgeLabel && persona.position;

  const buildFullPersona = () => ({
    ...persona,
    ageLabel: subAgeLabel,
    ageRelation: ageRelation?.tag || "年下",
    position: persona.position,
  });

  const startSession = () => {
    const fp = buildFullPersona();
    const pool = buildVoicePool(fp, userRole);
    setVoicePool(pool); setUsedVoices([]);
    setDesignLoading(true);
    setTimeout(() => { setDesignMsgs([{ ai: true, text: buildDesign(fp, userRole, userAge) }]); setDesignLoading(false); }, 900);
    setRoleMsgs([{ ai: true, text: `【ロールプレイ開始】\n${subAgeLabel}（${ageRelation?.tag}）/ ${fp.industry} / ${fp.job} / ${fp.position}\n性格: ${fp.personality.join("・")}\n状況: ${fp.issue.join("・")}\n\nこのペルソナの部下として話します。1on1を始めてください。（約10回でフィードバック）` }]);
    setRoleCount(0); setRoleDone(false); setScreen("main");
  };

  const getNextVoice = useCallback((pool, used) => {
    const avail = pool.filter(v => !used.includes(v));
    if (avail.length === 0) { setUsedVoices([]); return pool[Math.floor(Math.random() * pool.length)]; }
    const v = avail[Math.floor(Math.random() * avail.length)];
    setUsedVoices(prev => [...prev, v]);
    return v;
  }, []);

  const sendDesign = () => {
    if (!designInput.trim()) return;
    const t = designInput;
    setDesignMsgs(p => [...p, { ai: false, text: t }]);
    setDesignInput(""); setDesignLoading(true);
    setTimeout(() => {
      const fp = buildFullPersona();
      const cycle = SUCCESS_CYCLE.diagnose(fp.issue, fp.personality);
      const maslow = MASLOW.diagnose(fp.issue, fp.personality, fp.family);
      setDesignMsgs(p => [...p, { ai: true, text: `【追加アドバイス】\n\n「${t}」について。\n\n成功循環モデル（${cycle.label}）の視点から：\n${cycle.desc}\n\nマズロー（${maslow.name}）の視点から：\n${maslow.desc}\n\n具体的には：\n・アドバイスより先に共感を\n・沈黙は10秒待つ\n・「頑張ってるの、ちゃんと見てるよ」が刺さります` }]);
      setDesignLoading(false);
    }, 800);
  };

  const sendRole = () => {
    if (!roleInput.trim() || roleDone) return;
    const t = roleInput; const nc = roleCount + 1;
    setRoleMsgs(p => [...p, { ai: false, text: t }]);
    setRoleInput(""); setRoleCount(nc); setRoleLoading(true);
    setTimeout(() => {
      if (nc >= 10) {
        const userMsgs = roleMsgs.filter(m => !m.ai).map(m => m.text).concat([t]);
        const score = calcScore(userMsgs);
        const fp = buildFullPersona();
        const cycle = SUCCESS_CYCLE.diagnose(fp.issue, fp.personality);
        const maslow = MASLOW.diagnose(fp.issue, fp.personality, fp.family);
        const fb = `【ロールプレイ フィードバック】\n\n${score.comment}\n\n━━━ 総合評価 ━━━\n${score.grade}評価　${score.label}\nスコア: ${score.score}/100点 / やり取り: ${nc}回\n\n━━━ 成功循環モデル分析 ━━━\n今回の1on1で「${cycle.label}」への働きかけができましたか？\n${cycle.desc}\n\n━━━ マズロー分析 ━━━\n部下の「${maslow.name}」を満たす言葉がけはできましたか？\n${maslow.desc}\n\n━━━ 改善ポイント ━━━\n${score.score >= 80 ? "深掘りの質問をさらに磨くと完璧です！" : score.score >= 68 ? "評価・アドバイスを減らして「聴く」に徹するとA+に届きます。" : "まず「なるほど」「そうなんだ」の受け取りを増やしてみて。"}\n\n━━━ 次の1on1で試すこと ━━━\n${cycle.action}`;
        const rec = { date: new Date().toLocaleDateString("ja-JP"), persona: `${subAgeLabel}/${fp.job}/${fp.position}`, grade: score.grade, score: score.score, personality: fp.personality[0] || "", issue: fp.issue[0] || "", feedback: fb };
        const newH = [...history, rec]; setHistory(newH); saveHistory(newH);
        setRoleMsgs(p => [...p, { ai: true, text: fb }]);
        setRoleDone(true);
        setRoleResult(fb);
        T("success");
      } else {
        setRoleMsgs(p => [...p, { ai: true, text: getNextVoice(voicePool, usedVoices) }]);
      }
      setRoleLoading(false);
    }, 700);
  };

  const buildResultText = () => {
    const fb = roleMsgs.filter(m => m.ai).slice(-1)[0]?.text || "";
    const fp = buildFullPersona();
    return (
      `【1on1ロールプレイ 結果レポート】\n` +
      `実施日: ${new Date().toLocaleDateString("ja-JP")}\n\n` +
      `■ 部下ペルソナ\n` +
      `${subAgeLabel}（${ageRelation?.tag}）/ ${fp.industry} / ${fp.job} / ${fp.position}\n` +
      `性格: ${fp.personality.join("・")}\n` +
      `状況: ${fp.issue.join("・")}\n\n` +
      `■ フィードバック\n${fb}\n\n` +
      `---\n1on1マスターAI`
    );
  };

  const exportRoleResult = () => {
    const text = buildResultText();
    const subject = encodeURIComponent("1on1ロールプレイ結果レポート");
    const body = encodeURIComponent(text);
    const mailUrl = `mailto:?subject=${subject}&body=${body}`;
    // Artifact環境でも動くよう両方試みる
    try {
      const a = document.createElement("a");
      a.href = mailUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(mailUrl, "_blank");
    }
  };

  const copyResult = async () => {
    const text = buildResultText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // フォールバック
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const retryRole = () => {
    const fp = buildFullPersona();
    const pool = buildVoicePool(fp, userRole);
    setVoicePool(pool); setUsedVoices([]);
    setRoleMsgs([{ ai: true, text: `【再挑戦】同じペルソナで再スタート。\n1on1を始めてください。` }]);
    setRoleCount(0); setRoleDone(false);
  };

  const resetPersona = () => { setPersona({}); setSubAgeLabel(""); setScreen("persona"); setDesignMsgs([]); setRoleMsgs([]); setRoleCount(0); setRoleDone(false); };

  const saveUserProfile = () => { saveProfile({ age: userAge, role: userRole }); setScreen("persona"); };

  const handleSpeak = (text) => {
    if (isSpeaking) { window.speechSynthesis?.cancel(); setIsSpeaking(false); return; }
    setIsSpeaking(true);
    const utt = new SpeechSynthesisUtterance(text.slice(0, 150));
    utt.lang = "ja-JP"; utt.rate = 0.9;
    const voices = window.speechSynthesis?.getVoices() || [];
    const ja = voices.find(v => v.lang.startsWith("ja"));
    if (ja) utt.voice = ja;
    utt.onend = () => setIsSpeaking(false);
    window.speechSynthesis?.speak(utt);
  };

  const gradeColor = (g) => ({ S: C.red, "A+": C.goldDark, A: C.green, "A-": C.blue, B: C.textSub }[g] || C.textSub);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "sans-serif", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.7)}50%{opacity:1;transform:scale(1)}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#ddd}
        textarea:focus{border-color:${C.borderActive}!important;outline:none;}
        input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;background:#e0dbd2;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:${C.gold};cursor:pointer;}
      `}</style>

      {/* Header */}
      <div style={{ padding: "12px 16px 0", borderBottom: `1px solid ${C.border}`, background: C.surface, boxShadow: "0 1px 6px rgba(0,0,0,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${C.gold},${C.goldDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧭</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.goldDark }}>1on1 マスターAI</div>
            <div style={{ fontSize: 9, color: C.textMuted }}>成功循環モデル × マズロー × AI</div>
          </div>
          <button onClick={toggleTap} style={{ padding: "4px 7px", background: tapOn ? C.goldBg : C.surface2, border: `1px solid ${tapOn ? C.borderActive : C.border}`, borderRadius: 7, fontSize: 10, color: tapOn ? C.gold : C.textMuted, cursor: "pointer", fontWeight: 600 }}>{tapOn ? "🔔音ON" : "🔕音OFF"}</button>
          <button onClick={() => { setScreen("home"); }} style={{ padding: "4px 8px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 10, color: C.textSub, cursor: "pointer" }}>🏠 ホーム</button>
          <button onClick={() => setScreen(screen === "history" ? (screen === "main" ? "main" : "persona") : "history")}
            style={{ padding: "4px 8px", background: screen === "history" ? C.goldLight : C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 10, color: C.textSub, cursor: "pointer" }}>
            📊 履歴
          </button>
        </div>
        {screen === "main" && (
          <>
            <div style={{ fontSize: 10, color: C.gold, marginBottom: 8, padding: "3px 8px", background: C.goldLight, borderRadius: 6, fontWeight: 600 }}>
              👤 {subAgeLabel}（{ageRelation?.tag}）/ {persona.industry} / {persona.job}
            </div>
            <div style={{ display: "flex" }}>
              {["🧭 トーク設計", "🎭 ロールプレイ"].map((t, i) => (
                <button key={i} onClick={() => setTab(i)} style={{ flex: 1, padding: "8px 0", background: "transparent", border: "none", borderBottom: tab === i ? `2.5px solid ${C.gold}` : "2.5px solid transparent", color: tab === i ? C.goldDark : C.textMuted, fontSize: 13, cursor: "pointer", fontWeight: tab === i ? 700 : 400 }}>{t}</button>
              ))}
              <button onClick={resetPersona} style={{ padding: "8px 10px", background: "transparent", border: "none", color: C.textMuted, fontSize: 10, cursor: "pointer" }}>← 変更</button>
            </div>
          </>
        )}
      </div>

      {/* ====== ホーム画面 ====== */}
      {screen === "home" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ textAlign: "center", paddingTop: 20, marginBottom: 28 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🧭</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.goldDark, marginBottom: 6 }}>1on1 マスターAI</div>
            <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7 }}>成功循環モデル × マズロー心理学<br />管理職のための1on1コーチングAI</div>
          </div>

          {/* 自分の年齢 */}
          <div style={{ background: C.surface, borderRadius: 14, padding: 18, marginBottom: 16, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>🎂 あなたの年齢</div>
            <div style={{ textAlign: "center", fontSize: 32, fontWeight: 700, color: C.goldDark, marginBottom: 8 }}>{userAge}<span style={{ fontSize: 16 }}>歳</span></div>
            <input type="range" min={22} max={65} value={userAge} onChange={e => setUserAge(Number(e.target.value))}
              style={{ width: "100%", marginBottom: 8 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.textMuted }}>
              <span>22歳</span><span>65歳</span>
            </div>
          </div>

          {/* 自分の役職 */}
          <div style={{ background: C.surface, borderRadius: 14, padding: 18, marginBottom: 24, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📊 あなたの役職</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(ROLE_HIERARCHY).map(([key, role]) => (
                <button key={key} onClick={() => setUserRole(key)} style={{
                  padding: "14px 16px", borderRadius: 12, border: `2px solid ${userRole === key ? C.borderActive : C.border}`,
                  background: userRole === key ? C.goldLight : C.surface2, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                }}>
                  <div style={{ fontSize: 24 }}>{role.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: userRole === key ? C.goldDark : C.text }}>{role.label}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{role.desc}</div>
                  </div>
                  {userRole === key && <div style={{ marginLeft: "auto", color: C.gold, fontSize: 18 }}>✓</div>}
                </button>
              ))}
            </div>
          </div>

          <button onClick={saveUserProfile} style={{ width: "100%", padding: "14px 0", background: `linear-gradient(135deg,${C.gold},${C.goldDark})`, border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 16px rgba(184,149,106,0.3)` }}>
            ✅ 設定を保存して次へ
          </button>
        </div>
      )}

      {/* ====== ペルソナ設定 ====== */}
      {screen === "persona" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 32px" }}>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 16, padding: "10px 14px", background: C.goldLight, borderRadius: 10, border: `1px solid ${C.border}`, lineHeight: 1.8 }}>
            あなた：<strong style={{ color: C.goldDark }}>{ROLE_HIERARCHY[userRole]?.label}（{userAge}歳）</strong><br />
            部下のペルソナを設定してください。性格・状況は複数選択可。
          </div>

          {/* 氏名入力 */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6, fontWeight: 600 }}>👤 部下の氏名（任意）</div>
            <input
              value={persona.name || ""}
              onChange={e => setPersona(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例：田中 太郎"
              style={{ width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, fontFamily: "sans-serif" }}
            />
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>入力するとトーク設計・ロールプレイ・履歴に名前が反映されます</div>
          </div>

          {/* 部下の年齢（年上・同学年・年下グループ） */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 8, fontWeight: 600 }}>🎂 部下の年齢層</div>
            {subAgeGroups.above.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: C.red, marginBottom: 5, fontWeight: 600 }}>▲ 年上の部下</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {subAgeGroups.above.map(r => <Chip key={r.label} label={r.label} selected={subAgeLabel === r.label} onClick={() => setSubAgeLabel(r.label)} />)}
                </div>
              </div>
            )}
            {subAgeGroups.same.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: C.blue, marginBottom: 5, fontWeight: 600 }}>＝ 同学年・近い年代</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {subAgeGroups.same.map(r => <Chip key={r.label} label={r.label} selected={subAgeLabel === r.label} onClick={() => setSubAgeLabel(r.label)} />)}
                </div>
              </div>
            )}
            {subAgeGroups.below.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 10, color: C.green, marginBottom: 5, fontWeight: 600 }}>▼ 年下の部下</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {subAgeGroups.below.map(r => <Chip key={r.label} label={r.label} selected={subAgeLabel === r.label} onClick={() => setSubAgeLabel(r.label)} />)}
                </div>
              </div>
            )}
            {subAgeLabel && ageRelation && (
              <div style={{ marginTop: 6, padding: "4px 10px", background: C.goldLight, borderRadius: 8, fontSize: 11, color: C.goldDark, fontWeight: 600 }}>
                👉 {ageRelation.label} の部下
              </div>
            )}
          </div>

          {/* ポジション */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 8, fontWeight: 600 }}>
              📊 {ROLE_HIERARCHY[userRole]?.subordinateLabel || "ポジション"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {positionOpts.map(o => (
                <Chip key={o} label={o} selected={persona.position === o} onClick={() => setPersona(prev => ({ ...prev, position: prev.position === o ? undefined : o }))} />
              ))}
            </div>
          </div>

          {/* 残りペルソナ */}
          {PERSONA_KEYS.map(k => {
            const d = PERSONA[k];
            const hasCats = d.categories && d.categories.length > 0;
            return (
              <div key={k} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                  {d.icon} {d.label}
                  {d.multi && <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 400 }}>複数選択可</span>}
                </div>
                {hasCats ? (
                  // カテゴリヘッダー付き表示（性格・状況）
                  d.categories.map(cat => (
                    <div key={cat.label} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6, paddingLeft: 2, borderLeft: `2px solid ${C.gold}`, paddingLeft: 6 }}>
                        {cat.label}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {cat.items.map(o => {
                          const v = persona[k];
                          const sel = d.multi ? (v || []).includes(o) : v === o;
                          return <Chip key={o} label={o} selected={sel} multi={d.multi} onClick={() => togglePersona(k, o, d.multi)} />;
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  // 通常のフラット表示（業種・職種・家族構成）
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {d.opts.map(o => {
                      const v = persona[k];
                      const sel = d.multi ? (v || []).includes(o) : v === o;
                      return <Chip key={o} label={o} selected={sel} multi={d.multi} onClick={() => togglePersona(k, o, d.multi)} />;
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={startSession} disabled={!isReady} style={{
            width: "100%", padding: "14px 0", marginTop: 8,
            background: isReady ? `linear-gradient(135deg,${C.gold},${C.goldDark})` : C.border,
            border: "none", borderRadius: 14, color: isReady ? "#fff" : C.textMuted,
            fontSize: 14, fontWeight: 700, cursor: isReady ? "pointer" : "not-allowed",
            boxShadow: isReady ? `0 4px 16px rgba(184,149,106,0.3)` : "none",
          }}>
            {isReady ? "✅ このペルソナで開始" : "全項目を選んでください"}
          </button>

          {history.length > 0 && (
            <button onClick={() => setScreen("history")} style={{ width: "100%", padding: "10px 0", marginTop: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: C.textSub, fontSize: 12, cursor: "pointer" }}>
              📊 過去の履歴を見る（{history.length}件）
            </button>
          )}
        </div>
      )}

      {/* ====== メイン ====== */}
      {screen === "main" && tab === 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {designLoading && !designMsgs.length && <Dots />}
            {designMsgs.map((m, i) => <Bubble key={i} text={m.text} isUser={!m.ai} />)}
            {designLoading && designMsgs.length > 0 && <Dots />}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}`, background: C.surface }}>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea value={designInput} onChange={e => setDesignInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDesign(); }}}
                placeholder="追加質問を…" rows={2}
                style={{ flex: 1, background: C.surface2, border: `1.5px solid ${C.border}`, borderRadius: 12, color: C.text, padding: "9px 12px", fontSize: 13, resize: "none", outline: "none", lineHeight: 1.5, fontFamily: "sans-serif" }} />
              <button onClick={sendDesign} disabled={!designInput.trim() || designLoading}
                style={{ width: 44, height: 44, borderRadius: 12, background: designInput.trim() ? C.gold : C.border, border: "none", color: "#fff", fontSize: 20, cursor: "pointer", alignSelf: "flex-end" }}>↑</button>
            </div>
          </div>
        </div>
      )}

      {screen === "main" && tab === 1 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {!roleDone && (
            <div style={{ padding: "5px 14px", background: C.surface2, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: C.textMuted }}>進捗</span>
                <span style={{ fontSize: 10, color: C.textMuted }}>残り約{Math.max(0, 10 - roleCount)}回でフィードバック</span>
              </div>
              <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
                <div style={{ width: `${Math.min(100, roleCount * 10)}%`, height: "100%", background: `linear-gradient(90deg,${C.gold},${C.goldDark})`, borderRadius: 2, transition: "width 0.4s ease" }} />
              </div>
            </div>
          )}
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {roleMsgs.map((m, i) => (
              <Bubble key={i} text={m.text} isUser={!m.ai} icon="👤" iconBg="linear-gradient(135deg,#6a7a8a,#3a4a5a)"
                onSpeak={m.ai ? () => handleSpeak(m.text) : null} />
            ))}
            {roleLoading && <Dots />}
            <div ref={bottomRef} />
          </div>
          {!roleDone ? (
            <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}`, background: C.surface }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleVoiceInput(setRoleInput)} style={{ width: 44, height: 44, borderRadius: 12, background: listening ? C.goldLight : C.surface2, border: `1px solid ${listening ? C.gold : C.border}`, color: listening ? C.gold : C.textSub, fontSize: 18, flexShrink: 0, cursor: "pointer" }}>🎤</button>
                <textarea value={roleInput} onChange={e => setRoleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendRole(); }}}
                  placeholder="部下に話しかけてみて…" rows={2}
                  style={{ flex: 1, background: C.surface2, border: `1.5px solid ${C.border}`, borderRadius: 12, color: C.text, padding: "9px 12px", fontSize: 13, resize: "none", outline: "none", lineHeight: 1.5, fontFamily: "sans-serif" }} />
                <button onClick={sendRole} disabled={!roleInput.trim() || roleLoading}
                  style={{ width: 44, height: 44, borderRadius: 12, background: roleInput.trim() ? "#3a5a6a" : C.border, border: "none", color: "#fff", fontSize: 20, cursor: "pointer", alignSelf: "flex-end" }}>↑</button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 14, flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10, textAlign: "center" }}>次のアクションを選んでください</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button onClick={retryRole} style={{ flex: 1, padding: "12px 0", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 12, color: C.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  🔄 同じペルソナで<br />再挑戦
                </button>
                <button onClick={resetPersona} style={{ flex: 1, padding: "12px 0", background: `linear-gradient(135deg,${C.gold},${C.goldDark})`, border: "none", borderRadius: 12, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  👤 ペルソナを<br />再設定して練習
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button onClick={exportRoleResult} style={{ flex: 1, padding: "10px 0", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.textSub, fontSize: 11, cursor: "pointer" }}>
                  📧 メールで送る
                </button>
                <button onClick={copyResult} style={{ flex: 1, padding: "10px 0", background: copied ? C.greenLight : C.surface, border: `1px solid ${copied ? C.green : C.border}`, borderRadius: 10, color: copied ? C.green : C.textSub, fontSize: 11, cursor: "pointer", fontWeight: copied ? 700 : 400 }}>
                  {copied ? "✅ コピーしました" : "📋 結果をコピー"}
                </button>
                <button onClick={() => { if(isSpeaking){doStopSpeak();setIsSpeaking(false);}else if(roleResult){doSpeak(roleResult);setIsSpeaking(true);} }} style={{ flex: 1, padding: "10px 0", background: isSpeaking ? C.greenLight : C.surface, border: `1px solid ${isSpeaking ? C.green : C.border}`, borderRadius: 10, color: isSpeaking ? C.green : C.textSub, fontSize: 11, cursor: "pointer" }}>
                  {isSpeaking ? "⏹停止" : "🔈読上"}
                </button>
              </div>
              <button onClick={() => setScreen("history")} style={{ width: "100%", padding: "10px 0", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.textSub, fontSize: 12, cursor: "pointer" }}>
                📊 履歴・評価グラフを見る
              </button>
            </div>
          )}
        </div>
      )}

      {/* ====== 履歴 ====== */}
      {screen === "history" && !selectedHistory && (
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.goldDark, marginBottom: 16 }}>📊 実施履歴・評価推移</div>
          {/* AI サマリーボタン */}
          {history.length >= 2 && (
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => { playTap(); generateSummary(); }} style={{ width: "100%", padding: "11px 0", background: summaryLoading ? C.surface2 : `linear-gradient(135deg,${C.gold},${C.goldDark})`, border: "none", borderRadius: 12, color: summaryLoading ? C.textMuted : "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {summaryLoading ? "分析中..." : "🧠 全履歴のAIサマリーを生成"}
              </button>
              {summaryText && (
                <div style={{ marginTop: 10, padding: "14px 16px", background: C.goldLight, borderRadius: 12, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.goldDark, fontWeight: 700, marginBottom: 8 }}>📝 成長サマリー</div>
                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{summaryText}</div>
                </div>
              )}
            </div>
          )}
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: C.textMuted, fontSize: 13 }}>まだ履歴がありません。<br />ロールプレイを完了すると記録されます。</div>
          ) : (
            <>
              <div style={{ background: C.surface, borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12, fontWeight: 600 }}>スコア推移（直近{Math.min(history.length, 10)}回）</div>
                {(() => {
                  const data = history.slice(-10);
                  const w = 280, h = 80, pad = 10;
                  const xs = data.map((_, i) => pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2));
                  const ys = data.map(d => h - pad - ((d.score - 15) / 85) * (h - pad * 2));
                  const points = data.length > 1 ? xs.map((x, i) => `${x},${ys[i]}`).join(" ") : null;
                  return (
                    <svg width="100%" viewBox={`0 0 ${w} ${h + 14}`} style={{ overflow: "visible" }}>
                      {/* グリッドライン */}
                      {[25, 50, 75, 100].map(v => {
                        const y = h - pad - ((v - 15) / 85) * (h - pad * 2);
                        return <line key={v} x1={pad} y1={y} x2={w - pad} y2={y} stroke={C.border} strokeWidth={0.5} strokeDasharray="3,3" />;
                      })}
                      {/* 棒グラフ（背景） */}
                      {data.map((d, i) => {
                        const barW = Math.max(4, (w - pad * 2) / data.length - 4);
                        const barH = ((d.score - 15) / 85) * (h - pad * 2);
                        return <rect key={i} x={xs[i] - barW / 2} y={h - pad - barH} width={barW} height={barH} fill={gradeColor(d.grade)} opacity={0.15} rx={2} />;
                      })}
                      {/* 折れ線 */}
                      {points && <polyline points={points} fill="none" stroke={C.gold} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
                      {/* データ点 */}
                      {data.map((d, i) => (
                        <g key={i}>
                          <circle cx={xs[i]} cy={ys[i]} r={4} fill={gradeColor(d.grade)} stroke="#fff" strokeWidth={1.5} />
                          <text x={xs[i]} y={ys[i] - 8} textAnchor="middle" fontSize={8} fill={gradeColor(d.grade)} fontWeight="700">{d.grade}</text>
                          <text x={xs[i]} y={h + 10} textAnchor="middle" fontSize={7} fill={C.textMuted}>{d.date.slice(5)}</text>
                        </g>
                      ))}
                    </svg>
                  );
                })()}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>👆 各記録をタップすると詳細を確認できます</div>
              {[...history].reverse().map((h, i) => (
                <div key={i} onClick={() => setSelectedHistory(h)}
                  style={{ background: C.surface, borderRadius: 10, padding: "10px 14px", marginBottom: 8, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = C.surface}
                >
                  <div>
                    <div style={{ fontSize: 12, color: C.text, fontWeight: 600, marginBottom: 3 }}>{h.persona}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{h.date} · {h.personality} · {h.issue}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: gradeColor(h.grade) }}>{h.grade}</div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>{h.score}点 ›</div>
                  </div>
                </div>
              ))}
              <button onClick={() => { { setHistory([]); saveHistory([]); } }}
                style={{ width: "100%", padding: "10px 0", marginTop: 8, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, color: C.textMuted, fontSize: 12, cursor: "pointer" }}>
                🗑 履歴を全削除
              </button>
            </>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => setScreen("home")}
              style={{ flex: 1, padding: "12px 0", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: C.textSub, fontSize: 13, cursor: "pointer" }}>
              🏠 ホームへ
            </button>
            <button onClick={() => setScreen(persona.industry ? "main" : "persona")}
              style={{ flex: 1, padding: "12px 0", background: `linear-gradient(135deg,${C.gold},${C.goldDark})`, border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ← 戻る
            </button>
          </div>
        </div>
      )}

      {/* ====== 履歴詳細 ====== */}
      {screen === "history" && selectedHistory && (
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>{selectedHistory.date} の記録</div>
          <div style={{ background: C.surface, borderRadius: 12, padding: 16, marginBottom: 14, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 8, fontWeight: 600 }}>ペルソナ</div>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>{selectedHistory.persona}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{selectedHistory.personality} / {selectedHistory.issue}</div>
          </div>
          <div style={{ background: C.surface, borderRadius: 12, padding: 16, marginBottom: 14, border: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: gradeColor(selectedHistory.grade), marginBottom: 4 }}>{selectedHistory.grade}</div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{selectedHistory.score}点</div>
          </div>
          {selectedHistory.feedback && (
            <div style={{ background: C.surface, borderRadius: 12, padding: 16, marginBottom: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10, fontWeight: 600 }}>フィードバック</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{selectedHistory.feedback}</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setSelectedHistory(null)}
              style={{ flex: 1, padding: "12px 0", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: C.textSub, fontSize: 13, cursor: "pointer" }}>
              ← 一覧へ
            </button>
            <button onClick={() => setScreen("home")}
              style={{ flex: 1, padding: "12px 0", background: `linear-gradient(135deg,${C.gold},${C.goldDark})`, border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              🏠 ホームへ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
　
