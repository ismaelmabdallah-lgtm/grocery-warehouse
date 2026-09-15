"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type MovementType = "IN" | "OUT" | "ADJUSTMENT";

type Movement = {
  id: string;
  product_id: string;
  batch_id: string | null;
  movement_type: MovementType;
  quantity: number;
  unit_id: string | null;
  notes: string | null;
  created_at: string;
  products:
    | {
        id: string;
        name: string;
        barcode: string | null;
      }
    | {
        id: string;
        name: string;
        barcode: string | null;
      }[]
    | null;
  units:
    | {
        id: string;
        name: string;
        symbol: string | null;
      }
    | {
        id: string;
        name: string;
        symbol: string | null;
      }[]
    | null;
};

function getProduct(productData: Movement["products"]) {
  if (!productData) return null;

  if (Array.isArray(productData)) {
    return productData[0] ?? null;
  }

  return productData;
}

function getUnit(unitData: Movement["units"]) {
  if (!unitData) return null;

  if (Array.isArray(unitData)) {
    return unitData[0] ?? null;
  }

  return unitData;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-JO", {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ar-JO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function getMovementInfo(type: MovementType) {
  if (type === "IN") {
    return {
      label: "إدخال",
      icon: "📥",
      badge: "bg-emerald-100 text-emerald-700",
      text: "text-emerald-600",
      sign: "+",
    };
  }

  if (type === "OUT") {
    return {
      label: "إخراج",
      icon: "📤",
      badge: "bg-orange-100 text-orange-700",
      text: "text-orange-600",
      sign: "-",
    };
  }

  return {
    label: "تعديل",
    icon: "🔧",
    badge: "bg-purple-100 text-purple-700",
    text: "text-purple-600",
    sign: "",
  };
}

