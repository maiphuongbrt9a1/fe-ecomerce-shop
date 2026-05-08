import OrdersClient from "@/components/admin/orders/OrdersClient";

export default function AdminOrdersPage() {
  return (
    <div className="h-full flex flex-col min-h-0">
      <OrdersClient />
    </div>
  );
}
