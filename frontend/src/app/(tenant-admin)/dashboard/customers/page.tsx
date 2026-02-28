"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useLeads } from "@/hooks/useLeads";
import { useOrders } from "@/hooks/useOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Customer {
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  lastActivity: any;
  status: "active" | "converted" | "inactive";
}

export default function CustomersPage() {
  const { tenant } = useTenantAuth();
  const tenantId = tenant?.id || null;
  const { leads, loading: leadsLoading } = useLeads(tenantId);
  const { orders, loading: ordersLoading } = useOrders(tenantId);
  const [searchQuery, setSearchQuery] = useState("");

  // Derive customers from leads + orders, grouped by unique email/phone
  const customers = useMemo(() => {
    const map = new Map<string, Customer>();

    // Process leads
    for (const lead of leads) {
      const key = lead.email?.toLowerCase() || lead.phone || lead.id;
      const existing = map.get(key);
      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += lead.estimatedValue || 0;
        if (lead.stage === "won") existing.status = "converted";
        // Keep latest activity
        const leadTime = lead.createdAt?.toMillis ? lead.createdAt.toMillis() : 0;
        const existingTime = existing.lastActivity?.toMillis ? existing.lastActivity.toMillis() : 0;
        if (leadTime > existingTime) existing.lastActivity = lead.createdAt;
      } else {
        map.set(key, {
          name: lead.name,
          email: lead.email || "",
          phone: lead.phone || "",
          totalOrders: 1,
          totalSpent: lead.estimatedValue || 0,
          lastActivity: lead.createdAt,
          status: lead.stage === "won" ? "converted" : lead.stage === "lost" ? "inactive" : "active",
        });
      }
    }

    // Process orders
    for (const order of orders) {
      const email = order.customerEmail || order.clientEmail || "";
      const phone = order.customerPhone || order.clientPhone || "";
      const key = email.toLowerCase() || phone || order.id;
      const existing = map.get(key);
      if (existing) {
        existing.totalSpent += order.totalAmount || order.estimatedAmount || 0;
        const orderTime = order.createdAt?.toMillis ? order.createdAt.toMillis() : 0;
        const existingTime = existing.lastActivity?.toMillis ? existing.lastActivity.toMillis() : 0;
        if (orderTime > existingTime) existing.lastActivity = order.createdAt;
      } else {
        const name = order.customerName || order.clientName || "Unknown";
        map.set(key, {
          name,
          email,
          phone,
          totalOrders: 1,
          totalSpent: order.totalAmount || order.estimatedAmount || 0,
          lastActivity: order.createdAt,
          status: order.status === "approved" ? "converted" : "active",
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.lastActivity?.toMillis ? a.lastActivity.toMillis() : 0;
      const bTime = b.lastActivity?.toMillis ? b.lastActivity.toMillis() : 0;
      return bTime - aTime;
    });
  }, [leads, orders]);

  const searchLower = searchQuery.toLowerCase();
  const filteredCustomers = customers.filter(
    (c) =>
      !searchQuery ||
      c.name.toLowerCase().includes(searchLower) ||
      c.email.toLowerCase().includes(searchLower) ||
      c.phone.includes(searchQuery)
  );

  const formatAmount = (amount: number) => {
    if (!amount) return "₹0";
    return amount >= 100000
      ? `₹${(amount / 100000).toFixed(1)}L`
      : `₹${amount.toLocaleString("en-IN")}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  };

  const loading = leadsLoading || ordersLoading;

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading customers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 text-sm">Customers derived from leads and estimates</p>
        </div>
        <Badge variant="outline" className="text-sm py-1.5">{customers.length} total</Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name, email, or phone..."
          className="pl-10 bg-white border-gray-200"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {filteredCustomers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No customers found</p>
              <p className="text-xs text-gray-400 mt-1">Customers appear when leads or estimates are created</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Name</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Email</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Phone</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Orders</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Total Spent</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Last Activity</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-gray-900">{customer.name}</TableCell>
                    <TableCell className="text-gray-600 text-sm">{customer.email || "-"}</TableCell>
                    <TableCell className="text-gray-600 text-sm">{customer.phone || "-"}</TableCell>
                    <TableCell className="font-medium text-gray-900">{customer.totalOrders}</TableCell>
                    <TableCell className="font-bold text-gray-900">{formatAmount(customer.totalSpent)}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{formatDate(customer.lastActivity)}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          customer.status === "converted"
                            ? "bg-green-100 text-green-700 border-none text-[10px]"
                            : customer.status === "inactive"
                            ? "bg-gray-100 text-gray-500 border-none text-[10px]"
                            : "bg-blue-100 text-blue-700 border-none text-[10px]"
                        }
                      >
                        {customer.status === "converted" ? "Converted" : customer.status === "inactive" ? "Inactive" : "Active"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
