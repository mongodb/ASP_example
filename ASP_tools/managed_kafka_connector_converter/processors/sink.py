#!/usr/bin/env python3
"""
MongoDB Sink Stream Processor Setup Tool

This script reads a main config file and processes connector configuration files
to create MongoDB sink stream processors using MongoDB Atlas Stream Processing.

Usage:
    python create_sink_processors.py <main_config.json> <connector_configs_folder>

Main config format:
{
    "confluent-cluster-id": "your-cluster-id",
    "confluent-rest-endpoint": "https://your-rest-endpoint.com",
    "mongodb-stream-processor-instance-url": "mongodb://your-stream-processor-instance-url/",
    "kafka-connection-name": "kafka-connection-name",
    "mongodb-connection-name": "mongodb-sink-connection",
    "mongodb-group-id": "your-24-char-mongodb-group-id",
    "mongodb-tenant-name": "your-stream-instance-name"
}

Connector config format:
{
    "kafka.api.key": "your-api-key",
    "kafka.api.secret": "your-api-secret",
    "input.data.format": "JSON",
    "connection.user": "your-username",
    "connection.password": "your-password",
    "topics": "topic-name" || ["topic1", "topic2"],
    "database": "your-database",
    "collection": "your-collection"
}
"""

import json
import os
import sys
import requests
import argparse
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, Union, List

# Import shared functions
from .common import load_json_file, create_kafka_connection, check_atlas_auth_with_login, create_mongodb_connection, validate_main_config, create_stream_processor
from .config_validator import validate_connector_config






def validate_sink_config(config: Dict[str, Any], filename: str) -> tuple[bool, List[str]]:
    """Validate a sink connector configuration file using CSV-based validation.
    
    Returns:
        tuple: (is_valid: bool, issues: List[str])
    """
    # Use CSV-based validation
    result = validate_connector_config(config)
    
    if result.is_valid:
        return True, []
    else:
        return False, result.error_messages









