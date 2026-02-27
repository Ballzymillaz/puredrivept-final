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
import AdvanceApproval from './pages/AdvanceApproval';
import AdvanceRequest from './pages/AdvanceRequest';
import AdvancedReports from './pages/AdvancedReports';
import CashFlow from './pages/CashFlow';
import Configuracoes from './pages/Configuracoes';
import DocumentApproval from './pages/DocumentApproval';
import DocumentManagement from './pages/DocumentManagement';
import Documents from './pages/Documents';
import DocumentsHub from './pages/DocumentsHub';
import DriverAssignmentHistory from './pages/DriverAssignmentHistory';
import DriverDashboard from './pages/DriverDashboard';
import DriverDetail from './pages/DriverDetail';
import DriverPerformance from './pages/DriverPerformance';
import Drivers from './pages/Drivers';
import FleetCommunications from './pages/FleetCommunications';
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
import PaymentHistory from './pages/PaymentHistory';
import PublicSite from './pages/PublicSite';
import Rankings from './pages/Rankings';
import Referrals from './pages/Referrals';
import Reimbursements from './pages/Reimbursements';
import Relatorios from './pages/Relatorios';
import RelatoriosFrota from './pages/RelatoriosFrota';
import RelatoriosFrotas from './pages/RelatoriosFrotas';
import UPI from './pages/UPI';
import UserManagement from './pages/UserManagement';
import VehicleAssignment from './pages/VehicleAssignment';
import VehicleAssignmentHistory from './pages/VehicleAssignmentHistory';
import VehicleManagement from './pages/VehicleManagement';
import VehiclePurchases from './pages/VehiclePurchases';
import Vehicles from './pages/Vehicles';
import DriverVehicleStatus from './pages/DriverVehicleStatus';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdvanceApproval": AdvanceApproval,
    "AdvanceRequest": AdvanceRequest,
    "AdvancedReports": AdvancedReports,
    "CashFlow": CashFlow,
    "Configuracoes": Configuracoes,
    "DocumentApproval": DocumentApproval,
    "DocumentManagement": DocumentManagement,
    "Documents": Documents,
    "DocumentsHub": DocumentsHub,
    "DriverAssignmentHistory": DriverAssignmentHistory,
    "DriverDashboard": DriverDashboard,
    "DriverDetail": DriverDetail,
    "DriverPerformance": DriverPerformance,
    "Drivers": Drivers,
    "FleetCommunications": FleetCommunications,
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
    "PaymentHistory": PaymentHistory,
    "PublicSite": PublicSite,
    "Rankings": Rankings,
    "Referrals": Referrals,
    "Reimbursements": Reimbursements,
    "Relatorios": Relatorios,
    "RelatoriosFrota": RelatoriosFrota,
    "RelatoriosFrotas": RelatoriosFrotas,
    "UPI": UPI,
    "UserManagement": UserManagement,
    "VehicleAssignment": VehicleAssignment,
    "VehicleAssignmentHistory": VehicleAssignmentHistory,
    "VehicleManagement": VehicleManagement,
    "VehiclePurchases": VehiclePurchases,
    "Vehicles": Vehicles,
    "DriverVehicleStatus": DriverVehicleStatus,
}

export const pagesConfig = {
    mainPage: "PublicSite",
    Pages: PAGES,
    Layout: __Layout,
};