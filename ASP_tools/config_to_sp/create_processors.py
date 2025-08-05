#!/usr/bin/env python3
"""
Unified Processor Creator CLI

This script reads a main config file and processes connector configuration files
to create either source or sink processors based on the connector.class field.

Usage:
    python create_processors.py <main_config.json> <connector_configs_folder>

Main config format:
{
    "confluent-cluster-id": "your-cluster-id",
    "confluent-rest-endpoint": "https://your-rest-endpoint.com",
    "mongodb-stream-processor-instance-url": "mongodb://your-stream-processor-instance-url/",
    "mongodb-tenant-name": "your-stream-instance-name",
    "mongodb-group-id": "your-24-char-mongodb-group-id",
    "kafka-connection-name": "kafka-connection-name",
    "mongodb-cluster-name": "your-cluster-name",
    "mongodb-connection-name": "mongodb-connection",
    "mongodb-connection-role": "readAnyDatabase"
}

Connector config format:
{
    "connector.class": "MongoDbAtlasSource" | "MongoDbAtlasSink",
    "kafka.api.key": "your-api-key",
    "kafka.api.secret": "your-api-secret",
    ... (additional fields based on connector type)
}
"""

import json
import os
import sys
import argparse
from pathlib import Path
from typing import Dict, Any

# Import shared functions and existing modules
from processors.common import load_json_file, validate_main_config
from processors.source import process_connector_configs as process_source_configs
from processors.sink import process_connector_configs as process_sink_configs


def validate_unified_config(config: Dict[str, Any], filename: str) -> bool:
    """Validate a unified connector configuration file."""
    if "connector.class" not in config:
        print(f"Error: Missing required field 'connector.class' in {filename}")
        return False
    
    if "name" not in config:
        print(f"Error: Missing required field 'name' in {filename}")
        return False
    
    connector_class = config["connector.class"]
    if connector_class not in ["MongoDbAtlasSource", "MongoDbAtlasSink"]:
        print(f"Error: Unsupported connector.class '{connector_class}' in {filename}. Must be 'MongoDbAtlasSource' or 'MongoDbAtlasSink'")
        return False
    
    return True


def is_single_file(path: str) -> bool:
    """Check if the given path is a single file rather than a directory."""
    path_obj = Path(path)
    return path_obj.exists() and path_obj.is_file()


def separate_configs_by_type(configs_path: str) -> tuple[list, list]:
    """Separate configuration files by connector type from either a single file or folder."""
    path_obj = Path(configs_path)
    
    if not path_obj.exists():
        print(f"Error: Path not found: {configs_path}")
        return [], []
    
    source_configs = []
    sink_configs = []
    
    # Handle single file
    if path_obj.is_file():
        if not configs_path.endswith('.json'):
            print(f"Error: File must be a JSON file: {configs_path}")
            return [], []
        
        config = load_json_file(configs_path)
        if not config:
            return [], []
            
        if not validate_unified_config(config, path_obj.name):
            return [], []
        
        if config["connector.class"] == "MongoDbAtlasSource":
            source_configs.append(path_obj)
        elif config["connector.class"] == "MongoDbAtlasSink":
            sink_configs.append(path_obj)
    
    # Handle folder
    elif path_obj.is_dir():
        json_files = list(path_obj.glob("*.json"))
        
        if not json_files:
            print(f"No .json files found in {configs_path}")
            return [], []
        
        for json_file in json_files:
            config = load_json_file(str(json_file))
            if not config:
                continue
                
            if not validate_unified_config(config, json_file.name):
                continue
            
            if config["connector.class"] == "MongoDbAtlasSource":
                source_configs.append(json_file)
            elif config["connector.class"] == "MongoDbAtlasSink":
                sink_configs.append(json_file)
    
    else:
        print(f"Error: Path must be a file or directory: {configs_path}")
        return [], []
    
    return source_configs, sink_configs


def create_temp_folder_with_configs(configs: list, temp_folder_name: str) -> str:
    """Create a temporary folder with configs of a specific type."""
    if not configs:
        return None
    
    temp_folder = Path(f"/tmp/{temp_folder_name}")
    temp_folder.mkdir(exist_ok=True)
    
    for config_file in configs:
        config = load_json_file(str(config_file))
        
        temp_file_path = temp_folder / config_file.name
        with open(temp_file_path, 'w') as f:
            json.dump(config, f, indent=4)
    
    return str(temp_folder)


def main():
    """Main function to handle command-line arguments and orchestrate the process."""
    
    parser = argparse.ArgumentParser(
        description="Create processors from connector configuration files based on connector.class",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "main_config",
        help="Path to the main configuration JSON file"
    )
    
    parser.add_argument(
        "configs_path",
        help="Path to a single connector configuration file or a folder containing multiple configuration files"
    )
    
    args = parser.parse_args()
    
    # Load and validate main config
    print("Loading main configuration...")
    main_config = load_json_file(args.main_config)
    if not main_config:
        sys.exit(1)
    
    if not validate_main_config(main_config):
        sys.exit(1)
    
    print(f"✓ Main config loaded successfully")
    
    # Separate configs by type
    source_configs, sink_configs = separate_configs_by_type(args.configs_path)
    
    if not source_configs and not sink_configs:
        print("No valid connector configurations found.")
        sys.exit(1)
    
    print(f"Found {len(source_configs)} source configs and {len(sink_configs)} sink configs")
    
    # Process source configs
    if source_configs:
        print("\n" + "="*60)
        print("PROCESSING SOURCE CONFIGURATIONS")
        print("="*60)
        
        temp_source_folder = create_temp_folder_with_configs(source_configs, "source_configs")
        process_source_configs(main_config, temp_source_folder)
        
        # Cleanup temp folder
        import shutil
        shutil.rmtree(temp_source_folder)
    
    # Process sink configs
    if sink_configs:
        print("\n" + "="*60)
        print("PROCESSING SINK CONFIGURATIONS") 
        print("="*60)
        
        temp_sink_folder = create_temp_folder_with_configs(sink_configs, "sink_configs")
        process_sink_configs(main_config, temp_sink_folder)
        
        # Cleanup temp folder
        import shutil
        shutil.rmtree(temp_sink_folder)
    
    print("\n" + "="*60)
    print("PROCESSING COMPLETE")
    print("="*60)


if __name__ == "__main__":
    main()