use tauri_plugin_sql::MigrationKind;
use rusqlite::{Connection, Result};
use std::fs::File;
use std::io::Write;
use std::path::Path;

// Import migrations from the main module
#[path = "../migrations.rs"]
mod migrations;

#[allow(dead_code)]
struct TableInfo {
    name: String,
    sql: String,
}

#[allow(dead_code)]
struct ColumnInfo {
    cid: i32,
    name: String,
    data_type: String,
    not_null: bool,
    default_value: Option<String>,
    is_primary: bool,
}

struct IndexInfo {
    name: String,
    table_name: String,
    sql: Option<String>,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create an in-memory SQLite database
    let conn = Connection::open_in_memory()?;
    
    // Get migrations
    let migrations = migrations::migrations();
    
    // Apply all migrations
    for migration in &migrations {
        if matches!(migration.kind, MigrationKind::Up) {
            println!("Applying migration {}: {}", migration.version, migration.description);
            conn.execute_batch(migration.sql)?;
        }
    }
    
    // Query the schema
    let tables = get_tables(&conn)?;
    let indices = get_indices(&conn)?;
    
    // Generate SQL_SCHEMA.md in the root directory
    let schema_path = Path::new("../SQL_SCHEMA.md");
    let mut file = File::create(schema_path)?;
    
    // Write header
    writeln!(file, "# Database Schema")?;
    writeln!(file)?;
    writeln!(file, "_This file is auto-generated from migrations.rs. Do not edit manually._")?;
    writeln!(file)?;
    writeln!(file, "Last updated: {}", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"))?;
    writeln!(file)?;
    
    // Write table of contents
    writeln!(file, "## Tables")?;
    writeln!(file)?;
    for table in &tables {
        writeln!(file, "- [{}](#{})", table.name, table.name.to_lowercase())?;
    }
    writeln!(file)?;
    
    // Write detailed table information
    for table in &tables {
        writeln!(file, "## {}", table.name)?;
        writeln!(file)?;
        
        // Get column information
        let columns = get_columns(&conn, &table.name)?;
        
        // Write table
        writeln!(file, "| Column | Type | Constraints | Default |")?;
        writeln!(file, "|--------|------|-------------|---------|")?;
        
        for col in &columns {
            let constraints = format!("{}{}",
                if col.not_null { "NOT NULL " } else { "" },
                if col.is_primary { "PRIMARY KEY" } else { "" }
            ).trim().to_string();
            
            let default = col.default_value.as_deref().unwrap_or("-");
            
            writeln!(file, "| {} | {} | {} | {} |", 
                col.name, 
                col.data_type, 
                if constraints.is_empty() { "-" } else { &constraints },
                default
            )?;
        }
        writeln!(file)?;
        
        // Write indices for this table
        let table_indices: Vec<&IndexInfo> = indices.iter()
            .filter(|idx| idx.table_name == table.name && !idx.name.starts_with("sqlite_autoindex"))
            .collect();
        
        if !table_indices.is_empty() {
            writeln!(file, "### Indices")?;
            writeln!(file)?;
            for idx in table_indices {
                writeln!(file, "- **{}**", idx.name)?;
                if let Some(sql) = &idx.sql {
                    // Extract the column list from CREATE INDEX statement
                    if let Some(start) = sql.find('(') {
                        if let Some(end) = sql.find(')') {
                            let columns = &sql[start+1..end];
                            writeln!(file, "  - Columns: {}", columns)?;
                        }
                    }
                }
            }
            writeln!(file)?;
        }
    }
    
    println!("Schema generated successfully at ../SQL_SCHEMA.md");
    Ok(())
}

fn get_tables(conn: &Connection) -> Result<Vec<TableInfo>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")?;
    let tables = stmt.query_map([], |row| {
        Ok(TableInfo {
            name: row.get(0)?,
            sql: row.get(1)?,
        })
    })?;
    
    let mut result = Vec::new();
    for table in tables {
        result.push(table?);
    }
    Ok(result)
}

fn get_columns(conn: &Connection, table_name: &str) -> Result<Vec<ColumnInfo>, rusqlite::Error> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table_name))?;
    let columns = stmt.query_map([], |row| {
        Ok(ColumnInfo {
            cid: row.get(0)?,
            name: row.get(1)?,
            data_type: row.get(2)?,
            not_null: row.get(3)?,
            default_value: row.get(4)?,
            is_primary: row.get(5)?,
        })
    })?;
    
    let mut result = Vec::new();
    for col in columns {
        result.push(col?);
    }
    Ok(result)
}

fn get_indices(conn: &Connection) -> Result<Vec<IndexInfo>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' ORDER BY name")?;
    let indices = stmt.query_map([], |row| {
        Ok(IndexInfo {
            name: row.get(0)?,
            table_name: row.get(1)?,
            sql: row.get(2)?,
        })
    })?;
    
    let mut result = Vec::new();
    for idx in indices {
        result.push(idx?);
    }
    Ok(result)
}