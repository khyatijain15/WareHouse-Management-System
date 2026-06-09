"use client";

import DashboardLayout from '@/components/dashboard-layout';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, ArrowLeft, TrendingUp, TrendingDown, BarChart3, PieChart, Activity, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

interface AnalyticsData {
  totalInward: number;
  totalOutward: number;
  totalReleaseOrders: number;
  totalDeliveryOrders: number;
  totalInsurance: number;
  totalWarehouses: number;
  totalClients: number;
  totalCommodities: number;
  inwardValue: number;
  outwardValue: number;
  activeInsurance: number;
  expiredInsurance: number;
  monthlyData: {
    month: string;
    inward: number;
    outward: number;
    value: number;
  }[];
  topWarehouses: {
    name: string;
    count: number;
    value: number;
  }[];
  topClients: {
    name: string;
    count: number;
    value: number;
  }[];
  topCommodities: {
    name: string;
    count: number;
    value: number;
  }[];
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState('6months');
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalInward: 0,
    totalOutward: 0,
    totalReleaseOrders: 0,
    totalDeliveryOrders: 0,
    totalInsurance: 0,
    totalWarehouses: 0,
    totalClients: 0,
    totalCommodities: 0,
    inwardValue: 0,
    outwardValue: 0,
    activeInsurance: 0,
    expiredInsurance: 0,
    monthlyData: [],
    topWarehouses: [],
    topClients: [],
    topCommodities: []
  });

  // Fetch analytics data
  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // Fetch data from multiple collections
      const [inwardSnapshot, outwardSnapshot, roSnapshot, doSnapshot, inspectionsSnapshot, insuranceSnapshot] = await Promise.all([
        getDocs(collection(db, 'inward')),
        getDocs(collection(db, 'outwards')),
        getDocs(collection(db, 'releaseOrders')),
        getDocs(collection(db, 'deliveryOrders')),
        getDocs(collection(db, 'inspections')),
        getDocs(collection(db, 'insurance'))
      ]);

      // Process data
      const inwardData = inwardSnapshot.docs.map(doc => doc.data());
      const outwardData = outwardSnapshot.docs.map(doc => doc.data());
      const roData = roSnapshot.docs.map(doc => doc.data());
      const doData = doSnapshot.docs.map(doc => doc.data());
      const inspectionsData = inspectionsSnapshot.docs.map(doc => doc.data());
      const insuranceData = insuranceSnapshot.docs.map(doc => doc.data());

      // Calculate totals
      const totalInward = inwardData.length;
      const totalOutward = outwardData.length;
      const totalReleaseOrders = roData.length;
      const totalDeliveryOrders = doData.length;
      const totalWarehouses = new Set(inwardData.map((item: any) => item.warehouseName).filter(Boolean)).size;
      const totalClients = new Set(inwardData.map((item: any) => item.client).filter(Boolean)).size;
      const totalCommodities = new Set(inwardData.map((item: any) => item.commodity).filter(Boolean)).size;

      // Calculate values
      const inwardValue = inwardData.reduce((sum: number, item: any) => {
        const value = parseFloat(item.totalValue) || 0;
        return sum + value;
      }, 0);

      const outwardValue = outwardData.reduce((sum: number, item: any) => {
        const value = parseFloat(item.outwardValue) || 0;
        return sum + value;
      }, 0);

      // Calculate insurance data from insurance master collection
      let totalInsurance = insuranceData.length;
      let activeInsurance = 0;
      let expiredInsurance = 0;

      insuranceData.forEach((insurance: any) => {
        // Check if either policy is still active
        const fireEndDate = insurance.firePolicyEndDate ? new Date(insurance.firePolicyEndDate) : null;
        const burglaryEndDate = insurance.burglaryPolicyEndDate ? new Date(insurance.burglaryPolicyEndDate) : null;
        const today = new Date();
        
        let hasActivePolicy = false;
        
        if (fireEndDate && fireEndDate > today) {
          hasActivePolicy = true;
        }
        
        if (burglaryEndDate && burglaryEndDate > today) {
          hasActivePolicy = true;
        }
        
        // If no end dates are specified, consider as active
        if (!fireEndDate && !burglaryEndDate) {
          hasActivePolicy = true;
        }
        
        if (hasActivePolicy) {
          activeInsurance++;
        } else {
          expiredInsurance++;
        }
      });

      // Generate monthly data for the selected time range
      const monthlyData = generateMonthlyData(inwardData, timeRange);

      // Generate top performers
      const topWarehouses = generateTopWarehouses(inwardData);
      const topClients = generateTopClients(inwardData);
      const topCommodities = generateTopCommodities(inwardData);

      setAnalyticsData({
        totalInward,
        totalOutward,
        totalReleaseOrders,
        totalDeliveryOrders,
        totalInsurance,
        totalWarehouses,
        totalClients,
        totalCommodities,
        inwardValue,
        outwardValue,
        activeInsurance,
        expiredInsurance,
        monthlyData,
        topWarehouses,
        topClients,
        topCommodities
      });

    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate monthly data
  const generateMonthlyData = (data: any[], range: string) => {
    const months: { [key: string]: { inward: number; outward: number; value: number } } = {};
    const today = new Date();
    let startDate = new Date();

    switch (range) {
      case '3months':
        startDate.setMonth(today.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(today.getMonth() - 6);
        break;
      case '12months':
        startDate.setMonth(today.getMonth() - 12);
        break;
      default:
        startDate.setMonth(today.getMonth() - 6);
    }

    // Initialize months
    for (let d = new Date(startDate); d <= today; d.setMonth(d.getMonth() + 1)) {
      const monthKey = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      months[monthKey] = { inward: 0, outward: 0, value: 0 };
    }

    // Populate data
    data.forEach((item: any) => {
      const date = new Date(item.createdAt || item.dateOfInward || '');
      if (date >= startDate && date <= today) {
        const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (months[monthKey]) {
          months[monthKey].inward++;
          months[monthKey].value += parseFloat(item.totalValue) || 0;
        }
      }
    });

    return Object.entries(months).map(([month, data]) => ({
      month,
      ...data
    }));
  };

  // Generate top warehouses
  const generateTopWarehouses = (data: any[]) => {
    const warehouseCounts: { [key: string]: { count: number; value: number } } = {};
    
    data.forEach((item: any) => {
      const warehouse = item.warehouseName;
      if (warehouse) {
        if (!warehouseCounts[warehouse]) {
          warehouseCounts[warehouse] = { count: 0, value: 0 };
        }
        warehouseCounts[warehouse].count++;
        warehouseCounts[warehouse].value += parseFloat(item.totalValue) || 0;
      }
    });

    return Object.entries(warehouseCounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  // Generate top clients
  const generateTopClients = (data: any[]) => {
    const clientCounts: { [key: string]: { count: number; value: number } } = {};
    
    data.forEach((item: any) => {
      const client = item.client;
      if (client) {
        if (!clientCounts[client]) {
          clientCounts[client] = { count: 0, value: 0 };
        }
        clientCounts[client].count++;
        clientCounts[client].value += parseFloat(item.totalValue) || 0;
      }
    });

    return Object.entries(clientCounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  // Generate top commodities
  const generateTopCommodities = (data: any[]) => {
    const commodityCounts: { [key: string]: { count: number; value: number } } = {};
    
    data.forEach((item: any) => {
      const commodity = item.commodity;
      if (commodity) {
        if (!commodityCounts[commodity]) {
          commodityCounts[commodity] = { count: 0, value: 0 };
        }
        commodityCounts[commodity].count++;
        commodityCounts[commodity].value += parseFloat(item.totalValue) || 0;
      }
    });

    return Object.entries(commodityCounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Export analytics to CSV
  const exportAnalytics = () => {
    const csvContent = [
      'Metric,Value',
      `Total Inward Transactions,${analyticsData.totalInward}`,
      `Total Outward Transactions,${analyticsData.totalOutward}`,
      `Total Release Orders,${analyticsData.totalReleaseOrders}`,
      `Total Delivery Orders,${analyticsData.totalDeliveryOrders}`,
      `Total Insurance Policies,${analyticsData.totalInsurance}`,
      `Total Warehouses,${analyticsData.totalWarehouses}`,
      `Total Clients,${analyticsData.totalClients}`,
      `Total Commodities,${analyticsData.totalCommodities}`,
      `Total Inward Value,${formatCurrency(analyticsData.inwardValue)}`,
      `Total Outward Value,${formatCurrency(analyticsData.outwardValue)}`,
      `Active Insurance Policies,${analyticsData.activeInsurance}`,
      `Expired Insurance Policies,${analyticsData.expiredInsurance}`,
      '',
      'Monthly Data',
      'Month,Inward Count,Outward Count,Total Value',
      ...analyticsData.monthlyData.map(item => 
        `${item.month},${item.inward},${item.outward},${formatCurrency(item.value)}`
      ),
      '',
      'Top Warehouses',
      'Warehouse,Transaction Count,Total Value',
      ...analyticsData.topWarehouses.map(item => 
        `${item.name},${item.count},${formatCurrency(item.value)}`
      ),
      '',
      'Top Clients',
      'Client,Transaction Count,Total Value',
      ...analyticsData.topClients.map(item => 
        `${item.name},${item.count},${formatCurrency(item.value)}`
      ),
      '',
      'Top Commodities',
      'Commodity,Transaction Count,Total Value',
      ...analyticsData.topCommodities.map(item => 
        `${item.name},${item.count},${formatCurrency(item.value)}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => router.push('/reports')}
              className="inline-flex items-center text-base sm:text-lg font-semibold tracking-tight bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition-colors w-full md:w-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Reports
            </button>
          </div>
          
          <div className="text-center flex flex-col items-center w-full md:w-auto">
            {/* Logo */}
            <div className="w-36 h-10 relative mb-3 bg-white rounded-lg px-2 py-1">
              {/* <Image 
                src="/AGlogo.webp" 
                alt="AgroGreen Logo" 
                fill
                className="object-contain"
                priority
              /> */}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-orange-600 inline-block border-b-4 border-green-500 pb-2 px-4 sm:px-6 py-2 bg-orange-100 rounded-lg w-full md:w-auto">
              Analytics & Summary
            </h1>
            <p className="text-muted-foreground">Comprehensive business intelligence and insights</p>
          </div>
          
          <div className="flex space-x-2 justify-center md:justify-end w-full md:w-auto">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">3 Months</SelectItem>
                <SelectItem value="6months">6 Months</SelectItem>
                <SelectItem value="12months">12 Months</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchAnalyticsData} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button onClick={exportAnalytics}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inward</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.totalInward.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(analyticsData.inwardValue)} total value
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Outward</CardTitle>
              <TrendingDown className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.totalOutward.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(analyticsData.outwardValue)} total value
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Insurance</CardTitle>
              <Shield className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.activeInsurance.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {analyticsData.expiredInsurance} expired
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Warehouses</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.totalWarehouses.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {analyticsData.totalClients} clients, {analyticsData.totalCommodities} commodities
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction Summary */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Transaction Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Release Orders</span>
                  <span className="text-lg font-semibold">{analyticsData.totalReleaseOrders}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Delivery Orders</span>
                  <span className="text-lg font-semibold">{analyticsData.totalDeliveryOrders}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Insurance Policies</span>
                  <span className="text-lg font-semibold">{analyticsData.totalInsurance}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Monthly Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analyticsData.monthlyData.slice(-3).map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{item.month}</span>
                    <span className="text-sm font-medium">
                      {item.inward} inward, {item.outward} outward
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Performers */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top Warehouses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData.topWarehouses.map((warehouse, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{warehouse.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {warehouse.count} transactions
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(warehouse.value)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData.topClients.map((client, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{client.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {client.count} transactions
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(client.value)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top Commodities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData.topCommodities.map((commodity, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{commodity.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {commodity.count} transactions
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(commodity.value)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Info */}
        <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">i</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-medium text-green-900">Analytics Insights</h4>
              <p className="text-xs sm:text-sm text-green-700 mt-1 leading-relaxed">
                This dashboard provides comprehensive insights into warehouse operations, 
                transaction patterns, and business performance metrics. Use the time range 
                selector to analyze different periods and export data for further analysis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
