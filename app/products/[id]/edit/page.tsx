"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
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

type ProductUnit = {
  id: string;
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

type ExtraUnit = {
  unitId: string;
  conversionFactor: string;
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
  description: string | null;
};

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [product, setProduct] = useState<Product | null>(null);

  const [currentStock, setCurrentStock] = useState(0);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [minimumStock, setMinimumStock] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [description, setDescription] = useState("");

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const [baseUnitId, setBaseUnitId] = useState("");
  const [originalBaseUnitId, setOriginalBaseUnitId] = useState("");
  const [extraUnits, setExtraUnits] = useState<ExtraUnit[]>([]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  const [showImage, setShowImage] = useState(false);

  const hasStock = currentStock > 0;

  useEffect(() => {
    loadData();
  }, [productId]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        productResult,
        categoriesResult,
        unitsResult,
        productUnitsResult,
        batchesResult,
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
              description
            `,
          )
          .eq("id", productId)
          .single(),

        supabase
          .from("categories")
          .select("id, name, icon")
          .order("name"),

        supabase
          .from("units")
          .select("id, name, symbol")
          .order("name"),

        supabase
          .from("product_units")
          .select(
            `
              id,
              unit_id,
              conversion_factor,
              is_base_unit,
              units (
                id,
                name,
                symbol
              )
            `,
          )
          .eq("product_id", productId),

        supabase
          .from("batches")
          .select("quantity")
          .eq("product_id", productId),
      ]);

      if (productResult.error) {
        throw productResult.error;
      }

      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      if (unitsResult.error) {
        throw unitsResult.error;
      }

      if (productUnitsResult.error) {
        throw productUnitsResult.error;
      }

      if (batchesResult.error) {
        throw batchesResult.error;
      }

      const rawProduct = productResult.data;

      const loadedProduct: Product = {
        id: rawProduct.id,
        name: rawProduct.name,
        category_id: rawProduct.category_id,
        image_url: rawProduct.image_url,
        barcode: rawProduct.barcode,
        minimum_stock: Number(rawProduct.minimum_stock || 0),
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
      };

      setProduct(loadedProduct);

      setName(loadedProduct.name);
      setCategoryId(loadedProduct.category_id || "");
      setBarcode(loadedProduct.barcode || "");
      setMinimumStock(String(loadedProduct.minimum_stock));

      setPurchasePrice(
        loadedProduct.purchase_price !== null
          ? String(loadedProduct.purchase_price)
          : "",
      );

      setSellingPrice(
        loadedProduct.selling_price !== null
          ? String(loadedProduct.selling_price)
          : "",
      );

      setSupplierName(
        loadedProduct.supplier_name || "",
      );

      setDescription(
        loadedProduct.description || "",
      );

      setImageUrl(loadedProduct.image_url);

      setCategories(categoriesResult.data || []);
      setUnits(unitsResult.data || []);

      const totalStock = (
        batchesResult.data || []
      ).reduce(
        (total, batch) =>
          total + Number(batch.quantity || 0),
        0,
      );

      setCurrentStock(totalStock);

      const rawProductUnits =
        (productUnitsResult.data || []) as ProductUnit[];

      let loadedBaseUnitId = "";
      const loadedExtraUnits: ExtraUnit[] = [];

      for (const item of rawProductUnits) {
        if (item.is_base_unit) {
          loadedBaseUnitId = item.unit_id;
        } else {
          loadedExtraUnits.push({
            unitId: item.unit_id,
            conversionFactor: String(
              item.conversion_factor,
            ),
          });
        }
      }

      setBaseUnitId(loadedBaseUnitId);
      setOriginalBaseUnitId(loadedBaseUnitId);
      setExtraUnits(loadedExtraUnits);

      if (loadedExtraUnits.length > 0) {
        setShowUnits(true);
      }

      if (loadedProduct.image_url) {
        setShowImage(true);
      }

      if (
        loadedProduct.purchase_price !== null ||
        loadedProduct.selling_price !== null ||
        loadedProduct.supplier_name ||
        loadedProduct.description
      ) {
        setShowAdvanced(true);
      }
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء تحميل بيانات المنتج.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("الملف المختار ليس صورة.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة يجب ألا يتجاوز 5MB.");
      return;
    }

    setError("");
    setSuccess("");

    setImageFile(file);
    setRemoveImage(false);

    const previewUrl =
      URL.createObjectURL(file);

    setImagePreview(previewUrl);
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  }

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
      current.filter(
        (_, itemIndex) =>
          itemIndex !== index,
      ),
    );
  }

  function updateExtraUnit(
    index: number,
    field: keyof ExtraUnit,
    value: string,
  ) {
    setExtraUnits((current) =>
      current.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item,
      ),
    );
  }

  function getAvailableExtraUnits(
    currentIndex: number,
  ) {
    const selectedElsewhere =
      extraUnits
        .map((item, index) =>
          index === currentIndex
            ? null
            : item.unitId,
        )
        .filter(Boolean);

    return units.filter(
      (unit) =>
        unit.id !== baseUnitId &&
        !selectedElsewhere.includes(
          unit.id,
        ),
    );
  }

  async function uploadImage(
    productId: string,
  ) {
    if (!imageFile) return null;

    const extension =
      imageFile.name
        .split(".")
        .pop()
        ?.toLowerCase() || "jpg";

    const filePath = `${productId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } =
      await supabase.storage
        .from("product-images")
        .upload(
          filePath,
          imageFile,
          {
            cacheControl: "3600",
            upsert: false,
            contentType:
              imageFile.type,
          },
        );

    if (uploadError) {
      throw uploadError;
    }

    const { data } =
      supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function deleteOldImage(
    oldImageUrl: string | null,
  ) {
    if (!oldImageUrl) return;

    try {
      const marker =
        "/product-images/";

      const index =
        oldImageUrl.indexOf(marker);

      if (index === -1) return;

      const path =
        oldImageUrl.substring(
          index + marker.length,
        );

      if (!path) return;

      await supabase.storage
        .from("product-images")
        .remove([path]);
    } catch (err) {
      console.warn(
        "Could not delete old image:",
        err,
      );
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const trimmedName =
      name.trim();

    if (!trimmedName) {
      setError(
        "اسم المنتج مطلوب.",
      );
      return;
    }

    if (!baseUnitId) {
      setError(
        "يجب اختيار الوحدة الأساسية.",
      );
      return;
    }

    if (
      hasStock &&
      baseUnitId !==
        originalBaseUnitId
    ) {
      setError(
        "لا يمكن تغيير الوحدة الأساسية لأن المنتج لديه مخزون حالي.",
      );

      setBaseUnitId(
        originalBaseUnitId,
      );

      return;
    }

    const {
      data: latestBatches,
      error: latestStockError,
    } = await supabase
      .from("batches")
      .select("quantity")
      .eq(
        "product_id",
        productId,
      );

    if (latestStockError) {
      throw latestStockError;
    }

    const latestStock =
      (latestBatches || []).reduce(
        (total, batch) =>
          total +
          Number(
            batch.quantity || 0,
          ),
        0,
      );

    if (
      latestStock > 0 &&
      baseUnitId !==
        originalBaseUnitId
    ) {
      setError(
        "تم اكتشاف مخزون حالي، لذلك لا يمكن تغيير الوحدة الأساسية.",
      );

      setCurrentStock(
        latestStock,
      );

      setBaseUnitId(
        originalBaseUnitId,
      );

      return;
    }

    const parsedMinimumStock =
      Number(
        minimumStock || 0,
      );

    if (
      Number.isNaN(
        parsedMinimumStock,
      ) ||
      parsedMinimumStock < 0
    ) {
      setError(
        "الحد الأدنى للمخزون غير صحيح.",
      );

      return;
    }

    const parsedPurchasePrice =
      purchasePrice.trim() === ""
        ? null
        : Number(purchasePrice);

    const parsedSellingPrice =
      sellingPrice.trim() === ""
        ? null
        : Number(sellingPrice);

    if (
      parsedPurchasePrice !==
        null &&
      (Number.isNaN(
        parsedPurchasePrice,
      ) ||
        parsedPurchasePrice < 0)
    ) {
      setError(
        "سعر الشراء غير صحيح.",
      );

      return;
    }

    if (
      parsedSellingPrice !==
        null &&
      (Number.isNaN(
        parsedSellingPrice,
      ) ||
        parsedSellingPrice < 0)
    ) {
      setError(
        "سعر البيع غير صحيح.",
      );

      return;
    }

    const cleanedExtraUnits: ExtraUnit[] =
      [];

    for (const extraUnit of extraUnits) {
      if (!extraUnit.unitId) {
        setError(
          "اختر الوحدة لكل وحدة إضافية.",
        );

        return;
      }

      const factor = Number(
        extraUnit.conversionFactor,
      );

      if (
        Number.isNaN(factor) ||
        factor <= 0
      ) {
        setError(
          "قيمة التحويل يجب أن تكون أكبر من صفر.",
        );

        return;
      }

      if (
        extraUnit.unitId ===
        baseUnitId
      ) {
        setError(
          "لا يمكن إضافة الوحدة الأساسية كوحدة إضافية.",
        );

        return;
      }

      const duplicate =
        cleanedExtraUnits.some(
          (item) =>
            item.unitId ===
            extraUnit.unitId,
        );

      if (duplicate) {
        setError(
          "لا يمكن تكرار نفس الوحدة الإضافية.",
        );

        return;
      }

      cleanedExtraUnits.push({
        unitId:
          extraUnit.unitId,
        conversionFactor:
          String(factor),
      });
    }

    try {
      setSaving(true);

      let newImageUrl =
        imageUrl;

      if (imageFile) {
        newImageUrl =
          await uploadImage(
            productId,
          );
      } else if (
        removeImage
      ) {
        newImageUrl = null;
      }

      const {
        error: productUpdateError,
      } = await supabase
        .from("products")
        .update({
          name: trimmedName,
          category_id:
            categoryId || null,
          image_url:
            newImageUrl,
          barcode:
            barcode.trim() ||
            null,
          minimum_stock:
            parsedMinimumStock,
          purchase_price:
            parsedPurchasePrice,
          selling_price:
            parsedSellingPrice,
          supplier_name:
            supplierName.trim() ||
            null,
          description:
            description.trim() ||
            null,
        })
        .eq("id", productId);

      if (productUpdateError) {
        if (
          imageFile &&
          newImageUrl
        ) {
          await deleteOldImage(
            newImageUrl,
          );
        }

        throw productUpdateError;
      }

      const {
        error: baseUnitError,
      } = await supabase
        .from("product_units")
        .update({
          unit_id: baseUnitId,
          conversion_factor: 1,
          is_base_unit: true,
        })
        .eq(
          "product_id",
          productId,
        )
        .eq(
          "is_base_unit",
          true,
        );

      if (baseUnitError) {
        throw baseUnitError;
      }

      const {
        error: deleteExtrasError,
      } = await supabase
        .from("product_units")
        .delete()
        .eq(
          "product_id",
          productId,
        )
        .eq(
          "is_base_unit",
          false,
        );

      if (deleteExtrasError) {
        throw deleteExtrasError;
      }

      if (
        cleanedExtraUnits.length >
        0
      ) {
        const rows =
          cleanedExtraUnits.map(
            (item) => ({
              product_id:
                productId,
              unit_id:
                item.unitId,
              conversion_factor:
                Number(
                  item.conversionFactor,
                ),
              is_base_unit:
                false,
            }),
          );

        const {
          error:
            extraUnitsError,
        } =
          await supabase
            .from(
              "product_units",
            )
            .insert(rows);

        if (extraUnitsError) {
          throw extraUnitsError;
        }
      }

      if (
        imageFile &&
        imageUrl &&
        imageUrl !== newImageUrl
      ) {
        await deleteOldImage(
          imageUrl,
        );
      }

      if (
        removeImage &&
        imageUrl
      ) {
        await deleteOldImage(
          imageUrl,
        );
      }

      setSuccess(
        "تم حفظ التعديلات بنجاح.",
      );

      setTimeout(() => {
        router.push(
          `/products/${productId}`,
        );

        router.refresh();
      }, 400);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "حدث خطأ أثناء حفظ التعديلات.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 px-4 py-8"
      >
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">
              ⏳
            </div>

            <p className="mt-4 font-semibold text-slate-600">
              جارٍ تحميل بيانات المنتج...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 px-4 py-8"
      >
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="text-5xl">
              ❌
            </div>

            <h1 className="mt-4 text-xl font-bold text-slate-900">
              لم يتم العثور على المنتج
            </h1>

            <button
              onClick={() =>
                router.push(
                  "/products",
                )
              }
              className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white"
            >
              العودة إلى المنتجات
            </button>
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
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-5">
          <button
            onClick={() =>
              router.push(
                `/products/${productId}`,
              )
            }
            className="mb-2 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← تفاصيل المنتج
          </button>

          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
                ✏️ تعديل المنتج
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {product.name}
              </p>
            </div>

            {currentStock > 0 && (
              <div className="hidden rounded-2xl bg-amber-100 px-4 py-2 text-center sm:block">
                <p className="text-xs text-amber-700">
                  المخزون الحالي
                </p>

                <p className="font-black text-amber-900">
                  {currentStock}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
            ✅ {success}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >

          {/* Main information */}
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-black text-slate-900">
                📦 البيانات الأساسية
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                عدّل المعلومات الأكثر استخدامًا بسرعة.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">

              {/* Name */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  اسم المنتج *
                </label>

                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target.value,
                    )
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  التصنيف
                </label>

                <select
                  value={categoryId}
                  onChange={(e) =>
                    setCategoryId(
                      e.target.value,
                    )
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">
                    بدون تصنيف
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
              </div>

              {/* Barcode */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  الباركود
                </label>

                <input
                  type="text"
                  value={barcode}
                  onChange={(e) =>
                    setBarcode(
                      e.target.value,
                    )
                  }
                  placeholder="اختياري"
                  inputMode="numeric"
                  autoComplete="off"
                  dir="ltr"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-4 font-mono outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* Minimum */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  الحد الأدنى للمخزون
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={
                    minimumStock
                  }
                  onChange={(e) =>
                    setMinimumStock(
                      e.target.value,
                    )
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* Base unit */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-sm font-bold text-slate-700">
                    الوحدة الأساسية *
                  </label>

                  {hasStock && (
                    <span className="text-xs font-bold text-amber-700">
                      🔒 مقفلة
                    </span>
                  )}
                </div>

                <select
                  value={
                    baseUnitId
                  }
                  disabled={
                    hasStock
                  }
                  onChange={(e) => {
                    const newUnit =
                      e.target
                        .value;

                    setBaseUnitId(
                      newUnit,
                    );

                    setExtraUnits(
                      (current) =>
                        current.filter(
                          (item) =>
                            item.unitId !==
                            newUnit,
                        ),
                    );
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 outline-none ${
                    hasStock
                      ? "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-500"
                      : "border-slate-300 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  }`}
                  required
                >
                  <option value="">
                    اختر الوحدة
                  </option>

                  {units.map(
                    (unit) => (
                      <option
                        key={
                          unit.id
                        }
                        value={
                          unit.id
                        }
                      >
                        {unit.name}
                        {unit.symbol
                          ? ` (${unit.symbol})`
                          : ""}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            {hasStock && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                🔒 الوحدة الأساسية مقفلة لأن المنتج يحتوي على مخزون حالي.
              </div>
            )}
          </section>

          {/* Advanced */}
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() =>
                setShowAdvanced(
                  (value) => !value,
                )
              }
              className="flex w-full items-center justify-between p-4 text-right sm:p-5"
            >
              <div>
                <h2 className="font-black text-slate-900">
                  ⚙️ بيانات إضافية
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  الأسعار، المورد والوصف
                </p>
              </div>

              <span className="text-xl">
                {showAdvanced
                  ? "⌃"
                  : "⌄"}
              </span>
            </button>

            {showAdvanced && (
              <div className="border-t border-slate-100 p-4 sm:p-6">
                <div className="grid gap-4 md:grid-cols-2">

                  {/* Purchase */}
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      سعر الشراء
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={
                        purchasePrice
                      }
                      onChange={(e) =>
                        setPurchasePrice(
                          e.target
                            .value,
                        )
                      }
                      placeholder="اختياري"
                      dir="ltr"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  {/* Selling */}
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      سعر البيع
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={
                        sellingPrice
                      }
                      onChange={(e) =>
                        setSellingPrice(
                          e.target
                            .value,
                        )
                      }
                      placeholder="اختياري"
                      dir="ltr"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  {/* Supplier */}
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      المورد
                    </label>

                    <input
                      type="text"
                      value={
                        supplierName
                      }
                      onChange={(e) =>
                        setSupplierName(
                          e.target
                            .value,
                        )
                      }
                      placeholder="اختياري"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      الوصف
                    </label>

                    <textarea
                      value={
                        description
                      }
                      onChange={(e) =>
                        setDescription(
                          e.target
                            .value,
                        )
                      }
                      rows={3}
                      placeholder="اختياري"
                      className="w-full resize-none rounded-2xl border border-slate-300 px-4 py-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Units */}
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() =>
                setShowUnits(
                  (value) => !value,
                )
              }
              className="flex w-full items-center justify-between p-4 text-right sm:p-5"
            >
              <div>
                <h2 className="font-black text-slate-900">
                  📏 الوحدات الإضافية
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  مثل: كرتونة = 24 حبة
                </p>
              </div>

              <div className="flex items-center gap-3">
                {extraUnits.length >
                  0 && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                    {extraUnits.length}
                  </span>
                )}

                <span className="text-xl">
                  {showUnits
                    ? "⌃"
                    : "⌄"}
                </span>
              </div>
            </button>

            {showUnits && (
              <div className="border-t border-slate-100 p-4 sm:p-6">
                {extraUnits.length ===
                0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                    <p className="text-sm text-slate-500">
                      لا توجد وحدات إضافية.
                    </p>

                    <button
                      type="button"
                      onClick={
                        addExtraUnit
                      }
                      className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
                    >
                      + إضافة وحدة
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {extraUnits.map(
                      (
                        extraUnit,
                        index,
                      ) => {
                        const selectedUnit =
                          units.find(
                            (
                              unit,
                            ) =>
                              unit.id ===
                              extraUnit.unitId,
                          );

                        return (
                          <div
                            key={
                              index
                            }
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                              <div>
                                <label className="mb-2 block text-xs font-bold text-slate-600">
                                  الوحدة
                                </label>

                                <select
                                  value={
                                    extraUnit.unitId
                                  }
                                  onChange={(
                                    e,
                                  ) =>
                                    updateExtraUnit(
                                      index,
                                      "unitId",
                                      e.target
                                        .value,
                                    )
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                >
                                  <option value="">
                                    اختر الوحدة
                                  </option>

                                  {getAvailableExtraUnits(
                                    index,
                                  ).map(
                                    (
                                      unit,
                                    ) => (
                                      <option
                                        key={
                                          unit.id
                                        }
                                        value={
                                          unit.id
                                        }
                                      >
                                        {
                                          unit.name
                                        }
                                      </option>
                                    ),
                                  )}

                                  {selectedUnit &&
                                    !getAvailableExtraUnits(
                                      index,
                                    ).some(
                                      (
                                        unit,
                                      ) =>
                                        unit.id ===
                                        selectedUnit.id,
                                    ) && (
                                      <option
                                        value={
                                          selectedUnit.id
                                        }
                                      >
                                        {
                                          selectedUnit.name
                                        }
                                      </option>
                                    )}
                                </select>
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-bold text-slate-600">
                                  معامل التحويل
                                </label>

                                <input
                                  type="number"
                                  min="0.001"
                                  step="0.001"
                                  value={
                                    extraUnit.conversionFactor
                                  }
                                  onChange={(
                                    e,
                                  ) =>
                                    updateExtraUnit(
                                      index,
                                      "conversionFactor",
                                      e.target
                                        .value,
                                    )
                                  }
                                  placeholder="24"
                                  dir="ltr"
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  removeExtraUnit(
                                    index,
                                  )
                                }
                                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-100"
                              >
                                🗑️ حذف
                              </button>
                            </div>

                            {selectedUnit &&
                              extraUnit.conversionFactor && (
                                <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-slate-500">
                                  1{" "}
                                  {
                                    selectedUnit.name
                                  }{" "}
                                  ={" "}
                                  <strong>
                                    {
                                      extraUnit.conversionFactor
                                    }
                                  </strong>{" "}
                                  من الوحدة الأساسية
                                </div>
                              )}
                          </div>
                        );
                      },
                    )}

                    <button
                      type="button"
                      onClick={
                        addExtraUnit
                      }
                      className="w-full rounded-xl border border-dashed border-slate-300 bg-white py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      + إضافة وحدة أخرى
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Image */}
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() =>
                setShowImage(
                  (value) => !value,
                )
              }
              className="flex w-full items-center justify-between p-4 text-right sm:p-5"
            >
              <div>
                <h2 className="font-black text-slate-900">
                  🖼️ صورة المنتج
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  تغيير أو حذف الصورة
                </p>
              </div>

              <span className="text-xl">
                {showImage
                  ? "⌃"
                  : "⌄"}
              </span>
            </button>

            {showImage && (
              <div className="border-t border-slate-100 p-4 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row">
                  <div className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                    {imagePreview ? (
                      <img
                        src={
                          imagePreview
                        }
                        alt="الصورة الجديدة"
                        className="h-full w-full object-cover"
                      />
                    ) : imageUrl &&
                      !removeImage ? (
                      <img
                        src={
                          imageUrl
                        }
                        alt={
                          product.name
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-slate-400">
                        <div className="text-4xl">
                          📦
                        </div>

                        <p className="mt-1 text-xs">
                          لا توجد صورة
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={
                        handleImageChange
                      }
                      className="block w-full rounded-2xl border border-slate-300 bg-white text-sm file:mr-4 file:border-0 file:bg-slate-100 file:px-4 file:py-3 file:font-bold"
                    />

                    <p className="mt-2 text-xs text-slate-400">
                      JPG / PNG / WEBP — الحد الأقصى 5MB
                    </p>

                    {(imageUrl ||
                      imagePreview) &&
                      !removeImage && (
                        <button
                          type="button"
                          onClick={
                            handleRemoveImage
                          }
                          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600"
                        >
                          🗑️ حذف الصورة
                        </button>
                      )}

                    {removeImage && (
                      <div className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">
                        ⚠️ سيتم حذف الصورة عند الحفظ.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Bottom actions */}
          <div className="sticky bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/products/${productId}`,
                  )
                }
                disabled={saving}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex-[2] rounded-xl bg-blue-600 px-4 py-3 font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? "⏳ جارٍ الحفظ..."
                  : "💾 حفظ التعديلات"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}