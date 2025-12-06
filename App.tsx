import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { generateSpeech } from './services/geminiService';
import { createWavBlob } from './utils/audioUtils';

// --- UI Atom Components ---

const Label: React.FC<{ children: React.ReactNode; htmlFor?: string }> = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-colors">{children}</label>
);

const Field: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-5">{children}</div>
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <div className="relative">
    <select
      {...props}
      className={
        "w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 " +
        "dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400 transition-colors " +
        (props.className ?? "")
      }
    />
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
    </div>
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
}

const Button: React.FC<ButtonProps> = ({ loading, variant = 'primary', size = 'md', ...rest }) => {
  const baseClasses = "inline-flex items-center justify-center rounded-lg font-semibold shadow-sm transition-all active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed";
  
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm"
  };

  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 border border-transparent",
    secondary: "bg-gray-800 text-white hover:bg-gray-900 dark:bg-slate-700 dark:hover:bg-slate-600 border border-transparent",
    outline: "bg-transparent text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800",
    ghost: "bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 shadow-none"
  };

  return (
    <button
      {...rest}
      className={`${baseClasses} ${sizeClasses[size]} ${variants[variant]} ${rest.className ?? ""}`}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Generating...
        </>
      ) : rest.children}
    </button>
  );
};

interface CardProps {
  children: React.ReactNode;
  title?: string;
  desc?: string;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, title, desc, className }) => (
  <div className={`rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm p-6 shadow-sm transition-all dark:bg-slate-800/80 dark:border-slate-700 flex flex-col ${className ?? ""}`}>
    {title && (
      <div className="mb-5 border-b border-gray-100 dark:border-slate-700 pb-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
        {desc && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{desc}</p>}
      </div>
    )}
    <div className="flex-grow">{children}</div>
  </div>
);

// --- Constants & Types ---

interface Voice {
  id: string;
  apiId: string;
  name: string;
  description: string;
}

