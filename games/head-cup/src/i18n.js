// Interface text in English, French and Arabic (Modern Standard Arabic, right-to-left).
// Skill names/descriptions live in each skill module; country names in teams.js.
export const LANGS = { en: 'English', fr: 'Français', ar: 'العربية' };

const T = {
  en: {
    tagline: 'Big heads. Big goals.', pressStart: 'Press any key or tap to start', loading: 'Warming up…',
    onePlayer: '1 Player', twoPlayers: '2 Players', twoVsTwo: '2 vs 2', settings: 'Settings', howTo: 'How to play', back: 'Back', backPlayora: 'Back to PLAYORA',
    vsCpu: 'You vs the computer', vsFriend: 'Two friends, one keyboard', teamMode: 'Teams of two',
    chooseFighter: 'Choose your player', character: 'Player', team: 'Team', skill: 'Skill', ready: 'Ready!', confirm: 'Confirm', cpu: 'CPU', player: 'Player {n}',
    teammate: 'Team-mate', random: 'Random',
    speed: 'Speed', jump: 'Jump', kick: 'Kick', size: 'Head',
    matchSettings: 'Match settings', time: 'Time', goalLimit: 'Goals to win', noLimit: 'No limit', suddenDeath: 'Sudden death if tied', on: 'On', off: 'Off',
    difficulty: 'CPU level', easy: 'Easy', medium: 'Medium', hard: 'Hard', play: 'Play!', controller: 'Controlled by', gamepad: 'Gamepad {n}',
    pause: 'Paused', resume: 'Resume', restart: 'Restart match', quit: 'Main menu',
    win: '{team} wins!', draw: 'Draw!', rematch: 'Rematch', changePlayers: 'Change players', finalScore: 'Final score', goals: 'Goals',
    music: 'Music', sfx: 'Sound effects', mute: 'Mute', language: 'Language', shake: 'Screen shake', touch: 'Touch controls', auto: 'Auto', hints: 'Show key hints',
    goal: 'GOOOAL!', ownGoal: 'Own goal!', golden: 'GOLDEN GOAL', getReady: 'READY?', go: 'GO!', timeUp: 'TIME!', time_: 'TIME',
    controlsTitle: 'Controls', move: 'Move', jumpK: 'Jump', kickK: 'Kick', skillK: 'Skill', pauseK: 'Pause', muteK: 'Mute',
    rules: 'Score more goals than your opponent before time runs out. If it\'s tied, the next goal wins (sudden death). Each player has one skill: wait for its bar to fill, then use it once per match.',
    skillsTitle: 'Skills', modesTitle: 'Modes', gamepadHint: 'Gamepads: stick or d-pad to move, A jump, X/B kick, Y/RB skill, Start pause.',
    fullscreen: 'Fullscreen', notReady: 'Charging…',
  },
  fr: {
    tagline: 'Grosses têtes. Gros buts.', pressStart: 'Appuyez sur une touche ou touchez l’écran', loading: 'Échauffement…',
    onePlayer: '1 joueur', twoPlayers: '2 joueurs', twoVsTwo: '2 contre 2', settings: 'Réglages', howTo: 'Comment jouer', back: 'Retour', backPlayora: 'Retour à PLAYORA',
    vsCpu: 'Vous contre l’ordinateur', vsFriend: 'Deux amis, un clavier', teamMode: 'Équipes de deux',
    chooseFighter: 'Choisissez votre joueur', character: 'Joueur', team: 'Équipe', skill: 'Pouvoir', ready: 'Prêt !', confirm: 'Valider', cpu: 'CPU', player: 'Joueur {n}',
    teammate: 'Coéquipier', random: 'Aléatoire',
    speed: 'Vitesse', jump: 'Saut', kick: 'Frappe', size: 'Tête',
    matchSettings: 'Réglages du match', time: 'Temps', goalLimit: 'Buts pour gagner', noLimit: 'Sans limite', suddenDeath: 'Mort subite en cas d’égalité', on: 'Oui', off: 'Non',
    difficulty: 'Niveau CPU', easy: 'Facile', medium: 'Moyen', hard: 'Difficile', play: 'Jouer !', controller: 'Contrôlé par', gamepad: 'Manette {n}',
    pause: 'Pause', resume: 'Reprendre', restart: 'Recommencer', quit: 'Menu principal',
    win: '{team} gagne !', draw: 'Match nul !', rematch: 'Revanche', changePlayers: 'Changer de joueurs', finalScore: 'Score final', goals: 'Buts',
    music: 'Musique', sfx: 'Effets sonores', mute: 'Muet', language: 'Langue', shake: 'Tremblement d’écran', touch: 'Commandes tactiles', auto: 'Auto', hints: 'Afficher les touches',
    goal: 'BUUUT !', ownGoal: 'Contre son camp !', golden: 'BUT EN OR', getReady: 'PRÊTS ?', go: 'GO !', timeUp: 'TERMINÉ !', time_: 'TEMPS',
    controlsTitle: 'Commandes', move: 'Bouger', jumpK: 'Sauter', kickK: 'Frapper', skillK: 'Pouvoir', pauseK: 'Pause', muteK: 'Son',
    rules: 'Marquez plus de buts que l’adversaire avant la fin du temps. En cas d’égalité, le prochain but gagne (mort subite). Chaque joueur a un pouvoir : attendez que sa barre soit pleine, puis utilisez-le une fois par match.',
    skillsTitle: 'Pouvoirs', modesTitle: 'Modes', gamepadHint: 'Manettes : stick ou croix pour bouger, A sauter, X/B frapper, Y/RB pouvoir, Start pause.',
    fullscreen: 'Plein écran', notReady: 'En charge…',
  },
  ar: {
    tagline: 'رؤوس كبيرة. أهداف كبيرة.', pressStart: 'اضغط أي زر أو المس الشاشة للبدء', loading: 'جارٍ الإحماء…',
    onePlayer: 'لاعب واحد', twoPlayers: 'لاعبان', twoVsTwo: '٢ ضد ٢', settings: 'الإعدادات', howTo: 'طريقة اللعب', back: 'رجوع', backPlayora: 'العودة إلى PLAYORA',
    vsCpu: 'أنت ضد الحاسوب', vsFriend: 'صديقان على لوحة مفاتيح واحدة', teamMode: 'فريقان من لاعبَين',
    chooseFighter: 'اختر لاعبك', character: 'اللاعب', team: 'المنتخب', skill: 'المهارة', ready: 'جاهز!', confirm: 'تأكيد', cpu: 'الحاسوب', player: 'اللاعب {n}',
    teammate: 'زميل الفريق', random: 'عشوائي',
    speed: 'السرعة', jump: 'القفز', kick: 'الركل', size: 'الرأس',
    matchSettings: 'إعدادات المباراة', time: 'الوقت', goalLimit: 'الأهداف للفوز', noLimit: 'بلا حد', suddenDeath: 'الهدف الذهبي عند التعادل', on: 'نعم', off: 'لا',
    difficulty: 'مستوى الحاسوب', easy: 'سهل', medium: 'متوسط', hard: 'صعب', play: 'العب!', controller: 'يتحكم به', gamepad: 'يد التحكم {n}',
    pause: 'إيقاف مؤقت', resume: 'متابعة', restart: 'إعادة المباراة', quit: 'القائمة الرئيسية',
    win: 'فوز {team}!', draw: 'تعادل!', rematch: 'مباراة العودة', changePlayers: 'تغيير اللاعبين', finalScore: 'النتيجة النهائية', goals: 'الأهداف',
    music: 'الموسيقى', sfx: 'المؤثرات الصوتية', mute: 'كتم الصوت', language: 'اللغة', shake: 'اهتزاز الشاشة', touch: 'أزرار اللمس', auto: 'تلقائي', hints: 'إظهار الأزرار',
    goal: 'هدف!', ownGoal: 'هدف في مرماه!', golden: 'الهدف الذهبي', getReady: 'استعد!', go: 'انطلق!', timeUp: 'انتهى الوقت!', time_: 'الوقت',
    controlsTitle: 'التحكم', move: 'التحرك', jumpK: 'القفز', kickK: 'الركل', skillK: 'المهارة', pauseK: 'إيقاف', muteK: 'الصوت',
    rules: 'سجّل أهدافاً أكثر من خصمك قبل انتهاء الوقت. عند التعادل يفوز صاحب الهدف التالي (الهدف الذهبي). لكل لاعب مهارة واحدة: انتظر امتلاء شريطها ثم استخدمها مرة واحدة في المباراة.',
    skillsTitle: 'المهارات', modesTitle: 'أنماط اللعب', gamepadHint: 'يد التحكم: العصا أو الأسهم للتحرك، A للقفز، X/B للركل، Y/RB للمهارة، Start للإيقاف.',
    fullscreen: 'ملء الشاشة', notReady: 'قيد الشحن…',
  },
};

let lang = 'en';
export function setLang(l) { lang = T[l] ? l : 'en'; return lang; }
export function getLang() { return lang; }
export const isRTL = () => lang === 'ar';
/** Translate a key, filling {placeholders}. Falls back to English, then to the key itself. */
export function t(key, vars = {}) {
  const s = (T[lang] && T[lang][key]) ?? T.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}
/** Pick the current language from a {en, fr, ar} object. */
export const tr = (obj) => (obj ? obj[lang] || obj.en : '');
/** Apply translations to every element with data-i18n="key". */
export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.documentElement.lang = lang;
  document.documentElement.dir = isRTL() ? 'rtl' : 'ltr';
}
export function detectLang() {
  const n = (navigator.language || 'en').slice(0, 2);
  return T[n] ? n : 'en';
}
