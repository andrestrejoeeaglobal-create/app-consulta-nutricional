from sqlalchemy import Column, String, Integer, DateTime
from datetime import datetime
from .database import Base

class ActiveScan(Base):
    __tablename__ = "active_scans"

    scan_id = Column(String, primary_key=True, index=True)
    status = Column(String, default="scanning")  # scanning, completed, error
    progress = Column(Integer, default=0)
    results = Column(String, nullable=True)  # JSON text
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class BackgroundJob(Base):
    __tablename__ = "background_jobs"

    job_id = Column(String, primary_key=True, index=True)
    status = Column(String, default="processing")  # processing, completed, error
    results = Column(String, nullable=True)  # JSON text
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
