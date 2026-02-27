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
import CashFlow from './pages/CashFlow';
import Contracts from './pages/Contracts';
import Rankings from './pages/Rankings';
import Referrals from './pages/Referrals';
import Loans from './pages/Loans';
import Reimbursements from './pages/Reimbursements';
import VehiclePurchases from './pages/VehiclePurchases';
import Apply from './pages/Apply';
import PublicSite from './pages/PublicSite';
import Drivers from './pages/Drivers';
import Relatorios from './pages/Relatorios';
import FleetManagers from './pages/FleetManagers';
import DriverDashboard from './pages/DriverDashboard';
import Applications from './pages/Applications';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Vehicles from './pages/Vehicles';
import Commercials from './pages/Commercials';
import RelatoriosFrota from './pages/RelatoriosFrota';
import UPI from './pages/UPI';
import Messaging from './pages/Messaging';
import Goals from './pages/Goals';
import IVA from './pages/IVA';
import Payments from './pages/Payments';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CashFlow": CashFlow,
    "Contracts": Contracts,
    "Rankings": Rankings,
    "Referrals": Referrals,
    "Loans": Loans,
    "Reimbursements": Reimbursements,
    "VehiclePurchases": VehiclePurchases,
    "Apply": Apply,
    "PublicSite": PublicSite,
    "Drivers": Drivers,
    "Relatorios": Relatorios,
    "FleetManagers": FleetManagers,
    "DriverDashboard": DriverDashboard,
    "Applications": Applications,
    "Dashboard": Dashboard,
    "Documents": Documents,
    "Vehicles": Vehicles,
    "Commercials": Commercials,
    "RelatoriosFrota": RelatoriosFrota,
    "UPI": UPI,
    "Messaging": Messaging,
    "Goals": Goals,
    "IVA": IVA,
    "Payments": Payments,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};