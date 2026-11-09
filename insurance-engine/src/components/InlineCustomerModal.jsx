import React, { useState } from "react";
import { api } from "../services/api";
import { X, UserPlus, Building2, User, Loader2, AlertCircle } from "lucide-react";
import { FormInput } from "./common";
import {
  validateIndianMobile,
  validateEmail,
  validateName,
  validatePinCode,
} from "../utils/validation";

export default function InlineCustomerModal({ isOpen, onClose, onCustomerCreated }) {
  const [customerType, setCustomerType] = useState("INDIVIDUAL");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("Male");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setCustomerType("INDIVIDUAL");
    setFirstName("");
    setLastName("");
    setCompanyName("");
    setPhone("");
    setEmail("");
    setGender("Male");
    setCity("");
    setState("");
    setPincode("");
    setAddress("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (customerType === "INDIVIDUAL") {
      const fnCheck = validateName(firstName, "First Name", true);
      if (!fnCheck.isValid) {
        setError(fnCheck.error);
        return;
      }
      if (lastName.trim()) {
        const lnCheck = validateName(lastName, "Last Name", false);
        if (!lnCheck.isValid) {
          setError(lnCheck.error);
          return;
        }
      }
    } else {
      const cnCheck = validateName(companyName, "Company / Organization Name", true);
      if (!cnCheck.isValid) {
        setError(cnCheck.error);
        return;
      }
    }

    const mobCheck = validateIndianMobile(phone, "Mobile Number", true);
    if (!mobCheck.isValid) {
      setError(mobCheck.error);
      return;
    }

    if (email) {
      const emailCheck = validateEmail(email, "Email Address", false);
      if (!emailCheck.isValid) {
        setError(emailCheck.error);
        return;
      }
    }

    if (pincode) {
      const pinCheck = validatePinCode(pincode, "PIN Code", false);
      if (!pinCheck.isValid) {
        setError(pinCheck.error);
        return;
      }
    }

    setLoading(true);

    const payload = {
      customer_type: customerType,
      phone: phone.trim(),
      email: email.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      pincode: pincode.trim() || null,
      address: address.trim() || null,
    };

    if (customerType === "INDIVIDUAL") {
      payload.first_name = firstName.trim();
      payload.last_name = lastName.trim() || "Customer";
      payload.gender = gender;
    } else {
      payload.company_name = companyName.trim();
      payload.first_name = companyName.trim();
      payload.last_name = "Corporate";
    }

    try {
      const res = await api.insurance.createCustomer(payload);
      if (res.ok && res.data) {
        onCustomerCreated(res.data);
        handleClose();
      } else {
        setError(res.error || "Failed to create customer. Please check input values.");
      }
    } catch (err) {
      console.error("Error creating customer:", err);
      setError("Unexpected network or server error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Create New Customer Master</h3>
              <p className="text-[11px] text-slate-500">Inline registration without leaving your policy draft</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{typeof error === "string" ? error : (error?.error || error?.message || JSON.stringify(error))}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Type Selector */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setCustomerType("INDIVIDUAL")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                customerType === "INDIVIDUAL"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Individual</span>
            </button>
            <button
              type="button"
              onClick={() => setCustomerType("CORPORATE")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                customerType === "CORPORATE"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Corporate / Business</span>
            </button>
          </div>

          {/* Name Fields */}
          {customerType === "INDIVIDUAL" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sharma"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Company / Organization Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. FinNexus Technologies Pvt Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Contact Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormInput
                label="Mobile Number"
                type="mobile"
                required
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <FormInput
                label="Email Address"
                type="email"
                placeholder="user@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Location Snapshot (City, State, PIN Code) */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">City</label>
              <input
                type="text"
                placeholder="e.g. Mumbai"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">State</label>
              <input
                type="text"
                placeholder="e.g. Maharashtra"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <FormInput
                label="PIN Code"
                type="pin"
                placeholder="400001"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
            </div>
          </div>

          {/* Full Address */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Street Address</label>
            <input
              type="text"
              placeholder="Building, street, landmark..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? "Registering..." : "Save & Auto-Select"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
