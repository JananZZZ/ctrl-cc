export interface ClaudeSettingsEnv {
  ANTHROPIC_AUTH_TOKEN?: string;
  ANTHROPIC_BASE_URL?: string;
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC?: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL?: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL?: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL?: string;
}

export interface ClaudeSettings {
  env?: ClaudeSettingsEnv;
  permissions?: Record<string, unknown>;
  mcpServers?: Record<string, unknown>;
}

export class ClaudeCodeSettings {
  async read(): Promise<ClaudeSettings> {
    const { invokeCommand } = await import('../../services/invokeCommand');
    try {
      return await invokeCommand<ClaudeSettings>('setup_read_provider_config_safe');
    } catch {
      return {};
    }
  }

  async write(settings: Partial<ClaudeSettings>): Promise<void> {
    const { invokeCommand } = await import('../../services/invokeCommand');
    await invokeCommand('setup_write_provider_config', { req: settings });
  }

  static providerPresets(): Record<string, { label: string; baseUrl: string; models: string[] }> {
    return {
      anthropic: { label: '官方 Anthropic', baseUrl: 'https://api.anthropic.com', models: ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-7'] },
      deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'] },
      zhipu: { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-flash', 'glm-4-plus'] },
      minimax: { label: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', models: ['abab6.5s-chat', 'abab7-chat'] },
      qwen: { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'] },
    };
  }
}
