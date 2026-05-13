"use client";

export const dynamic = "force-dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoaderCircle } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import { authService } from "@/services/auth";

function ChangePassword() {
  const [step, setStep] = useState(1); // 1: Enter email, 2: Enter code and passwords
  const [formData, setFormData] = useState({
    email: "",
    codeActive: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({
    email: "",
    codeActive: "",
    password: "",
    confirmPassword: "",
  });
  const [showLoader, setShowLoader] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // If navigated with email query (from forgot-password), skip to step 2
  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setFormData((prev) => ({ ...prev, email: emailParam }));
      setStep(2);
    }
  }, [searchParams]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSubmitStep1 = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.email.trim()) {
      setErrors({ ...errors, email: "Vui lòng nhập email hợp lệ." });
      return;
    }

    setShowLoader(true);

    try {
      await authService.retryPassword({ email: formData.email });
      toast.success("Mã xác nhận đã được gửi đến email của bạn.");
      setStep(2);
    } catch (error) {
      const { ApiError } = await import("@/utils/api-error");
      if (error instanceof ApiError && (error.statusCode === 400 || error.statusCode === 404)) {
        toast.error("Email này chưa được đăng ký trong hệ thống.");
      } else {
        toast.error("Gửi mã xác nhận thất bại. Vui lòng thử lại.");
      }
    } finally {
      setShowLoader(false);
    }
  };

  const handleSubmitStep2 = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    let newErrors = {
      email: "",
      codeActive: "",
      password: "",
      confirmPassword: "",
    };

    if (!formData.codeActive.trim()) {
      newErrors.codeActive = "Vui lòng nhập mã xác nhận.";
    }

    if (!formData.password.trim()) {
      newErrors.password = "Vui lòng nhập mật khẩu mới.";
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Vui lòng xác nhận mật khẩu.";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }

    if (
      newErrors.codeActive ||
      newErrors.password ||
      newErrors.confirmPassword
    ) {
      setErrors(newErrors);
      return;
    }

    setShowLoader(true);

    try {
      await authService.changePassword({
        codeActive: formData.codeActive,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        email: formData.email,
      });
      toast.success("Mật khẩu đã được thay đổi thành công. Vui lòng đăng nhập lại.");
      router.push("/auth/login");
    } catch (error) {
      const { ApiError } = await import("@/utils/api-error");
      if (error instanceof ApiError && error.statusCode === 400) {
        toast.error("Mã xác nhận không hợp lệ hoặc đã hết hạn.");
      } else {
        toast.error("Đổi mật khẩu thất bại. Vui lòng thử lại.");
      }
    } finally {
      setShowLoader(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Side - Image */}
      <div className="hidden h-full w-1/2 bg-black lg:flex lg:items-center lg:justify-center">
        <div className="relative h-full w-full">
          <img src="/AuthImg.png" alt="Authentication" className="object-cover w-full h-full" />
        </div>
      </div>

      {/* Right Side - Change Password Form */}
      <div className="flex h-full w-full items-center justify-center bg-white lg:w-1/2">
        <div className="h-full w-full overflow-y-auto px-6 py-10 sm:px-12 sm:py-14 md:px-20 lg:px-32 xl:px-40 xl:py-20">
          <div className="flex min-h-full w-full flex-col items-center justify-center">
            {/* Logo */}
            <div className="mb-8 flex justify-center">
              <Link href="/homepage" className="cursor-pointer" aria-label="Về trang chủ">
                <Image
                  src="/LOGO.svg"
                  alt="Paplé Logo"
                  width={150}
                  height={60}
                  priority
                />
              </Link>
            </div>

            <div className="flex w-full flex-col items-center justify-start">
              {/* Title */}
              <h2 className="mb-6 text-center text-2xl font-semibold text-gray-900">
                {step === 1 ? "Quên mật khẩu" : "Đặt lại mật khẩu"}
              </h2>

              {/* Description */}
              <p className="mb-6 text-center text-sm text-gray-600">
                {step === 1
                  ? "Nhập email của bạn để nhận mã xác nhận"
                  : "Nhập mã xác nhận và mật khẩu mới"}
              </p>

              {/* Step 1: Enter Email */}
              {step === 1 && (
                <form onSubmit={handleSubmitStep1} className="w-full space-y-4">
                  <div className="space-y-1">
                    <Input
                      type="email"
                      name="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={handleChange}
                      className="border-0 border-b border-[#9D9D9D] bg-transparent px-4 py-2.5 text-[#9D9D9D] placeholder:text-[#9D9D9D] focus-visible:ring-0 focus-visible:border-[#9D9D9D]"
                    />
                    {errors.email && <p className="ml-3 text-sm text-red-600">{errors.email}</p>}
                  </div>

                  <Button
                    type="submit"
                    disabled={showLoader}
                    className="w-full border border-neutral-800 bg-neutral-800 px-4 py-2 text-white hover:border-gray-700 hover:bg-gray-900 cursor-pointer"
                  >
                    {showLoader ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      "Gửi mã xác nhận"
                    )}
                  </Button>
                </form>
              )}

              {/* Step 2: Enter Code and Passwords */}
              {step === 2 && (
                <form onSubmit={handleSubmitStep2} className="w-full space-y-4">
                  {/* 2x2 Grid Layout */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Input
                        type="text"
                        name="codeActive"
                        placeholder="Mã xác nhận"
                        value={formData.codeActive}
                        onChange={handleChange}
                        className="border-0 border-b border-[#9D9D9D] bg-transparent px-4 py-2.5 text-[#9D9D9D] placeholder:text-[#9D9D9D] focus-visible:ring-0 focus-visible:border-[#9D9D9D]"
                      />
                      {errors.codeActive && <p className="ml-3 text-sm text-red-600">{errors.codeActive}</p>}
                    </div>

                    <div className="space-y-1">
                      <Input
                        type="password"
                        name="password"
                        placeholder="Mật khẩu mới"
                        value={formData.password}
                        onChange={handleChange}
                        className="border-0 border-b border-[#9D9D9D] bg-transparent px-4 py-2.5 text-[#9D9D9D] placeholder:text-[#9D9D9D] focus-visible:ring-0 focus-visible:border-[#9D9D9D]"
                      />
                      {errors.password && <p className="ml-3 text-sm text-red-600">{errors.password}</p>}
                    </div>

                    <div className="space-y-1">
                      <Input
                        type="text"
                        name="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                        disabled
                        className="border-0 border-b border-[#9D9D9D] bg-transparent px-4 py-2.5 text-[#9D9D9D] placeholder:text-[#9D9D9D] focus-visible:ring-0 focus-visible:border-[#9D9D9D]"
                      />
                    </div>

                    <div className="space-y-1">
                      <Input
                        type="password"
                        name="confirmPassword"
                        placeholder="Xác nhận mật khẩu"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="border-0 border-b border-[#9D9D9D] bg-transparent px-4 py-2.5 text-[#9D9D9D] placeholder:text-[#9D9D9D] focus-visible:ring-0 focus-visible:border-[#9D9D9D]"
                      />
                      {errors.confirmPassword && <p className="ml-3 text-sm text-red-600">{errors.confirmPassword}</p>}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={showLoader}
                    className="w-full border border-neutral-800 bg-neutral-800 px-4 py-2 text-white hover:border-gray-700 hover:bg-gray-900 cursor-pointer"
                  >
                    {showLoader ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      "Đổi mật khẩu"
                    )}
                  </Button>
                </form>
              )}

              {/* Back to Login Link */}
              <div className="mt-4 text-center">
                <button
                  onClick={() => router.push("/auth/login")}
                  className="text-sm font-medium text-gray-900 hover:underline cursor-pointer"
                >
                  Quay lại đăng nhập
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Suspense } from "react";
export default function ChangePasswordPage() {
  return (
    <Suspense fallback={null}>
      <ChangePassword />
    </Suspense>
  );
}