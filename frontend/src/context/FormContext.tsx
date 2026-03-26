/**
 * @file FormContext.tsx - Form State Management Context
 *
 * This file manages ALL of the tax form data for the entire application.
 * It uses React Context -- a way to share state across many components
 * without passing props through every level of the component tree.
 *
 * What this file provides:
 *   1. FormProvider: A wrapper component that holds the form data state
 *   2. useForm(): A custom hook that any component can call to read or
 *      update the form data
 *   3. Functions to update individual fields, add/remove table rows, etc.
 *   4. Auto-calculation of the flat-rate professional expense deduction
 *   5. A "bridge" to the window object so non-React code (e.g., browser
 *      console or backend scripts) can interact with the form
 *
 * How React Context works (simplified):
 *   - <FormProvider> wraps the entire app (in App.tsx)
 *   - Any child component anywhere in the tree can call useForm() to get
 *     the current form data and update functions
 *   - When data changes, all components using useForm() automatically re-render
 *
 * How it fits into the project:
 *   FormProvider (this file) holds the "source of truth" for form data.
 *   SessionContext polls the backend and calls mergeFormData() to update it.
 *   Page components call useForm() to display fields and handle user input.
 *   The types for form data come from types.ts.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { FormData, PageStatus } from '../types';

/**
 * Global Window Interface Extension
 *
 * This "declare global" block tells TypeScript that the window object has
 * an extra property called `__taxPortalBridge`. This bridge lets non-React
 * code (like browser developer tools or backend automation scripts) access
 * and modify the form data.
 *
 * For example, in the browser console you could type:
 *   window.__taxPortalBridge.getData() // see all current form data
 *   window.__taxPortalBridge.updateField('personal', 'main', 'firstName', 'Alice')
 */
declare global {
  interface Window {
    __taxPortalBridge: {
      getData: () => FormData;
      updateField: (page: string, section: string, name: string, value: string | boolean) => void;
      addRow: (page: string, section: string) => void;
      removeRow: (page: string, section: string, index: number) => void;
      updateRowField: (page: string, section: string, index: number, field: string, value: string) => void;
    };
  }
}

/**
 * initialFormData - The default (empty) state of the entire tax form.
 *
 * When the application first loads, all form fields start with these values
 * (mostly empty strings and empty arrays). This object defines the "blank form"
 * that gets progressively filled in by the user or the AI agent.
 *
 * The structure exactly mirrors the FormData interface defined in types.ts.
 */
const initialFormData: FormData = {
  login: { auth: { ahvnumber: '', zugangscode: '' } },

  personal: {
    main: {
      firstName: '', lastName: '', dateofbirth: '', street: '', streetNumber: '',
      apartment: '', zip: '', city: '', phone: '', email: '', ahvnumber: '',
      maritalstatus: '', religion: '', occupation: '', employer: '', workplace: '',
    },
    partner: {
      firstName: '', lastName: '', dateofbirth: '', ahvnumber: '',
      occupation: '', employer: '', religion: '',
    },
    children: [],
    supported: [],
    representative: { name: '', address: '', phone: '' },
    giftsreceived: [],
    giftsgiven: [],
    capitalbenefits: { amount: '', description: '' },
    bankdetails: { iban: '', bankname: '', accountholder: '' },
  },

  income: {
    employment: { bruttolohn: '', ahvcontributions: '', bvgcontributions: '' },
    selfemployment: { enabled: false, revenue: '', expenses: '', netincome: '' },
    pension: { ahvpension: '', bvgpension: '', otherpension: '' },
    capitalwithdrawals: { amount: '' },
    investment: { dividends: '', interest: '' },
    alimony: { amount: '' },
    otherincome: { description: '', amount: '' },
    rental: { eigenmietwert: '', rentalincome: '', maintenancecosts: '' },
  },

  deductions: {
    berufsauslagen: { type: 'flat-rate' },
    flatrate: { amount: '0' },
    effective: [],
    fahrkosten: { amount: '', description: '' },
    verpflegung: { amount: '' },
    weitereberufsauslagen: { amount: '', description: '' },
    pillar3a: { amount: '' },
    insurance: { amount: '' },
    schuldzinsen: { amount: '' },
    unterhaltsbeitraege: { amount: '', recipient: '' },
    kinderbetreuungskosten: { amount: '' },
    weiterbildungskosten: { amount: '' },
    donations: { amount: '', recipient: '' },
    medical: { amount: '' },
    zweiverdienerabzug: { amount: '' },
    otherdeductions: { description: '', amount: '' },
  },

  wealth: {
    movableassets: { cashgold: '' },
    businessshares: [],
    securities: [],
    bankaccounts: [],
    insurances: [],
    vehicles: [],
    realestate: { eigenmietwert: '', steuerwert: '', address: '' },
    otherassets: { description: '', value: '' },
    debts: [],
  },

  attachments: {
    uploads: { lohnausweis: '', bankstatements: '', pillar3a: '', deductions: '', property: '', other: '' },
  },
};

