"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type ProductUnit = {
  id: string;
  unit_id: string;
  conversion_factor: number;
  is_base_unit: boolean;
  units: {
    name: string;
    symbol: string | null;
  } | null;
};

type Product = {
  id: string;
  name: string;
  image_url: string | null;
};

export default function StockInPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);

  const [quantity, setQuantity] = useState("");
  const [unitId, setUnitId] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, [productId]);

  async function loadData() {
    setLoading(true);
    setError("");

    const [productResult, unitsResult] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, image_url")
        .eq("id", productId)
        .single(),

      supabase
        .from("product_units")
        .select(
          `
          id,
          unit_id,
          conversion_factor,
          is_base_unit,
          units (
            name,
            symbol
          )
        `
        )
        .eq("product_id", productId)
        .order("is_base_unit", { ascending: false }),
    ]);

    if (productResult.error) {
      setError("تعذر تحميل بيانات المنتج.");
      setLoading(false);
      return;
    }

    if (unitsResult.error) {
      setError("تعذر تحميل وحدات المنتج.");
      setLoading(false);
      return;
    }

    setProduct(productResult.data);

    const units = (unitsResult.data || []) as unknown as ProductUnit[];

    setProductUnits(units);

    const baseUnit = units.find((unit) => unit.is_base_unit);

    if (baseUnit) {
      setUnitId(baseUnit.unit_id);
    }

    setLoading(false);
  }

  const selectedUnit = productUnits.find(
    (unit) => unit.unit_id === unitId
  );

  const conversionFactor = selectedUnit
    ? Number(selectedUnit.conversion_factor)
    : 1;

  const enteredQuantity = Number(quantity) || 0;

  const baseQuantity =
    enteredQuantity > 0
      ? enteredQuantity * conversionFactor
      : 0;

  const baseUnit = productUnits.find(
    (unit) => unit.is_base_unit
  );

  const baseUnitName =
    baseUnit?.units?.name || "الوحدة الأساسية";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!quantity || Number(quantity) <= 0) {
      setError("أدخل كمية صحيحة أكبر من صفر.");
      return;
    }

    if (!unitId) {
      setError("اختر وحدة الكمية.");
      return;
    }

    setSaving(true);

    const { data, error: rpcError } = await supabase.rpc(
      "add_stock",
      {
        p_product_id: productId,
        p_quantity: Number(quantity),
        p_unit_id: unitId,
        p_expiry_date: expiryDate || null,
        p_batch_code: batchCode.trim() || null,
        p_purchase_price:
          purchasePrice.trim() !== ""
            ? Number(purchasePrice)
            : null,
        p_notes: notes.trim() || null,
      }
    );

    if (rpcError) {
      console.error(rpcError);
      setError(rpcError.message || "حدث خطأ أثناء إدخال المخزون.");
      setSaving(false);
      return;
    }

    console.log("Stock added:", data);

    setSuccess("تم إدخال المخزون بنجاح ✅");

    setQuantity("");
    setExpiryDate("");
    setBatchCode("");
    setPurchasePrice("");
    setNotes("");

    setTimeout(() => {
      router.push(`/products/${productId}`);
      router.refresh();
    }, 800);
  }

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

  if (!product) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-gray-50 p-6"
      >
        <div className="max-w-3xl mx-auto bg-white rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            المنتج غير موجود
          </h1>

          <button
            onClick={() => router.push("/products")}
            className="mt-4 px-5 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            العودة إلى المنتجات
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50 p-4 md:p-8"
    >
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() =>
                router.push(`/products/${productId}`)
              }
              className="text-sm text-gray-500 hover:text-gray-800 mb-2"
            >
              ← العودة إلى المنتج
            </button>

            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              إدخال مخزون
            </h1>

            <p className="text-gray-500 mt-1">
              إضافة دفعة جديدة إلى مخزون:
              <span className="font-semibold text-gray-800 mr-1">
                {product.name}
              </span>
            </p>
          </div>

          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-2xl border bg-white"
            />
          )}
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border p-5 md:p-7 space-y-6"
        >

          {/* Quantity */}
          <div>
            <label className="block font-semibold text-gray-800 mb-2">
              الكمية *
            </label>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="مثال: 5"
                className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full border rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">اختر الوحدة</option>

                {productUnits.map((item) => (
                  <option
                    key={item.id}
                    value={item.unit_id}
                  >
                    {item.units?.name || "وحدة"}
                    {item.is_base_unit
                      ? " — أساسية"
                      : ` — 1 = ${item.conversion_factor} ${baseUnitName}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Conversion preview */}
            {enteredQuantity > 0 && selectedUnit && (
              <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="text-sm text-blue-700">
                  سيتم إضافة:
                </div>

                <div className="text-xl font-bold text-blue-900 mt-1">
                  {baseQuantity.toLocaleString("ar-JO")}
                  {" "}
                  {baseUnitName}
                </div>

                {!selectedUnit.is_base_unit && (
                  <div className="text-sm text-blue-600 mt-1">
                    {enteredQuantity}{" "}
                    {selectedUnit.units?.name}
                    {" × "}
                    {conversionFactor}
                    {" = "}
                    {baseQuantity}{" "}
                    {baseUnitName}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expiry */}
          <div>
            <label className="block font-semibold text-gray-800 mb-2">
              تاريخ انتهاء الصلاحية
            </label>

            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />

            <p className="text-xs text-gray-500 mt-2">
              إذا كانت هذه الدفعة لها تاريخ صلاحية مختلف، سيتم
              حفظها كدفعة مستقلة.
            </p>
          </div>

          {/* Batch code */}
          <div>
            <label className="block font-semibold text-gray-800 mb-2">
              رقم الدفعة
              <span className="text-gray-400 font-normal mr-1">
                (اختياري)
              </span>
            </label>

            <input
              type="text"
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              placeholder="مثال: LOT-2026-09"
              className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Purchase price */}
          <div>
            <label className="block font-semibold text-gray-800 mb-2">
              سعر الشراء
              <span className="text-gray-400 font-normal mr-1">
                (اختياري)
              </span>
            </label>

            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.001"
                value={purchasePrice}
                onChange={(e) =>
                  setPurchasePrice(e.target.value)
                }
                placeholder="مثال: 1.200"
                className="w-full border rounded-xl px-4 py-3 pl-16 outline-none focus:ring-2 focus:ring-blue-500"
              />

              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                د.أ
              </span>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              يمكنك تسجيل سعر الشراء الخاص بهذه الدفعة.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-gray-800 mb-2">
              ملاحظات
              <span className="text-gray-400 font-normal mr-1">
                (اختياري)
              </span>
            </label>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات خاصة بهذه الدفعة..."
              rows={3}
              className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
              <div className="font-semibold">
                حدث خطأ
              </div>

              <div className="text-sm mt-1">
                {error}
              </div>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">
              {success}
            </div>
          )}

          {/* Summary */}
          {enteredQuantity > 0 && selectedUnit && (
            <div className="border rounded-2xl p-5 bg-gray-50">
              <h2 className="font-bold text-gray-900 mb-4">
                📦 ملخص الإدخال
              </h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    الكمية المدخلة
                  </span>

                  <span className="font-semibold">
                    {enteredQuantity}{" "}
                    {selectedUnit.units?.name}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">
                    معامل التحويل
                  </span>

                  <span className="font-semibold">
                    {conversionFactor}
                  </span>
                </div>

                <div className="border-t pt-2 mt-2 flex justify-between">
                  <span className="text-gray-700 font-semibold">
                    الإضافة الفعلية للمخزون
                  </span>

                  <span className="font-bold text-blue-700">
                    {baseQuantity.toLocaleString("ar-JO")}{" "}
                    {baseUnitName}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col-reverse md:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() =>
                router.push(`/products/${productId}`)
              }
              disabled={saving}
              className="flex-1 border border-gray-300 rounded-xl px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-xl px-5 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? "جاري الحفظ..."
                : "📦 حفظ إدخال المخزون"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}