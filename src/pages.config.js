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
import Commercials from './pages/Commercials';
import Rankings from './pages/Rankings';
import Referrals from './pages/Referrals';
import Contracts from './pages/Contracts';
import Vehicles from './pages/Vehicles';
import Loans from './pages/Loans';
import PublicSite from './pages/PublicSite';
import Drivers from './pages/Drivers';
import VehiclePurchases from './pages/VehiclePurchases';
import DriverDashboard from './pages/DriverDashboard';
import Apply from './pages/Apply';
import Payments from './pages/Payments';
import UPI from './pages/UPI';
import Reimbursements from './pages/Reimbursements';
import Documents from './pages/Documents';
import CashFlow from './pages/CashFlow';
import Dashboard from './pages/Dashboard';
import Goals from './pages/Goals';
import IVA from './pages/IVA';
import Relatorios from './pages/Relatorios';
import Applications from './pages/Applications';
import FleetManagers from './pages/FleetManagers';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Commercials": Commercials,
    "Rankings": Rankings,
    "Referrals": Referrals,
    "Contracts": Contracts,
    "Vehicles": Vehicles,
    "Loans": Loans,
    "PublicSite": PublicSite,
    "Drivers": Drivers,
    "VehiclePurchases": VehiclePurchases,
    "DriverDashboard": DriverDashboard,
    "Apply": Apply,
    "Payments": Payments,
    "UPI": UPI,
    "Reimbursements": Reimbursements,
    "Documents": Documents,
    "CashFlow": CashFlow,
    "Dashboard": Dashboard,
    "Goals": Goals,
    "IVA": IVA,
    "Relatorios": Relatorios,
    "Applications": Applications,
    "FleetManagers": FleetManagers,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};