/**
 * rowTemplates - Factory functions for creating new blank rows in dynamic tables.
 *
 * Some sections of the form have dynamic tables where the user can add or remove
 * rows (e.g., children, bank accounts, securities). When the user clicks "Add Row",
 * we need to know what fields a new row should have. These templates define that.
 *
 * Structure: { [pageName]: { [sectionName]: () => newBlankRowObject } }
 *
 * Each value is a function (not an object) to ensure we create a new object
 * every time -- if we reused the same object, all rows would share references
 * and editing one would affect the others.
 */
const rowTemplates: Record<string, Record<string, () => Record<string, string>>> = {
  personal: {
    children: () => ({ name: '', dateOfBirth: '', relationship: '' }),
    supported: () => ({ name: '', relationship: '', contribution: '' }),
    giftsreceived: () => ({ description: '', date: '', amount: '' }),
    giftsgiven: () => ({ description: '', date: '', amount: '' }),
  },
  wealth: {
    businessshares: () => ({ date: '', description: '', wealthAmount: '', incomeAmount: '' }),
    securities: () => ({ name: '', isin: '', quantity: '', value: '', grossReturn: '' }),
    bankaccounts: () => ({ bankName: '', balance: '', interest: '' }),
    insurances: () => ({ company: '', policyNumber: '', surrenderValue: '' }),
    vehicles: () => ({ type: '', brand: '', year: '', value: '' }),
    debts: () => ({ creditor: '', amount: '' }),
  },
  deductions: {
    effective: () => ({ description: '', amount: '' }),
  },
};

/**
 * deepMerge - Recursively merge backend data into the current form state.
 *
 * This is one of the most important utility functions in the project. When the
 * frontend polls the backend for updated form data, we do NOT simply replace
 * the entire form -- that would wipe out any changes the user has made locally.
 * Instead, we "merge" the backend data intelligently.
 *
 * Merge rules:
 *   1. If the values are identical, use the incoming value (no change).
 *   2. If the incoming value is null/undefined, keep the existing base value.
 *   3. If the incoming value is an array, replace the entire array.
 *      Reason: The backend is the "source of truth" for array data (like rows
 *      of children or bank accounts).
 *   4. If both values are objects, recursively merge their properties.
 *   5. IMPORTANT: If the incoming string is EMPTY but the existing string is
 *      NOT empty, we keep the existing value. This prevents the backend from
 *      accidentally clearing out fields the user has already filled in.
 *   6. For all other cases (numbers, booleans, non-empty strings), the
 *      incoming value wins.
 *
 * Example:
 *   base:     { firstName: "Alice", lastName: "" }
 *   incoming: { firstName: "",      lastName: "Mueller" }
 *   result:   { firstName: "Alice", lastName: "Mueller" }
 *   (Alice's firstName is preserved because the incoming value was empty)
 *
 * @template T - The type of the objects being merged
 * @param {T} base - The current form data (what we already have)
 * @param {T} incoming - New data from the backend to merge in
 * @returns {T} The merged result
 */
function deepMerge<T>(base: T, incoming: T): T {
  // If they are the exact same reference or value, just return incoming
  if (base === incoming) return incoming;

  // If incoming is null/undefined, keep what we have (don't overwrite with nothing)
  if (incoming === null || incoming === undefined) return base;

  // Arrays are replaced entirely -- the backend is authoritative for row data
  if (Array.isArray(incoming)) return incoming;

  // If both are objects (but not arrays), merge them property by property
  if (typeof incoming === 'object' && typeof base === 'object' && !Array.isArray(base)) {
    // Start with a shallow copy of the base object
    const result = { ...base } as Record<string, unknown>;

    // Iterate over every property in the incoming object
    for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
      const existing = result[k];

      // KEY RULE: Do not overwrite a user-filled string with an empty backend value.
      // This prevents the backend poll from clearing fields the user has typed into.
      if (typeof v === 'string' && v === '' && typeof existing === 'string' && existing !== '') {
        continue; // Skip this property -- keep the user's value
      }

      // If both the existing and incoming values are nested objects, recurse deeper
      if (typeof v === 'object' && v !== null && typeof existing === 'object' && existing !== null && !Array.isArray(v)) {
        result[k] = deepMerge(existing, v);
      } else {
        // For all other cases (non-empty strings, numbers, booleans, arrays), use incoming
        result[k] = v;
      }
    }
    return result as T;
  }

  // For primitive types (strings, numbers, booleans), the incoming value wins
  return incoming;
}

