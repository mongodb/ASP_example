#!/usr/bin/env python3
"""
Test runner for unit and integration tests.

Usage:
    python run_tests.py                # Run all tests (unit + integration)
    python run_tests.py --unit-only    # Run only unit tests (fast, no external deps)
    python run_tests.py --integration-only  # Run only integration tests (requires env setup)
    python run_tests.py -v             # Verbose output
"""

import unittest
import sys
import argparse
from pathlib import Path


def run_unit_tests(verbosity=1):
    """Run unit tests."""
    print("🧪 Running Unit Tests")
    print("=" * 50)
    
    test_dir = Path(__file__).parent / "unit"
    loader = unittest.TestLoader()
    suite = loader.discover(
        start_dir=str(test_dir),
        pattern="test*.py",
        top_level_dir=str(Path(__file__).parent.parent)
    )
    
    runner = unittest.TextTestRunner(verbosity=verbosity)
    result = runner.run(suite)
    
    print("-" * 50)
    print(f"Unit Tests: {result.testsRun} run, {len(result.failures)} failures, {len(result.errors)} errors")
    
    return result.failures == 0 and result.errors == 0


def run_integration_tests(verbosity=1):
    """Run integration tests."""
    print("🚀 Running Integration Tests")
    print("=" * 50)
    
    test_dir = Path(__file__).parent / "integration"
    loader = unittest.TestLoader()
    suite = loader.discover(
        start_dir=str(test_dir),
        pattern="test*.py",
        top_level_dir=str(Path(__file__).parent.parent)
    )
    
    runner = unittest.TextTestRunner(verbosity=verbosity)
    result = runner.run(suite)
    
    print("-" * 50)
    print(f"Integration Tests: {result.testsRun} run, {len(result.failures)} failures, {len(result.errors)} errors")
    
    return result.failures == 0 and result.errors == 0


def main():
    """Main function to handle command line arguments and run tests."""
    parser = argparse.ArgumentParser(
        description="Run unit and/or integration tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Verbose output"
    )
    
    parser.add_argument(
        "--unit-only",
        action="store_true",
        help="Run only unit tests (fast, no external dependencies)"
    )
    
    parser.add_argument(
        "--integration-only",
        action="store_true",
        help="Run only integration tests (requires env setup)"
    )
    
    args = parser.parse_args()
    
    verbosity = 2 if args.verbose else 1
    
    if args.unit_only:
        success = run_unit_tests(verbosity)
    elif args.integration_only:
        success = run_integration_tests(verbosity)
    else:
        # Run both
        unit_success = run_unit_tests(verbosity)
        print("\n" + "="*60)
        integration_success = run_integration_tests(verbosity)
        
        success = unit_success and integration_success
        
        print("\n" + "="*60)
        print("OVERALL SUMMARY:")
        print(f"  Unit Tests: {'✅ PASSED' if unit_success else '❌ FAILED'}")
        print(f"  Integration Tests: {'✅ PASSED' if integration_success else '❌ FAILED'}")
        
        if success:
            print("🎉 ALL TESTS PASSED!")
        else:
            print("💥 SOME TESTS FAILED")
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()