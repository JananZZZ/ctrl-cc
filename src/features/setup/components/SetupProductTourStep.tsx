import '../styles/first-run-setup.css';

/**
 * 首次启动产品介绍步骤。
 * 文案必须面向小白用户，避免过度技术化。
 */
export function SetupProductTourStep() {
  return (
    <div className="setup-step-panel">
      <h1>Ctrl-CC 是怎么工作的？</h1>

      <p className="cc-body-sm">
        你可以把 Ctrl-CC 理解成 Claude Code CLI 的图形化控制台。它会在后台启动 Claude Code CLI，
        然后把聊天、终端、项目、资源、GitHub、AI 工作坞统一连接起来。
      </p>

      <div className="setup-tour-grid">
        <div className="cc-card setup-tour-card">
          <span className="setup-tour-icon">💬</span>
          <h3>Chat 聊天</h3>
          <p>适合新手，像普通聊天软件一样发送问题、查看回复。支持 Markdown、代码高亮和实时流式输出。</p>
        </div>

        <div className="cc-card setup-tour-card">
          <span className="setup-tour-icon">⌨️</span>
          <h3>Terminal 终端</h3>
          <p>适合高级用户，查看 Claude Code CLI 的完整原始输出。支持所有终端操作和快捷键。</p>
        </div>

        <div className="cc-card setup-tour-card">
          <span className="setup-tour-icon">📁</span>
          <h3>Projects 项目</h3>
          <p>把每个代码项目、会话、路径、Git 状态统一管理。支持多项目切换和会话历史。</p>
        </div>

        <div className="cc-card setup-tour-card">
          <span className="setup-tour-icon">🛟</span>
          <h3>AI 工作坞</h3>
          <p>在屏幕侧边显示后台任务、审批请求、风险和提醒。不打断你的工作流。</p>
        </div>
      </div>
    </div>
  );
}
