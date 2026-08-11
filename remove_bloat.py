#!/usr/bin/env python3
"""
Script to remove bloat files from the LitPath AI project
Removes unnecessary files and configurations that are safe to delete
"""
import os
import shutil
from pathlib import Path

def confirm_removal():
    """
    Prompt user to confirm file removal
    Returns True if user confirms, False otherwise
    """
    response = input("\n❗ Are you sure you want to remove these bloat files? (y/n): ")
    return response.lower() == 'y'

def remove_bloat_files():
    """
    Remove bloat files and configurations that are safe to delete
    """
    project_root = Path.cwd()
    
    # Files and directories safe to remove
    removable_items = [
        # Test data and related files that are for testing purposes only
        project_root / "populate_test_data.py",
        
        # Log files
        project_root / "backend.log",
        
        # Backup files
        project_root / ".env.backup",
        
        # Redundant files that duplicate seed_users functionality
        project_root / "check_db_users.py",
        
        # Migration check script that duplicates Django's functionality
        project_root / "check_migrations.py",
        
        # Documentation files that are development-specific
        project_root / "docs" / "IT_ADMIN_DATABASE_BACKUPS_DEMO_GUIDE.md",
    ]
    
    removed_count = 0
    for item in removable_items:
        try:
            if item.exists():
                if item.is_file():
                    item.unlink()  # Remove file
                    print(f"🗑️  Removed file: {item.name}")
                elif item.is_dir():
                    shutil.rmtree(item)  # Remove directory
                    print(f"🗑️  Removed directory: {item.name}")
                removed_count += 1
            else:
                print(f"ℹ️  Skipping (not found): {item.name}")
        except Exception as e:
            print(f"⚠️  Could not remove {item.name}: {str(e)}")
    
    print(f"\n✅ Successfully removed {removed_count} bloat items.")
    print("\n📋 The project has been cleaned of unnecessary files.")
    print("📖 Check LITPATH_STARTUP_GUIDE.md for deployment instructions on Ubuntu Server in Proxmox VE.")

if __name__ == "__main__":
    print("🧹 Starting deploating process for LitPath AI...")
    print("\n🔍 Checking bloat files...")
    
    # Show list of files to be removed
    project_root = Path.cwd()
    removable_items = [
        project_root / "populate_test_data.py",
        project_root / "backend.log",
        project_root / ".env.backup",
        project_root / "check_db_users.py",
        project_root / "check_migrations.py",
        project_root / "docs" / "IT_ADMIN_DATABASE_BACKUPS_DEMO_GUIDE.md",
    ]
    
    print("\n📂 Files and directories that will be removed:")
    for item in removable_items:
        if item.exists():
            print(f" - {item.name}")
    
    # Ask for user confirmation before removing
    if confirm_removal():
        remove_bloat_files()
    else:
        print("\n❌ Operation cancelled by user.")
        print("ℹ️  No files were removed.")