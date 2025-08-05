#!/usr/bin/env python3
"""
Configuration validation system for MongoDB-Kafka connector configurations.
Supports validation against multiple rule sets (general, source, sink) simultaneously.
"""

import csv
import os
from typing import Dict, Any, List, Tuple, Optional, Set
from dataclasses import dataclass
from enum import Enum


class ValidationAction(Enum):
    """Enumeration of validation actions."""
    REQUIRE = "REQUIRE"
    IGNORE = "IGNORE"
    DISALLOW = "DISALLOW"
    ALLOW_DEFAULT = "ALLOW default"
    ALLOW_VALUES = "ALLOW_VALUES"  # For ALLOW {specific values}
    ALLOW = "ALLOW"


@dataclass
class ValidationRule:
    """Represents a single configuration validation rule."""
    name: str
    action: ValidationAction
    default_value: Optional[str] = None
    valid_values: Optional[str] = None
    allowed_values: Optional[List[str]] = None  # Parsed from ALLOW {values} patterns
    subsection: Optional[str] = None
    definition: Optional[str] = None
    importance: Optional[str] = None


@dataclass
class ValidationResult:
    """Result of configuration validation."""
    is_valid: bool
    missing_required: List[str]
    disallowed_present: List[str]
    error_messages: List[str]


