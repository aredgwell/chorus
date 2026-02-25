use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
#[cfg(not(target_os = "macos"))]
use screenshots::Screen;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager};
#[cfg(target_os = "macos")]
use tauri_nspanel::ManagerExt;
use zerocopy::AsBytes;

use crate::SPOTLIGHT_LABEL;

#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Image processing error: {0}")]
    Image(String),
    #[error("Window not found: {0}")]
    WindowNotFound(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("{0}")]
    Other(String),
}

impl From<CommandError> for String {
    fn from(e: CommandError) -> String {
        e.to_string()
    }
}

// Target size in bytes (3.5MB) for image resizing
// This is used as the maximum size for images in the application
// and should match TARGET_IMAGE_SIZE_BYTES in src/ui/hooks/useAttachments.ts
// Changing this value will affect the size of all images processed by the application
const TARGET_SIZE_BYTES: u64 = 4_500_000;

#[tauri::command]
pub fn show(app_handle: AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let panel = app_handle.get_webview_panel(SPOTLIGHT_LABEL).unwrap();
        panel.show();
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Some(window) = app_handle.get_window(SPOTLIGHT_LABEL) {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
pub fn hide(app_handle: AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let panel = app_handle.get_webview_panel(SPOTLIGHT_LABEL).unwrap();
        if panel.is_visible() {
            panel.hide();
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Some(window) = app_handle.get_window(SPOTLIGHT_LABEL) {
            let _ = window.hide();
        }
    }
}

#[tauri::command]
pub fn open_in_main_window(app_handle: AppHandle, chat_id: String) {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.show().unwrap();
        window.set_focus().unwrap();
        app_handle
            .emit_to("main", "open_quick_chat_in_main_window", chat_id)
            .unwrap();
    }
}

#[tauri::command]
pub fn new_quick_chat(app_handle: AppHandle) {
    app_handle.emit_to("main", "new_quick_chat", ()).unwrap();
}

#[tauri::command]
pub fn refresh_projects_state(app_handle: AppHandle) {
    app_handle.emit("refresh_projects_state", ()).unwrap();
}

#[tauri::command]
pub fn chat_deleted(app_handle: AppHandle, chat_id: String) {
    app_handle.emit("chat_deleted", chat_id).unwrap();
}

#[tauri::command]
#[cfg(target_os = "macos")]
pub fn update_panel_theme(app_handle: AppHandle, is_dark_mode: bool) {
    if let Some(window) = app_handle.get_webview_window(SPOTLIGHT_LABEL) {
        crate::window::update_panel_theme(&window, is_dark_mode);
    }
}

#[tauri::command]
#[cfg(target_os = "macos")]
pub fn capture_window() -> Result<String, String> {
    use std::fs;
    use std::process::Command;
    use std::time::Instant;

    // Start timing the operation
    let start_time = Instant::now();
    log::debug!("Starting window capture...");

    // Create a temporary file path
    let raw_screenshot_path = std::env::temp_dir().join("screenshot_raw.png");

    // Run screencapture command
    let capture_time = Instant::now();
    let output = Command::new("screencapture")
        .arg("-w") // Window capture mode - allows user to select a window
        .arg(raw_screenshot_path.to_str().unwrap())
        .output()
        .map_err(|e| e.to_string())?;

    log::debug!("Raw capture completed in: {:?}", capture_time.elapsed());

    // Check if the command failed
    if !output.status.success() {
        return Err("Screen recording permission is required. Please enable it in System Preferences > Security & Privacy > Privacy > Screen Recording".to_string());
    }

    // Check if file exists and has content
    if !raw_screenshot_path.exists() {
        return Err("Screen recording permission denied. Please enable it in System Preferences > Security & Privacy > Privacy > Screen Recording".to_string());
    }

    // Use our resize_image function to handle the resizing
    let resized_path = resize_image(
        raw_screenshot_path.to_string_lossy().to_string(),
        TARGET_SIZE_BYTES,
    )?;

    // Read the resized file and convert to base64
    let image_data = fs::read(&resized_path).map_err(|e| e.to_string())?;

    // Clean up the temporary files
    let _ = fs::remove_file(&raw_screenshot_path);
    if resized_path != raw_screenshot_path.to_string_lossy().to_string() {
        let _ = fs::remove_file(&resized_path);
    }

    log::debug!(
        "Total window capture process took: {:?}",
        start_time.elapsed()
    );
    Ok(BASE64.encode(&image_data))
}

#[tauri::command]
#[cfg(not(target_os = "macos"))]
pub fn capture_window() -> Result<String, String> {
    // For non-macOS platforms, just capture the active window
    // This is a placeholder - you may want to implement platform-specific window capture
    Err("Window capture not implemented for this platform".to_string())
}

#[tauri::command]
#[cfg(target_os = "macos")]
pub fn capture_whole_screen(app_handle: AppHandle) -> Result<String, String> {
    use std::fs;
    use std::process::Command;
    use std::time::Instant;

    // Start timing the operation
    let start_time = Instant::now();
    log::debug!("Starting screenshot capture...");

    // Create temporary file path for raw screenshot
    let raw_screenshot_path = std::env::temp_dir().join("screenshot_raw.png");

    // Get information about the current window
    if let Some(window) = app_handle.get_webview_window(SPOTLIGHT_LABEL) {
        if let Ok(position) = window.outer_position() {
            // Log window position for debugging
            log::debug!("Window position: ({}, {})", position.x, position.y);

            // First, get the main display bounds to determine if we're on a secondary display
            // Use a temporary script to get this info
            let script_path = std::env::temp_dir().join("display_info.sh");
            let script_content = r#"#!/bin/bash
/usr/sbin/system_profiler SPDisplaysDataType | grep -A 15 "Display Type: Built-in" | grep "Resolution:" | head -n 1 | awk -F': ' '{print $2}' | sed 's/ Retina//' | awk -F' x ' '{print $1, $2}'
"#;
            fs::write(&script_path, script_content).map_err(|e| e.to_string())?;
            Command::new("chmod")
                .arg("+x")
                .arg(&script_path)
                .output()
                .map_err(|e| e.to_string())?;

            let main_display_output = Command::new(&script_path)
                .output()
                .map_err(|e| e.to_string())?;
            let _ = fs::remove_file(&script_path);

            // Parse main display resolution
            let main_display_resolution = String::from_utf8_lossy(&main_display_output.stdout);
            let parts: Vec<&str> = main_display_resolution.trim().split_whitespace().collect();

            let main_width = if parts.len() >= 1 {
                parts[0].parse::<i32>().unwrap_or(3456)
            } else {
                3456
            };
            let main_height = if parts.len() >= 2 {
                parts[1].parse::<i32>().unwrap_or(2234)
            } else {
                2234
            };

            log::debug!("Main display resolution: {}x{}", main_width, main_height);

            // Simple heuristic: If window position is outside main display bounds,
            // it's likely on a secondary display
            let target_display_id = if position.x > main_width || position.y > main_height {
                // It's likely on secondary display (typically ID 2)
                2
            } else {
                // It's likely on main display
                1
            };

            log::debug!("Detected window on display ID: {}", target_display_id);

            // Run screencapture command for the specific display
            log::debug!("Taking screenshot of display ID: {}", target_display_id);

            let capture_time = Instant::now();
            let output = Command::new("screencapture")
                .arg("-D") // Specify display
                .arg(target_display_id.to_string())
                .arg(raw_screenshot_path.to_str().unwrap())
                .output()
                .map_err(|e| e.to_string())?;

            log::debug!("Raw capture completed in: {:?}", capture_time.elapsed());

            // Check if the command failed
            if !output.status.success() {
                // If the specific display capture failed, try without a display ID
                log::debug!(
                    "Failed to capture display {}. Falling back to main display.",
                    target_display_id
                );

                let fallback_output = Command::new("screencapture")
                    .arg("-m") // Capture main display as fallback
                    .arg(raw_screenshot_path.to_str().unwrap())
                    .output()
                    .map_err(|e| e.to_string())?;

                if !fallback_output.status.success() {
                    return Err("Screen recording permission is required. Please enable it in System Preferences > Security & Privacy > Privacy > Screen Recording".to_string());
                }
            }

            // Check if file exists and has content
            if !raw_screenshot_path.exists() {
                return Err("Screen recording permission denied. Please enable it in System Preferences > Security & Privacy > Privacy > Screen Recording".to_string());
            }

            // Use our new resize_image function to handle the resizing
            let resized_path = resize_image(
                raw_screenshot_path.to_string_lossy().to_string(),
                TARGET_SIZE_BYTES,
            )?;

            // Read the resized file and convert to base64
            let image_data = fs::read(&resized_path).map_err(|e| e.to_string())?;

            // Clean up the resized file if it's not the same as the raw screenshot
            if resized_path != raw_screenshot_path.to_string_lossy().to_string() {
                let _ = fs::remove_file(&resized_path);
            }

            log::debug!("Total screenshot process took: {:?}", start_time.elapsed());
            return Ok(BASE64.encode(&image_data));
        }
    }

    // Fallback to the main display if window not found
    log::debug!("Window information not available, using main display");

    let output = Command::new("screencapture")
        .arg("-m") // Capture the main display only
        .arg(raw_screenshot_path.to_str().unwrap())
        .output()
        .map_err(|e| e.to_string())?;

    // Check if the command failed
    if !output.status.success() {
        return Err("Screen recording permission is required. Please enable it in System Preferences > Security & Privacy > Privacy > Screen Recording".to_string());
    }

    // Use our new resize_image function to handle the resizing
    let resized_path = resize_image(
        raw_screenshot_path.to_string_lossy().to_string(),
        TARGET_SIZE_BYTES,
    )?;

    // Read the resized file and convert to base64
    let image_data = fs::read(&resized_path).map_err(|e| e.to_string())?;

    // Clean up the resized file if it's not the same as the raw screenshot
    if resized_path != raw_screenshot_path.to_string_lossy().to_string() {
        let _ = fs::remove_file(&resized_path);
    }

    log::debug!("Total screenshot process took: {:?}", start_time.elapsed());
    Ok(BASE64.encode(&image_data))
}

#[tauri::command]
#[cfg(not(target_os = "macos"))]
pub fn capture_whole_screen(app_handle: AppHandle) -> Result<String, String> {
    use image::{DynamicImage, ImageBuffer, ImageFormat};
    use std::time::Instant;

    // Start timing the operation
    let start_time = Instant::now();
    log::debug!("Starting screenshot capture...");

    // For non-macOS platforms, use the screenshots crate to capture the entire screen
    let screens = Screen::all().map_err(|e| e.to_string())?;

    // Try to get the window position to determine which screen it's on
    if let Some(window) = app_handle.get_webview_window(SPOTLIGHT_LABEL) {
        if let Ok(position) = window.outer_position() {
            log::debug!("Window position: ({}, {})", position.x, position.y);

            // Try to find which screen contains the window
            for screen in &screens {
                let display_info = screen.display_info;

                // Check if the window's position is within this screen's bounds
                if position.x >= display_info.x as i32
                    && position.y >= display_info.y as i32
                    && position.x < (display_info.x + display_info.width) as i32
                    && position.y < (display_info.y + display_info.height) as i32
                {
                    // Log the display information
                    log::debug!(
                        "Taking screenshot of display at position ({}, {})",
                        display_info.x, display_info.y
                    );
                    log::debug!(
                        "Display dimensions: {}x{}",
                        display_info.width, display_info.height
                    );

                    // Capture this specific screen
                    let capture_time = Instant::now();
                    let image = screen.capture().map_err(|e| e.to_string())?;
                    log::debug!("Raw capture completed in: {:?}", capture_time.elapsed());

                    // Get image dimensions and raw pixels
                    let width = image.width();
                    let height = image.height();
                    let pixels = image.as_raw();

                    // Create a temporary file to save the raw screenshot
                    let temp_dir = std::env::temp_dir();
                    let raw_screenshot_path = temp_dir.join("screenshot_raw.png");

                    // Create a buffer to store the image data
                    let compress_time = Instant::now();

                    // Convert from RGBA to an image file
                    let img_buffer = ImageBuffer::from_raw(width, height, pixels.to_vec())
                        .ok_or("Failed to create image buffer")?;

                    let dynamic_image = DynamicImage::ImageRgba8(img_buffer);

                    // Save the image to a temporary file
                    dynamic_image
                        .save(&raw_screenshot_path)
                        .map_err(|e| e.to_string())?;

                    log::debug!("Raw image saved in: {:?}", compress_time.elapsed());

                    // Use our new resize_image function to handle the resizing
                    let resized_path = resize_image(
                        raw_screenshot_path.to_string_lossy().to_string(),
                        TARGET_SIZE_BYTES,
                    )?;

                    // Read the resized file and convert to base64
                    let image_data = std::fs::read(&resized_path).map_err(|e| e.to_string())?;

                    // Clean up the temporary files
                    let _ = std::fs::remove_file(&raw_screenshot_path);
                    if resized_path != raw_screenshot_path.to_string_lossy().to_string() {
                        let _ = std::fs::remove_file(&resized_path);
                    }

                    log::debug!("Total screenshot process took: {:?}", start_time.elapsed());
                    return Ok(BASE64.encode(&image_data));
                }
            }
        }
    }

    // Fallback to the main screen if we couldn't find the right screen
    log::debug!("Window not found on any display, using main display");
    let screen = screens.first().ok_or("No screen found")?;

    // Log the display information
    let display_info = screen.display_info;
    log::debug!(
        "Taking screenshot of main display at position ({}, {})",
        display_info.x, display_info.y
    );
    log::debug!(
        "Display dimensions: {}x{}",
        display_info.width, display_info.height
    );

    // Capture the screen
    let capture_time = Instant::now();
    let image = screen.capture().map_err(|e| e.to_string())?;
    log::debug!("Raw capture completed in: {:?}", capture_time.elapsed());

    // Get image dimensions and raw pixels
    let width = image.width();
    let height = image.height();
    let pixels = image.as_raw();

    // Create a temporary file to save the raw screenshot
    let temp_dir = std::env::temp_dir();
    let raw_screenshot_path = temp_dir.join("screenshot_raw.png");

    // Create a buffer to store the image data
    let compress_time = Instant::now();

    // Convert from RGBA to an image file
    let img_buffer = ImageBuffer::from_raw(width, height, pixels.to_vec())
        .ok_or("Failed to create image buffer")?;

    let dynamic_image = DynamicImage::ImageRgba8(img_buffer);

    // Save the image to a temporary file
    dynamic_image
        .save(&raw_screenshot_path)
        .map_err(|e| e.to_string())?;

    log::debug!("Raw image saved in: {:?}", compress_time.elapsed());

    // Use our new resize_image function to handle the resizing
    let resized_path = resize_image(
        raw_screenshot_path.to_string_lossy().to_string(),
        TARGET_SIZE_BYTES,
    )?;

    // Read the resized file and convert to base64
    let image_data = std::fs::read(&resized_path).map_err(|e| e.to_string())?;

    // Clean up the temporary files
    let _ = std::fs::remove_file(&raw_screenshot_path);
    if resized_path != raw_screenshot_path.to_string_lossy().to_string() {
        let _ = std::fs::remove_file(&resized_path);
    }

    log::debug!("Total screenshot process took: {:?}", start_time.elapsed());
    Ok(BASE64.encode(&image_data))
}

#[tauri::command]
pub fn resize_image(file_path: String, target_size_bytes: u64) -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    use std::process::Command;
    use std::time::Instant;

    // Start timing the operation
    let start_time = Instant::now();
    log::debug!("Starting image resize for: {}", file_path);

    // Create temporary file paths
    let input_path = Path::new(&file_path);
    let file_stem = input_path.file_stem().ok_or("Invalid file path")?;

    // Create temporary path for output
    let temp_dir = std::env::temp_dir();
    let output_path = temp_dir.join(format!("{}_resized.jpg", file_stem.to_string_lossy()));

    // Check if file exists
    if !input_path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Get file size
    let file_size = fs::metadata(&file_path).map_err(|e| e.to_string())?.len();
    log::debug!(
        "Original file size: {} bytes ({:.2} MB)",
        file_size,
        file_size as f64 / 1_048_576.0
    );

    // If file is already small enough, just return the original path
    if file_size <= target_size_bytes {
        log::debug!("File already under target size, skipping compression");
        return Ok(file_path);
    }

    // For very small size reductions, just use compression
    if file_size < target_size_bytes * 2 {
        // Use high quality for small reductions
        let quality = "85%";

        #[cfg(target_os = "macos")]
        {
            log::debug!("Using compression only with quality: {}", quality);
            let sips_output = Command::new("sips")
                .arg("-s")
                .arg("format")
                .arg("jpeg")
                .arg("-s")
                .arg("formatOptions")
                .arg(quality)
                .arg(input_path.to_str().unwrap())
                .arg("--out")
                .arg(output_path.to_str().unwrap())
                .output()
                .map_err(|e| e.to_string())?;

            if !sips_output.status.success() {
                log::debug!("Compression failed, using original image");
                return Ok(file_path);
            }
        }

        #[cfg(not(target_os = "macos"))]
        {
            use image::{ImageReader, ImageFormat};
            log::debug!("Using compression only with quality: {}", quality);

            // Parse quality percentage
            let quality_value = quality.trim_end_matches('%').parse::<u8>().unwrap_or(85);

            // Read the image
            let img = ImageReader::open(input_path)
                .map_err(|e| e.to_string())?
                .decode()
                .map_err(|e| e.to_string())?;

            // Save with compression
            img.save_with_format(output_path.to_str().unwrap(), ImageFormat::Jpeg)
                .map_err(|e| e.to_string())?;
        }

        let compressed_size = fs::metadata(&output_path).map_err(|e| e.to_string())?.len();
        log::debug!(
            "Compressed size: {} bytes ({:.2} MB)",
            compressed_size,
            compressed_size as f64 / 1_048_576.0
        );

        if compressed_size <= target_size_bytes {
            log::debug!("Compression successful, under target size");
            return Ok(output_path.to_string_lossy().to_string());
        }

        log::debug!("Simple compression not sufficient, proceeding to resize");
    }

    // Simple resize strategy: calculate dimensions based on target size
    // For JPEG: ~0.5 bytes per pixel at high quality is a reasonable estimate
    // Typical scaling factor for JPEG compression at good quality
    let bytes_per_pixel_estimation = 0.5;

    // When we need to do both dimension reduction and compression
    #[cfg(target_os = "macos")]
    {
        // First, get the image dimensions
        let sips_info = Command::new("sips")
            .arg("-g")
            .arg("pixelWidth")
            .arg("-g")
            .arg("pixelHeight")
            .arg(input_path.to_str().unwrap())
            .output()
            .map_err(|e| e.to_string())?;

        let info_str = String::from_utf8_lossy(&sips_info.stdout);

        // Parse dimensions from sips output
        let width_line = info_str.lines().find(|line| line.contains("pixelWidth"));
        let height_line = info_str.lines().find(|line| line.contains("pixelHeight"));

        let parse_dimension = |line: Option<&str>| -> Result<u32, String> {
            let value = line
                .ok_or("Could not find dimension in sips output")?
                .split(':')
                .nth(1)
                .ok_or("Invalid sips output format")?
                .trim()
                .parse::<u32>()
                .map_err(|e| e.to_string())?;
            Ok(value)
        };

        let original_width = parse_dimension(width_line)?;
        let original_height = parse_dimension(height_line)?;

        log::debug!(
            "Original dimensions: {}x{}",
            original_width, original_height
        );

        // Calculate the area in pixels and estimate the size reduction needed
        let original_pixels = original_width as f64 * original_height as f64;
        let target_pixels = target_size_bytes as f64 / bytes_per_pixel_estimation;

        // Calculate the scale factor - square root because we're scaling in 2D
        let scale_factor = ((target_pixels / original_pixels) as f64).sqrt() * 0.9; // 10% safety margin

        // Never go below 30% quality
        let scale_factor = scale_factor.max(0.3);

        // Calculate new dimensions
        let new_width = (original_width as f64 * scale_factor).round() as u32;

        log::debug!(
            "Using scale factor {:.2}, new width: {}",
            scale_factor, new_width
        );

        // Resize and compress in a single step with high quality
        let sips_output = Command::new("sips")
            .arg("-s")
            .arg("format")
            .arg("jpeg")
            .arg("-s")
            .arg("formatOptions")
            .arg("85%") // High quality
            .arg("--resampleWidth")
            .arg(new_width.to_string())
            .arg(input_path.to_str().unwrap())
            .arg("--out")
            .arg(output_path.to_str().unwrap())
            .output()
            .map_err(|e| e.to_string())?;

        if !sips_output.status.success() {
            log::debug!("Resizing failed, using original image");
            return Ok(file_path);
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        use image::{imageops::FilterType, ImageReader, ImageFormat};

        // Read the image
        let img = ImageReader::open(input_path)
            .map_err(|e| e.to_string())?
            .decode()
            .map_err(|e| e.to_string())?;

        // Get original dimensions
        let original_width = img.width();
        let original_height = img.height();

        log::debug!(
            "Original dimensions: {}x{}",
            original_width, original_height
        );

        // Calculate the area in pixels and estimate the size reduction needed
        let original_pixels = original_width as f64 * original_height as f64;
        let target_pixels = target_size_bytes as f64 / bytes_per_pixel_estimation;

        // Calculate the scale factor - square root because we're scaling in 2D
        let scale_factor = ((target_pixels / original_pixels) as f64).sqrt() * 0.9; // 10% safety margin

        // Never go below 30% quality
        let scale_factor = scale_factor.max(0.3);

        // Calculate new dimensions
        let new_width = (original_width as f64 * scale_factor).round() as u32;
        let new_height = (original_height as f64 * scale_factor).round() as u32;

        log::debug!(
            "Using scale factor {:.2}, new dimensions: {}x{}",
            scale_factor, new_width, new_height
        );

        // Resize the image
        let resized = img.resize(new_width, new_height, FilterType::Lanczos3);

        // Save with high quality compression
        resized
            .save_with_format(output_path.to_str().unwrap(), ImageFormat::Jpeg)
            .map_err(|e| e.to_string())?;
    }

    // Check final size
    let final_size = fs::metadata(&output_path).map_err(|e| e.to_string())?.len();
    log::debug!(
        "Final size: {} bytes ({:.2} MB)",
        final_size,
        final_size as f64 / 1_048_576.0
    );

    log::debug!("Total image processing took: {:?}", start_time.elapsed());
    Ok(output_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_screen_recording_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        // Open System Settings directly to Screen Recording privacy settings
        Command::new("open")
            .args(["x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"])
            .output()
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Opening screen recording settings is only supported on macOS".to_string())
    }
}

#[tauri::command]
pub fn get_instance_name() -> Result<String, String> {
    // Get the instance name from the environment variable set by our script
    match std::env::var("CHORUS_INSTANCE_NAME") {
        Ok(name) => Ok(name),
        Err(_) => Ok("".to_string()), // Return empty string if not set
    }
}

#[tauri::command]
pub async fn write_file_async(path: String, content: Option<Vec<u8>>, source_path: Option<String>) -> Result<(), String> {
    use std::path::Path;
    
    // Use Tauri's async runtime to perform the write operation
    tauri::async_runtime::spawn_blocking(move || {
        // Ensure parent directory exists
        if let Some(parent) = Path::new(&path).parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        
        if let Some(src_path) = source_path {
            // Copy file from source path (avoids IPC for large files)
            std::fs::copy(&src_path, &path).map_err(|e| e.to_string())?;
        } else if let Some(data) = content {
            // Write content directly (backward compatibility)
            std::fs::write(&path, data).map_err(|e| e.to_string())?;
        } else {
            return Err("Either content or source_path must be provided".to_string());
        }
        
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;
    
    Ok(())
}

#[tauri::command]
pub fn get_file_metadata(path: String) -> Result<serde_json::Value, String> {
    use std::fs;

    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "size": metadata.len(),
        "isFile": metadata.is_file(),
        "isDirectory": metadata.is_dir()
    }))
}

