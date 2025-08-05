"""
Processors module for MongoDB Atlas Stream Processing configuration.

This module contains the core functionality for creating and managing
MongoDB Atlas source and sink stream processors.
"""

from . import common
from . import source
from . import sink

__all__ = ['common', 'source', 'sink']