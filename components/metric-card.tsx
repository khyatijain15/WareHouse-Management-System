import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  href: string;
  className?: string;
}

export default function MetricCard({ title, value, icon, href, className }: MetricCardProps) {
  return (
    <Link href={href}>
      <Card className={cn("transition-all hover:shadow-md", className)}>
        <CardContent className="p-6 flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className="text-primary/80">{icon}</div>
        </CardContent>
      </Card>
    </Link>
  );
}