fn gen_id() -> String {
    use std::fmt::Write;
    let bytes: [u8; 16] = rand::random();
    let mut s = String::with_capacity(32);
    for b in bytes {
        write!(s, "{:02x}", b).unwrap();
    }
    s
}

fn gen_uuid() -> String {
    let hex = gen_id();
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

/// Runs the entire chat branch operation in a single SQLite transaction.
///
/// Steps:
/// 1. Create a new chat cloned from the source chat
/// 2. Duplicate all message sets up to and including the target level
/// 3. For each message set, duplicate messages, message_parts, and message_attachments
/// 4. Select the target message in the new chat
/// 5. Optionally set reply metadata
///
/// Returns a JSON object with:
/// - newChatId: the ID of the new chat
/// - messageSetIdMap: mapping of old message set IDs to new ones
/// - messageIdMap: mapping of old message IDs to new ones
#[tauri::command]
pub async fn branch_chat(
    app_handle: AppHandle,
    chat_id: String,
    message_set_id: String,
    message_id: String,
    reply_to_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let db_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("chats.db");

    tauri::async_runtime::spawn_blocking(move || {
        let mut conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
        // Enable WAL mode to avoid conflicts with tauri-plugin-sql
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| e.to_string())?;

        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // 1. Create new chat from source
        let new_chat_id = gen_id();
        tx.execute(
            "INSERT INTO chats (id, created_at, updated_at, project_id, title, quick_chat, parent_chat_id, reply_to_id)
             SELECT ?1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, project_id, title, 0, id, ?3
             FROM chats WHERE id = ?2",
            rusqlite::params![new_chat_id, chat_id, reply_to_id],
        )
        .map_err(|e| e.to_string())?;

        // 2. Get message sets to duplicate (up to the target message set's level)
        let target_level: i64 = tx
            .query_row(
                "SELECT level FROM message_sets WHERE id = ?1",
                rusqlite::params![message_set_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let mut stmt = tx
            .prepare(
                "SELECT id, level, type, selected_block_type FROM message_sets
                 WHERE chat_id = ?1 AND level <= ?2
                 ORDER BY level",
            )
            .map_err(|e| e.to_string())?;

        let source_message_sets: Vec<(String, i64, String, String)> = stmt
            .query_map(rusqlite::params![chat_id, target_level], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        drop(stmt);

        let mut message_set_id_map: HashMap<String, String> = HashMap::new();
        let mut message_id_map: HashMap<String, String> = HashMap::new();

        // 3. Duplicate each message set
        for (src_ms_id, level, ms_type, selected_block_type) in &source_message_sets {
            let new_ms_id = gen_uuid().to_lowercase();

            tx.execute(
                "INSERT INTO message_sets (id, chat_id, level, type, selected_block_type)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![new_ms_id, new_chat_id, level, ms_type, selected_block_type],
            )
            .map_err(|e| e.to_string())?;

            message_set_id_map.insert(src_ms_id.clone(), new_ms_id.clone());

            // Duplicate messages (ORDER BY selected DESC so selected ones come first)
            let mut msg_stmt = tx
                .prepare(
                    "SELECT id, text, model, selected, is_review, review_state, block_type, state, level
                     FROM messages WHERE message_set_id = ?1
                     ORDER BY selected DESC",
                )
                .map_err(|e| e.to_string())?;

            let source_messages: Vec<(
                String,
                String,
                String,
                i64,
                Option<i64>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<i64>,
            )> = msg_stmt
                .query_map(rusqlite::params![src_ms_id], |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                        row.get(6)?,
                        row.get(7)?,
                        row.get(8)?,
                    ))
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            drop(msg_stmt);

            for (
                src_msg_id,
                text,
                model,
                selected,
                is_review,
                review_state,
                block_type,
                _state,
                msg_level,
            ) in &source_messages
            {
                let new_msg_id = gen_uuid().to_lowercase();

                tx.execute(
                    "INSERT INTO messages (id, chat_id, message_set_id, text, model, selected, streaming_token, is_review, review_state, block_type, state, level, branched_from_id)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?8, ?9, 'idle', ?10, ?11)",
                    rusqlite::params![
                        new_msg_id,
                        new_chat_id,
                        new_ms_id,
                        text,
                        model,
                        selected,
                        is_review,
                        review_state,
                        block_type,
                        msg_level,
                        src_msg_id,
                    ],
                )
                .map_err(|e| e.to_string())?;

                message_id_map.insert(src_msg_id.clone(), new_msg_id.clone());

                // Duplicate message_attachments
                tx.execute(
                    "INSERT INTO message_attachments (message_id, attachment_id)
                     SELECT ?1, attachment_id FROM message_attachments WHERE message_id = ?2",
                    rusqlite::params![new_msg_id, src_msg_id],
                )
                .map_err(|e| e.to_string())?;

                // Duplicate message_parts
                tx.execute(
                    "INSERT INTO message_parts (chat_id, message_id, level, content, tool_calls, tool_results)
                     SELECT ?1, ?2, level, content, tool_calls, tool_results
                     FROM message_parts WHERE message_id = ?3",
                    rusqlite::params![new_chat_id, new_msg_id, src_msg_id],
                )
                .map_err(|e| e.to_string())?;
            }
        }

        // 4. Select the target message in the new chat
        let new_target_ms_id = message_set_id_map
            .get(&message_set_id)
            .ok_or_else(|| "Target message set not found in map".to_string())?;
        let new_target_msg_id = message_id_map
            .get(&message_id)
            .ok_or_else(|| "Target message not found in map".to_string())?;

        tx.execute(
            "UPDATE messages SET selected = (CASE WHEN id = ?1 THEN 1 ELSE 0 END)
             WHERE message_set_id = ?2 AND block_type = 'tools'",
            rusqlite::params![new_target_msg_id, new_target_ms_id],
        )
        .map_err(|e| e.to_string())?;

        // 5. Handle reply metadata
        if let Some(ref reply_id) = reply_to_id {
            // Set reply_chat_id on the source message
            tx.execute(
                "UPDATE messages SET reply_chat_id = ?1 WHERE id = ?2",
                rusqlite::params![new_chat_id, message_id],
            )
            .map_err(|e| e.to_string())?;

            // Set the reply model config
            let reply_model: Option<String> = tx
                .query_row(
                    "SELECT model FROM messages WHERE id = ?1",
                    rusqlite::params![reply_id],
                    |row| row.get(0),
                )
                .ok();

            if let Some(model) = reply_model {
                let config_id = gen_uuid();
                let model_ids_json = serde_json::json!([model]).to_string();
                tx.execute(
                    "INSERT INTO saved_model_configs_chats (id, chat_id, model_ids, created_at, updated_at)
                     VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    rusqlite::params![config_id, new_chat_id, model_ids_json],
                )
                .map_err(|e| e.to_string())?;
            }
        }

        tx.commit().map_err(|e| e.to_string())?;

        Ok(serde_json::json!({
            "newChatId": new_chat_id,
            "messageSetIdMap": message_set_id_map,
            "messageIdMap": message_id_map,
        }))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Create the vec0 virtual table for storing chat embeddings if it doesn't exist.
#[tauri::command]
pub async fn ensure_vec_table(app_handle: AppHandle) -> Result<(), String> {
    let db_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("chats.db");

    tauri::async_runtime::spawn_blocking(move || {
        let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
        conn.execute_batch(
            "CREATE VIRTUAL TABLE IF NOT EXISTS chat_embeddings USING vec0(
                chat_id TEXT PRIMARY KEY,
                embedding FLOAT[1536]
            );",
        )
        .map_err(|e| e.to_string())?;
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Store or update an embedding for a chat. vec0 doesn't support UPSERT,
/// so we delete-then-insert inside a transaction.
#[tauri::command]
pub async fn upsert_chat_embedding(
    app_handle: AppHandle,
    chat_id: String,
    embedding: Vec<f32>,
) -> Result<(), String> {
    let db_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("chats.db");

    tauri::async_runtime::spawn_blocking(move || {
        let mut conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        tx.execute(
            "DELETE FROM chat_embeddings WHERE chat_id = ?1",
            rusqlite::params![chat_id],
        )
        .map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO chat_embeddings(chat_id, embedding) VALUES (?1, ?2)",
            rusqlite::params![chat_id, embedding.as_bytes()],
        )
        .map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Find chats with similar embeddings using KNN search.
#[tauri::command]
pub async fn find_similar_chats(
    app_handle: AppHandle,
    embedding: Vec<f32>,
    limit: i32,
    exclude_chat_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let db_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("chats.db");

    tauri::async_runtime::spawn_blocking(move || {
        let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;

        // KNN query against the vec0 table, joined with chats for metadata
        let sql = "
            SELECT
                ce.chat_id,
                c.title,
                ce.distance,
                c.project_id,
                c.updated_at
            FROM chat_embeddings ce
            INNER JOIN chats c ON c.id = ce.chat_id
            WHERE ce.embedding MATCH ?1
              AND k = ?2
            ORDER BY ce.distance
        ";

        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![embedding.as_bytes(), limit], |row| {
                Ok(serde_json::json!({
                    "chatId": row.get::<_, String>(0)?,
                    "title": row.get::<_, Option<String>>(1)?,
                    "distance": row.get::<_, f64>(2)?,
                    "projectId": row.get::<_, Option<String>>(3)?,
                    "updatedAt": row.get::<_, Option<String>>(4)?,
                }))
            })
            .map_err(|e| e.to_string())?;

        let mut results: Vec<serde_json::Value> = Vec::new();
        for row in rows {
            let val = row.map_err(|e| e.to_string())?;
            // Filter out the excluded chat
            if let Some(ref exclude_id) = exclude_chat_id {
                if val.get("chatId").and_then(|v| v.as_str()) == Some(exclude_id.as_str()) {
                    continue;
                }
            }
            results.push(val);
        }

        Ok(serde_json::json!(results))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