export default function MovementsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [typeFilter, setTypeFilter] = useState<
    "all" | MovementType
  >("all");

  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "yesterday" | "week"
  >("all");

  async function loadMovements(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const { data, error } = await supabase
        .from("inventory_movements")
        .select(
          `
            id,
            product_id,
            batch_id,
            movement_type,
            quantity,
            unit_id,
            notes,
            created_at,
            products (
              id,
              name,
              barcode
            ),
            units (
              id,
              name,
              symbol
            )
          `,
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(500);

      if (error) {
        throw error;
      }

      const normalized = ((data || []) as any[]).map((item) => ({
        ...item,
        quantity: Number(item.quantity || 0),
      })) as Movement[];

      setMovements(normalized);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message || "تعذر تحميل سجل الحركات.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadMovements();
  }, []);

  const filteredMovements = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const startOfYesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    );

    const startOfWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
    );

    return movements.filter((movement) => {
      const product = getProduct(movement.products);

      const productName = (
        product?.name || ""
      ).toLowerCase();

      const barcode = (
        product?.barcode || ""
      ).toLowerCase();

      const notes = (
        movement.notes || ""
      ).toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        productName.includes(normalizedSearch) ||
        barcode.includes(normalizedSearch) ||
        notes.includes(normalizedSearch);

      const matchesType =
        typeFilter === "all" ||
        movement.movement_type === typeFilter;

      const movementDate = new Date(
        movement.created_at,
      );

      let matchesDate = true;

      if (dateFilter === "today") {
        matchesDate = movementDate >= startOfToday;
      }

      if (dateFilter === "yesterday") {
        matchesDate =
          movementDate >= startOfYesterday &&
          movementDate < startOfToday;
      }

      if (dateFilter === "week") {
        matchesDate = movementDate >= startOfWeek;
      }

      return (
        matchesSearch &&
        matchesType &&
        matchesDate
      );
    });
  }, [
    movements,
    search,
    typeFilter,
    dateFilter,
  ]);

  const statistics = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalAdjustments = 0;

    for (const movement of filteredMovements) {
      if (movement.movement_type === "IN") {
        totalIn += movement.quantity;
      }

      if (movement.movement_type === "OUT") {
        totalOut += movement.quantity;
      }

      if (
        movement.movement_type ===
        "ADJUSTMENT"
      ) {
        totalAdjustments += movement.quantity;
      }
    }

    return {
      total: filteredMovements.length,
      totalIn,
      totalOut,
      totalAdjustments,
    };
  }, [filteredMovements]);

  function resetFilters() {
    setSearch("");
    setTypeFilter("all");
    setDateFilter("all");
  }

  function setQuickType(
    type: "all" | MovementType,
  ) {
    setTypeFilter(type);
  }

  function setQuickDate(
    date: "all" | "today" | "yesterday" | "week",
  ) {
    setDateFilter(date);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 px-4 py-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">⏳</div>

            <p className="mt-4 font-semibold text-slate-600">
              جارٍ تحميل سجل الحركات...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              onClick={() => router.push("/")}
              className="mb-2 text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← لوحة التحكم
            </button>

            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
              📋 سجل الحركات
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              جميع عمليات الإدخال والإخراج والتعديل.
            </p>
          </div>

          <button
            onClick={() => loadMovements(true)}
            disabled={refreshing}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {refreshing
              ? "⏳ تحديث..."
              : "🔄 تحديث"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            ❌ {error}
          </div>
        )}

        {/* Statistics */}
        <section className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <p className="text-xs text-slate-500">
              العمليات
            </p>

            <p className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
              {formatNumber(statistics.total)}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm sm:p-4">
            <p className="text-xs text-emerald-700">
              الإدخال
            </p>

            <p className="mt-1 text-xl font-black text-emerald-700 sm:text-2xl">
              +{formatNumber(statistics.totalIn)}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 shadow-sm sm:p-4">
            <p className="text-xs text-orange-700">
              الإخراج
            </p>

            <p className="mt-1 text-xl font-black text-orange-700 sm:text-2xl">
              -{formatNumber(statistics.totalOut)}
            </p>
          </div>

          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-3 shadow-sm sm:p-4">
            <p className="text-xs text-purple-700">
              التعديلات
            </p>

            <p className="mt-1 text-xl font-black text-purple-700 sm:text-2xl">
              {formatNumber(
                statistics.totalAdjustments,
              )}
            </p>
          </div>
        </section>

        {/* Search + Filters */}
        <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">

          {/* Search */}
          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="🔎 اسم المنتج أو الباركود..."
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />

            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick type filters */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            <button
              onClick={() => setQuickType("all")}
              className={`rounded-xl px-2 py-3 text-xs font-bold transition sm:text-sm ${
                typeFilter === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              الكل
            </button>

            <button
              onClick={() => setQuickType("IN")}
              className={`rounded-xl px-2 py-3 text-xs font-bold transition sm:text-sm ${
                typeFilter === "IN"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              📥 إدخال
            </button>

            <button
              onClick={() => setQuickType("OUT")}
              className={`rounded-xl px-2 py-3 text-xs font-bold transition sm:text-sm ${
                typeFilter === "OUT"
                  ? "bg-orange-600 text-white"
                  : "bg-orange-50 text-orange-700 hover:bg-orange-100"
              }`}
            >
              📤 إخراج
            </button>

            <button
              onClick={() =>
                setQuickType("ADJUSTMENT")
              }
              className={`rounded-xl px-2 py-3 text-xs font-bold transition sm:text-sm ${
                typeFilter === "ADJUSTMENT"
                  ? "bg-purple-600 text-white"
                  : "bg-purple-50 text-purple-700 hover:bg-purple-100"
              }`}
            >
              🔧 تعديل
            </button>
          </div>

          {/* Date filters */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            <button
              onClick={() => setQuickDate("all")}
              className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${
                dateFilter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              كل الفترة
            </button>

            <button
              onClick={() => setQuickDate("today")}
              className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${
                dateFilter === "today"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              اليوم
            </button>

            <button
              onClick={() =>
                setQuickDate("yesterday")
              }
              className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${
                dateFilter === "yesterday"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              أمس
            </button>

            <button
              onClick={() => setQuickDate("week")}
              className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${
                dateFilter === "week"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              7 أيام
            </button>
          </div>

          {/* Reset */}
          {(search ||
            typeFilter !== "all" ||
            dateFilter !== "all") && (
            <button
              onClick={resetFilters}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              ✕ إعادة ضبط الفلاتر
            </button>
          )}
        </section>

        {/* Result count */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            عرض{" "}
            <strong className="text-slate-900">
              {formatNumber(
                filteredMovements.length,
              )}
            </strong>{" "}
            عملية
          </p>

          <p className="text-xs text-slate-400">
            الأحدث أولًا
          </p>
        </div>

        {/* Empty */}
        {filteredMovements.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="text-6xl">📋</div>

            <h2 className="mt-4 text-xl font-black text-slate-900">
              لا توجد حركات
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              لا توجد عمليات مطابقة للفلاتر الحالية.
            </p>

            {(search ||
              typeFilter !== "all" ||
              dateFilter !== "all") && (
              <button
                onClick={resetFilters}
                className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
              >
                عرض كل الحركات
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-right text-sm text-slate-500">
                      <th className="px-5 py-4 font-semibold">
                        المنتج
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        الحركة
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        الكمية
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        الدفعة
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        الملاحظات
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        التاريخ
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        المنتج
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMovements.map(
                      (movement) => {
                        const product =
                          getProduct(
                            movement.products,
                          );

                        const unit =
                          getUnit(
                            movement.units,
                          );

                        const info =
                          getMovementInfo(
                            movement.movement_type,
                          );

                        return (
                          <tr
                            key={movement.id}
                            className="border-b border-slate-100 transition hover:bg-slate-50"
                          >
                            <td className="px-5 py-4">
                              <p className="font-bold text-slate-900">
                                {product?.name ||
                                  "منتج محذوف"}
                              </p>

                              {product?.barcode && (
                                <p
                                  className="mt-1 text-xs text-slate-400"
                                  dir="ltr"
                                >
                                  {product.barcode}
                                </p>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${info.badge}`}
                              >
                                {info.icon}{" "}
                                {info.label}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <p
                                className={`font-black ${info.text}`}
                              >
                                {info.sign}
                                {formatNumber(
                                  movement.quantity,
                                )}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {unit?.name ||
                                  "وحدة أساسية"}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              {movement.batch_id ? (
                                <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                  مرتبطة
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  —
                                </span>
                              )}
                            </td>

                            <td className="max-w-xs px-5 py-4">
                              <p className="truncate text-sm text-slate-600">
                                {movement.notes ||
                                  "—"}
                              </p>
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-500">
                              {formatDate(
                                movement.created_at,
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {product && (
                                <button
                                  onClick={() =>
                                    router.push(
                                      `/products/${product.id}`,
                                    )
                                  }
                                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                                >
                                  عرض
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile */}
            <div className="grid gap-3 lg:hidden">
              {filteredMovements.map(
                (movement) => {
                  const product =
                    getProduct(
                      movement.products,
                    );

                  const unit =
                    getUnit(movement.units);

                  const info =
                    getMovementInfo(
                      movement.movement_type,
                    );

                  return (
                    <article
                      key={movement.id}
                      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      {/* Product + movement */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate font-black text-slate-900">
                            {product?.name ||
                              "منتج محذوف"}
                          </h2>

                          {product?.barcode && (
                            <p
                              className="mt-1 text-xs text-slate-400"
                              dir="ltr"
                            >
                              {product.barcode}
                            </p>
                          )}
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${info.badge}`}
                        >
                          {info.icon}{" "}
                          {info.label}
                        </span>
                      </div>

                      {/* Quantity */}
                      <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                        <div>
                          <p className="text-xs text-slate-500">
                            الكمية
                          </p>

                          <p
                            className={`mt-1 text-2xl font-black ${info.text}`}
                          >
                            {info.sign}
                            {formatNumber(
                              movement.quantity,
                            )}
                          </p>
                        </div>

                        <div className="text-left">
                          <p className="text-xs text-slate-400">
                            الوحدة
                          </p>

                          <p className="mt-1 font-bold text-slate-700">
                            {unit?.name ||
                              "وحدة"}
                          </p>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-slate-400">
                          🕐 التاريخ
                        </span>

                        <span className="font-semibold text-slate-700">
                          {formatDate(
                            movement.created_at,
                          )}
                        </span>
                      </div>

                      {/* Notes */}
                      {movement.notes && (
                        <div className="mt-3 rounded-xl bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                          📝 {movement.notes}
                        </div>
                      )}

                      {/* Product button */}
                      {product && (
                        <button
                          onClick={() =>
                            router.push(
                              `/products/${product.id}`,
                            )
                          }
                          className="mt-3 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                        >
                          عرض المنتج →
                        </button>
                      )}
                    </article>
                  );
                },
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}