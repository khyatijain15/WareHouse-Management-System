"use client";

import React from "react";
import DashboardLayout from '@/components/dashboard-layout';
import CommoditySummaryTable from '@/components/CommoditySummaryTable';

export default function CommoditySummaryPage() {
  return (
    <DashboardLayout>
      <CommoditySummaryTable showHeader={true} />
    </DashboardLayout>
  );
}
