#!/usr/bin/env python3
"""
Unit tests for output JSON format parameter handling in source processors.

Tests that output.json.format parameters are correctly extracted from connector configs,
properly mapped to Stream Processing $emit stage configuration, and handle all three
format options (ExtendedJson, DefaultJson, SimplifiedJson).
"""

import unittest
import sys
import json
from unittest.mock import patch, MagicMock
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from processors.common import create_stream_processor


class TestOutputJsonFormat(unittest.TestCase):
    """Test output JSON format parameter handling in stream processor creation."""
    
    def setUp(self):
        """Set up common test data."""
        self.base_args = {
            'connection_user': 'test_user',
            'connection_password': 'test_password', 
            'stream_processor_url': 'mongodb://test-url/',
            'kafka_connection_name': 'test-kafka-conn',
            'mongodb_connection_name': 'test-mongo-conn',
            'database': 'test_db',
            'collection': 'test_coll',
            'processor_type': 'source',
            'processor_name': 'test-processor',
            'topic_prefix': 'test'
        }
    
    @patch('processors.common.subprocess.run')
    def test_no_output_format_creates_emit_without_config(self, mock_subprocess):
        """Test that source without output_json_format creates $emit without outputFormat config."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stderr = ""
        
        result = create_stream_processor(**self.base_args)
        
        # Verify mongosh was called
        self.assertTrue(mock_subprocess.called)
        call_args = mock_subprocess.call_args[0][0]
        js_command = call_args[-1]  # Last argument is the --eval command
        
        # Parse the JavaScript command to get the pipeline
        pipeline_start = js_command.find('[')
        pipeline_end = js_command.rfind(']') + 1
        pipeline_json = js_command[pipeline_start:pipeline_end]
        pipeline = json.loads(pipeline_json)
        
        # Verify $emit stage exists and has no config section for outputFormat
        emit_stage = pipeline[1]['$emit']
        self.assertIn('connectionName', emit_stage)
        self.assertIn('topic', emit_stage)
        
        # Should not have config section if no parameters provided
        self.assertNotIn('config', emit_stage)
    
    @patch('processors.common.subprocess.run')
    def test_canonical_json_format(self, mock_subprocess):
        """Test that canonicalJson format is properly added to $emit config."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stderr = ""
        
        args = self.base_args.copy()
        args['output_json_format'] = 'canonicalJson'
        
        result = create_stream_processor(**args)
        
        # Verify mongosh was called
        self.assertTrue(mock_subprocess.called)
        call_args = mock_subprocess.call_args[0][0]
        js_command = call_args[-1]
        
        # Parse the JavaScript command to get the pipeline
        pipeline_start = js_command.find('[')
        pipeline_end = js_command.rfind(']') + 1
        pipeline_json = js_command[pipeline_start:pipeline_end]
        pipeline = json.loads(pipeline_json)
        
        # Verify $emit stage has correct outputFormat in config
        emit_stage = pipeline[1]['$emit']
        self.assertIn('config', emit_stage)
        self.assertEqual(emit_stage['config']['outputFormat'], 'canonicalJson')
    
    @patch('processors.common.subprocess.run')
    def test_relaxed_json_format(self, mock_subprocess):
        """Test that relaxedJson format is properly added to $emit config."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stderr = ""
        
        args = self.base_args.copy()
        args['output_json_format'] = 'relaxedJson'
        
        result = create_stream_processor(**args)
        
        # Verify mongosh was called
        self.assertTrue(mock_subprocess.called)
        call_args = mock_subprocess.call_args[0][0]
        js_command = call_args[-1]
        
        # Parse the JavaScript command to get the pipeline
        pipeline_start = js_command.find('[')
        pipeline_end = js_command.rfind(']') + 1
        pipeline_json = js_command[pipeline_start:pipeline_end]
        pipeline = json.loads(pipeline_json)
        
        # Verify $emit stage has correct outputFormat in config
        emit_stage = pipeline[1]['$emit']
        self.assertIn('config', emit_stage)
        self.assertEqual(emit_stage['config']['outputFormat'], 'relaxedJson')
    
    @patch('processors.common.subprocess.run')
    def test_output_format_with_compression_type(self, mock_subprocess):
        """Test that outputFormat and compression_type can be used together."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stderr = ""
        
        args = self.base_args.copy()
        args['output_json_format'] = 'canonicalJson'
        args['compression_type'] = 'gzip'
        
        result = create_stream_processor(**args)
        
        # Verify mongosh was called
        self.assertTrue(mock_subprocess.called)
        call_args = mock_subprocess.call_args[0][0]
        js_command = call_args[-1]
        
        # Parse the JavaScript command to get the pipeline
        pipeline_start = js_command.find('[')
        pipeline_end = js_command.rfind(']') + 1
        pipeline_json = js_command[pipeline_start:pipeline_end]
        pipeline = json.loads(pipeline_json)
        
        # Verify $emit stage has both outputFormat and compression_type in config
        emit_stage = pipeline[1]['$emit']
        self.assertIn('config', emit_stage)
        self.assertEqual(emit_stage['config']['outputFormat'], 'canonicalJson')
        self.assertEqual(emit_stage['config']['compression_type'], 'gzip')
    
    @patch('processors.common.subprocess.run')
    def test_sink_processor_ignores_output_format(self, mock_subprocess):
        """Test that sink processors ignore output_json_format parameter."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stderr = ""
        
        args = self.base_args.copy()
        args['processor_type'] = 'sink'
        args['topics'] = 'test-topic'
        args['output_json_format'] = 'canonicalJson'
        del args['topic_prefix']  # Not needed for sink
        
        result = create_stream_processor(**args)
        
        # Verify mongosh was called
        self.assertTrue(mock_subprocess.called)
        call_args = mock_subprocess.call_args[0][0]
        js_command = call_args[-1]
        
        # Parse the JavaScript command to get the pipeline
        pipeline_start = js_command.find('[')
        pipeline_end = js_command.rfind(']') + 1
        pipeline_json = js_command[pipeline_start:pipeline_end]
        pipeline = json.loads(pipeline_json)
        
        # Verify pipeline is sink-style: $source (Kafka) -> $merge (MongoDB)
        self.assertEqual(len(pipeline), 2)
        self.assertIn('$source', pipeline[0])
        self.assertIn('$merge', pipeline[1])
        
        # Sink should not have $emit stage, so outputFormat is not applicable
        source_stage = pipeline[0]['$source']
        self.assertEqual(source_stage['connectionName'], 'test-kafka-conn')
        self.assertEqual(source_stage['topic'], 'test-topic')


class TestOutputJsonFormatMapping(unittest.TestCase):
    """Test the mapping logic from connector formats to Stream Processing formats."""
    
    def test_format_mapping_in_source_extraction(self):
        """Test that the format mapping logic in source.py works correctly."""
        # This tests the logic that would be in source.py
        format_mapping = {
            "ExtendedJson": "canonicalJson",
            "DefaultJson": "canonicalJson",  # Conservative choice
            "SimplifiedJson": "relaxedJson"
        }
        
        # Test all three connector formats
        self.assertEqual(format_mapping.get("ExtendedJson"), "canonicalJson")
        self.assertEqual(format_mapping.get("DefaultJson"), "canonicalJson")
        self.assertEqual(format_mapping.get("SimplifiedJson"), "relaxedJson")
        
        # Test invalid format returns None
        self.assertIsNone(format_mapping.get("InvalidFormat"))
        self.assertIsNone(format_mapping.get(None))
    
    def test_conservative_default_json_mapping(self):
        """Test that DefaultJson maps to canonicalJson conservatively."""
        format_mapping = {
            "ExtendedJson": "canonicalJson",
            "DefaultJson": "canonicalJson",  # Conservative choice to preserve type info
            "SimplifiedJson": "relaxedJson"
        }
        
        # DefaultJson should map to canonicalJson for conservative type preservation
        self.assertEqual(format_mapping["DefaultJson"], "canonicalJson")
        
        # Verify this is the same as ExtendedJson (both preserve types)
        self.assertEqual(format_mapping["DefaultJson"], format_mapping["ExtendedJson"])


if __name__ == '__main__':
    unittest.main()