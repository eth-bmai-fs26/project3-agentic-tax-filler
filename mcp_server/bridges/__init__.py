"""Browser bridge implementations."""

from .base import BrowserBridge
from .mock import MockBridge, MockFrontend

# Lazy imports for optional dependencies
def get_colab_bridge():
    from .colab import ColabBridge
    return ColabBridge

def get_playwright_bridge():
    from .playwright import PlaywrightBridge
    return PlaywrightBridge

__all__ = ["BrowserBridge", "MockBridge", "MockFrontend"]
