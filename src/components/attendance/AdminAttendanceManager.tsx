import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Calendar, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { SkeletonTable } from "@/components/ui/skeleton-table";

interface AttendanceRecord {
  id: string;
  user_id: string;
  type: 'check_in' | 'check_out';
  timestamp: string;
  location: string | null;
  notes: string | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

const AdminAttendanceManager = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'day' | 'month' | 'year'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [searchUser, setSearchUser] = useState("");

  useEffect(() => {
    loadAttendanceRecords();
  }, [filterType, selectedDate, selectedMonth, selectedYear, searchUser]);

  const getDateRange = () => {
    switch (filterType) {
      case 'day':
        const dayStart = startOfDay(new Date(selectedDate));
        const dayEnd = endOfDay(new Date(selectedDate));
        return {
          start: dayStart.toISOString(),
          end: dayEnd.toISOString(),
        };
      case 'month':
        const monthStart = startOfMonth(new Date(`${selectedMonth}-01`));
        const monthEnd = endOfMonth(new Date(`${selectedMonth}-01`));
        return {
          start: monthStart.toISOString(),
          end: monthEnd.toISOString(),
        };
      case 'year':
        const yearStart = new Date(`${selectedYear}-01-01`).toISOString();
        const yearEnd = new Date(`${selectedYear}-12-31T23:59:59`).toISOString();
        return {
          start: yearStart,
          end: yearEnd,
        };
      default:
        return { start: '', end: '' };
    }
  };

  const loadAttendanceRecords = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      let query = supabase
        .from('attendance')
        .select(`
          id,
          user_id,
          type,
          timestamp,
          location,
          notes,
          profiles:user_id (
            first_name,
            last_name,
            email
          )
        `)
        .gte('timestamp', start)
        .lte('timestamp', end)
        .order('timestamp', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];
      if (searchUser) {
        filteredData = filteredData.filter(record => {
          const name = `${record.profiles?.first_name || ''} ${record.profiles?.last_name || ''}`.toLowerCase();
          const email = record.profiles?.email?.toLowerCase() || '';
          return name.includes(searchUser.toLowerCase()) || email.includes(searchUser.toLowerCase());
        });
      }

      setRecords(filteredData as AttendanceRecord[]);
    } catch (error) {
      console.error('Error loading attendance records:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (records.length === 0) {
      alert("No records to export");
      return;
    }

    // Prepare CSV data
    const headers = ['Employee Name', 'Email', 'Type', 'Date', 'Time', 'Location'];
    const csvContent = [
      headers.join(','),
      ...records.map(record => {
        const timestamp = new Date(record.timestamp);
        return [
          `"${record.profiles?.first_name || ''} ${record.profiles?.last_name || ''}"`,
          `"${record.profiles?.email || ''}"`,
          record.type.replace('_', ' ').toUpperCase(),
          format(timestamp, 'yyyy-MM-dd'),
          format(timestamp, 'HH:mm:ss'),
          `"${record.location || 'N/A'}"`,
        ].join(',');
      })
    ].join('\n');

    // Create and download file
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`);
    element.setAttribute('download', `attendance_${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filter Attendance Records
          </CardTitle>
          <CardDescription>Filter by date range and search employees</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Filter Type Selection */}
            <div>
              <Label htmlFor="filter-type">Filter By</Label>
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger id="filter-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date/Month/Year Selection */}
            <div>
              <Label htmlFor="date-select">
                {filterType === 'day' && 'Select Date'}
                {filterType === 'month' && 'Select Month'}
                {filterType === 'year' && 'Select Year'}
              </Label>
              {filterType === 'day' && (
                <Input
                  id="date-select"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              )}
              {filterType === 'month' && (
                <Input
                  id="date-select"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              )}
              {filterType === 'year' && (
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="date-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Search User */}
          <div>
            <Label htmlFor="search-user">Search Employee</Label>
            <Input
              id="search-user"
              placeholder="Search by name or email..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
            />
          </div>

          {/* Export Button */}
          <div className="flex justify-end">
            <Button onClick={exportToExcel} disabled={records.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export to CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Records Found: {records.length}</CardTitle>
        </CardHeader>
      </Card>

      {/* Attendance Table */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Attendance Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable rows={10} columns={6} />
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No attendance records found for the selected period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.profiles?.first_name} {record.profiles?.last_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.profiles?.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={record.type === 'check_in' ? 'default' : 'outline'}
                          className="capitalize"
                        >
                          {record.type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(record.timestamp), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(new Date(record.timestamp), 'HH:mm:ss')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.location || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAttendanceManager;
