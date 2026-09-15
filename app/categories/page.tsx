"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  created_at: string;
};

type ProductCount = Record<string, number>;

const COMMON_ICONS = [
  "🛒",
  "🥫",
  "🥤",
  "💧",
  "🧴",
  "🧹",
  "🍚",
  "🍪",
  "🍫",
  "☕",
  "🧃",
  "🥛",
  "🧂",
  "🛢️",
  "📦",
  "🧼",
  "🧻",
  "🍝",
  "🥖",
  "🍯",
];

export default function CategoriesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [productCounts, setProductCounts] =
    useState<ProductCount>({});

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [editingCategory, setEditingCategory] =
    useState<Category | null>(null);

  const [name, setName] =
    useState("");

  const [icon, setIcon] =
    useState("📦");

  async function loadCategories() {
    try {
      setLoading(true);
      setError("");

      // ================================
      // التصنيفات
      // ================================
      const {
        data: categoriesData,
        error: categoriesError,
      } = await supabase
        .from("categories")
        .select(
          "id, name, icon, created_at"
        )
        .order("name", {
          ascending: true,
        });

      if (categoriesError) {
        throw categoriesError;
      }

      // ================================
      // المنتجات لمعرفة عدد المنتجات
      // في كل تصنيف
      // ================================
      const {
        data: productsData,
        error: productsError,
      } = await supabase
        .from("products")
        .select(
          "id, category_id"
        )
        .eq("is_active", true);

      if (productsError) {
        throw productsError;
      }

      const counts: ProductCount = {};

      for (const product of productsData || []) {
        if (!product.category_id) {
          continue;
        }

        counts[product.category_id] =
          (counts[product.category_id] || 0) +
          1;
      }

      setCategories(
        (categoriesData || []) as Category[]
      );

      setProductCounts(counts);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "تعذر تحميل التصنيفات."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  const filteredCategories =
    useMemo(() => {
      const value =
        search.trim().toLowerCase();

      if (!value) {
        return categories;
      }

      return categories.filter(
        (category) =>
          category.name
            .toLowerCase()
            .includes(value)
      );
    }, [categories, search]);

  function resetForm() {
    setName("");
    setIcon("📦");
    setEditingCategory(null);
    setShowForm(false);
  }

  function startAdd() {
    setSuccess("");
    setError("");

    setName("");
    setIcon("📦");
    setEditingCategory(null);
    setShowForm(true);
  }

  function startEdit(category: Category) {
    setSuccess("");
    setError("");

    setEditingCategory(category);
    setName(category.name);
    setIcon(category.icon || "📦");
    setShowForm(true);
  }

  async function saveCategory() {
    const trimmedName =
      name.trim();

    if (!trimmedName) {
      setError(
        "اكتب اسم التصنيف أولًا."
      );
      return;
    }

    if (trimmedName.length < 2) {
      setError(
        "اسم التصنيف يجب أن يكون حرفين على الأقل."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // ================================
      // تعديل
      // ================================
      if (editingCategory) {
        const {
          error: updateError,
        } = await supabase
          .from("categories")
          .update({
            name: trimmedName,
            icon: icon || "📦",
          })
          .eq(
            "id",
            editingCategory.id
          );

        if (updateError) {
          if (
            updateError.code ===
            "23505"
          ) {
            throw new Error(
              "يوجد تصنيف آخر بنفس الاسم."
            );
          }

          throw updateError;
        }

        setSuccess(
          "تم تعديل التصنيف بنجاح."
        );
      }

      // ================================
      // إضافة
      // ================================
      else {
        const {
          error: insertError,
        } = await supabase
          .from("categories")
          .insert({
            name: trimmedName,
            icon: icon || "📦",
          });

        if (insertError) {
          if (
            insertError.code ===
            "23505"
          ) {
            throw new Error(
              "يوجد تصنيف بنفس الاسم بالفعل."
            );
          }

          throw insertError;
        }

        setSuccess(
          "تمت إضافة التصنيف بنجاح."
        );
      }

      await loadCategories();

      setName("");
      setIcon("📦");
      setEditingCategory(null);
      setShowForm(false);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "تعذر حفظ التصنيف."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(
    category: Category
  ) {
    const count =
      productCounts[category.id] || 0;

    if (count > 0) {
      setError(
        `لا يمكن حذف التصنيف "${category.name}" لأنه مرتبط بـ ${count} منتج. انقل المنتجات إلى تصنيف آخر أولًا.`
      );

      return;
    }

    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف التصنيف "${category.name}"؟`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const {
        error: deleteError,
      } = await supabase
        .from("categories")
        .delete()
        .eq(
          "id",
          category.id
        );

      if (deleteError) {
        throw deleteError;
      }

      setCategories(
        (current) =>
          current.filter(
            (item) =>
              item.id !== category.id
          )
      );

      setSuccess(
        "تم حذف التصنيف بنجاح."
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "تعذر حذف التصنيف."
      );
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">

        {/* ================================
            Header
        ================================= */}
        <header className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <button
                onClick={() =>
                  router.push("/")
                }
                className="mb-3 text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                ← العودة إلى لوحة التحكم
              </button>

              <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
                🏷️ إدارة التصنيفات
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                تنظيم المنتجات حسب الأقسام والتصنيفات.
              </p>
            </div>

            <button
              onClick={startAdd}
              className="rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              ➕ إضافة تصنيف
            </button>
          </div>
        </header>

        {/* ================================
            Messages
        ================================= */}
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-bold text-red-700">
            <span>
              ❌ {error}
            </span>

            <button
              onClick={() =>
                setError("")
              }
              className="text-red-400 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700">
            <span>
              ✅ {success}
            </span>

            <button
              onClick={() =>
                setSuccess("")
              }
              className="text-emerald-400 hover:text-emerald-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* ================================
            Add/Edit Form
        ================================= */}
        {showForm && (
          <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {editingCategory
                    ? "✏️ تعديل التصنيف"
                    : "➕ إضافة تصنيف جديد"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  أدخل اسم التصنيف واختر الأيقونة المناسبة.
                </p>
              </div>

              <button
                onClick={resetForm}
                className="rounded-xl bg-slate-100 px-3 py-2 text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">

              {/* Name */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  اسم التصنيف
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="مثال: مواد غذائية"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  autoFocus
                />
              </div>

              {/* Icon */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  أيقونة التصنيف
                </label>

                <div className="rounded-2xl border border-slate-300 bg-white p-3">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                      {icon}
                    </div>

                    <input
                      type="text"
                      value={icon}
                      onChange={(event) =>
                        setIcon(
                          event.target.value
                        )
                      }
                      maxLength={4}
                      className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-center text-xl outline-none focus:border-blue-500"
                      dir="ltr"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {COMMON_ICONS.map(
                      (item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            setIcon(item)
                          }
                          className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition ${
                            icon === item
                              ? "bg-blue-100 ring-2 ring-blue-500"
                              : "bg-slate-100 hover:bg-slate-200"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={saveCategory}
                disabled={saving}
                className="rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "⏳ جارٍ الحفظ..."
                  : editingCategory
                    ? "💾 حفظ التعديل"
                    : "➕ إضافة التصنيف"}
              </button>

              <button
                onClick={resetForm}
                disabled={saving}
                className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </section>
        )}

        {/* ================================
            Search
        ================================= */}
        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex-1">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="🔎 ابحث عن تصنيف..."
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="rounded-2xl bg-slate-100 px-5 py-3 text-center">
              <span className="text-sm text-slate-500">
                عدد التصنيفات
              </span>

              <strong className="mr-2 text-lg font-black text-slate-900">
                {categories.length}
              </strong>
            </div>
          </div>
        </section>

        {/* ================================
            Loading
        ================================= */}
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="text-5xl">
              ⏳
            </div>

            <p className="mt-4 font-bold text-slate-600">
              جارٍ تحميل التصنيفات...
            </p>
          </div>
        ) : filteredCategories.length === 0 ? (
          /* ================================
             Empty
          ================================= */
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="text-6xl">
              🏷️
            </div>

            <h2 className="mt-4 text-xl font-black text-slate-900">
              لا توجد تصنيفات
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {search
                ? "لا يوجد تصنيف يطابق البحث."
                : "ابدأ بإضافة أول تصنيف للمستودع."}
            </p>

            {!search && (
              <button
                onClick={startAdd}
                className="mt-5 rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
              >
                ➕ إضافة أول تصنيف
              </button>
            )}
          </div>
        ) : (
          /* ================================
             Categories Grid
          ================================= */
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCategories.map(
              (category) => {
                const productCount =
                  productCounts[
                    category.id
                  ] || 0;

                return (
                  <article
                    key={category.id}
                    className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md"
                  >
                    {/* Top */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                        {category.icon ||
                          "📦"}
                      </div>

                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                        {productCount} منتج
                      </span>
                    </div>

                    {/* Name */}
                    <h2 className="mt-5 text-lg font-black text-slate-900">
                      {category.name}
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      التصنيف #{category.id.slice(
                        0,
                        8
                      )}
                    </p>

                    {/* Actions */}
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          startEdit(
                            category
                          )
                        }
                        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100"
                      >
                        ✏️ تعديل
                      </button>

                      <button
                        onClick={() =>
                          deleteCategory(
                            category
                          )
                        }
                        className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                          productCount > 0
                            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                            : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        }`}
                        title={
                          productCount > 0
                            ? "لا يمكن حذف تصنيف مرتبط بمنتجات"
                            : "حذف التصنيف"
                        }
                      >
                        🗑️ حذف
                      </button>
                    </div>

                    {productCount > 0 && (
                      <p className="mt-3 text-center text-xs text-slate-400">
                        🔒 الحذف متاح بعد نقل المنتجات
                      </p>
                    )}
                  </article>
                );
              }
            )}
          </section>
        )}

        {/* ================================
            Footer Info
        ================================= */}
        <section className="mt-8 rounded-3xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <div className="text-2xl">
              💡
            </div>

            <div>
              <h3 className="font-black text-blue-900">
                ملاحظة
              </h3>

              <p className="mt-1 text-sm leading-6 text-blue-800">
                لا يمكن حذف تصنيف مرتبط بمنتجات حتى لا نفقد ارتباط المنتجات به. يمكنك تعديل اسم التصنيف أو نقل المنتجات إلى تصنيف آخر أولًا.
              </p>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}