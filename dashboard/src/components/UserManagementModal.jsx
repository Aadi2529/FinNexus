import React, { useState, useEffect } from "react";
import {
  X,
  UserPlus,
  Edit3,
  Shield,
  ShieldAlert,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Power,
  Eye,
  EyeOff,
} from "lucide-react";
import { authAPI } from "../services/api";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_-])[A-Za-z\d@$!%*?&#^()_-]{8,}$/;

export default function UserManagementModal({
  isOpen,
  onClose,
  onUserSaved,
  editUser = null,
  currentLoggedInUser = null,
}) {
  const isEdit = Boolean(editUser);
  const isSuperAdmin =
    currentLoggedInUser?.role === "SUPER_ADMIN" ||
    (Array.isArray(currentLoggedInUser?.roles) &&
      currentLoggedInUser.roles.includes("SUPER_ADMIN"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccess("");
      setConfirmDelete(false);
      setShowPassword(false);
      if (editUser) {
        setFullName(editUser.full_name || "");
        setEmail(editUser.email || "");
        const userRole = Array.isArray(editUser.roles)
          ? editUser.roles[0]
          : editUser.role || "EMPLOYEE";
        setRole(userRole);
        setIsActive(editUser.is_active !== false);
        setPassword("");
      } else {
        setFullName("");
        setEmail("");
        setRole("EMPLOYEE");
        setIsActive(true);
        setPassword("");
      }
    }
  }, [isOpen, editUser]);

  if (!isOpen) return null;

  const isTargetSuperAdmin =
    editUser?.role === "SUPER_ADMIN" ||
    (Array.isArray(editUser?.roles) && editUser.roles.includes("SUPER_ADMIN"));

  const validatePassword = (pwd) => {
    return PASSWORD_REGEX.test(pwd);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!isEdit) {
      if (!email.trim() || !email.includes("@")) {
        setError("Valid work email address is required.");
        return;
      }
      if (!password) {
        setError("Initial account password is required.");
        return;
      }
      if (!validatePassword(password)) {
        setError(
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
        );
        return;
      }

      setLoading(true);
      const res = await authAPI.registerUser({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        role: role.toUpperCase(),
        password: password,
      });
      setLoading(false);

      if (res.success) {
        setSuccess(`User account for ${fullName} provisioned successfully!`);
        setTimeout(() => {
          onUserSaved && onUserSaved(res.data);
          onClose();
        }, 1200);
      } else {
        setError(res.error || "Failed to provision user account.");
      }
    } else {
      // Edit User
      const payload = {
        full_name: fullName.trim(),
        role: role.toUpperCase(),
        is_active: isActive,
      };

      if (password.trim()) {
        if (!validatePassword(password)) {
          setError(
            "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
          );
          return;
        }
        payload.password = password.trim();
      }

      setLoading(true);
      const res = await authAPI.updateUser(editUser.id, payload);
      setLoading(false);

      if (res.success) {
        setSuccess(`User record updated successfully!`);
        setTimeout(() => {
          onUserSaved && onUserSaved(res.data);
          onClose();
        }, 1200);
      } else {
        setError(res.error || "Failed to update user account.");
      }
    }
  };

  const handleDelete = async () => {
    if (!editUser) return;
    setLoading(true);
    setError("");
    const res = await authAPI.deleteUser(editUser.id);
    setLoading(false);

    if (res.success) {
      setSuccess("Account deleted successfully.");
      setTimeout(() => {
        onUserSaved && onUserSaved(null);
        onClose();
      }, 1200);
    } else {
      setError(res.error || "Failed to delete user account.");
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Accent Gradient Line */}
        <div className="h-1 bg-gradient-to-r from-navy-900 via-teal-700 to-teal-500 w-full" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shadow-2xs shrink-0">
              {isEdit ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {isEdit ? `Manage Account: ${editUser.full_name}` : "Provision New User Account"}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEdit
                  ? "Update operational authority, credentials, or session status"
                  : "Establish enterprise credentials and system access scope"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 overflow-y-auto space-y-4 text-xs">
          {/* Full Name */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Full Legal Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ramesh Chandra"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 text-slate-900"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Work Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                disabled={isEdit}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh@finnexus.com"
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 ${
                  isEdit ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white"
                }`}
              />
            </div>
            {isEdit && (
              <p className="text-[10px] text-slate-400 mt-1">
                Email address serves as the primary system identifier and cannot be modified.
              </p>
            )}
          </div>

          {/* Role Selection */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Assigned Operational Role <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  code: "EMPLOYEE",
                  label: "Employee",
                  desc: "Task execution, checklist progress, client search",
                },
                {
                  code: "MANAGER",
                  label: "Manager",
                  desc: "Workload oversight, task delegation, team tracking",
                },
                {
                  code: "ADMIN",
                  label: "Admin",
                  desc: "Full client CRUD, work orders, categories, staff",
                },
                ...(isSuperAdmin
                  ? [
                      {
                        code: "SUPER_ADMIN",
                        label: "Super Admin",
                        desc: "Unrestricted governance, security invariants",
                      },
                    ]
                  : []),
              ].map((rOption) => (
                <label
                  key={rOption.code}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    role === rOption.code
                      ? "border-teal-600 bg-teal-50/50 shadow-2xs"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{rOption.label}</span>
                    <input
                      type="radio"
                      name="role"
                      value={rOption.code}
                      checked={role === rOption.code}
                      onChange={() => setRole(rOption.code)}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 leading-snug">
                    {rOption.desc}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Password (Required for new, optional for edit) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">
                {isEdit ? "Reset Password (Optional)" : "Initial Password"}{" "}
                {!isEdit && <span className="text-rose-500">*</span>}
              </label>
              {isEdit && (
                <span className="text-[10px] text-slate-400">
                  Leave blank to retain current password
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                required={!isEdit}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? "Enter new password to reset" : "••••••••••••"}
                className="w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Minimum 8 characters with at least 1 uppercase, 1 lowercase, 1 number, and 1 special symbol (@$!%*?&#^).
            </p>
          </div>

          {/* Account Status Toggle (Edit Mode Only) */}
          {isEdit && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">Account Status</span>
                <span className="text-[11px] text-slate-500 block">
                  {isActive
                    ? "Active account with operational login authorization"
                    : "Deactivated: active sessions revoked, login blocked"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isTargetSuperAdmin && isActive) {
                    alert(
                      "Super Admin Invariant Defense: The last active Super Admin account cannot be deactivated."
                    );
                    return;
                  }
                  setIsActive(!isActive);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                    : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isActive ? "Active (Click to Deactivate)" : "Deactivated (Click to Activate)"}</span>
              </button>
            </div>
          )}

          {/* Permanent Deletion for Super Admin */}
          {isEdit && isSuperAdmin && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-rose-700 block">Danger Zone</span>
                <span className="text-[11px] text-slate-500 block">
                  Permanently delete account (guarded against active assignments)
                </span>
              </div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete User</span>
                </button>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEdit ? "Save Account Changes" : "Provision User Account"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
