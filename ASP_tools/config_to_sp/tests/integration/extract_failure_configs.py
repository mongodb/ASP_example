#!/usr/bin/env python3
"""
Extract failure configurations for retesting.

This script takes a folder containing subfolders (typically from audit results failures/),
creates a new folder called 'failure_configs' next to it, and extracts the 
test_customer_config.json from each subfolder, renaming it to match the parent folder name.

Usage:
    python extract_failure_configs.py <path_to_failures_folder>

Example:
    python extract_failure_configs.py tests/integration/audit_results/20250804_174856/failures

This will:
1. Create: tests/integration/audit_results/20250804_174856/failure_configs/
2. Extract each: failures/sink.max.poll.interval.ms.60000/test_customer_config.json
3. Save as: failure_configs/sink.max.poll.interval.ms.60000.json
"""

import sys
import json
import shutil
from pathlib import Path


def extract_failure_configs(failures_folder: Path):
    """Extract test_customer_config.json files from failure subfolders."""
    
    if not failures_folder.exists():
        print(f"❌ Error: Folder does not exist: {failures_folder}")
        return False
    
    if not failures_folder.is_dir():
        print(f"❌ Error: Path is not a directory: {failures_folder}")
        return False
    
    # Create failure_configs folder next to the failures folder
    parent_dir = failures_folder.parent
    failure_configs_dir = parent_dir / "failure_configs"
    
    # Remove existing failure_configs if it exists
    if failure_configs_dir.exists():
        print(f"🗑️  Removing existing folder: {failure_configs_dir}")
        shutil.rmtree(failure_configs_dir)
    
    failure_configs_dir.mkdir()
    print(f"📁 Created folder: {failure_configs_dir}")
    
    # Find all subfolders in the failures folder
    subfolders = [d for d in failures_folder.iterdir() if d.is_dir()]
    
    if not subfolders:
        print(f"⚠️  No subfolders found in: {failures_folder}")
        return True
    
    print(f"🔍 Found {len(subfolders)} failure subfolders")
    
    extracted_count = 0
    missing_count = 0
    
    for subfolder in sorted(subfolders):
        config_file = subfolder / "test_customer_config.json"
        
        if not config_file.exists():
            print(f"⚠️  Missing config file: {subfolder.name}/test_customer_config.json")
            missing_count += 1
            continue
        
        # Create output filename: subfolder name + .json
        output_filename = f"{subfolder.name}.json"
        output_path = failure_configs_dir / output_filename
        
        try:
            # Read and validate JSON
            with open(config_file, 'r') as f:
                config_data = json.load(f)
            
            # Write to new location
            with open(output_path, 'w') as f:
                json.dump(config_data, f, indent=2)
            
            print(f"✅ Extracted: {subfolder.name} → {output_filename}")
            extracted_count += 1
            
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in {subfolder.name}/test_customer_config.json: {e}")
            missing_count += 1
        except Exception as e:
            print(f"❌ Error processing {subfolder.name}: {e}")
            missing_count += 1
    
    print(f"\n📊 Summary:")
    print(f"   ✅ Extracted: {extracted_count} configs")
    print(f"   ⚠️  Missing/Error: {missing_count} configs")
    print(f"   📁 Output folder: {failure_configs_dir}")
    
    if extracted_count > 0:
        print(f"\n🚀 You can now test these configs with:")
        print(f"   python test_integration.py --config {failure_configs_dir.name}/ --audit")
    
    return True


def main():
    """Main function."""
    if len(sys.argv) != 2:
        print("❌ Error: Please provide exactly one argument")
        print("\nUsage:")
        print(f"   python {Path(__file__).name} <path_to_failures_folder>")
        print("\nExample:")
        print(f"   python {Path(__file__).name} tests/integration/audit_results/20250804_174856/failures")
        sys.exit(1)
    
    failures_folder_path = Path(sys.argv[1])
    
    print(f"🎯 Processing failures folder: {failures_folder_path}")
    
    success = extract_failure_configs(failures_folder_path)
    
    if not success:
        sys.exit(1)
    
    print("\n🎉 Extraction complete!")


if __name__ == "__main__":
    main()