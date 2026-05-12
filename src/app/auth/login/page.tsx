"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoaderCircle } from "lucide-react";
import { ChangeEvent, FormEvent, Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticate } from "@/utils/actions";
import ModalReactive from "@/components/auth/ModalReactive";
import Image from "next/image";
import { toast } from "sonner";
import { authService } from "@/services/auth";
import { sanitizeCallbackUrl } from "@/utils/auth-intent";
import Link from "next/link";

function Login() {
  const [user, setUser] = useState({ email: "", password: "" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [showLoader, setShowLoader] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const isAdmin = session.user.role === "ADMIN" || session.user.isAdmin === true;
      const dest = isAdmin ? "/admin" : (callbackUrl || "/homepage");
      router.push(dest);
    }
  }, [status, session, router, callbackUrl]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setUser({ ...user, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = user.email.trim();
    const password = user.password.trim();
    let newErrors = { email: "", password: "" };

    const emailRegex = /^(?:[a-zA-Z0-9_'^&amp;+%`{}~!-]+(?:\.[a-zA-Z0-9_'^&amp;+%`{}~!-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z-]*[a-zA-Z]:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]+)\])$/;
    if (!email) {
      newErrors.email = "Vui lòng nhập email.";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Email không hợp lệ.";
    }

    if (!password) {
      newErrors.password = "Vui lòng nhập mật khẩu.";
    } else if (password.length < 8) {
      newErrors.password = "Mật khẩu phải có ít nhất 8 ký tự.";
    }

    if (newErrors.email || newErrors.password) {
      setErrors(newErrors);
      return;
    }

    setShowLoader(true);

    const res = await authenticate(user.email, user.password);

    if (res?.error) {
      console.error("Login error:", res?.error);

      if (res?.code === 2) {
        setIsModalOpen(true);
        setUserEmail(user.email);
        setShowLoader(false);
        return;
      }

      if (res?.code === 3 || res?.code === 1) {
        try {
          const check = await authService.checkEmail(user.email);
          if (!check?.data?.exists) {
            toast.error("Email này chưa được đăng ký tài khoản.");
            setErrors({ email: "Email chưa được đăng ký", password: "" });
          } else {
            toast.error("Mật khẩu không chính xác.");
            setErrors({ email: "", password: "Mật khẩu không đúng" });
          }
        } catch {
          toast.error("Email hoặc mật khẩu không chính xác.");
        }
      } else {
        toast.error("Đã xảy ra lỗi. Vui lòng thử lại sau.");
      }
      setShowLoader(false);
    } else {
      window.location.href = callbackUrl || "/";
    }
  };

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        {/* Left Side - Image */}
        <div className="hidden h-full w-1/2 bg-black lg:flex lg:items-center lg:justify-center">
          <div className="relative h-full w-full">
            <img src="/AuthImg.png" alt="Authentication" className="object-cover w-full h-full" />
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex h-full w-full items-center justify-center bg-white lg:w-1/2">
          <div className="h-full w-full overflow-hidden px-40 py-20">
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
                  Đăng nhập vào Paplé
                </h2>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="w-full space-y-4">
                  <div className="space-y-1">
                    <Input
                      type="email"
                      name="email"
                      placeholder="Nhập email"
                      value={user.email}
                      onChange={handleChange}
                      disabled={showLoader}
                      suppressHydrationWarning
                      className="border-0 border-b border-[#9D9D9D] bg-transparent px-4 py-2.5 text-[#9D9D9D] placeholder:text-[#9D9D9D] focus-visible:ring-0 focus-visible:border-[#9D9D9D] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {errors.email && <p className="ml-3 text-sm text-red-600">{errors.email}</p>}
                  </div>

                  <div className="space-y-1">
                    <Input
                      type="password"
                      name="password"
                      placeholder="Nhập mật khẩu (tối thiểu 8 ký tự)"
                      value={user.password}
                      onChange={handleChange}
                      disabled={showLoader}
                      suppressHydrationWarning
                      className="border-0 border-b border-[#9D9D9D] bg-transparent px-4 py-2.5 text-[#9D9D9D] placeholder:text-[#9D9D9D] focus-visible:ring-0 focus-visible:border-[#9D9D9D] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {errors.password && <p className="ml-3 text-sm text-red-600">{errors.password}</p>}
                  </div>

                  {/* Login Button */}
                  <Button
                    type="submit"
                    disabled={showLoader}
                    className="w-full h-auto border border-neutral-800 bg-neutral-800 px-4 py-3 text-sm font-medium text-white hover:border-gray-700 hover:bg-gray-900 cursor-pointer"
                  >
                    {showLoader ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      "Đăng nhập"
                    )}
                  </Button>
                </form>

                {/* Sign up Link */}
                <div className="mt-4 w-full text-center">
                  <button
                    onClick={() => router.push("/auth/signup")}
                    disabled={showLoader}
                    className="w-full rounded-none border border-[#000000] bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Đăng ký
                  </button>
                </div>

                {/* Forgot Password Link */}
                <div className="mt-4 text-center">
                  <button
                    onClick={() => router.push("/auth/change-password")}
                    className="text-sm font-medium text-gray-900 hover:underline cursor-pointer"
                  >
                    QUÊN MẬT KHẨU?
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModalReactive
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        userEmail={userEmail}
      />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}
