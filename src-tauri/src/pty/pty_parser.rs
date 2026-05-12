use crate::pty::pty_types::*;

pub struct PtySemanticParser {
    buffer: String,
    in_permission_prompt: bool,
    lower_cache: String,
    session_id: String,
}

impl PtySemanticParser {
    pub fn new() -> Self {
        Self {
            buffer: String::with_capacity(8192),
            in_permission_prompt: false,
            lower_cache: String::with_capacity(8192),
            session_id: String::new(),
        }
    }

    pub fn set_session_id(&mut self, id: &str) {
        self.session_id = id.to_string();
    }

    /// Feed raw UTF-8 text into the parser. Returns an event if something was recognized.
    /// Best-effort: unrecognized output is silently passed through (not discarded).
    pub fn feed(&mut self, text: &str) -> Option<PtySemanticEvent> {
        self.buffer.push_str(text);
        self.lower_cache = self.buffer.to_lowercase();

        // Keep buffer bounded
        if self.buffer.len() > 16384 {
            let drain_point = self.buffer.len() - 8192;
            self.buffer = self.buffer[drain_point..].to_string();
            self.lower_cache = self.buffer.to_lowercase();
        }

        // Pattern 1: Permission prompt detection
        if self.detect_permission_prompt() {
            self.in_permission_prompt = true;
            return Some(PtySemanticEvent::new(
                String::new(),
                PtyEventType::PermissionRequested,
                "Claude requires permission to proceed".into(),
                RiskLevel::Medium,
            ));
        }

        // Pattern 2: Tool call / Bash command
        if let Some(event) = self.detect_tool_call() {
            return Some(event);
        }

        // Pattern 3: File edit
        if let Some(event) = self.detect_file_edit() {
            return Some(event);
        }

        // Pattern 4: Error detection
        if self.detect_error() {
            return Some(PtySemanticEvent::new(
                String::new(),
                PtyEventType::Error,
                "Claude encountered an error".into(),
                RiskLevel::High,
            ));
        }

        // Pattern 5: Completion / Summary
        if self.detect_completion() {
            return Some(PtySemanticEvent::new(
                String::new(),
                PtyEventType::Summary,
                "Task completed".into(),
                RiskLevel::Low,
            ));
        }

        // Pattern 6: Session initialized (detect session_id in output)
        if let Some(event) = self.detect_session_init() {
            return Some(event);
        }

        // Pattern 7: Danger command detection
        if self.detect_danger_command() {
            return Some(PtySemanticEvent::new(
                String::new(),
                PtyEventType::CommandStarted,
                "Dangerous command detected".into(),
                RiskLevel::Critical,
            ));
        }

        None
    }

    fn make_event(&self, event_type: PtyEventType, content: String, risk_level: RiskLevel) -> PtySemanticEvent {
        let mut e = PtySemanticEvent::new(self.session_id.clone(), event_type, content, risk_level);
        e.timestamp = chrono::Utc::now().to_rfc3339();
        e
    }

    fn detect_permission_prompt(&self) -> bool {
        if self.in_permission_prompt { return false; }
        self.lower_cache.contains("do you want to proceed")
            || self.lower_cache.contains("permission required")
            || (self.lower_cache.contains("[y/n]") && self.lower_cache.contains("allow"))
            || self.lower_cache.contains("approve this operation")
    }

    fn detect_tool_call(&self) -> Option<PtySemanticEvent> {
        let lines: Vec<&str> = self.buffer.lines().collect();
        if let Some(last) = lines.last() {
            let trimmed = last.trim();
            if trimmed.starts_with("Tool:") || trimmed.starts_with("●") || trimmed.contains("tool_use") {
                return Some(self.make_event(PtyEventType::CommandStarted, trimmed.to_string(), RiskLevel::Low));
            }
            if trimmed.starts_with("$ ") || trimmed.starts_with("> ") {
                return Some(self.make_event(PtyEventType::CommandStarted, trimmed.to_string(), RiskLevel::Low));
            }
        }
        None
    }

