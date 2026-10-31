class AutomataException(Exception):
    """Base exception for all automata operations."""
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

class ValidationError(AutomataException):
    """Raised when an automaton fails mathematical validation."""
    pass

class ConversionError(AutomataException):
    """Raised when an algorithm cannot perform a valid conversion."""
    pass

class SimulationError(AutomataException):
    """Raised during invalid string simulation."""
    pass

class RegexParseError(AutomataException):
    """Raised when regular expression syntax is malformed."""
    pass

class GrammarParseError(AutomataException):
    """Raised when grammar syntax or production form is invalid."""
    pass

