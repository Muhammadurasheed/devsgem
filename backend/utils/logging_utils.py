import logging

class CorrelationIdFilter(logging.Filter):
    """
    Log filter to inject a default correlation_id if missing.
    Fixes crashes when third-party libraries log without it.
    """
    def filter(self, record):
        if not hasattr(record, 'correlation_id'):
            record.correlation_id = 'system'
        return True