    fn detect_file_edit(&self) -> Option<PtySemanticEvent> {
        let content = self.buffer.clone();
        let ext_pattern = self.lower_cache.contains(".ts") || self.lower_cache.contains(".rs")
            || self.lower_cache.contains(".js") || self.lower_cache.contains(".py")
            || self.lower_cache.contains(".tsx") || self.lower_cache.contains(".jsx")
            || self.lower_cache.contains(".go") || self.lower_cache.contains(".java");
        if self.lower_cache.contains("edited") && ext_pattern {
            return Some(self.make_event(PtyEventType::FileEdited, content, RiskLevel::Low));
        }
        if self.lower_cache.contains("created") && ext_pattern {
            return Some(self.make_event(PtyEventType::FileCreated, content, RiskLevel::Low));
        }
        if self.lower_cache.contains("deleted") && ext_pattern {
            return Some(self.make_event(PtyEventType::FileDeleted, content, RiskLevel::Low));
        }
        None
    }

    fn detect_error(&self) -> bool {
        (self.lower_cache.contains("error:") || self.lower_cache.contains("error in"))
            && !self.lower_cache.contains("to fix this error")
    }

    fn detect_completion(&self) -> bool {
        self.lower_cache.contains("done")
            || self.lower_cache.contains("completed successfully")
            || self.lower_cache.contains("task complete")
    }

    fn detect_session_init(&self) -> Option<PtySemanticEvent> {
        // Simple UUID-like pattern: 8-4-4-4-12 hex chars, within first 500 chars
        if self.buffer.len() > 500 { return None; }
        let has_uuid = self.buffer.split(|c: char| !c.is_ascii_hexdigit() && c != '-')
            .any(|seg| seg.len() == 36 && seg.chars().filter(|&c| c == '-').count() == 4);
        if has_uuid {
            return Some(self.make_event(PtyEventType::SessionInitialized, self.buffer.clone(), RiskLevel::Low));
        }
        None
    }

    fn detect_danger_command(&self) -> bool {
        self.lower_cache.contains("rm -rf")
            || self.lower_cache.contains("del /s")
            || self.lower_cache.contains("git reset --hard")
            || self.lower_cache.contains("git push --force")
            || self.lower_cache.contains("git clean -fd")
    }

    /// Explicit reset after event emission.
    #[allow(dead_code)]
    pub fn reset(&mut self) {
        self.buffer.clear();
        self.lower_cache.clear();
        self.in_permission_prompt = false;
    }

    #[allow(dead_code)]
    pub fn buffer_len(&self) -> usize {
        self.buffer.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn new_parser() -> PtySemanticParser {
        let mut p = PtySemanticParser::new();
        p.set_session_id("test-session");
        p
    }

    #[test]
    fn detects_permission_prompt() {
        let mut parser = new_parser();
        let event = parser.feed("Do you want to proceed? [y/n]");
        assert!(event.is_some());
        assert_eq!(event.unwrap().event_type, PtyEventType::PermissionRequested);
    }

    #[test]
    fn detects_tool_call() {
        let mut parser = new_parser();
        let event = parser.feed("Tool: Read src/main.rs");
        assert!(event.is_some());
        assert_eq!(event.unwrap().event_type, PtyEventType::CommandStarted);
    }

    #[test]
    fn detects_danger_command() {
        let mut parser = new_parser();
        let event = parser.feed("rm -rf /tmp/test");
        assert!(event.is_some());
        assert_eq!(event.unwrap().risk_level, RiskLevel::Critical);
    }

    #[test]
    fn detects_file_edit() {
        let mut parser = new_parser();
        let event = parser.feed("Edited src/auth/handler.ts\n  +23 lines\n  -5 lines");
        assert!(event.is_some());
        assert_eq!(event.unwrap().event_type, PtyEventType::FileEdited);
    }

    #[test]
    fn handles_empty_input() {
        let mut parser = new_parser();
        let event = parser.feed("");
        assert!(event.is_none());
    }

    #[test]
    fn no_false_permission_on_second_call() {
        let mut parser = new_parser();
        let e1 = parser.feed("Do you want to proceed? [y/n]");
        assert!(e1.is_some());
        parser.reset();
        let e2 = parser.feed("Do you want to proceed? [y/n]");
        assert!(e2.is_some());
    }

    #[test]
    fn buffer_truncates_when_large() {
        let mut parser = new_parser();
        let big_text = "a".repeat(20000);
        parser.feed(&big_text);
        assert!(parser.buffer_len() <= 16384);
    }

    #[test]
    fn event_has_session_id() {
        let mut parser = new_parser();
        let event = parser.feed("Tool: Read src/main.rs");
        assert!(event.is_some());
        assert_eq!(event.unwrap().session_id, "test-session");
    }
}
