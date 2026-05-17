/// v29: Claude CLI 输出分类器
/// 识别 Claude CLI 原始输出中的事件类型

/// 输出行分类
#[derive(Debug, PartialEq)]
pub enum OutputKind {
    Thinking,
    ToolUse,
    Permission,
    FileChange,
    Status,
    Plain,
}

/// 根据输出内容分类
pub fn classify_output(_line: &str) -> OutputKind {
    // v29: 基础分类逻辑
    // 后续可扩展为基于 JSON stream 的精确分类
    OutputKind::Plain
}
