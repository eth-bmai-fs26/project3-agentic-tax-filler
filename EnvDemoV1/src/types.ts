/* ---- Row types for dynamic tables ---- */

export interface ChildRow {
  name: string;
  dateOfBirth: string;
  relationship: string;
}

export interface SupportedPersonRow {
  name: string;
  relationship: string;
  contribution: string;
}

export interface GiftRow {
  description: string;
  date: string;
  amount: string;
}

export interface BusinessShareRow {
  date: string;
  description: string;
  wealthAmount: string;
  incomeAmount: string;
}

export interface SecurityRow {
  name: string;
  isin: string;
  quantity: string;
  value: string;
  grossReturn: string;
}

export interface BankAccountRow {
  bankName: string;
  balance: string;
  interest: string;
}

export interface InsuranceRow {
  company: string;
  policyNumber: string;
  surrenderValue: string;
}

export interface VehicleRow {
  type: string;
  brand: string;
  year: string;
  value: string;
}

export interface DebtRow {
  creditor: string;
  amount: string;
}

export interface EffectiveExpenseRow {
  description: string;
  amount: string;
}

/* ---- Main form data structure ---- */

export interface FormData {
  login: {
    auth: { ahvnumber: string; zugangscode: string };
  };

  personal: {
    main: {
      firstName: string;
      lastName: string;
      dateofbirth: string;
      street: string;
      streetNumber: string;
      apartment: string;
      zip: string;
      city: string;
      phone: string;
      email: string;
      ahvnumber: string;
      maritalstatus: string;
      religion: string;
      occupation: string;
      employer: string;
      workplace: string;
    };
    partner: {
      firstName: string;
      lastName: string;
      dateofbirth: string;
      ahvnumber: string;
      occupation: string;
      employer: string;
      religion: string;
    };
    children: ChildRow[];
    supported: SupportedPersonRow[];
    representative: {
      name: string;
      address: string;
      phone: string;
    };
    giftsreceived: GiftRow[];
    giftsgiven: GiftRow[];
    capitalbenefits: {
      amount: string;
      description: string;
    };
    bankdetails: {
      iban: string;
      bankname: string;
      accountholder: string;
    };
  };

  income: {
    employment: {
      bruttolohn: string;
      ahvcontributions: string;
      bvgcontributions: string;
    };
    selfemployment: {
      enabled: boolean;
      revenue: string;
      expenses: string;
      netincome: string;
    };
    pension: {
      ahvpension: string;
      bvgpension: string;
      otherpension: string;
    };
    capitalwithdrawals: { amount: string };
    investment: { dividends: string; interest: string };
    alimony: { amount: string };
    otherincome: { description: string; amount: string };
    rental: {
      eigenmietwert: string;
      rentalincome: string;
      maintenancecosts: string;
    };
  };

  deductions: {
    berufsauslagen: { type: string };
    flatrate: { amount: string };
    effective: EffectiveExpenseRow[];
    fahrkosten: { amount: string; description: string };
    verpflegung: { amount: string };
    weitereberufsauslagen: { amount: string; description: string };
    pillar3a: { amount: string };
    insurance: { amount: string };
    schuldzinsen: { amount: string };
    unterhaltsbeitraege: { amount: string; recipient: string };
    kinderbetreuungskosten: { amount: string };
    weiterbildungskosten: { amount: string };
    donations: { amount: string; recipient: string };
    medical: { amount: string };
    zweiverdienerabzug: { amount: string };
    otherdeductions: { description: string; amount: string };
  };

  wealth: {
    movableassets: { cashgold: string };
    businessshares: BusinessShareRow[];
    securities: SecurityRow[];
    bankaccounts: BankAccountRow[];
    insurances: InsuranceRow[];
    vehicles: VehicleRow[];
    realestate: {
      eigenmietwert: string;
      steuerwert: string;
      address: string;
    };
    otherassets: { description: string; value: string };
    debts: DebtRow[];
  };

  attachments: {
    uploads: {
      lohnausweis: string;
      bankstatements: string;
      pillar3a: string;
      deductions: string;
      property: string;
      other: string;
    };
  };
}

export type PageStatus = 'empty' | 'in-progress' | 'complete';

export interface PageInfo {
  path: string;
  label: string;
  status: PageStatus;
}
