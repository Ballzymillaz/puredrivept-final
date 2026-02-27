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
import IVA from './pages/IVA';
import Relatorios from './pages/Relatorios';
import Applications from './pages/Applications';
import Rankings from './pages/Rankings';
import Referrals from './pages/Referrals';
import CashFlow from './pages/CashFlow';
import Goals from './pages/Goals';
import Apply from './pages/Apply';
import Commercials from './pages/Commercials';
import FleetManagers from './pages/FleetManagers';
import UPI from './pages/UPI';
import Loans from './pages/Loans';
import Reimbursements from './pages/Reimbursements';
import VehiclePurchases from './pages/VehiclePurchases';
import Documents from './pages/Documents';
import Dashboard from './pages/Dashboard';
import DriverDashboard from './pages/DriverDashboard';
import Contracts from './pages/Contracts';
import DriverFinancialDashboard from './pages/DriverFinancialDashboard';
import Payments from './pages/Payments';
import PublicSite from './pages/PublicSite';
import Drivers from './pages/Drivers';
import Vehicles from './pages/Vehicles';
import RoleManagement from './pages/RoleManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "IVA": IVA,
    "Relatorios": Relatorios,
    "Applications": Applications,
    "Rankings": Rankings,
    "Referrals": Referrals,
    "CashFlow": CashFlow,
    "Goals": Goals,
    "Apply": Apply,
    "Commercials": Commercials,
    "FleetManagers": FleetManagers,
    "UPI": UPI,
    "Loans": Loans,
    "Reimbursements": Reimbursements,
    "VehiclePurchases": VehiclePurchases,
    "Documents": Documents,
    "Dashboard": Dashboard,
    "DriverDashboard": DriverDashboard,
    "Contracts": Contracts,
    "DriverFinancialDashboard": DriverFinancialDashboard,
    "Payments": Payments,
    "PublicSite": PublicSite,
    "Drivers": Drivers,
    "Vehicles": Vehicles,
    "RoleManagement": RoleManagement,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};