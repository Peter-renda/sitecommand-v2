import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ProjectNav from "../components/ProjectNav";
import { 
  Upload, 
  FileText, 
  MapPin, 
  Download, 
  ChevronDown, 
  Search, 
  Filter, 
  Info, 
  Grid, 
  List,
  ChevronRight,
  MoreHorizontal
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
type Drawing = {
  id: string;
  drawing_no: string;
  title: string;
  revision: string;
  drawing_date: string;
  received_date: string;
  discipline: string;
  set_name: string;
  status: string;
};
const DISCIPLINES = [
  { label: "Architectural", prefix: "A" },
  { label: "Civil", prefix: "C" },
  { label: "Electrical", prefix: "E" },
  { label: "Fire Protection", prefix: "FP" },
  { label: "General", prefix: "G" },
  { label: "Landscape", prefix: "L" },
  { label: "Mechanical", prefix: "M" },
  { label: "Plumbing", prefix: "P" },
  { label: "Structural", prefix: "S" },
];
function getDiscipline(drawingNo: string): string {
  if (!drawingNo) return "General";
  const prefix = drawingNo.split(/[0-9]/)[0];
  const disc = DISCIPLINES.find(d => d.prefix === prefix);
  return disc ? disc.label : "General";
}
export default function Drawings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Current Drawings");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch(`/api/projects/${id}/drawings`)
      .then((res) => res.json())
      .then((data) => {
        const rawDrawings = data.drawings || [];
        const processedDrawings = rawDrawings.map((d: any) => ({
          ...d,
          discipline: d.discipline || getDiscipline(d.drawing_no),
          set_name: d.set_name || "Original Set",
          status: d.status || "Published"
        }));
        setDrawings(processedDrawings);
        setLoading(false);
      });
  }, [id]);
  const filteredDrawings = useMemo(() => {
    return drawings.filter(d => 
      d.drawing_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [drawings, searchQuery]);
  const groupedDrawings = useMemo(() => {
    const groups: Record<string, Drawing[]> = {};
    filteredDrawings.forEach(d => {
      if (!groups[d.discipline]) groups[d.discipline] = [];
      groups[d.discipline].push(d);
    });
    return groups;
  }, [filteredDrawings]);
  const toggleGroup = (discipline: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(discipline)) next.delete(discipline);
    else next.add(discipline);
    setCollapsedGroups(next);
  };
  return (
    <div className="min-h-screen bg-[#f8f9fa] overflow-y-auto">
      <ProjectNav projectId={id!} />
      
      {/* Header */}
      <header className="bg-white px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Drawings</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="bg-[#ff5a1f] hover:bg-[#e64a19] text-white px-4 py-2 rounded font-semibold text-sm transition-colors flex items-center gap-2">
              Upload
            </button>
            <div className="relative group">
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded font-semibold text-sm transition-colors flex items-center gap-1">
                Reports <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute right-0 z-20 mt-1 hidden min-w-[220px] rounded border border-gray-200 bg-white py-1 shadow-lg group-hover:block">
                {[
                  "All Sets and Revisions",
                  "Sketches",
                  "Measurements"
                ].map((option) => (
                  <button
                    key={option}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded font-semibold text-sm transition-colors flex items-center gap-2">
              Create Locations
            </button>
            <div className="relative group">
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded font-semibold text-sm transition-colors flex items-center gap-1">
                Export <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <div className="w-10 h-5 bg-gray-300 rounded-full relative cursor-pointer">
                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm"></div>
              </div>
              <span className="text-xs font-medium text-gray-500">Subscribe</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">View, manage, and upload all of your drawings from the Drawings log.</p>
        
        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200 -mb-4">
          {["Current Drawings", "Drawing Sets", "Trash"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-3 text-sm font-bold transition-colors relative",
                activeTab === tab ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900 rounded-t-full"></div>}
            </button>
          ))}
        </div>
      </header>
      {/* Toolbar */}
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button className="flex items-center gap-2 text-sm font-bold text-gray-700 px-3 py-2 hover:bg-gray-100 rounded transition-colors">
            <Filter className="w-4 h-4" /> Filters
          </button>
          <div className="relative">
            <button className="flex items-center justify-between w-48 px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              Discipline <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="relative">
            <button className="flex items-center justify-between w-48 px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              Set <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center bg-gray-200 p-1 rounded">
          <button 
            onClick={() => setViewMode("list")}
            className={cn("p-1.5 rounded transition-colors", viewMode === "list" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900")}
          >
            <List className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode("grid")}
            className={cn("p-1.5 rounded transition-colors", viewMode === "grid" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900")}
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Table */}
      <div className="px-6 pb-10">
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-[#f2f4f6] border-b border-gray-200">
                <th className="w-10 p-3">
                  <div className="flex flex-col items-center gap-1">
                    <ChevronDown className="w-3 h-3 text-gray-500" />
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                  </div>
                </th>
                <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider">Drawing No.</th>
                <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider">Drawing Title</th>
                <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider">Revision</th>
                <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider">Drawing Date</th>
                <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider">Received Date</th>
                <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider">Set</th>
                <th className="px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {(Object.entries(groupedDrawings) as [string, Drawing[]][]).map(([discipline, items]) => (
                <React.Fragment key={discipline}>
                  {/* Group Header */}
                  <tr className="bg-white border-b border-gray-200">
                    <td className="p-3">
                      <button 
                        onClick={() => toggleGroup(discipline)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <ChevronRight className={cn("w-4 h-4 text-gray-500 transition-transform", !collapsedGroups.has(discipline) && "rotate-90")} />
                      </button>
                    </td>
                    <td colSpan={7} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                        <span className="font-bold text-gray-900">{discipline} ({items.length})</span>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Group Items */}
                  {!collapsedGroups.has(discipline) && items.map((d) => (
                    <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                          <Info className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-blue-600 font-medium hover:underline">
                          {d.drawing_no}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium uppercase">{d.title}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-700">{d.revision}</span>
                          <button className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 transition-colors uppercase">
                            See All
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{d.drawing_date ? new Date(d.drawing_date).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{d.received_date ? new Date(d.received_date).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3">
                        <button className="text-blue-600 hover:underline">
                          {d.set_name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          
          {loading && (
            <div className="p-10 text-center text-gray-400">Loading drawings...</div>
          )}
          
          {!loading && filteredDrawings.length === 0 && (
            <div className="p-20 text-center">
              <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No drawings found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
