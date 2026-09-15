"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type DashboardStats = {
  products: number;
  totalStock: number;
  lowStock: number;
  emptyStock: number;
  todayIn: number;
  todayOut: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [stats, setStats] = useState<DashboardStats>({
    products: 0,
    totalStock: 0,
    lowStock: 0,
    emptyStock: 0,
    todayIn: 0,
    todayOut: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      // ================================
      // المنتجات النشطة
      // ================================
      const { data: products, error: productsError } =
        await supabase
          .from("products")
          .select("id, minimum_stock")
          .eq("is_active", true);

      if (productsError) {
        throw productsError;
      }

      // ================================
      // المخزون الحالي
      // ================================
      const { data: batches, error: batchesError } =
        await supabase
          .from("batches")
          .select("product_id, quantity");

      if (batchesError) {
        throw batchesError;
      }

      const stockByProduct: Record<string, number> = {};

      for (const batch of batches || []) {
        const quantity = Number(batch.quantity || 0);

        stockByProduct[batch.product_id] =
          (stockByProduct[batch.product_id] || 0) +
          quantity;
      }

      let totalStock = 0;
      let lowStock = 0;
      let emptyStock = 0;

      for (const product of products || []) {
        const stock =
          stockByProduct[product.id] || 0;

        const minimumStock = Number(
          product.minimum_stock || 0
        );

        totalStock += stock;

        if (stock <= 0) {
          emptyStock++;
        } else if (stock <= minimumStock) {
          lowStock++;
        }
      }

      // ================================
      // حركات اليوم
      // ================================
      const now = new Date();

      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      const startOfTomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      );

      const { data: todayMovements, error: movementsError } =
        await supabase
          .from("inventory_movements")
          .select("movement_type, quantity, created_at")
          .gte(
            "created_at",
            startOfToday.toISOString()
          )
          .lt(
            "created_at",
            startOfTomorrow.toISOString()
          );

      if (movementsError) {
        throw movementsError;
      }

      let todayIn = 0;
      let todayOut = 0;

      for (const movement of todayMovements || []) {
        const quantity = Number(
          movement.quantity || 0
        );

        if (movement.movement_type === "IN") {
          todayIn += quantity;
        }

        if (movement.movement_type === "OUT") {
          todayOut += quantity;
        }
      }

      setStats({
        products: products?.length || 0,
        totalStock,
        lowStock,
        emptyStock,
        todayIn,
        todayOut,
      });
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل لوحة التحكم."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  function formatNumber(value: number) {
    return new Intl.NumberFormat("ar-JO", {
      maximumFractionDigits: 3,
    }).format(value);
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">

        {/* ================================
            Header
        ================================= */}
        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
                📦 إدارة المستودع
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                لوحة التحكم الرئيسية لإدارة المخزون
              </p>
            </div>

            <button
              onClick={loadDashboard}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              🔄 تحديث البيانات
            </button>
          </div>
        </header>

        {/* ================================
            Error
        ================================= */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-bold text-red-700">
            ❌ {error}
          </div>
        )}

        {/* ================================
            Statistics
        ================================= */}
        <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-6">

          {/* Products */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-3xl">
              📦
            </div>

            <p className="mt-3 text-sm text-slate-500">
              المنتجات
            </p>

            <p className="mt-1 text-2xl font-black text-slate-900">
              {loading
                ? "..."
                : formatNumber(stats.products)}
            </p>
          </div>

          {/* Total stock */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-3xl">
              📊
            </div>

            <p className="mt-3 text-sm text-slate-500">
              إجمالي المخزون
            </p>

            <p className="mt-1 text-2xl font-black text-slate-900">
              {loading
                ? "..."
                : formatNumber(stats.totalStock)}
            </p>
          </div>

          {/* Low stock */}
          <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
            <div className="text-3xl">
              ⚠️
            </div>

            <p className="mt-3 text-sm text-yellow-700">
              مخزون منخفض
            </p>

            <p className="mt-1 text-2xl font-black text-yellow-700">
              {loading
                ? "..."
                : formatNumber(stats.lowStock)}
            </p>
          </div>

          {/* Empty */}
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="text-3xl">
              🚨
            </div>

            <p className="mt-3 text-sm text-red-700">
              نفد المخزون
            </p>

            <p className="mt-1 text-2xl font-black text-red-700">
              {loading
                ? "..."
                : formatNumber(stats.emptyStock)}
            </p>
          </div>

          {/* Today IN */}
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="text-3xl">
              📥
            </div>

            <p className="mt-3 text-sm text-emerald-700">
              إدخال اليوم
            </p>

            <p className="mt-1 text-2xl font-black text-emerald-700">
              {loading
                ? "..."
                : formatNumber(stats.todayIn)}
            </p>
          </div>

          {/* Today OUT */}
          <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <div className="text-3xl">
              📤
            </div>

            <p className="mt-3 text-sm text-orange-700">
              إخراج اليوم
            </p>

            <p className="mt-1 text-2xl font-black text-orange-700">
              {loading
                ? "..."
                : formatNumber(stats.todayOut)}
            </p>
          </div>
        </section>

        {/* ================================
            Quick Actions
        ================================= */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-black text-slate-900">
              ⚡ الإجراءات السريعة
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              الوصول السريع إلى أهم وظائف المستودع
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* Products */}
            <button
              onClick={() =>
                router.push("/products")
              }
              className="group rounded-3xl border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                📦
              </div>

              <h3 className="mt-4 font-black text-slate-900">
                المنتجات
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                عرض وإدارة جميع المنتجات
              </p>
            </button>

            {/* Stock IN */}
            <button
              onClick={() =>
                router.push("/stock-in")
              }
              className="group rounded-3xl border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                📥
              </div>

              <h3 className="mt-4 font-black text-slate-900">
                إدخال مخزون
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                إضافة كمية جديدة للمستودع
              </p>
            </button>

            {/* Stock OUT */}
            <button
              onClick={() =>
                router.push("/stock-out")
              }
              className="group rounded-3xl border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-2xl">
                📤
              </div>

              <h3 className="mt-4 font-black text-slate-900">
                إخراج مخزون
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                تسجيل إخراج كمية من المستودع
              </p>
            </button>

            {/* Movements */}
            <button
              onClick={() =>
                router.push("/movements")
              }
              className="group rounded-3xl border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:-translate-y-1 hover:border-purple-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-2xl">
                📋
              </div>

              <h3 className="mt-4 font-black text-slate-900">
                سجل الحركات
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                متابعة الإدخال والإخراج والتعديلات
              </p>
            </button>

          </div>
        </section>

        {/* ================================
            Add Product + Alerts
        ================================= */}
        <section className="grid gap-4 lg:grid-cols-2">

          {/* Add product */}
          <button
            onClick={() =>
              router.push("/products/new")
            }
            className="rounded-3xl border border-dashed border-blue-300 bg-blue-50 p-6 text-right transition hover:bg-blue-100"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
                ➕
              </div>

              <div>
                <h2 className="font-black text-blue-900">
                  إضافة منتج جديد
                </h2>

                <p className="mt-1 text-sm text-blue-700">
                  إضافة منتج مع الوحدة والكمية والصلاحية والصورة والباركود
                </p>
              </div>
            </div>
          </button>

          {/* Alerts */}
          <button
            onClick={() =>
              router.push("/products")
            }
            className="rounded-3xl border border-red-200 bg-red-50 p-6 text-right transition hover:bg-red-100"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
                🚨
              </div>

              <div>
                <h2 className="font-black text-red-900">
                  تنبيهات المستودع
                </h2>

                <p className="mt-1 text-sm text-red-700">
                  المنتجات الناقصة والمنخفضة والمنتهية الصلاحية
                </p>
              </div>
            </div>
          </button>

        </section>

        {/* ================================
            Future Features
        ================================= */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">
            🚀 التطويرات القادمة
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-bold text-slate-700">
                📊 تقارير المخزون
              </p>

              <p className="mt-1 text-xs text-slate-500">
                تقارير يومية وشهرية
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-bold text-slate-700">
                👥 المستخدمون والصلاحيات
              </p>

              <p className="mt-1 text-xs text-slate-500">
                إدارة المستخدمين والأدوار
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-bold text-slate-700">
                🏷️ إدارة التصنيفات
              </p>

              <p className="mt-1 text-xs text-slate-500">
                تنظيم المنتجات حسب الأقسام
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-bold text-slate-700">
                📱 تطبيق مخصص للهاتف
              </p>

              <p className="mt-1 text-xs text-slate-500">
                تحسين تجربة الاستخدام على الهواتف
              </p>
            </div>

          </div>
        </section>

      </div>
    </main>
  );
}