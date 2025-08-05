#!/usr/bin/env python3
"""
Unit tests for CSV validation rules.

Tests that the validation behavior defined in the CSV files is working correctly:
- IGNORE fields should pass validation
- DISALLOW fields should fail validation with specific error messages
- REQUIRE fields should fail when missing
- ALLOW fields should validate allowed values
"""

import unittest
import sys
import argparse
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from processors.config_validator import validate_connector_config

# Global flag for verbose output
VERBOSE = False


class TestCSVValidationRules(unittest.TestCase):
    """Test that CSV validation rules work as expected."""
    
    def test_ignore_fields_pass_validation(self):
        """Test that configs with IGNORE fields pass validation."""
        # Test source config with IGNORE fields from the CSV
        source_config_with_ignore = {
            "connector.class": "MongoDbAtlasSource",
            "name": "test-source",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "topic.prefix": "test-prefix",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "database": "test-db",
            "collection": "test-collection",
            # IGNORE fields from CSV - these should not cause validation to fail
            "connection.host": "test-host",  # IGNORE in general_managed_configs.csv
            "poll.await.time.ms": "5000",    # IGNORE in managed_source_configs.csv
            "poll.max.batch.size": "100",    # IGNORE in managed_source_configs.csv
            "tasks.max": "1",                # IGNORE in general_managed_configs.csv
            "batch.size": "0",               # IGNORE in managed_source_configs.csv
            "heartbeat.interval.ms": "0",    # IGNORE in managed_source_configs.csv
            "server.api.version": "1",       # IGNORE in general_managed_configs.csv
            "mongo.errors.tolerance": "NONE" # IGNORE in general_managed_configs.csv
        }
        
        result = validate_connector_config(source_config_with_ignore)
        
        if VERBOSE:
            print(f"\n--- IGNORE FIELDS TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should pass validation despite having IGNORE fields
        self.assertTrue(result.is_valid, 
                       f"Config with IGNORE fields should pass validation. Errors: {result.error_messages}")
        self.assertEqual(len(result.error_messages), 0, 
                        f"Should have no errors, but got: {result.error_messages}")
    
    def test_disallow_fields_fail_validation(self):
        """Test that configs with DISALLOW fields fail validation with specific errors."""
        # Test source config with DISALLOW fields from the CSV
        source_config_with_disallow = {
            "connector.class": "MongoDbAtlasSource", 
            "name": "test-source",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "topic.prefix": "test-prefix",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "database": "test-db",
            "collection": "test-collection",
            # DISALLOW fields from CSV - these should cause validation to fail
            "topic.namespace.map": '{"test.collection": "test-topic"}',  # DISALLOW in managed_source_configs.csv
            "startup.mode.timestamp.start.at.operation.time": "2023-01-01T00:00:00Z",  # DISALLOW in managed_source_configs.csv
            "publish.full.document.only.tombstone.on.delete": "true",    # DISALLOW in managed_source_configs.csv
            "schema.context.name": "test-context",                       # DISALLOW in general_managed_configs.csv
            "kafka.service.account.id": "test-account-id"                # DISALLOW in general_managed_configs.csv
        }
        
        result = validate_connector_config(source_config_with_disallow)
        
        if VERBOSE:
            print(f"\n--- DISALLOW FIELDS TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should fail validation
        self.assertFalse(result.is_valid, 
                        "Config with DISALLOW fields should fail validation")
        
        # Should have specific error messages about disallowed fields
        self.assertGreater(len(result.error_messages), 0, 
                          "Should have error messages for DISALLOW fields")
        
        # Check that all disallowed fields are mentioned in error messages
        error_text = " ".join(result.error_messages).lower()
        disallowed_fields = [
            "topic.namespace.map",
            "startup.mode.timestamp.start.at.operation.time", 
            "publish.full.document.only.tombstone.on.delete",
            "schema.context.name",
            "kafka.service.account.id"
        ]
        
        for field in disallowed_fields:
            self.assertIn(field.lower(), error_text, 
                         f"Error message should mention disallowed field '{field}'. Got: {result.error_messages}")
    
    def test_sink_ignore_fields_pass_validation(self):
        """Test that sink configs with IGNORE fields pass validation."""
        sink_config_with_ignore = {
            "connector.class": "MongoDbAtlasSink",
            "name": "test-sink", 
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "topics": "test-topic",
            "database": "test-db",
            "collection": "test-collection",
            # IGNORE fields from sink CSV
            "max.batch.size": "100",           # IGNORE in managed_sink_configs.csv
            "bulk.write.ordered": "true",      # IGNORE in managed_sink_configs.csv
            "rate.limiting.timeout": "5000",   # IGNORE in managed_sink_configs.csv
            "max.num.retries": "3",            # IGNORE in managed_sink_configs.csv
            "max.poll.interval.ms": "300000",  # ALLOW in managed_sink_configs.csv
            "max.poll.records": "500"          # IGNORE in managed_sink_configs.csv
        }
        
        result = validate_connector_config(sink_config_with_ignore)
        
        if VERBOSE:
            print(f"\n--- SINK IGNORE FIELDS TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should pass validation despite having IGNORE fields
        self.assertTrue(result.is_valid,
                       f"Sink config with IGNORE fields should pass validation. Errors: {result.error_messages}")
        self.assertEqual(len(result.error_messages), 0,
                        f"Should have no errors, but got: {result.error_messages}")
    
    def test_sink_disallow_fields_fail_validation(self):
        """Test that sink configs with DISALLOW fields fail validation."""
        sink_config_with_disallow = {
            "connector.class": "MongoDbAtlasSink",
            "name": "test-sink",
            "kafka.auth.mode": "KAFKA_API_KEY", 
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "topics": "test-topic",
            "database": "test-db",
            "collection": "test-collection",
            # DISALLOW fields from sink CSV
            "key.projection.type": "AllowList",              # DISALLOW in managed_sink_configs.csv
            "value.projection.type": "BlockList",            # DISALLOW in managed_sink_configs.csv
            "namespace.mapper.class": "CustomMapper",        # DISALLOW in managed_sink_configs.csv
            "timeseries.timefield": "timestamp",             # DISALLOW in managed_sink_configs.csv
            "csfle.enabled": "true"                          # DISALLOW in managed_sink_configs.csv
        }
        
        result = validate_connector_config(sink_config_with_disallow)
        
        if VERBOSE:
            print(f"\n--- SINK DISALLOW FIELDS TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should fail validation
        self.assertFalse(result.is_valid,
                        "Sink config with DISALLOW fields should fail validation")
        
        # Check for specific disallowed fields in error messages
        error_text = " ".join(result.error_messages).lower()
        disallowed_fields = [
            "key.projection.type",
            "value.projection.type", 
            "namespace.mapper.class",
            "timeseries.timefield",
            "csfle.enabled"
        ]
        
        for field in disallowed_fields:
            self.assertIn(field.lower(), error_text,
                         f"Error message should mention disallowed field '{field}'. Got: {result.error_messages}")
    
    def test_missing_required_fields_fail_validation(self):
        """Test that configs missing REQUIRE fields fail validation."""
        # Config missing required fields
        incomplete_source_config = {
            "connector.class": "MongoDbAtlasSource",
            # Missing required fields: name, kafka.api.key, kafka.api.secret, etc.
            "topic.prefix": "test-prefix",
            "database": "test-db"
        }
        
        result = validate_connector_config(incomplete_source_config)
        
        if VERBOSE:
            print(f"\n--- MISSING REQUIRED FIELDS TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should fail validation
        self.assertFalse(result.is_valid,
                        "Config missing required fields should fail validation")
        
        # Should have error messages about missing fields
        self.assertGreater(len(result.error_messages), 0,
                          "Should have error messages for missing required fields")
        
        # Check for specific required fields in error messages
        error_text = " ".join(result.error_messages).lower()
        required_fields = ["name", "kafka.api.key", "kafka.api.secret", "connection.user", "connection.password"]
        
        for field in required_fields:
            self.assertIn(field.lower(), error_text,
                         f"Error message should mention missing required field '{field}'. Got: {result.error_messages}")
    
    def test_source_required_fields_comprehensive(self):
        """Test all required fields for source configs."""
        # Test with minimal config - missing most required fields
        minimal_config = {
            "connector.class": "MongoDbAtlasSource"
        }
        
        result = validate_connector_config(minimal_config)
        
        if VERBOSE:
            print(f"\n--- SOURCE REQUIRED FIELDS COMPREHENSIVE ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should fail validation
        self.assertFalse(result.is_valid, "Minimal config should fail validation")
        
        # Check that all required fields from CSV are caught
        # Note: collection is now optional for source connectors
        expected_required_fields = [
            "name", "kafka.api.key", "kafka.api.secret", "connection.user", 
            "connection.password", "database", "topic.prefix"
        ]
        
        # Verify these fields are mentioned in missing_required or error_messages
        missing_fields_text = " ".join(result.missing_required).lower()
        error_text = " ".join(result.error_messages).lower()
        combined_text = missing_fields_text + " " + error_text
        
        for field in expected_required_fields:
            self.assertIn(field.lower(), combined_text,
                         f"Required field '{field}' should be mentioned in validation errors")
    
    def test_sink_required_fields_comprehensive(self):
        """Test all required fields for sink configs."""
        # Test with minimal sink config - missing most required fields
        minimal_sink_config = {
            "connector.class": "MongoDbAtlasSink"
        }
        
        result = validate_connector_config(minimal_sink_config)
        
        if VERBOSE:
            print(f"\n--- SINK REQUIRED FIELDS COMPREHENSIVE ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should fail validation
        self.assertFalse(result.is_valid, "Minimal sink config should fail validation")
        
        # Check that all required fields from CSV are caught
        expected_required_fields = [
            "name", "kafka.api.key", "kafka.api.secret", "connection.user",
            "connection.password", "database", "collection", "topics"
        ]
        
        # Verify these fields are mentioned in missing_required or error_messages
        missing_fields_text = " ".join(result.missing_required).lower()
        error_text = " ".join(result.error_messages).lower()
        combined_text = missing_fields_text + " " + error_text
        
        for field in expected_required_fields:
            self.assertIn(field.lower(), combined_text,
                         f"Required field '{field}' should be mentioned in validation errors")
    
    def test_connector_class_required(self):
        """Test that connector.class field is required."""
        config_without_connector_class = {
            "name": "test-connector",
            "kafka.api.key": "test-key"
        }
        
        # Should raise ValueError when connector.class is missing or invalid
        with self.assertRaises(ValueError) as context:
            validate_connector_config(config_without_connector_class)
        
        if VERBOSE:
            print(f"\n--- CONNECTOR.CLASS REQUIRED TEST ---")
            print(f"Exception raised: {context.exception}")
        
        # Should mention connector.class in the error message
        error_message = str(context.exception).lower()
        self.assertIn("connector.class", error_message,
                     f"Error should mention connector.class. Got: {context.exception}")
    
    def test_invalid_connector_class(self):
        """Test that invalid connector.class values are rejected."""
        config_with_invalid_connector_class = {
            "connector.class": "InvalidConnector",
            "name": "test-connector",
            "kafka.api.key": "test-key"
        }
        
        # Should raise ValueError for invalid connector.class
        with self.assertRaises(ValueError) as context:
            validate_connector_config(config_with_invalid_connector_class)
        
        if VERBOSE:
            print(f"\n--- INVALID CONNECTOR.CLASS TEST ---")
            print(f"Exception raised: {context.exception}")
        
        # Should mention the invalid connector class
        error_message = str(context.exception).lower()
        self.assertIn("invalidconnector", error_message,
                     f"Error should mention the invalid connector class. Got: {context.exception}")
    
    def test_source_specific_ignore_fields(self):
        """Test IGNORE fields that are specific to source configs only."""
        source_config_with_source_specific_ignore = {
            "connector.class": "MongoDbAtlasSource",
            "name": "test-source",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "topic.prefix": "test-prefix",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "database": "test-db",
            "collection": "test-collection",
            # Source-specific IGNORE fields from managed_source_configs.csv
            "output.schema.key": '{"type": "record"}',     # IGNORE in source configs only
            "output.schema.value": '{"type": "record"}',   # IGNORE in source configs only
            "linger.ms": "100",                            # IGNORE in source configs only
            "producer.batch.size": "16384",                # IGNORE in source configs only
            "heartbeat.topic.name": "__mongodb_heartbeats" # IGNORE in source configs only
        }
        
        result = validate_connector_config(source_config_with_source_specific_ignore)
        
        if VERBOSE:
            print(f"\n--- SOURCE-SPECIFIC IGNORE FIELDS TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should pass validation with source-specific IGNORE fields
        self.assertTrue(result.is_valid,
                       f"Source config with source-specific IGNORE fields should pass. Errors: {result.error_messages}")
    
    def test_source_specific_disallow_fields(self):
        """Test DISALLOW fields that are specific to source configs only."""
        source_config_with_source_specific_disallow = {
            "connector.class": "MongoDbAtlasSource",
            "name": "test-source",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "topic.prefix": "test-prefix",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "database": "test-db",
            "collection": "test-collection",
            # Source-specific DISALLOW fields from managed_source_configs.csv
            "output.schema.infer.value": "false",                    # DISALLOW in source configs only
            "remove.field.on.schema.mismatch": "false",              # DISALLOW in source configs only
            "offset.partition.name": "custom-partition"              # DISALLOW in source configs only
        }
        
        result = validate_connector_config(source_config_with_source_specific_disallow)
        
        if VERBOSE:
            print(f"\n--- SOURCE-SPECIFIC DISALLOW FIELDS TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should fail validation with source-specific DISALLOW fields
        self.assertFalse(result.is_valid,
                        "Source config with source-specific DISALLOW fields should fail")
        
        # Check for source-specific disallowed fields
        error_text = " ".join(result.error_messages).lower()
        source_disallowed_fields = [
            "output.schema.infer.value",
            "remove.field.on.schema.mismatch", 
            "offset.partition.name"
        ]
        
        for field in source_disallowed_fields:
            self.assertIn(field.lower(), error_text,
                         f"Error should mention source-specific disallowed field '{field}'. Got: {result.error_messages}")
    
    def test_sink_specific_ignore_fields(self):
        """Test IGNORE fields that are specific to sink configs only."""
        sink_config_with_sink_specific_ignore = {
            "connector.class": "MongoDbAtlasSink",
            "name": "test-sink",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "topics": "test-topic",
            "database": "test-db",
            "collection": "test-collection",
            # Sink-specific IGNORE fields from managed_sink_configs.csv
            "rate.limiting.every.n": "10",         # IGNORE in sink configs only
            "retries.defer.timeout": "5000"        # IGNORE in sink configs only
        }
        
        result = validate_connector_config(sink_config_with_sink_specific_ignore)
        
        if VERBOSE:
            print(f"\n--- SINK-SPECIFIC IGNORE FIELDS TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should pass validation with sink-specific IGNORE fields
        self.assertTrue(result.is_valid,
                       f"Sink config with sink-specific IGNORE fields should pass. Errors: {result.error_messages}")
    
    def test_sink_specific_disallow_fields(self):
        """Test DISALLOW fields that are specific to sink configs only."""
        sink_config_with_sink_specific_disallow = {
            "connector.class": "MongoDbAtlasSink",
            "name": "test-sink",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "topics": "test-topic",
            "database": "test-db",
            "collection": "test-collection",
            # Sink-specific DISALLOW fields from managed_sink_configs.csv
            "namespace.mapper.key.database.field": "keyDb",        # DISALLOW in sink configs only
            "namespace.mapper.value.collection.field": "valueColl", # DISALLOW in sink configs only
            "timeseries.metafield": "metadata",                    # DISALLOW in sink configs only
            "ts.granularity": "minutes",                           # DISALLOW in sink configs only
            "sr.service.account.id": "test-account"                # DISALLOW in sink configs only
        }
        
        result = validate_connector_config(sink_config_with_sink_specific_disallow)
        
        if VERBOSE:
            print(f"\n--- SINK-SPECIFIC DISALLOW FIELDS TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should fail validation with sink-specific DISALLOW fields
        self.assertFalse(result.is_valid,
                        "Sink config with sink-specific DISALLOW fields should fail")
        
        # Check for sink-specific disallowed fields
        error_text = " ".join(result.error_messages).lower()
        sink_disallowed_fields = [
            "namespace.mapper.key.database.field",
            "namespace.mapper.value.collection.field",
            "timeseries.metafield",
            "ts.granularity",
            "sr.service.account.id"
        ]
        
        for field in sink_disallowed_fields:
            self.assertIn(field.lower(), error_text,
                         f"Error should mention sink-specific disallowed field '{field}'. Got: {result.error_messages}")
    
    def test_source_required_vs_sink_required(self):
        """Test that source and sink have different required fields."""
        # Source should require topic.prefix but not topics
        source_missing_topic_prefix = {
            "connector.class": "MongoDbAtlasSource",
            "name": "test-source",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "database": "test-db",
            "collection": "test-collection"
            # Missing topic.prefix (required for source)
        }
        
        result = validate_connector_config(source_missing_topic_prefix)
        
        if VERBOSE:
            print(f"\n--- SOURCE MISSING TOPIC.PREFIX TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
        
        # Should fail and mention topic.prefix
        self.assertFalse(result.is_valid, "Source should require topic.prefix")
        error_text = " ".join(result.error_messages + result.missing_required).lower()
        self.assertIn("topic.prefix", error_text, "Should require topic.prefix for source")
        
        # Sink should require topics but not topic.prefix
        sink_missing_topics = {
            "connector.class": "MongoDbAtlasSink", 
            "name": "test-sink",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "database": "test-db",
            "collection": "test-collection"
            # Missing topics (required for sink)
        }
        
        result = validate_connector_config(sink_missing_topics)
        
        if VERBOSE:
            print(f"\n--- SINK MISSING TOPICS TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
        
        # Should fail and mention topics
        self.assertFalse(result.is_valid, "Sink should require topics")
        error_text = " ".join(result.error_messages + result.missing_required).lower()
        self.assertIn("topics", error_text, "Should require topics for sink")
    
    def test_source_allow_default_valid_values(self):
        """Test that source ALLOW default fields accept their default values."""
        # Test source config with general and source-specific ALLOW default fields
        source_config_with_allow_defaults = {
            "connector.class": "MongoDbAtlasSource",
            "name": "test-source",
            "kafka.auth.mode": "KAFKA_API_KEY",    # ALLOW default (general)
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "topic.prefix": "test-prefix",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "database": "test-db",
            "collection": "test-collection",
            # Source-specific ALLOW default fields
            "output.data.format": "JSON",          # ALLOW JSON (source-specific)
            "output.key.format": "STRING"          # ALLOW STRING (source-specific)
        }
        
        result = validate_connector_config(source_config_with_allow_defaults)
        
        if VERBOSE:
            print(f"\n--- SOURCE ALLOW DEFAULT VALID VALUES TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should pass validation with default values
        self.assertTrue(result.is_valid,
                       f"Source config with ALLOW default values should pass. Errors: {result.error_messages}")
    
    def test_source_allow_default_invalid_values(self):
        """Test that source ALLOW default fields reject non-default values."""
        # Test source config with ALLOW default fields set to invalid values
        source_config_with_invalid_defaults = {
            "connector.class": "MongoDbAtlasSource",
            "name": "test-source",
            "kafka.auth.mode": "INVALID_MODE",     # ALLOW default KAFKA_API_KEY, but set to invalid
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "topic.prefix": "test-prefix",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "database": "test-db",
            "collection": "test-collection",
            "output.data.format": "INVALID_FORMAT" # ALLOW default STRING, but set to invalid
        }
        
        result = validate_connector_config(source_config_with_invalid_defaults)
        
        if VERBOSE:
            print(f"\n--- SOURCE ALLOW DEFAULT INVALID VALUES TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should fail validation with invalid default values
        self.assertFalse(result.is_valid,
                        "Source config with invalid ALLOW default values should fail")
        
        # Should mention the invalid fields
        error_text = " ".join(result.error_messages).lower()
        invalid_fields = ["kafka.auth.mode", "output.data.format"]
        
        for field in invalid_fields:
            self.assertIn(field.lower(), error_text,
                         f"Error should mention invalid field '{field}'. Got: {result.error_messages}")
    
    def test_source_allow_specific_values_valid(self):
        """Test that source ALLOW fields with specific allowed values accept those values."""
        # Test source config with ALLOW fields set to valid specific values
        source_config_with_valid_allow_values = {
            "connector.class": "MongoDbAtlasSource",
            "name": "test-source",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "topic.prefix": "test-prefix",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "database": "test-db",
            "collection": "test-collection",
            # General ALLOW field with specific values
            "errors.tolerance": "all",                   # ALLOW all (general)
            # Source-specific ALLOW fields with specific valid values
            "startup.mode": "latest",                    # ALLOW latest, copy_existing (source-specific)
            "output.data.format": "JSON",                # ALLOW with multiple values (source-specific)
            "output.json.format": "ExtendedJson"         # ALLOW DefaultJson, ExtendedJson, SimplifiedJson (source-specific)
        }
        
        result = validate_connector_config(source_config_with_valid_allow_values)
        
        if VERBOSE:
            print(f"\n--- SOURCE ALLOW SPECIFIC VALID VALUES TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should pass validation with valid allowed values
        self.assertTrue(result.is_valid,
                       f"Source config with valid ALLOW values should pass. Errors: {result.error_messages}")
    
    def test_source_allow_specific_values_invalid(self):
        """Test that source ALLOW fields with specific allowed values reject invalid values."""
        # Test source config with ALLOW fields set to invalid values
        source_config_with_invalid_allow_values = {
            "connector.class": "MongoDbAtlasSource",
            "name": "test-source",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "topic.prefix": "test-prefix",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "database": "test-db",
            "collection": "test-collection",
            # General ALLOW field with invalid value
            "errors.tolerance": "invalid_tolerance",     # ALLOW all, but set to invalid
            # Source-specific ALLOW fields with invalid values
            "startup.mode": "invalid_mode",              # ALLOW latest, copy_existing - but set to invalid
            "output.json.format": "InvalidFormat"        # ALLOW DefaultJson, ExtendedJson, SimplifiedJson - but set to invalid
        }
        
        result = validate_connector_config(source_config_with_invalid_allow_values)
        
        if VERBOSE:
            print(f"\n--- SOURCE ALLOW SPECIFIC INVALID VALUES TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should fail validation with invalid allowed values
        self.assertFalse(result.is_valid,
                        "Source config with invalid ALLOW values should fail")
        
        # Should mention the invalid fields
        error_text = " ".join(result.error_messages).lower()
        invalid_fields = ["errors.tolerance", "startup.mode", "output.json.format"]
        
        for field in invalid_fields:
            self.assertIn(field.lower(), error_text,
                         f"Error should mention invalid field '{field}'. Got: {result.error_messages}")
    
    def test_source_allow_unrestricted_fields(self):
        """Test source ALLOW fields with no value restrictions."""
        # Test source config with ALLOW fields that accept any value
        source_config_with_unrestricted_allow = {
            "connector.class": "MongoDbAtlasSource",
            "name": "test-source",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "topic.prefix": "test-prefix",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "database": "test-db",
            "collection": "test-collection",
            # Source-specific ALLOW fields with no restrictions
            "pipeline": "[{\"$match\": {\"field\": \"value\"}}]",    # ALLOW (no restrictions)
            "topic.separator": "_",                               # ALLOW (no restrictions)
            "topic.suffix": "-data"                               # ALLOW (no restrictions)
        }
        
        result = validate_connector_config(source_config_with_unrestricted_allow)
        
        if VERBOSE:
            print(f"\n--- SOURCE ALLOW UNRESTRICTED FIELDS TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should pass with unrestricted ALLOW fields
        self.assertTrue(result.is_valid,
                       f"Source config with unrestricted ALLOW fields should pass. Errors: {result.error_messages}")
    
    def test_sink_allow_default_valid_values(self):
        """Test that sink ALLOW default fields accept their default values."""
        # Test sink config with general and sink-specific ALLOW default fields
        sink_config_with_allow_defaults = {
            "connector.class": "MongoDbAtlasSink",
            "name": "test-sink",
            "kafka.auth.mode": "KAFKA_API_KEY",    # ALLOW default (general)
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "topics": "test-topic",
            "database": "test-db",
            "collection": "test-collection",
            # Sink-specific ALLOW default fields
            "input.data.format": "JSON",           # ALLOW default JSON (sink-specific)
            "input.key.format": "STRING",          # ALLOW default STRING (sink-specific)
            "doc.id.strategy": "BsonOidStrategy",  # ALLOW default BsonOidStrategy (sink-specific)
            "delete.on.null.values": "FALSE"      # ALLOW default FALSE (sink-specific)
        }
        
        result = validate_connector_config(sink_config_with_allow_defaults)
        
        if VERBOSE:
            print(f"\n--- SINK ALLOW DEFAULT VALID VALUES TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should pass validation with default values
        self.assertTrue(result.is_valid,
                       f"Sink config with ALLOW default values should pass. Errors: {result.error_messages}")
    
    def test_sink_allow_default_invalid_values(self):
        """Test that sink ALLOW default fields reject non-default values."""
        # Test sink config with ALLOW default fields set to invalid values
        sink_config_with_invalid_defaults = {
            "connector.class": "MongoDbAtlasSink",
            "name": "test-sink",
            "kafka.auth.mode": "INVALID_MODE",     # ALLOW default KAFKA_API_KEY, but set to invalid
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "topics": "test-topic",
            "database": "test-db",
            "collection": "test-collection",
            "input.data.format": "INVALID_FORMAT", # ALLOW default JSON, but set to invalid
            "doc.id.strategy": "InvalidStrategy"   # ALLOW default BsonOidStrategy, but set to invalid
        }
        
        result = validate_connector_config(sink_config_with_invalid_defaults)
        
        if VERBOSE:
            print(f"\n--- SINK ALLOW DEFAULT INVALID VALUES TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should fail validation with invalid default values
        self.assertFalse(result.is_valid,
                        "Sink config with invalid ALLOW default values should fail")
        
        # Should mention the invalid fields
        error_text = " ".join(result.error_messages).lower()
        invalid_fields = ["kafka.auth.mode", "input.data.format", "doc.id.strategy"]
        
        for field in invalid_fields:
            self.assertIn(field.lower(), error_text,
                         f"Error should mention invalid field '{field}'. Got: {result.error_messages}")
    
    def test_sink_allow_specific_values_valid(self):
        """Test that sink ALLOW fields with specific allowed values accept those values."""
        # Test sink config with ALLOW fields set to valid specific values
        sink_config_with_valid_allow_values = {
            "connector.class": "MongoDbAtlasSink",
            "name": "test-sink",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "topics": "test-topic",
            "database": "test-db",
            "collection": "test-collection",
            # General ALLOW field with specific values
            "errors.tolerance": "all",                         # ALLOW all (general)
            # Sink-specific ALLOW fields with specific valid values
            "consumer.override.auto.offset.reset": "earliest", # ALLOW earliest, latest (sink-specific)
            "write.strategy": "DefaultWriteModelStrategy"      # ALLOW default (sink-specific)
        }
        
        result = validate_connector_config(sink_config_with_valid_allow_values)
        
        if VERBOSE:
            print(f"\n--- SINK ALLOW SPECIFIC VALID VALUES TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should pass validation with valid allowed values
        self.assertTrue(result.is_valid,
                       f"Sink config with valid ALLOW values should pass. Errors: {result.error_messages}")
    
    def test_sink_allow_specific_values_invalid(self):
        """Test that sink ALLOW fields with specific allowed values reject invalid values."""
        # Test sink config with ALLOW fields set to invalid values
        sink_config_with_invalid_allow_values = {
            "connector.class": "MongoDbAtlasSink",
            "name": "test-sink",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "topics": "test-topic",
            "database": "test-db",
            "collection": "test-collection",
            # General ALLOW field with invalid value
            "errors.tolerance": "invalid_tolerance",           # ALLOW all, but set to invalid
            # Sink-specific ALLOW fields with invalid values
            "consumer.override.auto.offset.reset": "invalid",  # ALLOW earliest, latest - but set to invalid
            "write.strategy": "InvalidStrategy"                # ALLOW valid strategies - but set to invalid
        }
        
        result = validate_connector_config(sink_config_with_invalid_allow_values)
        
        if VERBOSE:
            print(f"\n--- SINK ALLOW SPECIFIC INVALID VALUES TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should fail validation with invalid allowed values
        self.assertFalse(result.is_valid,
                        "Sink config with invalid ALLOW values should fail")
        
        # Should mention the invalid fields
        error_text = " ".join(result.error_messages).lower()
        invalid_fields = ["errors.tolerance", "consumer.override.auto.offset.reset", "write.strategy"]
        
        for field in invalid_fields:
            self.assertIn(field.lower(), error_text,
                         f"Error should mention invalid field '{field}'. Got: {result.error_messages}")
    
    def test_sink_allow_unrestricted_fields(self):
        """Test sink ALLOW fields with no value restrictions."""
        # Test sink config with ALLOW fields that accept any value
        sink_config_with_unrestricted_allow = {
            "connector.class": "MongoDbAtlasSink",
            "name": "test-sink",
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": "test-key",
            "kafka.api.secret": "test-secret",
            "connection.user": "test-user",
            "connection.password": "test-password",
            "topics": "test-topic",
            "database": "test-db",
            "collection": "test-collection",
            # Sink-specific ALLOW fields  
            "input.data.format": "JSON" # ALLOW default (accepts default value)
        }
        
        result = validate_connector_config(sink_config_with_unrestricted_allow)
        
        if VERBOSE:
            print(f"\n--- SINK ALLOW UNRESTRICTED FIELDS TEST ---")
            print(f"Validation result: {result.is_valid}")
            print(f"Error messages: {result.error_messages}")
            print(f"Missing required: {result.missing_required}")
            print(f"Disallowed present: {result.disallowed_present}")
        
        # Should pass with unrestricted ALLOW fields
        self.assertTrue(result.is_valid,
                       f"Sink config with unrestricted ALLOW fields should pass. Errors: {result.error_messages}")
    
    def test_max_poll_interval_ms_validation(self):
        """Test that max.poll.interval.ms ALLOW field accepts valid values."""
        # Test various valid values for max.poll.interval.ms
        valid_values = ["300000", "600000", "60000", "1800000"]
        
        for value in valid_values:
            sink_config = {
                "connector.class": "MongoDbAtlasSink",
                "name": "test-sink",
                "kafka.auth.mode": "KAFKA_API_KEY",
                "kafka.api.key": "test-key",
                "kafka.api.secret": "test-secret",
                "connection.user": "test-user",
                "connection.password": "test-password",
                "topics": "test-topic",
                "database": "test-db",
                "collection": "test-collection",
                "max.poll.interval.ms": value
            }
            
            result = validate_connector_config(sink_config)
            
            if VERBOSE:
                print(f"\n--- MAX POLL INTERVAL MS TEST ({value}) ---")
                print(f"Validation result: {result.is_valid}")
                print(f"Error messages: {result.error_messages}")
            
            # Should pass validation with valid max.poll.interval.ms values
            self.assertTrue(result.is_valid,
                           f"Sink config with max.poll.interval.ms={value} should pass validation. Errors: {result.error_messages}")


if __name__ == '__main__':
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Test CSV validation rules')
    parser.add_argument('-v', '--verbose', action='store_true', 
                       help='Show detailed validation output')
    
    args, unittest_args = parser.parse_known_args()
    
    # Set global verbose flag
    VERBOSE = args.verbose
    
    # Run unittest with remaining args
    sys.argv = [sys.argv[0]] + unittest_args
    unittest.main(verbosity=2)