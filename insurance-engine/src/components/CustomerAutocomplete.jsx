import React, { useState, useEffect, useRef } from "react";
import { api } from "../services/api";
import { Search, UserCheck, Plus, X, Loader2, MapPin, Phone, Mail, Building2, User } from "lucide-react";

export default function CustomerAutocomplete({
  selectedCustomerId,
  selectedCustomerSnapshot,
  onSelectCustomer,
  onClearCustomer,
  onOpenCreateCustomerModal,
  disabled = false,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions with debouncing
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const term = searchTerm.trim();
    setLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.insurance.getCustomers({
          search: term || undefined,
          page_size: 15,
        });

        if (res.ok && res.data) {
          const items = Array.isArray(res.data) ? res.data : (res.data.items || []);
          setSuggestions(items);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error("Failed to search customers:", err);
        setSuggestions([]);
      } finally {
        setLoading(false);
        setHighlightedIndex(-1);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, isOpen]);

  const handleSelect = (customer) => {
    onSelectCustomer(customer);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelect(suggestions[highlightedIndex]);
      } else if (highlightedIndex === suggestions.length) {
        onOpenCreateCustomerModal();
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const selectedDisplayName =
    selectedCustomerSnapshot?.fullName ||
    selectedCustomerSnapshot?.name ||
    selectedCustomerSnapshot?.companyName ||
    "";

  return (
    <div ref={containerRef} className="relative w-full">
      {selectedCustomerId && selectedDisplayName ? (
        // Active Selection Pill / Card
        <div className="flex items-center justify-between p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl transition-all">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              {selectedCustomerSnapshot?.customerType === "CORPORATE" ? (
                <Building2 className="w-4 h-4" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {selectedDisplayName}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-slate-600 truncate mt-0.5">
                {selectedCustomerSnapshot?.mobile && (
                  <span className="flex items-center gap-0.5">
                    <Phone className="w-2.5 h-2.5 text-slate-400" />
                    {selectedCustomerSnapshot.mobile}
                  </span>
                )}
                {selectedCustomerSnapshot?.city && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5 text-slate-400" />
                    {selectedCustomerSnapshot.city}
                    {selectedCustomerSnapshot.pincode ? ` (${selectedCustomerSnapshot.pincode})` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={onClearCustomer}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors ml-2 shrink-0"
              title="Change Customer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        // Autocomplete Search Input
        <div className="relative">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              disabled={disabled}
              value={searchTerm}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search by Customer Name, Mobile, or Email..."
              className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-400"
            />
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600 animate-spin" />
            ) : searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            ) : null}
          </div>

          {/* Autocomplete Dropdown List */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
              {suggestions.length > 0 ? (
                suggestions.map((cust, idx) => {
                  const custName =
                    cust.company_name ||
                    cust.full_name ||
                    `${cust.first_name || ""} ${cust.last_name || ""}`.trim() ||
                    "Unnamed Customer";
                  const phone = cust.phone || cust.mobile || "";
                  const email = cust.email || "";
                  const city = cust.city || "";
                  const pincode = cust.pincode || cust.pin_code || "";
                  const isCorporate = cust.customer_type === "CORPORATE";
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={cust.id}
                      onClick={() => handleSelect(cust)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`px-3 py-2.5 cursor-pointer transition-colors ${
                        isHighlighted ? "bg-indigo-50/80" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                              isCorporate ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {isCorporate ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-xs font-bold text-slate-900 truncate">{custName}</span>
                        </div>
                        {cust.customer_type && (
                          <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                            {cust.customer_type}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1 text-[11px] text-slate-500 pl-8">
                        {phone && (
                          <span className="flex items-center gap-1 truncate">
                            <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            {phone}
                          </span>
                        )}
                        {email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            {email}
                          </span>
                        )}
                        {(city || pincode) && (
                          <span className="flex items-center gap-1 truncate text-slate-600 font-medium">
                            <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            {[city, pincode].filter(Boolean).join(" - ")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : !loading ? (
                <div className="px-4 py-4 text-center text-xs text-slate-500">
                  <p>No matching customers found for "{searchTerm}"</p>
                </div>
              ) : null}

              {/* Inline Create Option */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreateCustomerModal();
                }}
                className={`w-full px-3 py-2.5 bg-slate-50 hover:bg-indigo-50/80 text-left flex items-center gap-2 text-xs font-bold text-indigo-700 transition-colors ${
                  highlightedIndex === suggestions.length ? "bg-indigo-50" : ""
                }`}
              >
                <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <span>+ Create New Customer Record</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
