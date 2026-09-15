"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Stats = {
  products: number;
  lowStock: number;
  todayIn: number;
  todayOut: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [stats, setStats] = useState<Stats>({
    products: 0,
    lowStock: 0,
    todayIn: 0,
    todayOut: 0,
  });

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      // عدد المنتجات النشطة
      const { count: productsCount, error: productsError } =
        await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true);

      if (productsError) {
        throw productsError;
      }

      // جلب المنتجات والحد الأدنى للمخزون
      const { data: products, error: stockError } = await supabase
        .from("products")
        .select("id, minimum_stock")
        .eq("is_active", true);

      if (stockError) {
        throw stockError;
      }

      const productIds = products?.map((product) => product.id) ?? [];

      let lowStockCount = 0;

      // حساب المنتجات منخفضة المخزون
      if (productIds.length > 0) {
        const { data: batches, error: batchesError } = await supabase
          .from("batches")
          .select("product_id, quantity")
          .in("product_id", productIds);

        if (batchesError) {
          throw batchesError;
        }

        const stockMap: Record<string, number> = {};

        for (const batch of batches ?? []) {
          stockMap[batch.product_id] =
            (stockMap[batch.product_id] ?? 0) +
            Number(batch.quantity);
        }

        lowStockCount =
          products?.filter(
            (product) =>
              (stockMap[product.id] ?? 0) <=
              Number(product.minimum_stock)
          ).length ?? 0;
      }

      // بداية اليوم
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // حركات الإدخال اليوم
      const { data: todayIn, error: inError } = await supabase
        .from("inventory_movements")
        .select("quantity")
        .eq("movement_type", "IN")
        .gte("created_at", startOfDay.toISOString());

      if (inError) {
        throw inError;
      }

      // حركات الإخراج اليوم
      const { data: todayOut, error: outError } = await supabase
        .from("inventory_movements")
        .select("quantity")
        .eq("movement_type", "OUT")
        .gte("created_at", startOfDay.toISOString());

      if (outError) {
        throw outError;
      }

      setStats({
        products: productsCount ?? 0,

        lowStock: lowStockCount,

        todayIn:
          todayIn?.reduce(
            (total, movement) =>
              total + Number(movement.quantity),
            0
          ) ?? 0,

        todayOut:
          todayOut?.reduce(
            (total, movement) =>
              total + Number(movement.quantity),
            0
          ) ?? 0,
      });
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء تحميل بيانات لوحة التحكم.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      setError("حدث خطأ أثناء تسجيل الخروج.");
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-100"
    >
      {/* الهيدر */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6">

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              📦 إدارة مخزون المستودع
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              لوحة التحكم الرئيسية
            </p>
          </div>

          <div className="flex items-center gap-2">

            <div className="hidden rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 sm:block">
              👤 المدير
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
            >
              {loggingOut ? "جاري الخروج..." : "🚪 تسجيل الخروج"}
            </button>

          </div>
        </div>
      </header>

      {/* المحتوى */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

        {/* الترحيب */}
        <section className="mb-6">
          <h2 className="text-xl font-bold text-slate-800">
            مرحبًا بك 👋
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            إليك ملخص حالة المستودع اليوم.
          </p>
        </section>

        {/* رسالة الخطأ */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* الإحصائيات */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">

          {/* المنتجات */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-3xl">
                📦
              </span>

              <span className="text-xs font-semibold text-slate-400">
                المنتجات
              </span>
            </div>

            <p className="text-3xl font-bold text-slate-800">
              {loading ? "..." : stats.products}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              منتج نشط
            </p>
          </div>

          {/* منخفض المخزون */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-3xl">
                ⚠️
              </span>

              <span className="text-xs font-semibold text-slate-400">
                تنبيهات
              </span>
            </div>

            <p className="text-3xl font-bold text-orange-600">
              {loading ? "..." : stats.lowStock}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              منخفض المخزون
            </p>
          </div>

          {/* الإدخال */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-3xl">
                📥
              </span>

              <span className="text-xs font-semibold text-slate-400">
                اليوم
              </span>
            </div>

            <p className="text-3xl font-bold text-green-600">
              {loading ? "..." : stats.todayIn}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              كمية الإدخال
            </p>
          </div>

          {/* الإخراج */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-3xl">
                📤
              </span>

              <span className="text-xs font-semibold text-slate-400">
                اليوم
              </span>
            </div>

            <p className="text-3xl font-bold text-blue-600">
              {loading ? "..." : stats.todayOut}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              كمية الإخراج
            </p>
          </div>

        </section>

        {/* الإجراءات السريعة */}
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-slate-800">
            ⚡ الإجراءات السريعة
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* إضافة منتج */}
            <button
              type="button"
              onClick={() => router.push("/products/new")}
              className="rounded-2xl bg-blue-600 p-5 text-right text-white shadow-sm transition hover:bg-blue-700"
            >
              <div className="text-3xl">
                ➕
              </div>

              <div className="mt-3 font-bold">
                إضافة منتج
              </div>

              <div className="mt-1 text-sm text-blue-100">
                إضافة منتج جديد للمستودع
              </div>
            </button>

            {/* إدخال مخزون */}
            <button
              type="button"
              onClick={() => router.push("/stock-in")}
              className="rounded-2xl bg-white p-5 text-right shadow-sm transition hover:bg-slate-50"
            >
              <div className="text-3xl">
                📥
              </div>

              <div className="mt-3 font-bold text-slate-800">
                إدخال مخزون
              </div>

              <div className="mt-1 text-sm text-slate-500">
                تسجيل الكميات الواردة
              </div>
            </button>

            {/* إخراج مخزون */}
            <button
              type="button"
              onClick={() => router.push("/stock-out")}
              className="rounded-2xl bg-white p-5 text-right shadow-sm transition hover:bg-slate-50"
            >
              <div className="text-3xl">
                📤
              </div>

              <div className="mt-3 font-bold text-slate-800">
                إخراج مخزون
              </div>

              <div className="mt-1 text-sm text-slate-500">
                تسجيل الكميات الخارجة
              </div>
            </button>

            {/* البحث */}
            <button
              type="button"
              onClick={() => router.push("/products")}
              className="rounded-2xl bg-white p-5 text-right shadow-sm transition hover:bg-slate-50"
            >
              <div className="text-3xl">
                🔍
              </div>

              <div className="mt-3 font-bold text-slate-800">
                البحث عن منتج
              </div>

              <div className="mt-1 text-sm text-slate-500">
                البحث في مخزون المستودع
              </div>
            </button>

          </div>
        </section>

        {/* حالة المستودع */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">
            📊 حالة المستودع
          </h2>

          <div className="mt-5 rounded-xl bg-slate-50 p-5">
            {loading ? (
              <p className="text-slate-500">
                جاري تحميل البيانات...
              </p>
            ) : stats.products === 0 ? (
              <div>
                <p className="font-semibold text-slate-700">
                  المستودع فارغ حاليًا
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  ابدأ بإضافة أول منتج إلى المستودع.
                </p>
              </div>
            ) : (
              <p className="text-slate-600">
                يوجد حاليًا{" "}
                <span className="font-bold text-slate-800">
                  {stats.products}
                </span>{" "}
                منتج نشط في المستودع.
              </p>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}