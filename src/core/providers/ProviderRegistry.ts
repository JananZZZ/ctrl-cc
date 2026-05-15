import type { ChatRuntime } from '../runtime/ChatRuntime';

export interface ProviderCapabilities {
  chat: boolean;
  terminal: boolean;
  resume: boolean;
  fork: boolean;
  mcp: boolean;
  skills: boolean;
  planMode: boolean;
  inlineEdit: boolean;
}

export interface ProviderDefinition {
  id: string;
  label: string;
  createRuntime(): ChatRuntime;
  capabilities: ProviderCapabilities;
}

export class ProviderRegistry {
  private providers = new Map<string, ProviderDefinition>();

  register(provider: ProviderDefinition) {
    this.providers.set(provider.id, provider);
  }

  get(id: string): ProviderDefinition {
    const p = this.providers.get(id);
    if (!p) throw new Error(`Provider not found: ${id}`);
    return p;
  }

  list(): ProviderDefinition[] {
    return Array.from(this.providers.values());
  }
}

export const providerRegistry = new ProviderRegistry();
