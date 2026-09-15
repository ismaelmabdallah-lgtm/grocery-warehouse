"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  image_url: string | null;
  minimum_stock: number;
};

type Unit = {
  id: string;
  name: string;
  symbol: string | null;
  conversion_factor: number;
};

type Batch = {
  id: string;
  quantity: number;
  expiry_date: string | null;
};

type ProductUnitRow = {
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

export default function StockOutPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [quantity, setQuantity] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [productId]);

  async function loadData() {
    setLoading(true);
    setError("");

    const [productResult, unitsResult, batchesResult] =
      await Promise.all([
        supabase
          .from("products")
          .select("id, name, image_url, minimum_stock")
          .eq("id", productId)
          .single(),

        supabase
          .from("product_units")
          .select(`
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
          .order("is_base_unit", { ascending: false }),

        supabase
          .from("batches")
          .select("id, quantity, expiry_date")
          .eq("product_id", productId)
          .gt("quantity", 0)
          .order("expiry_date", {
            ascending: true,
            nullsFirst: false,
          }),
      ]);

    if (productResult.error) {
      setError(productResult.error.message);
      setLoading(false);
      return;
    }

    if (unitsResult.error) {
      setError(unitsResult.error.message);
      setLoading(false);
      return;
    }

    if (batchesResult.error) {
      setError(batchesResult.error.message);
      setLoading(false);
      return;
    }

    // -----------------------------
    // Product
    // -----------------------------

    setProduct({
      id: productResult.data.id,
      name: productResult.data.name,
      image_url: productResult.data.image_url,
      minimum_stock: Number(
        productResult.data.minimum_stock || 0
      ),
    });

    // -----------------------------
    // Units
    // -----------------------------

    const rawUnits =
      (unitsResult.data || []) as ProductUnitRow[];

    const normalizedUnits: Unit[] = [];

    for (const item of rawUnits) {
      let unitData = item.units;

      if (Array.isArray(unitData)) {
        unitData = unitData[0] ?? null;
      }

      if (!unitData) {
        continue;
      }

      normalizedUnits.push({
        id: unitData.id,
        name: unitData.name,
        symbol: unitData.symbol,
        conversion_factor: Number(
          item.conversion_factor || 1
        ),
      });
    }

    setUnits(normalizedUnits);

    // -----------------------------
    // Select base unit automatically
    // -----------------------------

    const baseUnitRow =
      rawUnits.find((item) => item.is_base_unit) ??
      rawUnits[0] ??
      null;

    if (baseUnitRow) {
      let baseUnitData = baseUnitRow.units;

      if (Array.isArray(baseUnitData)) {
        baseUnitData = baseUnitData[0] ?? null;
      }

      if (baseUnitData) {
        setSelectedUnitId(baseUnitData.id);
      }
    }

    // -----------------------------
    // Batches
    // -----------------------------

    const normalizedBatches: Batch[] =
      (batchesResult.data || []).map((batch) => ({
        id: batch.id,
        quantity: Number(batch.quantity || 0),
        expiry_date: batch.expiry_date,
      }));

    setBatches(normalizedBatches);

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
  // Selected unit
  // -----------------------------

  const selectedUnit = useMemo(() => {
    return (
      units.find(
        (unit) => unit.id === selectedUnitId
      ) || null
    );
  }, [units, selectedUnitId]);

  // -----------------------------
  // Quantity calculations
  // -----------------------------

  const enteredQuantity = Number(quantity || 0);

  const baseQuantity = selectedUnit
    ? enteredQuantity *
      selectedUnit.conversion_factor
    : 0;

  const remainingAfter =
    totalStock - baseQuantity;

  // -----------------------------
  // Quantity input
  // -----------------------------

  function handleQuantityChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const value = event.target.value;

    if (value === "" || Number(value) >= 0) {
      setQuantity(value);
    }
  }

  // -----------------------------
  // Submit
  // -----------------------------

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (!product) {
      setError("لم يتم تحميل بيانات المنتج");
      return;
    }

    if (!quantity || enteredQuantity <= 0) {
      setError("أدخل كمية صحيحة أكبر من صفر");
      return;
    }

    if (!selectedUnitId) {
      setError("اختر الوحدة");
      return;
    }

    if (baseQuantity > totalStock) {
      setError(
        "الكمية المطلوبة أكبر من المخزون المتوفر"
      );
      return;
    }

    setSaving(true);

    const { error: rpcError } =
      await supabase.rpc("remove_stock", {
        p_product_id: product.id,
        p_quantity: enteredQuantity,
        p_unit_id: selectedUnitId,
        p_notes: notes.trim() || null,
      });

    if (rpcError) {
      console.error(rpcError);

      setError(rpcError.message);
      setSaving(false);

      return;
    }

    router.push(
      `/products/${product.id}`
    );
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
          جاري تحميل البيانات...
        </div>
      </main>
    );
  }

  // -----------------------------
  // Product not found
  // -----------------------------

  if (!product) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-gray-50 flex items-center justify-center p-6"
      >
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="text-5xl mb-4">
            ❌
          </div>

          <h1 className="text-xl font-bold text-gray-800">
            المنتج غير موجود
          </h1>

          <button
            onClick={() =>
              router.push("/products")
            }
            className="mt-4 bg-gray-800 text-white px-5 py-3 rounded-xl"
          >
            العودة للمنتجات
          </button>
        </div>
      </main>
    );
  }

  // -----------------------------
  // UI
  // -----------------------------

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50 p-4 md:p-8"
    >
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() =>
              router.push(
                `/products/${product.id}`
              )
            }
            className="text-gray-600 hover:text-gray-900 mb-4"
          >
            ← العودة للمنتج
          </button>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            إخراج مخزون
          </h1>

          <p className="text-gray-500 mt-1">
            تسجيل كمية خارجة من المنتج
          </p>
        </div>

        {/* Product */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="flex items-center gap-4">

            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-20 h-20 rounded-xl object-cover border"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-3xl">
                📦
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {product.name}
              </h2>

              <p className="text-gray-500 mt-1">
                المخزون الحالي:
              </p>

              <p className="text-2xl font-bold text-green-600">
                {totalStock.toLocaleString("ar-JO")}
              </p>
            </div>

          </div>
        </div>

        {/* FEFO */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5">
          <div className="flex gap-3">
            <div className="text-2xl">
              🔄
            </div>

            <div>
              <h3 className="font-bold text-blue-900">
                الإخراج حسب أقرب انتهاء
              </h3>

              <p className="text-sm text-blue-800 mt-1">
                النظام سيقوم تلقائيًا بإخراج
                الكمية من الدفعة الأقرب إلى
                انتهاء الصلاحية أولًا.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-7"
        >
          <div className="space-y-5">

            {/* Quantity */}
            <div>
              <label className="block font-semibold text-gray-800 mb-2">
                الكمية
              </label>

              <input
                type="number"
                min="0"
                step="0.001"
                value={quantity}
                onChange={handleQuantityChange}
                placeholder="مثال: 3"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Unit */}
            <div>
              <label className="block font-semibold text-gray-800 mb-2">
                الوحدة
              </label>

              <select
                value={selectedUnitId}
                onChange={(event) =>
                  setSelectedUnitId(
                    event.target.value
                  )
                }
                className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">
                  اختر الوحدة
                </option>

                {units.map((unit) => (
                  <option
                    key={unit.id}
                    value={unit.id}
                  >
                    {unit.name}
                    {unit.conversion_factor !== 1
                      ? ` — 1 ${unit.name} = ${unit.conversion_factor} وحدة أساسية`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview */}
            {selectedUnit &&
              enteredQuantity > 0 && (
                <div className="bg-gray-50 border rounded-xl p-4">

                  <p className="text-gray-600 text-sm">
                    الكمية التي سيتم إخراجها:
                  </p>

                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {enteredQuantity.toLocaleString(
                      "ar-JO"
                    )}{" "}
                    {selectedUnit.name}
                  </p>

                  {selectedUnit.conversion_factor !==
                    1 && (
                    <p className="text-sm text-gray-500 mt-1">
                      ={" "}
                      {baseQuantity.toLocaleString(
                        "ar-JO"
                      )}{" "}
                      وحدة أساسية
                    </p>
                  )}

                  <div className="border-t mt-3 pt-3">
                    <p className="text-sm text-gray-600">
                      المخزون المتبقي بعد الإخراج:
                    </p>

                    <p
                      className={`text-xl font-bold mt-1 ${
                        remainingAfter < 0
                          ? "text-red-600"
                          : remainingAfter <=
                            product.minimum_stock
                          ? "text-orange-600"
                          : "text-green-600"
                      }`}
                    >
                      {Math.max(
                        remainingAfter,
                        0
                      ).toLocaleString("ar-JO")}
                    </p>
                  </div>

                </div>
              )}

            {/* Notes */}
            <div>
              <label className="block font-semibold text-gray-800 mb-2">
                ملاحظات
                <span className="text-gray-400 font-normal text-sm mr-2">
                  (اختياري)
                </span>
              </label>

              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                rows={3}
                placeholder="أي ملاحظة تريد تسجيلها..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
                <div className="font-bold mb-1">
                  ⚠️ حدث خطأ
                </div>

                <div className="text-sm">
                  {error}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">

              <button
                type="submit"
                disabled={
                  saving ||
                  !quantity ||
                  !selectedUnitId ||
                  baseQuantity > totalStock
                }
                className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {saving
                  ? "جاري تسجيل الإخراج..."
                  : "📤 تسجيل إخراج المخزون"}
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/products/${product.id}`
                  )
                }
                disabled={saving}
                className="px-6 py-3.5 rounded-xl border border-gray-300 bg-white font-semibold text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>

            </div>

          </div>
        </form>

        {/* Batches */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mt-5">

          <h2 className="font-bold text-lg text-gray-900 mb-4">
            الدفعات الحالية
          </h2>

          <div className="space-y-3">

            {batches.map(
              (batch, index) => (
                <div
                  key={batch.id}
                  className="border rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-gray-800">
                      الدفعة {index + 1}
                    </div>

                    <div className="text-sm text-gray-500 mt-1">
                      {batch.expiry_date
                        ? `انتهاء: ${batch.expiry_date}`
                        : "بدون تاريخ انتهاء"}
                    </div>
                  </div>

                  <div className="font-bold text-gray-900">
                    {batch.quantity.toLocaleString(
                      "ar-JO"
                    )}
                  </div>
                </div>
              )
            )}

            {batches.length === 0 && (
              <div className="text-center text-gray-500 py-6">
                لا يوجد مخزون متوفر.
              </div>
            )}

          </div>
        </div>

      </div>
    </main>
  );
}