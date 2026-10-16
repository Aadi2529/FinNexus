"""Consolidated SQLAlchemy 2.x declarative models for FinanceFlow."""

from app.db.models.audit import AuditLog
from app.db.models.auth import RefreshToken, Role, User, UserRole
from app.db.models.crm import (
    CrmNotification,
    Customer,
    CustomerNote,
    FinancialProfile,
    Task,
    WorkCategory,
    WorkOrder,
    WorkOrderChecklistItem,
    WorkOrderHistory,
    WorkOrderReminder,
)
from app.db.models.documents import Document

__all__ = [
    "AuditLog",
    "CrmNotification",
    "Customer",
    "CustomerNote",
    "Document",
    "FinancialProfile",
    "RefreshToken",
    "Role",
    "Task",
    "User",
    "UserRole",
    "WorkCategory",
    "WorkOrder",
    "WorkOrderChecklistItem",
    "WorkOrderHistory",
    "WorkOrderReminder",
]