const VOICES_BY_LANGUAGE: Record<string, { male: Voice[], female: Voice[] }> = {
  vi: {
    female: [
      { id: 'vi-female-1', apiId: 'Kore', name: 'Mai Linh (Miền Bắc)', description: 'Giọng nữ miền Bắc, ấm áp, truyền cảm.' },
      { id: 'vi-female-2', apiId: 'Zephyr', name: 'Thảo Vy (Miền Nam)', description: 'Giọng nữ miền Nam, trẻ trung, trong trẻo.' },
      { id: 'vi-female-3', apiId: 'Kore', name: 'Hà Trang (Miền Bắc)', description: 'Giọng nữ miền Bắc, thanh lịch, rõ ràng.' },
      { id: 'vi-female-4', apiId: 'Zephyr', name: 'Ngọc Hân (Miền Nam)', description: 'Giọng nữ miền Nam, ngọt ngào, thân thiện.' },
      { id: 'vi-female-5', apiId: 'Kore', name: 'Phương Anh (Miền Bắc)', description: 'Giọng nữ miền Bắc, chuyên nghiệp, phù hợp tin tức.' },
      { id: 'vi-female-6', apiId: 'Zephyr', name: 'Thanh Trúc (Miền Nam)', description: 'Giọng nữ miền Nam, tự nhiên, gần gũi.' },
      { id: 'vi-female-7', apiId: 'Kore', name: 'Thuỳ Dương (Miền Bắc)', description: 'Giọng nữ miền Bắc, nhẹ nhàng, tinh tế.' },
      { id: 'vi-female-8', apiId: 'Zephyr', name: 'Kim Ngân (Miền Nam)', description: 'Giọng nữ miền Nam, tươi vui, năng động.' },
      { id: 'vi-female-9', apiId: 'Kore', name: 'Lan Chi (Miền Bắc)', description: 'Giọng nữ miền Bắc, trang trọng, quyền uy.' },
      { id: 'vi-female-10', apiId: 'Zephyr', name: 'Tú Quyên (Miền Nam)', description: 'Giọng nữ miền Nam, dịu dàng, sâu lắng.' },
    ],
    male: [
      { id: 'vi-male-1', apiId: 'Puck', name: 'Minh Quang (Miền Bắc)', description: 'Giọng nam miền Bắc, rõ ràng, dứt khoát.' },
      { id: 'vi-male-2', apiId: 'Charon', name: 'Hoàng Dũng (Miền Nam)', description: 'Giọng nam miền Nam, trầm ấm, đáng tin cậy.' },
      { id: 'vi-male-3', apiId: 'Fenrir', name: 'Bảo Long (Miền Bắc)', description: 'Giọng nam miền Bắc, trung tính, tự nhiên.' },
      { id: 'vi-male-4', apiId: 'Puck', name: 'Gia Huy (Miền Nam)', description: 'Giọng nam miền Nam, trẻ trung, năng động.' },
      { id: 'vi-male-5', apiId: 'Charon', name: 'Tuấn Kiệt (Miền Bắc)', description: 'Giọng nam miền Bắc, mạnh mẽ, quyết đoán.' },
      { id: 'vi-male-6', apiId: 'Fenrir', name: 'Đức Anh (Miền Bắc)', description: 'Giọng nam miền Bắc, lịch lãm, điềm tĩnh.' },
      { id: 'vi-male-7', apiId: 'Puck', name: 'Thành Trung (Miền Nam)', description: 'Giọng nam miền Nam, thân thiện, kể chuyện.' },
      { id: 'vi-male-8', apiId: 'Charon', name: 'Quốc Bảo (Miền Nam)', description: 'Giọng nam miền Nam, chững chạc, uy tín.' },
      { id: 'vi-male-9', apiId: 'Fenrir', name: 'Việt Hoàng (Miền Bắc)', description: 'Giọng nam miền Bắc, hào sảng, quảng cáo.' },
      { id: 'vi-male-10', apiId: 'Puck', name: 'Đăng Khoa (Miền Nam)', description: 'Giọng nam miền Nam, sôi nổi, hoạt bát.' },
    ]
  },
  en: {
    female: [
      { id: 'en-female-1', apiId: 'Kore', name: 'Kore', description: 'A standard, clear female voice.' },
      { id: 'en-female-2', apiId: 'Zephyr', name: 'Zephyr', description: 'A warm and friendly female voice.' },
    ],
    male: [
      { id: 'en-male-1', apiId: 'Puck', name: 'Puck', description: 'A youthful and energetic male voice.' },
      { id: 'en-male-2', apiId: 'Charon', name: 'Charon', description: 'A deep and authoritative male voice.' },
      { id: 'en-male-3', apiId: 'Fenrir', name: 'Fenrir', description: 'A mature and calm male voice.' },
    ]
  },
  zh: {
    female: [
      { id: 'zh-female-1', apiId: 'Kore', name: '小美 (Xiǎo Měi)', description: '标准女声，清晰甜美。' },
      { id: 'zh-female-2', apiId: 'Zephyr', name: '静怡 (Jìng Yí)', description: '温柔亲切的女声。' },
    ],
    male: [
      { id: 'zh-male-1', apiId: 'Puck', name: '浩然 (Hàorán)', description: '年轻活力的男声。' },
      { id: 'zh-male-2', apiId: 'Charon', name: '文博 (Wénbó)', description: '深沉稳重的男声。' },
    ]
  },
  es: {
    female: [{ id: 'es-female-1', apiId: 'Kore', name: 'Sofía', description: 'Voz femenina estándar y clara.' }],
    male: [{ id: 'es-male-1', apiId: 'Puck', name: 'Mateo', description: 'Voz masculina joven y enérgica.' }]
  },
  fr: {
    female: [{ id: 'fr-female-1', apiId: 'Kore', name: 'Chloé', description: 'Voix féminine standard et claire.' }],
    male: [{ id: 'fr-male-1', apiId: 'Puck', name: 'Lucas', description: 'Voix masculine jeune et énergique.' }]
  },
  de: {
    female: [{ id: 'de-female-1', apiId: 'Kore', name: 'Hanna', description: 'Standardmäßige, klare weibliche Stimme.' }],
    male: [{ id: 'de-male-1', apiId: 'Puck', name: 'Lukas', description: 'Junge und energische männliche Stimme.' }]
  },
  it: {
    female: [{ id: 'it-female-1', apiId: 'Kore', name: 'Sofia', description: 'Voce femminile standard e chiara.' }],
    male: [{ id: 'it-male-1', apiId: 'Puck', name: 'Leonardo', description: 'Voce maschile giovane ed energica.' }]
  },
  pt: {
    female: [{ id: 'pt-female-1', apiId: 'Kore', name: 'Alice', description: 'Voz feminina padrão e clara.' }],
    male: [{ id: 'pt-male-1', apiId: 'Puck', name: 'Miguel', description: 'Voz masculina jovem e energética.' }]
  },
  ru: {
    female: [{ id: 'ru-female-1', apiId: 'Kore', name: 'София (Sofia)', description: 'Стандартный, чистый женский голос.' }],
    male: [{ id: 'ru-male-1', apiId: 'Puck', name: 'Артём (Artyom)', description: 'Молодий и энергичный мужской голос.' }]
  },
  ja: {
    female: [{ id: 'ja-female-1', apiId: 'Kore', name: 'さくら (Sakura)', description: '標準的でクリアな女性の声。' }],
    male: [{ id: 'ja-male-1', apiId: 'Puck', name: 'ひろと (Hiroto)', description: '若々しくエネルギッシュな男性の声。' }]
  },
  ko: {
    female: [{ id: 'ko-female-1', apiId: 'Kore', name: '서아 (Seo-ah)', description: '표준적이고 선명한 여성 목소리.' }],
    male: [{ id: 'ko-male-1', apiId: 'Puck', name: '도윤 (Do-yun)', description: '젊고 활기찬 남성 목소리.' }]
  },
  ar: {
    female: [{ id: 'ar-female-1', apiId: 'Kore', name: 'فاطمة (Fatima)', description: 'صوت أنثوي قياسي وواضح.' }],
    male: [{ id: 'ar-male-1', apiId: 'Puck', name: 'محمد (Mohammed)', description: 'صوت ذكوري شاب وحيوي.' }]
  },
  hi: {
    female: [{ id: 'hi-female-1', apiId: 'Kore', name: 'साची (Sachi)', description: 'एक मानक, स्पष्ट महिला आवाज।' }],
    male: [{ id: 'hi-male-1', apiId: 'Puck', name: 'आरव (Aarav)', description: 'एक युवा और ऊर्जावान पुरुष आवाज।' }]
  },
  bn: {
    female: [{ id: 'bn-female-1', apiId: 'Kore', name: 'অনন্যা (Ananya)', description: 'একটি আদর্শ, স্পষ্ট মহিলা কণ্ঠস্বর।' }],
    male: [{ id: 'bn-male-1', apiId: 'Puck', name: 'আয়ান (Ayan)', description: 'একটি তরুণ এবং শক্তিশালী পুরুষ কণ্ঠস্বর।' }]
  },
  id: {
    female: [{ id: 'id-female-1', apiId: 'Kore', name: 'Adira', description: 'Suara wanita standar dan jelas.' }],
    male: [{ id: 'id-male-1', apiId: 'Puck', name: 'Bagas', description: 'Suara pria muda dan energik.' }]
  },
  tr: {
    female: [{ id: 'tr-female-1', apiId: 'Kore', name: 'Zeynep', description: 'Standart, net bir kadın sesi.' }],
    male: [{ id: 'tr-male-1', apiId: 'Puck', name: 'Yusuf', description: 'Genç ve enerjik bir erkek sesi.' }]
  },
  nl: {
    female: [{ id: 'nl-female-1', apiId: 'Kore', name: 'Emma', description: 'Een standaard, duidelijke vrouwenstem.' }],
    male: [{ id: 'nl-male-1', apiId: 'Puck', name: 'Noah', description: 'Een jeugdige en energieke mannenstem.' }]
  },
  pl: {
    female: [{ id: 'pl-female-1', apiId: 'Kore', name: 'Zuzanna', description: 'Standardowy, czysty głos kobiecy.' }],
    male: [{ id: 'pl-male-1', apiId: 'Puck', name: 'Antoni', description: 'Młody i energiczny głos męski.' }]
  },
  sv: {
    female: [{ id: 'sv-female-1', apiId: 'Kore', name: 'Alice', description: 'En standard, tydlig kvinnoröst.' }],
    male: [{ id: 'sv-male-1', apiId: 'Puck', name: 'William', description: 'En ungdomlig och energisk mansröst.' }]
  },
  no: {
    female: [{ id: 'no-female-1', apiId: 'Kore', name: 'Nora', description: 'En standard, klar kvinnestemme.' }],
    male: [{ id: 'no-male-1', apiId: 'Puck', name: 'Jakob', description: 'En ungdommelig og energisk mannsstemme.' }]
  },
  da: {
    female: [{ id: 'da-female-1', apiId: 'Kore', name: 'Ida', description: 'En standard, klar kvindestemme.' }],
    male: [{ id: 'da-male-1', apiId: 'Puck', name: 'William', description: 'En ungdommelig og energisk mandsstemme.' }]
  },
  fi: {
    female: [{ id: 'fi-female-1', apiId: 'Kore', name: 'Aino', description: 'Tavallinen, selkeä naisääni.' }],
    male: [{ id: 'fi-male-1', apiId: 'Puck', name: 'Leo', description: 'Nuorekas ja energinen miesääni.' }]
  },
  el: {
    female: [{ id: 'el-female-1', apiId: 'Kore', name: 'Μαρία (Maria)', description: 'Μια τυπική, καθαρή γυναικεία φωνή.' }],
    male: [{ id: 'el-male-1', apiId: 'Puck', name: 'Γιώργος (Giorgos)', description: 'Μια νεανική και ενεργητική ανδρική φωνή.' }]
  },
  cs: {
    female: [{ id: 'cs-female-1', apiId: 'Kore', name: 'Eliška', description: 'Standardní, čistý ženský hlas.' }],
    male: [{ id: 'cs-male-1', apiId: 'Puck', name: 'Jakub', description: 'Mladý a energický mužský hlas.' }]
  },
  hu: {
    female: [{ id: 'hu-female-1', apiId: 'Kore', name: 'Hanna', description: 'Standard, tiszta női hang.' }],
    male: [{ id: 'hu-male-1', apiId: 'Puck', name: 'Bence', description: 'Fiatalos és energikus férfihang.' }]
  },
  ro: {
    female: [{ id: 'ro-female-1', apiId: 'Kore', name: 'Maria', description: 'O voce feminină standard, clară.' }],
    male: [{ id: 'ro-male-1', apiId: 'Puck', name: 'Andrei', description: 'O voce masculină tânără și energică.' }]
  },
  th: {
    female: [{ id: 'th-female-1', apiId: 'Kore', name: 'มะลิ (Mali)', description: 'เสียงผู้หญิงมาตรฐานและชัดเจน' }],
    male: [{ id: 'th-male-1', apiId: 'Puck', name: 'อาร์ม (Arm)', description: 'เสียงผู้ชายที่อ่อนเยาว์และกระฉับกระเฉง' }]
  },
  he: {
    female: [{ id: 'he-female-1', apiId: 'Kore', name: 'תמר (Tamar)', description: 'קול נשי סטנדרטי וברור.' }],
    male: [{ id: 'he-male-1', apiId: 'Puck', name: 'דניאל (Daniel)', description: 'קול גברי צעיר ואנרגטי.' }]
  },
  uk: {
    female: [{ id: 'uk-female-1', apiId: 'Kore', name: 'Софія (Sofiia)', description: 'Стандартний, чистий жіночий голос.' }],
    male: [{ id: 'uk-male-1', apiId: 'Puck', name: 'Артем (Artem)', description: 'Молодий та енергійний чоловічий голос.' }]
  },
  ms: {
    female: [{ id: 'ms-female-1', apiId: 'Kore', name: 'Aisyah', description: 'Suara wanita yang standard dan jelas.' }],
    male: [{ id: 'ms-male-1', apiId: 'Puck', name: 'Adam', description: 'Suara lelaki yang muda dan bertenaga.' }]
  },
  fa: {
    female: [{ id: 'fa-female-1', apiId: 'Kore', name: 'فاطمه (Fatemeh)', description: 'صدای زنانه استاندارد و واضح.' }],
    male: [{ id: 'fa-male-1', apiId: 'Puck', name: 'امیرعلی (Amir Ali)', description: 'صدای مردانه جوان و پرانرژی.' }]
  },
  fil: {
    female: [{ id: 'fil-female-1', apiId: 'Kore', name: 'Althea', description: 'Isang standard at malinaw na boses ng babae.' }],
    male: [{ id: 'fil-male-1', apiId: 'Puck', name: 'Nathaniel', description: 'Isang bata at masiglang boses ng lalaki.' }]
  },
  af: {
    female: [{ id: 'af-female-1', apiId: 'Kore', name: 'Mia', description: "'n Standaard, duidelike vroulike stem." }],
    male: [{ id: 'af-male-1', apiId: 'Puck', name: 'Liam', description: "'n Jeugdige en energieke manlike stem." }]
  },
  bg: {
    female: [{ id: 'bg-female-1', apiId: 'Kore', name: 'Виктория (Viktoria)', description: 'Стандартен, ясен женски глас.' }],
    male: [{ id: 'bg-male-1', apiId: 'Puck', name: 'Александър (Aleksandar)', description: 'Младежки и енергичен мъжки глас.' }]
  },
  ca: {
    female: [{ id: 'ca-female-1', apiId: 'Kore', name: 'Júlia', description: 'Veu femenina estàndard i clara.' }],
    male: [{ id: 'ca-male-1', apiId: 'Puck', name: 'Marc', description: 'Veu masculina jove i energètica.' }]
  },
  hr: {
    female: [{ id: 'hr-female-1', apiId: 'Kore', name: 'Mia', description: 'Standardni, jasan ženski glas.' }],
    male: [{ id: 'hr-male-1', apiId: 'Puck', name: 'Luka', description: 'Mladenački i energičan muški glas.' }]
  },
  et: {
    female: [{ id: 'et-female-1', apiId: 'Kore', name: 'Mia', description: 'Standardne, selge naise hääl.' }],
    male: [{ id: 'et-male-1', apiId: 'Puck', name: 'Robin', description: 'Nooruslik ja energiline mehe hääl.' }]
  },
  gl: {
    female: [{ id: 'gl-female-1', apiId: 'Kore', name: 'Sofía', description: 'Unha voz feminina estándar e clara.' }],
    male: [{ id: 'gl-male-1', apiId: 'Puck', name: 'Mateo', description: 'Unha voz masculina xuvenil e enérxica.' }]
  },
  is: {
    female: [{ id: 'is-female-1', apiId: 'Kore', name: 'Embla', description: 'Stöðluð, skýr kvenrödd.' }],
    male: [{ id: 'is-male-1', apiId: 'Puck', name: 'Aron', description: 'Ungleg og kraftmikil karlmannsrödd.' }]
  },
  lt: {
    female: [{ id: 'lt-female-1', apiId: 'Kore', name: 'Emilija', description: 'Standartinis, aiškus moteriškas balsas.' }],
    male: [{ id: 'lt-male-1', apiId: 'Puck', name: 'Lukas', description: 'Jaunatviškas ir energingas vyriškas balsas.' }]
  },
  lv: {
    female: [{ id: 'lv-female-1', apiId: 'Kore', name: 'Sofija', description: 'Standarta, skaidra sieviešu balss.' }],
    male: [{ id: 'lv-male-1', apiId: 'Puck', name: 'Roberts', description: 'Jaunīga un enerģiska vīriešu balss.' }]
  },
  mk: {
    female: [{ id: 'mk-female-1', apiId: 'Kore', name: 'Јана (Jana)', description: 'Стандарден, јасен женски глас.' }],
    male: [{ id: 'mk-male-1', apiId: 'Puck', name: 'Лука (Luka)', description: 'Младешки и енергичен машки глас.' }]
  },
  sk: {
    female: [{ id: 'sk-female-1', apiId: 'Kore', name: 'Sofia', description: 'Štandardný, čistý ženský hlas.' }],
    male: [{ id: 'sk-male-1', apiId: 'Puck', name: 'Jakub', description: 'Mladý a energický mužský hlas.' }]
  },
  sl: {
    female: [{ id: 'sl-female-1', apiId: 'Kore', name: 'Ema', description: 'Standarden, jasen ženski glas.' }],
    male: [{ id: 'sl-male-1', apiId: 'Puck', name: 'Luka', description: 'Mladosten in energičen moški glas.' }]
  },
  sr: {
    female: [{ id: 'sr-female-1', apiId: 'Kore', name: 'Софија (Sofija)', description: 'Стандардан, јасан женски глас.' }],
    male: [{ id: 'sr-male-1', apiId: 'Puck', name: 'Лука (Luka)', description: 'Младалачки и енергичан мушки глас.' }]
  },
  sw: {
    female: [{ id: 'sw-female-1', apiId: 'Kore', name: 'Asha', description: 'Sauti ya kawaida na wazi ya kike.' }],
    male: [{ id: 'sw-male-1', apiId: 'Puck', name: 'Juma', description: 'Sauti ya kiume ya ujana na nguvu.' }]
  },
  ur: {
    female: [{ id: 'ur-female-1', apiId: 'Kore', name: 'فاطمہ (Fatima)', description: 'ایک معیاری، واضح زنانہ آواز۔' }],
    male: [{ id: 'ur-male-1', apiId: 'Puck', name: 'علی (Ali)', description: 'ایک جوان اور توانا مردانہ آواز۔' }]
  },
  gu: {
    female: [{ id: 'gu-female-1', apiId: 'Kore', name: 'આરાધ્યા (Aaradhya)', description: 'એક પ્રમાણભૂત, સ્પષ્ટ સ્ત્રી અવાજ.' }],
    male: [{ id: 'gu-male-1', apiId: 'Puck', name: 'આરવ (Aarav)', description: 'એક યુવાન અને મહેનતુ પુરુષ અવાજ.' }]
  },
  kn: {
    female: [{ id: 'kn-female-1', apiId: 'Kore', name: 'ಸಾನ್ವಿ (Saanvi)', description: 'ಒಂದು ಗುಣಮಟ್ಟದ, ಸ್ಪಷ್ಟವಾದ ಸ್ತ್ರೀ ಧ್ವನಿ.' }],
    male: [{ id: 'kn-male-1', apiId: 'Puck', name: 'ಆರವ್ (Aarav)', description: 'ಒಂದು ಯುವ ಮತ್ತು ಶಕ್ತಿಯುತ ಪುರುಷ ಧ್ವನಿ.' }]
  },
  ml: {
    female: [{ id: 'ml-female-1', apiId: 'Kore', name: 'ഇഷ (Isha)', description: 'ഒരു സാധാരണ, വ്യക്തമായ സ്ത്രീ ശബ്ദം.' }],
    male: [{ id: 'ml-male-1', apiId: 'Puck', name: 'ആരവ് (Aarav)', description: 'ചെറുപ്പവും ഊർജ്ജസ്വലവുമായ പുരുഷ ശബ്ദം.' }]
  },
  mr: {
    female: [{ id: 'mr-female-1', apiId: 'Kore', name: 'सान्वी (Saanvi)', description: 'एक मानक, स्पष्ट स्त्री आवाज.' }],
    male: [{ id: 'mr-male-1', apiId: 'Puck', name: 'आरव (Aarav)', description: 'एक तरुण आणि उत्साही पुरुष आवाज.' }]
  },
  ta: {
    female: [{ id: 'ta-female-1', apiId: 'Kore', name: 'இனியா (Iniya)', description: 'ஒரு நிலையான, தெளிவான பெண் குரல்.' }],
    male: [{ id: 'ta-male-1', apiId: 'Puck', name: 'ஆரவ் (Aarav)', description: 'ஒரு இளமையான மற்றும் ஆற்றல்மிக்க ஆண் குரல்.' }]
  },
  te: {
    female: [{ id: 'te-female-1', apiId: 'Kore', name: 'సాన్వి (Saanvi)', description: 'ఒక ప్రామాణిక, స్పష్టమైన మహిళా స్వరం.' }],
    male: [{ id: 'te-male-1', apiId: 'Puck', name: 'ఆరవ్ (Aarav)', description: 'ఒక యువ మరియు శక్తివంతమైన పురుష స్వరం.' }]
  },
  jv: {
    female: [{ id: 'jv-female-1', apiId: 'Kore', name: 'Sari', description: 'Swara wadon standar lan cetha.' }],
    male: [{ id: 'jv-male-1', apiId: 'Puck', name: 'Budi', description: 'Swara lanang enom lan energik.' }]
  }
};

