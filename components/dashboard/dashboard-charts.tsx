'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useAUM, useCommodities } from '@/lib/firestore';
import CommoditySummaryTable from '@/components/CommoditySummaryTable';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import AUMSummaryTable from '@/components/AUMSummaryTable';

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];

// Dummy data for testing
const DUMMY_AUM_DATA = [
  { name: "Maharashtra", value: 500 },
  { name: "Gujarat", value: 400 },
  { name: "Punjab", value: 300 },
  { name: "Haryana", value: 200 },
  { name: "Karnataka", value: 150 },
  { name: "Tamil Nadu", value: 100 }
];

function useCommodityPieData() {
  const [data, setData] = useState<{ name: string; value: number; varieties: string[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInward = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'inward'));
        const inward = snap.docs.map(doc => doc.data());
        // Group by commodity, sum quantity, collect unique varieties
        const map = new Map();
        inward.forEach(entry => {
          const commodity = entry.commodity || '';
          const variety = entry.varietyName || '';
          const quantity = parseFloat(entry.totalQuantity || 0);
          if (!map.has(commodity)) {
            map.set(commodity, { name: commodity, value: 0, varieties: new Set() });
          }
          const obj = map.get(commodity);
          obj.value += quantity;
          if (variety) obj.varieties.add(variety);
        });
        const arr = Array.from(map.values()).map(obj => ({ ...obj, varieties: Array.from(obj.varieties) }));
        arr.sort((a, b) => b.value - a.value);
        setData(arr.slice(0, 6));
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchInward();
  }, []);

  return { data, loading };
}

function useAUMPieData() {
  const [data, setData] = useState<{ name: string; value: number; commodities: string[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInward = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'inward'));
        const inward = snap.docs.map(doc => doc.data());
        // Group by state, sum AUM, collect unique commodities
        const map = new Map();
        inward.forEach(entry => {
          const state = entry.state || '';
          const commodity = entry.commodity || '';
          const aum = parseFloat(entry.totalValue || 0);
          if (!map.has(state)) {
            map.set(state, { name: state, value: 0, commodities: new Set() });
          }
          const obj = map.get(state);
          obj.value += aum;
          if (commodity) obj.commodities.add(commodity);
        });
        const arr = Array.from(map.values()).map(obj => ({ ...obj, commodities: Array.from(obj.commodities) }));
        arr.sort((a, b) => b.value - a.value);
        setData(arr.slice(0, 6));
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchInward();
  }, []);

  return { data, loading };
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const { name, value, varieties } = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-md p-2 shadow text-xs">
        <div><span className="font-semibold">{name}</span></div>
        <div>Quantity: <span className="font-semibold">{value} (MT)</span></div>
        {varieties && varieties.length > 0 && (
          <div>Varieties: <span className="text-green-700">{varieties.join(", ")}</span></div>
        )}
      </div>
    );
  }
  return null;
}

function CustomAUMTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const { name, value, commodities } = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-md p-2 shadow text-xs">
        <div><span className="font-semibold">{name}</span></div>
        <div>AUM: <span className="font-semibold">{value} (₹/MT)</span></div>
        {commodities && commodities.length > 0 && (
          <div>Commodities: <span className="text-green-700">{commodities.join(", ")}</span></div>
        )}
      </div>
    );
  }
  return null;
}

function PieChartCard({ title, data, showVarietiesTooltip = false }: { title: string; data: any[]; showVarietiesTooltip?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base inline-block w-fit border-b-2 border-green-500 pb-1 md:pb-2">{title}</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {data.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                {showVarietiesTooltip ? <Tooltip content={<CustomTooltip />} /> : <Tooltip />}
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-6xl w-full max-h-[80vh] overflow-y-auto mx-2 md:mx-0">
        <CommoditySummaryTable showHeader={true} />
      </DialogContent>
    </Dialog>
  );
}

export function DashboardCharts() {
  const { data: commodityData, loading: commodityLoading } = useCommodityPieData();
  const { data: aumData, loading: aumLoading } = useAUMPieData();
  const [openAUM, setOpenAUM] = useState(false);

  if (commodityLoading || aumLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base">Loading...</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] md:h-[300px] flex items-center justify-center">
            <div className="w-6 h-6 md:w-8 md:h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base">Loading...</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] md:h-[300px] flex items-center justify-center">
            <div className="w-6 h-6 md:w-8 md:h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      <PieChartCard
        title="Commodity in Quantity"
        data={commodityData}
        showVarietiesTooltip={true}
      />
      <Dialog open={openAUM} onOpenChange={setOpenAUM}>
        <DialogTrigger asChild>
          <Card className="cursor-pointer bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-base inline-block w-fit border-b-2 border-green-500 pb-1 md:pb-2">AUM Statewise</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={aumData}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {aumData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomAUMTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent className="max-w-6xl w-full max-h-[80vh] overflow-y-auto mx-2 md:mx-0">
          <AUMSummaryTable showHeader={true} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
