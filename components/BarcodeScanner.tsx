"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  IScannerControls,
} from "@zxing/browser";

type BarcodeScannerProps = {
  onDetected: (barcode: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({
  onDetected,
  onClose,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
        setLoading(true);
        setError("");

        if (!videoRef.current) {
          return;
        }

        /*
         * التحقق من أن المتصفح يسمح باستخدام الكاميرا
         */
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "المتصفح لا يدعم تشغيل الكاميرا أو أن الاتصال غير آمن. افتح الموقع عبر HTTPS."
          );
        }

        const reader = new BrowserMultiFormatReader();

        /*
         * البحث عن كاميرات الجهاز
         */
        const devices =
          await BrowserMultiFormatReader.listVideoInputDevices();

        if (!mounted) {
          return;
        }

        if (!devices || devices.length === 0) {
          throw new Error("لم يتم العثور على كاميرا في الجهاز.");
        }

        /*
         * نفضّل الكاميرا الخلفية على الهاتف.
         *
         * بعض الهواتف تعطي أسماء مثل:
         * Back Camera
         * Rear Camera
         * Camera 0
         * أو أسماء أخرى.
         */
        const backCamera =
          devices.find((device) => {
            const label = device.label.toLowerCase();

            return (
              label.includes("back") ||
              label.includes("rear") ||
              label.includes("environment") ||
              label.includes("خلف") ||
              label.includes("trás") ||
              label.includes("trasera")
            );
          }) || devices[devices.length - 1];

        /*
         * تشغيل الكاميرا.
         *
         * نحاول استخدام الكاميرا الخلفية المناسبة للهاتف.
         */
        controlsRef.current = await reader.decodeFromVideoDevice(
          backCamera.deviceId,
          videoRef.current,
          (result, scanError) => {
            if (!mounted || detectedRef.current) {
              return;
            }

            if (result) {
              const barcode = result.getText().trim();

              if (barcode) {
                detectedRef.current = true;

                controlsRef.current?.stop();

                onDetected(barcode);
              }
            }

            // ZXing يرسل أخطاء قراءة متكررة أثناء البحث،
            // لذلك لا نعرضها للمستخدم إلا إذا فشل تشغيل الكاميرا نفسها.
            void scanError;
          }
        );

        if (!mounted) {
          controlsRef.current?.stop();
          return;
        }

        /*
         * إعدادات الفيديو المناسبة للهاتف.
         */
        if (videoRef.current) {
          videoRef.current.setAttribute(
            "playsinline",
            "true"
          );

          videoRef.current.setAttribute(
            "autoplay",
            "true"
          );

          videoRef.current.muted = true;

          /*
           * محاولة إجبار الهاتف على استخدام
           * الكاميرا الخلفية كإعداد إضافي.
           */
          const stream = videoRef.current.srcObject as
            | MediaStream
            | null;

          const videoTrack = stream?.getVideoTracks()[0];

          if (videoTrack) {
            try {
              await videoTrack.applyConstraints({
                facingMode: {
                  ideal: "environment",
                },
              });
            } catch {
              // بعض الأجهزة لا تسمح بتغيير facingMode بعد التشغيل.
              // لا نعتبر ذلك خطأ.
            }
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Barcode scanner error:", err);

        if (!mounted) {
          return;
        }

        setLoading(false);

        if (err instanceof DOMException) {
          if (err.name === "NotAllowedError") {
            setError(
              "تم رفض صلاحية الكاميرا. اسمح للموقع باستخدام الكاميرا من إعدادات المتصفح ثم حاول مرة أخرى."
            );
          } else if (err.name === "NotFoundError") {
            setError(
              "لم يتم العثور على كاميرا في هذا الجهاز."
            );
          } else if (err.name === "NotReadableError") {
            setError(
              "الكاميرا مستخدمة من تطبيق آخر. أغلق تطبيق الكاميرا أو أي تطبيق يستخدم الكاميرا ثم حاول مرة أخرى."
            );
          } else if (err.name === "SecurityError") {
            setError(
              "المتصفح منع الوصول إلى الكاميرا بسبب إعدادات الأمان. افتح الموقع باستخدام HTTPS."
            );
          } else {
            setError(
              "تعذر تشغيل الكاميرا. تأكد من صلاحية الكاميرا ثم حاول مرة أخرى."
            );
          }
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("حدث خطأ أثناء تشغيل الكاميرا.");
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;

      detectedRef.current = false;

      controlsRef.current?.stop();
      controlsRef.current = null;

      /*
       * إيقاف جميع مسارات الكاميرا عند إغلاق النافذة.
       */
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as
          | MediaStream
          | null;

        stream?.getTracks().forEach((track) => {
          track.stop();
        });

        videoRef.current.srcObject = null;
      }
    };
  }, [onDetected]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-0 sm:p-4"
      dir="rtl"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-black sm:h-auto sm:max-h-[95vh] sm:max-w-lg sm:rounded-3xl sm:bg-white sm:shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between bg-white px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              📷 مسح الباركود
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              استخدم الكاميرا الخلفية ووجّهها نحو الباركود
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-700 transition active:scale-95 hover:bg-slate-200"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        {/* Camera */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black sm:flex-none">

          <video
            ref={videoRef}
            className="h-full max-h-[75vh] w-full object-cover sm:aspect-square sm:h-auto"
            muted
            autoPlay
            playsInline
          />

          {/* Scanner overlay */}
          {!error && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">

              <div className="relative h-40 w-[78%] max-w-[340px] rounded-2xl border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]">

                {/* Top-left corner */}
                <span className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-emerald-400" />

                {/* Top-right corner */}
                <span className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-emerald-400" />

                {/* Bottom-left corner */}
                <span className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-emerald-400" />

                {/* Bottom-right corner */}
                <span className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-emerald-400" />

                {/* Scanning line */}
                <div className="absolute left-3 right-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-red-500 shadow-lg" />
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && !error && (
            <div className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-4 text-center text-sm font-semibold text-white">
              📷 جاري تشغيل الكاميرا...
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="shrink-0 bg-white p-5">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-700">
              <div className="mb-2 text-2xl">
                ⚠️
              </div>

              <p className="font-semibold">
                {error}
              </p>

              <div className="mt-3 rounded-xl bg-white/70 p-3 text-xs leading-6 text-red-600">
                <p>
                  • تأكد من إعطاء المتصفح صلاحية استخدام
                  الكاميرا.
                </p>

                <p>
                  • إذا كنت تفتح النظام من الهاتف، استخدم
                  رابط HTTPS.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 font-bold text-white transition active:scale-[0.98] hover:bg-slate-800"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Bottom instructions */}
        {!error && (
          <div className="shrink-0 bg-white p-4 sm:p-5">
            <div className="rounded-2xl bg-emerald-50 p-4 text-center text-sm leading-6 text-emerald-800">
              <div className="text-xl">
                📦
              </div>

              <p className="mt-1 font-semibold">
                ضع الباركود داخل الإطار
              </p>

              <p className="mt-1 text-xs text-emerald-700">
                سيتم التعرف عليه تلقائيًا وفتح المنتج مباشرة.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 font-bold text-white transition active:scale-[0.98] hover:bg-slate-800"
            >
              إلغاء
            </button>
          </div>
        )}
      </div>
    </div>
  );
}