const BANNED_WORDS = ["example_banned_word", "profanity"];
const TOKEN_PER_CHAR = 1;
const PRICE_PER_1K_TOKENS = 0.000015;

const SCENARIOS = [
    { name: "Kịch bản bán hàng", text: "Chỉ trong 30 giây, bạn sẽ hiểu tại sao sản phẩm này thay đổi cuộc sống của bạn. Hãy tưởng tượng một buổi sáng thức dậy tràn đầy năng lượng..." },
    { name: "Bản tin nhanh", text: "Bản tin AI hôm nay: Google vừa ra mắt mô hình mới... Đây là những gì bạn cần biết trong 60 giây tới." },
    { name: "Review phim", text: "Bộ phim bom tấn mới khiến khán giả đứng ngồi không yên. Ngay từ cảnh mở đầu, không khí hồi hộp đã bao trùm..." },
    { name: "Kể chuyện", text: "Ngày xửa ngày xưa, ở một vương quốc công nghệ, có một chú robot nhỏ bé mang trong mình ước mơ thay đổi thế giới..." },
];

export default function App() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState('vi');
  const [voiceId, setVoiceId] = useState<string>(VOICES_BY_LANGUAGE['vi'].female[0].id);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [isSSML, setIsSSML] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const charCount = text.length;
  const estTokens = useMemo(() => charCount * TOKEN_PER_CHAR, [charCount]);
  const estCost = useMemo(() => (estTokens / 1000) * PRICE_PER_1K_TOKENS, [estTokens]);

  const violations = useMemo(() => {
    const lowerText = text.toLowerCase();
    return BANNED_WORDS.filter(word => lowerText.includes(word));
  }, [text]);

  const selectedVoice = useMemo(() => {
    const allVoices = [
      ...VOICES_BY_LANGUAGE[language].female, 
      ...VOICES_BY_LANGUAGE[language].male
    ];
    return allVoices.find(v => v.id === voiceId)!;
  }, [voiceId, language]);

  const handleSynthesize = useCallback(async () => {
    if (!text.trim()) {
      setError("Please enter some text to synthesize.");
      return;
    }
    if (violations.length > 0) {
      setError(`Content contains banned words: ${violations.join(", ")}`);
      return;
    }

    setError(null);
    setLoading(true);
    setAudioUrl(null);

    try {
      const base64Audio = await generateSpeech({
        text,
        voiceId: selectedVoice.apiId,
        speed: isSSML ? 1.0 : speed,
        pitch: isSSML ? 0 : pitch,
        isSSML
      });
      const wavBlob = createWavBlob(base64Audio);
      const url = URL.createObjectURL(wavBlob);
      setAudioUrl(url);

      setTimeout(() => {
        audioRef.current?.play().catch(console.error);
      }, 100);

    } catch (e: any) {
      console.error(e);
      setError(e.message || "An error occurred while generating speech.");
    } finally {
      setLoading(false);
    }
  }, [text, selectedVoice, speed, pitch, isSSML, violations]);
  
  const handleDownload = useCallback(() => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `tts_${voiceId}_${new Date().toISOString()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [audioUrl, voiceId]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    const newLangVoices = VOICES_BY_LANGUAGE[newLang];
    const firstVoice = newLangVoices.female[0] || newLangVoices.male[0];
    if(firstVoice) {
      setVoiceId(firstVoice.id);
    }
  };

  // SSML Insertion Logic
  const applySSMLTag = (tagStart: string, tagEnd: string = '') => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const selectedText = currentText.substring(start, end);

    const newText = currentText.substring(0, start) +
                    tagStart + selectedText + tagEnd +
                    currentText.substring(end);

    setText(newText);
    setIsSSML(true); // Auto-enable SSML mode

    // Restore focus
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagStart.length, end + tagStart.length);
    }, 0);
  };

  const clearSSMLTags = () => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const selectedText = currentText.substring(start, end);
    
    // Regex to remove tags like <break/>, <emphasis>, </emphasis>
    const cleanSelection = selectedText.replace(/<\/?[^>]+(>|$)/g, "");

    const newText = currentText.substring(0, start) + cleanSelection + currentText.substring(end);
    setText(newText);
    
    setTimeout(() => {
       textarea.focus();
       textarea.setSelectionRange(start, start + cleanSelection.length);
    }, 0);
  };

  const { male: maleVoices, female: femaleVoices } = VOICES_BY_LANGUAGE[language];

  return (
    <div className="flex min-h-screen flex-col font-sans transition-colors duration-300 bg-gray-50 dark:bg-slate-950">
      
      {/* Header Bar */}
      <header className="border-b border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-800 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/80 dark:bg-slate-900/80">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand Left */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-center md:justify-start">
             <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-gray-200 dark:border-slate-700">
                <img 
                  src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/76jwxJS0DcAVoeVK00Z6/media/65019a9df30a7212a2e4c1d0.png" 
                  alt="Digital CEO Logo" 
                  className="h-full w-full object-contain rounded-md"
                />
             </div>
             <div className="text-left">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                  Digital CEO - Tuần Làm Việc 4h
                </h1>
                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">By Nam Trịnh</p>
             </div>
          </div>

          {/* Title Right */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-center md:justify-end">
             <div className="text-center md:text-right">
                <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                  CHUYỂN VĂN BẢN THÀNH GIỌNG NÓI
                </h2>
             </div>
             
             <div className="h-8 w-px bg-gray-300 dark:bg-slate-700 mx-2 hidden sm:block"></div>
             
             <button
                onClick={toggleTheme}
                className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-gray-200 hover:text-indigo-600 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700 dark:hover:text-yellow-300"
                aria-label="Toggle Dark Mode"
             >
                {isDarkMode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    </svg>
                )}
             </button>
          </div>
        </div>
      </header>

      <main className="flex-grow px-4 py-8">
        <div className="mx-auto max-w-5xl space-y-8">
          
          {/* Main Controls Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            
            {/* Settings Card */}
            <Card title="Cấu hình (Settings)" desc="Choose language, voice & effects" className="lg:col-span-1">
              <Field>
                <Label htmlFor="lang-select">Ngôn ngữ (Language)</Label>
                <Select id="lang-select" value={language} onChange={handleLanguageChange}>
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                  <option value="zh">中文 (Chinese)</option>
                  <option value="es">Español (Spanish)</option>
                  <option value="fr">Français (French)</option>
                  <option value="de">Deutsch (German)</option>
                  <option value="it">Italiano (Italian)</option>
                  <option value="pt">Português (Portuguese)</option>
                  <option value="ru">Русский (Russian)</option>
                  <option value="ja">日本語 (Japanese)</option>
                  <option value="ko">한국어 (Korean)</option>
                  <option value="ar">العربية (Arabic)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="bn">বাংলা (Bengali)</option>
                  <option value="id">Bahasa Indonesia (Indonesian)</option>
                  <option value="tr">Türkçe (Turkish)</option>
                  <option value="nl">Nederlands (Dutch)</option>
                  <option value="pl">Polski (Polish)</option>
                  <option value="sv">Svenska (Swedish)</option>
                  <option value="no">Norsk (Norwegian)</option>
                  <option value="da">Dansk (Danish)</option>
                  <option value="fi">Suomi (Finnish)</option>
                  <option value="el">Ελληνικά (Greek)</option>
                  <option value="cs">Čeština (Czech)</option>
                  <option value="hu">Magyar (Hungarian)</option>
                  <option value="ro">Română (Romanian)</option>
                  <option value="th">ไทย (Thai)</option>
                  <option value="he">עברית (Hebrew)</option>
                  <option value="uk">Українська (Ukrainian)</option>
                  <option value="ms">Bahasa Melayu (Malay)</option>
                  <option value="fa">فارسی (Persian)</option>
                  <option value="fil">Filipino</option>
                  <option value="af">Afrikaans</option>
                  <option value="bg">Български (Bulgarian)</option>
                  <option value="ca">Català (Catalan)</option>
                  <option value="hr">Hrvatski (Croatian)</option>
                  <option value="et">Eesti (Estonian)</option>
                  <option value="gl">Galego (Galician)</option>
                  <option value="is">Íslenska (Icelandic)</option>
                  <option value="lt">Lietuvių (Lithuanian)</option>
                  <option value="lv">Latviešu (Latvian)</option>
                  <option value="mk">Македонски (Macedonian)</option>
                  <option value="sk">Slovenčina (Slovenian)</option>
                  <option value="sl">Slovenščina (Slovenian)</option>
                  <option value="sr">Српски (Serbian)</option>
                  <option value="sw">Kiswahili (Swahili)</option>
                  <option value="ur">اردو (Urdu)</option>
                  <option value="gu">ગુજરાતી (Gujarati)</option>
                  <option value="kn">ಕನ್ನಡ (Kannada)</option>
                  <option value="ml">മലയാളം (Malayalam)</option>
                  <option value="mr">मराठी (Marathi)</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                  <option value="te">తెలుగు (Telugu)</option>
                  <option value="jv">Basa Jawa (Javanese)</option>
                </Select>
              </Field>
              
              <Field>
                <Label htmlFor="voice-select">Giọng đọc (Voice)</Label>
                <Select
                  id="voice-select"
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                >
                  {femaleVoices.length > 0 && (
                    <optgroup label="Giọng nữ">
                      {femaleVoices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {maleVoices.length > 0 && (
                    <optgroup label="Giọng nam">
                      {maleVoices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>
                {selectedVoice && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                    {selectedVoice.description}
                  </p>
                )}
              </Field>

              <Field>
                <Label htmlFor="speed-range">Tốc độ (Speed): {speed.toFixed(2)}x</Label>
                <input 
                  id="speed-range" 
                  type="range" 
                  min={0.5} 
                  max={2} 
                  step={0.01} 
                  value={speed} 
                  onChange={e => setSpeed(parseFloat(e.target.value))} 
                  className="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                  disabled={isSSML}
                />
              </Field>
              <Field>
                <Label htmlFor="pitch-range">Cao độ (Pitch): {pitch} semitones</Label>
                <input 
                  id="pitch-range" 
                  type="range" 
                  min={-12} 
                  max={12} 
                  step={1} 
                  value={pitch} 
                  onChange={e => setPitch(parseInt(e.target.value))} 
                  className="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                  disabled={isSSML}
                />
              </Field>
              <div className="flex items-center gap-2 mt-4 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700">
                <input 
                  id="ssml-checkbox" 
                  type="checkbox" 
                  checked={isSSML} 
                  onChange={e => setIsSSML(e.target.checked)} 
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="ssml-checkbox" className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable SSML Mode</label>
              </div>
               {isSSML && <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-400">Speed and Pitch controls are disabled when SSML is active.</p>}
            </Card>

            {/* Content & Action Area */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Card title="Nội dung (Content)" desc="Enter plain text or use the toolbar for SSML" className="flex-1">
                {/* SSML Toolbar */}
                <div className="mb-2 flex flex-wrap gap-1 p-2 bg-gray-100 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700">
                  <div className="flex gap-1 pr-2 border-r border-gray-300 dark:border-slate-600">
                    <Button variant="ghost" size="sm" onClick={() => applySSMLTag('<break time="500ms"/>')} title="Pause 0.5s">
                       ⏸️ 0.5s
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => applySSMLTag('<break time="1000ms"/>')} title="Pause 1s">
                       ⏸️ 1s
                    </Button>
                  </div>
                  <div className="flex gap-1 px-2 border-r border-gray-300 dark:border-slate-600">
                     <Button variant="ghost" size="sm" onClick={() => applySSMLTag('<emphasis level="strong">', '</emphasis>')} title="Strong Emphasis">
                       💪 Mạnh
                     </Button>
                     <Button variant="ghost" size="sm" onClick={() => applySSMLTag('<emphasis level="moderate">', '</emphasis>')} title="Moderate Emphasis">
                       👌 Vừa
                     </Button>
                  </div>
                  <div className="flex gap-1 px-2 border-r border-gray-300 dark:border-slate-600">
                     <Button variant="ghost" size="sm" onClick={() => applySSMLTag('<prosody rate="fast">', '</prosody>')} title="Speak Fast">
                       🐇 Nhanh
                     </Button>
                     <Button variant="ghost" size="sm" onClick={() => applySSMLTag('<prosody rate="slow">', '</prosody>')} title="Speak Slow">
                       🐢 Chậm
                     </Button>
                  </div>
                  <div className="flex gap-1 pl-2">
                     <Button variant="ghost" size="sm" onClick={clearSSMLTags} title="Clear Effects" className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                        ✖️ Xóa hiệu ứng
                     </Button>
                  </div>
                </div>

                <textarea
                  ref={textAreaRef}
                  className="h-64 w-full resize-none rounded-lg border border-gray-300 p-4 text-sm font-mono leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-600 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400 transition-colors"
                  placeholder={isSSML ? '<speak>Hello <emphasis>world</emphasis>!</speak>' : "Nhập văn bản bạn muốn chuyển thành giọng nói tại đây..."}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex gap-4">
                    <span>Characters: <span className="font-medium text-gray-700 dark:text-gray-200">{charCount.toLocaleString()}</span></span>
                  </div>
                  <span>Est. Cost: <span className="font-medium text-gray-700 dark:text-gray-200">~${estCost.toFixed(6)}</span></span>
                </div>
                {violations.length > 0 && (
                  <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    <span className="font-bold">Warning:</span> Banned words detected - {violations.join(", ")}
                  </p>
                )}
              </Card>

              <Card title="Kết quả (Result)" className="flex-none">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="flex gap-3 w-full sm:w-auto">
                    <Button onClick={handleSynthesize} disabled={loading || !text.trim()} loading={loading} className="w-full sm:w-auto">
                      Generate Speech
                    </Button>
                    <Button onClick={handleDownload} disabled={!audioUrl} variant="outline" className="w-full sm:w-auto">
                      Download WAV
                    </Button>
                  </div>
                  {audioUrl && (
                     <div className="w-full sm:w-1/2">
                       <audio ref={audioRef} src={audioUrl} controls className="w-full h-10 block" />
                     </div>
                  )}
                </div>
                
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 dark:bg-red-900/10 dark:border-red-900/20 dark:text-red-400">
                    {error}
                  </div>
                )}
                
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-700">
                   <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Help Tips</p>
                   <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc list-inside">
                      <li>Select text and click toolbar buttons to apply effects.</li>
                      <li>Use "Xóa hiệu ứng" to remove SSML tags from selected text.</li>
                      <li>Enable "SSML Mode" is automatic when using the toolbar.</li>
                   </ul>
                </div>
              </Card>
            </div>
          </div>

          <Card title="Kịch bản mẫu (Quick Scenarios)" desc="Start fast with pre-written templates">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {SCENARIOS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setText(p.text)}
                  className="group relative rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:border-indigo-300 hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-700 dark:hover:border-indigo-500"
                >
                  <div className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-1">{p.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{p.text}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </main>

      <footer className="mt-auto border-t border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-800 py-8 text-center transition-colors">
        <a 
          href="https://tuanlamviec4h.com/checkvar" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="inline-flex items-center gap-2 text-lg font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline transition-all"
        >
          Digital CEO - Tuần Làm Việc 4h
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </a>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
          &copy; {new Date().getFullYear()} Nam Trịnh. All rights reserved.
        </p>
      </footer>
    </div>
  );
}