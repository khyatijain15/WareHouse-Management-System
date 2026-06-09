"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X, Eye, EyeOff } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface FilterOption {
  key: string;
  label: string;
  value: string;
  options: string[];
}

interface Column {
  key: string;
  label: string;
}

interface FiltersAndControlsProps {
  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;
  
  // Date filters
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  
  // Filter options
  filterOptions: FilterOption[];
  onFilterChange: (key: string, value: string) => void;
  
  // Loading state
  loading: boolean;
  onApplyFilters: () => void;
  
  // Additional filters toggle
  showFilters: boolean;
  onToggleFilters: () => void;
  
  // Columns visibility
  allColumns: Column[];
  visibleColumns: string[];
  onToggleColumn: (columnKey: string) => void;
  
  // Clear filters
  onClearFilters: () => void;
  
  // Active filters for display
  activeFilters: Array<{
    key: string;
    label: string;
    value: string;
    onRemove: () => void;
  }>;
}

export function FiltersAndControls({
  searchTerm,
  onSearchChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  filterOptions,
  onFilterChange,
  loading,
  onApplyFilters,
  showFilters,
  onToggleFilters,
  allColumns,
  visibleColumns,
  onToggleColumn,
  onClearFilters,
  activeFilters
}: FiltersAndControlsProps) {
  
  const hasActiveFilters = activeFilters.length > 0 || searchTerm;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filters & Controls</CardTitle>
          <div className="flex space-x-2">
            <Button
              onClick={onToggleFilters}
              variant="outline"
              size="sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Columns ({visibleColumns.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 max-h-96 overflow-y-auto">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allColumns.map(column => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={visibleColumns.includes(column.key)}
                    onCheckedChange={() => onToggleColumn(column.key)}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Search and Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="search"
                placeholder="Search all fields..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          
          <div>
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
            />
          </div>
          
          <div>
            <Button 
              onClick={onApplyFilters} 
              className="mt-6 w-full"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Apply Filters'}
            </Button>
          </div>
        </div>

        {/* Additional Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            {filterOptions.map((filter, index) => (
              <div key={filter.key}>
                <Label htmlFor={`${filter.key}-filter`}>{filter.label}</Label>
                <Select value={filter.value} onValueChange={(value) => onFilterChange(filter.key, value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={`All ${filter.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All {filter.label.toLowerCase()}</SelectItem>
                    {filter.options.map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            
            {/* Clear Filters Button - only show if there are 3 or fewer filters */}
            {filterOptions.length <= 3 && (
              <div className="flex items-end">
                <Button 
                  onClick={onClearFilters}
                  variant="outline"
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        )}

        {/* If there are more than 3 filters, show clear button in a separate row */}
        {showFilters && filterOptions.length > 3 && (
          <div className="pt-4 border-t mt-4">
            <Button 
              onClick={onClearFilters}
              variant="outline"
              className="w-full md:w-auto"
            >
              Clear All Filters
            </Button>
          </div>
        )}

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-sm font-medium text-gray-700">Active Filters:</span>
              {searchTerm && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                  Search: "{searchTerm}"
                  <button onClick={() => onSearchChange('')} className="ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {activeFilters.map((filter, index) => (
                <span key={`${filter.key}-${index}`} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                  {filter.label}: {filter.value}
                  <button onClick={filter.onRemove} className="ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}