"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useProfile } from "./ProfileContext";
import { userService } from "../../services/user";
import { addressService } from "../../services/address";
import { useSession } from "next-auth/react";
import AddressModal from "./AddressModal";
import type { AddressDto } from "@/dto/address";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const subTabs = ["Hồ sơ", "Địa chỉ", "Đổi mật khẩu"];

export default function ProfileContent() {
    const profile = useProfile();
    const { data: session } = useSession();
    const router = useRouter();
    const [activeSubTab, setActiveSubTab] = useState("Hồ sơ");
    const [isEditing, setIsEditing] = useState(false);

    type Gender = "MALE" | "FEMALE" | "OTHER" | "";

    const [username, setUsername] = useState(profile?.username || "");
    const [lastName, setLastName] = useState(profile?.lastName || "");
    const [firstName, setFirstName] = useState(profile?.firstName || "");
    const [phone, setPhone] = useState(profile?.phone || "");
    const [gender, setGender] = useState<Gender>((profile?.gender || "") as Gender);

    // Sync state whenever profile context updates (e.g. after router.refresh())
    useEffect(() => {
      setLastName(profile?.lastName || "");
      setFirstName(profile?.firstName || "");
      setUsername(profile?.username || "");
      setPhone(profile?.phone || "");
      setGender((profile?.gender || "") as Gender);
    }, [profile]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Change password state
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [pwLoading, setPwLoading] = useState(false);
    const [pwMessage, setPwMessage] = useState<string | null>(null);
    const [pwError, setPwError] = useState<string | null>(null);

    const handleChangePassword = async () => {
        setPwMessage(null);
        setPwError(null);
        if (!newPassword || newPassword.length < 6) {
            setPwError("Mật khẩu mới phải có ít nhất 6 ký tự.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwError("Mật khẩu xác nhận không khớp.");
            return;
        }
        if (!profile?.id || !session?.user?.access_token) {
            setPwError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
            return;
        }
        setPwLoading(true);
        try {
            await userService.updateUser(String(profile.id), { password: newPassword }, session.user.access_token);
            setPwMessage("Đổi mật khẩu thành công.");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            console.error("[ProfileContent] Change password error:", err);
            const { ApiError } = await import("@/utils/api-error");
            setPwError(err instanceof ApiError ? err.message : "Đổi mật khẩu thất bại. Vui lòng thử lại.");
        } finally {
            setPwLoading(false);
        }
    };

    // Address state
    const [addresses, setAddresses] = useState<AddressDto[]>([]);
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<AddressDto | null>(null);
    const [defaultAddressId, setDefaultAddressId] = useState<number | null>(null);
    const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

    // Load addresses when tab changes to Địa chỉ
    useEffect(() => {
        if (activeSubTab === "Địa chỉ" && profile?.id && session?.user?.access_token) {
            loadAddresses();
        }
    }, [activeSubTab, profile?.id, session?.user?.access_token]);

    const loadAddresses = async () => {
        if (!profile?.id || !session?.user?.access_token) return;
        
        setIsLoadingAddresses(true);
        try {
            const userId = typeof profile.id === 'string' ? parseInt(profile.id, 10) : profile.id;
            const response = await addressService.getUserAddresses(userId, session.user.access_token);
            const addressList = Array.isArray(response.data) ? response.data : [];
            setAddresses(addressList);
            
            // Set first address as default if none set
            if (addressList.length > 0 && !defaultAddressId) {
                setDefaultAddressId(addressList[0].id);
            }
        } catch (err) {
            console.error("[ProfileContent] Failed to load addresses:", err);
        } finally {
            setIsLoadingAddresses(false);
        }
    };

    const handleAddAddress = () => {
        setEditingAddress(null);
        setIsAddressModalOpen(true);
    };

    const handleEditAddress = (address: AddressDto) => {
        setEditingAddress(address);
        setIsAddressModalOpen(true);
    };

    const handleDeleteAddress = async (addressId: number) => {
        if (!session?.user?.access_token) return;
        if (!confirm("Bạn có chắc chắn muốn xóa địa chỉ này?")) return;

        try {
            await addressService.deleteAddress(addressId, session.user.access_token);
            
            // Remove from local state
            setAddresses((prev) => prev.filter((addr) => addr.id !== addressId));
            
            // Clear default if deleted
            if (defaultAddressId === addressId) {
                const remaining = addresses.filter((addr) => addr.id !== addressId);
                setDefaultAddressId(remaining.length > 0 ? remaining[0].id : null);
            }
        } catch (err) {
            console.error("[ProfileContent] Failed to delete address:", err);
            toast.error("Không thể xóa địa chỉ. Vui lòng thử lại.");
        }
    };

    const handleSetDefaultAddress = (addressId: number) => {
        setDefaultAddressId(addressId);
        // TODO: Could persist to backend if there's a default address API
    };

    const handleAddressModalSuccess = () => {
        loadAddresses();
    };

    const handleSave = async () => {
        if (!profile?.id) return;
        // Debug log for session and token
        console.log("Session:", session);
        console.log("Access token:", session?.user?.access_token);
        if (!session?.user?.access_token) {
            setError("Bạn chưa đăng nhập hoặc phiên đã hết hạn. Vui lòng đăng nhập lại.");
            return;
        }
        setLoading(true);
        setMessage(null);
        setError(null);

        const updatePayload = {
            username,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            phone: phone || undefined,
            gender: gender || undefined,
        };

        console.log("=== Update User Payload ===");
        console.log("Profile ID:", profile.id);
        console.log("Payload:", JSON.stringify(updatePayload, null, 2));
        console.log("Access Token (first 20 chars):", session.user.access_token?.substring(0, 20));
        console.log("==========================");

        try {
            const res = await userService.updateUser(
                String(profile.id),
                updatePayload,
                session.user.access_token as string
            );
            console.log("[ProfileContent] Update response:", JSON.stringify(res, null, 2));
            setMessage("Cập nhật thành công");
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error("[ProfileContent] Update error:", error);
            const { ApiError } = await import("@/utils/api-error");
            const msg = error instanceof ApiError ? error.message : "Lỗi không xác định";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Sub-tabs */}
            <div className="flex gap-0 mb-4 md:mb-6 bg-white">
                {subTabs.map((tab) => (
                    <Button
                        key={tab}
                        variant="ghost"
                        onClick={() => setActiveSubTab(tab)}
                        className={`flex-1 min-w-0 text-center text-xs sm:text-sm h-auto px-2 py-3 whitespace-normal leading-tight ${
                            activeSubTab === tab
                                ? "font-bold text-black relative after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:bg-black"
                                : "text-gray-600 hover:text-black"
                        }`}
                    >
                        {tab}
                    </Button>
                ))}
            </div>
            <div className="bg-white px-4 py-6 sm:px-8 sm:py-8 md:px-14 md:py-10">
            {/* Content area - Hồ sơ tab */}
            {activeSubTab === "Hồ sơ" && (
                <div className="max-w-4xl">
                    <div className="flex flex-col md:flex-row items-stretch md:items-start gap-6 md:gap-8 md:divide-x">
                        {/* Left column - Form */}
                        <div className="flex-1 space-y-4 md:pr-8">
                            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] items-start md:items-center gap-1 md:gap-4">
                                <Label className="text-sm text-gray-600 font-normal">Tên người dùng</Label>
                                <Input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Nhập tên người dùng"
                                    disabled={!isEditing}
                                    className="text-sm disabled:bg-gray-50"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] items-start md:items-center gap-1 md:gap-4">
                                <Label className="text-sm text-gray-600 font-normal">Họ và tên</Label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Họ và tên đệm"
                                        disabled={!isEditing}
                                        className="flex-1 text-sm disabled:bg-gray-50"
                                    />
                                    <Input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="Tên"
                                        disabled={!isEditing}
                                        className="w-full sm:w-28 text-sm disabled:bg-gray-50"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] items-start md:items-center gap-1 md:gap-4">
                                <Label className="text-sm text-gray-600 font-normal">Email</Label>
                                <Input
                                    type="email"
                                    value={profile?.email || ""}
                                    readOnly
                                    className="text-sm bg-gray-50 text-gray-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] items-start md:items-center gap-1 md:gap-4">
                                <Label className="text-sm text-gray-600 font-normal">Số điện thoại</Label>
                                <Input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Nhập số điện thoại"
                                    disabled={!isEditing}
                                    className="text-sm disabled:bg-gray-50"
                                />
                            </div>

                            {/* Gender selection */}
                            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] items-start md:items-center gap-1 md:gap-4">
                                <Label className="text-sm text-gray-600 font-normal">Giới tính</Label>
                                <RadioGroup
                                    value={gender}
                                    onValueChange={(value) => setGender(value as Gender)}
                                    disabled={!isEditing}
                                    className="flex gap-6"
                                >
                                    <Label className="flex items-center gap-2 cursor-pointer font-normal">
                                        <RadioGroupItem value="MALE" />
                                        <span>Nam</span>
                                    </Label>
                                    <Label className="flex items-center gap-2 cursor-pointer font-normal">
                                        <RadioGroupItem value="FEMALE" />
                                        <span>Nữ</span>
                                    </Label>
                                    <Label className="flex items-center gap-2 cursor-pointer font-normal">
                                        <RadioGroupItem value="OTHER" />
                                        <span>Khác</span>
                                    </Label>
                                </RadioGroup>
                            </div>

                            {/* Unsupported field group (gender) removed per OpenAPI absence */}

                            {/* Unsupported field group (birth date) removed per OpenAPI absence */}

                            {/* Unsupported field (CCCD) removed per OpenAPI absence */}

                            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] items-start md:items-center gap-1 md:gap-4">
                                <div />
                                <div className="flex flex-col gap-2">
                                    <Button
                                        onClick={() => {
                                            if (isEditing) {
                                                handleSave();
                                            } else {
                                                setIsEditing(true);
                                            }
                                        }}
                                        disabled={loading}
                                        className="bg-black text-white px-6 py-2 h-auto text-sm font-semibold hover:bg-gray-800 w-fit"
                                    >
                                        {loading ? "Đang lưu..." : isEditing ? "Lưu" : "Sửa hồ sơ"}
                                    </Button>
                                    {message && <div className="text-green-600 text-sm">{message}</div>}
                                    {error && <div className="text-red-600 text-sm">{error}</div>}
                                </div>
                            </div>
                        </div>

                        {/* Right column - Avatar */}
                        <div className="flex flex-col items-center gap-4 md:pl-8">
                            <div className="relative w-32 h-32 overflow-hidden bg-gray-200">
                                <Image
                                    src={profile?.image || "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=200&q=80"}
                                    alt="Avatar"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <Button variant="outline" className="text-sm border-gray-300 px-4 py-2 h-auto">
                                Chọn Ảnh
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {activeSubTab === "Địa chỉ" && (
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold">Địa chỉ của tôi</h2>
                        <Button
                            onClick={handleAddAddress}
                            className="bg-black text-white px-4 py-2 h-auto text-sm hover:bg-gray-800 flex items-center gap-2"
                        >
                            <span>+</span> Thêm địa chỉ mới
                        </Button>
                    </div>

                    {isLoadingAddresses ? (
                        <div className="text-center text-gray-600 py-8">Đang tải...</div>
                    ) : addresses.length === 0 ? (
                        <div className="border border-dashed border-gray-300 p-12 text-center text-gray-500">
                            <i className="fa-solid fa-location-dot text-4xl mb-4 text-gray-300" />
                            <p>Bạn chưa có địa chỉ nào</p>
                            <Button
                                variant="outline"
                                onClick={handleAddAddress}
                                className="mt-4 border-black px-4 py-2 h-auto text-sm"
                            >
                                Thêm địa chỉ mới
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {addresses.map((address) => {
                                const isDefault = defaultAddressId === address.id;
                                const fullAddress = `${address.street}, ${address.ward}, ${address.district}, ${address.province}${address.zipCode ? `, ${address.zipCode}` : ""}, ${address.country}`;
                                
                                return (
                                    <div
                                        key={address.id}
                                        className="border bg-white p-4"
                                    >
                                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 mb-2 break-words">
                                                    {fullAddress}
                                                </p>
                                                {isDefault && (
                                                    <span className="inline-block border border-black px-2 py-1 text-xs">
                                                        Mặc định
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-2 md:ml-4 md:shrink-0">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => handleDeleteAddress(address.id)}
                                                    className="text-red-600 border-red-600 px-3 py-1 h-auto text-sm hover:bg-red-50 hover:text-red-600"
                                                >
                                                    Xóa
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => handleEditAddress(address)}
                                                    className="border-black px-3 py-1 h-auto text-sm"
                                                >
                                                    Cập nhật
                                                </Button>
                                                {!isDefault && (
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => handleSetDefaultAddress(address.id)}
                                                        className="border-gray-300 px-3 py-1 h-auto text-sm"
                                                    >
                                                        Đặt làm mặc định
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Address Modal */}
                    <AddressModal
                        isOpen={isAddressModalOpen}
                        onClose={() => setIsAddressModalOpen(false)}
                        onSuccess={handleAddressModalSuccess}
                        editAddress={editingAddress}
                    />
                </div>
            )}
            {activeSubTab === "Đổi mật khẩu" && (
                <div className="max-w-md space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] items-start md:items-center gap-1 md:gap-4">
                        <Label className="text-sm text-gray-600 font-normal">Mật khẩu mới</Label>
                        <Input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Nhập mật khẩu mới"
                            className="text-sm"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] items-start md:items-center gap-1 md:gap-4">
                        <Label className="text-sm text-gray-600 font-normal">Xác nhận mật khẩu</Label>
                        <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Nhập lại mật khẩu mới"
                            className="text-sm"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] items-start md:items-center gap-1 md:gap-4">
                        <div />
                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={handleChangePassword}
                                disabled={pwLoading}
                                className="bg-black text-white px-6 py-2 h-auto text-sm font-semibold hover:bg-gray-800 w-fit"
                            >
                                {pwLoading ? "Đang lưu..." : "Đổi mật khẩu"}
                            </Button>
                            {pwMessage && <p className="text-green-600 text-sm">{pwMessage}</p>}
                            {pwError && <p className="text-red-600 text-sm">{pwError}</p>}
                        </div>
                    </div>
                </div>
            )}
            </div>    
        </>
    );
}
