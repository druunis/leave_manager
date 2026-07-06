import { useState } from "react";
import { format } from "date-fns";
import { useAdminGetReport, getAdminGetReportQueryKey, useAdminGetUnpaidDeductions, getAdminGetUnpaidDeductionsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Ban } from "lucide-react";

type TypeFilter = "" | "annual" | "sick";
type StatusFilter = "" | "pending" | "approved" | "rejected" | "cancelled";

export default function AdminReportsPage() {
  const currentYear = new Date().getFullYear();
  const [leaveYear, setLeaveYear] = useState(currentYear);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [type, setType] = useState<TypeFilter>("");
  const [status, setStatus] = useState<StatusFilter>("");

  const reportParams = {
    leaveYear,
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
    ...(type ? { type: type as "annual" | "sick" } : {}),
    ...(status ? { status: status as "pending" | "approved" | "rejected" | "cancelled" } : {}),
  };

  const { data: reports, isLoading: reportsLoading } = useAdminGetReport(
    reportParams,
    { query: { queryKey: getAdminGetReportQueryKey(reportParams) } }
  );

  const { data: unpaid, isLoading: unpaidLoading } = useAdminGetUnpaidDeductions(
    { leaveYear },
    { query: { queryKey: getAdminGetUnpaidDeductionsQueryKey({ leaveYear }) } }
  );

  const hasActiveFilters = Boolean(start || end || type || status);
  const clearFilters = () => {
    setStart("");
    setEnd("");
    setType("");
    setStatus("");
  };

  const downloadCsv = () => {
    if (!reports) return;
    const headers = [
      "User",
      "Year",
      "Start Date",
      "Annual Entitlement",
      "Total Accrued",
      "Annual Used (Paid)",
      "Unpaid Used",
      "Sick Used",
      "Sick Remaining",
      "Pending",
      "Approved",
      "Rejected",
    ];
    const rows = reports.map(r => [
      r.userName,
      r.leaveYear,
      format(new Date(r.startDate), "yyyy-MM-dd"),
      r.annualEntitlement,
      r.accrued,
      r.usedPaid,
      r.usedUnpaid,
      r.sickUsed,
      r.sickRemaining,
      r.pendingCount,
      r.approvedCount,
      r.rejectedCount,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(v => `"${v}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const suffix = hasActiveFilters ? "-filtered" : "";
    link.setAttribute("href", url);
    link.setAttribute("download", `leave-report-${leaveYear}${suffix}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectClass = "flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Payroll</h1>
          <p className="text-muted-foreground mt-1">Review leave usage and unpaid deductions.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={leaveYear}
            onChange={(e) => setLeaveYear(parseInt(e.target.value))}
            className={selectClass}
            aria-label="Leave year"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button onClick={downloadCsv} disabled={!reports || reports.length === 0} variant="outline">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-sm mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="filter-start">From date</label>
              <input
                id="filter-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={selectClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="filter-end">To date</label>
              <input
                id="filter-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={selectClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="filter-type">Leave type</label>
              <select
                id="filter-type"
                value={type}
                onChange={(e) => setType(e.target.value as TypeFilter)}
                className={selectClass}
              >
                <option value="">All types</option>
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="filter-status">Status</label>
              <select
                id="filter-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                className={selectClass}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <Button
              variant="ghost"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Clear filters
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Balances reflect the selected leave year. Date range, type, and status filter the request counts below.
          </p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 border-border shadow-sm">
          <CardHeader>
            <CardTitle>Yearly Leave Summary</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {reportsLoading ? (
              <div className="space-y-4"><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/></div>
            ) : reports?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data for this year.</p>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-muted-foreground bg-muted/50 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 font-semibold rounded-tl-lg">User</th>
                    <th className="px-4 py-3 font-semibold">Accrued</th>
                    <th className="px-4 py-3 font-semibold">Annual Used</th>
                    <th className="px-4 py-3 font-semibold">Sick Used</th>
                    <th className="px-4 py-3 font-semibold text-destructive">Unpaid</th>
                    <th className="px-4 py-3 font-semibold rounded-tr-lg">Requests (P/A/R)</th>
                  </tr>
                </thead>
                <tbody>
                  {reports?.map(r => (
                    <tr key={r.userId} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.userName}</td>
                      <td className="px-4 py-3">{r.accrued} / {r.annualEntitlement}</td>
                      <td className="px-4 py-3">{r.usedPaid}</td>
                      <td className="px-4 py-3">{r.sickUsed}</td>
                      <td className={`px-4 py-3 font-bold ${r.usedUnpaid > 0 ? "text-destructive" : ""}`}>{r.usedUnpaid}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.pendingCount} / {r.approvedCount} / {r.rejectedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <Ban className="w-5 h-5 mr-2" /> Payroll Deductions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unpaidLoading ? (
              <div className="space-y-4"><Skeleton className="h-12 w-full"/></div>
            ) : unpaid?.length === 0 ? (
              <p className="text-muted-foreground text-sm">No unpaid leave recorded for {leaveYear}.</p>
            ) : (
              <div className="space-y-3">
                {unpaid?.map(u => (
                  <div key={u.requestId} className="bg-background rounded-lg p-3 border border-destructive/20 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{u.userName}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(u.startDate), "MMM d")} - {format(new Date(u.endDate), "MMM d")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-destructive">{u.unpaidDays}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">days</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
