"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Category = {
  id: string;
  name: string;
  icon: string | null;
};

type Product = {
  id: string;
  name: string;
  image_url: string | null;
  barcode: string | null;
  minimum_stock: number;
  purchase_price: number | null;
  selling_price: number | null;
  supplier_name: string | null;
  description: string | null;
  created_at: string;
  categories: Category[] | null;
};

type Unit = {
  id: string;
  name: string;
  symbol: string | null;
};

type ProductUnit = {
  id: string;
  unit_id: string;
  conversion_factor: number;
  is_base_unit: boolean;
  units: Unit | Unit[] | null;
};

type Batch = {
  id: string;
  quantity: number;
  expiry_date: string | null;
  batch_code: string | null;
  purchase_price: number | null;
  created_at: string;
};

type Movement = {
  id: string;
  movement_type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  notes: string | null;
  created_at: string;
  unit_id: string | null;
  units: Unit | Unit[] | null;
};

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProduct();
  }, [productId]);

  async function loadProduct() {
    setLoading(true);
    setError("");

    const [
      productResult,
      unitsResult,
      batchesResult,
      movementsResult,
    ] = await Promise.all([
      supabase
        .from("products")
        .select(`
          id,
          name,
          image_url,
          barcode,
          minimum_stock,
          purchase_price,
          selling_price,
          supplier_name,
          description,
          created_at,
          categories (
            id,
            name,
            icon
          )
        `)
        .eq("id", productId)
        .single(),

      supabase
        .from("product_units")
        .select(`
          id,
          unit_id,
          conversion_factor,
          is_base_unit,
          units (
            id,
            name,
            symbol
          )
        `)
        .eq("product_id", productId)
        .order("is_base_unit", {
          ascending: false,
        }),

      supabase
        .from("batches")
        .select(`
          id,
          quantity,
          expiry_date,
          batch_code,
          purchase_price,
          created_at
        `)
        .eq("product_id", productId)
        .order("expiry_date", {
          ascending: true,
          nullsFirst: false,
        }),

      supabase
        .from("inventory_movements")
        .select(`
          id,
          movement_type,
          quantity,
          notes,
          created_at,
          unit_id,
          units (
            id,
            name,
            symbol
          )
        `)
        .eq("product_id", productId)
        .order("created_at", {
          ascending: false,
        })
        .limit(50),
    ]);

    if (productResult.error) {
      console.error(productResult.error);
      setError(productResult.error.message);
      setLoading(false);
      return;
    }

    if (unitsResult.error) {
      console.error(unitsResult.error);
      setError(unitsResult.error.message);
      setLoading(false);
      return;
    }

    if (batchesResult.error) {
      console.error(batchesResult.error);
      setError(batchesResult.error.message);
      setLoading(false);
      return;
    }

    if (movementsResult.error) {
      console.error(movementsResult.error);
      setError(movementsResult.error.message);
      setLoading(false);
      return;
    }

    // -----------------------------
    // Product
    // -----------------------------

    const rawProduct = productResult.data;

    const normalizedProduct: Product = {
      id: rawProduct.id,
      name: rawProduct.name,
      image_url: rawProduct.image_url,
      barcode: rawProduct.barcode,
      minimum_stock: Number(
        rawProduct.minimum_stock || 0
      ),
      purchase_price:
        rawProduct.purchase_price !== null
          ? Number(rawProduct.purchase_price)
          : null,
      selling_price:
        rawProduct.selling_price !== null
          ? Number(rawProduct.selling_price)
          : null,
      supplier_name: rawProduct.supplier_name,
      description: rawProduct.description,
      created_at: rawProduct.created_at,
      categories:
        (rawProduct.categories as Category[]) ||
        [],
    };

    setProduct(normalizedProduct);

    // -----------------------------
    // Units
    // -----------------------------

    const normalizedUnits: ProductUnit[] =
      (unitsResult.data || []).map(
        (item: any) => {
          const unit = Array.isArray(item.units)
            ? item.units[0] || null
            : item.units;

          return {
            id: item.id,
            unit_id: item.unit_id,
            conversion_factor: Number(
              item.conversion_factor || 1
            ),
            is_base_unit: Boolean(
              item.is_base_unit
            ),
            units: unit,
          };
        }
      );

    setProductUnits(normalizedUnits);

    // -----------------------------
    // Batches
    // -----------------------------

    const normalizedBatches: Batch[] =
      (batchesResult.data || []).map(
        (batch) => ({
          id: batch.id,
          quantity: Number(
            batch.quantity || 0
          ),
          expiry_date: batch.expiry_date,
          batch_code: batch.batch_code,
          purchase_price:
            batch.purchase_price !== null
              ? Number(batch.purchase_price)
              : null,
          created_at: batch.created_at,
        })
      );

    setBatches(normalizedBatches);

    // -----------------------------
    // Movements
    // -----------------------------

    const normalizedMovements: Movement[] =
      (movementsResult.data || []).map(
        (movement: any) => {
          const unit = Array.isArray(
            movement.units
          )
            ? movement.units[0] || null
            : movement.units;

          return {
            id: movement.id,
            movement_type:
              movement.movement_type,
            quantity: Number(
              movement.quantity || 0
            ),
            notes: movement.notes,
            created_at: movement.created_at,
            unit_id: movement.unit_id,
            units: unit,
          };
        }
      );

    setMovements(normalizedMovements);

    setLoading(false);
  }

  // -----------------------------
  // Total stock
  // -----------------------------

  const totalStock = useMemo(() => {
    return batches.reduce(
      (total, batch) =>
        total + Number(batch.quantity || 0),
      0
    );
  }, [batches]);

  // -----------------------------
  // Base unit
  // -----------------------------

  const baseUnit = useMemo(() => {
    const base = productUnits.find(
      (item) => item.is_base_unit
    );

    if (!base) return null;

    const unit = Array.isArray(base.units)
      ? base.units[0] || null
      : base.units;

    return unit;
  }, [productUnits]);

  // -----------------------------
  // Mixed stock display
  // -----------------------------

  function formatStock(
    quantity: number
  ): string {
    if (quantity <= 0) {
      return "0";
    }

    const sortedUnits = [...productUnits]
      .filter(
        (item) =>
          item.conversion_factor > 0
      )
      .sort(
        (a, b) =>
          b.conversion_factor -
          a.conversion_factor
      );

    let remaining = quantity;

    const parts: string[] = [];

    for (const productUnit of sortedUnits) {
      const unit = Array.isArray(
        productUnit.units
      )
        ? productUnit.units[0] || null
        : productUnit.units;

      if (!unit) continue;

      const factor =
        productUnit.conversion_factor;

      if (factor <= remaining) {
        const count = Math.floor(
          remaining / factor
        );

        if (count > 0) {
          parts.push(
            `${count} ${unit.name}`
          );

          remaining =
            remaining - count * factor;
        }
      }
    }

    if (
      remaining > 0.0001 &&
      baseUnit
    ) {
      parts.push(
        `${Number(
          remaining.toFixed(3)
        )} ${baseUnit.name}`
      );
    }

    return parts.join(" + ");
  }

  // -----------------------------
  // Expiry status
  // -----------------------------

  function getExpiryStatus(
    expiryDate: string | null
  ) {
    if (!expiryDate) {
      return {
        text: "بدون تاريخ انتهاء",
        className: "text-gray-500",
      };
    }

    const today = new Date();
    const expiry = new Date(
      `${expiryDate}T00:00:00`
    );

    const diff =
      expiry.getTime() -
      today.getTime();

    const days = Math.ceil(
      diff / (1000 * 60 * 60 * 24)
    );

    if (days < 0) {
      return {
        text: `منتهي منذ ${Math.abs(days)} يوم`,
        className: "text-red-600",
      };
    }

    if (days === 0) {
      return {
        text: "ينتهي اليوم",
        className: "text-red-600",
      };
    }

    if (days <= 7) {
      return {
        text: `ينتهي خلال ${days} يوم`,
        className: "text-red-600",
      };
    }

    if (days <= 30) {
      return {
        text: `ينتهي خلال ${days} يوم`,
        className: "text-orange-600",
      };
    }

    return {
      text: `ينتهي خلال ${days} يوم`,
      className: "text-green-600",
    };
  }

  // -----------------------------
  // Movement unit
  // -----------------------------

  function getMovementUnit(
    movement: Movement
  ) {
    if (!movement.units) {
      return baseUnit;
    }

    return Array.isArray(
      movement.units
    )
      ? movement.units[0] || baseUnit
      : movement.units;
  }

  // -----------------------------
  // Loading
  // -----------------------------

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-gray-50 flex items-center justify-center"
      >
        <div className="text-gray-600 text-lg">
          جاري تحميل بيانات المنتج...
        </div>
      </main>
    );
  }

  // -----------------------------
  // Error
  // -----------------------------

  if (error) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-gray-50 p-6"
      >
        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
          <h1 className="font-bold text-xl mb-2">
            حدث خطأ
          </h1>

          <p>{error}</p>

          <button
            onClick={() =>
              router.push("/products")
            }
            className="mt-5 bg-gray-800 text-white px-5 py-3 rounded-xl"
          >
            العودة للمنتجات
          </button>
        </div>
      </main>
    );
  }

  if (!product) {
    return null;
  }

  const category =
    product.categories?.[0] || null;

  const stockStatus =
    totalStock <= 0
      ? {
          text: "نفد المخزون",
          className:
            "bg-red-100 text-red-700",
        }
      : totalStock <=
        product.minimum_stock
      ? {
          text: "مخزون منخفض",
          className:
            "bg-orange-100 text-orange-700",
        }
      : {
          text: "المخزون جيد",
          className:
            "bg-green-100 text-green-700",
        };

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50 p-4 md:p-8"
    >
      <div className="max-w-6xl mx-auto">

        {/* Back */}
        <button
          onClick={() =>
            router.push("/products")
          }
          className="text-gray-600 hover:text-gray-900 mb-5"
        >
          ← العودة إلى المنتجات
        </button>

        {/* Main Product Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-7">

          <div className="flex flex-col md:flex-row gap-6">

            {/* Image */}
            <div className="md:w-72">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-64 md:h-72 object-cover rounded-2xl border"
                />
              ) : (
                <div className="w-full h-64 md:h-72 rounded-2xl bg-gray-100 flex items-center justify-center text-6xl">
                  📦
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">

              <div className="flex flex-wrap items-center gap-2 mb-3">

                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${stockStatus.className}`}
                >
                  {stockStatus.text}
                </span>

                {category && (
                  <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
                    {category.icon}{" "}
                    {category.name}
                  </span>
                )}

              </div>

              <h1 className="text-3xl font-bold text-gray-900">
                {product.name}
              </h1>

              {/* Stock */}
              <div className="mt-6 bg-gray-50 rounded-2xl p-5">

                <p className="text-gray-500">
                  المخزون الحالي
                </p>

                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatStock(totalStock)}
                </p>

                <p className="text-sm text-gray-500 mt-2">
                  الإجمالي:{" "}
                  {totalStock.toLocaleString(
                    "ar-JO"
                  )}{" "}
                  {baseUnit?.name || "وحدة"}
                </p>

                <p className="text-sm text-gray-500 mt-1">
                  الحد الأدنى:{" "}
                  {product.minimum_stock.toLocaleString(
                    "ar-JO"
                  )}
                </p>

              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mt-5">

                <button
                  onClick={() =>
                    router.push(
                      `/products/${product.id}/stock-in`
                    )
                  }
                  className="flex-1 bg-green-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-green-700 transition"
                >
                  📥 إدخال مخزون
                </button>

                <button
                  onClick={() =>
                    router.push(
                      `/products/${product.id}/stock-out`
                    )
                  }
                  disabled={totalStock <= 0}
                  className="flex-1 bg-red-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                >
                  📤 إخراج مخزون
                </button>

                <button
                  onClick={() =>
                    router.push(
                      `/products/${product.id}/edit`
                    )
                  }
                  className="flex-1 bg-gray-800 text-white px-5 py-3 rounded-xl font-semibold hover:bg-gray-900 transition"
                >
                  ✏️ تعديل المنتج
                </button>

              </div>

            </div>
          </div>
        </div>

        {/* Batches */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-7 mt-6">

          <div className="flex items-center justify-between mb-5">

            <div>
              <h2 className="text-xl font-bold text-gray-900">
                الدفعات
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                الدفعات مرتبة حسب تاريخ انتهاء الصلاحية
              </p>
            </div>

            <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-semibold">
              {batches.length} دفعة
            </span>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-right">

              <thead>
                <tr className="border-b text-gray-500 text-sm">
                  <th className="py-3 px-2">
                    الدفعة
                  </th>

                  <th className="py-3 px-2">
                    الكمية
                  </th>

                  <th className="py-3 px-2">
                    تاريخ الانتهاء
                  </th>

                  <th className="py-3 px-2">
                    الحالة
                  </th>

                  <th className="py-3 px-2">
                    سعر الشراء
                  </th>
                </tr>
              </thead>

              <tbody>

                {batches.map(
                  (batch, index) => {
                    const expiry =
                      getExpiryStatus(
                        batch.expiry_date
                      );

                    return (
                      <tr
                        key={batch.id}
                        className="border-b last:border-0"
                      >
                        <td className="py-4 px-2 font-semibold">
                          الدفعة{" "}
                          {index + 1}
                        </td>

                        <td className="py-4 px-2 font-bold">
                          {formatStock(
                            batch.quantity
                          )}
                        </td>

                        <td className="py-4 px-2">
                          {batch.expiry_date ||
                            "—"}
                        </td>

                        <td
                          className={`py-4 px-2 font-semibold ${expiry.className}`}
                        >
                          {expiry.text}
                        </td>

                        <td className="py-4 px-2">
                          {batch.purchase_price !==
                          null
                            ? `${batch.purchase_price} د.أ`
                            : "—"}
                        </td>
                      </tr>
                    );
                  }
                )}

                {batches.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-8 text-gray-500"
                    >
                      لا توجد دفعات.
                    </td>
                  </tr>
                )}

              </tbody>

            </table>
          </div>
        </div>

        {/* Units */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-7 mt-6">

          <h2 className="text-xl font-bold text-gray-900 mb-5">
            وحدات المنتج
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {productUnits.map(
              (productUnit) => {
                const unit =
                  Array.isArray(
                    productUnit.units
                  )
                    ? productUnit.units[0] ||
                      null
                    : productUnit.units;

                if (!unit) {
                  return null;
                }

                return (
                  <div
                    key={productUnit.id}
                    className="border rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">

                      <span className="font-bold text-gray-900">
                        {unit.name}
                      </span>

                      {productUnit.is_base_unit && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          أساسية
                        </span>
                      )}

                    </div>

                    <p className="text-sm text-gray-500 mt-2">
                      1 {unit.name} ={" "}
                      {productUnit.conversion_factor}{" "}
                      وحدة أساسية
                    </p>
                  </div>
                );
              }
            )}

          </div>
        </div>

        {/* Product Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-7 mt-6">

          <h2 className="text-xl font-bold text-gray-900 mb-5">
            معلومات المنتج
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div>
              <p className="text-sm text-gray-500">
                الباركود
              </p>

              <p className="font-semibold mt-1">
                {product.barcode || "غير محدد"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                المورد
              </p>

              <p className="font-semibold mt-1">
                {product.supplier_name ||
                  "غير محدد"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                سعر الشراء
              </p>

              <p className="font-semibold mt-1">
                {product.purchase_price !== null
                  ? `${product.purchase_price} د.أ`
                  : "غير محدد"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                سعر البيع
              </p>

              <p className="font-semibold mt-1">
                {product.selling_price !== null
                  ? `${product.selling_price} د.أ`
                  : "غير محدد"}
              </p>
            </div>

            <div className="md:col-span-2">
              <p className="text-sm text-gray-500">
                الوصف
              </p>

              <p className="font-semibold mt-1">
                {product.description ||
                  "لا يوجد وصف"}
              </p>
            </div>

          </div>
        </div>

        {/* Movement History */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-7 mt-6 mb-8">

          <div className="flex items-center justify-between mb-5">

            <div>
              <h2 className="text-xl font-bold text-gray-900">
                سجل الحركات
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                آخر 50 حركة على المنتج
              </p>
            </div>

            <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-semibold">
              {movements.length}
            </span>

          </div>

          <div className="space-y-3">

            {movements.map(
              (movement) => {
                const movementUnit =
                  getMovementUnit(
                    movement
                  );

                const isIn =
                  movement.movement_type ===
                  "IN";

                const isOut =
                  movement.movement_type ===
                  "OUT";

                const isAdjustment =
                  movement.movement_type ===
                  "ADJUSTMENT";

                return (
                  <div
                    key={movement.id}
                    className="border rounded-xl p-4"
                  >

                    <div className="flex items-center justify-between gap-4">

                      <div className="flex items-center gap-3">

                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isIn
                              ? "bg-green-100"
                              : isOut
                              ? "bg-red-100"
                              : "bg-orange-100"
                          }`}
                        >
                          {isIn
                            ? "📥"
                            : isOut
                            ? "📤"
                            : "🔄"}
                        </div>

                        <div>

                          <p className="font-bold text-gray-900">
                            {isIn
                              ? "إدخال مخزون"
                              : isOut
                              ? "إخراج مخزون"
                              : "تعديل مخزون"}
                          </p>

                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(
                              movement.created_at
                            ).toLocaleString(
                              "ar-JO"
                            )}
                          </p>

                        </div>

                      </div>

                      <div
                        className={`font-bold text-lg ${
                          isIn
                            ? "text-green-600"
                            : isOut
                            ? "text-red-600"
                            : "text-orange-600"
                        }`}
                      >
                        {isIn
                          ? "+"
                          : isOut
                          ? "-"
                          : ""}
                        {movement.quantity.toLocaleString(
                          "ar-JO"
                        )}{" "}
                        {movementUnit?.name ||
                          baseUnit?.name ||
                          ""}
                      </div>

                    </div>

                    {movement.notes && (
                      <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                        {movement.notes}
                      </div>
                    )}

                  </div>
                );
              }
            )}

            {movements.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                لا توجد حركات حتى الآن.
              </div>
            )}

          </div>
        </div>

      </div>
    </main>
  );
}