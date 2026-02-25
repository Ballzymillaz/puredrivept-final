/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Dashboard from './pages/Dashboard';
import Drivers from './pages/Drivers';
import Vehicles from './pages/Vehicles';
import FleetManagers from './pages/FleetManagers';
import Commercials from './pages/Commercials';
import Documents from './pages/Documents';
import Applications from './pages/Applications';
import Payments from './pages/Payments';
import CashFlow from './pages/CashFlow';
import Loans from './pages/Loans';
import Reimbursements from './pages/Reimbursements';
import Referrals from './pages/Referrals';
import VehiclePurchases from './pages/VehiclePurchases';
import Goals from './pages/Goals';
import Rankings from './pages/Rankings';
import UPI from './pages/UPI';
import Apply from './pages/Apply';
import PublicSite from './pages/PublicSite';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Drivers": Drivers,
    "Vehicles": Vehicles,
    "FleetManagers": FleetManagers,
    "Commercials": Commercials,
    "Documents": Documents,
    "Applications": Applications,
    "Payments": Payments,
    "CashFlow": CashFlow,
    "Loans": Loans,
    "Reimbursements": Reimbursements,
    "Referrals": Referrals,
    "VehiclePurchases": VehiclePurchases,
    "Goals": Goals,
    "Rankings": Rankings,
    "UPI": UPI,
    "Apply": Apply,
    "PublicSite": PublicSite,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};