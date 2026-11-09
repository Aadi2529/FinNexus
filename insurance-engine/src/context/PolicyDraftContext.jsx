import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "FINNEXUS_INSURANCE_POLICY_DRAFT_V1";
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const PolicyDraftContext = createContext(null);

export function PolicyDraftProvider({ children }) {
  const [draft, setDraft] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const debounceTimerRef = useRef(null);

  // Helper to read stored draft from localStorage or sessionStorage
  const getStoredDraft = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      const savedAt = new Date(parsed.savedAt).getTime();
      if (Date.now() - savedAt > DRAFT_MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch (err) {
      console.warn("Failed to read draft from storage:", err);
      return null;
    }
  };

  // Helper to persist draft across both localStorage and sessionStorage
  const persistDraft = (payload) => {
    try {
      if (payload) {
        const serialized = JSON.stringify(payload);
        localStorage.setItem(STORAGE_KEY, serialized);
        sessionStorage.setItem(STORAGE_KEY, serialized);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn("Failed to write draft to storage:", err);
    }
  };

  // Load draft on mount with schema validation and expiry check
  useEffect(() => {
    const loaded = getStoredDraft();
    if (loaded && loaded.formData) {
      setDraft(loaded);
      // If we are not currently active inside the new_policy editor form, default to minimized floating widget
      const isCurrentlyInNewPolicyForm =
        typeof window !== "undefined" &&
        window.location.pathname === "/policies" &&
        window.location.search.includes("tab=new_policy");
      if (loaded.isMinimized !== false || !isCurrentlyInNewPolicyForm) {
        setIsMinimized(true);
      }
    }
  }, []);

  // Save draft with debouncing
  const saveDraft = useCallback((formData, customerSnapshot = {}, options = {}) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const performSave = () => {
      // Exclude sensitive credentials or deep tokens
      const sanitizedFormData = { ...formData };
      delete sanitizedFormData.token;
      delete sanitizedFormData.accessToken;
      delete sanitizedFormData.password;
      delete sanitizedFormData.aadhaarNumber;

      const draftPayload = {
        version: 1,
        savedAt: new Date().toISOString(),
        isMinimized: options.minimized !== undefined ? options.minimized : isMinimized,
        customerSnapshot: customerSnapshot || {},
        formData: sanitizedFormData,
      };

      setDraft(draftPayload);
      persistDraft(draftPayload);
    };

    if (options.immediate) {
      performSave();
    } else {
      debounceTimerRef.current = setTimeout(performSave, 500);
    }
  }, [isMinimized]);

  // Minimize draft (displays floating widget)
  const minimizeDraft = useCallback((formData, customerSnapshot = {}) => {
    setIsMinimized(true);
    saveDraft(formData, customerSnapshot, { immediate: true, minimized: true });
  }, [saveDraft]);

  // Restore draft (navigates back to active policy creation form)
  const restoreDraft = useCallback(() => {
    setIsMinimized(false);
    if (draft) {
      const updated = { ...draft, isMinimized: false };
      setDraft(updated);
      persistDraft(updated);
    }
  }, [draft]);

  // Clear draft completely (upon successful submission)
  const clearDraft = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setDraft(null);
    setIsMinimized(false);
    persistDraft(null);
  }, []);

  // Discard draft with confirmation option
  const discardDraft = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  const value = {
    draft,
    hasDraft: !!draft && !!draft.formData,
    isMinimized,
    setIsMinimized,
    saveDraft,
    minimizeDraft,
    restoreDraft,
    clearDraft,
    discardDraft,
  };

  return (
    <PolicyDraftContext.Provider value={value}>
      {children}
    </PolicyDraftContext.Provider>
  );
}

export function usePolicyDraft() {
  const context = useContext(PolicyDraftContext);
  if (!context) {
    throw new Error("usePolicyDraft must be used within a PolicyDraftProvider");
  }
  return context;
}
