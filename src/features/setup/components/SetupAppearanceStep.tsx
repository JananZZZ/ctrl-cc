import { useAppearanceStore, type CtrlCcTheme } from '../../../core/settings/appearanceStore';
import '../styles/first-run-setup.css';

const THEMES: { id: CtrlCcTheme; name: string; desc: string; colors: string[] }[] = [
  {
    id: 'light',
    name: '浅色',
    desc: '清爽、明亮、适合日常办公和长时间使用。',
    colors: ['#F7F8FA', '#FFFFFF', '#2563EB', '#111827'],
  },
  {
    id: 'dark',
    name: '深色',
    desc: '沉稳、低光、适合夜间工作和沉浸式代码任务。',
    colors: ['#0B0E14', '#151B26', '#8B5CF6', '#F3F6FB'],
  },
  {
    id: 'pale-blue',
    name: '浅蓝',
    desc: '清澈、理性、科技感更强，适合仪表盘和项目管理。',
    colors: ['#F2F7FD', '#FFFFFF', '#2F80ED', '#142033'],
  },
  {
    id: 'warm-sand',
    name: '暖沙',
    desc: '温和、纸张感、适合长时间阅读和舒缓工作。',
    colors: ['#FAF6EF', '#FFFDF8', '#B77945', '#241A10'],
  },
];

/**
 * 首次启动外观设置步骤。
 * 默认中文 + 默认浅色，但允许用户立刻切换。
 */
export function SetupAppearanceStep() {
  const theme = useAppearanceStore((s) => s.theme);
  const setTheme = useAppearanceStore((s) => s.setTheme);
  const language = useAppearanceStore((s) => s.language);
  const setLanguage = useAppearanceStore((s) => s.setLanguage);
  const fontScale = useAppearanceStore((s) => s.fontScale);
  const setFontScale = useAppearanceStore((s) => s.setFontScale);

  return (
    <div className="setup-step-panel">
      <h1>先把界面调成你喜欢的样子</h1>
      <p className="cc-body-sm">
        Ctrl-CC 默认使用中文和浅色主题。你可以现在修改，也可以以后在设置页随时修改。
      </p>

      <section className="setup-option-section">
        <h3>语言</h3>
        <div className="setup-button-row">
          <button
            className={language === 'zh' ? 'cc-btn cc-btn-primary' : 'cc-btn cc-btn-soft'}
            onClick={() => setLanguage('zh')}
          >
            中文
          </button>
          <button
            className={language === 'en' ? 'cc-btn cc-btn-primary' : 'cc-btn cc-btn-soft'}
            onClick={() => setLanguage('en')}
          >
            English
          </button>
        </div>
      </section>

      <section className="setup-option-section">
        <h3>主题配色</h3>
        <div className="setup-theme-grid">
          {THEMES.map((item) => (
            <button
              key={item.id}
              className={theme === item.id ? 'setup-theme-card is-selected' : 'setup-theme-card'}
              onClick={() => setTheme(item.id)}
            >
              <div className="setup-theme-swatches">
                {item.colors.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </div>
              <strong>{item.name}</strong>
              <p>{item.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="setup-option-section">
        <h3>字体大小</h3>
        <p className="cc-body-sm">
          建议保持默认。如果你觉得文字偏小，可以稍微调大。我们会把字体大小应用到整个软件。
        </p>
        <input
          type="range"
          min={0.9}
          max={1.25}
          step={0.05}
          value={fontScale}
          onChange={(event) => setFontScale(Number(event.target.value))}
          className="setup-font-slider"
        />
        <div className="setup-font-preview" style={{ fontSize: `calc(15px * ${fontScale})` }}>
          当前字号预览：你好，欢迎使用 Ctrl-CC。这里是正文、按钮、说明文字的综合效果。
        </div>
      </section>
    </div>
  );
}
