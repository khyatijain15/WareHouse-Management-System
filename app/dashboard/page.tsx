'use client';

import DashboardLayout from '@/components/dashboard-layout';
import { DashboardCards } from '@/components/dashboard/dashboard-cards';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { SidebarStats } from '@/components/dashboard/sidebar-stats';
import { DistributionChart } from "@/components/dashboard/distribution-chart";
export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="relative min-h-screen overflow-hidden">
        {/* Background image layer */}
        <div
          className="absolute inset-0 bg-center bg-no-repeat bg-fixed"
          style={{
            backgroundImage: 'url("/Group 86.png")',
            backgroundSize: '0%',
            opacity: 0.5, 
            zIndex: 1
          }}
        ></div>

        {/* Main dashboard content */}
        <div className="relative z-10 space-y-4 md:space-y-6 lg:space-y-8">
          <button onClick={() => window.location.reload()}>
            <h1 className="inline-block text-lg md:text-xl font-semibold tracking-tight bg-orange-500 text-white px-2 md:px-3 py-1 rounded-md hover:bg-orange-600 transition-colors">Dashboard</h1>
          </button>

          {/* Pie Charts */}
          <DashboardCharts />

          {/* Info Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-1">
              <SidebarStats />
            </div>
            <div className="lg:col-span-2">
              <DistributionChart />
            </div>
          </div>

          {/* Dashboard Cards */}
          <DashboardCards />
        </div>
      </div>
    </DashboardLayout>
  );
}
