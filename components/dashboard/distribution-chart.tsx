'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useEffect, useState } from "react";
import { useAUM } from "@/lib/firestore";
import { useRouter } from "next/navigation";
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import WarehouseStatusTable from '@/components/WarehouseStatusTable';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];

// Dummy data for testing
const DUMMY_DISTRIBUTION_DATA = [
  { date: "2024-01", Mumbai: 1200, Delhi: 1000, Bangalore: 800, Chennai: 600, Kolkata: 400 },
  { date: "2024-02", Mumbai: 1250, Delhi: 1050, Bangalore: 850, Chennai: 650, Kolkata: 450 },
  { date: "2024-03", Mumbai: 1300, Delhi: 1100, Bangalore: 900, Chennai: 700, Kolkata: 500 },
  { date: "2024-04", Mumbai: 1280, Delhi: 1080, Bangalore: 880, Chennai: 680, Kolkata: 480 },
  { date: "2024-05", Mumbai: 1350, Delhi: 1150, Bangalore: 950, Chennai: 750, Kolkata: 550 },
  { date: "2024-06", Mumbai: 1400, Delhi: 1200, Bangalore: 1000, Chennai: 800, Kolkata: 600 }
];

function useDistributionData() {
  const { data: aumData, loading } = useAUM();

  let distributionData = [];
  if (!aumData || aumData.length === 0) {
    distributionData = DUMMY_DISTRIBUTION_DATA;
  } else {
    // Process location data over time
    const locationData = aumData.reduce((acc, curr) => {
      const date = curr.date.split('T')[0].substring(0, 7); // Get YYYY-MM format
      if (!acc[date]) {
        acc[date] = {};
      }
      acc[date][curr.state] = (acc[date][curr.state] || 0) + (typeof curr.aum === 'string' ? parseFloat(curr.aum) : curr.aum);
      return acc;
    }, {} as Record<string, Record<string, number>>);
    const results = Object.entries(locationData)
      .map(([date, values]) => ({
        date: String(date),
        ...values
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-6); // Get last 6 months
    distributionData = results.length > 0 ? results : DUMMY_DISTRIBUTION_DATA;
  }

  return { distributionData, loading };
}

export function DistributionChart() {
  const router = useRouter();
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchInspections = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'inspections'));
        const inspections = snap.docs.map(doc => doc.data());
        // Group by month and status
        const monthStatusCount: Record<string, Record<string, number>> = {};
        inspections.forEach(entry => {
          // Use createdAt or status change date
          let dateStr = entry.createdAt || entry.submittedAt || entry.activatedAt || entry.closedAt || entry.lastUpdated;
          let status = (entry.status && entry.status.trim().toLowerCase()) || 'pending';
          if (!dateStr) return;
          let date = new Date(dateStr);
          if (isNaN(date.getTime())) return;
          const month = date.toISOString().slice(0, 7); // YYYY-MM
          if (!monthStatusCount[month]) monthStatusCount[month] = {
            Active: 0,
            Pending: 0,
            Closed: 0,
            Rejected: 0
          };
          
          // Categorize status based on formulas:
          // Active count = Activate + Reactivate
          if (["active", "activated", "activate", "reactivate", "reactivated"].includes(status)) {
            monthStatusCount[month]['Active']++;
          } 
          // Pending count = Pending + Submitted + Resubmit
          else if (["pending", "submitted", "submit", "resubmit", "resubmitted"].includes(status)) {
            monthStatusCount[month]['Pending']++;
          } 
          // Closed count = Closed
          else if (["closed"].includes(status)) {
            monthStatusCount[month]['Closed']++;
          } 
          // Reject count = Reject
          else if (["reject", "rejected"].includes(status)) {
            monthStatusCount[month]['Rejected']++;
          }
        });
        // Build chart data
        const allStatuses = ["Active", "Pending", "Closed", "Rejected"];
        const months = Object.keys(monthStatusCount).sort();
        const chartData = months.map(month => {
          const row: any = { date: format(new Date(month + '-01'), 'MMMM') };
          allStatuses.forEach(status => {
            row[status] = monthStatusCount[month][status] || 0;
          });
          return row;
        });
        setDistributionData(chartData.slice(-6)); // Last 6 months
      } catch {
        setDistributionData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchInspections();
  }, []);

  const statuses = ["Active", "Pending", "Closed", "Rejected"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer">
          <CardHeader>
            <CardTitle className="inline-block w-fit border-b-2 border-green-500 pb-2">Warehouse Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={distributionData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {statuses.map((status, index) => (
                  <Line
                    key={status}
                    type="monotone"
                    dataKey={status}
                    stroke={status === 'Rejected' ? '#EF4444' : COLORS[index % COLORS.length]}
                    activeDot={{ r: 8 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-6xl w-full max-h-[80vh] overflow-y-auto">
        <WarehouseStatusTable showHeader={true} />
      </DialogContent>
    </Dialog>
  );
}