/**
 * FormContextType - The interface for everything the FormContext provides.
 *
 * Any component that calls useForm() gets back an object with this shape.
 * It includes the current form data, login state, and functions to modify data.
 */
interface FormContextType {
  /** The complete form data object (all pages, all sections, all fields) */
  data: FormData;
  /** Whether the user is currently "logged in" (always true in demo mode) */
  isLoggedIn: boolean;
  /** Function to change the login state */
  setLoggedIn: (v: boolean) => void;
  /** Update a single field: updateField('personal', 'main', 'firstName', 'Alice') */
  updateField: (page: string, section: string, name: string, value: string | boolean) => void;
  /** Add a new blank row to a dynamic table section */
  addRow: (page: string, section: string) => void;
  /** Remove a row at a specific index from a dynamic table section */
  removeRow: (page: string, section: string, index: number) => void;
  /** Update one field within a specific row of a dynamic table */
  updateRowField: (page: string, section: string, index: number, field: string, value: string) => void;
  /** Get the completion status of a form page ('empty', 'in-progress', 'complete') */
  getPageStatus: (page: string) => PageStatus;
  /** Completely replace all form data (discards current values) */
  replaceFormData: (newData: FormData) => void;
  /** Intelligently merge new data into existing form data (preserves user edits) */
  mergeFormData: (newData: FormData) => void;
}

/**
 * The React Context object. Components read from this via useForm().
 * Initialized to null because the actual value is provided by FormProvider.
 */
const FormContext = createContext<FormContextType | null>(null);

/**
 * FormProvider - The component that provides form state to the entire app.
 *
 * This component wraps the app (in App.tsx) and makes form data available
 * to every child component through React Context. It holds the form data
 * in state and provides functions to update it.
 *
 * @param {object} props
 * @param {ReactNode} props.children - The child components to wrap
 * @returns {JSX.Element} The context provider wrapping children
 */
