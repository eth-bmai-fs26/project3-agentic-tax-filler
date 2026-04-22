/**
 * @file types.ts - TypeScript Type Definitions for the Tax Form
 *
 * This file defines all the "shapes" of data used throughout the frontend.
 * In TypeScript, an "interface" describes what properties an object must have
 * and what types those properties are. Think of interfaces like blueprints.
 *
 * Why this file exists:
 *   - It keeps all type definitions in one place so they can be imported
 *     anywhere in the project
 *   - TypeScript uses these types to catch bugs at compile time (e.g., if you
 *     try to access a property that does not exist, you get an error)
 *   - The types mirror the structure of the Swiss tax form, so understanding
 *     these types means understanding how the form data is organized
 *
 * How it fits into the project:
 *   FormContext.tsx imports FormData from here to type the form state.
 *   Page components import specific row types (ChildRow, SecurityRow, etc.)
 *   for rendering dynamic tables where users can add/remove rows.
 *
 * Note: All numeric values (amounts, balances, etc.) are stored as strings,
 * not numbers. This is common in form applications because form inputs
 * always produce strings, and it avoids issues with number formatting.
 */

/* ---- Row types for dynamic tables ---- */
/* These interfaces define rows in tables where the user can add or remove entries. */
/* For example, a taxpayer with 3 children would have 3 ChildRow objects in an array. */

/**
 * Represents one child in the taxpayer's household.
 * Used in the Personal > Children section of the tax form.
 */
export interface ChildRow {
  /** Full name of the child */
  name: string;
  /** Date of birth (e.g., "2010-05-15") */
  dateOfBirth: string;
  /** Relationship to taxpayer (e.g., "son", "daughter", "stepchild") */
  relationship: string;
}

/**
 * Represents a person financially supported by the taxpayer.
 * This is relevant for certain tax deductions in Switzerland.
 */
export interface SupportedPersonRow {
  /** Full name of the supported person */
  name: string;
  /** Relationship to taxpayer (e.g., "parent", "sibling") */
  relationship: string;
  /** Annual financial contribution amount in CHF */
  contribution: string;
}

/**
 * Represents a gift (either received or given).
 * Gifts above certain thresholds may be subject to tax in Switzerland.
 */
export interface GiftRow {
  /** What the gift was (e.g., "Cash gift from grandmother") */
  description: string;
  /** Date the gift was given/received */
  date: string;
  /** Value of the gift in CHF */
  amount: string;
}

/**
 * Represents ownership in a business or partnership.
 * Tracks both the wealth value (what the share is worth) and the
 * income generated from it.
 */
export interface BusinessShareRow {
  /** Date of acquisition or valuation */
  date: string;
  /** Description of the business share */
  description: string;
  /** Taxable wealth value of the share in CHF */
  wealthAmount: string;
  /** Income received from the share in CHF */
  incomeAmount: string;
}

/**
 * Represents a security (stock, bond, fund) owned by the taxpayer.
 * Securities must be declared for both wealth tax and income tax purposes.
 */
export interface SecurityRow {
  /** Name of the security (e.g., "Nestle SA") */
  name: string;
  /** ISIN -- International Securities Identification Number (unique ID for the security) */
  isin: string;
  /** Number of shares/units owned */
  quantity: string;
  /** Total market value in CHF */
  value: string;
  /** Gross return (dividends/interest before taxes) in CHF */
  grossReturn: string;
}

/**
 * Represents a bank account owned by the taxpayer.
 * Both the balance (wealth) and interest earned (income) must be declared.
 */
export interface BankAccountRow {
  /** Name of the bank (e.g., "UBS", "PostFinance") */
  bankName: string;
  /** Account balance at end of tax year in CHF */
  balance: string;
  /** Interest earned during the tax year in CHF */
  interest: string;
}

/**
 * Represents a life insurance or savings insurance policy.
 * The surrender value (what you would get if you cashed it out) is taxable wealth.
 */
export interface InsuranceRow {
  /** Name of the insurance company */
  company: string;
  /** Policy identification number */
  policyNumber: string;
  /** Current surrender/cash-out value in CHF */
  surrenderValue: string;
}

/**
 * Represents a vehicle owned by the taxpayer.
 * Vehicles are part of taxable wealth in Switzerland.
 */
