import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      authorized: false,
      status: 401,
      message: "يجب تسجيل الدخول.",
      user: null,
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

  if (profileError || profile?.role !== "ADMIN") {
    return {
      authorized: false,
      status: 403,
      message: "ليس لديك صلاحية لإدارة المستخدمين.",
      user,
    };
  }

  return {
    authorized: true,
    status: 200,
    message: "",
    user,
    profile,
  };
}


// =====================================================
// GET — جلب المستخدمين
// =====================================================

export async function GET() {
  try {
    const auth = await requireAdmin();

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.message },
        { status: auth.status },
      );
    }

    const admin = createAdminClient();

    const {
      data: authData,
      error: authError,
    } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authError) {
      throw authError;
    }

    const {
      data: profiles,
      error: profilesError,
    } = await admin
      .from("profiles")
      .select("id, full_name, role, created_at");

    if (profilesError) {
      throw profilesError;
    }

    const profileMap = new Map(
      (profiles || []).map((profile) => [
        profile.id,
        profile,
      ]),
    );

    const users = (authData.users || []).map((user) => {
      const profile = profileMap.get(user.id);

      return {
        id: user.id,
        email: user.email || "",
        full_name:
          profile?.full_name ||
          user.user_metadata?.full_name ||
          "",
        role: profile?.role === "ADMIN"
          ? "ADMIN"
          : "USER",
        created_at:
          profile?.created_at ||
          user.created_at,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/admin/users:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء جلب المستخدمين.",
      },
      { status: 500 },
    );
  }
}


// =====================================================
// POST — إنشاء مستخدم
// =====================================================

export async function POST(
  request: NextRequest,
) {
  try {
    const auth = await requireAdmin();

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.message },
        { status: auth.status },
      );
    }

    const body = await request.json();

    const fullName = String(
      body.full_name || "",
    ).trim();

    const email = String(
      body.email || "",
    )
      .trim()
      .toLowerCase();

    const password = String(
      body.password || "",
    );

    const role =
      body.role === "ADMIN"
        ? "ADMIN"
        : "USER";

    if (!fullName) {
      return NextResponse.json(
        { error: "اسم المستخدم مطلوب." },
        { status: 400 },
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مطلوب." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          error:
            "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
        },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const {
      data,
      error: createError,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError || !data.user) {
      throw (
        createError ||
        new Error("فشل إنشاء المستخدم.")
      );
    }

    const userId = data.user.id;

    const {
      error: profileError,
    } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        role,
      })
      .eq("id", userId);

    if (profileError) {
      await admin.auth.admin.deleteUser(
        userId,
      );

      throw profileError;
    }

    return NextResponse.json({
      success: true,
      message: "تم إنشاء المستخدم بنجاح.",
    });
  } catch (error) {
    console.error(
      "POST /api/admin/users:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء إنشاء المستخدم.",
      },
      { status: 500 },
    );
  }
}


// =====================================================
// PATCH — تعديل الاسم والصلاحية
// =====================================================

export async function PATCH(
  request: NextRequest,
) {
  try {
    const auth = await requireAdmin();

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.message },
        { status: auth.status },
      );
    }

    const body = await request.json();

    const userId = String(
      body.id || "",
    ).trim();

    const fullName = String(
      body.full_name || "",
    ).trim();

    const role =
      body.role === "ADMIN"
        ? "ADMIN"
        : "USER";

    if (!userId) {
      return NextResponse.json(
        { error: "معرّف المستخدم مطلوب." },
        { status: 400 },
      );
    }

    if (!fullName) {
      return NextResponse.json(
        { error: "اسم المستخدم مطلوب." },
        { status: 400 },
      );
    }

    // منع المدير من إزالة صلاحية ADMIN عن نفسه
    if (
      userId === auth.user?.id &&
      role !== "ADMIN"
    ) {
      return NextResponse.json(
        {
          error:
            "لا يمكنك إزالة صلاحية ADMIN من حسابك الحالي.",
        },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // حماية إضافية:
    // لا تسمح بتحويل آخر ADMIN إلى USER
    if (
      userId !== auth.user?.id &&
      role === "USER"
    ) {
      const {
        data: target,
        error: targetError,
      } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (targetError) {
        throw targetError;
      }

      if (target?.role === "ADMIN") {
        const {
          data: admins,
          error: adminsError,
        } = await admin
          .from("profiles")
          .select("id")
          .eq("role", "ADMIN");

        if (adminsError) {
          throw adminsError;
        }

        if ((admins || []).length <= 1) {
          return NextResponse.json(
            {
              error:
                "لا يمكن تحويل آخر ADMIN إلى USER.",
            },
            { status: 400 },
          );
        }
      }
    }

    const {
      error: profileError,
    } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        role,
      })
      .eq("id", userId);

    if (profileError) {
      throw profileError;
    }

    const {
      error: authError,
    } = await admin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          full_name: fullName,
        },
      },
    );

    if (authError) {
      throw authError;
    }

    return NextResponse.json({
      success: true,
      message: "تم تحديث المستخدم بنجاح.",
    });
  } catch (error) {
    console.error(
      "PATCH /api/admin/users:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء تحديث المستخدم.",
      },
      { status: 500 },
    );
  }
}


// =====================================================
// DELETE — حذف المستخدم
// =====================================================

export async function DELETE(
  request: NextRequest,
) {
  try {
    const auth = await requireAdmin();

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.message },
        { status: auth.status },
      );
    }

    const body = await request.json();

    const userId = String(
      body.id || "",
    ).trim();

    if (!userId) {
      return NextResponse.json(
        { error: "معرّف المستخدم مطلوب." },
        { status: 400 },
      );
    }

    // منع حذف نفسك
    if (userId === auth.user?.id) {
      return NextResponse.json(
        {
          error:
            "لا يمكنك حذف حسابك الحالي.",
        },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const {
      data: target,
      error: targetError,
    } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (targetError) {
      throw targetError;
    }

    // إذا كان المستخدم ADMIN،
    // نتأكد أنه ليس آخر ADMIN
    if (target?.role === "ADMIN") {
      const {
        data: admins,
        error: adminsError,
      } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "ADMIN");

      if (adminsError) {
        throw adminsError;
      }

      if ((admins || []).length <= 1) {
        return NextResponse.json(
          {
            error:
              "لا يمكن حذف آخر ADMIN في النظام.",
          },
          { status: 400 },
        );
      }
    }

    const {
      error: deleteError,
    } = await admin.auth.admin.deleteUser(
      userId,
    );

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: "تم حذف المستخدم بنجاح.",
    });
  } catch (error) {
    console.error(
      "DELETE /api/admin/users:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء حذف المستخدم.",
      },
      { status: 500 },
    );
  }
}