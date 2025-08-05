#!/usr/bin/env python3
"""
End-to-end integration tests that create real stream processors and verify they work.

This test:
1. Scans integration_configs/ for test config files
2. Creates complete configs by merging with env variables
3. Runs create_processors.py to create actual stream processors
4. Uses mongosh to verify processors exist with sp.<name>.stats()
5. Cleans up by deleting test processors

Test config files should be minimal and only contain:
- connector.class
- name (will be used for collection name too)
- The specific fields being tested

All other fields (credentials, topics, database, etc.) come from env variables.

Usage:
    python test_integration.py                              # Run all tests from integration_configs/
    python test_integration.py --config <filename.json>    # Run specific test
    python test_integration.py --config <foldername/>      # Run all tests from custom folder
    python test_integration.py --config <filename.json> -v # Run specific test with verbose output
    python test_integration.py --config <foldername/> --audit # Run all tests from custom folder with audit mode
    python test_integration.py --audit                     # Run all tests with audit mode
"""

import os
import sys
import unittest
import tempfile
import json
import subprocess
import shutil
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Load integration-specific .env file
load_dotenv(Path(__file__).parent / '.env.integration')


class TestE2EIntegration(unittest.TestCase):
    """End-to-end integration tests using real stream processors."""
    
    @classmethod
    def setUpClass(cls):
        """Set up class-level test fixtures."""
        # Audit mode is set by main section before unittest runs
        if not hasattr(cls, 'audit_mode'):
            cls.audit_mode = False
            cls.audit_dir = None
        # Ensure Atlas authentication (silently)
        try:
            subprocess.run(['atlas', 'auth', 'login'], capture_output=True, text=True)
        except:
            pass
        
        # Check required environment variables
        cls.required_env_vars = [
            'test_kafka_api_key', 'test_kafka_api_secret', 'test_db_user',
            'test_db_password', 'test_confluent_cluster_id', 'test_confluent_rest_endpoint',
            'test_stream_processor_url', 'test_tenant_name', 'test_group_id',
            'test_cluster_name', 'test_topic', 'test_database'
        ]
        
        missing_vars = [var for var in cls.required_env_vars if not os.getenv(var)]
        if missing_vars:
            raise unittest.SkipTest(
                f"Missing required environment variables: {', '.join(missing_vars)}\n"
                f"Please set all test_* environment variables before running integration tests."
            )
        
        print("✅ Environment variables verified")
        
        # Store created processors for cleanup
        cls.created_processors = []
    
    @classmethod
    def tearDownClass(cls):
        """Clean up any processors created during tests."""
        if cls.created_processors:
            print(f"\n🧹 Cleaning up {len(cls.created_processors)} test processors...")
            for processor_name in cls.created_processors:
                try:
                    cls.delete_processor(processor_name)
                    print(f"   Deleted: {processor_name}")
                except Exception as e:
                    print(f"   Failed to delete {processor_name}: {e}")
    
    def setUp(self):
        """Set up test fixtures before each test."""
        # Create temporary directory for this test
        self.temp_dir = tempfile.mkdtemp(prefix="e2e_integration_test_")
        self.config_dir = Path(self.temp_dir) / "configs"
        self.config_dir.mkdir()
        
        # Create main config using environment variables
        self.main_config = {
            "confluent-cluster-id": os.getenv('test_confluent_cluster_id'),
            "confluent-rest-endpoint": os.getenv('test_confluent_rest_endpoint'),
            "mongodb-stream-processor-instance-url": os.getenv('test_stream_processor_url'),
            "mongodb-tenant-name": os.getenv('test_tenant_name'),
            "mongodb-group-id": os.getenv('test_group_id'),
            "kafka-connection-name": os.getenv('test_kafka_connection_name'),
            "mongodb-cluster-name": os.getenv('test_cluster_name'),
            "mongodb-connection-name": os.getenv('test_mongodb_connection_name'),
            "mongodb-connection-role": os.getenv('test_mongodb_connection_role')
        }
        
        self.main_config_path = Path(self.temp_dir) / "main.json"
        with open(self.main_config_path, 'w') as f:
            json.dump(self.main_config, f, indent=2)
    
    def tearDown(self):
        """Clean up test fixtures after each test."""
        try:
            shutil.rmtree(self.temp_dir)
        except Exception as e:
            print(f"Warning: Failed to clean up temp directory: {e}")
    
    def create_full_config(self, test_config: dict) -> dict:
        """Create a full config by merging test config with env variables."""
        connector_class = test_config["connector.class"]
        name = test_config["name"]
        
        # Base config with all required fields from env
        full_config = {
            "connector.class": connector_class,
            "name": name,
            "kafka.auth.mode": "KAFKA_API_KEY",
            "kafka.api.key": os.getenv('test_kafka_api_key'),
            "kafka.api.secret": os.getenv('test_kafka_api_secret'),
            "connection.user": os.getenv('test_db_user'),
            "connection.password": os.getenv('test_db_password'),
            "database": os.getenv('test_database'),
            "collection": name  # Use processor name as collection name
        }
        
        # Add connector-specific required fields
        if "Source" in connector_class:
            full_config["topic.prefix"] = os.getenv('test_topic')
        elif "Sink" in connector_class:
            full_config["topics"] = os.getenv('test_topic')
        
        # Merge in the test-specific fields (overriding defaults)
        full_config.update(test_config)
        
        return full_config
    
    def run_create_processors(self) -> subprocess.CompletedProcess:
        """Run create_processors.py and return the result."""
        cmd = [
            sys.executable,
            str(project_root / "create_processors.py"),
            str(self.main_config_path),
            str(self.config_dir)
        ]
        
        return subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    
    def check_processor_exists(self, processor_name: str) -> bool:
        """Check if processor exists using mongosh sp.<name>.stats()."""
        try:
            # Use authentication like in common.py
            stream_processor_url = os.getenv('test_stream_processor_url')
            if not stream_processor_url.endswith('/'):
                stream_processor_url += '/'
                
            cmd = [
                "mongosh", 
                stream_processor_url,
                "--tls",
                "--authenticationDatabase", "admin",
                "--username", os.getenv('test_db_user'),
                "--password", os.getenv('test_db_password'),
                "--eval", f"sp['{processor_name}'].stats()"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            # Check if running in verbose mode
            import sys
            verbose_mode = '-v' in sys.argv or '--verbose' in sys.argv
            
            if verbose_mode and result.returncode == 0:
                print(f"\n📊 Stats for processor '{processor_name}':")
                print("=" * 50)
                print(result.stdout)
                if result.stderr:
                    print("STDERR:")
                    print(result.stderr)
                print("=" * 50)
            
            # If stats() succeeds, processor exists
            return result.returncode == 0 and "stats" in result.stdout.lower()
            
        except Exception as e:
            print(f"Error checking processor {processor_name}: {e}")
            return False
    
    @classmethod
    def delete_processor(cls, processor_name: str):
        """Delete a processor using mongosh."""
        # Use authentication like in common.py
        stream_processor_url = os.getenv('test_stream_processor_url')
        if not stream_processor_url.endswith('/'):
            stream_processor_url += '/'
            
        cmd = [
            "mongosh",
            stream_processor_url,
            "--tls",
            "--authenticationDatabase", "admin",
            "--username", os.getenv('test_db_user'),
            "--password", os.getenv('test_db_password'),
            "--eval", f"sp['{processor_name}'].drop()"
        ]
        
        subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    
    def audit_processor_stats(self, processor_name: str, test_config: dict, full_config: dict):
        """Capture processor stats and save to audit directory with configs."""
        if not self.__class__.audit_mode:
            return
            
        # Create processor-specific directory
        processor_dir = self.__class__.audit_dir / processor_name
        processor_dir.mkdir(exist_ok=True)
        
        # Save initial test config
        test_config_file = processor_dir / "initial_test_config.json"
        with open(test_config_file, 'w') as f:
            json.dump(test_config, f, indent=2)
        
        # Save full generated config (what customer would provide)
        full_config_file = processor_dir / "full_customer_config.json"
        with open(full_config_file, 'w') as f:
            json.dump(full_config, f, indent=2)
        
        # Capture stats
        stats_file = processor_dir / "stats_output.txt"
        try:
            # Use authentication like in common.py
            stream_processor_url = os.getenv('test_stream_processor_url')
            if not stream_processor_url.endswith('/'):
                stream_processor_url += '/'
                
            cmd = [
                "mongosh", 
                stream_processor_url,
                "--tls",
                "--authenticationDatabase", "admin",
                "--username", os.getenv('test_db_user'),
                "--password", os.getenv('test_db_password'),
                "--eval", f"sp['{processor_name}'].stats()"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            # Write stats (success or failure) to file
            with open(stats_file, 'w') as f:
                f.write(f"Processor: {processor_name}\n")
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")
                f.write(f"Command: {' '.join(cmd)}\n")
                f.write(f"Return Code: {result.returncode}\n")
                f.write(f"{'='*60}\n\n")
                
                if result.returncode == 0:
                    f.write("✅ STATS CAPTURED SUCCESSFULLY\n\n")
                    f.write("STDOUT:\n")
                    f.write(result.stdout)
                    if result.stderr:
                        f.write("\n\nSTDERR:\n")
                        f.write(result.stderr)
                else:
                    f.write("❌ ERROR CAPTURING STATS\n\n")
                    f.write("STDOUT:\n")
                    f.write(result.stdout or "(empty)")
                    f.write("\n\nSTDERR:\n")
                    f.write(result.stderr or "(empty)")
            
            if result.returncode == 0:
                print(f"📊 Audit data saved for '{processor_name}' to {processor_dir}")
            else:
                print(f"⚠️  Stats capture failed for '{processor_name}', error logged to {processor_dir}")
                
        except Exception as e:
            # Write exception to stats file
            with open(stats_file, 'w') as f:
                f.write(f"Processor: {processor_name}\n")
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")
                f.write(f"{'='*60}\n\n")
                f.write("❌ EXCEPTION DURING STATS CAPTURE\n\n")
                f.write(f"Exception: {str(e)}\n")
                f.write(f"Exception Type: {type(e).__name__}\n")
            
            print(f"⚠️  Exception during audit for '{processor_name}', logged to {processor_dir}: {e}")
    
    def audit_failed_processor(self, processor_name: str, test_config: dict, full_config: dict, create_result: subprocess.CompletedProcess, is_unexpected_failure: bool = False):
        """Capture audit data for failed processor creation."""
        if not self.__class__.audit_mode:
            return
            
        # Create processor-specific directory
        if is_unexpected_failure:
            # Put unexpected failures in a "failures" subfolder for easier identification
            failures_dir = self.__class__.audit_dir / "failures"
            failures_dir.mkdir(exist_ok=True)
            processor_dir = failures_dir / processor_name
        else:
            # Expected failures (shouldFail=true) stay in main audit directory
            processor_dir = self.__class__.audit_dir / processor_name
        
        processor_dir.mkdir(exist_ok=True)
        
        # Save initial test config
        test_config_file = processor_dir / "initial_test_config.json"
        with open(test_config_file, 'w') as f:
            json.dump(test_config, f, indent=2)
        
        # Save full generated config (what customer would provide)
        full_config_file = processor_dir / "full_customer_config.json"
        with open(full_config_file, 'w') as f:
            json.dump(full_config, f, indent=2)
        
        # Save creation failure details (clean v2 format)
        failure_file = processor_dir / "creation_failure.txt"
        self._create_clean_failure_report(failure_file, processor_name, test_config, create_result)
        
        if is_unexpected_failure:
            print(f"📋 Audit data saved for unexpected failure '{processor_name}' to failures/{processor_name}")
    
    def _create_clean_failure_report(self, failure_file: Path, processor_name: str, test_config: dict, create_result: subprocess.CompletedProcess):
        """Create a clean, focused failure report instead of the verbose original."""
        
        # Extract the config file name from processor name
        config_file = processor_name.replace('.', '_') + '.json'
        failure_content = create_result.stdout or ""
        
        # Extract processor-specific failure information
        specific_failure = self._extract_processor_specific_failure(failure_content, processor_name, config_file)
        
        # Create the clean report
        report_lines = []
        report_lines.append(f"# Failure Analysis: {processor_name}")
        report_lines.append(f"Generated: {datetime.now().isoformat()}")
        report_lines.append("")
        
        # Show what was being tested
        report_lines.append("## Test Configuration")
        if test_config:
            # Remove common fields, show only the test-specific fields
            test_specific = {k: v for k, v in test_config.items() 
                            if k not in ['connector.class', 'name', 'shouldFail']}
            if test_specific:
                for key, value in test_specific.items():
                    report_lines.append(f"- {key}: {value}")
            else:
                report_lines.append("- Testing basic configuration (no specific parameters)")
        else:
            report_lines.append("- Test configuration not available")
        report_lines.append("")
        
        # Show the specific failure
        report_lines.append("## Failure Details")
        report_lines.append("```")
        report_lines.append(specific_failure)
        report_lines.append("```")
        report_lines.append("")
        
        # Analyze the failure type
        report_lines.append("## Failure Analysis")
        if "session expired" in failure_content.lower():
            report_lines.append("**Root Cause**: Atlas CLI session expired during test execution")
            report_lines.append("**Type**: Infrastructure/Authentication Issue")
            report_lines.append("**Impact**: Prevented connection creation, no stream processor created")
            report_lines.append("**Solution**: Re-authenticate with Atlas CLI and re-run test")
        elif "validation issues" in specific_failure.lower():
            report_lines.append("**Root Cause**: Configuration validation failed")
            report_lines.append("**Type**: Expected validation failure (likely shouldFail=true test)")
            validation_msgs = [line for line in specific_failure.split('\n') if 'Only ' in line and 'supported' in line]
            if validation_msgs:
                report_lines.append("**Validation Rules Triggered**:")
                for msg in validation_msgs:
                    report_lines.append(f"  - {msg.strip()}")
        elif "mongoservererror" in specific_failure.lower() or "idlunknownfield" in specific_failure.lower():
            report_lines.append("**Root Cause**: MongoDB Atlas Stream Processing API error")
            report_lines.append("**Type**: Technical Issue - Unsupported field or configuration")
            if "maxawaittimems" in specific_failure.lower():
                report_lines.append("**Specific Issue**: maxAwaitTimeMS field not supported in $source.config")
                report_lines.append("**Solution**: Remove or fix the max.poll.interval.ms parameter mapping")
        elif "failed to create stream processor" in specific_failure.lower():
            report_lines.append("**Root Cause**: Stream processor creation failed")
            report_lines.append("**Type**: Technical Issue")
            report_lines.append("**Details**: Check mongosh command and Stream Processing API compatibility")
        elif "network error" in specific_failure.lower():
            report_lines.append("**Root Cause**: Network connectivity issue")
            report_lines.append("**Type**: Infrastructure Issue")
            report_lines.append("**Details**: Timeout or connection failure to external services")
        else:
            report_lines.append("**Root Cause**: Unknown - requires manual investigation")
            report_lines.append("**Type**: Needs Analysis")
        report_lines.append("")
        
        # Write the clean report
        with open(failure_file, 'w') as f:
            f.write('\n'.join(report_lines))
    
    def _extract_processor_specific_failure(self, failure_content: str, processor_name: str, config_file: str) -> str:
        """Extract only the failure information relevant to a specific processor."""
        
        lines = failure_content.split('\n')
        
        # Find the section where this specific processor config is being processed
        processor_section_start = None
        processor_section_end = None
        
        for i, line in enumerate(lines):
            # Look for the line that starts processing this specific config file
            if f"Processing: {config_file}" in line:
                processor_section_start = i
                break
        
        if processor_section_start is not None:
            # Find where this processor's section ends (next "Processing:" line or summary)
            for i in range(processor_section_start + 1, len(lines)):
                line = lines[i]
                if (line.startswith("Processing:") or 
                    line.startswith("--------------------------------------------------") or
                    line.startswith("Summary:") or
                    line.startswith("=")):
                    processor_section_end = i
                    break
            
            if processor_section_end is None:
                processor_section_end = len(lines)
            
            # Extract the relevant section
            relevant_lines = lines[processor_section_start:processor_section_end]
            
            # Also look for validation errors in the SKIPPED CONFIGURATIONS section
            validation_errors = []
            in_skipped_section = False
            for line in lines:
                if "⚠ SKIPPED CONFIGURATIONS" in line:
                    in_skipped_section = True
                    continue
                if in_skipped_section:
                    if line.startswith("============"):
                        break
                    if config_file in line:
                        validation_errors.append(line.strip())
                        # Get the next few lines that contain the bullet points
                        line_idx = lines.index(line)
                        for j in range(line_idx + 1, min(line_idx + 5, len(lines))):
                            next_line = lines[j]
                            if next_line.strip().startswith("•") or next_line.strip().startswith("-"):
                                validation_errors.append(next_line.strip())
                            elif next_line.strip().startswith("-") and next_line.strip().endswith(".json:"):
                                break
                            elif not next_line.strip():
                                continue
                            else:
                                break
            
            # Look for mongosh/stream processor creation errors
            creation_errors = []
            for line in relevant_lines:
                if ("Failed to create stream processor" in line or 
                    "MongoServerError" in line or 
                    "Error:" in line or
                    "IDLUnknownField" in line):
                    creation_errors.append(line.strip())
            
            result_lines = relevant_lines[:]
            if validation_errors:
                result_lines.append("\n--- Validation Errors from SKIPPED CONFIGURATIONS ---")
                result_lines.extend(validation_errors)
            if creation_errors:
                result_lines.append("\n--- Stream Processor Creation Errors ---")
                result_lines.extend(creation_errors)
            
            return '\n'.join(result_lines)
        
        # If we can't find a specific section, look for any mentions of the processor or config file
        relevant_lines = []
        for line in lines:
            if processor_name in line or config_file in line:
                relevant_lines.append(line.strip())
        
        if relevant_lines:
            return '\n'.join(relevant_lines)
        
        return "No specific failure information found for this processor."
    
    def run_integration_test_for_config(self, config_file: Path):
        """Run an integration test for a specific config file."""
        print(f"\n{'='*80}")
        print(f"TESTING CONFIG: {config_file.name}")
        print(f"{'='*80}")
        
        # Load the test config
        with open(config_file, 'r') as f:
            test_config = json.load(f)
        
        print(f"Test config: {json.dumps(test_config, indent=2)}")
        
        # Check if this test is expected to fail
        should_fail = test_config.get("shouldFail", False)
        if should_fail:
            print(f"⚠️  This test is EXPECTED TO FAIL")
        
        # Create full config
        full_config = self.create_full_config(test_config)
        processor_name = full_config["name"]
        
        print(f"Processor name: {processor_name}")
        
        # Write full config to temp file
        temp_config_path = self.config_dir / f"{config_file.stem}.json"
        with open(temp_config_path, 'w') as f:
            json.dump(full_config, f, indent=2)
        
        # Run create_processors
        print("Running create_processors.py...")
        result = self.run_create_processors()
        
        print("STDOUT:")
        print(result.stdout)
        if result.stderr:
            print("STDERR:")
            print(result.stderr)
        
        # Verify basic success
        self.assertIn("Main config loaded successfully", result.stdout,
                     "Main config should load successfully")
        self.assertIn("PROCESSING COMPLETE", result.stdout,
                     "Processing should complete")
        
        # Check if processor was created
        print(f"Checking if processor '{processor_name}' exists...")
        processor_exists = self.check_processor_exists(processor_name)
        
        # Handle shouldFail logic
        if should_fail:
            if processor_exists:
                # Unexpected success when failure was expected - test fails
                print(f"❌ Test FAILED: Expected failure but processor '{processor_name}' was created successfully!")
                self.audit_processor_stats(processor_name, test_config, full_config)
                self.__class__.created_processors.append(processor_name)
                self.log_test_result(config_file.name, False, f"Expected failure but processor was created")
                self.fail(f"Test expected to fail but processor '{processor_name}' was created successfully")
            else:
                # Expected failure occurred - test passes
                print(f"✅ Test PASSED: Expected failure occurred for processor '{processor_name}'")
                self.audit_failed_processor(processor_name, test_config, full_config, result)
                self.log_test_result(config_file.name, True, "Expected failure occurred")
        else:
            # Normal logic - processor creation success means test passes
            if processor_exists:
                print(f"✅ Processor '{processor_name}' created successfully!")
                # Capture audit stats before adding to cleanup list
                self.audit_processor_stats(processor_name, test_config, full_config)
                # Add to cleanup list
                self.__class__.created_processors.append(processor_name)
                # Log successful test
                self.log_test_result(config_file.name, True)
            else:
                # Processor creation failed - test fails
                print(f"❌ Processor '{processor_name}' was not created")
                # Still capture audit data for failed processors - this is an unexpected failure
                self.audit_failed_processor(processor_name, test_config, full_config, result, is_unexpected_failure=True)
                # Log failed test
                self.log_test_result(config_file.name, False, f"Processor '{processor_name}' was not created")
                self.fail(f"Processor '{processor_name}' was not created. Check output above.")
        
        return processor_name
    
    def log_test_result(self, config_name: str, success: bool, error_message: str = ""):
        """Log test result to a simple text file."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        status = "PASS" if success else "FAIL"
        
        # Put the log file in the current audit directory if audit mode is enabled
        if hasattr(self.__class__, 'audit_mode') and self.__class__.audit_mode and self.__class__.audit_dir:
            log_file = self.__class__.audit_dir / "test_results.txt"
        else:
            # Fallback to audit_results directory if audit mode is not enabled
            audit_base_dir = Path(__file__).parent / "audit_results"
            audit_base_dir.mkdir(exist_ok=True)
            log_file = audit_base_dir / "test_results.txt"
        
        with open(log_file, 'a') as f:
            f.write(f"{timestamp} | {status} | {config_name} | {error_message}\n")
    
    def test_all_integration_configs(self):
        """Discover and test all config files in integration_configs/ or custom folder."""
        # Check if specific config file was requested
        if hasattr(self.__class__, 'target_config') and self.__class__.target_config:
            # Check if it's a folder (ends with /)
            if self.__class__.target_config.endswith('/'):
                # Use custom folder
                folder_path = self.__class__.target_config.rstrip('/')
                integration_configs_dir = Path(__file__).parent / folder_path
                if not integration_configs_dir.exists():
                    self.fail(f"Requested config folder not found: {folder_path}")
                print(f"Running tests from custom folder: {folder_path}")
            else:
                # Use default folder for specific file
                integration_configs_dir = Path(__file__).parent / "integration_configs"
                if not integration_configs_dir.exists():
                    self.skipTest("No integration_configs directory found")
                
                config_file = integration_configs_dir / self.__class__.target_config
                if not config_file.exists():
                    self.fail(f"Requested config file not found: {self.__class__.target_config}")
                
                print(f"Running specific config test: {self.__class__.target_config}")
                self.run_integration_test_for_config(config_file)
                return
        else:
            # Default behavior - use integration_configs
            integration_configs_dir = Path(__file__).parent / "integration_configs"
            if not integration_configs_dir.exists():
                self.skipTest("No integration_configs directory found")
        
        config_files = sorted(integration_configs_dir.glob("*.json"), key=lambda x: x.name)
        
        if not config_files:
            folder_name = integration_configs_dir.name
            self.skipTest(f"No config files found in {folder_name}/")
        
        print(f"Found {len(config_files)} config files to test:")
        for config_file in config_files:
            print(f"  - {config_file.name}")
        
        # Test each config file
        for config_file in config_files:
            with self.subTest(config=config_file.name):
                self.run_integration_test_for_config(config_file)


if __name__ == '__main__':
    import sys
    import os
    
    # Handle custom flags before unittest processes arguments
    if '-dlq' in sys.argv:
        os.environ['DEBUG_DLQ'] = 'true'
        sys.argv.remove('-dlq')
    
    # Handle custom --config flag before unittest processes arguments
    target_config = None
    if '--config' in sys.argv:
        config_index = sys.argv.index('--config')
        if config_index + 1 < len(sys.argv):
            target_config = sys.argv[config_index + 1]
            sys.argv.remove('--config')
            sys.argv.remove(target_config)
            TestE2EIntegration.target_config = target_config
            if target_config.endswith('/'):
                print(f"📁 Target folder specified: {target_config.rstrip('/')}")
            else:
                print(f"🎯 Target config specified: {target_config}")
        else:
            print("❌ Error: --config requires a filename or folder argument")
            print("Usage: python test_integration.py --config <filename.json>")
            print("   or: python test_integration.py --config <foldername/>")
            sys.exit(1)
    else:
        TestE2EIntegration.target_config = None
    
    # Handle custom --audit flag before unittest processes arguments
    if '--audit' in sys.argv:
        sys.argv.remove('--audit')
        # Set up audit mode on the test class
        TestE2EIntegration.audit_mode = True
        # Create audit directory with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        audit_base_dir = Path(__file__).parent / "audit_results"
        audit_base_dir.mkdir(exist_ok=True)
        TestE2EIntegration.audit_dir = audit_base_dir / timestamp
        TestE2EIntegration.audit_dir.mkdir(parents=True, exist_ok=True)
        print(f"📋 Audit mode enabled. Results will be saved to: {TestE2EIntegration.audit_dir}")
    else:
        TestE2EIntegration.audit_mode = False
        TestE2EIntegration.audit_dir = None
    
    unittest.main(verbosity=2)