class ConfigValidator:
    """Configuration validator that can load and apply multiple rule sets."""
    
    def __init__(self):
        self.rules: Dict[str, ValidationRule] = {}
        self.rule_sources: Dict[str, str] = {}  # Track which file each rule came from
    
    def load_rules_from_csv(self, csv_file_path: str, rule_source_name: str = None) -> bool:
        """
        Load validation rules from a CSV file.
        
        Args:
            csv_file_path: Path to the CSV file containing rules
            rule_source_name: Optional name to identify the source of rules (for debugging)
            
        Returns:
            True if rules were loaded successfully, False otherwise
        """
        if not os.path.exists(csv_file_path):
            return False
        
        source_name = rule_source_name or os.path.basename(csv_file_path)
        
        try:
            with open(csv_file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                # Expected columns may vary between files, so we'll be flexible
                for row in reader:
                    # Skip empty rows
                    if not any(row.values()):
                        continue
                    
                    # Extract required fields
                    name = row.get('name', '').strip()
                    what_to_do = row.get('what_do_do', row.get('what to do', '')).strip()
                    
                    if not name or not what_to_do:
                        continue
                    
                    # Parse action and extract allowed values for ALLOW {values} patterns
                    action = None
                    allowed_values = None
                    
                    try:
                        action = ValidationAction(what_to_do)
                    except ValueError:
                        # Handle "ALLOW default" as a special case
                        if what_to_do.startswith("ALLOW") and "default" in what_to_do:
                            action = ValidationAction.ALLOW_DEFAULT
                        elif what_to_do.startswith("ALLOW "):
                            # Handle ALLOW {specific values} patterns
                            action = ValidationAction.ALLOW_VALUES
                            # Extract the allowed values from the action string
                            values_part = what_to_do[6:]  # Remove "ALLOW "
                            # Parse comma-separated values and clean them up
                            allowed_values = [v.strip() for v in values_part.replace(" and ", ", ").split(",")]
                            allowed_values = [v for v in allowed_values if v]  # Remove empty strings
                        else:
                            continue  # Skip invalid actions
                    
                    if action is None:
                        continue
                    
                    # Create validation rule
                    rule = ValidationRule(
                        name=name,
                        action=action,
                        default_value=row.get('default', '').strip() or None,
                        valid_values=row.get('valid_values', '').strip() or None,
                        allowed_values=allowed_values,
                        subsection=row.get('subsection', '').strip() or None,
                        definition=row.get('definition', '').strip() or None,
                        importance=row.get('importance', '').strip() or None
                    )
                    
                    # Store rule (later rules override earlier ones)
                    self.rules[name] = rule
                    self.rule_sources[name] = source_name
                    
            return True
            
        except Exception as e:
            print(f"Error loading rules from {csv_file_path}: {e}")
            return False
    
    def load_multiple_rule_files(self, rule_files: List[Tuple[str, str]]) -> bool:
        """
        Load rules from multiple CSV files.
        
        Args:
            rule_files: List of (file_path, source_name) tuples
            
        Returns:
            True if all files were loaded successfully, False otherwise
        """
        success = True
        for file_path, source_name in rule_files:
            if not self.load_rules_from_csv(file_path, source_name):
                success = False
        return success
    
    def validate_config(self, config: Dict[str, Any]) -> ValidationResult:
        """
        Validate a configuration against all loaded rules.
        
        Args:
            config: Configuration dictionary to validate
            
        Returns:
            ValidationResult with validation outcome and details
        """
        missing_required = []
        disallowed_present = []
        error_messages = []
        
        # Check all rules
        for field_name, rule in self.rules.items():
            field_present = field_name in config
            field_value = config.get(field_name)
            
            if rule.action == ValidationAction.REQUIRE:
                if not field_present:
                    missing_required.append(field_name)
                    
            elif rule.action == ValidationAction.DISALLOW:
                if field_present:
                    disallowed_present.append(field_name)
                    
            elif rule.action == ValidationAction.ALLOW_DEFAULT:
                if field_present and rule.default_value is not None:
                    # Convert both to strings for comparison
                    provided_str = str(field_value).strip()
                    default_str = str(rule.default_value).strip()
                    
                    if provided_str != default_str:
                        error_messages.append(f"Only {default_str} is supported for {field_name}")
            
            elif rule.action == ValidationAction.ALLOW_VALUES:
                if field_present and rule.allowed_values is not None:
                    # Convert provided value to string for comparison
                    provided_str = str(field_value).strip()
                    
                    # Check if provided value is in the allowed values list
                    if provided_str not in rule.allowed_values:
                        # Format allowed values as comma-separated list
                        allowed_str = ", ".join(rule.allowed_values)
                        error_messages.append(f"Only {allowed_str} is supported for {field_name}")
            
            # IGNORE and ALLOW actions don't generate validation errors
            # (ALLOW actions will have custom logic implemented later)
        
        # Generate error messages
        if missing_required:
            error_messages.append(
                f"Missing required fields: {', '.join(missing_required)}"
            )
        
        if disallowed_present:
            error_messages.append(
                f"The following fields are not supported: {', '.join(disallowed_present)}"
            )
        
        is_valid = not (missing_required or disallowed_present or error_messages)
        
        return ValidationResult(
            is_valid=is_valid,
            missing_required=missing_required,
            disallowed_present=disallowed_present,
            error_messages=error_messages
        )
    
    def get_required_fields(self) -> List[str]:
        """Get list of all required field names."""
        return [name for name, rule in self.rules.items() 
                if rule.action == ValidationAction.REQUIRE]
    
    def get_disallowed_fields(self) -> List[str]:
        """Get list of all disallowed field names."""
        return [name for name, rule in self.rules.items() 
                if rule.action == ValidationAction.DISALLOW]
    
    def get_rule_summary(self) -> Dict[str, int]:
        """Get summary of rule counts by action type."""
        summary = {}
        for rule in self.rules.values():
            action_name = rule.action.value
            summary[action_name] = summary.get(action_name, 0) + 1
        return summary


def validate_connector_config(
    config: Dict[str, Any], 
    connector_type: str = None,
    rules_path: str = None
) -> ValidationResult:
    """
    Convenience function to validate a connector configuration.
    
    Args:
        config: Configuration dictionary to validate
        connector_type: Either 'source' or 'sink' (auto-detected from connector.class if None)
        rules_path: Path to rules directory (auto-detected if None)
        
    Returns:
        ValidationResult
    """
    if rules_path is None:
        # Auto-detect path relative to this file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        rules_path = os.path.join(current_dir, 'rules')
    
    # Auto-detect connector type from connector.class if not provided
    if connector_type is None:
        connector_class = config.get('connector.class', '')
        if 'Source' in connector_class:
            connector_type = 'source'
        elif 'Sink' in connector_class:
            connector_type = 'sink'
        else:
            raise ValueError(f"Cannot determine connector type from connector.class: '{connector_class}'. Must contain 'Source' or 'Sink'")
    
    validator = ConfigValidator()
    
    # Load general rules (always required)
    general_rules_path = os.path.join(rules_path, 'general_managed_configs.csv')
    
    # Load connector-specific rules
    if connector_type == 'source':
        specific_rules_path = os.path.join(rules_path, 'managed_source_configs.csv')
    elif connector_type == 'sink':
        specific_rules_path = os.path.join(rules_path, 'managed_sink_configs.csv')
    else:
        raise ValueError(f"Invalid connector_type: {connector_type}. Must be 'source' or 'sink'")
    
    # Load both rule sets
    rule_files = [
        (general_rules_path, 'general'),
        (specific_rules_path, connector_type)
    ]
    
    if not validator.load_multiple_rule_files(rule_files):
        raise RuntimeError("Failed to load validation rules")
    
    return validator.validate_config(config)