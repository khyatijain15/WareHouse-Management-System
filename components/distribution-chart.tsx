"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { columns } from '@/components/columns';

type ChartFilter = 'commodity' | 'aum' | 'state';

// Sample data for the chart
const chartData = {
  commodity: [
    { name: 'Wheat', value: 3500, color: 'hsl(var(--chart-1))' },
    { name: 'Rice', value: 2800, color: 'hsl(var(--chart-2))' },
    { name: 'Corn', value: 1800, color: 'hsl(var(--chart-3))' },
    { name: 'Soybeans', value: 1200, color: 'hsl(var(--chart-4))' },
    { name: 'Other', value: 900, color: 'hsl(var(--chart-5))' }
  ],
  aum: [
    { name: '<$100K', value: 2200, color: 'hsl(var(--chart-1))' },
    { name: '$100K-$500K', value: 3100, color: 'hsl(var(--chart-2))' },
    { name: '$500K-$1M', value: 2600, color: 'hsl(var(--chart-3))' },
    { name: '>$1M', value: 2300, color: 'hsl(var(--chart-4))' }
  ],
  state: [
    { name: 'California', value: 2800, color: 'hsl(var(--chart-1))' },
    { name: 'Texas', value: 2100, color: 'hsl(var(--chart-2))' },
    { name: 'Florida', value: 1800, color: 'hsl(var(--chart-3))' },
    { name: 'New York', value: 1500, color: 'hsl(var(--chart-4))' },
    { name: 'Illinois', value: 1100, color: 'hsl(var(--chart-5))' }
  ]
};

// Sample data for the table based on filter
const getTableData = (filter: ChartFilter) => {
  const baseData = chartData[filter].flatMap((item, index) => {
    // Create multiple rows for each pie segment
    return Array.from({ length: Math.ceil(item.value / 100) }, (_, i) => {
      const quantity = Math.min(100, item.value - i * 100);
      return {
        id: `${index}-${i}`,
        srNo: index * 10 + i + 1,
        state: ['California', 'Texas', 'Florida', 'New York', 'Illinois'][Math.floor(Math.random() * 5)],
        commodity: filter === 'commodity' ? item.name : ['Wheat', 'Rice', 'Corn', 'Soybeans', 'Other'][Math.floor(Math.random() * 5)],
        aum: filter === 'aum' ? item.name : ['<$100K', '$100K-$500K', '$500K-$1M', '>$1M'][Math.floor(Math.random() * 4)],
        quantity
      };
    });
  });
  
  return baseData;
};

export default function DistributionChart() {
  const [activeFilter, setActiveFilter] = useState<ChartFilter>('commodity');
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);

  const handleFilterChange = (value: ChartFilter) => {
    setActiveFilter(value);
    setActiveSegment(null);
  };

  const handlePieClick = (data: any) => {
    setActiveSegment(data.name);
  };

  useEffect(() => {
    // Get table data based on the filter
    const allData = getTableData(activeFilter);
    
    // Filter by active segment if needed
    const filteredData = activeSegment 
      ? allData.filter(item => 
          activeFilter === 'commodity' ? item.commodity === activeSegment : 
          activeFilter === 'aum' ? item.aum === activeSegment : 
          item.state === activeSegment
        )
      : allData;
    
    setTableData(filteredData);
  }, [activeFilter, activeSegment]);

  const handleExportCSV = () => {
    // Convert tableData to CSV
    const csvContent = [
      // Header row
      ['Sr. No', 'State', 'Commodity', 'AUM (₹/MT)', 'Quantity'].join(','),
      // Data rows
      ...tableData.map(row => 
        [row.srNo, row.state, row.commodity, row.aum, row.quantity].join(',')
      )
    ].join('\n');

    // Create a blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeFilter}_distribution.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Distribution by {activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}</CardTitle>
        <Select value={activeFilter} onValueChange={(value) => handleFilterChange(value as ChartFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="commodity">Commodity</SelectItem>
            <SelectItem value="aum">AUM</SelectItem>
            <SelectItem value="state">State</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData[activeFilter]}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
                onClick={handlePieClick}
                cursor="pointer"
              >
                {chartData[activeFilter].map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color} 
                    stroke="hsl(var(--background))" 
                    strokeWidth={entry.name === activeSegment ? 3 : 1}
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [`${value} Units`, '']}
                contentStyle={{ 
                  borderRadius: 'var(--radius)', 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">
              {activeSegment 
                ? `${activeSegment} Details` 
                : `All ${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Details`}
            </h3>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="bg-blue-500 hover:bg-blue-700 text-white">
              <Download size={16} className="mr-2" />
              Export CSV
            </Button>
          </div>
          <DataTable 
            columns={columns} 
            data={tableData} 
            stickyHeader={true}
            stickyFirstColumn={true}
            showGridLines={true}
            headClassName="bg-orange-100 text-orange-600 font-bold text-center"
            cellClassName="text-green-800 text-center"
          />
        </div>
      </CardContent>
    </Card>
  );
}