def process_connector_configs(main_config: Dict[str, Any], configs_folder: str) -> None:
    """Process all connector configuration files in the specified folder."""
    
    # Check Atlas CLI authentication first - stop all processing if not authenticated
    if not check_atlas_auth_with_login():
        print("✗ All processing stopped due to authentication failure")
        return
    
    folder_path = Path(configs_folder)
    
    if not folder_path.exists():
        print(f"Error: Folder not found: {configs_folder}")
        return
    
    if not folder_path.is_dir():
        print(f"Error: Path is not a directory: {configs_folder}")
        return
    
    # Find all .json files in the folder
    json_files = list(folder_path.glob("*.json"))
    
    if not json_files:
        print(f"No .json files found in {configs_folder}")
        return
    
    print(f"Found {len(json_files)} .json files to process")
    print("-" * 50)
    
    # Track skipped configurations and issues
    skipped_configs = {}  # filename -> list of issues
    
    # Create connections once (using first connector config for Kafka auth)
    kafka_connection_created = False
    kafka_connection_was_created = False
    mongodb_connection_created = False
    mongodb_connection_was_created = False
    first_connector_config = None
    
    # Find first valid config for connection setup
    for json_file in json_files:
        connector_config = load_json_file(str(json_file))
        if connector_config:
            is_valid, issues = validate_sink_config(connector_config, json_file.name)
            if is_valid:
                first_connector_config = connector_config
                break
            else:
                skipped_configs[json_file.name] = issues
    
    # Create MongoDB sink connection
    print(f"\nCreating MongoDB sink connection: {main_config['mongodb-connection-name']}")
    mongodb_connection_created, mongodb_connection_was_created = create_mongodb_connection(
        main_config["mongodb-group-id"],
        main_config["mongodb-tenant-name"],
        main_config["mongodb-cluster-name"],
        main_config["mongodb-connection-name"],
        role_name=main_config["mongodb-connection-role"]
    )
    
    # Create Kafka connection
    if first_connector_config:
        print(f"\nCreating Kafka connection: {main_config['kafka-connection-name']}")
        kafka_connection_created, kafka_connection_was_created = create_kafka_connection(
            main_config["mongodb-group-id"],
            main_config["mongodb-tenant-name"],
            main_config["kafka-connection-name"],
            main_config["confluent-rest-endpoint"],
            first_connector_config["kafka.api.key"],
            first_connector_config["kafka.api.secret"]
        )
    
    stream_processor_success_count = 0
    stream_processor_created_count = 0
    existing_processors = []
    total_count = len(json_files)
    
    for json_file in json_files:
        print(f"\nProcessing: {json_file.name}")
        
        # Load connector config
        connector_config = load_json_file(str(json_file))
        if not connector_config:
            continue
        
        # Validate connector config
        is_valid, issues = validate_sink_config(connector_config, json_file.name)
        if not is_valid:
            skipped_configs[json_file.name] = issues
            print(f"✗ Skipping {json_file.name} due to validation issues:")
            for issue in issues:
                print(f"  - {issue}")
            continue
        
        # Extract required fields
        name = connector_config["name"]
        database = connector_config["database"]
        collection = connector_config["collection"]
        topics = connector_config["topics"]
        connection_user = connector_config["connection.user"]
        connection_password = connector_config["connection.password"]
        
        # Check for DLQ requirement based on errors.tolerance
        enable_dlq = connector_config.get("errors.tolerance", "").lower() == "all"
        
        # Handle optional auto offset reset
        auto_offset_reset = connector_config.get("consumer.override.auto.offset.reset")
        if auto_offset_reset and auto_offset_reset not in ["earliest", "latest"]:
            print(f"✗ Error: auto offset reset must be 'earliest' or 'latest', got '{auto_offset_reset}' in {json_file.name}")
            continue
            
        # Extract optional max poll interval
        max_poll_interval_ms = connector_config.get("max.poll.interval.ms")
        
        
        # Create stream processor if both connections exist
        if mongodb_connection_created and kafka_connection_created:
            stream_processor_success, was_created, processor_name = create_stream_processor(
                connection_user,
                connection_password,
                main_config["mongodb-stream-processor-instance-url"],
                main_config["kafka-connection-name"],
                main_config["mongodb-connection-name"],
                database,
                collection,
                "sink",
                name,
                topics=topics,
                auto_offset_reset=auto_offset_reset,
                enable_dlq=enable_dlq,
                max_poll_interval_ms=max_poll_interval_ms
            )
            
            if stream_processor_success:
                stream_processor_success_count += 1
                if was_created:
                    stream_processor_created_count += 1
                else:
                    existing_processors.append(processor_name)
        else:
            print(f"⚠ Skipping stream processor creation: Required connections not available")
    
    print("-" * 50)
    print(f"Summary:")
    if mongodb_connection_created:
        connection_status = "created" if mongodb_connection_was_created else "reused (already existed)"
        print(f"  MongoDB sink connection: 1/1 {connection_status}")
    else:
        print(f"  MongoDB sink connection: 0/1 created successfully")
    if kafka_connection_created:
        connection_status = "created" if kafka_connection_was_created else "reused (already existed)"
        print(f"  Kafka connection: 1/1 {connection_status}")
    else:
        print(f"  Kafka connection: 0/1 created successfully")
    if existing_processors:
        existing_names = ", ".join(existing_processors)
        print(f"  Stream processors: {stream_processor_created_count}/{total_count} created successfully (processors {existing_names} already exist)")
    else:
        print(f"  Stream processors: {stream_processor_created_count}/{total_count} created successfully")
    
    # Display skipped configurations summary
    if skipped_configs:
        print(f"\n⚠ SKIPPED CONFIGURATIONS ({len(skipped_configs)} files):")
        for filename, issues in skipped_configs.items():
            print(f"  - {filename}:")
            for issue in issues:
                print(f"    • {issue}")
    else:
        print(f"\n✓ All configurations processed successfully")


def main():
    """Main function to handle command-line arguments and orchestrate the process."""
    
    parser = argparse.ArgumentParser(
        description="Create MongoDB sink stream processors from connector configuration files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "main_config",
        help="Path to the main configuration JSON file"
    )
    
    parser.add_argument(
        "configs_folder",
        help="Path to the folder containing connector configuration files"
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
    print(f"  Confluent Cluster ID: {main_config['confluent-cluster-id']}")
    print(f"  Confluent REST Endpoint: {main_config['confluent-rest-endpoint']}")
    print(f"  Stream Processor URL: {main_config['mongodb-stream-processor-instance-url']}")
    print(f"  Kafka Connection Name: {main_config['kafka-connection-name']}")
    print(f"  MongoDB Connection Name: {main_config['mongodb-connection-name']}")
    
    # Process connector configs
    process_connector_configs(main_config, args.configs_folder)


if __name__ == "__main__":
    main()