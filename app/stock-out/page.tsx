"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  image_url: string | null;
};

type ProductUnit = {
  id: string;
  unit_id: string;
  conversion_factor: number;
  is_base_unit: boolean;
  units: {
    id: string;
    name: string;
    symbol: string | null;
  } | null;
};

type ProductSearchItem = {
  id: string;
  name: string;
  barcode: string | null;
  image_url: string | null;
};

export default function QuickStockOutPage() {
  const router = useRouter();
  const supabase = createClient();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchItem[]>([]);
  const [showResults, setShowResults] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);

  const [totalStock, setTotalStock] = useState(0);

  const [quantity, setQuantity] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const [notes, setNotes] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --------------------------------------------------
  // البحث عن المنتجات بالاسم
  // --------------------------------------------------

  useEffect(() => {
    const timer = setTimeout(() => {
      void searchProducts(search);
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  async function searchProducts(value: string) {
    const cleanSearch = value.trim();

    if (!cleanSearch) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setLoadingProducts(true);

    try {
      const { data, error: searchError } = await supabase
        .from("products")
        .select("id, name, barcode, image_url")
        .eq("is_active", true)
        .ilike("name", `%${cleanSearch}%`)
        .order("name", { ascending: true })
        .limit(20);

      if (searchError) {
        throw searchError;
      }

      setSearchResults(data || []);
      setShowResults(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "حدث خطأ أثناء البحث عن المنتجات");
    } finally {
      setLoadingProducts(false);
    }
  }

  // --------------------------------------------------
  // اختيار المنتج
  // --------------------------------------------------

  async function selectProduct(productData: ProductSearchItem) {
    setLoadingProduct(true);
    setError("");
    setSuccess("");
    setShowResults(false);

    try {
      setProduct(productData);

      // تحميل الوحدات
      const { data: unitsData, error: unitsError } =
        await supabase
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
          .eq("product_id", productData.id)
          .order("is_base_unit", { ascending: false });

      if (unitsError) {
        throw unitsError;
      }

      const normalizedUnits: ProductUnit[] = (
        unitsData || []
      ).map((item: any) => ({
        id: item.id,
        unit_id: item.unit_id,
        conversion_factor: Number(
          item.conversion_factor || 1,
        ),
        is_base_unit: Boolean(item.is_base_unit),
        units: Array.isArray(item.units)
          ? item.units[0] || null
          : item.units || null,
      }));

      setProductUnits(normalizedUnits);

      // تحميل المخزون الحالي
      const { data: batchesData, error: batchesError } =
        await supabase
          .from("batches")
          .select("quantity")
          .eq("product_id", productData.id);

      if (batchesError) {
        throw batchesError;
      }

      const stock = (batchesData || []).reduce(
        (sum, batch) =>
          sum + Number(batch.quantity || 0),
        0,
      );

      setTotalStock(stock);

      // اختيار الوحدة الأساسية
      const baseUnit = normalizedUnits.find(
        (unit) => unit.is_base_unit,
      );

      if (baseUnit) {
        setSelectedUnitId(baseUnit.unit_id);
      } else if (normalizedUnits.length > 0) {
        setSelectedUnitId(
          normalizedUnits[0].unit_id,
        );
      } else {
        setSelectedUnitId("");
      }

      setQuantity("");

      setTimeout(() => {
        quantityInputRef.current?.focus();
      }, 150);
    } catch (err: any) {
      console.error(err);

      setProduct(null);
      setProductUnits([]);
      setTotalStock(0);

      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل بيانات المنتج",
      );
    } finally {
      setLoadingProduct(false);
    }
  }

  // --------------------------------------------------
  // مسح المنتج الحالي
  // --------------------------------------------------

  function resetProduct() {
    setProduct(null);
    setProductUnits([]);
    setSelectedUnitId("");

    setTotalStock(0);
    setQuantity("");

    setNotes("");
    setShowAdvanced(false);

    setSearch("");
    setSearchResults([]);
    setShowResults(false);

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }

  // --------------------------------------------------
  // الوحدة المختارة
  // --------------------------------------------------

  const selectedUnit = productUnits.find(
    (unit) => unit.unit_id === selectedUnitId,
  );

  const numericQuantity = Number(quantity || 0);

  const baseQuantity =
    selectedUnit && numericQuantity > 0
      ? numericQuantity *
        Number(selectedUnit.conversion_factor || 1)
      : 0;

  const remainingStock = Math.max(
    0,
    totalStock - baseQuantity,
  );

  // --------------------------------------------------
  // حفظ إخراج المخزون
  // --------------------------------------------------

  async function handleSave() {
    if (!product) {
      setError("اختر المنتج أولًا");
      return;
    }

    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      setError("أدخل كمية صحيحة أكبر من صفر");
      quantityInputRef.current?.focus();
      return;
    }

    if (!selectedUnitId) {
      setError("اختر الوحدة");
      return;
    }

    if (baseQuantity > totalStock) {
      setError(
        `الكمية المطلوبة أكبر من المخزون المتوفر (${totalStock})`,
      );

      quantityInputRef.current?.focus();

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { error: rpcError } =
        await supabase.rpc("remove_stock", {
          p_product_id: product.id,
          p_quantity: qty,
          p_unit_id: selectedUnitId,
          p_notes: notes.trim() || null,
        });

      if (rpcError) {
        throw rpcError;
      }

      setSuccess(
        `تم إخراج ${qty} ${
          selectedUnit?.units?.name || ""
        } بنجاح`,
      );

      // تجهيز الشاشة للمنتج التالي
      resetProduct();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء إخراج المخزون",
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // Enter = حفظ
  // --------------------------------------------------

  function handleQuantityKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();

      if (!saving) {
        void handleSave();
      }
    }
  }

  // --------------------------------------------------
  // تنظيف رسالة النجاح
  // --------------------------------------------------

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      setSuccess("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [success]);

  // --------------------------------------------------
  // الواجهة
  // --------------------------------------------------

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6"
    >
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              📤 إخراج مخزون
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              اختر المنتج بالاسم ثم أدخل الكمية وأخرجها بسرعة
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            الرئيسية
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            ❌ {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            ✅ {success}
          </div>
        )}

        {/* Product Search */}
        {!product && (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3">
              <h2 className="font-black text-slate-900">
                1. اختر المنتج
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                اكتب اسم المنتج وسيظهر لك مباشرة
              </p>
            </div>

            <div className="relative">
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setError("");
                }}
                onFocus={() => {
                  if (
                    search.trim() &&
                    searchResults.length > 0
                  ) {
                    setShowResults(true);
                  }
                }}
                placeholder="🔍 ابحث باسم المنتج..."
                autoComplete="off"
                className="min-h-16 w-full rounded-2xl border-2 border-slate-300 bg-slate-50 px-5 text-lg font-bold outline-none transition focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100"
              />

              {loadingProducts && (
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  ⏳
                </div>
              )}

              {showResults && search.trim() && (
                <div className="absolute right-0 left-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  {searchResults.length > 0 ? (
                    searchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          void selectProduct(item)
                        }
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-right transition hover:bg-red-50 active:bg-red-100"
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                            📦
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black text-slate-900">
                            {item.name}
                          </p>

                          {item.barcode && (
                            <p
                              dir="ltr"
                              className="mt-1 text-right text-xs text-slate-400"
                            >
                              {item.barcode}
                            </p>
                          )}
                        </div>

                        <span className="text-red-600">
                          ←
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="p-5 text-center text-sm font-bold text-slate-500">
                      لا يوجد منتج بهذا الاسم
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Loading */}
        {loadingProduct && (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 text-center font-bold text-slate-500">
            ⏳ جاري تحميل بيانات المنتج...
          </div>
        )}

        {/* Product */}
        {product && (
          <section className="mt-4 overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">

            {/* Product Header */}
            <div className="flex items-center gap-4 bg-red-50 p-4 sm:p-5">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-20 w-20 rounded-2xl border border-white bg-white object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
                  📦
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-red-700">
                  المنتج المحدد
                </p>

                <h2 className="mt-1 truncate text-xl font-black text-slate-900">
                  {product.name}
                </h2>

                {product.barcode && (
                  <p
                    dir="ltr"
                    className="mt-1 text-left text-xs text-slate-400"
                  >
                    {product.barcode}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={resetProduct}
                className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm transition hover:bg-slate-100"
              >
                تغيير
              </button>
            </div>

            <div className="p-4 sm:p-5">

              {/* Current Stock */}
              <div className="mb-4 rounded-2xl bg-slate-900 px-4 py-4 text-center text-white">
                <p className="text-xs font-bold text-slate-300">
                  المخزون المتوفر
                </p>

                <p className="mt-1 text-3xl font-black">
                  {totalStock.toLocaleString("ar-JO")}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  بالوحدة الأساسية
                </p>
              </div>

              {/* Quantity */}
              <div className="mb-2">
                <h3 className="font-black text-slate-900">
                  2. أدخل الكمية
                </h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    الكمية
                  </label>

                  <input
                    ref={quantityInputRef}
                    type="number"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(event.target.value)
                    }
                    onKeyDown={handleQuantityKeyDown}
                    placeholder="مثال: 20"
                    inputMode="decimal"
                    className="min-h-16 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-center text-2xl font-black outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    الوحدة
                  </label>

                  <select
                    value={selectedUnitId}
                    onChange={(event) =>
                      setSelectedUnitId(event.target.value)
                    }
                    className="min-h-16 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-center text-lg font-black outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  >
                    {productUnits.map((unit) => (
                      <option
                        key={unit.unit_id}
                        value={unit.unit_id}
                      >
                        {unit.units?.name || "وحدة"}

                        {!unit.is_base_unit &&
                        Number(unit.conversion_factor) !== 1
                          ? ` — ×${unit.conversion_factor}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conversion */}
              {selectedUnit && numericQuantity > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-800">
                    📤 سيتم إخراج{" "}
                    <span className="text-base">
                      {baseQuantity.toLocaleString("ar-JO")}
                    </span>{" "}
                    من الوحدة الأساسية
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-3 text-center text-sm font-bold ${
                      baseQuantity <= totalStock
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    📦 المتبقي بعد العملية:{" "}
                    {remainingStock.toLocaleString("ar-JO")}
                  </div>
                </div>
              )}

              {/* FEFO */}
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-black text-amber-800">
                  📅 سيتم اختيار الدفعات تلقائيًا
                </p>

                <p className="mt-1 text-xs leading-5 text-amber-700">
                  النظام يخرج من الدفعات الأقرب إلى الانتهاء أولًا
                  (FEFO)، لذلك لا تحتاج لاختيار الدفعة يدويًا.
                </p>
              </div>

              {/* Advanced */}
              <div className="mt-4 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setShowAdvanced((value) => !value)
                  }
                  className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-right font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  <span>⚙️ تفاصيل إضافية</span>

                  <span className="text-sm">
                    {showAdvanced ? "▲ إخفاء" : "▼ إظهار"}
                  </span>
                </button>

                {showAdvanced && (
                  <div className="mt-3">
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      ملاحظات
                    </label>

                    <textarea
                      value={notes}
                      onChange={(event) =>
                        setNotes(event.target.value)
                      }
                      placeholder="اختياري"
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 font-bold outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    />
                  </div>
                )}
              </div>

              {/* Save */}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={
                  saving ||
                  !quantity ||
                  !selectedUnitId ||
                  baseQuantity > totalStock
                }
                className="mt-5 min-h-16 w-full rounded-2xl bg-red-600 text-lg font-black text-white shadow-md transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "⏳ جاري الحفظ..."
                  : "📤 حفظ إخراج المخزون"}
              </button>

              <p className="mt-3 text-center text-xs text-slate-400">
                يمكنك الضغط على Enter بعد كتابة الكمية للإخراج مباشرة
              </p>
            </div>
          </section>
        )}

        {/* Empty State */}
        {!product && !loadingProduct && (
          <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="text-5xl">📤</div>

            <h2 className="mt-4 font-black text-slate-800">
              جاهز لإخراج المخزون
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              ابحث عن اسم المنتج، اختره، ثم اكتب الكمية واضغط حفظ.
              <br />
              بعد الحفظ يمكنك مباشرة اختيار المنتج التالي.
            </p>
          </div>
        )}

        {/* Bottom Shortcuts */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.push("/stock-in")}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 font-black text-emerald-700 transition hover:bg-emerald-100"
          >
            📥 إدخال مخزون
          </button>

          <button
            type="button"
            onClick={() => router.push("/products")}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-black text-slate-700 transition hover:bg-slate-100"
          >
            📦 المنتجات
          </button>
        </div>
      </div>
    </main>
  );
}