export function FormProvider({ children }: { children: ReactNode }) {
  /** The main form data state -- starts as a blank form */
  const [data, setData] = useState<FormData>(initialFormData);
  // Login is bypassed for demo purposes -- users are always "logged in"
  const [isLoggedIn, setLoggedIn] = useState(true);

  /**
   * updateField - Update a single field in the form data.
   *
   * This uses a path-based approach: you specify the page, section, and field name.
   * For example: updateField('personal', 'main', 'firstName', 'Alice')
   * This would set data.personal.main.firstName = 'Alice'
   *
   * useCallback ensures this function has a stable reference and does not cause
   * unnecessary re-renders of child components.
   *
   * @param {string} page - Top-level page key (e.g., 'personal', 'income')
   * @param {string} section - Section within the page (e.g., 'main', 'employment')
   * @param {string} name - The field name to update (e.g., 'firstName')
   * @param {string | boolean} value - The new value for the field
   */
  const updateField = useCallback((page: string, section: string, name: string, value: string | boolean) => {
    setData(prev => {
      const next = { ...prev };
      // Navigate to the right page and section using dynamic property access
      const p = next[page as keyof FormData] as Record<string, Record<string, unknown>>;
      if (p && p[section]) {
        // Create a new section object with the updated field (immutable update)
        p[section] = { ...p[section], [name]: value };
      }
      return { ...next };
    });
  }, []);

  /**
   * addRow - Add a new blank row to a dynamic table section.
   *
   * For example: addRow('personal', 'children') adds a new empty child entry.
   * The new row's shape comes from the rowTemplates defined above.
   *
   * Note: JSON.parse(JSON.stringify(prev)) creates a "deep clone" of the state.
   * This is a simple (though not the most efficient) way to ensure we create
   * a completely new object, which React needs to detect the state change.
   *
   * @param {string} page - Top-level page key (e.g., 'personal', 'wealth')
   * @param {string} section - Section with the dynamic array (e.g., 'children', 'bankaccounts')
   */
  const addRow = useCallback((page: string, section: string) => {
    setData(prev => {
      // Deep clone the entire state to avoid mutating the previous state
      const next = JSON.parse(JSON.stringify(prev)) as FormData;
      // Look up the template for this page+section combination
      const template = rowTemplates[page]?.[section];
      if (template) {
        const p = next[page as keyof FormData] as unknown as Record<string, unknown[]>;
        if (Array.isArray(p[section])) {
          // Call the template function to create a fresh blank row and append it
          p[section].push(template());
        }
      }
      return next;
    });
  }, []);

  /**
   * removeRow - Remove a row at a specific index from a dynamic table.
   *
   * For example: removeRow('personal', 'children', 1) removes the second child.
   *
   * @param {string} page - Top-level page key
   * @param {string} section - Section with the dynamic array
   * @param {number} index - Zero-based index of the row to remove
   */
  const removeRow = useCallback((page: string, section: string, index: number) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as FormData;
      const p = next[page as keyof FormData] as unknown as Record<string, unknown[]>;
      if (Array.isArray(p[section])) {
        // splice(index, 1) removes one element at the given position
        p[section].splice(index, 1);
      }
      return next;
    });
  }, []);

  /**
   * updateRowField - Update a single field within a specific row of a dynamic table.
   *
   * For example: updateRowField('personal', 'children', 0, 'name', 'Max')
   * This sets the name of the first child to 'Max'.
   *
   * @param {string} page - Top-level page key
   * @param {string} section - Section with the dynamic array
   * @param {number} index - Zero-based index of the row to update
   * @param {string} field - The field name within the row
   * @param {string} value - The new value for the field
   */
  const updateRowField = useCallback((page: string, section: string, index: number, field: string, value: string) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as FormData;
      const p = next[page as keyof FormData] as unknown as Record<string, Record<string, string>[]>;
      if (Array.isArray(p[section]) && p[section][index]) {
        p[section][index][field] = value;
      }
      return next;
    });
  }, []);

  /**
   * Window Bridge Effect
   *
   * This useEffect attaches the form manipulation functions to the global
   * window object as `window.__taxPortalBridge`. This allows:
   *   - Backend automation scripts to read/write form data
   *   - Developers to inspect and modify form data from the browser console
   *   - Testing tools to interact with the form programmatically
   *
   * The bridge is updated whenever the data or any of the functions change.
   */
  useEffect(() => {
    window.__taxPortalBridge = { getData: () => data, updateField, addRow, removeRow, updateRowField };
  }, [data, updateField, addRow, removeRow, updateRowField]);

  /**
   * Auto-compute Berufsauslagen Pauschale (flat-rate professional expense deduction).
   *
   * In Swiss tax law, employees can deduct professional expenses either as a
   * flat-rate percentage or by itemizing actual expenses. The flat-rate is
   * calculated as 3% of net salary, clamped between CHF 2,000 and CHF 4,000.
   *
   * This effect runs automatically whenever the employment income fields change,
   * keeping the flat-rate amount up to date without manual calculation.
   *
   * Calculation:
   *   1. Net salary = Gross salary - AHV contributions - BVG contributions
   *   2. Flat rate = 3% of net salary, rounded to nearest whole number
   *   3. Clamped to minimum CHF 2,000 and maximum CHF 4,000
   */
  useEffect(() => {
    // Parse salary components -- the || 0 ensures we get 0 instead of NaN for empty strings
    const brutto = Number(data.income.employment.bruttolohn) || 0;
    const ahv = Number(data.income.employment.ahvcontributions) || 0;
    const bvg = Number(data.income.employment.bvgcontributions) || 0;

    // Calculate net salary by subtracting social security contributions
    const nettolohn = brutto - ahv - bvg;

    // Apply the Swiss flat-rate formula:
    // Math.round(nettolohn * 0.03) = 3% of net salary, rounded
    // Math.max(..., 2000) = at least CHF 2,000
    // Math.min(..., 4000) = at most CHF 4,000
    const pauschale = Math.min(Math.max(Math.round(nettolohn * 0.03), 2000), 4000);

    const current = data.deductions.flatrate.amount;
    const newVal = String(pauschale);

    // Only update if the value actually changed (avoids infinite re-render loops)
    if (current !== newVal) {
      setData(prev => ({
        ...prev,
        deductions: {
          ...prev.deductions,
          flatrate: { amount: newVal },
        },
      }));
    }
  }, [data.income.employment.bruttolohn, data.income.employment.ahvcontributions, data.income.employment.bvgcontributions]);

  /**
   * replaceFormData - Completely replace all form data with new data.
   *
   * Unlike mergeFormData, this discards all current values. Use with caution --
   * any unsaved user edits will be lost.
   *
   * @param {FormData} newData - The new complete form data to use
   */
  const replaceFormData = useCallback((newData: FormData) => {
    setData(newData);
  }, []);

  /**
   * mergeFormData - Intelligently merge backend data into the current form state.
   *
   * This uses the deepMerge function to combine new backend data with existing
   * form data without wiping out user edits. See the deepMerge function's
   * documentation above for the detailed merge rules.
   *
   * Called by SessionContext every time it polls the backend for updated form data.
   *
   * @param {FormData} incoming - New data from the backend to merge in
   */
  const mergeFormData = useCallback((incoming: FormData) => {
    setData(prev => deepMerge(prev, incoming));
  }, []);

  /**
   * getPageStatus - Determine how "complete" a form page is.
   *
   * This function counts how many string fields are filled in for a given page
   * and returns a status: 'empty', 'in-progress', or 'complete'.
   *
   * The sidebar uses this to show colored status indicators next to each page link
   * (e.g., a green checkmark for complete pages, a yellow dot for in-progress).
   *
   * Each page has different criteria for what counts:
   *   - personal: checks main taxpayer fields (and partner if married)
   *   - income: checks employment fields
   *   - deductions: checks commuting, pillar 3a, and insurance fields
   *   - wealth: checks if any bank accounts or securities exist
   *   - attachments: checks which documents have been uploaded
   *
   * @param {string} page - The page name to check (e.g., 'personal', 'income')
   * @returns {PageStatus} 'empty' | 'in-progress' | 'complete'
   */
  const getPageStatus = useCallback((page: string): PageStatus => {
    /**
     * Helper: count how many string fields in an object are filled vs total.
     * Only considers string-type values (ignores nested objects, arrays, booleans).
     */
    const checkFields = (obj: Record<string, unknown>): { filled: number; total: number } => {
      let filled = 0, total = 0;
      for (const val of Object.values(obj)) {
        if (typeof val === 'string') {
          total++;
          if (val.trim()) filled++; // Count as filled if non-empty after trimming whitespace
        }
      }
      return { filled, total };
    };

    let totalFilled = 0, totalFields = 0;

    if (page === 'personal') {
      // Check main taxpayer fields
      const main = checkFields(data.personal.main as unknown as Record<string, unknown>);
      totalFilled += main.filled; totalFields += main.total;
      // If married, also check partner fields
      if (data.personal.main.maritalstatus === 'married') {
        const partner = checkFields(data.personal.partner as unknown as Record<string, unknown>);
        totalFilled += partner.filled; totalFields += partner.total;
      }
    } else if (page === 'income') {
      const emp = checkFields(data.income.employment as unknown as Record<string, unknown>);
      totalFilled += emp.filled; totalFields += emp.total;
    } else if (page === 'deductions') {
      // Check three key deduction sections
      for (const sec of ['fahrkosten', 'pillar3a', 'insurance'] as const) {
        const s = checkFields(data.deductions[sec] as unknown as Record<string, unknown>);
        totalFilled += s.filled; totalFields += s.total;
      }
    } else if (page === 'wealth') {
      // Wealth is considered "filled" if there are any bank accounts or securities
      totalFields += 1;
      if (data.wealth.bankaccounts.length > 0 || data.wealth.securities.length > 0) totalFilled++;
    } else if (page === 'attachments') {
      const a = checkFields(data.attachments.uploads as unknown as Record<string, unknown>);
      totalFilled += a.filled; totalFields += a.total;
    } else {
      return 'empty'; // Unknown page name
    }

    // Determine status based on fill ratio
    if (totalFields === 0) return 'empty';
    if (totalFilled === 0) return 'empty';
    if (totalFilled >= totalFields) return 'complete';
    return 'in-progress';
  }, [data]);

  return (
    <FormContext.Provider value={{ data, isLoggedIn, setLoggedIn, updateField, addRow, removeRow, updateRowField, getPageStatus, replaceFormData, mergeFormData }}>
      {children}
    </FormContext.Provider>
  );
}

/**
 * useForm - Custom hook to access the form context from any component.
 *
 * Usage in a component:
 *   const { data, updateField } = useForm();
 *   // data.personal.main.firstName -- read a field
 *   // updateField('personal', 'main', 'firstName', 'Alice') -- update a field
 *
 * This hook will throw an error if called from a component that is NOT
 * inside a <FormProvider>. This is a safety check to catch mistakes early.
 *
 * @returns {FormContextType} The form data and update functions
 * @throws {Error} If called outside of a FormProvider
 */
export function useForm() {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('useForm must be used within FormProvider');
  return ctx;
}
