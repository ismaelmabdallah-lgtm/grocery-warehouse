"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BarcodeScanner from "@/components/BarcodeScanner";

type Category = {
  id: string;
  name: string;
  icon: string | null;
};

type ProductUnit = {
  id: string;
  product_id: string;
  unit_id: string;
  conversion_factor: number;
  is_base_unit: boolean;
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

type Batch = {
  id: string;
  product_id: string;
  quantity: number;
  expiry_date: string | null;
};

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  image_url: string | null;
  barcode: string | null;
  minimum_stock: number;
  purchase_price: number | null;
  selling_price: number | null;
  supplier_name: string | null;
  created_at: string;
  categories:
    | {
        id: string;
        name: string;
        icon: string | null;
      }
    | {
        id: string;
        name: string;
        icon: string | null;
      }[]
    | null;
};

type ProductWithData = Product & {
  productUnits: ProductUnit[];
  batches: Batch[];
  totalStock: number;
};

type StockStatus = "good" | "low" | "empty";

type AlertType =
  | "empty"
  | "low"
  | "expired"
  | "expiring";

function getCategory(product: Product) {
  if (!product.categories) return null;

  if (Array.isArray(product.categories)) {
    return product.categories[0] ?? null;
  }

  return product.categories;
}

function getUnit(unitData: ProductUnit["units"]) {
  if (!unitData) return null;

  if (Array.isArray(unitData)) {
    return unitData[0] ?? null;
  }

  return unitData;
}

function getStockStatus(
  totalStock: number,
  minimumStock: number,
): StockStatus {
  if (totalStock <= 0) {
    return "empty";
  }

  if (minimumStock > 0 && totalStock <= minimumStock) {
    return "low";
  }

  return "good";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-JO", {
    maximumFractionDigits: 3,
  }).format(value);
}