export interface VehicleRow {
  /** Type of vehicle (e.g., "car", "motorcycle") */
  type: string;
  /** Brand/make of the vehicle (e.g., "Toyota", "BMW") */
  brand: string;
  /** Year of manufacture */
  year: string;
  /** Estimated current market value in CHF */
  value: string;
}

/**
 * Represents a debt owed by the taxpayer.
 * Debts can be subtracted from total wealth for tax purposes.
 */
export interface DebtRow {
  /** Who the debt is owed to (e.g., "Mortgage - UBS") */
  creditor: string;
  /** Outstanding debt amount in CHF */
  amount: string;
}

/**
 * Represents an itemized professional expense (used when the taxpayer
 * chooses "effective" expenses instead of the flat-rate deduction).
 */
export interface EffectiveExpenseRow {
  /** What the expense was for (e.g., "Professional tools") */
  description: string;
  /** Expense amount in CHF */
  amount: string;
}

/* ---- Main form data structure ---- */

/**
 * FormData - The complete data model for the entire Swiss tax form.
 *
 * This is the single most important type in the project. It defines every
 * field in the tax form, organized into sections that mirror the actual
 * Swiss tax declaration:
 *
 *   - login:       Authentication credentials for the tax portal
 *   - personal:    Taxpayer info, partner, children, gifts, bank details
 *   - income:      Employment income, pensions, investments, rental income
 *   - deductions:  Professional expenses, insurance, donations, medical costs
 *   - wealth:      Bank accounts, securities, real estate, vehicles, debts
 *   - attachments: Uploaded supporting documents
 *
 * The FormContext stores one instance of this interface and provides
 * functions to update individual fields within it.
 */
export interface FormData {
  /** Login/authentication section */
  login: {
    auth: {
      /** AHV number -- Swiss social security number (format: 756.XXXX.XXXX.XX) */
      ahvnumber: string;
      /** Access code provided by the tax authority */
      zugangscode: string;
    };
  };

