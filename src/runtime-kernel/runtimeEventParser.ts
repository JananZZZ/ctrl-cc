// v28: Deprecated — chat projection is now handled by parsers/chatProjection.ts
// Kept as a re-export for backward compat during migration.

export { projectRawToChat as runtimeKernelEventToChatEvents } from './parsers/chatProjection';
export { stripAnsi } from './parsers/ansi';
