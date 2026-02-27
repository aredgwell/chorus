#![allow(unexpected_cfgs)]
#![allow(clippy::unused_unit)]

#[cfg(target_os = "macos")]
use tauri_nspanel::{
    tauri_panel, PanelHandle, PanelLevel, StyleMask,
    WebviewWindowExt as PanelWebviewWindowExt,
};

#[cfg(target_os = "macos")]
use objc2_app_kit::{NSAppearance, NSAppearanceCustomization};

use tauri::{Emitter, Manager, WebviewWindow};
use window_vibrancy::*;

// Define the panel class and event handler using v2.1 macro
#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(SpotlightPanel {
        config: {
            can_become_key_window: true,
            can_become_main_window: false,
            is_floating_panel: true
        }
    })

    panel_event!(SpotlightPanelDelegate {
        window_did_become_key(notification: &NSNotification) -> (),
        window_did_resign_key(notification: &NSNotification) -> ()
    })
}

#[cfg(target_os = "macos")]
pub fn update_panel_theme(window: &WebviewWindow, is_dark_mode: bool) {
    if let Ok(handle) = window.ns_window() {
        unsafe {
            let handle = handle as *mut objc2::runtime::AnyObject;
            let ns_window = &*(handle as *const objc2_app_kit::NSWindow);
            let appearance_name = objc2_foundation::NSString::from_str(if is_dark_mode {
                "NSAppearanceNameDarkAqua"
            } else {
                "NSAppearanceNameAqua"
            });
            if let Some(appearance) = NSAppearance::appearanceNamed(&appearance_name) {
                ns_window.setAppearance(Some(&appearance));
            }
        }
    }
}

#[cfg(target_os = "macos")]
pub fn setup_spotlight_panel(
    window: &WebviewWindow,
    is_dark_mode: bool,
) -> tauri::Result<PanelHandle<tauri::Wry>> {
    apply_vibrancy(
        window,
        NSVisualEffectMaterial::Popover,
        Some(NSVisualEffectState::Active),
        Some(12.0),
    )
    .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

    // Set initial theme appearance
    update_panel_theme(window, is_dark_mode);

    // Convert window to panel
    let panel = window.to_panel::<SpotlightPanel>()?;

    panel.set_level(PanelLevel::Status.into());

    panel.set_style_mask(
        StyleMask::empty()
            .nonactivating_panel()
            .resizable()
            .into(),
    );

    // Use raw bit flags matching the old working configuration:
    // CanJoinAllSpaces(1<<0) | Transient(1<<3) | Stationary(1<<4) |
    // IgnoresCycle(1<<6) | FullScreenAuxiliary(1<<8)
    let behavior_bits: usize = (1 << 0) | (1 << 3) | (1 << 4) | (1 << 6) | (1 << 8);
    panel.set_collection_behavior(
        objc2_app_kit::NSWindowCollectionBehavior::from_bits_retain(behavior_bits),
    );

    panel.set_hides_on_deactivate(false);

    let ns_panel = panel.as_panel();
    let max_size = objc2_foundation::NSSize::new(900.0, 1200.0);
    let min_size = objc2_foundation::NSSize::new(300.0, 200.0);
    ns_panel.setMaxSize(max_size);
    ns_panel.setMinSize(min_size);

    let handler = SpotlightPanelDelegate::new();

    let app_handle = window.app_handle().clone();
    let label = window.label().to_string();

    let app_handle_key = app_handle.clone();
    let label_key = label.clone();

    handler.window_did_become_key(move |_notification| {
        let _ = app_handle_key.emit(
            format!("{}_panel_did_become_key", label_key).as_str(),
            (),
        );
    });

    handler.window_did_resign_key(move |_notification| {
        let _ = app_handle.emit(
            format!("{}_panel_did_resign_key", label).as_str(),
            (),
        );
    });

    panel.set_event_handler(Some(handler.as_ref()));

    Ok(panel)
}
