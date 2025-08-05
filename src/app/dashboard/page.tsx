'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Toast, useToast } from '@/components/Toast';
import { InvoiceStorageService } from '@/lib/invoiceStorage';
import { FileStorageService } from '@/lib/fileStorage';
import { standardizeVendorName } from '@/lib/dataUtils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { 
  FileText, 
  DollarSign, 
  Download, 
  Upload, 
  RefreshCw, 
  ExternalLink,
  BarChart3,
  LogOut,
  Plus,
  X,
  FileUp,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Calendar,
  Users,
  Clock,
  Activity,
  PieChart as PieChartIcon,
  Trash2,
  Edit3,
  Info
} from 'lucide-react';

// Component-level type definitions
type FilterState = {
  vendorName: string;
  customerName: string;
  minAmount: string;
  maxAmount: string;
  minItems: string;
  maxItems: string;
  dateFrom: string;
  dateTo: string;
  invoiceNumber: string;
  commodityItem: string;
  sortBy: 'totalAmount' | 'commodityPrice' | 'date' | 'vendor';
  sortOrder: 'asc' | 'desc';
};

// Chart colors for variety
const chartColors = {
  vibrant: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'],
  professional: ['#2E86AB', '#A23B72', '#F18F01', '#C73E1D', '#5D737E', '#64A250', '#4A4A4A', '#8B5A3C'],
  modern: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7']
};

// --- Reusable Components (defined outside Dashboard to prevent re-renders) ---