  /** Personal information section */
  personal: {
    /** Main taxpayer details */
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
      /** AHV (social security) number */
      ahvnumber: string;
      /** e.g., "single", "married", "divorced" */
      maritalstatus: string;
      /** Religious denomination (affects church tax in some cantons) */
      religion: string;
      occupation: string;
      employer: string;
      workplace: string;
    };
    /** Spouse/partner details (only relevant if married) */
    partner: {
      firstName: string;
      lastName: string;
      dateofbirth: string;
      ahvnumber: string;
      occupation: string;
      employer: string;
      religion: string;
    };
    /** List of dependent children (dynamic -- user can add/remove rows) */
    children: ChildRow[];
    /** List of other financially supported persons */
    supported: SupportedPersonRow[];
    /** Tax representative (e.g., an accountant acting on behalf of the taxpayer) */
    representative: {
      name: string;
      address: string;
      phone: string;
    };
    /** Gifts received during the tax year */
    giftsreceived: GiftRow[];
    /** Gifts given during the tax year */
    giftsgiven: GiftRow[];
    /** One-time capital benefits (e.g., lump-sum pension payout) */
    capitalbenefits: {
      amount: string;
      description: string;
    };
    /** Bank account for tax refunds */
    bankdetails: {
      /** International Bank Account Number */
      iban: string;
      bankname: string;
      accountholder: string;
    };
  };

  /** Income section -- all sources of taxable income */
  income: {
    /** Employment income from a salaried position */
    employment: {
      /** Gross salary (Bruttolohn) in CHF */
      bruttolohn: string;
      /** AHV/IV/EO social security contributions deducted from salary */
      ahvcontributions: string;
      /** BVG (occupational pension) contributions deducted from salary */
      bvgcontributions: string;
    };
    /** Self-employment income (freelancers, sole proprietors) */
    selfemployment: {
      /** Whether the taxpayer has self-employment income */
      enabled: boolean;
      revenue: string;
      expenses: string;
      netincome: string;
    };
    /** Pension income from various pillars of the Swiss pension system */
    pension: {
      /** First pillar -- state pension (AHV/IV) */
      ahvpension: string;
      /** Second pillar -- occupational pension (BVG) */
      bvgpension: string;
      /** Any other pension income */
      otherpension: string;
    };
    /** Lump-sum withdrawals from pension funds */
    capitalwithdrawals: { amount: string };
    /** Investment income */
    investment: {
      /** Dividend income from stocks */
      dividends: string;
      /** Interest income from savings/bonds */
      interest: string;
    };
    /** Alimony/maintenance payments received */
    alimony: { amount: string };
    /** Any other income not covered above */
    otherincome: { description: string; amount: string };
    /** Rental and property income */
    rental: {
      /** Eigenmietwert -- imputed rental value for owner-occupied property (a Swiss tax concept) */
      eigenmietwert: string;
      /** Actual rental income from rented-out properties */
      rentalincome: string;
      /** Costs of maintaining rental properties */
      maintenancecosts: string;
    };
  };

  /** Deductions section -- amounts that reduce taxable income */
  deductions: {
    /** Professional expenses type: "flat-rate" or "effective" (itemized) */
    berufsauslagen: { type: string };
    /** Flat-rate professional expense deduction (auto-calculated, see FormContext) */
    flatrate: { amount: string };
    /** Itemized professional expenses (used when type is "effective") */
    effective: EffectiveExpenseRow[];
    /** Commuting costs (Fahrkosten) */
    fahrkosten: { amount: string; description: string };
    /** Meal costs at workplace (Verpflegung) */
    verpflegung: { amount: string };
    /** Other professional expenses */
    weitereberufsauslagen: { amount: string; description: string };
    /** Pillar 3a (private pension) contributions -- tax-deductible up to a limit */
    pillar3a: { amount: string };
    /** Insurance premiums deduction */
    insurance: { amount: string };
    /** Debt interest payments (Schuldzinsen) */
    schuldzinsen: { amount: string };
    /** Alimony/maintenance payments made (Unterhaltsbeitraege) */
    unterhaltsbeitraege: { amount: string; recipient: string };
    /** Childcare costs (Kinderbetreuungskosten) */
    kinderbetreuungskosten: { amount: string };
    /** Continuing education costs (Weiterbildungskosten) */
    weiterbildungskosten: { amount: string };
    /** Charitable donations */
    donations: { amount: string; recipient: string };
    /** Medical expenses exceeding a threshold */
    medical: { amount: string };
    /** Dual-income deduction for married couples (Zweiverdienerabzug) */
    zweiverdienerabzug: { amount: string };
    /** Any other deductions not covered above */
    otherdeductions: { description: string; amount: string };
  };

  /** Wealth section -- all taxable assets and liabilities */
  wealth: {
    /** Cash, gold, and other movable assets */
    movableassets: { cashgold: string };
    /** Shares in businesses or partnerships */
    businessshares: BusinessShareRow[];
    /** Stocks, bonds, and investment funds */
    securities: SecurityRow[];
    /** Bank and postal accounts */
    bankaccounts: BankAccountRow[];
    /** Life insurance and savings insurance policies */
    insurances: InsuranceRow[];
    /** Motor vehicles */
    vehicles: VehicleRow[];
    /** Real estate / property */
    realestate: {
      /** Imputed rental value of owner-occupied property */
      eigenmietwert: string;
      /** Official tax value of the property (Steuerwert) */
      steuerwert: string;
      /** Address of the property */
      address: string;
    };
    /** Any other assets not covered above */
    otherassets: { description: string; value: string };
    /** Outstanding debts (can be subtracted from wealth) */
    debts: DebtRow[];
  };

  /** Attachments section -- references to uploaded supporting documents */
  attachments: {
    uploads: {
      /** Salary statement from employer */
      lohnausweis: string;
      /** Bank statements */
      bankstatements: string;
      /** Pillar 3a contribution receipts */
      pillar3a: string;
      /** Receipts for claimed deductions */
      deductions: string;
      /** Property-related documents */
      property: string;
      /** Any other supporting documents */
      other: string;
    };
  };
}

/**
 * PageStatus - Represents how complete a form page is.
 *
 * Used by the sidebar and overview to show visual indicators:
 *   - 'empty':       No fields have been filled in yet
 *   - 'in-progress': Some fields are filled but not all
 *   - 'complete':    All required fields are filled
 */
export type PageStatus = 'empty' | 'in-progress' | 'complete';

/**
 * PageInfo - Metadata about a form page used for navigation.
 *
 * The sidebar and tab navigation use arrays of PageInfo objects
 * to render navigation links with status indicators.
 */
export interface PageInfo {
  /** URL path for the page (e.g., "/personal", "/income") */
  path: string;
  /** Human-readable label shown in the navigation (e.g., "Personal Info") */
  label: string;
  /** Current completion status of the page */
  status: PageStatus;
}
