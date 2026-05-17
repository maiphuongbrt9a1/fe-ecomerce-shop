"use client";

import Image from "next/image";
import { useState } from "react";

interface RowImageProps {
  src: string | null;
  alt: string;
  /** Pixel size — matches the wrapper div. Next/Image needs explicit dimensions
   *  so it can request a tiny optimized thumbnail instead of the full S3 file. */
  size?: number;
}

/**
 * Thumbnail cell for list/table rows.
 * Falls back to a gray placeholder when the source is missing or fails to load.
 * The fallback uses local state instead of mutating the DOM so Next/Image keeps
 * its optimizer wrapper intact.
 */
export default function RowImage({ src, alt, size = 36 }: RowImageProps) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return <div className="w-full h-full bg-gray-200" />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      className="w-full h-full object-cover"
      onError={() => setErrored(true)}
    />
  );
}
