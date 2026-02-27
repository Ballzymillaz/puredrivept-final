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
import AdvancedReports from './pages/AdvancedReports';
import CashFlow from './pages/CashFlow';
import Configuracoes from './pages/Configuracoes';
import DocumentManagement from './pages/DocumentManagement';
import Documents from './pages/Documents';
import DriverDetail from './pages/DriverDetail';
import DriverPerformance from './pages/DriverPerformance';
import Drivers from './pages/Drivers';
import FleetDrivers from './pages/FleetDrivers';
import FleetManagerDashboard from './pages/FleetManagerDashboard';
import FleetManagers from './pages/FleetManagers';
import FleetVehicles from './pages/FleetVehicles';
import Fleets from './pages/Fleets';
import Goals from './pages/Goals';
import IVA from './pages/IVA';
import Loans from './pages/Loans';
import Notifications from './pages/Notifications';
import Onboarding from './pages/Onboarding';
import PublicSite from './pages/PublicSite';
import Rankings from './pages/Rankings';
import Referrals from './pages/Referrals';
import Reimbursements from './pages/Reimbursements';
import Relatorios from './pages/Relatorios';
import RelatoriosFrota from './pages/RelatoriosFrota';
import RelatoriosFrotas from './pages/RelatoriosFrotas';
import UPI from './pages/UPI';
import UserManagement from './pages/UserManagement';
import VehicleManagement from './pages/VehicleManagement';
import VehiclePurchases from './pages/VehiclePurchases';
import Vehicles from './pages/Vehicles';
import DriverDashboard from './pages/DriverDashboard';
import DocumentsHub from './pages/DocumentsHub';
import DocumentApproval from './pages/DocumentApproval';
import PaymentHistory from './pages/PaymentHistory';
import AdvanceRequest from './pages/AdvanceRequest';
import AdvanceApproval from './pages/AdvanceApproval';
import FleetCommunications from './pages/FleetCommunications';
import VehicleAssignment from './pages/VehicleAssignment';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdvancedReports": AdvancedReports,
    "CashFlow": CashFlow,
    "Configuracoes": Configuracoes,
    "DocumentManagement": DocumentManagement,
    "Documents": Documents,
    "DriverDetail": DriverDetail,
    "DriverPerformance": DriverPerformance,
    "Drivers": Drivers,
    "FleetDrivers": FleetDrivers,
    "FleetManagerDashboard": FleetManagerDashboard,
    "FleetManagers": FleetManagers,
    "FleetVehicles": FleetVehicles,
    "Fleets": Fleets,
    "Goals": Goals,
    "IVA": IVA,
    "Loans": Loans,
    "Notifications": Notifications,
    "Onboarding": Onboarding,
    "PublicSite": PublicSite,
    "Rankings": Rankings,
    "Referrals": Referrals,
    "Reimbursements": Reimbursements,
    "Relatorios": Relatorios,
    "RelatoriosFrota": RelatoriosFrota,
    "RelatoriosFrotas": RelatoriosFrotas,
    "UPI": UPI,
    "UserManagement": UserManagement,
    "VehicleManagement": VehicleManagement,
    "VehiclePurchases": VehiclePurchases,
    "Vehicles": Vehicles,
    "DriverDashboard": DriverDashboard,
    "DocumentsHub": DocumentsHub,
    "DocumentApproval": DocumentApproval,
    "PaymentHistory": PaymentHistory,
    "AdvanceRequest": AdvanceRequest,
    "AdvanceApproval": AdvanceApproval,
    "FleetCommunications": FleetCommunications,
    "VehicleAssignment": VehicleAssignment,
}

export const pagesConfig = {
    mainPage: "PublicSite",
    Pages: PAGES,
    Layout: __Layout,
};