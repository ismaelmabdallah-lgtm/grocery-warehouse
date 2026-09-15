"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Category = {
  id: string;
  name: string;
  icon: string | null;
};

type Unit = {
  id: string;
  name: string;
  symbol: string | null;
};

type ExtraUnit = {
  unitId: string;
  conversionFactor: string;
};

export default function NewProductPage() {
  const router = useRouter();
  const supabase = createClient();

  const nameInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [baseUnitId, setBaseUnitId] = useState("");

  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const [minimumStock, setMinimumStock] = useState("0");
  const [barcode, setBarcode] = useState("");

  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");

  const [description, setDescription] = useState("");

  const [extraUnits, setExtraUnits] = useState<ExtraUnit[]>([]);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  const [showImage, setShowImage] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ---------------------------------------------------------
  // تحميل التصنيفات والوحدات
  // ---------------------------------------------------------

  useEffect(() => {
    loadOptions();

    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 200);
  }, []);

  async function loadOptions() {
    setLoadingOptions(true);
    setError("");

    const [categoriesResult, unitsResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, icon")
        .order("name"),

      supabase
        .from("units")
        .select("id, name, symbol")
        .order("name"),
    ]);

    if (categoriesResult.error) {
      console.error(categoriesResult.error);
      setError("تعذر تحميل التصنيفات.");
      setLoadingOptions(false);
      return;
    }

    if (unitsResult.error) {
      console.error(unitsResult.error);
      setError("تعذر تحميل الوحدات.");
      setLoadingOptions(false);
      return;
    }

    setCategories(categoriesResult.data ?? []);
    setUnits(unitsResult.data ?? []);

    setLoadingOptions(false);
  }

  // ---------------------------------------------------------
  // الصورة
  // ---------------------------------------------------------

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setError("");

    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("يرجى اختيار ملف صورة فقط.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
      event.target.value = "";
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  }

  function removeImage() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(null);
    setImagePreview("");
  }

  // ---------------------------------------------------------
  // الوحدات الإضافية
  // ---------------------------------------------------------

  function addExtraUnit() {
    setShowUnits(true);

    setExtraUnits((current) => [
      ...current,
      {
        unitId: "",
        conversionFactor: "",
      },
    ]);
  }

  function removeExtraUnit(index: number) {
    setExtraUnits((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function updateExtraUnit(
    index: number,
    field: keyof ExtraUnit,
    value: string,
  ) {
    setExtraUnits((current) =>
      current.map((unit, currentIndex) =>
        currentIndex === index
          ? {
              ...unit,
              [field]: value,
            }
          : unit,
      ),
    );
  }

  function getUnitName(unitId: string) {
    return (
      units.find((unit) => unit.id === unitId)?.name ?? ""
    );
  }

  function getAvailableUnits(currentIndex: number) {
    const selectedOtherUnits = extraUnits
      .map((unit, index) =>
        index === currentIndex ? null : unit.unitId,
      )
      .filter(Boolean);

    return units.filter(
      (unit) =>
        unit.id !== baseUnitId &&
        !selectedOtherUnits.includes(unit.id),
    );
  }

  // ---------------------------------------------------------
  // رفع الصورة
  // ---------------------------------------------------------

  async function uploadProductImage(
    file: File,
    productId: string,
  ) {
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath = `${productId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return {
      filePath,
      publicUrl: data.publicUrl,
    };
  }

  // ---------------------------------------------------------
  // حفظ المنتج
  // ---------------------------------------------------------

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("يرجى كتابة اسم المنتج.");
      nameInputRef.current?.focus();
      return;
    }

    if (!baseUnitId) {
      setError("يرجى اختيار الوحدة الأساسية.");
      return;
    }

    const quantityNumber = Number(quantity || 0);
    const minimumStockNumber = Number(minimumStock || 0);

    if (
      !Number.isFinite(quantityNumber) ||
      quantityNumber < 0
    ) {
      setError("الكمية غير صحيحة.");
      return;
    }

    if (
      !Number.isFinite(minimumStockNumber) ||
      minimumStockNumber < 0
    ) {
      setError("الحد الأدنى للمخزون غير صحيح.");
      return;
    }

    for (const extraUnit of extraUnits) {
      if (!extraUnit.unitId) {
        setError("يرجى اختيار الوحدة لكل وحدة إضافية.");
        return;
      }

      const factor = Number(extraUnit.conversionFactor);

      if (!Number.isFinite(factor) || factor <= 0) {
        setError("معامل التحويل يجب أن يكون أكبر من صفر.");
        return;
      }
    }

    setLoading(true);

    let productId: string | null = null;
    let uploadedImagePath: string | null = null;

    try {
      // -------------------------------------------------------
      // 1. إنشاء المنتج
      // -------------------------------------------------------

      const { data: product, error: productError } =
        await supabase
          .from("products")
          .insert({
            name: name.trim(),
            category_id: categoryId || null,

            // الباركود اختياري
            barcode: barcode.trim() || null,

            minimum_stock: minimumStockNumber,

            purchase_price: purchasePrice
              ? Number(purchasePrice)
              : null,

            selling_price: sellingPrice
              ? Number(sellingPrice)
              : null,

            description: description.trim() || null,
          })
          .select("id")
          .single();

      if (productError) {
        throw productError;
      }

      productId = product.id;

      // -------------------------------------------------------
      // 2. رفع الصورة
      // -------------------------------------------------------

      let imageUrl: string | null = null;

      if (imageFile) {
        const uploaded = await uploadProductImage(
          imageFile,
          product.id,
        );

        uploadedImagePath = uploaded.filePath;
        imageUrl = uploaded.publicUrl;

        const { error: imageUpdateError } =
          await supabase
            .from("products")
            .update({
              image_url: imageUrl,
            })
            .eq("id", product.id);

        if (imageUpdateError) {
          throw imageUpdateError;
        }
      }

      // -------------------------------------------------------
      // 3. الوحدة الأساسية
      // -------------------------------------------------------

      const { error: baseUnitError } = await supabase
        .from("product_units")
        .insert({
          product_id: product.id,
          unit_id: baseUnitId,
          conversion_factor: 1,
          is_base_unit: true,
        });

      if (baseUnitError) {
        throw baseUnitError;
      }

      // -------------------------------------------------------
      // 4. الوحدات الإضافية
      // -------------------------------------------------------

      if (extraUnits.length > 0) {
        const extraUnitRows = extraUnits.map((unit) => ({
          product_id: product.id,
          unit_id: unit.unitId,
          conversion_factor: Number(
            unit.conversionFactor,
          ),
          is_base_unit: false,
        }));

        const { error: extraUnitsError } =
          await supabase
            .from("product_units")
            .insert(extraUnitRows);

        if (extraUnitsError) {
          throw extraUnitsError;
        }
      }

      // -------------------------------------------------------
      // 5. الدفعة الأولى
      // -------------------------------------------------------

      if (quantityNumber > 0 || expiryDate) {
        const { error: batchError } =
          await supabase
            .from("batches")
            .insert({
              product_id: product.id,
              quantity: quantityNumber,
              expiry_date: expiryDate || null,
              purchase_price: purchasePrice
                ? Number(purchasePrice)
                : null,
            });

        if (batchError) {
          throw batchError;
        }
      }

      // -------------------------------------------------------
      // 6. حركة الإدخال الأولى
      // -------------------------------------------------------

      if (quantityNumber > 0) {
        const { error: movementError } =
          await supabase
            .from("inventory_movements")
            .insert({
              product_id: product.id,
              quantity: quantityNumber,
              unit_id: baseUnitId,
              movement_type: "IN",
              notes: "إضافة المنتج لأول مرة",
            });

        if (movementError) {
          throw movementError;
        }
      }

      // -------------------------------------------------------
      // نجاح
      // -------------------------------------------------------

      setSuccess("تمت إضافة المنتج بنجاح.");

      // ننتظر لحظة قصيرة حتى يرى المستخدم رسالة النجاح
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 500);
    } catch (err: any) {
      console.error(err);

      // حذف الصورة إذا حدث خطأ
      if (uploadedImagePath) {
        await supabase.storage
          .from("product-images")
          .remove([uploadedImagePath]);
      }

      // حذف المنتج وما يرتبط به
      if (productId) {
        await supabase
          .from("products")
          .delete()
          .eq("id", productId);
      }

      setError(
        err?.message ||
          "حدث خطأ أثناء حفظ المنتج. تأكد من البيانات وحاول مرة أخرى.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------
  // الواجهة
  // ---------------------------------------------------------

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6"
    >
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              ➕ إضافة منتج
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              أضف المنتج بسرعة، والتفاصيل الإضافية اختيارية.
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

        {/* رسائل */}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* =================================================
              البيانات الأساسية
          ================================================= */}

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-black text-slate-900">
                📦 البيانات الأساسية
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                هذه هي البيانات التي تحتاجها غالبًا لإضافة المنتج.
              </p>
            </div>

            <div className="space-y-4">
              {/* الاسم */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  اسم المنتج *
                </label>

                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="مثال: مياه أروى"
                  autoComplete="off"
                  required
                  className="min-h-14 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-lg font-bold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* التصنيف + الوحدة */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    التصنيف
                  </label>

                  <select
                    value={categoryId}
                    onChange={(event) =>
                      setCategoryId(event.target.value)
                    }
                    disabled={loadingOptions}
                    className="min-h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">
                      بدون تصنيف
                    </option>

                    {categories.map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.icon
                          ? `${category.icon} `
                          : ""}
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    الوحدة الأساسية *
                  </label>

                  <select
                    value={baseUnitId}
                    onChange={(event) =>
                      setBaseUnitId(event.target.value)
                    }
                    disabled={loadingOptions}
                    required
                    className="min-h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                        {unit.symbol
                          ? ` (${unit.symbol})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* الباركود */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  الباركود
                  <span className="mr-2 text-xs font-normal text-slate-400">
                    اختياري
                  </span>
                </label>

                <input
                  type="text"
                  value={barcode}
                  onChange={(event) =>
                    setBarcode(event.target.value)
                  }
                  placeholder="إذا كان للمنتج باركود أدخله هنا"
                  inputMode="numeric"
                  autoComplete="off"
                  enterKeyHint="next"
                  dir="ltr"
                  className="min-h-14 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 text-center font-bold tracking-wider outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />

                <p className="mt-1 text-xs text-slate-400">
                  يمكنك تركه فارغًا إذا لم يكن المنتج لديه باركود.
                </p>
              </div>

              {/* الكمية + الانتهاء */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    الكمية الحالية
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(event.target.value)
                    }
                    placeholder="مثال: 247"
                    inputMode="decimal"
                    className="min-h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-center text-xl font-black outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    تاريخ الانتهاء
                    <span className="mr-2 text-xs font-normal text-slate-400">
                      اختياري
                    </span>
                  </label>

                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(event) =>
                      setExpiryDate(event.target.value)
                    }
                    className="min-h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* حفظ */}
              <button
                type="submit"
                disabled={loading || loadingOptions}
                className="min-h-16 w-full rounded-2xl bg-blue-600 text-lg font-black text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "⏳ جاري الحفظ..."
                  : "💾 حفظ المنتج"}
              </button>

              <p className="text-center text-xs text-slate-400">
                الباركود والتصنيف وتاريخ الانتهاء يمكن تركها فارغة.
              </p>
            </div>
          </section>

          {/* =================================================
              الوحدات الإضافية
          ================================================= */}

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() =>
                setShowUnits((value) => !value)
              }
              className="flex w-full items-center justify-between p-5 text-right transition hover:bg-slate-50"
            >
              <div>
                <h2 className="font-black text-slate-900">
                  📦 وحدات إضافية
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  مثال: 1 كرتونة = 24 حبة
                </p>
              </div>

              <span className="font-bold text-slate-500">
                {showUnits ? "▲" : "▼"}
              </span>
            </button>

            {showUnits && (
              <div className="border-t border-slate-100 p-5">
                {!baseUnitId && (
                  <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-700">
                    ⚠️ اختر الوحدة الأساسية أولًا.
                  </div>
                )}

                {baseUnitId && (
                  <>
                    <div className="rounded-2xl bg-blue-50 p-4">
                      <p className="text-xs font-bold text-blue-700">
                        الوحدة الأساسية
                      </p>

                      <p className="mt-1 font-black text-blue-950">
                        {getUnitName(baseUnitId)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addExtraUnit}
                      className="mt-4 min-h-12 w-full rounded-2xl bg-blue-50 font-black text-blue-700 transition hover:bg-blue-100"
                    >
                      ➕ إضافة وحدة إضافية
                    </button>

                    {extraUnits.length === 0 && (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-center">
                        <div className="text-3xl">📦</div>

                        <p className="mt-2 text-sm font-bold text-slate-600">
                          لا توجد وحدات إضافية
                        </p>
                      </div>
                    )}

                    <div className="mt-4 space-y-3">
                      {extraUnits.map(
                        (extraUnit, index) => {
                          const selectedUnit =
                            getUnitName(
                              extraUnit.unitId,
                            );

                          const factor = Number(
                            extraUnit.conversionFactor,
                          );

                          return (
                            <div
                              key={index}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                                <div>
                                  <label className="mb-2 block text-sm font-bold text-slate-700">
                                    الوحدة
                                  </label>

                                  <select
                                    value={
                                      extraUnit.unitId
                                    }
                                    onChange={(event) =>
                                      updateExtraUnit(
                                        index,
                                        "unitId",
                                        event.target
                                          .value,
                                      )
                                    }
                                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 font-bold outline-none focus:border-blue-500"
                                  >
                                    <option value="">
                                      اختر الوحدة
                                    </option>

                                    {getAvailableUnits(
                                      index,
                                    ).map((unit) => (
                                      <option
                                        key={unit.id}
                                        value={unit.id}
                                      >
                                        {unit.name}
                                        {unit.symbol
                                          ? ` (${unit.symbol})`
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-bold text-slate-700">
                                    تحتوي على
                                  </label>

                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="0.001"
                                      step="0.001"
                                      value={
                                        extraUnit.conversionFactor
                                      }
                                      onChange={(event) =>
                                        updateExtraUnit(
                                          index,
                                          "conversionFactor",
                                          event.target
                                            .value,
                                        )
                                      }
                                      placeholder="24"
                                      className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-center font-bold outline-none focus:border-blue-500"
                                    />

                                    <span className="whitespace-nowrap text-xs font-bold text-slate-500">
                                      {getUnitName(
                                        baseUnitId,
                                      )}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeExtraUnit(
                                      index,
                                    )
                                  }
                                  className="min-h-12 rounded-xl bg-red-50 px-4 font-bold text-red-600 hover:bg-red-100"
                                >
                                  🗑️
                                </button>
                              </div>

                              {selectedUnit &&
                                factor > 0 && (
                                  <div className="mt-3 rounded-xl bg-white p-3 text-center text-sm">
                                    1{" "}
                                    <strong>
                                      {selectedUnit}
                                    </strong>{" "}
                                    ={" "}
                                    <strong className="text-blue-700">
                                      {factor}{" "}
                                      {getUnitName(
                                        baseUnitId,
                                      )}
                                    </strong>
                                  </div>
                                )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* =================================================
              التفاصيل الإضافية
          ================================================= */}

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() =>
                setShowAdvanced((value) => !value)
              }
              className="flex w-full items-center justify-between p-5 text-right transition hover:bg-slate-50"
            >
              <div>
                <h2 className="font-black text-slate-900">
                  ⚙️ تفاصيل إضافية
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  الأسعار، الحد الأدنى، الصورة والملاحظات
                </p>
              </div>

              <span className="font-bold text-slate-500">
                {showAdvanced ? "▲" : "▼"}
              </span>
            </button>

            {showAdvanced && (
              <div className="space-y-4 border-t border-slate-100 p-5">
                {/* الحد الأدنى */}
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    الحد الأدنى للمخزون
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={minimumStock}
                    onChange={(event) =>
                      setMinimumStock(event.target.value)
                    }
                    placeholder="0"
                    className="min-h-12 w-full rounded-2xl border border-slate-300 px-4 font-bold outline-none focus:border-blue-500"
                  />
                </div>

                {/* الأسعار */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      سعر الشراء
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={purchasePrice}
                      onChange={(event) =>
                        setPurchasePrice(event.target.value)
                      }
                      placeholder="اختياري"
                      inputMode="decimal"
                      className="min-h-12 w-full rounded-2xl border border-slate-300 px-4 font-bold outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      سعر البيع
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={sellingPrice}
                      onChange={(event) =>
                        setSellingPrice(event.target.value)
                      }
                      placeholder="اختياري"
                      inputMode="decimal"
                      className="min-h-12 w-full rounded-2xl border border-slate-300 px-4 font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* الصورة */}
                <div className="rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() =>
                      setShowImage((value) => !value)
                    }
                    className="flex w-full items-center justify-between p-4 text-right font-bold text-slate-700"
                  >
                    <span>📸 صورة المنتج</span>

                    <span className="text-sm text-slate-400">
                      {showImage ? "▲" : "▼"}
                    </span>
                  </button>

                  {showImage && (
                    <div className="border-t border-slate-100 p-4">
                      {!imagePreview ? (
                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-blue-400 hover:bg-blue-50">
                          <div className="text-4xl">
                            📷
                          </div>

                          <div className="mt-3 text-sm font-bold text-slate-700">
                            اختر صورة المنتج
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            JPG / PNG / WEBP — حتى 5MB
                          </div>

                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="overflow-hidden rounded-2xl border bg-slate-50">
                          <div className="flex justify-center p-4">
                            <img
                              src={imagePreview}
                              alt="معاينة المنتج"
                              className="max-h-64 rounded-xl object-contain"
                            />
                          </div>

                          <div className="flex flex-col gap-2 border-t bg-white p-3 sm:flex-row">
                            <label className="cursor-pointer rounded-xl bg-blue-50 px-4 py-3 text-center text-sm font-bold text-blue-700">
                              🔄 تغيير الصورة

                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="hidden"
                              />
                            </label>

                            <button
                              type="button"
                              onClick={removeImage}
                              className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600"
                            >
                              🗑️ حذف
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* الوصف */}
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    ملاحظات / وصف
                  </label>

                  <textarea
                    value={description}
                    onChange={(event) =>
                      setDescription(event.target.value)
                    }
                    placeholder="اختياري"
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-slate-300 px-4 py-3 font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </section>

          {/* زر الحفظ السفلي */}
          <button
            type="submit"
            disabled={loading || loadingOptions}
            className="min-h-16 w-full rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "⏳ جاري حفظ المنتج..."
              : "💾 حفظ المنتج"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            disabled={loading}
            className="w-full rounded-2xl bg-slate-200 py-4 font-bold text-slate-700 transition hover:bg-slate-300"
          >
            إلغاء
          </button>
        </form>
      </div>
    </main>
  );
}