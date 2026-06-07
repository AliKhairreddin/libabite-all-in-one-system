import {
  ArrowRight,
  CalendarClock,
  ChefHat,
  CircleDollarSign,
  ClipboardCheck,
  Package,
  ShoppingBag,
  Truck
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { seedState } from "../data/seed.js";
import { formatMoney } from "../shared/money.js";

const restaurant = seedState as any;
const LIBABITE_LOGO_URL = "https://inch-digital.com/libabiteimg/logo.webp";
const activeProducts = restaurant.products.filter((product: any) => product.active);
const activeIngredients = restaurant.ingredients.filter((ingredient: any) => ingredient.active);
const orders = restaurant.orders.filter((order: any) => order.status !== "Cancelled");
const openOrders = orders.filter((order: any) => !["Paid", "Served", "Cancelled"].includes(order.status));
const serviceDate = restaurant.reservations[0]?.date || "";
const openReservations = restaurant.reservations.filter((reservation: any) => {
  return reservation.date === serviceDate && reservation.status !== "Cancelled";
});
const pendingReservations = openReservations.filter((reservation: any) => reservation.status === "Pending").length;
const scheduledStaff = restaurant.staffShifts.filter((shift: any) => shift.date === serviceDate).length;
const lowStockIngredients = activeIngredients.filter((ingredient: any) => Number(ingredient.stock) <= Number(ingredient.min));
const activeDrivers = restaurant.drivers.filter((driver: any) => driver.status === "Available").length;

function getTableName(tableId: string) {
  return restaurant.tables.find((table: any) => table.id === tableId)?.name || "Unassigned";
}

function getRevenueTotal() {
  return orders.reduce((sum: number, order: any) => sum + (Number(order.total) || 0), 0);
}

const metrics = [
  {
    label: "Today revenue",
    value: formatMoney(getRevenueTotal()),
    detail: `${openOrders.length} open orders`,
    icon: CircleDollarSign,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200"
  },
  {
    label: "Reservations",
    value: String(openReservations.length),
    detail: `${pendingReservations} pending approval`,
    icon: CalendarClock,
    tone: "bg-cyan-50 text-cyan-700 border-cyan-200"
  },
  {
    label: "Inventory alerts",
    value: String(lowStockIngredients.length),
    detail: `${activeIngredients.length} active ingredients`,
    icon: Package,
    tone: "bg-amber-50 text-amber-700 border-amber-200"
  },
  {
    label: "Service team",
    value: String(scheduledStaff),
    detail: "scheduled today",
    icon: ClipboardCheck,
    tone: "bg-violet-50 text-violet-700 border-violet-200"
  }
];

const serviceQueues = [
  {
    label: "Kitchen delays",
    value: restaurant.tickets.filter((ticket: any) => ticket.status === "Delayed").length,
    icon: ChefHat,
    caption: "open prep tickets need attention"
  },
  {
    label: "Late deliveries",
    value: orders.filter((order: any) => order.fulfillment === "Delivery" && order.status === "Late").length,
    icon: Truck,
    caption: "delivery orders outside target"
  },
  {
    label: "Menu items",
    value: activeProducts.length,
    icon: ShoppingBag,
    caption: "active sellable products"
  }
];

export function App() {
  const reservationRows = openReservations.slice(0, 4);
  const menuRows = activeProducts.slice(0, 6);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <img className="h-12 w-14 object-contain" src={LIBABITE_LOGO_URL} alt="" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">LibaBite</p>
                <h1 className="text-2xl font-semibold tracking-normal">React operations console</h1>
              </div>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              A shadcn-ready React surface wired into the restaurant system's TypeScript data.
            </p>
          </div>
          <Button asChild>
            <a href="#reservations">
              Review service
              <ArrowRight aria-hidden="true" />
            </a>
          </Button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Operational metrics">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <Card key={metric.label} className="gap-4">
                <CardHeader className="flex-row items-center justify-between gap-3">
                  <div>
                    <CardDescription>{metric.label}</CardDescription>
                    <CardTitle className="mt-2 text-2xl">{metric.value}</CardTitle>
                  </div>
                  <span className={`flex size-10 items-center justify-center rounded-md border ${metric.tone}`}>
                    <Icon aria-hidden="true" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{metric.detail}</p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]" aria-label="Service overview">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardDescription>Command center</CardDescription>
                <CardTitle className="mt-2 text-xl">Service pressure</CardTitle>
              </div>
              <Badge variant={openOrders.length > 0 ? "default" : "secondary"}>
                {openOrders.length > 0 ? "Live orders" : "Quiet floor"}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {serviceQueues.map((queue) => {
                const Icon = queue.icon;

                return (
                  <div key={queue.label} className="rounded-md border bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{queue.label}</p>
                      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <p className="mt-4 text-3xl font-semibold">{queue.value}</p>
                    <p className="mt-1 min-h-10 text-sm text-muted-foreground">{queue.caption}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card id="reservations">
            <CardHeader>
              <CardDescription>Tonight</CardDescription>
              <CardTitle className="text-xl">Reservations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reservationRows.length ? (
                reservationRows.map((reservation: any) => (
                  <div key={reservation.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">
                        {reservation.time} - {reservation.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {reservation.guests} guests, {getTableName(reservation.tableId)}
                      </p>
                    </div>
                    <Badge variant={reservation.status === "Pending" ? "outline" : "secondary"}>
                      {reservation.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No reservations are queued for today.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section id="inventory" className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]" aria-label="Inventory and menu">
          <Card>
            <CardHeader>
              <CardDescription>Stock watch</CardDescription>
              <CardTitle className="text-xl">Low inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStockIngredients.slice(0, 5).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.location || "Storage"} stock</p>
                  </div>
                  <Badge variant="outline">
                    {item.stock} {item.unit}
                  </Badge>
                </div>
              ))}
              {!lowStockIngredients.length && (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No low-stock ingredients in the current seed data.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardDescription>Menu intelligence</CardDescription>
                <CardTitle className="text-xl">Active catalog</CardTitle>
              </div>
              <Badge variant="secondary">{activeDrivers} drivers available</Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Station</th>
                      <th className="px-4 py-3 font-medium">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuRows.length ? (
                      menuRows.map((product: any) => (
                        <tr key={product.id} className="border-t">
                          <td className="px-4 py-3 font-medium">{product.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatMoney(Number(product.price) || 0)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{product.station}</td>
                          <td className="px-4 py-3 text-muted-foreground">{product.targetMargin || 0}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-5 text-muted-foreground" colSpan={4}>
                          Active products will appear once the catalog is configured.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
