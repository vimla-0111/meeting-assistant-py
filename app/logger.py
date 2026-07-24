import logging
import sys
from app.config import settings

def setup_logger():
    # Define log format
    log_format = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    # Set log level based on debug setting
    log_level = logging.DEBUG if settings.app_debug else logging.INFO

    # Create root logger
    logger = logging.getLogger()
    logger.setLevel(log_level)

    # Prevent adding duplicate handlers if setup_logger is called multiple times
    if not logger.handlers:
        # Console Handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level)
        formatter = logging.Formatter(fmt=log_format, datefmt=date_format)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

        # File Handler
        file_handler = logging.FileHandler("app.log", encoding="utf-8")
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    # Suppress verbose logs from some noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    return logger

# Create a convenient logger instance to import
logger = logging.getLogger("meeting_assistant")
