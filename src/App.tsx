import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./views/Home";
import Login from "./views/Login";
import Signup from "./views/Signup";
import Dashboard from "./views/Dashboard";
import ProjectDetail from "./views/ProjectDetail";
import DailyLog from "./views/DailyLog";
import Directory from "./views/Directory";
import Tasks from "./views/Tasks";
import Emails from "./views/Emails";
import RFIs from "./views/RFIs";
import Submittals from "./views/Submittals";
import PunchList from "./views/PunchList";
import Schedule from "./views/Schedule";
import Photos from "./views/Photos";
import Drawings from "./views/Drawings";
import Admin from "./views/Admin";
import Pricing from "./views/Pricing";
import Reporting from "./views/Reporting";
import Insights from "./views/Insights";
import Budget from "./views/Budget";
import PrimeContracts from "./views/PrimeContracts";
import CreatePrimeContract from "./views/CreatePrimeContract";
import ChangeOrders from "./views/ChangeOrders";
import BidManagement from "./views/BidManagement";
import ProjectBidManagement from "./views/ProjectBidManagement";
import BIM from "./views/BIM";
import Estimating from "./views/Estimating";
import Prequalification from "./views/Prequalification";
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/bid-management" element={<BidManagement />} />
        <Route path="/bim" element={<BIM />} />
        <Route path="/estimating" element={<Estimating />} />
        <Route path="/prequalification" element={<Prequalification />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/projects/:id/daily-log" element={<DailyLog />} />
        <Route path="/projects/:id/directory" element={<Directory />} />
        <Route path="/projects/:id/tasks" element={<Tasks />} />
        <Route path="/projects/:id/emails" element={<Emails />} />
        <Route path="/projects/:id/rfis" element={<RFIs />} />
        <Route path="/projects/:id/submittals" element={<Submittals />} />
        <Route path="/projects/:id/punch-list" element={<PunchList />} />
        <Route path="/projects/:id/schedule" element={<Schedule />} />
        <Route path="/projects/:id/photos" element={<Photos />} />
        <Route path="/projects/:id/drawings" element={<Drawings />} />
        <Route path="/projects/:id/reporting" element={<Reporting />} />
        <Route path="/projects/:id/insights" element={<Insights />} />
        <Route path="/projects/:id/budget" element={<Budget />} />
        <Route path="/projects/:id/prime-contracts" element={<PrimeContracts />} />
        <Route path="/projects/:id/prime-contracts/new" element={<CreatePrimeContract />} />
        <Route path="/projects/:id/change-orders" element={<ChangeOrders />} />
        <Route path="/projects/:id/bid-management" element={<ProjectBidManagement />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
