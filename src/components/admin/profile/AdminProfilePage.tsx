"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "next-auth";
import Image from "next/image";
import { Copy, Check, Eye, EyeOff, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { userService, getAvatarUrl, type UserFullDto } from "@/services/user";
import { authService } from "@/services/auth";

interface Props {
  session: Session | null;
}

type Gender = "MALE" | "FEMALE" | "OTHER" | "";
type PasswordStep = "request" | "verify";

function InitialAvatar({ name, size = 96 }: { name: string; size?: number }) {
  const initial = name.charAt(0).toUpperCase() || "A";
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="rounded-full bg-[var(--admin-green-mid)] text-[var(--admin-green-dark)] flex items-center justify-center font-bold shrink-0"
    >
      {initial}
    </div>
  );
}

export default function AdminProfilePage({ session }: Props) {
  const accessToken = session?.user?.access_token ?? "";
  const userId = session?.user?.id ?? "";

  const [profile, setProfile] = useState<UserFullDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [saving, setSaving] = useState(false);

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password state
  const [pwStep, setPwStep] = useState<PasswordStep>("request");
  const [pwSending, setPwSending] = useState(false);
  const [pwCode, setPwCode] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showPwNew, setShowPwNew] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // Copy email
  const [copied, setCopied] = useState(false);

  // Load profile on mount
  useEffect(() => {
    if (!userId || !accessToken) return;
    setLoading(true);
    userService
      .getUserWithMedia(userId, accessToken)
      .then((res) => {
        const data = res?.data as UserFullDto | undefined;
        if (data) {
          setProfile(data);
          setFirstName(data.firstName ?? "");
          setLastName(data.lastName ?? "");
          setPhone(data.phone ?? "");
          setGender((data.gender as Gender) ?? "");
        }
      })
      .catch((err) => {
        console.error("[AdminProfilePage] Failed to load profile:", err);
        toast.error("Không thể tải thông tin hồ sơ");
      })
      .finally(() => setLoading(false));
  }, [userId, accessToken]);

  const avatarUrl = avatarPreview ?? getAvatarUrl(profile?.userMedia ?? []) ?? profile?.image;
  const displayName =
    [profile?.lastName, profile?.firstName].filter(Boolean).join(" ") ||
    session?.user?.name ||
    session?.user?.email ||
    "Admin";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSaveProfile() {
    if (!userId || !accessToken) return;
    setSaving(true);
    try {
      const res = await userService.updateUser(
        userId,
        { firstName, lastName, phone, gender: gender || undefined },
        accessToken,
        avatarFile ?? undefined
      );
      const updated = res?.data as UserFullDto | undefined;
      if (updated) {
        setProfile(updated);
        setAvatarFile(null);
        setAvatarPreview(null);
      }
      toast.success("Cập nhật hồ sơ thành công");
    } catch (err) {
      console.error("[AdminProfilePage] Failed to save profile:", err);
      toast.error("Cập nhật hồ sơ thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendPasswordCode() {
    if (!session?.user?.email) return;
    setPwSending(true);
    try {
      await authService.retryPassword({ email: session.user.email });
      toast.success("Mã xác nhận đã được gửi đến email của bạn");
      setPwStep("verify");
    } catch (err) {
      console.error("[AdminProfilePage] Failed to send password code:", err);
      toast.error("Gửi mã xác nhận thất bại");
    } finally {
      setPwSending(false);
    }
  }

  async function handleChangePassword() {
    if (!session?.user?.email) return;
    if (pwNew !== pwConfirm) {
      toast.error("Mật khẩu mới không khớp");
      return;
    }
    if (!pwCode.trim()) {
      toast.error("Vui lòng nhập mã xác nhận");
      return;
    }
    setPwSaving(true);
    try {
      await authService.changePassword({
        email: session.user.email,
        codeActive: pwCode,
        password: pwNew,
        confirmPassword: pwConfirm,
      });
      toast.success("Đổi mật khẩu thành công");
      setPwStep("request");
      setPwCode("");
      setPwNew("");
      setPwConfirm("");
    } catch (err) {
      console.error("[AdminProfilePage] Failed to change password:", err);
      toast.error("Đổi mật khẩu thất bại. Kiểm tra lại mã xác nhận.");
    } finally {
      setPwSaving(false);
    }
  }

  function handleCopyEmail() {
    const email = profile?.email ?? session?.user?.email ?? "";
    if (!email) return;
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="animate-spin text-[var(--admin-green-dark)]" size={32} />
      </div>
    );
  }

  const email = profile?.email ?? session?.user?.email ?? "";
  const username = profile?.username ?? "";

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-[1200px] mx-auto">
      <h1 className="text-[22px] font-bold text-[var(--admin-green-dark)] mb-6 tracking-tight">
        Thông tin của tôi
      </h1>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Left column ─────────────────────────────────────── */}
        <div className="flex flex-col gap-5 w-full lg:w-[340px] shrink-0">
          {/* Avatar card */}
          <div className="bg-white rounded-lg shadow-[var(--admin-card-shadow)] p-5 flex flex-col items-center gap-3">
            <div className="w-full flex items-center justify-between mb-1">
              <span className="text-[17px] font-bold text-[#23272e]">Ảnh đại diện</span>
            </div>
            <div className="relative w-24 h-24 rounded-full overflow-hidden shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <InitialAvatar name={displayName} size={96} />
              )}
            </div>
            <p className="text-[17px] font-bold text-[#23272e]">{displayName}</p>
            <div className="flex items-center gap-2 text-[13px] text-[#6a717f]">
              <span className="truncate max-w-[220px]">{email}</span>
              <button
                onClick={handleCopyEmail}
                className="cursor-pointer text-[#6a717f] hover:text-[var(--admin-green-dark)] transition-colors shrink-0"
                aria-label="Sao chép email"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Password change card */}
          <div className="bg-white rounded-lg shadow-[var(--admin-card-shadow)] p-5 flex flex-col gap-4">
            <p className="text-[17px] font-bold text-[#23272e]">Đổi mật khẩu</p>

            {pwStep === "request" ? (
              <>
                <p className="text-[13px] text-[#6a717f] leading-relaxed">
                  Chúng tôi sẽ gửi mã xác nhận đến email{" "}
                  <span className="font-semibold text-[var(--admin-green-dark)]">{email}</span>{" "}
                  để xác thực trước khi đổi mật khẩu.
                </p>
                <Button
                  onClick={handleSendPasswordCode}
                  disabled={pwSending}
                  className="w-full cursor-pointer"
                >
                  {pwSending && <Loader2 size={15} className="animate-spin mr-2" />}
                  Gửi mã xác nhận
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[14px] text-[#023337]">Mã xác nhận</Label>
                  <Input
                    placeholder="Nhập mã từ email"
                    value={pwCode}
                    onChange={(e) => setPwCode(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[14px] text-[#023337]">Mật khẩu mới</Label>
                  <div className="relative">
                    <Input
                      type={showPwNew ? "text" : "password"}
                      placeholder="Nhập mật khẩu mới"
                      value={pwNew}
                      onChange={(e) => setPwNew(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a717f] cursor-pointer"
                    >
                      {showPwNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[14px] text-[#023337]">Nhập lại mật khẩu mới</Label>
                  <div className="relative">
                    <Input
                      type={showPwConfirm ? "text" : "password"}
                      placeholder="Nhập lại mật khẩu mới"
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a717f] cursor-pointer"
                    >
                      {showPwConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      setPwStep("request");
                      setPwCode("");
                      setPwNew("");
                      setPwConfirm("");
                    }}
                  >
                    Huỷ
                  </Button>
                  <Button
                    className="flex-1 cursor-pointer"
                    onClick={handleChangePassword}
                    disabled={pwSaving}
                  >
                    {pwSaving && <Loader2 size={15} className="animate-spin mr-2" />}
                    Lưu mật khẩu
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ────────────────────────────────────── */}
        <div className="flex-1 min-w-0 w-full bg-white rounded-lg shadow-[var(--admin-card-shadow)] p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-[17px] font-bold text-[#23272e]">Cập nhật trang cá nhân</p>
            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              size="sm"
              className="cursor-pointer"
            >
              {saving && <Loader2 size={14} className="animate-spin mr-1.5" />}
              Lưu thay đổi
            </Button>
          </div>

          {/* Avatar upload row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 mb-8">
            <div className="relative w-16 h-16 rounded-full overflow-hidden shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <InitialAvatar name={displayName} size={64} />
              )}
            </div>
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer gap-2"
              >
                <Upload size={15} />
                Tải ảnh mới
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRemoveAvatar}
                className="cursor-pointer"
                disabled={!avatarPreview}
              >
                Xóa
              </Button>
            </div>
          </div>

          {/* Form fields — 2-column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
            {/* firstName */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[14px] text-[#023337]">Tên</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nhập tên"
              />
            </div>

            {/* lastName */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[14px] text-[#023337]">Họ và tên đệm</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nhập họ và tên đệm"
              />
            </div>

            {/* gender */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[14px] text-[#023337]">Giới tính</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Chọn giới tính" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Nam</SelectItem>
                  <SelectItem value="FEMALE">Nữ</SelectItem>
                  <SelectItem value="OTHER">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* phone */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[14px] text-[#023337]">Số điện thoại</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nhập số điện thoại"
              />
            </div>

            {/* email — read only */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[14px] text-[#023337]">E-mail</Label>
              <Input value={email} disabled className="bg-gray-50 text-gray-400" />
            </div>

            {/* username — read only */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[14px] text-[#023337]">Tên đăng nhập</Label>
              <Input value={username} disabled className="bg-gray-50 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
