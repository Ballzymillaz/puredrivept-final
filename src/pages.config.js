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
import Applications from './pages/Applications';
import Apply from './pages/Apply';
import CashFlow from './pages/CashFlow';
import Commercials from './pages/Commercials';
import Contracts from './pages/Contracts';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DriverDashboard from './pages/DriverDashboard';
import Drivers from './pages/Drivers';
import FleetManagers from './pages/FleetManagers';
import Goals from './pages/Goals';
import IVA from './pages/IVA';
import Loans from './pages/Loans';
import Messaging from './pages/Messaging';
import Payments from './pages/Payments';
import PublicSite from './pages/PublicSite';
import Rankings from './pages/Rankings';
import Referrals from './pages/Referrals';
import Reimbursements from './pages/Reimbursements';
import Relatorios from './pages/Relatorios';
import RelatoriosFrota from './pages/RelatoriosFrota';
import UPI from './pages/UPI';
import VehiclePurchases from './pages/VehiclePurchases';
import Vehicles from './pages/Vehicles';
import VehicleDetail from './pages/VehicleDetail';
import Notifications from './pages/Notifications';
import RelatorioVeiculos from './pages/RelatorioVeiculos';
import UserManagement from './pages/UserManagement';
import Fleets from './pages/Fleets';
import RelatorioFrotas from './pages/RelatorioFrotas';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Applications": Applications,
    "Apply": Apply,
    "CashFlow": CashFlow,
    "Commercials": Commercials,
    "Contracts": Contracts,
    "Dashboard": Dashboard,
    "Documents": Documents,
    "DriverDashboard": DriverDashboard,
    "Drivers": Drivers,
    "FleetManagers": FleetManagers,
    "Goals": Goals,
    "IVA": IVA,
    "Loans": Loans,
    "Messaging": Messaging,
    "Payments": Payments,
    "PublicSite": PublicSite,
    "Rankings": Rankings,
    "Referrals": Referrals,
    "Reimbursements": Reimbursements,
    "Relatorios": Relatorios,
    "RelatoriosFrota": RelatoriosFrota,
    "UPI": UPI,
    "VehiclePurchases": VehiclePurchases,
    "Vehicles": Vehicles,
    "VehicleDetail": VehicleDetail,
    "Notifications": Notifications,
    "RelatorioVeiculos": RelatorioVeiculos,
    "UserManagement": UserManagement,
    "Fleets": Fleets,
    "RelatorioFrotas": RelatorioFrotas,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};