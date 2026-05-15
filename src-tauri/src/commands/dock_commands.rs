use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub fn open_ai_dock(app: AppHandle) -> Result<(), String> {
    // If dock already exists, focus it
    if let Some(window) = app.get_webview_window("ai-dock") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(&app, "ai-dock", WebviewUrl::App("index.html".into()))
        .title("Ctrl-CC AI Dock")
        .inner_size(420.0, 720.0)
        .min_inner_size(320.0, 400.0)
        .decorations(true)
        .always_on_top(false)
        .resizable(true)
        .visible(true)
        .build()
        .map_err(|e| format!("Failed to create AI Dock window: {}", e))?;

    window.set_focus().map_err(|e| e.to_string())?;

    let _ = app.emit("dock://status", serde_json::json!({"open": true}));
    Ok(())
}

#[tauri::command]
pub fn close_ai_dock(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("ai-dock") {
        window.close().map_err(|e| e.to_string())?;
    }
    let _ = app.emit("dock://status", serde_json::json!({"open": false}));
    Ok(())
}

#[tauri::command]
pub fn toggle_ai_dock(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("ai-dock") {
        let visible = window.is_visible().unwrap_or(false);
        if visible {
            window.hide().map_err(|e| e.to_string())?;
            let _ = app.emit("dock://status", serde_json::json!({"open": false}));
            Ok(false)
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            let _ = app.emit("dock://status", serde_json::json!({"open": true}));
            Ok(true)
        }
    } else {
        drop(app.clone());
        open_ai_dock(app)?;
        Ok(true)
    }
}

#[tauri::command]
pub fn get_dock_status(app: AppHandle) -> serde_json::Value {
    if let Some(window) = app.get_webview_window("ai-dock") {
        let visible = window.is_visible().unwrap_or(false);
        serde_json::json!({"open": true, "visible": visible})
    } else {
        serde_json::json!({"open": false, "visible": false})
    }
}
