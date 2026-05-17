import '../styles/first-run-setup.css';

/**
 * 首次启动 Chat / Dock / 权限设置。
 * 这些设置先保存在 localStorage，后续可迁移到数据库。
 */
export function SetupChatDockPermissionStep() {
  return (
    <div className="setup-step-panel">
      <h1>选择你的默认工作方式</h1>

      <p className="cc-body-sm">
        这些选项会影响新建会话时的默认体验。你以后可以在设置页随时修改。
      </p>

      <div className="setup-config-grid">
        <label className="setup-field">
          <span>默认打开视图</span>
          <select
            defaultValue={localStorage.getItem('ctrlcc.defaultViewMode') || 'chat'}
            onChange={(event) => localStorage.setItem('ctrlcc.defaultViewMode', event.target.value)}
          >
            <option value="chat">Chat 气泡聊天（推荐）</option>
            <option value="split">Chat + Terminal 分屏</option>
            <option value="terminal">Terminal 终端</option>
          </select>
        </label>

        <label className="setup-field">
          <span>默认模型</span>
          <select
            defaultValue={localStorage.getItem('ctrl-cc-model') || 'sonnet'}
            onChange={(event) => localStorage.setItem('ctrl-cc-model', event.target.value)}
          >
            <option value="sonnet">Sonnet（推荐）</option>
            <option value="opus">Opus</option>
            <option value="haiku">Haiku</option>
          </select>
        </label>

        <label className="setup-field">
          <span>默认权限策略</span>
          <select
            defaultValue={localStorage.getItem('ctrl-cc-permMode') || 'default'}
            onChange={(event) => localStorage.setItem('ctrl-cc-permMode', event.target.value)}
          >
            <option value="default">默认：危险操作前询问</option>
            <option value="plan">计划模式：先规划再执行</option>
            <option value="acceptEdits">自动接受编辑</option>
          </select>
        </label>

        <label className="setup-field">
          <span>AI 工作坞</span>
          <select
            defaultValue={localStorage.getItem('ctrlcc.aiDock.mode') || 'focus'}
            onChange={(event) => localStorage.setItem('ctrlcc.aiDock.mode', event.target.value)}
          >
            <option value="focus">聚焦模式：完整显示任务与审批</option>
            <option value="calm">舒缓模式：只显示关键提醒</option>
            <option value="quiet">安静模式：仅显示边缘状态条</option>
            <option value="disabled">暂不启用</option>
          </select>
        </label>
      </div>

      <div className="setup-friendly-note">
        如果你不确定怎么选，保持默认即可。默认配置会尽量安全、稳定、适合新手。
      </div>
    </div>
  );
}