// Glass morphism card component
const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white border border-gray-200 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 ${className}`}>
    {children}
  </div>
);
GlassCard.displayName = 'GlassCard';

// Professional Stats Cards Component with Glass Effect
const StatsCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
  <GlassCard className="p-6 hover:transform hover:scale-105 transition-all duration-300">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className={`p-4 rounded-2xl shadow-lg`} style={{ backgroundColor: color }}>
        <Icon size={28} className="text-white" />
      </div>
    </div>
  </GlassCard>
);
StatsCard.displayName = 'StatsCard';

// Custom tooltip component for vendor chart
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length || !payload[0] || !payload[0].payload) {
    return null;
  }
  
  const data = payload[0].payload;
  
  if (!data || typeof data.amount === 'undefined' || typeof data.invoiceCount === 'undefined') {
    return null;
  }
  
  // Check if this is showing individual invoices vs vendor breakdown
  const isIndividualInvoice = data.invoiceCount === 1;
  
  return (
    <div className="backdrop-blur-lg bg-white/90 border border-white/30 rounded-xl p-4 shadow-xl">
      <h3 className="text-gray-900 font-bold text-sm mb-2">{data.fullName || 'Unknown'}</h3>
      <div className="space-y-1">
        <p className="text-gray-700 text-sm">
          <span className="font-medium">{isIndividualInvoice ? 'Amount:' : 'Total Amount:'}</span> ${data.amount.toLocaleString()}
        </p>
        
        {/* Show commodity item details if available (when filtering by commodity) */}
        {data.commodityItem && (
          <>
            <p className="text-gray-700 text-sm">
              <span className="font-medium">Item:</span> {data.commodityItem}
            </p>
            <p className="text-gray-700 text-sm">
              <span className="font-medium">Unit Price:</span> ${data.commodityPrice?.toFixed(2) || '0.00'}
            </p>
            <p className="text-gray-700 text-sm">
              <span className="font-medium">Quantity:</span> {data.commodityQuantity || 0}
            </p>
            <p className="text-gray-700 text-sm">
              <span className="font-medium">Item Total:</span> ${data.commodityTotal?.toFixed(2) || '0.00'}
            </p>
          </>
        )}
        
        {!isIndividualInvoice && (
          <>
            <p className="text-gray-700 text-sm">
              <span className="font-medium">Invoices:</span> {data.invoiceCount}
            </p>
            <p className="text-gray-700 text-sm">
              <span className="font-medium">Avg per Invoice:</span> ${data.invoiceCount > 0 ? (data.amount / data.invoiceCount).toFixed(2) : '0.00'}
            </p>
          </>
        )}
        {isIndividualInvoice && data.invoices && data.invoices.length > 0 && !data.commodityItem && (
          <>
            <p className="text-gray-700 text-sm">
              <span className="font-medium">Date:</span> {data.invoices[0].invoiceDate || 'N/A'}
            </p>
            <p className="text-gray-700 text-sm">
              <span className="font-medium">Items:</span> {data.invoices[0].extractedData?.commodity_details?.total_items || 0}
            </p>
          </>
        )}
      </div>
    </div>
  );
};
CustomTooltip.displayName = 'CustomTooltip';

// Memoized Filter Component to prevent focus loss
const FilterInputs = React.memo(({
  tempFilters,
  handleTempFilterChange,
  uniqueVendorNames,
  uniqueCommodityItems,
  uniqueCustomerNames
}: {
  tempFilters: FilterState;
  handleTempFilterChange: (filterKey: string, value: string) => void;
  uniqueVendorNames: string[];
  uniqueCommodityItems: string[];
  uniqueCustomerNames: string[];
}) => {
  const [showVendorAutocomplete, setShowVendorAutocomplete] = useState(false);
  const [showCommodityAutocomplete, setShowCommodityAutocomplete] = useState(false);
  const [showCustomerAutocomplete, setShowCustomerAutocomplete] = useState(false);
  const [filteredVendors, setFilteredVendors] = useState<string[]>([]);
  const [filteredCommodities, setFilteredCommodities] = useState<string[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<string[]>([]);

  // Filter vendors based on input
  const getFilteredVendors = useCallback((query: string) => {
    if (!query.trim()) return [];
    const normalizedQuery = query.toLowerCase();
    const filtered = uniqueVendorNames
      .filter(vendor => vendor.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
    return filtered;
  }, [uniqueVendorNames]);

  // Filter commodities based on input
  const getFilteredCommodities = useCallback((query: string) => {
    if (!query.trim()) return [];
    const normalizedQuery = query.toLowerCase();
    const filtered = uniqueCommodityItems
      .filter(item => item.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
    return filtered;
  }, [uniqueCommodityItems]);

  // Filter customers based on input
  const getFilteredCustomers = useCallback((query: string) => {
    if (!query.trim()) return [];
    const normalizedQuery = query.toLowerCase();
    const filtered = uniqueCustomerNames
      .filter(customer => customer.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
    return filtered;
  }, [uniqueCustomerNames]);

  return (
    <div className="space-y-6">
      {/* First Row - Basic Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Vendor Name Filter with Autocomplete */}
        <div className="relative">
          <label className="block text-sm font-bold text-gray-800 mb-2">
            Vendor Name
          </label>
          <input
            type="text"
            value={tempFilters.vendorName}
            onChange={e => {
              handleTempFilterChange('vendorName', e.target.value);
              const filtered = getFilteredVendors(e.target.value);
              setFilteredVendors(filtered);
              setShowVendorAutocomplete(filtered.length > 0);
            }}
            onFocus={() => {
              if (tempFilters.vendorName.trim()) {
                const filtered = getFilteredVendors(tempFilters.vendorName);
                setFilteredVendors(filtered);
                setShowVendorAutocomplete(filtered.length > 0);
              }
            }}
            onBlur={() => setTimeout(() => setShowVendorAutocomplete(false), 200)}
            placeholder="Search vendor..."
            autoComplete="off"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white text-black placeholder-gray-500 focus:outline-none"
          />
          
          {/* Vendor Autocomplete Dropdown */}
          {showVendorAutocomplete && filteredVendors.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[9999] max-h-60 overflow-y-auto">
              {filteredVendors.map((vendor, index) => (
                <div
                  key={vendor}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    handleTempFilterChange('vendorName', vendor);
                    setShowVendorAutocomplete(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors cursor-pointer text-gray-700 ${
                    index === 0 ? 'rounded-t-xl' : ''} ${index === filteredVendors.length - 1 ? 'rounded-b-xl' : ''}`}
                >
                  <div className="flex items-center space-x-3 w-full">
                    <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="font-medium flex-1">{vendor}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Customer Name Filter with Autocomplete */}
        <div className="relative">
          <label className="block text-sm font-bold text-gray-800 mb-2">
            Customer Name
          </label>
          <input
            type="text"
            value={tempFilters.customerName}
            onChange={e => {
              handleTempFilterChange('customerName', e.target.value);
              const filtered = getFilteredCustomers(e.target.value);
              setFilteredCustomers(filtered);
              setShowCustomerAutocomplete(filtered.length > 0);
            }}
            onFocus={() => {
              if (tempFilters.customerName.trim()) {
                const filtered = getFilteredCustomers(tempFilters.customerName);
                setFilteredCustomers(filtered);
                setShowCustomerAutocomplete(filtered.length > 0);
              }
            }}
            onBlur={() => setTimeout(() => setShowCustomerAutocomplete(false), 200)}
            placeholder="Search customer..."
            autoComplete="off"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white text-black placeholder-gray-500 focus:outline-none"
          />
          
          {/* Customer Autocomplete Dropdown */}
          {showCustomerAutocomplete && filteredCustomers.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[9999] max-h-60 overflow-y-auto">
              {filteredCustomers.map((customer, index) => (
                <div
                  key={customer}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    handleTempFilterChange('customerName', customer);
                    setShowCustomerAutocomplete(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors cursor-pointer text-gray-700 ${
                    index === 0 ? 'rounded-t-xl' : ''} ${index === filteredCustomers.length - 1 ? 'rounded-b-xl' : ''}`}
                >
                  <div className="flex items-center space-x-3 w-full">
                    <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="font-medium flex-1">{customer}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Invoice Number Filter */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">
            Invoice Number
          </label>
          <input
            type="text"
            value={tempFilters.invoiceNumber}
            onChange={e => handleTempFilterChange('invoiceNumber', e.target.value)}
            placeholder="Search invoice..."
            autoComplete="off"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white text-black placeholder-gray-500 focus:outline-none"
          />
        </div>

        {/* Commodity Item Filter with Autocomplete */}
        <div className="relative">
          <label className="block text-sm font-bold text-gray-800 mb-2">
            Commodity Item
          </label>
          <input
            type="text"
            value={tempFilters.commodityItem}
            onChange={e => {
              handleTempFilterChange('commodityItem', e.target.value);
              const filtered = getFilteredCommodities(e.target.value);
              setFilteredCommodities(filtered);
              setShowCommodityAutocomplete(filtered.length > 0);
            }}
            onFocus={() => {
              if (tempFilters.commodityItem.trim()) {
                const filtered = getFilteredCommodities(tempFilters.commodityItem);
                setFilteredCommodities(filtered);
                setShowCommodityAutocomplete(filtered.length > 0);
              }
            }}
            onBlur={() => setTimeout(() => setShowCommodityAutocomplete(false), 200)}
            placeholder="Search items..."
            autoComplete="off"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white text-black placeholder-gray-500 focus:outline-none"
          />
          
          {/* Commodity Autocomplete Dropdown */}
          {showCommodityAutocomplete && filteredCommodities.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[9999] max-h-60 overflow-y-auto">
              {filteredCommodities.map((item, index) => (
                <div
                  key={item}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    handleTempFilterChange('commodityItem', item);
                    setShowCommodityAutocomplete(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors cursor-pointer text-gray-700 ${
                    index === 0 ? 'rounded-t-xl' : ''} ${index === filteredCommodities.length - 1 ? 'rounded-b-xl' : ''}`}
                >
                  <div className="flex items-center space-x-3 w-full">
                    <Activity className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="font-medium flex-1">{item}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sort Options */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">
            Sort By
          </label>
          <div className="flex space-x-2">
            <select
              value={tempFilters.sortBy}
              onChange={e => handleTempFilterChange('sortBy', e.target.value)}
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white text-black focus:outline-none"
            >
              <option value="totalAmount">Total Amount</option>
              <option value="commodityPrice">Item Price</option>
              <option value="date">Date</option>
              <option value="vendor">Vendor</option>
            </select>
            <button
              onClick={() => handleTempFilterChange('sortOrder', tempFilters.sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-blue-50 transition-colors bg-white text-gray-700 font-bold text-lg"
              title={tempFilters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {tempFilters.sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Second Row - Range Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Amount Range */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">
            Amount Range ($)
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              value={tempFilters.minAmount}
              onChange={e => handleTempFilterChange('minAmount', e.target.value)}
              placeholder="Min"
              autoComplete="off"
              className="w-1/2 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white text-black placeholder-gray-500 focus:outline-none"
            />
            <input
              type="number"
              value={tempFilters.maxAmount}
              onChange={e => handleTempFilterChange('maxAmount', e.target.value)}
              placeholder="Max"
              autoComplete="off"
              className="w-1/2 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white text-black placeholder-gray-500 focus:outline-none"
            />
          </div>
        </div>
        
        {/* Item Count Range */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">
            Item Count Range
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              value={tempFilters.minItems}
              onChange={e => handleTempFilterChange('minItems', e.target.value)}
              placeholder="Min"
              autoComplete="off"
              className="w-1/2 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white text-black placeholder-gray-500 focus:outline-none"
            />
            <input
              type="number"
              value={tempFilters.maxItems}
              onChange={e => handleTempFilterChange('maxItems', e.target.value)}
              placeholder="Max"
              autoComplete="off"
              className="w-1/2 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white text-black placeholder-gray-500 focus:outline-none"
            />
          </div>
        </div>
        
        {/* Date From */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">
            Date From
          </label>
          <input
            type="date"
            value={tempFilters.dateFrom}
            onChange={e => handleTempFilterChange('dateFrom', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white text-black focus:outline-none"
          />
        </div>
        
        {/* Date To */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">
            Date To
          </label>
          <input
            type="date"
            value={tempFilters.dateTo}
            onChange={e => handleTempFilterChange('dateTo', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white text-black focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
});
FilterInputs.displayName = 'FilterInputs';

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  
  // Upload modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [hasOversizedFiles, setHasOversizedFiles] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  // Removed unused batch tracking variables
  const [selectedVendorIndex, setSelectedVendorIndex] = useState<number | null>(null);
  const [modalProcessedResults, setModalProcessedResults] = useState<any[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<any>(null);
  const [showPieChartInfo, setShowPieChartInfo] = useState(false);
  
  // Database states
  const [allInvoicesFromDB, setAllInvoicesFromDB] = useState<any[]>([]);
  const [loadingAllInvoices, setLoadingAllInvoices] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadTime, setLoadTime] = useState<number>(0);
  
  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  

  
  // Filter states
  const initialFilterState: FilterState = useMemo(() => ({
    vendorName: '',
    customerName: '',
    minAmount: '',
    maxAmount: '',
    minItems: '',
    maxItems: '',
    dateFrom: '',
    dateTo: '',
    invoiceNumber: '',
    commodityItem: '',
    sortBy: 'totalAmount',
    sortOrder: 'asc'
  }), []);
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [tempFilters, setTempFilters] = useState<FilterState>(initialFilterState);
  
  const INVOICES_PER_PAGE = 10;
  const { toast, showToast, hideToast } = useToast();

  // Enhanced vendor name normalization based on Firebase analysis
  const enhancedVendorNormalization = useCallback((name: string | undefined | null): string => {
    if (!name || name.trim() === '') return 'Unknown';
    
    let normalized = standardizeVendorName(name.trim());
    
    // Firebase analysis showed similar vendor names that should be merged
    // Apply specific normalization rules based on analysis
    const normalizationRules = {
      'Trash Taxi Of Gallc': 'Trash Taxi Of Ga Llc',
      'Trash Taxi Of GA LLC': 'Trash Taxi Of Ga Llc',
      'Trash Taxi Of GA Llc': 'Trash Taxi Of Ga Llc',
      'WM Corporate Services Inc': 'Wm Corporate Services Inc',
      'WM CORPORATE SERVICES INC': 'Wm Corporate Services Inc',
      'Georgia Waste Systems LLC': 'Georgia Waste Systems Llc',
      'GEORGIA WASTE SYSTEMS LLC': 'Georgia Waste Systems Llc',
      'Valley Pallet And Crating LLC': 'Valley Pallet And Crating Llc',
      'VALLEY PALLET AND CRATING LLC': 'Valley Pallet And Crating Llc'
    };
    
    // Apply normalization rules
    for (const [variant, canonical] of Object.entries(normalizationRules)) {
      if (normalized === variant) {
        normalized = canonical;
        break;
      }
    }
    
    return normalized;
  }, []);

  // Helper function to normalize vendor/customer names for case-insensitive grouping
  const normalizeCompanyName = useCallback((name: string | undefined | null): string => {
    return enhancedVendorNormalization(name);
  }, [enhancedVendorNormalization]);

  // Filter invoices based on current filters
  const filteredInvoices = useMemo(() => {
    
    const filtered = allInvoicesFromDB.filter(invoice => {
      // Vendor name filter
      if (filters.vendorName && filters.vendorName.trim() !== '') {
        const normalizedVendorName = normalizeCompanyName(invoice.vendorName).toLowerCase();
        const normalizedFilterValue = enhancedVendorNormalization(filters.vendorName).toLowerCase();
        if (!normalizedVendorName.includes(normalizedFilterValue)) {
          return false;
        }
      }
      
      // Customer name filter
      if (filters.customerName && filters.customerName.trim() !== '') {
        const normalizedCustomerName = normalizeCompanyName(invoice.extractedData?.customer_information?.company_name).toLowerCase();
        const normalizedFilterValue = enhancedVendorNormalization(filters.customerName).toLowerCase();
        if (!normalizedCustomerName.includes(normalizedFilterValue)) {
          return false;
        }
      }
      
      // Amount filters
      const amount = invoice.totalAmount || 0;
      if (filters.minAmount && filters.minAmount.trim() !== '') {
        const minAmount = parseFloat(filters.minAmount);
        if (!isNaN(minAmount) && amount < minAmount) {
          return false;
        }
      }
      if (filters.maxAmount && filters.maxAmount.trim() !== '') {
        const maxAmount = parseFloat(filters.maxAmount);
        if (!isNaN(maxAmount) && amount > maxAmount) {
          return false;
        }
      }
      
      // Item count filters
      const itemCount = invoice.extractedData?.commodity_details?.total_items || 0;
      if (filters.minItems && filters.minItems.trim() !== '') {
        const minItems = parseInt(filters.minItems);
        if (!isNaN(minItems) && itemCount < minItems) {
          return false;
        }
      }
      if (filters.maxItems && filters.maxItems.trim() !== '') {
        const maxItems = parseInt(filters.maxItems);
        if (!isNaN(maxItems) && itemCount > maxItems) {
          return false;
        }
      }
      
      // Date filters
      if (filters.dateFrom || filters.dateTo) {
        let invoiceDate;
        const dateSource = invoice.invoiceDate || invoice.createdAt;
        
        if (dateSource && typeof dateSource.toDate === 'function') {
          invoiceDate = dateSource.toDate();
        } else if (dateSource && typeof dateSource === 'object' && dateSource.seconds) {
          invoiceDate = new Date(dateSource.seconds * 1000);
        } else {
          invoiceDate = new Date(dateSource);
        }
        
        if (filters.dateFrom && filters.dateFrom.trim() !== '') {
          const fromDate = new Date(filters.dateFrom);
          if (!isNaN(fromDate.getTime()) && invoiceDate < fromDate) {
            return false;
          }
        }
        if (filters.dateTo && filters.dateTo.trim() !== '') {
          const toDate = new Date(filters.dateTo);
          if (!isNaN(toDate.getTime()) && invoiceDate > toDate) {
            return false;
          }
        }
      }
      
      // Invoice number filter
      if (filters.invoiceNumber && filters.invoiceNumber.trim() !== '') {
        const normalizedInvoiceNumber = (invoice.invoiceNumber || '').toLowerCase();
        const normalizedFilterValue = filters.invoiceNumber.toLowerCase();
        if (!normalizedInvoiceNumber.includes(normalizedFilterValue)) {
          return false;
        }
      }
      
      // Commodity item filter
      if (filters.commodityItem && filters.commodityItem.trim() !== '') {
        const commodityItems = invoice.extractedData?.commodity_details?.items || [];
        const searchTerm = filters.commodityItem.toLowerCase();
        
        const hasMatchingItem = commodityItems.some((item: any) => {
          const description = (item.description || item.item || '').toLowerCase();
          return description.includes(searchTerm);
        });
        
        if (!hasMatchingItem) {
          return false;
        }
      }
      
      return true;
    });
    
    // Sort the filtered invoices
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (filters.sortBy) {
        case 'totalAmount':
          aValue = a.totalAmount || 0;
          bValue = b.totalAmount || 0;
          break;
        case 'commodityPrice':
          // Get the highest commodity price from each invoice
          const aItems = a.extractedData?.commodity_details?.items || [];
          const bItems = b.extractedData?.commodity_details?.items || [];
          aValue = aItems.length > 0 ? Math.max(...aItems.map((item: any) => item.unit_price || 0)) : 0;
          bValue = bItems.length > 0 ? Math.max(...bItems.map((item: any) => item.unit_price || 0)) : 0;
          break;
        case 'date':
          const aDate = a.invoiceDate || a.createdAt;
          const bDate = b.invoiceDate || b.createdAt;
          aValue = aDate && typeof aDate.toDate === 'function' ? aDate.toDate() : new Date(aDate);
          bValue = bDate && typeof bDate.toDate === 'function' ? bDate.toDate() : new Date(bDate);
          break;
        case 'vendor':
          aValue = normalizeCompanyName(a.vendorName);
          bValue = normalizeCompanyName(b.vendorName);
          break;
        default:
          return 0;
      }
      
      if (filters.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    return sorted;
  }, [allInvoicesFromDB, filters, normalizeCompanyName, enhancedVendorNormalization]);

  // Calculate analytics data based on filtered invoices
  const analyticsData = useMemo(() => {
    const totalInvoices = filteredInvoices.length;
    const totalAmount = filteredInvoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
    const averageAmount = totalInvoices > 0 ? totalAmount / totalInvoices : 0;
    
    // Check if we have commodity item filter active
    const hasCommodityFilter = filters.commodityItem && filters.commodityItem.trim() !== '';
    const hasActiveFilters = Object.values(filters).some(value => value && value.trim() !== '');
    
    let topVendors;
    let chartTitle = 'Top Vendors';
    
    if (hasCommodityFilter) {
      // When filtering by commodity item, show individual invoices with that item
      chartTitle = `Invoices with "${filters.commodityItem}" (${filteredInvoices.length})`;
      
      // Create chart data for invoices containing the filtered commodity item
      topVendors = filteredInvoices.map((invoice, index) => {
        // Find the specific commodity item that matches the filter
        const commodityItems = invoice.extractedData?.commodity_details?.items || [];
        const matchingItem = commodityItems.find((item: any) => {
          const description = (item.description || item.item || '').toLowerCase();
          return description.includes(filters.commodityItem.toLowerCase());
        });
        
        return {
          name: invoice.invoiceNumber || `Invoice ${index + 1}`,
          fullName: `${invoice.invoiceNumber || 'N/A'} - ${normalizeCompanyName(invoice.vendorName)}`,
          amount: invoice.totalAmount || 0,
          invoiceCount: 1,
          invoices: [invoice],
          commodityItem: matchingItem?.description || matchingItem?.item || filters.commodityItem,
          commodityPrice: matchingItem?.unit_price || 0,
          commodityQuantity: matchingItem?.quantity || 0,
          commodityTotal: matchingItem ? (matchingItem.unit_price || 0) * (matchingItem.quantity || 0) : 0,
          index
        };
      });
      
      // Sort based on current sort settings
      if (filters.sortBy === 'totalAmount') {
        topVendors.sort((a, b) => filters.sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount);
      } else if (filters.sortBy === 'commodityPrice') {
        topVendors.sort((a, b) => filters.sortOrder === 'asc' ? a.commodityPrice - b.commodityPrice : b.commodityPrice - a.commodityPrice);
      } else if (filters.sortBy === 'date') {
        topVendors.sort((a, b) => {
          const aDate = a.invoices[0]?.invoiceDate || a.invoices[0]?.createdAt;
          const bDate = b.invoices[0]?.invoiceDate || b.invoices[0]?.createdAt;
          const aTime = aDate && typeof aDate.toDate === 'function' ? aDate.toDate() : new Date(aDate);
          const bTime = bDate && typeof bDate.toDate === 'function' ? bDate.toDate() : new Date(bDate);
          return filters.sortOrder === 'asc' ? aTime.getTime() - bTime.getTime() : bTime.getTime() - aTime.getTime();
        });
      } else if (filters.sortBy === 'vendor') {
        topVendors.sort((a, b) => {
          const aVendor = normalizeCompanyName(a.invoices[0]?.vendorName);
          const bVendor = normalizeCompanyName(b.invoices[0]?.vendorName);
          return filters.sortOrder === 'asc' ? aVendor.localeCompare(bVendor) : bVendor.localeCompare(aVendor);
        });
      }
      
      // Limit to top 10 for chart display
      topVendors = topVendors.slice(0, 10);
      
    } else if (hasActiveFilters && filteredInvoices.length <= 15) {
      // Show individual invoices when filtered and count is manageable
      chartTitle = `Filtered Invoices (${filteredInvoices.length})`;
      topVendors = filteredInvoices.map((invoice, index) => ({
        name: invoice.invoiceNumber || `Invoice ${index + 1}`,
        fullName: `${invoice.invoiceNumber || 'N/A'} - ${normalizeCompanyName(invoice.vendorName)} - $${(invoice.totalAmount || 0).toLocaleString()}`,
        amount: invoice.totalAmount || 0,
        invoiceCount: 1,
        invoices: [invoice],
        index
      })).sort((a, b) => b.amount - a.amount).slice(0, 10);
      
    } else if (hasActiveFilters && filteredInvoices.length > 15) {
      // Show vendor breakdown for filtered results when there are many invoices
      chartTitle = `Filtered Vendors (${filteredInvoices.length} invoices)`;
      
      // Create vendor breakdown from filtered invoices
      const vendorMap = new Map<string, { totalAmount: number; invoiceCount: number; invoices: any[] }>();
      
      filteredInvoices.forEach(invoice => {
        const normalizedVendorName = enhancedVendorNormalization(invoice.vendorName || 'Unknown');
        
        if (!vendorMap.has(normalizedVendorName)) {
          vendorMap.set(normalizedVendorName, {
            totalAmount: 0,
            invoiceCount: 0,
            invoices: []
          });
        }
        
        const vendorData = vendorMap.get(normalizedVendorName)!;
        vendorData.totalAmount += (invoice.totalAmount || 0);
        vendorData.invoiceCount += 1;
        vendorData.invoices.push(invoice);
      });
      
      topVendors = Array.from(vendorMap.entries())
        .sort(([, a], [, b]) => b.totalAmount - a.totalAmount)
        .slice(0, 5)
        .map(([normalizedName, data], index) => ({
          name: normalizedName.length > 12 ? normalizedName.substring(0, 12) + '...' : normalizedName,
          fullName: normalizedName,
          amount: data.totalAmount || 0,
          invoiceCount: data.invoiceCount || 0,
          invoices: data.invoices || [],
          index
        }));
        
    } else {
      // Show vendor breakdown (default behavior)
      chartTitle = 'Top Vendors';
      
      // Create vendor breakdown using Map for better key handling
      const vendorMap = new Map<string, { totalAmount: number; invoiceCount: number; invoices: any[] }>();
      
      filteredInvoices.forEach((invoice) => {
        const originalVendorName = invoice.vendorName || 'Unknown';
        const vendor = enhancedVendorNormalization(originalVendorName);
        
        if (!vendorMap.has(vendor)) {
          vendorMap.set(vendor, {
            totalAmount: 0,
            invoiceCount: 0,
            invoices: []
          });
        }
        
        const vendorData = vendorMap.get(vendor)!;
        vendorData.totalAmount += (invoice.totalAmount || 0);
        vendorData.invoiceCount += 1;
        vendorData.invoices.push(invoice);
      });
      
      topVendors = Array.from(vendorMap.entries())
        .sort(([, a], [, b]) => b.totalAmount - a.totalAmount)
        .slice(0, 5)
        .map(([normalizedName, data]) => ({
          name: normalizedName.length > 12 ? normalizedName.substring(0, 12) + '...' : normalizedName,
          fullName: normalizedName,
          amount: data.totalAmount || 0,
          invoiceCount: data.invoiceCount || 0,
          invoices: data.invoices || []
        }));
    }

    // Invoice status distribution
    const statusDistribution = [
      { name: 'Processed', value: filteredInvoices.length, color: chartColors.vibrant[0] },
      { name: 'Pending', value: 0, color: chartColors.vibrant[1] },
      { name: 'Disputed', value: 0, color: chartColors.vibrant[2] }
    ];

    // Calculate unique vendors count
    const uniqueVendorsCount = new Set(filteredInvoices.map(inv => enhancedVendorNormalization(inv.vendorName))).size;

    return {
      totalInvoices,
      totalAmount,
      averageAmount,
      topVendors: topVendors.length > 0 ? topVendors : [],
      statusDistribution,
      uniqueVendors: uniqueVendorsCount,
      chartTitle
    };
  }, [filteredInvoices, filters, normalizeCompanyName, enhancedVendorNormalization]);

  // Memoized pagination calculations
  const filteredInvoicesPagination = useMemo(() => {
    const totalPages = Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE);
    const startIndex = (currentPage - 1) * INVOICES_PER_PAGE;
    const endIndex = Math.min(startIndex + INVOICES_PER_PAGE, filteredInvoices.length);
    const currentInvoices = filteredInvoices.slice(startIndex, endIndex);
    
    return {
      totalPages,
      startIndex,
      endIndex,
      currentInvoices,
      showingFrom: startIndex + 1,
      showingTo: endIndex,
      total: filteredInvoices.length
    };
  }, [filteredInvoices, currentPage]);

  // Load ALL invoices from Firestore database
  const loadAllInvoicesFromDB = useCallback(async () => {
    setLoadingAllInvoices(true);
    try {
      const startTime = Date.now();
      const invoices = await InvoiceStorageService.getAllInvoices(1000);
      const loadTime = Date.now() - startTime;
      setLoadTime(loadTime);

      // *** DEFINITIVE FIX: NORMALIZE DATA ON FETCH ***
      // This ensures all data, old and new, is standardized before use.
      const normalizedInvoices = invoices.map(invoice => {
        const rawVendorName = invoice.vendorName ||
                           invoice.extractedData?.vendor_information?.company_name ||
                           invoice.extractedData?.vendor_information?.name ||
                           invoice.extractedData?.vendorName ||
                           invoice.extractedData?.vendor_name ||
                           'Unknown';
        
        const standardized = enhancedVendorNormalization(rawVendorName.toString());
        

        
        // Overwrite the vendorName field with the clean, standardized version
        return {
          ...invoice,
          vendorName: standardized
        };
      });

      // Check for any null/undefined vendor names
      const nullVendors = normalizedInvoices.filter(inv => !inv.vendorName || inv.vendorName.trim() === '');
      if (nullVendors.length > 0) {
        // Silent handling of null vendor names
      }
      

      
      setAllInvoicesFromDB(normalizedInvoices); // <-- Set state with CLEAN data
      setCurrentPage(1);
      
      return normalizedInvoices;
    } catch (error) {
      showToast(`Failed to load invoices: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      return [];
    } finally {
      setLoadingAllInvoices(false);
    }
  }, [showToast, enhancedVendorNormalization]);

  // Modal handlers
  const openUploadModal = () => setShowUploadModal(true);
  const closeUploadModal = async () => {
    // If we processed invoices, refresh the main table
    if (modalProcessedResults.length > 0) {
      await loadAllInvoicesFromDB();
    }
    
    setShowUploadModal(false);
    setUploadedFiles([]);
    setIsProcessing(false);
    setProcessingProgress(0);
    setRateLimitError(null);
    setModalProcessedResults([]);
  };

  // File handling for modal
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      
      // Filter PDF files only
      const pdfFiles = files.filter(file => file.type === 'application/pdf');
      
      // Check file size limits - 5MB maximum per invoice
      const maxFileSize = 5 * 1024 * 1024; // 5MB in bytes
      const oversizedFiles = pdfFiles.filter(file => file.size > maxFileSize);
      const validFiles = pdfFiles.filter(file => file.size <= maxFileSize);
      
      if (oversizedFiles.length > 0) {
        const fileNames = oversizedFiles.map(f => f.name).join(', ');
        showToast(`File(s) "${fileNames}" exceed 5MB limit and cannot be processed.`, 'error');
        setHasOversizedFiles(true);
      } else {
        setHasOversizedFiles(false);
      }
      
      if (validFiles.length > 0) {
        setUploadedFiles(prev => {
          const newFiles = [...prev, ...validFiles];
          return newFiles;
        });
      }
      
      if (files.length > pdfFiles.length) {
        showToast('Only PDF files are supported', 'error');
      }
      
      // Reset the input value to allow selecting the same file again
      e.target.value = '';
      setFileInputKey(prev => prev + 1);
    }
  };

  const handleModalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleModalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleModalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    // Check file size limits - 5MB maximum per invoice
    const maxFileSize = 5 * 1024 * 1024; // 5MB in bytes
    const oversizedFiles = pdfFiles.filter(file => file.size > maxFileSize);
    const validFiles = pdfFiles.filter(file => file.size <= maxFileSize);
    
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => f.name).join(', ');
      showToast(`File(s) "${fileNames}" exceed 5MB limit and cannot be processed.`, 'error');
      setHasOversizedFiles(true);
    } else {
      setHasOversizedFiles(false);
    }
    
    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
    }
    
    if (files.length > pdfFiles.length) {
      showToast('Only PDF files are supported', 'error');
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      
      // Check if there are still oversized files after removal
      const maxFileSize = 5 * 1024 * 1024; // 5MB in bytes
      const hasOversized = newFiles.some(file => file.size > maxFileSize);
      setHasOversizedFiles(hasOversized);
      
      return newFiles;
    });
  };

  // Handle pagination
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
  }, []);

  // Handle bar click for vendor selection
  const handleVendorBarClick = useCallback((data: any, index: number) => {
    setSelectedVendorIndex(selectedVendorIndex === index ? null : index);
  }, [selectedVendorIndex]);

  // Handle row expansion
  const toggleRowExpansion = useCallback((index: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(index)) {
      newExpandedRows.delete(index);
    } else {
      newExpandedRows.add(index);
    }
    setExpandedRows(newExpandedRows);
  }, [expandedRows]);

  // Handle invoice deletion
  const handleDeleteInvoice = useCallback(async (invoice: any, index: number) => {
    setInvoiceToDelete({ invoice, index });
    setShowDeleteModal(true);
  }, []);

  // Confirm delete action
  const confirmDelete = useCallback(async () => {
    if (!invoiceToDelete) return;

    const { invoice, index } = invoiceToDelete;
    
    try {
      // Delete from Firestore using the document ID
      const result = await InvoiceStorageService.deleteInvoiceData(invoice.documentId || invoice.id);
      
      if (result.success) {
        // Remove from local state
        setAllInvoicesFromDB(prev => prev.filter((_, i) => i !== index));
        
        // Remove from expanded rows if it was expanded
        const newExpandedRows = new Set(expandedRows);
        newExpandedRows.delete(index);
        setExpandedRows(newExpandedRows);
        
        showToast(`Invoice "${invoice.invoiceNumber}" deleted successfully`, 'success');
      } else {
        throw new Error(result.message || 'Failed to delete invoice');
      }
    } catch (error) {
      showToast(`Error deleting invoice: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setShowDeleteModal(false);
      setInvoiceToDelete(null);
    }
  }, [invoiceToDelete, expandedRows, showToast]);

  // Cancel delete action
  const cancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setInvoiceToDelete(null);
  }, []);

  // Handle invoice editing
  const handleEditInvoice = useCallback((invoice: any) => {
    setInvoiceToEdit(invoice);
    setShowEditModal(true);
  }, []);

  // Save edited invoice
  const saveEditedInvoice = useCallback(async (editedData: any) => {
    if (!invoiceToEdit) return;

    try {
      // Normalize vendor and customer names before updating
      const normalizedExtractedData = {
        ...editedData,
        vendor_information: {
          ...editedData.vendor_information,
          company_name: enhancedVendorNormalization(editedData.vendor_information?.company_name || '')
        },
        customer_information: {
          ...editedData.customer_information,
          company_name: enhancedVendorNormalization(editedData.customer_information?.company_name || '')
        }
      };

      // Update the invoice data in Firestore using the existing document ID
      const result = await InvoiceStorageService.updateInvoiceData(
        invoiceToEdit.documentId || invoiceToEdit.id,
        user?.uid || '',
        normalizedExtractedData
      );

      if (result.success) {
        // Update local state with all the updated fields
        setAllInvoicesFromDB(prev => prev.map(inv => 
          inv.documentId === invoiceToEdit.documentId 
            ? { 
                ...inv, 
                extractedData: normalizedExtractedData,
                // Update derived fields that are shown in the table
                invoiceNumber: normalizedExtractedData.invoice_metadata?.invoice_number || inv.invoiceNumber,
                totalAmount: normalizedExtractedData.financial_summary?.total_amount || inv.totalAmount,
                invoiceDate: normalizedExtractedData.invoice_metadata?.invoice_date || inv.invoiceDate,
                vendorName: normalizedExtractedData.vendor_information?.company_name || inv.vendorName
              }
            : inv
        ));
        
        showToast(`Invoice "${normalizedExtractedData.invoice_metadata?.invoice_number}" updated successfully`, 'success');
        setShowEditModal(false);
        setInvoiceToEdit(null);
        
        // Refresh the invoices from database to ensure consistency
        await loadAllInvoicesFromDB();
      } else {
        throw new Error(result.message || 'Failed to update invoice');
      }
    } catch (error) {
      showToast(`Error updating invoice: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [invoiceToEdit, user?.uid, showToast, enhancedVendorNormalization, loadAllInvoicesFromDB]);

  // Cancel edit action
  const cancelEdit = useCallback(() => {
    setShowEditModal(false);
    setInvoiceToEdit(null);
  }, []);

  // Filter handlers - Fixed to prevent focus loss
  const handleTempFilterChange = useCallback((filterKey: string, value: string) => {
    setTempFilters(prev => {
      const newFilters = { ...prev, [filterKey]: value };
      return newFilters;
    });
  }, []);

  // Apply filters when button is clicked
  const applyFilters = useCallback(() => {
    setFilters(tempFilters);
    setCurrentPage(1);
  }, [tempFilters]);

  // Clear filters and reset temp filters
  const clearFilters = useCallback(() => {
    setFilters(initialFilterState);
    setTempFilters(initialFilterState);
    setCurrentPage(1);
  }, [initialFilterState]);

  // Check if filters have changed from applied filters
  const hasFilterChanges = useMemo(() => {
    return Object.keys(filters).some(key => 
      filters[key as keyof typeof filters] !== tempFilters[key as keyof typeof tempFilters]
    );
  }, [filters, tempFilters]);

  // Load data on component mount
  useEffect(() => {
    if (user && !loadingAllInvoices && allInvoicesFromDB.length === 0) {
      loadAllInvoicesFromDB();
    }
  }, [user, loadingAllInvoices, allInvoicesFromDB.length, loadAllInvoicesFromDB]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  // Function to generate actual PDF links from Firebase Storage
  const generatePDFLink = (invoice: any) => {
    if (invoice.fileUrl) {
      return invoice.fileUrl;
    }
    return null;
  };



  // Function to save invoice to Firestore
  const saveInvoiceToFirestore = async (file: File, extractedData: any) => {
    try {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      // Normalize vendor and customer names before saving
      const normalizedExtractedData = {
        ...extractedData,
        vendor_information: {
          ...extractedData.vendor_information,
          company_name: enhancedVendorNormalization(extractedData.vendor_information?.company_name || '')
        },
        customer_information: {
          ...extractedData.customer_information,
          company_name: enhancedVendorNormalization(extractedData.customer_information?.company_name || '')
        }
      };

      // Get the extracted invoice number
      const extractedInvoiceNumber = normalizedExtractedData.invoice_metadata?.invoice_number;

      // First, check if this invoice already exists using the storage service
      const existingInvoice = await InvoiceStorageService.findExistingInvoice(
        user.uid,
        file.name,
        extractedInvoiceNumber
      );

      let fileUrl: string | undefined;
      let fileSize: number | undefined;

      if (existingInvoice) {
        // If invoice exists, use the existing file URL and size
        fileUrl = existingInvoice.fileUrl;
        fileSize = existingInvoice.fileSize;
      } else {
        // Only upload file if this is a new invoice
        const invoiceId = `invoice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        const fileResult = await FileStorageService.uploadPDF(user.uid, file, invoiceId);
        
        if (!fileResult.success) {
          throw new Error(fileResult.error || 'Failed to upload file');
        }
        
        fileUrl = fileResult.downloadURL;
        fileSize = file.size;
      }

      // Now save to Firestore using the enhanced duplicate detection service
      const saveResult = await InvoiceStorageService.saveInvoiceData(
        user.uid,
        file.name,
        normalizedExtractedData,
        fileUrl,
        fileSize
      );

      if (saveResult.success) {
        // Refresh the invoices list to show the updated data
        await loadAllInvoicesFromDB();

        return {
          success: true,
          message: saveResult.message,
          documentId: saveResult.documentId,
          isUpdate: existingInvoice ? true : false
        };
      } else {
        throw new Error(saveResult.message || 'Failed to save invoice data');
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  };

  // Check network connectivity with weak connection detection
  const checkNetworkConnectivity = async (): Promise<{ isOnline: boolean; isWeak: boolean }> => {
    if (!navigator.onLine) {
      return { isOnline: false, isWeak: false };
    }
    
    try {
      const startTime = Date.now();
      
      // Try to reach a reliable endpoint to verify actual connectivity
      const response = await fetch('/api/process-invoice', {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000) // Increased timeout for weak connection detection
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      const isOnline = response.ok || response.status === 405; // 405 is OK for HEAD request
      const isWeak = responseTime > 3000; // Consider connection weak if response takes more than 3 seconds
      
      return { isOnline, isWeak };
    } catch {
      return { isOnline: false, isWeak: false };
    }
  };



  // Process invoices with enhanced batch processing (2 invoices per batch)
  const processInvoices = async () => {
    if (uploadedFiles.length === 0) {
      showToast('Please select at least one PDF file', 'error');
      return;
    }

    // Check network connectivity before processing
    const { isOnline, isWeak } = await checkNetworkConnectivity();
    if (!isOnline) {
      showToast('No internet connection detected. Please check your network connection and try again. Your selected files have been preserved.', 'error');
      return;
    }
    
    if (isWeak) {
      showToast('Weak internet connection detected. Upload may take longer than usual. Please ensure a stable connection for better performance.', 'warning');
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setRateLimitError(null);
    
    // Clear previous results
    setModalProcessedResults([]);

    const newProcessedInvoices: any[] = [];
    const BATCH_SIZE = 2; // Process 2 invoices at a time to prevent backend overload

    try {
      // Split files into batches of 2
      const batches = [];
      for (let i = 0; i < uploadedFiles.length; i += BATCH_SIZE) {
        batches.push(uploadedFiles.slice(i, i + BATCH_SIZE));
      }
      
      let totalProcessed = 0;
      
              // Process each batch sequentially
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const currentBatch = batches[batchIndex];
        
        // Update progress for current batch
        const batchProgress = (batchIndex / batches.length) * 100;
        setProcessingProgress(batchProgress);
        
        // Show batch progress to user
        showToast(`Processing batch ${batchIndex + 1}/${batches.length} (${currentBatch.length} files) - Please wait...`, 'info');
        
        // Check network connectivity before each batch
        const { isOnline, isWeak } = await checkNetworkConnectivity();
        if (!isOnline) {
          throw new Error(`Network connection lost while processing batch ${batchIndex + 1}. Please check your internet connection and try again. Your files have been preserved.`);
        }
        
        if (isWeak) {
          showToast(`Weak connection detected during batch ${batchIndex + 1}. Processing may take longer.`, 'warning');
        }
        
        // Create FormData for current batch
        const formData = new FormData();
        currentBatch.forEach(file => {
          formData.append('files', file);
        });

        // Process current batch with enhanced network error handling
        let response;
        try {
          response = await fetch('/api/process-multiple-invoices', {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(60000) // 60 second timeout
          });
        } catch (fetchError) {
          // Check if it's a network connectivity issue
          const { isOnline: isCurrentlyOnline, isWeak } = await checkNetworkConnectivity();
          if (!isCurrentlyOnline) {
            throw new Error(`Network connection lost during batch ${batchIndex + 1} processing. Please check your internet connection and try again. Your files have been preserved.`);
          }
          
          if (isWeak) {
            throw new Error(`Weak internet connection detected during batch ${batchIndex + 1} processing. Please try again with a stronger connection. Your files have been preserved.`);
          }
          
          if (fetchError instanceof Error) {
            if (fetchError.name === 'AbortError' || fetchError.message.includes('timeout')) {
              throw new Error(`Request timeout during batch ${batchIndex + 1}. Please check your internet connection and try again. Your files have been preserved.`);
            }
            if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
              throw new Error(`Network error detected during batch ${batchIndex + 1}. Please check your internet connection and try again. Your files have been preserved.`);
            }
          }
          throw new Error(`Network connection lost during batch ${batchIndex + 1} processing. Please check your internet connection and try again. Your files have been preserved.`);
        }

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            // If we can't parse JSON, it might be a network issue
            throw new Error('Network error or server unavailable. Please check your internet connection and try again. Your files have been preserved.');
          }
          
          if (errorData.setupRequired) {
            throw new Error('Backend API not configured. Please check environment settings.');
          }
          
          // Handle specific error codes
          if (response.status === 502) {
            throw new Error('Backend service temporarily unavailable. Please try again in a few minutes. Your files have been preserved.');
          }
          
          if (response.status === 504 || response.status === 408) {
            throw new Error('Request timeout. The backend took too long to process the files. Please check your internet connection and try again. Your files have been preserved.');
          }
          
          if (response.status === 503) {
            const retryMessage = errorData.retryAfter ? ` Please try again in ${errorData.retryAfter} seconds.` : ' Please try again in a few moments.';
            throw new Error(`Backend service is currently unavailable.${retryMessage} Your files have been preserved.`);
          }
          
          throw new Error(`Processing error: ${errorData.message || 'Server error occurred'}. Your files have been preserved.`);
        }

        const result = await response.json();

        if (result.success) {
          // Handle batch processing results
          const results = result.data.results || [];
          
          // Process each result in the current batch
                      for (const fileResult of results) {
              if (fileResult.success) {
                const extractedData = fileResult.data;
              
              // Check for existing invoice to determine if we should update or create new
              const invoiceNumber = extractedData.invoice_metadata?.invoice_number;
              let existingInvoice = null;
              
              if (invoiceNumber?.trim()) {
                existingInvoice = await InvoiceStorageService.findExistingInvoice(
                  user?.uid || '',
                  fileResult.filename,
                  invoiceNumber.trim()
                );
              }
              
              if (existingInvoice) {
                // Found existing invoice, will update instead of create new
              }
              
              // Find the original file object
              const originalFile = currentBatch.find(f => f.name === fileResult.filename);
              if (!originalFile) {
                continue;
              }
              
              // Check network connectivity before saving each file
              const { isOnline: isOnlineBeforeSave, isWeak } = await checkNetworkConnectivity();
              if (!isOnlineBeforeSave) {
                throw new Error(`Network connection lost while saving ${fileResult.filename}. Please check your internet connection and try again. Your files have been preserved.`);
              }
              
              if (isWeak) {
                showToast(`Weak connection detected while saving ${fileResult.filename}. This may take longer than usual.`, 'warning');
              }
              
              // Handle existing vs new invoice processing
              let saveResult;
              let isUpdate = false;
              
              if (existingInvoice) {
                // Update existing invoice
                saveResult = await InvoiceStorageService.updateInvoiceData(
                  existingInvoice.id,
                  user?.uid || '',
                  extractedData
                );
                isUpdate = true;
              } else {
                // Save new invoice
                saveResult = await saveInvoiceToFirestore(originalFile, extractedData);
                isUpdate = saveResult.isUpdate || false;
              }
              
              if (saveResult.success) {
                // Create properly structured invoice data for display
                const processedInvoice = {
                  filename: fileResult.filename,
                  extractedData: extractedData,
                  invoiceNumber: extractedData.invoice_metadata?.invoice_number || 'N/A',
                  vendorName: extractedData.vendor_information?.company_name || 'Unknown',
                  totalAmount: extractedData.financial_summary?.total_amount || 0,
                  invoiceDate: extractedData.invoice_metadata?.invoice_date || null,
                  customerName: extractedData.customer_information?.company_name || 'N/A',
                  totalItems: extractedData.commodity_details?.total_items || 0,
                  status: 'success',
                  isUpdate: isUpdate,
                  processingTime: fileResult.processingTime
                };
                newProcessedInvoices.push(processedInvoice);
                
                // Add to modal results for immediate display
                setModalProcessedResults(prev => [...prev, processedInvoice]);
                
                // Show appropriate success message based on whether it's an update or new upload
                const actionText = isUpdate ? 'updated' : 'uploaded';
                showToast(`Invoice "${processedInvoice.invoiceNumber}" ${actionText} successfully`, 'success');
                
                totalProcessed++;
                const overallProgress = ((batchIndex * BATCH_SIZE + totalProcessed) / uploadedFiles.length) * 100;
                setProcessingProgress(overallProgress);
              } else {
                throw new Error(saveResult.message);
              }
            } else {
      
              showToast(`Error processing ${fileResult.filename}: ${fileResult.error}`, 'error');
            }
          }
          
        } else {
          throw new Error(result.message || 'Batch processing failed');
        }
        
        // Add a small delay between batches to prevent overwhelming the backend
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Process invoices completed
      if (newProcessedInvoices.length > 0) {
        // Count new vs updated invoices
        const newCount = newProcessedInvoices.filter(inv => !inv.isUpdate).length;
        const updatedCount = newProcessedInvoices.filter(inv => inv.isUpdate).length;
        
        let message = '';
        if (newCount > 0 && updatedCount > 0) {
          message = `✅ Processing complete: ${newCount} new invoice${newCount > 1 ? 's' : ''} added, ${updatedCount} existing invoice${updatedCount > 1 ? 's' : ''} updated`;
        } else if (newCount > 0) {
          message = `✅ Processing complete: ${newCount} new invoice${newCount > 1 ? 's' : ''} added`;
        } else if (updatedCount > 0) {
          message = `✅ Processing complete: ${updatedCount} existing invoice${updatedCount > 1 ? 's' : ''} updated`;
        }
        
        // Add detailed breakdown for better user understanding
        if (newCount > 0 || updatedCount > 0) {
          // Processing summary available
        }
        
        showToast(message, 'success');
        
        // Refresh the main table immediately
        await loadAllInvoicesFromDB();
        // Small delay to ensure Firestore has propagated the changes
        setTimeout(async () => {
          await loadAllInvoicesFromDB();
        }, 2000);
      }

    } catch (error) {
      showToast(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
          } catch {
        showToast('Error during logout', 'error');
      }
  };

  // Professional Invoice Table Component with expandable rows and sticky headers
  const InvoiceTable = ({ invoices, title, emptyMessage }: { invoices: any[], title: string, emptyMessage: string }) => (
    <div className="overflow-hidden border border-gray-200 rounded-2xl bg-white">
      {/* Mobile View */}
      <div className="block md:hidden">
        <div className="max-h-96 overflow-y-auto">
          {invoices.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm">{emptyMessage}</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {invoices.map((invoice, index) => (
                <div key={index} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold text-gray-900 text-sm">
                      #{invoice.invoiceNumber || invoice.extractedData?.invoice_metadata?.invoice_number || 'N/A'}
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => toggleRowExpansion(index)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {expandedRows.has(index) ? (
                          <ChevronUp className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEditInvoice(invoice)}
                        className="p-1 hover:bg-blue-50 rounded text-blue-600"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(invoice, index)}
                        className="p-1 hover:bg-red-50 rounded text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div><span className="font-medium">Date:</span> {
                      invoice.invoiceDate ? (() => {
                        try {
                          if (typeof invoice.invoiceDate === 'string') {
                            return new Date(invoice.invoiceDate).toLocaleDateString();
                          } else if (invoice.invoiceDate && typeof invoice.invoiceDate.toDate === 'function') {
                            return invoice.invoiceDate.toDate().toLocaleDateString();
                          } else if (invoice.invoiceDate && typeof invoice.invoiceDate === 'object' && invoice.invoiceDate.seconds) {
                            return new Date(invoice.invoiceDate.seconds * 1000).toLocaleDateString();
                          } else {
                            return new Date(invoice.invoiceDate).toLocaleDateString();
                          }
                        } catch {
                          return 'N/A';
                        }
                      })() : 'N/A'
                    }</div>
                    <div><span className="font-medium">Vendor:</span> {normalizeCompanyName(invoice.vendorName)}</div>
                    <div><span className="font-medium">Customer:</span> {normalizeCompanyName(invoice.extractedData?.customer_information?.company_name) || 'N/A'}</div>
                    <div><span className="font-medium">Amount:</span> ${invoice.totalAmount || 0}</div>
                    <div><span className="font-medium">Items:</span> {invoice.extractedData?.commodity_details?.total_items || 0}</div>
                    
                    {/* Additional columns for mobile - more compact */}
                    {invoice.extractedData?.commodity_details?.items && invoice.extractedData.commodity_details.items.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium text-gray-700 mb-1">Items & Prices:</div>
                        <div className="space-y-1 text-xs">
                          {invoice.extractedData.commodity_details.items.map((item: any, idx: number) => {
                            const unitPrice = item.unit_price || item.price || 0;
                            const quantity = item.quantity || 0;
                            const totalPrice = item.total_price || (unitPrice * quantity) || 0;
                            return (
                              <div key={idx} className="bg-gray-50 p-2 rounded text-gray-600">
                                <div className="font-medium">{item.description || item.name || 'N/A'}</div>
                                <div className="text-gray-500">Qty: {quantity} × ${unitPrice} = ${totalPrice}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    <div><span className="font-medium">Currency:</span> {invoice.extractedData?.financial_summary?.currency || 'USD'}</div>
                  </div>
                  {expandedRows.has(index) && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs text-gray-500 space-y-1">
                        <div><span className="font-medium">File:</span> {invoice.originalFilename || 'N/A'}</div>
                        <div><span className="font-medium">Size:</span> {invoice.fileSize ? (invoice.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</div>
                        {invoice.fileUrl && (
                          <a 
                            href={invoice.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View PDF
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block table-scroll-container">
        <table className="w-full min-w-[1400px]">
          <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 z-40">
            <tr>
              <th className="sticky-invoice-header px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-24">
                Invoice #
              </th>
              <th className="sticky top-0 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-r from-gray-50 to-gray-100 z-40 border-r border-gray-200 w-20">
                Date
              </th>
              <th className="sticky top-0 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-r from-gray-50 to-gray-100 z-40 border-r border-gray-200 w-28">
                Vendor
              </th>
              <th className="sticky top-0 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-r from-gray-50 to-gray-100 z-40 border-r border-gray-200 w-28">
                Customer
              </th>
              <th className="sticky top-0 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-r from-gray-50 to-gray-100 z-40 border-r border-gray-200 w-12">
                Items
              </th>
              <th className="sticky top-0 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-r from-gray-50 to-gray-100 z-40 border-r border-gray-200 w-24">
                Total Amount
              </th>
              <th className="sticky top-0 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-r from-gray-50 to-gray-100 z-40 border-r border-gray-200 w-36">
                Commodity Items
              </th>
              <th className="sticky top-0 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-r from-gray-50 to-gray-100 z-40 border-r border-gray-200 w-36">
                Individual Prices
              </th>
              <th className="sticky top-0 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-r from-gray-50 to-gray-100 z-40 border-r border-gray-200 w-20">
                PDF Link
              </th>
              <th className="sticky top-0 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-r from-gray-50 to-gray-100 z-40 w-20">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                      <p className="text-sm">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              invoices.map((invoice, index) => (
                <React.Fragment key={index}>
                  <tr className="group hover:bg-gray-50 transition-all duration-200 border-b border-gray-200">
                                        <td className="sticky-invoice-cell px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {invoice.invoiceNumber || invoice.extractedData?.invoice_metadata?.invoice_number || 'N/A'}
                  </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {invoice.invoiceDate ? (() => {
                          try {
                            // Handle both string dates and Firebase Timestamps
                            if (typeof invoice.invoiceDate === 'string') {
                              return new Date(invoice.invoiceDate).toLocaleDateString();
                            } else if (invoice.invoiceDate && typeof invoice.invoiceDate.toDate === 'function') {
                              return invoice.invoiceDate.toDate().toLocaleDateString();
                            } else if (invoice.invoiceDate && typeof invoice.invoiceDate === 'object' && invoice.invoiceDate.seconds) {
                              return new Date(invoice.invoiceDate.seconds * 1000).toLocaleDateString();
                            } else {
                              return new Date(invoice.invoiceDate).toLocaleDateString();
                            }
                          } catch {
                    
                            return 'N/A';
                          }
                        })() : 'N/A'}
                  </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {normalizeCompanyName(invoice.vendorName)}
                  </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {normalizeCompanyName(invoice.extractedData?.customer_information?.company_name)}
                  </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {invoice.extractedData?.commodity_details?.total_items || 0}
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ${(invoice.totalAmount || 0).toLocaleString()}
                  </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="space-y-1">
                          {(invoice.extractedData?.commodity_details?.items || []).slice(0, 3).map((item: any, idx: number) => (
                            <div key={idx} className="text-xs">
                              <span className="font-medium">{item.description || item.name || 'N/A'}</span>
                            </div>
                          ))}
                          {(invoice.extractedData?.commodity_details?.items || []).length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{(invoice.extractedData?.commodity_details?.items || []).length - 3} more
                            </div>
                          )}
                        </div>
                  </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="space-y-1">
                          {(invoice.extractedData?.commodity_details?.items || []).slice(0, 3).map((item: any, idx: number) => (
                            <div key={idx} className="text-xs">
                              <span className="font-medium text-green-600">${(item.unit_price || 0).toFixed(2)}</span>
                              <span className="text-gray-500 ml-1">× {item.quantity || 0}</span>
                              <span className="text-gray-400 ml-1">= ${((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)}</span>
                            </div>
                          ))}
                          {(invoice.extractedData?.commodity_details?.items || []).length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{(invoice.extractedData?.commodity_details?.items || []).length - 3} more
                            </div>
                          )}
                        </div>
                  </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {generatePDFLink(invoice) ? (
                      <a
                        href={generatePDFLink(invoice)}
                        target="_blank"
                        rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                      >
                            <ExternalLink className="w-4 h-4 mr-1" />
                        View PDF
                      </a>
                    ) : (
                          <span className="text-gray-400">No PDF</span>
                    )}
                  </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleRowExpansion(index)}
                            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                          >
                            {expandedRows.has(index) ? (
                              <ChevronUp className="w-4 h-4 text-gray-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEditInvoice(invoice)}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600 hover:text-blue-700"
                            title="Edit invoice"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(invoice, index)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600 hover:text-red-700"
                            title="Delete invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                  </td>
                  </tr>
                  {expandedRows.has(index) && (
                    <tr className="bg-gray-50">
                      <td colSpan={10} className="px-6 py-6">
                        <div className="w-full">
                          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <FileText className="w-5 h-5 mr-2 text-blue-600" />
                            Complete Invoice Details
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                            
                            {/* Invoice Metadata */}
                            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-4 shadow-sm">
                              <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                                <Calendar className="w-4 h-4 mr-2 text-green-600" />
                                Invoice Metadata
                              </h5>
                              <div className="space-y-2 text-sm">
                                <div><span className="text-gray-600">Invoice Number:</span> <span className="font-medium text-gray-900">{invoice.extractedData?.invoice_metadata?.invoice_number || 'N/A'}</span></div>
                                <div><span className="text-gray-600">Date:</span> <span className="font-medium text-gray-900">{invoice.extractedData?.invoice_metadata?.invoice_date ? new Date(invoice.extractedData.invoice_metadata.invoice_date).toLocaleDateString() : 'N/A'}</span></div>
                                <div><span className="text-gray-600">Due Date:</span> <span className="font-medium text-gray-900">{invoice.extractedData?.invoice_metadata?.due_date ? new Date(invoice.extractedData.invoice_metadata.due_date).toLocaleDateString() : 'N/A'}</span></div>
                                <div><span className="text-gray-600">Payment Terms:</span> <span className="font-medium text-gray-900">{invoice.extractedData?.payment_terms || 'N/A'}</span></div>
                              </div>
                            </div>

                            {/* Vendor Information */}
                            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-4 shadow-sm">
                              <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                                <Users className="w-4 h-4 mr-2 text-blue-600" />
                                Vendor Information
                              </h5>
                              <div className="space-y-2 text-sm">
                                <div><span className="text-gray-600">Company:</span> <span className="font-medium text-gray-900">{normalizeCompanyName(invoice.extractedData?.vendor_information?.company_name)}</span></div>
                                <div><span className="text-gray-600">Address:</span> <span className="font-medium text-gray-900">{invoice.extractedData?.vendor_information?.contact_info?.address || 'N/A'}</span></div>
                                <div><span className="text-gray-600">Phone:</span> <span className="font-medium text-gray-900">{invoice.extractedData?.vendor_information?.contact_info?.phone || 'N/A'}</span></div>
                                <div><span className="text-gray-600">Email:</span> <span className="font-medium text-gray-900">{invoice.extractedData?.vendor_information?.contact_info?.email || 'N/A'}</span></div>
                              </div>
                            </div>

                            {/* Customer Information */}
                            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-4 shadow-sm">
                              <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                                <Users className="w-4 h-4 mr-2 text-purple-600" />
                                Customer Information
                              </h5>
                              <div className="space-y-2 text-sm">
                                <div><span className="text-gray-600">Company:</span> <span className="font-medium text-gray-900">{normalizeCompanyName(invoice.extractedData?.customer_information?.company_name)}</span></div>
                                <div><span className="text-gray-600">Address:</span> <span className="font-medium text-gray-900">{invoice.extractedData?.customer_information?.contact_info?.address || 'N/A'}</span></div>
                                <div><span className="text-gray-600">Phone:</span> <span className="font-medium text-gray-900">{invoice.extractedData?.customer_information?.contact_info?.phone || 'N/A'}</span></div>
                                <div><span className="text-gray-600">Email:</span> <span className="font-medium text-gray-900">{invoice.extractedData?.customer_information?.contact_info?.email || 'N/A'}</span></div>
                              </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-4 shadow-sm">
                              <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                                <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                                Financial Summary
                              </h5>
                              <div className="space-y-2 text-sm">
                                <div><span className="text-gray-600">Subtotal:</span> <span className="font-medium text-gray-900">${(invoice.extractedData?.financial_summary?.subtotal || 0).toLocaleString()}</span></div>
                                <div><span className="text-gray-600">Tax:</span> <span className="font-medium text-gray-900">${(invoice.extractedData?.financial_summary?.tax_amount || 0).toLocaleString()}</span></div>
                                <div><span className="text-gray-600">Total:</span> <span className="font-bold text-green-600">${(invoice.extractedData?.financial_summary?.total_amount || 0).toLocaleString()}</span></div>
                                <div><span className="text-gray-600">Currency:</span> <span className="font-medium text-gray-900">{invoice.extractedData?.financial_summary?.currency || 'USD'}</span></div>
                              </div>
                            </div>

                            {/* Commodity Details */}
                            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-4 shadow-sm">
                              <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                                <Activity className="w-4 h-4 mr-2 text-orange-600" />
                                Commodity Details
                              </h5>
                              <div className="space-y-2 text-sm">
                                <div><span className="text-gray-600">Total Items:</span> <span className="font-medium text-gray-900">{invoice.extractedData?.commodity_details?.total_items || 0}</span></div>
                              </div>
                              
                              {/* Detailed Commodity Items */}
                              {invoice.extractedData?.commodity_details?.items && invoice.extractedData.commodity_details.items.length > 0 && (
                                <div className="mt-4">
                                  <h6 className="font-medium text-gray-700 mb-2">Line Items:</h6>
                                  <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {invoice.extractedData.commodity_details.items.map((item: any, idx: number) => (
                                      <div key={idx} className="bg-gray-50 rounded-lg p-2 text-xs">
                                        <div className="font-medium text-gray-800">{item.description || item.item || 'N/A'}</div>
                                        <div className="grid grid-cols-3 gap-2 text-gray-600">
                                          <span>Qty: {item.quantity || 0}</span>
                                          <span>Price: ${(item.unit_price || 0).toFixed(2)}</span>
                                          <span>Total: ${(item.amount || 0).toFixed(2)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Processing Information */}
                            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-4 shadow-sm">
                              <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                                <Clock className="w-4 h-4 mr-2 text-red-600" />
                                Processing Info
                              </h5>
                              <div className="space-y-2 text-sm">
                                <div><span className="text-gray-600">File Name:</span> <span className="font-medium text-gray-900">{invoice.originalFilename || 'N/A'}</span></div>
                                <div><span className="text-gray-600">File Size:</span> <span className="font-medium text-gray-900">{invoice.fileSize ? (invoice.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</span></div>
                                <div><span className="text-gray-600">Processed:</span> <span className="font-medium text-gray-900">{invoice.createdAt ? new Date(invoice.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</span></div>
                                <div><span className="text-gray-600">Status:</span> <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Processed</span></div>
                              </div>
                            </div>

                          </div>
                        </div>
                  </td>
                </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Upload Modal Component
     // Edit Invoice Modal Component
     const EditInvoiceModal = ({ invoice, onSave, onCancel }: { 
    invoice: any; 
    onSave: (data: any) => void; 
    onCancel: () => void; 
  }) => {
    const [editedData, setEditedData] = useState<any>(invoice.extractedData);
    const [activeTab, setActiveTab] = useState('metadata');
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [isValidating, setIsValidating] = useState(false);
    const { showToast } = useToast();

    // Function to check if invoice number already exists (excluding current invoice)
    const checkInvoiceNumberExists = async (invoiceNumber: string): Promise<boolean> => {
      if (!invoiceNumber?.trim()) return false;
      
      try {
        const existingInvoice = await InvoiceStorageService.findExistingInvoice(
          user?.uid || '',
          '', // filename not needed for invoice number check
          invoiceNumber.trim()
        );
        
        // Return true if found and it's not the same invoice being edited
        // Use documentId as the primary identifier
        return !!(existingInvoice && existingInvoice.id !== (invoice.documentId || invoice.id));
      } catch {

        return false;
      }
    };

    // Real-time validation function
    const validateInRealTime = async () => {
      setIsValidating(true);
      const errors: string[] = [];
      
      // Check required fields
      if (!editedData.invoice_metadata?.invoice_number?.trim()) {
        errors.push('Invoice Number is required');
      } else {
        const currentInvoiceNumber = editedData.invoice_metadata.invoice_number;
        
        // Check format first
        const formatError = validateInvoiceNumberFormat(currentInvoiceNumber);
        if (formatError) {
          errors.push(formatError);
        } else {
          // Check if invoice number has changed and if it already exists
          const originalInvoiceNumber = invoice.extractedData?.invoice_metadata?.invoice_number;
          const newInvoiceNumber = currentInvoiceNumber.trim();
          
          if (newInvoiceNumber !== originalInvoiceNumber) {
            const exists = await checkInvoiceNumberExists(newInvoiceNumber);
            
            if (exists) {
              errors.push('Invoice Number already exists');
            }
          }
        }
      }
      
      if (!editedData.invoice_metadata?.invoice_date?.trim()) {
        errors.push('Invoice Date is required');
      }
      
      // Validate vendor name
      const vendorError = validateCompanyNameFormat(editedData.vendor_information?.company_name, 'Vendor Name');
      if (vendorError) {
        errors.push(vendorError);
      }
      
      // Validate customer name
      const customerError = validateCompanyNameFormat(editedData.customer_information?.company_name, 'Customer Name');
      if (customerError) {
        errors.push(customerError);
      }
      
      // Validate total amount
      const amountError = validateAmountFormat(editedData.financial_summary?.total_amount, 'Total Amount');
      if (amountError) {
        errors.push(amountError);
      }
      
      // Validate currency
      const currencyError = validateCurrencyFormat(editedData.financial_summary?.currency);
      if (currencyError) {
        errors.push(currencyError);
      }
      
      // Check if there are commodity items
      if (!editedData.commodity_details?.items || editedData.commodity_details.items.length === 0) {
        errors.push('At least one commodity item is required');
      } else {
        // Validate each commodity item
        editedData.commodity_details.items.forEach((item: any, index: number) => {
          const itemNumber = index + 1;
          
          // Validate item description
          if (!item.description?.trim() && !item.name?.trim()) {
            errors.push(`Item ${itemNumber}: Description is required`);
          } else {
            const description = item.description || item.name;
            if (description && description.length > 200) {
              errors.push(`Item ${itemNumber}: Description cannot exceed 200 characters`);
            }
          }
          
          // Validate quantity
          const quantityError = validateAmountFormat(item.quantity, `Item ${itemNumber} Quantity`);
          if (quantityError) {
            errors.push(quantityError);
          } else if (item.quantity <= 0) {
            errors.push(`Item ${itemNumber}: Quantity must be greater than 0`);
          }
          
          // Validate unit price
          const unitPrice = item.unit_price || item.price;
          const priceError = validateAmountFormat(unitPrice, `Item ${itemNumber} Unit Price`);
          if (priceError) {
            errors.push(priceError);
          } else if (unitPrice <= 0) {
            errors.push(`Item ${itemNumber}: Unit price must be greater than 0`);
          }
        });
      }
      
      setValidationErrors(errors);
      setIsValidating(false);
      return errors.length === 0;
    };

    const validateData = async (): Promise<boolean> => {
      return await validateInRealTime();
    };

    const handleSave = async () => {
      if (await validateData()) {
        onSave(editedData);
      } else {
        // Show themed error toast
        const errorMessage = validationErrors.length === 1 
          ? validationErrors[0] 
          : `Please fix the following errors:\n${validationErrors.join('\n')}`;
        showToast(errorMessage, 'error');
      }
    };

    // Validate invoice number format
    const validateInvoiceNumberFormat = (invoiceNumber: string): string | null => {
      if (!invoiceNumber) return null;
      
      // Check for invalid special characters
      const invalidCharsRegex = /[#@!$%^&*()=+[\]{}|\\:";'<>?,./~`]/;
      if (invalidCharsRegex.test(invoiceNumber)) {
        return 'Invoice Number cannot contain special characters like #@!$%^&*()=+[]{}|\\:";\'<>?,./~`';
      }
      
      // Check if it's only spaces
      if (invoiceNumber.trim() === '') {
        return 'Invoice Number cannot be empty or contain only spaces';
      }
      
      // Check length (optional - reasonable limits)
      if (invoiceNumber.length > 50) {
        return 'Invoice Number cannot exceed 50 characters';
      }
      
      return null; // Valid
    };

    // Validate company name format (vendor/customer)
    const validateCompanyNameFormat = (companyName: string, fieldName: string): string | null => {
      if (!companyName) return `${fieldName} is required`;
      
      // Check if it's only spaces
      if (companyName.trim() === '') {
        return `${fieldName} cannot be empty or contain only spaces`;
      }
      
      // Check for excessive special characters (allow some common ones for business names)
      const excessiveSpecialChars = /[@#$%^*+=[\]{}|\\:";'<>?~`]/;
      if (excessiveSpecialChars.test(companyName)) {
        return `${fieldName} contains invalid characters. Use only letters, numbers, and common business symbols (., -, &, /)`;
      }
      
      // Check length
      if (companyName.length > 100) {
        return `${fieldName} cannot exceed 100 characters`;
      }
      
      return null; // Valid
    };

    // Validate monetary amount format
    const validateAmountFormat = (amount: any, fieldName: string): string | null => {
      if (!amount && amount !== 0) return `${fieldName} is required`;
      
      const numAmount = parseFloat(amount);
      
      if (isNaN(numAmount)) {
        return `${fieldName} must be a valid number`;
      }
      
      if (numAmount < 0) {
        return `${fieldName} cannot be negative`;
      }
      
      if (numAmount > 999999999) {
        return `${fieldName} cannot exceed 999,999,999`;
      }
      
      // Check for too many decimal places
      const decimalString = amount.toString();
      if (decimalString.includes('.')) {
        const decimalPart = decimalString.split('.')[1];
        if (decimalPart && decimalPart.length > 2) {
          return `${fieldName} cannot have more than 2 decimal places`;
        }
      }
      
      return null; // Valid
    };

    // Validate currency format
    const validateCurrencyFormat = (currency: string): string | null => {
      if (!currency) return 'Currency is required';
      
      if (currency.trim() === '') {
        return 'Currency cannot be empty';
      }
      
      // Check if it's a valid currency code (3 letters)
      const currencyRegex = /^[A-Z]{3}$/;
      if (!currencyRegex.test(currency.trim())) {
        return 'Currency must be a valid 3-letter code (e.g., USD, EUR, GBP)';
      }
      
      return null; // Valid
    };

    // Handle invoice number change with real-time validation
    const handleInvoiceNumberChange = async (value: string) => {
      // Validate format first
      const formatError = validateInvoiceNumberFormat(value);
      
      const newData = {
        ...editedData,
        invoice_metadata: {
          ...editedData.invoice_metadata,
          invoice_number: value
        }
      };
      setEditedData(newData);
      
      // Clear previous invoice number errors
      setValidationErrors(prev => prev.filter(error => 
        !error.includes('Invoice Number')
      ));
      
      // Add format error if present
      if (formatError) {
        setValidationErrors(prev => [...prev, formatError]);
        return;
      }
      
      // Validate in real-time if there's a value and format is valid
      if (value.trim()) {
        setTimeout(async () => {
          await validateInRealTime();
        }, 500); // Debounce validation
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <GlassCard className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/20 bg-gradient-to-r from-blue-50/50 to-purple-50/50">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-600 shadow-lg">
                <Edit3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Edit Invoice</h2>
                <p className="text-sm text-gray-600">Modify invoice data and save to database</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-white/20 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* Tab Navigation */}
            <div className="flex space-x-1 mb-6 bg-gray-100 rounded-xl p-1">
              {['metadata', 'vendor', 'customer', 'financial', 'commodity'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Validation Errors Display */}
            {validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                    <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content */}
            <div className="space-y-6">
              {activeTab === 'metadata' && (
                <div className="grid grid-cols-2 gap-4">
                                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invoice Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editedData.invoice_metadata?.invoice_number || ''}
                      onChange={(e) => handleInvoiceNumberChange(e.target.value)}
                      onBlur={async () => {
                        const invoiceNumber = editedData.invoice_metadata?.invoice_number?.trim();
                        if (!invoiceNumber) {
                          showToast('Invoice Number is required', 'error');
                        } else {
                          // Check if invoice number has changed and if it already exists
                          const originalInvoiceNumber = invoice.extractedData?.invoice_metadata?.invoice_number;
                          if (invoiceNumber !== originalInvoiceNumber) {
                            const exists = await checkInvoiceNumberExists(invoiceNumber);
                            if (exists) {
                              showToast('Invoice Number already exists', 'error');
                              setValidationErrors(prev => [...prev.filter(error => error !== 'Invoice Number already exists'), 'Invoice Number already exists']);
                            }
                          }
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm transition-colors ${
                        !editedData.invoice_metadata?.invoice_number?.trim() || validationErrors.some(error => error.includes('Invoice Number'))
                          ? 'border-red-300 bg-red-50 focus:ring-red-500' 
                          : 'border-white/30'
                      }`}
                      placeholder="Enter invoice number"
                    />
                    {!editedData.invoice_metadata?.invoice_number?.trim() && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Invoice Number is required
                      </p>
                    )}
                    {validationErrors.some(error => error.includes('Invoice Number') && error !== 'Invoice Number is required') && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {validationErrors.find(error => error.includes('Invoice Number') && error !== 'Invoice Number is required')}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invoice Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={editedData.invoice_metadata?.invoice_date || ''}
                      onChange={(e) => setEditedData((prev: any) => ({
                        ...prev,
                        invoice_metadata: { ...prev.invoice_metadata, invoice_date: e.target.value }
                      }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm ${
                        !editedData.invoice_metadata?.invoice_date?.trim() ? 'border-red-300 bg-red-50' : 'border-white/30'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={editedData.invoice_metadata?.due_date || ''}
                      onChange={(e) => setEditedData((prev: any) => ({
                        ...prev,
                        invoice_metadata: { ...prev.invoice_metadata, due_date: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm"
                      placeholder="Select due date"
                    />
                    <p className="mt-1 text-xs text-gray-500">Optional: When payment is due</p>
                  </div>
                </div>
              )}

              {activeTab === 'vendor' && (
                <div className="grid grid-cols-2 gap-4">
                                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vendor Company <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editedData.vendor_information?.company_name || ''}
                      onChange={(e) => setEditedData((prev: any) => ({
                        ...prev,
                        vendor_information: { ...prev.vendor_information, company_name: e.target.value }
                      }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm ${
                        !editedData.vendor_information?.company_name?.trim() ? 'border-red-300 bg-red-50' : 'border-white/30'
                      }`}
                      placeholder="Enter vendor company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Address</label>
                                         <input
                       type="text"
                       value={editedData.vendor_information?.contact_info?.address || ''}
                       onChange={(e) => setEditedData((prev: any) => ({
                         ...prev,
                         vendor_information: { 
                           ...prev.vendor_information, 
                           contact_info: { ...prev.vendor_information?.contact_info, address: e.target.value }
                         }
                       }))}
                       className="w-full px-3 py-2 border border-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm"
                     />
                  </div>
                </div>
              )}

              {activeTab === 'customer' && (
                <div className="grid grid-cols-2 gap-4">
                                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Company <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editedData.customer_information?.company_name || ''}
                      onChange={(e) => setEditedData((prev: any) => ({
                        ...prev,
                        customer_information: { ...prev.customer_information, company_name: e.target.value }
                      }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm ${
                        !editedData.customer_information?.company_name?.trim() ? 'border-red-300 bg-red-50' : 'border-white/30'
                      }`}
                      placeholder="Enter customer company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Customer Address</label>
                                         <input
                       type="text"
                       value={editedData.customer_information?.contact_info?.address || ''}
                       onChange={(e) => setEditedData((prev: any) => ({
                         ...prev,
                         customer_information: { 
                           ...prev.customer_information, 
                           contact_info: { ...prev.customer_information?.contact_info, address: e.target.value }
                         }
                       }))}
                       className="w-full px-3 py-2 border border-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm"
                     />
                  </div>
                </div>
              )}

              {activeTab === 'financial' && (
                <div className="grid grid-cols-2 gap-4">
                                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editedData.financial_summary?.total_amount || ''}
                      onChange={(e) => setEditedData((prev: any) => ({
                        ...prev,
                        financial_summary: { ...prev.financial_summary, total_amount: parseFloat(e.target.value) || 0 }
                      }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm ${
                        !editedData.financial_summary?.total_amount || editedData.financial_summary.total_amount <= 0 ? 'border-red-300 bg-red-50' : 'border-white/30'
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editedData.financial_summary?.currency || ''}
                      onChange={(e) => setEditedData((prev: any) => ({
                        ...prev,
                        financial_summary: { ...prev.financial_summary, currency: e.target.value }
                      }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm ${
                        !editedData.financial_summary?.currency?.trim() ? 'border-red-300 bg-red-50' : 'border-white/30'
                      }`}
                      placeholder="USD"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'commodity' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Total Items</label>
                    <input
                      type="number"
                      value={editedData.commodity_details?.total_items || ''}
                      onChange={(e) => setEditedData((prev: any) => ({
                        ...prev,
                        commodity_details: { ...prev.commodity_details, total_items: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm"
                    />
                  </div>
                  
                  {/* Individual Commodity Items */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-sm font-medium text-gray-700">Commodity Items</label>
                      <button
                        type="button"
                        onClick={() => {
                          const newItem = {
                            description: '',
                            quantity: 0,
                            unit_price: 0,
                            total_price: 0,
                            unit: ''
                          };
                          setEditedData((prev: any) => ({
                            ...prev,
                            commodity_details: {
                              ...prev.commodity_details,
                              items: [...(prev.commodity_details?.items || []), newItem]
                            }
                          }));
                        }}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        + Add Item
                      </button>
                    </div>
                    
                    <div className="space-y-4 max-h-64 overflow-y-auto">
                      {(editedData.commodity_details?.items || []).map((item: any, index: number) => (
                        <GlassCard key={index} className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-900">Item {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => {
                                setEditedData((prev: any) => ({
                                  ...prev,
                                  commodity_details: {
                                    ...prev.commodity_details,
                                    items: prev.commodity_details?.items?.filter((_: any, i: number) => i !== index) || []
                                  }
                                }));
                              }}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                              <input
                                type="text"
                                value={item.description || ''}
                                onChange={(e) => {
                                  const newItems = [...(editedData.commodity_details?.items || [])];
                                  newItems[index] = { ...newItems[index], description: e.target.value };
                                  setEditedData((prev: any) => ({
                                    ...prev,
                                    commodity_details: { ...prev.commodity_details, items: newItems }
                                  }));
                                }}
                                className="w-full px-2 py-1 text-sm border border-white/30 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                              <input
                                type="text"
                                value={item.unit || ''}
                                onChange={(e) => {
                                  const newItems = [...(editedData.commodity_details?.items || [])];
                                  newItems[index] = { ...newItems[index], unit: e.target.value };
                                  setEditedData((prev: any) => ({
                                    ...prev,
                                    commodity_details: { ...prev.commodity_details, items: newItems }
                                  }));
                                }}
                                className="w-full px-2 py-1 text-sm border border-white/30 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.quantity || ''}
                                onChange={(e) => {
                                  const newItems = [...(editedData.commodity_details?.items || [])];
                                  const quantity = parseFloat(e.target.value) || 0;
                                  const unitPrice = newItems[index].unit_price || 0;
                                  newItems[index] = { 
                                    ...newItems[index], 
                                    quantity: quantity,
                                    total_price: quantity * unitPrice
                                  };
                                  setEditedData((prev: any) => ({
                                    ...prev,
                                    commodity_details: { ...prev.commodity_details, items: newItems }
                                  }));
                                }}
                                className="w-full px-2 py-1 text-sm border border-white/30 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Unit Price</label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.unit_price || ''}
                                onChange={(e) => {
                                  const newItems = [...(editedData.commodity_details?.items || [])];
                                  const unitPrice = parseFloat(e.target.value) || 0;
                                  const quantity = newItems[index].quantity || 0;
                                  newItems[index] = { 
                                    ...newItems[index], 
                                    unit_price: unitPrice,
                                    total_price: quantity * unitPrice
                                  };
                                  setEditedData((prev: any) => ({
                                    ...prev,
                                    commodity_details: { ...prev.commodity_details, items: newItems }
                                  }));
                                }}
                                className="w-full px-2 py-1 text-sm border border-white/30 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm"
                              />
                            </div>
                            
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Total Price</label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.total_price || ''}
                                onChange={(e) => {
                                  const newItems = [...(editedData.commodity_details?.items || [])];
                                  newItems[index] = { ...newItems[index], total_price: parseFloat(e.target.value) || 0 };
                                  setEditedData((prev: any) => ({
                                    ...prev,
                                    commodity_details: { ...prev.commodity_details, items: newItems }
                                  }));
                                }}
                                className="w-full px-2 py-1 text-sm border border-white/30 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-black bg-white/80 backdrop-blur-sm"
                              />
                            </div>
                          </div>
                        </GlassCard>
                      ))}
                      
                      {(editedData.commodity_details?.items || []).length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <p>No commodity items found. Click &quot;Add Item&quot; to add items.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={validationErrors.length > 0 || isValidating}
                className={`flex-1 px-4 py-2 rounded-xl transition-colors font-medium ${
                  validationErrors.length > 0 || isValidating
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isValidating ? 'Validating...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  };

  const UploadModal = () => {
    if (!showUploadModal) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <GlassCard className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/20 bg-gradient-to-r from-green-50/50 to-blue-50/50">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-600 shadow-lg">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Upload Invoices</h2>
                <p className="text-sm text-gray-600">Upload and process PDF invoices with AI</p>
              </div>
            </div>
            <button
              onClick={() => closeUploadModal()}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-white/20 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-6">
            {/* Upload Area */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Select Files</h3>
                                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="modal-file-upload"
                    key={fileInputKey}
                  />
                <label
                  htmlFor="modal-file-upload"
                  className="inline-flex items-center px-6 py-3 text-white rounded-xl hover:opacity-90 transition-colors cursor-pointer font-semibold bg-gray-600 shadow-lg"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Browse Files
                </label>
              </div>



              {/* Drag & Drop Area */}
              <div
                className={`border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ${
                  isDragOver 
                    ? 'border-green-500 bg-green-50/50 backdrop-blur-sm' 
                    : 'border-gray-300 hover:border-gray-400 bg-white/20'
                }`}
                onDragOver={handleModalDragOver}
                onDragLeave={handleModalDragLeave}
                onDrop={handleModalDrop}
              >
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-100">
                    <FileUp className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Drop your PDF invoices here
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Supports multiple files • PDF format only • Maximum 5MB per file
                  </p>
                  <div className="text-sm text-gray-500">
                    Drag and drop your PDF invoices here or click to browse
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Files */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Selected Files ({uploadedFiles.length})
                </h3>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {uploadedFiles.map((file, index) => (
                    <GlassCard key={index} className="p-3">
                      <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            file.size > 4 * 1024 * 1024 
                              ? 'bg-gradient-to-br from-orange-100 to-red-100' 
                              : 'bg-gradient-to-br from-red-100 to-pink-100'
                          }`}>
                            {file.size > 4 * 1024 * 1024 ? (
                              <AlertCircle className="w-6 h-6 text-orange-600" />
                            ) : (
                              <FileText className="w-6 h-6 text-red-600" />
                            )}
                        </div>
                        <div>
                            <span className="text-sm font-semibold text-gray-900">{file.name}</span>
                          <p className={`text-xs ${
                            file.size > 4 * 1024 * 1024 ? 'text-orange-600 font-medium' : 'text-gray-500'
                          }`}>
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                            {file.size > 4 * 1024 * 1024 && ' (Approaching 5MB limit)'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-2 hover:bg-white/20 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    </GlassCard>
                  ))}
                </div>
              </div>
            )}

            {/* Oversized Files Warning */}
            {hasOversizedFiles && (
              <GlassCard className="p-4 bg-red-50/50 border border-red-200">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-red-800 mb-1">File Size Limit Exceeded</h4>
                    <p className="text-sm text-red-700">
                      Some files exceed the 5MB limit and cannot be processed. Please remove oversized files or compress them before uploading.
                    </p>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Processing Progress */}
            {isProcessing && (
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-900">
                    Processing {uploadedFiles.length} invoice{uploadedFiles.length > 1 ? 's' : ''} in batches of 2...
                  </span>
                  <span className="text-sm text-gray-600">{Math.round(processingProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="h-3 rounded-full transition-all duration-300 bg-green-500"
                    style={{ width: `${processingProgress}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Processing 2 invoices per batch to prevent backend overload
                </div>
              </GlassCard>
            )}

            {/* Error Messages */}
            {rateLimitError && (
              <GlassCard className="p-4 bg-red-50/50">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-600 text-sm font-medium">{rateLimitError}</p>
                </div>
              </GlassCard>
            )}

            {/* Success Messages */}
            {modalProcessedResults.length > 0 && !isProcessing && (
              <GlassCard className="p-4 bg-green-50/50">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-green-600 text-sm font-medium">
                    {(() => {
                      const newCount = modalProcessedResults.filter(inv => !inv.isUpdate).length;
                      const updatedCount = modalProcessedResults.filter(inv => inv.isUpdate).length;
                      
                      if (newCount > 0 && updatedCount > 0) {
                        return `Successfully processed ${newCount} new and updated ${updatedCount} existing invoice${modalProcessedResults.length > 1 ? 's' : ''}!`;
                      } else if (newCount > 0) {
                        return `Successfully processed ${newCount} new invoice${newCount > 1 ? 's' : ''}!`;
                      } else if (updatedCount > 0) {
                        return `Successfully updated ${updatedCount} existing invoice${updatedCount > 1 ? 's' : ''}!`;
                      }
                      return `Successfully processed ${modalProcessedResults.length} invoice${modalProcessedResults.length > 1 ? 's' : ''}!`;
                    })()}
                  </p>
                </div>
              </GlassCard>
            )}

            {/* Processed Results Display */}
            {modalProcessedResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Processing Results</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {modalProcessedResults.map((invoice, index) => (
                    <GlassCard key={index} className="p-4 bg-green-50/30">
                                              <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-semibold text-gray-900">{invoice.filename}</span>
                              {invoice.isUpdate ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Updated
                                </span>
                              ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  New
                                </span>
                              )}
                            </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Invoice #:</span>
                              <span className="ml-2 font-medium text-black">{invoice.invoiceNumber}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Vendor:</span>
                              <span className="ml-2 font-medium text-black">{normalizeCompanyName(invoice.vendorName)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Customer:</span>
                              <span className="ml-2 font-medium text-black">{normalizeCompanyName(invoice.customerName || invoice.extractedData?.customer_information?.company_name)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Amount:</span>
                              <span className="ml-2 font-medium text-green-600">${(invoice.totalAmount || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Items:</span>
                              <span className="ml-2 font-medium text-black">{invoice.totalItems || invoice.extractedData?.commodity_details?.total_items || 0}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Date:</span>
                              <span className="ml-2 font-medium text-black">
                                {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 
                                 invoice.extractedData?.invoice_metadata?.invoice_date ? new Date(invoice.extractedData.invoice_metadata.invoice_date).toLocaleDateString() : 
                                 'N/A'}
                              </span>
                            </div>
                          </div>
                            </div>
                            </div>
                    </GlassCard>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between p-6 border-t border-white/20 bg-gradient-to-r from-gray-50/50 to-gray-100/50">
            <div className="text-sm text-gray-500">
              {modalProcessedResults.length > 0 
                ? (() => {
                    const newCount = modalProcessedResults.filter(inv => !inv.isUpdate).length;
                    const updatedCount = modalProcessedResults.filter(inv => inv.isUpdate).length;
                    
                    if (newCount > 0 && updatedCount > 0) {
                      return `${newCount} new, ${updatedCount} updated`;
                    } else if (newCount > 0) {
                      return `${newCount} new invoice${newCount !== 1 ? 's' : ''} processed`;
                    } else if (updatedCount > 0) {
                      return `${updatedCount} invoice${updatedCount !== 1 ? 's' : ''} updated`;
                    }
                    return `${modalProcessedResults.length} invoice${modalProcessedResults.length !== 1 ? 's' : ''} processed`;
                  })()
                : hasOversizedFiles 
                          ? 'Cannot process: Files exceed 5MB limit'
        : `${uploadedFiles.length} file${uploadedFiles.length !== 1 ? 's' : ''} selected • Max 5MB per file • Processed in batches of 2`
              }
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => closeUploadModal()}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-white/20 transition-colors backdrop-blur-sm font-medium"
              >
                {modalProcessedResults.length > 0 ? 'Close' : 'Cancel'}
              </button>
              {modalProcessedResults.length === 0 && (
                <button
                  onClick={processInvoices}
                  disabled={uploadedFiles.length === 0 || isProcessing || hasOversizedFiles}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                    uploadedFiles.length === 0 || isProcessing || hasOversizedFiles
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                      : 'text-white bg-gray-600 hover:bg-gray-700 shadow-lg'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin inline" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2 inline" />
                      Process {uploadedFiles.length} Invoice{uploadedFiles.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </GlassCard>
      </div>
    );
  };

  // Get unique vendor names for autocomplete
  const uniqueVendorNames = useMemo(() => {
    const vendors = new Set<string>();
    allInvoicesFromDB.forEach(invoice => {
      const vendorName = normalizeCompanyName(invoice.vendorName);
      if (vendorName && vendorName.trim() !== '') {
        vendors.add(vendorName);
      }
    });
    const result = Array.from(vendors).sort();
    return result;
  }, [allInvoicesFromDB, normalizeCompanyName]);

  // Get unique commodity items for autocomplete
  const uniqueCommodityItems = useMemo(() => {
    const items = new Set<string>();
    allInvoicesFromDB.forEach(invoice => {
      const commodityItems = invoice.extractedData?.commodity_details?.items || [];
      commodityItems.forEach((item: any) => {
        const description = item.description || item.item || '';
        if (description && description.trim() !== '') {
          items.add(description);
        }
      });
    });
    const result = Array.from(items).sort();
    return result;
  }, [allInvoicesFromDB]);

  // Get unique customer names for autocomplete
  const uniqueCustomerNames = useMemo(() => {
    const customers = new Set<string>();
    allInvoicesFromDB.forEach(invoice => {
      const customerName = normalizeCompanyName(invoice.extractedData?.customer_information?.company_name);
      if (customerName && customerName.trim() !== '') {
        customers.add(customerName);
      }
    });
    const result = Array.from(customers).sort();
    return result;
  }, [allInvoicesFromDB, normalizeCompanyName]);



  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <GlassCard className="p-8 text-center">
          <RefreshCw className="w-10 h-10 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </GlassCard>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 relative w-full" style={{ fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>

      <style jsx global>{`
        .table-scroll-container {
          overflow-x: scroll !important;
          overflow-y: scroll !important;
          max-height: 400px !important;
          scrollbar-width: auto !important;
          scrollbar-color: #6b7280 #f3f4f6 !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 8px !important;
          /* FORCE SCROLLBARS TO SHOW */
          scrollbar-gutter: stable !important;
          background: white !important;
        }
        
        /* OVERRIDE ANY BROWSER HIDING */
        .table-scroll-container {
          scrollbar-width: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
        
        .table-scroll-container::-webkit-scrollbar {
          width: 25px !important;
          height: 25px !important;
          display: block !important;
          background: #f1f5f9 !important;
        }
        
        .table-scroll-container::-webkit-scrollbar-track {
          background: #f3f4f6 !important;
          border-radius: 10px !important;
          border: 1px solid #e5e7eb !important;
        }
        
        .table-scroll-container::-webkit-scrollbar-thumb {
          background: #6b7280 !important;
          border-radius: 12px !important;
          border: 3px solid #f3f4f6 !important;
          min-height: 40px !important;
          min-width: 40px !important;
          box-shadow: inset 0 0 6px rgba(0,0,0,0.2) !important;
        }
        
        .table-scroll-container::-webkit-scrollbar-thumb:hover {
          background: #4b5563 !important;
        }
        
        .table-scroll-container::-webkit-scrollbar-corner {
          background: #e5e7eb !important;
        }
        
        /* FORCE SCROLLBARS TO BE VISIBLE */
        .table-scroll-container::-webkit-scrollbar:horizontal {
          display: block !important;
        }
        
        .table-scroll-container::-webkit-scrollbar:vertical {
          display: block !important;
        }
        
        /* AGGRESSIVE STICKY POSITIONING - FIXED OVERLAP ISSUE */
        .sticky-invoice-header {
          position: sticky !important;
          top: 0 !important;
          left: 0 !important;
          z-index: 999 !important;
          background: linear-gradient(to right, #f9fafb, #f3f4f6) !important;
          border-right: 2px solid #d1d5db !important;
          box-shadow: 2px 0 8px rgba(0,0,0,0.25) !important;
          border-bottom: 2px solid #d1d5db !important;
        }
        
        .sticky-invoice-cell {
          position: sticky !important;
          left: 0 !important;
          z-index: 30 !important;
          background: white !important;
          border-right: 2px solid #d1d5db !important;
          box-shadow: 2px 0 8px rgba(0,0,0,0.15) !important;
        }
        
        .sticky-invoice-cell:hover {
          background: #f9fafb !important;
        }
        
        /* FORCE ALL HEADERS TO BE STICKY - LOWER Z-INDEX THAN INVOICE HEADER */
        thead {
          position: sticky !important;
          top: 0 !important;
          z-index: 100 !important;
        }
        
        thead th {
          position: sticky !important;
          top: 0 !important;
          z-index: 100 !important;
          background: linear-gradient(to right, #f9fafb, #f3f4f6) !important;
          border-bottom: 2px solid #d1d5db !important;
        }
        
        /* ENSURE INVOICE HEADER ALWAYS STAYS ON TOP */
        .sticky-invoice-header {
          position: sticky !important;
          top: 0 !important;
          left: 0 !important;
          z-index: 999 !important;
          background: linear-gradient(to right, #f9fafb, #f3f4f6) !important;
          border-right: 2px solid #d1d5db !important;
          border-bottom: 2px solid #d1d5db !important;
          box-shadow: 2px 2px 8px rgba(0,0,0,0.25) !important;
        }
      `}</style>
      {/* Background Logo Watermark */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-3"
        style={{
          backgroundImage: 'url(/logo_complete.png)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center center',
          backgroundSize: '600px auto'
        }}
      ></div>

      {/* Modern Header - Redesigned - Sticky */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-50 shadow-lg">
        <div className="w-full">
          <div className="flex justify-between items-center py-4 px-6">
            {/* Left side - Logo only, no padding */}
            <div className="flex items-center space-x-4">
              <Image
                src="/logo_complete.png"
                alt="Green Earth Logo"
                width={180}
                height={60}
                className="h-auto"
                priority
              />
              </div>
            
            {/* Right side - Logout only */}
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-6 py-3 text-white rounded-xl hover:opacity-90 transition-all duration-200 bg-gradient-to-r from-red-500 to-pink-500 shadow-lg font-medium"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 py-6 space-y-8 relative z-10">
        
        {/* Quick Actions Bar */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <TrendingUp className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">Invoice Analytics</h2>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={openUploadModal}
              className="inline-flex items-center px-6 py-3 text-white rounded-xl hover:opacity-90 transition-all duration-200 font-semibold bg-gray-600 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Plus className="w-5 h-5 mr-2" />
              Upload Invoices
            </button>
          </div>
        </div>



        {/* Always Visible Filters Section */}
        <GlassCard className="border border-white/30">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Advanced Filters</h3>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={applyFilters}
                  disabled={!hasFilterChanges}
                  className={`text-sm font-medium transition-colors px-4 py-2 rounded-xl ${
                    hasFilterChanges
                      ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:opacity-90 shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Apply Filters
                </button>
                <button
                  onClick={clearFilters}
                  className="text-sm font-medium hover:opacity-80 transition-colors px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white"
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <FilterInputs 
              tempFilters={tempFilters} 
              handleTempFilterChange={handleTempFilterChange}
              uniqueVendorNames={uniqueVendorNames}
              uniqueCommodityItems={uniqueCommodityItems}
              uniqueCustomerNames={uniqueCustomerNames}
            />
            
            {/* Filter Summary */}
            <GlassCard className="mt-6 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-700">
                  Showing {filteredInvoices.length} of {allInvoicesFromDB.length} invoices
                </span>
                {filteredInvoices.length !== allInvoicesFromDB.length && (
                  <span className="px-3 py-1 rounded-full text-white text-xs font-medium bg-gradient-to-r from-orange-500 to-red-500">
                    {allInvoicesFromDB.length - filteredInvoices.length} filtered out
                  </span>
                )}
              </div>
            </GlassCard>
          </div>
        </GlassCard>
        
        {/* Enhanced Analytics Cards - Removed Processing Time */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            title="Total Invoices"
            value={analyticsData.totalInvoices.toLocaleString()}
            icon={FileText}
            color={chartColors.vibrant[0]}
            subtitle={`${analyticsData.uniqueVendors} unique vendors`}
          />
          <StatsCard
            title="Total Amount"
            value={`$${analyticsData.totalAmount.toLocaleString()}`}
            icon={DollarSign}
            color={chartColors.vibrant[1]}
            subtitle={`Avg: $${analyticsData.averageAmount.toFixed(0)}`}
          />
          <StatsCard
            title="Active Vendors"
            value={analyticsData.uniqueVendors.toLocaleString()}
            icon={Users}
            color={chartColors.vibrant[2]}
            subtitle="This period"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Dynamic Chart */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {analyticsData.chartTitle}
              </h3>
              <BarChart3 className="w-6 h-6 text-gray-400" />
            </div>
            
            {loadingAllInvoices ? (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-spin" />
                  <p className="text-gray-500">Loading chart data...</p>
                </div>
              </div>
            ) : analyticsData.topVendors && analyticsData.topVendors.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.topVendors} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#000', textAnchor: 'end' }}
                      angle={-45}
                      height={60}
                      interval={0}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#666' }}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="amount" 
                      fill={chartColors.vibrant[0]}
                      radius={[8, 8, 0, 0]}
                      cursor="pointer"
                      onClick={handleVendorBarClick}
                    >
                      {analyticsData.topVendors.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={selectedVendorIndex === index ? chartColors.vibrant[1] : chartColors.vibrant[0]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No vendor data available</p>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Invoice Status Distribution */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
              <h3 className="text-xl font-bold text-gray-900">Invoice Status</h3>
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowPieChartInfo(true)}
                    onMouseLeave={() => setShowPieChartInfo(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    title="Chart Information"
                  >
                    <Info className="w-4 h-4 text-gray-500" />
                  </button>
                  
                  {/* Info Tooltip */}
                  {showPieChartInfo && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl z-50 whitespace-nowrap">
                      <div className="text-center">
                        <p className="font-medium mb-1">Invoice Status Distribution</p>
                        <p className="text-xs text-gray-300">
                          Shows the breakdown of processed invoices by status.
                          Currently displays processed invoices count.
                        </p>
                      </div>
                      {/* Arrow */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  )}
                </div>
              </div>
              <PieChartIcon className="w-6 h-6 text-gray-400" />
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {analyticsData.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors.modern[index]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          </div>

        {/* All Invoices Database */}
        <GlassCard className="overflow-hidden">
          <div className="px-6 py-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 backdrop-blur-sm">
              <div className="flex justify-between items-center">
                <div>
                <h2 className="text-2xl font-bold text-gray-900">All Invoices</h2>
                <p className="text-gray-600 text-sm mt-1">
                    {loadingAllInvoices 
                      ? 'Loading from database...' 
                      : `${allInvoicesFromDB.length} total invoices • Loaded in ${loadTime}ms`
                    }
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                  onClick={() => {
                    // Determine which dataset to export based on applied filters
                    const hasActiveFilters = Object.values(filters).some(filterValue => 
                      filterValue && filterValue.trim() !== ''
                    );
                    const dataToExport = hasActiveFilters ? filteredInvoices : allInvoicesFromDB;
                    const exportType = hasActiveFilters ? 'filtered' : 'all';
                    
                    // Format date properly for CSV export
                    const formatDateForCSV = (dateValue: any): string => {
                      if (!dateValue) return 'N/A';
                      try {
                        let dateObj: Date;
                        if (typeof dateValue === 'string') {
                          dateObj = new Date(dateValue);
                        } else if (dateValue && typeof dateValue.toDate === 'function') {
                          dateObj = dateValue.toDate();
                        } else if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
                          dateObj = new Date(dateValue.seconds * 1000);
                        } else {
                          dateObj = new Date(dateValue);
                        }
                        
                        // Format as YYYY-MM-DD to avoid comma issues
                        return dateObj.toISOString().split('T')[0];
                      } catch {
                        return 'N/A';
                      }
                    };

                    // Escape CSV values to handle commas and quotes
                    const escapeCSV = (value: any): string => {
                      if (value === null || value === undefined) return '';
                      const str = String(value);
                      // If the value contains comma, quote, or newline, wrap in quotes and escape quotes
                      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                      }
                      return str;
                    };

                    const csvContent = "data:text/csv;charset=utf-8," + 
                      "Invoice Number,Date,Vendor,Customer,Total Amount,Items Count,Commodity Items,Individual Prices,Currency,Invoice Status,PDF Link\n" +
                      dataToExport.map(invoice => {
                        const invoiceNumber = escapeCSV(invoice.invoiceNumber || invoice.extractedData?.invoice_metadata?.invoice_number || 'N/A');
                        const date = escapeCSV(formatDateForCSV(invoice.invoiceDate));
                        const vendor = escapeCSV(invoice.vendorName || 'Unknown');
                        const customer = escapeCSV(invoice.extractedData?.customer_information?.company_name || 'N/A');
                        const totalAmount = escapeCSV(invoice.totalAmount || invoice.extractedData?.financial_summary?.total_amount || 0);
                        const itemsCount = escapeCSV(invoice.extractedData?.commodity_details?.total_items || 0);
                        
                        // Format commodity items with descriptions and quantities
                        const commodityItems = escapeCSV(
                          invoice.extractedData?.commodity_details?.items?.map((item: any) => 
                            `${item.description || item.name || 'N/A'} (Qty: ${item.quantity || 0})`
                          ).join('; ') || 'N/A'
                        );
                        
                        // Format individual prices for each commodity item
                        const individualPrices = escapeCSV(
                          invoice.extractedData?.commodity_details?.items?.map((item: any) => {
                            const unitPrice = item.unit_price || item.price || 0;
                            const quantity = item.quantity || 0;
                            const totalPrice = item.total_price || (unitPrice * quantity) || 0;
                            return `${item.description || item.name || 'N/A'}: $${unitPrice}/unit × ${quantity} = $${totalPrice}`;
                          }).join('; ') || 'N/A'
                        );
                        
                        const currency = escapeCSV(invoice.extractedData?.financial_summary?.currency || 'USD');
                        const status = escapeCSV('Processed'); // All stored invoices are processed
                        const pdfLink = escapeCSV(invoice.fileUrl || 'N/A');
                        
                        return `${invoiceNumber},${date},${vendor},${customer},${totalAmount},${itemsCount},${commodityItems},${individualPrices},${currency},${status},${pdfLink}`;
                      }).join('\n');
                    
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement('a');
                    link.setAttribute('href', encodedUri);
                    const filename = exportType === 'filtered' ? `filtered_invoices_${dataToExport.length}.csv` : 'all_invoices.csv';
                    link.setAttribute('download', filename);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    // Show confirmation message
                    const message = exportType === 'filtered' 
                      ? `Exported ${dataToExport.length} filtered invoices to CSV` 
                      : `Exported all ${dataToExport.length} invoices to CSV`;
                    showToast(message, 'success');
                  }}
                    disabled={allInvoicesFromDB.length === 0}
                  className="inline-flex items-center px-4 py-2 bg-white/20 text-gray-700 rounded-xl hover:bg-white/30 transition-colors disabled:opacity-50 backdrop-blur-sm font-medium"
                  >
                    <Download className="w-4 h-4 mr-2" />
                  Export CSV
                  </button>
                  <button
                    onClick={loadAllInvoicesFromDB}
                    disabled={loadingAllInvoices}
                  className="inline-flex items-center px-4 py-2 bg-white/20 text-gray-700 rounded-xl hover:bg-white/30 transition-colors disabled:opacity-50 backdrop-blur-sm font-medium"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingAllInvoices ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {loadingAllInvoices ? (
                <div className="space-y-4">
                  <div className="animate-pulse space-y-3">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className="h-4 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Invoice Table */}
                  <InvoiceTable 
                    invoices={filteredInvoicesPagination.currentInvoices} 
                  title="All Invoices"
                    emptyMessage="No invoices have been processed yet. Start by uploading some PDF invoices."
                  />
                  
                  {/* Pagination */}
                  {filteredInvoicesPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-white/20 bg-gradient-to-r from-gray-50/30 to-gray-100/30 backdrop-blur-sm rounded-b-2xl">
                      <div className="flex items-center text-sm text-gray-700">
                        <span>
                          Showing {filteredInvoicesPagination.showingFrom} to {filteredInvoicesPagination.showingTo} of {filteredInvoicesPagination.total} invoices
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white/50 border border-white/30 rounded-xl hover:bg-white/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors backdrop-blur-sm"
                        >
                          Previous
                        </button>
                        
                        <div className="flex space-x-1">
                          {Array.from({ length: filteredInvoicesPagination.totalPages }, (_, i) => i + 1)
                            .slice(Math.max(0, currentPage - 3), Math.min(filteredInvoicesPagination.totalPages, currentPage + 2))
                            .map((pageNum) => (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                                  pageNum === currentPage
                                  ? 'text-white bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg'
                                  : 'text-gray-700 bg-white/50 border border-white/30 hover:bg-white/70 backdrop-blur-sm'
                                }`}
                              >
                                {pageNum}
                              </button>
                            ))}
                        </div>
                        
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === filteredInvoicesPagination.totalPages}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white/50 border border-white/30 rounded-xl hover:bg-white/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors backdrop-blur-sm"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
        </GlassCard>
      </main>

      {/* Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* Upload Modal */}
      <UploadModal />
      
              {/* Delete Confirmation Modal */}
        {showDeleteModal && invoiceToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <GlassCard className="w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-100">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Delete Invoice</h3>
                    <p className="text-sm text-gray-600">This action cannot be undone</p>
                  </div>
                </div>
                
                <p className="text-gray-700 mb-6">
                  Are you sure you want to delete invoice <span className="font-semibold">&quot;{invoiceToDelete.invoice.invoiceNumber}&quot;</span>?
                </p>
                
                <div className="flex space-x-3">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Edit Invoice Modal */}
        {showEditModal && invoiceToEdit && (
          <EditInvoiceModal 
            invoice={invoiceToEdit} 
            onSave={saveEditedInvoice} 
            onCancel={cancelEdit} 
          />
        )}
    </div>
  );
}