function getDaysUntilExpiry(date: string | null) {
  if (!date) return null;

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${date}T00:00:00`);

  expiry.setHours(0, 0, 0, 0);

  const difference =
    expiry.getTime() - today.getTime();

  return Math.ceil(
    difference / (1000 * 60 * 60 * 24),
  );
}

function getExpiryInfo(product: ProductWithData) {
  const validDates = product.batches
    .filter(
      (batch) =>
        batch.quantity > 0 &&
        batch.expiry_date,
    )
    .map((batch) => ({
      date: batch.expiry_date as string,
      days: getDaysUntilExpiry(
        batch.expiry_date,
      ),
    }))
    .filter(
      (
        item,
      ): item is {
        date: string;
        days: number;
      } => item.days !== null,
    )
    .sort((a, b) => a.days - b.days);

  if (validDates.length === 0) {
    return null;
  }

  return validDates[0];
}

function getAlertTypes(
  product: ProductWithData,
): AlertType[] {
  const alerts: AlertType[] = [];

  const stockStatus = getStockStatus(
    product.totalStock,
    product.minimum_stock,
  );

  if (stockStatus === "empty") {
    alerts.push("empty");
  }

  if (stockStatus === "low") {
    alerts.push("low");
  }

  const expiry = getExpiryInfo(product);

  if (expiry) {
    if (expiry.days < 0) {
      alerts.push("expired");
    } else if (expiry.days <= 30) {
      alerts.push("expiring");
    }
  }

  return alerts;
}

function formatStock(product: ProductWithData) {
  const total = product.totalStock;

  if (total <= 0) {
    return "0";
  }

  const units = product.productUnits
    .map((item) => {
      const unit = getUnit(item.units);

      return {
        id: item.id,
        name: unit?.name || "وحدة",
        factor: Number(
          item.conversion_factor || 1,
        ),
        isBase: item.is_base_unit,
      };
    })
    .filter((unit) => unit.factor > 0)
    .sort(
      (a, b) => b.factor - a.factor,
    );

  if (units.length === 0) {
    return formatNumber(total);
  }

  let remaining = total;

  const parts: string[] = [];

  for (const unit of units) {
    const amount = Math.floor(
      remaining / unit.factor,
    );

    if (amount > 0) {
      parts.push(
        `${formatNumber(amount)} ${unit.name}`,
      );

      remaining -=
        amount * unit.factor;
    }
  }

  if (remaining > 0.0001) {
    const baseUnit =
      units.find(
        (unit) => unit.isBase,
      ) ||
      units[units.length - 1];

    parts.push(
      `${formatNumber(
        remaining,
      )} ${baseUnit.name}`,
    );
  }

  return parts.length > 0
    ? parts.join(" + ")
    : "0";
}

export default function ProductsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [products, setProducts] =
    useState<ProductWithData[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [stockFilter, setStockFilter] =
    useState("all");

  const [expiryFilter, setExpiryFilter] =
    useState("all");

  const [alertFilter, setAlertFilter] =
    useState("all");

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [scannerOpen, setScannerOpen] =
    useState(false);

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");

      const [
        productsResult,
        categoriesResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select(
            `
              id,
              name,
              category_id,
              image_url,
              barcode,
              minimum_stock,
              purchase_price,
              selling_price,
              supplier_name,
              created_at,
              categories (
                id,
                name,
                icon
              ),
              product_units (
                id,
                product_id,
                unit_id,
                conversion_factor,
                is_base_unit,
                units (
                  id,
                  name,
                  symbol
                )
              ),
              batches (
                id,
                product_id,
                quantity,
                expiry_date
              )
            `,
          )
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("categories")
          .select(
            "id, name, icon",
          )
          .order("name"),
      ]);

      if (productsResult.error) {
        throw productsResult.error;
      }

      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      const rawProducts =
        (productsResult.data ||
          []) as any[];

      const normalizedProducts: ProductWithData[] =
        rawProducts.map((item) => {
          const rawUnits =
            (item.product_units ||
              []) as ProductUnit[];

          const normalizedUnits =
            rawUnits.map((unit) => ({
              ...unit,
              conversion_factor:
                Number(
                  unit.conversion_factor ||
                    1,
                ),
            }));

          const batches: Batch[] =
            (
              item.batches || []
            ).map(
              (batch: Batch) => ({
                ...batch,
                quantity: Number(
                  batch.quantity || 0,
                ),
              }),
            );

          const totalStock =
            batches.reduce(
              (sum, batch) =>
                sum + batch.quantity,
              0,
            );

          return {
            id: item.id,
            name: item.name,
            category_id:
              item.category_id,
            image_url:
              item.image_url,
            barcode: item.barcode,
            minimum_stock:
              Number(
                item.minimum_stock ||
                  0,
              ),
            purchase_price:
              item.purchase_price !==
              null
                ? Number(
                    item.purchase_price,
                  )
                : null,
            selling_price:
              item.selling_price !==
              null
                ? Number(
                    item.selling_price,
                  )
                : null,
            supplier_name:
              item.supplier_name,
            created_at:
              item.created_at,
            categories:
              item.categories ||
              null,
            productUnits:
              normalizedUnits,
            batches,
            totalStock,
          };
        });

      setProducts(
        normalizedProducts,
      );

      setCategories(
        categoriesResult.data || [],
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل المنتجات",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function findProductByBarcode(
    barcodeValue: string,
  ) {
    const barcode =
      barcodeValue.trim();

    if (!barcode) {
      return null;
    }

    const { data, error } =
      await supabase
        .from("products")
        .select(
          "id, name, barcode",
        )
        .eq(
          "barcode",
          barcode,
        )
        .eq(
          "is_active",
          true,
        )
        .maybeSingle();

    if (error) {
      console.error(
        "Barcode lookup error:",
        error,
      );

      throw error;
    }

    return data;
  }

  async function handleBarcodeSearch() {
    const barcode =
      search.trim();

    if (!barcode) {
      return;
    }

    try {
      setError("");

      const product =
        await findProductByBarcode(
          barcode,
        );

      if (product) {
        router.push(
          `/products/${product.id}`,
        );

        return;
      }

      alert(
        `لم يتم العثور على منتج بالباركود:\n${barcode}`,
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء البحث عن الباركود.",
      );
    }
  }

  async function handleQuickBarcodeSearch() {
    const barcode =
      window.prompt(
        "📱 أدخل الباركود أو امسحه باستخدام قارئ الباركود:",
      );

    if (barcode === null) {
      return;
    }

    const normalizedBarcode =
      barcode.trim();

    if (!normalizedBarcode) {
      return;
    }

    try {
      setError("");

      const product =
        await findProductByBarcode(
          normalizedBarcode,
        );

      if (product) {
        router.push(
          `/products/${product.id}`,
        );

        return;
      }

      alert(
        `لم يتم العثور على منتج بالباركود:\n${normalizedBarcode}`,
      );

      setSearch(
        normalizedBarcode,
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء البحث عن الباركود.",
      );
    }
  }

  async function handleBarcodeDetected(
    barcode: string,
  ) {
    const normalizedBarcode =
      barcode.trim();

    if (!normalizedBarcode) {
      return;
    }

    setScannerOpen(false);

    try {
      setError("");

      const product =
        await findProductByBarcode(
          normalizedBarcode,
        );

      if (product) {
        router.push(
          `/products/${product.id}`,
        );

        return;
      }

      setSearch(
        normalizedBarcode,
      );

      alert(
        `تم قراءة الباركود بنجاح، ولكن لا يوجد منتج مسجل بهذا الباركود:\n\n${normalizedBarcode}`,
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء البحث عن الباركود.",
      );
    }
  }

  const filteredProducts =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return products.filter(
        (product) => {
          const category =
            getCategory(product);

          const matchesSearch =
            !normalizedSearch ||
            product.name
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            (
              product.barcode ||
              ""
            )
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            (
              product.supplier_name ||
              ""
            )
              .toLowerCase()
              .includes(
                normalizedSearch,
              );

          const matchesCategory =
            categoryFilter ===
              "all" ||
            product.category_id ===
              categoryFilter;

          const status =
            getStockStatus(
              product.totalStock,
              product.minimum_stock,
            );

          const matchesStock =
            stockFilter ===
              "all" ||
            status === stockFilter;

          const expiry =
            getExpiryInfo(product);

          let matchesExpiry =
            true;

          if (
            expiryFilter ===
            "expiring"
          ) {
            matchesExpiry =
              expiry !== null &&
              expiry.days >= 0 &&
              expiry.days <= 30;
          }

          if (
            expiryFilter ===
            "expired"
          ) {
            matchesExpiry =
              expiry !== null &&
              expiry.days < 0;
          }

          if (
            expiryFilter ===
            "safe"
          ) {
            matchesExpiry =
              expiry === null ||
              expiry.days > 30;
          }

          const alerts =
            getAlertTypes(product);

          const matchesAlert =
            alertFilter ===
              "all" ||
            alerts.includes(
              alertFilter as AlertType,
            );

          return (
            matchesSearch &&
            matchesCategory &&
            matchesStock &&
            matchesExpiry &&
            matchesAlert
          );
        },
      );
    }, [
      products,
      search,
      categoryFilter,
      stockFilter,
      expiryFilter,
      alertFilter,
    ]);

  const statistics =
    useMemo(() => {
      const total =
        products.length;

      const empty =
        products.filter(
          (product) =>
            product.totalStock <=
            0,
        ).length;

      const low =
        products.filter(
          (product) =>
            product.totalStock >
              0 &&
            product.minimum_stock >
              0 &&
            product.totalStock <=
              product.minimum_stock,
        ).length;

      const expiring =
        products.filter(
          (product) => {
            const expiry =
              getExpiryInfo(
                product,
              );

            return (
              expiry !== null &&
              expiry.days >= 0 &&
              expiry.days <= 30
            );
          },
        ).length;

      const expired =
        products.filter(
          (product) => {
            const expiry =
              getExpiryInfo(
                product,
              );

            return (
              expiry !== null &&
              expiry.days < 0
            );
          },
        ).length;

      const totalStock =
        products.reduce(
          (sum, product) =>
            sum +
            product.totalStock,
          0,
        );

      return {
        total,
        empty,
        low,
        expiring,
        expired,
        totalStock,
      };
    }, [products]);

  function setAlertFilterAndResetOthers(
    type: AlertType,
  ) {
    if (alertFilter === type) {
      setAlertFilter("all");
      return;
    }

    setAlertFilter(type);

    setStockFilter("all");
    setExpiryFilter("all");
  }

  function renderStockStatus(
    product: ProductWithData,
  ) {
    const status =
      getStockStatus(
        product.totalStock,
        product.minimum_stock,
      );

    if (status === "empty") {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
          🔴 نافد
        </span>
      );
    }

    if (status === "low") {
      return (
        <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
          🟠 مخزون منخفض
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
        🟢 جيد
      </span>
    );
  }

  function renderExpiry(
    product: ProductWithData,
  ) {
    const expiry =
      getExpiryInfo(product);

    if (!expiry) {
      return (
        <span className="text-xs text-slate-400">
          لا يوجد تاريخ انتهاء
        </span>
      );
    }

    if (expiry.days < 0) {
      return (
        <span className="font-semibold text-red-600">
          🔴 منتهي منذ{" "}
          {formatNumber(
            Math.abs(
              expiry.days,
            ),
          )}{" "}
          يوم
        </span>
      );
    }

    if (expiry.days === 0) {
      return (
        <span className="font-semibold text-red-600">
          🔴 ينتهي اليوم
        </span>
      );
    }

    if (expiry.days <= 7) {
      return (
        <span className="font-semibold text-red-600">
          🔴 ينتهي خلال{" "}
          {formatNumber(
            expiry.days,
          )}{" "}
          يوم
        </span>
      );
    }

    if (expiry.days <= 30) {
      return (
        <span className="font-semibold text-orange-600">
          🟠 ينتهي خلال{" "}
          {formatNumber(
            expiry.days,
          )}{" "}
          يوم
        </span>
      );
    }

    return (
      <span className="text-sm text-slate-500">
        ينتهي بعد{" "}
        {formatNumber(
          expiry.days,
        )}{" "}
        يوم
      </span>
    );
  }

  function renderAlertBadges(
    product: ProductWithData,
  ) {
    const alerts =
      getAlertTypes(product);

    if (alerts.length === 0) {
      return (
        <span className="text-xs font-semibold text-green-600">
          ✓ لا توجد تنبيهات
        </span>
      );
    }

    return (
      <div className="flex flex-wrap gap-1">
        {alerts.includes(
          "empty",
        ) && (
          <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-bold text-red-700">
            🔴 نافد
          </span>
        )}

        {alerts.includes(
          "low",
        ) && (
          <span className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-700">
            🟠 منخفض
          </span>
        )}

        {alerts.includes(
          "expired",
        ) && (
          <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-bold text-red-700">
            ⛔ منتهي
          </span>
        )}

        {alerts.includes(
          "expiring",
        ) && (
          <span className="rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-bold text-yellow-700">
            🟡 قريب الانتهاء
          </span>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 px-4 py-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">
              ⏳
            </div>

            <p className="mt-4 font-semibold text-slate-600">
              جارٍ تحميل المنتجات...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              onClick={() =>
                router.push(
                  "/dashboard",
                )
              }
              className="mb-3 text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← العودة إلى لوحة التحكم
            </button>

            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              📦 المنتجات والمخزون
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              إدارة جميع المنتجات والكميات وحالات المخزون والتنبيهات.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() =>
                setScannerOpen(true)
              }
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100 active:scale-[0.98]"
            >
              📷 مسح بالكاميرا
            </button>

            <button
              type="button"
              onClick={
                handleQuickBarcodeSearch
              }
              className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 font-bold text-blue-700 shadow-sm transition hover:bg-blue-100 active:scale-[0.98]"
            >
              📱 بحث بالباركود
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/products/new",
                )
              }
              className="rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
            >
              + إضافة منتج
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            ❌ {error}
          </div>
        )}

        {/* Alert Summary */}
        {(statistics.empty > 0 ||
          statistics.low > 0 ||
          statistics.expired > 0 ||
          statistics.expiring > 0) && (
          <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  🚨 تنبيهات المستودع
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  اضغط على أي تنبيه لعرض المنتجات التي تحتاج إلى انتباه.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAlertFilter(
                    "all",
                  );
                  setStockFilter(
                    "all",
                  );
                  setExpiryFilter(
                    "all",
                  );
                }}
                className="text-sm font-bold text-blue-600 hover:text-blue-700"
              >
                عرض الكل
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statistics.empty >
                0 && (
                <button
                  onClick={() =>
                    setAlertFilterAndResetOthers(
                      "empty",
                    )
                  }
                  className={`rounded-2xl border p-4 text-right transition ${
                    alertFilter ===
                    "empty"
                      ? "border-red-400 bg-red-50 ring-2 ring-red-100"
                      : "border-red-100 bg-red-50/50 hover:bg-red-50"
                  }`}
                >
                  <div className="text-2xl">
                    🔴
                  </div>

                  <p className="mt-2 text-xs font-bold text-red-700">
                    نفد المخزون
                  </p>

                  <p className="mt-1 text-2xl font-black text-red-700">
                    {formatNumber(
                      statistics.empty,
                    )}
                  </p>
                </button>
              )}

              {statistics.low >
                0 && (
                <button
                  onClick={() =>
                    setAlertFilterAndResetOthers(
                      "low",
                    )
                  }
                  className={`rounded-2xl border p-4 text-right transition ${
                    alertFilter ===
                    "low"
                      ? "border-orange-400 bg-orange-50 ring-2 ring-orange-100"
                      : "border-orange-100 bg-orange-50/50 hover:bg-orange-50"
                  }`}
                >
                  <div className="text-2xl">
                    🟠
                  </div>

                  <p className="mt-2 text-xs font-bold text-orange-700">
                    مخزون منخفض
                  </p>

                  <p className="mt-1 text-2xl font-black text-orange-700">
                    {formatNumber(
                      statistics.low,
                    )}
                  </p>
                </button>
              )}

              {statistics.expired >
                0 && (
                <button
                  onClick={() =>
                    setAlertFilterAndResetOthers(
                      "expired",
                    )
                  }
                  className={`rounded-2xl border p-4 text-right transition ${
                    alertFilter ===
                    "expired"
                      ? "border-red-400 bg-red-50 ring-2 ring-red-100"
                      : "border-red-100 bg-red-50/50 hover:bg-red-50"
                  }`}
                >
                  <div className="text-2xl">
                    ⛔
                  </div>

                  <p className="mt-2 text-xs font-bold text-red-700">
                    منتهي الصلاحية
                  </p>

                  <p className="mt-1 text-2xl font-black text-red-700">
                    {formatNumber(
                      statistics.expired,
                    )}
                  </p>
                </button>
              )}

              {statistics.expiring >
                0 && (
                <button
                  onClick={() =>
                    setAlertFilterAndResetOthers(
                      "expiring",
                    )
                  }
                  className={`rounded-2xl border p-4 text-right transition ${
                    alertFilter ===
                    "expiring"
                      ? "border-yellow-400 bg-yellow-50 ring-2 ring-yellow-100"
                      : "border-yellow-100 bg-yellow-50/50 hover:bg-yellow-50"
                  }`}
                >
                  <div className="text-2xl">
                    🟡
                  </div>

                  <p className="mt-2 text-xs font-bold text-yellow-700">
                    قريب الانتهاء
                  </p>

                  <p className="mt-1 text-2xl font-black text-yellow-700">
                    {formatNumber(
                      statistics.expiring,
                    )}
                  </p>
                </button>
              )}
            </div>
          </section>
        )}

        {/* Statistics */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">
              إجمالي المنتجات
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatNumber(
                statistics.total,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">
              إجمالي المخزون
            </p>

            <p className="mt-2 text-2xl font-bold text-blue-600">
              {formatNumber(
                statistics.totalStock,
              )}
            </p>
          </div>

          <button
            onClick={() =>
              setStockFilter(
                stockFilter ===
                  "low"
                  ? "all"
                  : "low",
              )
            }
            className={`rounded-2xl border p-4 text-right shadow-sm transition ${
              stockFilter ===
              "low"
                ? "border-orange-300 bg-orange-50"
                : "border-slate-200 bg-white hover:border-orange-200"
            }`}
          >
            <p className="text-xs text-slate-500">
              مخزون منخفض
            </p>

            <p className="mt-2 text-2xl font-bold text-orange-600">
              {formatNumber(
                statistics.low,
              )}
            </p>
          </button>

          <button
            onClick={() =>
              setStockFilter(
                stockFilter ===
                  "empty"
                  ? "all"
                  : "empty",
              )
            }
            className={`rounded-2xl border p-4 text-right shadow-sm transition ${
              stockFilter ===
              "empty"
                ? "border-red-300 bg-red-50"
                : "border-slate-200 bg-white hover:border-red-200"
            }`}
          >
            <p className="text-xs text-slate-500">
              منتجات نافدة
            </p>

            <p className="mt-2 text-2xl font-bold text-red-600">
              {formatNumber(
                statistics.empty,
              )}
            </p>
          </button>

          <button
            onClick={() =>
              setExpiryFilter(
                expiryFilter ===
                  "expiring"
                  ? "all"
                  : "expiring",
              )
            }
            className={`rounded-2xl border p-4 text-right shadow-sm transition ${
              expiryFilter ===
              "expiring"
                ? "border-orange-300 bg-orange-50"
                : "border-slate-200 bg-white hover:border-orange-200"
            }`}
          >
            <p className="text-xs text-slate-500">
              قرب الانتهاء
            </p>

            <p className="mt-2 text-2xl font-bold text-orange-600">
              {formatNumber(
                statistics.expiring,
              )}
            </p>
          </button>

          <button
            onClick={() =>
              setExpiryFilter(
                expiryFilter ===
                  "expired"
                  ? "all"
                  : "expired",
              )
            }
            className={`rounded-2xl border p-4 text-right shadow-sm transition ${
              expiryFilter ===
              "expired"
                ? "border-red-300 bg-red-50"
                : "border-slate-200 bg-white hover:border-red-200"
            }`}
          >
            <p className="text-xs text-slate-500">
              منتهية الصلاحية
            </p>

            <p className="mt-2 text-2xl font-bold text-red-600">
              {formatNumber(
                statistics.expired,
              )}
            </p>
          </button>
        </div>

        {/* Active alert filter */}
        {alertFilter !==
          "all" && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm font-bold text-blue-800">
              🔎 يتم الآن عرض المنتجات التي تحتاج إلى انتباه
            </p>

            <button
              onClick={() =>
                setAlertFilter(
                  "all",
                )
              }
              className="text-sm font-bold text-blue-700 hover:text-blue-900"
            >
              إلغاء الفلتر
            </button>
          </div>
        )}

        {/* Filters */}
        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value,
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key ===
                    "Enter"
                  ) {
                    void handleBarcodeSearch();
                  }
                }}
                placeholder="🔎 ابحث باسم المنتج أو الباركود أو المورد..."
                inputMode="search"
                autoComplete="off"
                enterKeyHint="search"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />

              {search.trim() && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500 hover:bg-slate-200"
                  aria-label="مسح البحث"
                >
                  ✕
                </button>
              )}

              <p className="mt-2 text-xs text-slate-400">
                💡 للباركود: امسحه في هذا الحقل ثم اضغط Enter
              </p>
            </div>

            <select
              value={
                categoryFilter
              }
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value,
                )
              }
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">
                كل التصنيفات
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={
                      category.id
                    }
                    value={
                      category.id
                    }
                  >
                    {category.icon
                      ? `${category.icon} `
                      : ""}
                    {
                      category.name
                    }
                  </option>
                ),
              )}
            </select>

            <select
              value={stockFilter}
              onChange={(e) =>
                setStockFilter(
                  e.target.value,
                )
              }
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">
                كل حالات المخزون
              </option>

              <option value="good">
                🟢 جيد
              </option>

              <option value="low">
                🟠 منخفض
              </option>

              <option value="empty">
                🔴 نافد
              </option>
            </select>

            <select
              value={
                expiryFilter
              }
              onChange={(e) =>
                setExpiryFilter(
                  e.target.value,
                )
              }
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">
                كل الصلاحيات
              </option>

              <option value="expiring">
                🟠 تنتهي خلال 30 يوم
              </option>

              <option value="expired">
                🔴 منتهية
              </option>

              <option value="safe">
                🟢 أكثر من 30 يوم
              </option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategoryFilter(
                  "all",
                );
                setStockFilter(
                  "all",
                );
                setExpiryFilter(
                  "all",
                );
                setAlertFilter(
                  "all",
                );
              }}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-600 hover:bg-slate-50"
            >
              إعادة ضبط
            </button>
          </div>
        </section>

        {/* Results count */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            عرض{" "}
            <strong className="text-slate-800">
              {formatNumber(
                filteredProducts.length,
              )}
            </strong>{" "}
            من أصل{" "}
            <strong className="text-slate-800">
              {formatNumber(
                products.length,
              )}
            </strong>{" "}
            منتج
          </p>

          <button
            onClick={loadProducts}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            🔄 تحديث
          </button>
        </div>

        {/* Empty */}
        {filteredProducts.length ===
        0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="text-6xl">
              📦
            </div>

            <h2 className="mt-4 text-xl font-bold text-slate-900">
              لا توجد منتجات مطابقة
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              جرّب تغيير البحث أو الفلاتر.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1150px]">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-right text-sm text-slate-500">
                      <th className="px-5 py-4 font-semibold">
                        المنتج
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        التصنيف
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        المخزون
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        الحالة
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        الصلاحية
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        التنبيهات
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        الأسعار
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        إجراء
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map(
                      (product) => {
                        const category =
                          getCategory(
                            product,
                          );

                        return (
                          <tr
                            key={
                              product.id
                            }
                            className="border-b border-slate-100 transition hover:bg-slate-50"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                                  {product.image_url ? (
                                    <img
                                      src={
                                        product.image_url
                                      }
                                      alt={
                                        product.name
                                      }
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-2xl">
                                      📦
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900">
                                    {
                                      product.name
                                    }
                                  </p>

                                  {product.barcode && (
                                    <p
                                      className="mt-1 text-xs text-slate-400"
                                      dir="ltr"
                                    >
                                      {
                                        product.barcode
                                      }
                                    </p>
                                  )}

                                  {product.supplier_name && (
                                    <p className="mt-1 text-xs text-slate-400">
                                      المورد:{" "}
                                      {
                                        product.supplier_name
                                      }
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              {category ? (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {category.icon
                                    ? `${category.icon} `
                                    : ""}
                                  {
                                    category.name
                                  }
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  بدون تصنيف
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <p className="font-bold text-slate-900">
                                {formatStock(
                                  product,
                                )}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                الإجمالي:{" "}
                                {formatNumber(
                                  product.totalStock,
                                )}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              {renderStockStatus(
                                product,
                              )}

                              {product.minimum_stock >
                                0 && (
                                <p className="mt-1 text-xs text-slate-400">
                                  الحد الأدنى:{" "}
                                  {formatNumber(
                                    product.minimum_stock,
                                  )}
                                </p>
                              )}
                            </td>

                            <td className="px-5 py-4 text-sm">
                              {renderExpiry(
                                product,
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {renderAlertBadges(
                                product,
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <div className="space-y-1 text-sm">
                                <p>
                                  <span className="text-slate-400">
                                    شراء:
                                  </span>{" "}
                                  <strong>
                                    {product.purchase_price !==
                                    null
                                      ? `${product.purchase_price.toFixed(
                                          3,
                                        )} د.أ`
                                      : "-"}
                                  </strong>
                                </p>

                                <p>
                                  <span className="text-slate-400">
                                    بيع:
                                  </span>{" "}
                                  <strong className="text-green-700">
                                    {product.selling_price !==
                                    null
                                      ? `${product.selling_price.toFixed(
                                          3,
                                        )} د.أ`
                                      : "-"}
                                  </strong>
                                </p>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <button
                                onClick={() =>
                                  router.push(
                                    `/products/${product.id}`,
                                  )
                                }
                                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                              >
                                التفاصيل
                              </button>
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
            <div className="grid gap-4 lg:hidden">
              {filteredProducts.map(
                (product) => {
                  const category =
                    getCategory(
                      product,
                    );

                  return (
                    <article
                      key={
                        product.id
                      }
                      onClick={() =>
                        router.push(
                          `/products/${product.id}`,
                        )
                      }
                      className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                    >
                      <div className="flex gap-4">
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                          {product.image_url ? (
                            <img
                              src={
                                product.image_url
                              }
                              alt={
                                product.name
                              }
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl">
                              📦
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h2 className="font-bold text-slate-900">
                                {
                                  product.name
                                }
                              </h2>

                              {category && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {category.icon
                                    ? `${category.icon} `
                                    : ""}
                                  {
                                    category.name
                                  }
                                </p>
                              )}
                            </div>

                            {renderStockStatus(
                              product,
                            )}
                          </div>

                          {product.barcode && (
                            <p
                              className="mt-2 text-xs text-slate-400"
                              dir="ltr"
                            >
                              {
                                product.barcode
                              }
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        {renderAlertBadges(
                          product,
                        )}
                      </div>

                      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-slate-500">
                              المخزون الحالي
                            </p>

                            <p className="mt-1 text-lg font-bold text-slate-900">
                              {formatStock(
                                product,
                              )}
                            </p>
                          </div>

                          <div className="text-left">
                            <p className="text-xs text-slate-500">
                              الإجمالي
                            </p>

                            <p className="mt-1 font-bold text-blue-600">
                              {formatNumber(
                                product.totalStock,
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <span className="text-xs text-slate-500">
                          الصلاحية
                        </span>

                        <span className="text-right text-xs">
                          {renderExpiry(
                            product,
                          )}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-400">
                            سعر الشراء
                          </p>

                          <p className="mt-1 font-bold text-slate-800">
                            {product.purchase_price !==
                            null
                              ? `${product.purchase_price.toFixed(
                                  3,
                                )} د.أ`
                              : "-"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-green-50 p-3">
                          <p className="text-xs text-green-600">
                            سعر البيع
                          </p>

                          <p className="mt-1 font-bold text-green-700">
                            {product.selling_price !==
                            null
                              ? `${product.selling_price.toFixed(
                                  3,
                                )} د.أ`
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(
                          event,
                        ) => {
                          event.stopPropagation();

                          router.push(
                            `/products/${product.id}`,
                          );
                        }}
                        className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800"
                      >
                        عرض التفاصيل →
                      </button>
                    </article>
                  );
                },
              )}
            </div>
          </>
        )}
      </div>

      {/* Camera Scanner */}
      {scannerOpen && (
        <BarcodeScanner
          onDetected={
            handleBarcodeDetected
          }
          onClose={() =>
            setScannerOpen(false)
          }
        />
      )}
    </main>
  );
}