"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { addressService } from "@/services/address";
import type { CreateAddressDto, AddressDto } from "@/dto/address";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editAddress?: AddressDto | null;
}

interface Province {
  code: string;
  name: string;
  districts: District[];
}

interface District {
  code: string;
  name: string;
  wards: Ward[];
}

interface Ward {
  code: string;
  name: string;
}

export default function AddressModal({ isOpen, onClose, onSuccess, editAddress }: AddressModalProps) {
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for click outside detection
  const provinceDropdownRef = useRef<HTMLDivElement>(null);
  const districtDropdownRef = useRef<HTMLDivElement>(null);
  const wardDropdownRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Location data
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Search states
  const [provinceSearch, setProvinceSearch] = useState("");
  const [districtSearch, setDistrictSearch] = useState("");
  const [wardSearch, setWardSearch] = useState("");
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);
  const [showWardDropdown, setShowWardDropdown] = useState(false);

  const [formData, setFormData] = useState({
    street: "",
    ward: "",
    district: "",
    province: "",
    zipCode: "",
    country: "Vietnam",
  });

  // Load Vietnam provinces data
  useEffect(() => {
    const loadProvinces = async () => {
      setIsLoadingLocation(true);
      try {
        // Using Vietnam Provinces API
        const response = await fetch("https://provinces.open-api.vn/api/p/");
        const data = await response.json();
        setProvinces(data);
      } catch (err) {
        console.error("[AddressModal] Failed to load provinces:", err);
      } finally {
        setIsLoadingLocation(false);
      }
    };

    if (isOpen) {
      loadProvinces();
    }
  }, [isOpen]);

  // Load districts when province is selected
  const loadDistricts = async (provinceCode: string) => {
    try {
      const response = await fetch(`https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`);
      const data = await response.json();
      setDistricts(data.districts || []);
      setWards([]);
      setFormData((prev) => ({ ...prev, district: "", ward: "" }));
      setDistrictSearch("");
      setWardSearch("");
    } catch (err) {
      console.error("[AddressModal] Failed to load districts:", err);
    }
  };

  // Load wards when district is selected
  const loadWards = async (districtCode: string) => {
    try {
      const response = await fetch(`https://provinces.open-api.vn/api/d/${districtCode}?depth=2`);
      const data = await response.json();
      setWards(data.wards || []);
      setFormData((prev) => ({ ...prev, ward: "" }));
      setWardSearch("");
    } catch (err) {
      console.error("[AddressModal] Failed to load wards:", err);
    }
  };

  // Load edit data when modal opens
  useEffect(() => {
    if (editAddress) {
      setFormData({
        street: editAddress.street,
        ward: editAddress.ward,
        district: editAddress.district,
        province: editAddress.province,
        zipCode: editAddress.zipCode,
        country: editAddress.country,
      });
      setProvinceSearch(editAddress.province);
      setDistrictSearch(editAddress.district);
      setWardSearch(editAddress.ward);
    } else {
      // Reset form for new address
      setFormData({
        street: "",
        ward: "",
        district: "",
        province: "",
        zipCode: "",
        country: "Vietnam",
      });
      setProvinceSearch("");
      setDistrictSearch("");
      setWardSearch("");
    }
    setError(null);
  }, [editAddress, isOpen]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle province selection
  const handleProvinceSelect = (province: Province) => {
    setFormData((prev) => ({ ...prev, province: province.name, district: "", ward: "" }));
    setProvinceSearch(province.name);
    setShowProvinceDropdown(false);
    loadDistricts(province.code);
  };

  // Handle district selection
  const handleDistrictSelect = (district: District) => {
    setFormData((prev) => ({ ...prev, district: district.name, ward: "" }));
    setDistrictSearch(district.name);
    setShowDistrictDropdown(false);
    loadWards(district.code);
  };

  // Handle ward selection
  const handleWardSelect = (ward: Ward) => {
    setFormData((prev) => ({ ...prev, ward: ward.name }));
    setWardSearch(ward.name);
    setShowWardDropdown(false);
  };

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (provinceDropdownRef.current && !provinceDropdownRef.current.contains(event.target as Node)) {
        setShowProvinceDropdown(false);
      }
      if (districtDropdownRef.current && !districtDropdownRef.current.contains(event.target as Node)) {
        setShowDistrictDropdown(false);
      }
      if (wardDropdownRef.current && !wardDropdownRef.current.contains(event.target as Node)) {
        setShowWardDropdown(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  // Filter provinces by search
  const filteredProvinces = provinces.filter((p) =>
    p.name.toLowerCase().includes(provinceSearch.toLowerCase())
  );

  // Filter districts by search
  const filteredDistricts = districts.filter((d) =>
    d.name.toLowerCase().includes(districtSearch.toLowerCase())
  );

  // Filter wards by search
  const filteredWards = wards.filter((w) =>
    w.name.toLowerCase().includes(wardSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user?.id || !session?.user?.access_token) {
      setError("Bạn chưa đăng nhập");
      return;
    }

    // Validate required fields
    if (!formData.street || !formData.ward || !formData.district || !formData.province || !formData.zipCode || !formData.country) {
      setError("Vui lòng điền đầy đủ thông tin địa chỉ");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const userId = parseInt(session.user.id, 10);
      
      if (editAddress) {
        // Update existing address
        const updateData = {
          street: formData.street,
          ward: formData.ward,
          district: formData.district,
          province: formData.province,
          zipCode: formData.zipCode,
          country: formData.country,
        };
        
        await addressService.updateAddress(editAddress.id, updateData, session.user.access_token);
      } else {
        // Create new address
        const createData: CreateAddressDto = {
          userId,
          street: formData.street,
          ward: formData.ward,
          district: formData.district,
          province: formData.province,
          zipCode: formData.zipCode,
          country: formData.country,
        };
        
        await addressService.createAddress(createData, session.user.access_token);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("[AddressModal] Failed to save address:", err);
      setError(err?.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto"
      onClick={handleOverlayClick}
    >
      <div className="bg-white w-full max-w-2xl my-8" ref={modalContentRef}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold">
            {editAddress ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}
          </h2>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-600 hover:text-black text-2xl leading-none h-auto p-1"
          >
            ×
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Street address */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Địa chỉ <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.street}
              onChange={(e) => handleChange("street", e.target.value)}
              placeholder="Số nhà, tên đường"
              required
            />
          </div>

          {/* Location details */}
          <div className="grid grid-cols-3 gap-4">
            <div className="relative" ref={provinceDropdownRef}>
              <label className="block text-sm font-medium mb-1">
                Tỉnh/Thành phố <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={provinceSearch}
                onChange={(e) => {
                  setProvinceSearch(e.target.value);
                  setShowProvinceDropdown(true);
                }}
                onFocus={() => setShowProvinceDropdown(true)}
                placeholder="Tìm tỉnh/thành phố"
                required
              />
              {showProvinceDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-[var(--border-primary)] max-h-60 overflow-y-auto">
                  {isLoadingLocation ? (
                    <div className="px-3 py-2 text-gray-500 text-sm">Đang tải...</div>
                  ) : filteredProvinces.length === 0 ? (
                    <div className="px-3 py-2 text-gray-500 text-sm">Không tìm thấy</div>
                  ) : (
                    filteredProvinces.map((province) => (
                      <div
                        key={province.code}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => handleProvinceSelect(province)}
                      >
                        {province.name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="relative" ref={districtDropdownRef}>
              <label className="block text-sm font-medium mb-1">
                Quận/Huyện <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={districtSearch}
                onChange={(e) => {
                  setDistrictSearch(e.target.value);
                  setShowDistrictDropdown(true);
                }}
                onFocus={() => setShowDistrictDropdown(true)}
                placeholder="Tìm quận/huyện"
                disabled={!formData.province}
                required
                className="disabled:bg-gray-50"
              />
              {showDistrictDropdown && districts.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-[var(--border-primary)] max-h-60 overflow-y-auto">
                  {filteredDistricts.length === 0 ? (
                    <div className="px-3 py-2 text-gray-500 text-sm">Không tìm thấy</div>
                  ) : (
                    filteredDistricts.map((district) => (
                      <div
                        key={district.code}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => handleDistrictSelect(district)}
                      >
                        {district.name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="relative" ref={wardDropdownRef}>
              <label className="block text-sm font-medium mb-1">
                Phường/Xã <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={wardSearch}
                onChange={(e) => {
                  setWardSearch(e.target.value);
                  setShowWardDropdown(true);
                }}
                onFocus={() => setShowWardDropdown(true)}
                placeholder="Tìm phường/xã"
                disabled={!formData.district}
                required
                className="disabled:bg-gray-50"
              />
              {showWardDropdown && wards.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-[var(--border-primary)] max-h-60 overflow-y-auto">
                  {filteredWards.length === 0 ? (
                    <div className="px-3 py-2 text-gray-500 text-sm">Không tìm thấy</div>
                  ) : (
                    filteredWards.map((ward) => (
                      <div
                        key={ward.code}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => handleWardSelect(ward)}
                      >
                        {ward.name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Zip code and country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Mã bưu điện <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.zipCode}
                onChange={(e) => handleChange("zipCode", e.target.value)}
                placeholder="Nhập mã bưu điện"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Quốc gia <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.country}
                onChange={(e) => handleChange("country", e.target.value)}
                placeholder="Nhập quốc gia"
                required
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-[var(--border-primary)] px-4 py-3 h-auto"
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[var(--bg-button)] text-[var(--text-inverse)] px-4 py-3 h-auto hover:bg-[var(--bg-button-hover)] disabled:bg-gray-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang lưu..." : editAddress ? "Cập nhật" : "Thêm địa chỉ"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
