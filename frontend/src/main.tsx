/**
 * @file main.tsx - React Application Entry Point
 *
 * This is the very first file that runs when the frontend starts up.
 * Think of it as the "ignition key" for the entire React application.
 *
 * What it does:
 * 1. Imports global CSS styles so they apply across the whole app
 * 2. Finds the <div id="root"> element in the HTML page (index.html)
 * 3. Renders the <App /> component inside that div
 *
 * The component hierarchy established here is:
 *   StrictMode -> FormProvider -> App
 *
 * - StrictMode: A React development helper that warns about potential problems
 *   (it does not affect the production build at all).
 * - FormProvider: Wraps the app so that every component can access and modify
 *   the tax form data (via React Context). This is the "outer" provider;
 *   App.tsx also wraps with FormProvider inside the router -- the inner one
 *   takes precedence for components inside it.
 *
 * How this fits into the project:
 *   index.html --> main.tsx (this file) --> App.tsx --> all pages & components
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import './styles/forms.css'
import App from './App.tsx'
import { FormProvider } from './context/FormContext'

/**
 * Create the React root and render the application.
 *
 * `document.getElementById('root')!` grabs the <div id="root"> from index.html.
 * The `!` (non-null assertion) tells TypeScript "trust me, this element exists."
 *
 * The component tree rendered here:
 *   <StrictMode>         -- enables extra development-time warnings
 *     <FormProvider>     -- provides form state to the whole app
 *       <App />          -- the main application component (routing, layout, etc.)
 *     </FormProvider>
 *   </StrictMode>
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FormProvider>
      <App />
    </FormProvider>
  </StrictMode>,
)
