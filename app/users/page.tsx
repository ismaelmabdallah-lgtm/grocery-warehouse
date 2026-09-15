"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type UserRole = "ADMIN" | "USER";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
};

export default function UsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<UserRow[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] =
    useState(false);

  const [editingUser, setEditingUser] =
    useState<UserRow | null>(null);

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [role, setRole] =
    useState<UserRole>("USER");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");


  // =====================================================
  // تحميل المستخدمين
  // =====================================================

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/users",
        {
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (response.status === 403) {
        setError(
          "ليس لديك صلاحية للوصول إلى إدارة المستخدمين.",
        );
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "فشل تحميل المستخدمين.",
        );
      }

      setUsers(data.users || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء تحميل المستخدمين.",
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadUsers();
  }, []);


  // =====================================================
  // إعادة النموذج
  // =====================================================

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("USER");
    setEditingUser(null);
    setShowForm(false);
  }


  // =====================================================
  // بدء التعديل
  // =====================================================

  function startEdit(user: UserRow) {
    setEditingUser(user);
    setFullName(user.full_name);
    setEmail(user.email);
    setPassword("");
    setRole(user.role);

    setShowForm(true);
    setError("");
    setSuccess("");
  }


  // =====================================================
  // حفظ
  // =====================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      if (editingUser) {
        // ===============================================
        // تعديل مستخدم
        // ===============================================

        const response = await fetch(
          "/api/admin/users",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              id: editingUser.id,
              full_name: fullName,
              role,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "فشل تحديث المستخدم.",
          );
        }

        setSuccess(
          "تم تحديث المستخدم بنجاح.",
        );
      } else {
        // ===============================================
        // إضافة مستخدم
        // ===============================================

        const response = await fetch(
          "/api/admin/users",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              full_name: fullName,
              email,
              password,
              role,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "فشل إنشاء المستخدم.",
          );
        }

        setSuccess(
          "تم إنشاء المستخدم بنجاح.",
        );
      }

      resetForm();

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ.",
      );
    } finally {
      setSaving(false);
    }
  }


  // =====================================================
  // حذف المستخدم
  // =====================================================

  async function handleDelete(
    user: UserRow,
  ) {
    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف المستخدم "${user.full_name}"؟\n\nسيتم حذف حساب الدخول نهائيًا.`,
      );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        "/api/admin/users",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: user.id,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "فشل حذف المستخدم.",
        );
      }

      setSuccess(
        "تم حذف المستخدم بنجاح.",
      );

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء الحذف.",
      );
    }
  }


  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 px-4 py-6 md:px-8"
    >
      <div className="mx-auto max-w-6xl">

        {/* ================================================= */}
        {/* Header */}
        {/* ================================================= */}

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            <button
              type="button"
              onClick={() =>
                router.push("/")
              }
              className="mb-3 text-sm text-slate-500 hover:text-slate-900"
            >
              ← العودة للوحة التحكم
            </button>

            <h1 className="text-2xl font-bold text-slate-900">
              👥 إدارة المستخدمين
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              إدارة حسابات المستودع والصلاحيات
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white shadow-sm hover:bg-slate-800"
          >
            ＋ إضافة مستخدم
          </button>
        </div>


        {/* ================================================= */}
        {/* Messages */}
        {/* ================================================= */}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            ✅ {success}
          </div>
        )}


        {/* ================================================= */}
        {/* Form */}
        {/* ================================================= */}

        {showForm && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="mb-5 flex items-center justify-between">

              <h2 className="text-lg font-bold text-slate-900">
                {editingUser
                  ? "✏️ تعديل المستخدم"
                  : "➕ إضافة مستخدم جديد"}
              </h2>

              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-slate-500 hover:text-slate-900"
              >
                إغلاق
              </button>
            </div>


            <form
              onSubmit={handleSubmit}
              className="grid gap-4 md:grid-cols-2"
            >

              {/* الاسم */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  اسم المستخدم
                </label>

                <input
                  type="text"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(
                      event.target.value,
                    )
                  }
                  placeholder="مثال: أحمد محمد"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>


              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  البريد الإلكتروني
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                  placeholder="user@example.com"
                  required
                  disabled={!!editingUser}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-left outline-none disabled:bg-slate-100 focus:border-slate-500"
                />

                {editingUser && (
                  <p className="mt-1 text-xs text-slate-400">
                    البريد الإلكتروني لا يتم
                    تغييره من هذه الصفحة.
                  </p>
                )}
              </div>


              {/* Password */}
              {!editingUser && (
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    كلمة المرور
                  </label>

                  <input
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    placeholder="6 أحرف على الأقل"
                    minLength={6}
                    required
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-left outline-none focus:border-slate-500"
                  />
                </div>
              )}


              {/* Role */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  الصلاحية
                </label>

                <select
                  value={role}
                  onChange={(event) =>
                    setRole(
                      event.target
                        .value as UserRole,
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-500"
                >
                  <option value="USER">
                    USER — موظف
                  </option>

                  <option value="ADMIN">
                    ADMIN — مدير
                  </option>
                </select>
              </div>


              {/* Buttons */}
              <div className="flex gap-3 md:col-span-2">

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "جاري الحفظ..."
                    : editingUser
                      ? "حفظ التعديلات"
                      : "إنشاء المستخدم"}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 hover:bg-slate-50"
                >
                  إلغاء
                </button>
              </div>

            </form>
          </section>
        )}


        {/* ================================================= */}
        {/* Users list */}
        {/* ================================================= */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="flex items-center justify-between border-b border-slate-200 p-5">

            <h2 className="font-bold text-slate-900">
              المستخدمون
            </h2>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              {users.length} مستخدم
            </span>
          </div>


          {loading ? (
            <div className="p-10 text-center text-slate-500">
              جاري تحميل المستخدمين...
            </div>
          ) : users.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              لا يوجد مستخدمون.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">

              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                >

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="font-bold text-slate-900">
                        {user.full_name ||
                          "بدون اسم"}
                      </h3>

                      {user.role ===
                      "ADMIN" ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                          👑 ADMIN
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
                          👤 USER
                        </span>
                      )}
                    </div>

                    <p
                      dir="ltr"
                      className="mt-1 text-right text-sm text-slate-500"
                    >
                      {user.email}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      تاريخ الإنشاء:{" "}
                      {new Date(
                        user.created_at,
                      ).toLocaleDateString(
                        "ar-JO",
                      )}
                    </p>
                  </div>


                  <div className="flex gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        startEdit(user)
                      }
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      ✏️ تعديل
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(user)
                      }
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
                    >
                      🗑️ حذف
                    </button>

                  </div>
                </div>
              ))}

            </div>
          )}
        </section>


        {/* ================================================= */}
        {/* Security information */}
        {/* ================================================= */}

        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">

          <div className="font-bold">
            🔐 الحماية
          </div>

          <div className="mt-1">
            إدارة المستخدمين محمية من السيرفر،
            ولا يستطيع حساب USER إنشاء مستخدمين
            أو تغيير الصلاحيات حتى لو حاول الوصول
            إلى API مباشرة.
          </div>

        </div>

      </div>
    </main>
  );
}