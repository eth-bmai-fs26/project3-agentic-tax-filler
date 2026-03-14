import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { FormData, PageStatus } from '../types';

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

/* Row templates keyed by page.section */
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

interface FormContextType {
  data: FormData;
  isLoggedIn: boolean;
  setLoggedIn: (v: boolean) => void;
  updateField: (page: string, section: string, name: string, value: string | boolean) => void;
  addRow: (page: string, section: string) => void;
  removeRow: (page: string, section: string, index: number) => void;
  updateRowField: (page: string, section: string, index: number, field: string, value: string) => void;
  getPageStatus: (page: string) => PageStatus;
}

const FormContext = createContext<FormContextType | null>(null);

export function FormProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FormData>(initialFormData);
  // Login bypassed for demo — always logged in
  const [isLoggedIn, setLoggedIn] = useState(true);

  const updateField = useCallback((page: string, section: string, name: string, value: string | boolean) => {
    setData(prev => {
      const next = { ...prev };
      const p = next[page as keyof FormData] as Record<string, Record<string, unknown>>;
      if (p && p[section]) {
        p[section] = { ...p[section], [name]: value };
      }
      return { ...next };
    });
  }, []);

  const addRow = useCallback((page: string, section: string) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as FormData;
      const template = rowTemplates[page]?.[section];
      if (template) {
        const p = next[page as keyof FormData] as unknown as Record<string, unknown[]>;
        if (Array.isArray(p[section])) {
          p[section].push(template());
        }
      }
      return next;
    });
  }, []);

  const removeRow = useCallback((page: string, section: string, index: number) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as FormData;
      const p = next[page as keyof FormData] as unknown as Record<string, unknown[]>;
      if (Array.isArray(p[section])) {
        p[section].splice(index, 1);
      }
      return next;
    });
  }, []);

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

  useEffect(() => {
    window.__taxPortalBridge = { getData: () => data, updateField, addRow, removeRow, updateRowField };
  }, [data, updateField, addRow, removeRow, updateRowField]);

  // Auto-compute Berufsauslagen Pauschale when income changes
  useEffect(() => {
    const brutto = Number(data.income.employment.bruttolohn) || 0;
    const ahv = Number(data.income.employment.ahvcontributions) || 0;
    const bvg = Number(data.income.employment.bvgcontributions) || 0;
    const nettolohn = brutto - ahv - bvg;
    const pauschale = Math.min(Math.max(Math.round(nettolohn * 0.03), 2000), 4000);
    const current = data.deductions.flatrate.amount;
    const newVal = String(pauschale);
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

  const getPageStatus = useCallback((page: string): PageStatus => {
    const checkFields = (obj: Record<string, unknown>): { filled: number; total: number } => {
      let filled = 0, total = 0;
      for (const val of Object.values(obj)) {
        if (typeof val === 'string') {
          total++;
          if (val.trim()) filled++;
        }
      }
      return { filled, total };
    };

    let totalFilled = 0, totalFields = 0;

    if (page === 'personal') {
      const main = checkFields(data.personal.main as unknown as Record<string, unknown>);
      totalFilled += main.filled; totalFields += main.total;
      if (data.personal.main.maritalstatus === 'married') {
        const partner = checkFields(data.personal.partner as unknown as Record<string, unknown>);
        totalFilled += partner.filled; totalFields += partner.total;
      }
    } else if (page === 'income') {
      const emp = checkFields(data.income.employment as unknown as Record<string, unknown>);
      totalFilled += emp.filled; totalFields += emp.total;
    } else if (page === 'deductions') {
      for (const sec of ['fahrkosten', 'pillar3a', 'insurance'] as const) {
        const s = checkFields(data.deductions[sec] as unknown as Record<string, unknown>);
        totalFilled += s.filled; totalFields += s.total;
      }
    } else if (page === 'wealth') {
      totalFields += 1;
      if (data.wealth.bankaccounts.length > 0 || data.wealth.securities.length > 0) totalFilled++;
    } else if (page === 'attachments') {
      const a = checkFields(data.attachments.uploads as unknown as Record<string, unknown>);
      totalFilled += a.filled; totalFields += a.total;
    } else {
      return 'empty';
    }

    if (totalFields === 0) return 'empty';
    if (totalFilled === 0) return 'empty';
    if (totalFilled >= totalFields) return 'complete';
    return 'in-progress';
  }, [data]);

  return (
    <FormContext.Provider value={{ data, isLoggedIn, setLoggedIn, updateField, addRow, removeRow, updateRowField, getPageStatus }}>
      {children}
    </FormContext.Provider>
  );
}

export function useForm() {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('useForm must be used within FormProvider');
  return ctx;
}
