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
import Applications from './pages/Applications';
import Apply from './pages/Apply';
import CashFlow from './pages/CashFlow';
import Commercials from './pages/Commercials';
import Configuracoes from './pages/Configuracoes';
import Contracts from './pages/Contracts';
import Dashboard from './pages/Dashboard';
import DashboardModular from './pages/DashboardModular';
import Documents from './pages/Documents';
import DriverDashboard from './pages/DriverDashboard';
import Drivers from './pages/Drivers';
import FleetContracts from './pages/FleetContracts';
import FleetDrivers from './pages/FleetDrivers';
import FleetManagers from './pages/FleetManagers';
import FleetVehicles from './pages/FleetVehicles';
import Fleets from './pages/Fleets';
import Goals from './pages/Goals';
import IVA from './pages/IVA';
import Loans from './pages/Loans';
import Messaging from './pages/Messaging';
import Notifications from './pages/Notifications';
import Onboarding from './pages/Onboarding';
import Payments from './pages/Payments';
import PublicSite from './pages/PublicSite';
import Rankings from './pages/Rankings';
import Referrals from './pages/Referrals';
import Reimbursements from './pages/Reimbursements';
import RelatorioFrotas from './pages/RelatorioFrotas';
import RelatorioVeiculos from './pages/RelatorioVeiculos';
import Relatorios from './pages/Relatorios';
import RelatoriosFrota from './pages/RelatoriosFrota';
import RelatoriosFrotas from './pages/RelatoriosFrotas';
import ReportBuilder from './pages/ReportBuilder';
import ReportContractStatus from './pages/ReportContractStatus';
import ReportDriverUtilization from './pages/ReportDriverUtilization';
import ReportScheduler from './pages/ReportScheduler';
import ReportVehiclePerformance from './pages/ReportVehiclePerformance';
import UPI from './pages/UPI';
import UserManagement from './pages/UserManagement';
import VehicleDetail from './pages/VehicleDetail';
import VehiclePurchases from './pages/VehiclePurchases';
import Vehicles from './pages/Vehicles';
import DocumentManagement from './pages/DocumentManagement';
import VehicleManagement from './pages/VehicleManagement';
import DriverPerformance from './pages/DriverPerformance';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdvancedReports": AdvancedReports,
    "Applications": Applications,
    "Apply": Apply,
    "CashFlow": CashFlow,
    "Commercials": Commercials,
    "Configuracoes": Configuracoes,
    "Contracts": Contracts,
    "Dashboard": Dashboard,
    "DashboardModular": DashboardModular,
    "Documents": Documents,
    "DriverDashboard": DriverDashboard,
    "Drivers": Drivers,
    "FleetContracts": FleetContracts,
    "FleetDrivers": FleetDrivers,
    "FleetManagers": FleetManagers,
    "FleetVehicles": FleetVehicles,
    "Fleets": Fleets,
    "Goals": Goals,
    "IVA": IVA,
    "Loans": Loans,
    "Messaging": Messaging,
    "Notifications": Notifications,
    "Onboarding": Onboarding,
    "Payments": Payments,
    "PublicSite": PublicSite,
    "Rankings": Rankings,
    "Referrals": Referrals,
    "Reimbursements": Reimbursements,
    "RelatorioFrotas": RelatorioFrotas,
    "RelatorioVeiculos": RelatorioVeiculos,
    "Relatorios": Relatorios,
    "RelatoriosFrota": RelatoriosFrota,
    "RelatoriosFrotas": RelatoriosFrotas,
    "ReportBuilder": ReportBuilder,
    "ReportContractStatus": ReportContractStatus,
    "ReportDriverUtilization": ReportDriverUtilization,
    "ReportScheduler": ReportScheduler,
    "ReportVehiclePerformance": ReportVehiclePerformance,
    "UPI": UPI,
    "UserManagement": UserManagement,
    "VehicleDetail": VehicleDetail,
    "VehiclePurchases": VehiclePurchases,
    "Vehicles": Vehicles,
    "DocumentManagement": DocumentManagement,
    "VehicleManagement": VehicleManagement,
    "DriverPerformance": DriverPerformance,
}

export const pagesConfig = {
    mainPage: "Onboarding",
    Pages: PAGES,
    Layout: __Layout,
};