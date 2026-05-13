"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/auth";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useState } from "react";
import Image from "next/image";

function Signup() {
  const [user, setUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [showLoader, setShowLoader] = useState(false);
  const router = useRouter();

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setUser({ ...user, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    let newErrors = { firstName: "", lastName: "", email: "", password: "" };

    const emailRegex = /^(?:[a-zA-Z0-9_'^&+%`{}~!-]+(?:\.[a-zA-Z0-9_'^&+%`{}~!-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z-]*[a-zA-Z]:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]+)\])$/;

    if (!user.firstName.trim()) {
      newErrors.firstName = "Vui lòng nhập họ.";
    }

    if (!user.lastName.trim()) {
      newErrors.lastName = "Vui lòng nhập tên.";
    }

    if (!user.email.trim()) {
      newErrors.email = "Vui lòng nhập email.";
    } else if (!emailRegex.test(user.email.trim())) {
      newErrors.email = "Email không hợp lệ.";
    }

    if (!user.password.trim()) {
      newErrors.password = "Vui lòng nhập mật khẩu.";
    } else if (user.password.trim().length < 8) {
      newErrors.password = "Mật khẩu phải có ít nhất 8 ký tự.";
    }

    if (
      newErrors.firstName ||
      newErrors.lastName ||
      newErrors.email ||
      newErrors.password
    ) {
      setErrors(newErrors);
      return;
    }

    setShowLoader(true);

    const email = user.email.trim();
    const password = user.password.trim();
    const firstName = user.firstName.trim();
    const lastName = user.lastName.trim();

    const data = {
      email: email,
      password: password,
      firstName: firstName,
      lastName: lastName,
      username:
        firstName + lastName + Math.floor(Math.random() * 100000).toString(),
      phone: "", // Backend requires this field
    }

    console.log(">>> check data: ", data);

    try {
      const res = await authService.signup(data);
      console.log(">>> check res: ", res);
      router.push(`/auth/verify/${res?.data?.id}`);
    } catch (error) {
      const { ApiError } = await import("@/utils/api-error");
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.error("Email này đã được đăng ký. Vui lòng dùng email khác.");
      } else {
        toast.error("Đăng ký thất bại. Vui lòng thử lại.");
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

      {/* Right Side - Signup Form */}
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
              Đăng ký tài khoản Paplé
            </h2>

            {/* Signup Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <div className="space-y-1">
                <Input
                  type="text"
                  name="firstName"
                  placeholder="Họ"
                  value={user.firstName}
                  onChange={handleChange}
                  className="border-0 border-b border-[#9D9D9D] bg-transparent px-4 py-2.5 text-[#9D9D9D] placeholder:text-[#9D9D9D] focus-visible:ring-0 focus-visible:border-[#9D9D9D]"
                />
                {errors.firstName && <p className="ml-3 text-sm text-red-600">{errors.firstName}</p>}
              </div>
              <div className="space-y-1">
                <Input
                  type="text"
                  name="lastName"
                  placeholder="Tên"
                  value={user.lastName}
                  onChange={handleChange}
                  className="border-0 border-b border-[#9D9D9D] bg-transparent px-4 py-2.5 text-[#9D9D9D] placeholder:text-[#9D9D9D] focus-visible:ring-0 focus-visible:border-[#9D9D9D]"
                />
                {errors.lastName && <p className="ml-3 text-sm text-red-600">{errors.lastName}</p>}
              </div>
              <div className="space-y-1">
                <Input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={user.email}
                  onChange={handleChange}
                  className="border-0 border-b border-[#9D9D9D] bg-transparent px-4 py-2.5 text-[#9D9D9D] placeholder:text-[#9D9D9D] focus-visible:ring-0 focus-visible:border-[#9D9D9D]"
                />
                {errors.email && <p className="ml-3 text-sm text-red-600">{errors.email}</p>}
              </div>
              <div className="space-y-1">
                <Input
                  type="password"
                  name="password"
                  placeholder="Mật khẩu (tối thiểu 8 ký tự)"
                  value={user.password}
                  onChange={handleChange}
                  className="border-0 border-b border-[#9D9D9D] bg-transparent px-4 py-2.5 text-[#9D9D9D] placeholder:text-[#9D9D9D] focus-visible:ring-0 focus-visible:border-[#9D9D9D]"
                />
                {errors.password && <p className="ml-3 text-sm text-red-600">{errors.password}</p>}
              </div>

              {/* Signup Button */}
              <Button
                type="submit"
                disabled={showLoader}
                className="w-full h-auto border border-neutral-800 bg-neutral-800 px-4 py-3 text-sm font-medium text-white hover:border-gray-700 hover:bg-gray-900 cursor-pointer"
              >
                {showLoader ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  "Đăng ký"
                )}
              </Button>
            </form>

            {/* Login Link */}
            <div className="mt-4 w-full text-center">
              <button
                onClick={() => router.push("/auth/login")}
                className="w-full rounded-none border border-[#000000] bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 cursor-pointer"
              >
                Đã có tài khoản? Đăng nhập
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
